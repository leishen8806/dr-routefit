import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationDirectory=new URL('../db/migrations/',import.meta.url);

async function migration(name){
 return readFile(new URL(name,migrationDirectory),'utf8');
}

test('Backend1 migration range defines the assigned pricing, order, merchant, and coupon storage',async()=>{
 const expected={
  '065_backend1_pricing_configuration.sql':['pricing.dimension_rule','pricing.vehicle_tariff','pricing.value_added_service','pricing.fx_rate'],
  '066_backend1_package_lines.sql':['orders.package_line','ALTER TABLE orders.draft'],
  '067_backend1_merchant_contracts.sql':['party.merchant_contract','party.sku_dimension','party.account_freeze'],
  '068_backend1_coupons.sql':['marketing.coupon_batch','marketing.coupon'],
  '069_backend1_rls_handoff.sql':['marketing.coupon_redemption','marketing.risk_flag','marketing.coupon_risk_signal']
 };
 for(const [name,fragments] of Object.entries(expected)){
  const sql=await migration(name);
  for(const fragment of fragments)assert.match(sql,new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 }
 const couponDefinition=await migration('068_backend1_coupons.sql');
 assert.doesNotMatch(couponDefinition,/marketing\.coupon_redemption|marketing\.risk_flag/);
});

test('Backend1 migrations keep contract transitions, freezes, and coupon writes append-only and idempotent',async()=>{
 const contracts=await migration('067_backend1_merchant_contracts.sql');
 const coupons=await migration('068_backend1_coupons.sql');
 const events=await migration('069_backend1_rls_handoff.sql');
 assert.match(contracts,/party\.merchant_contract_event/);
 assert.match(contracts,/version bigint NOT NULL CHECK\(version BETWEEN 1 AND 9000000000000\)/);
 assert.match(coupons,/idempotency_key text NOT NULL/);
 assert.match(coupons,/UNIQUE\(company_id,idempotency_key\)/);
 assert.match(events,/CREATE FUNCTION party\.prevent_backend1_history_mutation/);
 assert.match(events,/BEFORE UPDATE OR DELETE/);
});

test('Backend1 tables enforce the standard company RLS policy and routefit_api grants',async()=>{
 const tables={
  '065_backend1_pricing_configuration.sql':['pricing.dimension_rule','pricing.vehicle_tariff','pricing.value_added_service','pricing.fx_rate'],
  '066_backend1_package_lines.sql':['orders.package_line'],
  '067_backend1_merchant_contracts.sql':['party.merchant_contract','party.sku_dimension','party.merchant_contract_event','party.account_freeze'],
  '068_backend1_coupons.sql':['marketing.coupon_batch','marketing.coupon'],
  '069_backend1_rls_handoff.sql':['marketing.coupon_redemption','marketing.risk_flag','marketing.coupon_risk_signal']
 };
 for(const [name,names] of Object.entries(tables)){
 const sql=await migration(name);
  for(const table of names){
   const escaped=table.replace('.', '\\.')
   assert.match(sql,new RegExp(escaped));
  }
  assert.match(sql,/ALTER TABLE %s ENABLE ROW LEVEL SECURITY|ALTER TABLE [\w.]+ ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/ALTER TABLE %s FORCE ROW LEVEL SECURITY|ALTER TABLE [\w.]+ FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/CREATE POLICY company_scope ON (?:%s|[\w.]+)/);
  assert.match(sql,/USING\(company_id=NULLIF\(current_setting\('+app\.company_id'+,true\),'+\)::uuid\)/);
  assert.match(sql,/WITH CHECK\(company_id=NULLIF\(current_setting\('+app\.company_id'+,true\),'+\)::uuid\)/);
  assert.match(sql,/GRANT SELECT,INSERT(?:,UPDATE)? ON %s TO routefit_api|GRANT SELECT,INSERT(?:,UPDATE)? ON [\w.]+ TO routefit_api/);
 }
});
