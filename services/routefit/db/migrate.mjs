import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import pg from 'pg';

export async function migrate(pool){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('routefit-schema-migrations',0))");
  await client.query('CREATE TABLE IF NOT EXISTS public.routefit_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir(new URL('./migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort()){
   const sql=await readFile(new URL('./migrations/'+name,import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
   const previous=(await client.query('SELECT sha256 FROM public.routefit_migrations WHERE name=$1',[name])).rows[0];
   if(previous){if(previous.sha256!==hash)throw Error('Migration checksum changed: '+name);continue;}
   await client.query(sql);await client.query('INSERT INTO public.routefit_migrations(name,sha256) VALUES($1,$2)',[name,hash]);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.env.ROUTEFIT_MIGRATION_DATABASE_URL)throw Error('ROUTEFIT_MIGRATION_DATABASE_URL is required; never use the API account for migrations');
 const pool=new pg.Pool({connectionString:process.env.ROUTEFIT_MIGRATION_DATABASE_URL});
 try{await migrate(pool);console.log('Migrations applied and checksums verified');}finally{await pool.end();}
}
