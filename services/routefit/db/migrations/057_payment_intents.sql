CREATE TABLE finance.payment_intent (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES org.company(id), order_id uuid NOT NULL,
 customer_id uuid NOT NULL, quote_id uuid NOT NULL, trade_no text NOT NULL CHECK(trade_no ~ '^[A-Za-z0-9-]{1,32}$'),
 money_amount_minor bigint NOT NULL CHECK(money_amount_minor BETWEEN 1 AND 9000000000000), money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'), created_by uuid NOT NULL REFERENCES org.principal(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), UNIQUE(company_id,trade_no), FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,order_id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id)
);
CREATE TABLE finance.payment_intent_item (
 company_id uuid NOT NULL, intent_id uuid NOT NULL, ledger_item_id uuid NOT NULL, ledger_item_version bigint NOT NULL CHECK(ledger_item_version=1),
 PRIMARY KEY(company_id,intent_id,ledger_item_id), FOREIGN KEY(company_id,intent_id) REFERENCES finance.payment_intent(company_id,id),
 FOREIGN KEY(company_id,ledger_item_id) REFERENCES finance.ledger_item(company_id,id)
);
CREATE TABLE finance.payment_intent_event (
 company_id uuid NOT NULL, intent_id uuid NOT NULL, version bigint NOT NULL CHECK(version>=1), state text NOT NULL CHECK(state IN ('creating','waiting','unknown','succeeded','closed','failed','needs_review')),
 principal_id uuid NULL, snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,intent_id,version), FOREIGN KEY(company_id,intent_id) REFERENCES finance.payment_intent(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance.payment_intent','finance.payment_intent_item','finance.payment_intent_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($p$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$p$,t);
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change()',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
