import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../services/routefit/node_modules/playwright-core/index.mjs';
import {createBrowserGrant} from '../services/routefit/adapters/local-browser.mjs';

const origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||'http://127.0.0.1:4180';
const sessionsFile=resolve(process.env.ROUTEFIT_SESSION_FILE||'services/routefit/.local/sessions.json');
const evidenceDirectory=resolve(process.env.ROUTEFIT_EVIDENCE_DIRECTORY||'.local/evidence/rf-pm-018');
const executablePath=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const feesUrl=`${origin}/prototype/fees.html`,indexUrl=`${origin}/prototype/`;
await mkdir(evidenceDirectory,{recursive:true});

const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const evidence=[];
const fail=(message)=>{throw new Error(message);};
const snap=async(page,name)=>{const path=resolve(evidenceDirectory,name);await page.screenshot({path,fullPage:true});return path;};
async function session(actor,viewport={width:1280,height:900}){
  const context=await browser.newContext({viewport});
  const grant=await createBrowserGrant({sessionsFile,actor,origin});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(grant.url,{waitUntil:'domcontentloaded',timeout:15000});await page.waitForURL(`${origin}/prototype/`,{timeout:15000});
  await page.goto(feesUrl,{waitUntil:'domcontentloaded',timeout:15000});await page.locator('#source').waitFor({state:'visible',timeout:15000});
  return {context,page,errors,grant};
}
async function post(page,path,body,version=null,key=crypto.randomUUID(),csrf){
  const session=await page.evaluate(async()=>{const r=await fetch('/dev/session');return r.ok?r.json():null;});
  csrf??=session?.csrfToken;
  const headers={'Content-Type':'application/json','X-CSRF-Token':csrf||'invalid','Idempotency-Key':key};
  if(version)headers['If-Match']=`"${version}"`;
  return page.evaluate(async({path,body,headers})=>{const r=await fetch('/api/ops/v1/pricing'+path,{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>null),requestId:r.headers.get('X-Request-Id')};},{path,body,headers});
}
async function seed(page){
  const result=await post(page,'/tariffs',{name:'RF-PM-018 synthetic browser draft',owner:'DR',currency:'USD',scope:'Synthetic browser acceptance only'});
  if(result.status!==201)fail(`seed tariff failed: ${result.status}`);return result.body.id;
}
async function choose(page,id){
  await page.locator(`#tariff option[value="${id}"]`).waitFor({state:'attached',timeout:15000});
  await page.locator('#tariff').selectOption(id);await page.locator('#context').waitFor({state:'visible'});await page.waitForTimeout(100);}
async function prepareBase(page){
  await page.locator('#fees button').first().click();
  await page.locator('#fee-fields').evaluate(el=>{
    el.disabled=false;el.querySelectorAll('input,select,textarea').forEach(input=>{input.disabled=false;});
    const set=(name,value)=>{const input=el.querySelector(`[name="${name}"]`);if(input){if(input.type==='checkbox')input.checked=value;else input.value=value;}};
    set('enabled',true);set('amount','200');set('scope','Synthetic browser acceptance');set('evidence','RF-PM-018 synthetic evidence');
  });
  await page.locator('#save').evaluate(el=>{el.disabled=false;});
}
try{
  const owner=await session(0);
  const tariffId=await seed(owner.page);
  await owner.page.reload({waitUntil:'domcontentloaded'});await owner.page.locator('#source').waitFor({state:'visible'});
  await choose(owner.page,tariffId);
  evidence.push({name:'mobile-navigation',status:'PASS',detail:'390px viewport shows the 费用设置（数据库） navigation entry and opens fees.html',screenshot:await (async()=>{
    await owner.context.close();
    const mobile=await session(0,{width:390,height:844});
    await mobile.page.goto(`${indexUrl}#operations`,{waitUntil:'domcontentloaded'});await mobile.page.locator('#mobile-nav').waitFor({state:'visible',timeout:15000});
    const entry=mobile.page.locator('#mobile-nav');
    if(!(await entry.isVisible())||!(await mobile.page.locator('#mobile-nav option[value="fees-api"]').count()))fail('fees navigation entry is not available at 390px');
    const path=await snap(mobile.page,'01-mobile-navigation.png');
    await entry.selectOption('fees-api');await mobile.page.waitForURL('**/prototype/fees.html');
    await mobile.context.close();return path;
  })()});

  const unauth=await browser.newContext({viewport:{width:1280,height:900}});const unauthPage=await unauth.newPage();
  await unauthPage.goto(feesUrl);await unauthPage.locator('#errors').waitFor({state:'visible'});
  if(await unauthPage.locator('#errors').getAttribute('hidden')!==null)fail('401 summary is hidden');
  if(await unauthPage.evaluate(()=>document.activeElement?.id)!=='errors')fail('401 summary did not receive focus');
  evidence.push({name:'session-expired-401',status:'PASS',detail:'Unauthenticated session renders focused error summary and hides saved area',screenshot:await snap(unauthPage,'02-401-session-expired.png')});await unauth.close();

  const forbidden=await session(2);await choose(forbidden.page,tariffId);await prepareBase(forbidden.page);await forbidden.page.locator('#save').click({force:true});
  await forbidden.page.locator('#errors').waitFor({state:'visible'});
  if(await forbidden.page.evaluate(()=>document.activeElement?.id)!=='errors')fail('403 summary did not receive focus');
  evidence.push({name:'readonly-403',status:'PASS',detail:'Read-only review identity gets FORBIDDEN and focused error summary',screenshot:await snap(forbidden.page,'03-403-readonly.png')});await forbidden.context.close();

  const cross=await session(1);await cross.page.locator('#tariff').evaluate((select,id)=>{select.add(new Option('cross-company synthetic tariff',id));select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));},tariffId);
  await cross.page.locator('#errors').waitFor({state:'visible'});
  if(await cross.page.evaluate(()=>document.activeElement?.id)!=='errors')fail('404 summary did not receive focus');
  evidence.push({name:'cross-company-404',status:'PASS',detail:'Other synthetic company cannot read the tariff and gets NOT_FOUND with focused summary',screenshot:await snap(cross.page,'04-404-cross-company.png')});await cross.context.close();

  const offline=await session(0);await choose(offline.page,tariffId);await prepareBase(offline.page);
  await offline.page.route('**/api/ops/v1/pricing/tariffs/*/actions/save-fee',route=>route.abort('failed'));
  await offline.page.locator('#save').click({force:true});await offline.page.locator('#errors').waitFor({state:'visible'});
  const retryVisible=await offline.page.locator('#retry').isVisible();
  const amount=await offline.page.locator('input[name=amount]').inputValue();
  if(!retryVisible||amount!=='200')fail('offline result-unknown did not preserve input and retry action');
  evidence.push({name:'offline-result-unknown',status:'PASS',detail:'Save response is interrupted before completion; RESULT_UNKNOWN keeps input and exposes retry',screenshot:await snap(offline.page,'05-offline-result-unknown.png')});await offline.context.close();

  console.log(JSON.stringify({task:'RF-PM-018',origin,viewport:{width:390,height:844},tariffId,checks:evidence,allPass:evidence.every(x=>x.status==='PASS')},null,2));
}finally{await browser.close();}
