import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {parseEnvironment} from './trial-ssh-link.mjs';
import {readJson,writePrivate,sessionFileFor,trialDatabaseName,resolveStaffPrincipal} from './trial-common.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function databaseUrl(env){
 const adminEnv=env.ROUTEFIT_ADMIN_ENV_FILE?parseEnvironment(await readFile(env.ROUTEFIT_ADMIN_ENV_FILE,'utf8')):{};
 const value=env.ROUTEFIT_PG_ADMIN_URL||adminEnv.ROUTEFIT_PG_ADMIN_URL;
 if(!value)throw Error('ROUTEFIT_PG_ADMIN_URL is required via root-only env file');
 const target=new URL(value);target.pathname='/'+trialDatabaseName(env);return target.href;
}
async function companyId(env){
 if(env.ROUTEFIT_TRIAL_COMPANY_ID)return String(env.ROUTEFIT_TRIAL_COMPANY_ID);
 return String((await readJson(env.ROUTEFIT_TRIAL_COMPANY_FILE)).id||'');
}
async function withTrialClient({env,Pool,work}){
 const pool=new Pool({connectionString:await databaseUrl(env)}),client=await pool.connect();
 try{return await work(client);}finally{client.release();await pool.end();}
}
export async function runDisableStaff({env=process.env,Pool=pg.Pool,sshLogin=process.argv[2]}={}){
 const login=String(sshLogin||'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(login))throw Error('a valid staff sshLogin is required');
 const file=sessionFileFor(env,import.meta.url),sessions=JSON.parse(await readFile(file,'utf8')),company=await companyId(env);if(!uuid.test(company))throw Error('ROUTEFIT_TRIAL_COMPANY_ID or company config id is required');
 const result=await withTrialClient({env,Pool,work:async client=>{await client.query('BEGIN');try{await client.query("SELECT set_config('app.company_id',$1,true)",[company]);const resolved=await resolveStaffPrincipal({client,companyId:company,sessions,sshLogin:login});const principal=resolved.principal;if(!principal)throw Error('staff principal was not found');const locked=(await client.query("SELECT id FROM org.principal WHERE company_id=$1 AND kind='STAFF' AND id=$2 FOR UPDATE",[company,principal.id])).rows[0];if(!locked)throw Error('staff principal was not found');const cleared=(await client.query('DELETE FROM party.customer_access WHERE company_id=$1 AND principal_id=$2',[company,locked.id])).rowCount||0;await client.query("UPDATE org.principal SET status='DISABLED', idp_subject=$3 WHERE company_id=$1 AND id=$2",[company,locked.id,`local:${login}`]);await client.query('COMMIT');return {principalId:locked.id,cleared};}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}}});
 const remaining=sessions.filter(session=>session.principalId!==result.principalId),removed=sessions.length-remaining.length;await writePrivate(file,remaining);return {cleared:result.cleared,removed};
}
export async function runDisableCustomer({env=process.env,Pool=pg.Pool,customerId=process.argv[2]}={}){
 const id=String(customerId||'').trim();if(!uuid.test(id))throw Error('a customer UUID is required');
 const file=sessionFileFor(env,import.meta.url),sessions=JSON.parse(await readFile(file,'utf8')),company=await companyId(env);if(!uuid.test(company))throw Error('ROUTEFIT_TRIAL_COMPANY_ID or company config id is required');
 const result=await withTrialClient({env,Pool,work:async client=>{await client.query('BEGIN');try{await client.query("SELECT set_config('app.company_id',$1,true)",[company]);const customer=(await client.query("SELECT id FROM party.customer WHERE company_id=$1 AND id=$2 AND status='ACTIVE' FOR UPDATE",[company,id])).rows[0];if(!customer)throw Error('active customer was not found');const cleared=(await client.query('DELETE FROM party.customer_access WHERE company_id=$1 AND customer_id=$2',[company,id])).rowCount||0;await client.query("UPDATE party.customer SET status='DISABLED' WHERE company_id=$1 AND id=$2",[company,id]);await client.query('COMMIT');return {cleared};}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}}});
 const remaining=sessions.filter(session=>session.customerId!==id&&session.customer_id!==id),removed=sessions.length-remaining.length;await writePrivate(file,remaining);return {cleared:result.cleared,removed};
}
