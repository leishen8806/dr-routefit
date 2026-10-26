CREATE TABLE partner.carrier_booking (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 partner_id uuid NOT NULL,
 agreement_version_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('draft','pending_confirmation','confirmed','pickup_pending','in_transit','delivery_reported','delivered_verified','cancel_requested','cancelled','exception')),
 proposed_amount_minor bigint NOT NULL CHECK(proposed_amount_minor BETWEEN 1 AND 9000000000000),
 proposed_currency text NOT NULL CHECK(proposed_currency IN ('USD','KHR')),
 external_tracking_no text,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,partner_id) REFERENCES partner.carrier(company_id,id),
 FOREIGN KEY(company_id,agreement_version_id) REFERENCES partner.agreement_version(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'partnerId') IS NOT DISTINCT FROM partner_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'externalTrackingNo') IS NOT DISTINCT FROM external_tracking_no)
);
CREATE UNIQUE INDEX one_effective_booking_per_order ON partner.carrier_booking(company_id,order_id)
 WHERE state IN ('draft','pending_confirmation','confirmed','pickup_pending','in_transit','delivery_reported','cancel_requested','exception');

CREATE TABLE partner.carrier_booking_event (
 company_id uuid NOT NULL,
 booking_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('CREATED','REQUESTED','CONFIRMED','DELIVERY_REPORTED','DELIVERY_VERIFIED','CANCEL_REQUESTED','CANCELLED','CARRIER_REPORTED')),
 external_event_id text,
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,booking_id,version),
 UNIQUE(company_id,external_event_id),
 FOREIGN KEY(company_id,booking_id) REFERENCES partner.carrier_booking(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE FUNCTION partner.only_advance_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Carrier bookings may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.partner_id<>NEW.partner_id OR OLD.agreement_version_id<>NEW.agreement_version_id OR OLD.proposed_amount_minor<>NEW.proposed_amount_minor OR OLD.proposed_currency<>NEW.proposed_currency OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Carrier booking identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER carrier_booking_only_advance BEFORE UPDATE OR DELETE ON partner.carrier_booking FOR EACH ROW EXECUTE FUNCTION partner.only_advance_booking();
CREATE TRIGGER carrier_booking_event_append_only BEFORE UPDATE OR DELETE ON partner.carrier_booking_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE FUNCTION partner.check_carrier_booking_event_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN
  RAISE EXCEPTION 'Carrier booking event principal and person mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER carrier_booking_event_identity BEFORE INSERT ON partner.carrier_booking_event FOR EACH ROW EXECUTE FUNCTION partner.check_carrier_booking_event_identity();
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['partner.carrier_booking','partner.carrier_booking_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
CREATE POLICY booking_order_scope ON partner.carrier_booking AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=carrier_booking.company_id AND d.id=carrier_booking.order_id))
 WITH CHECK(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=carrier_booking.company_id AND d.id=carrier_booking.order_id));
CREATE POLICY booking_event_scope ON partner.carrier_booking_event AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM partner.carrier_booking b WHERE b.company_id=carrier_booking_event.company_id AND b.id=carrier_booking_event.booking_id))
 WITH CHECK(EXISTS(SELECT 1 FROM partner.carrier_booking b WHERE b.company_id=carrier_booking_event.company_id AND b.id=carrier_booking_event.booking_id));
