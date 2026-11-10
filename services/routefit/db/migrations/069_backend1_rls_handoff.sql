CREATE TABLE marketing.coupon_redemption (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 coupon_id uuid NOT NULL,
 order_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('LOCKED','REDEEMED','RELEASED')),
 discount_minor bigint NOT NULL CHECK(discount_minor>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,coupon_id), UNIQUE(company_id,order_id),
 FOREIGN KEY(company_id,coupon_id) REFERENCES marketing.coupon(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id)
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
