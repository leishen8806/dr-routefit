CREATE SCHEMA finance;
ALTER TABLE org.principal ADD COLUMN person_id uuid;
UPDATE org.principal SET person_id=id;
ALTER TABLE org.principal ALTER COLUMN person_id SET DEFAULT gen_random_uuid();
ALTER TABLE org.principal ALTER COLUMN person_id SET NOT NULL;
CREATE TABLE pricing.quote_confirmation (
 company_id uuid NOT NULL, quote_id uuid NOT NULL, order_id uuid NOT NULL, snapshot jsonb NOT NULL,
 principal_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(company_id,quote_id),
 FOREIGN KEY(company_id,order_id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE finance.receiving_account (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES org.company(id), label text NOT NULL,
 currency text NOT NULL CHECK(currency IN ('USD','KHR')), active boolean NOT NULL DEFAULT true, UNIQUE(company_id,id)
);
CREATE TABLE finance.prepayment_receipt (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,order_id uuid NOT NULL,quote_id uuid NOT NULL,account_id uuid NOT NULL,
 bank_reference text NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 9000000000000),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),prepared_by uuid NOT NULL,person_id uuid NOT NULL,snapshot jsonb NOT NULL,
 UNIQUE(company_id,id),FOREIGN KEY(company_id,quote_id) REFERENCES pricing.quote_confirmation(company_id,quote_id),
 FOREIGN KEY(company_id,order_id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id),
 FOREIGN KEY(company_id,account_id) REFERENCES finance.receiving_account(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE finance.receipt_decision (
 company_id uuid NOT NULL,receipt_id uuid NOT NULL,account_id uuid NOT NULL,bank_reference text NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('CONFIRMED','REJECTED')),principal_id uuid NOT NULL,person_id uuid NOT NULL,snapshot jsonb NOT NULL,
 PRIMARY KEY(company_id,receipt_id),FOREIGN KEY(company_id,receipt_id) REFERENCES finance.prepayment_receipt(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE UNIQUE INDEX one_bank_fact ON finance.receipt_decision(company_id,account_id,bank_reference) WHERE outcome='CONFIRMED';
CREATE TABLE finance.prepayment_allocation (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,receipt_id uuid NOT NULL,order_id uuid NOT NULL,quote_id uuid NOT NULL,
 prepared_by uuid NOT NULL,person_id uuid NOT NULL,snapshot jsonb NOT NULL,UNIQUE(company_id,id),
 FOREIGN KEY(company_id,receipt_id) REFERENCES finance.receipt_decision(company_id,receipt_id),
 FOREIGN KEY(company_id,order_id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE finance.allocation_event (
 company_id uuid NOT NULL,allocation_id uuid NOT NULL,version integer NOT NULL CHECK(version BETWEEN 2 AND 4),
 action text NOT NULL CHECK(action IN ('REVIEWED','APPROVED','POSTED','REJECTED')),principal_id uuid NOT NULL,person_id uuid NOT NULL,snapshot jsonb NOT NULL,
 PRIMARY KEY(company_id,allocation_id,version),
 FOREIGN KEY(company_id,allocation_id) REFERENCES finance.prepayment_allocation(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['pricing.quote_confirmation','finance.prepayment_receipt','finance.receipt_decision','finance.prepayment_allocation','finance.allocation_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change()',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
CREATE POLICY customer_scope ON pricing.quote_confirmation AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=quote_confirmation.company_id AND d.id=quote_confirmation.order_id));
CREATE POLICY customer_scope ON finance.prepayment_receipt AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=prepayment_receipt.company_id AND d.id=prepayment_receipt.order_id));
CREATE POLICY customer_scope ON finance.receipt_decision AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM finance.prepayment_receipt r WHERE r.company_id=receipt_decision.company_id AND r.id=receipt_decision.receipt_id));
CREATE POLICY customer_scope ON finance.prepayment_allocation AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=prepayment_allocation.company_id AND d.id=prepayment_allocation.order_id));
CREATE POLICY customer_scope ON finance.allocation_event AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM finance.prepayment_allocation a WHERE a.company_id=allocation_event.company_id AND a.id=allocation_event.allocation_id));
ALTER TABLE finance.receiving_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.receiving_account FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.receiving_account USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT USAGE ON SCHEMA finance TO routefit_api;
GRANT SELECT ON finance.receiving_account TO routefit_api;
CREATE FUNCTION finance.check_independence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maker uuid; reviewer uuid; prior text;
BEGIN
 IF TG_TABLE_NAME='receipt_decision' THEN
  SELECT person_id INTO maker FROM finance.prepayment_receipt WHERE company_id=NEW.company_id AND id=NEW.receipt_id;
  IF maker=NEW.person_id THEN RAISE EXCEPTION 'Independent verifier required' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT person_id INTO maker FROM finance.prepayment_allocation WHERE company_id=NEW.company_id AND id=NEW.allocation_id;
  SELECT person_id INTO reviewer FROM finance.allocation_event WHERE company_id=NEW.company_id AND allocation_id=NEW.allocation_id AND version=2;
  SELECT action INTO prior FROM finance.allocation_event WHERE company_id=NEW.company_id AND allocation_id=NEW.allocation_id AND version=NEW.version-1;
  IF (NEW.version=2 AND NEW.action NOT IN ('REVIEWED','REJECTED')) OR
     (NEW.version=3 AND (prior IS DISTINCT FROM 'REVIEWED' OR NEW.action NOT IN ('APPROVED','REJECTED'))) OR
     (NEW.version=4 AND (prior IS DISTINCT FROM 'APPROVED' OR NEW.action<>'POSTED')) OR
     (NEW.version IN (2,3) AND maker=NEW.person_id) OR (NEW.version=3 AND reviewer=NEW.person_id) THEN
   RAISE EXCEPTION 'Invalid independent approval sequence' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN
  RAISE EXCEPTION 'Person identity mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER independent_receipt BEFORE INSERT ON finance.receipt_decision FOR EACH ROW EXECUTE FUNCTION finance.check_independence();
CREATE TRIGGER independent_allocation BEFORE INSERT ON finance.allocation_event FOR EACH ROW EXECUTE FUNCTION finance.check_independence();
CREATE FUNCTION pricing.lock_confirmed_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.quote_id IS NOT NULL AND NEW.snapshot IS DISTINCT FROM OLD.snapshot AND EXISTS(SELECT 1 FROM pricing.quote_confirmation WHERE company_id=OLD.company_id AND quote_id=OLD.quote_id) THEN
  RAISE EXCEPTION 'Confirmed order needs controlled change workflow' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER confirmed_order_guard BEFORE UPDATE ON orders.draft FOR EACH ROW EXECUTE FUNCTION pricing.lock_confirmed_order();
