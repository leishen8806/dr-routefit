import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../services/routefit/node_modules/playwright-core/index.mjs';
import {seed} from './model.mjs';
import {addDispatchScenario,dispatchAlerts,filterAlertsByRole} from './dispatch-ui.mjs';
import {driverAccess} from './r1m-model.mjs';

const origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||'http://127.0.0.1:4180',evidenceDirectory=resolve(process.env.ROUTEFIT_EVIDENCE_DIRECTORY||'services/routefit/verification/rf029');
await mkdir(evidenceDirectory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'}),checks=[];
const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
try{
 const sourceDb=addDispatchScenario(seed()),sourceAlerts=dispatchAlerts(sourceDb);
 const expectedByRole=Object.fromEntries(['ops','finance','dispatch','warehouse','customer'].map(role=>[role,filterAlertsByRole(sourceAlerts,role)]));
 expectedByRole.driver=sourceAlerts.filter(alert=>driverAccess(sourceDb,sourceDb.orders.find(order=>order.id===alert.id),'driver','D01'));
 check('ops expected reminders are independent and complete',expectedByRole.ops.length===sourceAlerts.length&&JSON.stringify(expectedByRole.ops.map(item=>item.id).sort())===JSON.stringify(sourceAlerts.map(item=>item.id).sort()));
 check('customer expected reminders are empty',expectedByRole.customer.length===0);
 for(const role of Object.keys(expectedByRole)){
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${origin}/prototype/?experience=rf029-${role}#${role}`,{waitUntil:'domcontentloaded',timeout:15000});await page.locator(`[data-role="${role}"]`).first().click();await page.locator('.topbar').waitFor({timeout:5000});
  const expected=expectedByRole[role],trigger=page.locator('[data-notices]').first();check(`${role} notice trigger visibility matches scope`,(await trigger.count())===Number(expected.length>0));if(expected.length>0){await trigger.click();const notices=page.locator('.notice-center article.notice'),noticeCount=await notices.count();check(`${role} reminder count matches data source`,noticeCount===expected.length);const ids=await notices.evaluateAll(nodes=>nodes.map(node=>node.querySelector('small')?.textContent?.split('·').at(-1)?.trim()).sort());check(`${role} reminder ids match data source`,JSON.stringify(ids)===JSON.stringify(expected.map(item=>item.id).sort()));await page.locator('[data-notice-close]').click();}else check(`${role} mapped-out role sees empty reminders`,await trigger.count()===0);await page.setViewportSize({width:350,height:844});check(`${role} has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const more=page.locator('.topbar-more summary');if(await more.isVisible()){await more.click({timeout:5000});check(`${role} more menu opens on mobile`,await page.locator('.topbar-more[open] .topbar-more-menu').isVisible());await page.locator('.topbar-more-menu a[href="./showcase.html"]').click({timeout:5000});await page.waitForURL(/showcase\.html/,{timeout:5000});check(`${role} more menu switches view`,page.url().includes('showcase.html'));}else if(role==='driver')check('driver mobile main action area remains usable',await page.locator('.driver-bottom').first().isVisible());else if(role==='customer')check('customer mobile main action area remains usable',await page.locator('.customer-app').isVisible());else throw Error(`${role} mobile more menu is missing`);}
 console.log(JSON.stringify({task:'RF-PM-033',checks,allPass:true},null,2));
}finally{await browser.close();}
