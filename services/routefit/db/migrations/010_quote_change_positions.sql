CREATE TABLE pricing.quote_change_position (
 company_id uuid NOT NULL, quote_id uuid NOT NULL PRIMARY KEY, order_id uuid NOT NULL, case_id uuid NOT NULL,
 snapshot jsonb NOT NULL,
 FOREIGN KEY(quote_id) REFERENCES pricing.amendment_quote(quote_id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,case_id) REFERENCES casework.service_case(company_id,id)
);
ALTER TABLE pricing.quote_change_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.quote_change_position FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON pricing.quote_change_position USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY customer_scope ON pricing.quote_change_position AS RESTRICTIVE USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=quote_change_position.company_id AND d.id=quote_change_position.order_id));
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON pricing.quote_change_position FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT SELECT,INSERT ON pricing.quote_change_position TO routefit_api;
