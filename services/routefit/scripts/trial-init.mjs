import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {migrate} from '../db/migrate.mjs';

if(process.env.NODE_ENV==='production')throw Error('trial:init refuses NODE_ENV=production');
const adminUrl=process.env.ROUTEFIT_PG_ADMIN_URL;
if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required');
const databaseName=process.env.ROUTEFIT_TRIAL_DATABASE||'routefit_trial';
const envFile=process.env.ROUTEFIT_TRIAL_ENV_FILE||fileURLToPath(new URL('../.local/dev.env',import.meta.url));
const runtimeRole=`rf_trial_${randomBytes(8).toString('hex')}`;
const runtimePassword=randomBytes(32).toString('hex');
const base=new URL(adminUrl);
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('admin URL must be local');
const admin=new pg.Pool({connectionString:adminUrl});
const quoteIdentifier=value=>`"${value.replaceAll('"','""')}"`;
let created=false,roleCreated=false;
try{
 const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName]);
 if(exists.rowCount)throw Error(`${databaseName} already exists; refusing to overwrite`);
 await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);created=true;
}catch(error){await admin.end();throw error;}
const target=new URL(adminUrl);target.pathname='/'+databaseName;
const pool=new pg.Pool({connectionString:target.href});
try{
 await migrate(pool);await pool.end();
 await admin.query(`CREATE ROLE ${quoteIdentifier(runtimeRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${runtimePassword}'`);roleCreated=true;
 await admin.query(`GRANT routefit_api TO ${quoteIdentifier(runtimeRole)}`);
 target.username=runtimeRole;target.password=runtimePassword;
 const dir=dirname(envFile),sessionFile=join(dir,'sessions.json');await mkdir(dir,{recursive:true});
 await writeFile(envFile,`NODE_ENV=development\nROUTEFIT_AUTH_MODE=development\nROUTEFIT_DATABASE_URL=${target.href}\nROUTEFIT_SESSION_FILE=${sessionFile}\nROUTEFIT_PORT=4180\n`,{flag:'wx',mode:0o600});
 console.log(`Created ${databaseName}, runtime account ${runtimeRole}, and applied all migrations. No demo customers or orders were inserted.`);
}catch(error){await pool.end().catch(()=>{});if(roleCreated)await admin.query(`DROP ROLE IF EXISTS ${quoteIdentifier(runtimeRole)}`).catch(()=>{});if(created)await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(()=>{});throw error;
}finally{await admin.end();}
