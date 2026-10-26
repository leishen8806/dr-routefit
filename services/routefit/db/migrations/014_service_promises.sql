CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE dispatch.service_promise (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 check_id uuid NOT NULL,
 quote_id uuid NOT NULL,
 vehicle_id uuid NOT NULL,
 supersedes_promise_id uuid,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 principal_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,check_id) REFERENCES dispatch.promise_check(company_id,id),
 FOREIGN KEY(company_id,order_id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id),
 FOREIGN KEY(company_id,vehicle_id) REFERENCES fleet.vehicle(company_id,id),
 FOREIGN KEY(company_id,supersedes_promise_id) REFERENCES dispatch.service_promise(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'supersedesPromiseId') IS NOT DISTINCT FROM supersedes_promise_id::text)
);

CREATE TABLE dispatch.capacity_reservation (
 company_id uuid NOT NULL,
 promise_id uuid NOT NULL,
 order_id uuid NOT NULL,
 vehicle_id uuid NOT NULL,
 reservation_window tstzrange NOT NULL,
 released_at timestamptz,
 released_by_promise_id uuid,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,promise_id),
 FOREIGN KEY(company_id,promise_id) REFERENCES dispatch.service_promise(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,vehicle_id) REFERENCES fleet.vehicle(company_id,id),
 FOREIGN KEY(company_id,released_by_promise_id) REFERENCES dispatch.service_promise(company_id,id),
 CHECK(lower(reservation_window)<upper(reservation_window)),
 CHECK((released_at IS NULL)=(released_by_promise_id IS NULL)),
 EXCLUDE USING gist(company_id WITH =,vehicle_id WITH =,reservation_window WITH &&) WHERE(released_at IS NULL)
);
CREATE UNIQUE INDEX one_active_promise_per_order ON dispatch.capacity_reservation(company_id,order_id) WHERE released_at IS NULL;

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['dispatch.service_promise','dispatch.capacity_reservation'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
CREATE POLICY customer_scope ON dispatch.service_promise AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=service_promise.company_id AND d.id=service_promise.order_id));
CREATE POLICY customer_scope ON dispatch.capacity_reservation AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=capacity_reservation.company_id AND d.id=capacity_reservation.order_id));
CREATE TRIGGER service_promise_append_only BEFORE UPDATE OR DELETE ON dispatch.service_promise FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE FUNCTION dispatch.only_release_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Capacity reservations may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.promise_id<>NEW.promise_id OR OLD.order_id<>NEW.order_id OR OLD.vehicle_id<>NEW.vehicle_id OR OLD.reservation_window<>NEW.reservation_window OR OLD.snapshot IS DISTINCT FROM NEW.snapshot OR OLD.released_at IS NOT NULL OR NEW.released_at IS NULL THEN
  RAISE EXCEPTION 'Capacity reservations may only be released' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capacity_release_only BEFORE UPDATE OR DELETE ON dispatch.capacity_reservation FOR EACH ROW EXECUTE FUNCTION dispatch.only_release_capacity();
GRANT SELECT,INSERT ON dispatch.service_promise TO routefit_api;
GRANT SELECT,INSERT,UPDATE ON dispatch.capacity_reservation TO routefit_api;

ALTER TABLE orders.draft DROP CONSTRAINT draft_intake_state;
ALTER TABLE orders.draft ADD CONSTRAINT draft_intake_state CHECK(snapshot#>>'{order,state}' IN ('draft','validating','quoted','awaiting_dispatch'));
ALTER TABLE orders.draft DROP CONSTRAINT intake_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT intake_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}'='draft' AND intake_evidence_id IS NULL AND intake_source_version IS NULL AND intake_area_revision IS NULL AND NOT snapshot ? 'intake') OR
 (snapshot#>>'{order,state}' IN ('validating','quoted','awaiting_dispatch') AND intake_evidence_id IS NOT NULL AND intake_source_version IS NOT NULL AND intake_area_revision IS NOT NULL
  AND intake_source_version<version
  AND (snapshot#>>'{intake,evidenceId}') IS NOT DISTINCT FROM intake_evidence_id::text
  AND (snapshot#>>'{intake,sourceOrderVersion}') IS NOT DISTINCT FROM intake_source_version::text
  AND (snapshot#>>'{intake,acceptedOrderVersion}')::bigint>intake_source_version
  AND (snapshot#>>'{intake,areaRevision}') IS NOT DISTINCT FROM intake_area_revision::text)
);
ALTER TABLE orders.draft DROP CONSTRAINT quote_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT quote_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}' IN ('quoted','awaiting_dispatch') AND quote_id IS NOT NULL AND (snapshot->>'quoteId') IS NOT DISTINCT FROM quote_id::text) OR
 (snapshot#>>'{order,state}' IN ('draft','validating') AND quote_id IS NULL AND snapshot->>'quoteId' IS NULL)
);
CREATE OR REPLACE FUNCTION pricing.lock_confirmed_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_state text; new_state text;
BEGIN
 IF OLD.quote_id IS NOT NULL AND NEW.snapshot IS DISTINCT FROM OLD.snapshot AND EXISTS(SELECT 1 FROM pricing.quote_confirmation WHERE company_id=OLD.company_id AND quote_id=OLD.quote_id) THEN
  old_state:=OLD.snapshot#>>'{order,state}';new_state:=NEW.snapshot#>>'{order,state}';
  IF NOT (NEW.customer_id=OLD.customer_id AND NEW.quote_id=OLD.quote_id AND (NEW.snapshot-'order') IS NOT DISTINCT FROM (OLD.snapshot-'order')
   AND OLD.snapshot#>>'{order,id}'=NEW.snapshot#>>'{order,id}' AND OLD.snapshot#>>'{order,orderNo}'=NEW.snapshot#>>'{order,orderNo}'
   AND OLD.snapshot#>>'{order,serviceLevel}'=NEW.snapshot#>>'{order,serviceLevel}' AND OLD.snapshot#>>'{order,fulfillmentStage}'=NEW.snapshot#>>'{order,fulfillmentStage}'
   AND OLD.snapshot#>>'{order,customerId}'=NEW.snapshot#>>'{order,customerId}' AND OLD.snapshot#>>'{order,collectionState}'=NEW.snapshot#>>'{order,collectionState}'
   AND (old_state='quoted' AND new_state='awaiting_dispatch' OR old_state='awaiting_dispatch' AND new_state='awaiting_dispatch')
   AND (NEW.snapshot#>>'{order,version}')::bigint=(OLD.snapshot#>>'{order,version}')::bigint+1
   AND (NEW.snapshot#>>'{order,promiseId}')::uuid IS NOT NULL) THEN
   RAISE EXCEPTION 'Confirmed order needs controlled change workflow' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
