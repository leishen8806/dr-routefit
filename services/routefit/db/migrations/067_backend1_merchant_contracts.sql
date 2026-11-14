CREATE TABLE party.merchant_contract (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 merchant_id uuid NOT NULL,
 pricing_plan text NOT NULL CHECK(length(btrim(pricing_plan)) BETWEEN 1 AND 120),
 cod_settlement_cycle text NOT NULL CHECK(cod_settlement_cycle IN ('WEEKLY','MONTHLY')),
 cod_fee_bps integer NOT NULL CHECK(cod_fee_bps BETWEEN 0 AND 10000),
 monthly_credit_limit_minor bigint NOT NULL CHECK(monthly_credit_limit_minor>=0),
 payout_account_ref text NOT NULL CHECK(length(btrim(payout_account_ref)) BETWEEN 1 AND 160),
 state text NOT NULL CHECK(state IN ('DRAFT','ACTIVE','EXPIRED')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,merchant_id) REFERENCES party.customer(company_id,id)
);
CREATE TABLE party.sku_dimension (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 merchant_id uuid NOT NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 length_cm integer NOT NULL CHECK(length_cm>0),
 width_cm integer NOT NULL CHECK(width_cm>0),
 height_cm integer NOT NULL CHECK(height_cm>0),
 weight_grams integer NOT NULL CHECK(weight_grams>0),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,merchant_id,name),
 FOREIGN KEY(company_id,merchant_id) REFERENCES party.customer(company_id,id)
);
CREATE TABLE party.merchant_contract_event (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 contract_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 state text NOT NULL CHECK(state IN ('DRAFT','ACTIVE','EXPIRED')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,contract_id,version),
 FOREIGN KEY(company_id,contract_id) REFERENCES party.merchant_contract(company_id,id)
);
CREATE TABLE party.account_freeze (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 principal_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('FREEZE','UNFREEZE')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 300),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,principal_id,version),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['party.merchant_contract','party.sku_dimension'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['party.merchant_contract_event','party.account_freeze'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
