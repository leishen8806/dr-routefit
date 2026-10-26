import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {validateFee,calculate} from '../domain/pricing.mjs';

export async function assertRuntimeRole(pool){
 const r=(await pool.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];
 ensure(r&&!r.rolsuper&&!r.rolbypassrls&&!r.rolcreaterole&&!r.rolreplication,503,'UNSAFE_DATABASE_ROLE','API数据库账号不能具有管理、复制或绕过RLS权限');
 const ready=await pool.query("SELECT to_regclass('pricing.tariff') IS NOT NULL AND to_regclass('orders.draft') IS NOT NULL AND to_regclass('orders.cancellation') IS NOT NULL AND to_regclass('pricing.policy_publication') IS NOT NULL AND to_regclass('finance.reversal_event') IS NOT NULL AND to_regclass('finance.ledger_item') IS NOT NULL AND to_regclass('finance.amendment_adjustment') IS NOT NULL AND to_regclass('casework.service_case') IS NOT NULL AND to_regclass('casework.dispatch_exception') IS NOT NULL AND to_regclass('partner.carrier') IS NOT NULL AND to_regclass('pricing.amendment_quote') IS NOT NULL AND to_regclass('pricing.quote_change_position') IS NOT NULL AND to_regclass('fleet.vehicle') IS NOT NULL AND to_regclass('dispatch.promise_check') IS NOT NULL AND to_regclass('dispatch.service_promise') IS NOT NULL AND to_regclass('dispatch.capacity_reservation') IS NOT NULL AND to_regclass('dispatch.load_review') IS NOT NULL AND to_regclass('dispatch.route_plan') IS NOT NULL AND to_regclass('dispatch.fulfillment_execution') IS NOT NULL AND to_regclass('dispatch.assignment') IS NOT NULL AND to_regclass('evidence.file') IS NOT NULL AND to_regclass('custody.transfer') IS NOT NULL AND to_regclass('delivery.recipient_authorization') IS NOT NULL AS ready");
 ensure(ready.rows[0].ready,503,'MIGRATION_REQUIRED','请先执行数据库迁移');
 const mobileReady=await pool.query("SELECT to_regclass('mobile.location_event') IS NOT NULL AND to_regclass('mobile.sync_event') IS NOT NULL AS ready");
 ensure(mobileReady.rows[0].ready,503,'MIGRATION_REQUIRED','请先执行数据库迁移');
 const deliveryReady=await pool.query("SELECT to_regclass('delivery.record') IS NOT NULL AS ready");
 ensure(deliveryReady.rows[0].ready,503,'MIGRATION_REQUIRED','请先执行数据库迁移');
 const returnReady=await pool.query("SELECT to_regclass('dispatch.return_task') IS NOT NULL AND to_regclass('warehouse.site') IS NOT NULL AND to_regclass('warehouse.request') IS NOT NULL AND to_regclass('warehouse.inventory_snapshot') IS NOT NULL AND to_regclass('warehouse.stock_reservation') IS NOT NULL AND to_regclass('integration.service_binding') IS NOT NULL AND to_regclass('integration.external_intake') IS NOT NULL AND to_regclass('integration.wms_stock_event') IS NOT NULL AND to_regclass('party.portal_membership') IS NOT NULL AND to_regclass('party.portal_membership_event') IS NOT NULL AND to_regclass('org.external_subject_access') IS NOT NULL AND to_regclass('finance.external_settlement_request') IS NOT NULL AND to_regclass('finance.export_job') IS NOT NULL AND to_regclass('delivery.recipient_challenge') IS NOT NULL AND to_regclass('delivery.recipient_session') IS NOT NULL AND to_regclass('delivery.recipient_request_result') IS NOT NULL AND to_regprocedure('delivery.recipient_session_identity(text)') IS NOT NULL AND to_regprocedure('delivery.recipient_challenge_identity(uuid)') IS NOT NULL AND to_regprocedure('delivery.recipient_tracking(text)') IS NOT NULL AND to_regprocedure('sharing.public_tracking(text)') IS NOT NULL AND to_regclass('finance.receipt') IS NOT NULL AND to_regclass('finance.payment_intent') IS NOT NULL AND to_regclass('finance.payment_intent_event') IS NOT NULL AND to_regclass('finance.workflow_document') IS NOT NULL AND to_regclass('finance.workflow_document_event') IS NOT NULL AND to_regclass('finance.workflow_account_change_secret') IS NOT NULL AND to_regclass('finance.channel_settlement') IS NOT NULL AND to_regclass('finance.channel_settlement_receipt') IS NOT NULL AND to_regclass('dispatch.rescue_plan') IS NOT NULL AND to_regclass('dispatch.rescue_assignment') IS NOT NULL AND to_regclass('dispatch.rescue_assignment_package') IS NOT NULL AND to_regclass('finance.cash_handover') IS NOT NULL AND to_regclass('finance.settlement_rule') IS NOT NULL AND to_regclass('finance.statement') IS NOT NULL AND to_regclass('finance.settlement_account') IS NOT NULL AND to_regclass('finance.settlement_account_subject_version_unique') IS NOT NULL AND to_regclass('finance.refund_request') IS NOT NULL AND to_regclass('finance.driver_withdrawal_request') IS NOT NULL AND to_regclass('finance.task_read') IS NOT NULL AND to_regclass('finance.task_hold_event') IS NOT NULL AND to_regclass('notification.template') IS NOT NULL AND to_regclass('notification.message') IS NOT NULL AND to_regclass('org.role_grant') IS NOT NULL AND to_regclass('finance.bank_transaction') IS NOT NULL AS ready");
 ensure(returnReady.rows[0].ready,503,'MIGRATION_REQUIRED','请先执行数据库迁移');
 const owned=await pool.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('org','pricing','integration','party','orders','coverage','finance','casework','fleet','dispatch','evidence','partner','custody','delivery') AND pg_has_role(current_user,c.relowner,'MEMBER') LIMIT 1");
 ensure(!owned.rowCount,503,'UNSAFE_DATABASE_ROLE','API账号不能拥有或继承业务表owner');
 const mobileOwned=await pool.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='mobile' AND pg_has_role(current_user,c.relowner,'MEMBER') LIMIT 1");
 ensure(!mobileOwned.rowCount,503,'UNSAFE_DATABASE_ROLE','API账号不能拥有或继承业务表owner');
 const warehouseOwned=await pool.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('warehouse','sharing','notification') AND pg_has_role(current_user,c.relowner,'MEMBER') LIMIT 1");
 ensure(!warehouseOwned.rowCount,503,'UNSAFE_DATABASE_ROLE','API账号不能拥有或继承业务表owner');
}
export async function transaction(pool,principal,work,{readOnly=false}={}){
 const client=await pool.connect();
 try{
  await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
  await client.query("SET LOCAL lock_timeout='2s'");await client.query("SET LOCAL statement_timeout='5s'");
  await client.query("SELECT set_config('app.company_id',$1,true)",[principal.companyId]);
  await client.query("SELECT set_config('app.principal_id',$1,true)",[principal.principalId]);
  const active=await client.query("SELECT p.id FROM org.principal p JOIN org.company c ON c.id=p.company_id WHERE p.company_id=$1 AND p.id=$2 AND p.status='ACTIVE' AND c.status='ACTIVE'",[principal.companyId,principal.principalId]);
  ensure(active.rowCount===1,401,'SESSION_REVOKED','当前主体或企业已停用');
  const result=await work(client);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
const ruleView=r=>({code:r.code,enabled:r.enabled,method:r.method,amount:Number(r.amount),unit:r.unit,includedMilli:Number(r.included_milli),stepMilli:Number(r.step_milli),share:r.share,scope:r.scope,evidence:r.evidence});
export async function getTariff(client,companyId,id,lock=false){
 const r=(await client.query('SELECT * FROM pricing.tariff WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[companyId,id])).rows[0];
 ensure(r,404,'NOT_FOUND','资源不存在');
 const rules=(await client.query('SELECT * FROM pricing.fee_rule WHERE company_id=$1 AND tariff_id=$2 ORDER BY code',[companyId,id])).rows.map(ruleView);
 return {id:r.id,name:r.name,owner:r.owner,currency:r.currency,scope:r.scope,state:r.state,version:Number(r.version),rules,createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString()};
}
async function revision(client,principal,tariff){
 await client.query('INSERT INTO pricing.tariff_revision(company_id,tariff_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[principal.companyId,tariff.id,tariff.version,tariff,principal.principalId]);
}
export async function createTariff(client,principal,p){
 ensure(p.name.trim()&&p.scope.trim(),422,'EMPTY_TARIFF','名称与适用范围不能为空');
 const id=randomUUID();
 await client.query('INSERT INTO pricing.tariff(id,company_id,owner,currency,name,scope,version,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,1,$7,$7)',[id,principal.companyId,p.owner,p.currency,p.name.trim(),p.scope.trim(),principal.principalId]);
 const t=await getTariff(client,principal.companyId,id);await revision(client,principal,t);return t;
}
export async function saveFee(client,principal,id,p,version){
 const t=await getTariff(client,principal.companyId,id,true);
 ensure(t.version===version,412,'VERSION_CONFLICT','费用版本已变化，请重新查询');validateFee(p,t);
 await client.query(`INSERT INTO pricing.fee_rule(company_id,tariff_id,owner,code,enabled,method,amount,unit,included_milli,step_milli,share,scope,evidence)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
 ON CONFLICT(company_id,tariff_id,code) DO UPDATE SET enabled=EXCLUDED.enabled,method=EXCLUDED.method,amount=EXCLUDED.amount,unit=EXCLUDED.unit,included_milli=EXCLUDED.included_milli,step_milli=EXCLUDED.step_milli,share=EXCLUDED.share,scope=EXCLUDED.scope,evidence=EXCLUDED.evidence`,
 [principal.companyId,id,t.owner,p.code,p.enabled,p.method,p.amount,p.unit,p.includedMilli,p.stepMilli,p.share,p.scope.trim(),p.evidence.trim()]);
 await client.query('UPDATE pricing.tariff SET version=version+1,updated_by=$3,updated_at=now() WHERE company_id=$1 AND id=$2',[principal.companyId,id,principal.principalId]);
 const result=await getTariff(client,principal.companyId,id);await revision(client,principal,result);return result;
}
export async function createTrial(client,principal,id,p,version){
 const t=await getTariff(client,principal.companyId,id,true);ensure(t.version===version,412,'VERSION_CONFLICT','费用配置已变化，请重新查询');
 const result={id:randomUUID(),tariffId:id,tariffVersion:t.version,state:'SIMULATION',...calculate(t,p.lines),createdAt:new Date().toISOString()};
 await client.query('INSERT INTO pricing.trial(id,company_id,tariff_id,tariff_version,principal_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[result.id,principal.companyId,id,t.version,principal.principalId,result]);
 return result;
}
export async function readResource(client,principal,kind,id,{limit=50,after=null}={}){
 const company=principal.companyId;
 if(kind==='tariff')return getTariff(client,company,id);
 if(kind==='trial'){
  const r=(await client.query('SELECT snapshot FROM pricing.trial WHERE company_id=$1 AND id=$2',[company,id])).rows[0];ensure(r,404,'NOT_FOUND','资源不存在');return r.snapshot;
 }
 if(kind==='revisions'){
  await getTariff(client,company,id);
  const rows=(await client.query('SELECT * FROM pricing.tariff_revision WHERE company_id=$1 AND tariff_id=$2 AND ($3::bigint IS NULL OR version<$3) ORDER BY version DESC LIMIT $4',[company,id,after,limit+1])).rows;
  const items=rows.slice(0,limit).map(r=>({tariffId:r.tariff_id,version:Number(r.version),snapshot:r.snapshot,principalId:r.principal_id,createdAt:r.created_at.toISOString()}));
  return {items,nextAfterVersion:rows.length>limit?items.at(-1).version:null};
 }
 const rows=(await client.query('SELECT id FROM pricing.tariff WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[company,after,limit+1])).rows;
 const items=[];for(const row of rows.slice(0,limit))items.push(await getTariff(client,company,row.id));
 return {items,nextAfter:rows.length>limit?items.at(-1).id:null};
}
export async function idempotent(client,principal,request,work){
 const params=[principal.companyId,principal.principalId,request.method??'POST',request.path,request.key];
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(params)]);
 const prior=(await client.query('SELECT * FROM integration.http_request_result WHERE company_id=$1 AND principal_id=$2 AND method=$3 AND path=$4 AND idempotency_key=$5',params)).rows[0];
 if(prior){ensure(prior.fingerprint===request.fingerprint,409,'IDEMPOTENCY_KEY_REUSED','同一幂等键不能用于不同内容或前置版本');return {status:prior.status,body:prior.response,etag:prior.etag,replayed:true};}
 const result=await work();
 await client.query('INSERT INTO integration.http_request_result(company_id,principal_id,method,path,idempotency_key,fingerprint,status,response,etag) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[...params,request.fingerprint,result.status,result.body,result.etag]);
 return {...result,replayed:false};
}
