import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL must point to a local disposable PostgreSQL cluster administrator');

test('Backend1 history is append-only and freeze versions are unique in PostgreSQL',async()=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 try{
  const companyId=fixture.principals[0].companyId;
  const principalId=fixture.principals[0].principalId;
  const merchantId=fixture.customers[0];
  const contractId=randomUUID();
  const eventId=randomUUID();
  const freezeId=randomUUID();
  await fixture.owner.query(`INSERT INTO party.merchant_contract
   (id,company_id,merchant_id,pricing_plan,cod_settlement_cycle,cod_fee_bps,monthly_credit_limit_minor,payout_account_ref,state,version)
   VALUES($1,$2,$3,'DEMO','WEEKLY',0,0,'DEMO','DRAFT',1)`,[contractId,companyId,merchantId]);
  await fixture.owner.query(`INSERT INTO party.merchant_contract_event(id,company_id,contract_id,version,state)
   VALUES($1,$2,$3,1,'DRAFT')`,[eventId,companyId,contractId]);
  await assert.rejects(
   fixture.owner.query('UPDATE party.merchant_contract_event SET state=\'ACTIVE\' WHERE company_id=$1 AND id=$2',[companyId,eventId]),
   error=>error.code==='P0001'
  );
  await fixture.owner.query(`INSERT INTO party.account_freeze(id,company_id,principal_id,action,reason,version)
   VALUES($1,$2,$3,'FREEZE','DEMO',1)`,[freezeId,companyId,principalId]);
  await assert.rejects(
   fixture.owner.query(`INSERT INTO party.account_freeze(id,company_id,principal_id,action,reason,version)
    VALUES($1,$2,$3,'UNFREEZE','DEMO',1)`,[randomUUID(),companyId,principalId]),
   error=>error.code==='23505'
  );
  await assert.rejects(
   fixture.owner.query('DELETE FROM party.account_freeze WHERE company_id=$1 AND id=$2',[companyId,freezeId]),
   error=>error.code==='P0001'
  );
 }finally{await fixture.cleanup();}
});

test('Backend1 tables force company RLS for routefit_api',async()=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 const client=new pg.Client({connectionString:fixture.runtimeUrl});
 const tables=['pricing.dimension_rule','pricing.vehicle_tariff','pricing.value_added_service','pricing.fx_rate','orders.package_line','party.merchant_contract','party.sku_dimension','party.merchant_contract_event','party.account_freeze','marketing.coupon_batch','marketing.coupon','marketing.coupon_redemption','marketing.risk_flag','marketing.coupon_risk_signal'];
 try{
  const companyA=fixture.principals[0].companyId;
  const companyB=fixture.principals[1].companyId;
  const catalog=await fixture.owner.query(`SELECT n.nspname||'.'||c.relname AS table_name,c.relrowsecurity,c.relforcerowsecurity,p.qual,p.with_check
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname AND p.policyname='company_scope'
   WHERE n.nspname||'.'||c.relname=ANY($1::text[])`,[tables]);
  assert.equal(catalog.rowCount,tables.length);
  for(const row of catalog.rows){
   assert.equal(row.relrowsecurity,true,row.table_name);
   assert.equal(row.relforcerowsecurity,true,row.table_name);
   assert.ok(row.qual,row.table_name);
   assert.ok(row.with_check,row.table_name);
  }
  const couponId=randomUUID();
  await fixture.owner.query(`INSERT INTO marketing.coupon_batch(id,company_id,kind,currency,amount_minor,minimum_spend_minor,budget_minor,idempotency_key,code,starts_at,ends_at,state,version)
   VALUES($1,$2,'AMOUNT_OFF','USD',100,0,1000,$3,'FOREIGN-DEMO','2026-11-10T00:00:00Z','2026-11-12T00:00:00Z','APPROVED',1)`,[randomUUID(),companyB,'foreign-batch']);
  await client.connect();
  await client.query('BEGIN');
  await client.query('SET ROLE routefit_api');
  await client.query("SELECT set_config('app.company_id',$1,true)",[companyA]);
  assert.equal((await client.query('SELECT id FROM marketing.coupon_batch WHERE company_id=$1',[companyB])).rowCount,0);
  await assert.rejects(client.query(`INSERT INTO marketing.coupon_batch(id,company_id,kind,currency,amount_minor,minimum_spend_minor,budget_minor,idempotency_key,code,starts_at,ends_at,state,version)
   VALUES($1,$2,'AMOUNT_OFF','USD',100,0,1000,$3,'BLOCKED-DEMO','2026-11-10T00:00:00Z','2026-11-12T00:00:00Z','DRAFT',1)`,[couponId,companyB,'blocked-cross-company']),error=>error.code==='42501');
  await client.query('ROLLBACK');
 }finally{await client.end().catch(()=>{});await fixture.cleanup();}
});
