CREATE SCHEMA warehouse;

CREATE TABLE warehouse.site (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 160),
 state text NOT NULL CHECK(state IN ('ACTIVE','RETIRED')),
 UNIQUE(company_id,id)
);

CREATE TABLE dispatch.return_task (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('requested','authorized','assigned','picked_up','received','inspected','closed')),
 discrepancy_open boolean NOT NULL DEFAULT false,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,warehouse_id) REFERENCES warehouse.site(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'warehouseId') IS NOT DISTINCT FROM warehouse_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'discrepancyOpen')::boolean=discrepancy_open)
);
CREATE UNIQUE INDEX one_open_return_task_per_order ON dispatch.return_task(company_id,order_id) WHERE state<>'closed';

CREATE TABLE dispatch.return_task_package (
 company_id uuid NOT NULL,
 return_task_id uuid NOT NULL,
 package_id uuid NOT NULL,
 PRIMARY KEY(company_id,return_task_id,package_id),
 FOREIGN KEY(company_id,return_task_id) REFERENCES dispatch.return_task(company_id,id)
);
CREATE TABLE dispatch.return_task_event (
 company_id uuid NOT NULL,
 return_task_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('REQUESTED','AUTHORIZED','RECEIVED','INSPECTED','CLOSED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,return_task_id,version),
 FOREIGN KEY(company_id,return_task_id) REFERENCES dispatch.return_task(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE FUNCTION dispatch.only_advance_return_task() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Return tasks may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.warehouse_id<>NEW.warehouse_id OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Return task identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT ((OLD.state='requested' AND NEW.state='authorized') OR (OLD.state='authorized' AND NEW.state='received') OR (OLD.state='received' AND NEW.state='inspected') OR (OLD.state='inspected' AND NEW.state='closed')) THEN
  RAISE EXCEPTION 'Return task state transition is invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_task_only_advance BEFORE UPDATE OR DELETE ON dispatch.return_task FOR EACH ROW EXECUTE FUNCTION dispatch.only_advance_return_task();
CREATE TRIGGER return_task_package_append_only BEFORE UPDATE OR DELETE ON dispatch.return_task_package FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER return_task_event_append_only BEFORE UPDATE OR DELETE ON dispatch.return_task_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['warehouse.site','dispatch.return_task','dispatch.return_task_package','dispatch.return_task_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA warehouse TO routefit_api;
GRANT SELECT ON warehouse.site TO routefit_api;
GRANT SELECT,INSERT,UPDATE ON dispatch.return_task TO routefit_api;
GRANT SELECT,INSERT ON dispatch.return_task_package,dispatch.return_task_event TO routefit_api;
