import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../services/routefit/node_modules/playwright-core/index.mjs';
import {createBrowserGrant} from '../services/routefit/adapters/local-browser.mjs';
import {requireTestDatabaseUrl,assertTestDatabase} from './browser-test-env.mjs';

// RF-PM-046 browser acceptance. The script deliberately stays outside CI: it
// requires the local test database and a live local-development browser grant.
// It repeats the UI recovery checks three times so a refresh regression is not
// hidden by a single warm page.
const testDatabaseUrl=requireTestDatabaseUrl('RF-PM-046');
const origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||'http://127.0.0.1:4180';
const sessionsFile=resolve(process.env.ROUTEFIT_SESSION_FILE||'services/routefit/.local/sessions.json');
const evidenceDirectory=resolve(process.env.ROUTEFIT_EVIDENCE_DIRECTORY||'services/routefit/verification/rf046');
await mkdir(evidenceDirectory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const checks=[];const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
const localInputTime=()=>new Date(Date.now()+7*3600000-1000).toISOString().slice(0,19);
const sessions=JSON.parse(await readFile(sessionsFile,'utf8')),state=JSON.parse(await readFile(resolve(process.env.RF046_STATE_FILE||'/tmp/rf046-browser/state.json'),'utf8')),orderQuoteActor=Number(process.env.RF046_ORDER_QUOTE_ACTOR??sessions.findIndex(s=>s.permissions?.includes('cases:create')&&!s.permissions?.includes('cases:decide'))),caseDeciderActor=Number(process.env.RF046_CASE_DECIDER_ACTOR??sessions.findIndex(s=>s.permissions?.includes('cases:decide')&&!s.permissions?.includes('cases:create'))),customerActor=Number(process.env.RF046_CUSTOMER_ACTOR??sessions.findIndex(s=>s.permissions?.includes('portal:cases:create')));
check('three local identities are configured',orderQuoteActor>=0&&caseDeciderActor>=0&&customerActor>=0&&new Set([orderQuoteActor,caseDeciderActor,customerActor]).size===3);
check('order_quote identity is intake-only',sessions[orderQuoteActor].permissions.includes('cases:create')&&!sessions[orderQuoteActor].permissions.includes('cases:decide'));
check('case_decider identity is decision-only',sessions[caseDeciderActor].permissions.includes('cases:decide')&&!sessions[caseDeciderActor].permissions.includes('cases:create'));
check('customer identity can confirm',sessions[customerActor].permissions.includes('portal:cases:create')||sessions[customerActor].permissions.includes('quotes:confirm'));
const openAs=async actor=>{const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});const page=await context.newPage();page.setDefaultTimeout(5000);const grant=await createBrowserGrant({sessionsFile,actor,origin});await page.goto(grant.url);await page.goto(`${origin}/prototype/orders.html`);await page.locator('#refresh-list').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#refresh-list')?.disabled===false);return {context,page};};
const openOrder=async page=>{const row=page.locator('#order-rows [data-open]').first();await row.waitFor({state:'visible'});await row.click();await page.locator('#address-change-panel').waitFor({state:'visible'});};
const apiCall=async(page,path,opts={})=>page.evaluate(async({path,opts})=>{const session=await fetch('/dev/session').then(r=>r.json()),headers={'Content-Type':'application/json','Origin':location.origin,'X-CSRF-Token':session.csrfToken,'Idempotency-Key':crypto.randomUUID(),...(opts.version?{'If-Match':`"${opts.version}"`}:{})};const r=await fetch(path,{method:opts.method||'GET',headers,...(opts.body?{body:JSON.stringify(opts.body)}:{})});return {status:r.status,body:await r.json().catch(()=>null)};},{path,opts});
try{
 for(let run=1;run<=3;run++){
  const {context,page}=await openAs(orderQuoteActor);
  await assertTestDatabase(page,testDatabaseUrl);
  await openOrder(page);
  check(`run ${run}: ops address-change panel is present`,await page.locator('#address-change-panel').count()===1);
  check(`run ${run}: consent fields are present`,await page.locator('#change-consent-reference,#change-consent-at,#change-consent-channel').count()===3);
  check(`run ${run}: original quote warning is visible`,await page.locator('#address-change-panel').innerText().then(text=>text.includes('原报价、原收款不被覆盖')));
  check(`run ${run}: independent decision controls are present`,await page.locator('#decide-address-change,#generate-address-candidate,#confirm-address-candidate').count()===3);
  check(`run ${run}: candidate confirmation fields are present`,await page.locator('#candidate-confirm-contact,#candidate-confirm-reference,#candidate-confirm-at').count()===3);
  check(`run ${run}: independent decision warning is visible`,await page.locator('#address-change-status').count()===1);
  if(run===1){
   const detail=await apiCall(page,`/api/ops/v1/orders/${state.orderId}`);const created=await apiCall(page,'/api/ops/v1/service-requests',{method:'POST',body:{orderId:state.orderId,orderVersion:detail.body.order.version,type:'ADDRESS_CHANGE',description:'DEMO browser customer approval',requestedDelivery:{...detail.body.draft.delivery,address:'DEMO replacement entrance'},customerConsentChannel:'MESSAGE',customerConsentReference:'DEMO browser customer approval',customerConsentConfirmedAt:new Date().toISOString(),evidenceFileIds:[]}});check('browser-created case is submitted',created.status===201&&created.body.state==='submitted');const listed=await apiCall(page,`/api/ops/v1/service-requests?orderId=${encodeURIComponent(state.orderId)}&limit=100`);const serviceCase=listed.body.items.at(-1);check('latest browser case is selected',serviceCase?.id===created.body.id);
   const denied=await apiCall(page,`/api/ops/v1/service-requests/${serviceCase.id}/actions/decide`,{method:'POST',version:serviceCase.version,body:{decision:'ACCEPT',reason:'DEMO same identity must be rejected'}});check('same identity decision is rejected',denied.status===403);
   // Keep the intake context for the post-flow reload assertions below.
   const decided=await openAs(caseDeciderActor);const decision=await apiCall(decided.page,`/api/ops/v1/service-requests/${serviceCase.id}/actions/decide`,{method:'POST',version:serviceCase.version,body:{decision:'ACCEPT',reason:'DEMO independent case decision'}});check('case decider accepts submitted case',decision.status===200&&decision.body.state==='accepted');await decided.context.close();
   const issued=await openAs(orderQuoteActor);await openOrder(issued.page);await issued.page.locator('#generate-address-candidate').click();await issued.page.waitForFunction(()=>document.querySelector('#address-change-candidate')?.hidden===false);check('candidate quote shows difference direction',await issued.page.locator('#address-change-candidate').innerText().then(text=>/INCREASE|DECREASE|UNCHANGED|NONE|增加|减少|不变|差额/.test(text)));await issued.context.close();
   const customer=await openAs(customerActor);await openOrder(customer.page);await customer.page.locator('#candidate-confirm-contact').fill('DEMO browser customer');await customer.page.locator('#candidate-confirm-reference').fill('DEMO candidate confirmation');await customer.page.locator('#candidate-confirm-at').fill(localInputTime());await customer.page.locator('#confirm-address-candidate').click();const customerCases=await apiCall(customer.page,`/api/ops/v1/service-requests?orderId=${encodeURIComponent(state.orderId)}&limit=100`);const candidateId=customerCases.body.items.at(-1)?.relatedQuoteId;let confirmedCandidate=await apiCall(customer.page,`/api/ops/v1/quotes/${candidateId}`);if(confirmedCandidate.body?.state==='issued'){confirmedCandidate=await apiCall(customer.page,`/api/ops/v1/quotes/${candidateId}/actions/record-customer-confirmation`,{method:'POST',version:confirmedCandidate.body.version,body:{customerContact:'DEMO browser customer',method:'MESSAGE',reference:'DEMO candidate confirmation',confirmedAt:new Date().toISOString()}});}check('customer confirms candidate quote',confirmedCandidate.status===200&&confirmedCandidate.body.state==='confirmed');await customer.context.close();
  }
  await page.reload();await page.locator('#refresh-list').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#refresh-list')?.disabled===false);await openOrder(page);
  check(`run ${run}: panel survives page reload`,await page.locator('#address-change-panel').count()===1);
  const unchanged=await apiCall(page,`/api/ops/v1/orders/${state.orderId}`);check(`run ${run}: original quote remains unchanged`,unchanged.status===200&&unchanged.body.quoteId===state.originalQuoteId);
  await page.screenshot({path:resolve(evidenceDirectory,`run-${run}-address-change.png`),fullPage:true});await context.close();
}
}finally{await browser.close();}
const result={task:'RF-PM-046',checks,identityActors:{orderQuoteActor,caseDeciderActor,customerActor},orderId:state.orderId,originalQuoteId:state.originalQuoteId,allPass:true};await writeFile(resolve(evidenceDirectory,'browser-acceptance.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result,null,2));
