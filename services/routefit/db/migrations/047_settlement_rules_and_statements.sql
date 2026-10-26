CREATE TABLE finance.settlement_rule (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 subject_id uuid NOT NULL,
 direction text NOT NULL CHECK(direction IN ('RECEIVABLE','PAYABLE')),
 purpose text NOT NULL CHECK(purpose IN ('DELIVERY','INSURANCE','COD','CARRIER','DRIVER_INCOME','WAREHOUSE')),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 state text NOT NULL CHECK(state IN ('draft','active','superseded')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 rule jsonb NOT NULL CHECK(jsonb_typeof(rule)='object'),
 maker_principal_id uuid NOT NULL,
 maker_person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,maker_principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state),
 CHECK(snapshot->'rule'=rule)
);
CREATE UNIQUE INDEX settlement_rule_one_active_scope ON finance.settlement_rule(company_id,subject_id,direction,purpose,currency) WHERE state='active';
CREATE TABLE finance.settlement_rule_event (
 company_id uuid NOT NULL,
 rule_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('CREATED','ACTIVATED','SUPERSEDED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,rule_id,version),
 FOREIGN KEY(company_id,rule_id) REFERENCES finance.settlement_rule(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE TABLE finance.statement (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 subject_id uuid NOT NULL,
 direction text NOT NULL CHECK(direction IN ('RECEIVABLE','PAYABLE')),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 rule_id uuid NOT NULL,
 period_start date NOT NULL,
 period_end_exclusive date NOT NULL CHECK(period_end_exclusive>period_start),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 900000000),
 internal_state text NOT NULL CHECK(internal_state IN ('draft','reviewed','approved','issued')),
 customer_state text NOT NULL DEFAULT 'unseen' CHECK(customer_state IN ('unseen','acknowledged','disputed')),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 maker_principal_id uuid NOT NULL,
 maker_person_id uuid NOT NULL,
 due_date date NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,subject_id,direction,currency,rule_id,period_start,period_end_exclusive,revision),
 FOREIGN KEY(company_id,rule_id) REFERENCES finance.settlement_rule(company_id,id),
 FOREIGN KEY(company_id,maker_principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'internalState') IS NOT DISTINCT FROM internal_state),
 CHECK((snapshot->>'customerState') IS NOT DISTINCT FROM customer_state)
);
CREATE TABLE finance.statement_line (
 company_id uuid NOT NULL,
 statement_id uuid NOT NULL,
 ledger_item_id uuid NOT NULL,
 ledger_item_version bigint NOT NULL CHECK(ledger_item_version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 PRIMARY KEY(company_id,statement_id,ledger_item_id),
 UNIQUE(company_id,ledger_item_id),
 FOREIGN KEY(company_id,statement_id) REFERENCES finance.statement(company_id,id)
);
CREATE TABLE finance.statement_event (
 company_id uuid NOT NULL,
 statement_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 action text NOT NULL CHECK(action IN ('CREATED','REVIEWED','APPROVED','ISSUED','ACKNOWLEDGED')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,statement_id,version),
 FOREIGN KEY(company_id,statement_id) REFERENCES finance.statement(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE FUNCTION finance.check_settlement_rule_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'settlement rule history is immutable'; END IF;
 IF NOT (NEW.company_id=OLD.company_id AND NEW.id=OLD.id AND NEW.subject_id=OLD.subject_id AND NEW.direction=OLD.direction AND NEW.purpose=OLD.purpose AND NEW.currency=OLD.currency AND NEW.rule=OLD.rule AND NEW.maker_principal_id=OLD.maker_principal_id AND NEW.maker_person_id=OLD.maker_person_id AND NEW.version=OLD.version+1 AND ((OLD.state='draft' AND NEW.state='active') OR (OLD.state='active' AND NEW.state='superseded'))) THEN RAISE EXCEPTION 'settlement rule history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER settlement_rule_transition BEFORE UPDATE OR DELETE ON finance.settlement_rule FOR EACH ROW EXECUTE FUNCTION finance.check_settlement_rule_update();
CREATE FUNCTION finance.check_statement_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'statement history is immutable'; END IF;
 IF NOT (NEW.company_id=OLD.company_id AND NEW.id=OLD.id AND NEW.subject_id=OLD.subject_id AND NEW.direction=OLD.direction AND NEW.currency=OLD.currency AND NEW.rule_id=OLD.rule_id AND NEW.period_start=OLD.period_start AND NEW.period_end_exclusive=OLD.period_end_exclusive AND NEW.revision=OLD.revision AND NEW.maker_principal_id=OLD.maker_principal_id AND NEW.maker_person_id=OLD.maker_person_id AND NEW.due_date=OLD.due_date AND NEW.version=OLD.version+1 AND ((OLD.internal_state='draft' AND NEW.internal_state='reviewed' AND NEW.customer_state=OLD.customer_state) OR (OLD.internal_state='reviewed' AND NEW.internal_state='approved' AND NEW.customer_state=OLD.customer_state) OR (OLD.internal_state='approved' AND NEW.internal_state='issued' AND NEW.customer_state=OLD.customer_state) OR (OLD.internal_state=NEW.internal_state AND OLD.customer_state='unseen' AND NEW.customer_state='acknowledged'))) THEN RAISE EXCEPTION 'statement history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER statement_transition BEFORE UPDATE OR DELETE ON finance.statement FOR EACH ROW EXECUTE FUNCTION finance.check_statement_update();
CREATE TRIGGER settlement_rule_event_append_only BEFORE UPDATE OR DELETE ON finance.settlement_rule_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER statement_line_append_only BEFORE UPDATE OR DELETE ON finance.statement_line FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER statement_event_append_only BEFORE UPDATE OR DELETE ON finance.statement_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance.settlement_rule','finance.settlement_rule_event','finance.statement','finance.statement_line','finance.statement_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
