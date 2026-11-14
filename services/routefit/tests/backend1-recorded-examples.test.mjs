import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';

const root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const module=JSON.parse(readFileSync(resolve(root,'contracts/modules/backend1.json'),'utf8'));
const recorded=new Map((module['x-recorded-operations']??[]).map(operation=>[operation.operationId,operation]));

test('Backend1 keeps the three reassigned base operations planned until recorded permissions reach the assembled contract',()=>{
  const expected=[
    ['opsDriverApplications','drivers:application:review'],
    ['driverAssignmentLoadScanCreate','driver:tasks:execute'],
    ['driverDeliveryAttemptCreate','driver:delivery:record'],
  ];
  for(const [operationId,permission] of expected){
    const operation=recorded.get(operationId);
    assert.ok(operation,`missing ${operationId}`);
    assert.deepEqual(operation['x-permissions'],[permission]);
    assert.equal(operation['x-baseline-tier'],'A');
    assert.equal(operation['x-implementation-status'],'PLANNED');
    assert.equal(operation['x-owner'],'Backend1');
  }
});

test('Backend1 recorded operations provide Ajv-valid success and rejected response bodies',()=>{
  const openapi=JSON.parse(readFileSync(resolve(root,'contracts/openapi.json'),'utf8'));
  const ajv=new Ajv({allErrors:true,strict:false});
  ajv.addSchema({$id:'openapi',components:openapi.components});
  const validateCandidatePage=ajv.compile({$ref:'openapi#/components/schemas/CandidatePage'});
  const validateResourceVersion=ajv.compile({$ref:'openapi#/components/schemas/ResourceVersion'});
  const validateApiError=ajv.compile({$ref:'openapi#/components/schemas/ApiError'});
  const expected=[
    ['opsDriverApplications',validateCandidatePage],
    ['driverAssignmentLoadScanCreate',validateResourceVersion],
    ['driverDeliveryAttemptCreate',validateResourceVersion],
  ];
  for(const [operationId,validateSuccess] of expected){
    const examples=recorded.get(operationId)?.['x-examples'];
    assert.ok(examples?.success?.body,`${operationId} success body`);
    assert.ok(examples?.rejected?.body,`${operationId} rejected body`);
    assert.equal(validateSuccess(examples.success.body),true,JSON.stringify(validateSuccess.errors));
    assert.equal(validateApiError(examples.rejected.body),true,JSON.stringify(validateApiError.errors));
    const error=examples.rejected.body.error;
    assert.match(error.requestId,/^[A-Za-z0-9_-]{1,64}$/);
    assert.deepEqual(Object.keys(error).sort(),['code','fields','message','messageKey','requestId','retryable']);
  }
});

test('Backend1 defines the four driver-side collection and delivery paths',()=>{
  const expected=[
    ['/api/driver/v1/orders/{orderId}/collection-intents','post','driverCollectionIntentCreate','driver:collection-intents:write'],
    ['/api/driver/v1/orders/{orderId}/collection-intents','get','driverCollectionIntentsList','driver:collection-intents:read'],
    ['/api/driver/v1/orders/{orderId}/collection-intents/{intentId}/actions/confirm','post','driverCollectionIntentConfirm','driver:collection-intents:write'],
    ['/api/driver/v1/orders/{orderId}/delivery-scans','post','driverDeliveryScanCreate','driver:delivery:scan'],
  ];
  for(const [path,method,operationId,permission] of expected){
    const operation=module.paths?.[path]?.[method];
    assert.ok(operation,`missing ${method.toUpperCase()} ${path}`);
    assert.equal(operation.operationId,operationId);
    assert.deepEqual(operation['x-permissions'],[permission]);
    assert.equal(operation['x-baseline-tier'],'A');
    assert.equal(operation['x-implementation-status'],'CONTRACT_READY');
    assert.equal(operation['x-owner'],'Backend1');
  }
  assert.equal(module.paths?.['/api/recipient/v1/payment-intents'],undefined);
});

test('Backend1 retains the assigned recorded permission declarations pending the assembler update',()=>{
  const expected={
    opsDriverApplications:['drivers:application:review'],
    driverAssignmentLoadScanCreate:['driver:tasks:execute'],
    driverDeliveryAttemptCreate:['driver:delivery:record'],
  };
  for(const [operationId,permissions] of Object.entries(expected)){
    assert.deepEqual(recorded.get(operationId)?.['x-permissions'],permissions,operationId);
  }
});
