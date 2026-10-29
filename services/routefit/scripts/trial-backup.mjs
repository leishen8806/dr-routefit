import {access,chmod,readdir,stat,unlink,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertTrialBackupFileMetadata,requireExistingBackupDirectory,trialBackupChecksumName,trialBackupCleanupNames,trialBackupDirectory,trialBackupFileMode,trialBackupName,trialBackupUmask} from './trial-common.mjs';
import {pgCliConnection,sha256File} from './trial-db-cli.mjs';
import {parseEnvironment} from './trial-ssh-link.mjs';

export async function runBackup({exec=promisify(execFile),cwd=process.cwd(),env=process.env,backupDirectory=env.ROUTEFIT_BACKUP_DIRECTORY||trialBackupDirectory,now=new Date(),platform=process.platform,setMetadata:customSetMetadata}={}){
 const {dir,gid}=await requireExistingBackupDirectory(cwd,backupDirectory);
 let databaseUrl=env.ROUTEFIT_DATABASE_URL;
 const fs=await import('node:fs/promises');
 if(env.ROUTEFIT_BACKUP_ENV_FILE){const backupEnv=parseEnvironment(await fs.readFile(env.ROUTEFIT_BACKUP_ENV_FILE,'utf8'));databaseUrl=backupEnv.ROUTEFIT_PG_BACKUP_URL||databaseUrl;}
 else if(env.ROUTEFIT_ADMIN_ENV_FILE){const adminEnv=parseEnvironment(await fs.readFile(env.ROUTEFIT_ADMIN_ENV_FILE,'utf8'));databaseUrl=adminEnv.ROUTEFIT_PG_ADMIN_URL||databaseUrl;const u=new URL(databaseUrl);u.pathname='/'+(env.ROUTEFIT_TRIAL_DATABASE||'routefit_trial');databaseUrl=u.href;}
 if(env.ROUTEFIT_TRIAL==='1'&&!env.ROUTEFIT_BACKUP_ENV_FILE)throw Error('ROUTEFIT_BACKUP_ENV_FILE is required in trial mode');
 const url=new URL(databaseUrl);
 const name=trialBackupName(now),file=join(dir,name),checksum=join(dir,trialBackupChecksumName(name));
 const bin=env.ROUTEFIT_PG_BIN?join(env.ROUTEFIT_PG_BIN,platform==='win32'?'pg_dump.exe':'pg_dump'):'pg_dump';
 const setMetadata=customSetMetadata|| (async path=>{if(platform==='win32')return;await chmod(path,trialBackupFileMode);assertTrialBackupFileMetadata(await stat(path),process.getuid(),gid);});
 try{
 await access(file).then(()=>{throw Error('backup timestamp collision; retry after one second');}).catch(error=>{if(error.code!=='ENOENT')throw error;});
 const oldUmask=process.umask(trialBackupUmask);
 try{const cli=pgCliConnection(url.href);try{await exec(bin,['-Fc','--file',file,cli.url],{env:{...env,PGPASSWORD:cli.password}});}catch(error){if(error.code==='ENOENT')throw Error('找不到 pg_dump，请设置 ROUTEFIT_PG_BIN 指向 PostgreSQL bin 目录');throw error;}await setMetadata(file);await writeFile(checksum,`${await sha256File(file)}  ${name}\n`,{mode:trialBackupFileMode,flag:'wx'});await setMetadata(checksum);}finally{process.umask(oldUmask);}
 for(const old of trialBackupCleanupNames(await readdir(dir)))await unlink(join(dir,old)).catch(error=>{if(error.code!=='ENOENT')throw error;});
 }catch(error){await Promise.all([unlink(file).catch(()=>{}),unlink(checksum).catch(()=>{})]);throw error;}
 return {file,checksum,name};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:backup refuses NODE_ENV=production');
 const result=await runBackup();
 console.log(`Backup written outside repository: ${result.file}`);
}
