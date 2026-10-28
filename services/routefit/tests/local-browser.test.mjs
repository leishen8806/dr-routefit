import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localBrowser,createBrowserGrant} from '../adapters/local-browser.mjs';
import {digest} from '../adapters/development-auth.mjs';

const origin='http://127.0.0.1:4180';
const root=new URL('../../../',import.meta.url).pathname;
const sessionsFile=new URL('../.local/sessions.json',import.meta.url).pathname;
const principal={browser:true,companyId:'60676152-92f2-4937-bc8c-1abb5c6f6c17',principalId:'9742d6c8-6668-4af3-92ef-72f735cab2c5'};
const request=(url='/dev/database-name',over={})=>({socket:{remoteAddress:'127.0.0.1'},...over,headers:{host:'127.0.0.1:4180',...(over.headers||{})},url,method:over.method||'GET'});
const response=()=>{const headers={};return {headers,status:null,body:null,setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(body){this.body=body;}};};
const access=localBrowser({origin,root,sessionsFile,authenticate:req=>req.headers.cookie?principal:{...principal,browser:false},pool:{query:async()=>({rows:[{database:'routefit_rf030_test'}]})}});
const trialAccess=localBrowser({origin,root,sessionsFile,trialMode:true,authenticate:req=>req.headers.cookie?principal:{...principal,browser:false},pool:{query:async()=>({rows:[{database:'routefit_rf030_test'}]})}});

test('database-name requires a browser session',async()=>{
 await assert.rejects(()=>access(request(),response(),()=>{}),{code:'BROWSER_SESSION_REQUIRED',status:401});
});

test('database-name rejects POST and query parameters before authentication',async()=>{
 await assert.rejects(()=>access(request('/dev/database-name?x=1',{method:'GET',headers:{cookie:'rf_session=browser'}}),response(),()=>{}),{code:'METHOD_NOT_ALLOWED',status:405});
 await assert.rejects(()=>access(request('/dev/database-name',{method:'POST',headers:{cookie:'rf_session=browser'}}),response(),()=>{}),{code:'METHOD_NOT_ALLOWED',status:405});
});

test('database-name returns current_database for a browser session',async()=>{
 const res=response();
 const send=(status,body)=>{res.status=status;res.body=JSON.stringify(body);};
 assert.equal(await access(request('/dev/database-name',{headers:{cookie:'rf_session=browser'}}),res,send),true);
 assert.equal(res.status,200);
 assert.deepEqual(JSON.parse(res.body),{database:'routefit_rf030_test'});
});
test('trial mode blocks demo HTML but allows database page assets',async()=>{
 await assert.rejects(()=>trialAccess(request('/prototype/index.html',{headers:{cookie:'rf_session=browser'}}),response(),()=>{}),{code:'NOT_FOUND',status:404});
 for(const path of ['/prototype/orders.html','/prototype/orders.mjs','/prototype/app.css']){const res=response();assert.equal(await trialAccess(request(path,{headers:{cookie:'rf_session=browser'}}),res,()=>{}),true);assert.equal(res.status,200);}
});
test('activation redirect changes only in trial mode',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rf038-browser-')),file=join(dir,'sessions.json'),token='synthetic-token';
 const session={companyId:principal.companyId,principalId:principal.principalId,tokenHash:digest(token),csrfHash:digest('csrf'),permissions:[],expiresAt:new Date(Date.now()+3600000).toISOString()};
 await writeFile(file,JSON.stringify([session]));
 const make=trialMode=>{const auth=req=>req.headers.cookie?principal:{...principal,browser:false};auth.source=()=>principal;auth.issue=()=>({token:'browser-token',session:{expiresAt:new Date(Date.now()+3600000).toISOString()}});auth.revoke=()=>{};return localBrowser({origin,root,sessionsFile:file,trialMode,authenticate:auth,pool:{connect:async()=>({query:async()=>({rows:[{id:principal.principalId}],rowCount:1}),release(){}})}});};
 try{
  for(const [trial,next] of [[false,'/prototype/'],[true,'/prototype/orders.html']]){const accessMode=make(trial),grant=await createBrowserGrant({sessionsFile:file,origin}),res=response(),send=(status,body,headers)=>{res.status=status;res.body=body;Object.assign(res.headers,headers||{});};const req=request(new URL(grant.url).pathname+new URL(grant.url).search);assert.equal(await accessMode(req,res,send),true);assert.equal(res.status,303);assert.equal(res.headers.Location,next);}
 }finally{await rm(dir,{recursive:true,force:true});}
});
