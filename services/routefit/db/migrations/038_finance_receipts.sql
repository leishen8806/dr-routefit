CREATE TABLE finance.receipt (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 payer_subject_id uuid NOT NULL,
 money_amount_minor bigint NOT NULL CHECK(money_amount_minor BETWEEN 1 AND 9000000000000),
 money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 method text NOT NULL CHECK(method IN ('BANK_TRANSFER','CASH')),
 receiving_account_id uuid NULL,
 external_reference text NOT NULL CHECK(length(btrim(external_reference)) BETWEEN 1 AND 128),
 custody_type text NOT NULL CHECK(custody_type='COMPANY'),
 custodian_subject_id uuid NOT NULL,
 observed_at timestamptz NOT NULL,
 prepared_by uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,receiving_account_id) REFERENCES finance.receiving_account(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'payerSubjectId') IS NOT DISTINCT FROM payer_subject_id::text),
 CHECK((snapshot#>>'{money,amountMinor}')::bigint=money_amount_minor),
 CHECK((snapshot#>>'{money,currency}') IS NOT DISTINCT FROM money_currency),
 CHECK((snapshot->>'method') IS NOT DISTINCT FROM method),
 CHECK((snapshot->>'externalReference') IS NOT DISTINCT FROM external_reference),
 CHECK((snapshot->>'custodyType') IS NOT DISTINCT FROM custody_type),
 CHECK((snapshot->>'custodianSubjectId') IS NOT DISTINCT FROM custodian_subject_id::text),
 CHECK((snapshot->>'observedAt')::timestamptz=observed_at)
);
CREATE TABLE finance.receipt_order (
 company_id uuid NOT NULL,
 receipt_id uuid NOT NULL,
 order_id uuid NOT NULL,
 PRIMARY KEY(company_id,receipt_id,order_id),
 FOREIGN KEY(company_id,receipt_id) REFERENCES finance.receipt(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id)
);
CREATE TABLE finance.receipt_evidence (
 company_id uuid NOT NULL,
 receipt_id uuid NOT NULL,
 evidence_file_id uuid NOT NULL,
 PRIMARY KEY(company_id,receipt_id,evidence_file_id),
 FOREIGN KEY(company_id,receipt_id) REFERENCES finance.receipt(company_id,id),
 FOREIGN KEY(company_id,evidence_file_id) REFERENCES evidence.file(company_id,id)
);
CREATE TABLE finance.receipt_confirmation (
 company_id uuid NOT NULL,
 receipt_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version=2),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,receipt_id),
 FOREIGN KEY(company_id,receipt_id) REFERENCES finance.receipt(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'receiptId') IS NOT DISTINCT FROM receipt_id::text),
 CHECK((snapshot->>'version')::bigint=version)
);
CREATE UNIQUE INDEX one_confirmed_receipt_reference ON finance.receipt_confirmation(company_id,COALESCE(snapshot->>'receivingAccountId',''),(snapshot->>'externalReference'));

CREATE TRIGGER receipt_append_only BEFORE UPDATE OR DELETE ON finance.receipt FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER receipt_order_append_only BEFORE UPDATE OR DELETE ON finance.receipt_order FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER receipt_evidence_append_only BEFORE UPDATE OR DELETE ON finance.receipt_evidence FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER receipt_confirmation_append_only BEFORE UPDATE OR DELETE ON finance.receipt_confirmation FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

ALTER TABLE finance.receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.receipt FORCE ROW LEVEL SECURITY;
ALTER TABLE finance.receipt_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.receipt_order FORCE ROW LEVEL SECURITY;
ALTER TABLE finance.receipt_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.receipt_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE finance.receipt_confirmation ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.receipt_confirmation FORCE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance.receipt','finance.receipt_order','finance.receipt_evidence','finance.receipt_confirmation'] LOOP
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
