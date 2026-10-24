-- =============================================================================
-- Daen GeoCore G1 · geocore_g1 库验证脚本 v0.1
--
-- 用途：在执行 geocore-g1-schema-draft.sql 之后的临时库中运行。
-- 数据：全部为合成数据。
-- 运行：psql -v ON_ERROR_STOP=1 -f verify-geocore-g1.sql
-- =============================================================================

\set ON_ERROR_STOP on

INSERT INTO loc.collection_window (id, company_id, driver_ref, during, source_ref) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001',
   tstzrange('2026-10-24 07:00+07', '2026-10-24 19:00+07'), 'synthetic-shift-1');

INSERT INTO loc.location_observation
  (id, company_id, driver_ref, client_point_id, observed_at, location, accuracy_m, source, window_id) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', 'p-000001', '2026-10-24 10:01:15+07',
   ST_GeogFromText('SRID=4326;POINT(104.9282 11.5564)'), 12.0, 'DRIVER_APP',
   'c1000000-0000-0000-0000-000000000001');

-- G1：观测按 observed_at 落入日分区（2026-10-24 10:01+07 = 03:01 UTC）
DO $$
DECLARE
  part text;
BEGIN
  SELECT tableoid::regclass::text INTO part FROM loc.location_observation
   WHERE id = 'c2000000-0000-0000-0000-000000000001';
  IF part <> 'loc.location_observation_20261024' THEN
    RAISE EXCEPTION 'FAIL G1: observation stored in %', part;
  END IF;
  RAISE NOTICE 'PASS G1: observation is routed to the daily partition %', part;
END;
$$;

-- G2：同一设备点重传不重复入库
DO $$
BEGIN
  BEGIN
    INSERT INTO loc.location_observation
      (id, company_id, driver_ref, client_point_id, observed_at, location, source, window_id) VALUES
      ('c2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
       'a4000000-0000-0000-0000-000000000001', 'p-000001', '2026-10-24 10:01:15+07',
       ST_GeogFromText('SRID=4326;POINT(104.9282 11.5564)'), 'DRIVER_APP',
       'c1000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL G2: a re-sent point was stored twice';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS G2: re-sent points are de-duplicated by client_point_id';
  END;
END;
$$;

-- G3：观测只追加
DO $$
BEGIN
  BEGIN
    UPDATE loc.location_observation SET accuracy_m = 1
     WHERE id = 'c2000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL G3: an observation was modified';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS G3: location observations are append-only';
  END;
END;
$$;

-- G4：供应商地理编码结果必须带留存依据（PRD 5.3）
DO $$
BEGIN
  BEGIN
    INSERT INTO geo.address_record
      (id, company_id, address_text, location, location_source, valid_during, status) VALUES
      ('c3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
       'Synthetic St 1', ST_GeogFromText('SRID=4326;POINT(104.92 11.55)'), 'PROVIDER_GEOCODE',
       tstzrange('2026-10-24 00:00+07', NULL), 'ACTIVE');
    RAISE EXCEPTION 'FAIL G4: provider geocode stored without a retention basis';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS G4: provider geocode results require provider_terms_ref';
  END;
END;
$$;

-- G5：缓存键在企业之间隔离；公共数据用 NULL 企业
DO $$
BEGIN
  INSERT INTO route.travel_time_cache
    (company_id, cache_key, data_category, provider, policy_version, payload, computed_at, expires_at) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'k1', 'PRIVATE', 'synthetic', 'p0', '{}', now(), now() + interval '1 hour'),
    ('b0000000-0000-0000-0000-000000000001', 'k1', 'PRIVATE', 'synthetic', 'p0', '{}', now(), now() + interval '1 hour'),
    (NULL, 'k1', 'PUBLIC', 'synthetic', 'p0', '{}', now(), now() + interval '1 hour');
  BEGIN
    INSERT INTO route.travel_time_cache
      (company_id, cache_key, data_category, provider, policy_version, payload, computed_at, expires_at) VALUES
      (NULL, 'k1', 'PUBLIC', 'synthetic', 'p0', '{}', now(), now() + interval '1 hour');
    RAISE EXCEPTION 'FAIL G5: duplicate public cache key accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS G5: cache keys are unique per company, with one shared public namespace';
  END;
END;
$$;

\echo 'ALL GEOCORE G1 TESTS PASSED'
