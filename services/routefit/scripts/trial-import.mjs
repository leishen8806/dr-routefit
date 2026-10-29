import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import pg from 'pg';
import {parseCsv,rowsToObjects,sessionFileFor,trialDatabaseName} from './trial-common.mjs';
import {parseEnvironment} from './trial-ssh-link.mjs';
import {writeIntake} from '../adapters/intake.mjs';

export async function runTrialImport({env=process.env,Pool=pg.Pool}={}){
 const areaReason=String(env.ROUTEFIT_TRIAL_AREA_REASON||'').trim();if(!areaReason)throw Error('ROUTEFIT_TRIAL_AREA_REASON is required');
 const dir=env.ROUTEFIT_TRIAL_IMPORT_DIRECTORY||fileURLToPath(new URL('../.local/import/',import.meta.url));
 const csv=async name=>rowsToObjects(parseCsv(await readFile(join(dir,name),'utf8')),name);
 const customers=await csv('customers.csv');
 if(customers.some(x=>!x.name))throw Error('CSV validation failed; no rows were written');
 const areaFile=String(env.ROUTEFIT_TRIAL_SERVICE_AREAS_FILE||'').trim();
 if(env.ROUTEFIT_TRIAL==='1'&&!areaFile)throw Error('ROUTEFIT_TRIAL_SERVICE_AREAS_FILE is required in trial mode');
 const resolvedAreaFile=areaFile||join(dir,'service-areas.example.geojson');
 let geojson;
 try{geojson=JSON.parse(await readFile(resolvedAreaFile,'utf8'));}catch(error){throw Error(`service-area GeoJSON is required: ${resolvedAreaFile} (${error.message})`);}
 const features=geojson.type==='FeatureCollection'?geojson.features:(geojson.type==='Feature'?[geojson]:[]);
 if(!features.length)throw Error('service-area GeoJSON must contain at least one Feature');
 const drafts=features.map((feature,index)=>{const props=feature.properties||{},draft={name:props.name,type:props.type,polygon:feature.geometry,effectiveFrom:props.effectiveFrom||new Date().toISOString()};if(!draft.name||!['ALLOW','DENY'].includes(draft.type)||draft.polygon?.type!=='Polygon')throw Error(`service-area ${index+1} has invalid properties`);return draft;});
 let databaseUrl=env.ROUTEFIT_DATABASE_URL;if(env.ROUTEFIT_ADMIN_ENV_FILE){const adminEnv=parseEnvironment(await (await import('node:fs/promises')).readFile(env.ROUTEFIT_ADMIN_ENV_FILE,'utf8'));databaseUrl=adminEnv.ROUTEFIT_PG_ADMIN_URL||databaseUrl;const u=new URL(databaseUrl);u.pathname='/'+trialDatabaseName(env);databaseUrl=u.href;}
 const pool=new Pool({connectionString:databaseUrl});let imported=0;const client=await pool.connect();
 try{await client.query('BEGIN');const companyId=env.ROUTEFIT_TRIAL_COMPANY_ID||JSON.parse(await readFile(env.ROUTEFIT_TRIAL_COMPANY_FILE||fileURLToPath(new URL('../.local/trial-company.json',import.meta.url)),'utf8')).id;await client.query("SELECT set_config('app.company_id',$1,true)",[companyId]);const company=(await client.query("SELECT id FROM org.company WHERE id=$1 AND status='ACTIVE'",[companyId])).rows[0];if(!company)throw Error('no active company');
  const principal=(await client.query("SELECT id FROM org.principal WHERE company_id=$1 AND kind='SERVICE' AND idp_subject='system:trial-import' AND status='ACTIVE'",[company.id])).rows[0];if(!principal)throw Error('no active trial import system principal');
  for(const row of customers){const customer=(await client.query('INSERT INTO party.customer(id,company_id,name,status) VALUES(gen_random_uuid(),$1,$2,\'ACTIVE\') RETURNING id',[company.id,row.name])).rows[0];await client.query('INSERT INTO party.customer_access(company_id,customer_id,principal_id) SELECT $1,$2,id FROM org.principal WHERE company_id=$1 AND kind=\'STAFF\' AND status=\'ACTIVE\' AND idp_subject LIKE \'local:%\'',[company.id,customer.id]);imported++;}
  const published=[];for(const [index,draft] of drafts.entries()){try{const created=await writeIntake(client,{companyId:company.id,principalId:principal.id},'area-create',null,draft,null);published.push(await writeIntake(client,{companyId:company.id,principalId:principal.id},'area-publish',created.id,{reason:areaReason},created.version));}catch(error){throw Error(`service-area ${index+1} (${draft.name||'unnamed'}) import failed: ${error.message}`);}}
  await client.query('COMMIT');const coverageRevision=Number((await client.query('SELECT COALESCE(max(revision),0) AS revision FROM coverage.publication WHERE company_id=$1',[company.id])).rows[0].revision);return {customers:imported,areas:published.length,coverageRevision,principalId:principal.id};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production')throw Error('trial:import refuses NODE_ENV=production');
 const result=await runTrialImport();console.log(`Imported ${result.customers} synthetic customers and published ${result.areas} service areas at coverage revision ${result.coverageRevision} using system principal ${result.principalId}.`);
}
