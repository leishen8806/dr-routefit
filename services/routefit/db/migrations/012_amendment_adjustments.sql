ALTER TABLE finance.ledger_item ADD CONSTRAINT ledger_item_company_id_unique UNIQUE(company_id,id);
CREATE TABLE finance.amendment_adjustment (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, order_id uuid NOT NULL, candidate_quote_id uuid NOT NULL,
 base_ledger_item_id uuid NOT NULL, prepared_by uuid NOT NULL, person_id uuid NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE(company_id,id), UNIQUE(company_id,candidate_quote_id,base_ledger_item_id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,order_id,candidate_quote_id) REFERENCES pricing.order_quote(company_id,order_id,id),
 FOREIGN KEY(company_id,base_ledger_item_id) REFERENCES finance.ledger_item(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE finance.amendment_adjustment_event (
 company_id uuid NOT NULL, adjustment_id uuid NOT NULL, version integer NOT NULL CHECK(version BETWEEN 2 AND 5),
 action text NOT NULL CHECK(action IN ('SUBMITTED','REVIEWED','APPROVED','REJECTED','POSTED')),
 principal_id uuid NOT NULL, person_id uuid NOT NULL, snapshot jsonb NOT NULL,
 PRIMARY KEY(company_id,adjustment_id,version),
 FOREIGN KEY(company_id,adjustment_id) REFERENCES finance.amendment_adjustment(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE finance.amendment_ledger_adjustment (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, adjustment_id uuid NOT NULL, order_id uuid NOT NULL, base_ledger_item_id uuid NOT NULL,
 candidate_quote_id uuid NOT NULL, candidate_fee_id uuid NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE(company_id,adjustment_id), UNIQUE(company_id,candidate_quote_id,candidate_fee_id),
 FOREIGN KEY(company_id,adjustment_id) REFERENCES finance.amendment_adjustment(company_id,id),
 FOREIGN KEY(company_id,base_ledger_item_id) REFERENCES finance.ledger_item(company_id,id),
 FOREIGN KEY(company_id,order_id,candidate_quote_id) REFERENCES pricing.order_quote(company_id,order_id,id)
);
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['finance.amendment_adjustment','finance.amendment_adjustment_event','finance.amendment_ledger_adjustment'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change()',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
CREATE POLICY customer_scope ON finance.amendment_adjustment AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=amendment_adjustment.company_id AND d.id=amendment_adjustment.order_id));
CREATE POLICY customer_scope ON finance.amendment_adjustment_event AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM finance.amendment_adjustment a WHERE a.company_id=amendment_adjustment_event.company_id AND a.id=amendment_adjustment_event.adjustment_id));
CREATE POLICY customer_scope ON finance.amendment_ledger_adjustment AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM finance.amendment_adjustment a WHERE a.company_id=amendment_ledger_adjustment.company_id AND a.id=amendment_ledger_adjustment.adjustment_id));
CREATE FUNCTION finance.check_amendment_adjustment_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maker uuid; reviewer uuid; prior text;
BEGIN
 SELECT person_id INTO maker FROM finance.amendment_adjustment WHERE company_id=NEW.company_id AND id=NEW.adjustment_id;
 SELECT person_id INTO reviewer FROM finance.amendment_adjustment_event WHERE company_id=NEW.company_id AND adjustment_id=NEW.adjustment_id AND version=3;
 SELECT action INTO prior FROM finance.amendment_adjustment_event WHERE company_id=NEW.company_id AND adjustment_id=NEW.adjustment_id AND version=NEW.version-1;
 IF (NEW.version=2 AND (NEW.action<>'SUBMITTED' OR NEW.person_id<>maker)) OR
    (NEW.version=3 AND (prior IS DISTINCT FROM 'SUBMITTED' OR NEW.action NOT IN ('REVIEWED','REJECTED') OR NEW.person_id=maker)) OR
    (NEW.version=4 AND (prior IS DISTINCT FROM 'REVIEWED' OR NEW.action NOT IN ('APPROVED','REJECTED') OR NEW.person_id IN (maker,reviewer))) OR
    (NEW.version=5 AND (prior IS DISTINCT FROM 'APPROVED' OR NEW.action<>'POSTED')) THEN
  RAISE EXCEPTION 'Invalid independent amendment adjustment sequence' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN
  RAISE EXCEPTION 'Person identity mismatch' USING ERRCODE='23514';
 END IF;
 IF NEW.action='POSTED' AND NOT EXISTS(
   SELECT 1 FROM finance.amendment_adjustment a JOIN pricing.amendment_quote q ON q.company_id=a.company_id AND q.quote_id=a.candidate_quote_id JOIN pricing.quote_confirmation c ON c.company_id=q.company_id AND c.quote_id=q.quote_id
   WHERE a.company_id=NEW.company_id AND a.id=NEW.adjustment_id
 ) THEN RAISE EXCEPTION 'Confirmed candidate quote required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER independent_amendment_adjustment BEFORE INSERT ON finance.amendment_adjustment_event FOR EACH ROW EXECUTE FUNCTION finance.check_amendment_adjustment_event();
