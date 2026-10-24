import {incidentActions,applyIncident} from './incident-model.mjs';
export const labels = {incident_open:'事故转运中',rescue_waiting:'接驳待接单',rescue_accepted:'接驳待交接',draft:'待核验',awaiting_dispatch:'待派单',offered:'待司机确认',accepted:'待装载复核',ready:'待司机取货',picked_up:'已取货',in_transit:'运输中',delivered:'已送达',return_open:'退回处理中',closed_exception:'异常已结案',cancelled:'已取消'};
import {upgrade,r1mActions,applyR1M,activeBooking,driverAccess,partnerVehicle,partnerReason,addPayable} from './r1m-model.mjs';
export const roles = {dispatch:'调度',driver:'司机',partnerDriver:'合作司机',warehouse:'仓库',finance:'财务'};
export const vehicles = [{id:'V01',name:'厢式货车 · 1.5T',plate:'DEMO · 3A-018',driver:'សុខា · Sokha',capacity:1500,door:[180,180],size:[320,180,180]},{id:'V02',name:'轻型货车 · 0.8T',plate:'DEMO · 2B-026',driver:'សុខា · Sokha',capacity:800,door:[150,150],size:[240,150,150]}];
const rights = {create:['dispatch'],edit:['dispatch'],promise:['dispatch'],offer:['dispatch'],revoke:['dispatch'],cancel:['dispatch'],accept:['driver'],reject:['driver'],prepare:['warehouse'],pickup:['driver'],depart:['driver'],report:['driver'],deliver:['driver'],verify:['finance'],remit:['driver'],reconcile:['finance'],authorizeReturn:['dispatch'],returnArrived:['driver'],receiveReturn:['warehouse']};
const check = (yes,msg) => { if(!yes) throw new Error(msg); };
const stamp = (now=Date.now())=>new Date(now).toISOString();
const event=(o,text,role,now)=>o.events.push({text,role:roles[role]||role,at:stamp(now)});
export function validateInput(p) {
  for(const f of ['customer','destination','cargo','expected']) check(typeof p[f]==='string'&&p[f].trim().length>0,'请填写客户、收货地址、货物名称和期望时间。');
  check(Number.isInteger(+p.qty)&&+p.qty>0&&+p.qty<=100,'件数必须是 1–100 的整数。');
  for(const f of ['weight','length','width','height','amount']) check(Number.isFinite(+p[f])&&+p[f]>0, '重量、尺寸及运费必须是大于 0 的数字。');
  check(['cash','transfer'].includes(p.payment),'原型仅支持演示现金与转账。');
  check(Number.isFinite(Date.parse(p.expected+':00+07:00')),'请填写有效的期望日期与时间。');
  check(Math.abs(+p.amount*100-Math.round(+p.amount*100))<1e-7,'USD 运费最多保留两位小数。');
  return Object.fromEntries(['customer','destination','cargo','expected','payment','qty','weight','length','width','height','amount'].map(k=>[k,['qty','weight','length','width','height','amount'].includes(k)?+p[k]:p[k].trim()]));
}
function base(id,p,now) {return {id,...p,amountMinor:Math.round(p.amount*100),status:'draft',version:1,vehicle:null,promise:null,basis:null,offerUntil:null,custody:'金边演示仓',collection:'due',reportedMinor:0,collectionProof:'',remittance:'open',received:0,returnAuthorized:false,returnAtWarehouse:false,events:[{text:'创建订单草稿',role:'调度',at:stamp(now)}]};}
export function seed(now=Date.now()) {
  const one=base('RF-1024-001',{customer:'湄公河办公用品 · 演示',destination:'金边 · 桑园区演示收货点 A',cargo:'办公收纳柜',qty:4,weight:32,length:80,width:45,height:90,expected:'2026-10-24T16:30',amount:24,payment:'cash'},now-2400000);
  one.status='awaiting_dispatch';one.promise='2026-10-24T17:00';one.basis='人工核对车辆班次与收货窗口';event(one,'客户已确认报价与人工服务承诺','dispatch',now-1800000);
  const two=base('RF-1024-002',{customer:'河畔生活馆 · 演示',destination:'金边 · 森速区演示收货点 B',cargo:'纸箱包装灯具',qty:6,weight:8,length:45,width:35,height:30,expected:'2026-10-24T18:00',amount:18,payment:'transfer'},now-1600000);
  const three=base('RF-1024-003',{customer:'城南材料店 · 演示',destination:'金边 · 棉芷区演示收货点 C',cargo:'工具收纳箱',qty:2,weight:20,length:60,width:40,height:35,expected:'2026-10-24T15:30',amount:16,payment:'cash'},now-3600000);
  three.status='delivered';three.promise='2026-10-24T16:00';three.received=2;three.custody='演示收货人';three.collection='reported';three.reportedMinor=1600;three.collectionProof='DEMO-CASH-003';event(three,'演示初始化：逐件签收完成，现金待核验','driver',now-600000);
  return upgrade({schema:1,next:4,orders:[one,two,three],requests:{},queue:[]},now);
}
export function loadCheck(o,v) {
  if(!v)return '请选择车辆';
  if(o.qty*o.weight>v.capacity)return `总重量 ${o.qty*o.weight} kg 超过车辆载重 ${v.capacity} kg，禁止放行`;
  if(o.width>v.door[0]||o.height>v.door[1]||o.length>v.size[0])return '货物尺寸或装货门不适配，禁止放行';
  if(o.qty*o.length*o.width*o.height>v.size.reduce((a,b)=>a*b,1))return '总体积超过车厢，禁止放行';
  return null;
}
export function apply(db,c,now=Date.now()) {
  if(incidentActions.has(c.action))return applyIncident(db,c,now);
  if(r1mActions.has(c.action))return applyR1M(db,c,now);
  check(rights[c.action]?.includes(c.role)||(c.role==='partnerDriver'&&rights[c.action]?.includes('driver')),'无权限：当前角色不能执行此操作。');
  const authOrder=db.orders.find(x=>x.id===c.id);
  if(['driver','partnerDriver'].includes(c.role))check(authOrder&&driverAccess(db,authOrder,c.role),'这不是当前司机的授权任务，或合作访问已撤销。');
  check(typeof c.key==='string'&&c.key.length>0,'缺少幂等键。');
  const fingerprint=JSON.stringify([c.id,c.action,c.role,c.payload||{}]);
  if(db.requests[c.key]) {check(db.requests[c.key].fingerprint===fingerprint,'幂等键冲突：同一请求内容已改变。');return db;}
  const next=structuredClone(db),p=c.payload||{};
  let o=next.orders.find(x=>x.id===c.id);
  if(c.action==='create') {const fields=validateInput(p);o=base(`RF-1024-${String(next.next++).padStart(3,'0')}`,fields,now);next.orders.unshift(o);}
  else {
    check(o,'订单不存在或不可访问。');check(!o.rescueParent,'事故接驳必须使用专用动作，原单账务独立');check(c.version===o.version,'路线或订单版本已变化，请刷新后重新确认。');
    if(o.fulfillmentMode==='PARCEL_CARRIER'&&!['edit','promise','offer','verify'].includes(c.action))check(!activeBooking(o)&&o.booking?.status==='cancellation_confirmed','快递必须走承运委托与实物保管流程，不能用车辆动作绕过。');
    const at=(...states)=>check(states.includes(o.status),'当前状态不允许此操作，请刷新确认。');
    switch(c.action) {
      case 'edit': at('draft'); Object.assign(o,validateInput(p));o.amountMinor=Math.round(o.amount*100);break;
      case 'promise': at('draft'); check(p.confirmed&&p.address&&p.measured,'请确认地址、仓库实测和客户同意。');check(p.promise&&Number.isFinite(Date.parse(p.promise+':00+07:00'))&&p.basis?.trim(),'请填写有效承诺时间和人工核验依据。');o.promise=p.promise;o.basis=p.basis;o.status='awaiting_dispatch';break;
      case 'offer': {at('awaiting_dispatch');check(!activeBooking(o),'取消未确认，禁止派车或重复委托。');const v=vehicles.find(x=>x.id===p.vehicle);check(v,'请选择有效车辆。');check(!next.vehicleBlocks?.[v.id],'事故车辆停用，不能派单');check(!loadCheck(o,v),loadCheck(o,v));check(!next.orders.some(x=>x.id!==o.id&&x.vehicle===v.id&&['offered','accepted','ready','picked_up','in_transit','return_open','incident_open','rescue_waiting','rescue_accepted'].includes(x.status)),'该车已有有效任务，请选择其他车辆。');o.fulfillmentMode='OWN_FLEET';o.partnerId=null;o.vehicle=v.id;o.status='offered';o.offerUntil=now+120000;break;}
      case 'revoke': at('offered');o.status='awaiting_dispatch';o.vehicle=null;break;
      case 'cancel': at('draft','awaiting_dispatch','offered','accepted','ready');check(p.reason?.trim(),'请填写取消依据。');o.status='cancelled';o.vehicle=null;break;
      case 'accept': at('offered');check(!next.vehicleBlocks?.[o.vehicle],'事故车辆停用，不能接受任务');check(now<o.offerUntil,'提案已过期，不能接受；请调度刷新。');if(o.fulfillmentMode==='PARTNER_VEHICLE'){check(!partnerReason(next.partners.find(x=>x.id===o.partnerId),now),'合作资格或窗口已失效，不能接新任务。');check(p.available&&p.cargoConfirmed,'请确认实际可用窗口与当前持货无冲突。');addPayable(next,o,o.partnerId,o.agreedMinor,o.assignmentId,now);}o.status='accepted';break;
      case 'reject': at('offered');check(p.reason?.trim(),'请填写拒绝原因。');o.status='awaiting_dispatch';o.vehicle=null;break;
      case 'prepare': {at('accepted');const v=o.fulfillmentMode==='PARTNER_VEHICLE'?partnerVehicle(next.partners.find(x=>x.id===o.partnerId)):vehicles.find(x=>x.id===o.vehicle);check(!loadCheck(o,v),loadCheck(o,v));check(p.dimension&&p.pattern&&p.packaging&&p.evidence?.trim(),'请逐项核对装载、件数包装，并记录放行依据。');o.status='ready';o.release=p.evidence;break;}
      case 'pickup': at('ready');check(+p.count===o.qty&&p.evidence?.trim(),'实收件数必须一致，并填写交接凭证。');o.status='picked_up';o.custody=o.fulfillmentMode==='PARTNER_VEHICLE'?'合作司机 Dara':'演示司机 Sokha';break;
      case 'depart': at('picked_up');o.status='in_transit';break;
      case 'report': at('picked_up','in_transit','delivered','return_open','closed_exception','incident_open');check(o.collection==='due'||o.collection==='mismatch','已有有效申报，不可重复提交。');check(Number.isFinite(+p.amount)&&+p.amount>0&&p.proof?.trim(),'填写有效金额和收款凭证。');o.reportedMinor=Math.round(+p.amount*100);o.collectionProof=p.proof.trim();o.collection='reported';break;
      case 'deliver': at('in_transit');check(Number.isInteger(+p.count)&&+p.count>=0&&+p.count<=o.qty,'签收件数必须在订单件数范围内。');check(p.receiver?.trim()&&p.evidence?.trim(),'请填写收货人和签收凭证。');if(+p.count>0)check(o.payment==='cash'?['reported','verified'].includes(o.collection):o.collection==='verified','放货条件未满足：现金须现场申报，转账须财务核验。');o.received=+p.count;o.status=o.received===o.qty?'delivered':'return_open';o.custody=o.received===o.qty?p.receiver:`司机持有 ${o.qty-o.received} 件；收货人已收 ${o.received} 件`;o.pod=p.evidence;break;
      case 'verify': check(o.collection==='reported','没有待核验申报。');check(p.evidence?.trim(),'请填写财务核对依据。');check(Number.isFinite(+p.amount)&&+p.amount>=0,'请填写有效实核金额。');if(o.payment==='transfer')check(!next.orders.some(x=>x.id!==o.id&&x.collection==='verified'&&x.financeEvidence===p.evidence.trim()),'交易凭证已被其他订单核销。');o.collection=(Math.round(+p.amount*100)===o.amountMinor&&o.reportedMinor===o.amountMinor)?'verified':'mismatch';o.financeEvidence=p.evidence.trim();break;
      case 'remit': check(o.payment==='cash'&&o.collection==='verified'&&o.remittance==='open','先完成现金核验，再提交交款。');check(p.evidence?.trim(),'请填写交款凭证。');o.remittance='submitted';o.remitProof=p.evidence;break;
      case 'reconcile': check(o.remittance==='submitted','尚无司机交款申报。');check(+p.amount*100===o.amountMinor&&p.evidence?.trim(),'交款差额未解决，不能结清；请核对实交金额和凭证。');o.remittance='reconciled';break;
      case 'authorizeReturn': at('return_open');check(!o.returnAuthorized,'已授权退回。');check(p.reason?.trim(),'请记录退回目的地与人工容量／时间复核依据。');o.returnAuthorized=true;break;
      case 'returnArrived': at('return_open');check(o.returnAuthorized,'先由调度授权退回。');o.returnAtWarehouse=true;break;
      case 'receiveReturn': at('return_open');check(o.returnAtWarehouse,'货物尚未返仓。');check(+p.count===o.qty-o.received&&p.evidence?.trim(),'退回件数不符或证据缺失，不能结案。');o.status='closed_exception';o.custody=`客户 ${o.received} 件 / 仓库 ${o.qty-o.received} 件`;break;
      default: throw new Error('未知操作');
    }
    o.version++;
    const names={edit:'修改订单草稿',promise:'客户确认报价与人工承诺',offer:'发出司机提案',revoke:'撤回提案，保留原承诺',cancel:'取消取货前订单',accept:'司机接受提案',reject:'司机拒绝提案，回调度处理',prepare:'仓库人工装载放行，交接待司机确认',pickup:'司机逐件点收，实物保管转移',depart:'车辆出发',report:'收款申报，等待财务核验',deliver:o.status==='delivered'?'逐件签收完成；财务独立处理':'部分收货，剩余货物待授权退回',verify:o.collection==='verified'?'财务核验通过':'财务发现收款差额',remit:'司机提交现金交款',reconcile:'财务核对交款，已结清',authorizeReturn:'调度授权退回并复核容量／时间',returnArrived:'司机已返仓，待实物点收',receiveReturn:'仓库退回点收完成；履约异常结案'};
    event(o,names[c.action]+(p.reason?`：${p.reason}`:''),c.role,now);
  }
  next.requests[c.key]={fingerprint,id:o.id};return next;
}
export function expire(db,now=Date.now()) {const next=structuredClone(db);for(const o of next.orders)if(o.status==='offered'&&o.offerUntil<=now){o.status='awaiting_dispatch';o.vehicle=null;o.version++;event(o,'提案过期，释放预留并保留原承诺','dispatch',now);}return next;}
