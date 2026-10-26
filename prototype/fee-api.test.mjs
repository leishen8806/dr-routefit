import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decimal,display,feeDTO,trialDTO,formatTrialInput} from './fee-api-model.mjs';
test('exact decimal conversion and formatting preserve cents, milliunits and basis points',()=>{
 assert.equal(decimal('2.00',2),200);assert.equal(decimal('1.001',3),1001);assert.equal(decimal('1.25',2),125);assert.equal(display(125,2),'1.25');assert.equal(decimal('90000000000.00',2),9000000000000);
 for(const v of ['', '1e2','-1','NaN','Infinity','2.001','90000000000.01']) assert.throws(()=>decimal(v,2));
 assert.throws(()=>decimal('1.1',0));assert.throws(()=>decimal('100.01',2,10000));
});
const form={code:'insurance',enabled:true,method:'percent',amount:'1.25',share:true,scope:'DEMO',evidence:'合成'};
test('locked insurance and purchase fee exclude sharing and reject missing/invalid rule inputs',()=>{
 const rule=feeDTO(form,{code:'insurance',basis:'goods',locked:true,units:[]},'DR','USD');assert.equal(rule.amount,125);assert.equal(rule.share,false);
 assert.equal(feeDTO({...form,code:'base',method:'fixed',amount:'2.00'},{code:'base',units:['kg']},'VET','USD').share,false);
 assert.throws(()=>feeDTO({...form,scope:''},{code:'insurance',basis:'goods'},'DR','USD'));
 assert.throws(()=>feeDTO({...form,method:'unit',unit:'kg',included:'0',step:'0'},{code:'insurance',units:[]},'DR','USD'));
});
test('trial selection is explicit, rejects duplicate/disabled/unconfigured fees and missing bases',()=>{
 const rules=[{code:'base',enabled:true,method:'fixed'},{code:'insurance',enabled:true,method:'percent'}];
 assert.deepEqual(trialDTO(rules,[{code:'base'},{code:'insurance',value:'100.00'}],'USD'),{lines:[{code:'base',quantityMilli:null,basisMinor:null},{code:'insurance',quantityMilli:null,basisMinor:10000}]});
 for(const inputs of [[],[{code:'base'},{code:'base'}],[{code:'weight'}],[{code:'insurance',value:''}]])assert.throws(()=>trialDTO(rules,inputs,'USD'));
});
test('trial input display is readable for fixed, unit and percentage fees',()=>{
 assert.equal(formatTrialInput({input:{quantityMilli:null,basisMinor:null},rule:{method:'fixed'}},'USD'),'—');
 assert.equal(formatTrialInput({input:{quantityMilli:1000,basisMinor:null},rule:{method:'unit',unit:'kg'}},'USD'),'1.000 kg');
 assert.equal(formatTrialInput({input:{quantityMilli:null,basisMinor:10000},rule:{method:'percent',basis:'goods'}},'USD'),'100.00 USD 货值');
});

const {FeeClient}=await import('./fee-api-client.mjs');
const session={companyId:'A',principalId:'one',csrfToken:'test-only',permissions:['pricing:read','pricing:write']};
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
test('lost save retains immutable request, blocks duplicate and replays original key/body/version',async()=>{
 const writes=[];let fail=true;
 const c=new FeeClient(async(path,init)=>{if(path==='/dev/session')return response(session);writes.push(init);if(fail){fail=false;throw Error('lost');}return response({id:'x',version:2},200,{'Idempotency-Replayed':'true','ETag':'"2"'});});
 await c.connect();const body={amount:200};await assert.rejects(c.mutate('/tariffs/x/actions/save-fee',body,'"1"'));body.amount=999;
 await assert.rejects(c.mutate('/tariffs/x/actions/save-fee',body,'"1"'));const result=await c.retry();assert.equal(result.replayed,true);assert.equal(c.pending,null);
 assert.equal(writes[0].body,writes[1].body);assert.equal(JSON.parse(writes[1].body).amount,200);assert.deepEqual(writes[0].headers,writes[1].headers);
});
test('identity change refuses old mutation and clears private session context',async()=>{
 let who=session;let writes=0;const c=new FeeClient(async path=>path==='/dev/session'?response(who):(writes++,Promise.reject(Error('lost'))));
 await c.connect();await assert.rejects(c.mutate('/tariffs',{},null));who={...session,principalId:'two'};await assert.rejects(c.retry(),e=>e.code==='IDENTITY_CHANGED');assert.equal(writes,1);assert.equal(c.pending,null);
});
test('412 is definitive; malformed success and 5xx remain unknown, not saved',async()=>{
 let status=412;const c=new FeeClient(async path=>path==='/dev/session'?response(session):status===200?new Response('<html>',{status:200}):response({error:{code:status===412?'VERSION_CONFLICT':'UNKNOWN',fields:[]}},status));await c.connect();
 await assert.rejects(c.mutate('/tariffs/x',{},'"1"'),e=>e.status===412);assert.equal(c.pending,null);
 status=200;await assert.rejects(c.mutate('/tariffs/x',{},'"1"'));assert.ok(c.pending);status=503;await assert.rejects(c.retry());assert.ok(c.pending);
});
test('invalid fee amount identifies field for error summary while retaining input',()=>{
 assert.throws(()=>feeDTO({...form,amount:'1.251'},{code:'insurance',basis:'goods',locked:true},'DR','USD'),e=>e.status===422&&e.fields[0].path==='/amount');
});
const {snapshotChanged}=await import('./fee-api-model.mjs');
test('persisted snapshot flags later changes only for its own tariff',()=>{
 const snapshot={tariffId:'a',tariffVersion:3};assert.equal(snapshotChanged({id:'a',version:3},snapshot),false);assert.equal(snapshotChanged({id:'a',version:4},snapshot),true);assert.equal(snapshotChanged({id:'b',version:4},snapshot),false);assert.equal(snapshotChanged(null,snapshot),false);
});
