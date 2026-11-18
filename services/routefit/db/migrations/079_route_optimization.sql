BEGIN;

CREATE TABLE dispatch.optimization_run (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 state text NOT NULL CHECK(state IN ('generated','adopted','failed')),
 version bigint NOT NULL CHECK(version>=1),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 requested_by_principal_id uuid NOT NULL,
 input_snapshot jsonb NOT NULL CHECK(jsonb_typeof(input_snapshot)='object'),
 result_snapshot jsonb NOT NULL CHECK(jsonb_typeof(result_snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,requested_by_principal_id,idempotency_key),
 FOREIGN KEY(company_id,requested_by_principal_id) REFERENCES org.principal(company_id,id)
);

CREATE TABLE dispatch.optimization_route (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 optimization_run_id uuid NOT NULL,
 vehicle_id uuid NOT NULL,
 slot text NOT NULL CHECK(length(slot) BETWEEN 1 AND 64),
 sequence_no bigint NOT NULL CHECK(sequence_no>=1),
 order_ids jsonb NOT NULL CHECK(jsonb_typeof(order_ids)='array'),
 used_volume bigint NOT NULL CHECK(used_volume>=0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,optimization_run_id,vehicle_id,slot),
 FOREIGN KEY(company_id,optimization_run_id) REFERENCES dispatch.optimization_run(company_id,id),
 FOREIGN KEY(company_id,vehicle_id) REFERENCES fleet.vehicle(company_id,id)
);

CREATE TABLE dispatch.optimization_run_event (
 company_id uuid NOT NULL,
 optimization_run_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version>=2),
 action text NOT NULL CHECK(action IN ('ADOPTED','FAILED')),
 principal_id uuid NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,optimization_run_id,version),
 FOREIGN KEY(company_id,optimization_run_id) REFERENCES dispatch.optimization_run(company_id,id),
 FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);

CREATE FUNCTION dispatch.enforce_optimization_run_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Optimization runs are immutable' USING ERRCODE='42501'; END IF;
 IF NEW.company_id<>OLD.company_id OR NEW.id<>OLD.id OR NEW.requested_by_principal_id<>OLD.requested_by_principal_id OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.input_snapshot<>OLD.input_snapshot OR NEW.result_snapshot<>OLD.result_snapshot OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Optimization run history is immutable' USING ERRCODE='42501';
 END IF;
 IF OLD.state='generated' AND NEW.state IN ('adopted','failed') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Invalid optimization run transition' USING ERRCODE='23514';
END;
$$;

CREATE FUNCTION dispatch.append_optimization_run_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO dispatch.optimization_run_event(company_id,optimization_run_id,version,action,principal_id,snapshot)
 VALUES(NEW.company_id,NEW.id,NEW.version,CASE NEW.state WHEN 'adopted' THEN 'ADOPTED' ELSE 'FAILED' END,NEW.requested_by_principal_id,NEW.result_snapshot);
 RETURN NEW;
END;
$$;

CREATE FUNCTION dispatch.enforce_optimization_route_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF jsonb_typeof(NEW.order_ids)<>'array' THEN RAISE EXCEPTION 'Optimization route orders must be an array' USING ERRCODE='23514'; END IF;
 IF EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(NEW.order_ids) AS route_order(id)
  WHERE CASE WHEN route_order.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   THEN NOT EXISTS(SELECT 1 FROM orders.draft AS order_record WHERE order_record.company_id=NEW.company_id AND order_record.id=route_order.id::uuid)
   ELSE true END
 ) THEN RAISE EXCEPTION 'Optimization route orders must belong to the company' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM dispatch.optimization_run
  WHERE company_id=NEW.company_id AND id=NEW.optimization_run_id
    AND NEW.order_ids <@ COALESCE(input_snapshot->'orderIds','[]'::jsonb)
 ) THEN RAISE EXCEPTION 'Optimization route orders must be part of the run input' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

CREATE TRIGGER optimization_run_transition BEFORE UPDATE OR DELETE ON dispatch.optimization_run FOR EACH ROW EXECUTE FUNCTION dispatch.enforce_optimization_run_transition();
CREATE TRIGGER optimization_run_event_after_transition AFTER UPDATE ON dispatch.optimization_run FOR EACH ROW EXECUTE FUNCTION dispatch.append_optimization_run_event();
CREATE TRIGGER optimization_route_ownership BEFORE INSERT ON dispatch.optimization_route FOR EACH ROW EXECUTE FUNCTION dispatch.enforce_optimization_route_ownership();
CREATE TRIGGER optimization_route_append_only BEFORE UPDATE OR DELETE ON dispatch.optimization_route FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();
CREATE TRIGGER optimization_run_event_append_only BEFORE UPDATE OR DELETE ON dispatch.optimization_run_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

ALTER TABLE dispatch.optimization_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch.optimization_run FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON dispatch.optimization_run USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE dispatch.optimization_route ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch.optimization_route FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON dispatch.optimization_route USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);
ALTER TABLE dispatch.optimization_run_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch.optimization_run_event FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON dispatch.optimization_run_event USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid);

GRANT SELECT,INSERT,UPDATE ON dispatch.optimization_run TO routefit_api;
GRANT SELECT,INSERT ON dispatch.optimization_route,dispatch.optimization_run_event TO routefit_api;

COMMIT;
