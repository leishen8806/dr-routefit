ALTER TABLE dispatch.assignment_event DROP CONSTRAINT assignment_event_action_check;
ALTER TABLE dispatch.assignment_event ADD CONSTRAINT assignment_event_action_check CHECK(action IN ('OFFERED','ACCEPTED','REJECTED','REVOKED','SUPERSEDED','EXPIRED'));
