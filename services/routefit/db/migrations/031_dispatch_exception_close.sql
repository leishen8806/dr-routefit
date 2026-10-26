ALTER TABLE casework.dispatch_exception_event DROP CONSTRAINT dispatch_exception_event_action_check;
ALTER TABLE casework.dispatch_exception_event ADD CONSTRAINT dispatch_exception_event_action_check CHECK(action IN ('REPORTED','ASSIGNED','RESOLVED','CLOSED'));

CREATE OR REPLACE FUNCTION casework.only_advance_dispatch_exception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Dispatch exceptions may not be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.company_id<>NEW.company_id OR OLD.id<>NEW.id OR OLD.order_id<>NEW.order_id OR OLD.category<>NEW.category OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Dispatch exception identity is immutable and version must advance once' USING ERRCODE='23514';
 END IF;
 IF NOT ((OLD.state='open' AND NEW.state='assigned') OR (OLD.state IN ('assigned','resolving') AND NEW.state IN ('assigned','resolved')) OR (OLD.state='resolved' AND NEW.state='closed')) THEN
  RAISE EXCEPTION 'Dispatch exception state transition is invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
