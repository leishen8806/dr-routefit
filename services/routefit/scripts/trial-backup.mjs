import {mkdir,readdir,unlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {assertBackupDirectoryOutsideRepo} from './trial-common.mjs';

const exec=promisify(execFile);
if(process.env.NODE_ENV==='production')throw Error('trial:backup refuses NODE_ENV=production');
const rawDir=process.env.ROUTEFIT_BACKUP_DIRECTORY;
if(!rawDir)throw Error('ROUTEFIT_BACKUP_DIRECTORY is required');
const dir=assertBackupDirectoryOutsideRepo(process.cwd(),rawDir);
await mkdir(dir,{recursive:true});
const url=new URL(process.env.ROUTEFIT_DATABASE_URL);
const file=join(dir,`routefit-${new Date().toISOString().replaceAll(/[-:]/g,'').replaceAll('.','')}.dump`);
const bin=process.env.ROUTEFIT_PG_BIN?join(process.env.ROUTEFIT_PG_BIN,process.platform==='win32'?'pg_dump.exe':'pg_dump'):'pg_dump';
try{await exec(bin,['-Fc','--file',file,url.href]);}catch(error){if(error.code==='ENOENT')throw Error('找不到 pg_dump，请设置 ROUTEFIT_PG_BIN 指向 PostgreSQL bin 目录');throw error;}
const files=(await readdir(dir)).filter(x=>x.endsWith('.dump')).sort();
for(const old of files.slice(0,-14))await unlink(join(dir,old));
console.log(`Backup written outside repository: ${file}`);
