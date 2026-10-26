CREATE TABLE finance.task_hold_event (
 company_id uuid NOT NULL REFERENCES org.company(id),
 task_id uuid NOT NULL,
 task_type text NOT NULL CHECK(task_type='COLLECT'),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 until_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 evidence_file_ids uuid[] NOT NULL CHECK(cardinality(evidence_file_ids) BETWEEN 1 AND 20),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,task_id,task_type,version),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((snapshot->>'taskId') IS NOT DISTINCT FROM task_id::text),
 CHECK((snapshot->>'taskType')=task_type),
 CHECK((snapshot->>'version')::bigint=version),
 CHECK((snapshot->>'until')::timestamptz=until_at)
);
CREATE TRIGGER task_hold_event_append_only BEFORE UPDATE OR DELETE ON finance.task_hold_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
ALTER TABLE finance.task_hold_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.task_hold_event FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.task_hold_event USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT SELECT,INSERT ON finance.task_hold_event TO routefit_api;
