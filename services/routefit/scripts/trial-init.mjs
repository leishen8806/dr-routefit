import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {migrate} from '../db/migrate.mjs';

const quoteIdentifier=value=>`"${String(value).replaceAll('"','""')}"`;
const quoteLiteral=value=>`'${String(value).replaceAll("'","''")}'`;

export async function runTrialInit({adminUrl=process.env.ROUTEFIT_PG_ADMIN_URL,databaseName=process.env.ROUTEFIT_TRIAL_DATABASE||'routefit_trial',envFile=process.env.ROUTEFIT_TRIAL_ENV_FILE||fileURLToPath(new URL('../.local/dev.env',import.meta.url)),companyFile=process.env.ROUTEFIT_TRIAL_COMPANY_FILE||fileURLToPath(new URL('../.local/trial-company.json',import.meta.url)),Pool=pg.Pool}={}){
 if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required');
 const base=new URL(adminUrl);if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('admin URL must be local');
 const company=JSON.parse(await readFile(companyFile,'utf8'));if(!company.name)throw Error('trial company name is required');
 const runtimeRole=`rf_trial_${randomBytes(8).toString('hex')}`,runtimePassword=randomBytes(32).toString('hex');
 const admin=new Pool({connectionString:adminUrl});let created=false,roleCreated=false;
 try{
  const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName]);if(exists.rowCount)throw Error(`${databaseName} already exists; refusing to overwrite`);
  await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);created=true;
  const target=new URL(adminUrl);target.pathname='/'+databaseName;const pool=new Pool({connectionString:target.href});
  try{
   await migrate(pool);
   await pool.query('BEGIN');
   const id=company.id||randomUUID();
   await pool.query("SELECT set_config('app.company_id',$1,true)",[id]);
   await pool.query('INSERT INTO org.company(id,name,status) VALUES($1,$2,\'ACTIVE\') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,status=\'ACTIVE\'',[id,company.name]);
   await pool.query('COMMIT');
  }catch(error){await pool.query('ROLLBACK').catch(()=>{});throw error;}finally{await pool.end();}
  await admin.query(`CREATE ROLE ${quoteIdentifier(runtimeRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${quoteLiteral(runtimePassword)}`);roleCreated=true;
  await admin.query(`GRANT routefit_api TO ${quoteIdentifier(runtimeRole)}`);
  target.username=runtimeRole;target.password=runtimePassword;const sessionFile=process.env.ROUTEFIT_TRIAL_SESSION_FILE||'/var/lib/routefit/sessions.json';
  await mkdir(dirname(envFile),{recursive:true});await writeFile(envFile,`NODE_ENV=development\nROUTEFIT_TRIAL=1\nROUTEFIT_AUTH_MODE=development\nROUTEFIT_DATABASE_URL=${target.href}\nROUTEFIT_SESSION_FILE=${sessionFile}\nROUTEFIT_PORT=4180\n`,{flag:'wx',mode:0o600});
  await mkdir(dirname(sessionFile),{recursive:true});await writeFile(sessionFile,'[]\n',{flag:'wx',mode:0o600});
  return {databaseName,runtimeRole,envFile,sessionFile,companyId:company.id};
 }catch(error){if(roleCreated)await admin.query(`DROP ROLE IF EXISTS ${quoteIdentifier(runtimeRole)}`).catch(()=>{});if(created)await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(()=>{});throw error;}finally{await admin.end();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:init refuses NODE_ENV=production');
 const result=await runTrialInit();console.log(`Created ${result.databaseName}, runtime account ${result.runtimeRole}, and applied all migrations. No demo customers or orders were inserted.`);
}
