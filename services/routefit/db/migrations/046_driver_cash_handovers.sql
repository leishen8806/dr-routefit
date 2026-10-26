ALTER TABLE finance.receipt DROP CONSTRAINT receipt_custody_type_check;
ALTER TABLE finance.receipt ADD CONSTRAINT receipt_custody_type_check CHECK(custody_type IN ('COMPANY','DRIVER'));
CREATE UNIQUE INDEX one_driver_cash_voucher ON finance.receipt(company_id,custodian_subject_id,external_reference) WHERE custody_type='DRIVER';

CREATE TABLE finance.cash_handover (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 driver_principal_id uuid NOT NULL,
 driver_person_id uuid NOT NULL,
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 declared_amount_minor bigint NOT NULL CHECK(declared_amount_minor BETWEEN 1 AND 9000000000000),
 counted_amount_minor bigint NULL CHECK(counted_amount_minor BETWEEN 0 AND 9000000000000),
 difference_minor bigint NULL CHECK(difference_minor BETWEEN 0 AND 9000000000000),
 difference_direction text NOT NULL CHECK(difference_direction IN ('NONE','SHORT','OVER','UNKNOWN')),
 state text NOT NULL CHECK(state IN ('submitted','counted','disputed','reviewed','posted')),
 version bigint NOT NULL CHECK(version>=1),
 review_document_id uuid NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,driver_principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'driverSubjectId') IS NOT DISTINCT FROM driver_principal_id::text),
 CHECK((snapshot#>>'{declared,amountMinor}')::bigint=declared_amount_minor),
 CHECK((snapshot#>>'{declared,currency}') IS NOT DISTINCT FROM currency),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot#>>'{counted,amountMinor}')::bigint IS NOT DISTINCT FROM counted_amount_minor),
 CHECK((snapshot->>'differenceMinor')::bigint IS NOT DISTINCT FROM difference_minor),
 CHECK((snapshot->>'differenceDirection') IS NOT DISTINCT FROM difference_direction)
);
CREATE TABLE finance.cash_handover_line (
 company_id uuid NOT NULL,
 handover_id uuid NOT NULL,
 receipt_id uuid NOT NULL,
 receipt_version bigint NOT NULL CHECK(receipt_version=2),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 9000000000000),
 PRIMARY KEY(company_id,handover_id,receipt_id),
 FOREIGN KEY(company_id,handover_id) REFERENCES finance.cash_handover(company_id,id),
 FOREIGN KEY(company_id,receipt_id) REFERENCES finance.receipt(company_id,id)
);
CREATE TABLE finance.cash_handover_evidence (
 company_id uuid NOT NULL,
 handover_id uuid NOT NULL,
 evidence_file_id uuid NOT NULL,
 PRIMARY KEY(company_id,handover_id,evidence_file_id),
 FOREIGN KEY(company_id,handover_id) REFERENCES finance.cash_handover(company_id,id),
 FOREIGN KEY(company_id,evidence_file_id) REFERENCES evidence.file(company_id,id)
);
CREATE TABLE finance.cash_handover_count (
 company_id uuid NOT NULL,
 handover_id uuid NOT NULL,
 counter_principal_id uuid NOT NULL,
 counter_person_id uuid NOT NULL,
 actual_amount_minor bigint NOT NULL CHECK(actual_amount_minor BETWEEN 0 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,handover_id),
 FOREIGN KEY(company_id,handover_id) REFERENCES finance.cash_handover(company_id,id),
 FOREIGN KEY(company_id,counter_principal_id) REFERENCES org.principal(company_id,id)
 ,CHECK((snapshot#>>'{actual,amountMinor}')::bigint=actual_amount_minor)
);
CREATE TABLE finance.cash_handover_count_evidence (
 company_id uuid NOT NULL,
 handover_id uuid NOT NULL,
 evidence_file_id uuid NOT NULL,
 PRIMARY KEY(company_id,handover_id,evidence_file_id),
 FOREIGN KEY(company_id,handover_id) REFERENCES finance.cash_handover(company_id,id),
 FOREIGN KEY(company_id,evidence_file_id) REFERENCES evidence.file(company_id,id)
);

CREATE FUNCTION finance.check_cash_handover_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'cash handover history is immutable';
 END IF;
 IF NOT (NEW.company_id=OLD.company_id AND NEW.id=OLD.id AND NEW.driver_principal_id=OLD.driver_principal_id AND NEW.driver_person_id=OLD.driver_person_id AND NEW.currency=OLD.currency AND NEW.declared_amount_minor=OLD.declared_amount_minor AND NEW.version=OLD.version+1 AND OLD.state='submitted' AND NEW.state IN ('counted','disputed')) THEN
  RAISE EXCEPTION 'cash handover history is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cash_handover_transition BEFORE UPDATE OR DELETE ON finance.cash_handover FOR EACH ROW EXECUTE FUNCTION finance.check_cash_handover_update();
CREATE TRIGGER cash_handover_line_append_only BEFORE UPDATE OR DELETE ON finance.cash_handover_line FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER cash_handover_evidence_append_only BEFORE UPDATE OR DELETE ON finance.cash_handover_evidence FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER cash_handover_count_append_only BEFORE UPDATE OR DELETE ON finance.cash_handover_count FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER cash_handover_count_evidence_append_only BEFORE UPDATE OR DELETE ON finance.cash_handover_count_evidence FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance.cash_handover','finance.cash_handover_line','finance.cash_handover_evidence','finance.cash_handover_count','finance.cash_handover_count_evidence'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
