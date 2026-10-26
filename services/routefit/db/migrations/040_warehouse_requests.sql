CREATE TABLE warehouse.request (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 owner_account_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 type text NOT NULL CHECK(type IN ('INBOUND_NOTICE','OUTBOUND_DELIVERY')),
 state text NOT NULL CHECK(state IN ('submitted','accepted','rejected','withdrawn','fulfilled')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,owner_account_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,warehouse_id) REFERENCES warehouse.site(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'type') IS NOT DISTINCT FROM type),
 CHECK((snapshot->>'ownerAccountId') IS NOT DISTINCT FROM owner_account_id::text),
 CHECK((snapshot->>'warehouseId') IS NOT DISTINCT FROM warehouse_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);
CREATE INDEX warehouse_request_queue ON warehouse.request(company_id,type,state,created_at DESC,id DESC);

CREATE TABLE warehouse.request_event (
 company_id uuid NOT NULL,
 request_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('SUBMITTED','ACCEPTED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id,version),
 FOREIGN KEY(company_id,request_id) REFERENCES warehouse.request(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE warehouse.request_evidence (
 company_id uuid NOT NULL,
 request_id uuid NOT NULL,
 evidence_file_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('PACKING','ACCEPTANCE')),
 PRIMARY KEY(company_id,request_id,evidence_file_id,role),
 FOREIGN KEY(company_id,request_id) REFERENCES warehouse.request(company_id,id),
 FOREIGN KEY(company_id,evidence_file_id) REFERENCES evidence.file(company_id,id)
);

CREATE FUNCTION warehouse.only_advance_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Warehouse requests may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.owner_account_id<>NEW.owner_account_id OR OLD.warehouse_id<>NEW.warehouse_id OR OLD.type<>NEW.type OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Warehouse request identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT (OLD.state='submitted' AND NEW.state='accepted') THEN RAISE EXCEPTION 'Warehouse request state transition is invalid' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER warehouse_request_only_advance BEFORE UPDATE OR DELETE ON warehouse.request FOR EACH ROW EXECUTE FUNCTION warehouse.only_advance_request();
CREATE TRIGGER warehouse_request_event_append_only BEFORE UPDATE OR DELETE ON warehouse.request_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER warehouse_request_evidence_append_only BEFORE UPDATE OR DELETE ON warehouse.request_evidence FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['warehouse.request','warehouse.request_event','warehouse.request_evidence'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON warehouse.request TO routefit_api;
GRANT SELECT,INSERT ON warehouse.request_event,warehouse.request_evidence TO routefit_api;
