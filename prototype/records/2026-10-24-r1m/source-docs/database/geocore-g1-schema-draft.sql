-- =============================================================================
-- Daen GeoCore G1 · geocore_g1 库建表草案 v0.1（2026-10-24）
--
-- 状态：设计草案，尚未在 PostgreSQL 中执行验证；不是已批准的迁移文件。
-- 边界：G1 不保存订单、承诺或运单状态；RouteFit 只经 GeoPort 访问本库的数据。
--       不复制既有 E:/Daen_GeoCore 的身份治理表；不建立跨库外键。
-- 说明：见 ../database-architecture.md 第 7.10 节。
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA geo;
CREATE SCHEMA loc;
CREATE SCHEMA route;

CREATE FUNCTION geo.reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %.%: % is not allowed', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END;
$$;

-- -----------------------------------------------------------------------------
-- geo：企业作用域的地址库与入口（PRD 5、5.4）
-- -----------------------------------------------------------------------------
CREATE TABLE geo.address_record (
  id                  uuid PRIMARY KEY,
  company_id          uuid NOT NULL,                  -- 由 RouteFit 传入的企业作用域，不跨企业命中
  address_version     integer NOT NULL DEFAULT 1,
  address_text        text NOT NULL,                  -- 保留原文，不自动翻译
  landmark            text,
  location            geography(Point, 4326),
  location_source     text NOT NULL CHECK (location_source IN (
                        'OWN_SURVEY', 'DRIVER_CONFIRMED', 'PROVIDER_GEOCODE', 'MANUAL', 'UNKNOWN')),
  accuracy_m          numeric(8,1),
  provider_terms_ref  text,                           -- 第三方内容的留存依据；无依据不得长期保存
  valid_during        tstzrange NOT NULL,
  vehicle_access      text[] NOT NULL DEFAULT '{}',
  floor_and_handling  jsonb NOT NULL DEFAULT '{}'::jsonb,
  geocore_place_ref   text,                           -- 既有 Daen GeoCore 的引用，可空
  status              text NOT NULL CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'RETIRED')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  CHECK (location_source <> 'PROVIDER_GEOCODE' OR provider_terms_ref IS NOT NULL)
);
CREATE INDEX address_record_location_gix ON geo.address_record USING gist (location);

CREATE TABLE geo.access_point (
  id              uuid PRIMARY KEY,
  company_id      uuid NOT NULL,
  address_id      uuid NOT NULL,
  label           text NOT NULL,
  location        geography(Point, 4326) NOT NULL,
  photo_ref       text,                               -- 对象存储引用
  confirmed_by    text NOT NULL,                      -- RouteFit 主体引用
  confirmed_at    timestamptz NOT NULL,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, address_id) REFERENCES geo.address_record (company_id, id)
);

-- 司机回写或人工纠错先成为候选；超出批准偏移或精度不足须人工确认（PRD 5）
CREATE TABLE geo.address_correction_candidate (
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL,
  address_id         uuid NOT NULL,
  proposed_location  geography(Point, 4326) NOT NULL,
  accuracy_m         numeric(8,1),
  offset_m           numeric(10,1),
  source             text NOT NULL CHECK (source IN ('DRIVER_ARRIVAL', 'DISPATCHER', 'CUSTOMER')),
  status             text NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  reviewed_by        text,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, address_id) REFERENCES geo.address_record (company_id, id),
  CHECK (status = 'PENDING' OR reviewed_by IS NOT NULL)
);

-- -----------------------------------------------------------------------------
-- loc：授权采集窗口与位置观测（PRD 8、5.2）
-- -----------------------------------------------------------------------------

-- RouteFit 下达的授权采集窗口；窗口外的点拒收
CREATE TABLE loc.collection_window (
  id           uuid PRIMARY KEY,
  company_id   uuid NOT NULL,
  driver_ref   uuid NOT NULL,
  vehicle_ref  uuid,
  during       tstzrange NOT NULL CHECK (NOT isempty(during)),
  source_ref   text NOT NULL,                         -- RouteFit 班次或任务引用
  revoked_at   timestamptz,
  UNIQUE (company_id, id)
);
CREATE INDEX collection_window_driver_ix ON loc.collection_window USING gist (driver_ref, during);

-- 位置观测：按日分区，到期按分区整体删除（PRD D11）
CREATE TABLE loc.location_observation (
  id               uuid NOT NULL,
  company_id       uuid NOT NULL,
  driver_ref       uuid NOT NULL,
  vehicle_ref      uuid,
  client_point_id  text NOT NULL,                     -- 设备生成，重传不重复入库
  observed_at      timestamptz NOT NULL,              -- 设备观测时间；补传点保留原值
  received_at      timestamptz NOT NULL DEFAULT now(),
  location         geography(Point, 4326) NOT NULL,
  accuracy_m       numeric(8,1),
  source           text NOT NULL CHECK (source IN ('DRIVER_APP', 'TRACKER_DEVICE', 'MANUAL')),
  device_state     jsonb NOT NULL DEFAULT '{}'::jsonb, -- 权限、电量、前后台等
  window_id        uuid NOT NULL,
  PRIMARY KEY (id, observed_at),
  UNIQUE (driver_ref, client_point_id, observed_at)
) PARTITION BY RANGE (observed_at);

CREATE TABLE loc.location_observation_20261024 PARTITION OF loc.location_observation
  FOR VALUES FROM ('2026-10-24 00:00:00+00') TO ('2026-10-25 00:00:00+00');
CREATE TABLE loc.location_observation_default PARTITION OF loc.location_observation DEFAULT;
CREATE INDEX location_observation_driver_ix
  ON loc.location_observation (company_id, driver_ref, observed_at DESC);

-- 最新位置：小表，按观测时间只前进；过期判断由 RouteFit 负责
CREATE TABLE loc.latest_location (
  company_id   uuid NOT NULL,
  driver_ref   uuid NOT NULL,
  vehicle_ref  uuid,
  observed_at  timestamptz NOT NULL,
  received_at  timestamptz NOT NULL,
  location     geography(Point, 4326) NOT NULL,
  accuracy_m   numeric(8,1),
  source       text NOT NULL,
  PRIMARY KEY (company_id, driver_ref)
);

-- -----------------------------------------------------------------------------
-- route：供应商调用记录与（默认关闭的）缓存（PRD 5.3）
-- -----------------------------------------------------------------------------
CREATE TABLE route.provider_call_log (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL,
  provider         text NOT NULL,
  operation        text NOT NULL CHECK (operation IN (
                     'resolveAddress', 'reverseGeocode', 'getTravelTimeMatrix', 'getRoute')),
  request_digest   text NOT NULL,                     -- 摘要，不存个人信息原文
  adapter_version  text NOT NULL,
  provider_version text,                              -- 供应商不提供时为 NULL，不伪造
  outcome          text NOT NULL CHECK (outcome IN (
                     'OK', 'UNAVAILABLE', 'TIMEOUT', 'OUT_OF_COVERAGE', 'LOW_CONFIDENCE', 'FORBIDDEN', 'UNSUPPORTED')),
  latency_ms       integer,
  called_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_call_log_time_ix ON route.provider_call_log (called_at);

-- 缓存默认关闭：只有 policy 允许的数据类别写入；私有数据不跨企业命中
CREATE TABLE route.travel_time_cache (
  company_id      uuid,                               -- NULL 仅限经授权的公共数据
  cache_key       text NOT NULL,
  data_category   text NOT NULL,
  provider        text NOT NULL,
  policy_version  text NOT NULL,
  payload         jsonb NOT NULL,
  computed_at     timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,
  CHECK (expires_at > computed_at)
);
CREATE UNIQUE INDEX travel_time_cache_key
  ON route.travel_time_cache (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), cache_key);

-- 只追加
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON loc.location_observation
  FOR EACH ROW EXECUTE FUNCTION geo.reject_change();
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON route.provider_call_log
  FOR EACH ROW EXECUTE FUNCTION geo.reject_change();
-- 注：到期数据由所有者账号按分区 DETACH／DROP 删除，不走逐行 DELETE。
