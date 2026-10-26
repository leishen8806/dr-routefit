CREATE TABLE finance.driver_withdrawal_request (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 driver_id uuid NOT NULL,
 ledger_item_id uuid NOT NULL,
 settlement_account_id uuid NOT NULL,
 money_amount_minor bigint NOT NULL CHECK(money_amount_minor BETWEEN 1 AND 9000000000000),
 money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 ledger_item_version bigint NOT NULL CHECK(ledger_item_version=1),
 account_version bigint NOT NULL CHECK(account_version BETWEEN 1 AND 9000000000000),
 version bigint NOT NULL CHECK(version=1),
 state text NOT NULL CHECK(state='submitted'),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 prepared_by uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,ledger_item_id) REFERENCES finance.ledger_item(company_id,id),
 FOREIGN KEY(company_id,settlement_account_id) REFERENCES finance.settlement_account(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'kind')='PAYMENT'),
 CHECK((snapshot->>'state')='submitted'),
 CHECK((snapshot#>>'{money,amountMinor}')::bigint=money_amount_minor),
 CHECK((snapshot#>>'{money,currency}') IS NOT DISTINCT FROM money_currency),
 CHECK((snapshot->>'ledgerItemId') IS NOT DISTINCT FROM ledger_item_id::text),
 CHECK((snapshot->>'accountId') IS NOT DISTINCT FROM settlement_account_id::text)
);
CREATE INDEX driver_withdrawal_request_source ON finance.driver_withdrawal_request(company_id,driver_id,ledger_item_id) WHERE state='submitted';
CREATE TRIGGER driver_withdrawal_request_append_only BEFORE UPDATE OR DELETE ON finance.driver_withdrawal_request FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
ALTER TABLE finance.driver_withdrawal_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.driver_withdrawal_request FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.driver_withdrawal_request USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT SELECT,INSERT ON finance.driver_withdrawal_request TO routefit_api;
