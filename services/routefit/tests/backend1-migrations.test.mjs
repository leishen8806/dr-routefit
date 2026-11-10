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
  '068_backend1_coupons.sql':['marketing.coupon_batch','marketing.coupon','marketing.coupon_redemption','marketing.risk_flag'],
  '069_backend1_rls_handoff.sql':['Backend1 RLS handoff']
 };
 for(const [name,fragments] of Object.entries(expected)){
  const sql=await migration(name);
  for(const fragment of fragments)assert.match(sql,new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 }
});
