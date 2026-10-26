ALTER TABLE dispatch.capacity_reservation ADD COLUMN release_reason text;
DO $$
DECLARE c text;
BEGIN
 SELECT conname INTO c FROM pg_constraint WHERE conrelid='dispatch.capacity_reservation'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%released_at%released_by_promise_id%';
 IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE dispatch.capacity_reservation DROP CONSTRAINT %I',c); END IF;
END $$;
ALTER TABLE dispatch.capacity_reservation ADD CONSTRAINT capacity_reservation_release_fact CHECK(
 (released_at IS NULL AND released_by_promise_id IS NULL AND release_reason IS NULL) OR
 (released_at IS NOT NULL AND ((released_by_promise_id IS NOT NULL AND release_reason='SUPERSEDED') OR (released_by_promise_id IS NULL AND release_reason='CANCELLED')))
);
CREATE OR REPLACE FUNCTION dispatch.only_release_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Capacity reservations may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.promise_id<>NEW.promise_id OR OLD.order_id<>NEW.order_id OR OLD.vehicle_id<>NEW.vehicle_id OR OLD.reservation_window<>NEW.reservation_window OR OLD.snapshot IS DISTINCT FROM NEW.snapshot OR OLD.released_at IS NOT NULL OR NEW.released_at IS NULL THEN
  RAISE EXCEPTION 'Capacity reservations may only be released' USING ERRCODE='23514';
 END IF;
 IF (NEW.release_reason='SUPERSEDED' AND NEW.released_by_promise_id IS NULL) OR (NEW.release_reason='CANCELLED' AND NEW.released_by_promise_id IS NOT NULL) OR NEW.release_reason NOT IN ('SUPERSEDED','CANCELLED') THEN
  RAISE EXCEPTION 'Capacity release evidence is inconsistent' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE TABLE orders.cancellation (
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 source_order_version bigint NOT NULL,
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,order_id),
 FOREIGN KEY(company_id,order_id,source_order_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'sourceOrderVersion')::bigint=source_order_version),
 CHECK((snapshot->>'principalId') IS NOT DISTINCT FROM principal_id::text),
 CHECK((snapshot->>'personId') IS NOT DISTINCT FROM person_id::text)
);
ALTER TABLE orders.cancellation ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders.cancellation FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON orders.cancellation
 USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)
 WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY customer_scope ON orders.cancellation AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=cancellation.company_id AND d.id=cancellation.order_id));
CREATE FUNCTION orders.check_cancellation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN
  RAISE EXCEPTION 'Cancellation person identity mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cancellation_identity BEFORE INSERT ON orders.cancellation FOR EACH ROW EXECUTE FUNCTION orders.check_cancellation_identity();
CREATE TRIGGER cancellation_append_only BEFORE UPDATE OR DELETE ON orders.cancellation FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT SELECT,INSERT ON orders.cancellation TO routefit_api;

ALTER TABLE orders.draft DROP CONSTRAINT draft_intake_state;
ALTER TABLE orders.draft ADD CONSTRAINT draft_intake_state CHECK(snapshot#>>'{order,state}' IN ('draft','validating','quoted','awaiting_dispatch','cancelled'));
ALTER TABLE orders.draft DROP CONSTRAINT intake_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT intake_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}'='draft' AND intake_evidence_id IS NULL AND intake_source_version IS NULL AND intake_area_revision IS NULL AND NOT snapshot ? 'intake') OR
 (snapshot#>>'{order,state}' IN ('validating','quoted','awaiting_dispatch','cancelled') AND intake_evidence_id IS NOT NULL AND intake_source_version IS NOT NULL AND intake_area_revision IS NOT NULL
  AND intake_source_version<version
  AND (snapshot#>>'{intake,evidenceId}') IS NOT DISTINCT FROM intake_evidence_id::text
  AND (snapshot#>>'{intake,sourceOrderVersion}') IS NOT DISTINCT FROM intake_source_version::text
  AND (snapshot#>>'{intake,acceptedOrderVersion}')::bigint>intake_source_version
  AND (snapshot#>>'{intake,areaRevision}') IS NOT DISTINCT FROM intake_area_revision::text)
);
ALTER TABLE orders.draft DROP CONSTRAINT quote_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT quote_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}' IN ('quoted','awaiting_dispatch','cancelled') AND quote_id IS NOT NULL AND (snapshot->>'quoteId') IS NOT DISTINCT FROM quote_id::text) OR
 (snapshot#>>'{order,state}' IN ('draft','validating') AND quote_id IS NULL AND snapshot->>'quoteId' IS NULL)
);
CREATE OR REPLACE FUNCTION pricing.lock_confirmed_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_state text; new_state text;
BEGIN
 IF OLD.quote_id IS NOT NULL AND NEW.snapshot IS DISTINCT FROM OLD.snapshot AND EXISTS(SELECT 1 FROM pricing.quote_confirmation WHERE company_id=OLD.company_id AND quote_id=OLD.quote_id) THEN
  old_state:=OLD.snapshot#>>'{order,state}';new_state:=NEW.snapshot#>>'{order,state}';
  IF NOT (
   (NEW.customer_id=OLD.customer_id AND NEW.quote_id=OLD.quote_id AND (NEW.snapshot-'order') IS NOT DISTINCT FROM (OLD.snapshot-'order')
    AND OLD.snapshot#>>'{order,id}'=NEW.snapshot#>>'{order,id}' AND OLD.snapshot#>>'{order,orderNo}'=NEW.snapshot#>>'{order,orderNo}'
    AND OLD.snapshot#>>'{order,serviceLevel}'=NEW.snapshot#>>'{order,serviceLevel}' AND OLD.snapshot#>>'{order,fulfillmentStage}'=NEW.snapshot#>>'{order,fulfillmentStage}'
    AND OLD.snapshot#>>'{order,customerId}'=NEW.snapshot#>>'{order,customerId}'
    AND (old_state='quoted' AND new_state='awaiting_dispatch' OR old_state='awaiting_dispatch' AND new_state='awaiting_dispatch')
    AND (NEW.snapshot#>>'{order,version}')::bigint=(OLD.snapshot#>>'{order,version}')::bigint+1
    AND (NEW.snapshot#>>'{order,promiseId}')::uuid IS NOT NULL)
   OR
   (NEW.customer_id=OLD.customer_id AND NEW.quote_id=OLD.quote_id AND (NEW.snapshot-'order') IS NOT DISTINCT FROM (OLD.snapshot-'order')
    AND OLD.snapshot#>>'{order,id}'=NEW.snapshot#>>'{order,id}' AND OLD.snapshot#>>'{order,orderNo}'=NEW.snapshot#>>'{order,orderNo}'
    AND OLD.snapshot#>>'{order,serviceLevel}'=NEW.snapshot#>>'{order,serviceLevel}' AND OLD.snapshot#>>'{order,fulfillmentStage}'=NEW.snapshot#>>'{order,fulfillmentStage}'
    AND OLD.snapshot#>>'{order,customerId}'=NEW.snapshot#>>'{order,customerId}'
    AND old_state IN ('quoted','awaiting_dispatch') AND new_state='cancelled'
    AND (NEW.snapshot#>>'{order,version}')::bigint=(OLD.snapshot#>>'{order,version}')::bigint+1
    AND NEW.snapshot#>>'{order,promiseId}' IS NULL
    AND EXISTS(SELECT 1 FROM orders.cancellation c WHERE c.company_id=OLD.company_id AND c.order_id=OLD.id AND c.source_order_version=OLD.version))
  ) THEN
   RAISE EXCEPTION 'Confirmed order needs controlled change workflow' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
