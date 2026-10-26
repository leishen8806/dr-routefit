CREATE SCHEMA coverage;
CREATE TABLE coverage.area (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES org.company(id), version bigint NOT NULL CHECK(version BETWEEN 1 AND 3),
 state text NOT NULL CHECK(state IN ('draft','active','superseded')), data jsonb NOT NULL,
 created_by uuid NOT NULL, UNIQUE(company_id,id),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE coverage.publication (
 company_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision>0), area_id uuid NOT NULL, area_version bigint NOT NULL,
 snapshot jsonb NOT NULL, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000), principal_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(company_id,revision), UNIQUE(company_id,area_id,area_version),
 FOREIGN KEY(company_id,area_id) REFERENCES coverage.area(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE orders.intake_evidence (
 id uuid PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY, company_id uuid NOT NULL, order_id uuid NOT NULL, source_version bigint NOT NULL,
 snapshot jsonb NOT NULL, principal_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,order_id,id,source_version),
 FOREIGN KEY(company_id,order_id,source_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE INDEX intake_latest ON orders.intake_evidence(company_id,order_id,source_version,seq DESC);
CREATE TABLE orders.intake_return (
 company_id uuid NOT NULL, order_id uuid NOT NULL, version bigint NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000), principal_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(company_id,order_id,version),
 FOREIGN KEY(company_id,order_id,version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
DO $$ DECLARE name text;
BEGIN
 SELECT conname INTO STRICT name FROM pg_constraint WHERE conrelid='orders.draft'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%{order,state}%';
 EXECUTE format('ALTER TABLE orders.draft DROP CONSTRAINT %I',name);
END $$;
ALTER TABLE orders.draft ADD CONSTRAINT draft_intake_state CHECK(snapshot#>>'{order,state}' IN ('draft','validating'));
ALTER TABLE orders.draft ADD COLUMN intake_evidence_id uuid, ADD COLUMN intake_source_version bigint, ADD COLUMN intake_area_revision bigint;
ALTER TABLE orders.draft ADD CONSTRAINT intake_source FOREIGN KEY(company_id,id,intake_evidence_id,intake_source_version) REFERENCES orders.intake_evidence(company_id,order_id,id,source_version);
ALTER TABLE orders.draft ADD CONSTRAINT intake_coverage FOREIGN KEY(company_id,intake_area_revision) REFERENCES coverage.publication(company_id,revision);
ALTER TABLE orders.draft ADD CONSTRAINT intake_snapshot_consistent CHECK(
 (snapshot#>>'{order,state}'='draft' AND intake_evidence_id IS NULL AND intake_source_version IS NULL AND intake_area_revision IS NULL AND NOT snapshot ? 'intake') OR
 (snapshot#>>'{order,state}'='validating' AND intake_evidence_id IS NOT NULL AND intake_source_version IS NOT NULL AND intake_area_revision IS NOT NULL
  AND intake_source_version=version-1
  AND (snapshot#>>'{intake,evidenceId}') IS NOT DISTINCT FROM intake_evidence_id::text
  AND (snapshot#>>'{intake,sourceOrderVersion}') IS NOT DISTINCT FROM intake_source_version::text
  AND (snapshot#>>'{intake,acceptedOrderVersion}') IS NOT DISTINCT FROM version::text
  AND (snapshot#>>'{intake,areaRevision}') IS NOT DISTINCT FROM intake_area_revision::text)
);
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['coverage.area','coverage.publication','orders.intake_evidence','orders.intake_return'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING (company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK (company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
CREATE POLICY intake_customer_scope ON orders.intake_evidence AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=intake_evidence.company_id AND d.id=intake_evidence.order_id))
 WITH CHECK(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=intake_evidence.company_id AND d.id=intake_evidence.order_id));
CREATE TRIGGER intake_append_only BEFORE UPDATE OR DELETE ON orders.intake_evidence FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE POLICY return_customer_scope ON orders.intake_return AS RESTRICTIVE
 USING(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=intake_return.company_id AND d.id=intake_return.order_id))
 WITH CHECK(EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=intake_return.company_id AND d.id=intake_return.order_id));
CREATE TRIGGER return_append_only BEFORE UPDATE OR DELETE ON orders.intake_return FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER coverage_append_only BEFORE UPDATE OR DELETE ON coverage.publication FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT USAGE ON SCHEMA coverage TO routefit_api;
GRANT SELECT,INSERT,UPDATE ON coverage.area TO routefit_api;
GRANT SELECT,INSERT ON coverage.publication,orders.intake_evidence,orders.intake_return TO routefit_api;
GRANT USAGE ON SEQUENCE orders.intake_evidence_seq_seq TO routefit_api;
