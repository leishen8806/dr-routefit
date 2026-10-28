import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import pg from 'pg';
import {assertRestoreDatabase} from './trial-common.mjs';
import {pgCliConnection,verifyBackupChecksum} from './trial-db-cli.mjs';

const exec=promisify(execFile);
if(process.env.NODE_ENV==='production')throw Error('trial:restore refuses NODE_ENV=production');
const file=process.argv[2];
const database=assertRestoreDatabase(process.argv[3]);
const adminUrl=process.env.ROUTEFIT_PG_ADMIN_URL;
if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required');
const checksumFile=`${file}.sha256`;
await verifyBackupChecksum(file,checksumFile);
const admin=new pg.Pool({connectionString:adminUrl});
try{const existing=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database]);if(existing.rowCount)throw Error('restore target already exists; refusing overwrite');await admin.query(`CREATE DATABASE "${database.replaceAll('"','""')}"`);}finally{await admin.end();}
const target=new URL(adminUrl);target.pathname='/'+database;
const bin=process.env.ROUTEFIT_PG_BIN?join(process.env.ROUTEFIT_PG_BIN,process.platform==='win32'?'pg_restore.exe':'pg_restore'):'pg_restore';
try{const cli=pgCliConnection(target.href);await exec(bin,['--clean','--if-exists','--dbname',cli.url,file],{env:{...process.env,PGPASSWORD:cli.password}});}catch(error){if(error.code==='ENOENT')throw Error('找不到 pg_restore，请设置 ROUTEFIT_PG_BIN 指向 PostgreSQL bin 目录');throw error;}
console.log(`Restored into new database ${database}; routefit_trial was not modified.`);
