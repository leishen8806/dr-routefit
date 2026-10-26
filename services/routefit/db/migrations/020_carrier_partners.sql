CREATE SCHEMA partner;

CREATE TABLE partner.carrier (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 255),
 kind text NOT NULL CHECK(kind IN ('PARTNER_VEHICLE','PARCEL_CARRIER')),
 contact text NOT NULL CHECK(length(btrim(contact)) BETWEEN 1 AND 255),
 phone text NOT NULL CHECK(length(btrim(phone)) BETWEEN 1 AND 32),
 state text NOT NULL CHECK(state IN ('draft','pending_verification','active','suspended','exited')),
 evidence_bundle_id uuid NOT NULL,
 agreement_version_id uuid,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'name') IS NOT DISTINCT FROM name),
 CHECK((snapshot->>'kind') IS NOT DISTINCT FROM kind),
 CHECK((snapshot->>'contact') IS NOT DISTINCT FROM contact),
 CHECK((snapshot->>'phone') IS NOT DISTINCT FROM phone),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'agreementVersionId') IS NOT DISTINCT FROM agreement_version_id::text)
);

CREATE TABLE partner.agreement_version (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 partner_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 verified_by uuid NOT NULL,
 verified_person_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,partner_id) REFERENCES partner.carrier(company_id,id),
 FOREIGN KEY(company_id,verified_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'partnerId') IS NOT DISTINCT FROM partner_id::text),
 CHECK((snapshot->>'verifiedPersonId') IS NOT DISTINCT FROM verified_person_id::text)
);

ALTER TABLE partner.carrier ADD CONSTRAINT carrier_agreement_version
 FOREIGN KEY(company_id,agreement_version_id) REFERENCES partner.agreement_version(company_id,id);

CREATE TABLE partner.carrier_event (
 company_id uuid NOT NULL,
 partner_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('CREATED','VERIFIED','SUSPENDED','REINSTATED','EXITED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,partner_id,version),
 FOREIGN KEY(company_id,partner_id) REFERENCES partner.carrier(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE FUNCTION partner.only_advance_carrier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Carrier partners may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.name<>NEW.name OR OLD.kind<>NEW.kind OR OLD.contact<>NEW.contact OR OLD.phone<>NEW.phone OR OLD.evidence_bundle_id<>NEW.evidence_bundle_id OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Carrier partner identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT ((OLD.state='draft' AND NEW.state='active') OR (OLD.state='active' AND NEW.state IN ('suspended','exited')) OR (OLD.state='suspended' AND NEW.state IN ('active','exited'))) THEN
  RAISE EXCEPTION 'Carrier partner state transition is invalid' USING ERRCODE='23514';
 END IF;
 IF NEW.state='active' AND NEW.agreement_version_id IS NULL THEN RAISE EXCEPTION 'Active carrier partner needs verified agreement' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER carrier_only_advance BEFORE UPDATE OR DELETE ON partner.carrier FOR EACH ROW EXECUTE FUNCTION partner.only_advance_carrier();
CREATE TRIGGER carrier_event_append_only BEFORE UPDATE OR DELETE ON partner.carrier_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER agreement_version_append_only BEFORE UPDATE OR DELETE ON partner.agreement_version FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE FUNCTION partner.check_carrier_event_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN
  RAISE EXCEPTION 'Carrier partner event principal and person mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER carrier_event_identity BEFORE INSERT ON partner.carrier_event FOR EACH ROW EXECUTE FUNCTION partner.check_carrier_event_identity();
CREATE FUNCTION partner.check_agreement_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.verified_by AND p.person_id=NEW.verified_person_id) THEN
  RAISE EXCEPTION 'Carrier agreement verifier and person mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER agreement_version_identity BEFORE INSERT ON partner.agreement_version FOR EACH ROW EXECUTE FUNCTION partner.check_agreement_identity();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['partner.carrier','partner.agreement_version','partner.carrier_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA partner TO routefit_api;
