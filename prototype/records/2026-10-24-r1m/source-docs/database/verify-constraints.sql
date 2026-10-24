-- =============================================================================
-- DR RouteFit · routefit 库关键约束验证脚本 v0.1
--
-- 用途：在执行 routefit-schema-draft.sql 之后的临时库中运行，验证数据库兜底的规则。
-- 数据：全部为合成数据（公司 A、公司 B），不含任何真实信息。
-- 运行：psql -v ON_ERROR_STOP=1 -f verify-constraints.sql
--       每个测试打印 PASS；任何 FAIL 都会中止脚本并返回非零退出码。
-- 注意：必须以超级用户或表所有者执行种子数据部分；行级安全测试会切换到
--       非所有者角色 routefit_app。
-- =============================================================================

\set ON_ERROR_STOP on
SET client_min_messages = notice;

-- -----------------------------------------------------------------------------
-- 合成种子数据
-- -----------------------------------------------------------------------------
INSERT INTO org.company (id, name, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Synthetic Company A', 'ACTIVE'),
  ('b0000000-0000-0000-0000-000000000001', 'Synthetic Company B', 'ACTIVE');

INSERT INTO org.principal (id, company_id, kind, display_name, idp_subject, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'STAFF',  'Dispatcher A',  'synthetic-a-staff',  'ACTIVE'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'DRIVER', 'Driver A',      'synthetic-a-driver', 'ACTIVE'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'STAFF',  'Ops Owner A',   'synthetic-a-ops',    'ACTIVE'),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'STAFF',  'Integration A', 'synthetic-a-int',    'ACTIVE'),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'STAFF',  'Dispatcher B',  'synthetic-b-staff',  'ACTIVE');

INSERT INTO party.customer (id, company_id, name, status) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Customer A', 'ACTIVE'),
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Customer B', 'ACTIVE');

INSERT INTO fleet.vehicle (id, company_id, ownership, plate_no, vehicle_type, status) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'OWN_FLEET', 'SYN-A-0001', 'VAN', 'AVAILABLE');

INSERT INTO fleet.driver (id, company_id, principal_id, status) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000002', 'ACTIVE');

INSERT INTO orders.delivery_order (id, company_id, order_no, customer_id, service_level, status, created_by) VALUES
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'SYN-A-0001',
   'a2000000-0000-0000-0000-000000000001', 'S2', 'awaiting_dispatch', 'a1000000-0000-0000-0000-000000000001'),
  ('a5000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'SYN-A-0002',
   'a2000000-0000-0000-0000-000000000001', 'S2', 'awaiting_dispatch', 'a1000000-0000-0000-0000-000000000001'),
  ('b5000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'SYN-B-0001',
   'b2000000-0000-0000-0000-000000000001', 'S2', 'awaiting_dispatch', 'b1000000-0000-0000-0000-000000000001');

INSERT INTO orders.service_promise
  (id, company_id, order_id, promise_version, delivery_latest_at, promise_accepted_at, basis,
   customer_consent_ref, resource_basis, created_by)
VALUES
  ('a6000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a5000000-0000-0000-0000-000000000001', 1, '2026-10-24 17:00+07', '2026-10-24 08:00+07',
   'MANUAL_POLICY', 'synthetic-consent-1', '{"vehicleId":"a3000000-0000-0000-0000-000000000001"}',
   'a1000000-0000-0000-0000-000000000001');

-- -----------------------------------------------------------------------------
-- T1 一个订单同一时刻只有一个有效执行（RULE-041、AT-10、AT-68）
-- -----------------------------------------------------------------------------
INSERT INTO dispatch.fulfillment_execution (id, company_id, order_id, kind, status) VALUES
  ('a7000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a5000000-0000-0000-0000-000000000001', 'VEHICLE', 'ACTIVE');

DO $$
BEGIN
  BEGIN
    INSERT INTO dispatch.fulfillment_execution (id, company_id, order_id, kind, status) VALUES
      ('a7000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
       'a5000000-0000-0000-0000-000000000001', 'CARRIER', 'ACTIVE');
    RAISE EXCEPTION 'FAIL T1a: second ACTIVE execution for the same order was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS T1a: a second ACTIVE execution (vehicle vs carrier) is rejected';
  END;
END;
$$;

DO $$
BEGIN
  UPDATE dispatch.fulfillment_execution
     SET status = 'ENDED', ended_at = now(), end_reason = 'SYNTHETIC_REJECTED'
   WHERE id = 'a7000000-0000-0000-0000-000000000001';
  INSERT INTO dispatch.fulfillment_execution (id, company_id, order_id, kind, status) VALUES
    ('a7000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
     'a5000000-0000-0000-0000-000000000001', 'CARRIER', 'ACTIVE');
  RAISE NOTICE 'PASS T1b: after the previous execution ENDED a new ACTIVE execution is allowed';
END;
$$;

-- -----------------------------------------------------------------------------
-- T2 同一车辆独占预留时段不重叠（PRD 3.8、AT-72）
-- -----------------------------------------------------------------------------
INSERT INTO dispatch.capacity_reservation (id, company_id, vehicle_id, order_id, kind, sharing, during, status) VALUES
  ('a8000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a3000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001',
   'PROMISE', 'EXCLUSIVE', tstzrange('2026-10-24 10:00+07', '2026-10-24 12:00+07'), 'ACTIVE');

DO $$
BEGIN
  INSERT INTO dispatch.capacity_reservation
    (id, company_id, vehicle_id, order_id, kind, sharing, during, status, expires_at) VALUES
    ('a8000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
     'a3000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001',
     'OFFER', 'EXCLUSIVE', tstzrange('2026-10-24 10:30+07', '2026-10-24 11:30+07'), 'ACTIVE',
     '2026-10-24 10:02+07');
  RAISE NOTICE 'PASS T2a: the same order''s offer reservation does not conflict with its promise reservation';
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO dispatch.capacity_reservation (id, company_id, vehicle_id, order_id, kind, sharing, during, status) VALUES
      ('a8000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
       'a3000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002',
       'PROMISE', 'EXCLUSIVE', tstzrange('2026-10-24 11:00+07', '2026-10-24 13:00+07'), 'ACTIVE');
    RAISE EXCEPTION 'FAIL T2b: overlapping exclusive reservation for another order was accepted';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PASS T2b: overlapping exclusive reservation for another order is rejected';
  END;
END;
$$;

DO $$
BEGIN
  INSERT INTO dispatch.capacity_reservation (id, company_id, vehicle_id, order_id, kind, sharing, during, status) VALUES
    ('a8000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
     'a3000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002',
     'PROMISE', 'EXCLUSIVE', tstzrange('2026-10-24 12:00+07', '2026-10-24 13:00+07'), 'ACTIVE');
  RAISE NOTICE 'PASS T2c: back-to-back windows [10:00,12:00) and [12:00,13:00) do not conflict';
END;
$$;

DO $$
BEGIN
  INSERT INTO dispatch.capacity_reservation (id, company_id, vehicle_id, order_id, kind, sharing, during, status) VALUES
    ('a8000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
     'a3000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002',
     'PROMISE', 'SHARED', tstzrange('2026-10-24 10:30+07', '2026-10-24 11:30+07'), 'ACTIVE');
  RAISE NOTICE 'PASS T2d: SHARED reservations are not blocked by the constraint (application checks them under the vehicle row lock)';
END;
$$;

DO $$
DECLARE
  n integer;
BEGIN
  -- 承诺级预留转换为执行占用：更新同一行，不新增行
  UPDATE dispatch.capacity_reservation SET kind = 'EXECUTION', version = version + 1
   WHERE id = 'a8000000-0000-0000-0000-000000000004';
  SELECT count(*) INTO n FROM dispatch.capacity_reservation
   WHERE order_id = 'a5000000-0000-0000-0000-000000000002' AND status = 'ACTIVE' AND sharing = 'EXCLUSIVE';
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL T2e: expected 1 exclusive active reservation after conversion, got %', n;
  END IF;
  RAISE NOTICE 'PASS T2e: PROMISE converts to EXECUTION in place without double counting';
END;
$$;

DO $$
BEGIN
  UPDATE dispatch.capacity_reservation SET status = 'RELEASED', release_reason = 'SYNTHETIC_RELEASE'
   WHERE order_id = 'a5000000-0000-0000-0000-000000000001';
  INSERT INTO dispatch.capacity_reservation (id, company_id, vehicle_id, order_id, kind, sharing, during, status) VALUES
    ('a8000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
     'a3000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002',
     'PROMISE', 'EXCLUSIVE', tstzrange('2026-10-24 10:00+07', '2026-10-24 11:00+07'), 'ACTIVE');
  RAISE NOTICE 'PASS T2f: released reservations no longer block the vehicle';
END;
$$;

-- -----------------------------------------------------------------------------
-- T3 同一笔银行交易只能核销一次（AT-38）
-- -----------------------------------------------------------------------------
INSERT INTO finance.collection_record
  (id, company_id, order_id, charge_type, beneficiary, method, currency, due_minor, status) VALUES
  ('a9000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a5000000-0000-0000-0000-000000000001', 'FREIGHT', 'OPERATOR', 'KHQR', 'USD', 1250, 'due'),
  ('a9000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'a5000000-0000-0000-0000-000000000002', 'FREIGHT', 'OPERATOR', 'KHQR', 'USD', 900, 'due');

INSERT INTO finance.collection_verification
  (id, company_id, collection_id, channel, external_txn_id, verified_minor, currency, result, verified_by) VALUES
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a9000000-0000-0000-0000-000000000001', 'BANK', 'SYN-TXN-0001', 1250, 'USD', 'MATCHED',
   'a1000000-0000-0000-0000-000000000001');

DO $$
BEGIN
  BEGIN
    INSERT INTO finance.collection_verification
      (id, company_id, collection_id, channel, external_txn_id, verified_minor, currency, result, verified_by) VALUES
      ('aa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
       'a9000000-0000-0000-0000-000000000002', 'BANK', 'SYN-TXN-0001', 900, 'USD', 'MATCHED',
       'a1000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL T3a: the same bank transaction was verified against a second collection';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS T3a: the same bank transaction cannot be verified twice';
  END;
END;
$$;

DO $$
BEGIN
  INSERT INTO finance.collection_verification
    (id, company_id, collection_id, channel, external_txn_id, verified_minor, currency, result, verified_by) VALUES
    ('aa000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
     'a9000000-0000-0000-0000-000000000002', 'CASH_COUNT', NULL, 900, 'USD', 'MATCHED',
     'a1000000-0000-0000-0000-000000000001'),
    ('aa000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
     'a9000000-0000-0000-0000-000000000002', 'CASH_COUNT', NULL, 900, 'USD', 'MATCHED',
     'a1000000-0000-0000-0000-000000000001');
  RAISE NOTICE 'PASS T3b: cash counts without a transaction id are not blocked by the uniqueness rule';
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO finance.collection_verification
      (id, company_id, collection_id, channel, external_txn_id, verified_minor, currency, result, verified_by) VALUES
      ('aa000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
       'a9000000-0000-0000-0000-000000000002', 'BANK', NULL, 900, 'USD', 'MATCHED',
       'a1000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL T3c: a bank verification without a transaction id was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS T3c: bank or KHQR verification requires a transaction id';
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- T4 只追加与不可改写
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    UPDATE orders.service_promise SET customer_consent_ref = 'tampered'
     WHERE id = 'a6000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL T4a: a service promise was updated in place';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T4a: service promises are append-only';
  END;
END;
$$;

INSERT INTO audit.audit_event (id, occurred_at, company_id, principal_id, action, object_type, object_id) VALUES
  ('ab000000-0000-0000-0000-000000000001', '2026-10-24 09:00+07', 'a0000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001', 'order.submitted', 'DeliveryOrder', 'a5000000-0000-0000-0000-000000000001');

DO $$
BEGIN
  BEGIN
    DELETE FROM audit.audit_event WHERE id = 'ab000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL T4b: an audit event was deleted';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T4b: audit events cannot be deleted (partitioned table trigger)';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE finance.collection_record SET due_minor = 1
     WHERE id = 'a9000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL T4c: a collection amount was changed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T4c: collection amounts are immutable';
  END;
  UPDATE finance.collection_record
     SET status = 'reported', reported_minor = 1250, reported_at = now(),
         reported_by = 'a1000000-0000-0000-0000-000000000002', version = version + 1
   WHERE id = 'a9000000-0000-0000-0000-000000000001';
  RAISE NOTICE 'PASS T4d: status changes and the first report are still allowed';
END;
$$;

INSERT INTO custody.custody_transfer
  (id, company_id, order_id, from_party_type, from_party_ref, to_party_type, to_party_ref, occurred_at, status) VALUES
  ('ac000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a5000000-0000-0000-0000-000000000001', 'WAREHOUSE', 'SYN-WH-01', 'DRIVER',
   'a4000000-0000-0000-0000-000000000001', '2026-10-24 09:30+07', 'PROPOSED');

DO $$
BEGIN
  UPDATE custody.custody_transfer
     SET status = 'CONFIRMED',
         confirmed_by_from = 'a1000000-0000-0000-0000-000000000001',
         confirmed_by_to = 'a1000000-0000-0000-0000-000000000002'
   WHERE id = 'ac000000-0000-0000-0000-000000000001';
  BEGIN
    UPDATE custody.custody_transfer SET to_party_ref = 'someone-else'
     WHERE id = 'ac000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL T4e: a confirmed custody transfer was modified';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T4e: confirmed custody transfers are final';
  END;
END;
$$;

-- 恢复暂停须两种角色的批准（PRD 15.1）
INSERT INTO ops.pause_record (id, company_id, scope, capability, trigger_code, reason, paused_by) VALUES
  ('ad000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CAPABILITY',
   'DISPATCH_NEW_OFFERS', 'DUPLICATE_DISPATCH', 'synthetic test', 'a1000000-0000-0000-0000-000000000001');

DO $$
BEGIN
  BEGIN
    UPDATE ops.pause_record SET resumed_at = now() WHERE id = 'ad000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL T4f: a pause was resumed without approvals';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T4f: resume without approvals is rejected';
  END;
  INSERT INTO ops.pause_approval (id, company_id, pause_id, approver_id, approver_role) VALUES
    ('ae000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
     'ad000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'OPERATIONS_OWNER');
  BEGIN
    UPDATE ops.pause_record SET resumed_at = now() WHERE id = 'ad000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL T4g: a pause was resumed with a single approval';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T4g: resume with only the operations owner approval is rejected';
  END;
  INSERT INTO ops.pause_approval (id, company_id, pause_id, approver_id, approver_role) VALUES
    ('ae000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
     'ad000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 'INTEGRATION_OWNER');
  UPDATE ops.pause_record SET resumed_at = now() WHERE id = 'ad000000-0000-0000-0000-000000000001';
  RAISE NOTICE 'PASS T4h: resume succeeds with both approvals';
END;
$$;

-- -----------------------------------------------------------------------------
-- T6 跨企业引用与未知值（以所有者身份执行）
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    INSERT INTO orders.delivery_order (id, company_id, order_no, customer_id, service_level, status, created_by) VALUES
      ('a5000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000001', 'SYN-A-0099',
       'b2000000-0000-0000-0000-000000000001', 'S2', 'draft', 'a1000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL T6a: an order of company A referenced a customer of company B';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS T6a: composite foreign keys block cross-company references';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO orders.order_item (id, company_id, order_id, item_label, dims_source, weight_source, weight_kg) VALUES
      ('af000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
       'a5000000-0000-0000-0000-000000000001', 'ITEM-1', 'UNKNOWN', 'CUSTOMER_ESTIMATE', 20);
    RAISE EXCEPTION 'FAIL T6b: unknown dimensions were stored without a reason';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS T6b: unknown dimensions require an unknown reason';
  END;
  INSERT INTO orders.order_item
    (id, company_id, order_id, item_label, dims_source, dims_unknown_reason, weight_source, weight_kg) VALUES
    ('af000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
     'a5000000-0000-0000-0000-000000000001', 'ITEM-1', 'UNKNOWN', 'NOT_MEASURED_YET', 'CUSTOMER_ESTIMATE', 20);
  RAISE NOTICE 'PASS T6c: unknown dimensions with a reason are accepted (no zero placeholder)';
END;
$$;

-- -----------------------------------------------------------------------------
-- T5 行级安全（切换到非所有者角色）
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routefit_app') THEN
    CREATE ROLE routefit_app NOLOGIN;
  END IF;
END;
$$;
GRANT USAGE ON SCHEMA org, party, fleet, cargo, orders, dispatch, carrier, custody,
  finance, ops, reco, integration, audit TO routefit_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA org, party, fleet, cargo, orders,
  dispatch, carrier, custody, finance, ops, reco, integration TO routefit_app;
GRANT SELECT, INSERT ON audit.audit_event TO routefit_app;

SET ROLE routefit_app;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM orders.delivery_order;
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL T5a: without app.company_id the app role saw % orders', n;
  END IF;
  RAISE NOTICE 'PASS T5a: without a company scope the app role sees no rows';
END;
$$;

SET app.company_id = 'a0000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  n_own integer;
  n_other integer;
  n_upd integer;
BEGIN
  SELECT count(*) INTO n_own FROM orders.delivery_order;
  SELECT count(*) INTO n_other FROM orders.delivery_order
   WHERE company_id = 'b0000000-0000-0000-0000-000000000001';
  IF n_own <> 2 OR n_other <> 0 THEN
    RAISE EXCEPTION 'FAIL T5b: company A scope saw % own and % foreign orders', n_own, n_other;
  END IF;
  RAISE NOTICE 'PASS T5b: company A scope sees only its 2 orders';

  UPDATE orders.delivery_order SET notes = 'tampered'
   WHERE id = 'b5000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n_upd = ROW_COUNT;
  IF n_upd <> 0 THEN
    RAISE EXCEPTION 'FAIL T5c: company A scope updated a company B order';
  END IF;
  RAISE NOTICE 'PASS T5c: updates cannot reach another company''s rows';

  BEGIN
    INSERT INTO party.customer (id, company_id, name, status) VALUES
      ('b2000000-0000-0000-0000-000000000099', 'b0000000-0000-0000-0000-000000000001', 'Injected', 'ACTIVE');
    RAISE EXCEPTION 'FAIL T5d: company A scope inserted a row for company B';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T5d: inserts for another company violate the row-level security policy';
  END;

  BEGIN
    DELETE FROM orders.delivery_order WHERE id = 'a5000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'FAIL T5e: the app role deleted an order';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T5e: the app role has no DELETE privilege';
  END;
END;
$$;

RESET app.company_id;
RESET ROLE;

\echo 'ALL ROUTEFIT CONSTRAINT TESTS PASSED'
