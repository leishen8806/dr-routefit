import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createKessSandboxClient,signKess,validateKessOrder,KESS_SANDBOX} from './kess-pay.mjs';
const config={clientId:'demo-client',clientSecret:'test-only',username:'test-user',password:'test-only',secretKey:'test-only',sellerCode:'DEMO-SELLER'};
const expected={tradeNo:'DR-TEST-1',amountMinor:1200,currency:'USD'};
const data={out_trade_no:'DR-TEST-1',seller:{code:config.sellerCode},total_amount:'12.00',currency:'USD',status:'WAITING',transaction_id:null,payment_link:KESS_SANDBOX+'/pay/test-only'};
test('KESS V2 HMAC signing sorts scalar fields, preserves zero, excludes sign/nested/null',()=>{
 const params={z:0,a:' x ',blank:'',missing:null,data:{ignored:true},sign:'old',sign_type:'HMAC-SHA256'};
 assert.equal(signKess(params,'test'),createHmac('sha256','test').update('a=x&sign_type=HMAC-SHA256&z=0&key=test').digest('hex'));
});
test('sandbox create/query use OAuth and documented service names without exposing credentials',async()=>{
 const calls=[];const client=createKessSandboxClient(config,{fetchImpl:async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>url.endsWith('/token')?{token_type:'Bearer',access_token:'private-token',expires_in:1800}:{success:true,data}};}});
 const created=await client.create(expected);await client.query(expected);assert.equal(calls.length,3);assert.equal(created.paymentLink,data.payment_link);assert.equal(JSON.parse(calls[1].body).total_amount,'12.00');assert.equal(JSON.parse(calls[1].body).service,'webpay.acquire.createorder');assert.equal(JSON.parse(calls[2].body).service,'webpay.acquire.queryOrder');assert.equal(calls[1].headers.Authorization,'Bearer private-token');assert.equal(calls[1].redirect,'error');assert.ok(!JSON.stringify(created).includes('private-token'));
});
test('reject wrong merchant, order, currency, amount, missing transaction and unknown status',()=>{
 for(const patch of [{seller:{code:'OTHER'}},{out_trade_no:'other'},{currency:'KHR'},{total_amount:'12.01'},{status:'SUCCESS'},{status:'SOMETHING'}])assert.throws(()=>validateKessOrder({...data,...patch},expected,config.sellerCode));
 assert.equal(validateKessOrder({...data,status:'SUCCESS',transaction_id:'TX1'},expected,config.sellerCode).transactionId,'TX1');
});
test('missing config and production host fail closed',()=>{
 assert.throws(()=>createKessSandboxClient({}),/CONFIG_REQUIRED/);assert.throws(()=>createKessSandboxClient({...config,baseUrl:'https://example.com'}),/SANDBOX_ONLY/);
});
test('unsafe links rejected and no automatic create retry on unknown result',async()=>{
 const client=createKessSandboxClient(config,{fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/token')?{token_type:'Bearer',access_token:'token',expires_in:1800}:{success:true,data:{...data,payment_link:'https://attacker.example/pay/a'}}})});await assert.rejects(()=>client.create(expected),/LINK_REJECTED/);
 let gatewayCalls=0;const timed=createKessSandboxClient(config,{fetchImpl:async url=>{if(url.endsWith('/token'))return {ok:true,json:async()=>({token_type:'Bearer',access_token:'token',expires_in:1800})};gatewayCalls++;throw Error('private detail');}});await assert.rejects(()=>timed.create(expected),/RESULT_UNKNOWN_QUERY_ORIGINAL/);assert.equal(gatewayCalls,1);
});
test('invalid amount and trade identifiers never contact provider',async()=>{
 const client=createKessSandboxClient(config,{fetchImpl:()=>{throw Error('must not call')}});for(const value of [0,-1,0.5,NaN])await assert.rejects(()=>client.create({...expected,amountMinor:value}),/MONEY_INVALID/);await assert.rejects(()=>client.query({...expected,tradeNo:'a/b'}),/TRADE_NO_INVALID/);
});
test('HTTP and invalid success results fail without leaking provider payload',async()=>{
 for(const response of [{ok:false,status:401},{ok:true,json:async()=>{throw Error('sensitive')}},{ok:true,json:async()=>({token_type:'Bearer',access_token:'token',expires_in:1800})}]){
 const client=createKessSandboxClient(config,{fetchImpl:async()=>response});await assert.rejects(()=>client.create(expected),/KESS_HTTP_401|KESS_INVALID_RESPONSE|KESS_REJECTED/);}
});
