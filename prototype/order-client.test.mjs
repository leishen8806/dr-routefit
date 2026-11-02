import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderClient} from './order-client.mjs';
const reply=(status,value,headers=null)=>({ok:status<400,status,json:async()=>value,headers});
const identity={companyId:'A',principalId:'person-1',csrfToken:'synthetic-csrf'};
test('lost response retries exactly the same frozen write, never creates a new key',async()=>{
 const writes=[];let lose=true;
 const client=createOrderClient({uuid:()=> 'synthetic-idempotency-key',fetchImpl:async(path,options)=>{
  if(path==='/dev/session')return reply(200,identity);writes.push({path,...options});
  if(lose){lose=false;throw Error('response lost after server commit');}return reply(200,{order:{version:2}});
 }});
 await client.connect();const draft={notes:'original'};
 await assert.rejects(client.save(draft,{id:'order-1',version:1}),{code:'RESULT_UNKNOWN'});draft.notes='changed locally';
 assert.equal(client.pending,true);await assert.rejects(client.save(draft),{code:'UNRESOLVED_REQUEST'});
 await client.retry();assert.equal(client.pending,false);assert.equal(writes.length,2);
 for(const k of ['path','method','body'])assert.equal(writes[0][k],writes[1][k]);
 assert.deepEqual(writes[0].headers,writes[1].headers);assert.equal(writes[1].body,'{"notes":"original"}');assert.equal(writes[1].headers['If-Match'],'"1"');
});
test('expired session retains request and renews CSRF only for the same identity',async()=>{
 let expired=true,session=identity;const writes=[];
 const client=createOrderClient({fetchImpl:async(path,options)=>{if(path==='/dev/session')return reply(200,session);writes.push(options);return expired?reply(401,{error:{code:'UNAUTHENTICATED'}}):reply(201,{order:{version:1}});}});
 await client.connect();await assert.rejects(client.save({notes:'held'}),{status:401});assert.equal(client.pending,true);
 expired=false;session={...identity,csrfToken:'renewed'};await client.connect();await client.retry();
 assert.equal(writes[0].headers['Idempotency-Key'],writes[1].headers['Idempotency-Key']);assert.equal(writes[1].headers['X-CSRF-Token'],'renewed');
});
test('identity change clears the pending write; it cannot be replayed by another account',async()=>{
 let session=identity;
 const client=createOrderClient({fetchImpl:async path=>path==='/dev/session'?reply(200,session):Promise.reject(Error('offline'))});
 await client.connect();await assert.rejects(client.save({notes:'private'}));session={...identity,principalId:'person-2'};
 await assert.rejects(client.connect(),{code:'IDENTITY_CHANGED'});assert.equal(client.pending,false);assert.throws(()=>client.retry(),{code:'NO_PENDING_REQUEST'});
});
test('version conflict is explicit and clears pending without retry or overwrite',async()=>{
 let writes=0;
 const client=createOrderClient({fetchImpl:async path=>path==='/dev/session'?reply(200,identity):(writes++,reply(412,{error:{code:'VERSION_MISMATCH'}}))});
 await client.connect();await assert.rejects(client.save({notes:'mine'},{id:'1',version:1}),{status:412});assert.equal(client.pending,false);assert.equal(writes,1);
});
test('idempotency replay is exposed to the page without changing the response body',async()=>{
 const client=createOrderClient({fetchImpl:async path=>path==='/dev/session'?reply(200,identity):reply(200,{id:'quote-1',version:1},{get:name=>name==='Idempotency-Replayed'?'true':null})});
 await client.connect();const result=await client.command('/api/ops/v1/orders/order-1/quotes',{},1);
 assert.equal(result.replayed,true);assert.deepEqual(Object.keys(result),['id','version']);
});
