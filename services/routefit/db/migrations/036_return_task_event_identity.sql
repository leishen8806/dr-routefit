CREATE FUNCTION dispatch.return_task_event_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE creator_person uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM org.principal p WHERE p.company_id=NEW.company_id AND p.id=NEW.principal_id AND p.person_id=NEW.person_id AND p.kind='STAFF' AND p.status='ACTIVE') THEN
  RAISE EXCEPTION 'Return task event principal and person mismatch' USING ERRCODE='23514';
 END IF;
 IF NEW.action='AUTHORIZED' THEN
  SELECT p.person_id INTO creator_person FROM dispatch.return_task t JOIN org.principal p ON p.company_id=t.company_id AND p.id=t.created_by WHERE t.company_id=NEW.company_id AND t.id=NEW.return_task_id;
  IF creator_person IS NULL OR creator_person=NEW.person_id THEN RAISE EXCEPTION 'Return authorization requires a different person' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_task_event_identity BEFORE INSERT ON dispatch.return_task_event FOR EACH ROW EXECUTE FUNCTION dispatch.return_task_event_identity();
