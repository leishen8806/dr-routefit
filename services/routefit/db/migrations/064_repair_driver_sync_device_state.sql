DO $$
DECLARE
 company record;
 company_before bigint;
 company_repaired bigint;
 company_after bigint;
 before_count bigint := 0;
 repaired_count bigint := 0;
 after_count bigint := 0;
BEGIN
 -- The migration role owns org.company but FORCE RLS otherwise hides the company list.
 ALTER TABLE org.company NO FORCE ROW LEVEL SECURITY;
 FOR company IN SELECT id FROM org.company ORDER BY id LOOP
  PERFORM set_config('app.company_id',company.id::text,true);

  WITH event_max AS (
   SELECT company_id,device_id,min(driver_id::text)::uuid AS driver_id,max(sequence) AS last_sequence
   FROM mobile.sync_event WHERE company_id=company.id GROUP BY company_id,device_id
  )
  SELECT count(*) INTO company_before FROM event_max e
  LEFT JOIN mobile.sync_device_state s USING(company_id,device_id)
  WHERE s.device_id IS NULL OR s.last_sequence<e.last_sequence;

  INSERT INTO mobile.sync_device_state(company_id,device_id,driver_id,last_sequence)
  SELECT company_id,device_id,driver_id,last_sequence FROM (
   SELECT company_id,device_id,min(driver_id::text)::uuid AS driver_id,max(sequence) AS last_sequence
   FROM mobile.sync_event WHERE company_id=company.id GROUP BY company_id,device_id
  ) event_max
  ON CONFLICT(company_id,device_id) DO UPDATE
  SET last_sequence=EXCLUDED.last_sequence,updated_at=clock_timestamp()
  WHERE mobile.sync_device_state.last_sequence<EXCLUDED.last_sequence;
  GET DIAGNOSTICS company_repaired=ROW_COUNT;

  WITH event_max AS (
   SELECT company_id,device_id,max(sequence) AS last_sequence
   FROM mobile.sync_event WHERE company_id=company.id GROUP BY company_id,device_id
  )
  SELECT count(*) INTO company_after FROM event_max e
  LEFT JOIN mobile.sync_device_state s USING(company_id,device_id)
  WHERE s.device_id IS NULL OR s.last_sequence<e.last_sequence;

  before_count:=before_count+company_before;
  repaired_count:=repaired_count+company_repaired;
  after_count:=after_count+company_after;
 END LOOP;
 PERFORM set_config('app.company_id','',true);
 ALTER TABLE org.company FORCE ROW LEVEL SECURITY;
 RAISE NOTICE 'RF_PM_064_SYNC_STATE_BEFORE=% REPAIRED=% AFTER=%',before_count,repaired_count,after_count;
END $$;
