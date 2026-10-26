import assert from 'node:assert/strict';
import test from 'node:test';
import {assertRuntimeRole} from '../adapters/postgres.mjs';

test('runtime readiness blocks startup when driver withdrawal migration is absent',async()=>{
 const pool={query:async sql=>{
  if(sql.startsWith('SELECT rolsuper'))return {rows:[{rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolreplication:false}]};
  if(sql.includes("to_regclass('pricing.tariff')"))return {rows:[{ready:true}]};
  if(sql.includes("to_regclass('mobile.location_event')"))return {rows:[{ready:true}]};
  if(sql.includes("to_regclass('delivery.record')"))return {rows:[{ready:true}]};
  if(sql.includes("to_regclass('dispatch.return_task')")){assert.match(sql,/to_regclass\('finance\.driver_withdrawal_request'\)/);assert.match(sql,/to_regclass\('finance\.task_hold_event'\)/);assert.match(sql,/to_regclass\('integration\.service_binding'\)/);assert.match(sql,/to_regclass\('integration\.external_intake'\)/);assert.match(sql,/to_regclass\('integration\.wms_stock_event'\)/);assert.match(sql,/to_regclass\('org\.external_subject_access'\)/);assert.match(sql,/to_regclass\('finance\.external_settlement_request'\)/);assert.match(sql,/to_regclass\('finance\.export_job'\)/);assert.match(sql,/to_regclass\('finance\.workflow_document'\)/);assert.match(sql,/to_regclass\('finance\.workflow_account_change_secret'\)/);assert.match(sql,/to_regclass\('finance\.settlement_account_subject_version_unique'\)/);assert.match(sql,/to_regclass\('finance\.channel_settlement'\)/);assert.match(sql,/to_regclass\('dispatch\.rescue_plan'\)/);return {rows:[{ready:false}]};}
  throw Error('unexpected runtime readiness query');
 }};
 await assert.rejects(assertRuntimeRole(pool),{code:'MIGRATION_REQUIRED'});
});
