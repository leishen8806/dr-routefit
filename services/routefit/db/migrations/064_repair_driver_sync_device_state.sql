DO $$
DECLARE
 before_count bigint;
 repaired_count bigint;
 after_count bigint;
BEGIN
 WITH event_max AS (
  SELECT company_id,device_id,min(driver_id::text)::uuid AS driver_id,max(sequence) AS last_sequence
  FROM mobile.sync_event GROUP BY company_id,device_id
 )
 SELECT count(*) INTO before_count FROM event_max e
 LEFT JOIN mobile.sync_device_state s USING(company_id,device_id)
 WHERE s.device_id IS NULL OR s.last_sequence<e.last_sequence;

 INSERT INTO mobile.sync_device_state(company_id,device_id,driver_id,last_sequence)
 SELECT company_id,device_id,driver_id,last_sequence FROM (
  SELECT company_id,device_id,min(driver_id::text)::uuid AS driver_id,max(sequence) AS last_sequence
  FROM mobile.sync_event GROUP BY company_id,device_id
 ) event_max
 ON CONFLICT(company_id,device_id) DO UPDATE
 SET last_sequence=EXCLUDED.last_sequence,updated_at=clock_timestamp()
 WHERE mobile.sync_device_state.last_sequence<EXCLUDED.last_sequence;
 GET DIAGNOSTICS repaired_count=ROW_COUNT;

 WITH event_max AS (
  SELECT company_id,device_id,max(sequence) AS last_sequence
  FROM mobile.sync_event GROUP BY company_id,device_id
 )
 SELECT count(*) INTO after_count FROM event_max e
 LEFT JOIN mobile.sync_device_state s USING(company_id,device_id)
 WHERE s.device_id IS NULL OR s.last_sequence<e.last_sequence;

 RAISE NOTICE 'RF_PM_064_SYNC_STATE_BEFORE=% REPAIRED=% AFTER=%',before_count,repaired_count,after_count;
END $$;
