CREATE TABLE integration.service_binding (
 company_id uuid NOT NULL REFERENCES org.company(id),
 principal_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('WAREHOUSE','EXTERNAL')),
 source_system text NOT NULL CHECK(length(btrim(source_system)) BETWEEN 1 AND 128),
 customer_id uuid NOT NULL,
 warehouse_id uuid NULL,
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','DISABLED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,principal_id),
 UNIQUE(company_id,channel,source_system,customer_id,warehouse_id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,customer_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,warehouse_id) REFERENCES warehouse.site(company_id,id),
 CHECK((channel='WAREHOUSE')=(warehouse_id IS NOT NULL))
);

CREATE FUNCTION integration.validate_service_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal WHERE company_id=NEW.company_id AND id=NEW.principal_id AND kind='SERVICE' AND status='ACTIVE') THEN
  RAISE EXCEPTION 'Service binding requires an active SERVICE principal' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER integration_service_binding_principal BEFORE INSERT OR UPDATE ON integration.service_binding FOR EACH ROW EXECUTE FUNCTION integration.validate_service_binding();

CREATE TABLE integration.external_intake (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 channel text NOT NULL CHECK(channel IN ('WAREHOUSE','EXTERNAL')),
 service_principal_id uuid NOT NULL,
 source_system text NOT NULL CHECK(length(btrim(source_system)) BETWEEN 1 AND 128),
 customer_id uuid NOT NULL,
 external_order_id text NOT NULL CHECK(length(btrim(external_order_id)) BETWEEN 1 AND 128),
 external_revision bigint NOT NULL CHECK(external_revision BETWEEN 1 AND 9000000000000),
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 order_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('pending_review','validated','rejected','dispatch_requested')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,channel,source_system,customer_id,external_order_id),
 FOREIGN KEY(company_id,service_principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,customer_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'externalOrderId') IS NOT DISTINCT FROM external_order_id),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);
CREATE TABLE integration.external_intake_event (
 company_id uuid NOT NULL,
 intake_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('IMPORTED','REVISED','DISPATCH_REQUESTED')),
 principal_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,intake_id,version),
 FOREIGN KEY(company_id,intake_id) REFERENCES integration.external_intake(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE integration.wms_stock_event (
 company_id uuid NOT NULL,
 service_principal_id uuid NOT NULL,
 source_system text NOT NULL CHECK(length(btrim(source_system)) BETWEEN 1 AND 128),
 external_event_id text NOT NULL CHECK(length(btrim(external_event_id)) BETWEEN 1 AND 128),
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 inventory_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,source_system,external_event_id),
 FOREIGN KEY(company_id,service_principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,inventory_id) REFERENCES warehouse.inventory_snapshot(company_id,id)
);

CREATE FUNCTION integration.only_advance_external_intake() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'External intake may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.channel<>NEW.channel OR OLD.service_principal_id<>NEW.service_principal_id OR OLD.source_system<>NEW.source_system OR OLD.customer_id<>NEW.customer_id OR OLD.external_order_id<>NEW.external_order_id OR OLD.order_id<>NEW.order_id OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'External intake identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NEW.external_revision<OLD.external_revision OR (NEW.external_revision=OLD.external_revision AND NEW.content_hash<>OLD.content_hash) THEN
  RAISE EXCEPTION 'External intake revision is invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER integration_external_intake_only_advance BEFORE UPDATE OR DELETE ON integration.external_intake FOR EACH ROW EXECUTE FUNCTION integration.only_advance_external_intake();
CREATE TRIGGER integration_external_intake_event_append_only BEFORE UPDATE OR DELETE ON integration.external_intake_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER integration_wms_stock_event_append_only BEFORE UPDATE OR DELETE ON integration.wms_stock_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DROP POLICY customer_scope ON orders.draft;
CREATE POLICY customer_scope ON orders.draft AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM party.customer c WHERE c.company_id=draft.company_id AND c.id=draft.customer_id AND c.status='ACTIVE' AND (
  EXISTS(SELECT 1 FROM party.customer_access a WHERE a.company_id=c.company_id AND a.customer_id=c.id AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid)
  OR EXISTS(SELECT 1 FROM integration.service_binding b WHERE b.company_id=c.company_id AND b.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND b.customer_id=c.id AND b.state='ACTIVE')
 )) OR EXISTS(SELECT 1 FROM dispatch.assignment a WHERE a.company_id=draft.company_id AND a.order_id=draft.id AND a.driver_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND a.state IN ('offered','accepted')))
 WITH CHECK(EXISTS(SELECT 1 FROM party.customer c WHERE c.company_id=draft.company_id AND c.id=draft.customer_id AND c.status='ACTIVE' AND (
  EXISTS(SELECT 1 FROM party.customer_access a WHERE a.company_id=c.company_id AND a.customer_id=c.id AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid)
  OR EXISTS(SELECT 1 FROM integration.service_binding b WHERE b.company_id=c.company_id AND b.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND b.customer_id=c.id AND b.state='ACTIVE')
 )) OR EXISTS(SELECT 1 FROM dispatch.assignment a WHERE a.company_id=draft.company_id AND a.order_id=draft.id AND a.driver_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND a.state='accepted'));

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['integration.service_binding','integration.external_intake','integration.external_intake_event','integration.wms_stock_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
CREATE POLICY service_binding_scope ON integration.service_binding AS RESTRICTIVE
 USING(principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid)
 WITH CHECK(principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid);
CREATE POLICY intake_service_scope ON integration.external_intake AS RESTRICTIVE
 USING(service_principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid)
 WITH CHECK(service_principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid);
CREATE POLICY stock_event_service_scope ON integration.wms_stock_event AS RESTRICTIVE
 USING(service_principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid)
 WITH CHECK(service_principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid);
CREATE POLICY intake_event_service_scope ON integration.external_intake_event AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM integration.external_intake i WHERE i.company_id=external_intake_event.company_id AND i.id=external_intake_event.intake_id))
 WITH CHECK(EXISTS(SELECT 1 FROM integration.external_intake i WHERE i.company_id=external_intake_event.company_id AND i.id=external_intake_event.intake_id));

GRANT SELECT ON integration.service_binding TO routefit_api;
GRANT SELECT,INSERT,UPDATE ON integration.external_intake,warehouse.inventory_snapshot TO routefit_api;
GRANT SELECT,INSERT ON integration.external_intake_event,integration.wms_stock_event TO routefit_api;
