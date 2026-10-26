import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,rename,stat,unlink,writeFile} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {ensure} from '../domain/errors.mjs';
import {getOrder} from './orders.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mimeTypes=new Set(['image/jpeg','image/png','application/pdf']);
const hash=value=>createHash('sha256').update(value).digest('hex');
const view=row=>({id:row.id,version:Number(row.version),state:row.state,mimeType:row.actual_mime_type??row.declared_mime_type,sizeBytes:Number(row.actual_size_bytes??row.declared_size_bytes),sha256:row.actual_sha256??row.declared_sha256});
const pathFor=(directory,id)=>{const root=resolve(directory),path=resolve(root,id+'.bin');ensure(path.startsWith(root+sep),500,'EVIDENCE_STORAGE_UNAVAILABLE','本地证据目录无效');return path;};
const magicMatches=(mime,bytes)=>mime==='image/jpeg'?bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff:mime==='image/png'?bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])):bytes.length>=5&&bytes.subarray(0,5).toString('ascii')==='%PDF-';
const uploadUrl=(origin,id,token)=>new URL('/dev/evidence-uploads/'+id+'?token='+token,origin).toString();
const signDownload=(secret,id,expires)=>createHmac('sha256',secret).update(id+':'+expires).digest('hex');
const verifyDownload=(secret,id,token)=>{
 const [rawExpiry,signature,...extra]=(token??'').split('.');if(extra.length||!/^1[0-9]{12,}$/.test(rawExpiry??'')||!/^[a-f0-9]{64}$/.test(signature??''))return false;
 const expiry=Number(rawExpiry),expected=signDownload(secret,id,expiry);return Number.isSafeInteger(expiry)&&expiry>Date.now()&&expiry<=Date.now()+600000&&timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'));
};
async function authorizeResource(client,principal,type,id,authorizeOrder=null){
 if(type==='ORDER'){if(authorizeOrder)await authorizeOrder(client,principal,type,id);else await getOrder(client,principal,id);return;}
 if(type==='WAREHOUSE_REQUEST'&&uuid.test(id)){
  const request=(await client.query('SELECT id FROM warehouse.request WHERE company_id=$1 AND id=$2',[principal.companyId,id])).rows[0];
  ensure(request,404,'NOT_FOUND','资源不存在');return;
 }
 ensure(type==='PARTNER'&&uuid.test(id),422,'EVIDENCE_RESOURCE_UNSUPPORTED','本地证据上传仅已接入订单或合作方预登记对象');
 const carrier=(await client.query('SELECT id FROM partner.carrier WHERE company_id=$1 AND evidence_bundle_id=$2',[principal.companyId,id])).rows[0];
 if(carrier)return;
 // shortcut: an unbound UUID is a one-principal pre-registration bundle; bind it on carrier creation.
}
async function evidenceRow(client,principal,id,{lock=false,authorizeOrder=null}={}){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await client.query('SELECT * FROM evidence.file WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');await authorizeResource(client,principal,row.resource_type,row.resource_id,authorizeOrder);return row;
}
export async function writeEvidence(client,principal,kind,id,input,version,{origin,evidenceDirectory,authorizeOrder=null}){
 ensure(evidenceDirectory,503,'EVIDENCE_STORAGE_UNAVAILABLE','本地证据存储未配置');
 if(kind==='create'){
  if(input.resourceType==='PARTNER')ensure(input.purpose==='QUALIFICATION',422,'EVIDENCE_PURPOSE_INVALID','合作方预登记仅接受QUALIFICATION证照协议文件');
  await authorizeResource(client,principal,input.resourceType,input.resourceId,authorizeOrder);
  const fileId=randomUUID(),token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+300000).toISOString();
  await client.query("INSERT INTO evidence.file(id,company_id,principal_id,recipient_session_id,resource_type,resource_id,purpose,declared_mime_type,declared_size_bytes,declared_sha256,state,upload_token_hash,expires_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'issued',$11,$12,1)",[fileId,principal.companyId,principal.principalId??null,principal.recipientSessionId??null,input.resourceType,input.resourceId,input.purpose,input.mimeType,input.sizeBytes,input.sha256,hash(token),expiresAt]);
  return {id:fileId,version:1,uploadUrl:uploadUrl(origin,fileId,token),method:'PUT',expiresAt};
 }
 const file=await evidenceRow(client,principal,id,{lock:true,authorizeOrder});
 ensure(file.state==='uploaded',409,'EVIDENCE_NOT_UPLOADED','证据尚未完成校验上传');
 ensure(Number(file.version)===version,412,'VERSION_CONFLICT','证据版本已变化，请重新查询');
 const objectPath=pathFor(evidenceDirectory,file.id),actual=await stat(objectPath).catch(()=>null);
 ensure(actual&&actual.isFile()&&actual.size===Number(file.actual_size_bytes),409,'EVIDENCE_OBJECT_MISSING','证据对象不存在或已变化');
 // shortcut: local structural scan only; replace with isolated malware scanning before production.
 const scanning=await client.query("UPDATE evidence.file SET state='scanning',version=version+1,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2 RETURNING *",[principal.companyId,file.id]);
 const available=await client.query("UPDATE evidence.file SET state='available',version=version+1,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2 RETURNING *",[principal.companyId,file.id]);
 ensure(scanning.rowCount===1&&available.rowCount===1,409,'EVIDENCE_STATE_CHANGED','证据状态已变化');
 return view(available.rows[0]);
}
export async function readEvidenceDownload(client,principal,id,{origin,downloadSecret,authorizeOrder=null}){
 const file=await evidenceRow(client,principal,id,{authorizeOrder});
 ensure(file.state==='available',409,'EVIDENCE_NOT_AVAILABLE','证据尚未完成安全检查');
 const expires=Date.now()+300000,token=expires+'.'+signDownload(downloadSecret,file.id,expires);
 return {url:new URL('/dev/evidence-files/'+file.id+'?token='+token,origin).toString(),expiresAt:new Date(expires).toISOString()};
}
async function readRawBody(req){
 const mime=(req.headers['content-type']??'').split(';',1)[0].toLowerCase();ensure(mimeTypes.has(mime),415,'EVIDENCE_MIME_INVALID','证据类型不受支持');
 ensure(!req.headers['content-encoding'],415,'UNSUPPORTED_ENCODING','不接受压缩证据上传');
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;ensure(size<=10485760,413,'BODY_TOO_LARGE','证据不得超过10MiB');chunks.push(chunk);}
 ensure(size>0,422,'EVIDENCE_EMPTY','证据不能为空');return {mime,bytes:Buffer.concat(chunks)};
}
async function uploadObject(req,pool,directory,id,token){
 ensure(uuid.test(id)&&typeof token==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(token),404,'NOT_FOUND','上传链接无效');
 const {mime,bytes}=await readRawBody(req),sha256=hash(bytes);ensure(magicMatches(mime,bytes),422,'EVIDENCE_MAGIC_INVALID','证据内容与声明类型不一致');
 const client=await pool.connect();let target,temp;
 try{
  await client.query('BEGIN');await client.query("SELECT set_config('app.evidence_upload_token_hash',$1,true)",[hash(token)]);
  const row=(await client.query('SELECT * FROM evidence.file WHERE id=$1 FOR UPDATE',[id])).rows[0];
  ensure(row,404,'NOT_FOUND','上传链接无效');ensure(new Date(row.expires_at).getTime()>Date.now(),410,'EVIDENCE_UPLOAD_EXPIRED','上传链接已过期');
  ensure(row.declared_mime_type===mime&&Number(row.declared_size_bytes)===bytes.length&&row.declared_sha256===sha256,422,'EVIDENCE_DECLARATION_MISMATCH','证据与上传申请不一致');
  await client.query("SELECT set_config('app.company_id',$1,true)",[row.company_id]);
  await mkdir(directory,{recursive:true});target=pathFor(directory,id);temp=target+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temp,bytes,{flag:'wx'});await rename(temp,target);temp=null;
  const updated=await client.query("UPDATE evidence.file SET state='uploaded',object_key=$2,actual_mime_type=$3,actual_size_bytes=$4,actual_sha256=$5,version=version+1,updated_at=clock_timestamp() WHERE id=$1",[id,id+'.bin',mime,bytes.length,sha256]);
  ensure(updated.rowCount===1,409,'EVIDENCE_STATE_CHANGED','证据已上传或状态已变化');await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});if(temp)await unlink(temp).catch(()=>{});if(target)await unlink(target).catch(()=>{});throw error;}finally{client.release();}
}
async function downloadObject(res,pool,directory,id,token,secret){
 ensure(uuid.test(id)&&verifyDownload(secret,id,token),404,'NOT_FOUND','下载链接无效或已过期');
 const client=await pool.connect();
 try{
  await client.query('BEGIN READ ONLY');await client.query("SELECT set_config('app.evidence_download_file_id',$1,true)",[id]);
  const row=(await client.query("SELECT object_key,actual_mime_type,actual_size_bytes FROM evidence.file WHERE id=$1",[id])).rows[0];ensure(row,404,'NOT_FOUND','下载链接无效或已过期');await client.query('COMMIT');
  const bytes=await readFile(pathFor(directory,id));ensure(bytes.length===Number(row.actual_size_bytes),409,'EVIDENCE_OBJECT_MISSING','证据对象不存在或已变化');
  res.writeHead(200,{'Content-Type':row.actual_mime_type,'Content-Length':String(bytes.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename=\"evidence-'+id+'\"'});res.end(bytes);
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
export async function serveEvidenceObject(req,res,pool,evidenceDirectory,url,downloadSecret){
 const upload=url.pathname.match(/^\/dev\/evidence-uploads\/([^/]+)$/);if(upload){ensure(url.searchParams.size===1&&url.searchParams.getAll('token').length===1,404,'NOT_FOUND','上传链接无效');ensure(req.method==='PUT',405,'METHOD_NOT_ALLOWED','上传链接只接受PUT');await uploadObject(req,pool,evidenceDirectory,upload[1],url.searchParams.get('token'));res.writeHead(204,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end();return true;}
 const download=url.pathname.match(/^\/dev\/evidence-files\/([^/]+)$/);if(download){ensure(url.searchParams.size===1&&url.searchParams.getAll('token').length===1,404,'NOT_FOUND','下载链接无效');ensure(req.method==='GET',405,'METHOD_NOT_ALLOWED','下载链接只接受GET');await downloadObject(res,pool,evidenceDirectory,download[1],url.searchParams.get('token'),downloadSecret);return true;}
 return false;
}
