ALTER TABLE dispatch.assignment_event DROP CONSTRAINT assignment_event_action_check;
ALTER TABLE dispatch.assignment_event ADD CONSTRAINT assignment_event_action_check CHECK(action IN ('OFFERED','ACCEPTED','REJECTED','DEPARTED','REVOKED','SUPERSEDED','EXPIRED'));

CREATE OR REPLACE FUNCTION pricing.lock_confirmed_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_state text; new_state text;
BEGIN
 IF OLD.quote_id IS NOT NULL AND NEW.snapshot IS DISTINCT FROM OLD.snapshot AND EXISTS(SELECT 1 FROM pricing.quote_confirmation WHERE company_id=OLD.company_id AND quote_id=OLD.quote_id) THEN
  old_state:=OLD.snapshot#>>'{order,state}';new_state:=NEW.snapshot#>>'{order,state}';
  IF NOT (NEW.customer_id=OLD.customer_id AND NEW.quote_id=OLD.quote_id AND (NEW.snapshot-'order') IS NOT DISTINCT FROM (OLD.snapshot-'order')
   AND OLD.snapshot#>>'{order,id}'=NEW.snapshot#>>'{order,id}' AND OLD.snapshot#>>'{order,orderNo}'=NEW.snapshot#>>'{order,orderNo}'
   AND OLD.snapshot#>>'{order,serviceLevel}'=NEW.snapshot#>>'{order,serviceLevel}' AND OLD.snapshot#>>'{order,customerId}'=NEW.snapshot#>>'{order,customerId}' AND OLD.snapshot#>>'{order,collectionState}'=NEW.snapshot#>>'{order,collectionState}'
   AND (NEW.snapshot#>>'{order,version}')::bigint=(OLD.snapshot#>>'{order,version}')::bigint+1
   AND (
    ((old_state='quoted' AND new_state='awaiting_dispatch') OR (old_state='awaiting_dispatch' AND new_state='awaiting_dispatch'))
     AND OLD.snapshot#>>'{order,fulfillmentStage}'=NEW.snapshot#>>'{order,fulfillmentStage}'
     AND (NEW.snapshot#>>'{order,promiseId}')::uuid IS NOT NULL
    OR old_state='awaiting_dispatch' AND new_state='executing'
     AND OLD.snapshot#>>'{order,fulfillmentStage}'='none' AND NEW.snapshot#>>'{order,fulfillmentStage}'='pickup_pending'
     AND (NEW.snapshot#>>'{order,promiseId}')::uuid=(OLD.snapshot#>>'{order,promiseId}')::uuid
     AND EXISTS(SELECT 1 FROM dispatch.assignment a WHERE a.company_id=OLD.company_id AND a.order_id=OLD.id AND a.promise_id=(OLD.snapshot#>>'{order,promiseId}')::uuid AND a.state='accepted')
    OR old_state='executing' AND new_state='executing'
     AND OLD.snapshot#>>'{order,fulfillmentStage}'='pickup_pending' AND NEW.snapshot#>>'{order,fulfillmentStage}'='in_transit'
     AND (NEW.snapshot#>>'{order,promiseId}')::uuid=(OLD.snapshot#>>'{order,promiseId}')::uuid
     AND EXISTS(SELECT 1 FROM dispatch.assignment a WHERE a.company_id=OLD.company_id AND a.order_id=OLD.id AND a.promise_id=(OLD.snapshot#>>'{order,promiseId}')::uuid AND a.state='accepted'
      AND (SELECT count(*) FROM custody.package_position cp WHERE cp.company_id=OLD.company_id AND cp.order_id=OLD.id AND cp.custodian_id=a.driver_id)=
          (SELECT count(*) FROM jsonb_array_elements(OLD.snapshot->'items') i CROSS JOIN LATERAL jsonb_array_elements_text(i.value->'packageIds')))
    OR old_state IN ('quoted','awaiting_dispatch') AND new_state='cancelled'
     AND OLD.snapshot#>>'{order,fulfillmentStage}'=NEW.snapshot#>>'{order,fulfillmentStage}'
     AND NEW.snapshot#>>'{order,promiseId}' IS NULL
     AND EXISTS(SELECT 1 FROM orders.cancellation c WHERE c.company_id=OLD.company_id AND c.order_id=OLD.id AND c.source_order_version=OLD.version)
   )
  ) THEN RAISE EXCEPTION 'Confirmed order needs controlled change workflow' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
