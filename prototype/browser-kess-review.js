async(page)=>{
 const ctx=await page.context().browser().newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),checks=[],errors=[];
 const dir='E:/Dr.RouteFit/prototype/records/2026-10-24-kess-review/';p.on('pageerror',e=>errors.push(e.message));
 const assert=(v,m)=>{if(!v)throw Error(m)},state=()=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('routefit-r1-prototype-v1')));
 const form=async(action,values={})=>{await p.locator(`[data-fin-action=${action}]`).first().click();for(const [name,value]of Object.entries(values))await p.locator(`#fin-form [name=${name}]`).selectOption(value);await p.locator('#fin-form [type=submit]').click();await p.locator('#finance-dialog').waitFor({state:'hidden'});};
 try{
  await p.goto('http://127.0.0.1:4173/prototype/language-preview.html');
  for(const locale of ['zh-CN','km-KH','en-US']){
   await p.locator('#locale').selectOption(locale);
   for(const width of [1440,390]){await p.setViewportSize({width,height:1000});for(const view of ['dispatch','driver','import','fees']){await p.locator(`[data-view=${view}]`).click();assert(await p.locator('#'+view).isVisible(),'view '+view);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'locale overflow');}}
   await p.locator('[data-view=dispatch]').click();await p.locator('#review-order').focus();await p.keyboard.press('Enter');assert(await p.locator('#driver').isVisible(),'keyboard review action');
   for(const group of ['overdue','transit','completed','cancelled']){await p.locator(`[data-group=${group}]`).click();assert(await p.locator('#driver-order').isVisible()===(group==='transit'),'group '+group);}
  }checks.push('9 controls × 3 locales; keyboard and mobile/desktop');
  await p.goto('http://127.0.0.1:4173/prototype/finance.html');await form('load');await p.locator('#fin-actor').selectOption('C01');await p.locator('[data-fin-tab=receipts]').click();await form('kessCreate',{orderId:'FIN-DEMO-002'});
  let f=(await state()).financeLedger;assert(f.paymentIntents[0].amount===1200,'insurance included in checkout');assert(f.receipts.length===0,'create is not payment');
  await form('kessQuery',{result:'UNKNOWN'});assert((await p.locator('main').innerText()).includes('结果未知'),'unknown label');
  await p.locator('[data-fin-action=kessCreate]').click();await p.locator('[name=orderId]').selectOption('FIN-DEMO-002');await p.locator('#fin-form [type=submit]').click();assert((await p.locator('#fin-error').innerText()).includes('已有支付'),'duplicate intent guard');await p.locator('#fin-form [data-close]').first().click();await p.locator('#fin-form [data-close]').first().click();
  await p.locator('[data-fin-action=kessQuery]').click();await p.locator('[name=result]').selectOption('MISMATCH');await p.locator('#fin-form [type=submit]').click();assert((await p.locator('#fin-error').innerText()).includes('不匹配'),'mismatch guard');await p.locator('[name=result]').selectOption('SUCCESS');await p.locator('#fin-form [type=submit]').click();await p.locator('#finance-dialog').waitFor({state:'hidden'});
  f=(await state()).financeLedger;assert(f.receipts.length===1&&f.receipts[0].custodian==='KESS','channel receipt');assert(f.allocations.length===0,'no approval bypass');
  await p.reload();assert((await state()).financeLedger.receipts.length===1,'reload duplicate');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'finance mobile overflow');
  const close=p.locator('#toast.show button');if(await close.count())await close.click();await p.screenshot({path:dir+'kess-customer.png',fullPage:true});
  await p.locator('#fin-actor').selectOption('MG01');await p.locator('[data-fin-tab=reports]').click();await p.setViewportSize({width:1440,height:1000});assert((await p.locator('main').innerText()).includes('KESS 渠道待结算'),'channel report');await p.screenshot({path:dir+'kess-report.png',fullPage:true});
  await p.locator('#fin-actor').selectOption('W01');assert(!(await p.locator('main').innerText()).includes('DEMO-KESS'),'warehouse privacy');
  checks.push('checkout fee+insurance; duplicate/unknown/mismatch; channel custody; no auto allocation; reload; role scope');
  assert(errors.length===0,errors.join(';'));return {checks,errors,screenshots:['kess-customer.png','kess-report.png']};
 }finally{await ctx.close()}
}
