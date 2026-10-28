import test from 'node:test';
import assert from 'node:assert/strict';
import {localBrowser} from '../adapters/local-browser.mjs';

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
