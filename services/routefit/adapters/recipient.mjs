import {createHash,randomBytes,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {writeEvidence,readEvidenceDownload} from './evidence.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=value=>createHash('sha256').update(value).digest('hex');
const genericMessage='如订单存在且您是预登记收货人，验证码将发送至登记联系方式。';
const tokenHash=value=>hash(value);
const codeFor=()=>String(randomInt(0,1000000)).padStart(6,'0');
const sameSet=(left,right)=>left.length===right.length&&new Set(left).size===left.length&&left.every(value=>right.includes(value));

export function recipientBearer(req){
 ensure(!req.headers.cookie,401,'RECIPIENT_TOKEN_REQUIRED','收货人入口不接受浏览器会话');
 const match=(req.headers.authorization??'').match(/^Bearer ([A-Za-z0-9_-]{32,512})$/);
 ensure(match,401,'RECIPIENT_TOKEN_REQUIRED','需要有效收货人访问令牌');return match[1];
}

async function recipientTransaction(pool,token,work,{readOnly=false}={}){
 const client=await pool.connect();
 try{
  await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
  await client.query("SET LOCAL lock_timeout='2s'");await client.query("SET LOCAL statement_timeout='5s'");
  const row=(await client.query('SELECT * FROM delivery.recipient_session_identity($1)',[tokenHash(token)])).rows[0];
  ensure(row,401,'RECIPIENT_SESSION_EXPIRED','收货人访问已失效，请重新验证');
  const session={id:row.session_id,companyId:row.company_id,orderId:row.order_id,permissions:row.permissions};
  await client.query("SELECT set_config('app.company_id',$1,true)",[session.companyId]);
  await client.query("SELECT set_config('app.recipient_session_id',$1,true)",[session.id]);
  const result=await work(client,session);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}

function neutralChallenge(){return {challengeId:randomUUID(),expiresAt:new Date(Date.now()+600000).toISOString(),message:genericMessage};}

export async function createRecipientChallenge(pool,input,sendCode){
 // No delivery integration means all requests fail equally; returning a fake success here would create an unusable sign-in path.
 ensure(typeof sendCode==='function',503,'RECIPIENT_CHALLENGE_DELIVERY_UNAVAILABLE','收货验证码通道尚未配置');
 const result=neutralChallenge(),token=hash(input.trackingRef),client=await pool.connect();let target,code;
 try{
  await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='2s'");await client.query("SET LOCAL statement_timeout='5s'");
  target=(await client.query('SELECT * FROM sharing.recipient_tracking_target($1)',[token])).rows[0];
  if(target?.recipient_phone){
   await client.query("SELECT set_config('app.company_id',$1,true)",[target.company_id]);code=codeFor();
   await client.query('INSERT INTO delivery.recipient_challenge(id,company_id,order_id,code_hash,expires_at) VALUES($1,$2,$3,$4,$5)',[result.challengeId,target.company_id,target.order_id,hash(code),result.expiresAt]);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
 if(target?.recipient_phone)await sendCode({phone:target.recipient_phone,code,expiresAt:result.expiresAt});
 return result;
}

export async function verifyRecipientChallenge(pool,input){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='2s'");await client.query("SET LOCAL statement_timeout='5s'");
  const candidate=(await client.query('SELECT * FROM delivery.recipient_challenge_identity($1)',[input.challengeId])).rows[0];
  ensure(candidate,401,'RECIPIENT_CHALLENGE_INVALID','验证码无效或已失效');
  await client.query("SELECT set_config('app.company_id',$1,true)",[candidate.company_id]);
  ensure(!candidate.verified_at&&Date.parse(candidate.expires_at)>Date.now()&&Number(candidate.attempts)<5,401,'RECIPIENT_CHALLENGE_INVALID','验证码无效或已失效');
  const expected=Buffer.from(candidate.code_hash,'hex'),actual=Buffer.from(hash(input.code),'hex'),valid=expected.length===actual.length&&timingSafeEqual(expected,actual);
  if(!valid){await client.query('UPDATE delivery.recipient_challenge SET attempts=attempts+1 WHERE company_id=$1 AND id=$2',[candidate.company_id,candidate.id]);ensure(false,401,'RECIPIENT_CHALLENGE_INVALID','验证码无效或已失效');}
  await client.query('UPDATE delivery.recipient_challenge SET verified_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[candidate.company_id,candidate.id]);
  const accessToken=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+900000).toISOString(),permissions=['DELIVERY_READ','ARRANGEMENT_REQUEST','DELIVERY_ACK','CASE_CREATE'];
  await client.query('INSERT INTO delivery.recipient_session(id,company_id,order_id,token_hash,permissions,expires_at) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),candidate.company_id,candidate.order_id,tokenHash(accessToken),permissions,expiresAt]);
  await client.query('COMMIT');return {accessToken,expiresAt,orderId:candidate.order_id,permissions};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}

function permission(session,needed){ensure(session.permissions.includes(needed),403,'RECIPIENT_PERMISSION_DENIED','当前收货人会话无此操作权限');}
async function orderForSession(client,session,orderId,version=null,{lock=false}={}){
 ensure(orderId===session.orderId,404,'NOT_FOUND','资源不存在');
 const row=(await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[session.companyId,orderId])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 const order=row.snapshot;ensure(version===null||order.order.version===version,412,'VERSION_CONFLICT','订单已变化，请重新查询');return order;
}
async function recipientEvidence(client,session,orderId,ids){
 ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');if(!ids.length)return;
 const count=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND recipient_session_id=$3 AND resource_type='ORDER' AND resource_id=$4 AND state='available'",[session.companyId,ids,session.id,orderId])).rows[0].count;
 ensure(count===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于当前收货人订单');
}
const caseView=row=>({id:row.id,version:1,orderId:row.order_id,type:row.type,state:'submitted',ownerDisplayName:null,nextAction:'等待运营受理',relatedQuoteId:null,relatedFinanceDocumentId:null});

export async function recipientDelivery(pool,token){
 return recipientTransaction(pool,token,async(client,session)=>{permission(session,'DELIVERY_READ');const row=(await client.query('SELECT * FROM delivery.recipient_tracking($1)',[tokenHash(token)])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return {orderLabel:row.order_label,state:row.state,promiseWindow:row.promise_window,etaAt:row.eta_at?.toISOString()??null,etaType:row.eta_type,updatedAt:row.updated_at.toISOString(),quality:row.quality,contactEntry:row.contact_entry};},{readOnly:true});
}

export async function recipientServiceRequest(pool,token,input,request){
 return recipientTransaction(pool,token,async(client,session)=>{permission(session,'CASE_CREATE');return recipientIdempotent(client,session,request,async()=>{const order=await orderForSession(client,session,input.orderId,input.orderVersion,{lock:true});
   if(input.type==='ADDRESS_CHANGE')ensure(input.requestedDelivery,422,'CHANGE_DETAILS_REQUIRED','改地址须提供新的送达地点');
   if(input.type==='TIME_CHANGE')ensure(input.requestedWindow,422,'CHANGE_DETAILS_REQUIRED','改时间须提供新的送达窗口');
   ensure(order.order.state!=='cancelled',409,'ORDER_NOT_ACTIONABLE','已取消订单不能提交收货人请求');await recipientEvidence(client,session,input.orderId,input.evidenceFileIds);const result={id:randomUUID(),orderId:input.orderId,orderVersion:input.orderVersion,type:input.type};
   await client.query('INSERT INTO casework.recipient_service_case(id,company_id,order_id,order_version,session_id,type,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[result.id,session.companyId,result.orderId,result.orderVersion,session.id,result.type,{...result,description:input.description.trim(),requestedDelivery:input.requestedDelivery??null,requestedWindow:input.requestedWindow??null,evidenceFileIds:input.evidenceFileIds,createdAt:new Date().toISOString()}]);
   const body=caseView({id:result.id,order_id:result.orderId,type:result.type});return {status:201,body,etag:'"1"'};});
 });
}

export async function recipientAcknowledgement(pool,token,input,request){
 return recipientTransaction(pool,token,async(client,session)=>{permission(session,'DELIVERY_ACK');return recipientIdempotent(client,session,request,async()=>{await orderForSession(client,session,session.orderId,null,{lock:true});await recipientEvidence(client,session,session.orderId,input.evidenceFileIds);
   const record=(await client.query('SELECT * FROM delivery.record WHERE company_id=$1 AND id=$2 AND order_id=$3',[session.companyId,input.deliveryRecordId,session.orderId])).rows[0];ensure(record&&Number(record.order_version)===input.deliveryRecordVersion,409,'DELIVERY_RECORD_STALE','交付记录不存在或已变化');ensure(Date.parse(input.observedAt)<=Date.now()+300000,422,'OBSERVATION_IN_FUTURE','确认时间不能显著晚于当前时间');
   const delivered=(await client.query("SELECT package_id FROM delivery.record_package WHERE company_id=$1 AND record_id=$2 AND outcome='DELIVERED'",[session.companyId,record.id])).rows.map(row=>row.package_id);
   ensure(new Set(input.deliveredPackageIds).size===input.deliveredPackageIds.length&&input.deliveredPackageIds.length>0,422,'DELIVERY_PACKAGES_INVALID','交付件不得重复且不能为空');const state=sameSet(input.deliveredPackageIds,delivered)?'matched':'needs_review',body={id:randomUUID(),version:1,state,orderId:session.orderId,deliveryRecordId:record.id};
   await client.query('INSERT INTO delivery.recipient_acknowledgement(id,company_id,order_id,delivery_record_id,session_id,state,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[body.id,session.companyId,body.orderId,body.deliveryRecordId,session.id,body.state,{...body,deliveredPackageIds:input.deliveredPackageIds,evidenceFileIds:input.evidenceFileIds,observedAt:input.observedAt,recordedAt:new Date().toISOString()}]);return {status:201,body,etag:'"1"'};});
 });
}

async function recipientIdempotent(client,session,request,work){
 const params=[session.companyId,session.id,request.method,request.path,request.key];await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(params)]);
 const prior=(await client.query('SELECT fingerprint,status,response,etag FROM delivery.recipient_request_result WHERE company_id=$1 AND session_id=$2 AND method=$3 AND path=$4 AND idempotency_key=$5',params)).rows[0];
 if(prior){ensure(prior.fingerprint===request.fingerprint,409,'IDEMPOTENCY_KEY_REUSED','同一幂等键不能用于不同内容');return {...prior,body:prior.response,replayed:true};}
 const result=await work();await client.query('INSERT INTO delivery.recipient_request_result(company_id,session_id,method,path,idempotency_key,fingerprint,status,response,etag) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[...params,request.fingerprint,result.status,result.body,result.etag]);return {...result,replayed:false};
}
function recipientOrderAuthorization(session,type,id){ensure(type==='ORDER'&&id===session.orderId,404,'NOT_FOUND','资源不存在');}
export async function recipientEvidenceWrite(pool,token,kind,id,input,version,options,request){
 return recipientTransaction(pool,token,async(client,session)=>{permission(session,kind==='evidence-download'?'DELIVERY_READ':'CASE_CREATE');const principal={companyId:session.companyId,principalId:null,recipientSessionId:session.id};const authorizeOrder=async(_client,_principal,type,resourceId)=>recipientOrderAuthorization(session,type,resourceId);
  if(kind==='evidence-download')return {status:200,body:await readEvidenceDownload(client,principal,id,{...options,authorizeOrder}),etag:''};
  if(kind==='evidence-create'){ensure(input.resourceType==='ORDER'&&input.resourceId===session.orderId&&['DELIVERY','DISPUTE'].includes(input.purpose),422,'RECIPIENT_EVIDENCE_SCOPE_INVALID','收货人仅能上传本订单的交付或争议证据');}
  return recipientIdempotent(client,session,request,async()=>{const data=kind==='evidence-download'?await readEvidenceDownload(client,principal,id,{...options,authorizeOrder}):await writeEvidence(client,principal,kind,id,input,version,{...options,authorizeOrder});return {status:kind==='evidence-create'?201:kind==='evidence-complete'?202:200,body:data,etag:data.version?`\"${data.version}\"`:''};});
 });
}
