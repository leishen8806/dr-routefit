CREATE TABLE dispatch.load_review (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 order_version bigint NOT NULL,
 vehicle_id uuid NOT NULL,
 spec_version_id uuid NOT NULL,
 result text NOT NULL CHECK(result IN ('RELEASED','REJECTED','NEEDS_REVIEW')),
 reviewer_principal_id uuid NOT NULL,
 reviewer_person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id,order_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,vehicle_id) REFERENCES fleet.vehicle(company_id,id),
 FOREIGN KEY(company_id,reviewer_principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'orderVersion')::bigint=order_version),
 CHECK((snapshot->>'vehicleId') IS NOT DISTINCT FROM vehicle_id::text),
 CHECK((snapshot->>'specVersionId') IS NOT DISTINCT FROM spec_version_id::text),
 CHECK((snapshot->>'result') IS NOT DISTINCT FROM result),
 CHECK((snapshot->>'reviewerPersonId') IS NOT DISTINCT FROM reviewer_person_id::text)
);

ALTER TABLE dispatch.load_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch.load_review FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON dispatch.load_review
 USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)
 WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY customer_scope ON dispatch.load_review AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=load_review.company_id AND d.id=load_review.order_id));
CREATE TRIGGER load_review_append_only BEFORE UPDATE OR DELETE ON dispatch.load_review FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT SELECT,INSERT ON dispatch.load_review TO routefit_api;
