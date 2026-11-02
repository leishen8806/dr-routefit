import {createServer} from 'node:http';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {ApiError,ensure} from '../domain/errors.mjs';
import {catalog} from '../domain/pricing.mjs';
import {validate} from '../adapters/contract.mjs';
import {parseJson} from '../adapters/json.mjs';
import {orderRoutes} from './orders.mjs';
import {policyRoutes} from './policy.mjs';
import {intakeRoutes} from './intake.mjs';
import {quoteRoutes} from './quotes.mjs';
import {prepaymentRoutes} from './prepayment.mjs';
import {caseRoutes} from './cases.mjs';
import {financeRoutes} from './finance.mjs';
import {customerRoutes} from './customer.mjs';
import {dispatchRoutes} from './dispatch.mjs';
import {evidenceRoutes} from './evidence.mjs';
import {exceptionRoutes} from './exceptions.mjs';
import {partnerRoutes} from './partners.mjs';
import {bookingRoutes} from './bookings.mjs';
import {driverRoutes} from './driver.mjs';
import {custodyRoutes} from './custody.mjs';
import {deliveryRoutes} from './delivery.mjs';
import {integrationRoutes} from './integration.mjs';
import {publicRoutes} from './public.mjs';
import {warehouseRoutes} from './warehouse.mjs';
import {notificationRoutes} from './notifications.mjs';
import {accessRoutes} from './access.mjs';
import {merchantRoutes,partnerPortalRoutes} from './external-subjects.mjs';
import {exportRoutes} from './exports.mjs';
import {recipientRoutes} from './recipient.mjs';
import {authorizePrepayment,readPrepayment,writePrepayment} from '../adapters/prepayment.mjs';
import {createQuote,getQuote} from '../adapters/quotes.mjs';
import {readIntake,writeIntake} from '../adapters/intake.mjs';
import {getPolicy,listPublishedPolicies,submitPolicy,reviewOrPublishPolicy} from '../adapters/policy.mjs';
import {orderQuery,authorizedCustomer,currentCustomer,getOrder,getCustomerOrder,readOrders,writeOrder,writeOrderCancel} from '../adapters/orders.mjs';
import {caseQuery,readCases,writeCase} from '../adapters/cases.mjs';
import {documentQuery,driverIncomeQuery,ledgerQuery,moneyOverviewQuery,readDriverIncome,readFinance,readFinanceDocuments,readFinanceTasks,readLedgerReport,readMoneyOverview,readReceipt,readReceipts,receiptQuery,reportQuery,taskQuery,writeFinanceDocument,writeFinanceTask,writeReceipt} from '../adapters/finance.mjs';
import {createWorkflowDocument,readWorkflowDocuments,workflowDocument,writeWorkflowDocument} from '../adapters/finance-workflow.mjs';
import {channelSettlement,createChannelSettlement} from '../adapters/channel-settlements.mjs';
import {createPaymentIntent,paymentIntentQuery,readPaymentIntent,readPaymentIntents,requestPaymentQuery} from '../adapters/payment-intents.mjs';
import {customerSession,customerTimeline,timelineQuery,readCustomerEvidenceDownload,writeCustomerEvidence} from '../adapters/customer.mjs';
import {inviteCustomerMember,portalMemberQuery,readCustomerMembers,updateCustomerMember} from '../adapters/memberships.mjs';
import {externalSubjectQuery,readExternalSubject,requestExternalSettlement} from '../adapters/external-subjects.mjs';
import {createFinanceExport,readFinanceExport,serveFinanceExport} from '../adapters/exports.mjs';
import {createRecipientChallenge,recipientAcknowledgement,recipientBearer,recipientDelivery,recipientEvidenceWrite,recipientServiceRequest,verifyRecipientChallenge} from '../adapters/recipient.mjs';
import {dispatchQuery,readDispatch,writePromiseCheck,writePromise,writeLoadReview,writeAssignment} from '../adapters/dispatch.mjs';
import {readEvidenceDownload,serveEvidenceObject,writeEvidence} from '../adapters/evidence.mjs';
import {exceptionQuery,readExceptions,writeException} from '../adapters/exceptions.mjs';
import {createRescuePlan} from '../adapters/rescue.mjs';
import {partnerQuery,readPartners,writePartner} from '../adapters/partners.mjs';
import {readBooking,writeBooking} from '../adapters/bookings.mjs';
import {driverQuery,readDriver,readDriverEvidenceDownload,writeDriver,writeDriverEvidence,writeDriverLocations,writeDriverSync} from '../adapters/driver.mjs';
import {writeCustody} from '../adapters/custody.mjs';
import {readDelivery,writeDelivery} from '../adapters/delivery.mjs';
import {returnRoutes} from './returns.mjs';
import {writeReturn} from '../adapters/returns.mjs';
import {readOpsSnapshot} from '../adapters/integration.mjs';
import {importExternalOrder,readExternalImport,requestExternalDispatch,writeWmsStockEvent} from '../adapters/service-intake.mjs';
import {readPublicTracking} from '../adapters/public.mjs';
import {acceptWarehouseRequest,createCustomerWarehouseRequest,readCustomerWarehouseRequests,readWarehouseQueue,readWarehouseRequests,warehouseRequestQuery} from '../adapters/warehouse.mjs';
import {createStockReservation,inventoryQuery,readCustomerInventory,writeStockReservation} from '../adapters/inventory.mjs';
import {readNotification,writeNotification} from '../adapters/notifications.mjs';
import {accessGrantQuery,readAccessGrants,writeAccessGrant} from '../adapters/access.mjs';
import {readBankTransactions,writeBankTransaction} from '../adapters/bank.mjs';
import {cashHandoverQuery,readCashHandover,readCashHandovers,writeCashCount,writeDriverCashReport,writeDriverHandover} from '../adapters/cash.mjs';
import {acknowledgeCustomerStatement,customerFinanceRequestQuery,customerSettlementAccountQuery,customerStatementQuery,driverSettlementAccountQuery,driverWithdrawalQuery,opsSettlementAccountQuery,readCustomerFinanceRequests,readCustomerSettlementAccounts,readCustomerStatements,readDriverSettlementAccounts,readDriverWithdrawals,readOpsSettlementAccounts,readSettlement,requestCustomerRefund,requestDriverWithdrawal,settlementRuleQuery,statementQuery,writeSettlement} from '../adapters/settlement.mjs';
import {transaction,createTariff,saveFee,createTrial,readResource,idempotent,assertRuntimeRole} from '../adapters/postgres.mjs';

const base='/api/ops/v1/pricing';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const fingerprint=value=>createHash('sha256').update(canonical(value)).digest('hex');
export const routes=[
 {method:'GET',pattern:/^\/catalog$/,operation:'pricingCatalog',schema:'PricingCatalog',kind:'catalog'},
 {method:'GET',pattern:/^\/tariffs$/,operation:'listPricingTariffs',schema:'PricingTariffPage',kind:'list'},
 {method:'POST',pattern:/^\/tariffs$/,operation:'createPricingTariff',schema:'PricingTariff',input:'PricingTariffCreate',kind:'create',write:true},
 {method:'GET',pattern:/^\/tariffs\/([^/]+)$/,operation:'getPricingTariff',schema:'PricingTariff',kind:'tariff'},
 {method:'POST',pattern:/^\/tariffs\/([^/]+)\/actions\/save-fee$/,operation:'savePricingFee',schema:'PricingTariff',input:'PricingFeeDraft',kind:'save',write:true,version:true},
 {method:'POST',pattern:/^\/tariffs\/([^/]+)\/trials$/,operation:'createPricingTrial',schema:'PricingTrialResult',input:'PricingTrialRequest',kind:'simulate',version:true},
 {method:'GET',pattern:/^\/tariffs\/([^/]+)\/revisions$/,operation:'pricingRevisions',schema:'PricingRevisionPage',kind:'revisions'},
 {method:'GET',pattern:/^\/trials\/([^/]+)$/,operation:'getPricingTrial',schema:'PricingTrialResult',kind:'trial'}
];
async function readBody(req){
 ensure(/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']||''),415,'UNSUPPORTED_MEDIA_TYPE','请使用application/json');
 ensure(!req.headers['content-encoding'],415,'UNSUPPORTED_ENCODING','不接受压缩请求体');
 let size=0;const chunks=[];
 for await(const chunk of req.iterator({destroyOnReturn:false})){
  size+=chunk.length;if(size>65536){req.resume();throw new ApiError(413,'BODY_TOO_LARGE','请求体不得超过64KiB');}chunks.push(chunk);
 }
 return parseJson(Buffer.concat(chunks));
}
const isoDateTimeWithZone=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;
function normalizedIsoDateTime(value){
 const match=isoDateTimeWithZone.exec(value);if(!match)return null;
 const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number),calendar=new Date(Date.UTC(year,month-1,day));
 if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day||hour>23||minute>59||second>59)return null;
 const timestamp=Date.parse(value);return Number.isNaN(timestamp)?null:new Date(timestamp).toISOString();
}
function pagination(url,kind){
 const cursor=kind==='revisions'?'afterVersion':'after';
 const allowed=kind==='policy-list'?['limit','after','state','effectiveAt','serviceLevel','tariffId']:['list','revisions'].includes(kind)?['limit',cursor]:[];
 for(const key of url.searchParams.keys())ensure(allowed.includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const raw=url.searchParams.get('limit')??'50';
 ensure(/^[1-9][0-9]*$/.test(raw)&&Number(raw)<=100,422,'INVALID_LIMIT','limit须为1到100');
 let after=url.searchParams.get(cursor);
 if(after!==null){
  if(kind==='revisions'){ensure(/^[1-9][0-9]*$/.test(after)&&Number(after)<=9000000000000,422,'INVALID_CURSOR','版本游标无效');after=Number(after);}
  else ensure(uuid.test(after),422,'INVALID_CURSOR','游标须为UUID');
 }
 const page={limit:Number(raw),after};
 if(kind==='policy-list'){
  const state=url.searchParams.get('state')??'PUBLISHED';ensure(state==='PUBLISHED',422,'INVALID_STATE_FILTER','策略列表只支持state=PUBLISHED');
  const effectiveAt=normalizedIsoDateTime(url.searchParams.get('effectiveAt')??new Date().toISOString());ensure(effectiveAt,422,'INVALID_EFFECTIVE_AT','effectiveAt须为带时区的ISO时间');
  const serviceLevel=url.searchParams.get('serviceLevel');if(serviceLevel)ensure(['S1','S2','S3'].includes(serviceLevel),422,'INVALID_SERVICE_LEVEL','serviceLevel无效');
  const tariffId=url.searchParams.get('tariffId');if(tariffId)ensure(uuid.test(tariffId),422,'INVALID_TARIFF_ID','tariffId须为UUID');
  return {...page,state,effectiveAt,serviceLevel,tariffId};
 }
 return page;
}
// Two id-ordered sources, each already limited to page.limit rows after the same cursor. After merging, anything cut off by
// the limit is still ahead of the last returned id, so the next page (id > last) will return it; report "more" whenever either
// source has more or the merge itself overflowed the limit.
export function mergeDocumentPages(legacy,workflow,page){
 const merged=[...legacy.items,...workflow.items].sort((a,b)=>a.id.localeCompare(b.id)),items=merged.slice(0,page.limit);
 const more=Boolean(legacy.nextCursor||workflow.nextCursor||merged.length>page.limit);
 return {items,nextCursor:more&&items.length?page.cursor(items.at(-1).id):null};
}
// Fixed-window limiter. Expired windows are purged once the table grows, so one-off keys (e.g. client IPs) do not accumulate forever.
export function rateLimit(table,key,max,now=Date.now(),windowMs=60000){
 if(table.size>=1024)for(const [k,v] of table)if(now-v.start>=windowMs)table.delete(k);
 const previous=table.get(key);
 if(!previous||now-previous.start>=windowMs){table.set(key,{start:now,count:1});return;}
 ensure(previous.count<max,429,'RATE_LIMITED','请求过于频繁');previous.count++;
}
// Postgres constraint violations are business conflicts, not server faults.
export function databaseConflict(error){
 if(error?.code==='23P01')return {code:'CAPACITY_CONFLICT',message:'车辆在该时段已被其他承诺占用，请重新选择车辆或时间'};
 if(error?.code==='23505')return {code:'REQUEST_CONFLICT',message:'资源已被并发创建或已存在，请刷新后重试'};
 return null;
}
export function apiServer({pool,authenticate,serviceAuthenticate,localAccess,evidenceDirectory,origin,recipientCodeSender,requestRateLimit=120,log=()=>{}}){
 const limits=new Map();
 const publicLimits=new Map();
  const recipientLimits=new Map();
 const downloadSecret=randomBytes(32);
 const server=createServer({maxHeaderSize:16384},async(req,res)=>{
  const requestId=randomUUID();let operation='unknown';
  const send=(status,body,headers={},cause=null)=>{const noContent=status===204;res.writeHead(status,{...(noContent?{}:{'Content-Type':'application/json; charset=utf-8'}),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Request-Id':requestId,...(status===429?{'Retry-After':'60'}:{}),...headers});res.end(noContent?'':JSON.stringify(body));log({requestId,operation,status,...(cause?{cause}:{})});};
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(evidenceDirectory&&await serveEvidenceObject(req,res,pool,evidenceDirectory,url,downloadSecret))return;
   if(origin&&await serveFinanceExport(req,res,pool,url,authenticate))return;
   if(localAccess&&await localAccess(req,res,send))return;
   if(req.method==='GET'&&['/health/live','/health/ready'].includes(url.pathname)){
    operation='health';if(url.pathname.endsWith('ready'))await assertRuntimeRole(pool);send(200,{status:'ok',mode:'local-development'});return;
   }
   const publicRoute=publicRoutes.find(r=>r.pattern.test(url.pathname));
   if(publicRoute){
    ensure(req.method===publicRoute.method,405,'METHOD_NOT_ALLOWED','请求方法不支持');operation=publicRoute.operation;const ref=url.pathname.match(publicRoute.pattern)[1];rateLimit(publicLimits,req.socket.remoteAddress??'unknown',60);const data=await readPublicTracking(pool,ref);validate(publicRoute.schema,data);send(200,data);return;
   }
   const recipientRoute=recipientRoutes.find(r=>r.pattern.test(url.pathname));
   if(recipientRoute){
    ensure(req.method===recipientRoute.method,405,'METHOD_NOT_ALLOWED','请求方法不支持');operation=recipientRoute.operation;
    if(['challenge','verify'].includes(recipientRoute.kind))rateLimit(recipientLimits,req.socket.remoteAddress??'unknown',10);
    let body=null,version=null,request=null;
    if(req.method!=='GET'){
     body=await readBody(req);validate(recipientRoute.input,body);
     if(!['challenge','verify'].includes(recipientRoute.kind)){
      const key=req.headers['idempotency-key'];ensure(typeof key==='string'&&/^[\x21-\x7e]{16,128}$/.test(key),428,'IDEMPOTENCY_REQUIRED','需要16到128位可见ASCII幂等键');
      if(recipientRoute.version){const match=req.headers['if-match']?.match(/^"([1-9][0-9]*)"$/);ensure(match&&Number(match[1])<=9000000000000,428,'VERSION_REQUIRED','需要带双引号的有效If-Match版本');version=Number(match[1]);}
      request={method:req.method,path:url.pathname.toLowerCase(),key,fingerprint:fingerprint({method:req.method,path:url.pathname.toLowerCase(),body,version})};
     }
    }
    const id=url.pathname.match(recipientRoute.pattern)?.[1];if(id)ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
    let result;
    if(recipientRoute.kind==='challenge'){const data=await createRecipientChallenge(pool,body,recipientCodeSender);validate(recipientRoute.schema,data);result={status:202,body:data};}
    else if(recipientRoute.kind==='verify'){const data=await verifyRecipientChallenge(pool,body);validate(recipientRoute.schema,data);result={status:200,body:data};}
    else{
     const token=recipientBearer(req);
     if(recipientRoute.kind==='delivery'){const data=await recipientDelivery(pool,token);validate(recipientRoute.schema,data);result={status:200,body:data};}
     else if(recipientRoute.kind==='service-request')result=await recipientServiceRequest(pool,token,body,request);
     else if(recipientRoute.kind==='ack')result=await recipientAcknowledgement(pool,token,body,request);
     else result=await recipientEvidenceWrite(pool,token,recipientRoute.kind,id,body,version,{origin,downloadSecret,evidenceDirectory},request);
     validate(recipientRoute.schema,result.body);
    }
    send(result.status,result.body,{...(result.etag?{ETag:result.etag}:{}),...(result.replayed!==undefined?{'Idempotent-Replayed':String(result.replayed)}:{})});return;
   }
   const finance=financeRoutes.some(r=>r.pattern.test(url.pathname)),exporting=exportRoutes.some(r=>r.pattern.test(url.pathname)),notifications=notificationRoutes.some(r=>r.pattern.test(url.pathname)),access=accessRoutes.some(r=>r.pattern.test(url.pathname)),merchant=merchantRoutes.some(r=>r.pattern.test(url.pathname)),partnerPortal=partnerPortalRoutes.some(r=>r.pattern.test(url.pathname)),dispatch=dispatchRoutes.some(r=>r.pattern.test(url.pathname)),custody=custodyRoutes.some(r=>r.pattern.test(url.pathname)),delivery=deliveryRoutes.some(r=>r.pattern.test(url.pathname)),returns=returnRoutes.some(r=>r.pattern.test(url.pathname)),integration=integrationRoutes.some(r=>r.pattern.test(url.pathname)),warehouse=warehouseRoutes.some(r=>r.pattern.test(url.pathname)),driver=driverRoutes.some(r=>r.pattern.test(url.pathname)),evidence=evidenceRoutes.some(r=>r.pattern.test(url.pathname)),exceptions=exceptionRoutes.some(r=>r.pattern.test(url.pathname)),partners=partnerRoutes.some(r=>r.pattern.test(url.pathname)),bookings=bookingRoutes.some(r=>r.pattern.test(url.pathname)),cases=caseRoutes.some(r=>r.pattern.test(url.pathname)),customer=customerRoutes.some(r=>r.pattern.test(url.pathname)),prepayment=prepaymentRoutes.some(r=>r.pattern.test(url.pathname)),quote=quoteRoutes.some(r=>r.pattern.test(url.pathname)),intake=intakeRoutes.some(r=>r.pattern.test(url.pathname)),policy=policyRoutes.some(r=>r.pattern.test(url.pathname)),pricing=!policy&&url.pathname.startsWith(base+'/');
   const local=pricing?url.pathname.slice(base.length):url.pathname,matches=(finance?financeRoutes:exporting?exportRoutes:notifications?notificationRoutes:access?accessRoutes:merchant?merchantRoutes:partnerPortal?partnerPortalRoutes:dispatch?dispatchRoutes:custody?custodyRoutes:delivery?deliveryRoutes:returns?returnRoutes:integration?integrationRoutes:warehouse?warehouseRoutes:driver?driverRoutes:evidence?evidenceRoutes:exceptions?exceptionRoutes:partners?partnerRoutes:bookings?bookingRoutes:cases?caseRoutes:customer?customerRoutes:prepayment?prepaymentRoutes:quote?quoteRoutes:intake?intakeRoutes:policy?policyRoutes:pricing?routes:orderRoutes).filter(r=>r.pattern.test(local));
   ensure(matches.length,404,'NOT_FOUND','资源不存在');
   const route=matches.find(r=>r.method===req.method);ensure(route,405,'METHOD_NOT_ALLOWED','请求方法不支持');operation=route.operation;
   const principal=route.service?(ensure(typeof serviceAuthenticate==='function',503,'SERVICE_AUTH_UNAVAILABLE','服务凭据认证尚未配置'),serviceAuthenticate(req)):authenticate(req);
   ensure(principal.permissions.includes(route.permission??(route.write?'pricing:write':'pricing:read')),403,'FORBIDDEN','没有执行此操作的权限');
   rateLimit(limits,principal.companyId+':'+principal.principalId,requestRateLimit);
   const id=local.match(route.pattern)[1];if(id)ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
   const page=policy?pagination(url,route.kind):pricing?pagination(url,route.kind):finance?route.kind==='tasks'?taskQuery(url,principal):route.kind==='documents'?documentQuery(url,principal):['receipt','receipts'].includes(route.kind)?receiptQuery(url,principal):route.kind==='bank-transactions'?receiptQuery(url,principal,'bank-transactions'):route.kind==='cash-handovers'?cashHandoverQuery(url,principal,'ops'):route.kind==='settlement-rules'?settlementRuleQuery(url,principal):route.kind==='statements'?statementQuery(url,principal):route.kind==='settlement-accounts'?opsSettlementAccountQuery(url,principal):route.kind==='money-overview'?moneyOverviewQuery(url):route.kind==='ledger-report'?reportQuery(url,principal):ledgerQuery(url,principal):merchant?externalSubjectQuery(url,principal,'merchant-'+route.kind):partnerPortal?externalSubjectQuery(url,principal,'partner-'+route.kind):notifications?null:access?accessGrantQuery(url,principal):dispatch?dispatchQuery(url,principal):custody||delivery||integration?null:warehouse?route.kind==='queue'?orderQuery(url,'warehouse-queue',principal):route.kind.startsWith('inventory-')?null:warehouseRequestQuery(url,principal,'ops',route.kind.startsWith('inbound')?'INBOUND_NOTICE':'OUTBOUND_DELIVERY'):driver?route.kind==='cash-handovers'?cashHandoverQuery(url,principal,'driver'):route.kind==='settlement-accounts'?driverSettlementAccountQuery(url,principal):route.kind==='income'?driverIncomeQuery(url,principal):route.kind==='withdrawal-requests'?driverWithdrawalQuery(url,principal):driverQuery(url,principal):exceptions?exceptionQuery(url,principal):partners?partnerQuery(url,principal):bookings?null:customer&&route.kind==='members'?portalMemberQuery(url,principal):customer&&route.kind==='customer-statements'?customerStatementQuery(url,principal):customer&&route.kind==='customer-settlement-accounts'?customerSettlementAccountQuery(url,principal):customer&&route.kind==='customer-finance-requests'?customerFinanceRequestQuery(url,principal):customer&&route.kind==='inventory'?inventoryQuery(url,principal):customer&&route.kind.startsWith('warehouse-')?warehouseRequestQuery(url,principal,'customer',route.kind.includes('inbound')?'INBOUND_NOTICE':'OUTBOUND_DELIVERY'):customer&&route.kind==='ledger-items'?ledgerQuery(url,principal):customer&&route.kind==='ledger-report'?reportQuery(url,principal,true):customer&&route.kind==='receipts'?receiptQuery(url,principal):route.kind==='timeline'?timelineQuery(url,principal):cases?caseQuery(url,principal):evidence?null:orderQuery(url,route.kind,principal);
   let body,version=null,request;
   if(req.method!=='GET'){
    const key=req.headers['idempotency-key'];ensure(typeof key==='string'&&/^[\x21-\x7e]{16,128}$/.test(key),428,'IDEMPOTENCY_REQUIRED','需要16到128位可见ASCII幂等键');
    if(route.version){const match=req.headers['if-match']?.match(/^"([1-9][0-9]*)"$/);ensure(match&&Number(match[1])<=9000000000000,428,'VERSION_REQUIRED','需要带双引号的有效If-Match版本');version=Number(match[1]);}
    else ensure(!req.headers['if-match'],422,'UNEXPECTED_VERSION','创建草稿不接受If-Match');
    body=await readBody(req);validate(route.input,body);
    const path=url.pathname.toLowerCase();request={method:req.method,path,key,fingerprint:fingerprint({method:req.method,path,body,version})};
   }
   if(route.kind==='logout'){
    ensure(principal.browser,401,'BROWSER_SESSION_REQUIRED','请使用本机一次性链接建立浏览器会话');
    const result=await transaction(pool,principal,client=>idempotent(client,principal,request,async()=>({status:204,body:{},etag:''})));
    authenticate.revoke(principal);
    send(result.status,null,{'Set-Cookie':'rf_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',...(result.replayed!==undefined?{'Idempotent-Replayed':String(result.replayed)}:{})});
    return;
   }
   const result=await transaction(pool,principal,async client=>{
    if(integration){
     if(route.kind==='ops-snapshot'){const data=await readOpsSnapshot(client,principal);validate(route.schema,data);return {status:200,body:data};}
     if(req.method==='GET'){const data=await readExternalImport(client,principal,route.channel,id);validate(route.schema,data);return {status:200,body:data};}
     return idempotent(client,principal,request,async()=>{const data=route.kind==='import-create'?await importExternalOrder(client,principal,route.channel,body):route.kind==='dispatch-request'?await requestExternalDispatch(client,principal,route.channel,id,body,version):await writeWmsStockEvent(client,principal,body);validate(route.schema,data);return {status:route.kind==='dispatch-request'?202:201,body:data,etag:`"${data.version}"`};});
    }
    if(notifications){if(req.method==='GET')return {status:200,body:await readNotification(client,principal,id)};return idempotent(client,principal,request,async()=>{const data=await writeNotification(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:202,body:data,etag:`"${data.version}"`};});}
    if(exporting){if(req.method==='GET')return {status:200,body:await readFinanceExport(client,principal,id,{origin})};return idempotent(client,principal,request,async()=>{const data=await createFinanceExport(client,principal,body,{origin});validate(route.schema,data);return {status:202,body:data,etag:`"${data.version}"`};});}
    if(merchant||partnerPortal){const portal=merchant?'merchant':'partner';if(req.method==='GET'){const data=await readExternalSubject(client,principal,portal,route.kind,page);validate(route.schema,data);return {status:200,body:data};}return idempotent(client,principal,request,async()=>{const data=await requestExternalSettlement(client,principal,portal,body);validate(route.schema,data);return {status:201,body:data,etag:`"${data.version}"`};});}
    if(access){if(req.method==='GET'){const data=await readAccessGrants(client,principal,page);validate(route.schema,data);return {status:200,body:data};}return idempotent(client,principal,request,async()=>{const data=await writeAccessGrant(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:route.kind==='create'?201:200,body:data,etag:`"${data.version}"`};});}
    if(warehouse){
     if(route.kind==='queue')return {status:200,body:await readWarehouseQueue(client,principal,page)};
     if(route.kind.startsWith('inventory-'))return idempotent(client,principal,request,async()=>{const data=route.kind==='inventory-reserve'?await createStockReservation(client,principal,body):await writeStockReservation(client,principal,route.kind.slice('inventory-'.length),id,body,version);validate(route.schema,data);return {status:route.kind==='inventory-reserve'?201:200,body:data,etag:`"${data.version}"`};});
     const type=route.kind.startsWith('inbound')?'INBOUND_NOTICE':'OUTBOUND_DELIVERY';
     if(req.method==='GET'){const data=await readWarehouseRequests(client,principal,type,id,page);validate(route.schema,data);return {status:200,body:data};}
     return idempotent(client,principal,request,async()=>{const data=await acceptWarehouseRequest(client,principal,type,id,body,version);validate(route.schema,data);return {status:200,body:data,etag:`"${data.version}"`};});
    }
    if(delivery){if(req.method==='GET')return {status:200,body:await readDelivery(client,principal,id)};return idempotent(client,principal,request,async()=>{const data=await writeDelivery(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:201,body:data,etag:`"${data.version??data.orderVersion}"`};});}
    if(returns)return idempotent(client,principal,request,async()=>{const data=await writeReturn(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:route.kind==='create'?201:200,body:data,etag:`"${data.version}"`};});
    if(custody)return idempotent(client,principal,request,async()=>{const data=await writeCustody(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:route.kind==='create'?201:200,body:data,etag:`"${data.version}"`};});
    if(exceptions){
     if(route.kind==='rescue-create')return idempotent(client,principal,request,async()=>{const data=await createRescuePlan(client,principal,id,body,version);validate(route.schema,data);return {status:201,body:data,etag:'"'+data.version+'"'};});
     if(req.method==='GET')return {status:200,body:await readExceptions(client,principal,page)};
     return idempotent(client,principal,request,async()=>{const data=await writeException(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:route.kind==='create'?201:200,body:data,etag:'"'+data.version+'"'};});
    }
    if(partners){
     if(req.method==='GET')return {status:200,body:await readPartners(client,principal,page)};
     return idempotent(client,principal,request,async()=>{const data=await writePartner(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:route.kind==='create'?201:200,body:data,etag:'"'+data.version+'"'};});
    }
    if(bookings){
     if(req.method==='GET')return {status:200,body:await readBooking(client,principal,id)};
     return idempotent(client,principal,request,async()=>{const data=await writeBooking(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:route.kind==='create'?201:route.kind==='request'||route.kind==='event'?202:200,body:data,etag:'"'+data.version+'"'};});
    }
    if(dispatch){
     if(req.method==='GET')return {status:200,body:await readDispatch(client,principal,route.kind,id,page)};
     return idempotent(client,principal,request,async()=>{const data=route.kind==='promise-check'?await writePromiseCheck(client,principal,id,body,version):route.kind==='promise-create'?await writePromise(client,principal,id,body,version):route.kind==='load-review'?await writeLoadReview(client,principal,id,body,version):await writeAssignment(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:['promise-check','promise-create','load-review','assignment-create'].includes(route.kind)?201:200,body:data,etag:`\"${route.kind==='promise-create'?version+1:data.version}\"`};});
    }
    if(driver){
     if(route.kind==='evidence-download')return {status:200,body:await readDriverEvidenceDownload(client,principal,id,{origin:req.headers.origin,downloadSecret})};
     if(route.kind.startsWith('evidence-'))return idempotent(client,principal,request,async()=>{const data=await writeDriverEvidence(client,principal,route.kind,id,body,version,{origin:req.headers.origin,evidenceDirectory});validate(route.schema,data);return {status:route.kind==='evidence-create'?201:202,body:data,etag:`"${data.version}"`};});
     if(req.method==='GET')return {status:200,body:route.kind==='cash-handovers'?await readCashHandovers(client,principal,page,'driver'):route.kind==='settlement-accounts'?await readDriverSettlementAccounts(client,principal,page):route.kind==='income'?await readDriverIncome(client,principal,page):route.kind==='withdrawal-requests'?await readDriverWithdrawals(client,principal,page):await readDriver(client,principal,route.kind,id,page)};
     return idempotent(client,principal,request,async()=>{const data=route.kind==='locations'?await writeDriverLocations(client,principal,body):route.kind==='sync'?await writeDriverSync(client,principal,body):route.kind==='cash-report'?await writeDriverCashReport(client,principal,body):route.kind==='cash-handover'?await writeDriverHandover(client,principal,body):route.kind==='withdrawal-request'?await requestDriverWithdrawal(client,principal,body):await writeDriver(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:['cash-report','cash-handover','withdrawal-request'].includes(route.kind)?201:200,body:data,etag:data.version?`\"${data.version}\"`:''};});
    }
    if(evidence){
     if(req.method==='GET')return {status:200,body:await readEvidenceDownload(client,principal,id,{origin:req.headers.origin,downloadSecret})};
     return idempotent(client,principal,request,async()=>{
      const data=await writeEvidence(client,principal,route.kind,id,body,version,{origin:req.headers.origin,evidenceDirectory});validate(route.schema,data);
      return {status:route.kind==='create'?201:202,body:data,etag:`"${data.version}"`};
     });
    }
    if(finance){
     if(req.method==='GET'&&route.kind==='documents'){const legacy=await readFinanceDocuments(client,principal,'documents',null,page),workflow=await readWorkflowDocuments(client,principal,page);return {status:200,body:mergeDocumentPages(legacy,workflow,page)};}
     if(route.kind==='channel-settlement'&&req.method==='GET')return {status:200,body:await channelSettlement(client,principal,id)};
     if(route.kind==='channel-settlement-create')return idempotent(client,principal,request,async()=>{const data=await createChannelSettlement(client,principal,body);validate(route.schema,data);return {status:201,body:data,etag:`\"${data.version}\"`};});
     if(req.method==='GET'&&route.kind==='document'){try{return {status:200,body:await workflowDocument(client,principal,id)};}catch(error){if(error.code!=='NOT_FOUND')throw error;}}
     if(req.method!=='GET'&&['document-create','document-revise','document-submit','document-review','document-approve','document-reject','document-execution','document-result','document-post'].includes(route.kind))return idempotent(client,principal,request,async()=>{let data;if(route.kind==='document-create')data=body.kind==='ADJUSTMENT'?await writeFinanceDocument(client,principal,route.kind,id,body,version):await createWorkflowDocument(client,principal,body);else{const action={ 'document-revise':'revise','document-submit':'submit','document-review':'review','document-approve':'approve','document-reject':'reject','document-execution':'execution','document-result':'result','document-post':'post'}[route.kind];try{data=await writeWorkflowDocument(client,principal,action,id,body,version);}catch(error){if(error.code!=='NOT_FOUND')throw error;data=await writeFinanceDocument(client,principal,route.kind,id,body,version);}}validate(route.schema,data);return {status:route.kind==='document-create'?201:200,body:data,etag:`\"${data.version}\"`};});
     if(route.kind==='payment-intents')return {status:200,body:await readPaymentIntents(client,principal,paymentIntentQuery(url,principal,'ops-payment-intents'))};
     if(route.kind==='payment-query')return idempotent(client,principal,request,async()=>{const data=await requestPaymentQuery(client,principal,id,version);validate(route.schema,data);return {status:202,body:data,etag:`\"${data.version}\"`};});
     if(req.method==='GET'&&route.kind==='cash-handovers')return {status:200,body:await readCashHandovers(client,principal,page,'ops')};
     if(req.method==='GET'&&route.kind==='cash-handover')return {status:200,body:await readCashHandover(client,principal,id)};
     if(req.method==='POST'&&route.kind==='cash-count')return idempotent(client,principal,request,async()=>{const data=await writeCashCount(client,principal,id,body,version);validate(route.schema,data);return {status:200,body:data,etag:`\"${data.version}\"`};});
     if(req.method==='GET'&&route.kind==='settlement-accounts')return {status:200,body:await readOpsSettlementAccounts(client,principal,page)};
     if(req.method==='GET'&&['settlement-rules','settlement-rule','statements','statement'].includes(route.kind))return {status:200,body:await readSettlement(client,principal,route.kind,id,page)};
     if(req.method==='GET')return {status:200,body:route.kind==='tasks'?await readFinanceTasks(client,principal,page):['documents','document'].includes(route.kind)?await readFinanceDocuments(client,principal,route.kind,id,page):route.kind==='receipt'?await readReceipt(client,principal,id):route.kind==='receipts'?await readReceipts(client,principal,page):route.kind==='bank-transactions'?await readBankTransactions(client,principal,page):route.kind==='money-overview'?await readMoneyOverview(client,principal,page):route.kind==='ledger-report'?await readLedgerReport(client,principal,page):await readFinance(client,principal,route.kind,page,id)};
     return idempotent(client,principal,request,async()=>{const data=['settlement-rule-create','settlement-rule-preview','settlement-rule-activate','statement-generate','statement-review','statement-approve','statement-issue'].includes(route.kind)?await writeSettlement(client,principal,route.kind,id,body,version):route.kind==='bank-register'?await writeBankTransaction(client,principal,body):['task-read','task-hold'].includes(route.kind)?await writeFinanceTask(client,principal,route.kind,id,version,body):route.kind.startsWith('receipt-')?await writeReceipt(client,principal,route.kind,id,body,version):await writeFinanceDocument(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:['receipt-report','document-create','bank-register','settlement-rule-create','statement-generate'].includes(route.kind)?201:200,body:data,etag:data.version?`"${data.version}"`:''};});
    }
    if(customer){
     if(route.kind==='payment-intent')return {status:200,body:await readPaymentIntent(client,principal,id,true)};
     if(route.kind==='payment-query')return idempotent(client,principal,request,async()=>{const data=await requestPaymentQuery(client,principal,id,version,true);validate(route.schema,data);return {status:202,body:data,etag:`\"${data.version}\"`};});
     if(route.kind==='payment-intent-create')return idempotent(client,principal,request,async()=>{const data=await createPaymentIntent(client,principal,body);validate(route.schema,data);return {status:202,body:data,etag:`\"${data.version}\"`};});
     if(route.kind==='evidence-download')return {status:200,body:await readCustomerEvidenceDownload(client,principal,id,{origin:req.headers.origin,downloadSecret})};
     if(route.kind.startsWith('evidence-'))return idempotent(client,principal,request,async()=>{const data=await writeCustomerEvidence(client,principal,route.kind,id,body,version,{origin:req.headers.origin,evidenceDirectory});validate(route.schema,data);return {status:route.kind==='evidence-create'?201:202,body:data,etag:`"${data.version}"`};});
     if(route.kind==='session')return {status:200,body:await customerSession(client,principal)};
     if(route.kind==='members')return {status:200,body:await readCustomerMembers(client,principal,page)};
     if(route.kind==='member-invite')return idempotent(client,principal,request,async()=>{const data=await inviteCustomerMember(client,principal,body);validate(route.schema,data);return {status:201,body:data,etag:`\"${data.version}\"`};});
     if(['member-suspend','member-revoke'].includes(route.kind))return idempotent(client,principal,request,async()=>{const data=await updateCustomerMember(client,principal,route.kind,id,body,version);validate(route.schema,data);return {status:200,body:data,etag:`\"${data.version}\"`};});
     if(req.method==='GET'&&['customer-statements','customer-statement'].includes(route.kind))return {status:200,body:await readCustomerStatements(client,principal,route.kind==='customer-statement'?id:null,page)};
     if(route.kind==='customer-settlement-accounts')return {status:200,body:await readCustomerSettlementAccounts(client,principal,page)};
     if(route.kind==='customer-finance-requests')return {status:200,body:await readCustomerFinanceRequests(client,principal,page)};
     if(route.kind==='customer-refund-request')return idempotent(client,principal,request,async()=>{const data=await requestCustomerRefund(client,principal,body);validate(route.schema,data);return {status:201,body:data,etag:`"${data.version}"`};});
     if(route.kind==='inventory'){const data=await readCustomerInventory(client,principal,page);validate(route.schema,data);return {status:200,body:data};}
     if(route.kind.startsWith('warehouse-')){
      const type=route.kind.includes('inbound')?'INBOUND_NOTICE':'OUTBOUND_DELIVERY';
      if(req.method==='GET'){const data=await readCustomerWarehouseRequests(client,principal,type,id,page);validate(route.schema,data);return {status:200,body:data};}
      return idempotent(client,principal,request,async()=>{const data=await createCustomerWarehouseRequest(client,principal,type,body);validate(route.schema,data);return {status:201,body:data,etag:`"${data.version}"`};});
     }
     if(route.kind==='customer-statement-acknowledge')return idempotent(client,principal,request,async()=>{const data=await acknowledgeCustomerStatement(client,principal,id,body,version);validate(route.schema,data);return {status:200,body:data,etag:`"${data.version}"`};});
     if(req.method!=='GET')return idempotent(client,principal,request,async()=>{
      let data;
      if(route.kind==='customer-quote-confirm'){
       data=await writePrepayment(client,principal,'customer-confirm',id,body,version);
      }else if(route.kind==='customer-receipt-report'){
       data=await writeReceipt(client,principal,route.kind,id,body,version);
      }else if(route.kind==='customer-order-create'){
       const customerId=await currentCustomer(client,principal);
       const created=await writeOrder(client,principal,null,{...body,customerId});
       data=await getCustomerOrder(client,principal,created.order.id);
      }else{
       await writeIntake(client,principal,'intake-submit',id,body,version);
       data=await getCustomerOrder(client,principal,id);
      }
      validate(route.schema,data);return {status:route.kind==='customer-order-create'?201:200,body:data,etag:`\"${data.version??data.order.version}\"`};
     });
     if(route.kind==='ledger-items')return {status:200,body:await readFinance(client,principal,'ledger-items',page)};
     if(route.kind==='ledger-report')return {status:200,body:await readLedgerReport(client,principal,page,true)};
     if(route.kind==='receipts')return {status:200,body:await readReceipts(client,principal,page)};
     if(route.kind==='timeline')return {status:200,body:await customerTimeline(client,principal,id,page)};
     if(route.kind==='quote')return {status:200,body:await getQuote(client,principal,id)};
     return {status:200,body:route.kind==='order'?await getCustomerOrder(client,principal,id):await readOrders(client,principal,'orders',null,page)};
    }
    if(cases){
     if(req.method==='GET')return {status:200,body:await readCases(client,principal,route.kind,id,page)};
     return idempotent(client,principal,request,async()=>{
      const data=await writeCase(client,principal,route.kind,id,body,version);validate(route.schema,data);
      return {status:['create','ops-create'].includes(route.kind)?201:200,body:data,etag:`"${data.version}"`};
     });
    }
    if(prepayment){
     if(req.method==='GET')return {status:200,body:await readPrepayment(client,principal,route.kind,id)};
     await authorizePrepayment(client,principal,route.kind,id);
     return idempotent(client,principal,request,async()=>{
      const data=await writePrepayment(client,principal,route.kind,id,body,version);validate(route.schema,data);
      return {status:route.kind.endsWith('-create')?201:200,body:data,etag:`"${data.version}"`};
     });
    }
    if(quote){
     if(req.method==='GET')return {status:200,body:await getQuote(client,principal,id)};
     await getOrder(client,principal,id);
     return idempotent(client,principal,request,async()=>{
      const data=await createQuote(client,principal,id,body,version);validate(route.schema,data);
      return {status:201,body:data,etag:'"1"'};
     });
    }
    if(intake){
     if(route.order)await getOrder(client,principal,id);
     if(req.method==='GET')return {status:200,body:await readIntake(client,principal,route.kind,id,page)};
     return idempotent(client,principal,request,async()=>{
      const data=await writeIntake(client,principal,route.kind,id,body,version);validate(route.schema,data);
      return {status:['area-create','intake-evidence'].includes(route.kind)?201:200,body:data,etag:`"${data.version??data.order?.version??data.orderVersion}"`};
     });
    }
    if(policy){
     if(route.kind==='policy-list')return {status:200,body:await listPublishedPolicies(client,principal,page)};
     if(req.method==='GET')return {status:200,body:await getPolicy(client,principal,id)};
     return idempotent(client,principal,request,async()=>{
      const data=route.kind==='policy-submit'?await submitPolicy(client,principal,id,body,version):await reviewOrPublishPolicy(client,principal,id,body,version,route.kind==='policy-publish');
      validate(route.schema,data);return {status:route.kind==='policy-submit'?201:200,body:data,etag:`"${data.version}"`};
     });
    }
    if(!pricing){
     if(req.method==='GET')return {status:200,body:route.kind==='session'?await customerSession(client,principal):route.kind==='timeline'?await customerTimeline(client,principal,id,page):await readOrders(client,principal,route.kind,id,page)};
     if(route.kind!=='order-cancel')await authorizedCustomer(client,principal,body.customerId);
     if(id)await getOrder(client,principal,id);
     return idempotent(client,principal,request,async()=>{
      const data=route.kind==='order-cancel'?await writeOrderCancel(client,principal,id,body,version):await writeOrder(client,principal,id,body,version);validate(route.schema,data);
      return {status:route.kind==='order-create'?201:200,body:data,etag:`"${data.order.version}"`};
     });
    }
    if(req.method==='GET')return {status:200,body:route.kind==='catalog'?catalog:await readResource(client,principal,route.kind,id,page)};
    return idempotent(client,principal,request,async()=>{
     const data=route.kind==='create'?await createTariff(client,principal,body):route.kind==='save'?await saveFee(client,principal,id,body,version):await createTrial(client,principal,id,body,version);
     validate(route.schema,data);
     return {status:route.kind==='save'?200:201,body:data,etag:`"${data.version??data.tariffVersion}"`};
    });
   },{readOnly:req.method==='GET'});
   if(route.schema)validate(route.schema,result.body);
   const headers={},resourceVersion=result.body.version??result.body.order?.version;if(result.etag||resourceVersion)headers.ETag=result.etag??`"${resourceVersion}"`;
   if(result.replayed!==undefined)headers[pricing||policy?'Idempotency-Replayed':'Idempotent-Replayed']=String(result.replayed);
   send(result.status,result.body,headers);
  }catch(error){
   const transient=['55P03','40001','40P01'].includes(error.code);
   const unavailable=['ECONNREFUSED','ECONNRESET','ETIMEDOUT','57P01','57P03','53300'].includes(error.code);
   const conflict=error instanceof ApiError?null:databaseConflict(error);
   const status=error instanceof ApiError?error.status:conflict?409:transient?409:unavailable?503:500;
   const code=error instanceof ApiError?error.code:conflict?conflict.code:transient?'REQUEST_IN_PROGRESS':unavailable?'SERVICE_UNAVAILABLE':'INTERNAL_ERROR';
   const message=error instanceof ApiError?error.message:conflict?conflict.message:transient?'操作正在处理，请使用同一幂等键重试':'服务暂时不可用';
   // Unexpected failures (5xx not raised through ApiError) are logged with the driver/database error identity so requestId can be traced.
   const cause=error instanceof ApiError||status<500?null:{name:String(error?.name??'Error'),code:error?.code??null,constraint:error?.constraint??null,message:String(error?.message??'').slice(0,160)};
   send(status,{error:{code,message,messageKey:`errors.${code.toLowerCase()}`,retryable:transient||[429,503].includes(status),requestId,fields:error instanceof ApiError?error.fields:[]}},[429,503].includes(status)||transient?{'Retry-After':'1'}:{},cause);
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
 return server;
}
