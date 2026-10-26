import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {token,csrf,origin}=JSON.parse(await readFile(new URL('../.local/client.json',import.meta.url),'utf8'));
async function request(path,body,version){
 const r=await fetch(origin+'/api/ops/v1'+path,{method:body?'POST':'GET',headers:{Cookie:'rf_session='+token,Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();assert.ok(r.ok,`${r.status}: ${data.error?.code}`);return data;
}
const draft=JSON.parse(await readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8'));
draft.customerId=(await request('/customers')).items[0].id;
for(const side of ['pickup','delivery'])draft[side].point={lng:104.9,lat:11.5};
for(const [i,k] of ['requestedPickupWindow','requestedDeliveryWindow'].entries())draft[k]={start:new Date(Date.now()+(i+1)*3600000).toISOString(),end:new Date(Date.now()+(i+2)*3600000).toISOString()};
const reason={reason:'DEMO smoke only; not a real service boundary'},area=await request('/service-areas',{name:'DEMO intake smoke',type:'ALLOW',polygon:{type:'Polygon',coordinates:[[[104.8,11.4],[105,11.4],[105,11.6],[104.8,11.6],[104.8,11.4]]]},effectiveFrom:new Date().toISOString()});
await request('/service-areas/'+area.id+'/actions/publish',reason,1);
try{
 const order=await request('/orders',draft),path='/orders/'+order.order.id,input=JSON.parse(await readFile(new URL('../../../contracts/examples/order-intake.json',import.meta.url),'utf8'));
 assert.equal((await request(path+'/intake-check')).ready,false);
 await request(path+'/intake-evidence',input,1);
 const check=await request(path+'/intake-check');assert.equal(check.ready,true);assert.equal(check.automationEligible,false);assert.deepEqual(check.evidence.sourceSnapshot,draft);
 const submitted=await request(path+'/actions/submit',{},1);assert.equal(submitted.order.state,'validating');assert.equal(submitted.quoteId,null);assert.equal(submitted.order.collectionState,'unpaid');
 assert.equal((await request(path+'/actions/return-to-draft',reason,2)).order.version,3);assert.equal((await request(path+'/intake-check')).ready,false);
 console.log('8 intake/coverage operations passed: versioned manual evidence, blocked then accepted, return requires new evidence, synthetic area retired. No quote, promise, payment or dispatch.');
}finally{await request('/service-areas/'+area.id+'/actions/retire',reason,2);}
