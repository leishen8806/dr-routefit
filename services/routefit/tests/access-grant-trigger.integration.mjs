import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {localFixture} from '../db/local-fixture.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL required');

test('role grant trigger accepts a valid grant without ambiguous column errors',async()=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 const client=await fixture.owner.connect();
 try{
  const companyId=fixture.principals[0].companyId,createdBy=fixture.principals[0].principalId,targetId=randomUUID(),grantId=randomUUID(),expiresAt=new Date(Date.now()+86400000).toISOString();
  await client.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF','DEMO role-grant target',$3,'ACTIVE')",[targetId,companyId,'local:'+targetId]);
  await client.query("SELECT set_config('app.principal_id',$1,false)",[createdBy]);
  const original=await readFile(new URL('../db/migrations/044_access_grants.sql',import.meta.url),'utf8'),oldFunction=original.slice(original.indexOf('CREATE FUNCTION org.only_revoke_role_grant()'),original.indexOf('CREATE TRIGGER role_grant_only_revoke')).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
  await client.query(oldFunction);
  await assert.rejects(client.query('INSERT INTO org.role_grant(id,company_id,principal_id,role,warehouse_ids,subject_ids,expires_at,state,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[grantId,companyId,targetId,'DISPATCH',[],[],expiresAt,'active',1,{id:grantId,version:1,state:'active',data:{principalId:targetId,role:'DISPATCH',expiresAt}},createdBy]),error=>error.code==='42702');
  await client.query(await readFile(new URL('../db/migrations/088_rebuild_only_revoke_role_grant.sql',import.meta.url),'utf8'));
  await assert.doesNotReject(client.query('INSERT INTO org.role_grant(id,company_id,principal_id,role,warehouse_ids,subject_ids,expires_at,state,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[grantId,companyId,targetId,'DISPATCH',[],[],expiresAt,'active',1,{id:grantId,version:1,state:'active',data:{principalId:targetId,role:'DISPATCH',expiresAt}},createdBy]));
  await assert.doesNotReject(client.query('UPDATE org.role_grant SET state=$2,version=$3,snapshot=$4,revoked_by=$5,revoked_at=clock_timestamp() WHERE id=$1',[grantId,'revoked',2,{id:grantId,version:2,state:'revoked',data:{principalId:targetId,role:'DISPATCH',expiresAt}},createdBy]));
 }finally{client.release();await fixture.cleanup();}
});
