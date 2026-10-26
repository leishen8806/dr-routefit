import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeDriverEvidence} from '../adapters/driver.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'},orderId='33333333-3333-4333-8333-333333333333';
test('driver evidence is limited to the driver current order',async()=>{
 const client={query:async(sql,params)=>{
  if(sql.startsWith('SELECT kind,person_id FROM org.principal'))return {rows:[{kind:'DRIVER',person_id:'44444444-4444-4444-8444-444444444444'}]};
  if(sql.startsWith('SELECT 1 FROM dispatch.assignment')){assert.deepEqual(params,[principal.companyId,principal.principalId,orderId]);return {rowCount:1,rows:[{}]};}
  throw Error('Unexpected query');
 }};
 await authorizeDriverEvidence(client,principal,'ORDER',orderId);
 await assert.rejects(authorizeDriverEvidence(client,principal,'CASE',orderId),{code:'EVIDENCE_RESOURCE_UNSUPPORTED'});
});
test('driver evidence hides unassigned orders',async()=>{
 const client={query:async sql=>sql.startsWith('SELECT kind,person_id FROM org.principal')?{rows:[{kind:'DRIVER',person_id:'44444444-4444-4444-8444-444444444444'}]}:{rowCount:0,rows:[]}};
 await assert.rejects(authorizeDriverEvidence(client,principal,'ORDER',orderId),{code:'NOT_FOUND'});
});
