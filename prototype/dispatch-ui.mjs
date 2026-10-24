// Synthetic review fixtures only; never a source of operational facts.
export function addDispatchScenario(db,now=Date.now()){
 const next=structuredClone(db);next.dispatchScenarioVersion=1;
 const local=minutes=>new Date(now+minutes*60000+7*3600000).toISOString().slice(0,16);
 const definitions=[
  ['201','中央市场商户','纸箱包装日用品','awaiting_dispatch',-18,8,12,36],
  ['202','河畔餐饮用品','包装餐具','awaiting_dispatch',22,6,9,28],
  ['203','森速办公中心','文件收纳箱','in_transit',48,10,15,42],
  ['204','南区家居店','包装椅子','return_open',-35,4,20,32],
  ['205','金边书店','图书纸箱','delivered',-60,5,12,20],
  ['206','商场布置团队','展架纸箱','draft',90,3,25,25],
  ['207','北区社区商店','包装杂货','awaiting_dispatch',75,12,8,38],
  ['208','演示电器仓','包装灯具','delivered',-90,2,10,18]
 ];
 for(const [suffix,name,cargo,status,minutes,qty,weight,amount] of definitions){const id='RF-DEMO-'+suffix;if(next.orders.some(o=>o.id===id))continue;const o={...structuredClone(db.orders[0]),id,customer:name+' · 演示',destination:'金边 · '+name+'演示收货点',cargo,qty,weight,amount,amountMinor:amount*100,payment:'cash',assignmentId:null,agreedMinor:null,goodsId:null,warehouseId:'WH01',serviceType:'standard',commissionBps:null,baseAmountMinor:amount*100,flashFeeMinor:0,incident:undefined,rescueParent:undefined,rescueItems:undefined,rescueVehicle:undefined,rescueFee:undefined,handover:undefined,length:60,width:40,height:40,expected:local(minutes-15),promise:status==='draft'?null:local(minutes),status,version:1,vehicle:null,fulfillmentMode:'OWN_FLEET',partnerId:null,booking:undefined,bookingHistory:undefined,offerUntil:null,custody:'金边演示仓',release:null,received:0,collection:'due',reportedMinor:0,collectionProof:'',financeEvidence:'',remittance:'open',returnAuthorized:false,returnAtWarehouse:false,events:[{text:'繁忙调度场景初始化 · 全部信息为合成演示',role:'演示场景',at:new Date(now).toISOString()}]};
  if(status==='in_transit'||status==='return_open'){const vid=status==='in_transit'?'V02':'V01';if(next.vehicleBlocks?.[vid]||next.orders.some(x=>x.vehicle===vid&&['offered','accepted','ready','picked_up','in_transit','return_open','incident_open','rescue_waiting','rescue_accepted'].includes(x.status))){o.status='awaiting_dispatch'}else{o.vehicle=vid;o.release='DEMO-LOAD-'+suffix;o.custody='司机持货 · 演示';if(status==='return_open'){o.received=2;o.custody='司机持有 2 件待退回 · 演示';o.collection='reported';o.reportedMinor=o.amountMinor;o.collectionProof='DEMO-CASH-'+suffix;}}}
  if(status==='delivered'){o.received=qty;o.custody='演示收货人';o.collection=suffix==='205'?'mismatch':'verified';o.reportedMinor=suffix==='205'?1500:o.amountMinor;o.collectionProof='DEMO-CASH-'+suffix;o.financeEvidence='DEMO-CHECK-'+suffix;o.remittance=suffix==='208'?'reconciled':'open';}
  next.orders.push(o);
 }return next;
}
export function dispatchAlerts(db,now=Date.now()){
 const list=[];for(const o of db.orders){if(o.rescueParent)continue;const push=(type,level,title,detail,owner)=>list.push({id:o.id,type,level,title,detail,owner});
 if(o.status==='incident_open')push('incident','urgent','车祸应急转运',`现场待处置 ${o.incident.items.filter(i=>!['已签收','已回仓'].includes(i.state)).length} 件；事故车停用，逐件分配和交接。`,o.incident.owner);
 const end=['delivered','closed_exception','cancelled'].includes(o.status);
 if(!end&&o.promise){const due=Date.parse(o.promise.length===16?o.promise+':00+07:00':o.promise),minutes=Math.ceil((due-now)/60000);if(minutes<=0)push('promise','urgent','原承诺时间已过',`已过 ${Math.abs(minutes)} 分钟，核实履约进度并联系客户；不自动判定违约。`,'调度');else if(minutes<=30)push('promise','warning','承诺窗口临近',`距原承诺约 ${minutes} 分钟，优先核对资源与实际进度。`,'调度');}
 if(o.status==='return_open')push('return','urgent',o.booking?'快递异常待退回':'持货异常待退回',o.returnAuthorized?'已确认退回安排，跟进返仓与准确点收。':'货物保管责任未解除，需确认退回地点、容量和时间。','调度 / 仓库');
 if(o.collection==='mismatch')push('money','warning','收款金额差异',`应收 USD ${(o.amountMinor/100).toFixed(2)} / 申报 USD ${(o.reportedMinor/100).toFixed(2)}，保持账务开放。`,'财务');
 if(o.booking?.status==='cancel_requested')push('cancel','urgent','承运取消仍待确认','不得重复委托或改派，先确认取消结果和实物保管。','调度');
 if(o.booking?.warning)push('carrier','warning','承运事件需要核实',o.booking.warning,'调度');
 if(o.status==='offered')push('offer','info','等待司机接受提案','接受前不视为已派发完成；到期自动释放预留。','调度 / 司机');
 }return list.sort((a,b)=>({urgent:0,warning:1,info:2}[a.level]-{urgent:0,warning:1,info:2}[b.level]));
}
export function dispatchOverview(db,h){const {e,btn,money}=h,alerts=dispatchAlerts(db),urgent=alerts.filter(x=>x.level==='urgent').length;const amount=db.orders.filter(o=>o.status!=='cancelled').reduce((n,o)=>n+o.amountMinor,0);const pending=db.orders.filter(o=>['due','reported','mismatch'].includes(o.collection)&&o.status!=='cancelled').reduce((n,o)=>n+o.amountMinor,0);const groups=[['待核验','draft'],['待派单','awaiting_dispatch'],['待确认','offered'],['待装载','accepted'],['待取货','ready'],['运输中','in_transit'],['异常退回','return_open'],['已送达','delivered']];return `<section class="dispatch-summary" aria-label="调度业务汇总"><div><span>当前订单</span><strong>${db.orders.filter(o=>!o.rescueParent).length}<small> 单</small></strong></div><div><span>需跟进订单</span><strong>${new Set(alerts.map(a=>a.id)).size}<small> 单</small></strong></div><div><span>紧急事项</span><strong class="urgent-number">${urgent}<small> 项</small></strong></div><div><span>合成订单应收</span><strong>${money(amount)}</strong></div><div><span>未核验应收</span><strong>${money(pending)}</strong></div></section><section class="panel dispatch-alerts"><div class="panel-title"><div><div class="eyebrow">ATTENTION REQUIRED</div><h2>优先处理 · 异常与紧急事项</h2></div>${btn('查看全部待办','all-alerts','small')}</div><div class="alert-explainer">基于当前演示订单状态与原承诺时间计算 · 临近阈值 30 分钟仅为原型参数 · 无实时定位或 ETA</div><div class="dispatch-alert-grid">${alerts.slice(0,6).map(a=>`<article class="dispatch-alert ${a.level}"><div class="alert-heading"><span class="pill ${a.level==='urgent'?'danger':a.level==='warning'?'warning':'info'}">${a.level==='urgent'?'紧急':a.level==='warning'?'关注':'待确认'}</span><span>${e(a.id)}</span></div><h3>${e(a.title)}</h3><p>${e(a.detail)}</p><footer><span>处理席：${e(a.owner)}</span><button class="btn small" data-alert-order="${a.id}">查看处理 →</button></footer></article>`).join('')||'<div class="alert-empty">暂无需要跟进的事项。持续按订单状态核对，不代表已接入实时监控。</div>'}</div></section><section class="panel flow-overview"><div class="panel-title"><h2>履约队列分布</h2><span class="muted small">点击状态筛选订单</span></div><div class="flow-stages">${groups.map(([name,state])=>`<button data-stage="${state}"><strong>${db.orders.filter(o=>o.status===state).length}</strong><span>${name}</span></button>`).join('')}</div></section>`;}
