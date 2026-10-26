CREATE TABLE dispatch.route_plan (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 vehicle_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 current_version bigint NOT NULL CHECK(current_version BETWEEN 1 AND 9000000000000),
 state text NOT NULL CHECK(state IN ('proposed','ready','in_progress','completed','cancelled')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,vehicle_id) REFERENCES fleet.vehicle(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'vehicleId') IS NOT DISTINCT FROM vehicle_id::text),
 CHECK((snapshot->>'driverId') IS NOT DISTINCT FROM driver_id::text),
 CHECK((snapshot->>'currentVersion')::bigint=current_version),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);

CREATE TABLE dispatch.route_plan_version (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 plan_id uuid NOT NULL,
 plan_version bigint NOT NULL CHECK(plan_version BETWEEN 1 AND 9000000000000),
 state text NOT NULL CHECK(state IN ('ready','superseded','cancelled')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,plan_id,plan_version),
 FOREIGN KEY(company_id,plan_id) REFERENCES dispatch.route_plan(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'planId') IS NOT DISTINCT FROM plan_id::text),
 CHECK((snapshot->>'planVersion')::bigint=plan_version),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);

CREATE TABLE dispatch.route_stop (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 plan_version_id uuid NOT NULL,
 order_id uuid,
 sequence_no integer NOT NULL CHECK(sequence_no>=1),
 stop_type text NOT NULL CHECK(stop_type IN ('PICKUP','DROPOFF','RETURN','DEPOT')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,plan_version_id,sequence_no),
 FOREIGN KEY(company_id,plan_version_id) REFERENCES dispatch.route_plan_version(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'stopType') IS NOT DISTINCT FROM stop_type)
);

CREATE FUNCTION dispatch.route_plan_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Route plans are append-only' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.vehicle_id<>NEW.vehicle_id OR OLD.driver_id<>NEW.driver_id OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.current_version<OLD.current_version THEN
  RAISE EXCEPTION 'Route plan identity is immutable and versions cannot regress' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER route_plan_only_advance BEFORE UPDATE OR DELETE ON dispatch.route_plan FOR EACH ROW EXECUTE FUNCTION dispatch.route_plan_append_only();
CREATE TRIGGER route_plan_version_append_only BEFORE UPDATE OR DELETE ON dispatch.route_plan_version FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER route_stop_append_only BEFORE UPDATE OR DELETE ON dispatch.route_stop FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['dispatch.route_plan','dispatch.route_plan_version','dispatch.route_stop'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
CREATE POLICY route_plan_order_scope ON dispatch.route_stop AS RESTRICTIVE
 USING(order_id IS NULL OR EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=route_stop.company_id AND d.id=route_stop.order_id))
 WITH CHECK(order_id IS NULL OR EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=route_stop.company_id AND d.id=route_stop.order_id));
