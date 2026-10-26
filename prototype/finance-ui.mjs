import {validDate} from './settlement-model.mjs';
import {formField as field,showToast as notify} from './ui-primitives.mjs';
import {seed,initialize} from './model.mjs';
import {initFinance,applyFinance,financeProjection,financeInternal,financialOrder,formatMoney,amountMinor,lineTotal,lineDue,linePaid,receiptFree,paymentReserved,balances,purposeNames} from './finance-ledger.mjs';
const KEY='routefit-r1-prototype-v1',root=document.querySelector('#finance-app'),dialog=document.querySelector('#finance-dialog');
let db;try{db=initialize(JSON.parse(sessionStorage.getItem(KEY))||seed());}catch{db=seed();}db=initFinance(db);
const params=new URLSearchParams(location.search),ui={actor:params.get('actor')||'F01',tab:params.get('tab')||'tasks',query:params.get('q')||'',currency:params.get('currency')||'USD',page:1,detail:null,detailTab:'summary',report:params.get('report')||'detail',asOf:params.get('asOf')||'2026-10-24'};
if(!db.financeLedger.actors.some(a=>a.id===ui.actor))ui.actor='F01';if(!['USD','KHR'].includes(ui.currency))ui.currency='USD';if(!validDate(ui.asOf))ui.asOf='2026-10-24';
let spec=null,dirty=false,busy=false,opener=null,timer;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>formatMoney(n,ui.currency),f=()=>db.financeLedger,actor=()=>f().actors.find(a=>a.id===ui.actor),byActor=id=>f().actors.find(a=>a.id===id)?.name||id||'待处理';
const status={WAITING:'模拟待支付',SUCCESS:'模拟渠道收款成功 · 待核销／结算',CLOSED:'模拟已关闭',FAILED:'模拟渠道确认失败',UNKNOWN:'模拟结果未知 · 查询原单',draft:'待提交',submitted:'待复核',reviewed:'待审批',approved:'已审批 · 待处理',processing:'执行已登记 · 待核对',unknown:'结果未知 · 禁止重复付款',failed:'确认失败 · 原记录保留',confirmed:'资金已确认 · 待核销',posted:'处理完成',rejected:'已退回',reported:'已申报 · 待核验'};
const elapsed=at=>at?`${Math.max(0,Math.floor((Date.now()-Date.parse(at))/60000))} 分钟`:'待核实';
const kinds={allocation:'收款核销',payment:'付款／提现',refund:'退款',adjustment:'费用补差',reversal:'撤销核销',account:'收款账户变更',payable:'履约费用核定',handover:'现金交接批次',recovery:'差额补交'};
const button=(label,action,id='',cls='')=>`<button class="btn ${cls}" data-fin-action="${action}" data-id="${e(id)}">${e(label)}</button>`;
const pill=s=>`<span class="pill ${['posted','confirmed'].includes(s)?'success':['unknown','reported','submitted'].includes(s)?'warning':'info'}">${e(status[s]||s)}</span>`;
const select=(name,label,rows,value)=>`<label class="field"><span>${e(label)}</span><select name="${name}" aria-describedby="fin-error">${rows.map(([id,title])=>`<option value="${e(id)}" ${id===value?'selected':''}>${e(title)}</option>`).join('')}</select></label>`;
const detailButton=(type,id,label='查看明细')=>`<button class="btn small" data-fin-detail="${type}:${e(id)}">${label}</button>`;
function save(){sessionStorage.setItem(KEY,JSON.stringify(db));}
function url(){const p=new URLSearchParams({actor:ui.actor,tab:ui.tab,currency:ui.currency,report:ui.report,asOf:ui.asOf});if(ui.query)p.set('q',ui.query);history.replaceState(null,'',`?${p}`);}
function tools(){return `<div class="fin-filters"><form id="fin-search" novalidate><label class="sr-only" for="fin-query">搜索单号、状态或对象</label><input id="fin-query" name="query" placeholder="搜索单号、状态或对象" value="${e(ui.query)}"><button class="btn">搜索</button>${ui.query?'<button type="button" class="btn" id="fin-clear">清空</button>':''}</form><label>币种 <select id="fin-currency"><option ${ui.currency==='USD'?'selected':''}>USD</option><option ${ui.currency==='KHR'?'selected':''}>KHR</option></select></label><button class="btn" id="fin-export">导出当前明细 CSV</button></div>`;}
let exportRows=[],exportHeaders=[];
function table(headers,rows){exportHeaders=headers;
 const filtered=rows.filter(r=>r.join(' ').toLowerCase().includes(ui.query.toLowerCase()));exportRows=filtered.map(r=>r.map(s=>String(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()));const pages=Math.max(1,Math.ceil(filtered.length/8));ui.page=Math.min(ui.page,pages);
 return `<div class="table-wrap fin-table"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${filtered.slice((ui.page-1)*8,ui.page*8).map(r=>`<tr>${r.map((c,i)=>`<td data-label="${e(headers[i])}">${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}"><div class="status-panel"><h2>暂无匹配记录</h2><p>可清空搜索、切换币种，或加载合成案例开始演示。</p></div></td></tr>`}</tbody></table></div><div class="fin-pages"><span>共 ${filtered.length} 项 · 第 ${ui.page} / ${pages} 页</span><div class="actions"><button class="btn" data-page="${ui.page-1}" ${ui.page<=1?'disabled':''}>上一页</button><button class="btn" data-page="${ui.page+1}" ${ui.page>=pages?'disabled':''}>下一页</button></div></div>`;
}
function docActions(d){
 const a=actor(),mine=d.makerPerson===a.personId;let out='';
 if(d.state==='draft'&&mine)out+=button('提交复核','submit',d.id,'primary');
 if(d.state==='submitted'&&a.role==='reviewer')out+=button('复核通过','review',d.id,'primary');
 if(d.state==='reviewed'&&a.role==='approver')out+=button('批准本版本','approve',d.id,'primary');
 if(['submitted','reviewed'].includes(d.state)&&['reviewer','approver'].includes(a.role))out+=button('退回','reject',d.id);
 if(['draft','submitted','reviewed','approved','rejected'].includes(d.state)&&mine&&!['handover','recovery'].includes(d.kind))out+=button('修订并重新审核','revise',d.id);
 if(d.state==='approved'&&['payment','refund'].includes(d.kind)&&a.role==='cashier')out+=button('登记人工付款','execute',d.id,'primary');
 if(['processing','unknown'].includes(d.state)&&a.role==='checker')out+=button('核对资金结果','paymentResult',d.id,'primary');
 if((d.state==='confirmed'||d.state==='approved'&&!['payment','refund'].includes(d.kind))&&a.role==='checker')out+=button('完成核销／入账','post',d.id,'primary');
 return out;
}
function summary(p){const lines=p.lines.filter(l=>l.currency===ui.currency),ar=lines.filter(l=>l.direction==='in'),ap=lines.filter(l=>l.direction==='out'),b=balances(f(),ui.currency),a=actor();let cells;
 if(financeInternal(a))cells=[['客户还没付',ar.reduce((n,l)=>n+lineDue(f(),l),0),'包括配送、保险和代收，展开可分项'],['我们还没付',ap.reduce((n,l)=>n+lineDue(f(),l),0),'含商户返款、合作运费和司机收入'],['司机持有现金',b.driver,'已确认现金减已点收批次申报额'],['交款差额待查',b.unresolved,'不认定责任，不自动扣司机收入']];
 else if(a.role==='driver')cells=[['持有待交现金',b.driver,'运费与货款一起保管，分项归属'],['我的收入待付',ap.reduce((n,l)=>n+lineDue(f(),l),0),'不把代收货款计作收入']];
 else if(a.role==='customer')cells=[['我的未结费用／代收',ar.reduce((n,l)=>n+lineDue(f(),l),0),'部分付款不标成金额差错'],['已确认付款',p.receipts.filter(r=>r.currency===ui.currency&&r.state==='confirmed').reduce((n,r)=>n+r.amount,0),'到账与核销分开，不重复收取']];
 else if(a.role==='carrier')cells=[['合作运费待结',ap.reduce((n,l)=>n+lineDue(f(),l),0),'按承运协议及实际履约核对']];
 else if(a.role==='merchant')cells=[['货款待返还',ap.reduce((n,l)=>n+lineDue(f(),l),0),'由已确认且已归属的代收生成'],['货款尚未收齐',ar.reduce((n,l)=>n+lineDue(f(),l),0),'未收不算公司已持款']];
 else cells=[['本仓服务收费依据',ar.filter(l=>l.purpose!=='cod').reduce((n,l)=>n+l.amount,0),'只展示费用依据，不授予收付款权限'],['本仓订单',p.orders.filter(o=>o.currency===ui.currency).length,'履约与财务独立，不能因核销改签收']];
 return `<div class="fin-summary">${cells.map(([title,n,desc])=>`<article><span>${title}</span><strong>${title==='本仓订单'?n:money(n)}</strong><small>${desc}</small></article>`).join('')}</div>`;
}
function orderRows(p){return p.orders.filter(o=>o.currency===ui.currency).map(o=>{const lines=p.lines.filter(l=>l.orderId===o.id),ar=lines.filter(l=>l.direction==='in'),ap=lines.filter(l=>l.direction==='out');const due=ar.reduce((n,l)=>n+lineDue(f(),l),0),owed=ap.reduce((n,l)=>n+lineDue(f(),l),0);return [e(o.id)+`<small>${e(o.customer)}</small>`,`${e(o.cargo)} · ${o.qty} 件<small>${o.status==='delivered'?'已签收':'履约进行中'} · 仓 ${e(o.warehouseId)}</small>`,lines.map(l=>`${l.direction==='in'?'应收':'应付'} ${purposeNames[l.purpose]} ${money(lineTotal(f(),l))}${lineTotal(f(),l)!==l.amount?'（含已批调整）':''}`).join('<br>'),`${ar.length?'应收未结 '+money(due):''}${ap.length?'<br>应付未结 '+money(owed):''}<small>${due===0&&owed===0?'可见账项已全额核销':'仍有未结，查看下一动作'}</small>`,detailButton('order',o.id,'看流向与明细')];});}
function detail(p){
 const [type,...rest]=ui.detail.split(':'),id=rest.join(':');let body='';
 if(type==='order'){
  const o=p.orders.find(o=>o.id===id);if(!o)return '<p>对象不存在或不可访问</p>';const lines=p.lines.filter(l=>l.orderId===id),ids=new Set(lines.map(l=>l.id)),allocs=p.allocations.filter(x=>ids.has(x.lineId));
  const tabs=[['summary','业务与费用'],['funds','资金流向'],['evidence','凭证与审批']];
  body=`<h2>${e(o.id)}</h2><p>${e(o.customer)} · ${e(o.cargo)} · ${o.status==='delivered'?'货已签收，账务独立':'履约进行中'}。${o.financeTerms==='approved_credit'?'本例为获批月结，不取消预付派单规则。':'预付须完成资金归属与核销后放行。'}</p><div class="fin-tabs">${tabs.map(([k,t])=>`<button class="btn ${ui.detailTab===k?'primary':''}" data-detail-tab="${k}" aria-pressed="${ui.detailTab===k}">${t}</button>`).join('')}</div>`;
  if(ui.detailTab==='summary')body+=table(['费用／往来','来源','原额','已核销','未结'],lines.map(l=>[`${l.direction==='in'?'应收':'应付'} · ${purposeNames[l.purpose]}`,e(l.source),`${money(l.amount)}${lineTotal(f(),l)!==l.amount?`<small>已批调整 ${money(lineTotal(f(),l)-l.amount)}；核定 ${money(lineTotal(f(),l))}</small>`:''}`,money(linePaid(f(),l)),money(lineDue(f(),l))]));
  if(ui.detailTab==='funds')body+=`<div class="fin-chain"><article><small>业务来源</small><strong>订单 → 费用与受益方</strong>${lines.map(l=>`${l.direction==='in'?'应收':'应付'} ${purposeNames[l.purpose]} · ${e(l.subject)} · ${money(lineTotal(f(),l))}`).join('<br>')}</article><article><small>已确认分配</small><strong>资金 → 本单核销</strong>${allocs.length?allocs.map(x=>`${e(x.receiptId||x.documentId)} → ${money(x.amount)}`).join('<br>'):'尚未核销；没有证据不补画资金链'}</article><article><small>未完成事项</small><strong>逐项余额</strong>${lines.map(l=>`${purposeNames[l.purpose]} · 未结 ${money(lineDue(f(),l))}`).join('<br>')}</article></div><p class="info-box">银行余额、司机保管和商户负债是不同维度，不能相加。流向展示业务分配与保管证据，不追踪纸币或收款人之后的外部交易。</p>`;
  if(ui.detailTab==='funds'&&['maker','reviewer','approver','checker','cashier','manager','driver'].includes(actor().role)){const receiptIds=new Set(allocs.map(x=>x.receiptId));const hands=p.handovers.filter(h=>(h.items||[]).some(x=>receiptIds.has(x.receiptId)));body+=`<h3>关联现金交接批次</h3>${hands.length?hands.map(h=>`<div class="info-box">${e(h.id)} · 原申报 ${formatMoney(h.amount,h.currency)} · 公司点收 ${h.counted===undefined?'待核实':formatMoney(h.counted,h.currency)}<br>来源：${h.items.map(x=>`${e(x.receiptId)} ${formatMoney(x.amount,h.currency)}`).join('；')}<br>交款凭证 ${e(h.evidence)} · 点收证据 ${e(h.countEvidence||'待核实')}<br>后续补交：${p.handovers.filter(x=>x.recoveryOf===h.id).map(x=>`${e(x.id)} · ${formatMoney(x.counted,x.currency)} · ${e(x.countEvidence)}`).join('；')||'暂无已审批补交'}<br>批次差额不擅自分摊到运费或COD，原点收不覆盖。</div>`).join(''):'<p>尚未形成关联交接批次；转账直接到公司，不产生司机交款。</p>'}`;}
  if(ui.detailTab==='evidence')body+=table(['核销记录','金额','凭证来源','审核单'],allocs.map(x=>{const r=p.receipts.find(r=>r.id===x.receiptId);return [e(x.id),money(x.amount),e(r?.evidence||'按权限查看资金来源'),financeInternal(actor())?detailButton('doc',x.documentId,'看审核链'):e(x.documentId)];}));
 }else if(type==='doc'){
  const d=p.documents.find(x=>x.id===id);if(!d)return '<p>对象不存在或不可访问</p>';
  body=`<div class="fin-heading"><div><h2>${kinds[d.kind]} · ${e(d.id)}</h2><p>${e(d.reason)}</p></div>${pill(d.state)}</div><h2>${formatMoney(d.amount,d.currency)}</h2>`;
  if(financeInternal(actor()))body+=`<p>当前版本 v${d.version} · 账户版本 ${d.accountVersion||'不涉及'} ${d.accountSnapshot?'· 尾号 '+e(d.accountSnapshot.last4):''}。关键内容修改后原复核审批失效。</p><div class="fin-approval"><div><small>经办</small>${e(byActor(d.maker))}</div><div><small>独立复核</small>${e(byActor(d.reviewer))}</div><div><small>独立审批</small>${e(byActor(d.approver))}</div></div>${d.items?table(['目标账项','本次分配'],d.items.map(x=>[e(x.lineId),formatMoney(x.amount,d.currency)])):''}<div class="actions">${docActions(d)}</div><ul class="fin-timeline">${d.history.map(h=>`<li><strong>${e(h.action)} · v${h.version}</strong><br>${e(byActor(h.actor))} · ${e(h.at)}<br>${e(h.evidence)}</li>`).join('')||'<li>草稿尚未提交，未改变任何资金余额。</li>'}</ul>`;
  if(!financeInternal(actor()))body+=`<div class="actions">${docActions(d)}</div><p>只显示本主体申请与结果，内部账户及其他主体成本不公开。</p>`;
 }return `<button class="btn" id="fin-back">← 返回原列表</button><section class="panel fin-panel">${body}</section>`;
}
function render(){
 const p=financeProjection(db,ui.actor),a=p.actor,internal=financeInternal(a);if(!internal&&!['orders','receipts','cash','reports','documents'].includes(ui.tab))ui.tab='orders';
 const tabs=internal?[['tasks','今日待办'],['orders','订单与往来'],['receipts','收款与核销'],['documents','付款与审批'],['cash','交款与差异'],['reports','财务报表']]:a.role==='driver'?[['orders','我的订单'],['receipts','收款申报'],['cash','现金交款'],['documents','收入与提现'],['reports','我的报表']]:a.role==='customer'?[['orders','费用与订单'],['receipts','付款与退款'],['documents','申请进度'],['reports','我的账单']]:['merchant','carrier'].includes(a.role)?[['orders',a.role==='merchant'?'代收订单':'合作运单'],['documents','返款进度'],['reports','商户对账单']]:[['orders','出入仓订单'],['documents','费用申请进度'],['reports','仓库作业报表']];
 if(!tabs.some(([k])=>k===ui.tab))ui.tab=tabs[0][0];url();let content='';exportRows=[];
 if(ui.detail)content=detail(p);
 else{
  let actions='',body='';
  if(ui.tab==='tasks'){
   const rows=[];
   for(const r of p.receipts.filter(r=>r.currency===ui.currency&&r.state==='reported'))rows.push([e(r.id),'收款待确认',`${money(r.amount)}<small>等待 ${elapsed(r.at)}</small>`,'资金核对员','核对交易、账户、金额与币种',a.role==='checker'?button('确认资金事实','confirmReceipt',r.id):'<span class="muted">切换独立资金核对员处理</span>']);
   for(const d of p.documents.filter(d=>d.currency===ui.currency&&!['posted','rejected','failed'].includes(d.state)))rows.push([e(d.id),`${kinds[d.kind]} · ${pill(d.state)}`,`${money(d.amount)}<small>等待 ${elapsed(d.createdAt)}</small>`,d.state==='draft'?e(byActor(d.maker)):d.state==='submitted'?'独立复核人':d.state==='reviewed'?'独立审批人':d.state==='approved'&&['payment','refund'].includes(d.kind)?'付款执行人':'资金核对员','查看当前版本及逐项证据',detailButton('doc',d.id,'进入处理')]);
   for(const h of p.handovers.filter(h=>h.currency===ui.currency&&h.counted===undefined))rows.push([e(h.id),'司机交款待点收',`${money(h.amount)}<small>等待 ${elapsed(h.at)}</small>`,'资金核对员','申报不等于公司实收',a.role==='checker'?button('登记实际点收','count',h.id):'等待独立点收']);
   for(const l of p.lines.filter(l=>l.currency===ui.currency&&lineDue(f(),l)>0)){const remaining=lineDue(f(),l);if(l.direction==='out'&&paymentReserved(f(),l)>=remaining)continue;rows.push([e(l.orderId),l.direction==='in'?'客户／代收款待收齐':'履约应付待结算',money(remaining),l.direction==='in'?'经办跟进收款':'经办／受益方申请',`${purposeNames[l.purpose]} · 合同到期 ${l.due}`,detailButton('order',l.orderId,'查看费用与流向')]);}
   for(const r of p.receipts.filter(r=>r.currency===ui.currency&&r.state==='confirmed'&&receiptFree(f(),r)>0))rows.push([e(r.id),'到账待归属／核销',money(receiptFree(f(),r)),'经办制单','保留来源，不能自动当收入',a.role==='maker'?button('核销制单','newAllocation',r.id):'待经办选择账项']);
   for(const i of p.issues.filter(i=>i.currency===ui.currency&&i.state==='open'))rows.push([e(i.id),'交款差额待查',money(i.amount),e(byActor(i.owner)),e(i.reason),a.role==='checker'?button('登记补交审核','recover',i.id):'查看交款与差异']);
   if(a.role==='maker'&&!f().loaded)actions=button('加载三笔合成订单','load','','primary');
   body=table(['业务编号','待办原因','金额','下一负责人','下一步','处理'],rows);
  }else if(ui.tab==='orders'){
   body=table(['订单／客户','履约与仓库','费用组成','未结','操作'],orderRows(p));if(a.role==='maker')actions=button('纳入已有未收款订单','enroll');if(a.role==='warehouse')actions=button('提交仓库费用依据','newAdjustment');
  }else if(ui.tab==='receipts'){
   if(['maker','driver','customer'].includes(a.role))actions=button(a.role==='driver'?'申报收取现金':a.role==='customer'?'登记付款凭证':'登记收款申报','receipt','','primary');
   if(['maker','customer'].includes(a.role))actions+=p.orders.some(o=>o.currency===ui.currency)?button('模拟 KESS 付款','kessCreate'):'<button class="btn" disabled aria-describedby="kess-stage">模拟 KESS 付款</button>';
   if(a.role==='maker')actions+=button('一款多单核销制单','newAllocation');
   if(a.role==='customer'||a.role==='maker')actions+=button('申请退回未分配款','newRefund');
   body=table(['收款编号／证据','方式／保管','已确认状态','金额','待分配／操作'],p.receipts.filter(r=>r.currency===ui.currency).map(r=>[`${e(r.id)}<small>${e(r.evidence||'限定可见的本商户分配')}</small>`,r.method?`${r.method==='cash'?'现金':r.method==='kess'?'KESS 渠道待结算':'公司银行'} · ${e(r.custodian)}`:'按授权显示归属',pill(r.state),money(r.amount),`${r.state==='confirmed'?money(receiptFree(f(),r)):'尚未确认'}<br>${r.state==='reported'&&a.role==='checker'?button('核对到账','confirmReceipt',r.id):''}`]));
   const intents=p.paymentIntents.filter(x=>x.currency===ui.currency);body=`${internal||a.role==='customer'?`<section class="info-box" id="kess-stage" aria-labelledby="kess-stage-title"><strong id="kess-stage-title">KESS 商户尚未开通 · 真实付款未开放</strong><p>当前可演示付款流程，不会扣款，也不会打开真实收银台。${p.orders.some(o=>o.currency===ui.currency)?'请选择本人的配送订单开始模拟。':'当前币种暂无演示订单，请先由财务工作席加载合成案例或切换币种。'}</p><details class="fin-payment-help"><summary>付款演示说明</summary><ol><li>选择“模拟 KESS 付款”，核对配送费与保险费；金额来自订单，不能手填。</li><li>选择“模拟查询结果”测试待支付、结果未知、失败或成功；结果未知时继续查原单。</li><li>模拟成功只生成一笔渠道收款，财务仍需核销制单、独立复核、独立审批及核销。</li></ol><p>保险单独记账，不参与配送费分成；本支付单不收 COD。渠道收款不等于公司银行到账，也不等于配送已完成。</p><p>请勿填写真实支付密码、银行卡或商户密钥。模拟记录只保存在当前浏览器标签页。</p>${internal?'<p>接入准备：现有模拟与服务端适配已备；商户测试资料、真实联调、回调与银行对账仍待完成。开户不代表自动上线。</p>':''}</details></section>`:''}${intents.map(x=>`<article class="info-box"><strong>${e(x.orderId)} · ${money(x.amount)}</strong><p>${e(x.id)} · ${pill(x.state)}</p><p>${x.items.map(item=>`${purposeNames[f().lines.find(l=>l.id===item.lineId)?.purpose]||'费用'} ${money(item.amount)}`).join(' + ')}</p>${['maker','customer','checker'].includes(a.role)&&!['SUCCESS','CLOSED','FAILED'].includes(x.state)?button('模拟查询结果','kessQuery',x.id):''}${x.receiptId?`<p>模拟收款凭据 ${e(x.receiptId)}。${internal?'去核销制单选择对应账项；未自动审批。':'等待财务核销；当前没有真实扣款。'}</p>`:''}</article>`).join('')}`+body;
  }else if(ui.tab==='documents'){
   if(['maker','driver','merchant','carrier'].includes(a.role))actions=button(a.role==='driver'?'申请收入提现':a.role==='merchant'?'申请商户返款':'申请结算付款','newPayment','','primary');
   if(a.role==='maker')actions+=button('核定履约应付','newPayable')+button('费用补差／减免','newAdjustment')+button('撤销错误核销','newReversal')+button('收款账户变更','newAccount');
   body=table(['单据','理由／来源','金额','状态','操作'],p.documents.filter(d=>d.currency===ui.currency).map(d=>[`${e(d.id)}<small>${kinds[d.kind]}</small>`,`${e(d.reason)}<small>${e(d.lineId||d.receiptId||d.handoverId||'')}</small>`,money(d.amount),pill(d.state),detailButton('doc',d.id,'查看处理')]));
  }else if(ui.tab==='cash'){
   if(a.role==='driver')actions=button('申报交回现金','handover','','primary');
   body=table(['交款批次','申报金额','公司点收','待查差额','操作'],p.handovers.filter(h=>h.currency===ui.currency).map(h=>[`${e(h.id)}<small>${e(h.evidence||h.countEvidence)}${h.recoveryOf?' · 差额补交':''}</small>`,money(h.amount),h.counted===undefined?'待点收':money(h.counted),h.counted===undefined?'尚未核对':money(Math.max(0,h.amount-h.counted)),h.counted===undefined&&a.role==='checker'?button('登记实际点收','count',h.id):'保管事实已记录']));
   body+=`<h3>差额处理</h3>${p.issues.filter(i=>i.currency===ui.currency).map(i=>`<div class="info-box warning">${e(i.id)} · ${money(i.amount)} · ${e(i.reason)} · ${i.state==='resolved'?'已补交并审核':`待查 ${a.role==='checker'?button('登记差额补交审核','recover',i.id):''}`}</div>`).join('')||'<p>暂无可见差额。</p>'}`;
  }else{
   const b=balances(f(),ui.currency),lines=p.lines.filter(l=>l.currency===ui.currency);
   body=`<p class="info-box">只统计已纳入新版闭环的订单。当前为 ${ui.currency}；不同币种及保管／负债指标不能直接相加。业务日期 2026-10-24（演示）；已签收不代表已结清。</p>`;
   if(internal)body+=`<p class="info-box">KESS 商户尚未开通 · 模拟数据<br>KESS 渠道待结算：<strong>${money(b.channel)}</strong>。此金额不计入公司保管或可付余额；渠道清算与银行到账核对尚未接通。</p><div class="fin-chain"><article><small>公司已确认保管余额</small><strong>${money(b.company)}</strong>来源：核验收款＋点收－已确认出款</article><article><small>尚在付款占用</small><strong>${money(b.reserved)}</strong>包括处理中及未知结果</article><article><small>账户余额核对</small><strong>未接银行实时余额</strong>仅展示有证据的演示账务余额</article></div>`;
   body+=`<div class="fin-filters"><label class="field"><span>报表口径</span><select id="fin-report"><option value="detail" ${ui.report==='detail'?'selected':''}>账项明细</option><option value="aging" ${ui.report==='aging'?'selected':''}>未结账龄</option></select></label><label class="field"><span>账龄观察日（只改变分析，不回写账期）</span><input id="fin-asof" type="date" value="${e(ui.asOf)}"></label></div>`;
   if(ui.report==='aging'){const buckets=[['未到期／当天',{in:0,out:0}],['逾期1–7天',{in:0,out:0}],['逾期8–30天',{in:0,out:0}],['逾期31天以上',{in:0,out:0}]];for(const l of lines){const days=Math.floor((Date.parse(ui.asOf+'T00:00:00Z')-Date.parse(l.due+'T00:00:00Z'))/86400000);buckets[days<=0?0:days<=7?1:days<=30?2:3][1][l.direction]+=lineDue(f(),l);}body+=`<div class="fin-summary">${buckets.map(([name,amount])=>`<article><span>${name}</span><strong>${money(amount.in)}</strong><small>未结应收</small><strong>${money(amount.out)}</strong><small>未结应付 · 两方向不相加</small></article>`).join('')}</div>`;}
   body+=table(['业务来源','用途／方向','原额／批准调整','已核销','未结／到期'],lines.map(l=>[`${e(l.orderId)}<small>${e(l.source)}</small>`,`${purposeNames[l.purpose]} · ${l.direction==='in'?'应收':'应付'}`,`${money(l.amount)}${lineTotal(f(),l)!==l.amount?`<small>已批调整 ${money(lineTotal(f(),l)-l.amount)}；核定 ${money(lineTotal(f(),l))}</small>`:''}`,money(linePaid(f(),l)),`${money(lineDue(f(),l))}<small>合同到期 ${l.due}</small>`]));
   body+='<p class="muted">保险费不参与配送费分成；司机交款不重复计收款；配送收费减运输费用不是净利润。导出为当前币种与筛选明细，非会计凭证或正式税务报表。</p>';
  }
  content=`${summary(p)}<div class="fin-heading"><h2>${tabs.find(([k])=>k===ui.tab)?.[1]}</h2><div class="actions">${actions}</div></div>${tools()}<section class="panel fin-panel">${body}</section>`;
 }
 root.innerHTML=`<div class="fin-shell ${internal?'':'fin-app-view'}"><aside class="fin-nav"><img src="../brand/logo/routefit-horizontal-mono-white.svg" alt="DR RouteFit">${tabs.map(([k,t])=>`<button data-fin-tab="${k}" class="${ui.tab===k?'active':''}" aria-current="${ui.tab===k?'page':'false'}">${t}</button>`).join('')}<a href="./index.html#${a.role==='driver'?'driver':a.role==='warehouse'?'warehouse':a.role==='customer'?'customer':'finance'}">← 配送工作台</a><a href="./finance-design.html">查看跨端设计图</a><p class="fin-note">同一订单 · 同一资金来源<br>角色切换仅用于原型评审<br>没有真实银行或消息操作</p></aside><main class="fin-main"><header class="fin-toolbar"><strong>DR 仓配 / ${internal?'财务工作席':'订单与账款'}</strong><label>演示身份<select id="fin-actor" aria-label="演示身份">${f().actors.map(a=>`<option value="${a.id}" ${ui.actor===a.id?'selected':''}>${e(a.name)}</option>`).join('')}</select></label></header><div class="fin-heading"><div><div class="eyebrow">ORDER / MONEY / RESPONSIBILITY</div><h1>${internal?'每笔钱，都有下一步':{driver:'我的订单与收入',customer:'我的配送账单',merchant:'我的代收与返款',warehouse:'仓库订单与费用',carrier:'合作运费与结算'}[a.role]}</h1><p class="muted">${internal?'先处理待办，再展开费用、凭证和审核链。':'只展示当前演示身份的业务范围，不展示其他主体账目。'}</p></div><span class="pill demo">合成数据 · 非真实资金</span></div><div class="fin-mobile-scope">范围：新版闭环 ${p.orders.length} 笔授权订单 · 旧记录不自动迁移 · 资金未知不重复付款</div>${content}<p class="fin-inline-error" id="fin-page-error" role="alert"></p></main></div>`;
 bind();
}
function allocationFields(d){const p=financeProjection(db,ui.actor);return p.lines.filter(l=>l.direction==='in'&&l.currency===(d?.currency||ui.currency)).map(l=>field(`allocate:${l.id}`,`${l.orderId} · ${purposeNames[l.purpose]} · 未结 ${formatMoney(lineDue(f(),l),l.currency)}`,d?.items?.find(x=>x.lineId===l.id)?fdecimal(d.items.find(x=>x.lineId===l.id).amount,l.currency):'','number')).join('');}
const fdecimal=(n,c)=>String(n/(c==='KHR'?1:100));
function open(action,id){
 opener=document.activeElement;const a=actor(),p=financeProjection(db,ui.actor),d=f().documents.find(d=>d.id===id),r=f().receipts.find(r=>r.id===id),h=f().handovers.find(h=>h.id===id);let title='',body='',payload={},actual=action;
 const reason=()=>field('reason','业务理由／演示凭证编号');
 const visibleLines=p.lines.filter(l=>l.currency===ui.currency),visibleReceipts=p.receipts.filter(r=>r.currency===ui.currency&&r.state==='confirmed');
 if(action==='load'){title='加载三笔合成订单';body='<p>添加运费20＋COD200、运费10＋保险2及KHR10000三笔已履约案例。均为获批月结例外，现有订单不会覆盖。</p>';}
 else if(action==='enroll'){title='纳入现有未收款订单';body=select('orderId','未被新版接管、尚无收款证据的订单',db.orders.filter(o=>!o.financeManaged&&o.collection==='due'&&!o.reportedMinor).map(o=>[o.id,`${o.id} · ${o.customer}`]))+'<p>已有付款、应付或收入记录的旧单不自动迁移；原金额作为来源快照。</p>';}
 else if(action==='kessCreate'){title='模拟 KESS 付款';body=select('orderId','选择配送订单',p.orders.filter(o=>o.currency===ui.currency).map(o=>[o.id,`${o.id} · 待付配送与保险 ${money(p.lines.filter(l=>l.orderId===o.id&&l.direction==='in'&&l.purpose!=='cod').reduce((n,l)=>n+lineDue(f(),l),0))}`]))+'<p>金额取自当前订单账项，不允许手填。COD 不在本支付单收取；结果未知时只能查原单，不能重新扣款。KESS 商户尚未开通，本次只保存模拟支付单，不会扣款或打开真实收银台。</p>';}
 else if(action==='kessQuery'){const intent=p.paymentIntents.find(x=>x.id===id);if(!intent)throw Error('支付单不可访问');title='模拟查询结果';body=`<p>${e(intent.id)} · ${formatMoney(intent.amount,intent.currency)}。本次由你选择模拟结果，不代表真实到账。正式付款结果由支付渠道核实，用户不能自行选择成功。</p>`+select('result','模拟渠道返回',[['WAITING','待支付'],['UNKNOWN','查询超时／结果未知'],['SUCCESS','渠道确认收款成功'],['CLOSED','渠道确认关闭'],['FAILED','渠道确认失败'],['MISMATCH','金额／商户不匹配，拒绝确认']]);}
 else if(action==='receipt'){title='登记收款申报';body=(a.role==='customer'?'':select('subject','付款主体',[...new Map(p.orders.map(o=>[o.financeCustomer,[o.financeCustomer,o.customer+' · '+o.financeCustomer]])).values()],'C01'))+select('method','收款方式',a.role==='driver'?[['cash','司机现金']]:a.role==='customer'?[['bank','公司银行转账']]:[['bank','公司银行转账'],['cash','司机现金']])+select('currency','币种',[['USD','USD'],['KHR','KHR']],ui.currency)+field('amount','实际金额','','number')+field('evidence','唯一演示交易号／现金凭证')+'<p>这里只形成申报。独立核对后才成为确认资金，核销还需三人审核。</p>';}
 else if(action==='confirmReceipt'){title='确认资金事实';body=`<div class="info-box">${e(r.id)} · ${formatMoney(r.amount,r.currency)} · ${e(r.evidence)}<br>核对金额、账户、币种与交易结果；不凭截图推定到账。</div>`+field('evidence','人工核对的资金证据编号');}
 else if(action==='handover'){title='司机现金交款申报';body=select('currency','币种',[['USD','USD'],['KHR','KHR']],ui.currency)+field('amount','申报交款金额','','number')+field('evidence','交款凭证编号')+'<p>提交后仍待公司实际点收，不新增客户收款。</p>';}
 else if(action==='count'){title='记录实际点收';body=`<p>司机申报 ${formatMoney(h.amount,h.currency)}。短少金额保留待查，不扣收入、不减少COD。</p>`+field('amount','实际点收金额',fdecimal(h.amount,h.currency),'number')+field('evidence','点收证据编号');}
 else if(action==='recover'){title='登记差额补交审核';body=field('evidence','补交证据与说明')+'<p>产生独立补交单，复核审批后补入公司保管，不再增加客户收款。</p>';}
 else if(action.startsWith('new')){
  actual='draft';const kind={newAllocation:'allocation',newPayment:'payment',newRefund:'refund',newAdjustment:'adjustment',newReversal:'reversal',newAccount:'account',newPayable:'payable'}[action];payload={kind,currency:ui.currency};title=`新建${kinds[kind]}`;
  if(kind==='allocation')body=select('receiptId','已确认资金来源',visibleReceipts.map(r=>[r.id,`${r.id} · 可用 ${formatMoney(receiptFree(f(),r),r.currency)}`]),id)+'<p>填写本次分配，空白为不分配。各项合计不能超过资金可用余额。</p>'+allocationFields();
  if(kind==='payable')body=select('orderId','已签收订单',p.orders.filter(o=>o.status==='delivered').map(o=>[o.id,o.id+' · '+o.customer]))+select('purpose','核定对象',[['carrier','合作承运费'],['income','司机履约收入']])+field('amount','按协议／分成规则核定金额','','number')+'<p>原订单未产生其他运力应付时才可核定；保费与COD不计入分成基数，必须填写协议及计算依据。</p>';
  if(kind==='payment')body=select('lineId','应付明细',visibleLines.filter(l=>l.direction==='out'&&(a.role!=='driver'||l.purpose==='income'&&l.subject===a.subject)).map(l=>[l.id,`${l.orderId} · ${purposeNames[l.purpose]} · 未付 ${money(lineDue(f(),l))}`]))+field('amount','本次申请金额','','number');
  if(kind==='refund')body=select('receiptId','退回未分配款的来源',visibleReceipts.filter(r=>r.custodian==='COMPANY').map(r=>[r.id,`${r.id} · 未分配 ${money(receiptFree(f(),r))}`]))+field('amount','退款申请金额','','number')+'<p>已核销的款须先更正业务费用和撤销分配；不直接删除原收款。</p>';
  if(kind==='adjustment')body=select('lineId','服务费用账项',visibleLines.filter(l=>l.direction==='in'&&l.purpose!=='cod').map(l=>[l.id,`${l.orderId} · ${purposeNames[l.purpose]}`]))+select('negative','调整方向',[['false','补收'],['true','减免']])+field('amount','调整金额','','number');
  if(kind==='reversal')body=select('allocationId','原收款核销记录',p.allocations.filter(x=>x.amount>0&&x.receiptId&&!f().allocations.some(y=>y.reverses===x.id)).map(x=>[x.id,`${x.id} · ${x.lineId} · ${formatMoney(x.amount,x.currency)}`]));
  if(kind==='account')body=select('subject','收款对象',Object.entries(f().accounts).map(([id,v])=>[id,`${id} · 当前尾号 ${v.last4}`]))+field('last4','演示新账户后四位')+'<p>不采集真实银行卡。变更需复核审批，旧付款审批不能继续执行。</p>';
  body+=reason();
 }else if(action==='revise'){
  title='修订单据并使原审核失效';body=`<p>当前 v${d.version}，修订生成下一版本，复核与审批清空，历史保留。</p>`;
  if(['payment','refund','adjustment','payable'].includes(d.kind))body+=field('amount','新金额',fdecimal(Math.abs(d.amount),d.currency),'number');
  if(d.kind==='adjustment')body+=select('negative','调整方向',[['false','补收'],['true','减免']],String(d.amount<0));
  if(d.kind==='allocation')body+=allocationFields(d);if(d.kind==='account')body+=field('last4','新账户尾号',d.last4);body+=field('reason','修订理由',d.reason);
 }else {title={submit:'提交独立复核',review:'复核当前版本',approve:'批准当前版本',reject:'退回单据',execute:'登记人工执行',paymentResult:'核对银行资金结果',post:'完成核销／入账'}[action];body=`<div class="info-box">${kinds[d.kind]} · ${e(d.id)} · v${d.version}<br>${formatMoney(d.amount,d.currency)}<br>${e(d.reason)}<br>经办 ${e(byActor(d.maker))}；复核 ${e(byActor(d.reviewer))}；审批 ${e(byActor(d.approver))}</div>`;
  if(['reject','execute','paymentResult'].includes(action))body+=field('evidence','本次处理证据／理由');
  if(action==='paymentResult')body+=select('result','查询及核对结果',[['unknown','结果未知，保持占用'],['confirmed','资金确认成功，仍待核销'],['failed','确认失败，保留原执行记录']]);
  if(action==='execute')body+='<p>仅记录已在银行端人工执行的演示事实，不发起真实付款。登记不等于对方到账。</p>';
 }
 spec={action:actual,id,version:f().version,payload,key:crypto.randomUUID(),documentVersion:d?.version};dirty=false;
 dialog.innerHTML=`<form id="fin-form" novalidate><header class="dialog-head"><h2 id="finance-dialog-title" tabindex="-1">${title}</h2><button type="button" class="close" data-close aria-label="关闭">×</button></header><div class="form-body">${body}<p id="fin-error" class="fin-inline-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="btn" data-close>返回</button><button class="btn primary" type="submit">${title}</button></footer></form>`;
 dialog.showModal();dialog.querySelector('h2').focus();dialog.querySelector('form').addEventListener('input',()=>{dirty=true;delete dialog.dataset.discard});dialog.querySelector('form').addEventListener('change',()=>{dirty=true;delete dialog.dataset.discard});dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>close());dialog.querySelector('form').onsubmit=submit;
}
function close(force=false){if(busy)return;if(dirty&&!force&&dialog.dataset.discard!=='yes'){dialog.querySelector('#fin-error').textContent='有未保存输入。再次返回将放弃本次输入。';dialog.dataset.discard='yes';return;}dialog.close();spec=null;dirty=false;delete dialog.dataset.discard;opener?.focus();}
dialog.addEventListener('cancel',ev=>{ev.preventDefault();close()});
async function submit(ev){
 ev.preventDefault();if(busy)return;busy=true;const form=ev.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;submit.setAttribute('aria-busy','true');const values=Object.fromEntries(new FormData(form)),payload={...spec.payload,...values,documentVersion:spec.documentVersion};payload.negative=payload.negative==='true';
 payload.items=Object.entries(values).filter(([k,v])=>k.startsWith('allocate:')&&v.trim()!==''&&v!=='0').map(([k,v])=>({lineId:k.slice(9),amount:v}));
 try{if(!navigator.onLine)throw Error('离线不能确认资金或审批，请恢复连接后重试。');const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(saved?.financeLedger&&saved.financeLedger.version!==f().version){db=initialize(saved);throw Error('另一个页面已更新账务，请关闭表单并重新打开。');}
  const next=applyFinance(db,{...spec,id:spec.action==='enroll'?payload.orderId:spec.id,actorId:ui.actor,payload});sessionStorage.setItem(KEY,JSON.stringify(next));db=next;busy=false;close(true);render();notify('演示记录已保存；未执行真实收付款。');
 }catch(error){const err=form.querySelector('#fin-error');err.textContent=error.message;err.tabIndex=-1;err.focus();}finally{busy=false;submit.disabled=false;submit.removeAttribute('aria-busy');}
}
function bind(){
 root.querySelector('#fin-actor').onchange=ev=>{ui.actor=ev.target.value;ui.detail=null;ui.query='';ui.page=1;render()};
 root.querySelectorAll('[data-fin-tab]').forEach(b=>b.onclick=()=>{ui.tab=b.dataset.finTab;ui.detail=null;ui.page=1;ui.query='';render()});
 root.querySelectorAll('[data-fin-action]').forEach(b=>b.onclick=()=>{try{open(b.dataset.finAction,b.dataset.id)}catch(err){document.querySelector('#fin-page-error').textContent=err.message}});
 root.querySelectorAll('[data-fin-detail]').forEach(b=>b.onclick=()=>{ui.detail=b.dataset.finDetail;ui.detailTab='summary';render();window.scrollTo(0,0)});
 root.querySelectorAll('[data-detail-tab]').forEach(b=>b.onclick=()=>{ui.detailTab=b.dataset.detailTab;render()});
 root.querySelector('#fin-back')?.addEventListener('click',()=>{ui.detail=null;render()});
 root.querySelector('#fin-search')?.addEventListener('submit',ev=>{ev.preventDefault();ui.query=new FormData(ev.currentTarget).get('query').trim();ui.page=1;render()});
 root.querySelector('#fin-clear')?.addEventListener('click',()=>{ui.query='';ui.page=1;render();root.querySelector('#fin-query').focus()});
 root.querySelector('#fin-report')?.addEventListener('change',ev=>{ui.report=ev.target.value;ui.page=1;render()});
 root.querySelector('#fin-asof')?.addEventListener('change',ev=>{if(!validDate(ev.target.value)){notify('请选择有效观察日期');return;}ui.asOf=ev.target.value;render()});
 root.querySelector('#fin-currency')?.addEventListener('change',ev=>{ui.currency=ev.target.value;ui.page=1;render()});
 root.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{ui.page=+b.dataset.page;render()});
 root.querySelector('#fin-export')?.addEventListener('click',()=>{const protect=s=>/^[=+@-]/.test(s)?`'${s}`:s;const csv='\uFEFF'+[exportHeaders,...exportRows].map(row=>row.map(s=>`"${protect(s).replace(/"/g,'""')}"`).join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`DR-${ui.actor}-${ui.tab}-${ui.currency}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);notify('已导出当前授权范围的筛选明细。');});
}
try{save();render()}catch(error){root.textContent=`无法打开财务演示：${error.message}`;}
