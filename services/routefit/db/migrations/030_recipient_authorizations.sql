CREATE SCHEMA delivery;

CREATE TABLE delivery.recipient_authorization (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 order_version bigint NOT NULL CHECK(order_version BETWEEN 1 AND 9000000000000),
 expires_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('active','revoked','expired')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id,order_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'orderVersion')::bigint=order_version),
 CHECK((snapshot->>'expiresAt')::timestamptz=expires_at),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);
CREATE UNIQUE INDEX one_active_recipient_authorization_per_order ON delivery.recipient_authorization(company_id,order_id) WHERE state='active';
CREATE TRIGGER recipient_authorization_append_only BEFORE UPDATE OR DELETE ON delivery.recipient_authorization FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

ALTER TABLE delivery.recipient_authorization ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery.recipient_authorization FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON delivery.recipient_authorization
 USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)
 WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT USAGE ON SCHEMA delivery TO routefit_api;
GRANT SELECT,INSERT ON delivery.recipient_authorization TO routefit_api;
