import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../services/routefit/node_modules/playwright-core/index.mjs';

const origin=process.env.ROUTEFIT_ALLOWED_ORIGIN||'http://127.0.0.1:4180',evidenceDirectory=resolve(process.env.ROUTEFIT_EVIDENCE_DIRECTORY||'services/routefit/verification/rf029');
await mkdir(evidenceDirectory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'}),checks=[];
const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
try{
 const expectedMinimum={ops:1,finance:1,dispatch:1,warehouse:1,driver:1,customer:0};
 let opsReminderCount=null;
 for(const role of Object.keys(expectedMinimum)){
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${origin}/prototype/?experience=rf029-${role}#${role}`,{waitUntil:'domcontentloaded',timeout:15000});await page.locator(`[data-role="${role}"]`).first().click();await page.locator('.topbar').waitFor({timeout:5000});
  const trigger=page.locator('[data-notices]').first();check(`${role} notice trigger visibility matches scope`,(await trigger.count())===Number(expectedMinimum[role]>0));if(expectedMinimum[role]>0){await trigger.click();const noticeCount=await page.locator('.notice-center article.notice').count();check(`${role} sees scoped reminders`,noticeCount>=expectedMinimum[role]);if(role==='ops')opsReminderCount=noticeCount;if(role==='driver')check('driver scope matches operations reminder set',noticeCount===opsReminderCount);await page.locator('[data-notice-close]').click();}else check(`${role} mapped-out role sees empty reminders`,await trigger.count()===0);await page.setViewportSize({width:350,height:844});check(`${role} has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.topbar-more summary').click({timeout:5000});check(`${role} more menu opens on mobile`,await page.locator('.topbar-more[open] .topbar-more-menu').isVisible());await page.locator('.topbar-more-menu a[href="./showcase.html"]').click({timeout:5000});await page.waitForURL(/showcase\.html/,{timeout:5000});check(`${role} more menu switches view`,page.url().includes('showcase.html'));}
 console.log(JSON.stringify({task:'RF-PM-033',checks,allPass:true},null,2));
}finally{await browser.close();}
