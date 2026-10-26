// Real HTTP + disposable PostgreSQL; run explicitly as documented in the verification file.
import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';import {once} from 'node:events';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import pg from '../services/routefit/node_modules/pg/lib/index.js';
import {localFixture} from '../services/routefit/db/local-fixture.mjs';
import {apiServer} from '../services/routefit/application/http.mjs';
import {developmentAuth,digest} from '../services/routefit/adapters/development-auth.mjs';
import {localBrowser,createBrowserGrant} from '../services/routefit/adapters/local-browser.mjs';
import {FeeClient} from './fee-api-client.mjs';import {feeDTO,trialDTO} from './fee-api-model.mjs';
if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('Set a local disposable ROUTEFIT_TEST_DATABASE_URL');
test('frontend client with real pricing HTTP and PostgreSQL',async t=>{
 const f=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL),dir=await mkdtemp(join(tmpdir(),'rf011-http-')),sessionsFile=join(dir,'sessions.json');
 const sessions=[...f.principals,{...f.principals[0]}].map((p,i)=>({...p,tokenHash:digest(randomBytes(32).toString('hex')),csrfHash:digest(randomBytes(32).toString('hex')),permissions:i===2?['pricing:read']:['pricing:read','pricing:write'],expiresAt:new Date(Date.now()+600000).toISOString()}));
 await writeFile(sessionsFile,JSON.stringify(sessions),{mode:0o600});const pool=new pg.Pool({connectionString:f.runtimeUrl,max:5});let auth,access;
 const server=apiServer({pool,authenticate:req=>auth(req),localAccess:(...a)=>access(...a)});server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;auth=developmentAuth(sessions,origin);access=localBrowser({origin,root:fileURLToPath(new URL('../',import.meta.url)),sessionsFile,authenticate:auth,pool});
 async function actor(index){const g=await createBrowserGrant({sessionsFile,origin,actor:index});const r=await fetch(g.url,{redirect:'manual'});const cookie=r.headers.get('set-cookie').split(';')[0];const state={lost:false,posts:[],cookie};state.fetch=async(path,init={})=>{const r=await fetch(origin+path,{...init,headers:{...init.headers,Origin:origin,Cookie:state.cookie}});if(init.method==='POST'){state.posts.push({path,body:init.body,key:init.headers['Idempotency-Key'],etag:init.headers['If-Match'],status:r.status,replayed:r.headers.get('Idempotency-Replayed')});if(state.lost){state.lost=false;await r.text();throw Error('deliberately lost response after real DB commit');}}return r;};state.client=new FeeClient(state.fetch);await state.client.connect();return state;}
 try{
  const a=await actor(0),b=await actor(1),readonly=await actor(2),c=a.client;const catalog=(await c.get('/catalog')).data;assert.equal(catalog.length,19);
  let tariff,trial;
  await t.test('create/save/reread real database and exact insurance totals',async()=>{
   tariff=(await c.mutate('/tariffs',{name:'RF011 synthetic',owner:'DR',currency:'USD',scope:'DEMO'})).data;
   const fixed=feeDTO({code:'base',enabled:true,method:'fixed',amount:'2.00',scope:'DEMO',evidence:'synthetic',share:true},catalog.find(x=>x.code==='base'),'DR','USD');
   tariff=(await c.mutate('/tariffs/'+tariff.id+'/actions/save-fee',fixed,'"1"')).data;
   const insurance=feeDTO({code:'insurance',enabled:true,method:'percent',amount:'1.25',scope:'DEMO',evidence:'synthetic',share:true},catalog.find(x=>x.code==='insurance'),'DR','USD');
   tariff=(await c.mutate('/tariffs/'+tariff.id+'/actions/save-fee',insurance,'"2"')).data;
   trial=(await c.mutate('/tariffs/'+tariff.id+'/trials',trialDTO(tariff.rules,[{code:'base'},{code:'insurance',value:'100.00'}],'USD'),'"3"')).data;
   assert.deepEqual([trial.totalMinor,trial.shareMinor,trial.insuranceMinor,trial.separateMinor],[325,200,125,125]);assert.equal(trial.totalMinor,326);assert.equal((await c.get('/tariffs/'+tariff.id)).data.version,3);
  });
  await t.test('lost successful response replays same operation once in database',async()=>{
   const r=tariff.rules.find(x=>x.code==='base');a.lost=true;await assert.rejects(c.mutate('/tariffs/'+tariff.id+'/actions/save-fee',{...r,amount:300},'"3"'));assert.ok(c.pending);
   await assert.rejects(c.mutate('/tariffs/'+tariff.id+'/actions/save-fee',{...r,amount:999},'"3"'));
   const result=await c.retry();assert.equal(result.replayed,true);assert.equal(result.data.version,4);assert.equal(result.data.rules.find(x=>x.code==='base').amount,300);assert.equal(c.pending,null);
   const [first,retry]=a.posts.slice(-2);assert.deepEqual({...first,status:0,replayed:0},{...retry,status:0,replayed:0});
  });
  await t.test('stale version is 412, old snapshot/history unchanged',async()=>{
   await assert.rejects(c.mutate('/tariffs/'+tariff.id+'/actions/save-fee',tariff.rules[0],'"3"'),e=>e.status===412&&e.code==='VERSION_CONFLICT');assert.equal(c.pending,null);
   assert.deepEqual((await c.get('/trials/'+trial.id)).data,trial);const history=(await c.get('/tariffs/'+tariff.id+'/revisions?limit=2')).data;assert.equal(history.items.length,2);assert.equal(history.nextAfterVersion,3);assert.equal((await c.get('/tariffs/'+tariff.id+'/revisions?limit=2&afterVersion=3')).data.items[0].version,2);
  });
  await t.test('unknown/disabled/duplicate fees cannot create snapshots',async()=>{
   for(const lines of [[{code:'weight',quantityMilli:1000,basisMinor:null}],[{code:'base',quantityMilli:null,basisMinor:null},{code:'base',quantityMilli:null,basisMinor:null}]])await assert.rejects(c.mutate('/tariffs/'+tariff.id+'/trials',{lines},'"4"'),e=>e.status===422);
   const disabled={...tariff.rules.find(x=>x.code==='base'),enabled:false};await c.mutate('/tariffs/'+tariff.id+'/actions/save-fee',disabled,'"4"');await assert.rejects(c.mutate('/tariffs/'+tariff.id+'/trials',{lines:[{code:'base',quantityMilli:null,basisMinor:null}]},'"5"'),e=>e.status===422);
  });
  await t.test('permissions and tenant isolation, then expired browser session',async()=>{
   await assert.rejects(b.client.get('/tariffs/'+tariff.id),e=>e.status===404);assert.equal((await b.client.get('/tariffs')).data.items.length,0);
   await assert.rejects(readonly.client.mutate('/tariffs',{name:'forbidden'}),e=>e.status===403);assert.equal(readonly.posts.length,0);
   a.cookie='rf_session=invalid';await assert.rejects(c.connect(),e=>e.status===401);
  });
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();await f.cleanup();await rm(dir,{recursive:true,force:true});}
});
