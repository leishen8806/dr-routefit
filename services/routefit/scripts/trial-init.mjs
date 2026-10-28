import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {migrate} from '../db/migrate.mjs';

if(process.env.NODE_ENV==='production')throw Error('trial:init refuses NODE_ENV=production');
const adminUrl=process.env.ROUTEFIT_PG_ADMIN_URL;
if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required');
const databaseName=process.env.ROUTEFIT_TRIAL_DATABASE||'routefit_trial';
const envFile=process.env.ROUTEFIT_TRIAL_ENV_FILE||fileURLToPath(new URL('../.local/dev.env',import.meta.url));
const base=new URL(adminUrl);
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('admin URL must be local');
const admin=new pg.Pool({connectionString:adminUrl});
try{const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName]);if(exists.rowCount)throw Error(`${databaseName} already exists; refusing to overwrite`);await admin.query(`CREATE DATABASE "${databaseName.replaceAll('"','""')}"`);}finally{await admin.end();}
const target=new URL(adminUrl);target.pathname='/'+databaseName;
const pool=new pg.Pool({connectionString:target.href});await migrate(pool);await pool.end();
const dir=dirname(envFile),sessionFile=dir+'/sessions.json';await mkdir(dir,{recursive:true});
await writeFile(envFile,`NODE_ENV=development\nROUTEFIT_AUTH_MODE=development\nROUTEFIT_DATABASE_URL=${target.href}\nROUTEFIT_SESSION_FILE=${sessionFile}\nROUTEFIT_PORT=4180\n`,{flag:'wx',mode:0o600});
console.log(`Created ${databaseName} and applied all migrations. No demo customers or orders were inserted.`);
