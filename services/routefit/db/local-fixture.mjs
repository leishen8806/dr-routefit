import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {migrate} from './migrate.mjs';

// shortcut: synthetic local fixtures only; production provisioning belongs to the reviewed identity/deployment work.
// routefit_api is a cluster-wide role that migration 001 creates with IF NOT EXISTS. That check is not atomic,
// so concurrent fixtures (one database each) collide on pg_authid_rolname_index. Create it once here, serialised by
// an advisory lock (taken on the admin database, which every fixture shares); migration 001 then finds it.
async function ensureApiRole(admin){
 const client=await admin.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('routefit_api_role'))");
  await client.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='routefit_api') THEN CREATE ROLE routefit_api NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$");
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}finally{client.release();}
}
export async function localFixture(adminUrl){
 const url=new URL(adminUrl);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Fixture database must be local');
 const suffix=randomBytes(8).toString('hex'),database='routefit_local_'+suffix,role='rf_local_'+suffix,password=randomBytes(32).toString('hex');
 const admin=new pg.Pool({connectionString:adminUrl,max:1});let owner,created=false,roleCreated=false;
 async function cleanup(){
  await owner?.end();
  if(created)await admin.query(`DROP DATABASE "${database}"`);
  if(roleCreated)await admin.query(`DROP ROLE "${role}"`);
  await admin.end();
 }
 try{
  await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;
  await ensureApiRole(admin);owner=new pg.Pool({connectionString:url.href,max:2});await migrate(owner);
  await admin.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);roleCreated=true;
  await owner.query(`GRANT routefit_api TO "${role}"`);
  const principals=[],customers=[];
  for(const label of ['A','B']){
   const companyId=randomUUID(),principalId=randomUUID(),personId=randomUUID();
   await owner.query('INSERT INTO org.company(id,name,status) VALUES($1,$2,$3)',[companyId,`DEMO Company ${label}`,'ACTIVE']);
   await owner.query('INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[principalId,companyId,'STAFF',`DEMO Operator ${label}`,'local:'+principalId,'ACTIVE',personId]);
   principals.push({companyId,principalId});
   const customerId=randomUUID();
   await owner.query('INSERT INTO party.customer(id,company_id,name,status) VALUES($1,$2,$3,$4)',[customerId,companyId,`DEMO Customer ${label}`,'ACTIVE']);
   await owner.query('INSERT INTO party.customer_access(company_id,customer_id,principal_id) VALUES($1,$2,$3)',[companyId,customerId,principalId]);customers.push(customerId);
   for(const currency of ['USD','KHR'])await owner.query('INSERT INTO finance.receiving_account(id,company_id,label,currency) VALUES($1,$2,$3,$4)',[randomUUID(),companyId,'DEMO company bank '+currency,currency]);
  }
  url.username=role;url.password=password;
  return {database,role,owner,admin,principals,customers,runtimeUrl:url.href,cleanup};
 }catch(error){await cleanup();throw error;}
}
