BEGIN;

CREATE TABLE finance.payout_approval (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 source_type text NOT NULL CHECK(source_type IN ('DRIVER_WITHDRAWAL','MERCHANT_SETTLEMENT','PAYROLL_RUN')),
 source_id uuid NOT NULL,
 money_amount_minor bigint NOT NULL CHECK(money_amount_minor BETWEEN 1 AND 9000000000000),
 money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 state text NOT NULL CHECK(state IN ('submitted','approved','rejected','paid')),
 prepared_by_principal_id uuid NOT NULL,
 prepared_by_person_id uuid NOT NULL,
 approved_by_principal_id uuid,
 approved_by_person_id uuid,
 confirmed_by_principal_id uuid,
 confirmed_by_person_id uuid,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 version bigint NOT NULL CHECK(version>=1),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,source_type,source_id),
 UNIQUE(company_id,prepared_by_principal_id,idempotency_key),
 FOREIGN KEY(company_id,prepared_by_principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,approved_by_principal_id) REFERENCES org.principal(company_id,id),
 FOREIGN KEY(company_id,confirmed_by_principal_id) REFERENCES org.principal(company_id,id),
 CHECK(approved_by_person_id IS NULL OR prepared_by_person_id<>approved_by_person_id),
 CHECK(approved_by_principal_id IS NULL OR prepared_by_principal_id<>approved_by_principal_id),
 CHECK(approved_by_person_id IS NULL OR confirmed_by_person_id IS NULL OR approved_by_person_id<>confirmed_by_person_id),
 CHECK((state='submitted' AND approved_by_person_id IS NULL AND confirmed_by_person_id IS NULL) OR (state='approved' AND approved_by_person_id IS NOT NULL AND confirmed_by_person_id IS NULL) OR (state='rejected' AND confirmed_by_person_id IS NULL) OR (state='paid' AND approved_by_person_id IS NOT NULL AND confirmed_by_person_id IS NOT NULL))
);

COMMENT ON COLUMN finance.payout_approval.confirmed_by_person_id IS 'Two-person payout control: confirmation may be by the preparer, but never by the approver.';

CREATE TABLE finance.payout_approval_event (
 company_id uuid NOT NULL,
 payout_approval_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version>=2),
 action text NOT NULL CHECK(action IN ('APPROVED','REJECTED','CONFIRMED_PAID')),
 principal_id uuid NOT NULL,
 person_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,payout_approval_id,version),
 FOREIGN KEY(company_id,payout_approval_id) REFERENCES finance.payout_approval(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE FUNCTION finance.require_principal_person_binding(p_company_id uuid, p_principal_id uuid, p_person_id uuid, p_context text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM org.principal
  WHERE company_id=p_company_id AND id=p_principal_id AND person_id=p_person_id
 ) THEN
  RAISE EXCEPTION '% principal and person must match', p_context USING ERRCODE='23514';
 END IF;
END;
$$;

CREATE FUNCTION finance.enforce_payout_approval_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'submitted' OR NEW.approved_by_person_id IS NOT NULL OR NEW.approved_by_principal_id IS NOT NULL OR NEW.confirmed_by_person_id IS NOT NULL OR NEW.confirmed_by_principal_id IS NOT NULL THEN
   RAISE EXCEPTION 'Payout approvals must start submitted without approval or payment confirmation' USING ERRCODE='23514';
  END IF;
  PERFORM finance.require_principal_person_binding(NEW.company_id,NEW.prepared_by_principal_id,NEW.prepared_by_person_id,'Payout preparer');
  RETURN NEW;
 END IF;
 IF NEW.company_id<>OLD.company_id OR NEW.id<>OLD.id OR NEW.source_type<>OLD.source_type OR NEW.source_id<>OLD.source_id OR NEW.money_amount_minor<>OLD.money_amount_minor OR NEW.money_currency<>OLD.money_currency OR NEW.prepared_by_person_id<>OLD.prepared_by_person_id OR NEW.prepared_by_principal_id<>OLD.prepared_by_principal_id OR (OLD.approved_by_person_id IS NOT NULL AND NEW.approved_by_person_id<>OLD.approved_by_person_id) OR (OLD.approved_by_principal_id IS NOT NULL AND NEW.approved_by_principal_id<>OLD.approved_by_principal_id) OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.snapshot<>OLD.snapshot OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Payout approval history is immutable' USING ERRCODE='42501';
 END IF;
 IF OLD.state='submitted' AND NEW.state='approved' AND (NEW.approved_by_person_id IS NULL OR NEW.approved_by_principal_id IS NULL) THEN
  RAISE EXCEPTION 'Approved payout requires approver person and principal' USING ERRCODE='23514';
 END IF;
 IF OLD.state='submitted' AND NEW.state='approved' AND NEW.approved_by_person_id IS NOT NULL AND NEW.approved_by_principal_id IS NOT NULL AND NEW.approved_by_person_id<>OLD.prepared_by_person_id AND NEW.approved_by_principal_id<>OLD.prepared_by_principal_id AND NEW.confirmed_by_person_id IS NULL THEN
  PERFORM finance.require_principal_person_binding(NEW.company_id,NEW.approved_by_principal_id,NEW.approved_by_person_id,'Payout approver');
  RETURN NEW;
 END IF;
 IF OLD.state='submitted' AND NEW.state='rejected' AND NEW.approved_by_person_id IS NOT NULL AND NEW.confirmed_by_person_id IS NULL THEN
  PERFORM finance.require_principal_person_binding(NEW.company_id,NEW.approved_by_principal_id,NEW.approved_by_person_id,'Payout rejection approver');
  RETURN NEW;
 END IF;
 IF OLD.state='approved' AND NEW.state='paid' AND NEW.confirmed_by_person_id IS NOT NULL AND NEW.confirmed_by_principal_id IS NOT NULL AND NEW.confirmed_by_person_id<>OLD.approved_by_person_id THEN
  PERFORM finance.require_principal_person_binding(NEW.company_id,NEW.confirmed_by_principal_id,NEW.confirmed_by_person_id,'Payout confirmer');
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Invalid payout approval transition' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER payout_approval_transition BEFORE INSERT OR UPDATE OR DELETE ON finance.payout_approval FOR EACH ROW EXECUTE FUNCTION finance.enforce_payout_approval_transition();
CREATE FUNCTION finance.append_payout_approval_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_principal_id uuid; event_person_id uuid;
BEGIN
 event_principal_id:=CASE WHEN NEW.state='paid' THEN NEW.confirmed_by_principal_id ELSE NEW.approved_by_principal_id END;
 event_person_id:=CASE WHEN NEW.state='paid' THEN NEW.confirmed_by_person_id ELSE NEW.approved_by_person_id END;
 PERFORM finance.require_principal_person_binding(NEW.company_id,event_principal_id,event_person_id,'Payout approval event');
 INSERT INTO finance.payout_approval_event(company_id,payout_approval_id,version,action,principal_id,person_id,snapshot)
 VALUES(
  NEW.company_id,
  NEW.id,
  NEW.version,
  CASE NEW.state WHEN 'approved' THEN 'APPROVED' WHEN 'rejected' THEN 'REJECTED' ELSE 'CONFIRMED_PAID' END,
  event_principal_id,
  event_person_id,
  NEW.snapshot
 );
 RETURN NEW;
END;
$$;
CREATE TRIGGER payout_approval_event_after_transition AFTER UPDATE ON finance.payout_approval FOR EACH ROW EXECUTE FUNCTION finance.append_payout_approval_event();
CREATE TRIGGER payout_approval_event_append_only BEFORE UPDATE OR DELETE ON finance.payout_approval_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

ALTER TABLE finance.payout_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.payout_approval FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.payout_approval USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE finance.payout_approval_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.payout_approval_event FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON finance.payout_approval_event USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON finance.payout_approval TO routefit_api;
GRANT SELECT,INSERT ON finance.payout_approval_event TO routefit_api;

COMMIT;
