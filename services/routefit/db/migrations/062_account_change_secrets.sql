CREATE TABLE finance.workflow_account_change_secret (
 company_id uuid NOT NULL,
 document_id uuid NOT NULL,
 document_version bigint NOT NULL CHECK(document_version>=1),
 key_id text NOT NULL CHECK(length(btrim(key_id)) BETWEEN 1 AND 64),
 iv bytea NOT NULL CHECK(octet_length(iv)=12),
 ciphertext bytea NOT NULL CHECK(octet_length(ciphertext)>0),
 tag bytea NOT NULL CHECK(octet_length(tag)=16),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,document_id,document_version),
 FOREIGN KEY(company_id,document_id) REFERENCES finance.workflow_document(company_id,id)
);
ALTER TABLE finance.workflow_account_change_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.workflow_account_change_secret FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.workflow_account_change_secret USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON finance.workflow_account_change_secret FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
GRANT SELECT,INSERT ON finance.workflow_account_change_secret TO routefit_api;
