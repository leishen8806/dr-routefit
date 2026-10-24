-- =============================================================================
-- DR RouteFit · routefit 库建表草案 v0.1（2026-10-24）
--
-- 状态：设计草案，尚未在 PostgreSQL 中执行验证；不是已批准的迁移文件。
-- 目标：PostgreSQL 16+、PostGIS 3.4+（选型待 ADR，PRD D24）。
-- 说明：见 ../database-architecture.md。字段最终形态以 R0-B 机器契约为准。
-- 约定：
--   * 业务表都有 company_id，并建 UNIQUE (company_id, id)，跨表引用用复合外键。
--   * 主键 uuid 由应用生成（UUIDv7）。
--   * 状态用 text + CHECK，不用 ENUM 类型。
--   * 金额 bigint 最小单位 + currency；禁止浮点。
--   * 只追加的表由 audit.reject_change() 触发器保护。
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA org;
CREATE SCHEMA party;
CREATE SCHEMA fleet;
CREATE SCHEMA cargo;
CREATE SCHEMA orders;
CREATE SCHEMA dispatch;
CREATE SCHEMA carrier;
CREATE SCHEMA custody;
CREATE SCHEMA finance;
CREATE SCHEMA ops;
CREATE SCHEMA reco;
CREATE SCHEMA integration;
CREATE SCHEMA audit;

-- 只追加表的保护触发器
CREATE FUNCTION audit.reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %.%: % is not allowed', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END;
$$;

-- -----------------------------------------------------------------------------
-- org：企业、主体、角色
-- -----------------------------------------------------------------------------
CREATE TABLE org.company (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  status      text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org.principal (
  id            uuid PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES org.company (id),
  kind          text NOT NULL CHECK (kind IN ('STAFF', 'DRIVER', 'PARTNER_DRIVER', 'SERVICE')),
  display_name  text NOT NULL,
  idp_subject   text NOT NULL,
  status        text NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, idp_subject)
);

CREATE TABLE org.role_grant (
  id            uuid PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES org.company (id),
  principal_id  uuid NOT NULL,
  role          text NOT NULL CHECK (role IN (
                  'DISPATCHER', 'DISPATCH_LEAD', 'WAREHOUSE', 'LOAD_REVIEWER', 'FINANCE_REVIEWER',
                  'OPERATIONS_OWNER', 'INTEGRATION_OWNER', 'TECH_ON_CALL', 'ADMIN', 'DRIVER', 'PARTNER_DRIVER')),
  scope         jsonb NOT NULL DEFAULT '{}'::jsonb,
  granted_by    uuid NOT NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, principal_id) REFERENCES org.principal (company_id, id)
);

-- -----------------------------------------------------------------------------
-- party：客户与合作方
-- -----------------------------------------------------------------------------
CREATE TABLE party.customer (
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES org.company (id),
  name        text NOT NULL,
  status      text NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  version     integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id)
);

-- 联系方式单独成表：限权读取，报表视图不含本表
CREATE TABLE party.customer_contact (
  id                  uuid PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES org.company (id),
  customer_id         uuid NOT NULL,
  name                text NOT NULL,
  phone               text,
  preferred_language  text CHECK (preferred_language IN ('km', 'en', 'zh-Hans')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, customer_id) REFERENCES party.customer (company_id, id)
);

CREATE TABLE party.carrier_partner (
  id            uuid PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES org.company (id),
  partner_type  text NOT NULL CHECK (partner_type IN ('VEHICLE_OPERATOR', 'PARCEL_CARRIER')),
  legal_name    text NOT NULL,
  status        text NOT NULL CHECK (status IN (
                  'APPLIED', 'PENDING_VERIFICATION', 'AVAILABLE', 'SUSPENDED', 'EXPIRED', 'EXITED')),
  capabilities  jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 服务区、货类、COD 能力等（PRD 21.3）
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id)
);

CREATE TABLE party.partner_agreement (
  id                  uuid PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES org.company (id),
  carrier_partner_id  uuid NOT NULL,
  agreement_version   integer NOT NULL,
  valid_during        tstzrange NOT NULL,
  terms               jsonb NOT NULL,             -- 费率、附加项、责任与异常联系人、数据授权
  settlement_cycle    text NOT NULL,
  status              text NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'EXPIRED', 'TERMINATED')),
  approved_by         uuid,
  approved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, carrier_partner_id, agreement_version),
  FOREIGN KEY (company_id, carrier_partner_id) REFERENCES party.carrier_partner (company_id, id),
  CHECK (status <> 'APPROVED' OR approved_by IS NOT NULL)
);

-- -----------------------------------------------------------------------------
-- fleet：车辆、司机、班次、可用窗口
-- -----------------------------------------------------------------------------
CREATE TABLE fleet.vehicle (
  id                       uuid PRIMARY KEY,
  company_id               uuid NOT NULL REFERENCES org.company (id),
  ownership                text NOT NULL CHECK (ownership IN ('OWN_FLEET', 'PARTNER_VEHICLE')),
  carrier_partner_id       uuid,
  plate_no                 text NOT NULL,
  vehicle_type             text NOT NULL,
  status                   text NOT NULL CHECK (status IN ('AVAILABLE', 'MAINTENANCE', 'SUSPENDED', 'RETIRED')),
  current_spec_version_id  uuid,
  version                  integer NOT NULL DEFAULT 1,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, plate_no),
  FOREIGN KEY (company_id, carrier_partner_id) REFERENCES party.carrier_partner (company_id, id),
  CHECK ((ownership = 'PARTNER_VEHICLE') = (carrier_partner_id IS NOT NULL))
);

-- 车厢实测规格：只追加；装载复核引用具体版本
CREATE TABLE fleet.vehicle_spec_version (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  vehicle_id       uuid NOT NULL,
  spec_version     integer NOT NULL,
  cargo_length_cm  numeric(8,1) NOT NULL CHECK (cargo_length_cm > 0),
  cargo_width_cm   numeric(8,1) NOT NULL CHECK (cargo_width_cm > 0),
  cargo_height_cm  numeric(8,1) NOT NULL CHECK (cargo_height_cm > 0),
  door_width_cm    numeric(8,1) NOT NULL CHECK (door_width_cm > 0),
  door_height_cm   numeric(8,1) NOT NULL CHECK (door_height_cm > 0),
  payload_kg       numeric(10,3) NOT NULL CHECK (payload_kg > 0),
  obstructions     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 轮拱、固定点等占用
  measured_by      uuid NOT NULL,
  measured_at      timestamptz NOT NULL,
  UNIQUE (company_id, id),
  UNIQUE (company_id, vehicle_id, spec_version),
  FOREIGN KEY (company_id, vehicle_id) REFERENCES fleet.vehicle (company_id, id)
);

ALTER TABLE fleet.vehicle
  ADD FOREIGN KEY (company_id, current_spec_version_id) REFERENCES fleet.vehicle_spec_version (company_id, id);

CREATE TABLE fleet.driver (
  id                  uuid PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES org.company (id),
  principal_id        uuid NOT NULL,
  carrier_partner_id  uuid,                         -- 合作司机必填
  allowed_vehicle_types text[] NOT NULL DEFAULT '{}',
  status              text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXITED')),
  version             integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, principal_id),
  FOREIGN KEY (company_id, principal_id) REFERENCES org.principal (company_id, id),
  FOREIGN KEY (company_id, carrier_partner_id) REFERENCES party.carrier_partner (company_id, id)
);

CREATE TABLE fleet.driver_qualification (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  driver_id        uuid NOT NULL,
  qualification    text NOT NULL,
  valid_during     tstzrange NOT NULL,
  verification     text NOT NULL CHECK (verification IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
  verified_by      uuid,
  document_ref     text,                            -- 受控存储引用，不存证件内容
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, driver_id) REFERENCES fleet.driver (company_id, id)
);

-- 班次：定位采集授权以此为准；同一司机班次不重叠
CREATE TABLE fleet.shift (
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES org.company (id),
  driver_id   uuid NOT NULL,
  vehicle_id  uuid,
  during      tstzrange NOT NULL CHECK (NOT isempty(during)),
  status      text NOT NULL CHECK (status IN ('PLANNED', 'STARTED', 'ENDED', 'CANCELLED')),
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, driver_id) REFERENCES fleet.driver (company_id, id),
  FOREIGN KEY (company_id, vehicle_id) REFERENCES fleet.vehicle (company_id, id),
  EXCLUDE USING gist (driver_id WITH =, during WITH &&) WHERE (status <> 'CANCELLED')
);

-- 合作车辆／司机已确认的可用窗口（PRD 21.3、21.7）
CREATE TABLE fleet.capacity_availability (
  id                           uuid PRIMARY KEY,
  company_id                   uuid NOT NULL REFERENCES org.company (id),
  vehicle_id                   uuid NOT NULL,
  driver_id                    uuid,
  during                       tstzrange NOT NULL CHECK (NOT isempty(during)),
  source                       text NOT NULL CHECK (source IN ('OWN_SCHEDULE', 'PARTNER_CONFIRMED', 'MANUAL')),
  confirmed_by                 uuid NOT NULL,
  confirmed_at                 timestamptz NOT NULL,
  expires_at                   timestamptz NOT NULL,
  external_commitment_unknown  boolean NOT NULL DEFAULT true,   -- 本系统无法证明外部平台无冲突
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, vehicle_id) REFERENCES fleet.vehicle (company_id, id),
  FOREIGN KEY (company_id, driver_id) REFERENCES fleet.driver (company_id, id)
);

-- -----------------------------------------------------------------------------
-- cargo：货物模板与组合装载模式
-- -----------------------------------------------------------------------------
CREATE TABLE cargo.cargo_template (
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES org.company (id),
  code        text NOT NULL,
  name        text NOT NULL,
  category    text NOT NULL,
  status      text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, code)
);

-- 模板版本：只追加
CREATE TABLE cargo.cargo_template_version (
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL REFERENCES org.company (id),
  template_id        uuid NOT NULL,
  template_version   integer NOT NULL,
  kind               text NOT NULL CHECK (kind IN ('GENERIC_TEMPLATE', 'VERIFIED_TEMPLATE')),
  model_or_sku       text,
  packaging_version  text,
  length_cm_max      numeric(8,1),
  width_cm_max       numeric(8,1),
  height_cm_max      numeric(8,1),
  weight_kg_max      numeric(10,3),
  orientation_rule   text,
  stackable          boolean,                        -- NULL 表示未知
  handling           jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_during       tstzrange NOT NULL,
  approved_by        uuid,
  approved_at        timestamptz,
  UNIQUE (company_id, id),
  UNIQUE (company_id, template_id, template_version),
  FOREIGN KEY (company_id, template_id) REFERENCES cargo.cargo_template (company_id, id),
  CHECK (kind <> 'VERIFIED_TEMPLATE' OR (
    model_or_sku IS NOT NULL AND packaging_version IS NOT NULL AND approved_by IS NOT NULL
    AND length_cm_max IS NOT NULL AND width_cm_max IS NOT NULL
    AND height_cm_max IS NOT NULL AND weight_kg_max IS NOT NULL))
);

CREATE TABLE cargo.load_pattern (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  code             text NOT NULL,
  pattern_version  integer NOT NULL,
  rules            jsonb NOT NULL,                   -- 组合、堆叠、卸货顺序条件
  status           text NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'RETIRED')),
  approved_by      uuid,
  UNIQUE (company_id, id),
  UNIQUE (company_id, code, pattern_version)
);

-- 兼容表：已验证组合装载模式 × 实测车型版本（PRD 4.3）
CREATE TABLE cargo.load_pattern_vehicle (
  company_id               uuid NOT NULL REFERENCES org.company (id),
  load_pattern_id          uuid NOT NULL,
  vehicle_spec_version_id  uuid NOT NULL,
  conditions               jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by              uuid NOT NULL,
  approved_at              timestamptz NOT NULL,
  PRIMARY KEY (company_id, load_pattern_id, vehicle_spec_version_id),
  FOREIGN KEY (company_id, load_pattern_id) REFERENCES cargo.load_pattern (company_id, id),
  FOREIGN KEY (company_id, vehicle_spec_version_id) REFERENCES fleet.vehicle_spec_version (company_id, id)
);

-- -----------------------------------------------------------------------------
-- orders：订单、货物、位置快照、报价、承诺、ETA、服务区
-- -----------------------------------------------------------------------------
CREATE TABLE orders.service_area (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  code             text NOT NULL,
  area_version     integer NOT NULL,
  area             geography(MultiPolygon, 4326) NOT NULL,
  status           text NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'RETIRED')),
  approved_by      uuid,
  approved_at      timestamptz,
  UNIQUE (company_id, id),
  UNIQUE (company_id, code, area_version)
);
CREATE INDEX service_area_area_gix ON orders.service_area USING gist (area);

CREATE TABLE orders.delivery_order (
  id                       uuid PRIMARY KEY,
  company_id               uuid NOT NULL REFERENCES org.company (id),
  order_no                 text NOT NULL,
  customer_id              uuid NOT NULL,
  service_level            text NOT NULL CHECK (service_level IN ('S1', 'S2', 'S3', 'S4')),
  status                   text NOT NULL CHECK (status IN (
                             'draft', 'validating', 'quoted', 'awaiting_dispatch', 'executing',
                             'delivered', 'cancelled', 'return_open', 'returned', 'closed_exception')),
  fulfillment_stage        text CHECK (fulfillment_stage IN (
                             'pickup_pending', 'picked_up', 'in_transit', 'delivery_recorded')),
  fulfillment_mode         text CHECK (fulfillment_mode IN ('OWN_FLEET', 'PARTNER_VEHICLE', 'PARCEL_CARRIER')),
  requested_window         tstzrange,
  current_promise_id       uuid,
  latest_safe_dispatch_at  timestamptz,
  collection_policy        jsonb NOT NULL DEFAULT '{}'::jsonb,
  s4_fallback              text CHECK (s4_fallback IN ('DEDICATED_SAME_PRICE', 'REQUOTE', 'CANCEL')),
  notes                    text,
  version                  integer NOT NULL DEFAULT 1,
  created_by               uuid NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, order_no),
  FOREIGN KEY (company_id, customer_id) REFERENCES party.customer (company_id, id),
  CHECK (fulfillment_stage IS NULL OR status = 'executing'),
  CHECK (service_level <> 'S4' OR status = 'draft' OR s4_fallback IS NOT NULL)
);
CREATE INDEX delivery_order_queue_ix
  ON orders.delivery_order (company_id, status, latest_safe_dispatch_at);

-- 逐件货物；件级标识用于交接与部分收货
CREATE TABLE orders.order_item (
  id                    uuid PRIMARY KEY,
  company_id            uuid NOT NULL REFERENCES org.company (id),
  order_id              uuid NOT NULL,
  item_label            text NOT NULL,
  template_version_id   uuid,
  length_cm             numeric(8,1) CHECK (length_cm > 0),
  width_cm              numeric(8,1) CHECK (width_cm > 0),
  height_cm             numeric(8,1) CHECK (height_cm > 0),
  dims_source           text NOT NULL CHECK (dims_source IN (
                          'CUSTOMER_ESTIMATE', 'GENERIC_TEMPLATE', 'VERIFIED_TEMPLATE',
                          'WAREHOUSE_MEASURED', 'PICKUP_VERIFIED', 'UNKNOWN')),
  dims_unknown_reason   text,
  weight_kg             numeric(10,3) CHECK (weight_kg > 0),
  weight_source         text NOT NULL CHECK (weight_source IN (
                          'CUSTOMER_ESTIMATE', 'GENERIC_TEMPLATE', 'VERIFIED_TEMPLATE',
                          'WAREHOUSE_MEASURED', 'PICKUP_VERIFIED', 'UNKNOWN')),
  weight_unknown_reason text,
  stackable             boolean,                     -- NULL 表示未知
  orientation_rule      text,
  measured_by           uuid,
  measured_at           timestamptz,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  UNIQUE (company_id, order_id, item_label),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, template_version_id) REFERENCES cargo.cargo_template_version (company_id, id),
  -- 未知不补零：尺寸要么三项齐全，要么说明原因
  CHECK ((length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL)
         OR dims_unknown_reason IS NOT NULL),
  CHECK (weight_kg IS NOT NULL OR weight_unknown_reason IS NOT NULL),
  CHECK ((dims_source = 'UNKNOWN') = (length_cm IS NULL)),
  CHECK ((weight_source = 'UNKNOWN') = (weight_kg IS NULL))
);

-- 订单确认的位置快照：只追加；地址库后续更正不改这里（AT-47、AT-63）
CREATE TABLE orders.order_location (
  id                       uuid PRIMARY KEY,
  company_id               uuid NOT NULL REFERENCES org.company (id),
  order_id                 uuid NOT NULL,
  role                     text NOT NULL CHECK (role IN ('PICKUP', 'DROPOFF', 'RETURN_DEST')),
  address_text             text NOT NULL,
  landmark                 text,
  entrance_note            text,
  location                 geography(Point, 4326),
  location_source          text NOT NULL CHECK (location_source IN (
                             'MAP_PICK', 'GEOCODE_CANDIDATE', 'ADDRESS_BOOK', 'DRIVER_ARRIVAL', 'MANUAL', 'UNKNOWN')),
  accuracy_m               numeric(8,1),
  confirmation_status      text NOT NULL CHECK (confirmation_status IN ('PENDING', 'CONFIRMED')),
  confirmed_by             uuid,
  confirmed_at             timestamptz,
  geocore_address_ref      uuid,
  geocore_address_version  integer,
  provider_terms_ref       text,                      -- 坐标可留存的授权依据（PRD 5.3）
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  CHECK (confirmation_status <> 'CONFIRMED' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE TABLE orders.quote (
  id                         uuid PRIMARY KEY,
  company_id                 uuid NOT NULL REFERENCES org.company (id),
  order_id                   uuid NOT NULL,
  quote_version              integer NOT NULL,
  lines                      jsonb NOT NULL,
  total_minor                bigint NOT NULL CHECK (total_minor >= 0),
  currency                   char(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
  valid_until                timestamptz,
  status                     text NOT NULL CHECK (status IN (
                               'DRAFT', 'SENT', 'CUSTOMER_CONFIRMED', 'EXPIRED', 'SUPERSEDED')),
  customer_confirmation_ref  text,
  version                    integer NOT NULL DEFAULT 1,
  created_by                 uuid NOT NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, order_id, quote_version),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  CHECK (status <> 'CUSTOMER_CONFIRMED' OR customer_confirmation_ref IS NOT NULL)
);

-- 服务承诺：只追加；变更为新版本并保留原承诺（PRD 3.6）
CREATE TABLE orders.service_promise (
  id                       uuid PRIMARY KEY,
  company_id               uuid NOT NULL REFERENCES org.company (id),
  order_id                 uuid NOT NULL,
  promise_version          integer NOT NULL CHECK (promise_version >= 1),
  pickup_window            tstzrange,
  delivery_latest_at       timestamptz NOT NULL,
  promise_accepted_at      timestamptz NOT NULL,      -- S1 时钟起点，不可重置
  basis                    text NOT NULL CHECK (basis IN ('CALIBRATED_P90', 'MANUAL_POLICY')),
  pickup_buffer_minutes    integer CHECK (pickup_buffer_minutes >= 0),
  delivery_buffer_minutes  integer CHECK (delivery_buffer_minutes >= 0),
  quote_id                 uuid,
  customer_consent_ref     text NOT NULL,
  resource_basis           jsonb NOT NULL,            -- 承诺依据运力（PRD 3.8）
  supersedes_id            uuid,
  created_by               uuid NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, order_id, promise_version),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, quote_id) REFERENCES orders.quote (company_id, id),
  FOREIGN KEY (company_id, supersedes_id) REFERENCES orders.service_promise (company_id, id),
  CHECK ((promise_version = 1) = (supersedes_id IS NULL))
);

ALTER TABLE orders.delivery_order
  ADD FOREIGN KEY (company_id, current_promise_id) REFERENCES orders.service_promise (company_id, id);

CREATE TABLE orders.eta_estimate (
  id             uuid PRIMARY KEY,
  company_id     uuid NOT NULL REFERENCES org.company (id),
  order_id       uuid NOT NULL,
  checkpoint     text NOT NULL CHECK (checkpoint IN ('PICKUP', 'DELIVERY')),
  estimate_type  text NOT NULL CHECK (estimate_type IN ('P90', 'POINT', 'MANUAL', 'UNCALIBRATED')),
  eta_at         timestamptz,
  computed_at    timestamptz NOT NULL,
  source         text NOT NULL,
  data_version   text NOT NULL,                       -- 不可得时写 'UNAVAILABLE'，不伪造
  quality        text NOT NULL CHECK (quality IN ('fresh', 'stale', 'partial', 'unavailable')),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  CHECK (eta_at IS NOT NULL OR quality = 'unavailable')
);
CREATE INDEX eta_estimate_order_ix ON orders.eta_estimate (company_id, order_id, computed_at DESC);

-- -----------------------------------------------------------------------------
-- dispatch：执行、路线、指派（含提案阶段）、预留、装载复核、退回、返程机会
-- -----------------------------------------------------------------------------

-- 一个订单同一时刻只有一个有效执行：车辆指派与快递委托互斥（RULE-041、AT-10、AT-68）
CREATE TABLE dispatch.fulfillment_execution (
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES org.company (id),
  order_id    uuid NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('VEHICLE', 'CARRIER')),
  status      text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  end_reason  text,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX fulfillment_execution_one_active
  ON dispatch.fulfillment_execution (company_id, order_id) WHERE status = 'ACTIVE';

CREATE TABLE dispatch.route_plan (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  vehicle_id       uuid NOT NULL,
  driver_id        uuid,
  status           text NOT NULL CHECK (status IN (
                     'proposed', 'committed', 'in_progress', 'replanning_required', 'completed', 'cancelled')),
  current_version  integer NOT NULL DEFAULT 1,
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, vehicle_id) REFERENCES fleet.vehicle (company_id, id),
  FOREIGN KEY (company_id, driver_id) REFERENCES fleet.driver (company_id, id)
);

-- 路线版本：只追加；任何改变站点或顺序的操作生成新版本
CREATE TABLE dispatch.route_plan_version (
  id             uuid PRIMARY KEY,
  company_id     uuid NOT NULL REFERENCES org.company (id),
  plan_id        uuid NOT NULL,
  plan_version   integer NOT NULL,
  basis          jsonb NOT NULL,                      -- 计算依据：数据版本、策略版本、人工依据
  created_by     uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, plan_id, plan_version),
  FOREIGN KEY (company_id, plan_id) REFERENCES dispatch.route_plan (company_id, id)
);

-- 站点：只追加；stop_key 跨版本稳定，完成情况记录在 stop_event
CREATE TABLE dispatch.route_stop (
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL REFERENCES org.company (id),
  plan_version_id    uuid NOT NULL,
  stop_key           uuid NOT NULL,
  seq                integer NOT NULL CHECK (seq >= 1),
  stop_type          text NOT NULL CHECK (stop_type IN ('PICKUP', 'DROPOFF', 'RETURN', 'DEPOT')),
  order_id           uuid,
  order_location_id  uuid,
  time_window        tstzrange,
  planned_at         timestamptz,
  load_after_kg      numeric(10,3),
  load_after_m3      numeric(10,4),
  UNIQUE (company_id, id),
  UNIQUE (company_id, plan_version_id, seq),
  UNIQUE (company_id, plan_version_id, stop_key),
  FOREIGN KEY (company_id, plan_version_id) REFERENCES dispatch.route_plan_version (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, order_location_id) REFERENCES orders.order_location (company_id, id)
);

CREATE TABLE dispatch.stop_event (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  plan_id          uuid NOT NULL,
  stop_key         uuid NOT NULL,
  event_type       text NOT NULL CHECK (event_type IN ('ARRIVED', 'COMPLETED', 'SKIPPED')),
  observed_at      timestamptz NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  recorded_by      uuid NOT NULL,
  degraded         boolean NOT NULL DEFAULT false,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, plan_id) REFERENCES dispatch.route_plan (company_id, id)
);

-- 指派：PRD 的 DispatchOffer 即本表的 offered 阶段
CREATE TABLE dispatch.assignment (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  execution_id     uuid NOT NULL,
  order_id         uuid NOT NULL,
  driver_id        uuid NOT NULL,
  vehicle_id       uuid NOT NULL,
  plan_version_id  uuid NOT NULL,
  policy_version   text NOT NULL,
  status           text NOT NULL CHECK (status IN (
                     'offered', 'accepted', 'completed', 'expired', 'rejected', 'revoked', 'superseded')),
  offered_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,              -- 提案 TTL（PRD 3.2）
  accepted_at      timestamptz,
  ended_at         timestamptz,
  end_reason       text,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, execution_id) REFERENCES dispatch.fulfillment_execution (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, driver_id) REFERENCES fleet.driver (company_id, id),
  FOREIGN KEY (company_id, vehicle_id) REFERENCES fleet.vehicle (company_id, id),
  FOREIGN KEY (company_id, plan_version_id) REFERENCES dispatch.route_plan_version (company_id, id),
  CHECK (expires_at > offered_at),
  CHECK (status <> 'accepted' OR accepted_at IS NOT NULL)
);
CREATE UNIQUE INDEX assignment_one_open_per_order
  ON dispatch.assignment (company_id, order_id) WHERE status IN ('offered', 'accepted');

-- 容量预留（PRD 3.8）：承诺级、提案软预留、执行占用
CREATE TABLE dispatch.capacity_reservation (
  id              uuid PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES org.company (id),
  vehicle_id      uuid NOT NULL,
  order_id        uuid NOT NULL,
  assignment_id   uuid,
  kind            text NOT NULL CHECK (kind IN ('PROMISE', 'OFFER', 'EXECUTION')),
  sharing         text NOT NULL CHECK (sharing IN ('EXCLUSIVE', 'SHARED')),
  during          tstzrange NOT NULL CHECK (NOT isempty(during)),
  weight_kg       numeric(10,3),
  volume_m3       numeric(10,4),
  status          text NOT NULL CHECK (status IN ('ACTIVE', 'RELEASED', 'EXPIRED', 'TRANSFERRED')),
  expires_at      timestamptz,
  release_reason  text,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, vehicle_id) REFERENCES fleet.vehicle (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, assignment_id) REFERENCES dispatch.assignment (company_id, id),
  CHECK (kind <> 'OFFER' OR expires_at IS NOT NULL),
  CHECK (status = 'ACTIVE' OR release_reason IS NOT NULL),
  -- 不同订单的独占预留在同一车辆上不得时段重叠（AT-72）
  EXCLUDE USING gist (vehicle_id WITH =, during WITH &&, order_id WITH <>)
    WHERE (status = 'ACTIVE' AND sharing = 'EXCLUSIVE')
);

CREATE TABLE dispatch.load_review (
  id                       uuid PRIMARY KEY,
  company_id               uuid NOT NULL REFERENCES org.company (id),
  order_id                 uuid NOT NULL,
  vehicle_spec_version_id  uuid NOT NULL,
  load_pattern_id          uuid,
  plan_version_id          uuid,
  items_digest             text NOT NULL,             -- 货物清单（件、尺寸、重量版本）的摘要
  result                   text NOT NULL CHECK (result IN (
                             'VERIFIED_PATTERN_PASS', 'MANUAL_LOAD_REVIEW', 'MANUAL_RELEASED', 'REJECTED')),
  reviewer_id              uuid,
  evidence                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at              timestamptz NOT NULL DEFAULT now(),
  invalidated_at           timestamptz,
  invalidated_reason       text,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, vehicle_spec_version_id) REFERENCES fleet.vehicle_spec_version (company_id, id),
  FOREIGN KEY (company_id, load_pattern_id) REFERENCES cargo.load_pattern (company_id, id),
  FOREIGN KEY (company_id, plan_version_id) REFERENCES dispatch.route_plan_version (company_id, id),
  CHECK (result <> 'MANUAL_RELEASED' OR reviewer_id IS NOT NULL),
  CHECK ((invalidated_at IS NULL) = (invalidated_reason IS NULL))
);

CREATE TABLE dispatch.return_task (
  id             uuid PRIMARY KEY,
  company_id     uuid NOT NULL REFERENCES org.company (id),
  order_id       uuid NOT NULL,
  reason_code    text NOT NULL CHECK (reason_code IN (
                   'REFUSED', 'UNREACHABLE', 'ADDRESS_INACCESSIBLE', 'ITEM_MISMATCH',
                   'CANCELLED_AFTER_PICKUP', 'PARTIAL_DELIVERY', 'DAMAGED', 'OTHER')),
  destination    text NOT NULL,
  status         text NOT NULL CHECK (status IN (
                   'requested', 'authorized', 'assigned', 'picked_up', 'received', 'inspected', 'closed')),
  cost_bearer    text,
  authorized_by  uuid,
  version        integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  CHECK (status = 'requested' OR authorized_by IS NOT NULL)
);

-- R3-C 返程机会（首期不使用）
CREATE TABLE dispatch.route_opportunity (
  id                    uuid PRIMARY KEY,
  company_id            uuid NOT NULL REFERENCES org.company (id),
  vehicle_id            uuid NOT NULL,
  driver_id             uuid,
  origin                geography(Point, 4326) NOT NULL,
  planned_end           geography(Point, 4326) NOT NULL,
  earliest_pickup_at    timestamptz NOT NULL,
  latest_return_at      timestamptz NOT NULL,
  corridor              geography(Polygon, 4326),
  remaining_weight_kg   numeric(10,3),
  remaining_volume_m3   numeric(10,4),
  source_plan_version_id uuid,
  status                text NOT NULL CHECK (status IN ('OPEN', 'MATCHED', 'EXPIRED', 'CANCELLED')),
  valid_until           timestamptz NOT NULL,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, vehicle_id) REFERENCES fleet.vehicle (company_id, id),
  FOREIGN KEY (company_id, driver_id) REFERENCES fleet.driver (company_id, id),
  FOREIGN KEY (company_id, source_plan_version_id) REFERENCES dispatch.route_plan_version (company_id, id),
  CHECK (latest_return_at > earliest_pickup_at)
);

-- -----------------------------------------------------------------------------
-- carrier：快递委托（R1-M）
-- -----------------------------------------------------------------------------
CREATE TABLE carrier.carrier_booking (
  id                        uuid PRIMARY KEY,
  company_id                uuid NOT NULL REFERENCES org.company (id),
  execution_id              uuid,                     -- 离开 draft 时创建执行
  order_id                  uuid NOT NULL,
  carrier_partner_id        uuid NOT NULL,
  service_product           text NOT NULL,
  external_booking_no       text,
  request_idempotency_key   text NOT NULL,
  quote_minor               bigint CHECK (quote_minor >= 0),
  currency                  char(3) CHECK (currency IN ('USD', 'KHR')),
  pickup_window             tstzrange,
  status                    text NOT NULL CHECK (status IN (
                              'draft', 'pending_confirmation', 'confirmed', 'awaiting_handover', 'handed_over',
                              'in_transit', 'delivery_reported', 'delivery_verified',
                              'cancel_requested', 'cancellation_confirmed')),
  last_event_at             timestamptz,
  version                   integer NOT NULL DEFAULT 1,
  created_by                uuid NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, request_idempotency_key),
  UNIQUE (company_id, carrier_partner_id, external_booking_no),
  FOREIGN KEY (company_id, execution_id) REFERENCES dispatch.fulfillment_execution (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, carrier_partner_id) REFERENCES party.carrier_partner (company_id, id),
  CHECK (status = 'draft' OR execution_id IS NOT NULL),
  CHECK ((quote_minor IS NULL) = (currency IS NULL))
);
CREATE INDEX carrier_booking_followup_ix
  ON carrier.carrier_booking (company_id, status, last_event_at);

CREATE TABLE carrier.booking_contact_log (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES org.company (id),
  booking_id        uuid NOT NULL,
  channel           text NOT NULL,
  contact_person    text,
  contacted_at      timestamptz NOT NULL,
  outcome           text NOT NULL CHECK (outcome IN ('CONFIRMED', 'DECLINED', 'UNKNOWN', 'NO_ANSWER')),
  next_follow_up_by uuid,
  next_follow_up_at timestamptz,
  recorded_by       uuid NOT NULL,
  evidence_file_id  uuid,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, booking_id) REFERENCES carrier.carrier_booking (company_id, id),
  CHECK (outcome <> 'UNKNOWN' OR next_follow_up_by IS NOT NULL)
);

CREATE TABLE carrier.carrier_tracking_event (
  id                  uuid PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES org.company (id),
  booking_id          uuid NOT NULL,
  carrier_partner_id  uuid NOT NULL,
  provider_event_id   text,
  dedupe_key          text NOT NULL,
  occurred_at         timestamptz,
  received_at         timestamptz NOT NULL DEFAULT now(),
  raw_status          text NOT NULL,
  raw_payload         jsonb,                          -- 最小必要、已脱敏
  mapped_status       text NOT NULL,                  -- 未知状态映射为 'UNKNOWN'，不映射为成功
  mapping_version     text NOT NULL,
  entered_by          uuid,                           -- 人工录入时必填
  evidence_file_id    uuid,
  UNIQUE (company_id, id),
  UNIQUE (company_id, carrier_partner_id, dedupe_key),
  FOREIGN KEY (company_id, booking_id) REFERENCES carrier.carrier_booking (company_id, id),
  FOREIGN KEY (company_id, carrier_partner_id) REFERENCES party.carrier_partner (company_id, id)
);

-- -----------------------------------------------------------------------------
-- custody：凭证文件、实物交接、交付凭证
-- -----------------------------------------------------------------------------
CREATE TABLE custody.evidence_file (
  id            uuid PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES org.company (id),
  object_key    text NOT NULL UNIQUE,
  sha256        char(64) NOT NULL,
  content_type  text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
  captured_at   timestamptz,
  uploaded_by   uuid NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id)
);

ALTER TABLE carrier.booking_contact_log
  ADD FOREIGN KEY (company_id, evidence_file_id) REFERENCES custody.evidence_file (company_id, id);
ALTER TABLE carrier.carrier_tracking_event
  ADD FOREIGN KEY (company_id, evidence_file_id) REFERENCES custody.evidence_file (company_id, id);

CREATE TABLE custody.custody_transfer (
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL REFERENCES org.company (id),
  order_id           uuid NOT NULL,
  execution_id       uuid,
  from_party_type    text NOT NULL CHECK (from_party_type IN ('WAREHOUSE', 'DRIVER', 'CARRIER', 'CONSIGNEE')),
  from_party_ref     text NOT NULL,
  to_party_type      text NOT NULL CHECK (to_party_type IN ('WAREHOUSE', 'DRIVER', 'CARRIER', 'CONSIGNEE')),
  to_party_ref       text NOT NULL,
  location_text      text,
  location           geography(Point, 4326),
  occurred_at        timestamptz NOT NULL,
  status             text NOT NULL CHECK (status IN ('PROPOSED', 'CONFIRMED', 'DISCREPANCY')),
  confirmed_by_from  uuid,
  confirmed_by_to    uuid,
  degraded           boolean NOT NULL DEFAULT false,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, execution_id) REFERENCES dispatch.fulfillment_execution (company_id, id),
  CHECK (status <> 'CONFIRMED' OR (confirmed_by_from IS NOT NULL AND confirmed_by_to IS NOT NULL))
);

-- 已确认或已登记差异的交接不可修改
CREATE FUNCTION custody.lock_final_transfer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('CONFIRMED', 'DISCREPANCY') THEN
    RAISE EXCEPTION 'custody_transfer % is final', OLD.id USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER custody_transfer_final_lock
  BEFORE UPDATE ON custody.custody_transfer
  FOR EACH ROW EXECUTE FUNCTION custody.lock_final_transfer();

CREATE TABLE custody.custody_transfer_item (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES org.company (id),
  transfer_id       uuid NOT NULL,
  order_item_id     uuid NOT NULL,
  packaging_state   text,
  seal_state        text,
  discrepancy_note  text,
  UNIQUE (company_id, id),
  UNIQUE (company_id, transfer_id, order_item_id),
  FOREIGN KEY (company_id, transfer_id) REFERENCES custody.custody_transfer (company_id, id),
  FOREIGN KEY (company_id, order_item_id) REFERENCES orders.order_item (company_id, id)
);

CREATE TABLE custody.delivery_proof (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES org.company (id),
  order_id          uuid NOT NULL,
  proof_type        text NOT NULL CHECK (proof_type IN (
                      'SIGNATURE', 'PHOTO', 'SCAN', 'CONSIGNEE_CONFIRMATION', 'CARRIER_POD')),
  evidence_file_id  uuid,
  delivered_items   jsonb NOT NULL,                   -- 件级实收；部分收货逐件记录
  recorded_by       uuid NOT NULL,
  observed_at       timestamptz NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, evidence_file_id) REFERENCES custody.evidence_file (company_id, id)
);

-- -----------------------------------------------------------------------------
-- finance：收款、核验、交款、合作方应付
-- -----------------------------------------------------------------------------
CREATE TABLE finance.collection_record (
  id              uuid PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES org.company (id),
  order_id        uuid NOT NULL,
  charge_type     text NOT NULL CHECK (charge_type IN ('FREIGHT', 'COD')),
  beneficiary     text NOT NULL,
  method          text NOT NULL CHECK (method IN ('CASH', 'KHQR', 'MONTHLY_ACCOUNT')),
  currency        char(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
  due_minor       bigint NOT NULL CHECK (due_minor >= 0),
  reported_minor  bigint CHECK (reported_minor >= 0),
  status          text NOT NULL CHECK (status IN ('due', 'reported', 'verified', 'mismatch', 'voided_by_correction')),
  reported_by     uuid,
  reported_at     timestamptz,
  reverses_id     uuid,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, reverses_id) REFERENCES finance.collection_record (company_id, id),
  CHECK (status = 'due' OR reverses_id IS NOT NULL OR reported_minor IS NOT NULL)
);

-- 金额、币种、账目类型一经写入不可修改；更正用冲正记录
CREATE FUNCTION finance.lock_collection_amounts() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.due_minor IS DISTINCT FROM OLD.due_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.charge_type IS DISTINCT FROM OLD.charge_type
     OR (OLD.reported_minor IS NOT NULL AND NEW.reported_minor IS DISTINCT FROM OLD.reported_minor) THEN
    RAISE EXCEPTION 'collection_record % amounts are immutable; use a reversal', OLD.id
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collection_record_amount_lock
  BEFORE UPDATE ON finance.collection_record
  FOR EACH ROW EXECUTE FUNCTION finance.lock_collection_amounts();

CREATE TABLE finance.collection_verification (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES org.company (id),
  collection_id     uuid NOT NULL,
  channel           text NOT NULL CHECK (channel IN ('BANK', 'KHQR', 'CASH_COUNT')),
  external_txn_id   text,
  verified_minor    bigint NOT NULL CHECK (verified_minor >= 0),
  currency          char(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
  result            text NOT NULL CHECK (result IN ('MATCHED', 'MISMATCH')),
  verified_by       uuid NOT NULL,
  verified_at       timestamptz NOT NULL DEFAULT now(),
  evidence_file_id  uuid,
  UNIQUE (company_id, id),
  -- 同一银行交易只能核销一次（AT-38）
  UNIQUE (company_id, channel, external_txn_id),
  FOREIGN KEY (company_id, collection_id) REFERENCES finance.collection_record (company_id, id),
  FOREIGN KEY (company_id, evidence_file_id) REFERENCES custody.evidence_file (company_id, id),
  CHECK (channel = 'CASH_COUNT' OR external_txn_id IS NOT NULL)
);

CREATE TABLE finance.remittance (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  driver_id        uuid NOT NULL,
  business_date    date NOT NULL,                     -- Asia/Phnom_Penh 营业日
  currency         char(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
  expected_minor   bigint NOT NULL CHECK (expected_minor >= 0),
  submitted_minor  bigint CHECK (submitted_minor >= 0),
  status           text NOT NULL CHECK (status IN ('open', 'submitted', 'verified', 'discrepancy', 'reconciled')),
  verified_by      uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  UNIQUE (company_id, driver_id, business_date, currency),
  FOREIGN KEY (company_id, driver_id) REFERENCES fleet.driver (company_id, id)
);

CREATE TABLE finance.partner_payable (
  id                  uuid PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES org.company (id),
  execution_id        uuid NOT NULL,
  carrier_partner_id  uuid NOT NULL,
  agreement_id        uuid NOT NULL,
  currency            char(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
  payable_minor       bigint NOT NULL CHECK (payable_minor >= 0),
  verified_minor      bigint CHECK (verified_minor >= 0),
  status              text NOT NULL CHECK (status IN (
                        'PENDING_REVIEW', 'VERIFIED', 'DISPUTED', 'PARTIALLY_PAID', 'PAID')),
  reverses_id         uuid,
  version             integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, execution_id) REFERENCES dispatch.fulfillment_execution (company_id, id),
  FOREIGN KEY (company_id, carrier_partner_id) REFERENCES party.carrier_partner (company_id, id),
  FOREIGN KEY (company_id, agreement_id) REFERENCES party.partner_agreement (company_id, id),
  FOREIGN KEY (company_id, reverses_id) REFERENCES finance.partner_payable (company_id, id)
);

CREATE TABLE finance.payable_payment (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES org.company (id),
  payable_id        uuid NOT NULL,
  paid_minor        bigint NOT NULL CHECK (paid_minor > 0),
  currency          char(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
  paid_on           date NOT NULL,
  evidence_file_id  uuid NOT NULL,
  recorded_by       uuid NOT NULL,
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, payable_id) REFERENCES finance.partner_payable (company_id, id),
  FOREIGN KEY (company_id, evidence_file_id) REFERENCES custody.evidence_file (company_id, id)
);

-- -----------------------------------------------------------------------------
-- ops：异常、降级、暂停、试点策略、功能开关、通知、跟踪链接
-- -----------------------------------------------------------------------------
CREATE TABLE ops.dispatch_exception (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  order_id         uuid,
  exception_type   text NOT NULL,
  stage            text NOT NULL,
  blocking         boolean NOT NULL,
  blocked_actions  text[] NOT NULL DEFAULT '{}',
  custodian_type   text CHECK (custodian_type IN ('WAREHOUSE', 'DRIVER', 'CARRIER', 'CONSIGNEE', 'UNKNOWN')),
  custodian_ref    text,
  owner_id         uuid,
  due_at           timestamptz,
  status           text NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  resolution       text,
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  CHECK (status NOT IN ('RESOLVED', 'CLOSED') OR resolution IS NOT NULL)
);
CREATE INDEX dispatch_exception_open_ix
  ON ops.dispatch_exception (company_id, status, due_at) WHERE status IN ('OPEN', 'IN_PROGRESS');

CREATE TABLE ops.degradation_record (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES org.company (id),
  degradation_type  text NOT NULL CHECK (degradation_type IN (
                      'MAP_UNAVAILABLE', 'LOCATION_STALE', 'DRIVER_OFFLINE', 'PAYMENT_UNVERIFIABLE')),
  subject_ref       text,
  reason            text NOT NULL,
  started_by        uuid NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_by          uuid,
  ended_at          timestamptz,
  UNIQUE (company_id, id),
  CHECK ((ended_at IS NULL) = (ended_by IS NULL))
);

CREATE TABLE ops.pause_record (
  id            uuid PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES org.company (id),
  scope         text NOT NULL CHECK (scope IN ('CAPABILITY', 'GLOBAL')),
  capability    text,
  trigger_code  text NOT NULL,
  reason        text NOT NULL,
  paused_by     uuid NOT NULL,
  paused_at     timestamptz NOT NULL DEFAULT now(),
  resumed_at    timestamptz,
  resume_scope  text,
  UNIQUE (company_id, id),
  CHECK ((scope = 'CAPABILITY') = (capability IS NOT NULL))
);

-- 恢复须运营负责人与人类集成负责人两条不同主体的批准（PRD 15.1）
CREATE TABLE ops.pause_approval (
  id             uuid PRIMARY KEY,
  company_id     uuid NOT NULL REFERENCES org.company (id),
  pause_id       uuid NOT NULL,
  approver_id    uuid NOT NULL,
  approver_role  text NOT NULL CHECK (approver_role IN ('OPERATIONS_OWNER', 'INTEGRATION_OWNER')),
  approved_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, pause_id, approver_role),
  UNIQUE (company_id, pause_id, approver_id),
  FOREIGN KEY (company_id, pause_id) REFERENCES ops.pause_record (company_id, id)
);

CREATE FUNCTION ops.require_dual_approval() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.resumed_at IS NULL AND NEW.resumed_at IS NOT NULL THEN
    IF (SELECT count(DISTINCT approver_role) FROM ops.pause_approval
         WHERE company_id = NEW.company_id AND pause_id = NEW.id) < 2 THEN
      RAISE EXCEPTION 'pause % requires approvals from both OPERATIONS_OWNER and INTEGRATION_OWNER', NEW.id
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pause_record_dual_approval
  BEFORE UPDATE ON ops.pause_record
  FOR EACH ROW EXECUTE FUNCTION ops.require_dual_approval();

CREATE TABLE ops.pilot_policy_version (
  id              uuid PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES org.company (id),
  policy_id       text NOT NULL,                      -- 如 ROUTEFIT-PILOT-0
  policy_version  text NOT NULL,
  parameters      jsonb NOT NULL,
  status          text NOT NULL CHECK (status IN ('PROPOSED', 'APPROVED', 'RETIRED')),
  approved_by     uuid,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, policy_id, policy_version),
  CHECK (status <> 'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

-- 功能开关：默认关闭；读取失败按关闭处理
CREATE TABLE ops.feature_flag (
  company_id         uuid NOT NULL REFERENCES org.company (id),
  capability         text NOT NULL,
  enabled            boolean NOT NULL DEFAULT false,
  policy_version_id  uuid,
  updated_by         uuid NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, capability),
  FOREIGN KEY (company_id, policy_version_id) REFERENCES ops.pilot_policy_version (company_id, id)
);

CREATE TABLE ops.notification_message (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES org.company (id),
  order_id          uuid NOT NULL,
  template_code     text NOT NULL,
  template_version  text NOT NULL,
  locale            text NOT NULL CHECK (locale IN ('km', 'en', 'zh-Hans')),
  channel           text NOT NULL,
  recipient_ref     uuid NOT NULL,                    -- 指向联系人，不复制电话
  status            text NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'FAILED', 'MANUAL_FOLLOW_UP')),
  failure_reason    text,
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id),
  FOREIGN KEY (company_id, recipient_ref) REFERENCES party.customer_contact (company_id, id)
);

-- 跟踪链接只存引用的哈希，不存明文
CREATE TABLE ops.tracking_link (
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES org.company (id),
  order_id    uuid NOT NULL,
  ref_hash    bytea NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id)
);

-- -----------------------------------------------------------------------------
-- reco：推荐日志与每趟经营
-- -----------------------------------------------------------------------------
CREATE TABLE reco.recommendation_log (
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL REFERENCES org.company (id),
  order_id           uuid NOT NULL,
  mode               text NOT NULL CHECK (mode IN ('shadow', 'assisted')),
  inputs_snapshot    jsonb NOT NULL,                  -- 决策前输入，防止事后利用结果
  recommendation     jsonb NOT NULL,
  model_version      text NOT NULL,
  dispatcher_choice  jsonb,
  rejection_reason   text,
  outcome            jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES orders.delivery_order (company_id, id)
);

CREATE TABLE reco.trip_economics (
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL REFERENCES org.company (id),
  route_plan_id      uuid NOT NULL,
  currency           char(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
  revenue_minor      bigint,
  driver_cost_minor  bigint,
  distance_cost_minor bigint,
  waiting_cost_minor bigint,
  handling_cost_minor bigint,
  exception_cost_minor bigint,
  is_estimated       boolean NOT NULL,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, route_plan_id, currency),
  FOREIGN KEY (company_id, route_plan_id) REFERENCES dispatch.route_plan (company_id, id)
);

-- -----------------------------------------------------------------------------
-- integration：幂等、发件箱、收件箱、中控快照、场景映射
-- -----------------------------------------------------------------------------
CREATE TABLE integration.idempotency_record (
  company_id       uuid NOT NULL REFERENCES org.company (id),
  principal_id     uuid NOT NULL,
  idempotency_key  text NOT NULL,
  request_hash     bytea NOT NULL,
  operation        text NOT NULL,
  response_status  integer,
  response_body    jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  PRIMARY KEY (company_id, principal_id, idempotency_key)
);

CREATE TABLE integration.outbox_event (
  id              uuid PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES org.company (id),
  event_type      text NOT NULL,
  aggregate_type  text NOT NULL,
  aggregate_id    uuid NOT NULL,
  aggregate_version integer NOT NULL,
  schema_version  text NOT NULL,
  occurred_at     timestamptz NOT NULL,
  correlation_id  uuid,
  payload         jsonb NOT NULL,
  published_at    timestamptz,
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text
);
CREATE INDEX outbox_event_unpublished_ix
  ON integration.outbox_event (occurred_at) WHERE published_at IS NULL;

CREATE TABLE integration.inbox_event (
  company_id   uuid NOT NULL REFERENCES org.company (id),
  source       text NOT NULL,
  dedupe_key   text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  handled_at   timestamptz,
  PRIMARY KEY (company_id, source, dedupe_key)
);

CREATE TABLE integration.ops_snapshot (
  id                          uuid PRIMARY KEY,
  company_id                  uuid NOT NULL REFERENCES org.company (id),
  sequence                    bigint NOT NULL,
  schema_version              text NOT NULL,
  generated_at                timestamptz NOT NULL,
  data_as_of                  timestamptz NOT NULL,
  quality                     text NOT NULL CHECK (quality IN ('fresh', 'stale', 'partial', 'unavailable')),
  metric_definitions_version  text NOT NULL,
  window_start                timestamptz NOT NULL,
  window_end                  timestamptz NOT NULL,
  payload                     jsonb NOT NULL,
  UNIQUE (company_id, id),
  UNIQUE (company_id, sequence)
);

CREATE TABLE integration.scene_binding (
  id               uuid PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES org.company (id),
  warehouse_ref    text NOT NULL,
  scene_zone       text NOT NULL CHECK (scene_zone IN ('W1', 'W2', 'W3')),
  binding_version  integer NOT NULL,
  approved_by      uuid NOT NULL,
  approved_at      timestamptz NOT NULL,
  retired_at       timestamptz,
  UNIQUE (company_id, id),
  UNIQUE (company_id, warehouse_ref, scene_zone, binding_version)
);

-- -----------------------------------------------------------------------------
-- audit：审计事件（按月分区，只追加）
-- -----------------------------------------------------------------------------
CREATE TABLE audit.audit_event (
  id               uuid NOT NULL,
  occurred_at      timestamptz NOT NULL,
  company_id       uuid NOT NULL,
  principal_id     uuid,
  action           text NOT NULL,
  object_type      text NOT NULL,
  object_id        uuid,
  before_version   integer,
  after_version    integer,
  idempotency_key  text,
  request_id       uuid,
  degraded         boolean NOT NULL DEFAULT false,
  detail           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 不含凭据与个人信息原文
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE audit.audit_event_2026_10 PARTITION OF audit.audit_event
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE audit.audit_event_default PARTITION OF audit.audit_event DEFAULT;
CREATE INDEX audit_event_object_ix ON audit.audit_event (company_id, object_type, object_id, occurred_at);

-- -----------------------------------------------------------------------------
-- 只追加表：拒绝 UPDATE 与 DELETE
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fleet.vehicle_spec_version',
    'cargo.cargo_template_version',
    'orders.order_location',
    'orders.service_promise',
    'orders.eta_estimate',
    'dispatch.route_plan_version',
    'dispatch.route_stop',
    'dispatch.stop_event',
    'carrier.booking_contact_log',
    'carrier.carrier_tracking_event',
    'custody.evidence_file',
    'custody.custody_transfer_item',
    'custody.delivery_proof',
    'finance.collection_verification',
    'finance.payable_payment',
    'audit.audit_event'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION audit.reject_change()',
      t);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 行级安全：按 app.company_id 隔离（第二道防线；应用仍做对象授权）
-- 应用在每个事务开始时执行：SET LOCAL app.company_id = '<uuid>';
-- 未设置时 current_setting(..., true) 返回 NULL，查询不到任何行。
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.column_name = 'company_id'
       AND t.table_type = 'BASE TABLE'
       AND c.table_schema IN ('org', 'party', 'fleet', 'cargo', 'orders', 'dispatch', 'carrier',
                              'custody', 'finance', 'ops', 'reco', 'integration', 'audit')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format(
      'CREATE POLICY company_isolation ON %I.%I
         USING (company_id = NULLIF(current_setting(''app.company_id'', true), '''')::uuid)
         WITH CHECK (company_id = NULLIF(current_setting(''app.company_id'', true), '''')::uuid)',
      r.table_schema, r.table_name);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 账号与权限（示意；账号与密码由部署环境创建，不写入仓库）
-- -----------------------------------------------------------------------------
-- CREATE ROLE routefit_app LOGIN;            -- 密码由密钥管理服务注入
-- GRANT USAGE ON SCHEMA org, party, fleet, cargo, orders, dispatch, carrier, custody,
--   finance, ops, reco, integration, audit TO routefit_app;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA org, party, fleet, cargo, orders,
--   dispatch, carrier, custody, finance, ops, reco, integration TO routefit_app;
-- GRANT INSERT, SELECT ON audit.audit_event TO routefit_app;
-- -- 不授予 DELETE；不授予 DDL；routefit_app 不是任何表的所有者，因此受 RLS 约束。
