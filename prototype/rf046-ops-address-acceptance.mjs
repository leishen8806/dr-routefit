import {mkdir,writeFile} from 'node:fs/promises';
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
try{
 for(let run=1;run<=3;run++){
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});const page=await context.newPage();
  const grant=await createBrowserGrant({sessionsFile,actor:0,origin});await page.goto(grant.url);await page.goto(`${origin}/prototype/orders.html`);await page.locator('#refresh-list').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#refresh-list')?.disabled===false);
  await assertTestDatabase(page,testDatabaseUrl);
  check(`run ${run}: ops address-change panel is present`,await page.locator('#address-change-panel').count()===1);
  check(`run ${run}: consent fields are present`,await page.locator('#change-consent-reference,#change-consent-at,#change-consent-channel').count()===3);
  check(`run ${run}: original quote warning is visible`,await page.locator('#address-change-panel').innerText().then(text=>text.includes('原报价、原收款不被覆盖')));
  check(`run ${run}: independent decision controls are present`,await page.locator('#decide-address-change,#generate-address-candidate,#confirm-address-candidate').count()===3);
  check(`run ${run}: candidate confirmation fields are present`,await page.locator('#candidate-confirm-contact,#candidate-confirm-reference,#candidate-confirm-at').count()===3);
  check(`run ${run}: independent decision warning is visible`,await page.locator('#address-change-status').count()===1);
  await page.reload();await page.locator('#refresh-list').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#refresh-list')?.disabled===false);
  check(`run ${run}: panel survives page reload`,await page.locator('#address-change-panel').count()===1);
  await page.screenshot({path:resolve(evidenceDirectory,`run-${run}-address-change.png`),fullPage:true});await context.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify({task:'RF-PM-046',checks,allPass:true},null,2));
