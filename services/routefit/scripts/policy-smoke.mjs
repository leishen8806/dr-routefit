import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createBrowserGrant} from '../adapters/local-browser.mjs';
if(process.env.NODE_ENV==='production'||process.env.ROUTEFIT_AUTH_MODE!=='development')throw Error('Explicit local development mode required');
const origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||`http://127.0.0.1:${process.env.ROUTEFIT_PORT||4180}`,sessions=[];
async function request(session,path,body,version){
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:session.cookie,Origin:origin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await r.json();assert.ok(r.ok,`${r.status}: ${result.error?.code}`);return result;
}
const reversalMode=process.argv.includes('--reversal'),prepaymentMode=reversalMode||process.argv.includes('--prepayment');
try{
 for(const actor of (prepaymentMode?[0,2,3,4,5]:[0,2,3])){
  const grant=await createBrowserGrant({sessionsFile:process.env.ROUTEFIT_SESSION_FILE,actor,origin});
  const activated=await fetch(grant.url,{redirect:'manual'});assert.equal(activated.status,303,'Activation failed; use new bootstrap with three pricing identities');
  const session={cookie:activated.headers.get('set-cookie').split(';')[0]};sessions.push(session);Object.assign(session,await request(session,'/dev/session'));
 }
 assert.equal(new Set(sessions.map(s=>s.principalId)).size,sessions.length);assert.equal(new Set(sessions.map(s=>s.companyId)).size,1);
 const [author,reviewer,approver]=sessions,prefix='/api/ops/v1/pricing';
 let tariff=await request(author,prefix+'/tariffs',{name:'DEMO published policy',owner:'DR',currency:'USD',scope:'Synthetic fixed delivery only'});
 for(const code of ['base','insurance'])tariff=await request(author,`${prefix}/tariffs/${tariff.id}/actions/save-fee`,{code,enabled:true,method:'fixed',amount:code==='base'?200:75,unit:null,includedMilli:0,stepMilli:1000,share:code==='base',scope:'DEMO',evidence:'Synthetic agreed fee'},tariff.version);
 let policy=await request(author,`${prefix}/tariffs/${tariff.id}/policy-versions`,{validFrom:new Date().toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),quoteValiditySeconds:600,serviceLevels:['S2'],reason:'Synthetic policy submission'},tariff.version);
 const path=`${prefix}/policy-versions/${policy.id}`;
 policy=await request(reviewer,path+'/actions/review',{reason:'Synthetic independent check'},policy.version);
 policy=await request(approver,path+'/actions/publish',{reason:'Synthetic independent approval'},policy.version);
 assert.equal(policy.state,'PUBLISHED');assert.equal(policy.version,3);assert.equal(policy.tariff.rules.find(r=>r.code==='insurance').share,false);
 assert.deepEqual(await request(author,path),policy);
 if(process.argv.includes('--quotes')||prepaymentMode){
  const base='/api/ops/v1',draft=JSON.parse(await readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8')),input=JSON.parse(await readFile(new URL('../../../contracts/examples/order-intake.json',import.meta.url),'utf8'));
  draft.customerId=(await request(author,base+'/customers')).items[0].id;
  for(const side of ['pickup','delivery'])draft[side].point={lng:104.9,lat:11.5};
  for(const [i,k] of ['requestedPickupWindow','requestedDeliveryWindow'].entries())draft[k]={start:new Date(Date.now()+(i+1)*3600000).toISOString(),end:new Date(Date.now()+(i+2)*3600000).toISOString()};
  const area=await request(author,base+'/service-areas',{name:'DEMO quote smoke',type:'ALLOW',polygon:{type:'Polygon',coordinates:[[[104.8,11.4],[105,11.4],[105,11.6],[104.8,11.6],[104.8,11.4]]]},effectiveFrom:new Date().toISOString()});
  await request(author,base+'/service-areas/'+area.id+'/actions/publish',{reason:'DEMO only'},1);
  try{
   const order=await request(author,base+'/orders',draft),op=base+'/orders/'+order.order.id;
   await request(author,op+'/intake-evidence',input,1);await request(author,op+'/actions/submit',{},1);
   const quote=await request(author,op+'/quotes',{pricingPolicyVersionId:policy.id,insuranceRequested:true},2);
   assert.equal(quote.total.amountMinor,275);assert.equal(quote.calculation.shareMinor,200);assert.equal(quote.calculation.insuranceMinor,75);
   assert.equal((await request(author,base+'/quotes/'+quote.id)).state,'issued');
   assert.equal((await request(author,op)).order.state,'quoted');
   if(prepaymentMode){
    const [, , ,financeReview,financeApprove]=sessions,reason={reason:'DEMO financial evidence'};
    await request(author,base+'/quotes/'+quote.id+'/actions/record-customer-confirmation',{customerContact:'DEMO sender',method:'MESSAGE',reference:'DEMO acceptance',confirmedAt:new Date().toISOString()},1);
    const account=(await request(author,base+'/finance/receiving-accounts')).items.find(a=>a.currency==='USD');
    const receipt=await request(author,op+'/prepayment-receipts',{receivingAccountId:account.id,bankReference:'DEMO-'+randomUUID(),reference:'DEMO bank evidence',observedAt:new Date().toISOString(),money:{amountMinor:300,currency:'USD'}},3);
    await request(financeReview,base+'/prepayment-receipts/'+receipt.id+'/actions/verify',{approve:true,...reason},1);
    const allocation=await request(author,op+'/prepayment-allocations',{receiptId:receipt.id,lines:quote.fees.map(f=>({feeId:f.id,amountMinor:f.money.amountMinor})),...reason},3),ap=base+'/prepayment-allocations/'+allocation.id;
    await request(financeReview,ap+'/actions/review',{approve:true,...reason},1);await request(financeApprove,ap+'/actions/approve',{approve:true,...reason},2);
    assert.equal((await request(author,op+'/payment-admission')).paymentSatisfied,false);
    await request(financeApprove,ap+'/actions/post',reason,3);
    const gate=await request(author,op+'/payment-admission');assert.deepEqual([gate.requiredMinor,gate.confirmedMinor,gate.allocatedMinor,gate.unallocatedMinor,gate.remainingMinor,gate.paymentSatisfied,gate.dispatchAllowed],[275,300,275,25,0,true,false]);
    assert.equal((await request(author,op)).order.collectionState,'allocated');
    if(reversalMode){
     const correction=await request(author,ap+'/reversals',{...reason,reference:'DEMO wrong allocation'},4),rp=base+'/allocation-reversals/'+correction.id;
     assert.equal((await request(author,op+'/payment-admission')).paymentSatisfied,false);
     await request(financeReview,rp+'/actions/review',{approve:true,...reason},1);await request(financeApprove,rp+'/actions/approve',{approve:true,...reason},2);
     assert.equal((await request(author,op+'/payment-admission')).allocatedMinor,275);await request(financeApprove,rp+'/actions/post',reason,3);
     assert.equal((await request(author,ap)).state,'REVERSED');assert.equal((await request(author,rp)).state,'POSTED');
     const restored=await request(author,op+'/payment-admission');assert.deepEqual([restored.confirmedMinor,restored.allocatedMinor,restored.unallocatedMinor,restored.remainingMinor,restored.paymentSatisfied],[300,0,300,275,false]);
     const corrected=await request(author,op+'/prepayment-allocations',{receiptId:receipt.id,lines:quote.fees.map(f=>({feeId:f.id,amountMinor:f.money.amountMinor})),...reason},3),np=base+'/prepayment-allocations/'+corrected.id;
     await request(financeReview,np+'/actions/review',{approve:true,...reason},1);await request(financeApprove,np+'/actions/approve',{approve:true,...reason},2);await request(financeApprove,np+'/actions/post',reason,3);
     assert.equal((await request(author,op+'/payment-admission')).allocatedMinor,275);
     console.log('Reversal smoke passed: independent correction approval, restored fee balances, original bank facts preserved, new allocation posted; no refund or order edit.');
    }
    console.log('Prepayment smoke passed: 5 distinct local identities; confirmed quote; manual bank evidence; independent verification, review, approval and posting; insurance separate; excess 25 unallocated; no dispatch. Cleanup retires test area, so subsequent admission blocks on coverage.');
   }else{
   await request(author,op+'/actions/return-to-draft',{reason:'DEMO rework'},3);
   assert.equal((await request(author,base+'/quotes/'+quote.id)).state,'superseded');
   console.log('Order quote smoke passed: reviewed policy, intake, 275 cents quote, insurance excluded, read, return invalidation. No customer confirmation or payment.');
   }
  }finally{await request(author,base+'/service-areas/'+area.id+'/actions/retire',{reason:'DEMO cleanup'},2);}
 }else{
 console.log('4 policy operations passed with 3 distinct local identities; frozen fees and independent approval verified. No quote, order state or payment changed.');
 }
}finally{
 for(const session of sessions)await fetch(origin+'/dev/session/logout',{method:'POST',headers:{Cookie:session.cookie,Origin:origin,'X-CSRF-Token':session.csrfToken||''}}).catch(()=>{});
}
