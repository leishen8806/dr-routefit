import {readFile,readdir,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {sessionFileFor,findFreshValidBackup,isTrialMode} from './trial-common.mjs';
import {verifyBackupChecksum} from './trial-db-cli.mjs';

const exec=promisify(execFile);
export async function runTrialStart({env=process.env,Pool=pg.Pool,spawnImpl=spawn,execImpl=exec,now=Date.now,verify=verifyBackupChecksum}={}){
 if(env.NODE_ENV==='production')throw Error('trial:start refuses NODE_ENV=production');
 const pool=new Pool({connectionString:env.ROUTEFIT_DATABASE_URL});await pool.query('SELECT 1');await pool.end();
 const sessions=JSON.parse(await readFile(sessionFileFor(env,import.meta.url),'utf8'));
 const soon=sessions.some(x=>Date.parse(x.expiresAt)-now()<2*3600000);if(soon)console.warn('Trial session expires in under 2 hours; run npm run trial:renew first.');
 if(isTrialMode(env)){
  const directory=env.ROUTEFIT_BACKUP_DIRECTORY;if(!directory)throw Error('ROUTEFIT_BACKUP_DIRECTORY is required in trial mode');
  let fresh=false;try{fresh=(await findFreshValidBackup(directory,{now:now(),verify})).length>0;}catch(error){throw Error(`今日没有可用备份：${error.message}`);}
  if(!fresh){try{const childBackup=spawnImpl(process.execPath,['scripts/trial-backup.mjs'],{stdio:'inherit',env});await new Promise((resolve,reject)=>{childBackup.on('exit',code=>code===0?resolve():reject(Error(`trial backup exited ${code}`)));childBackup.on('error',reject);});}catch(error){throw Error(`今日没有可用备份，补做备份失败：${error.message}`);}}
 }else if(env.ROUTEFIT_BACKUP_DIRECTORY){try{const files=await readdir(env.ROUTEFIT_BACKUP_DIRECTORY);let fresh=false;for(const name of files.filter(x=>x.endsWith('.dump'))){const info=await stat(join(env.ROUTEFIT_BACKUP_DIRECTORY,name));if(now()-info.mtimeMs<24*3600000){fresh=true;break;}}if(!fresh){const childBackup=spawnImpl(process.execPath,['scripts/trial-backup.mjs'],{stdio:'inherit',env});await new Promise((resolve,reject)=>{childBackup.on('exit',code=>code===0?resolve():reject(Error(`trial backup exited ${code}`)));childBackup.on('error',reject);});}}catch(error){console.warn(`Backup pre-check skipped: ${error.message}`);}}
 if(process.platform!=='linux')throw Error('trial:start requires Linux systemd on the VPS');
 try{await execImpl('systemctl',['is-active','--quiet','routefit']);}catch{throw Error('routefit systemd 服务未运行，请检查 systemctl status routefit');}
 return 'routefit systemd 服务已运行（127.0.0.1）；未在前台重复启动。';
}

if(process.argv[1]===fileURLToPath(import.meta.url)){const message=await runTrialStart();console.log(message);}
