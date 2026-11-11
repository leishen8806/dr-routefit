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

-- Backend1 RLS handoff: every table created in 065--069 has company_id.
-- DBEngineer owns the restrictive, role-specific policies and grants in its reviewed migration range.
COMMENT ON TABLE pricing.dimension_rule IS 'Backend1 RLS handoff: company-scoped configuration; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE pricing.vehicle_tariff IS 'Backend1 RLS handoff: company-scoped configuration; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE pricing.value_added_service IS 'Backend1 RLS handoff: company-scoped configuration; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE pricing.fx_rate IS 'Backend1 RLS handoff: company-scoped configuration; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE orders.package_line IS 'Backend1 RLS handoff: inherit company scope from order; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE party.merchant_contract IS 'Backend1 RLS handoff: company-scoped merchant contract; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE party.sku_dimension IS 'Backend1 RLS handoff: company-scoped merchant dimension; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE party.account_freeze IS 'Backend1 RLS handoff: company-scoped freeze history; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE marketing.coupon_batch IS 'Backend1 RLS handoff: company-scoped coupon batch; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE marketing.coupon IS 'Backend1 RLS handoff: company-scoped coupon; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE marketing.coupon_redemption IS 'Backend1 RLS handoff: company-scoped redemption; DBEngineer adds reviewed restrictive policy.';
COMMENT ON TABLE marketing.risk_flag IS 'Backend1 RLS handoff: company-scoped risk flag; DBEngineer adds reviewed restrictive policy.';
