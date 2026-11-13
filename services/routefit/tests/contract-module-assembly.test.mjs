import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleContract, validateModuleStandards} from '../../../scripts/build-contract-modules.mjs';

const recorded={
  operationId:'getRecordedOrder',
  path:'/api/orders/{orderId}',
  method:'get',
  'x-permissions':['orders:read'],
  'x-stage':'beta',
  'x-baseline-tier':'A',
  'x-implementation-status':'PLANNED',
  'x-version-resource':'orders',
  'x-owner':'BackendSenior',
  'x-examples':{success:{},rejected:{}},
};

function base(){
  return {paths:{
    '/api/orders/{orderId}':{get:{operationId:'getRecordedOrder',summary:'base operation',responses:{'404':{$ref:'#/components/responses/NotFound'}}}},
  },components:{schemas:{}}};
}

function moduleWithRecorded(operations=[recorded]){
  return {module:'recorded-fixture',paths:{},'x-recorded-operations':operations};
}

test('assembles only the three recorded output fields onto a matching base operation',()=>{
  const assembled=assembleContract(base(),[moduleWithRecorded()]);
  const operation=assembled.paths['/api/orders/{orderId}'].get;

  assert.equal(operation['x-baseline-tier'],'A');
  assert.equal(operation['x-implementation-status'],'PLANNED');
  assert.equal(operation['x-owner'],'BackendSenior');
  assert.equal(operation['x-permissions'],undefined);
  assert.equal(operation['x-stage'],undefined);
  assert.equal(operation['x-version-resource'],undefined);
  assert.equal(operation['x-examples'],undefined);
  assert.equal(operation.summary,'base operation');
});

test('rejects a recorded operationId that does not match the target operation',()=>{
  const invalid={...recorded,operationId:'unknownRecordedOperation'};
  assert.throws(()=>validateModuleStandards(moduleWithRecorded([invalid]),base()),/operationId.*does not match/i);
});

test('rejects an unknown recorded input key',()=>{
  const invalid={...recorded,'x-bogus':true};
  assert.throws(()=>validateModuleStandards(moduleWithRecorded([invalid]),base()),/x-bogus.*not allowed/i);
});

test('rejects a duplicate recorded target across modules',()=>{
  assert.throws(()=>assembleContract(base(),[moduleWithRecorded(),{...moduleWithRecorded(),module:'second-recorded-fixture'}]),/duplicate recorded operation/i);
});
