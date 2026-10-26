// Server-only sandbox adapter. Never import into the static demo or accept amounts from a browser.
import {createHmac} from 'node:crypto';
import {amountMinor} from '../prototype/finance-ledger.mjs';
export const KESS_SANDBOX='https://devwebpayment.kesspay.io';
const requireValue=(ok,message)=>{if(!ok)throw Error(message)};
export function signKess(params,key){
 const text=Object.keys(params).sort().filter(k=>k!=='sign'&&params[k]!==null&&params[k]!==undefined&&params[k]!==''&&typeof params[k]!=='object').map(k=>`${k}=${String(params[k]).trim()}`).join('&');
 return createHmac('sha256',key).update(`${text}&key=${key}`).digest('hex');
}
export function validateKessOrder(data,expected,sellerCode){
 requireValue(data&&data.out_trade_no===expected.tradeNo&&data.seller?.code===sellerCode,'KESS_ORDER_OR_MERCHANT_MISMATCH');
 requireValue(data.currency===expected.currency&&amountMinor(String(data.total_amount),data.currency)===expected.amountMinor,'KESS_AMOUNT_MISMATCH');
 requireValue(['WAITING','SUCCESS','CLOSED','FAILED','REFUNDED','PENDING_REFUNDED','PARTIAL_REFUNDED'].includes(data.status),'KESS_UNKNOWN_STATUS');
 if(data.status==='SUCCESS')requireValue(typeof data.transaction_id==='string'&&data.transaction_id.trim().length>0,'KESS_MISSING_TRANSACTION');
 return {tradeNo:expected.tradeNo,amountMinor:expected.amountMinor,currency:data.currency,status:data.status,transactionId:data.transaction_id||null,paidAt:data.paid_at||null,settledAt:data.settled_at||null};
}
export function createKessSandboxClient(config,{fetchImpl=fetch,clock=Date.now}={}){
 for(const name of ['clientId','clientSecret','username','password','secretKey','sellerCode'])requireValue(typeof config[name]==='string'&&config[name].trim(),`KESS_CONFIG_REQUIRED:${name}`);
 requireValue(!config.baseUrl||config.baseUrl===KESS_SANDBOX,'KESS_SANDBOX_ONLY');
 let token,expires=0;
 async function post(path,body,access){
  let response;try{response=await fetchImpl(KESS_SANDBOX+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(access?{Authorization:`Bearer ${access}`}:{})},body:JSON.stringify(body)});}catch{throw Error('KESS_RESULT_UNKNOWN_QUERY_ORIGINAL');}
  requireValue(response.ok,`KESS_HTTP_${response.status}_QUERY_ORIGINAL`);
  let result;try{result=await response.json();}catch{throw Error('KESS_INVALID_RESPONSE_QUERY_ORIGINAL');}return result;
 }
 async function access(){if(token&&clock()<expires)return token;const r=await post('/oauth/token',{grant_type:'password',client_id:config.clientId,client_secret:config.clientSecret,username:config.username,password:config.password});requireValue(typeof r.access_token==='string'&&r.token_type==='Bearer'&&Number(r.expires_in)>30,'KESS_AUTH_INVALID');token=r.access_token;expires=clock()+(Number(r.expires_in)-30)*1000;return token;}
 async function gateway(params){const r=await post('/api/mch/v2/gateway',{...params,sign:signKess(params,config.secretKey)},await access());requireValue(r.success===true&&r.data,'KESS_REJECTED_QUERY_ORIGINAL');return r.data;}
 function check(expected){requireValue(/^[A-Za-z0-9-]{1,32}$/.test(expected.tradeNo),'KESS_TRADE_NO_INVALID');requireValue(['USD','KHR'].includes(expected.currency)&&Number.isSafeInteger(expected.amountMinor)&&expected.amountMinor>0&&expected.amountMinor<=1e11,'KESS_MONEY_INVALID');}
 return {
  async create(expected){check(expected);const amount=expected.currency==='USD'?`${Math.floor(expected.amountMinor/100)}.${String(expected.amountMinor%100).padStart(2,'0')}`:String(expected.amountMinor);
   // Public V2 examples use createorder, while the field table says createOrder; confirm with the merchant sandbox before release.
   const d=await gateway({service:'webpay.acquire.createorder',sign_type:'HMAC-SHA256',seller_code:config.sellerCode,out_trade_no:expected.tradeNo,body:'DR RouteFit delivery',total_amount:amount,currency:expected.currency,login_type:'ANONYMOUS'});
   const result=validateKessOrder(d,expected,config.sellerCode);const link=new URL(d.payment_link);requireValue(link.origin===KESS_SANDBOX&&!link.username&&!link.password&&link.pathname.startsWith('/pay/'),'KESS_PAYMENT_LINK_REJECTED');return {...result,paymentLink:link.href};
  },
  async query(expected){check(expected);return validateKessOrder(await gateway({service:'webpay.acquire.queryOrder',sign_type:'HMAC-SHA256',out_trade_no:expected.tradeNo}),expected,config.sellerCode);}
 };
}
