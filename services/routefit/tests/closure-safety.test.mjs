import assert from 'node:assert/strict';
import test from 'node:test';
import {ledgerItemOutstanding} from '../adapters/finance.mjs';
import {paymentIntentMoney,paymentIntentQuery} from '../adapters/payment-intents.mjs';
import {matchesChannelBankTransaction} from '../adapters/channel-settlements.mjs';
import {replayWorkflow,resultReferenceMatches,workflowTransitionAllowed,writeWorkflowDocument} from '../adapters/finance-workflow.mjs';
import {rescuePackagesAllowed} from '../adapters/rescue.mjs';
import {sealAccountChange} from '../adapters/account-change.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'};
const itemId='33333333-3333-4333-8333-333333333333';

test('payment intent uses current ledger outstanding and a signed cursor',async()=>{
 const client={query:async sql=>{
  assert.match(sql,/finance\.prepayment_allocation/);
  return {rows:[{total:'700'}]};
 }};
 const item=await ledgerItemOutstanding(client,principal,{quote_id:itemId,fee_id:itemId,snapshot:{originalMinor:1200,currency:'USD'}});
 assert.deepEqual(paymentIntentMoney([item]),{amountMinor:500n,currency:'USD'});
 const page=paymentIntentQuery(new URL('http://localhost/payment-intents?limit=2'),principal),cursor=page.cursor(itemId);
 assert.equal(paymentIntentQuery(new URL('http://localhost/payment-intents?limit=2&cursor='+encodeURIComponent(cursor)),principal).after,itemId);
 assert.throws(()=>paymentIntentQuery(new URL('http://localhost/payment-intents?cursor='+itemId),principal),{code:'INVALID_CURSOR'});
});

test('channel settlement accepts only the immutable inbound bank amount',()=>{
 const reference={id:itemId,version:1};
 assert.equal(matchesChannelBankTransaction({direction:'IN',currency:'USD',amount_minor:'950'},reference,'USD',950),true);
 assert.equal(matchesChannelBankTransaction({direction:'OUT',currency:'USD',amount_minor:'950'},reference,'USD',950),false);
 assert.equal(matchesChannelBankTransaction({direction:'IN',currency:'USD',amount_minor:'950'},{...reference,version:2},'USD',950),false);
});

test('workflow revisions keep old approval hashes and reset channel execution path',()=>{
 const row={maker_person_id:'maker',created_at:new Date('2026-10-01T00:00:00Z'),snapshot:{reason:'original',details:{kind:'PAYMENT',money:{amountMinor:10,currency:'USD'},reason:'original'}}};
 const events=[
  {action:'SUBMITTED',person_id:'maker',version:2,created_at:new Date('2026-10-01T01:00:00Z'),snapshot:{reason:'submit'}},
  {action:'REJECTED',person_id:'reviewer',version:3,created_at:new Date('2026-10-01T02:00:00Z'),snapshot:{reason:'reject'}},
  {action:'REVISED',person_id:'maker',version:4,created_at:new Date('2026-10-01T03:00:00Z'),snapshot:{reason:'revised',details:{kind:'PAYMENT',money:{amountMinor:20,currency:'USD'},reason:'revised'}}},
  {action:'SUBMITTED',person_id:'maker',version:5,created_at:new Date('2026-10-01T04:00:00Z'),snapshot:{reason:'resubmit'}}
 ];
 const replay=replayWorkflow(row,events);
 assert.notEqual(replay.history[1].contentHash,replay.history[3].contentHash);
 assert.equal(replay.history[3].contentHash,replay.history[4].contentHash);
 assert.equal(replay.details.money.amountMinor,20);
 assert.equal(workflowTransitionAllowed('approved','CHANNEL_SETTLEMENT','POSTED'),true);
 assert.equal(workflowTransitionAllowed('approved','ACCOUNT_CHANGE','POSTED'),true);
 assert.equal(workflowTransitionAllowed('confirmed','ACCOUNT_CHANGE','POSTED'),false);
 assert.equal(workflowTransitionAllowed('approved','ACCOUNT_CHANGE','EXECUTION_RECORDED'),false);
 assert.equal(workflowTransitionAllowed('approved','CHANNEL_SETTLEMENT','EXECUTION_RECORDED'),false);
 assert.equal(resultReferenceMatches([{role:'EXECUTOR',comment:'BANK-001'}],'BANK-001'),true);
 assert.equal(resultReferenceMatches([{role:'EXECUTOR',comment:'BANK-001'}],'BANK-002'),false);
});

test('rescue plans cannot move a package outside the accident scope',()=>{
 const all=new Set(['a','b','c']),affected=new Set(['a','b']);
 assert.equal(rescuePackagesAllowed(all,affected,['a','b']),true);
 assert.equal(rescuePackagesAllowed(all,affected,['c']),false);
 assert.equal(rescuePackagesAllowed(all,affected,['a','a']),false);
});

test('account changes encrypt account values and only expose a masked review projection',()=>{
 const input={subjectId:itemId,currentAccountVersion:1,currency:'USD',bankCode:'ABA',holderName:'Test Holder',accountNumber:'1234-5678',reason:'replace compromised account',evidenceFileIds:[itemId]};
 const sealed=sealAccountChange(input,'11'.repeat(32));
 assert.equal(sealed.details.holderDisplayName,'***');
 assert.equal(sealed.details.last4,'5678');
 assert.equal('holderName' in sealed.details,false);
 assert.equal('accountNumber' in sealed.details,false);
 assert.match(sealed.details.secretFingerprint,/^[a-f0-9]{64}$/);
 assert.equal(sealed.sealed.ciphertext.includes(Buffer.from(input.accountNumber)),false);
 assert.throws(()=>sealAccountChange(input),{code:'ACCOUNT_SECRET_KEY_REQUIRED'});
 assert.throws(()=>sealAccountChange({...input,accountNumber:'123'},'11'.repeat(32)),{code:'ACCOUNT_NUMBER_INVALID'});
});

test('approved account change creates only the next masked account version',async()=>{
 const documentId='44444444-4444-4444-8444-444444444444',subjectId='55555555-5555-4555-8555-555555555555',details={kind:'ACCOUNT_CHANGE',subjectId,currentAccountVersion:0,currency:'USD',bankCode:'ABA',holderDisplayName:'***',last4:'5678',secretFingerprint:'a'.repeat(64),reason:'replace account',evidenceFileIds:[itemId]},row={id:documentId,kind:'ACCOUNT_CHANGE',maker_person_id:'maker',created_at:new Date('2026-10-01T00:00:00Z'),snapshot:{reason:details.reason,details}},history=[
  {action:'SUBMITTED',person_id:'maker',version:2,created_at:new Date('2026-10-01T00:01:00Z'),snapshot:{reason:'submitted'}},
  {action:'REVIEWED',person_id:'reviewer',version:3,created_at:new Date('2026-10-01T00:02:00Z'),snapshot:{reason:'reviewed'}},
  {action:'APPROVED',person_id:'approver',version:4,created_at:new Date('2026-10-01T00:03:00Z'),snapshot:{reason:'approved'}}
 ],calls=[];let posted=false;
 const client={query:async(sql,params=[])=>{
  calls.push([sql,params]);
  if(sql.startsWith('SELECT * FROM finance.workflow_document WHERE'))return {rows:[row]};
  if(sql.startsWith('SELECT * FROM finance.workflow_document_event WHERE'))return {rows:posted?[...history,{action:'POSTED',person_id:'approver',version:5,created_at:new Date('2026-10-01T00:04:00Z'),snapshot:{reason:'posted'}}]:history};
  if(sql.startsWith('SELECT person_id FROM org.principal'))return {rows:[{person_id:'approver'}]};
  if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[{}]};
  if(sql.startsWith('SELECT version FROM finance.settlement_account'))return {rows:[]};
  if(sql.startsWith('INSERT INTO finance.settlement_account'))return {rows:[]};
  if(sql.startsWith('INSERT INTO finance.workflow_document_event')){posted=true;return {rows:[]};}
  throw Error('unexpected query '+sql);
 }};
 const result=await writeWorkflowDocument(client,principal,'post',documentId,{reason:'posted'},4);
 assert.equal(result.state,'posted');
 assert.equal(result.details.last4,'5678');
 const account=calls.find(([sql])=>sql.startsWith('INSERT INTO finance.settlement_account'));
 assert.equal(account[1][3],1);
 assert.equal(account[1][8].holderDisplayName,'***');
 assert.equal(JSON.stringify(account[1][8]).includes('1234-5678'),false);
});
