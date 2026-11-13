import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const base=JSON.parse(execFileSync('git',['show','origin/develop:contracts/openapi.json'],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}));
const current=JSON.parse(readFileSync(resolve(root,'contracts/openapi.json'),'utf8'));
const modules=readdirSync(resolve(root,'contracts/modules')).filter(name=>name.endsWith('.json')).sort().map(name=>JSON.parse(readFileSync(resolve(root,'contracts/modules',name),'utf8')));
const recorded=modules.flatMap(module=>(module['x-recorded-operations']??[]).map(operation=>({module:module.module,...operation})));
const keyOf=operation=>`${operation.method.toLowerCase()} ${operation.path}`;
const targets=new Map(recorded.map(operation=>[keyOf(operation),operation]));

assert.equal(targets.size,recorded.length,'recorded targets must be unique');
let baseOwners=0,currentOwners=0,readyBefore=0,readyAfter=0,changedNonTargets=0;
const omitRecorded=operation=>{
  const copy=structuredClone(operation);
  for(const key of ['x-baseline-tier','x-implementation-status','x-owner'])delete copy[key];
  return copy;
};

for(const [path,methods] of Object.entries(base.paths))for(const [method,before] of Object.entries(methods)){
  const after=current.paths[path]?.[method];
  assert.ok(after,`missing ${method} ${path}`);
  const recordedOperation=targets.get(`${method} ${path}`);
  if(recordedOperation){
    assert.equal(after.operationId,recordedOperation.operationId,`operationId mismatch at ${method} ${path}`);
    for(const key of ['x-baseline-tier','x-implementation-status','x-owner'])assert.equal(after[key],recordedOperation[key],`${key} missing at ${method} ${path}`);
    assert.deepEqual(omitRecorded(after),omitRecorded(before),`non-whitelisted mutation at ${method} ${path}`);
  }else try{assert.deepEqual(after,before)}catch{changedNonTargets++;}
  if(before['x-owner']!==undefined)baseOwners++;
  if(after['x-owner']!==undefined)currentOwners++;
  if(before['x-implementation-status']==='CONTRACT_READY')readyBefore++;
  if(after['x-implementation-status']==='CONTRACT_READY')readyAfter++;
}

assert.equal(changedNonTargets,0,'non-recorded base operations changed');
assert.equal(currentOwners-baseOwners,recorded.length,'x-owner increase must equal recorded count');
assert.equal(readyBefore,39);
assert.equal(readyAfter,39);
console.log(JSON.stringify({moduleFiles:modules.length,recordedDeclarations:recorded.length,ownerDelta:currentOwners-baseOwners,contractReadyBefore:readyBefore,contractReadyAfter:readyAfter,nonRecordedChanges:changedNonTargets},null,2));
