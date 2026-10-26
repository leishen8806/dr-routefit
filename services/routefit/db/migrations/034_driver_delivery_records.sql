CREATE TABLE delivery.record (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 execution_id uuid NOT NULL,
 order_version bigint NOT NULL CHECK(order_version BETWEEN 1 AND 9000000000000),
 recipient_authorization_id uuid NOT NULL,
 delivery_state text NOT NULL CHECK(delivery_state IN ('DELIVERED','PARTIAL')),
 observed_at timestamptz NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,order_id),
 FOREIGN KEY(company_id,order_id,order_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,assignment_id) REFERENCES dispatch.assignment(company_id,id),
 FOREIGN KEY(company_id,execution_id) REFERENCES dispatch.fulfillment_execution(company_id,id),
 FOREIGN KEY(company_id,recipient_authorization_id) REFERENCES delivery.recipient_authorization(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'orderVersion')::bigint=order_version),
 CHECK((snapshot->>'deliveryState') IS NOT DISTINCT FROM delivery_state)
);

CREATE TABLE delivery.record_package (
 company_id uuid NOT NULL,
 record_id uuid NOT NULL,
 item_id uuid NOT NULL,
 package_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('DELIVERED','RETURN_PENDING')),
 PRIMARY KEY(company_id,record_id,package_id),
 FOREIGN KEY(company_id,record_id) REFERENCES delivery.record(company_id,id)
);

CREATE FUNCTION delivery.matches_order_packages(p_company_id uuid,p_record_id uuid,p_order_snapshot jsonb,p_delivery_state text) RETURNS boolean LANGUAGE sql STABLE AS $$
 WITH expected(package_id) AS (
   SELECT p.package_id::uuid FROM jsonb_array_elements(p_order_snapshot->'items') i
   CROSS JOIN LATERAL jsonb_array_elements_text(i.value->'packageIds') p(package_id)
 ), actual(package_id,outcome) AS (
   SELECT package_id,outcome FROM delivery.record_package WHERE company_id=p_company_id AND record_id=p_record_id
 )
 SELECT (SELECT count(*) FROM expected)=(SELECT count(*) FROM actual)
    AND NOT EXISTS((SELECT package_id FROM expected) EXCEPT (SELECT package_id FROM actual))
    AND NOT EXISTS((SELECT package_id FROM actual) EXCEPT (SELECT package_id FROM expected))
    AND ((p_delivery_state='DELIVERED' AND NOT EXISTS(SELECT 1 FROM actual WHERE outcome='RETURN_PENDING'))
      OR (p_delivery_state='PARTIAL' AND EXISTS(SELECT 1 FROM actual WHERE outcome='RETURN_PENDING')))
$$;

CREATE TRIGGER delivery_record_append_only BEFORE UPDATE OR DELETE ON delivery.record FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER delivery_record_package_append_only BEFORE UPDATE OR DELETE ON delivery.record_package FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

ALTER TABLE orders.draft DROP CONSTRAINT draft_intake_state;
ALTER TABLE orders.draft ADD CONSTRAINT draft_intake_state CHECK(snapshot#>>'{order,state}' IN ('draft','validating','quoted','awaiting_dispatch','executing','delivered','return_open','cancelled'));
ALTER TABLE orders.draft DROP CONSTRAINT intake_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT intake_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}'='draft' AND intake_evidence_id IS NULL AND intake_source_version IS NULL AND intake_area_revision IS NULL AND NOT snapshot ? 'intake') OR
 (snapshot#>>'{order,state}' IN ('validating','quoted','awaiting_dispatch','executing','delivered','return_open','cancelled') AND intake_evidence_id IS NOT NULL AND intake_source_version IS NOT NULL AND intake_area_revision IS NOT NULL
  AND intake_source_version<version
  AND (snapshot#>>'{intake,evidenceId}') IS NOT DISTINCT FROM intake_evidence_id::text
  AND (snapshot#>>'{intake,sourceOrderVersion}') IS NOT DISTINCT FROM intake_source_version::text
  AND (snapshot#>>'{intake,acceptedOrderVersion}')::bigint>intake_source_version
  AND (snapshot#>>'{intake,areaRevision}') IS NOT DISTINCT FROM intake_area_revision::text)
);
ALTER TABLE orders.draft DROP CONSTRAINT quote_snapshot_consistent;
ALTER TABLE orders.draft ADD CONSTRAINT quote_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}' IN ('quoted','awaiting_dispatch','executing','delivered','return_open','cancelled') AND quote_id IS NOT NULL AND (snapshot->>'quoteId') IS NOT DISTINCT FROM quote_id::text) OR
 (snapshot#>>'{order,state}' IN ('draft','validating') AND quote_id IS NULL AND snapshot->>'quoteId' IS NULL)
);

ALTER TABLE dispatch.assignment_event DROP CONSTRAINT assignment_event_action_check;
ALTER TABLE dispatch.assignment_event ADD CONSTRAINT assignment_event_action_check CHECK(action IN ('OFFERED','ACCEPTED','REJECTED','DEPARTED','DELIVERY_RECORDED','REVOKED','SUPERSEDED','EXPIRED'));

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
    OR old_state='executing' AND new_state IN ('delivered','return_open')
     AND OLD.snapshot#>>'{order,fulfillmentStage}'='in_transit' AND NEW.snapshot#>>'{order,fulfillmentStage}'='delivery_recorded'
     AND (NEW.snapshot#>>'{order,promiseId}')::uuid=(OLD.snapshot#>>'{order,promiseId}')::uuid
     AND EXISTS(SELECT 1 FROM delivery.record r WHERE r.company_id=OLD.company_id AND r.order_id=OLD.id AND r.order_version=OLD.version
      AND ((new_state='delivered' AND r.delivery_state='DELIVERED') OR (new_state='return_open' AND r.delivery_state='PARTIAL'))
      AND delivery.matches_order_packages(OLD.company_id,r.id,OLD.snapshot,r.delivery_state))
    OR old_state IN ('quoted','awaiting_dispatch') AND new_state='cancelled'
     AND OLD.snapshot#>>'{order,fulfillmentStage}'=NEW.snapshot#>>'{order,fulfillmentStage}'
     AND NEW.snapshot#>>'{order,promiseId}' IS NULL
     AND EXISTS(SELECT 1 FROM orders.cancellation c WHERE c.company_id=OLD.company_id AND c.order_id=OLD.id AND c.source_order_version=OLD.version)
   )
  ) THEN RAISE EXCEPTION 'Confirmed order needs controlled change workflow' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

ALTER TABLE delivery.record ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery.record FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON delivery.record USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE delivery.record_package ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery.record_package FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON delivery.record_package USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT SELECT,INSERT ON delivery.record,delivery.record_package TO routefit_api;
