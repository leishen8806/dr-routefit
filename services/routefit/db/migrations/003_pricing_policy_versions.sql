CREATE TABLE pricing.policy_version (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, tariff_id uuid NOT NULL, tariff_version bigint NOT NULL,
 prepared_by uuid NOT NULL, contributors uuid[] NOT NULL, snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id), UNIQUE(company_id,id,prepared_by),
 CHECK(prepared_by=ANY(contributors)),
 FOREIGN KEY(company_id,tariff_id,tariff_version) REFERENCES pricing.tariff_revision(company_id,tariff_id,version),
 FOREIGN KEY(company_id,prepared_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE pricing.policy_review (
 company_id uuid NOT NULL, policy_id uuid NOT NULL, prepared_by uuid NOT NULL, reviewed_by uuid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,policy_id), UNIQUE(company_id,policy_id,prepared_by,reviewed_by), CHECK(prepared_by<>reviewed_by),
 FOREIGN KEY(company_id,policy_id,prepared_by) REFERENCES pricing.policy_version(company_id,id,prepared_by),
 FOREIGN KEY(company_id,reviewed_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE pricing.policy_publication (
 company_id uuid NOT NULL, policy_id uuid NOT NULL, prepared_by uuid NOT NULL, reviewed_by uuid NOT NULL, approved_by uuid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,policy_id), CHECK(approved_by<>prepared_by AND approved_by<>reviewed_by),
 FOREIGN KEY(company_id,policy_id,prepared_by,reviewed_by) REFERENCES pricing.policy_review(company_id,policy_id,prepared_by,reviewed_by),
 FOREIGN KEY(company_id,approved_by) REFERENCES org.principal(company_id,id)
);
CREATE FUNCTION pricing.check_policy_independence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 IF TG_TABLE_NAME='policy_review' THEN actor := NEW.reviewed_by;
 ELSE actor := NEW.approved_by;
 END IF;
 IF EXISTS(SELECT 1 FROM pricing.policy_version p WHERE p.company_id=NEW.company_id AND p.id=NEW.policy_id AND actor=ANY(p.contributors)) THEN
  RAISE EXCEPTION 'Policy contributor cannot review or approve own pricing' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER policy_review_independent BEFORE INSERT ON pricing.policy_review FOR EACH ROW EXECUTE FUNCTION pricing.check_policy_independence();
CREATE TRIGGER policy_publication_independent BEFORE INSERT ON pricing.policy_publication FOR EACH ROW EXECUTE FUNCTION pricing.check_policy_independence();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['policy_version','policy_review','policy_publication'] LOOP
  EXECUTE format('ALTER TABLE pricing.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE pricing.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON pricing.%I USING (company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK (company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON pricing.%I FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change()',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT ON pricing.policy_version,pricing.policy_review,pricing.policy_publication TO routefit_api;
