BEGIN;

CREATE SCHEMA payroll;

CREATE TABLE payroll.plan_version (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 plan_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version>=1),
 state text NOT NULL CHECK(state IN ('draft','approved','retired')),
 example_label text NOT NULL DEFAULT '示例',
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 deductions_enabled boolean NOT NULL DEFAULT false,
 effective_from timestamptz NOT NULL,
 prepared_by_principal_id uuid NOT NULL,
 approved_by_principal_id uuid,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,plan_id,version),
 FOREIGN KEY(company_id,prepared_by_principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,approved_by_principal_id) REFERENCES org.principal(company_id,id),
 CHECK((state='draft' AND approved_by_principal_id IS NULL) OR (state IN ('approved','retired') AND approved_by_principal_id IS NOT NULL)),
 CHECK(NOT deductions_enabled OR (state='approved' AND approved_by_principal_id IS NOT NULL)),
 CHECK(approved_by_principal_id IS NULL OR prepared_by_principal_id<>approved_by_principal_id)
);

CREATE TABLE payroll.run (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 plan_version_id uuid NOT NULL,
 period_start date NOT NULL,
 period_end date NOT NULL,
 state text NOT NULL CHECK(state IN ('draft','approved','payout_pending','closed')),
 version bigint NOT NULL CHECK(version>=1),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 prepared_by_principal_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,prepared_by_principal_id,idempotency_key),
 UNIQUE(company_id,plan_version_id,period_start,period_end),
 FOREIGN KEY(company_id,plan_version_id) REFERENCES payroll.plan_version(company_id,id),
 FOREIGN KEY(company_id,prepared_by_principal_id) REFERENCES org.principal(company_id,id),
 CHECK(period_end>=period_start)
);

CREATE TABLE payroll.run_line (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 run_id uuid NOT NULL,
 driver_principal_id uuid NOT NULL,
 plan_version_id uuid NOT NULL,
 money_gross_minor bigint NOT NULL CHECK(money_gross_minor>=0),
 money_deduction_minor bigint NOT NULL DEFAULT 0 CHECK(money_deduction_minor>=0),
 money_net_minor bigint NOT NULL CHECK(money_net_minor>=0),
 money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,run_id,driver_principal_id),
 FOREIGN KEY(company_id,run_id) REFERENCES payroll.run(company_id,id),
 FOREIGN KEY(company_id,driver_principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,plan_version_id) REFERENCES payroll.plan_version(company_id,id),
 CHECK(money_deduction_minor<=money_gross_minor),
 CHECK(money_net_minor=money_gross_minor-money_deduction_minor)
);

CREATE TRIGGER payroll_plan_version_append_only BEFORE UPDATE OR DELETE ON payroll.plan_version FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER payroll_run_line_append_only BEFORE UPDATE OR DELETE ON payroll.run_line FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE FUNCTION payroll.require_approved_plan_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plan_state text;
BEGIN
 SELECT state INTO plan_state FROM payroll.plan_version WHERE company_id=NEW.company_id AND id=NEW.plan_version_id;
 IF plan_state IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Payroll runs require an approved plan version' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER payroll_run_requires_approved_plan BEFORE INSERT ON payroll.run FOR EACH ROW EXECUTE FUNCTION payroll.require_approved_plan_version();

ALTER TABLE payroll.plan_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll.plan_version FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON payroll.plan_version USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE payroll.run ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll.run FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON payroll.run USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE payroll.run_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll.run_line FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON payroll.run_line USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);

GRANT USAGE ON SCHEMA payroll TO routefit_api;
GRANT SELECT,INSERT ON payroll.plan_version,payroll.run,payroll.run_line TO routefit_api;

COMMIT;
