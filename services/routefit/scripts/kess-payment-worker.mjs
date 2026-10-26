// Explicit sandbox worker: never starts from the HTTP process and never accepts browser input.
import pg from 'pg';
import {createKessSandboxClient} from '../../../integrations/kess-pay.mjs';
import {transaction} from '../adapters/postgres.mjs';
import {paymentIntentExternalWork,recordKessPaymentResult,requestPaymentQuery} from '../adapters/payment-intents.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const required=name=>{const value=process.env[name];if(!value)throw Error(`${name} is required`);return value;};
const principal={companyId:required('ROUTEFIT_KESS_WORKER_COMPANY_ID'),principalId:required('ROUTEFIT_KESS_WORKER_PRINCIPAL_ID')};
if(!uuid.test(principal.companyId)||!uuid.test(principal.principalId))throw Error('KESS worker principal IDs must be UUIDs');
const client=createKessSandboxClient({clientId:required('KESS_CLIENT_ID'),clientSecret:required('KESS_CLIENT_SECRET'),username:required('KESS_USERNAME'),password:required('KESS_PASSWORD'),secretKey:required('KESS_SECRET_KEY'),sellerCode:required('KESS_SELLER_CODE')});
const pool=new pg.Pool({connectionString:required('ROUTEFIT_DATABASE_URL'),max:1});
try{
 const ids=await transaction(pool,principal,async c=>(await c.query("SELECT i.id FROM finance.payment_intent i JOIN LATERAL (SELECT state FROM finance.payment_intent_event e WHERE e.company_id=i.company_id AND e.intent_id=i.id ORDER BY version DESC LIMIT 1) e ON true WHERE i.company_id=$1 AND e.state IN ('creating','unknown','waiting') ORDER BY i.created_at LIMIT 10",[principal.companyId])).rows.map(r=>r.id));
 for(const id of ids){
  const work=await transaction(pool,principal,c=>paymentIntentExternalWork(c,principal,id));
  try{
   const result=work.state==='creating'?await client.create({tradeNo:work.tradeNo,amountMinor:work.amountMinor,currency:work.currency}):await client.query({tradeNo:work.tradeNo,amountMinor:work.amountMinor,currency:work.currency});
   await transaction(pool,principal,c=>recordKessPaymentResult(c,principal,id,result));
  }catch(error){
   await transaction(pool,principal,c=>requestPaymentQuery(c,principal,id,work.version)).catch(()=>{});
   console.error(JSON.stringify({paymentIntentId:id,error:'KESS_RESULT_UNKNOWN_QUERY_ORIGINAL'}));
  }
 }
}finally{await pool.end();}
