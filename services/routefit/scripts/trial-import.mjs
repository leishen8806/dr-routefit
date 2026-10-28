import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseCsv,rowsToObjects} from './trial-common.mjs';
if(process.env.NODE_ENV==='production')throw Error('trial:import refuses NODE_ENV=production');
const dir=process.env.ROUTEFIT_TRIAL_IMPORT_DIRECTORY||fileURLToPath(new URL('../.local/import/',import.meta.url));const csv=async name=>rowsToObjects(parseCsv(await readFile(join(dir,name),'utf8')),name);
const customers=await csv('customers.csv'),areas=await csv('service-areas.csv');if(customers.some(x=>!x.name)||areas.some(x=>!x.name||!x.type))throw Error('CSV validation failed; no rows were written');const pool=new pg.Pool({connectionString:process.env.ROUTEFIT_DATABASE_URL});try{const company=(await pool.query('SELECT id FROM org.company WHERE status=\'ACTIVE\' ORDER BY id LIMIT 1')).rows[0];if(!company)throw Error('no active company');await pool.query('BEGIN');for(const row of customers)await pool.query('INSERT INTO party.customer(id,company_id,name,status) VALUES(gen_random_uuid(),$1,$2,\'ACTIVE\')',[company.id,row.name]);await pool.query('COMMIT');console.log(`Imported ${customers.length} synthetic customers; service-area rows validated=${areas.length} (polygon import requires reviewed coordinates).`);}catch(error){await pool.query('ROLLBACK').catch(()=>{});throw error;}finally{await pool.end();}
