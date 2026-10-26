import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from './model.mjs';
import {applyFinance,balances,financeProjection} from './finance-ledger.mjs';
function fixture(){let db=seed();let serial=0;const run=(action,payload={},id,actorId='F01',key)=>{db=applyFinance(db,{action,payload,id,actorId,key:key||`k-${serial++}`,version:db.financeLedger.version});return db;};run('load');return {run,get db(){return db}};}
test('KESS checkout amount is sourced from freight + insurance, never COD or browser price',()=>{
 const f=fixture();f.run('kessCreate',{orderId:'FIN-DEMO-001',amount:1});assert.equal(f.db.financeLedger.paymentIntents[0].amount,2000);f.run('kessCreate',{orderId:'FIN-DEMO-002'},undefined,'C01');assert.equal(f.db.financeLedger.paymentIntents[1].amount,1200);assert.equal(f.db.financeLedger.paymentIntents[1].items.length,2);assert.throws(()=>f.run('kessCreate',{orderId:'FIN-DEMO-002'}),/已有支付/);
});
test('unknown remains unresolved; mismatched result does not confirm a receipt',()=>{
 const f=fixture();f.run('kessCreate',{orderId:'FIN-DEMO-002'});const id=f.db.financeLedger.paymentIntents[0].id;f.run('kessQuery',{result:'UNKNOWN'},id,'C01');assert.throws(()=>f.run('kessCreate',{orderId:'FIN-DEMO-002'}),/已有支付/);assert.throws(()=>f.run('kessQuery',{result:'MISMATCH'},id),/不匹配/);assert.equal(f.db.financeLedger.receipts.length,0);
});
test('channel paid is one receipt, not bank settlement or automatic business allocation',()=>{
 const f=fixture();f.run('kessCreate',{orderId:'FIN-DEMO-002'});const id=f.db.financeLedger.paymentIntents[0].id;f.run('kessQuery',{result:'SUCCESS'},id,'C01');f.run('kessQuery',{result:'SUCCESS'},id,'C01');const b=balances(f.db.financeLedger);assert.equal(b.received,1200);assert.equal(b.channel,1200);assert.equal(b.company,0);assert.equal(b.available,0);assert.equal(f.db.financeLedger.receipts.length,1);assert.equal(f.db.financeLedger.allocations.length,0);assert.equal(f.db.orders.find(o=>o.id==='FIN-DEMO-002').collection,'due');assert.throws(()=>f.run('kessQuery',{result:'WAITING'},id),/终态/);
});
test('channel receipts cannot fund a manual refund while unsettled',()=>{
 const f=fixture();f.run('kessCreate',{orderId:'FIN-DEMO-002'});f.run('kessQuery',{result:'SUCCESS'},f.db.financeLedger.paymentIntents[0].id);assert.throws(()=>f.run('draft',{kind:'refund',receiptId:f.db.financeLedger.receipts[0].id,amount:'1',currency:'USD',reason:'test'}),/渠道待结算/);
});
test('KESS visible only to finance and owning customer; warehouse/driver cannot mutate',()=>{
 const f=fixture();f.run('kessCreate',{orderId:'FIN-DEMO-002'});for(const actor of ['W01','D01','M01','P01']){assert.equal(financeProjection(f.db,actor).paymentIntents.length,0);assert.throws(()=>f.run('kessCreate',{orderId:'FIN-DEMO-002'},undefined,actor),/没有此操作权限/);}assert.equal(financeProjection(f.db,'C01').paymentIntents.length,1);
});
test('KHR uses integer currency units; confirmed failure permits a new distinct intent',()=>{
 const f=fixture();f.run('kessCreate',{orderId:'FIN-DEMO-003'});const first=f.db.financeLedger.paymentIntents[0];assert.equal(first.amount,10000);f.run('kessQuery',{result:'CLOSED'},first.id);f.run('kessCreate',{orderId:'FIN-DEMO-003'});assert.notEqual(f.db.financeLedger.paymentIntents[1].id,first.id);
});
