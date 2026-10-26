CREATE SCHEMA party;
CREATE SCHEMA orders;

CREATE TABLE party.customer (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES org.company(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 status text NOT NULL CHECK(status IN ('ACTIVE','DISABLED')),
 UNIQUE(company_id,id)
);
CREATE TABLE party.customer_access (
 company_id uuid NOT NULL, customer_id uuid NOT NULL, principal_id uuid NOT NULL,
 PRIMARY KEY(company_id,customer_id,principal_id),
 FOREIGN KEY(company_id,customer_id) REFERENCES party.customer(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE orders.draft (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, customer_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,customer_id) REFERENCES party.customer(company_id,id),
 CHECK(snapshot#>>'{order,state}'='draft'),
 CHECK((snapshot#>>'{order,version}')::bigint=version),
 CHECK((snapshot#>>'{order,id}')::uuid=id),
 CHECK((snapshot#>>'{order,customerId}')::uuid=customer_id),
 CHECK((snapshot#>>'{draft,customerId}')::uuid=customer_id)
);
CREATE TABLE orders.draft_revision (
 company_id uuid NOT NULL, order_id uuid NOT NULL, version bigint NOT NULL,
 snapshot jsonb NOT NULL, principal_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,order_id,version),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
CREATE INDEX order_draft_list ON orders.draft(company_id,created_at DESC,id DESC);
CREATE TRIGGER order_revision_append_only BEFORE UPDATE OR DELETE ON orders.draft_revision FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['party.customer','party.customer_access','orders.draft','orders.draft_revision'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING (company_id = NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK (company_id = NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
CREATE POLICY customer_scope ON orders.draft AS RESTRICTIVE
 USING (EXISTS(SELECT 1 FROM party.customer_access a JOIN party.customer c ON (c.company_id,c.id)=(a.company_id,a.customer_id)
  WHERE a.company_id=draft.company_id AND a.customer_id=draft.customer_id
  AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND c.status='ACTIVE'))
 WITH CHECK (EXISTS(SELECT 1 FROM party.customer_access a JOIN party.customer c ON (c.company_id,c.id)=(a.company_id,a.customer_id)
  WHERE a.company_id=draft.company_id AND a.customer_id=draft.customer_id
  AND a.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid AND c.status='ACTIVE'));
CREATE POLICY revision_scope ON orders.draft_revision AS RESTRICTIVE
 USING (EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=draft_revision.company_id AND d.id=draft_revision.order_id))
 WITH CHECK (EXISTS(SELECT 1 FROM orders.draft d WHERE d.company_id=draft_revision.company_id AND d.id=draft_revision.order_id));
ALTER TABLE integration.http_request_result DROP CONSTRAINT http_request_result_method_check;
ALTER TABLE integration.http_request_result ADD CONSTRAINT http_request_result_method_check CHECK(method IN ('POST','PATCH'));
GRANT USAGE ON SCHEMA party,orders TO routefit_api;
GRANT SELECT ON party.customer,party.customer_access TO routefit_api;
GRANT SELECT,INSERT,UPDATE ON orders.draft TO routefit_api;
GRANT SELECT,INSERT ON orders.draft_revision TO routefit_api;
