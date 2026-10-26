import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=randomBytes(32),sign=value=>createHmac('sha256',key).update(value).digest('base64url');
const view=row=>({id:row.id,version:Number(row.version),state:row.state,data:row.snapshot.data});
const unique=values=>new Set(values).size===values.length;

export function accessGrantQuery(url,principal){
 for(const name of url.searchParams.keys())ensure(['limit','cursor'].includes(name)&&url.searchParams.getAll(name).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');
 const binding=JSON.stringify([principal.companyId,principal.principalId,limit]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
async function grant(client,principal,id,lock=false){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT * FROM org.role_grant WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;
}
async function validateScope(client,principal,input){
 ensure(input.principalId!==principal.principalId,403,'SELF_GRANT_FORBIDDEN','不得向当前授权人自行授予角色');ensure(unique(input.warehouseIds)&&unique(input.subjectIds),422,'DUPLICATE_SCOPE','权限范围不得重复');
 const target=(await client.query("SELECT 1 FROM org.principal WHERE company_id=$1 AND id=$2 AND kind='STAFF' AND status='ACTIVE'",[principal.companyId,input.principalId])).rowCount;ensure(target,404,'NOT_FOUND','被授权主体不存在或不可授权');
 if(input.warehouseIds.length){const found=Number((await client.query('SELECT count(*) AS count FROM warehouse.site WHERE company_id=$1 AND id=ANY($2::uuid[])',[principal.companyId,input.warehouseIds])).rows[0].count);ensure(found===input.warehouseIds.length,404,'NOT_FOUND','仓库范围不存在');}
 if(input.subjectIds.length){const found=Number((await client.query("SELECT count(*) AS count FROM (SELECT id FROM org.principal WHERE company_id=$1 AND id=ANY($2::uuid[]) UNION SELECT id FROM party.customer WHERE company_id=$1 AND id=ANY($2::uuid[])) scope",[principal.companyId,input.subjectIds])).rows[0].count);ensure(found===input.subjectIds.length,404,'NOT_FOUND','对象范围不存在');}
 ensure(Date.parse(input.expiresAt)>Date.now(),422,'INVALID_EXPIRY','授权到期时间必须在未来');
}
export async function readAccessGrants(client,principal,query){
 const rows=(await client.query('SELECT * FROM org.role_grant WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,query.after,query.limit+1])).rows,items=rows.slice(0,query.limit).map(view);
 return {items,nextCursor:rows.length>query.limit?query.cursor(items.at(-1).id):null};
}
export async function writeAccessGrant(client,principal,kind,id,input,version){
 if(kind==='create'){
  await validateScope(client,principal,input);const result={id:randomUUID(),version:1,state:'active',data:input};
  await client.query('INSERT INTO org.role_grant(id,company_id,principal_id,role,warehouse_ids,subject_ids,expires_at,state,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[result.id,principal.companyId,input.principalId,input.role,input.warehouseIds,input.subjectIds,input.expiresAt,result.state,result.version,result,principal.principalId]);
  await client.query("INSERT INTO org.role_grant_event(company_id,grant_id,version,action,principal_id,snapshot) VALUES($1,$2,1,'GRANTED',$3,$4)",[principal.companyId,result.id,principal.principalId,{...result,recordedAt:new Date().toISOString()}]);return result;
 }
 const current=await grant(client,principal,id,true);ensure(Number(current.version)===version,412,'VERSION_CONFLICT','授权已变化，请重新查询');ensure(current.state==='active',409,'GRANT_NOT_REVOCABLE','当前授权不能撤销');ensure(input.reason.trim(),422,'REASON_REQUIRED','撤销必须填写原因');
 const result={...view(current),version:Number(current.version)+1,state:'revoked'};
 await client.query('UPDATE org.role_grant SET state=$3,version=$4,snapshot=$5,revoked_by=$6,revoked_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,result.state,result.version,result,principal.principalId]);
 await client.query("INSERT INTO org.role_grant_event(company_id,grant_id,version,action,principal_id,snapshot) VALUES($1,$2,$3,'REVOKED',$4,$5)",[principal.companyId,id,result.version,principal.principalId,{...result,reason:input.reason.trim(),recordedAt:new Date().toISOString()}]);return result;
}
