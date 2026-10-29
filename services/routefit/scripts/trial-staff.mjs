import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {readJson,writePrivate,rolePermissions,newSession,localFile,validateStaffAssignments,sessionFileFor} from './trial-common.mjs';
import {parseEnvironment} from './trial-ssh-link.mjs';

export async function runTrialStaff({env=process.env,Pool=pg.Pool}={}){
 const file=sessionFileFor(env,import.meta.url),staffFile=env.ROUTEFIT_TRIAL_STAFF_FILE||localFile(import.meta.url,'../.local/trial-staff.json');
 const adminEnvFile=env.ROUTEFIT_ADMIN_ENV_FILE||'/root/.config/routefit/admin.env';
 const adminEnv=parseEnvironment(await readFile(adminEnvFile,'utf8'));let adminUrl=env.ROUTEFIT_PG_ADMIN_URL||adminEnv.ROUTEFIT_PG_ADMIN_URL;if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required via root-only env file');
 const target=new URL(adminUrl);target.pathname='/'+(env.ROUTEFIT_TRIAL_DATABASE||'routefit_trial');adminUrl=target.href;
 const people=validateStaffAssignments(await readJson(staffFile)),sessions=JSON.parse(await readFile(file,'utf8')),pool=new Pool({connectionString:adminUrl});let company;
 const client=await pool.connect();
 try{await client.query('BEGIN');company=(await client.query("SELECT id FROM org.company WHERE status='ACTIVE' ORDER BY id LIMIT 1")).rows[0];if(!company)throw Error('no active company');await client.query("SELECT set_config('app.company_id',$1,true)",[company.id]);
  for(const person of people){const principalId=randomUUID(),displayName=String(person.displayName||'Synthetic Staff'),permissions=[...new Set((person.roles||[]).flatMap(role=>rolePermissions[role]||[]))];await client.query('INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,\'STAFF\',$3,$4,\'ACTIVE\')',[principalId,company.id,displayName,`local:${principalId}`]);const [session]=newSession({companyId:company.id,principalId,sshLogin:person.sshLogin},permissions,new Date(Date.now()+18*3600000).toISOString());sessions.push(session);}
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
 await writePrivate(file,sessions);return {count:people.length,ssh:people.map(person=>({sshLogin:person.sshLogin,roles:person.roles||[]}))};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:staff refuses NODE_ENV=production');
 const result=await runTrialStaff();console.log(`Created ${result.count} synthetic staff records; no real identities were used.`);console.log('SSH accounts to create:');for(const item of result.ssh)console.log(`${item.sshLogin}: ${item.roles.join(', ')}`);
}
