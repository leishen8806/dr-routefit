// CMP-1708: ops roles / staff persistence. Permission checks (roles:*, staff:write) are enforced by the HTTP layer
// from the server-side principal; this module enforces the business rules and the optimistic-version contract.
import {ensure} from '../domain/errors.mjs';
import {PERMISSION_CODES,PERMISSION_MODULES,permissionCatalogVersion} from '../domain/permission-catalog.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roleView=row=>({id:row.id,name:row.name,permissions:row.permissions,version:Number(row.version)});
const staffView=row=>({id:row.id,personId:row.person_id,roleIds:row.role_ids,state:row.status.toLowerCase(),version:Number(row.version)});
const event=(client,principal,resource,id,version,action,snapshot)=>client.query('INSERT INTO org.ops_change_event(company_id,resource,resource_id,version,action,principal_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,resource,id,version,action,principal.principalId,{...snapshot,recordedAt:new Date().toISOString()}]);

export function readPermissionCatalog(ifNoneMatch){
 const etag=`"${permissionCatalogVersion()}"`;
 if(ifNoneMatch===etag)return {status:304,body:{},etag};
 return {status:200,body:{modules:PERMISSION_MODULES},etag};
}

export async function writeRolePermissions(client,principal,roleId,input,version){
 ensure(uuid.test(roleId),404,'NOT_FOUND','资源不存在');
 const role=(await client.query('SELECT * FROM org.role WHERE company_id=$1 AND id=$2 FOR UPDATE',[principal.companyId,roleId])).rows[0];
 ensure(role,404,'NOT_FOUND','资源不存在');
 ensure(Number(role.version)===version,412,'VERSION_CONFLICT','角色已变化，请重新查询');
 ensure(!role.is_system,409,'SYSTEM_ROLE_IMMUTABLE','系统角色不可修改');
 const unknown=input.permissions.filter(code=>!PERMISSION_CODES.has(code));
 ensure(!unknown.length,422,'UNKNOWN_PERMISSION','权限点不在目录中：'+unknown.slice(0,5).join(','));
 ensure(!(input.permissions.includes('payouts:approve')&&input.permissions.includes('payouts:confirm-paid')),422,'HARD_CONSTRAINT_VIOLATION','同一角色不得同时拥有出款审批与确认付款');
 const next=(await client.query('UPDATE org.role SET permissions=$3,version=version+1,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2 RETURNING *',[principal.companyId,roleId,[...input.permissions].sort()])).rows[0];
 const result=roleView(next);await event(client,principal,'ROLE',roleId,result.version,'SET_PERMISSIONS',result);return result;
}

async function staffRow(client,principal,staffId){
 ensure(uuid.test(staffId),404,'NOT_FOUND','资源不存在');
 const row=(await client.query("SELECT p.id,p.person_id,p.status,s.role_ids,s.version FROM org.principal p JOIN org.staff_profile s ON s.company_id=p.company_id AND s.principal_id=p.id WHERE p.company_id=$1 AND p.id=$2 AND p.kind='STAFF' FOR UPDATE OF s",[principal.companyId,staffId])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');return row;
}

export async function writeStaff(client,principal,kind,staffId,input,version){
 const current=await staffRow(client,principal,staffId);
 ensure(Number(current.version)===version,412,'VERSION_CONFLICT','员工已变化，请重新查询');
 let status=current.status,roleIds=current.role_ids,action;
 if(kind==='patch'){
  action='PATCH';ensure(staffId!==principal.principalId,403,'SELF_ROLE_CHANGE_FORBIDDEN','不得修改自己的角色');
  const found=Number((await client.query('SELECT count(*) AS count FROM org.role WHERE company_id=$1 AND id=ANY($2::uuid[])',[principal.companyId,input.roleIds])).rows[0].count);
  ensure(found===input.roleIds.length,422,'UNKNOWN_ROLE','角色不存在');roleIds=input.roleIds;
 }else if(kind==='disable'){
  action='DISABLE';ensure(staffId!==principal.principalId,403,'SELF_DISABLE_FORBIDDEN','不能停用自己');
  ensure(current.status==='ACTIVE',409,'INVALID_TRANSITION','员工当前状态不能停用');status='DISABLED';
 }else{
  action='ENABLE';ensure(current.status==='DISABLED',409,'INVALID_TRANSITION','员工当前状态不能启用');status='ACTIVE';
 }
 if(status!==current.status)await client.query('UPDATE org.principal SET status=$3 WHERE company_id=$1 AND id=$2',[principal.companyId,staffId,status]);
 const next=(await client.query('UPDATE org.staff_profile SET role_ids=$3,version=version+1,updated_at=clock_timestamp() WHERE company_id=$1 AND principal_id=$2 RETURNING version',[principal.companyId,staffId,roleIds])).rows[0];
 const result=staffView({...current,status,role_ids:roleIds,version:next.version});await event(client,principal,'STAFF',staffId,result.version,action,result);return result;
}
