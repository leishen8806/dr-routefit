import test from 'node:test';
import assert from 'node:assert/strict';
import {externalSubjectQuery,readExternalSubject,requestExternalSettlement} from '../adapters/external-subjects.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'},subjectId='33333333-3333-4333-8333-333333333333';
test('external portals reject an unbound principal before exposing a subject ledger',async()=>{
 const client={query:async sql=>{assert.match(sql,/org\.external_subject_access/);return {rows:[]};}};
 await assert.rejects(readExternalSubject(client,principal,'merchant','ledger',{limit:1,after:null,cursor:()=>null}),{code:'NOT_FOUND'});
});
test('external settlement requests cannot use a ledger outside the portal subject scope',async()=>{
 const calls=[];const client={query:async(sql,params=[])=>{calls.push({sql,params});if(sql.includes('org.external_subject_access'))return {rows:[{subject_id:subjectId}]};if(sql.startsWith('WITH source AS'))return {rows:[]};throw Error('unexpected query');}};
 await assert.rejects(requestExternalSettlement(client,principal,'merchant',{kind:'PAYMENT',ledgerItemId:'44444444-4444-4444-8444-444444444444',ledgerItemVersion:1,money:{amountMinor:1,currency:'USD'},accountId:'55555555-5555-4555-8555-555555555555',accountVersion:1,reason:'COD return'}),{code:'NOT_FOUND'});
 const lookup=calls.find(x=>x.sql.startsWith('WITH source AS'));assert.deepEqual(lookup.params.slice(0,3),[principal.companyId,subjectId,'COD']);
});
test('external portal cursors bind the caller and reject tampering',()=>{
 const query=externalSubjectQuery(new URL('https://local.test/api/merchant/v1/ledger-items?limit=5'),principal,'merchant-ledger'),cursor=query.cursor(subjectId);
 assert.equal(externalSubjectQuery(new URL('https://local.test/api/merchant/v1/ledger-items?limit=5&cursor='+encodeURIComponent(cursor)),principal,'merchant-ledger').after,subjectId);
 assert.throws(()=>externalSubjectQuery(new URL('https://local.test/api/merchant/v1/ledger-items?limit=5&cursor='+encodeURIComponent(cursor+'x')),principal,'merchant-ledger'),{code:'INVALID_CURSOR'});
});
