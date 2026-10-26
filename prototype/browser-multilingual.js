async(page)=>{
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)};const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/prototype/language-preview.html');
 const result=[];
 for(const locale of ['km-KH','en-US','zh-CN']){
  await page.locator('#locale').selectOption(locale);
  assert(await page.locator('html').getAttribute('lang')===locale,'html language');
  for(const width of [1280,390,360]){
   await page.setViewportSize({width,height:900});
   for(const view of ['dispatch','driver','import','fees']){
    await page.locator(`[data-view=${view}]`).click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+locale+width+view);
   }
  }
  result.push(locale+': 4 sections at 1280/390/360px');
 }
 await page.locator('[data-view=import]').click();await page.locator('[name=pickupContact]').fill('DEMO Unchanged');
 await page.locator('#locale').selectOption('km-KH');assert(await page.locator('[name=pickupContact]').inputValue()==='DEMO Unchanged','input lost');
 await page.locator('[name=pickupContact]').fill('   ');await page.locator('#language-form button').click();assert(await page.locator('[name=pickupContact]').getAttribute('aria-invalid')==='true','blank input validation');await page.locator('[name=pickupContact]').fill('DEMO Unchanged');await page.locator('#language-form button').click();assert((await page.locator('#form-status').textContent()).length>0,'save feedback');
 await page.reload();assert(await page.locator('#locale').inputValue()==='km-KH','language persistence');
 await page.locator('[data-view=import]').click();assert(await page.locator('[name=pickupContact]').inputValue()==='DEMO Unchanged','draft persistence');
 await page.locator('[data-view=driver]').click();await page.locator('[data-group=cancelled]').click();await page.locator('#locale').selectOption('en-US');assert(await page.locator('#empty-orders').isVisible(),'group lost');
 await page.locator('[data-group=transit]').click();assert(await page.locator('#driver-order').isVisible(),'driver order');
 await page.locator('[data-view=fees]').click();assert((await page.locator('[data-money="2200"]').last().textContent()).includes('22.00'),'money changed');
 await page.locator('#locale').selectOption('km-KH');await page.screenshot({path:'E:/Dr.RouteFit/prototype/records/2026-10-24-multilingual/khmer-mobile-fees.png',fullPage:true});
 await page.setViewportSize({width:1280,height:900});await page.locator('[data-view=dispatch]').click();await page.screenshot({path:'E:/Dr.RouteFit/prototype/records/2026-10-24-multilingual/khmer-desktop.png',fullPage:true});
 await page.locator('#review-order').click();assert(await page.locator('#driver').isVisible(),'review navigation');
 assert(!errors.length,errors.join('\n'));return {passed:result,interaction:'input, group, locale persistence, draft save/reload, order navigation and fixed USD amounts passed',pageErrors:errors};
}
