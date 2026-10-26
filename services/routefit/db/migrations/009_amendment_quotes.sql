CREATE TABLE pricing.amendment_quote (
 company_id uuid NOT NULL, quote_id uuid NOT NULL PRIMARY KEY, order_id uuid NOT NULL, case_id uuid NOT NULL,
 base_quote_id uuid NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE(company_id,case_id),
 FOREIGN KEY(quote_id) REFERENCES pricing.order_quote(id),
 FOREIGN KEY(company_id,order_id,base_quote_id) REFERENCES pricing.order_quote(company_id,order_id,id),
 FOREIGN KEY(company_id,case_id) REFERENCES casework.service_case(company_id,id)
);
ALTER TABLE pricing.amendment_quote ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.amendment_quote FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON pricing.amendment_quote USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY customer_scope ON pricing.amendment_quote AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=amendment_quote.company_id AND d.id=amendment_quote.order_id));
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON pricing.amendment_quote FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT SELECT,INSERT ON pricing.amendment_quote TO routefit_api;
