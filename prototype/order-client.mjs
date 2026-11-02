export class OrderApiError extends Error {
 constructor(status,code,fields=[]){super(code);Object.assign(this,{status,code,fields});}
}
export function createOrderClient({fetchImpl=globalThis.fetch,uuid=()=>crypto.randomUUID()}={}){
 let session=null,pending=null;
 const owner=s=>s&&`${s.companyId}:${s.principalId}`;
 async function request(path,options={}){
  let response,value;
  try{response=await fetchImpl(path,{credentials:'same-origin',signal:AbortSignal.timeout(15000),...options});value=await response.json();}
  catch{throw new OrderApiError(0,'RESULT_UNKNOWN');}
  if(!response.ok)throw new OrderApiError(response.status,value.error?.code||'HTTP_ERROR',value.error?.fields||[]);
  if(response.headers?.get?.('Idempotency-Replayed')==='true'&&value&&typeof value==='object')Object.defineProperty(value,'replayed',{value:true});
  return value;
 }
 async function connect(){
  const next=await request('/dev/session'),changed=session&&owner(next)!==owner(session);
  session=next;
  if(changed){pending=null;throw new OrderApiError(401,'IDENTITY_CHANGED');}
  return next;
 }
 async function submit(){
  if(!session)throw new OrderApiError(401,'UNAUTHENTICATED');
  if(pending.owner!==owner(session))throw new OrderApiError(401,'IDENTITY_CHANGED');
  try{
   const value=await request(pending.path,{method:pending.method,headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'Idempotency-Key':pending.key,...(pending.version?{'If-Match':`"${pending.version}"`}:{})},body:pending.body});
   pending=null;return value;
  }catch(error){
   // Unknown execution results keep the exact request; a new key could create a duplicate order.
   if(error.status>=400&&error.status<500&&![401,408,429].includes(error.status)&&error.code!=='REQUEST_IN_PROGRESS')pending=null;
   throw error;
  }
 }
 return {
  connect,read:path=>request(path),get session(){return session;},get pending(){return Boolean(pending);},
  async command(path,body,version){
   if(pending)throw new OrderApiError(409,'UNRESOLVED_REQUEST');
   if(!session)throw new OrderApiError(401,'UNAUTHENTICATED');
   pending={owner:owner(session),method:'POST',path,body:JSON.stringify(body),version,key:uuid()};
   return submit();
  },
  async save(draft,order){
   if(pending)throw new OrderApiError(409,'UNRESOLVED_REQUEST');
   if(!session)throw new OrderApiError(401,'UNAUTHENTICATED');
   pending={owner:owner(session),method:order?'PATCH':'POST',path:'/api/ops/v1/orders'+(order?'/'+order.id:''),body:JSON.stringify(draft),version:order?.version,key:uuid()};
   return submit();
  },
  retry(){if(!pending)throw new OrderApiError(409,'NO_PENDING_REQUEST');return submit();}
 };
}
