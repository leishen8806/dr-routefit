import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedDemo,defaults,candidates,transition,totals} from './showcase-model.mjs';
import {loadCheck} from './model.mjs';
const plan=()=>transition(transition(seedDemo(),'evaluate',defaults),'choose',{id:'VAN'});
test('existing dispatch load check rejects interior width/height and missing measurements',()=>{
 const v={capacity:500,size:[300,100,100],door:[200,200]},o={qty:1,weight:5,length:20,width:150,height:20};
 assert.match(loadCheck(o,v),/尺寸/);assert.match(loadCheck({...o,width:20,height:150},v),/尺寸/);
 assert.match(loadCheck({...o,width:20,weight:NaN},v),/参数/);assert.match(loadCheck({...o,width:20},{...v,size:[]}),/参数/);
 assert.equal(loadCheck({...o,width:20},v),null);
});
test('candidate checks reject overload, dimensions, original and new deadline conflicts',()=>{
 const c=candidates(defaults);assert.equal(c.filter(v=>v.feasible).length,2);assert.ok(c.find(v=>v.id==='LATE').reasons.some(r=>r.includes('原 S1')));
 for(const patch of [{weight:600},{length:350},{width:250},{height:250},{deadline:30}])assert.equal(candidates({...defaults,...patch}).some(v=>v.feasible),false);
 assert.throws(()=>candidates({...defaults,qty:1.5}));assert.throws(()=>candidates({...defaults,insurance:NaN}));assert.throws(()=>candidates({...defaults,delivery:1.001}));
 assert.deepEqual(c[0].segments.map(x=>x.weight),[90,30,0]);
});
test('stale plan, wrong order, duplicate and rejection cannot silently advance',()=>{
 const s=plan(),stale=transition(s,'invalidate');assert.throws(()=>transition(stale,'offer',{confirmed:true}),/过期/);
 assert.throws(()=>transition(s,'accept',{confirmed:true}));assert.throws(()=>transition(s,'offer',{confirmed:true},s.version-1));
 const offered=transition(s,'offer',{confirmed:true});assert.throws(()=>transition(offered,'offer',{confirmed:true}));assert.throws(()=>transition(offered,'reject',{reason:''}));
 const rejected=transition(offered,'reject',{reason:'无法接单'});assert.equal(rejected.stage,'planned');assert.equal(rejected.plan,null);assert.deepEqual(rejected.orders[0],s.orders[0]);
});
test('two individual signatures and finance close with insurance excluded from split',()=>{
 let s=plan();const run=(a,p={})=>s=transition(s,a,p);
 run('offer',{confirmed:true});run('accept',{confirmed:true});assert.throws(()=>run('release',{confirmed:true}));run('release',{confirmed:true,evidence:'DEMO-load'});
 assert.throws(()=>run('pickup',{count:5,evidence:'x'}));run('pickup',{count:6,evidence:'DEMO-pickup'});run('depart');
 assert.throws(()=>run('deliver',{id:'B',count:2,amountMinor:2200,evidence:'x'}));
 assert.throws(()=>run('deliver',{id:'A',count:4,amountMinor:1,evidence:'x'}));
 run('deliver',{id:'A',count:4,amountMinor:2400,evidence:'DEMO-A'});assert.equal(s.stage,'transit');assert.throws(()=>run('verify',{confirmed:true,evidence:'x'}));
 run('deliver',{id:'B',count:2,amountMinor:2200,evidence:'DEMO-B'});assert.equal(s.stage,'delivered');
 run('verify',{confirmed:true,evidence:'DEMO-verify'});assert.throws(()=>run('remit',{amountMinor:4400,evidence:'x'}));run('remit',{amountMinor:4600,evidence:'DEMO-remit'});
 assert.throws(()=>run('reconcile',{confirmed:true,amountMinor:1,evidence:'x'}));run('reconcile',{confirmed:true,amountMinor:4600,evidence:'DEMO-reconcile'});
 assert.equal(s.stage,'closed');assert.deepEqual(totals(s),{delivery:4400,insurance:200,receivable:4600,platform:880,driver:3520});assert.equal(s.events.length,12);assert.throws(()=>run('reconcile',{confirmed:true,amountMinor:4600,evidence:'x'}));
});
