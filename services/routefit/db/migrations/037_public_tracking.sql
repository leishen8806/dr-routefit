CREATE SCHEMA sharing;

CREATE TABLE sharing.tracking_link (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 token_hash text NOT NULL CHECK(token_hash~'^[a-f0-9]{64}$'),
 contact_entry text NOT NULL CHECK(length(btrim(contact_entry)) BETWEEN 1 AND 500),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(token_hash),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id)
);
CREATE INDEX tracking_link_order_active ON sharing.tracking_link(company_id,order_id) WHERE revoked_at IS NULL;

CREATE FUNCTION sharing.public_tracking(token text) RETURNS TABLE(order_label text,state text,promise_window jsonb,eta_at timestamptz,eta_type text,updated_at timestamptz,quality text,contact_entry text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT d.snapshot#>>'{order,orderNo}',
  CASE WHEN d.snapshot#>>'{order,state}'='delivered' THEN 'delivered' WHEN d.snapshot#>>'{order,state}'='return_open' THEN 'returning' WHEN d.snapshot#>>'{order,state}'='cancelled' THEN 'cancelled' WHEN d.snapshot#>>'{order,state}'='closed_exception' THEN 'exception' WHEN d.snapshot#>>'{order,fulfillmentStage}' IN ('picked_up','in_transit') THEN 'in_transit' WHEN d.snapshot#>>'{order,fulfillmentStage}'='pickup_pending' THEN 'pickup_pending' ELSE 'preparing' END,
  NULL::jsonb,NULL::timestamptz,'UNAVAILABLE',d.updated_at,'fresh',l.contact_entry
 FROM sharing.tracking_link l JOIN orders.draft d ON (d.company_id,d.id)=(l.company_id,l.order_id)
 WHERE l.token_hash=token AND l.revoked_at IS NULL AND l.expires_at>clock_timestamp()
 LIMIT 1
$$;
REVOKE ALL ON SCHEMA sharing FROM PUBLIC;
REVOKE ALL ON sharing.tracking_link FROM routefit_api;
REVOKE ALL ON FUNCTION sharing.public_tracking(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA sharing TO routefit_api;
GRANT EXECUTE ON FUNCTION sharing.public_tracking(text) TO routefit_api;
