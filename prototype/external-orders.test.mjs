import {wallet} from './platform-model.mjs';
import {platformForm} from './platform-ui.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {seed,apply} from './model.mjs';import {parseExternalText} from './external-orders.mjs';
const now=Date.parse('2026-10-24T08:00:00Z');
export const externalExample={sourceType:'customer',sourceSystem:'DEMO-Shop',externalOrderId:'DEMO-001',customer:'演示用户',pickupAddress:'演示上门收货点 A',pickupContact:'演示寄件人',pickupPhone:'+855 000 000 001',destination:'演示送货点 B',deliveryContact:'演示收件人',deliveryPhone:'+855 000 000 002',amount:20,insuranceAmount:2,currency:'USD',cargo:'包装货',qty:2,weight:10,length:40,width:30,height:20,expected:'2026-10-24T18:00',payment:'cash',reviewed:true};
const imported=(extra={})=>apply(seed(now),{action:'importExternal',role:'ops',key:'import',payload:{...externalExample,...extra}},now);
test('labeled clipboard parses separate contacts and money; ambiguous price and duplicates warn',()=>{const r=parseExternalText('上门收货地址：A\n联系人：寄件人\n电话：+855000000001\n送货地址：B\n收货人：收件人\n联系电话：+855000000002\n配送价格：USD 20\n配送保险价格：2\n价格：999\n送货地址：C');assert.equal(r.fields.pickupPhone,'+855000000001');assert.equal(r.fields.deliveryPhone,'+855000000002');assert.equal(r.fields.amount,'20');assert.equal(r.fields.insuranceAmount,'2');assert.equal(r.fields.destination,'B');assert.equal(r.warnings.length,2);assert.equal(parseExternalText('{"currency":"EUR"}').fields.currency,'EUR')});
test('import requires both contact pairs and explicit reviewed price currency',()=>{for(const extra of [{pickupPhone:''},{deliveryContact:''},{reviewed:false},{currency:'KHR'},{insuranceAmount:''}])assert.throws(()=>imported(extra));const db=imported();assert.equal(db.orders[0].status,'draft');assert.equal(db.orders[0].amountMinor,2200);assert.equal(db.orders[0].insuranceFeeMinor,200);assert.equal(db.orders[0].pickupAddress,externalExample.pickupAddress)});
test('source order uniqueness and request idempotency cannot duplicate or overwrite',()=>{let db=imported();assert.equal(apply(db,{action:'importExternal',role:'ops',key:'import',payload:externalExample},now),db);assert.equal(apply(db,{action:'importExternal',role:'ops',key:'other',payload:externalExample},now),db);assert.throws(()=>apply(db,{action:'importExternal',role:'ops',key:'new',payload:{...externalExample,amount:25}},now),/已存在/);assert.throws(()=>apply(db,{action:'importExternal',role:'driver',key:'new',payload:externalExample},now),/无权限/)});
test('dispatch request remains draft, no vehicle reservation, and cannot bypass insurance confirmation',()=>{let db=imported(),o=db.orders[0];db=apply(db,{id:o.id,action:'requestExternalDispatch',role:'ops',key:'request',version:o.version},now);assert.equal(db.orders[0].status,'draft');assert.equal(db.orders[0].vehicle,null);assert(db.externalIntakes[0].dispatchRequestedAt);assert.throws(()=>apply(db,{id:o.id,action:'promise',role:'dispatch',key:'promise',version:db.orders[0].version,payload:{promise:'2026-10-24T18:00',basis:'DEMO',address:true,measured:true,confirmed:true}},now),/承保/)});
test('delivery plus insurance collects 22; 20 percent split applies only to delivery 20',()=>{let db=imported(),seq=0;const run=(action,role,payload)=>{const o=db.orders[0];db=apply(db,{id:o.id,action,role,key:'flow-'+seq++,version:o.version,payload},now)};run('promise','dispatch',{promise:'2026-10-24T18:00',basis:'DEMO',address:true,measured:true,confirmed:true,commissionPercent:20,insuranceConfirmed:true,insuranceProvider:'DEMO insurer',insurancePolicy:'DEMO-POLICY'});run('offer','dispatch',{vehicle:'V01'});run('accept','driver',{});run('prepare','warehouse',{dimension:true,pattern:true,packaging:true,evidence:'DEMO-LOAD'});run('pickup','driver',{count:2,evidence:'DEMO-HO'});run('depart','driver',{});run('report','driver',{amount:22,proof:'DEMO-CASH'});run('deliver','driver',{count:2,receiver:'DEMO',evidence:'DEMO-POD'});run('verify','finance',{amount:22,evidence:'DEMO-CHECK'});run('remit','driver',{evidence:'DEMO-REMIT'});run('reconcile','finance',{amount:22,evidence:'DEMO-RECON'});run('earningPost','finance',{evidence:'DEMO-SPLIT'});const x=db.earnings[0];assert.equal(x.insuranceMinor,200);assert.equal(x.platformMinor,400);assert.equal(x.driverMinor,1600);assert.equal(x.totalMinor,x.insuranceMinor+x.platformMinor+x.driverMinor);assert.equal(wallet(db,x.driverId).earned,1600);assert.equal(wallet(db,x.driverId).available,1600)});
test('customer intake identity is server-owned and cannot request another platform order',()=>{const db=imported();const payload={...externalExample,sourcePlatform:'DEMO-Shop-A',sourceType:'warehouse',sourceSystem:'forged'};const next=apply(db,{action:'importExternal',role:'customer',key:'customer',payload},now);assert.equal(next.orders[0].externalSource.sourceSystem,'DEMO-USER-001');assert.equal(next.orders[0].externalSource.sourceType,'customer');assert.throws(()=>apply(next,{action:'requestExternalDispatch',role:'customer',id:db.orders[0].id,version:db.orders[0].version,key:'foreign'},now),/不存在/);const another=apply(next,{action:'importExternal',role:'customer',key:'customer2',payload:{...payload,sourcePlatform:'DEMO-Shop-B'}},now);assert.equal(another.externalIntakes.length,3)});

test('customer can submit a minimal delivery request, but it cannot become a service promise before quotation and cargo verification',()=>{const db=apply(seed(now),{action:'importExternal',role:'customer',key:'quick-request',payload:{quickRequest:true,pickupAddress:'演示取件点 A',pickupContact:'演示发货人',pickupPhone:'+855 000 000 001',destination:'演示送货点 B',deliveryContact:'演示收货人',deliveryPhone:'+855 000 000 002',expected:'2026-10-24T18:00'}},now),o=db.orders[0],intake=db.externalIntakes.at(-1);assert.equal(o.quotePending,true);assert.equal(o.amountMinor,0);assert.equal(o.payment,'pending');assert(intake.dispatchRequestedAt);assert.throws(()=>apply(db,{id:o.id,action:'promise',role:'dispatch',key:'promise-pending',version:o.version,payload:{promise:'2026-10-24T18:30',basis:'DEMO',address:true,measured:true,confirmed:true}},now),/待核验/);});

test('commission confirmation labels delivery basis, separate insurance and total distinctly',()=>{const db=imported(),h={db,selectedResource:db.orders[0].id,driverActor:'D01',e:String,money:n=>'USD '+(n/100).toFixed(2),field:()=>'',checkField:()=>''};for(const action of ['commissionSet','earningPost']){const form=platformForm(action,h);assert.match(form.body,/配送费（分成基数）USD 20.00/);assert.match(form.body,/保险费（单独记账、不分成）USD 2.00/);assert.match(form.body,/客户应收 USD 22.00/);}});
// --- customer request form: only what the customer knows is asked; the rest is system-owned -----------------------------------
import {customerProfile,suggestDeliveryTime,validateCustomerRequest} from './external-orders.mjs';
import {externalForm} from './external-ui.mjs';
import {customerApp} from './experience.mjs';
const formHelpers=()=>({field:(name,label,value='',type='text',full=false,hint='')=>`<label data-field="${name}" data-type="${type}" data-value="${value}">${label}${hint?'｜'+hint:''}</label>`,e:String,role:'customer'});
const minimal={quickRequest:true,pickupAddress:'演示取件点 A',destination:'演示送货点 B',deliveryContact:'演示收货人',deliveryPhone:'+855 000 000 002'};
test('customer request form asks only for addresses, receiver, time and an optional cargo note',()=>{
 const html=externalForm(formHelpers());
 const asked=[...html.matchAll(/data-field="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(asked,['pickupAddress','destination','deliveryContact','deliveryPhone','expected','cargo']);
 for(const system of ['pickupContact','pickupPhone'])assert.ok(!asked.includes(system),system+' comes from the profile, not the form');
 assert.ok(!/external-paste|从其他平台复制|data-parse-external|textarea/.test(html),'platform import is an operator tool, not a customer step');
 assert.match(html,/寄件人[\s\S]*演示用户 USER-001 · \+855 000 000 001[\s\S]*无需填写/);
 assert.ok(!/本次操作核对/.test(html));
 assert.ok(asked.length<=6);
});
test('the delivery time field is pre-filled with a system suggestion the customer may change',()=>{
 const html=externalForm(formHelpers()),value=html.match(/data-field="expected" data-type="datetime-local" data-value="([^"]*)"/)?.[1];
 assert.match(value,/^\d{4}-\d{2}-\d{2}T\d{2}:(00|30)$/);
 assert.match(html,/系统建议时间，可修改；最终以调度确认为准/);
 assert.equal(suggestDeliveryTime(Date.parse('2026-10-26T01:00:00Z')),'2026-10-26T11:00');
 assert.equal(suggestDeliveryTime(Date.parse('2026-10-26T01:10:00Z')),'2026-10-26T11:30');
 assert.equal(suggestDeliveryTime(Date.parse('2026-10-26T16:45:00Z')),'2026-10-27T03:00','rolls over midnight in Phnom Penh time');
});
test('a request with only the two addresses and the receiver is accepted and sender identity is server-owned',()=>{
 const r=validateCustomerRequest(minimal,{now});
 assert.equal(r.pickupContact,customerProfile.name);assert.equal(r.pickupPhone,customerProfile.phone);assert.equal(r.customer,customerProfile.name);
 assert.equal(r.expected,suggestDeliveryTime(now));assert.equal(r.cargo,'待调度确认货物');
 const forged=validateCustomerRequest({...minimal,pickupContact:'冒名者',pickupPhone:'+855 999 999 999',customer:'冒名者'},{now});
 assert.equal(forged.pickupContact,customerProfile.name,'a client cannot choose the sender identity');assert.equal(forged.pickupPhone,customerProfile.phone);
 const db=apply(seed(now),{action:'importExternal',role:'customer',key:'slim',payload:minimal},now),o=db.orders[0];
 assert.equal(o.pickupContact,customerProfile.name);assert.equal(o.quotePending,true);assert.equal(o.amountMinor,0);assert.equal(o.payment,'pending');
 assert.equal(o.expected,suggestDeliveryTime(now));assert.ok(db.externalIntakes.at(-1).dispatchRequestedAt);
});
test('the receiver and addresses are still required, and an explicit delivery time is kept',()=>{
 for(const missing of ['pickupAddress','destination','deliveryContact','deliveryPhone'])assert.throws(()=>validateCustomerRequest({...minimal,[missing]:''},{now}),missing==='deliveryPhone'?/联系电话|收货联系电话/:/请核对/);
 assert.throws(()=>validateCustomerRequest({...minimal,deliveryPhone:'abc'},{now}),/联系电话格式不正确/);
 assert.throws(()=>validateCustomerRequest({...minimal,expected:'not-a-time'},{now}),/有效的期望送达时间/);
 assert.equal(validateCustomerRequest({...minimal,expected:'2026-10-28T09:30'},{now}).expected,'2026-10-28T09:30');
});
test('the profile page shows the sender details the order form no longer asks for',()=>{
 const h={db:{orders:[],externalIntakes:[]},e:String,btn:()=>'',money:String,sectionTab:'profile'};
 const html=customerApp(h);
 assert.match(html,/演示用户 USER-001/);assert.match(html,/\+855 000 000 001/);assert.match(html,/下单时自动带入，无需重复填写/);
});
