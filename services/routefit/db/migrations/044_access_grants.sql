CREATE TABLE org.role_grant (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 principal_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('OPS','DISPATCH','WAREHOUSE','LOAD_REVIEWER','FINANCE_MAKER','FINANCE_REVIEWER','FINANCE_APPROVER','CASHIER','CHECKER','ADMIN')),
 warehouse_ids uuid[] NOT NULL,
 subject_ids uuid[] NOT NULL,
 expires_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('active','revoked')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_by uuid,
 revoked_at timestamptz,
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,revoked_by) REFERENCES org.principal(company_id,id),
 CHECK(cardinality(warehouse_ids)<=100 AND cardinality(subject_ids)<=100),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot#>>'{data,principalId}') IS NOT DISTINCT FROM principal_id::text),
 CHECK((snapshot#>>'{data,role}') IS NOT DISTINCT FROM role),
 CHECK((snapshot#>>'{data,expiresAt}')::timestamptz=expires_at),
 CHECK((state='active' AND revoked_by IS NULL AND revoked_at IS NULL) OR (state='revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE TABLE org.role_grant_event (
 company_id uuid NOT NULL,
 grant_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('GRANTED','REVOKED')),
 principal_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,grant_id,version),
 FOREIGN KEY(company_id,grant_id) REFERENCES org.role_grant(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE FUNCTION org.only_revoke_role_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Role grants may not be deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid THEN RAISE EXCEPTION 'Role grant may not grant the current principal' USING ERRCODE='23514'; END IF;
  IF NEW.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.kind='STAFF' AND p.status='ACTIVE') THEN RAISE EXCEPTION 'Role grant target or expiry is invalid' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.warehouse_ids) id LEFT JOIN warehouse.site s ON s.company_id=NEW.company_id AND s.id=id WHERE s.id IS NULL) OR EXISTS(SELECT 1 FROM unnest(NEW.subject_ids) id LEFT JOIN (SELECT id FROM org.principal WHERE company_id=NEW.company_id UNION SELECT id FROM party.customer WHERE company_id=NEW.company_id) s ON s.id=id WHERE s.id IS NULL) OR cardinality(NEW.warehouse_ids)<>(SELECT count(DISTINCT id) FROM unnest(NEW.warehouse_ids) id) OR cardinality(NEW.subject_ids)<>(SELECT count(DISTINCT id) FROM unnest(NEW.subject_ids) id) THEN RAISE EXCEPTION 'Role grant scope is invalid' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.principal_id<>NEW.principal_id OR OLD.role<>NEW.role OR OLD.warehouse_ids<>NEW.warehouse_ids OR OLD.subject_ids<>NEW.subject_ids OR OLD.expires_at<>NEW.expires_at OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR OLD.state<>'active' OR NEW.state<>'revoked' OR NEW.version<>OLD.version+1 OR NEW.revoked_by IS NULL OR NEW.revoked_at IS NULL THEN RAISE EXCEPTION 'Role grant may only be revoked once' USING ERRCODE='23514'; END IF;
 IF NEW.revoked_by IS DISTINCT FROM NULLIF(current_setting('app.principal_id',true),'')::uuid THEN RAISE EXCEPTION 'Role grant revoker mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER role_grant_only_revoke BEFORE INSERT OR UPDATE OR DELETE ON org.role_grant FOR EACH ROW EXECUTE FUNCTION org.only_revoke_role_grant();
CREATE TRIGGER role_grant_event_append_only BEFORE UPDATE OR DELETE ON org.role_grant_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['org.role_grant','org.role_grant_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON org.role_grant TO routefit_api;
GRANT SELECT,INSERT ON org.role_grant_event TO routefit_api;
