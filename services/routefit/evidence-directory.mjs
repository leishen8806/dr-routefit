import {randomUUID} from 'node:crypto';
import {access,chmod,mkdir,unlink,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';

export async function prepareEvidenceDirectory({directory,trial=false}={}){
 const target=String(directory||'');
 try{
  await mkdir(target,{recursive:true,mode:0o700});
  await chmod(target,0o700);
  await access(target,constants.W_OK|constants.X_OK);
  const probe=`.routefit-write-${randomUUID()}`;
  const probePath=`${target}/${probe}`;
  await writeFile(probePath,'',{flag:'wx',mode:0o600});
  await unlink(probePath);
  return target;
 }catch(error){
  if(trial) throw new Error(`ROUTEFIT_EVIDENCE_DIRECTORY is not writable: ${target}`);
  throw error;
 }
}
