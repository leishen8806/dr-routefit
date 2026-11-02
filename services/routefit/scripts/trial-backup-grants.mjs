import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {configureBackupRole} from './trial-init.mjs';
import {parseEnvironment} from './trial-ssh-link.mjs';

export async function runBackupGrants({env=process.env,Pool=pg.Pool}={}){
 const adminFile=env.ROUTEFIT_ADMIN_ENV_FILE||env.ROUTEFIT_PG_ADMIN_ENV_FILE;if(!adminFile)throw Error('ROUTEFIT_ADMIN_ENV_FILE is required');
 const backupFile=env.ROUTEFIT_BACKUP_ENV_FILE;if(!backupFile)throw Error('ROUTEFIT_BACKUP_ENV_FILE is required');
 const adminEnv=parseEnvironment(await readFile(adminFile,'utf8')),backupEnv=parseEnvironment(await readFile(backupFile,'utf8'));if(!adminEnv.ROUTEFIT_PG_ADMIN_URL||!backupEnv.ROUTEFIT_PG_BACKUP_URL)throw Error('admin and backup environment files are required');
 const backupUrl=new URL(backupEnv.ROUTEFIT_PG_BACKUP_URL),databaseName=env.ROUTEFIT_TRIAL_DATABASE||backupUrl.pathname.slice(1);if(!databaseName)throw Error('ROUTEFIT_TRIAL_DATABASE is required');
 const adminUrl=new URL(adminEnv.ROUTEFIT_PG_ADMIN_URL);adminUrl.pathname='/'+databaseName;const backupRole=decodeURIComponent(backupUrl.username);const pool=new Pool({connectionString:adminUrl.href});const client=await pool.connect();
 try{const owners=(await client.query("SELECT DISTINCT tableowner AS role FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'")).rows.map(row=>row.role);const schemas=await configureBackupRole({client,backupRole,migrationRoles:owners});return {databaseName,backupRole,schemas};}finally{client.release();await pool.end();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:backup-grants refuses NODE_ENV=production');
 const result=await runBackupGrants();console.log(`Backup grants refreshed for ${result.databaseName}: ${result.schemas.length} schemas, role ${result.backupRole}.`);
}
