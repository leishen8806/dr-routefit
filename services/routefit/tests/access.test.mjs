import test from 'node:test';
import assert from 'node:assert/strict';
import {accessGrantQuery,writeAccessGrant} from '../adapters/access.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principalId='22222222-2222-4222-8222-222222222222',targetId='33333333-3333-4333-8333-333333333333';
const principal={companyId,principalId},draft={principalId:targetId,role:'DISPATCH',warehouseIds:[],subjectIds:[],expiresAt:'2030-01-01T00:00:00.000Z'};
function client(){return {query:async(sql,params)=>{
 if(sql.includes("SELECT 1 FROM org.principal"))return {rows:[{exists:1}],rowCount:1};
 if(sql.includes('INSERT INTO org.role_grant'))return {rows:[],rowCount:1};
 if(sql.includes('INSERT INTO org.role_grant_event'))return {rows:[],rowCount:1};
 throw Error('Unexpected query: '+sql);
}};}
test('role grant persists only another active staff principal and keeps an immutable scope snapshot',async()=>{
 const result=await writeAccessGrant(client(),principal,'create',null,draft,null);
 assert.equal(result.version,1);assert.equal(result.state,'active');assert.deepEqual(result.data,draft);
 await assert.rejects(()=>writeAccessGrant(client(),principal,'create',null,{...draft,principalId},null),{code:'SELF_GRANT_FORBIDDEN'});
});
test('role grant cursors are principal-bound and reject tampering',()=>{
 const query=accessGrantQuery(new URL('http://local/?limit=2'),principal),cursor=query.cursor(targetId);
 assert.equal(accessGrantQuery(new URL('http://local/?limit=2&cursor='+encodeURIComponent(cursor)),principal).after,targetId);
 assert.throws(()=>accessGrantQuery(new URL('http://local/?limit=3&cursor='+encodeURIComponent(cursor)),principal),{code:'INVALID_CURSOR'});
});
