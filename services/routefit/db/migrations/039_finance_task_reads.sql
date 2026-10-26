CREATE TABLE finance.task_read (
 company_id uuid NOT NULL REFERENCES org.company(id),
 task_id uuid NOT NULL,
 principal_id uuid NOT NULL,
 read_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,task_id,principal_id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TRIGGER task_read_append_only BEFORE UPDATE OR DELETE ON finance.task_read FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
ALTER TABLE finance.task_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.task_read FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.task_read USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT SELECT,INSERT ON finance.task_read TO routefit_api;
