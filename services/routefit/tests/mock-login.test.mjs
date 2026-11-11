import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mockLogin,mockLoginEnabled,MOCK_LOGIN_CODE} from '../adapters/mock-login.mjs';
import {developmentAuth,digest} from '../adapters/development-auth.mjs';

const origin='http://127.0.0.1:4180';
const company='60676152-92f2-4937-bc8c-1abb5c6f6c17';
const session=(name,permissions)=>({tokenHash:digest('src-'+name),csrfHash:digest('csrf-'+name),companyId:company,principalId:'9742d6c8-6668-4af3-92ef-72f735cab2c'+(name==='driver'?'1':'2'),permissions,expiresAt:new Date(Date.now()+86400000).toISOString()});
const driver=session('driver',['driver:tasks:read','driver:income:read']),customer=session('customer',['portal:session:read','portal:orders:read']);
const ops=session('ops',['pricing:read','orders:read']);
const identities=[{audience:'driver',phone:'+85510000001',tokenHash:driver.tokenHash},{audience:'customer',phone:'+85510000002',tokenHash:customer.tokenHash},{audience:'driver',phone:'+85510000009',tokenHash:ops.tokenHash}];
const devEnv={NODE_ENV:'development',ROUTEFIT_AUTH_MODE:'development',ROUTEFIT_MOCK_LOGIN:'1'};
const setup=(env=devEnv)=>{const authenticate=developmentAuth([driver,customer,ops],origin);return {authenticate,handler:mockLogin({env,identities,authenticate})};};
const call=async(handler,path,body,over={})=>{
 const raw=typeof body==='string'?body:JSON.stringify(body);
 const req=Object.assign(Readable.from([Buffer.from(raw)]),{method:'POST',url:path,socket:{remoteAddress:'127.0.0.1'},headers:{'content-type':'application/json',...(over.headers||{})},...over.req});
 let out=null;const send=(status,b)=>{out={status,body:b};};
 try{const handled=await handler(req,{},send);return {handled,...out};}catch(e){return {error:e};}
};
const D='/api/driver/v1/auth/mock-login',C='/api/customer/v1/auth/mock-login';

test('enabled only for explicit development/test with flag',()=>{
 assert.equal(mockLoginEnabled(devEnv),true);
 assert.equal(mockLoginEnabled({...devEnv,NODE_ENV:'test'}),true);
 for(const env of [{...devEnv,NODE_ENV:'production'},{...devEnv,NODE_ENV:'Production'},{...devEnv,NODE_ENV:undefined},{...devEnv,NODE_ENV:''},{...devEnv,NODE_ENV:'staging'},{...devEnv,ROUTEFIT_MOCK_LOGIN:undefined},{...devEnv,ROUTEFIT_MOCK_LOGIN:'true'},{...devEnv,ROUTEFIT_AUTH_MODE:'production'},{}])assert.equal(mockLoginEnabled(env),false,JSON.stringify(env));
});

test('production environment: endpoints are 404 even with correct code and flag',async()=>{
 const {handler}=setup({...devEnv,NODE_ENV:'production'});
 for(const path of [D,C]){const r=await call(handler,path,{phone:'+85510000001',code:MOCK_LOGIN_CODE});assert.equal(r.error.status,404);assert.equal(r.error.code,'NOT_FOUND');}
});

test('non-mock paths are passed through',async()=>{
 const {handler}=setup();const r=await call(handler,'/api/ops/v1/orders',{});assert.equal(r.handled,false);
});

test('driver login with fixed code returns bearer token usable only on driver paths',async()=>{
 const {handler,authenticate}=setup();
 const r=await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE});
 assert.equal(r.status,200);assert.equal(r.body.audience,'driver');assert.equal(r.body.tokenType,'Bearer');
 assert.match(r.body.accessToken,/^[0-9a-f]{64}$/);
 const req=(url,extra={})=>({method:'POST',url,headers:{authorization:'Bearer '+r.body.accessToken,...extra}});
 assert.equal(authenticate(req('/api/driver/v1/tasks')).principalId,driver.principalId);
 assert.throws(()=>authenticate(req('/api/ops/v1/orders')),{code:'FORBIDDEN'});
 assert.throws(()=>authenticate(req('/api/customer/v1/orders')),{code:'FORBIDDEN'});
 assert.throws(()=>authenticate(req('/api/driver/v1/tasks',{cookie:'rf_session=x'})),{code:'UNAUTHENTICATED'});
 assert.throws(()=>authenticate({method:'GET',url:'/api/driver/v1/tasks',headers:{authorization:'Bearer '+'0'.repeat(64)}}),{code:'UNAUTHENTICATED'});
});

test('customer login works and token is limited to customer paths',async()=>{
 const {handler,authenticate}=setup();
 const r=await call(handler,C,{phone:'+85510000002',code:MOCK_LOGIN_CODE});
 assert.equal(r.status,200);assert.equal(r.body.audience,'customer');
 assert.equal(authenticate({method:'GET',url:'/api/customer/v1/session',headers:{authorization:'Bearer '+r.body.accessToken}}).principalId,customer.principalId);
 assert.throws(()=>authenticate({method:'GET',url:'/api/driver/v1/tasks',headers:{authorization:'Bearer '+r.body.accessToken}}),{code:'FORBIDDEN'});
});

test('wrong code, unknown phone, wrong audience all give the same 401',async()=>{
 const {handler}=setup();
 const cases=[[D,{phone:'+85510000001',code:'000000'}],[D,{phone:'+85510000777',code:MOCK_LOGIN_CODE}],[C,{phone:'+85510000001',code:MOCK_LOGIN_CODE}],[D,{phone:'abc',code:MOCK_LOGIN_CODE}]];
 for(const [path,body] of cases){const r=await call(handler,path,body);assert.equal(r.error.status,401);assert.equal(r.error.code,'INVALID_CREDENTIALS');}
});

test('identity without matching permissions cannot get a token for that audience',async()=>{
 const {handler}=setup();
 const r=await call(handler,D,{phone:'+85510000009',code:MOCK_LOGIN_CODE});
 assert.equal(r.error.status,403);
});

test('mock tokens cannot be used as login source, and revoke works',async()=>{
 const {handler,authenticate}=setup();
 const r=await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE});
 assert.throws(()=>authenticate.source(digest(r.body.accessToken)),{code:'UNAUTHENTICATED'});
 const p=authenticate({method:'GET',url:'/api/driver/v1/x',headers:{authorization:'Bearer '+r.body.accessToken}});
 authenticate.revoke(p);
 assert.throws(()=>authenticate({method:'GET',url:'/api/driver/v1/x',headers:{authorization:'Bearer '+r.body.accessToken}}),{code:'UNAUTHENTICATED'});
});

test('request validation: method, media type, body shape, remote address, rate limit',async()=>{
 const {handler}=setup();
 assert.equal((await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE},{req:{method:'GET'}})).error.status,405);
 assert.equal((await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE},{headers:{'content-type':'text/plain'}})).error.status,415);
 assert.equal((await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE,role:'admin'})).error.status,422);
 assert.equal((await call(handler,D,'not json')).error.status,422);
 assert.equal((await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE},{req:{socket:{remoteAddress:'10.0.0.5'}}})).error.status,403);
 const authenticate=developmentAuth([driver],origin);let n=0;
 const limited=mockLogin({env:devEnv,identities,authenticate,rateLimit:()=>{if(++n>2)throw Object.assign(new Error('x'),{status:429});}});
 await call(limited,D,{phone:'+85510000001',code:'1'});await call(limited,D,{phone:'+85510000001',code:'1'});
 assert.equal((await call(limited,D,{phone:'+85510000001',code:'1'})).error.status,429);
});

// CMP-1466 SEC-1/2/3 regression tests
test('SEC-1: mock token cannot be used as rf_session cookie',async()=>{
 const {handler,authenticate}=setup();
 const r=await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE});
 assert.throws(()=>authenticate({method:'GET',url:'/api/ops/v1/orders',headers:{cookie:'rf_session='+r.body.accessToken}}),{code:'UNAUTHENTICATED'});
 assert.throws(()=>authenticate({method:'GET',url:'/api/driver/v1/tasks',headers:{cookie:'rf_session='+r.body.accessToken}}),{code:'UNAUTHENTICATED'});
});

test('SEC-2: path traversal in request target does not pass the prefix check',async()=>{
 const {handler,authenticate}=setup();
 const r=await call(handler,D,{phone:'+85510000001',code:MOCK_LOGIN_CODE});
 for(const url of ['/api/driver/v1/../../ops/v1/orders','/api/driver/v1/%2e%2e/%2e%2e/ops/v1/orders','/api/driver/v1/%2E%2e/x','/api/driver/v1/./tasks','/api/driver/v1/a%2f..%2f..%2fops','/api/driver/v1//..//x'])
  assert.throws(()=>authenticate({method:'GET',url,headers:{authorization:'Bearer '+r.body.accessToken}}),{code:'FORBIDDEN'},url);
 assert.equal(authenticate({method:'GET',url:'/api/driver/v1/tasks?x=1',headers:{authorization:'Bearer '+r.body.accessToken}}).principalId,driver.principalId);
});

test('SEC-3: mock session permissions are trimmed to the audience',async()=>{
 const mixed=session('driver',['driver:tasks:read','orders:read','pricing:write','portal:orders:read']);
 const authenticate=developmentAuth([mixed],origin);
 assert.deepEqual(authenticate.issueMock(mixed.tokenHash,'driver').session.permissions,['driver:tasks:read']);
 const mixed2=session('customer',['portal:orders:read','orders:read','finance:export']);
 const a2=developmentAuth([mixed2],origin);
 assert.deepEqual(a2.issueMock(mixed2.tokenHash,'customer').session.permissions,['portal:orders:read']);
});
