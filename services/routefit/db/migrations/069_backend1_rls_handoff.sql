-- Backend1 RLS handoff: every table created in 065--068 has company_id.
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
