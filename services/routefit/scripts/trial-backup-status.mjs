import {access,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isTrialBackupName,trialBackupChecksumName,trialBackupDirectory} from './trial-common.mjs';
import {verifyBackupChecksum} from './trial-db-cli.mjs';

const utc7='Asia/Phnom_Penh';
const formatUtc7=date=>new Intl.DateTimeFormat('en-CA',{timeZone:utc7,dateStyle:'short',timeStyle:'medium',hour12:false}).format(date);
export async function runBackupStatus({directory=process.env.ROUTEFIT_BACKUP_DIRECTORY||trialBackupDirectory,now=Date.now(),verify=verifyBackupChecksum}={}){
 let names=[];try{names=(await readdir(directory)).filter(isTrialBackupName);}catch(error){if(error.code!=='ENOENT')throw error;}
 const files=[];
 for(const name of names){const file=join(directory,name),info=await stat(file);if(info.isFile()&&info.size>0)files.push({name,file,mtimeMs:info.mtimeMs});}
 files.sort((a,b)=>b.mtimeMs-a.mtimeMs);
 const latest=files[0]||null,ageHours=latest?(now-latest.mtimeMs)/3600000:null;
 let checksumExists=false,checksumValid=false;
 if(latest){const checksum=join(directory,trialBackupChecksumName(latest.name));try{await access(checksum);checksumExists=true;await verify(latest.file,checksum);checksumValid=true;}catch{}}
 const result={latestBackupAtUtc7:latest?formatUtc7(new Date(latest.mtimeMs)):null,ageHours:ageHours===null?null:Number(ageHours.toFixed(2)),checksumExists,checksumValid,backupCount:files.length,ok:Boolean(latest&&ageHours<=26&&checksumValid)};
 if(!result.ok){const reason=!latest?'no backups':ageHours>26?'latest backup is older than 26 hours':!checksumExists?'checksum file is missing':'latest backup checksum failed';throw Object.assign(new Error(`backup status failed: ${reason}`),{status:result});}
 return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await runBackupStatus(),null,2));}catch(error){if(error.status)console.error(JSON.stringify(error.status,null,2));throw error;}}
