CREATE TABLE party.portal_membership (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 customer_id uuid NOT NULL,
 invitation_email text NOT NULL CHECK(length(btrim(invitation_email)) BETWEEN 3 AND 254),
 person_id uuid NULL,
 state text NOT NULL CHECK(state IN ('invited','active','suspended','revoked')),
 permissions text[] NOT NULL CHECK(cardinality(permissions) BETWEEN 1 AND 12),
 expires_at timestamptz NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,customer_id,invitation_email),
 FOREIGN KEY(company_id,customer_id) REFERENCES party.customer(company_id,id),
 CHECK(invitation_email=lower(btrim(invitation_email))),
 CHECK(permissions <@ ARRAY['ORDERS_READ','EVIDENCE_READ','INVENTORY_READ','WAREHOUSE_REQUEST','ORDER_REQUEST','FINANCE_READ','PAYMENT_REQUEST','CASE_CREATE','MEMBERS_MANAGE','QUOTES_CONFIRM','STATEMENTS_ACKNOWLEDGE','FINANCE_EXPORT']),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'ownerAccountId') IS NOT DISTINCT FROM customer_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);
CREATE TABLE party.portal_membership_event (
 company_id uuid NOT NULL,
 membership_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('INVITED','SUSPENDED','REVOKED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,membership_id,version),
 FOREIGN KEY(company_id,membership_id) REFERENCES party.portal_membership(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE FUNCTION party.only_advance_portal_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Portal membership may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.customer_id<>NEW.customer_id OR OLD.invitation_email<>NEW.invitation_email OR OLD.person_id IS DISTINCT FROM NEW.person_id OR OLD.permissions<>NEW.permissions OR OLD.expires_at<>NEW.expires_at OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Portal membership identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT ((OLD.state='active' AND NEW.state IN ('suspended','revoked')) OR (OLD.state='invited' AND NEW.state='revoked') OR (OLD.state='suspended' AND NEW.state='revoked')) THEN
  RAISE EXCEPTION 'Portal membership state transition is invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER party_portal_membership_only_advance BEFORE UPDATE OR DELETE ON party.portal_membership FOR EACH ROW EXECUTE FUNCTION party.only_advance_portal_membership();
CREATE TRIGGER party_portal_membership_event_append_only BEFORE UPDATE OR DELETE ON party.portal_membership_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['party.portal_membership','party.portal_membership_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
CREATE POLICY portal_membership_scope ON party.portal_membership AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM party.customer_access a WHERE a.company_id=portal_membership.company_id AND a.customer_id=portal_membership.customer_id AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid) OR EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=portal_membership.company_id AND p.id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND p.person_id=portal_membership.person_id))
 WITH CHECK(EXISTS(SELECT 1 FROM party.customer_access a WHERE a.company_id=portal_membership.company_id AND a.customer_id=portal_membership.customer_id AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid));
CREATE POLICY portal_membership_event_scope ON party.portal_membership_event AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM party.portal_membership m WHERE m.company_id=portal_membership_event.company_id AND m.id=portal_membership_event.membership_id))
 WITH CHECK(EXISTS(SELECT 1 FROM party.portal_membership m WHERE m.company_id=portal_membership_event.company_id AND m.id=portal_membership_event.membership_id));
GRANT SELECT,INSERT,UPDATE ON party.portal_membership TO routefit_api;
GRANT SELECT,INSERT ON party.portal_membership_event TO routefit_api;
