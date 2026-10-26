CREATE SCHEMA fleet;
CREATE SCHEMA dispatch;

CREATE TABLE fleet.vehicle (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 driver_id uuid NOT NULL,
 spec_version_id uuid NOT NULL,
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 64),
 kind text NOT NULL CHECK(kind IN ('MOTORCYCLE','TRICYCLE','VAN','LIGHT_TRUCK','BOX_TRUCK')),
 state text NOT NULL CHECK(state IN ('available','busy','paused','incident')),
 max_payload_kg numeric NOT NULL CHECK(max_payload_kg>0),
 internal_length_cm numeric NOT NULL CHECK(internal_length_cm>0),
 internal_width_cm numeric NOT NULL CHECK(internal_width_cm>0),
 internal_height_cm numeric NOT NULL CHECK(internal_height_cm>0),
 door_width_cm numeric NOT NULL CHECK(door_width_cm>0),
 door_height_cm numeric NOT NULL CHECK(door_height_cm>0),
 version bigint NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9000000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES org.principal(company_id,id)
);

CREATE TABLE dispatch.promise_check (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 order_version bigint NOT NULL,
 quote_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 principal_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id,order_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,order_id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'orderVersion')::bigint=order_version),
 CHECK((snapshot->>'quoteId') IS NOT DISTINCT FROM quote_id::text)
);

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['fleet.vehicle','dispatch.promise_check'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
CREATE POLICY customer_scope ON dispatch.promise_check AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=promise_check.company_id AND d.id=promise_check.order_id));
CREATE TRIGGER promise_check_append_only BEFORE UPDATE OR DELETE ON dispatch.promise_check FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT USAGE ON SCHEMA fleet,dispatch TO routefit_api;
GRANT SELECT ON fleet.vehicle TO routefit_api;
GRANT SELECT,INSERT ON dispatch.promise_check TO routefit_api;
