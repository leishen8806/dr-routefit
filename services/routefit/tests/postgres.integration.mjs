import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {mkdtemp,writeFile,unlink,rmdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';
import {migrate} from '../db/migrate.mjs';
import {apiServer,routes} from '../application/http.mjs';
import {developmentAuth,digest} from '../adapters/development-auth.mjs';
import {assertRuntimeRole,transaction} from '../adapters/postgres.mjs';
import {specification,validate} from '../adapters/contract.mjs';
import {createBrowserGrant,localBrowser} from '../adapters/local-browser.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL must point to a local disposable PostgreSQL cluster administrator');
test('real PostgreSQL HTTP pricing slice',async t=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 let pool,server,origin;
 const actors=fixture.principals.map((p,index)=>({...p,token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),permissions:index===0?['pricing:read','pricing:write','session:logout']:['pricing:read','pricing:write']}));
 actors.push({...actors[0],token:randomBytes(32).toString('hex'),permissions:['pricing:read']});
 const browserDir=await mkdtemp(join(tmpdir(),'routefit-browser-')),sessionsFile=join(browserDir,'sessions.json');
 async function start(){
  pool=new pg.Pool({connectionString:fixture.runtimeUrl,max:5});await assertRuntimeRole(pool);
  const sessions=actors.map(a=>({...a,tokenHash:digest(a.token),csrfHash:digest(a.csrf),expiresAt:new Date(Date.now()+600000).toISOString()}));
  await writeFile(sessionsFile,JSON.stringify(sessions));
  let auth,access;server=apiServer({pool,authenticate:Object.assign(r=>auth(r),{revoke:principal=>auth.revoke(principal)}),localAccess:(...args)=>access(...args)});server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;auth=developmentAuth(sessions,origin);
  access=localBrowser({origin,root:fileURLToPath(new URL('../../../',import.meta.url)),sessionsFile,authenticate:auth,pool});
 }
 async function stop(){if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pool?.end();server=null;pool=null;}
 async function req(path,{body,actor=0,key=randomUUID(),version,headers={},method=body===undefined?'GET':'POST',raw}={}){
  const a=actors[actor];const response=await fetch(origin+'/api/ops/v1/pricing'+path,{method,headers:{Cookie:`rf_session=${a.token}`,Origin:origin,'X-CSRF-Token':a.csrf,'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{}),...headers},...(method==='POST'?{body:raw??JSON.stringify(body)}:{})});
  const data=await response.json();
  if(response.ok){const route=routes.find(r=>r.method===method&&r.pattern.test(path.split('?')[0]));validate(route.schema,data);}else validate('ApiError',data);
  return {status:response.status,data,headers:response.headers};
 }
 const create={name:'Synthetic tariff',owner:'DR',currency:'USD',scope:'DEMO only'},fee={code:'base',enabled:true,method:'fixed',amount:200,unit:null,includedMilli:0,stepMilli:1000,share:true,scope:'DEMO',evidence:'Synthetic evidence'};
 let tariff,trial;
 try{
  await start();
  await t.test('migration checksum replay and safe runtime role',async()=>{
   await migrate(fixture.owner);const migrations=(await readdir(new URL('../db/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql'));assert.equal((await fixture.owner.query('SELECT count(*) FROM public.routefit_migrations')).rows[0].count,String(migrations.length));
   await assert.rejects(assertRuntimeRole(fixture.owner),{code:'UNSAFE_DATABASE_ROLE'});
   assert.equal((await pool.query('SELECT count(*) FROM org.company')).rows[0].count,'0');
  });
  await t.test('authentication, permission, CSRF, unknown fields and malformed JSON',async()=>{
   assert.equal((await req('/catalog',{headers:{Cookie:''}})).status,401);
   assert.equal((await req('/tariffs',{body:create,actor:2})).status,403);
   assert.equal((await req('/tariffs',{body:create,headers:{'X-CSRF-Token':'invalid'}})).status,403);
   assert.equal((await req('/tariffs',{body:create,headers:{Origin:'http://evil.test'}})).status,403);
   assert.equal((await req('/tariffs',{body:{...create,companyId:actors[1].companyId}})).status,422);
   assert.equal((await req('/tariffs',{body:create,raw:'{'})).status,400);
   assert.equal((await req('/tariffs',{body:create,headers:{'Content-Type':'text/plain'}})).status,415);
   assert.equal((await req('/tariffs',{body:create,raw:JSON.stringify({...create,name:'x'.repeat(70000)})})).status,413);
   assert.equal((await req('/tariffs',{body:create,headers:{'Idempotency-Key':'short'}})).status,428);
   assert.equal((await req('/catalog')).data.length,19);
  });
  await t.test('concurrent duplicate creation persists once and replays original',async()=>{
   const key=randomUUID(),results=await Promise.all([req('/tariffs',{body:create,key}),req('/tariffs',{body:create,key})]);
   assert.deepEqual(results.map(x=>x.status),[201,201]);assert.deepEqual(results[0].data,results[1].data);
   assert.deepEqual(results.map(x=>x.headers.get('Idempotency-Replayed')).sort(),['false','true']);tariff=results[0].data;
   assert.equal((await req('/tariffs',{body:{...create,name:'different'},key})).status,409);
   assert.equal((await fixture.owner.query('SELECT count(*) FROM pricing.tariff')).rows[0].count,'1');
  });
  await t.test('ambiguous JSON and invalid UTF-8 cannot create financial configuration',async()=>{
   const counts=async()=> (await fixture.owner.query('SELECT (SELECT count(*) FROM pricing.tariff) AS tariffs,(SELECT count(*) FROM pricing.tariff_revision) AS revisions,(SELECT count(*) FROM pricing.trial) AS trials,(SELECT count(*) FROM integration.http_request_result) AS requests')).rows[0];
   const before=await counts();
   for(const raw of [
    '{"name":"first","name":"last","owner":"DR","currency":"USD","scope":"DEMO"}',
    '{"name":"first","na\\u006de":"last","owner":"DR","currency":"USD","scope":"DEMO"}',
    Buffer.concat([Buffer.from('{"name":"'),Buffer.from([0xff]),Buffer.from('","owner":"DR","currency":"USD","scope":"DEMO"}')])
   ]){
    const result=await req('/tariffs',{body:create,raw});assert.equal(result.status,400);assert.equal(result.data.error.code,'INVALID_JSON');
   }
   for(const [path,raw] of [
    [`/tariffs/${tariff.id}/actions/save-fee`,JSON.stringify(fee).replace('"amount":200','"amount":200,"amount":999')],
    [`/tariffs/${tariff.id}/trials`,'{"lines":[{"code":"base","code":"insurance","quantityMilli":null,"basisMinor":null}]}']
   ]){
    const result=await req(path,{body:create,raw,version:tariff.version});assert.equal(result.status,400);assert.equal(result.data.error.code,'INVALID_JSON');
   }
   assert.deepEqual(await counts(),before);
  });
  await t.test('optimistic concurrency allows one of two independent edits',async()=>{
   const path=`/tariffs/${tariff.id}/actions/save-fee`;
   const results=await Promise.all([req(path,{body:fee,version:1}),req(path,{body:{...fee,amount:300},version:1})]);
   assert.deepEqual(results.map(x=>x.status).sort(),[200,412]);tariff=results.find(x=>x.status===200).data;assert.equal(tariff.version,2);
   const normalized=await req(path,{body:fee,version:2});assert.equal(normalized.status,200);tariff=normalized.data;
  });
  await t.test('successful retry replays before stale-version checks and fingerprints If-Match',async()=>{
   const key=randomUUID(),version=tariff.version,path=`/tariffs/${tariff.id}/actions/save-fee`;
   const first=await req(path,{body:fee,version,key});assert.equal(first.status,200);tariff=first.data;
   const replay=await req(path,{body:fee,version,key});assert.deepEqual(replay.data,first.data);assert.equal(replay.headers.get('Idempotency-Replayed'),'true');
   assert.equal((await req(path,{body:fee,version:tariff.version,key})).status,409);
  });
  await t.test('invalid monetary configuration rolls back all writes',async()=>{
   const count=async()=> (await fixture.owner.query('SELECT (SELECT count(*) FROM pricing.tariff_revision) AS revisions,(SELECT count(*) FROM integration.http_request_result) AS requests')).rows[0];
   const before=await count();const result=await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:{...fee,code:'insurance'},version:tariff.version});
   assert.equal(result.status,422);assert.deepEqual(await count(),before);assert.equal((await req(`/tariffs/${tariff.id}`)).data.version,tariff.version);
  });
  await t.test('integer calculation creates a permanent version-bound simulation',async()=>{
   for(const rule of [{...fee,code:'weight',method:'unit',unit:'kg',amount:100,includedMilli:1000},{...fee,code:'insurance',method:'percent',amount:125,share:false}]){
    const r=await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:rule,version:tariff.version});assert.equal(r.status,200);tariff=r.data;
   }
   const input={lines:[{code:'base',quantityMilli:null,basisMinor:null},{code:'weight',quantityMilli:1001,basisMinor:null},{code:'insurance',quantityMilli:null,basisMinor:10000}]};
   const r=await req(`/tariffs/${tariff.id}/trials`,{body:input,version:tariff.version});assert.equal(r.status,201);trial=r.data;
   assert.deepEqual([trial.totalMinor,trial.shareMinor,trial.insuranceMinor,trial.separateMinor],[425,300,125,125]);
   assert.equal((await req(`/tariffs/${tariff.id}`)).data.version,tariff.version);
   assert.equal((await req(`/tariffs/${tariff.id}/trials`,{body:{lines:[input.lines[0],input.lines[0]]},version:tariff.version})).status,422);
   assert.equal((await req(`/tariffs/${tariff.id}/trials`,{body:input,version:1})).status,412);
   const updated=await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:{...fee,amount:999},version:tariff.version});tariff=updated.data;
   assert.deepEqual((await req(`/trials/${trial.id}`)).data,trial);
  });
  await t.test('company isolation is enforced by both HTTP and runtime PostgreSQL RLS',async()=>{
   for(const path of [`/tariffs/${tariff.id}`,`/trials/${trial.id}`,`/tariffs/${tariff.id}/revisions`])assert.equal((await req(path,{actor:1})).status,404);
   assert.equal((await req(`/tariffs/${tariff.id}/actions/save-fee`,{actor:1,body:fee,version:tariff.version})).status,404);
   assert.equal((await req('/tariffs',{actor:1})).data.items.length,0);
   const rows=await transaction(pool,actors[1],c=>c.query('SELECT * FROM pricing.tariff'));assert.equal(rows.rowCount,0);
   assert.equal((await pool.query('SELECT * FROM pricing.tariff')).rowCount,0);
   await assert.rejects(transaction(pool,actors[1],c=>c.query('INSERT INTO pricing.trial(id,company_id,tariff_id,tariff_version,principal_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),actors[1].companyId,tariff.id,trial.tariffVersion,actors[1].principalId,{}])),e=>e.code==='23503');
  });
  await t.test('database constraints protect excluded shares and append-only evidence',async()=>{
   await assert.rejects(fixture.owner.query("UPDATE pricing.fee_rule SET share=true WHERE code='insurance'"),e=>e.code==='23514');
   for(const table of ['pricing.tariff_revision','pricing.trial','integration.http_request_result'])await assert.rejects(fixture.owner.query(`DELETE FROM ${table}`),e=>e.code==='42501');
   await assert.rejects(transaction(pool,actors[0],c=>c.query('DELETE FROM pricing.tariff')),e=>e.code==='42501');
  });
  await t.test('pagination, exact routes, and ETag preserve resource version',async()=>{
   assert.equal((await req('/tariffs?limit=0')).status,422);assert.equal((await req('/tariffs?limit=1&limit=2')).status,422);
   assert.equal((await req('/tariffs?companyId=spoof')).status,422);assert.equal((await req('/catalog',{method:'DELETE'})).status,405);
   assert.equal((await req(`/tariffs/${randomUUID()}`)).status,404);
   const first=await req(`/tariffs/${tariff.id}/revisions?limit=1`);assert.equal(first.data.items[0].version,tariff.version);
   const second=await req(`/tariffs/${tariff.id}/revisions?limit=1&afterVersion=${first.data.nextAfterVersion}`);assert.equal(second.data.items[0].version,tariff.version-1);
   assert.equal((await req(`/tariffs/${tariff.id}`)).headers.get('ETag'),`"${tariff.version}"`);
   assert.equal((await req(`/tariffs/${tariff.id.toUpperCase()}`)).data.id,tariff.id);
  });
  await t.test('disabled identities cannot replay past successful operations',async()=>{
   const key=randomUUID();assert.equal((await req('/tariffs',{body:create,key})).status,201);
   await fixture.owner.query("UPDATE org.principal SET status='DISABLED' WHERE id=$1",[actors[0].principalId]);
   assert.equal((await req('/tariffs',{body:create,key})).status,401);
   await fixture.owner.query("UPDATE org.principal SET status='ACTIVE' WHERE id=$1",[actors[0].principalId]);
  });
  await t.test('new server and new connection pool read persisted snapshots',async()=>{
   await stop();await start();assert.deepEqual((await req(`/trials/${trial.id}`)).data,trial);
   assert.equal((await req(`/tariffs/${tariff.id}`)).data.version,tariff.version);
  });
  await t.test('one-use browser activation, same-origin HTTP, CSRF and logout',async()=>{
   const grant=await createBrowserGrant({sessionsFile,origin});
   const results=await Promise.all([fetch(grant.url,{redirect:'manual'}),fetch(grant.url,{redirect:'manual'})]);
   assert.deepEqual(results.map(r=>r.status).sort(),[303,401]);
   const activated=results.find(r=>r.status===303),cookieHeader=activated.headers.get('set-cookie'),cookie=cookieHeader.split(';')[0];
   assert.match(cookieHeader,/HttpOnly/);assert.match(cookieHeader,/SameSite=Strict/);assert.equal(activated.headers.get('location'),'/prototype/');assert.equal(activated.headers.get('referrer-policy'),'no-referrer');
   let response=await fetch(origin+'/dev/session',{headers:{Cookie:cookie}});assert.equal(response.status,200);const session=await response.json();assert.equal(session.companyId,actors[0].companyId);assert.equal(session.mode,'local-development');assert.ok(session.csrfToken.length>=32);assert.equal(session.token,undefined);
   const createHeaders={Cookie:cookie,Origin:origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()};
   response=await fetch(origin+'/api/ops/v1/pricing/tariffs',{method:'POST',headers:createHeaders,body:JSON.stringify(create)});assert.equal(response.status,403);
   response=await fetch(origin+'/api/ops/v1/pricing/tariffs',{method:'POST',headers:{...createHeaders,'X-CSRF-Token':session.csrfToken},body:JSON.stringify(create)});assert.equal(response.status,201);
   assert.equal((await fetch(origin+'/prototype/')).status,200);
   const localSpec=await (await fetch(origin+'/dev/openapi.json')).json();
   const localOperations=Object.values(localSpec.paths).flatMap(Object.values).filter(op=>op.operationId),implemented=Object.values(specification.paths).flatMap(Object.values).filter(op=>op['x-implementation-status']==='LOCAL_IMPLEMENTED_NOT_DEPLOYED');assert.deepEqual(localOperations.map(op=>op.operationId).sort(),implemented.map(op=>op.operationId).sort());assert.ok(localOperations.every(op=>op.servers[0].url===origin));
   for(const path of ['/services/routefit/.local/dev.env','/prototype/records/x.html','/prototype/../services/routefit/main.mjs','/prototype/server.mjs','/brand/logo/../../services/routefit/main.mjs'])assert.equal((await fetch(origin+path)).status,404);
   const wrongHost=await new Promise((resolve,reject)=>{const r=httpRequest(origin+'/dev/session',{headers:{Cookie:cookie,Host:'evil.test'}},s=>{s.resume();resolve(s.statusCode);});r.on('error',reject);r.end();});assert.equal(wrongHost,403);
   assert.equal((await fetch(origin+'/dev/session',{headers:{Cookie:cookie,Origin:'http://127.0.0.1:4173'}})).status,403);
   assert.equal((await fetch(origin+'/prototype/',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
   response=await fetch(origin+'/api/ops/v1/session/actions/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:'{}'});const logoutBody=await response.text();assert.equal(response.status,204);assert.equal(logoutBody,'');assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
   assert.equal((await fixture.owner.query("SELECT status,response FROM integration.http_request_result WHERE path='/api/ops/v1/session/actions/logout'")).rows[0].status,204);
   assert.equal((await fetch(origin+'/dev/session',{headers:{Cookie:cookie}})).status,401);
  });
  await t.test('browser activation rejects expired grants and disabled identities; tenant B remains isolated',async()=>{
   const expired=await createBrowserGrant({sessionsFile,origin}),ticket=new URL(expired.url).searchParams.get('ticket');
   await writeFile(join(browserDir,'browser-grants',digest(ticket)+'.json'),JSON.stringify({source:digest(actors[0].token),origin,expiresAt:Date.now()-1}));
   assert.equal((await fetch(expired.url,{redirect:'manual'})).status,401);
   const disabled=await createBrowserGrant({sessionsFile,origin});await fixture.owner.query("UPDATE org.principal SET status='DISABLED' WHERE id=$1",[actors[0].principalId]);
   assert.equal((await fetch(disabled.url,{redirect:'manual'})).status,401);await fixture.owner.query("UPDATE org.principal SET status='ACTIVE' WHERE id=$1",[actors[0].principalId]);
   const b=await createBrowserGrant({sessionsFile,origin,actor:1}),response=await fetch(b.url,{redirect:'manual'}),cookie=response.headers.get('set-cookie').split(';')[0];
   assert.equal((await fetch(origin+`/api/ops/v1/pricing/tariffs/${tariff.id}`,{headers:{Cookie:cookie}})).status,404);
   await stop();await start();assert.equal((await fetch(origin+'/dev/session',{headers:{Cookie:cookie}})).status,401);
  });
  await t.test('CLI uses RouteFit connection settings instead of another project environment',async()=>{
   const port=server.address().port;await stop();
   const dir=await mkdtemp(join(tmpdir(),'routefit-cli-')),file=join(dir,'session.json');
   await writeFile(file,JSON.stringify(actors.map(a=>({...a,tokenHash:digest(a.token),csrfHash:digest(a.csrf),expiresAt:new Date(Date.now()+60000).toISOString()}))));
   const child=spawn(process.execPath,['main.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),windowsHide:true,env:{...process.env,NODE_ENV:'development',ROUTEFIT_AUTH_MODE:'development',ROUTEFIT_DATABASE_URL:fixture.runtimeUrl,ROUTEFIT_SESSION_FILE:file,ROUTEFIT_PORT:String(port),ROUTEFIT_ALLOWED_ORIGIN:origin,DATABASE_URL:'postgresql://unused:unused@127.0.0.1:1/unrelated'},stdio:['ignore','pipe','pipe']});
   try{
    await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('CLI did not become ready')),10000);
     child.once('error',e=>{clearTimeout(timer);reject(e);});
     child.once('exit',()=>{clearTimeout(timer);reject(Error('CLI exited before ready'));});
     child.stdout.on('data',chunk=>{if(chunk.toString().includes('RouteFit local pricing API')){clearTimeout(timer);resolve();}});
    });
    assert.equal((await fetch(origin+'/health/ready')).status,200);
    assert.deepEqual((await req(`/trials/${trial.id}`)).data,trial);
   }finally{
    if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}
    await unlink(file);await rmdir(dir);
   }
  });
 }finally{await stop();await fixture.cleanup();await unlink(sessionsFile);await rmdir(join(browserDir,'browser-grants')).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(browserDir);}
});
