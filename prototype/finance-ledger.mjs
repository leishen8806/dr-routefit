// Synthetic local ledger. Production requires server identities, transactional locks and protected audit storage.
const must=(ok,message)=>{if(!ok)throw Error(message)};
const sum=rows=>rows.reduce((n,x)=>n+x.amount,0);
export const purposeNames={freight:'配送费',insurance:'保险费',cod:'代收货款',carrier:'合作运费',income:'司机收入'};
export const actors=[
 {id:'F01',personId:'P-F01',name:'林 · 经办',role:'maker'},
 {id:'F02',personId:'P-F02',name:'陈 · 复核',role:'reviewer'},
 {id:'F03',personId:'P-F03',name:'王 · 审批',role:'approver'},
 {id:'F04',personId:'P-F04',name:'周 · 付款执行',role:'cashier'},
 {id:'F05',personId:'P-F05',name:'李 · 资金核对',role:'checker'},
 {id:'MG01',personId:'P-MG',name:'管理者',role:'manager'},
 {id:'D01',personId:'P-D01',name:'Sokha · 司机',role:'driver',subject:'D01'},
 {id:'C01',personId:'P-C01',name:'河畔商行 · 发货人',role:'customer',subject:'C01'},
 {id:'M01',personId:'P-M01',name:'河畔商行 · 商户',role:'merchant',subject:'M01'},
 {id:'P01',personId:'P-P01',name:'合作承运方 · 对账',role:'carrier',subject:'P01'},
 {id:'W01',personId:'P-W01',name:'金边仓 · 仓管',role:'warehouse',subject:'WH01'}
];
export const financeInternal=a=>['maker','reviewer','approver','cashier','checker','manager'].includes(a.role);
export function guardLegacyFinance(db,c){
 const o=db.orders.find(o=>o.id===c.id)||db.orders.find(o=>o.id===c.payload?.orderId)||db.orders.find(o=>o.id===db.payables?.find(p=>p.id===c.id)?.orderId);
 if(o?.financeManaged&&['edit','report','verify','remit','reconcile','earningPost','commissionSet','payableVerify','payableDispute','payablePay','payableReverse','settlementCollect'].includes(c.action))throw Error('本单已纳入新版财务闭环，请到订单账款与报表处理，旧入口不能改写。');
 if(o?.financeManaged&&['offer','partnerOffer','bookingConfirm'].includes(c.action)&&o.financeTerms!=='approved_credit'){
  const lines=db.financeLedger.lines.filter(l=>l.orderId===o.id&&l.direction==='in'&&l.purpose!=='cod');must(lines.every(l=>lineDue(db.financeLedger,l)===0),'本单预付费用尚未核销，不能派单');
 }
}
export function amountMinor(value,currency='USD'){
 const digits=currency==='KHR'?0:2;must(['USD','KHR'].includes(currency),'币种不支持');
 const raw=String(value).trim();must(new RegExp(`^\\d+(?:\\.\\d{1,${digits||1}})?$`).test(raw)&&!(digits===0&&raw.includes('.')),'金额格式或币种精度不正确');
 const [whole,part='']=raw.split('.'),n=Number(whole)*(digits?100:1)+Number(part.padEnd(digits,'0'));
 must(Number.isSafeInteger(n)&&n>=0&&n<=100000000000,'金额超出范围');return n;
}
export const formatMoney=(n,c='USD')=>`${c} ${new Intl.NumberFormat('zh-CN',{minimumFractionDigits:c==='KHR'?0:2,maximumFractionDigits:c==='KHR'?0:2}).format(n/(c==='KHR'?1:100))}`;
export function initFinance(db){if(db.financeLedger)return db;return {...db,financeLedger:{version:1,next:1,company:'DR-DEMO',actors:structuredClone(actors),lines:[],receipts:[],allocations:[],documents:[],handovers:[],issues:[],audit:[],requests:{},accounts:{M01:{last4:'1200',version:1},P01:{last4:'1400',version:1},D01:{last4:'0100',version:1},C01:{last4:'2200',version:1}},loaded:false}};}
const id=f=>`FIN-${String(f.next++).padStart(4,'0')}`;
const actorFor=(f,id)=>{const a=f.actors.find(a=>a.id===id);must(a,'身份不可用');return a};
const allow=(a,...roles)=>must(roles.includes(a.role),'当前人员没有此操作权限');
const lineFor=(f,id)=>{const l=f.lines.find(x=>x.id===id);must(l,'账项不存在');return l};
export const linePaid=(f,l)=>sum(f.allocations.filter(x=>x.lineId===l.id));
export const lineTotal=(f,l)=>l.amount+sum(f.documents.filter(d=>d.kind==='adjustment'&&d.state==='posted'&&d.lineId===l.id));
export const lineDue=(f,l)=>lineTotal(f,l)-linePaid(f,l);
const livePayment=d=>['approved','processing','unknown','confirmed'].includes(d.state)&&['payment','refund'].includes(d.kind);
export const receiptFree=(f,r)=>r.amount-sum(f.allocations.filter(x=>x.receiptId===r.id))-sum(f.documents.filter(d=>d.kind==='refund'&&d.receiptId===r.id&&['approved','processing','unknown','confirmed','posted'].includes(d.state)));
export const paymentReserved=(f,l,except)=>sum(f.documents.filter(d=>d.id!==except&&d.kind==='payment'&&d.lineId===l.id&&livePayment(d)));
export function balances(f,currency='USD'){
 const receipts=f.receipts.filter(r=>r.currency===currency&&r.state==='confirmed'),hands=f.handovers.filter(h=>h.currency===currency&&h.counted!==undefined);
 const out=f.documents.filter(d=>d.currency===currency&&['payment','refund'].includes(d.kind)&&['confirmed','posted'].includes(d.state));
 const held=f.documents.filter(d=>d.currency===currency&&['payment','refund'].includes(d.kind)&&['approved','processing','unknown'].includes(d.state));
 const cashIn=sum(receipts.filter(r=>r.custodian==='COMPANY'))+hands.reduce((n,h)=>n+h.counted,0);
 const pendingCash=hands.filter(h=>!h.recoveryOf&&!f.documents.some(d=>d.handoverId===h.id&&d.kind==='handover'&&d.state==='posted')).reduce((n,h)=>n+h.counted,0);
 return {channel:sum(receipts.filter(r=>r.custodian==='KESS')),received:sum(receipts),company:cashIn-sum(out),available:cashIn-sum(out)-sum(held)-pendingCash,driver:sum(receipts.filter(r=>r.custodian==='D01'))-sum(hands),unresolved:sum(hands)-hands.reduce((n,h)=>n+h.counted,0),reserved:sum(held),pendingCash,out:sum(out)};
}
export function unrestrictedFunds(f,currency='USD'){
 const cod=f.lines.filter(l=>l.currency===currency&&l.direction==='out'&&l.purpose==='cod').reduce((n,l)=>n+lineDue(f,l)-paymentReserved(f,l),0);
 const insurance=f.lines.filter(l=>l.currency===currency&&l.direction==='in'&&l.purpose==='insurance').reduce((n,l)=>n+linePaid(f,l),0);
 const unapplied=f.receipts.filter(r=>r.currency===currency&&r.state==='confirmed').reduce((n,r)=>n+receiptFree(f,r),0);
 // Conservative: unresolved custody never makes earmarked or unallocated money available for operating payments.
 return balances(f,currency).available-cod-insurance-unapplied;
}
export function financialOrder(db,o){
 const f=db.financeLedger,lines=f?.lines.filter(l=>l.orderId===o.id)||[],ar=lines.filter(l=>l.direction==='in'),ap=lines.filter(l=>l.direction==='out');
 return {lines,receivable:sum(ar),unpaid:ar.reduce((n,l)=>n+lineDue(f,l),0),payable:sum(ap),owed:ap.reduce((n,l)=>n+lineDue(f,l),0)};
}
const scopedOrder=(a,o)=>financeInternal(a)||({driver:o.financeDriver,customer:o.financeCustomer,merchant:o.financeMerchant,warehouse:o.warehouseId,carrier:o.financeCost?.subject}[a.role]===a.subject);
const scopedLine=(a,l)=>financeInternal(a)?true:a.role==='warehouse'?l.direction==='in'&&l.purpose==='freight':a.role==='customer'?l.direction==='in':a.role==='merchant'?l.purpose==='cod':a.role==='driver'?(l.direction==='in'||l.purpose==='income'):a.role==='carrier'?l.direction==='out'&&l.subject===a.subject:false;
export function financeProjection(db,actorId){
 const f=db.financeLedger,a=actorFor(f,actorId),orders=db.orders.filter(o=>o.financeManaged&&scopedOrder(a,o)),ids=new Set(orders.map(o=>o.id));
 const lines=f.lines.filter(l=>ids.has(l.orderId)&&scopedLine(a,l));
 // Warehouse sees operational fees, never bank evidence, customer receipts or partner account details.
 const visible=orders.map(o=>({id:o.id,status:o.status,cargo:o.cargo,qty:o.qty,received:o.received,warehouseId:o.warehouseId,customer:o.customer,financeCustomer:o.financeCustomer,financeMerchant:o.financeMerchant,financeDriver:o.financeDriver,financeTerms:o.financeTerms,feeMinor:o.feeMinor,insuranceMinor:o.insuranceMinor,currency:o.currency}));
 const lineIds=new Set(lines.map(l=>l.id)),allocations=f.allocations.filter(x=>lineIds.has(x.lineId));
 const receiptIds=new Set(allocations.map(x=>x.receiptId));
 const receipts=a.role==='warehouse'?[]:f.receipts.filter(r=>financeInternal(a)||a.role==='customer'&&r.subject===a.subject||a.role==='driver'&&r.custodian===a.subject||a.role==='merchant'&&receiptIds.has(r.id)).map(r=>a.role==='merchant'?{id:r.id,currency:r.currency,state:r.state,amount:sum(allocations.filter(x=>x.receiptId===r.id))}:structuredClone(r));
 const documents=f.documents.filter(d=>financeInternal(a)||d.makerPerson===a.personId||a.role!=='warehouse'&&d.kind==='payment'&&lines.some(l=>l.id===d.lineId&&l.subject===a.subject));
 return {paymentIntents:(f.paymentIntents||[]).filter(x=>financeInternal(a)||a.role==='customer'&&x.subject===a.subject),actor:a,orders:visible,lines,allocations,receipts,documents:documents.map(d=>financeInternal(a)?d:{id:d.id,kind:d.kind,state:d.state,makerPerson:d.makerPerson,amount:d.amount,currency:d.currency,lineId:d.lineId,receiptId:d.receiptId,reason:d.reason}),handovers:['driver','maker','checker','reviewer','approver','cashier','manager'].includes(a.role)?f.handovers.filter(h=>financeInternal(a)||h.driver===a.subject):[],issues:financeInternal(a)?f.issues:[],audit:financeInternal(a)?f.audit:[]};
}
function addLine(f,o,purpose,direction,amount,subject){const l={id:`${o.id}:${direction}:${purpose}`,company:f.company,orderId:o.id,payer:o.financeCustomer,purpose,direction,amount,subject,currency:o.currency||'USD',due:'2026-10-24',source:`${o.id} / ${purpose==='carrier'?'演示承运协议':purpose==='income'?'演示分成规则':'确认费用'}`};f.lines.push(l);return l;}
function enroll(f,o){must(!o.financeManaged,'订单已纳入');must(o.collection==='due'&&!o.reportedMinor&&!o.settlementReceipts?.length,'已有收款证据的旧单需专门迁移，不能自动接管');o.financeManaged=true;o.financeCustomer||=`CUSTOMER:${o.id}`;o.financeDriver||=o.driverId||'D01';o.financeMerchant||='M01';o.currency||='USD';o.financeTerms||='prepaid';o.insuranceMinor??=o.insuranceFeeMinor||0;o.feeMinor??=o.deliveryAmountMinor??(o.amountMinor-o.insuranceMinor);must(Number.isSafeInteger(o.feeMinor)&&o.feeMinor>=0&&o.feeMinor+o.insuranceMinor===o.amountMinor,'费用组成与原订单总额不一致');addLine(f,o,'freight','in',o.feeMinor,o.financeCustomer);if(o.insuranceMinor)addLine(f,o,'insurance','in',o.insuranceMinor,'INSURER');if(o.codMinor)addLine(f,o,'cod','in',o.codMinor,o.financeMerchant);if(o.status==='delivered'&&o.financeCost)addLine(f,o,o.financeCost.kind,'out',o.financeCost.amount,o.financeCost.subject);}
function document(f,a,kind,p){return {id:id(f),kind,state:'draft',version:1,maker:a.id,makerPerson:a.personId,...p,history:[]};}
function validateDoc(f,d){
 must(d.reason?.trim(),'请填写业务理由或证据');
 if(d.kind==='allocation'){
  const r=f.receipts.find(x=>x.id===d.receiptId);must(r?.state==='confirmed','收款尚未确认');must(d.items.length>0,'至少填写一项核销金额');must(new Set(d.items.map(x=>x.lineId)).size===d.items.length,'账项不能重复');
  must(sum(d.items)<=receiptFree(f,r),'核销超过资金可用余额');
  for(const item of d.items){const l=lineFor(f,item.lineId);must(l.direction==='in'&&l.currency===r.currency&&l.company===r.company&&l.amount>=0,'公司、方向或币种不匹配');must(l.payer===r.subject,'付款主体不匹配');must(Number.isSafeInteger(item.amount)&&item.amount>0&&item.amount<=lineDue(f,l),'核销金额超过未结或格式错误');}
 }else if(d.kind==='payable'){
  must(Number.isSafeInteger(d.amount)&&d.amount>0&&['carrier','income'].includes(d.purpose),'填写有效应付金额与类型');must(!f.lines.some(l=>l.orderId===d.orderId&&l.direction==='out'&&l.purpose!=='cod'),'该订单已有运力应付／收入，不得重复计入');must(f.accounts[d.subject],'收款主体不存在');
 }else if(['payment','adjustment'].includes(d.kind)){
  const l=lineFor(f,d.lineId);must(d.currency===l.currency,'币种不匹配');must(Number.isSafeInteger(d.amount)&&d.amount!==0,'金额无效');
  if(d.kind==='payment'){must(l.direction==='out'&&d.amount>0,'只能结算应付');must(d.amount<=lineDue(f,l)-paymentReserved(f,l,d.id),'金额超过可付余额或已有付款占用');must(d.accountVersion===f.accounts[l.subject]?.version,'收款账户已变，必须重新制单复核');}
  else {must(l.direction==='in'&&l.purpose!=='cod','本切片仅支持服务费／保险费补差，COD 不得减免');must(lineDue(f,l)+d.amount>=0,'已核销款先撤销分配并走退款，不可直接减免');}
 }else if(d.kind==='reversal'){const entry=f.allocations.find(x=>x.id===d.allocationId);must(entry&&entry.amount>0&&!f.allocations.some(x=>x.reverses===entry.id),'原核销已撤销或不存在');must(entry.receiptId,'出款核销更正需独立返款事实，本切片禁止直接冲减已付款');const l=lineFor(f,entry.lineId);if(l.purpose==='cod'){const out=f.lines.find(x=>x.orderId===l.orderId&&x.purpose==='cod'&&x.direction==='out');must(!out||lineDue(f,out)-paymentReserved(f,out)>=entry.amount,'商户款已付或预留，须先处理返款，不能直接撤销');}}
 else if(d.kind==='refund'){const r=f.receipts.find(x=>x.id===d.receiptId);must(r?.state==='confirmed'&&r.currency===d.currency&&r.custodian==='COMPANY','退款须来源于已确认公司收款，渠道待结算款不能直接退付');must(d.amount>0&&d.amount<=receiptFree(f,r)+(livePayment(d)?d.amount:0),'退款超过未分配可退额');must(f.accounts[r.subject]&&d.accountVersion===f.accounts[r.subject].version,'退款账户缺失或已变化');}
 else if(d.kind==='account'){must(f.accounts[d.subject]&&/^\d{4}$/.test(d.last4),'请选择已存在对象及四位演示账户尾号');must(d.accountVersion===f.accounts[d.subject].version,'账户版本已变化');}
}
export function applyFinance(db,c,now=Date.now()){
 const input=initFinance(db),f0=input.financeLedger,a0=actorFor(f0,c.actorId);must(c.key&&typeof c.key==='string','缺少业务操作标识');
 const fingerprint=JSON.stringify([c.actorId,c.action,c.id,c.payload||{}]);
 if(f0.requests[c.key]){must(f0.requests[c.key]===fingerprint,'幂等键内容冲突');return db;}
 must(c.version===f0.version,'账务版本已变化，请刷新后重试');
 const next=structuredClone(input),f=next.financeLedger,a=actorFor(f,c.actorId),p=c.payload||{},at=new Date(now).toISOString();let target=c.id;
 if(c.action==='load'){
  allow(a,'maker');must(!f.loaded,'样例已加载');
  for(const [suffix,fee,insurance,cod,cost,currency] of [['001',2000,0,20000,{kind:'carrier',amount:1400,subject:'P01'},'USD'],['002',1000,200,0,{kind:'income',amount:800,subject:'D01'},'USD'],['003',10000,0,0,null,'KHR']]){
   const oid=`FIN-DEMO-${suffix}`;must(!next.orders.some(o=>o.id===oid),'样例编号冲突');
   const template=next.orders[0];const o={...structuredClone(template),id:oid,version:1,status:'delivered',customer:'河畔商行 · 财务演示',cargo:'演示包装箱',qty:1,received:1,warehouseId:'WH01',vehicle:'V01',fulfillmentMode:'OWN_VEHICLE',partnerId:null,booking:null,feeMinor:fee,insuranceMinor:insurance,codMinor:cod,amountMinor:fee+insurance,amount:(fee+insurance)/(currency==='KHR'?1:100),currency,payment:'cash',collection:'due',reportedMinor:0,remittance:'open',custody:'演示收货人',financeCustomer:'C01',financeTerms:'approved_credit',financeCost:cost,events:[{at,role:'演示数据',text:'已批准月结例外，已交付，尚未收款；保险独立记账'}]};
   for(const k of ['financeManaged','settlementReceipts','settlementHold','financeEvidence','collectionProof','remitProof','incident','rescueParent'])delete o[k];next.orders.push(o);enroll(f,o);
  }f.loaded=true;
 }else if(c.action==='enroll'){allow(a,'maker');const o=next.orders.find(o=>o.id===c.id);must(o,'订单不存在');must(!next.settlement?.bindings?.[`order:${o.id}`]&&!next.payables.some(x=>x.orderId===o.id)&&!next.earnings.some(x=>x.orderId===o.id),'旧账单／应付／收入已有记录，需迁移');enroll(f,o);
 }else if(c.action==='kessCreate'){
  allow(a,'maker','customer');const o=next.orders.find(o=>o.id===p.orderId&&o.financeManaged);must(o&&(a.role==='maker'||o.financeCustomer===a.subject),'订单不存在或不可付款');
  f.paymentIntents??=[];must(!f.paymentIntents.some(x=>x.orderId===o.id&&!['CLOSED','FAILED'].includes(x.state)),'本单已有支付记录，请查询原支付单或先完成财务核销');
  const lines=f.lines.filter(l=>l.orderId===o.id&&l.direction==='in'&&l.purpose!=='cod'&&lineDue(f,l)>0);must(lines.length>0,'没有待付配送费或保险费');
  const items=lines.map(l=>({lineId:l.id,amount:lineDue(f,l)}));const intent={id:id(f),orderId:o.id,orderVersion:o.version,subject:o.financeCustomer,amount:sum(items),currency:o.currency,items,state:'WAITING',createdAt:at,mode:'SIMULATED'};f.paymentIntents.push(intent);target=intent.id;
 }else if(c.action==='kessQuery'){
  allow(a,'maker','customer','checker');const intent=f.paymentIntents?.find(x=>x.id===c.id);must(intent&&(a.role!=='customer'||intent.subject===a.subject),'支付单不存在');must(['WAITING','SUCCESS','CLOSED','FAILED','UNKNOWN','MISMATCH'].includes(p.result),'演示查询结果无效');
  must(!['SUCCESS','CLOSED','FAILED'].includes(intent.state)||p.result===intent.state,'已确认终态不能被旧通知覆盖');
  if(p.result==='MISMATCH')throw Error('金额／币种／商户／订单不匹配，拒绝确认；保留原支付单');
  intent.state=p.result;intent.checkedAt=at;target=intent.id;
  if(p.result==='SUCCESS'&&!intent.receiptId){const transactionId='DEMO-KESS-'+intent.id;must(!f.receipts.some(r=>r.evidence===transactionId),'渠道交易已记录');
   const r={id:id(f),company:f.company,subject:intent.subject,amount:intent.amount,currency:intent.currency,method:'kess',custodian:'KESS',evidence:transactionId,state:'confirmed',reporter:a.id,reporterPerson:a.personId,at,confirmedAt:at,verifier:'KESS-SIMULATOR',verifyEvidence:'仅模拟服务端主动查单，未接真实渠道',paymentIntentId:intent.id};f.receipts.push(r);intent.receiptId=r.id;
  }
 }else if(c.action==='receipt'){
  allow(a,'maker','driver','customer');must(['bank','cash'].includes(p.method),'请选择收款方式');must(['USD','KHR'].includes(p.currency),'币种无效');const amount=amountMinor(p.amount,p.currency);must(amount>0,'金额必须大于零');must(typeof p.evidence==='string'&&p.evidence.trim(),'填写演示交易号／凭证');must(!f.receipts.some(r=>r.method===p.method&&r.evidence===p.evidence.trim()),'该交易已登记，不能重复收款');
  if(a.role==='driver')must(p.method==='cash','司机仅申报经手现金');if(a.role==='customer')must(p.method==='bank','客户转账到公司，不生成司机现金');
  const subject=a.role==='customer'?a.subject:p.subject||'C01';must(f.lines.some(l=>l.direction==='in'&&l.payer===subject),'付款主体未登记');if(a.role==='driver')must(next.orders.some(o=>o.financeManaged&&o.financeDriver===a.subject&&o.financeCustomer===subject),'不是当前司机客户的收款');
  const r={id:id(f),company:f.company,subject,amount,currency:p.currency,method:p.method,custodian:p.method==='cash'?'D01':'COMPANY',evidence:p.evidence.trim(),state:'reported',reporter:a.id,reporterPerson:a.personId,at};f.receipts.push(r);target=r.id;
 }else if(c.action==='confirmReceipt'){
  allow(a,'checker');const r=f.receipts.find(r=>r.id===c.id);must(r?.state==='reported','收款不是待核状态');must(r.reporterPerson!==a.personId,'不能核对自己申报的收款');must(p.evidence?.trim(),'填写资金核对证据');r.state='confirmed';r.verifier=a.id;r.verifyEvidence=p.evidence.trim();r.confirmedAt=at;
 }else if(c.action==='handover'){
  allow(a,'driver');const amount=amountMinor(p.amount,p.currency);must(amount>0&&p.evidence?.trim(),'填写交款金额与凭证');const other=sum(f.handovers.filter(h=>h.driver===a.subject&&h.currency===p.currency&&h.counted===undefined));must(amount<=balances(f,p.currency).driver-other,'交款超过当前持有且未申报的现金');
  let remaining=amount;const items=[];for(const r of f.receipts.filter(r=>r.state==='confirmed'&&r.custodian===a.subject&&r.currency===p.currency)){const used=sum(f.handovers.flatMap(h=>h.items||[]).filter(x=>x.receiptId===r.id)),take=Math.min(remaining,r.amount-used);if(take>0){items.push({receiptId:r.id,amount:take});remaining-=take;}}must(remaining===0,'现金来源无法完整关联，请核对');
  const h={id:id(f),driver:a.subject,personId:a.personId,amount,currency:p.currency,items,evidence:p.evidence.trim(),at};f.handovers.push(h);target=h.id;
 }else if(c.action==='count'){
  allow(a,'checker');const h=f.handovers.find(h=>h.id===c.id);must(h&&h.counted===undefined,'交款不存在或已点收');const counted=amountMinor(p.amount,h.currency);must(counted<=h.amount&&p.evidence?.trim(),'本切片实际点收不能大于申报，超收需另登记待查');must(h.personId!==a.personId,'司机不能自行点收');h.counted=counted;h.counter=a.id;h.countEvidence=p.evidence;h.countedAt=at;
  const driver=actorFor(f,h.driver),d=document(f,driver,'handover',{handoverId:h.id,amount:h.amount,currency:h.currency,reason:`点收 ${counted} 最小单位；${p.evidence}`});d.state='submitted';f.documents.push(d);if(counted<h.amount)f.issues.push({id:id(f),handoverId:h.id,amount:h.amount-counted,currency:h.currency,state:'open',reason:'交款差额，责任及去向待查；不自动扣收入',owner:'F01'});
 }else if(c.action==='recover'){
  allow(a,'checker');const issue=f.issues.find(x=>x.id===c.id);must(issue?.state==='open'&&p.evidence?.trim(),'差异已处理或缺少证据');const h=f.handovers.find(h=>h.id===issue.handoverId);must(!f.documents.some(d=>d.kind==='recovery'&&d.issueId===issue.id&&!['rejected','posted'].includes(d.state)),'已有差额补交待审核');const d=document(f,a,'recovery',{issueId:issue.id,handoverId:h.id,amount:issue.amount,currency:issue.currency,reason:p.evidence});f.documents.push(d);target=d.id;
 }else if(c.action==='draft'){
  const kind=p.kind;must(['allocation','payment','adjustment','reversal','refund','account','payable'].includes(kind),'单据类型不支持');
  if(a.role==='driver'){must(kind==='payment'&&lineFor(f,p.lineId).subject===a.subject&&lineFor(f,p.lineId).purpose==='income','司机只能申请自己的收入提现');}else if(['merchant','carrier'].includes(a.role)){must(kind==='payment'&&lineFor(f,p.lineId).direction==='out'&&lineFor(f,p.lineId).subject===a.subject,'只能申请本主体返款或结算');}else if(a.role==='warehouse'){const l=lineFor(f,p.lineId);must(kind==='adjustment'&&l.purpose==='freight'&&scopedOrder(a,next.orders.find(o=>o.id===l.orderId)),'仓库只可提交本仓服务费用依据');}else if(a.role==='customer'){must(kind==='refund'&&f.receipts.find(r=>r.id===p.receiptId)?.subject===a.subject,'只能申请自己的退款');}else allow(a,'maker');
  let body={reason:p.reason,currency:p.currency||'USD'};
  if(kind==='payable'){const o=next.orders.find(o=>o.id===p.orderId);must(o?.financeManaged&&o.status==='delivered','应付依据须为已签收且已纳入的订单');must(['carrier','income'].includes(p.purpose),'选择合作费用或司机收入');body={...body,orderId:o.id,orderVersion:o.version,currency:o.currency,purpose:p.purpose,subject:p.purpose==='income'?o.financeDriver:'P01',amount:amountMinor(p.amount,o.currency)};}
  if(kind==='allocation'){const r=f.receipts.find(r=>r.id===p.receiptId);must(r,'请选择收款');body={...body,receiptId:r.id,currency:r.currency,items:(p.items||[]).map(x=>({lineId:x.lineId,amount:amountMinor(x.amount,r.currency)}))};body.amount=sum(body.items);}
  if(['payment','adjustment'].includes(kind)){const l=lineFor(f,p.lineId);body={...body,lineId:l.id,currency:l.currency,amount:amountMinor(p.amount,l.currency)*(p.negative&&kind==='adjustment'?-1:1),accountVersion:f.accounts[l.subject]?.version,subject:l.subject,accountSnapshot:structuredClone(f.accounts[l.subject]||null)};}
  if(kind==='reversal'){const entry=f.allocations.find(x=>x.id===p.allocationId);must(entry,'请选择原核销');body={...body,allocationId:entry.id,currency:entry.currency,amount:entry.amount};}
  if(kind==='refund'){const r=f.receipts.find(r=>r.id===p.receiptId);must(r,'请选择原收款');body={...body,receiptId:r.id,currency:r.currency,amount:amountMinor(p.amount,r.currency),accountVersion:f.accounts[r.subject]?.version,subject:r.subject,accountSnapshot:structuredClone(f.accounts[r.subject]||null)};}
  if(kind==='account')body={...body,subject:p.subject,last4:p.last4,accountVersion:f.accounts[p.subject]?.version,previousAccount:structuredClone(f.accounts[p.subject]||null),amount:0};
  const d=document(f,a,kind,body);validateDoc(f,d);f.documents.push(d);target=d.id;
 }else {
  const d=f.documents.find(x=>x.id===c.id);must(d,'单据不存在');must(p.documentVersion===d.version,'单据版本已变化');
  const record=(action)=>d.history.push({action,actor:a.id,person:a.personId,version:d.version,at,amount:d.amount,currency:d.currency,accountVersion:d.accountVersion,accountSnapshot:structuredClone(d.accountSnapshot||null),subject:d.subject,lineId:d.lineId,receiptId:d.receiptId,items:structuredClone(d.items||[]),evidence:p.evidence||d.reason});
  if(c.action==='submit'){must(d.makerPerson===a.personId&&d.state==='draft','只有经办人可提交草稿');validateDoc(f,d);d.state='submitted';record('提交');}
  else if(c.action==='review'){allow(a,'reviewer');must(d.state==='submitted','需先提交');must(d.makerPerson!==a.personId,'经办人不能复核自己的单据');validateDoc(f,d);d.reviewer=a.id;d.reviewerPerson=a.personId;d.reviewVersion=d.version;d.state='reviewed';record('复核');}
  else if(c.action==='approve'){allow(a,'approver');must(d.state==='reviewed'&&d.reviewVersion===d.version,'缺少本版本复核');must(a.personId!==d.makerPerson&&a.personId!==d.reviewerPerson,'经办、复核、审批必须不同人员');validateDoc(f,d);if(['payment','refund'].includes(d.kind))must(d.amount<=balances(f,d.currency).available,'公司已确认可用款不足，不能占用司机持款、差额或待审交款');if(d.kind==='payment'&&lineFor(f,d.lineId).purpose!=='cod')must(d.amount<=unrestrictedFunds(f,d.currency),'可用于运费结算的资金不足，不能挪用COD、保险或未分配收款');d.approver=a.id;d.approverPerson=a.personId;d.state='approved';record('审批');}
  else if(c.action==='reject'){allow(a,'reviewer','approver');must(['submitted','reviewed'].includes(d.state)&&a.personId!==d.makerPerson,'不能退回此单据');must(p.evidence?.trim(),'填写退回原因');d.state='rejected';record('退回');}
  else if(c.action==='revise'){
   must(d.makerPerson===a.personId&&['draft','submitted','reviewed','approved','rejected'].includes(d.state)&&!['handover','recovery'].includes(d.kind),'此单据不可修改');record('旧版本失效');d.version++;d.state='draft';delete d.reviewer;delete d.reviewerPerson;delete d.approver;delete d.approverPerson;delete d.reviewVersion;
   must(p.reason?.trim(),'填写新版本理由');d.reason=p.reason;
   if(['payment','refund','adjustment','payable'].includes(d.kind))d.amount=amountMinor(p.amount,d.currency)*(d.kind==='adjustment'&&p.negative?-1:1);
   if(d.kind==='allocation'){d.items=(p.items||[]).map(x=>({lineId:x.lineId,amount:amountMinor(x.amount,d.currency)}));d.amount=sum(d.items);}
   if(d.kind==='account')d.last4=p.last4;
   const subject=d.kind==='payment'?lineFor(f,d.lineId).subject:d.kind==='refund'?f.receipts.find(r=>r.id===d.receiptId).subject:d.subject;if(subject){d.accountVersion=f.accounts[subject]?.version;d.accountSnapshot=structuredClone(f.accounts[subject]||null);}validateDoc(f,d);record('修订');
  }else if(c.action==='execute'){
   allow(a,'cashier');must(['payment','refund'].includes(d.kind)&&d.state==='approved','只有审批完成且未执行的付款可登记');must(p.evidence?.trim(),'填写银行端执行凭证');must(!f.documents.some(x=>x.id!==d.id&&x.executionEvidence===p.evidence.trim()),'执行凭证已登记，先核对原付款，不得重复使用');validateDoc(f,d);must(balances(f,d.currency).available>=0,'批准后资金余额已变化，请重新核对');if(d.kind==='payment'&&lineFor(f,d.lineId).purpose!=='cod')must(unrestrictedFunds(f,d.currency)>=0,'批准后资金用途已变化，请重新核对');d.state='processing';d.executor=a.id;d.executorPerson=a.personId;d.executionEvidence=p.evidence;record('人工执行登记');
  }else if(c.action==='paymentResult'){
   allow(a,'checker');must(['processing','unknown'].includes(d.state)&&a.personId!==d.executorPerson,'结果待核对且核对人必须独立于执行人');must(['unknown','failed','confirmed'].includes(p.result)&&p.evidence?.trim(),'选择结果并填写资金核对证据');d.state=p.result;d.checker=a.id;d.resultEvidence=p.evidence;record('资金核对');
  }else if(c.action==='post'){
   allow(a,'checker');must(d.state===(['payment','refund'].includes(d.kind)?'confirmed':'approved'),'需要完成本版本复核审批及资金核对');
   if(!['payment','refund'].includes(d.kind))validateDoc(f,d);
   if(d.kind==='allocation')for(const x of d.items){const l=lineFor(f,x.lineId);f.allocations.push({id:id(f),documentId:d.id,receiptId:d.receiptId,lineId:l.id,amount:x.amount,currency:l.currency,at});if(l.purpose==='cod'){let out=f.lines.find(y=>y.orderId===l.orderId&&y.purpose==='cod'&&y.direction==='out');if(!out)out=addLine(f,next.orders.find(o=>o.id===l.orderId),'cod','out',0,l.subject);out.amount+=x.amount;}}
   if(d.kind==='payment'){const l=lineFor(f,d.lineId);must(d.amount<=lineDue(f,l),'应付余款变化，需处理差异');f.allocations.push({id:id(f),documentId:d.id,lineId:l.id,amount:d.amount,currency:d.currency,at});}
   if(d.kind==='payable'){const o=next.orders.find(o=>o.id===d.orderId);must(o.status==='delivered'&&o.version===d.orderVersion,'履约依据已变化，请重新制单核对');const l=addLine(f,o,d.purpose,'out',d.amount,d.subject);l.source=`${o.id} / 批准单 ${d.id} / ${d.reason}`;o.financeCost={kind:d.purpose,amount:d.amount,subject:d.subject,documentId:d.id};}
   if(d.kind==='reversal'){const entry=f.allocations.find(x=>x.id===d.allocationId);f.allocations.push({id:id(f),documentId:d.id,lineId:entry.lineId,receiptId:entry.receiptId,amount:-entry.amount,currency:entry.currency,reverses:entry.id,at});const l=lineFor(f,entry.lineId);if(l.purpose==='cod')f.lines.find(x=>x.orderId===l.orderId&&x.purpose==='cod'&&x.direction==='out').amount-=entry.amount;}
   if(d.kind==='account'){f.accounts[d.subject]={last4:d.last4,version:f.accounts[d.subject].version+1};}
   if(d.kind==='recovery'){const issue=f.issues.find(x=>x.id===d.issueId);must(issue.state==='open','差额已处理');const h=f.handovers.find(x=>x.id===d.handoverId);f.handovers.push({id:id(f),driver:h.driver,amount:0,counted:d.amount,currency:d.currency,recoveryOf:h.id,counter:a.id,countEvidence:d.reason,at});issue.state='resolved';issue.resolution=d.id;}
   d.state='posted';record('入账／核销');
  }else throw Error('未知财务动作');
 }
 for(const d of f.documents)if(!d.createdAt)d.createdAt=at;
 f.audit.push({id:id(f),at,actor:a.id,person:a.personId,action:c.action,target,version:f.version,company:f.company});f.requests[c.key]=fingerprint;f.version++;
 for(const o of next.orders.filter(o=>o.financeManaged)){const state=financialOrder(next,o);o.collection=state.unpaid===0?'verified':state.unpaid<state.receivable?'partial':'due';o.financeOpenMinor=state.unpaid;o.events??=[];}
 return next;
}
