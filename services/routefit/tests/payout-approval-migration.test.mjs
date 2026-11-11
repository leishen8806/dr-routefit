import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=new URL('../db/migrations/076_payout_approvals.sql',import.meta.url);

test('payout approval migration is transactional, company-scoped and separates approver from confirmer',async()=>{
 const sql=await readFile(migration,'utf8');
 assert.match(sql,/^BEGIN;/);
 assert.match(sql,/COMMIT;\s*$/);
 assert.match(sql,/CREATE TABLE finance\.payout_approval/);
 assert.match(sql,/CREATE TABLE finance\.payout_approval_event/);
 assert.match(sql,/money_amount_minor bigint NOT NULL/);
 assert.match(sql,/CHECK\(approved_by_person_id IS NULL OR confirmed_by_person_id IS NULL OR approved_by_person_id<>confirmed_by_person_id\)/);
 assert.match(sql,/CHECK\(approved_by_person_id IS NULL OR prepared_by_person_id<>approved_by_person_id\)/);
 assert.match(sql,/approved_by_person_id<>OLD\.approved_by_person_id/);
 assert.match(sql,/approved_by_principal_id<>OLD\.approved_by_principal_id/);
 assert.match(sql,/NEW\.confirmed_by_person_id<>OLD\.approved_by_person_id/);
 assert.match(sql,/Two-person payout control: confirmation may be by the preparer, but never by the approver\./);
 assert.match(sql,/NEW\.approved_by_person_id IS NULL OR NEW\.approved_by_principal_id IS NULL/);
 assert.match(sql,/Approved payout requires approver person and principal/);
 assert.match(sql,/TG_OP='INSERT'/);
 assert.match(sql,/NEW\.state<>'submitted'/);
 assert.match(sql,/ALTER TABLE finance\.payout_approval ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/ALTER TABLE finance\.payout_approval FORCE ROW LEVEL SECURITY/);
 assert.match(sql,/ALTER TABLE finance\.payout_approval_event ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/ALTER TABLE finance\.payout_approval_event FORCE ROW LEVEL SECURITY/);
 assert.match(sql,/CREATE POLICY company_scope ON finance\.payout_approval_event/);
 assert.match(sql,/INSERT INTO finance\.payout_approval_event/);
 assert.match(sql,/payout_approval_event_append_only/);
});
