CREATE TABLE mobile.sync_device_state (
 company_id uuid NOT NULL REFERENCES org.company(id),
 device_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 last_sequence bigint NOT NULL CHECK(last_sequence>=0 AND last_sequence<=9000000000000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,device_id),
 FOREIGN KEY(company_id,device_id,driver_id) REFERENCES mobile.device(company_id,id,driver_id)
);

CREATE TABLE mobile.sync_event (
 company_id uuid NOT NULL REFERENCES org.company(id),
 event_id uuid NOT NULL,
 device_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 sequence bigint NOT NULL CHECK(sequence BETWEEN 1 AND 9000000000000),
 assignment_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('ARRIVED','HANDOVER_SIGNED','DEPARTED','DELIVERY_RECORDED','CASH_REPORTED','EXCEPTION_REPORTED')),
 observed_at timestamptz NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 result text NOT NULL CHECK(result IN ('APPLIED','REJECTED','NEEDS_REVIEW')),
 resource_id uuid,
 resource_version bigint CHECK(resource_version BETWEEN 1 AND 9000000000000),
 error_code text CHECK(error_code IS NULL OR length(error_code) BETWEEN 1 AND 128),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,event_id),
 UNIQUE(company_id,device_id,sequence),
 FOREIGN KEY(company_id,device_id,driver_id) REFERENCES mobile.device(company_id,id,driver_id),
 FOREIGN KEY(company_id,assignment_id) REFERENCES dispatch.assignment(company_id,id),
 CHECK((snapshot->'input'->>'eventId') IS NOT DISTINCT FROM event_id::text),
 CHECK((snapshot->'input'->>'sequence')::bigint=sequence),
 CHECK((snapshot->'input'->>'assignmentId') IS NOT DISTINCT FROM assignment_id::text),
 CHECK((snapshot->'input'->>'type') IS NOT DISTINCT FROM event_type),
 CHECK((snapshot->'result'->>'result') IS NOT DISTINCT FROM result)
);

CREATE FUNCTION mobile.only_advance_sync_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Driver sync state may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.device_id<>NEW.device_id OR OLD.driver_id<>NEW.driver_id OR NEW.last_sequence<OLD.last_sequence THEN RAISE EXCEPTION 'Driver sync state identity is immutable and sequence may only advance' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_device_state_only_advance BEFORE UPDATE OR DELETE ON mobile.sync_device_state FOR EACH ROW EXECUTE FUNCTION mobile.only_advance_sync_state();
CREATE TRIGGER sync_event_append_only BEFORE UPDATE OR DELETE ON mobile.sync_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['mobile.sync_device_state','mobile.sync_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
