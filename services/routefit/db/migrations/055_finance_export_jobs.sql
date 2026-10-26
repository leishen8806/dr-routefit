CREATE TABLE finance.export_job (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 principal_id uuid NOT NULL,
 report text NOT NULL CHECK(report IN ('LEDGER','AGING','STATEMENTS','CASH_HANDOVERS','COD','WAREHOUSE')),
 parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'),
 csv_content text NOT NULL,
 state text NOT NULL CHECK(state='ready'),
 expires_at timestamptz NOT NULL,
 version bigint NOT NULL CHECK(version=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE INDEX finance_export_job_owner ON finance.export_job(company_id,principal_id,id);
CREATE TRIGGER finance_export_job_append_only BEFORE UPDATE OR DELETE ON finance.export_job FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
ALTER TABLE finance.export_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.export_job FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.export_job USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY export_owner_scope ON finance.export_job AS RESTRICTIVE USING(principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid) WITH CHECK(principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid);
GRANT SELECT,INSERT ON finance.export_job TO routefit_api;
