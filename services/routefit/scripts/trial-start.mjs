import {readFile,readdir,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {sessionFileFor} from './trial-common.mjs';

const exec=promisify(execFile);
if(process.env.NODE_ENV==='production')throw Error('trial:start refuses NODE_ENV=production');
const pool=new pg.Pool({connectionString:process.env.ROUTEFIT_DATABASE_URL});await pool.query('SELECT 1');await pool.end();
const sessions=JSON.parse(await readFile(sessionFileFor(process.env,import.meta.url),'utf8'));
const soon=sessions.some(x=>Date.parse(x.expiresAt)-Date.now()<2*3600000);if(soon)console.warn('Trial session expires in under 2 hours; run npm run trial:renew first.');
if(process.env.ROUTEFIT_BACKUP_DIRECTORY){try{const files=await readdir(process.env.ROUTEFIT_BACKUP_DIRECTORY);let fresh=false;for(const name of files.filter(x=>x.endsWith('.dump'))){const info=await stat(join(process.env.ROUTEFIT_BACKUP_DIRECTORY,name));if(Date.now()-info.mtimeMs<24*3600000){fresh=true;break;}}if(!fresh){const childBackup=spawn(process.execPath,['scripts/trial-backup.mjs'],{stdio:'inherit',env:process.env});await new Promise((resolve,reject)=>{childBackup.on('exit',code=>code===0?resolve():reject(Error(`trial backup exited ${code}`)));childBackup.on('error',reject);});}}catch(error){console.warn(`Backup pre-check skipped: ${error.message}`);}}
if(process.platform!=='linux')throw Error('trial:start requires Linux systemd on the VPS');
try{await exec('systemctl',['is-active','--quiet','routefit']);}catch{throw Error('routefit systemd 服务未运行，请检查 systemctl status routefit');}
console.log('routefit systemd 服务已运行（127.0.0.1）；未在前台重复启动。');
