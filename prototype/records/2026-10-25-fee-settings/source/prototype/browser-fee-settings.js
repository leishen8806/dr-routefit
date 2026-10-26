async (page) => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}}),p=await context.newPage();
 const checks=[],errors=[],dir='E:/Dr.RouteFit/prototype/records/2026-10-25-fee-settings/';
 const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
 p.on('pageerror',err=>errors.push(err.message));
 const state=()=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('routefit-r1-prototype-v1')));
 const fill=async(fields)=>{for(const [name,value] of Object.entries(fields)){const el=p.locator(`#action-form [name="${name}"]`);if(typeof value==='boolean')await el.setChecked(value);else if(await el.evaluate(x=>x.tagName)==='SELECT')await el.selectOption(value);else await el.fill(value);}};
 const submit=async()=>{await p.locator('#action-form [type=submit]').click();await p.locator('#dialog').waitFor({state:'hidden',timeout:5000});};
 const edit=async(code,fields)=>{await p.locator(`[data-fee-edit="DR:USD:${code}"]`).click();await fill({amount:'1',scope:'DEMO 金边同城／普通配送／门到门',evidence:'DEMO 合成价表',enabled:true,...fields});await submit();};
 try{
  await p.goto('http://127.0.0.1:4173/prototype/#pricing');await p.locator('[data-fee-edit]').first().waitFor();
  const original=await p.evaluate(()=>JSON.stringify(JSON.parse(sessionStorage.getItem('routefit-r1-prototype-v1')).orders));
  await p.locator('[data-section-tab=fee-trial]').click();assert(await p.locator('[data-action=feeTrial]').isDisabled(),'empty trial enabled');
  await p.locator('[data-section-tab=list]').click();await p.locator('[data-fee-edit="DR:USD:base"]').click();assert(!await p.locator('[name=unit]').isVisible(),'fixed method exposes unit fields');await fill({scope:'DEMO 金边同城',evidence:'DEMO 依据'});
  await p.locator('#action-form [type=submit]').click();await p.waitForFunction(()=>document.querySelector('#form-error').textContent.length>0);
  assert(await p.locator('[name=amount]').getAttribute('aria-invalid')==='true','amount error not associated');
  await fill({amount:'1',enabled:true,share:true});await submit();checks.push('空费率拒绝、字段错误关联与输入恢复、保存后回原分类');
  await edit('weight',{method:'unit',unit:'kg',included:'3',step:'0.5',amount:'0.25',share:true});
  await p.locator('[data-fee-group=funds]').click();await edit('insurance',{method:'percent',amount:'1'});await edit('cod',{method:'percent',amount:'0.5'});
  await p.locator('[data-section-tab=fee-trial]').click();await p.locator('[data-action=feeTrial]').click();
  await fill({use_base:true,use_weight:true,qty_weight:'3.1',use_insurance:true,qty_insurance:'200',use_cod:true,qty_cod:'200'});await submit();
  let db=await state(),q=db.feeSettings.trials.at(-1);assert(q.totalMinor===425&&q.shareMinor===125&&q.insuranceMinor===200,'incorrect fee split');
  await p.screenshot({path:dir+'trial-desktop.png',fullPage:true});checks.push('基础1＋续重0.25＋保险2＋COD服务1＝4.25；分成基数1.25，COD本金不加入总额');
  await p.locator('[data-section-tab=list]').click();await p.locator('[data-fee-group=transport]').click();await edit('base',{amount:'2',share:true});
  await p.locator('[data-section-tab=fee-trial]').click();assert((await p.locator('main').innerText()).includes('配置已有变更'),'stale trial not marked');
  assert((await state()).feeSettings.trials.at(-1).totalMinor===425,'prior trial changed');
  await p.locator('[data-section-tab=fee-history]').click();assert((await p.locator('main').innerText()).includes('USD 1.00 / 单 → USD 2.00 / 单'),'before/after missing');
  await p.reload();await p.locator('[data-fee-edit]').first().waitFor();db=await state();assert(db.feeSettings.rules['DR:USD:base'].amount===200,'reload lost config');
  assert(JSON.stringify(db.orders)===original,'configuration changed order money');checks.push('变更前后记录、旧试算过期提示、刷新持久化、原订单保持不变');
  await p.locator('[data-fee-filter=owner]').selectOption('ZTO');assert((await p.locator('main').innerText()).includes('尚未配置'),'carrier price prefilled');
  await p.locator('[data-fee-filter=currency]').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
  await p.locator('[data-fee-filter=currency]').selectOption('KHR');assert(await p.locator('[data-fee-edit="ZTO:KHR:base"]').count()===1,'KHR scope wrong');
  await p.locator('[data-fee-edit="ZTO:KHR:base"]').click();await fill({amount:'1.50',scope:'DEMO金边',evidence:'DEMO价格',enabled:true});
  await p.locator('#action-form [type=submit]').click();await p.waitForFunction(()=>document.querySelector('#form-error').textContent.includes('0 位'));await fill({amount:'5000'});await submit();
  checks.push('中通采购、USD/KHR独立；原生选择键盘操作，KHR拒绝小数');
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:dir+'settings-mobile.png',fullPage:true});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page horizontal overflow');
  await p.locator('[data-fee-edit="ZTO:KHR:base"]').click();await p.screenshot({path:dir+'edit-mobile.png',fullPage:true});
  const bounds=await p.locator('#action-form [type=submit]').boundingBox();assert(bounds&&bounds.y+bounds.height<=844,'submit clipped');
  await p.locator('[name=amount]').fill('6000');await p.keyboard.press('Escape');assert(await p.locator('#dialog').isVisible(),'dirty edit discarded without warning');await p.keyboard.press('Escape');await p.locator('#dialog').waitFor({state:'hidden'});
  assert((await state()).feeSettings.rules['ZTO:KHR:base'].amount===5000,'cancel saved dirty input');checks.push('390px页面与长弹窗可用，Esc脏输入提醒及放弃不改配置');
  await p.setViewportSize({width:1440,height:1000});await p.locator('[data-role=finance]').click();await p.locator('[data-nav=pricing]').click();assert(await p.locator('[data-fee-edit]').count()===0,'finance edit shown');checks.push('财务费用页只读，运营编辑；权限模型另有单测');
  assert(errors.length===0,errors.join('\n'));
  return {checks,errors,status:'PASS'};
 }finally{await context.close();}
}
