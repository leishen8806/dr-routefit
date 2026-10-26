const prefix='/api/ops/v1/pricing';
export class FeeError extends Error{
 constructor(status,code,fields=[],requestId=''){super(code);Object.assign(this,{status,code,fields,requestId});}
}
export class FeeClient{
 #fetch;#session=null;#pending=null;#sending=false;
 constructor(fetchImpl=globalThis.fetch.bind(globalThis)){this.#fetch=fetchImpl;}
 get pending(){return this.#pending?{path:this.#pending.path}:null;}
 get identity(){const s=this.#session;return s?{companyId:s.companyId,principalId:s.principalId,permissions:[...s.permissions]}:null;}
 async #request(path,init={}){
  let r;try{r=await this.#fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...init});}catch{throw new FeeError(0,'RESULT_UNKNOWN');}
  let data;try{data=await r.json();}catch{throw new FeeError(r.status>=400&&r.status<500?r.status:0,'INVALID_RESPONSE');}
  if(!r.ok)throw new FeeError(r.status,data.error?.code||'UNKNOWN_ERROR',data.error?.fields||[],data.error?.requestId||'');
  if(!data||typeof data!=='object')throw new FeeError(0,'INVALID_RESPONSE');
  return {data,etag:r.headers.get('ETag'),replayed:r.headers.get('Idempotency-Replayed')==='true'};
 }
 async connect(){
  const {data:s}=await this.#request('/dev/session');
  if(!s.companyId||!s.principalId||!s.csrfToken||!Array.isArray(s.permissions))throw new FeeError(0,'INVALID_SESSION');
  const changed=this.#session&&(s.companyId!==this.#session.companyId||s.principalId!==this.#session.principalId);
  this.#session=s;if(changed){this.#pending=null;throw new FeeError(401,'IDENTITY_CHANGED');}return this.identity;
 }
 async get(path){return this.#request(prefix+path);}
 async mutate(path,body,etag){
  if(this.#pending||this.#sending)throw new FeeError(409,'PENDING_OPERATION');
  if(!this.#session)throw new FeeError(401,'SESSION_REQUIRED');
  const permission=path.endsWith('/trials')?'pricing:read':'pricing:write';
  if(!this.#session.permissions.includes(permission))throw new FeeError(403,'FORBIDDEN');
  this.#pending={path,body:JSON.stringify(body),key:crypto.randomUUID(),etag,identity:this.#session.companyId+':'+this.#session.principalId};
  return this.#send();
 }
 async retry(){if(this.#sending)throw new FeeError(409,'PENDING_OPERATION');if(!this.#pending)throw new FeeError(409,'NO_PENDING');await this.connect();return this.#send();}
 async #send(){
  const p=this.#pending;if(!p)throw new FeeError(409,'NO_PENDING');this.#sending=true;
  try{
   const result=await this.#request(prefix+p.path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':this.#session.csrfToken,'Idempotency-Key':p.key,...(p.etag?{'If-Match':p.etag}:{})},body:p.body});
   if(!result.data.id||!Number.isInteger(result.data.version??result.data.tariffVersion))throw new FeeError(0,'INVALID_RESPONSE');
   this.#pending=null;return result;
  }catch(e){if(e.status>=400&&e.status<500&&![401,403,429].includes(e.status)&&e.code!=='REQUEST_IN_PROGRESS')this.#pending=null;throw e;}
  finally{this.#sending=false;}
 }
}
