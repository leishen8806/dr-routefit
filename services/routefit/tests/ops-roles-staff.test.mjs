// CMP-1708: setRolePermissions, getPermissionCatalog, disableStaff, enableStaff, patchStaff.
// HTTP-level tests over a stub pool (no database); real-database behaviour is covered by the 082 migration review, not here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {apiServer} from '../application/http.mjs';
import {opsRolesStaffRoutes} from '../application/ops-roles-staff.mjs';
import {PERMISSION_MODULES} from '../domain/permission-catalog.mjs';

const spec=JSON.parse(readFileSync(new URL('../../../contracts/openapi.json',import.meta.url),'utf8'));
const companyId='11111111-1111-4111-8111-111111111111',actorId='22222222-2222-4222-8222-222222222222',staffId='33333333-3333-4333-8333-333333333333',personId='44444444-4444-4444-8444-444444444444',roleId='55555555-5555-4555-8555-555555555555',systemRoleId='66666666-6666-4666-8666-666666666666';
const ASCII_ID=/^[A-Za-z0-9_-]{1,64}$/;
const ok=(rows=[])=>({rows,rowCount:rows.length});

function world(){
 const state={roles:new Map([[roleId,{id:roleId,name:'运营（示例）',is_system:false,permissions:['payouts:read'],version:3}],[systemRoleId,{id:systemRoleId,name:'管理员（示例）',is_system:true,permissions:[],version:1}]]),
  staff:new Map([[staffId,{id:staffId,person_id:personId,status:'ACTIVE',role_ids:[roleId],version:2}],[actorId,{id:actorId,person_id:actorId,status:'ACTIVE',role_ids:[],version:1}]]),events:[],results:new Map()};
 const query=async(sql,params=[])=>{
  if(sql.includes('FROM org.principal p JOIN org.company c'))return ok([{id:actorId}]);
  if(sql.includes('integration.http_request_result')){
   if(sql.startsWith('SELECT')){const prior=state.results.get(params.slice(0,5).join('|'));return ok(prior?[prior]:[]);}
   state.results.set(params.slice(0,5).join('|'),{fingerprint:params[5],status:params[6],response:params[7],etag:params[8]});return ok();
  }
  if(sql.startsWith('SELECT * FROM org.role')){const r=state.roles.get(params[1]);return ok(r?[r]:[]);}
  if(sql.startsWith('UPDATE org.role')){const r=state.roles.get(params[1]);Object.assign(r,{permissions:params[2],version:r.version+1});return ok([r]);}
  if(sql.includes('FROM org.principal p JOIN org.staff_profile')){const s=state.staff.get(params[1]);return ok(s?[s]:[]);}
  if(sql.startsWith('SELECT count(*)'))return ok([{count:params[1].filter(id=>state.roles.has(id)).length}]);
  if(sql.startsWith('UPDATE org.principal SET status')){state.staff.get(params[1]).status=params[2];return ok();}
  if(sql.startsWith('UPDATE org.staff_profile')){const s=state.staff.get(params[1]);Object.assign(s,{role_ids:params[2],version:s.version+1});return ok([{version:s.version}]);}
  if(sql.startsWith('INSERT INTO org.ops_change_event')){state.events.push({resource:params[1],action:params[4]});return ok();}
  return ok();
 };
 return {state,pool:{connect:async()=>({release(){},query})}};
}
async function withServer(permissions,fn,principalId=actorId){
 const w=world(),server=apiServer({pool:w.pool,authenticate:()=>({companyId,principalId,permissions})});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  let n=0;
  const call=(method,path,{body,etag,headers={}}={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(method!=='GET'?{'idempotency-key':'key-'+String(++n).padStart(16,'0')}:{}),...(etag?{'if-match':`"${etag}"`}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  await fn(call,w.state);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
function assertForbidden(response,body){
 assert.equal(response.status,403);
 assert.deepEqual(Object.keys(body),['error']);
 assert.deepEqual(Object.keys(body.error).sort(),['code','fields','message','messageKey','requestId','retryable']);
 assert.equal(body.error.code,'FORBIDDEN');assert.equal(typeof body.error.message,'string');assert.equal(typeof body.error.messageKey,'string');
 assert.equal(body.error.retryable,false);assert.match(body.error.requestId,ASCII_ID);assert.deepEqual(body.error.fields,[]);
}

// ---- AC-2: routes match the contract artifact -------------------------------
const CONTRACT={setRolePermissions:['post','/api/ops/v1/roles/{roleId}/actions/set-permissions','roles:write'],getPermissionCatalog:['get','/api/ops/v1/permission-catalog','roles:read'],disableStaff:['post','/api/ops/v1/staff/{staffId}/actions/disable','staff:write'],enableStaff:['post','/api/ops/v1/staff/{staffId}/actions/enable','staff:write'],patchStaff:['patch','/api/ops/v1/staff/{staffId}','staff:write']};
test('the five routes carry the method, path, operationId and permission of contracts/openapi.json',()=>{
 for(const [operation,[method,path,permission]] of Object.entries(CONTRACT)){
  const entry=spec.paths[path]?.[method];assert.equal(entry?.operationId,operation);assert.deepEqual(entry['x-permissions'],[permission]);
  const route=opsRolesStaffRoutes.find(r=>r.operation===operation);
  assert.ok(route,operation);assert.equal(route.method,method.toUpperCase());assert.equal(route.permission,permission);
  const sample=path.replace(/\{[^}]+\}/g,'abc');assert.match(sample,route.pattern);
 }
 assert.equal(opsRolesStaffRoutes.length,5);
});
test('the permission catalog equals the contract example',()=>{
 assert.deepEqual(PERMISSION_MODULES,spec.paths['/api/ops/v1/permission-catalog'].get['x-examples'].success.body.modules);
});

// ---- getPermissionCatalog ---------------------------------------------------
test('getPermissionCatalog: roles:read gets the catalog with an ETag and 304 on If-None-Match',async()=>{
 await withServer(['roles:read'],async call=>{
  const response=await call('GET','/api/ops/v1/permission-catalog'),body=await response.json();
  assert.equal(response.status,200);assert.ok(body.modules.length>0);assert.match(response.headers.get('etag'),/^"[1-9][0-9]*"$/);assert.equal(response.headers.get('cache-control'),'no-store');
  const again=await call('GET','/api/ops/v1/permission-catalog',{headers:{'if-none-match':response.headers.get('etag')}});
  assert.equal(again.status,304);assert.equal(await again.text(),'');
 });
});
test('getPermissionCatalog: without roles:read the request is rejected with 403',async()=>{
 await withServer(['roles:write','staff:write','staff:read'],async call=>{const response=await call('GET','/api/ops/v1/permission-catalog');assertForbidden(response,await response.json());});
});

// ---- setRolePermissions -----------------------------------------------------
const setPath=id=>`/api/ops/v1/roles/${id}/actions/set-permissions`;
test('setRolePermissions: roles:write sets the matrix, bumps the version and records an event',async()=>{
 await withServer(['roles:write'],async(call,state)=>{
  const response=await call('POST',setPath(roleId),{body:{version:3,permissions:['payouts:read','payouts:approve']},etag:3}),body=await response.json();
  assert.equal(response.status,200);assert.deepEqual(body,{id:roleId,name:'运营（示例）',permissions:['payouts:approve','payouts:read'],version:4});
  assert.equal(response.headers.get('etag'),'"4"');assert.deepEqual(state.events,[{resource:'ROLE',action:'SET_PERMISSIONS'}]);
 });
});
test('setRolePermissions: without roles:write the request is rejected with 403 and nothing is written',async()=>{
 await withServer(['roles:read','staff:write'],async(call,state)=>{
  const response=await call('POST',setPath(roleId),{body:{version:3,permissions:['payouts:read']},etag:3});assertForbidden(response,await response.json());
  assert.equal(state.roles.get(roleId).version,3);assert.deepEqual(state.events,[]);
 });
});
test('setRolePermissions: hard constraint, system role, stale version, unknown role and unknown permission',async()=>{
 await withServer(['roles:write'],async call=>{
  let response=await call('POST',setPath(roleId),{body:{version:3,permissions:['payouts:approve','payouts:confirm-paid']},etag:3});
  assert.equal(response.status,422);assert.equal((await response.json()).error.code,'HARD_CONSTRAINT_VIOLATION');
  response=await call('POST',setPath(systemRoleId),{body:{version:1,permissions:['payouts:read']},etag:1});assert.equal(response.status,409);assert.equal((await response.json()).error.code,'SYSTEM_ROLE_IMMUTABLE');
  response=await call('POST',setPath(roleId),{body:{version:2,permissions:['payouts:read']},etag:2});assert.equal(response.status,412);assert.equal((await response.json()).error.code,'VERSION_CONFLICT');
  response=await call('POST',setPath('77777777-7777-4777-8777-777777777777'),{body:{version:1,permissions:[]},etag:1});assert.equal(response.status,404);
  response=await call('POST',setPath(roleId),{body:{version:3,permissions:['nothing:here']},etag:3});assert.equal(response.status,422);assert.equal((await response.json()).error.code,'UNKNOWN_PERMISSION');
  response=await call('POST',setPath(roleId),{body:{version:3,permissions:[]}});assert.equal(response.status,428);
 });
});

// ---- staff ------------------------------------------------------------------
const staffPath=(id,action)=>`/api/ops/v1/staff/${id}${action?'/actions/'+action:''}`;
test('disableStaff: staff:write disables another staff member; second disable is an invalid transition',async()=>{
 await withServer(['staff:write'],async(call,state)=>{
  let response=await call('POST',staffPath(staffId,'disable'),{body:{version:2},etag:2}),body=await response.json();
  assert.equal(response.status,200);assert.deepEqual(body,{id:staffId,personId,roleIds:[roleId],state:'disabled',version:3});assert.equal(state.staff.get(staffId).status,'DISABLED');
  response=await call('POST',staffPath(staffId,'disable'),{body:{version:3},etag:3});assert.equal(response.status,409);assert.equal((await response.json()).error.code,'INVALID_TRANSITION');
 });
});
test('disableStaff: a member cannot disable themself',async()=>{
 await withServer(['staff:write'],async call=>{const response=await call('POST',staffPath(actorId,'disable'),{body:{version:1},etag:1});assert.equal(response.status,403);assert.equal((await response.json()).error.code,'SELF_DISABLE_FORBIDDEN');});
});
test('disableStaff: without staff:write the request is rejected with 403 and the staff stays active',async()=>{
 await withServer(['staff:read','roles:write'],async(call,state)=>{
  const response=await call('POST',staffPath(staffId,'disable'),{body:{version:2},etag:2});assertForbidden(response,await response.json());assert.equal(state.staff.get(staffId).status,'ACTIVE');
 });
});
test('enableStaff: staff:write re-enables a disabled staff member; enabling an active one is invalid',async()=>{
 await withServer(['staff:write'],async(call,state)=>{
  state.staff.get(staffId).status='DISABLED';
  let response=await call('POST',staffPath(staffId,'enable'),{body:{version:2},etag:2}),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.state,'active');assert.equal(body.version,3);
  response=await call('POST',staffPath(staffId,'enable'),{body:{version:3},etag:3});assert.equal(response.status,409);
 });
});
test('enableStaff: without staff:write the request is rejected with 403',async()=>{
 await withServer(['staff:read','roles:write'],async(call,state)=>{
  state.staff.get(staffId).status='DISABLED';
  const response=await call('POST',staffPath(staffId,'enable'),{body:{version:2},etag:2});assertForbidden(response,await response.json());assert.equal(state.staff.get(staffId).status,'DISABLED');
 });
});
test('patchStaff: staff:write replaces the role set; unknown roles, stale versions and self-edits are refused',async()=>{
 await withServer(['staff:write'],async(call,state)=>{
  let response=await call('PATCH',staffPath(staffId),{body:{version:2,roleIds:[systemRoleId]},etag:2}),body=await response.json();
  assert.equal(response.status,200);assert.deepEqual(body,{id:staffId,personId,roleIds:[systemRoleId],state:'active',version:3});assert.deepEqual(state.events,[{resource:'STAFF',action:'PATCH'}]);
  response=await call('PATCH',staffPath(staffId),{body:{version:3,roleIds:['88888888-8888-4888-8888-888888888888']},etag:3});assert.equal(response.status,422);assert.equal((await response.json()).error.code,'UNKNOWN_ROLE');
  response=await call('PATCH',staffPath(staffId),{body:{version:2,roleIds:[roleId]},etag:2});assert.equal(response.status,412);
  response=await call('PATCH',staffPath(actorId),{body:{version:1,roleIds:[roleId]},etag:1});assert.equal(response.status,403);assert.equal((await response.json()).error.code,'SELF_ROLE_CHANGE_FORBIDDEN');
 });
});
test('patchStaff: without staff:write the request is rejected with 403 and roles are unchanged',async()=>{
 await withServer(['staff:read','roles:write'],async(call,state)=>{
  const response=await call('PATCH',staffPath(staffId),{body:{version:2,roleIds:[systemRoleId]},etag:2});assertForbidden(response,await response.json());assert.deepEqual(state.staff.get(staffId).role_ids,[roleId]);
 });
});
