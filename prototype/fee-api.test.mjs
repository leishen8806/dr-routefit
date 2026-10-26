import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decimal,display,feeDTO,trialDTO} from './fee-api-model.mjs';
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
