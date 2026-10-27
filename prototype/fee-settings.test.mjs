import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,apply} from './model.mjs';
import {calculateFeeTrial,feeKey,decimalUnits} from './fee-settings.mjs';
import {initAccess,sessionFor,executeAsAccount,projectAccount,canView} from './access-control.mjs';
import {tariffSummary,shortId,listStatus} from './fee-api-model.mjs';
let sequence=0;
test('fee draft picker uses readable summary and short display IDs',()=>{const id='12345678-aaaa-bbbb-cccc-ddddeeeeffff';assert.equal(shortId(id),'12345678');assert.match(tariffSummary({owner:'DR',currency:'USD',state:'DRAFT',version:1,id},new Date('2026-10-27T04:45:00Z')),/对客价表 · USD · 草稿 · 第 1 版/);});
test('fee draft picker explains loading, pagination and access states',()=>{assert.equal(listStatus({connected:false}),'未连接 · 请重新连接开发会话');assert.equal(listStatus({connected:true,loading:true}),'加载中…');assert.equal(listStatus({connected:true,hasMore:true,count:50}),'还有更多草稿可加载');assert.equal(listStatus({connected:true,count:2}),'已显示全部 2 份草稿');});
const config=(db,code,p={},owner='DR',currency='USD')=>{
 const id=feeKey(owner,currency,code);
 return apply(db,{action:'feeSave',role:'ops',key:'fee-'+(++sequence),id,version:db.feeSettings.rules[id]?.version||0,payload:{enabled:true,method:'fixed',amount:'2',share:false,scope:'合成样例：金边同城普通配送',evidence:'DEMO-价表依据',...p}});
};
test('fees default unset; no researched supplier prices or order mutations',()=>{
 const db=seed(),orders=structuredClone(db.orders),next=config(db,'base');
 assert.deepEqual(db.feeSettings.rules,{});assert.deepEqual(next.orders,orders);
 assert.equal(next.feeSettings.history.length,1);assert.equal(next.feeSettings.rules['DR:USD:base'].amount,200);
});
test('fixed + stepped weight + percent insurance + COD keeps funds and share separate',()=>{
 let db=config(seed(),'base',{amount:'1',share:true});
 db=config(db,'weight',{method:'unit',unit:'kg',included:'3',step:'0.5',amount:'0.25',share:true});
 db=config(db,'insurance',{method:'percent',amount:'1'});
 db=config(db,'cod',{method:'percent',amount:'0.5'});
 const q=calculateFeeTrial(db,{owner:'DR',currency:'USD',use_base:true,use_weight:true,qty_weight:'3.1',use_insurance:true,qty_insurance:'200',use_cod:true,qty_cod:'200'});
 assert.equal(q.totalMinor,425);assert.equal(q.shareMinor,125);assert.equal(q.insuranceMinor,200);assert.equal(q.separateMinor,300);
 assert.equal(q.lines[1].units,1);assert.equal(q.lines[1].quantity,3100);
 assert.equal(calculateFeeTrial(db,{owner:'DR',currency:'USD',use_weight:true,qty_weight:'3'}).totalMinor,0);
});
test('USD and KHR precision and HALF_UP are deterministic',()=>{
 let db=config(seed(),'insurance',{method:'percent',amount:'1'});
 assert.equal(calculateFeeTrial(db,{owner:'DR',currency:'USD',use_insurance:true,qty_insurance:'0.50'}).totalMinor,1);
 db=config(db,'insurance',{method:'percent',amount:'1'},'DR','KHR');
 assert.equal(calculateFeeTrial(db,{owner:'DR',currency:'KHR',use_insurance:true,qty_insurance:'50'}).totalMinor,1);
 assert.throws(()=>config(db,'base',{amount:'1.5'},'DR','KHR'),/0 位/);
 assert.equal(decimalUnits('0.29',2),29);
 for(const v of ['',null,'NaN','Infinity','-1','1e3','0.001','1,000'])assert.throws(()=>decimalUnits(v,2));
});
test('blank rate blocked; explicit zero is free; disabled fee cannot be used',()=>{
 assert.throws(()=>config(seed(),'base',{amount:''}));
 let db=config(seed(),'base',{amount:'0'});
 assert.equal(calculateFeeTrial(db,{owner:'DR',currency:'USD',use_base:true}).totalMinor,0);
 db=config(db,'base',{enabled:false,amount:'0'});
 assert.throws(()=>calculateFeeTrial(db,{owner:'DR',currency:'USD',use_base:true}),/停用/);
 assert.throws(()=>calculateFeeTrial(db,{owner:'DR',currency:'USD'}),/至少/);
});
test('invalid rules rejected and non-delivery money cannot be shared',()=>{
 const db=seed();
 for(const code of ['insurance','cod','storage','inbound','outbound','packing'])assert.throws(()=>config(db,code,{share:true}),/分成/);
 assert.throws(()=>config(db,'base',{share:true},'VET'),/采购/);
 assert.throws(()=>config(db,'base',{method:'percent'}),/不支持/);
 assert.throws(()=>config(db,'insurance',{method:'percent',amount:'100.01'}),/100%/);
 assert.throws(()=>config(db,'distance',{method:'unit',unit:'kg',included:'0',step:'1'}),/单位/);
 assert.throws(()=>config(db,'weight',{method:'unit',unit:'kg',included:'0',step:'0'}),/步长/);
 assert.throws(()=>config(db,'base',{scope:' '}),/适用线路/);
});
test('versions, idempotency and saved trials preserve old rules',()=>{
 let db=config(seed(),'base',{amount:'2'});
 const c={action:'feeTrial',role:'finance',id:'fee-trial',version:db.feeSettings.revision,key:'trial-1',payload:{owner:'DR',currency:'USD',use_base:true}};
 db=apply(db,c);assert.equal(apply(db,c),db);
 assert.throws(()=>apply(db,{...c,payload:{...c.payload,use_base:false}}),/幂等/);
 const original=structuredClone(db.feeSettings.trials[0]);db=config(db,'base',{amount:'3'});
 assert.deepEqual(db.feeSettings.trials[0],original);assert.equal(original.totalMinor,200);
 assert.equal(db.feeSettings.history[1].before.amount,200);
 assert.throws(()=>apply(db,{...c,key:'newtrial'}),/配置已变化/);
 assert.throws(()=>apply(db,{action:'feeSave',role:'ops',id:'DR:USD:base',version:0,key:'stale'}),/版本/);
});
test('carrier and currency settings are independent; omitted services do not charge',()=>{
 let db=config(seed(),'base',{amount:'2'});db=config(db,'base',{amount:'3'},'ZTO');db=config(db,'return',{amount:'8'});
 assert.equal(calculateFeeTrial(db,{owner:'DR',currency:'USD',use_base:true}).totalMinor,200);
 assert.equal(calculateFeeTrial(db,{owner:'ZTO',currency:'USD',use_base:true}).totalMinor,300);
 assert.throws(()=>calculateFeeTrial(db,{owner:'ZTO',currency:'KHR',use_base:true}),/尚未配置/);
});
test('amount overflow and malformed quantities fail instead of rounding silently',()=>{
 let db=config(seed(),'distance',{method:'unit',unit:'km',included:'0',step:'0.001',amount:'9000000000'});
 assert.throws(()=>calculateFeeTrial(db,{owner:'DR',currency:'USD',use_distance:true,qty_distance:'999999999'}),/过大/);
 assert.throws(()=>calculateFeeTrial(db,{owner:'DR',currency:'USD',use_distance:true,qty_distance:'1.0001'}),/三|3 位/);
});
test('roles and scoped account projection enforce global pricing access',()=>{
 let db=initAccess(seed());const session=sessionFor(db,'A02');
 const c={action:'feeSave',role:'dispatch',id:'DR:USD:base',key:'x',version:0,payload:{}};
 assert.throws(()=>apply(db,c),/无权/);assert.throws(()=>apply(db,{...c,role:'finance'}),/无权/);
 assert.throws(()=>executeAsAccount(db,session,c,apply),/权限/);
 assert.equal(projectAccount(db,session).feeSettings,undefined);
 db.access.accounts.push({id:'A04',roleIds:['operations'],scope:{mode:'all',warehouseIds:[],vehicleIds:null},status:'active',epoch:1});
 const ops=sessionFor(db,'A04');assert.equal(canView(db,ops,'pricing'),true);
 db=config(db,'base');const next=executeAsAccount(db,ops,{action:'feeTrial',role:'ops',key:'ops-trial',version:db.feeSettings.revision,payload:{owner:'DR',currency:'USD',use_base:true}},apply);
 assert.equal(next.feeSettings.trials[0].totalMinor,200);
});
