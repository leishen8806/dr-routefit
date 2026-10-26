const check=(ok,msg,field)=>{if(!ok){const error=Error(msg);error.field=field;throw error;}};
const DAY=86400000;
export const settlementActions=new Set(['settlementRule','settlementCheck','settlementClock','settlementDemo','settlementConfirm','settlementSend','settlementCollect','settlementHold','settlementRead']);
export const localDate=(now=Date.now())=>new Date(now+7*3600000).toISOString().slice(0,10);
const dateNumber=d=>Date.parse(d+'T00:00:00Z');
export function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(dateNumber(d))&&new Date(dateNumber(d)).toISOString().slice(0,10)===d;}
export const plusDays=(d,n)=>new Date(dateNumber(d)+n*DAY).toISOString().slice(0,10);
const diff=(a,b)=>Math.round((dateNumber(a)-dateNumber(b))/DAY);
export const settlementToday=(db,now=Date.now())=>db.settlement?.clock||localDate(now);
export function initSettlement(db){return db.settlement?db:{...db,settlement:{version:1,clock:null,rules:[],bindings:{},bills:[],tasks:[],audit:[],demoLoaded:false}};}
export function settlementSubjects(db){
 const customers=[...new Set(db.orders.filter(o=>!o.rescueParent).map(o=>o.customer))].map(name=>({id:'customer:'+name,name,direction:'receivable',kind:'客户'}));
 const partners=(db.partners||[]).map(p=>({id:'partner:'+p.id,name:p.name,direction:'payable',kind:p.type==='PARTNER_VEHICLE'?'合作个人／车辆':'合作单位'}));
 const drivers=(db.driverProfiles||[]).filter(d=>d.kind!=='partner').map(d=>({id:'driver:'+d.id,name:d.name,direction:'payable',kind:'司机'}));
 return [...customers,...partners,...drivers];
}
export function settlementSources(db,now=Date.now()){
 const today=settlementToday(db,now),atDate=v=>v?localDate(Date.parse(v)):today;
 const rows=db.orders.filter(o=>!o.financeManaged&&!o.rescueParent&&['delivered','closed_exception'].includes(o.status)).map(o=>{
  const paid=o.collection==='verified'?o.amountMinor:(o.settlementReceipts||[]).reduce((n,r)=>n+r.amountMinor,0);
  return {key:'order:'+o.id,subjectId:'customer:'+o.customer,ref:o.id,direction:'receivable',currency:'USD',amount:o.amountMinor,paid,held:o.settlementHold?.amountMinor||0,holdReason:o.settlementHold?.reason||'',date:o.settlementDate||atDate(o.events?.find(e=>/签收完成|异常结案|签收核验/.test(e.text))?.at||o.events?.[0]?.at),pending:o.collection==='reported'?Math.max(0,o.reportedMinor-paid):0,kind:'order',version:o.version,payment:o.payment};
 });
 for(const p of db.payables||[])rows.push({key:'payable:'+p.id,subjectId:'partner:'+p.partnerId,ref:p.id,direction:'payable',currency:'USD',amount:p.amountMinor,paid:p.paidMinor,held:p.status==='disputed'?p.amountMinor-p.paidMinor:0,pending:p.status==='pending'?p.amountMinor-p.paidMinor:0,date:atDate(p.at),kind:'payable',version:p.version});
 // Driver reminders point at the existing wallet; company payables never become driver earnings here.
 const paidByDriver={};for(const w of db.withdrawals||[])if(w.status==='paid')paidByDriver[w.driverId]=(paidByDriver[w.driverId]||0)+w.amountMinor;
 for(const x of db.earnings||[]){const paid=Math.min(x.driverMinor,paidByDriver[x.driverId]||0);paidByDriver[x.driverId]=(paidByDriver[x.driverId]||0)-paid;rows.push({key:'earning:'+x.id,subjectId:'driver:'+x.driverId,ref:x.id,direction:'payable',currency:'USD',amount:x.driverMinor,paid,held:0,pending:x.driverMinor-paid,date:atDate(x.at),kind:'earning',version:1});}
 return rows;
}
export const billToken=(db,b)=>JSON.stringify(billBalance(db,b).rows.map(r=>[r.key,r.version,r.amount,r.paid,r.held,r.pending]));
const integer=(v,min,max)=>Number.isInteger(+v)&&String(v).trim()!==''&&+v>=min&&+v<=max;
export function validateRule(p){
 check(['daily','weekly','monthly','interval','perOrder'].includes(p.cycle),'请选择有效结算周期','cycle');
 check(validDate(p.effective),'填写有效生效日期','effective');check(validDate(p.anchor),'填写有效周期锚点','anchor');
 const names={day:'每月截账日',weekday:'每周截账日',every:'周期天数',issueLag:'出账延迟',dueLag:'付款期限',before:'提前提醒天数',repeat:'逾期跟进间隔'};
 for(const [k,min,max] of [['day',1,31],['weekday',0,6],['every',1,90],['issueLag',0,60],['dueLag',0,90],['before',0,30],['repeat',1,30]])check(integer(p[k],min,max),`${names[k]}超出允许范围：${min}–${max} 的整数`,k);
 check(['last','skip'].includes(p.shortMonth),'请选择短月处理方式','shortMonth');check(p.owner?.trim()&&p.owner.length<=60,'填写财务负责人（最多60字）','owner');check(p.contact?.trim()&&p.contact.length<=100,'填写演示账单接收人（最多100字）','contact');
 return {cycle:p.cycle,effective:p.effective,anchor:p.anchor,day:+p.day,weekday:+p.weekday,every:+p.every,issueLag:+p.issueLag,dueLag:+p.dueLag,before:+p.before,repeat:+p.repeat,shortMonth:p.shortMonth,owner:p.owner.trim(),contact:p.contact.trim()};
}
export function scheduleFor(rule,date){
 check(validDate(date),'账项日期无效');let end=date;
 if(rule.cycle==='weekly')end=plusDays(date,(rule.weekday-new Date(dateNumber(date)).getUTCDay()+7)%7);
 if(rule.cycle==='interval'){check(date>=rule.anchor,'账项早于周期锚点');end=plusDays(rule.anchor,(Math.floor(diff(date,rule.anchor)/rule.every)+1)*rule.every-1);}
 if(rule.cycle==='monthly'){
  const d=new Date(dateNumber(date));let y=d.getUTCFullYear(),m=d.getUTCMonth();
  for(let i=0;i<14;i++){const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();if(rule.day<=last||rule.shortMonth==='last'){const candidate=new Date(Date.UTC(y,m,Math.min(last,rule.day))).toISOString().slice(0,10);if(candidate>=date){end=candidate;break;}}m++;}
 }
 const issue=plusDays(end,1+rule.issueLag),due=plusDays(issue,rule.dueLag);return {end,issue,due};
}
export function previewRule(rule,start){let date=start;return Array.from({length:3},()=>{const s=scheduleFor(rule,date);date=plusDays(s.end,1);return s;});}
export function billBalance(db,bill,now=Date.now()){
 const sources=settlementSources(db,now),rows=bill.keys.map(k=>sources.find(s=>s.key===k)).filter(Boolean);
 const amount=rows.reduce((n,s)=>n+s.amount,0),paid=rows.reduce((n,s)=>n+s.paid,0),remaining=amount-paid;
 const blocked=rows.reduce((n,s)=>n+Math.min(Math.max(0,s.amount-s.paid),s.held+s.pending),0);
 return {rows,amount,paid,remaining,blocked,collectible:Math.max(0,remaining-blocked),missing:rows.length!==bill.keys.length};
}
function synchronize(db,now){
 const s=db.settlement,today=settlementToday(db,now),sources=settlementSources(db,now);
 for(const x of sources){
  if(!s.bindings[x.key]){
   const r=s.rules.filter(r=>r.subjectId===x.subjectId&&r.effective<=x.date).at(-1);if(!r||x.date<r.anchor&&r.cycle==='interval')continue;
   const schedule=scheduleFor(r,x.date);s.bindings[x.key]={...schedule,rule:structuredClone(r)};
  }
  const binding=s.bindings[x.key];if(binding.issue>today)continue;
  const id=`${x.subjectId}|${binding.end}|${binding.issue}|${binding.due}|${binding.rule.cycle==='perOrder'?x.key:'batch'}|USD`;
  let bill=s.bills.find(b=>b.id===id);
  // Confirmed statements stay immutable; late source entries get a linked supplemental statement.
  const late=bill?.status==='confirmed'&&!bill.keys.includes(x.key);
  if(late)bill=s.bills.find(b=>b.id===id+'|'+x.key);
  if(!bill){bill={id:late?id+'|'+x.key:id,subjectId:x.subjectId,direction:x.direction,keys:[],end:binding.end,issue:binding.issue,due:binding.due,rule:structuredClone(binding.rule),status:'draft',sent:false,notices:[],version:1,supplementOf:late?id:null};s.bills.push(bill);}
  if(!bill.keys.includes(x.key)){bill.keys.push(x.key);bill.version++;}
 }
 const active=new Set();
 const task=(bill,stage,label,due)=>{const id=bill.id+'|'+stage;active.add(id);let t=s.tasks.find(t=>t.id===id);if(!t){t={id,billId:bill.id,stage,label,due,read:false,created:today};s.tasks.push(t);}t.done=false;};
 for(const b of s.bills){
  const balance=billBalance(db,b,now);
  if(b.status==='draft'){task(b,'issue','待出账',b.issue);continue;}
  if(balance.remaining<=0)continue;
  if(balance.missing||balance.blocked>0)task(b,'review','差异／待核验',b.due);
  if(b.direction==='payable'){if(today>=plusDays(b.due,-b.rule.before))task(b,'pay','待付款',b.due);continue;}
  if(!b.sent)task(b,'statement','待发送账单',b.issue);
  if(balance.collectible<=0)continue;
  if(today>b.due){
   const round=Math.floor((diff(today,b.due)-1)/b.rule.repeat),stage='collect:'+round;
   if(!b.notices.some(n=>n.stage===stage&&n.status==='simulated'))task(b,stage,'待催收',plusDays(b.due,1+round*b.rule.repeat));
  }else if(today>=plusDays(b.due,-b.rule.before))task(b,'receive','待收款',b.due);
 }
 for(const t of s.tasks)if(!active.has(t.id))t.done=true;
 s.lastChecked=today;
}
export function checkSettlements(db,now=Date.now()){
 const next=structuredClone(initSettlement(db));synchronize(next,now);
 if(JSON.stringify(next.settlement)===JSON.stringify(db.settlement))return db;
 next.settlement.version++;return next;
}
const cents=v=>{check(typeof v==='string'&&/^\d+(\.\d{1,2})?$/.test(v),'金额须为非负数，最多两位小数','amount');const n=Math.round(Number(v)*100);check(Number.isSafeInteger(n)&&n<=100000000,'金额超出原型范围');return n;};
export function applySettlement(db,c,now=Date.now()){
 check(c.role==='finance','仅财务工作席可操作结算');check(c.key&&typeof c.key==='string','缺少幂等键');
 const fingerprint=JSON.stringify([c.action,c.id,c.payload]);const prev=db.requests[c.key];if(prev){check(prev.fingerprint===fingerprint,'幂等键冲突');return db;}
 const next=structuredClone(initSettlement(db)),s=next.settlement,p=c.payload||{},today=settlementToday(next,now);
 check(c.version===s.version,'结算数据已变化，请重新打开确认');
 if(c.action==='settlementRule'){
  check(settlementSubjects(next).some(x=>x.id===c.id),'结算主体不存在');const r=validateRule(p);
  synchronize(next,now);s.rules.push({...r,subjectId:c.id,id:c.key,version:s.rules.filter(r=>r.subjectId===c.id).length+1});
 }else if(c.action==='settlementClock'){
  check(validDate(p.date)&&p.date>=today,'演示日期只能向前推进');check(p.confirmed,'请确认这是模拟日期');s.clock=p.date;
 }else if(c.action==='settlementDemo'){
  check(p.confirmed,'请确认加载合成样例');check(!s.demoLoaded,'样例已经加载，不会重复添加');
  const date=plusDays(today,-12),template=next.orders.find(o=>!o.rescueParent);check(template,'需要至少一笔原型订单作为样例模板');
  for(const [i,name,amount] of [[1,'SET-DEMO · 周结客户',12000],[2,'SET-DEMO · 月结客户',18000]]){
   const id='SET-DEMO-00'+i;check(!next.orders.some(o=>o.id===id),'样例编号冲突');
   next.orders.push({...structuredClone(template),id,customer:name,status:'delivered',payment:'transfer',vehicle:null,fulfillmentMode:'OWN_FLEET',partnerId:null,booking:null,amount:amount/100,amountMinor:amount,baseAmountMinor:amount,insuranceFeeMinor:0,flashFeeMinor:0,distanceQuote:null,serviceType:'standard',collection:'due',reportedMinor:0,collectionProof:'',remittance:'open',received:template.qty,custody:'演示收货人',settlementDate:date,settlementDemo:true,settlementReceipts:[],settlementHold:null,financeEvidence:'',version:1,events:[{at:date+'T12:00:00+07:00',role:'财务',text:'合成已履约月结样例，仅验证账期；非真实月结批准'}]});
   s.rules.push({...validateRule({cycle:i===1?'weekly':'monthly',effective:plusDays(date,-31),anchor:plusDays(date,-31),day:31,weekday:0,every:7,issueLag:0,dueLag:3,before:2,repeat:3,shortMonth:'last',owner:'演示财务',contact:'演示客户联系人'}),subjectId:'customer:'+name,id:c.key+':'+i,version:1});
  }
  const partner=next.partners[0];if(partner){next.payables.push({id:'SET-DEMO-P01',partnerId:partner.id,orderId:'SET-DEMO-001',amountMinor:7200,paidMinor:0,status:'verified',version:1,entries:[],events:[],at:date+'T12:00:00+07:00',agreement:'DEMO-SETTLEMENT'});s.rules.push({...s.rules.at(-2),subjectId:'partner:'+partner.id,id:c.key+':partner',cycle:'weekly'});}
  s.demoLoaded=true;
 }else if(c.action==='settlementRead'){
  const t=s.tasks.find(t=>t.id===c.id);check(t,'通知不存在');t.read=true;
 }else if(c.action!=='settlementCheck'){
  const b=s.bills.find(b=>b.id===c.id);check(b,'账单不存在');let balance=billBalance(next,b,now);check(!balance.missing,'账项缺失，请先核查');
  if(['settlementConfirm','settlementSend','settlementCollect','settlementHold'].includes(c.action))check(p.sourceToken===billToken(next,b),'原账项已变化，请重新打开核对');
  if(c.action==='settlementConfirm'){check(b.status==='draft'&&p.confirmed,'请核对明细后确认账单');b.status='confirmed';b.confirmedAt=today;b.snapshot=balance.rows.map(x=>({...x}));}
  else if(c.action==='settlementSend'){
   check(b.status==='confirmed'&&p.confirmed,'须确认账单和发送内容');check(b.direction==='receivable','应付不能发送客户催收单');
   const stage=p.stage==='statement'?'statement':s.tasks.find(t=>t.billId===b.id&&!t.done&&t.stage===p.stage&&t.stage.startsWith('collect:'))?.stage;
   check(stage,'催收任务已变化，请重新检查');check(balance.collectible>0,'无可发送的未结余款，请核验到账或争议');
   check(!b.notices.some(n=>n.stage===stage&&n.status==='simulated'),'该阶段已模拟发送');
   const failed=p.failure===true;b.notices.push({id:c.key,stage,status:failed?'failed':'simulated',at:today,amountMinor:balance.collectible,contact:b.rule.contact});if(!failed&&stage==='statement')b.sent=true;
  }else if(c.action==='settlementCollect'||c.action==='settlementHold'){
   check(b.status==='confirmed'&&b.direction==='receivable','仅处理已确认客户账单');const row=balance.rows.find(x=>x.ref===p.orderId);check(row,'请选择本账单订单');const o=next.orders.find(o=>o.id===row.ref);check(o&&o.payment==='transfer','现金请在财务核验原入口处理');const amount=cents(p.amount);
   if(c.action==='settlementHold'){check(amount<=row.amount-row.paid,'暂缓金额不能超过未结额');check(p.evidence?.trim(),'填写暂缓或解除依据');o.settlementHold={amountMinor:amount,reason:p.evidence.trim()};}
   else{check(p.confirmed&&amount>0&&amount<=row.amount-row.paid,'核验金额须大于零且不超过未结额');check(p.evidence?.trim(),'填写演示银行核验凭证');check(!next.orders.some(x=>(x.settlementReceipts||[]).some(r=>r.proof===p.evidence.trim())||x.financeEvidence===p.evidence.trim()),'银行凭证已经核销');
    check(o.collection!=='reported','已有待核款，请从原财务核验入口处理');
    (o.settlementReceipts??=[]).push({amountMinor:amount,proof:p.evidence.trim(),at:today});const total=o.settlementReceipts.reduce((n,r)=>n+r.amountMinor,0);o.reportedMinor=total;o.collection=total===o.amountMinor?'verified':'mismatch';o.financeEvidence=p.evidence.trim();if(o.settlementHold)o.settlementHold.amountMinor=Math.min(o.settlementHold.amountMinor,o.amountMinor-total);
   }
   o.version++;o.events.push({at:new Date(now).toISOString(),role:'财务',text:c.action==='settlementCollect'?`账期收款核验 USD ${(amount/100).toFixed(2)}（模拟）`:'更新催收暂缓范围'});
  }else throw Error('未知结算动作');b.version++;
 }
 synchronize(next,now);s.version++;s.audit.push({action:c.action,target:c.id||'',at:new Date(now).toISOString(),actor:c.accessSession?.accountId||'finance',key:c.key});next.requests[c.key]={fingerprint};return next;
}
