CREATE TABLE pricing.order_quote (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, order_id uuid NOT NULL, source_version bigint NOT NULL,
 policy_id uuid NOT NULL, snapshot jsonb NOT NULL, principal_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(company_id,order_id,id),
 FOREIGN KEY(company_id,order_id,source_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,policy_id) REFERENCES pricing.policy_publication(company_id,policy_id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text AND (snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text
  AND (snapshot->>'sourceOrderVersion') IS NOT DISTINCT FROM source_version::text
  AND (snapshot->>'orderVersion') IS NOT DISTINCT FROM (source_version+1)::text
  AND (snapshot->>'pricingPolicyVersionId') IS NOT DISTINCT FROM policy_id::text AND snapshot->>'state'='issued')
);
ALTER TABLE pricing.order_quote ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.order_quote FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON pricing.order_quote USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY customer_scope ON pricing.order_quote AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=order_quote.company_id AND d.id=order_quote.order_id))
 WITH CHECK(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=order_quote.company_id AND d.id=order_quote.order_id));
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON pricing.order_quote FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT SELECT,INSERT ON pricing.order_quote TO routefit_api;
ALTER TABLE orders.draft ADD COLUMN quote_id uuid;
ALTER TABLE orders.draft ADD CONSTRAINT current_quote FOREIGN KEY(company_id,id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id);
ALTER TABLE orders.draft DROP CONSTRAINT draft_intake_state;
ALTER TABLE orders.draft ADD CONSTRAINT draft_intake_state CHECK(snapshot#>>'{order,state}' IN ('draft','validating','quoted'));
ALTER TABLE orders.draft DROP CONSTRAINT intake_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT intake_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}'='draft' AND intake_evidence_id IS NULL AND intake_source_version IS NULL AND intake_area_revision IS NULL AND NOT snapshot ? 'intake') OR
 (snapshot#>>'{order,state}' IN ('validating','quoted') AND intake_evidence_id IS NOT NULL AND intake_source_version IS NOT NULL AND intake_area_revision IS NOT NULL
  AND intake_source_version<version
  AND (snapshot#>>'{intake,evidenceId}') IS NOT DISTINCT FROM intake_evidence_id::text
  AND (snapshot#>>'{intake,sourceOrderVersion}') IS NOT DISTINCT FROM intake_source_version::text
  AND (snapshot#>>'{intake,acceptedOrderVersion}') IS NOT DISTINCT FROM (intake_source_version+1)::text
  AND (snapshot#>>'{intake,areaRevision}') IS NOT DISTINCT FROM intake_area_revision::text)
);
ALTER TABLE orders.draft ADD CONSTRAINT quote_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}'='quoted' AND quote_id IS NOT NULL AND (snapshot->>'quoteId') IS NOT DISTINCT FROM quote_id::text) OR
 (snapshot#>>'{order,state}' IN ('draft','validating') AND quote_id IS NULL AND snapshot->>'quoteId' IS NULL)
);
