import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../services/routefit/node_modules/playwright-core/index.mjs';
import {createBrowserGrant} from '../services/routefit/adapters/local-browser.mjs';
import {requireTestDatabaseUrl,assertTestDatabase,databaseLabel} from './browser-test-env.mjs';

const testDatabaseUrl=requireTestDatabaseUrl('RF-PM-018-R1');
const origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||'http://127.0.0.1:4180';
const sessionsFile=resolve(process.env.ROUTEFIT_SESSION_FILE||'services/routefit/.local/sessions.json');
const evidenceDirectory=resolve(process.env.ROUTEFIT_EVIDENCE_DIRECTORY||'.local/evidence/rf-pm-018');
const executablePath=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mobileWidth=Number(process.env.ROUTEFIT_MOBILE_WIDTH||390);
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
  const result=await post(page,'/tariffs',{name:'[TEST] RF-PM-018 synthetic browser draft',owner:'DR',currency:'USD',scope:'Synthetic browser acceptance only'});
  if(result.status!==201)fail(`seed tariff failed: ${result.status}`);return result.body.id;
}
async function choose(page,id){
  await page.locator(`#tariff option[value="${id}"]`).waitFor({state:'attached',timeout:15000});
  await page.locator('#tariff').selectOption(id);await page.locator('#context').waitFor({state:'visible'});await page.waitForTimeout(100);}
async function fillBaseUser(page){
  await page.locator('#fees button').first().click();
  await page.locator('input[name=enabled]').check();
  await page.locator('input[name=amount]').fill('200');
  await page.locator('#fee-form input[name=scope]').fill('Synthetic browser acceptance');
  await page.locator('#fee-form textarea[name=evidence]').fill('RF-PM-018 synthetic evidence');
}
async function readTariff(page,id){
  return page.evaluate(async id=>{const r=await fetch('/api/ops/v1/pricing/tariffs/'+encodeURIComponent(id));const body=await r.json().catch(()=>null);return {status:r.status,body,code:body?.error?.code||null};},id);
}
async function readSession(page){
  return page.evaluate(async()=>{const r=await fetch('/dev/session');const body=await r.json().catch(()=>null);return {status:r.status,body,code:body?.error?.code||null};});
}
try{
  const owner=await session(0);
  await assertTestDatabase(owner.page,testDatabaseUrl);
  const tariffId=await seed(owner.page);
  await owner.page.reload({waitUntil:'domcontentloaded'});await owner.page.locator('#source').waitFor({state:'visible'});
  await choose(owner.page,tariffId);
    evidence.push({name:'mobile-navigation',status:'PASS',detail:`${mobileWidth}px viewport shows the 费用设置（数据库） navigation entry and opens fees.html`,screenshot:await (async()=>{
    await owner.context.close();
    const mobile=await session(0,{width:mobileWidth,height:844});
    await mobile.page.goto(`${indexUrl}#operations`,{waitUntil:'domcontentloaded'});await mobile.page.locator('#mobile-nav').waitFor({state:'visible',timeout:15000});
    const entry=mobile.page.locator('#mobile-nav');
    if(!(await entry.isVisible())||!(await mobile.page.locator('#mobile-nav option[value="fees-api"]').count()))fail('fees navigation entry is not available at 390px');
    const path=await snap(mobile.page,'01-mobile-navigation.png');
    await entry.selectOption('fees-api');await mobile.page.waitForURL('**/prototype/fees.html');
    await choose(mobile.page,tariffId);await fillBaseUser(mobile.page);
    const dimensions=await mobile.page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
    const saveBox=await mobile.page.locator('#save').boundingBox();
    if(dimensions.scrollWidth>dimensions.clientWidth||!saveBox||saveBox.x<0||saveBox.x+saveBox.width>mobileWidth)fail(`${mobileWidth}px fee page overflow or clipped save button: ${JSON.stringify({dimensions,saveBox})}`);
    evidence.push({name:'mobile-fees-page',status:'PASS',detail:`${mobileWidth}px fee page has no horizontal overflow and save button stays within viewport`,screenshot:await snap(mobile.page,'02-mobile-fees-page.png')});
    await mobile.context.close();return path;
  })()});

  const unauth=await browser.newContext({viewport:{width:1280,height:900}});const unauthPage=await unauth.newPage();
  await unauthPage.goto(feesUrl);await unauthPage.locator('#errors').waitFor({state:'visible'});
  if(await unauthPage.locator('#errors').getAttribute('hidden')!==null)fail('401 summary is hidden');
  if(await unauthPage.evaluate(()=>document.activeElement?.id)!=='errors')fail('401 summary did not receive focus');
  const unauthCode=await readSession(unauthPage);if(unauthCode.status!==401||!unauthCode.code)fail(`401 code missing: ${JSON.stringify(unauthCode)}`);
  if(!(await unauthPage.locator('#comparison').isHidden()))fail('401 saved comparison area is visible');
  evidence.push({name:'session-expired-401',status:'PASS',detail:`No-session UI error is focused; API status 401 code ${unauthCode.code}; saved area hidden`,screenshot:await snap(unauthPage,'03-401-session-expired.png')});await unauth.close();

  const forbidden=await session(2);await choose(forbidden.page,tariffId);
  if(!(await forbidden.page.locator('#save').isDisabled()))fail('read-only role save button should be disabled');
  const forbiddenResult=await post(forbidden.page,`/tariffs/${tariffId}/actions/save-fee`,{code:'base',enabled:true,method:'fixed',amount:200,unit:null,includedMilli:0,stepMilli:1000,share:false,scope:'Synthetic browser acceptance',evidence:'RF-PM-018 synthetic evidence'});
  if(forbiddenResult.status!==403||forbiddenResult.body?.error?.code!=='FORBIDDEN')fail(`403 code mismatch: ${JSON.stringify(forbiddenResult)}`);
  if(!(await forbidden.page.locator('#comparison').isHidden()))fail('403 saved comparison area is visible');
  evidence.push({name:'readonly-403',status:'PASS',detail:'Read-only UI disables save; direct synthetic write returns 403 FORBIDDEN; saved area hidden',screenshot:await snap(forbidden.page,'04-403-readonly.png')});await forbidden.context.close();

  const cross=await session(1);await cross.page.locator('#tariff').evaluate((select,id)=>{select.add(new Option('cross-company synthetic tariff',id));select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));},tariffId);
  await cross.page.locator('#errors').waitFor({state:'visible'});
  if(await cross.page.evaluate(()=>document.activeElement?.id)!=='errors')fail('404 summary did not receive focus');
  const crossResult=await readTariff(cross.page,tariffId);if(crossResult.status!==404||!crossResult.code)fail(`404 code missing: ${JSON.stringify(crossResult)}`);
  if(!(await cross.page.locator('#comparison').isHidden()))fail('404 saved comparison area is visible');
  evidence.push({name:'cross-company-404',status:'PASS',detail:`Other synthetic company gets 404 code ${crossResult.code}; error summary focused and saved area hidden`,screenshot:await snap(cross.page,'05-404-cross-company.png')});await cross.context.close();

  const offline=await session(0);await choose(offline.page,tariffId);await fillBaseUser(offline.page);
  const before=await readTariff(offline.page,tariffId);if(before.status!==200)fail(`before tariff read failed: ${before.status}`);
  let intercepted=false;await offline.page.route('**/api/ops/v1/pricing/tariffs/*/actions/save-fee',async route=>{if(!intercepted){intercepted=true;await route.fetch();await route.abort('failed');}else await route.continue();});
  await offline.page.locator('#save').click();await offline.page.locator('#errors').waitFor({state:'visible'});
  const retryVisible=await offline.page.locator('#retry').isVisible();
  const amount=await offline.page.locator('input[name=amount]').inputValue();
  if(!retryVisible||amount!=='200')fail('offline result-unknown did not preserve input and retry action');
  await offline.page.locator('#retry').scrollIntoViewIfNeeded();const retryBox=await offline.page.locator('#retry').boundingBox();if(!retryBox||retryBox.x<0||retryBox.x+retryBox.width>1280)fail(`retry button clipped: ${JSON.stringify(retryBox)}`);
  await offline.page.locator('#retry').click();await offline.page.locator('#status').filter({hasText:'数据库已保存'}).waitFor({state:'visible',timeout:15000});
  const after=await readTariff(offline.page,tariffId);if(after.status!==200||after.body.version!==before.body.version+1)fail(`retry changed tariff more than once: before=${before.body.version} after=${after.body?.version}`);
  evidence.push({name:'offline-result-unknown',status:'PASS',detail:`Response cut after server commit; retry shows saved and tariff version changed exactly once (${before.body.version}→${after.body.version})`,screenshot:await snap(offline.page,'06-offline-result-unknown.png')});await offline.context.close();

  console.log(JSON.stringify({task:'RF-PM-018-R1',origin,testDatabase:databaseLabel(testDatabaseUrl),viewport:{width:mobileWidth,height:844},tariffId,checks:evidence,allPass:evidence.every(x=>x.status==='PASS')},null,2));
}finally{await browser.close();}
