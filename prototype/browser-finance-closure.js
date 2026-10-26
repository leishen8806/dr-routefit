async(page)=>{
 const ctx=await page.context().browser().newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage();
 const errors=[],checks=[],dir='E:/Dr.RouteFit/prototype/records/2026-10-24-finance-closure/';p.on('pageerror',e=>errors.push(e.message));
 const shot=async name=>{const close=p.locator('#toast.show button');if(await close.count())await close.click();await p.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');await p.screenshot({path:dir+name,fullPage:true})};
 const assert=(ok,m)=>{if(!ok)throw Error(m)},state=()=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('routefit-r1-prototype-v1')));
 const actor=async id=>{await p.locator('#fin-actor').selectOption(id)};
 const tab=async id=>{await p.locator(`[data-fin-tab="${id}"]`).click()};
 const form=async(action,values={},id='')=>{
  await p.locator(`[data-fin-action="${action}"]${id?`[data-id="${id}"]`:''}`).first().click();
  for(const [name,value]of Object.entries(values)){const input=p.locator(`#fin-form [name="${name}"]`);if(await input.evaluate(x=>x.tagName)==='SELECT')await input.selectOption(String(value));else await input.fill(String(value));}
  await p.locator('#fin-form [type=submit]').click();await p.locator('#finance-dialog').waitFor({state:'hidden',timeout:3500});
 };
 const lastDoc=async()=> (await state()).financeLedger.documents.at(-1).id;
 const openDoc=async id=>{await tab('documents');await p.locator('#fin-query').fill(id);await p.locator('#fin-search button[type=submit], #fin-search button:not([type])').first().click();await p.locator(`[data-fin-detail="doc:${id}"]`).click()};
 const approve=async(id,maker='F01')=>{await actor(maker);await openDoc(id);await form('submit');await actor('F02');await openDoc(id);await form('review');await actor('F03');await openDoc(id);await form('approve')};
 const post=async id=>{await actor('F05');await openDoc(id);await form('post')};
 const payment=async(line,amount,unknown=false,maker='F01')=>{
  await actor(maker);await tab('documents');await form('newPayment',{lineId:line,amount,reason:'演示协议与履约证据已核对'});const id=await lastDoc();await approve(id,maker);await actor('F04');await openDoc(id);await form('execute',{evidence:'EXEC-'+id});
  let db=await state();assert(!db.financeLedger.allocations.some(x=>x.documentId===id),'execution prematurely allocated');
  await actor('F05');await openDoc(id);if(unknown){await form('paymentResult',{result:'unknown',evidence:'RESULT-PENDING'});assert((await p.locator('main').innerText()).includes('禁止重复付款'),'unknown not visible');await shot('payment-unknown.png');}
  await form('paymentResult',{result:'confirmed',evidence:'CONFIRMED-'+id});await form('post');return id;
 };
 try{
  await p.goto('http://127.0.0.1:4173/prototype/finance.html');assert((await p.locator('main').innerText()).includes('暂无匹配记录'),'empty state');
  await form('load');assert((await state()).orders.some(o=>o.id==='FIN-DEMO-001'),'source orders missing');
  await actor('D01');await tab('receipts');await p.locator('[data-fin-action=receipt]').click();await p.locator('#fin-form [name=amount]').fill('-1');await p.locator('#fin-form [type=submit]').click();assert((await p.locator('#fin-error').innerText()).length>0,'invalid amount accepted');await p.locator('[name=amount]').fill('220');await p.locator('[name=evidence]').fill('CASH-220');await p.locator('#fin-form [type=submit]').click();await p.locator('#finance-dialog').waitFor({state:'hidden'});
  const receipt=(await state()).financeLedger.receipts[0].id;
  await actor('F05');await tab('tasks');await form('confirmReceipt',{evidence:'独立点验与客户收款凭证'},receipt);
  await actor('F01');await tab('receipts');await form('newAllocation',{receiptId:receipt,'allocate:FIN-DEMO-001:in:freight':'20','allocate:FIN-DEMO-001:in:cod':'200',reason:'运费20，代收商户货款200'});const allocation=await lastDoc();await approve(allocation);await shot('approval.png');await post(allocation);
  await actor('D01');await tab('orders');await p.setViewportSize({width:390,height:844});await shot('driver.png');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'driver horizontal overflow');await p.setViewportSize({width:1440,height:1000});await tab('cash');await form('handover',{amount:'220',currency:'USD',evidence:'DRIVER-HANDOVER'});
  await actor('F05');await tab('cash');await form('count',{amount:'210',evidence:'COUNTED-210'});let db=await state();assert(db.financeLedger.issues[0].amount===1000,'shortage missing');assert(db.financeLedger.lines.find(x=>x.id==='FIN-DEMO-001:out:cod').amount===20000,'COD reduced for shortage');
  const cashDoc=await lastDoc();await actor('F02');await openDoc(cashDoc);await form('review');await actor('F03');await openDoc(cashDoc);await form('approve');await post(cashDoc);
  await actor('F05');await tab('cash');await shot('cash-difference.png');await form('recover',{evidence:'核实后补交10，保留原210点收'},db.financeLedger.issues[0].id);const recovery=await lastDoc();await approve(recovery,'F05');await post(recovery);
  await actor('M01');await tab('reports');await shot('merchant.png');
  await actor('P01');await tab('orders');assert((await p.locator('main').innerText()).includes('应付未结 USD 14.00'),'carrier payable hidden or mixed');await shot('carrier.png');
  await payment('FIN-DEMO-001:out:cod','200',true,'M01');await payment('FIN-DEMO-001:out:carrier','14');
  checks.push('司机现金220 → 三人核销 → 实交210差额10 → 补交独立审批 → 商户200返款及承运14结算；未知结果不重付');
  await actor('C01');await tab('receipts');await form('receipt',{amount:'15',method:'bank',currency:'USD',evidence:'BANK-15'});const bank=(await state()).financeLedger.receipts.at(-1).id;await actor('F05');await tab('tasks');await form('confirmReceipt',{evidence:'BANK-CHECK-15'},bank);
  await actor('F01');await tab('receipts');await form('newAllocation',{receiptId:bank,'allocate:FIN-DEMO-002:in:freight':'10','allocate:FIN-DEMO-002:in:insurance':'2',reason:'配送费10及保险2独立'});const fee=await lastDoc();await approve(fee);await post(fee);
  await actor('C01');await tab('orders');await p.setViewportSize({width:390,height:844});await shot('customer.png');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'customer overflow');await p.setViewportSize({width:1440,height:1000});
  await tab('receipts');await form('newRefund',{receiptId:bank,amount:'3',reason:'超付未分配款退回'});const refund=await lastDoc();await approve(refund,'C01');await actor('F04');await openDoc(refund);await form('execute',{evidence:'REFUND-3'});await actor('F05');await openDoc(refund);await form('paymentResult',{result:'confirmed',evidence:'REFUND-RESULT'});await form('post');await payment('FIN-DEMO-002:out:income','8',false,'D01');
  checks.push('用户公司转账15 → 运费10/保险2分项核销 → 多付3经三人审核退款 → 司机收入8提现核对');
  await actor('W01');await tab('orders');await shot('warehouse.png');assert(!(await p.locator('main').innerText()).includes('收款账户'),'warehouse bank data exposed');await form('newAdjustment',{lineId:'FIN-DEMO-001:in:freight',amount:'2',negative:'false',reason:'仓库搬运费用依据，待财务复核'});const warehouse=await lastDoc();await approve(warehouse,'W01');await post(warehouse);
  checks.push('仓库仅提报本仓服务费用依据，经办与财务复核审批分离，保险及COD不由仓库改写');
  await actor('F01');await tab('orders');await p.locator('[data-fin-detail="order:FIN-DEMO-001"]').click();await p.locator('[data-detail-tab=funds]').click();await shot('trace.png');await p.locator('#fin-back').click();assert(await p.locator('#fin-query').count()===1,'detail back failed');
  await tab('tasks');await shot('finance.png');await actor('MG01');await tab('reports');await shot('manager.png');
  await p.locator('#fin-report').selectOption('aging');await p.locator('#fin-asof').fill('2026-11-24');await p.locator('#fin-asof').dispatchEvent('change');assert((await p.locator('main').innerText()).includes('逾期31天以上'),'aging report missing');await p.locator('#fin-report').selectOption('detail');
  const download=p.waitForEvent('download');await p.locator('#fin-export').click();assert((await download).suggestedFilename().endsWith('.csv'),'export failed');
  await p.locator('#fin-query').fill('无此业务');await p.locator('#fin-search button').first().click();assert((await p.locator('main').innerText()).includes('暂无匹配记录'),'no results');await p.locator('#fin-clear').click();await p.locator('#fin-currency').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.locator('#fin-currency').selectOption('KHR');assert((await p.locator('main').innerText()).includes('KHR 10,000'),'currency report');
  await p.reload();assert((await state()).financeLedger.documents.some(d=>d.id===refund&&d.state==='posted'),'reload persistence');assert(await p.locator('#fin-currency').inputValue()==='KHR','url state');
  await p.goto('http://127.0.0.1:4173/prototype/#warehouse');assert(await p.getByRole('link',{name:'订单账款与报表'}).count()===1,'workspace link missing');await p.getByRole('link',{name:'订单账款与报表'}).click();assert(await p.locator('#fin-actor').inputValue()==='W01','warehouse role link');
  checks.push('订单追溯/返回、CSV导出、搜索清空、原生选择键盘、KHR隔离、刷新保留和原工作台入口通过');
  assert(errors.length===0,errors.join('\n'));return {status:'PASS',checks,pageErrors:errors};
 }finally{await ctx.close();}
}
