import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root=resolve(import.meta.dirname,'../../..');
const modulePath=resolve(root,'contracts/modules/backend2-a-tier-driver-ops.json');
const contractPath=resolve(root,'contracts/openapi.json');

const batches={
  first:['opsDriverDetail','opsDriverSuspend','driverUndeliveredReasonsList'],
  second:['opsDriverResume','opsDriverApplicationDetail','opsDriverApplicationApprove'],
  third:['opsDriverApplicationReturn','recipientPaymentIntent','recipientPaymentIntentStatus'],
};

async function load(){
  const [module,contract]=await Promise.all([
    readFile(modulePath,'utf8').then(JSON.parse),
    readFile(contractPath,'utf8').then(JSON.parse),
  ]);
  const operations=Object.values(module.paths).flatMap(methods=>Object.values(methods));
  return {contract,operations};
}

function select(operations,operationIds){
  const selected=operations.filter(operation=>operationIds.includes(operation.operationId));
  assert.equal(selected.length,operationIds.length);
  return selected;
}

function resolveSchema(contract,schema){
  if(Array.isArray(schema))return schema.map(value=>resolveSchema(contract,value));
  if(!schema||typeof schema!=='object')return schema;
  if(schema.$ref?.startsWith('#/components/schemas/')){
    return resolveSchema(contract,contract.components.schemas[schema.$ref.split('/').at(-1)]);
  }
  return Object.fromEntries(Object.entries(schema).map(([key,value])=>[key,resolveSchema(contract,value)]));
}

function assertDeclared(operations){
  for(const operation of operations){
    assert.equal(operation['x-owner'],'Backend2');
    assert.equal(operation['x-baseline-tier'],'A');
    assert.equal(operation['x-stage'],'R2');
    assert.equal(operation['x-implementation-status'],'PLANNED');
    assert.ok(operation['x-examples'].success.body);
    assert.deepEqual(Object.keys(operation['x-examples'].rejected.body),['error']);
    assert.match(operation['x-examples'].rejected.body.error.requestId,/^[\x00-\x7F]+$/);
  }
}

function assertWriteHeaders(operations){
  for(const operation of operations.filter(operation=>operation.method==='post')){
    assert.ok(operation.parameters.some(parameter=>parameter.name==='Idempotency-Key'&&parameter.in==='header'&&parameter.required));
  }
}

function assertExamplesValidate(contract,operations){
  const createAjv=()=>addFormats(new Ajv({allErrors:true,strict:false}));
  const validateError=createAjv().compile(resolveSchema(contract,contract.components.schemas.ApiError));
  for(const operation of operations){
    assert.equal(validateError(operation['x-examples'].rejected.body),true,`${operation.operationId} rejected: ${JSON.stringify(validateError.errors)}`);
    const successResponse=Object.entries(operation.responses).find(([status])=>status.startsWith('2'))?.[1];
    const successSchema=successResponse?.content?.['application/json']?.schema;
    assert.ok(successSchema,`${operation.operationId} requires a success response schema`);
    const validateSuccess=createAjv().compile(resolveSchema(contract,successSchema));
    assert.equal(validateSuccess(operation['x-examples'].success.body),true,`${operation.operationId} success: ${JSON.stringify(validateSuccess.errors)}`);
  }
}

test('Backend2 A-tier driver operations are planned and complete',async()=>{
  const {operations}=await load();
  assert.deepEqual(operations.filter(operation=>operation['x-owner']==='Backend2'&&operation['x-baseline-tier']==='A').map(operation=>operation.operationId).sort(),Object.values(batches).flat().sort());
  assertDeclared(operations);
});

test('Backend2 first-batch driver contracts have compliant examples and write headers',async()=>{
  const {operations}=await load();
  const first=select(operations,batches.first);
  assertDeclared(first);
  assertWriteHeaders(first);
});

test('Backend2 first-batch examples validate with AJV',async()=>{
  const {contract,operations}=await load();
  assertExamplesValidate(contract,select(operations,batches.first));
});

test('Backend2 second-batch A-tier contracts are declared with safe examples',async()=>{
  const {operations}=await load();
  const second=select(operations,batches.second);
  assertDeclared(second);
  assertWriteHeaders(second);
});

test('Backend2 second-batch examples validate with AJV',async()=>{
  const {contract,operations}=await load();
  assertExamplesValidate(contract,select(operations,batches.second));
});

test('Backend2 third-batch ops driver contracts are declared with compliant examples',async()=>{
  const {operations}=await load();
  const third=select(operations,batches.third);
  assertDeclared(third);
  assertWriteHeaders(third);
});

test('Backend2 third-batch examples validate with AJV',async()=>{
  const {contract,operations}=await load();
  assertExamplesValidate(contract,select(operations,batches.third));
});
