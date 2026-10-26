CREATE TABLE finance.workflow_document (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES org.company(id), kind text NOT NULL CHECK(kind IN ('PAYMENT','REFUND','PAYABLE','ACCOUNT_CHANGE','CHANNEL_SETTLEMENT')),
 maker_principal_id uuid NOT NULL, maker_person_id uuid NOT NULL, subject_id uuid NOT NULL, money_amount_minor bigint NOT NULL CHECK((kind='ACCOUNT_CHANGE' AND money_amount_minor=0) OR money_amount_minor BETWEEN 1 AND 9000000000000), money_currency text NOT NULL CHECK(money_currency IN ('USD','KHR')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,id), FOREIGN KEY(company_id,maker_principal_id) REFERENCES org.principal(company_id,id)
);
CREATE TABLE finance.workflow_document_event (
 company_id uuid NOT NULL, document_id uuid NOT NULL, version bigint NOT NULL CHECK(version>=2),
 action text NOT NULL CHECK(action IN ('REVISED','SUBMITTED','REVIEWED','APPROVED','REJECTED','EXECUTION_RECORDED','RESULT_CONFIRMED','RESULT_FAILED','RESULT_UNKNOWN','POSTED')),
 principal_id uuid NOT NULL, person_id uuid NOT NULL, snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,document_id,version), FOREIGN KEY(company_id,document_id) REFERENCES finance.workflow_document(company_id,id), FOREIGN KEY(company_id,principal_id) REFERENCES org.principal(company_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance.workflow_document','finance.workflow_document_event'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
  EXECUTE format($p$CREATE POLICY company_scope ON %s USING(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK(company_id=NULLIF(current_setting('app.company_id',true),'')::uuid)$p$,t);
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION pricing.reject_history_change()',t);
  EXECUTE format('GRANT SELECT,INSERT ON %s TO routefit_api',t);
 END LOOP;
END $$;
