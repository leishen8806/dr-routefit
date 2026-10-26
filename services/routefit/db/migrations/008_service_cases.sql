CREATE SCHEMA casework;
CREATE TABLE casework.service_case (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, customer_id uuid NOT NULL, order_id uuid NOT NULL,
 prepared_by uuid NOT NULL, person_id uuid NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,customer_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE casework.service_case_event (
 company_id uuid NOT NULL, case_id uuid NOT NULL, version integer NOT NULL CHECK(version=2),
 action text NOT NULL CHECK(action IN ('ACCEPT','REJECT','REQUEST_CUSTOMER_CONSENT')),
 principal_id uuid NOT NULL, person_id uuid NOT NULL, snapshot jsonb NOT NULL,
 PRIMARY KEY(company_id,case_id,version),
 FOREIGN KEY(company_id,case_id) REFERENCES casework.service_case(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['casework.service_case','casework.service_case_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change()',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
CREATE POLICY customer_scope ON casework.service_case AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=service_case.company_id AND d.id=service_case.order_id));
CREATE POLICY customer_scope ON casework.service_case_event AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM casework.service_case c WHERE c.company_id=service_case_event.company_id AND c.id=service_case_event.case_id));
CREATE FUNCTION casework.check_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maker uuid;
BEGIN
 SELECT person_id INTO maker FROM casework.service_case WHERE company_id=NEW.company_id AND id=NEW.case_id;
 IF maker=NEW.person_id THEN RAISE EXCEPTION 'Independent case decision required' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id) THEN RAISE EXCEPTION 'Person identity mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER independent_case_decision BEFORE INSERT ON casework.service_case_event FOR EACH ROW EXECUTE FUNCTION casework.check_decision();
GRANT USAGE ON SCHEMA casework TO routefit_api;
