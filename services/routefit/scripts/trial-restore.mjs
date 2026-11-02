import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {assertRestoreDatabase} from './trial-common.mjs';
import {pgCliConnection,verifyBackupChecksum} from './trial-db-cli.mjs';

export async function runRestore({exec=promisify(execFile),poolFactory=connectionString=>new pg.Pool({connectionString}),verifyChecksum=verifyBackupChecksum,file,database,adminUrl,env=process.env,platform=process.platform}={}){
 database=assertRestoreDatabase(database);
 if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required');
 await verifyChecksum(file,`${file}.sha256`);
 const admin=poolFactory(adminUrl);
 let created=false;try{const existing=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database]);if(existing.rowCount)throw Error('restore target already exists; refusing overwrite');await admin.query(`CREATE DATABASE "${database.replaceAll('"','""')}"`);created=true;}finally{await admin.end();}
 const target=new URL(adminUrl);target.pathname='/'+database;
 const bin=env.ROUTEFIT_PG_BIN?join(env.ROUTEFIT_PG_BIN,platform==='win32'?'pg_restore.exe':'pg_restore'):'pg_restore';
 try{const cli=pgCliConnection(target.href);await exec(bin,['--clean','--if-exists','--dbname',cli.url,file],{env:{...env,PGPASSWORD:cli.password}});}catch(rawError){const error=rawError.code==='ENOENT'?Error('找不到 pg_restore，请设置 ROUTEFIT_PG_BIN 指向 PostgreSQL bin 目录'):rawError;if(created){try{const cleanup=poolFactory(adminUrl);try{await cleanup.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);await cleanup.query(`DROP DATABASE IF EXISTS "${database.replaceAll('"','""')}"`);}finally{await cleanup.end();}}catch(cleanupError){error.message=`${error.message}; 仍有残留：${database}（清理失败：${cleanupError.message}）`;}}throw error;}
 return {database,file};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:restore refuses NODE_ENV=production');
 const result=await runRestore({file:process.argv[2],database:process.argv[3],adminUrl:process.env.ROUTEFIT_PG_ADMIN_URL});
 console.log(`Restored into new database ${result.database}; routefit_trial was not modified.`);
}
