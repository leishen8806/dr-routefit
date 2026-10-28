import {access,chmod,readdir,stat,unlink,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {assertTrialBackupFileMetadata,requireExistingBackupDirectory,trialBackupChecksumName,trialBackupCleanupNames,trialBackupDirectory,trialBackupFileMode,trialBackupName,trialBackupUmask} from './trial-common.mjs';

const exec=promisify(execFile);
if(process.env.NODE_ENV==='production')throw Error('trial:backup refuses NODE_ENV=production');
const {dir,gid}=await requireExistingBackupDirectory(process.cwd(),process.env.ROUTEFIT_BACKUP_DIRECTORY||trialBackupDirectory);
const url=new URL(process.env.ROUTEFIT_DATABASE_URL);
const name=trialBackupName(new Date()),file=join(dir,name),checksum=join(dir,trialBackupChecksumName(name));
const bin=process.env.ROUTEFIT_PG_BIN?join(process.env.ROUTEFIT_PG_BIN,process.platform==='win32'?'pg_dump.exe':'pg_dump'):'pg_dump';
const sha256=async path=>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');};
const setMetadata=async path=>{if(process.platform==='win32')return;await chmod(path,trialBackupFileMode);assertTrialBackupFileMetadata(await stat(path),process.getuid(),gid);};
try{
 await access(file).then(()=>{throw Error('backup timestamp collision; retry after one second');}).catch(error=>{if(error.code!=='ENOENT')throw error;});
 const oldUmask=process.umask(trialBackupUmask);
 try{try{await exec(bin,['-Fc','--file',file,url.href]);}catch(error){if(error.code==='ENOENT')throw Error('找不到 pg_dump，请设置 ROUTEFIT_PG_BIN 指向 PostgreSQL bin 目录');throw error;}await setMetadata(file);await writeFile(checksum,`${await sha256(file)}  ${name}\n`,{mode:trialBackupFileMode,flag:'wx'});await setMetadata(checksum);}finally{process.umask(oldUmask);}
 for(const old of trialBackupCleanupNames(await readdir(dir)))await unlink(join(dir,old)).catch(error=>{if(error.code!=='ENOENT')throw error;});
}catch(error){await Promise.all([unlink(file).catch(()=>{}),unlink(checksum).catch(()=>{})]);throw error;}
console.log(`Backup written outside repository: ${file}`);
