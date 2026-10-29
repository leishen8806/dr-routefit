import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {migrate} from '../db/migrate.mjs';

const quoteIdentifier=value=>`"${String(value).replaceAll('"','""')}"`;
const quoteLiteral=value=>`'${String(value).replaceAll("'","''")}'`;

export async function configureBackupRole({client,backupRole,migrationRoles=[]}){
 const schemas=(await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema' ORDER BY schema_name")).rows.map(row=>row.schema_name);
 const roles=[...new Set(migrationRoles.length?migrationRoles:['current_user'])];
 await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
 for(const schema of schemas){
  const s=quoteIdentifier(schema),r=quoteIdentifier(backupRole);
  await client.query(`GRANT USAGE ON SCHEMA ${s} TO ${r}`);
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${s} TO ${r}`);
  await client.query(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA ${s} TO ${r}`);
  for(const role of roles){const owner=role==='current_user'?'CURRENT_USER':quoteIdentifier(role);await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA ${s} GRANT SELECT ON TABLES TO ${r}`);await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA ${s} GRANT SELECT ON SEQUENCES TO ${r}`);}
 }
 return schemas;
}

export async function runTrialInit({adminUrl=process.env.ROUTEFIT_PG_ADMIN_URL,databaseName=process.env.ROUTEFIT_TRIAL_DATABASE||'routefit_trial',envFile=process.env.ROUTEFIT_TRIAL_ENV_FILE||fileURLToPath(new URL('../.local/dev.env',import.meta.url)),companyFile=process.env.ROUTEFIT_TRIAL_COMPANY_FILE||fileURLToPath(new URL('../.local/trial-company.json',import.meta.url)),sessionFile=process.env.ROUTEFIT_TRIAL_SESSION_FILE||'/var/lib/routefit/sessions.json',backupEnvFile=process.env.ROUTEFIT_BACKUP_ENV_FILE||fileURLToPath(new URL('../.local/backup.env',import.meta.url)),Pool=pg.Pool}={}){
 if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required');
 const base=new URL(adminUrl);if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('admin URL must be local');
 const company=JSON.parse(await readFile(companyFile,'utf8'));if(!company.name)throw Error('trial company name is required');
 const runtimeRole=`rf_trial_${randomBytes(8).toString('hex')}`,runtimePassword=randomBytes(32).toString('hex'),backupRole=`rf_backup_${randomBytes(8).toString('hex')}`,backupPassword=randomBytes(32).toString('hex');
 const admin=new Pool({connectionString:adminUrl});let created=false,roleCreated=false,backupRoleCreated=false,companyId,systemPrincipalId;
 try{
  const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName]);if(exists.rowCount)throw Error(`${databaseName} already exists; refusing to overwrite`);
  await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);created=true;
  const target=new URL(adminUrl);target.pathname='/'+databaseName;const pool=new Pool({connectionString:target.href});
  try{
   await migrate(pool);
   const client=await pool.connect();
   try{
   await client.query('BEGIN');
   const id=company.id||randomUUID();companyId=id;
   await client.query("SELECT set_config('app.company_id',$1,true)",[id]);
   await client.query('INSERT INTO org.company(id,name,status) VALUES($1,$2,\'ACTIVE\') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,status=\'ACTIVE\'',[id,company.name]);
   systemPrincipalId=(await client.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'SERVICE','Trial Import Administrator','system:trial-import','ACTIVE') ON CONFLICT(company_id,idp_subject) DO UPDATE SET kind='SERVICE',display_name=EXCLUDED.display_name,status='ACTIVE' RETURNING id",[randomUUID(),id])).rows[0].id;
   await client.query('COMMIT');
   if(!company.id){await writeFile(companyFile,JSON.stringify({...company,id},null,2)+'\n',{mode:0o600});}
   }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
  }finally{await pool.end();}
  await admin.query(`CREATE ROLE ${quoteIdentifier(runtimeRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${quoteLiteral(runtimePassword)}`);roleCreated=true;
  await admin.query(`GRANT routefit_api TO ${quoteIdentifier(runtimeRole)}`);
  await admin.query(`CREATE ROLE ${quoteIdentifier(backupRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS PASSWORD ${quoteLiteral(backupPassword)}`);backupRoleCreated=true;
  const grantPool=new Pool({connectionString:target.href}),backupClient=await grantPool.connect();
  try{const owners=(await backupClient.query("SELECT DISTINCT tableowner AS role FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'")).rows.map(row=>row.role);await configureBackupRole({client:backupClient,backupRole,migrationRoles:owners});}finally{backupClient.release();await grantPool.end();}
  target.username=runtimeRole;target.password=runtimePassword;
  const backupTarget=new URL(adminUrl);backupTarget.pathname='/'+databaseName;backupTarget.username=backupRole;backupTarget.password=backupPassword;
  await mkdir(dirname(envFile),{recursive:true});await writeFile(envFile,`NODE_ENV=development\nROUTEFIT_TRIAL=1\nROUTEFIT_AUTH_MODE=development\nROUTEFIT_DATABASE_URL=${target.href}\nROUTEFIT_SESSION_FILE=${sessionFile}\nROUTEFIT_PORT=4180\n`,{flag:'wx',mode:0o600});
  await mkdir(dirname(sessionFile),{recursive:true});await writeFile(sessionFile,'[]\n',{flag:'wx',mode:0o600});
  await mkdir(dirname(backupEnvFile),{recursive:true});await writeFile(backupEnvFile,`ROUTEFIT_PG_BACKUP_URL=${backupTarget.href}\n`,{flag:'wx',mode:0o600});
  return {databaseName,runtimeRole,backupRole,envFile,backupEnvFile,sessionFile,companyId,systemPrincipalId};
 }catch(error){if(backupRoleCreated)await admin.query(`DROP ROLE IF EXISTS ${quoteIdentifier(backupRole)}`).catch(()=>{});if(roleCreated)await admin.query(`DROP ROLE IF EXISTS ${quoteIdentifier(runtimeRole)}`).catch(()=>{});if(created)await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(()=>{});throw error;}finally{await admin.end();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:init refuses NODE_ENV=production');
 const result=await runTrialInit();console.log(`Created ${result.databaseName}, runtime account ${result.runtimeRole}, and applied all migrations. No demo customers or orders were inserted.`);
}
