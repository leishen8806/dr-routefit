CREATE SCHEMA custody;

CREATE TABLE custody.transfer (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 order_version bigint NOT NULL CHECK(order_version BETWEEN 1 AND 9000000000000),
 assignment_version bigint NOT NULL CHECK(assignment_version BETWEEN 1 AND 9000000000000),
 from_custodian_id uuid NOT NULL,
 to_custodian_id uuid NOT NULL,
 load_review_id uuid NOT NULL,
 observed_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('proposed','partially_signed','confirmed','discrepancy')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,assignment_id) REFERENCES dispatch.assignment(company_id,id),
 FOREIGN KEY(company_id,from_custodian_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,to_custodian_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,load_review_id) REFERENCES dispatch.load_review(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK(from_custodian_id<>to_custodian_id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'version')::bigint=version)
);

CREATE TABLE custody.transfer_item (
 company_id uuid NOT NULL,
 transfer_id uuid NOT NULL,
 item_id uuid NOT NULL,
 package_id uuid NOT NULL,
 PRIMARY KEY(company_id,transfer_id,package_id),
 FOREIGN KEY(company_id,transfer_id) REFERENCES custody.transfer(company_id,id)
);

CREATE TABLE custody.transfer_signature (
 company_id uuid NOT NULL,
 transfer_id uuid NOT NULL,
 side text NOT NULL CHECK(side IN ('FROM','TO')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,transfer_id,side),
 UNIQUE(company_id,transfer_id,person_id),
 FOREIGN KEY(company_id,transfer_id) REFERENCES custody.transfer(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE TABLE custody.package_position (
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 item_id uuid NOT NULL,
 package_id uuid NOT NULL,
 custodian_id uuid NOT NULL,
 transfer_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,order_id,package_id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,custodian_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,transfer_id) REFERENCES custody.transfer(company_id,id)
);

CREATE TABLE custody.package_transfer_lock (
 company_id uuid NOT NULL,
 package_id uuid NOT NULL,
 transfer_id uuid NOT NULL,
 released_at timestamptz,
 PRIMARY KEY(company_id,package_id,transfer_id),
 FOREIGN KEY(company_id,transfer_id) REFERENCES custody.transfer(company_id,id)
);
CREATE UNIQUE INDEX one_open_custody_transfer_per_package ON custody.package_transfer_lock(company_id,package_id) WHERE released_at IS NULL;

CREATE FUNCTION custody.only_advance_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Custody transfers may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.assignment_id<>NEW.assignment_id OR OLD.order_version<>NEW.order_version OR OLD.assignment_version<>NEW.assignment_version OR OLD.from_custodian_id<>NEW.from_custodian_id OR OLD.to_custodian_id<>NEW.to_custodian_id OR OLD.load_review_id<>NEW.load_review_id OR OLD.observed_at<>NEW.observed_at OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Custody transfer identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT ((OLD.state='proposed' AND NEW.state IN ('partially_signed','discrepancy')) OR (OLD.state='partially_signed' AND NEW.state IN ('confirmed','discrepancy'))) THEN
  RAISE EXCEPTION 'Custody transfer state transition is invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
GRANT USAGE ON SCHEMA custody TO routefit_api;
CREATE TRIGGER custody_transfer_only_advance BEFORE UPDATE OR DELETE ON custody.transfer FOR EACH ROW EXECUTE FUNCTION custody.only_advance_transfer();
CREATE TRIGGER custody_transfer_item_append_only BEFORE UPDATE OR DELETE ON custody.transfer_item FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER custody_transfer_signature_append_only BEFORE UPDATE OR DELETE ON custody.transfer_signature FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

CREATE FUNCTION custody.check_transfer_signature_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id AND p.status='ACTIVE') THEN
  RAISE EXCEPTION 'Custody signature principal and person mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custody_transfer_signature_identity BEFORE INSERT ON custody.transfer_signature FOR EACH ROW EXECUTE FUNCTION custody.check_transfer_signature_identity();

CREATE FUNCTION custody.only_recipient_may_update_position() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Package custody positions may not be deleted' USING ERRCODE='23514'; END IF;
 IF NULLIF(current_setting('app.principal_id',true),'')::uuid IS DISTINCT FROM NEW.custodian_id THEN
  RAISE EXCEPTION 'Only the receiving custodian may record package custody' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (OLD.company_id<>NEW.company_id OR OLD.order_id<>NEW.order_id OR OLD.item_id<>NEW.item_id OR OLD.package_id<>NEW.package_id) THEN
  RAISE EXCEPTION 'Package custody identity is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custody_package_position_only_recipient BEFORE INSERT OR UPDATE OR DELETE ON custody.package_position FOR EACH ROW EXECUTE FUNCTION custody.only_recipient_may_update_position();

CREATE FUNCTION custody.release_terminal_transfer_locks() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state IN ('confirmed','discrepancy') THEN
  UPDATE custody.package_transfer_lock SET released_at=clock_timestamp() WHERE company_id=NEW.company_id AND transfer_id=NEW.id AND released_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custody_transfer_release_locks AFTER UPDATE ON custody.transfer FOR EACH ROW EXECUTE FUNCTION custody.release_terminal_transfer_locks();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['custody.transfer','custody.transfer_item','custody.transfer_signature','custody.package_position','custody.package_transfer_lock'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
