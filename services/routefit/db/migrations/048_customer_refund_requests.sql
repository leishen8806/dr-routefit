CREATE TABLE finance.settlement_account (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 subject_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 bank_code text NOT NULL CHECK(length(btrim(bank_code)) BETWEEN 1 AND 64),
 last4 text NOT NULL CHECK(last4 ~ '^[0-9]{4}$'),
 holder_display_name text NOT NULL CHECK(length(btrim(holder_display_name)) BETWEEN 1 AND 120),
 state text NOT NULL CHECK(state IN ('pending_review','verified','suspended')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'subjectId') IS NOT DISTINCT FROM subject_id::text),
 CHECK((snapshot->>'bankCode') IS NOT DISTINCT FROM bank_code),
 CHECK((snapshot->>'last4') IS NOT DISTINCT FROM last4),
 CHECK((snapshot->>'holderDisplayName') IS NOT DISTINCT FROM holder_display_name),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);

CREATE TABLE finance.refund_request (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 customer_id uuid NOT NULL,
 generic_receipt_id uuid NULL,
 prepayment_receipt_id uuid NULL,
 settlement_account_id uuid NOT NULL,
 money_amount_minor bigint NOT NULL CHECK(money_amount_minor BETWEEN 1 AND 9000000000000),
 money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 version bigint NOT NULL CHECK(version=1),
 state text NOT NULL CHECK(state='submitted'),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 prepared_by uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,generic_receipt_id) REFERENCES finance.receipt(company_id,id),
 FOREIGN KEY(company_id,prepayment_receipt_id) REFERENCES finance.prepayment_receipt(company_id,id),
 FOREIGN KEY(company_id,settlement_account_id) REFERENCES finance.settlement_account(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id),
 CHECK((generic_receipt_id IS NOT NULL)::integer+(prepayment_receipt_id IS NOT NULL)::integer=1),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'kind')='REFUND'),
 CHECK((snapshot#>>'{money,amountMinor}')::bigint=money_amount_minor),
 CHECK((snapshot#>>'{money,currency}') IS NOT DISTINCT FROM money_currency),
 CHECK((snapshot->>'accountId') IS NOT DISTINCT FROM settlement_account_id::text)
);
CREATE INDEX refund_request_generic_receipt ON finance.refund_request(company_id,generic_receipt_id) WHERE generic_receipt_id IS NOT NULL;
CREATE INDEX refund_request_prepayment_receipt ON finance.refund_request(company_id,prepayment_receipt_id) WHERE prepayment_receipt_id IS NOT NULL;
CREATE INDEX refund_request_customer ON finance.refund_request(company_id,customer_id,id);

CREATE TRIGGER settlement_account_append_only BEFORE UPDATE OR DELETE ON finance.settlement_account FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER refund_request_append_only BEFORE UPDATE OR DELETE ON finance.refund_request FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance.settlement_account','finance.refund_request'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
