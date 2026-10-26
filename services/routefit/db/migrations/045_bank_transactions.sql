CREATE TABLE finance.bank_transaction (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 account_id uuid NOT NULL,
 external_transaction_id text NOT NULL CHECK(length(btrim(external_transaction_id)) BETWEEN 1 AND 128),
 direction text NOT NULL CHECK(direction IN ('IN','OUT')),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 9000000000000),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 booked_at timestamptz NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,account_id,external_transaction_id),
 FOREIGN KEY(company_id,account_id) REFERENCES finance.receiving_account(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=1),
 CHECK((snapshot->>'accountId') IS NOT DISTINCT FROM account_id::text),
 CHECK((snapshot->>'externalTransactionId') IS NOT DISTINCT FROM external_transaction_id),
 CHECK((snapshot->>'direction') IS NOT DISTINCT FROM direction),
 CHECK((snapshot#>>'{money,amountMinor}')::bigint=amount_minor),
 CHECK((snapshot#>>'{money,currency}') IS NOT DISTINCT FROM currency),
 CHECK((snapshot->>'bookedAt')::timestamptz=booked_at)
);
CREATE TABLE finance.bank_transaction_evidence (
 company_id uuid NOT NULL,
 transaction_id uuid NOT NULL,
 evidence_file_id uuid NOT NULL,
 PRIMARY KEY(company_id,transaction_id,evidence_file_id),
 FOREIGN KEY(company_id,transaction_id) REFERENCES finance.bank_transaction(company_id,id),
 FOREIGN KEY(company_id,evidence_file_id) REFERENCES evidence.file(company_id,id)
);
CREATE TRIGGER bank_transaction_append_only BEFORE UPDATE OR DELETE ON finance.bank_transaction FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER bank_transaction_evidence_append_only BEFORE UPDATE OR DELETE ON finance.bank_transaction_evidence FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['finance.bank_transaction','finance.bank_transaction_evidence'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
