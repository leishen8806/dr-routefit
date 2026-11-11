CREATE TABLE marketing.coupon_redemption (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 coupon_id uuid NOT NULL,
 order_id uuid NOT NULL,
 previous_redemption_id uuid NULL,
 state text NOT NULL CHECK(state IN ('LOCKED','REDEEMED','RELEASED')),
 discount_minor bigint NOT NULL CHECK(discount_minor>=0),
 idempotency_key text NOT NULL CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 128),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,idempotency_key),
 FOREIGN KEY(company_id,coupon_id) REFERENCES marketing.coupon(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,previous_redemption_id) REFERENCES marketing.coupon_redemption(company_id,id)
);
CREATE TABLE marketing.risk_flag (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 coupon_id uuid NULL,
 order_id uuid NULL,
 code text NOT NULL CHECK(code='COUPON_REVIEW_REQUIRED'),
 state text NOT NULL CHECK(state IN ('OPEN','RESOLVED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,coupon_id) REFERENCES marketing.coupon(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 CHECK(coupon_id IS NOT NULL OR order_id IS NOT NULL)
);

CREATE FUNCTION party.prevent_backend1_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Backend1 history is append-only';
END;
$$;
CREATE TRIGGER merchant_contract_event_append_only
 BEFORE UPDATE OR DELETE ON party.merchant_contract_event
 FOR EACH ROW EXECUTE FUNCTION party.prevent_backend1_history_mutation();
CREATE TRIGGER account_freeze_append_only
 BEFORE UPDATE OR DELETE ON party.account_freeze
 FOR EACH ROW EXECUTE FUNCTION party.prevent_backend1_history_mutation();
CREATE TRIGGER coupon_redemption_append_only
 BEFORE UPDATE OR DELETE ON marketing.coupon_redemption
 FOR EACH ROW EXECUTE FUNCTION party.prevent_backend1_history_mutation();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['marketing.coupon_redemption'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['marketing.risk_flag'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
