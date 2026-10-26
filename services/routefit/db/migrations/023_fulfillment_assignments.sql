CREATE TABLE dispatch.fulfillment_execution (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('VEHICLE','CARRIER')),
 state text NOT NULL CHECK(state IN ('ACTIVE','ENDED')),
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ended_at timestamptz,
 end_reason text,
 created_by uuid NOT NULL,
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((state='ACTIVE' AND ended_at IS NULL AND end_reason IS NULL) OR (state='ENDED' AND ended_at IS NOT NULL AND length(btrim(end_reason)) BETWEEN 1 AND 128))
);
CREATE UNIQUE INDEX one_active_execution_per_order ON dispatch.fulfillment_execution(company_id,order_id) WHERE state='ACTIVE';
CREATE UNIQUE INDEX one_ready_route_plan_per_vehicle ON dispatch.route_plan(company_id,vehicle_id) WHERE state='ready';

ALTER TABLE partner.carrier_booking ADD COLUMN execution_id uuid;
ALTER TABLE partner.carrier_booking ADD CONSTRAINT carrier_booking_execution_fk FOREIGN KEY(company_id,execution_id) REFERENCES dispatch.fulfillment_execution(company_id,id);
CREATE UNIQUE INDEX carrier_booking_execution_once ON partner.carrier_booking(company_id,execution_id) WHERE execution_id IS NOT NULL;
INSERT INTO dispatch.fulfillment_execution(id,company_id,order_id,kind,state,created_by)
 SELECT md5('carrier-execution:'||id::text)::uuid,company_id,order_id,'CARRIER','ACTIVE',created_by
 FROM partner.carrier_booking
 WHERE state IN ('draft','pending_confirmation','confirmed','pickup_pending','in_transit','delivery_reported','cancel_requested','exception');
UPDATE partner.carrier_booking SET execution_id=md5('carrier-execution:'||id::text)::uuid
 WHERE state IN ('draft','pending_confirmation','confirmed','pickup_pending','in_transit','delivery_reported','cancel_requested','exception');

CREATE TABLE dispatch.assignment (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 execution_id uuid NOT NULL,
 order_id uuid NOT NULL,
 vehicle_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 plan_version_id uuid NOT NULL,
 promise_id uuid NOT NULL,
 load_review_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('offered','accepted','completed','expired','rejected','revoked','superseded')),
 expires_at timestamptz NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,execution_id),
 FOREIGN KEY(company_id,execution_id) REFERENCES dispatch.fulfillment_execution(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,vehicle_id) REFERENCES fleet.vehicle(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,plan_version_id) REFERENCES dispatch.route_plan_version(company_id,id),
 FOREIGN KEY(company_id,promise_id) REFERENCES dispatch.service_promise(company_id,id),
 FOREIGN KEY(company_id,load_review_id) REFERENCES dispatch.load_review(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'vehicleId') IS NOT DISTINCT FROM vehicle_id::text),
 CHECK((snapshot->>'driverId') IS NOT DISTINCT FROM driver_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'version')::bigint=version)
);
CREATE UNIQUE INDEX one_open_assignment_per_order ON dispatch.assignment(company_id,order_id) WHERE state IN ('offered','accepted');

CREATE TABLE dispatch.assignment_event (
 company_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('OFFERED','REVOKED','SUPERSEDED','EXPIRED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,assignment_id,version),
 FOREIGN KEY(company_id,assignment_id) REFERENCES dispatch.assignment(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'assignmentId') IS NOT DISTINCT FROM assignment_id::text),
 CHECK((snapshot->>'version')::bigint=version)
);

CREATE FUNCTION dispatch.only_advance_execution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Fulfillment executions may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.kind<>NEW.kind OR OLD.created_by<>NEW.created_by OR OLD.opened_at<>NEW.opened_at OR OLD.state<>'ACTIVE' OR NEW.state<>'ENDED' THEN
  RAISE EXCEPTION 'Fulfillment execution identity is immutable and may only end once' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fulfillment_execution_only_end BEFORE UPDATE OR DELETE ON dispatch.fulfillment_execution FOR EACH ROW EXECUTE FUNCTION dispatch.only_advance_execution();

CREATE FUNCTION dispatch.only_advance_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignments may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.execution_id<>NEW.execution_id OR OLD.order_id<>NEW.order_id OR OLD.vehicle_id<>NEW.vehicle_id OR OLD.driver_id<>NEW.driver_id OR OLD.plan_version_id<>NEW.plan_version_id OR OLD.promise_id<>NEW.promise_id OR OLD.load_review_id<>NEW.load_review_id OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Assignment identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assignment_only_advance BEFORE UPDATE OR DELETE ON dispatch.assignment FOR EACH ROW EXECUTE FUNCTION dispatch.only_advance_assignment();
CREATE TRIGGER assignment_event_append_only BEFORE UPDATE OR DELETE ON dispatch.assignment_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['dispatch.fulfillment_execution','dispatch.assignment','dispatch.assignment_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION partner.only_advance_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Carrier bookings may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.partner_id<>NEW.partner_id OR OLD.agreement_version_id<>NEW.agreement_version_id OR OLD.execution_id IS DISTINCT FROM NEW.execution_id OR OLD.proposed_amount_minor<>NEW.proposed_amount_minor OR OLD.proposed_currency<>NEW.proposed_currency OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Carrier booking identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
GRANT SELECT,INSERT,UPDATE ON dispatch.fulfillment_execution,dispatch.assignment TO routefit_api;
GRANT SELECT,INSERT ON dispatch.assignment_event TO routefit_api;
