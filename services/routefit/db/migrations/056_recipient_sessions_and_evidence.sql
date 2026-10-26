ALTER TABLE evidence.file ALTER COLUMN principal_id DROP NOT NULL;
ALTER TABLE evidence.file ADD COLUMN recipient_session_id uuid NULL;
ALTER TABLE evidence.file ADD CONSTRAINT evidence_file_recipient_session_fk FOREIGN KEY(company_id,recipient_session_id) REFERENCES delivery.recipient_session(company_id,id);
ALTER TABLE evidence.file ADD CONSTRAINT evidence_file_exactly_one_actor CHECK((principal_id IS NULL)<>(recipient_session_id IS NULL));

CREATE OR REPLACE FUNCTION evidence.only_progress_file() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Evidence files may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id IS DISTINCT FROM NEW.company_id OR OLD.principal_id IS DISTINCT FROM NEW.principal_id OR OLD.recipient_session_id IS DISTINCT FROM NEW.recipient_session_id OR OLD.resource_type IS DISTINCT FROM NEW.resource_type OR OLD.resource_id IS DISTINCT FROM NEW.resource_id OR OLD.purpose IS DISTINCT FROM NEW.purpose OR OLD.declared_mime_type IS DISTINCT FROM NEW.declared_mime_type OR OLD.declared_size_bytes IS DISTINCT FROM NEW.declared_size_bytes OR OLD.declared_sha256 IS DISTINCT FROM NEW.declared_sha256 OR OLD.upload_token_hash IS DISTINCT FROM NEW.upload_token_hash OR OLD.expires_at IS DISTINCT FROM NEW.expires_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Evidence file identity may not change' USING ERRCODE='23514';
 END IF;
 IF OLD.state='issued' AND NEW.state='uploaded' AND NEW.object_key IS NOT NULL AND NEW.actual_mime_type=OLD.declared_mime_type AND NEW.actual_size_bytes=OLD.declared_size_bytes AND NEW.actual_sha256=OLD.declared_sha256 THEN RETURN NEW; END IF;
 IF OLD.state='uploaded' AND NEW.state='scanning' AND NEW.object_key=OLD.object_key AND NEW.actual_mime_type=OLD.actual_mime_type AND NEW.actual_size_bytes=OLD.actual_size_bytes AND NEW.actual_sha256=OLD.actual_sha256 THEN RETURN NEW; END IF;
 IF OLD.state='scanning' AND NEW.state IN ('available','rejected') AND NEW.object_key=OLD.object_key AND NEW.actual_mime_type=OLD.actual_mime_type AND NEW.actual_size_bytes=OLD.actual_size_bytes AND NEW.actual_sha256=OLD.actual_sha256 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Invalid evidence file state transition' USING ERRCODE='23514';
END;
$$;

CREATE TABLE delivery.recipient_request_result (
 company_id uuid NOT NULL REFERENCES org.company(id),
 session_id uuid NOT NULL,
 method text NOT NULL,
 path text NOT NULL,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 fingerprint text NOT NULL CHECK(fingerprint~'^[a-f0-9]{64}$'),
 status integer NOT NULL CHECK(status IN (200,201,202)),
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 etag text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,session_id,method,path,idempotency_key),
 FOREIGN KEY(company_id,session_id) REFERENCES delivery.recipient_session(company_id,id)
);
CREATE TRIGGER recipient_request_result_append_only BEFORE UPDATE OR DELETE ON delivery.recipient_request_result FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
ALTER TABLE delivery.recipient_request_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery.recipient_request_result FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON delivery.recipient_request_result USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT SELECT,INSERT ON delivery.recipient_request_result TO routefit_api;

CREATE OR REPLACE FUNCTION delivery.recipient_session_identity(token text) RETURNS TABLE(session_id uuid,company_id uuid,order_id uuid,permissions text[])
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT s.id,s.company_id,s.order_id,s.permissions
 FROM delivery.recipient_session s JOIN org.company c ON c.id=s.company_id AND c.status='ACTIVE'
 WHERE s.token_hash=token AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
 LIMIT 1
$$;
CREATE OR REPLACE FUNCTION delivery.recipient_challenge_identity(challenge_id uuid) RETURNS TABLE(id uuid,company_id uuid,order_id uuid,code_hash text,attempts smallint,expires_at timestamptz,verified_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.id,c.company_id,c.order_id,c.code_hash,c.attempts,c.expires_at,c.verified_at
 FROM delivery.recipient_challenge c JOIN org.company o ON o.id=c.company_id AND o.status='ACTIVE'
 WHERE c.id=challenge_id
 LIMIT 1
$$;
CREATE OR REPLACE FUNCTION delivery.recipient_tracking(token text) RETURNS TABLE(order_label text,state text,promise_window jsonb,eta_at timestamptz,eta_type text,updated_at timestamptz,quality text,contact_entry text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT d.snapshot#>>'{order,orderNo}',
  CASE WHEN d.snapshot#>>'{order,state}'='delivered' THEN 'delivered' WHEN d.snapshot#>>'{order,state}'='return_open' THEN 'returning' WHEN d.snapshot#>>'{order,state}'='cancelled' THEN 'cancelled' WHEN d.snapshot#>>'{order,state}'='closed_exception' THEN 'exception' WHEN d.snapshot#>>'{order,fulfillmentStage}' IN ('picked_up','in_transit') THEN 'in_transit' WHEN d.snapshot#>>'{order,fulfillmentStage}'='pickup_pending' THEN 'pickup_pending' ELSE 'preparing' END,
  NULL::jsonb,NULL::timestamptz,'UNAVAILABLE',d.updated_at,'fresh',NULL::text
 FROM delivery.recipient_session s JOIN org.company c ON c.id=s.company_id AND c.status='ACTIVE'
 JOIN orders.draft d ON (d.company_id,d.id)=(s.company_id,s.order_id)
 WHERE s.token_hash=token AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION delivery.recipient_session_identity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION delivery.recipient_challenge_identity(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delivery.recipient_tracking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delivery.recipient_session_identity(text),delivery.recipient_challenge_identity(uuid),delivery.recipient_tracking(text) TO routefit_api;
