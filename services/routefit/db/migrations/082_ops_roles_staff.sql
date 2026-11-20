-- CMP-1708: ops roles / staff management (setRolePermissions, patchStaff, disableStaff, enableStaff).
-- org.role holds the permission matrix; org.staff_profile versions a STAFF principal and its role set.
-- Staff state lives in org.principal.status so a disabled staff member fails the session check in transaction().
CREATE TABLE org.role (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 is_system boolean NOT NULL DEFAULT false,
 permissions text[] NOT NULL DEFAULT '{}',
 version bigint NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9000000000000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 CHECK(cardinality(permissions)<=300),
 -- hard constraint: one role may not both approve and confirm payment of a payout
 CHECK(NOT (permissions @> ARRAY['payouts:approve','payouts:confirm-paid']))
);
CREATE TABLE org.staff_profile (
 company_id uuid NOT NULL,
 principal_id uuid NOT NULL,
 role_ids uuid[] NOT NULL DEFAULT '{}',
 version bigint NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9000000000000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,principal_id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE org.ops_change_event (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 company_id uuid NOT NULL,
 resource text NOT NULL CHECK(resource IN ('ROLE','STAFF')),
 resource_id uuid NOT NULL,
 version bigint NOT NULL,
 action text NOT NULL CHECK(action IN ('SET_PERMISSIONS','PATCH','DISABLE','ENABLE')),
 principal_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TRIGGER ops_change_event_append_only BEFORE UPDATE OR DELETE ON org.ops_change_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
-- existing STAFF principals get a profile at version 1 with no roles
INSERT INTO org.staff_profile(company_id,principal_id) SELECT company_id,id FROM org.principal WHERE kind='STAFF';
-- only STAFF principals may change status through the API role, and only between ACTIVE and DISABLED
CREATE FUNCTION org.staff_status_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status AND OLD.kind<>'STAFF' THEN RAISE EXCEPTION 'Only staff status may be changed' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.kind<>NEW.kind THEN RAISE EXCEPTION 'Principal identity is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER principal_staff_status_guard BEFORE UPDATE ON org.principal FOR EACH ROW EXECUTE FUNCTION org.staff_status_guard();
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['org.role','org.staff_profile','org.ops_change_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
GRANT SELECT,UPDATE ON org.role TO routefit_api;
GRANT SELECT,UPDATE ON org.staff_profile TO routefit_api;
GRANT SELECT,INSERT ON org.ops_change_event TO routefit_api;
GRANT UPDATE(status) ON org.principal TO routefit_api;
