import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {readJson,writePrivate,rolePermissions,newSession,localFile,validateStaffAssignments,sessionFileFor,trialDatabaseName,rolesNeedCustomerAccess,resolveStaffPrincipal} from './trial-common.mjs';
import {parseEnvironment} from './trial-ssh-link.mjs';

export async function runTrialStaff({env=process.env,Pool=pg.Pool,grantCustomerAccess=false}={}){
 const file=sessionFileFor(env,import.meta.url),staffFile=env.ROUTEFIT_TRIAL_STAFF_FILE||localFile(import.meta.url,'../.local/trial-staff.json'),companyFile=env.ROUTEFIT_TRIAL_COMPANY_FILE||localFile(import.meta.url,'../.local/trial-company.json');
 const adminEnvFile=env.ROUTEFIT_ADMIN_ENV_FILE||'/root/.config/routefit/admin.env';
 const adminEnv=parseEnvironment(await readFile(adminEnvFile,'utf8'));let adminUrl=env.ROUTEFIT_PG_ADMIN_URL||adminEnv.ROUTEFIT_PG_ADMIN_URL;if(!adminUrl)throw Error('ROUTEFIT_PG_ADMIN_URL is required via root-only env file');
 const target=new URL(adminUrl);target.pathname='/'+trialDatabaseName(env);adminUrl=target.href;
 const people=validateStaffAssignments(await readJson(staffFile)),sessions=JSON.parse(await readFile(file,'utf8')),companyId=String(env.ROUTEFIT_TRIAL_COMPANY_ID||JSON.parse(await readFile(companyFile,'utf8')).id||'').trim();if(!companyId)throw Error('ROUTEFIT_TRIAL_COMPANY_ID or company config id is required');const pool=new Pool({connectionString:adminUrl});let company;
 const client=await pool.connect();
 let created=0,reused=0,authorized=0,authorizationSkippedStaff=0;
 try{await client.query('BEGIN');company=(await client.query("SELECT id FROM org.company WHERE id=$1 AND status='ACTIVE'",[companyId])).rows[0];if(!company)throw Error(`no active company for configured id ${companyId}`);await client.query("SELECT set_config('app.company_id',$1,true)",[company.id]);
  for(const person of people){const displayName=String(person.displayName||'Synthetic Staff'),permissions=[...new Set((person.roles||[]).flatMap(role=>rolePermissions[role]||[]))],stableSubject=`local:${person.humanId}`,requestedId=randomUUID(),resolved=await resolveStaffPrincipal({client,companyId:company.id,sessions,sshLogin:person.sshLogin,subjectCandidates:[person.humanId,person.sshLogin]}),before=resolved.principal;if(before?.status==='DISABLED')throw Error(`staff ${person.humanId} is disabled; use an explicit reactivation command before rerunning trial:staff`);const idpSubject=before?.idp_subject||stableSubject;const upsert=(await client.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF',$3,$4,'ACTIVE') ON CONFLICT(company_id,idp_subject) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id",[before?.id||requestedId,company.id,displayName,idpSubject])).rows[0];const principalId=upsert?.id||before?.id||requestedId;if(before)reused++;else created++;const existingSession=resolved.session||sessions.find(session=>session.principalId===principalId&&session.authType!=='service');if(existingSession){existingSession.authType='staff';existingSession.roles=person.roles||[];existingSession.permissions=permissions;}else{const [session]=newSession({companyId:company.id,principalId,sshLogin:person.sshLogin,authType:'staff',roles:person.roles||[]},permissions,new Date(Date.now()+18*3600000).toISOString());sessions.push(session);}
   if(grantCustomerAccess){if(rolesNeedCustomerAccess(person.roles)){const result=await client.query("INSERT INTO party.customer_access(company_id,customer_id,principal_id) SELECT $1,c.id,$2 FROM party.customer c WHERE c.company_id=$1 AND c.status='ACTIVE' ON CONFLICT(company_id,customer_id,principal_id) DO NOTHING",[company.id,principalId]);authorized+=result.rowCount||0;}else authorizationSkippedStaff++;}
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
 await writePrivate(file,sessions);return {count:people.length,created,reused,authorized,authorizationSkippedStaff,grantRequested:grantCustomerAccess,ssh:people.map(person=>({sshLogin:person.sshLogin,roles:person.roles||[]}))};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:staff refuses NODE_ENV=production');
 const result=await runTrialStaff({grantCustomerAccess:process.argv.includes('--grant-customer-access')});console.log(`Staff processed: ${result.count}; created: ${result.created}; reused: ${result.reused}; customer grants written: ${result.authorized}; customer-scope staff skipped: ${result.authorizationSkippedStaff}.`);console.log('No real identities were used.');
}
