import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {chmod,mkdir,rm,stat} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareEvidenceDirectory} from '../evidence-directory.mjs';

test('trial evidence directory is created with owner-only permissions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'routefit-evidence-'));
 try{const target=await prepareEvidenceDirectory({directory:join(root,'evidence'),trial:true});assert.equal((await stat(target)).mode&0o777,0o700);}finally{await rm(root,{recursive:true,force:true});}
});

test('trial startup reports the configured variable and path when evidence directory is not writable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'routefit-evidence-')),parent=join(root,'locked'),target=join(parent,'evidence');await mkdir(parent);await chmod(parent,0o500);
 try{await assert.rejects(()=>prepareEvidenceDirectory({directory:target,trial:true}),error=>/ROUTEFIT_EVIDENCE_DIRECTORY is not writable:/.test(error.message)&&error.message.includes(target));}
 finally{await chmod(parent,0o700);await rm(root,{recursive:true,force:true});}
});
