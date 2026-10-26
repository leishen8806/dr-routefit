CREATE TABLE finance.ledger_item (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, order_id uuid NOT NULL, customer_id uuid NOT NULL,
 quote_id uuid NOT NULL, fee_id uuid NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE(company_id,quote_id,fee_id),
 FOREIGN KEY(company_id,customer_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,order_id,quote_id) REFERENCES pricing.order_quote(company_id,order_id,id)
);
ALTER TABLE finance.ledger_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.ledger_item FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.ledger_item USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY customer_scope ON finance.ledger_item AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=ledger_item.company_id AND d.id=ledger_item.order_id));
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON finance.ledger_item FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT SELECT,INSERT ON finance.ledger_item TO routefit_api;
