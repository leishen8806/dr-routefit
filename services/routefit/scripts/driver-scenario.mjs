import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {chmod,mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBrowserGrant} from '../adapters/local-browser.mjs';
import {createDriverRouteFixture} from '../db/driver-scenario-fixture.mjs';

const stages=new Set(['offered','custody-pending','ready-to-depart']);
const localHosts=new Set(['127.0.0.1','localhost','[::1]']);

function localUrl(value,label){const url=new URL(value);if(!localHosts.has(url.hostname))throw Error(`${label} must be local`);return url;}
function actorWith(sessions,...permissions){const actor=sessions.findIndex(session=>permissions.every(permission=>session.permissions?.includes(permission)));if(actor<0)throw Error(`Missing development identity for ${permissions.join(',')}`);return actor;}

async function activate({origin,sessionsFile,actor}){
 const grant=await createBrowserGrant({sessionsFile,actor,origin}),response=await fetch(grant.url,{redirect:'manual'});
 assert.equal(response.status,303,'Development activation failed');
 const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'Development session cookie missing');
 const sessionResponse=await fetch(origin+'/dev/session',{headers:{Cookie:cookie}}),session=await sessionResponse.json();assert.ok(sessionResponse.ok,'Development session lookup failed');
 return {cookie,token:cookie.slice(cookie.indexOf('=')+1),csrfToken:session.csrfToken,companyId:session.companyId,principalId:session.principalId};
}

async function request(origin,session,path,{body,version,method=body?'POST':'GET'}={}){
 const response=await fetch(origin+(path.startsWith('/api/')?path:'/api/ops/v1'+path),{method,headers:{Cookie:session.cookie,Origin:origin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();if(!response.ok)throw Error(`${response.status}: ${result.error?.code||'REQUEST_FAILED'}`);return result;
}

async function logout(origin,session){await fetch(origin+'/dev/session/logout',{method:'POST',headers:{Cookie:session.cookie,Origin:origin,'X-CSRF-Token':session.csrfToken}}).catch(()=>{});}

export async function createDriverScenario({
 stage='custody-pending',
 origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||`http://127.0.0.1:${process.env.ROUTEFIT_PORT||4180}`,
 databaseUrl=process.env.ROUTEFIT_DATABASE_URL,
 fixtureUrl=process.env.ROUTEFIT_PG_FIXTURE_URL,
 sessionsFile=process.env.ROUTEFIT_SESSION_FILE,
 scenarioFile=fileURLToPath(new URL('../.local/driver-scenario.json',import.meta.url)),
}={}){
 if(!stages.has(stage))throw Error('stage must be offered, custody-pending, or ready-to-depart');
 localUrl(origin,'Driver scenario service');localUrl(databaseUrl,'Driver scenario database');localUrl(fixtureUrl,'Driver scenario fixture database');
 if(process.env.NODE_ENV==='production'||process.env.ROUTEFIT_AUTH_MODE!=='development')throw Error('Explicit local development mode required');
 const sessions=JSON.parse(await readFile(sessionsFile,'utf8'));
 const driver=sessions.findIndex(session=>session.deviceId&&session.shiftId&&session.permissions?.includes('driver:tasks:execute'));if(driver<0)throw Error('Missing development driver identity');
 const indexes={author:actorWith(sessions,'pricing:write','orders:create'),reviewer:actorWith(sessions,'pricing:review'),publisher:actorWith(sessions,'pricing:publish'),financeReview:actorWith(sessions,'prepayment:verify'),financeApprove:actorWith(sessions,'prepayment:approve','prepayment:post'),driver};
 const active={};for(const [name,actor] of Object.entries(indexes))active[name]=await activate({origin,sessionsFile,actor});
 assert.equal(new Set(Object.values(active).map(session=>session.principalId)).size,Object.keys(active).length,'Scenario roles must be distinct');
 const base='/api/ops/v1',reason={reason:'DEMO driver scenario'},fee=(code,amount)=>({code,enabled:true,method:'fixed',amount,unit:null,includedMilli:0,stepMilli:1000,share:code!=='insurance',scope:'DEMO',evidence:'DEMO fixed fee'});
 try{
  const area=await request(origin,active.author,'/service-areas',{body:{name:`DEMO driver scenario ${randomUUID()}`,type:'ALLOW',polygon:{type:'Polygon',coordinates:[[[104.8,11.4],[105,11.4],[105,11.6],[104.8,11.6],[104.8,11.4]]]},effectiveFrom:new Date().toISOString()}});await request(origin,active.author,`/service-areas/${area.id}/actions/publish`,{body:reason,version:1});
  let tariff=await request(origin,active.author,'/pricing/tariffs',{body:{name:`DEMO driver scenario ${randomUUID()}`,owner:'DR',currency:'USD',scope:'DEMO'}});for(const [code,amount] of [['base',200],['insurance',75]])tariff=await request(origin,active.author,`/pricing/tariffs/${tariff.id}/actions/save-fee`,{body:fee(code,amount),version:tariff.version});
  let policy=await request(origin,active.author,`/pricing/tariffs/${tariff.id}/policy-versions`,{body:{validFrom:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),quoteValiditySeconds:600,serviceLevels:['S2'],...reason},version:tariff.version});policy=await request(origin,active.reviewer,`/pricing/policy-versions/${policy.id}/actions/review`,{body:reason,version:1});policy=await request(origin,active.publisher,`/pricing/policy-versions/${policy.id}/actions/publish`,{body:reason,version:2});
  const draft=JSON.parse(await readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8')),intake=JSON.parse(await readFile(new URL('../../../contracts/examples/order-intake.json',import.meta.url),'utf8'));draft.customerId=(await request(origin,active.author,'/customers')).items[0].id;for(const side of ['pickup','delivery'])draft[side].point={lng:104.9,lat:11.5};for(const [index,key] of ['requestedPickupWindow','requestedDeliveryWindow'].entries())draft[key]={start:new Date(Date.now()+(index+1)*3600000).toISOString(),end:new Date(Date.now()+(index+2)*3600000).toISOString()};
  let order=await request(origin,active.author,'/orders',{body:draft}),orderPath=`/orders/${order.order.id}`;await request(origin,active.author,orderPath+'/intake-evidence',{body:intake,version:1});await request(origin,active.author,orderPath+'/actions/submit',{body:{},version:1});
  let quote=await request(origin,active.author,orderPath+'/quotes',{body:{pricingPolicyVersionId:policy.id,insuranceRequested:true},version:2});quote=await request(origin,active.author,`/quotes/${quote.id}/actions/record-customer-confirmation`,{body:{customerContact:'DEMO sender',method:'MESSAGE',reference:'DEMO acceptance',confirmedAt:new Date().toISOString()},version:1});
  const account=(await request(origin,active.author,'/finance/receiving-accounts')).items.find(item=>item.currency==='USD'),receipt=await request(origin,active.author,orderPath+'/prepayment-receipts',{body:{receivingAccountId:account.id,money:quote.total,bankReference:'DEMO-'+randomUUID(),reference:'DEMO bank evidence',observedAt:new Date().toISOString()},version:3});await request(origin,active.financeReview,`/prepayment-receipts/${receipt.id}/actions/verify`,{body:{approve:true,...reason},version:1});
  const allocation=await request(origin,active.author,orderPath+'/prepayment-allocations',{body:{receiptId:receipt.id,lines:quote.fees.map(item=>({feeId:item.id,amountMinor:item.money.amountMinor})),...reason},version:3}),allocationPath=`/prepayment-allocations/${allocation.id}`;await request(origin,active.financeReview,allocationPath+'/actions/review',{body:{approve:true,...reason},version:1});await request(origin,active.financeApprove,allocationPath+'/actions/approve',{body:{approve:true,...reason},version:2});await request(origin,active.financeApprove,allocationPath+'/actions/post',{body:reason,version:3});
  const fixture=await createDriverRouteFixture({connectionString:fixtureUrl,companyId:active.author.companyId,driverId:active.driver.principalId,orderId:order.order.id,createdBy:active.author.principalId}),detail=await request(origin,active.author,orderPath),check=await request(origin,active.author,orderPath+'/promise-checks',{body:{quoteId:quote.id,vehicleId:fixture.vehicleId,pickupWindow:detail.draft.requestedPickupWindow,deliveryWindow:detail.draft.requestedDeliveryWindow,fulfillmentMode:'VEHICLE'},version:3}),promise=await request(origin,active.author,orderPath+'/promises',{body:{quoteId:quote.id,checkId:check.id,customerConsentEvidenceIds:[randomUUID()],pickupWindow:detail.draft.requestedPickupWindow,deliveryWindow:detail.draft.requestedDeliveryWindow},version:3});
  const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ticket=await request(origin,active.author,'/uploads',{body:{purpose:'PACKAGING',resourceType:'ORDER',resourceId:order.order.id,mimeType:'image/png',sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});assert.equal((await fetch(ticket.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes})).status,204);await request(origin,active.author,`/uploads/${ticket.id}/actions/complete`,{body:{},version:2});
  const review=await request(origin,active.author,orderPath+'/load-reviews',{body:{vehicleId:fixture.vehicleId,specVersionId:fixture.specVersionId,result:'RELEASED',evidenceFileIds:[ticket.id],reason:'DEMO driver scenario load review'},version:4}),assignment=await request(origin,active.author,orderPath+'/assignments',{body:{vehicleId:fixture.vehicleId,driverId:active.driver.principalId,vehicleVersion:1,planVersion:fixture.planVersion,loadReviewId:review.id,promiseId:promise.id},version:4});
  let transfer=null;if(stage!=='offered'){
   await request(origin,active.driver,`/api/driver/v1/assignments/${assignment.id}/actions/accept`,{body:{planVersion:1},version:1});order=await request(origin,active.author,orderPath);transfer=await request(origin,active.author,'/custody-transfers',{body:{orderId:order.order.id,orderVersion:order.order.version,assignmentId:assignment.id,assignmentVersion:2,fromCustodianId:active.author.principalId,toCustodianId:active.driver.principalId,items:order.items.map(item=>({itemId:item.id,packageIds:item.packageIds})),loadReviewId:review.id,observedAt:new Date().toISOString(),evidenceFileIds:[ticket.id]}});transfer=await request(origin,active.author,`/custody-transfers/${transfer.id}/actions/confirm`,{body:{reason:'DEMO warehouse handoff',evidenceFileIds:[ticket.id]},version:1});
   if(stage==='ready-to-depart')transfer=await request(origin,active.driver,`/api/driver/v1/custody-transfers/${transfer.id}/actions/confirm`,{body:{reason:'DEMO driver received package',evidenceFileIds:[ticket.id]},version:2});
  }
  const driverAssignment=await request(origin,active.driver,`/api/driver/v1/assignments/${assignment.id}`),pending=driverAssignment.state==='accepted'?await request(origin,active.driver,`/api/driver/v1/assignments/${assignment.id}/custody-transfers`):{items:[]},readiness=driverAssignment.state==='accepted'?await request(origin,active.driver,`/api/driver/v1/assignments/${assignment.id}/departure-readiness`):null;
  const scenario={stage,orderId:order.order.id,assignmentId:assignment.id,deviceId:sessions[indexes.driver].deviceId,shiftId:sessions[indexes.driver].shiftId,evidenceFileId:ticket.id,token:active.driver.token,csrfToken:active.driver.csrfToken};await mkdir(dirname(scenarioFile),{recursive:true});await writeFile(scenarioFile,JSON.stringify(scenario,null,2),{mode:0o600});await chmod(scenarioFile,0o600);
  return {stage,orderId:scenario.orderId,assignmentId:scenario.assignmentId,deviceId:scenario.deviceId,shiftId:scenario.shiftId,evidenceFileId:scenario.evidenceFileId,assignmentState:driverAssignment.state,pendingCustody:pending.items.length,ready:readiness?.ready??false};
 }finally{for(const [name,session] of Object.entries(active))if(name!=='driver')await logout(origin,session);}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const flag=process.argv.indexOf('--stage'),stage=flag<0?'custody-pending':process.argv[flag+1],result=await createDriverScenario({stage});
 for(const [key,value] of Object.entries(result))console.log(`${key.toUpperCase()}=${value}`);
}
