import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {assembleContract, validateModuleStandards} from '../../../scripts/build-contract-modules.mjs';

const base={openapi:'3.1.0',info:{title:'test',version:'1'},paths:{},components:{parameters:{Language:{name:'Accept-Language',in:'header'},IdempotencyKey:{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:16,maxLength:128}},IfMatch:{name:'If-Match',in:'header',required:true},Limit:{name:'limit',in:'query'},Cursor:{name:'cursor',in:'query'},Csrf:{name:'X-CSRF-Token',in:'header',required:true}},schemas:{Money:{type:'object'},Error:{type:'object'}},responses:{BadRequest:{description:'bad'},Unauthorized:{description:'unauthorized'},Forbidden:{description:'forbidden'},NotFound:{description:'not found'},TooManyRequests:{description:'rate limited'},ServiceUnavailable:{description:'unavailable'}}}};
const operation={
  operationId:'listRoutePlans',summary:'List route plans',
  'x-permissions':['dispatch:read'],'x-stage':'R2','x-baseline-tier':'A','x-implementation-status':'DESIGNED_NOT_DEPLOYED','x-version-resource':'read only','x-owner':'BackendSenior',
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
  assert.doesNotThrow(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/assignments/{assignmentId}':{get:operation}}},base));
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/route-plans':{delete:operation}}},base),/DELETE/);
  assert.throws(()=>validateModuleStandards({...module,paths:{'/api/ops/v1/Route Plans':{get:operation}}},base),/lowercase/);
});

test('shared OpenAPI contract exposes reusable public parameters',()=>{
  const spec=JSON.parse(readFileSync(new URL('../../../contracts/openapi.json',import.meta.url)));
  const parameters=spec.components.parameters;
  assert.deepEqual(Object.keys(parameters).sort(),['Csrf','Cursor','IdempotencyKey','IfMatch','Language','Limit']);
  assert.equal(parameters.Language.name,'Accept-Language');
  assert.equal(parameters.IdempotencyKey.name,'Idempotency-Key');
  assert.deepEqual({min:parameters.IdempotencyKey.schema.minLength,max:parameters.IdempotencyKey.schema.maxLength},{min:16,max:128});
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

test('requires an A or B tier and a required If-Match header for mutations',()=>{
  const module={module:'dispatch',paths:{'/api/ops/v1/route-plan/{id}':{patch:{...structuredClone(operation),parameters:[
    {name:'Idempotency-Key',in:'header',required:true},
    {name:'If-Match',in:'header',required:false}
  ]}}},components:{schemas:{}}};
  assert.throws(()=>validateModuleStandards(module,base),/required If-Match header/);

  const valid=structuredClone(module);
  valid.paths['/api/ops/v1/route-plan/{id}'].patch.parameters[1].required=true;
  delete valid.paths['/api/ops/v1/route-plan/{id}'].patch['x-baseline-tier'];
  assert.throws(()=>validateModuleStandards(valid,base),/x-baseline-tier/);
});

test('resolves shared OpenAPI parameter references before checking write requirements',()=>{
  const module={module:'dispatch',paths:{'/api/ops/v1/route-plan':{post:{...structuredClone(operation),parameters:[
    {$ref:'#/components/parameters/IdempotencyKey'}
  ]}}},components:{schemas:{}}};
  assert.doesNotThrow(()=>validateModuleStandards(module,base));
});

test('requires a matching header when same-name query and header parameters coexist',()=>{
  const patch={...structuredClone(operation),parameters:[
    {name:'Idempotency-Key',in:'header',required:true},
    {name:'If-Match',in:'query',required:true},
    {$ref:'#/components/parameters/IfMatch'}
  ]};
  const module={module:'dispatch',paths:{'/api/ops/v1/route-plan/{id}':{patch}},components:{schemas:{}}};
  assert.doesNotThrow(()=>validateModuleStandards(module,base));

  const queryOnly=structuredClone(module);
  queryOnly.paths['/api/ops/v1/route-plan/{id}'].patch.parameters.pop();
  assert.throws(()=>validateModuleStandards(queryOnly,base),/required If-Match header/);
});

test('validates recorded legacy operations before they can be claimed by a module',()=>{
  const legacyBase=structuredClone(base);
  legacyBase.paths['/api/ops/v1/finance/payout-approvals']={get:{operationId:'listPayoutApprovals'}};
  const recorded={...structuredClone(operation),operationId:'listPayoutApprovals',path:'/api/ops/v1/finance/payout-approvals',method:'GET'};
  delete recorded['x-owner'];
  const module={
    module:'payout-approvals',
    paths:{},
    'x-recorded-operations':[recorded]
  };
  assert.throws(()=>validateModuleStandards(module,legacyBase),/x-owner/);
});

test('records all five A-tier payout approval operations in the BackendSenior module',()=>{
  const module=JSON.parse(readFileSync(new URL('../../../contracts/modules/backendsenior-payout-approvals.json',import.meta.url)));
  const recorded=module['x-recorded-operations'];
  assert.equal(recorded.length,5);
  assert.deepEqual(recorded.map(operation=>operation.operationId).sort(),[
    'approvePayoutApproval','confirmPayoutPaid','getPayoutApproval','listPayoutApprovals','rejectPayoutApproval'
  ]);
  assert.ok(recorded.every(operation=>operation['x-baseline-tier']==='A'&&operation['x-owner']==='BackendSenior'));
});

test('records all twenty-four B-tier BackendSenior operations in the module contract',()=>{
  const module=JSON.parse(readFileSync(new URL('../../../contracts/modules/backendsenior-b-tier.json',import.meta.url)));
  const recorded=module['x-recorded-operations'];
  assert.equal(recorded.length,24);
  assert.ok(recorded.every(operation=>operation['x-baseline-tier']==='B'&&operation['x-owner']==='BackendSenior'));
});
