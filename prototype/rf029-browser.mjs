import {mkdir} from 'node:fs/promises';
import {chromium} from '../services/routefit/node_modules/playwright-core/index.mjs';

const out = 'prototype/screenshots/rf029';
await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport:{width:1440,height:1000}, locale:'zh-CN'});
const roles = ['ops','finance','dispatch','warehouse'];
const checks=[];
for(const role of roles){
  await page.goto(`http://127.0.0.1:4173/prototype/?experience=rf029-${role}#${role}`);
  await page.locator(`[data-role="${role}"]`).first().click();
  await page.locator('.topbar').waitFor();
  await page.locator('[data-notices]').first().click();
  await page.screenshot({path:`${out}/${role}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:350,height:844});
  const mobile = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,topbarHeight:document.querySelector('.topbar')?.getBoundingClientRect().height,more:!!document.querySelector('.topbar-more'),badge:document.querySelector('[data-notices]')?.dataset.count||''}));
  if(mobile.overflow) throw new Error(`${role} mobile overflow`);
  await page.screenshot({path:`${out}/${role}-350.png`,fullPage:true});
  checks.push({role,mobile});
  await page.setViewportSize({width:1440,height:1000});
}
console.log(JSON.stringify({allPass:true,checks},null,2));
await browser.close();
