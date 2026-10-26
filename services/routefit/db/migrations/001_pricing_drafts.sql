CREATE SCHEMA org;
CREATE SCHEMA pricing;
CREATE SCHEMA integration;

CREATE TABLE org.company (
 id uuid PRIMARY KEY, name text NOT NULL,
 status text NOT NULL CHECK(status IN ('ACTIVE','SUSPENDED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE org.principal (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES org.company(id),
 kind text NOT NULL CHECK(kind IN ('STAFF','DRIVER','PARTNER_DRIVER','SERVICE')),
 display_name text NOT NULL, idp_subject text NOT NULL,
 status text NOT NULL CHECK(status IN ('ACTIVE','DISABLED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id), UNIQUE(company_id,idp_subject)
);
CREATE TABLE pricing.tariff (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES org.company(id),
 owner text NOT NULL CHECK(owner IN ('DR','VET','ZTO','CE','JT')),
 currency text NOT NULL CHECK(currency IN ('USD','KHR')),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 scope text NOT NULL CHECK(length(btrim(scope)) BETWEEN 1 AND 300),
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state='DRAFT'),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 created_by uuid NOT NULL, updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id), UNIQUE(company_id,id,owner),
 FOREIGN KEY(company_id,created_by) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,updated_by) REFERENCES org.principal(company_id,id)
);
CREATE TABLE pricing.fee_rule (
 company_id uuid NOT NULL, tariff_id uuid NOT NULL, owner text NOT NULL,
 code text NOT NULL CHECK(code IN ('base','weight','distance','flash','pickup','door','remote','handling','stairs','waiting','redelivery','return','cancel','cod','insurance','storage','inbound','outbound','packing')),
 enabled boolean NOT NULL, method text NOT NULL CHECK(method IN ('fixed','unit','percent')),
 amount bigint NOT NULL CHECK(amount BETWEEN 0 AND 9000000000000),
 unit text, included_milli bigint NOT NULL CHECK(included_milli BETWEEN 0 AND 9000000000000),
 step_milli bigint NOT NULL CHECK(step_milli BETWEEN 1 AND 9000000000000),
 share boolean NOT NULL,
 scope text NOT NULL CHECK(length(btrim(scope)) BETWEEN 1 AND 300),
 evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 1 AND 300),
 PRIMARY KEY(company_id,tariff_id,code),
 FOREIGN KEY(company_id,tariff_id,owner) REFERENCES pricing.tariff(company_id,id,owner),
 CHECK(NOT share OR (owner='DR' AND code NOT IN ('cod','insurance','storage','inbound','outbound','packing'))),
 CHECK(method!='percent' OR (code IN ('cod','insurance') AND amount<=10000)),
 CHECK((method!='unit' AND unit IS NULL AND included_milli=0 AND step_milli=1000) OR
 (method='unit' AND unit IS NOT NULL AND (
  (code IN ('base','weight') AND unit='kg') OR (code IN ('distance','remote') AND unit='km') OR
  (code IN ('pickup','door') AND unit IN ('piece','stop')) OR
  (code IN ('handling','inbound','outbound','packing') AND unit='piece') OR
  (code='stairs' AND unit='floor') OR (code='waiting' AND unit='minute') OR
  (code='redelivery' AND unit='stop') OR (code='return' AND unit IN ('km','kg')) OR
  (code='storage' AND unit IN ('day','cbmDay')))))
);
CREATE TABLE pricing.tariff_revision (
 company_id uuid NOT NULL, tariff_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 principal_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,tariff_id,version),
 FOREIGN KEY(company_id,tariff_id) REFERENCES pricing.tariff(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE pricing.trial (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, tariff_id uuid NOT NULL,
 tariff_version bigint NOT NULL, principal_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,tariff_id,tariff_version) REFERENCES pricing.tariff_revision(company_id,tariff_id,version),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE integration.http_request_result (
 company_id uuid NOT NULL, principal_id uuid NOT NULL,
 method text NOT NULL CHECK(method='POST'), path text NOT NULL,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 fingerprint text NOT NULL CHECK(length(fingerprint)=64),
 status integer NOT NULL CHECK(status IN (200,201)), response jsonb NOT NULL,
 etag text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,principal_id,method,path,idempotency_key),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE INDEX tariff_company_list ON pricing.tariff(company_id,id);

CREATE FUNCTION pricing.reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only record' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER revision_append_only BEFORE UPDATE OR DELETE ON pricing.tariff_revision FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER trial_append_only BEFORE UPDATE OR DELETE ON pricing.trial FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER request_append_only BEFORE UPDATE OR DELETE ON integration.http_request_result FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['org.company','org.principal','pricing.tariff','pricing.fee_rule','pricing.tariff_revision','pricing.trial','integration.http_request_result'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING (%I = NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK (%I = NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t,CASE WHEN t='org.company' THEN 'id' ELSE 'company_id' END,CASE WHEN t='org.company' THEN 'id' ELSE 'company_id' END);
 END LOOP;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='routefit_api') THEN CREATE ROLE routefit_api NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA org,pricing,integration TO routefit_api;
GRANT SELECT ON org.company,org.principal TO routefit_api;
GRANT SELECT,INSERT,UPDATE ON pricing.tariff,pricing.fee_rule TO routefit_api;
GRANT SELECT,INSERT ON pricing.tariff_revision,pricing.trial,integration.http_request_result TO routefit_api;
