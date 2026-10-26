import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {seed,apply} from './model.mjs';
import {importFields} from './external-orders.mjs';
class ApiError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const fail=(status,code,message)=>{throw new ApiError(status,code,message)};
async function body(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size<=65536)chunks.push(c)}if(size>65536)fail(413,'BODY_TOO_LARGE','请求体超过 64 KiB');try{const p=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!p||Array.isArray(p)||typeof p!=='object')throw Error();return p}catch{fail(400,'INVALID_JSON','需要 JSON 对象')}}
// shortcut: process-local demo state; replace with authenticated transactional persistence before real integration.
export function createIntegrationServer({principals,clock=()=>Date.now()}){
 if(!principals||Object.keys(principals).length<1)throw Error('需要显式配置联调凭据');const tenants=new Map();
 const view=o=>({id:o.id,version:o.version,status:o.status,expectedAt:new Date(o.expected+':00+07:00').toISOString(),dispatchRequested:!!o.dispatchRequested,source:o.externalSource||null,pickup:{address:o.pickupAddress,contact:o.pickupContact,phone:o.pickupPhone},delivery:{address:o.destination,contact:o.deliveryContact,phone:o.deliveryPhone},money:{currency:'USD',deliveryMinor:o.amountMinor-(o.insuranceFeeMinor||0),insuranceMinor:o.insuranceFeeMinor||0,totalMinor:o.amountMinor},insuranceStatus:o.insurance?.status||(o.insuranceFeeMinor?'quoted_not_bound':'not_requested'),vehicle:o.vehicle||null});
 return http.createServer(async(req,res)=>{
  const send=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));};
  try{
   if(req.headers.origin)fail(403,'BROWSER_ORIGIN_NOT_ALLOWED','本联调接口供服务端调用，不开放跨域浏览器凭据');
   const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1],principal=Object.hasOwn(principals,token)?principals[token]:null;if(!principal)fail(401,'UNAUTHENTICATED','缺少有效联调凭据');
   const url=new URL(req.url,'http://127.0.0.1'),m=url.pathname.match(/^\/api\/(warehouse|customer|ops)\/v1\/orders(?:\/([^/]+)(?:\/actions\/([a-z-]+))?)?$/);if(!m)fail(404,'NOT_FOUND','资源不存在');
   const [,group,encodedId,action]=m;if(principal.group!==group)fail(403,'SCOPE_FORBIDDEN','凭据不能用于该接口分组');const id=encodedId?decodeURIComponent(encodedId):null;
   if(!tenants.has(principal.tenant))tenants.set(principal.tenant,seed(clock()));let db=tenants.get(principal.tenant);
   const owned=o=>group==='ops'||(o?.externalSource?.sourceType===group&&o.externalSource.sourceSystem===principal.system);
   const find=()=>{const o=db.orders.find(o=>o.id===id);if(!o||!owned(o))fail(404,'NOT_FOUND','资源不存在');return o};
   if(req.method==='GET'&&!action){if(id){const o=find(),item=db.externalIntakes?.find(x=>x.orderId===id);send(200,{...view(o),dispatchRequested:!!item?.dispatchRequestedAt},{ETag:`"${o.version}"`});return}
    const limit=Number(url.searchParams.get('limit')||20),offset=Number(url.searchParams.get('cursor')||0);if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0)fail(400,'INVALID_PAGE','分页参数无效');const rows=db.orders.filter(owned),items=rows.slice(offset,offset+limit).map(o=>({...view(o),dispatchRequested:!!db.externalIntakes?.find(x=>x.orderId===o.id)?.dispatchRequestedAt}));send(200,{items,nextCursor:offset+limit<rows.length?String(offset+limit):null});return;
   }
   if(req.method!=='POST')fail(405,'METHOD_NOT_ALLOWED','仅支持 GET 与 POST');if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON_REQUIRED','请使用 application/json');
   const key=req.headers['idempotency-key'];if(typeof key!=='string'||key.length<1||key.length>128)fail(428,'IDEMPOTENCY_KEY_REQUIRED','缺少有效 Idempotency-Key');
   const p=await body(req);db=tenants.get(principal.tenant);for(const k of ['tenantId','companyId','sourceType','sourceSystem','role','status','paid','actorId'])if(Object.hasOwn(p,k))fail(400,'SERVER_OWNED_FIELD','主体、状态与权限字段由服务端确定');
   const requestKey=JSON.stringify([principal.group,principal.system,key]);const httpFingerprint=JSON.stringify([req.method,url.pathname,p]);const prior=db.httpRequests?.[requestKey];if(prior){if(prior.fingerprint!==httpFingerprint)fail(409,'IDEMPOTENCY_KEY_REUSED','相同幂等键内容不同');send(prior.status,prior.response,{ETag:prior.etag,'Idempotent-Replayed':'true'});return}
   let orderId=id,status=200;
   if(!id&&!action&&group!=='ops'){
    const allowed=new Set([...Object.keys(importFields).filter(k=>!['sourceSystem','amount','insuranceAmount'].includes(k)),'currency','payment','reviewed','sourcePlatform','deliveryFeeMinor','insuranceFeeMinor']);if(Object.keys(p).some(k=>!allowed.has(k)))fail(400,'UNKNOWN_FIELD','包含不支持的导入字段');
    if(!Number.isSafeInteger(p.deliveryFeeMinor)||p.deliveryFeeMinor<=0||!Number.isSafeInteger(p.insuranceFeeMinor)||p.insuranceFeeMinor<0)fail(422,'INVALID_MONEY','配送费与保险费须明确填写为整数分');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/.test(p.expected||'')||!Number.isFinite(Date.parse(p.expected)))fail(422,'INVALID_TIME','expected 须为 RFC3339；本原型精确到分钟，秒须为00');const expected=new Date(Date.parse(p.expected)+7*3600000).toISOString().slice(0,16);
    db=apply(db,{action:'importExternal',role:'ops',key:requestKey,payload:{...p,expected,amount:(p.deliveryFeeMinor/100).toFixed(2),insuranceAmount:(p.insuranceFeeMinor/100).toFixed(2),sourceType:group,sourceSystem:principal.system}},clock());orderId=db.externalIntakes.find(x=>x.sourceType===group&&x.sourceSystem===principal.system&&x.externalOrderId===p.externalOrderId.trim()&&(x.sourcePlatform||'')===(p.sourcePlatform?.trim()||'')).orderId;status=201;
   }else if(id&&action){
    const o=find(),match=req.headers['if-match'];if(!/^"\d+"$/.test(match||''))fail(428,'PRECONDITION_REQUIRED','If-Match 必须为引号包裹的版本号');if(Number(match.slice(1,-1))!==o.version)fail(412,'VERSION_CONFLICT','版本已变化，请重新查询');
    let modelAction,role;
    if(action==='request-dispatch'&&group!=='ops'){modelAction='requestExternalDispatch';role='ops';if(Object.keys(p).length)fail(400,'UNKNOWN_FIELD','派单申请不接受车辆或执行状态');}
    else if(group==='warehouse'&&['warehouse-release','warehouse-return-receipt'].includes(action)){modelAction=action==='warehouse-release'?'prepare':'receiveReturn';role='warehouse';const allowed=new Set(modelAction==='prepare'?['dimension','pattern','packaging','evidence']:['count','evidence']);if(Object.keys(p).some(k=>!allowed.has(k)))fail(400,'UNKNOWN_FIELD','仓库事件字段无效');}
    else if(group==='ops'&&['promise','offer','revoke','cancel'].includes(action)){modelAction=action;role='dispatch';}
    else fail(403,'ACTION_FORBIDDEN','该来源不能执行此动作');
    db=apply(db,{id,action:modelAction,role,version:o.version,key:requestKey,payload:p},clock());status=action==='request-dispatch'?202:200;
   }else fail(404,'NOT_FOUND','资源不存在');
   const o=db.orders.find(o=>o.id===orderId),response={...view(o),dispatchRequested:!!db.externalIntakes?.find(x=>x.orderId===o.id)?.dispatchRequestedAt,demo:true},etag=`"${o.version}"`;
   (db.httpRequests??={})[requestKey]={fingerprint:httpFingerprint,status,response:structuredClone(response),etag};tenants.set(principal.tenant,db);send(status,response,{ETag:etag});
  }catch(error){send(error.status||(error.message.includes('已存在')||error.message.includes('幂等')?409:422),{error:{code:error.code||(error.message.includes('已存在')||error.message.includes('幂等')?'EXTERNAL_ORDER_CONFLICT':'VALIDATION_OR_STATE_REJECTED'),message:error.message},demo:true})}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const credentials=['WAREHOUSE','CUSTOMER','OPS'].map(x=>process.env['ROUTEFIT_'+x+'_TOKEN']);if(credentials.some(x=>!x||x.length<16)||new Set(credentials).size!==3)throw Error('设置三个不同的 ROUTEFIT_WAREHOUSE_TOKEN / CUSTOMER_TOKEN / OPS_TOKEN，均至少16字符');
 const principals=Object.fromEntries(credentials.map((token,i)=>[token,{tenant:'DEMO',group:['warehouse','customer','ops'][i],system:['DEMO-WMS','DEMO-CUSTOMER','DEMO-OPS'][i]}]));const server=createIntegrationServer({principals});server.requestTimeout=10000;server.listen(4174,'127.0.0.1',()=>console.log('RouteFit isolated integration demo: http://127.0.0.1:4174 · memory only'));
}
