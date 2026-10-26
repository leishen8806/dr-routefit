CREATE TABLE casework.dispatch_exception (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 order_id uuid NOT NULL,
 category text NOT NULL CHECK(category IN ('ACCIDENT','MISSING','DAMAGED','WRONG_GOODS','RECIPIENT_UNAVAILABLE','REFUSED','PRICE_DISPUTE','OTHER')),
 state text NOT NULL CHECK(state IN ('open','assigned','resolving','resolved','closed')),
 owner_id uuid,
 due_at timestamptz,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,owner_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'category') IS NOT DISTINCT FROM category),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK(state='open' OR (owner_id IS NOT NULL AND due_at IS NOT NULL))
);

CREATE TABLE casework.dispatch_exception_event (
 company_id uuid NOT NULL,
 exception_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('REPORTED','ASSIGNED','RESOLVED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,exception_id,version),
 FOREIGN KEY(company_id,exception_id) REFERENCES casework.dispatch_exception(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE FUNCTION casework.only_advance_dispatch_exception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Dispatch exceptions may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.category<>NEW.category OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Dispatch exception identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT ((OLD.state='open' AND NEW.state='assigned') OR (OLD.state='assigned' AND NEW.state IN ('assigned','resolved')) OR (OLD.state='resolving' AND NEW.state IN ('assigned','resolved'))) THEN
  RAISE EXCEPTION 'Dispatch exception state transition is invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dispatch_exception_only_advance BEFORE UPDATE OR DELETE ON casework.dispatch_exception FOR EACH ROW EXECUTE FUNCTION casework.only_advance_dispatch_exception();
CREATE TRIGGER dispatch_exception_event_append_only BEFORE UPDATE OR DELETE ON casework.dispatch_exception_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE FUNCTION casework.check_dispatch_exception_event_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN
  RAISE EXCEPTION 'Dispatch exception event principal and person mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dispatch_exception_event_identity BEFORE INSERT ON casework.dispatch_exception_event FOR EACH ROW EXECUTE FUNCTION casework.check_dispatch_exception_event_identity();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['casework.dispatch_exception','casework.dispatch_exception_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
CREATE POLICY exception_order_scope ON casework.dispatch_exception AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=dispatch_exception.company_id AND d.id=dispatch_exception.order_id))
 WITH CHECK(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=dispatch_exception.company_id AND d.id=dispatch_exception.order_id));
CREATE POLICY exception_event_scope ON casework.dispatch_exception_event AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM casework.dispatch_exception e WHERE e.company_id=dispatch_exception_event.company_id AND e.id=dispatch_exception_event.exception_id))
 WITH CHECK(EXISTS(SELECT 1 FROM casework.dispatch_exception e WHERE e.company_id=dispatch_exception_event.company_id AND e.id=dispatch_exception_event.exception_id));
