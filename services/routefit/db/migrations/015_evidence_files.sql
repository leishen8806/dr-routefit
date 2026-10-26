CREATE SCHEMA evidence;

ALTER TABLE integration.http_request_result DROP CONSTRAINT http_request_result_status_check;
ALTER TABLE integration.http_request_result ADD CONSTRAINT http_request_result_status_check CHECK(status IN (200,201,202));

CREATE TABLE evidence.file (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 principal_id uuid NOT NULL,
 resource_type text NOT NULL CHECK(resource_type IN ('ORDER','CASE','WAREHOUSE_REQUEST','FINANCE_DOCUMENT','PARTNER')),
 resource_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('PACKAGING','HANDOVER','DELIVERY','PAYMENT','DISPUTE','QUALIFICATION')),
 declared_mime_type text NOT NULL CHECK(declared_mime_type IN ('image/jpeg','image/png','application/pdf')),
 declared_size_bytes integer NOT NULL CHECK(declared_size_bytes BETWEEN 1 AND 10485760),
 declared_sha256 text NOT NULL CHECK(declared_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('issued','uploaded','scanning','available','rejected')),
 object_key text,
 actual_mime_type text,
 actual_size_bytes integer,
 actual_sha256 text,
 upload_token_hash text NOT NULL CHECK(upload_token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9000000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id),
 CHECK((state='issued')=(object_key IS NULL)),
 CHECK((state='issued') OR (actual_mime_type IS NOT NULL AND actual_size_bytes IS NOT NULL AND actual_sha256 IS NOT NULL)),
 CHECK(actual_mime_type IS NULL OR actual_mime_type IN ('image/jpeg','image/png','application/pdf')),
 CHECK(actual_size_bytes IS NULL OR actual_size_bytes BETWEEN 1 AND 10485760),
 CHECK(actual_sha256 IS NULL OR actual_sha256 ~ '^[a-f0-9]{64}$')
);

ALTER TABLE evidence.file ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.file FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_company_access ON evidence.file
 USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)
 WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
CREATE POLICY evidence_upload_read ON evidence.file FOR SELECT
 USING(state='issued' AND upload_token_hash=NULLIF(current_setting('app.evidence_upload_token_hash',true),''));
CREATE POLICY evidence_upload_write ON evidence.file FOR UPDATE
 USING(state='issued' AND upload_token_hash=NULLIF(current_setting('app.evidence_upload_token_hash',true),''))
 WITH CHECK(upload_token_hash=NULLIF(current_setting('app.evidence_upload_token_hash',true),''));
CREATE POLICY evidence_download_read ON evidence.file FOR SELECT
 USING(state='available' AND id::text=NULLIF(current_setting('app.evidence_download_file_id',true),''));

CREATE FUNCTION evidence.only_progress_file() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Evidence files may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.principal_id<>NEW.principal_id OR OLD.resource_type<>NEW.resource_type OR OLD.resource_id<>NEW.resource_id OR OLD.purpose<>NEW.purpose OR OLD.declared_mime_type<>NEW.declared_mime_type OR OLD.declared_size_bytes<>NEW.declared_size_bytes OR OLD.declared_sha256<>NEW.declared_sha256 OR OLD.upload_token_hash<>NEW.upload_token_hash OR OLD.expires_at<>NEW.expires_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Evidence file identity may not change' USING ERRCODE='23514';
 END IF;
 IF OLD.state='issued' AND NEW.state='uploaded' AND NEW.object_key IS NOT NULL AND NEW.actual_mime_type=OLD.declared_mime_type AND NEW.actual_size_bytes=OLD.declared_size_bytes AND NEW.actual_sha256=OLD.declared_sha256 THEN RETURN NEW; END IF;
 IF OLD.state='uploaded' AND NEW.state='scanning' AND NEW.object_key=OLD.object_key AND NEW.actual_mime_type=OLD.actual_mime_type AND NEW.actual_size_bytes=OLD.actual_size_bytes AND NEW.actual_sha256=OLD.actual_sha256 THEN RETURN NEW; END IF;
 IF OLD.state='scanning' AND NEW.state IN ('available','rejected') AND NEW.object_key=OLD.object_key AND NEW.actual_mime_type=OLD.actual_mime_type AND NEW.actual_size_bytes=OLD.actual_size_bytes AND NEW.actual_sha256=OLD.actual_sha256 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Invalid evidence file state transition' USING ERRCODE='23514';
END $$;
CREATE TRIGGER evidence_file_progress_only BEFORE UPDATE OR DELETE ON evidence.file FOR EACH ROW EXECUTE FUNCTION evidence.only_progress_file();

GRANT USAGE ON SCHEMA evidence TO routefit_api;
GRANT SELECT,INSERT,UPDATE ON evidence.file TO routefit_api;
