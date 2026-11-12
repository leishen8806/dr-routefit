CREATE OR REPLACE FUNCTION org.only_revoke_role_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Role grants may not be deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.principal_id=NULLIF(current_setting('app.principal_id',true),'')::uuid THEN RAISE EXCEPTION 'Role grant may not grant the current principal' USING ERRCODE='23514'; END IF;
  IF NEW.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.kind='STAFF' AND p.status='ACTIVE') THEN RAISE EXCEPTION 'Role grant target or expiry is invalid' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.warehouse_ids) id LEFT JOIN warehouse.site s ON s.company_id=NEW.company_id AND s.id=id.id WHERE s.id IS NULL) OR EXISTS(SELECT 1 FROM unnest(NEW.subject_ids) id LEFT JOIN (SELECT id FROM org.principal WHERE company_id=NEW.company_id UNION SELECT id FROM party.customer WHERE company_id=NEW.company_id) s ON s.id=id.id WHERE s.id IS NULL) OR cardinality(NEW.warehouse_ids)<>(SELECT count(DISTINCT id) FROM unnest(NEW.warehouse_ids) id) OR cardinality(NEW.subject_ids)<>(SELECT count(DISTINCT id) FROM unnest(NEW.subject_ids) id) THEN RAISE EXCEPTION 'Role grant scope is invalid' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.principal_id<>NEW.principal_id OR OLD.role<>NEW.role OR OLD.warehouse_ids<>NEW.warehouse_ids OR OLD.subject_ids<>NEW.subject_ids OR OLD.expires_at<>NEW.expires_at OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR OLD.state<>'active' OR NEW.state<>'revoked' OR NEW.version<>OLD.version+1 OR NEW.revoked_by IS NULL OR NEW.revoked_at IS NULL THEN RAISE EXCEPTION 'Role grant may only be revoked once' USING ERRCODE='23514'; END IF;
 IF NEW.revoked_by IS DISTINCT FROM NULLIF(current_setting('app.principal_id',true),'')::uuid THEN RAISE EXCEPTION 'Role grant revoker mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
