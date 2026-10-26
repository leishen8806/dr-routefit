CREATE TABLE finance.allocation_reversal (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, order_id uuid NOT NULL, allocation_id uuid NOT NULL,
 prepared_by uuid NOT NULL, person_id uuid NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE(company_id,id,allocation_id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,allocation_id) REFERENCES finance.prepayment_allocation(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE finance.reversal_event (
 company_id uuid NOT NULL, reversal_id uuid NOT NULL, allocation_id uuid NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 2 AND 4),
 action text NOT NULL CHECK(action IN ('REVIEWED','APPROVED','POSTED','REJECTED')),
 principal_id uuid NOT NULL, person_id uuid NOT NULL, snapshot jsonb NOT NULL,
 PRIMARY KEY(company_id,reversal_id,version),
 FOREIGN KEY(company_id,reversal_id,allocation_id) REFERENCES finance.allocation_reversal(company_id,id,allocation_id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE UNIQUE INDEX one_allocation_reversal ON finance.reversal_event(company_id,allocation_id) WHERE action='POSTED';
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['finance.allocation_reversal','finance.reversal_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change()',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
CREATE POLICY customer_scope ON finance.allocation_reversal AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=allocation_reversal.company_id AND d.id=allocation_reversal.order_id));
CREATE POLICY customer_scope ON finance.reversal_event AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM finance.allocation_reversal r WHERE r.company_id=reversal_event.company_id AND r.id=reversal_event.reversal_id));
CREATE FUNCTION finance.check_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maker uuid; reviewer uuid; prior text;
BEGIN
 SELECT person_id INTO maker FROM finance.allocation_reversal WHERE company_id=NEW.company_id AND id=NEW.reversal_id;
 SELECT person_id INTO reviewer FROM finance.reversal_event WHERE company_id=NEW.company_id AND reversal_id=NEW.reversal_id AND version=2;
 SELECT action INTO prior FROM finance.reversal_event WHERE company_id=NEW.company_id AND reversal_id=NEW.reversal_id AND version=NEW.version-1;
 IF (NEW.version=2 AND NEW.action NOT IN ('REVIEWED','REJECTED')) OR
    (NEW.version=3 AND (prior IS DISTINCT FROM 'REVIEWED' OR NEW.action NOT IN ('APPROVED','REJECTED'))) OR
    (NEW.version=4 AND (prior IS DISTINCT FROM 'APPROVED' OR NEW.action<>'POSTED')) OR
    (NEW.version IN (2,3) AND maker=NEW.person_id) OR (NEW.version=3 AND reviewer=NEW.person_id) THEN
  RAISE EXCEPTION 'Invalid independent reversal sequence' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN
  RAISE EXCEPTION 'Person identity mismatch' USING ERRCODE='23514';
 END IF;
 IF NEW.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.allocation_event e WHERE e.company_id=NEW.company_id AND e.allocation_id=NEW.allocation_id AND e.action='POSTED') THEN
  RAISE EXCEPTION 'Source allocation must be posted' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER independent_reversal BEFORE INSERT ON finance.reversal_event FOR EACH ROW EXECUTE FUNCTION finance.check_reversal();
