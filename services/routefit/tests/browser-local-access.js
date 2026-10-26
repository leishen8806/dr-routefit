async (page) => {
 const context=await page.context().browser().newContext(),p=await context.newPage(),errors=[];
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:4180/prototype/#pricing');
  await p.locator('[data-fee-edit]').first().waitFor();
  assert(await p.evaluate(async()=> (await fetch('/dev/session')).status)===401,'anonymous session must fail');
  const link='__ACTIVATION_LINK__';
  await p.goto(link);await p.locator('#app').waitFor();
  assert(p.url()==='http://127.0.0.1:4180/prototype/','activation must remove ticket from active URL');
  const cookies=await context.cookies(),sessionCookie=cookies.find(x=>x.name==='rf_session');
  assert(sessionCookie?.httpOnly&&sessionCookie.sameSite==='Strict','HttpOnly/SameSite cookie required');
  assert(!await p.evaluate(()=>document.cookie.includes('rf_session')),'session token must not be JS-readable');
  const result=await p.evaluate(async()=>{
   const check=(ok,m)=>{if(!ok)throw Error(m);};
   const session=await (await fetch('/dev/session')).json();
   check(session.mode==='local-development'&&!session.token,'explicit development identity only');
   const prefix='/api/ops/v1/pricing';
   const post=async(path,body,version,key=crypto.randomUUID(),csrf=session.csrfToken)=>{
    const r=await fetch(prefix+path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{})},body:JSON.stringify(body)});
    return {status:r.status,body:await r.json(),replayed:r.headers.get('Idempotency-Replayed'),cors:r.headers.get('Access-Control-Allow-Origin')};
   };
   const create={name:'DEMO browser RF-API-01',owner:'DR',currency:'USD',scope:'Synthetic browser validation'};
   check((await post('/tariffs',create,null,crypto.randomUUID(),'invalid')).status===403,'missing CSRF must fail');
   const key=crypto.randomUUID(),created=await post('/tariffs',create,null,key);check(created.status===201&&!created.cors,'create without CORS');
   check((await post('/tariffs',create,null,key)).replayed==='true','duplicate create must replay');
   const id=created.body.id,rule={code:'base',enabled:true,method:'fixed',amount:200,unit:null,includedMilli:0,stepMilli:1000,share:true,scope:'DEMO',evidence:'Synthetic browser fixture'};
   check((await post(`/tariffs/${id}/actions/save-fee`,rule,1)).status===200,'save base');
   check((await post(`/tariffs/${id}/actions/save-fee`,rule,1)).status===412,'stale version must fail');
   check((await post(`/tariffs/${id}/actions/save-fee`,{...rule,code:'insurance',method:'percent',amount:125,share:false},2)).status===200,'save insurance');
   const trial=await post(`/tariffs/${id}/trials`,{lines:[{code:'base',quantityMilli:null,basisMinor:null},{code:'insurance',quantityMilli:null,basisMinor:10000}]},3);
   check(trial.status===201&&trial.body.totalMinor===325&&trial.body.shareMinor===200&&trial.body.insuranceMinor===125,'insurance must be separate');
   return {tariffId:id,trialId:trial.body.id,totalMinor:trial.body.totalMinor,shareMinor:trial.body.shareMinor,insuranceMinor:trial.body.insuranceMinor};
  });
  await p.reload();
  const persisted=await p.evaluate(async id=>(await (await fetch('/api/ops/v1/pricing/trials/'+id)).json()).totalMinor,result.trialId);
  assert(persisted===325,'reload must retain database result');
  assert((await context.request.get(link,{maxRedirects:0})).status()===401,'activation link must be one-use');
  const logout=await p.evaluate(async()=>{const s=await (await fetch('/dev/session')).json();const r=await fetch('/dev/session/logout',{method:'POST',headers:{'X-CSRF-Token':s.csrfToken}});return {logout:r.status,after:(await fetch('/dev/session')).status};});
  assert(logout.logout===200&&logout.after===401,'logout must revoke session');
  assert(errors.length===0,'unexpected browser errors');
  const report={mode:'real Chromium + local PostgreSQL, direct same-origin fetch from unchanged prototype',checks:['prototype assets load on API origin','anonymous 401','single-use activation and redirect','HttpOnly SameSite Strict','session token hidden from JavaScript','CSRF rejection','persistent draft and fee saves','idempotency replay','412 stale edit','insurance excluded','reload reads snapshot','logout revoked'],...result,unhandledPageErrors:errors,frontendFeeButtonsConnected:false};
  return report;
 }finally{await context.close();}
}
