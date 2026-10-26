CREATE SCHEMA notification;

CREATE TABLE notification.template (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 resource_type text NOT NULL CHECK(resource_type IN ('ORDER','STATEMENT','CASE')),
 channel text NOT NULL CHECK(channel IN ('IN_APP','SMS','EMAIL')),
 state text NOT NULL CHECK(state IN ('approved','disabled')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 UNIQUE(company_id,id)
);
CREATE TABLE notification.message (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 subject_id uuid NOT NULL,
 resource_type text NOT NULL CHECK(resource_type IN ('ORDER','STATEMENT','CASE')),
 resource_id uuid NOT NULL,
 resource_version bigint NOT NULL CHECK(resource_version BETWEEN 1 AND 9000000000000),
 template_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('IN_APP','SMS','EMAIL')),
 state text NOT NULL CHECK(state IN ('queued','sent','failed','unknown')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 failure_code text CHECK(failure_code IS NULL OR length(failure_code) BETWEEN 1 AND 128),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 person_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,subject_id,resource_type,resource_id,resource_version,template_id,channel),
 FOREIGN KEY(company_id,template_id) REFERENCES notification.template(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'resourceId') IS NOT DISTINCT FROM resource_id::text)
);
CREATE FUNCTION notification.advance_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Notification message may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.subject_id<>NEW.subject_id OR OLD.resource_type<>NEW.resource_type OR OLD.resource_id<>NEW.resource_id OR OLD.resource_version<>NEW.resource_version OR OLD.template_id<>NEW.template_id OR OLD.channel<>NEW.channel OR OLD.created_by<>NEW.created_by OR OLD.person_id<>NEW.person_id OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 OR NOT ((OLD.state='failed' AND NEW.state='queued' AND NEW.failure_code IS NULL) OR (OLD.state='queued' AND NEW.state IN ('sent','failed','unknown'))) THEN RAISE EXCEPTION 'Notification state may only advance by a delivery outcome or failed retry' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_message_only_advance BEFORE UPDATE OR DELETE ON notification.message FOR EACH ROW EXECUTE FUNCTION notification.advance_message();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['notification.template','notification.message'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA notification TO routefit_api;
