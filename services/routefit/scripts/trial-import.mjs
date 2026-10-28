import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import pg from 'pg';
import {parseCsv,rowsToObjects,sessionFileFor} from './trial-common.mjs';

export async function runTrialImport({env=process.env,Pool=pg.Pool}={}){
 const dir=env.ROUTEFIT_TRIAL_IMPORT_DIRECTORY||fileURLToPath(new URL('../.local/import/',import.meta.url));
 const csv=async name=>rowsToObjects(parseCsv(await readFile(join(dir,name),'utf8')),name);
 const customers=await csv('customers.csv'),areas=await csv('service-areas.csv');
 if(customers.some(x=>!x.name)||areas.some(x=>!x.name||!x.type))throw Error('CSV validation failed; no rows were written');
 const pool=new Pool({connectionString:env.ROUTEFIT_DATABASE_URL});let imported=0;const client=await pool.connect();
 try{await client.query('BEGIN');const company=(await client.query("SELECT id FROM org.company WHERE status='ACTIVE' ORDER BY id LIMIT 1")).rows[0];if(!company)throw Error('no active company');await client.query("SELECT set_config('app.company_id',$1,true)",[company.id]);
  for(const row of customers){const customer=(await client.query('INSERT INTO party.customer(id,company_id,name,status) VALUES(gen_random_uuid(),$1,$2,\'ACTIVE\') RETURNING id',[company.id,row.name])).rows[0];await client.query('INSERT INTO party.customer_access(company_id,customer_id,principal_id) SELECT $1,$2,id FROM org.principal WHERE company_id=$1 AND kind=\'STAFF\' AND status=\'ACTIVE\' AND idp_subject LIKE \'local:%\'',[company.id,customer.id]);imported++;}
  await client.query('COMMIT');return {customers:imported,areas:areas.length};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:import refuses NODE_ENV=production');
 const result=await runTrialImport();console.log(`Imported ${result.customers} synthetic customers; service-area rows validated=${result.areas} (polygon import requires reviewed coordinates).`);
}
