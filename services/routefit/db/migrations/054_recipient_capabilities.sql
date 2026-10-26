CREATE TABLE delivery.recipient_challenge (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 code_hash text NOT NULL CHECK(code_hash~'^[a-f0-9]{64}$'),
 attempts smallint NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 verified_at timestamptz NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id)
);
CREATE INDEX recipient_challenge_active ON delivery.recipient_challenge(company_id,order_id,expires_at) WHERE verified_at IS NULL;
CREATE FUNCTION delivery.only_verify_recipient_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'recipient challenge may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.code_hash<>NEW.code_hash OR OLD.expires_at<>NEW.expires_at OR OLD.created_at<>NEW.created_at OR NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1 OR (OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at) THEN RAISE EXCEPTION 'recipient challenge is immutable except bounded verification attempts' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER recipient_challenge_only_verify BEFORE UPDATE OR DELETE ON delivery.recipient_challenge FOR EACH ROW EXECUTE FUNCTION delivery.only_verify_recipient_challenge();

CREATE TABLE delivery.recipient_session (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 token_hash text NOT NULL CHECK(token_hash~'^[a-f0-9]{64}$'),
 permissions text[] NOT NULL CHECK(permissions <@ ARRAY['DELIVERY_READ','ARRANGEMENT_REQUEST','DELIVERY_ACK','CASE_CREATE']),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(token_hash),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id)
);
CREATE INDEX recipient_session_active ON delivery.recipient_session(company_id,order_id,expires_at) WHERE revoked_at IS NULL;
CREATE TRIGGER recipient_session_append_only BEFORE UPDATE OR DELETE ON delivery.recipient_session FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

CREATE TABLE casework.recipient_service_case (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 order_version bigint NOT NULL CHECK(order_version BETWEEN 1 AND 9000000000000),
 session_id uuid NOT NULL,
 type text NOT NULL CHECK(type IN ('ADDRESS_CHANGE','TIME_CHANGE','MISSING','DAMAGED','WRONG_GOODS','REFUSAL','RETURN')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id,order_version) REFERENCES orders.draft_revision(company_id,order_id,version),
 FOREIGN KEY(company_id,session_id) REFERENCES delivery.recipient_session(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'orderVersion')::bigint=order_version),
 CHECK((snapshot->>'type') IS NOT DISTINCT FROM type)
);
CREATE TRIGGER recipient_service_case_append_only BEFORE UPDATE OR DELETE ON casework.recipient_service_case FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

CREATE TABLE delivery.recipient_acknowledgement (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 order_id uuid NOT NULL,
 delivery_record_id uuid NOT NULL,
 session_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('recorded','needs_review','matched')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,order_id) REFERENCES orders.draft(company_id,id),
 FOREIGN KEY(company_id,delivery_record_id) REFERENCES delivery.record(company_id,id),
 FOREIGN KEY(company_id,session_id) REFERENCES delivery.recipient_session(company_id,id),
 CHECK((snapshot->>'id') IS NOT DISTINCT FROM id::text),
 CHECK((snapshot->>'orderId') IS NOT DISTINCT FROM order_id::text),
 CHECK((snapshot->>'deliveryRecordId') IS NOT DISTINCT FROM delivery_record_id::text),
 CHECK((snapshot->>'state') IS NOT DISTINCT FROM state)
);
CREATE TRIGGER recipient_acknowledgement_append_only BEFORE UPDATE OR DELETE ON delivery.recipient_acknowledgement FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

CREATE FUNCTION sharing.recipient_tracking_target(token text) RETURNS TABLE(company_id uuid,order_id uuid,recipient_phone text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT l.company_id,l.order_id,d.snapshot#>>'{delivery,phone}'
 FROM sharing.tracking_link l JOIN orders.draft d ON (d.company_id,d.id)=(l.company_id,l.order_id)
 WHERE l.token_hash=token AND l.revoked_at IS NULL AND l.expires_at>clock_timestamp()
 LIMIT 1
$$;
CREATE FUNCTION delivery.recipient_session_scope(token text) RETURNS TABLE(company_id uuid,order_id uuid,permissions text[])
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT s.company_id,s.order_id,s.permissions FROM delivery.recipient_session s
 WHERE s.token_hash=token AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() LIMIT 1
$$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['delivery.recipient_challenge','delivery.recipient_session','casework.recipient_service_case','delivery.recipient_acknowledgement'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid) WITH CHECK(company_id=NULLIF(current_setting(''app.company_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION sharing.recipient_tracking_target(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION delivery.recipient_session_scope(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sharing.recipient_tracking_target(text) TO routefit_api;
GRANT EXECUTE ON FUNCTION delivery.recipient_session_scope(text) TO routefit_api;
