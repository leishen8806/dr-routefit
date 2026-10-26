CREATE SCHEMA mobile;

CREATE TABLE mobile.device (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 driver_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('ACTIVE','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE mobile.shift (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES org.company(id),
 device_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('ACTIVE','ENDED')),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,device_id) REFERENCES mobile.device(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES org.principal(company_id,id),
 CHECK(starts_at<ends_at)
);
CREATE TABLE mobile.location_event (
 company_id uuid NOT NULL,
 device_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 client_point_id uuid NOT NULL,
 observed_at timestamptz NOT NULL,
 lat numeric(8,5) NOT NULL CHECK(lat BETWEEN -90 AND 90),
 lng numeric(8,5) NOT NULL CHECK(lng BETWEEN -180 AND 180),
 accuracy_m numeric(10,2) NOT NULL CHECK(accuracy_m BETWEEN 0 AND 100000),
 permission text NOT NULL CHECK(permission IN ('ALWAYS','WHILE_USING','DENIED')),
 foreground boolean NOT NULL,
 battery_ratio numeric(5,4) NOT NULL CHECK(battery_ratio BETWEEN 0 AND 1),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,device_id,client_point_id),
 FOREIGN KEY(company_id,device_id) REFERENCES mobile.device(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES org.principal(company_id,id)
);
CREATE INDEX location_event_latest ON mobile.location_event(company_id,driver_id,observed_at DESC);
CREATE TRIGGER location_event_append_only BEFORE UPDATE OR DELETE ON mobile.location_event FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change();

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['mobile.device','mobile.shift','mobile.location_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($policy$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$policy$,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %s TO routefit_api',t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA mobile TO routefit_api;
