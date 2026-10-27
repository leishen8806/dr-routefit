import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../services/routefit/node_modules/playwright-core/index.mjs';
import {createBrowserGrant} from '../services/routefit/adapters/local-browser.mjs';
import {requireTestDatabaseUrl,assertTestDatabase,databaseLabel} from './browser-test-env.mjs';

const testDatabaseUrl=requireTestDatabaseUrl('RF-PM-022-R1');
const origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||'http://127.0.0.1:4180';
const sessionsFile=resolve(process.env.ROUTEFIT_SESSION_FILE||'services/routefit/.local/sessions.json');
const evidenceDirectory=resolve(process.env.ROUTEFIT_EVIDENCE_DIRECTORY||'services/routefit/verification/order-intake');
const executablePath=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await mkdir(evidenceDirectory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'}),page=await context.newPage(),checks=[];
const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
const shot=async name=>{const path=resolve(evidenceDirectory,name);await page.screenshot({path,fullPage:true});return path;};
async function req(path,body=null,version=null){
 const session=await page.evaluate(async()=>{const r=await fetch('/dev/session');return r.json();});
 const headers={'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'Idempotency-Key':crypto.randomUUID()};if(version)headers['If-Match']=`"${version}"`;
 const response=await page.evaluate(async({path,body,headers})=>{const r=await fetch('/api/ops/v1'+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json().catch(()=>null)};},{path,body,headers});
 if(response.status>=400)throw Error(`${path}: ${response.status} ${response.body?.error?.code||''}`);return response.body;
}
try{await page.waitForTimeout(500);
 const grant=await createBrowserGrant({sessionsFile,actor:0,origin});await page.goto(grant.url);await page.waitForURL(`${origin}/prototype/`);await page.goto(`${origin}/prototype/orders.html`);await page.locator('#refresh-list').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#refresh-list').disabled);
 await assertTestDatabase(page,testDatabaseUrl);
 const customer=(await req('/customers?limit=10')).items[0].id;
 const draft=JSON.parse(await readFile(new URL('../contracts/examples/order-draft.json',import.meta.url),'utf8'));draft.customerId=customer;draft.pickup.point={lng:104.9,lat:11.5};draft.delivery.point={lng:104.95,lat:11.55};for(const [i,k] of ['requestedPickupWindow','requestedDeliveryWindow'].entries())draft[k]={start:new Date(Date.now()+(i+2)*3600000).toISOString(),end:new Date(Date.now()+(i+3)*3600000).toISOString()};
 const area=await req('/service-areas',{name:'[TEST] RF-PM-022 synthetic area',type:'ALLOW',polygon:{type:'Polygon',coordinates:[[[104.8,11.4],[105,11.4],[105,11.6],[104.8,11.6],[104.8,11.4]]]},effectiveFrom:'2026-01-01T00:00:00Z'});await req(`/service-areas/${area.id}/actions/publish`,{reason:'RF-PM-022 browser acceptance'},1);
 const outsideDraft=structuredClone(draft);outsideDraft.pickup.point={lng:105.2,lat:11.8};outsideDraft.delivery.point={lng:105.25,lat:11.85};const outside=await req('/orders',outsideDraft);await page.locator('#refresh-list').click();await page.waitForFunction(()=>!document.querySelector('#refresh-list').disabled);await page.locator(`[data-open="${outside.order.id}"]`).click();await page.locator('#intake-panel').waitFor({state:'visible'});for(const [name,value] of [['intake.pickup.reference','OUTSIDE-PICKUP'],['intake.pickup.entrance','OUTSIDE'],['intake.delivery.reference','OUTSIDE-DELIVERY'],['intake.delivery.entrance','OUTSIDE']])await page.locator(`[name="${name}"]`).fill(value);for(let i=0;i<outsideDraft.items.length;i++){await page.locator(`[name="intake.measurements.${i}.reference"]`).fill(`OUTSIDE-${i}`);await page.locator(`[name="intake.measurements.${i}.packagingConfirmed"]`).check();}await page.locator('#save-intake-evidence').click();await page.locator('#check-intake').click();await page.locator('#intake-check').filter({hasText:'阻断项'}).waitFor({state:'visible'});check('outside area blocks intake and focuses field',await page.locator('#submit-intake').isDisabled()&&await page.locator('#intake-check').innerText().then(t=>t.includes('区域')));await shot('04-outside-area-blocked.png');await page.locator('#back-list').click();const order=await req('/orders',draft);await page.locator('#refresh-list').click();await page.waitForFunction(()=>!document.querySelector('#refresh-list').disabled);await page.locator(`[data-open="${order.order.id}"]`).click();await page.locator('#intake-panel').waitFor({state:'visible'});
 check('draft shows intake panel',await page.locator('#intake-panel').isVisible());
 for(const [name,value] of [['intake.pickup.reference','DEMO-PHONE-PICKUP'],['intake.pickup.entrance','东门登记台'],['intake.delivery.reference','DEMO-PHONE-DELIVERY'],['intake.delivery.entrance','南门收货台']])await page.locator(`[name="${name}"]`).fill(value);
 for(let i=0;i<draft.items.length;i++){await page.locator(`[name="intake.measurements.${i}.reference"]`).fill(`DEMO-MEASURE-${i+1}`);await page.locator(`[name="intake.measurements.${i}.packagingConfirmed"]`).check();}
 await page.locator('#save-intake-evidence').click();await page.locator('#intake-check').waitFor({state:'visible'});await page.locator('#check-intake').click();await page.locator('#intake-check').filter({hasText:'PASS'}).waitFor({state:'visible'});check('ready check passes after evidence',await page.locator('#intake-check').innerText().then(t=>t.includes('PASS')));await shot('01-draft-evidence-ready.png');
 await page.locator('#submit-intake').click();await page.locator('#edit-state').filter({hasText:'核验中'}).waitFor({state:'visible'});check('submit enters validating',await page.locator('#save-order').isDisabled()&&await page.locator('[name="pickup.address"]').isDisabled());await shot('02-validating-readonly.png');
 await page.locator('#return-reason').fill('RF-PM-022 synthetic correction');await page.locator('#return-to-draft').click();await page.locator('#edit-state').filter({hasText:'草稿'}).waitFor({state:'visible'});check('return reason restores draft editing',await page.locator('#intake-panel').isVisible());
 await page.setViewportSize({width:390,height:844});check('390px order intake has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('03-mobile-order-intake.png');
 console.log(JSON.stringify({task:'RF-PM-022-R1',testDatabase:databaseLabel(testDatabaseUrl),checks,screenshots:['01-draft-evidence-ready.png','02-validating-readonly.png','03-mobile-order-intake.png','04-outside-area-blocked.png'],allPass:true},null,2));
}finally{await context.close();await browser.close();}
