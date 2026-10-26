CREATE TABLE warehouse.inventory_snapshot (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 owner_account_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 sku_id uuid NOT NULL,
 lot_ref text NULL CHECK(lot_ref IS NULL OR length(lot_ref) BETWEEN 1 AND 128),
 lot_key text NOT NULL,
 unit text NOT NULL CHECK(length(unit) BETWEEN 1 AND 32),
 book_qty bigint NOT NULL CHECK(book_qty>=0),
 reserved_qty bigint NOT NULL DEFAULT 0 CHECK(reserved_qty>=0),
 quarantine_qty bigint NOT NULL DEFAULT 0 CHECK(quarantine_qty>=0),
 source text NOT NULL CHECK(source IN ('ROUTEFIT_WMS','EXTERNAL_WMS')),
 source_version bigint NOT NULL CHECK(source_version BETWEEN 1 AND 9000000000000),
 observed_at timestamptz NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,owner_account_id,warehouse_id,sku_id,lot_key,unit),
 FOREIGN KEY(company_id,owner_account_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,warehouse_id) REFERENCES warehouse.site(company_id,id),
 CHECK(book_qty>=reserved_qty+quarantine_qty)
);
CREATE INDEX warehouse_inventory_owner_cursor ON warehouse.inventory_snapshot(company_id,owner_account_id,warehouse_id,sku_id,id);

CREATE TABLE warehouse.stock_reservation (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 warehouse_request_id uuid NOT NULL,
 owner_account_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('requested','confirmed','released','consumed','disputed')),
 authority text NOT NULL CHECK(authority IN ('ROUTEFIT_WMS','EXTERNAL_WMS')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,warehouse_request_id) REFERENCES warehouse.request(company_id,id),
 FOREIGN KEY(company_id,owner_account_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,warehouse_id) REFERENCES warehouse.site(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'warehouseRequestId') IS NOT DISTINCT FROM warehouse_request_id::text),
 CHECK((snapshot->>'authority') IS NOT DISTINCT FROM authority)
);
CREATE UNIQUE INDEX warehouse_stock_reservation_active_request ON warehouse.stock_reservation(company_id,warehouse_request_id) WHERE state='confirmed';

CREATE TABLE warehouse.stock_reservation_line (
 company_id uuid NOT NULL,
 reservation_id uuid NOT NULL,
 inventory_id uuid NOT NULL,
 inventory_version bigint NOT NULL CHECK(inventory_version BETWEEN 1 AND 9000000000000),
 sku_id uuid NOT NULL,
 quantity bigint NOT NULL CHECK(quantity>0),
 PRIMARY KEY(company_id,reservation_id,inventory_id),
 FOREIGN KEY(company_id,reservation_id) REFERENCES warehouse.stock_reservation(company_id,id),
 FOREIGN KEY(company_id,inventory_id) REFERENCES warehouse.inventory_snapshot(company_id,id)
);
CREATE TABLE warehouse.stock_reservation_event (
 company_id uuid NOT NULL,
 reservation_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('CONFIRMED','RELEASED','CONSUMED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,reservation_id,version),
 FOREIGN KEY(company_id,reservation_id) REFERENCES warehouse.stock_reservation(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE FUNCTION warehouse.only_advance_stock_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Stock reservations may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.warehouse_request_id<>NEW.warehouse_request_id OR OLD.owner_account_id<>NEW.owner_account_id OR OLD.warehouse_id<>NEW.warehouse_id OR OLD.authority<>NEW.authority OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Stock reservation identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT (OLD.state='confirmed' AND NEW.state IN ('released','consumed')) THEN RAISE EXCEPTION 'Stock reservation state transition is invalid' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER warehouse_stock_reservation_only_advance BEFORE UPDATE OR DELETE ON warehouse.stock_reservation FOR EACH ROW EXECUTE FUNCTION warehouse.only_advance_stock_reservation();
CREATE TRIGGER warehouse_stock_reservation_line_append_only BEFORE UPDATE OR DELETE ON warehouse.stock_reservation_line FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER warehouse_stock_reservation_event_append_only BEFORE UPDATE OR DELETE ON warehouse.stock_reservation_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['warehouse.inventory_snapshot','warehouse.stock_reservation','warehouse.stock_reservation_line','warehouse.stock_reservation_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON warehouse.inventory_snapshot,warehouse.stock_reservation TO routefit_api;
GRANT SELECT,INSERT ON warehouse.stock_reservation_line,warehouse.stock_reservation_event TO routefit_api;
