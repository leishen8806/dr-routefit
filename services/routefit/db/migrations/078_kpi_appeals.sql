BEGIN;

CREATE SCHEMA kpi;

CREATE TABLE kpi.definition_version (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 definition_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version>=1),
 state text NOT NULL CHECK(state IN ('draft','approved','retired')),
 example_label text NOT NULL DEFAULT '示例',
 effective_from timestamptz NOT NULL,
 prepared_by_principal_id uuid NOT NULL,
 approved_by_principal_id uuid,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,definition_id,version),
 FOREIGN KEY(company_id,prepared_by_principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,approved_by_principal_id) REFERENCES org.principal(company_id,id),
 CHECK((state='draft' AND approved_by_principal_id IS NULL) OR (state IN ('approved','retired') AND approved_by_principal_id IS NOT NULL))
);

CREATE TABLE kpi.assessment (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 definition_version_id uuid NOT NULL,
 subject_principal_id uuid NOT NULL,
 subject_person_id uuid NOT NULL,
 period_start date NOT NULL,
 period_end date NOT NULL,
 version bigint NOT NULL CHECK(version>=1),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,definition_version_id,subject_principal_id,period_start,period_end),
 FOREIGN KEY(company_id,definition_version_id) REFERENCES kpi.definition_version(company_id,id),
 FOREIGN KEY(company_id,subject_principal_id) REFERENCES org.principal(company_id,id),
 CHECK(period_end>=period_start)
);

CREATE TABLE kpi.reward_penalty (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 assessment_id uuid NOT NULL,
 type text NOT NULL CHECK(type IN ('reward','penalty')),
 money_amount_minor bigint NOT NULL CHECK(money_amount_minor>0),
 money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 author_principal_id uuid NOT NULL,
 author_person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,assessment_id) REFERENCES kpi.assessment(company_id,id),
 FOREIGN KEY(company_id,author_principal_id) REFERENCES org.principal(company_id,id)
);

CREATE TABLE kpi.appeal (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 assessment_id uuid NOT NULL,
 reward_penalty_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('submitted','accepted','rejected')),
 version bigint NOT NULL CHECK(version>=1),
 submitted_by_person_id uuid NOT NULL,
 decision_person_id uuid,
 reward_penalty_author_person_id uuid NOT NULL,
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
 decision_reason text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 decided_at timestamptz,
 UNIQUE(company_id,id),
 UNIQUE(company_id,reward_penalty_id),
 FOREIGN KEY(company_id,assessment_id) REFERENCES kpi.assessment(company_id,id),
 FOREIGN KEY(company_id,reward_penalty_id) REFERENCES kpi.reward_penalty(company_id,id),
 CHECK(decision_person_id IS NULL OR decision_person_id<>reward_penalty_author_person_id),
 CHECK((state='submitted' AND decision_person_id IS NULL AND decision_reason IS NULL AND decided_at IS NULL) OR (state IN ('accepted','rejected') AND decision_person_id IS NOT NULL AND decision_reason IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE TRIGGER kpi_definition_version_append_only BEFORE UPDATE OR DELETE ON kpi.definition_version FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER kpi_reward_penalty_append_only BEFORE UPDATE OR DELETE ON kpi.reward_penalty FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

CREATE FUNCTION kpi.enforce_appeal_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subject_person uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'KPI appeals are immutable' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT subject_person_id INTO subject_person FROM kpi.assessment WHERE company_id=NEW.company_id AND id=NEW.assessment_id;
  IF subject_person IS NULL OR NEW.submitted_by_person_id<>subject_person THEN RAISE EXCEPTION 'Only the assessed driver may appeal' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.company_id<>OLD.company_id OR NEW.id<>OLD.id OR NEW.assessment_id<>OLD.assessment_id OR NEW.reward_penalty_id<>OLD.reward_penalty_id OR NEW.submitted_by_person_id<>OLD.submitted_by_person_id OR NEW.reward_penalty_author_person_id<>OLD.reward_penalty_author_person_id OR NEW.reason<>OLD.reason OR NEW.version<>OLD.version+1 OR OLD.state<>'submitted' OR NEW.state NOT IN ('accepted','rejected') THEN
  RAISE EXCEPTION 'Invalid KPI appeal transition' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER kpi_appeal_transition BEFORE INSERT OR UPDATE OR DELETE ON kpi.appeal FOR EACH ROW EXECUTE FUNCTION kpi.enforce_appeal_transition();

ALTER TABLE kpi.definition_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi.definition_version FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON kpi.definition_version USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE kpi.assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi.assessment FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON kpi.assessment USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE kpi.reward_penalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi.reward_penalty FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON kpi.reward_penalty USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE kpi.appeal ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi.appeal FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON kpi.appeal USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);

GRANT SELECT,INSERT ON kpi.definition_version,kpi.assessment,kpi.reward_penalty,kpi.appeal TO routefit_api;
GRANT UPDATE ON kpi.appeal TO routefit_api;

COMMIT;
