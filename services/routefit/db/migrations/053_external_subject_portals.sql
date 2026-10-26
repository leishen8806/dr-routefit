CREATE TABLE org.external_subject_access (
 company_id uuid NOT NULL REFERENCES org.company(id),
 principal_id uuid NOT NULL,
 subject_id uuid NOT NULL,
 subject_kind text NOT NULL CHECK(subject_kind IN ('MERCHANT','PARTNER')),
 state text NOT NULL CHECK(state IN ('active','revoked')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,principal_id,subject_kind),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE FUNCTION org.validate_external_subject_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal WHERE company_id=NEW.company_id AND id=NEW.principal_id AND status='ACTIVE') THEN RAISE EXCEPTION 'External subject access requires an active principal' USING ERRCODE='23514'; END IF;
 IF NEW.subject_kind='MERCHANT' AND NOT EXISTS(SELECT 1 FROM party.customer WHERE company_id=NEW.company_id AND id=NEW.subject_id AND status='ACTIVE') THEN RAISE EXCEPTION 'Merchant subject must be an active customer' USING ERRCODE='23514'; END IF;
 IF NEW.subject_kind='PARTNER' AND NOT EXISTS(SELECT 1 FROM partner.carrier WHERE company_id=NEW.company_id AND id=NEW.subject_id AND state='active') THEN RAISE EXCEPTION 'Partner subject must be an active carrier' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER external_subject_access_valid BEFORE INSERT OR UPDATE ON org.external_subject_access FOR EACH ROW EXECUTE FUNCTION org.validate_external_subject_access();

CREATE TABLE finance.external_settlement_request (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 subject_id uuid NOT NULL,
 subject_kind text NOT NULL CHECK(subject_kind IN ('MERCHANT','PARTNER')),
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
 FOREIGN KEY(company_id,settlement_account_id) REFERENCES finance.settlement_account(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'kind')='PAYMENT'),
 CHECK((snapshot->>'subjectId') IS NOT DISTINCT FROM subject_id::text),
 CHECK((snapshot#>>'{money,amountMinor}')::bigint=money_amount_minor),
 CHECK((snapshot#>>'{money,currency}') IS NOT DISTINCT FROM money_currency),
 CHECK((snapshot->>'ledgerItemId') IS NOT DISTINCT FROM ledger_item_id::text),
 CHECK((snapshot->>'accountId') IS NOT DISTINCT FROM settlement_account_id::text)
);
CREATE INDEX external_settlement_request_subject ON finance.external_settlement_request(company_id,subject_kind,subject_id,id);
CREATE TRIGGER external_settlement_request_append_only BEFORE UPDATE OR DELETE ON finance.external_settlement_request FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['org.external_subject_access','finance.external_settlement_request'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
CREATE POLICY external_subject_scope ON org.external_subject_access AS RESTRICTIVE
 USING(principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid)
 WITH CHECK(false);
CREATE POLICY external_settlement_scope ON finance.external_settlement_request AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM org.external_subject_access a WHERE a.company_id=external_settlement_request.company_id AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND a.subject_id=external_settlement_request.subject_id AND a.subject_kind=external_settlement_request.subject_kind AND a.state='active' AND a.expires_at>clock_timestamp()))
 WITH CHECK(EXISTS(SELECT 1 FROM org.external_subject_access a WHERE a.company_id=external_settlement_request.company_id AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND a.subject_id=external_settlement_request.subject_id AND a.subject_kind=external_settlement_request.subject_kind AND a.state='active' AND a.expires_at>clock_timestamp()));
GRANT SELECT ON org.external_subject_access TO routefit_api;
GRANT SELECT,INSERT ON finance.external_settlement_request TO routefit_api;
