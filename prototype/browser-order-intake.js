// Playwright MCP function. Inject a fresh one-use link; never save it.
async (page)=>{
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1000},locale:'zh-CN'}),p=await context.newPage(),checks=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
 try{
  await p.goto('__ACTIVATION_LINK__');await p.goto('http://127.0.0.1:4180/prototype/orders.html');await p.waitForFunction(()=>!document.querySelector('#refresh-list').disabled);
  const ids=await p.evaluate(async({draft,input})=>{
   const s=await(await fetch('/dev/session')).json();
   async function req(path,body,version){const r=await fetch('/api/ops/v1'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken,'Idempotency-Key':crypto.randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok)throw Error(v.error.code);return v;}
   draft.customerId=(await req('/customers')).items[0].id;for(const side of ['pickup','delivery'])draft[side].point={lng:104.9,lat:11.5};
   for(const [i,k] of ['requestedPickupWindow','requestedDeliveryWindow'].entries())draft[k]={start:new Date(Date.now()+(i+1)*3600000).toISOString(),end:new Date(Date.now()+(i+2)*3600000).toISOString()};
   const area=await req('/service-areas',{name:'DEMO browser test',type:'ALLOW',polygon:{type:'Polygon',coordinates:[[[104.8,11.4],[105,11.4],[105,11.6],[104.8,11.6],[104.8,11.4]]]},effectiveFrom:new Date().toISOString()});
   await req('/service-areas/'+area.id+'/actions/publish',{reason:'DEMO browser verification'},1);
   const order=await req('/orders',draft),path='/orders/'+order.order.id;await req(path+'/intake-evidence',input,1);const accepted=await req(path+'/actions/submit',{},1);
   return {orderId:accepted.order.id,areaId:area.id,state:accepted.order.state};
  },__FIXTURES__);
  check('real API submit enters validating',ids.state==='validating');await p.locator('#refresh-list').click();await p.waitForFunction(()=>!document.querySelector('#refresh-list').disabled);
  const row=p.locator(`[data-open="${ids.orderId}"]`);check('list identifies readonly state',(await row.innerText())==='只读查看');await row.click();await p.waitForFunction(()=>document.querySelector('#edit-state').textContent.includes('核验中'));
  check('detail identifies validating',(await p.locator('#edit-state').innerText()).includes('核验中'));
  check('fields cannot edit',await p.locator('[name="pickup.address"]').isDisabled());check('save and sample disabled',await p.locator('#save-order').isDisabled()&&await p.locator('#fill-sample').isDisabled());
  check('readonly reason shown',(await p.locator('#notice').innerText()).includes('退回草稿'));
  await p.locator('[data-step="cargo"]').focus();await p.keyboard.press('Enter');check('keyboard can inspect cargo',await p.locator('[data-panel="cargo"]').isVisible());
  await p.setViewportSize({width:390,height:844});await p.emulateMedia({reducedMotion:'reduce'});check('narrow screen has no body overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'E:/Dr.RouteFit/services/routefit/verification/order-intake/readonly-mobile.png',fullPage:true});
  await p.locator('#back-list').click();check('return remains usable',await p.locator('#orders-list').isVisible());
  await p.evaluate(async ids=>{const s=await(await fetch('/dev/session')).json();for(const path of ['/orders/'+ids.orderId+'/actions/return-to-draft','/service-areas/'+ids.areaId+'/actions/retire']){const r=await fetch('/api/ops/v1'+path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken,'Idempotency-Key':crypto.randomUUID(),'If-Match':'"2"'},body:JSON.stringify({reason:'DEMO return and cleanup'})});if(!r.ok)throw Error('return failed');}},ids);
  await p.locator('#refresh-list').click();await p.waitForFunction(()=>!document.querySelector('#refresh-list').disabled);await row.click();await p.waitForFunction(()=>!document.querySelector('#order-editor').hidden&&!document.querySelector('#save-order').disabled);check('server return restores draft editing',!await p.locator('#save-order').isDisabled()&&!await p.locator('[name="pickup.address"]').isDisabled());
  check('no JavaScript errors',errors.length===0);return {checks,errors,scope:'Real local HTTP/DB submit and return; readonly UI keyboard and 390px viewport; no real maps or payments'};
 }finally{await context.close();}
}
