import assert from 'node:assert/strict';
import test from 'node:test';

import {assembleContract, validateModuleStandards} from '../../../scripts/build-contract-modules.mjs';

const base={openapi:'3.1.0',info:{title:'test',version:'1'},paths:{},components:{schemas:{Money:{type:'object'},Error:{type:'object'}},responses:{BadRequest:{description:'bad'},Unauthorized:{description:'unauthorized'},Forbidden:{description:'forbidden'},NotFound:{description:'not found'},TooManyRequests:{description:'rate limited'},ServiceUnavailable:{description:'unavailable'}}}};
const operation={
  operationId:'listRoutePlans',summary:'List route plans',
  'x-permissions':['dispatch:read'],'x-stage':'A','x-implementation-status':'DESIGNED_NOT_DEPLOYED','x-version-resource':'read only','x-owner':'BackendSenior',
  parameters:[{name:'limit',in:'query',required:false,schema:{type:'integer'}},{name:'cursor',in:'query',required:false,schema:{type:'string'}}],
  responses:{'200':{description:'ok',content:{'application/json':{schema:{type:'object',properties:{items:{type:'array',items:{type:'object'}},nextCursor:{type:['string','null']}},required:['items','nextCursor']},examples:{success:{value:{items:[],nextCursor:null}}}}}},'400':{$ref:'#/components/responses/BadRequest'},'401':{$ref:'#/components/responses/Unauthorized'},'403':{$ref:'#/components/responses/Forbidden'},'404':{$ref:'#/components/responses/NotFound'},'429':{$ref:'#/components/responses/TooManyRequests'},'503':{$ref:'#/components/responses/ServiceUnavailable'}},
  'x-examples':{success:{items:[],nextCursor:null},rejected:{code:'FORBIDDEN'}}
};

test('assembles a module into the legacy base without mutating its input',()=>{
  const module={module:'dispatch',paths:{'/api/ops/v1/route-plans':{get:operation}},components:{schemas:{RoutePlan:{type:'object'}}}};
  const assembled=assembleContract(base,[module]);
  assert.deepEqual({...assembled.paths['/api/ops/v1/route-plans'].get,'x-contract-module':undefined},{...operation,'x-contract-module':undefined});
  assert.equal(assembled.paths['/api/ops/v1/route-plans'].get['x-contract-module'],'dispatch');
  assert.equal(assembled.components.schemas.RoutePlan['x-contract-module'],'dispatch');
  assert.deepEqual(base.paths,{});
});

test('enforces the eight baseline rules for module operations',()=>{
  const module={module:'dispatch',paths:{'/api/ops/v1/route-plans':{get:operation}},components:{schemas:{}}};
  assert.doesNotThrow(()=>validateModuleStandards(module,base));
  assert.doesNotThrow(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/coupon-batches/{batchId}':{get:operation}}},base));
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plans':{delete:operation}}},base),/DELETE/);
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/Route Plans':{get:operation}}},base),/lowercase/);
});

test('rejects missing idempotency, versioning, pagination, money, errors, metadata, and examples',()=>{
  const module={module:'dispatch',paths:{'/api/ops/v1/route-plans':{get:operation}},components:{schemas:{}}};
  const without=(key)=>{const copy=structuredClone(operation);delete copy[key];return copy;};
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plans':{get:without('x-owner')}}},base),/x-owner/);
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plan':{post:{...structuredClone(operation),parameters:[]}}}},base),/Idempotency-Key/);
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plan/{id}':{patch:{...structuredClone(operation),parameters:[{name:'Idempotency-Key',in:'header'}]}}}},base),/If-Match/);
  const noCursor=structuredClone(operation);noCursor.parameters=noCursor.parameters.filter(parameter=>parameter.name!=='cursor');
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plans':{get:noCursor}}},base),/limit and cursor/);
  const inlineError=structuredClone(operation);inlineError.responses['400']={description:'bad'};
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plans':{get:inlineError}}},base),/common error response/);
  const noExamples=without('x-examples');
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plans':{get:noExamples}}},base),/x-examples/);
  assert.throws(()=>validateModuleStandards({...module,components:{schemas:{Fare:{type:'object',properties:{amount:{type:'integer'}}}}}} ,base),/Money schema/);
});
