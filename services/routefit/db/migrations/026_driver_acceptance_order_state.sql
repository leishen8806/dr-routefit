ALTER TABLE orders.draft DROP CONSTRAINT draft_intake_state;
ALTER TABLE orders.draft ADD CONSTRAINT draft_intake_state CHECK(snapshot#>>'{order,state}' IN ('draft','validating','quoted','awaiting_dispatch','executing','cancelled'));
ALTER TABLE orders.draft DROP CONSTRAINT intake_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT intake_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}'='draft' AND intake_evidence_id IS NULL AND intake_source_version IS NULL AND intake_area_revision IS NULL AND NOT snapshot ? 'intake') OR
 (snapshot#>>'{order,state}' IN ('validating','quoted','awaiting_dispatch','executing','cancelled') AND intake_evidence_id IS NOT NULL AND intake_source_version IS NOT NULL AND intake_area_revision IS NOT NULL
  AND intake_source_version<version
  AND (snapshot#>>'{intake,evidenceId}') IS NOT DISTINCT FROM intake_evidence_id::text
  AND (snapshot#>>'{intake,sourceOrderVersion}') IS NOT DISTINCT FROM intake_source_version::text
  AND (snapshot#>>'{intake,acceptedOrderVersion}')::bigint>intake_source_version
  AND (snapshot#>>'{intake,areaRevision}') IS NOT DISTINCT FROM intake_area_revision::text)
);
ALTER TABLE orders.draft DROP CONSTRAINT quote_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT quote_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}' IN ('quoted','awaiting_dispatch','executing','cancelled') AND quote_id IS NOT NULL AND (snapshot->>'quoteId') IS NOT DISTINCT FROM quote_id::text) OR
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
   AND OLD.snapshot#>>'{order,customerId}'=NEW.snapshot#>>'{order,customerId}'
   AND (NEW.snapshot#>>'{order,version}')::bigint=(OLD.snapshot#>>'{order,version}')::bigint+1
   AND (
    ((old_state='quoted' AND new_state='awaiting_dispatch') OR (old_state='awaiting_dispatch' AND new_state='awaiting_dispatch'))
     AND (NEW.snapshot#>>'{order,promiseId}')::uuid IS NOT NULL
    OR old_state='awaiting_dispatch' AND new_state='executing'
     AND (NEW.snapshot#>>'{order,promiseId}')::uuid=(OLD.snapshot#>>'{order,promiseId}')::uuid
     AND EXISTS(SELECT 1 FROM dispatch.assignment a WHERE a.company_id=OLD.company_id AND a.order_id=OLD.id AND a.promise_id=(OLD.snapshot#>>'{order,promiseId}')::uuid AND a.state='accepted')
    OR old_state IN ('quoted','awaiting_dispatch') AND new_state='cancelled'
     AND NEW.snapshot#>>'{order,promiseId}' IS NULL
     AND EXISTS(SELECT 1 FROM orders.cancellation c WHERE c.company_id=OLD.company_id AND c.order_id=OLD.id AND c.source_order_version=OLD.version)
   )
  ) THEN RAISE EXCEPTION 'Confirmed order needs controlled change workflow' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
