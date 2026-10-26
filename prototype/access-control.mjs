const check=(ok,message)=>{if(!ok)throw Error(message)};
export const permissions={
 'orders.read':'查看订单与调度地图','orders.write':'录单、编辑与确认承诺','dispatch.assign':'派单、撤回与取消','delivery.exception':'异常、事故与退回处置',
 'warehouse.read':'查看仓库与库存','warehouse.write':'仓库交接与库存操作','finance.read':'查看财务与结算','finance.verify':'核验收款与分成','finance.pay':'应付与提现审批付款',
 'master.read':'查看运营资料','master.write':'维护货品、车辆与司机','partners.write':'合作方准入与委托','areas.write':'管理并发布配送区域','integrations.write':'导入外部订单与申请派单'
};
const groups={
 'finance.read':['feeTrial','settlementRead'],
 'orders.write':['create','edit','promise','commissionSet','areaPoint'],
 'dispatch.assign':['offer','revoke','cancel','partnerOffer'],
 'delivery.exception':['authorizeReturn','resolveDriverIssue','incidentOpen','rescueAssign','rescueCancel','rescueReturnApprove'],
 'warehouse.write':['prepare','receiveReturn','rescueReturnReceive','stockReceive','stockInspect','bookingHandover','bookingReturnReceive'],
 'finance.verify':['settlementRule','settlementCheck','settlementClock','settlementDemo','settlementConfirm','settlementSend','settlementDunning','settlementCollect','settlementHold','verify','reconcile','earningPost','bankReview','payableVerify','payableDispute'],
 'finance.pay':['withdrawApprove','withdrawReject','withdrawPaid','payablePay','payableReverse'],
 'master.write':['feeSave','goodsSave','vehicleSave','driverSave','driverReview','bankSave','warehouseSave'],
 'partners.write':['partnerRegister','partnerEdit','partnerApprove','partnerReview','partnerPause','partnerResume','partnerExit','bookingDraft','bookingContact','bookingConfirm','bookingReady','bookingEvent','bookingVerify','bookingCancel','bookingCancelConfirm','bookingException','bookingReturnConfirm','bookingReturnArrived'],
 'areas.write':['areaSave','areaPublish'],
 'integrations.write':['importExternal','requestExternalDispatch']
};
export const actionPermission=Object.fromEntries(Object.entries(groups).flatMap(([p,actions])=>actions.map(a=>[a,p])));
const role=(id,name,base,perms)=>({id,name,base,permissions:perms,version:1,builtin:true});
export function initAccess(db){if(db.access)return db;return {...db,access:{roles:[
 role('administrator','系统管理员','ops',Object.keys(permissions)),
 role('operations','运营管理员','ops',['master.read','master.write','partners.write','areas.write','integrations.write','orders.read']),
 role('dispatcher','调度员','dispatch',['orders.read','orders.write','dispatch.assign','delivery.exception','integrations.write']),
 role('warehouse','仓库作业员','warehouse',['warehouse.read','warehouse.write','orders.read']),
 role('finance','财务核验员','finance',['finance.read','finance.verify','orders.read']),
 role('viewer','订单只读','dispatch',['orders.read'])],accounts:[
 {id:'A01',login:'demo.admin',name:'演示系统管理员',roleIds:['administrator'],scope:{mode:'all',warehouseIds:[],vehicleIds:null},status:'active',epoch:1,version:1},
 {id:'A02',login:'demo.dispatch',name:'演示受限调度',roleIds:['dispatcher'],scope:{mode:'custom',warehouseIds:['WH01'],vehicleIds:['V01']},status:'active',epoch:1,version:1},
 {id:'A03',login:'demo.viewer',name:'演示订单只读',roleIds:['viewer'],scope:{mode:'custom',warehouseIds:['WH01'],vehicleIds:null},status:'active',epoch:1,version:1}
 ],audit:[]}};}
export function sessionFor(db,id){const a=db.access.accounts.find(x=>x.id===id);check(a?.status==='active','账号不存在或已停用');return {accountId:id,epoch:a.epoch};}
export function identity(db,session){const a=db.access?.accounts.find(x=>x.id===session?.accountId);check(a?.status==='active','账号已停用或不存在');check(a.epoch===session.epoch,'会话已撤销或授权已变化，请重新模拟登录');return a;}
export const isAdmin=(db,a)=>a.roleIds.includes('administrator');
export const accountRoles=(db,a)=>db.access.roles.filter(r=>a.roleIds.includes(r.id));
export const grants=(db,a)=>new Set(accountRoles(db,a).flatMap(r=>r.permissions));
export function inScope(a,o){if(a.scope.mode==='all')return true;return a.scope.warehouseIds.includes(o.warehouseId||'WH01')&&(!(o.rescueVehicle||o.vehicle)||a.scope.vehicleIds===null||a.scope.vehicleIds.includes(o.rescueVehicle||o.vehicle));}
const globalViews=new Set(['settlements','operations','goods','vehicles','drivers','partners','pricing','withdrawals','payables','areas','integrations','bookings']);
const viewPermissions={settlements:'finance.read',dispatch:'orders.read',orders:'orders.read',exceptions:'orders.read',warehouse:'warehouse.read',inventory:'warehouse.read',finance:'finance.read',operations:'master.read',goods:'master.read',vehicles:'master.read',drivers:'master.read',partners:'master.read',bookings:'partners.write',pricing:'finance.read',withdrawals:'finance.read',payables:'finance.read',areas:'areas.write',integrations:'integrations.write'};
export function canView(db,session,view){try{if(['prototype','customer','driver'].includes(view))return false;const a=identity(db,session);if(view==='access')return isAdmin(db,a);if(a.scope.mode!=='all'&&globalViews.has(view))return false;return isAdmin(db,a)||grants(db,a).has(viewPermissions[view])||(view==='pricing'&&grants(db,a).has('master.write'));}catch{return false}}
export function previewRoles(db,session){try{const a=identity(db,session);return isAdmin(db,a)?['ops','dispatch','warehouse','finance']:Array.from(new Set(accountRoles(db,a).map(r=>r.base)))}catch{return []}}
const scopedActions=new Set(['create','edit','promise','commissionSet','areaPoint','offer','revoke','cancel','authorizeReturn','resolveDriverIssue','prepare','receiveReturn','verify','reconcile','earningPost','stockReceive','stockInspect']);
export function canOperate(db,session,role,action){try{const a=identity(db,session);return previewRoles(db,session).includes(role)&&(isAdmin(db,a)||(grants(db,a).has(actionPermission[action])||(action==='feeTrial'&&grants(db,a).has('master.write'))))&&(a.scope.mode==='all'||scopedActions.has(action));}catch{return false}}
export function authorize(db,session,c){
 const a=identity(db,session);check(previewRoles(db,session).includes(c.role),'账号未获授权使用该工作席');
 check(isAdmin(db,a)||grants(db,a).has(actionPermission[c.action])||(c.action==='feeTrial'&&grants(db,a).has('master.write')),'没有此操作权限');
 if(a.scope.mode==='all')return a;
 check(scopedActions.has(c.action),'此操作涉及全局资料，限定范围账号不能执行');const p=c.payload||{};
 if(!['create','stockReceive','stockInspect'].includes(c.action)){const o=db.orders.find(x=>x.id===c.id);check(o&&inScope(a,o),'对象不存在或不在操作范围');}
 if(['create','edit','stockReceive','stockInspect'].includes(c.action))check(a.scope.warehouseIds.includes(p.warehouseId||'WH01'),'仓库不在操作范围');
 if(p.vehicle)check(a.scope.vehicleIds===null||a.scope.vehicleIds.includes(p.vehicle),'车辆不在操作范围');return a;
}
export function executeAsAccount(db,session,c,execute,now=Date.now()){
 check(typeof c.key==='string'&&c.key,'缺少幂等键');const a=authorize(db,session,c);const scoped={...c,accountId:a.id,key:`account:${a.id}:${c.key}`};const next=execute(db,scoped,now);if(next===db)return db;
 (next.access.audit??=[]).push({at:new Date(now).toISOString(),actorId:a.id,action:c.action,target:c.id||'new',kind:'business',summary:'账号权限及操作范围校验通过'});return next;
}
export function projectAccount(db,session){
 const a=identity(db,session),p=grants(db,a),next=structuredClone(db),all=isAdmin(db,a);
 next.orders=(all||p.has('orders.read')||p.has('warehouse.read')||p.has('finance.read'))?next.orders.filter(o=>inScope(a,o)):[];
 if(!all&&(!p.has('finance.read')||a.scope.mode!=='all')){delete next.settlement;delete next.financeLedger;}
 if(!all&&(a.scope.mode!=='all'||!p.has('finance.read')&&!p.has('master.write')))delete next.feeSettings;
 const ids=new Set(next.orders.map(o=>o.id));
 if(a.scope.mode!=='all'){
  next.warehouses=next.warehouses.filter(w=>a.scope.warehouseIds.includes(w.id));next.vehicleProfiles=next.vehicleProfiles.filter(v=>a.scope.vehicleIds===null||a.scope.vehicleIds.includes(v.id));next.partners=[];
  next.stockMoves=next.stockMoves.filter(x=>a.scope.warehouseIds.includes(x.warehouseId));next.stockReservations=Object.fromEntries(Object.entries(next.stockReservations).filter(([id])=>ids.has(id)));
 }
 const drivers=new Set(next.vehicleProfiles.map(v=>v.driverId));next.driverProfiles=next.driverProfiles.filter(d=>a.scope.mode==='all'||drivers.has(d.id));
 if(!all&&!p.has('finance.read')){next.earnings=[];next.withdrawals=[];next.payables=[];for(const o of next.orders){delete o.financeEvidence;delete o.collectionProof;delete o.remitProof}for(const d of next.driverProfiles)d.bank=null;}
 else{next.earnings=next.earnings.filter(x=>ids.has(x.orderId));next.payables=next.payables.filter(x=>ids.has(x.orderId));if(a.scope.mode!=='all')next.withdrawals=[];}
 next.externalIntakes=(next.externalIntakes||[]).filter(x=>ids.has(x.orderId));next.queue=[];next.requests={};next.platformAudit=[];
 if(!all)next.access={...next.access,accounts:next.access.accounts.filter(x=>x.id===a.id),audit:[]};return next;
}
function validateScope(db,p){check(p&&['all','custom'].includes(p.mode),'请选择全部或指定操作范围');if(p.mode==='all')return {mode:'all',warehouseIds:[],vehicleIds:null};check(Array.isArray(p.warehouseIds)&&p.warehouseIds.length>0&&p.warehouseIds.every(id=>db.warehouses.some(w=>w.id===id)),'至少选择一个有效仓库');check(p.vehicleIds===null||Array.isArray(p.vehicleIds)&&p.vehicleIds.every(id=>db.vehicleProfiles.some(v=>v.id===id)),'车辆范围无效');return {mode:'custom',warehouseIds:[...new Set(p.warehouseIds)],vehicleIds:p.vehicleIds===null?null:[...new Set(p.vehicleIds)]};}
export function applyAccess(db,session,c,now=Date.now()){
 const actor=identity(db,session);check(isAdmin(db,actor),'仅系统管理员可管理账号与授权');check(typeof c.key==='string'&&c.key,'缺少幂等键');const key=`iam:${actor.id}:${c.key}`,fingerprint=JSON.stringify([c.action,c.id,c.payload]);if(db.requests[key]){check(db.requests[key].fingerprint===fingerprint,'幂等键冲突');return db}
 const next=structuredClone(db),a=next.access,p=c.payload||{},at=new Date(now).toISOString();let target,before=null;
 if(c.action==='accountSave'){
  target=a.accounts.find(x=>x.id===c.id);if(c.id)check(target&&target.version===c.version,'账号版本变化，请重新打开');before=target?structuredClone(target):null;
  check(typeof p.login==='string'&&/^[a-z][a-z0-9._-]{2,39}$/.test(p.login),'账号使用3–40位小写字母、数字、点、下划线或短横线');check(typeof p.name==='string'&&p.name.trim()&&p.name.length<=60,'填写1–60字姓名');check(!a.accounts.some(x=>x.login===p.login&&x.id!==c.id),'账号标识已存在');
  check(Array.isArray(p.roleIds)&&p.roleIds.length>0&&p.roleIds.every(id=>a.roles.some(r=>r.id===id)),'至少选择一个有效角色');check(['active','disabled'].includes(p.status),'账号状态无效');const scope=validateScope(next,p.scope);check(!p.roleIds.includes('administrator')||scope.mode==='all','系统管理员必须拥有全范围');
  if(!target){target={id:'A-'+crypto.randomUUID(),version:0,epoch:0};a.accounts.push(target)}Object.assign(target,{login:p.login,name:p.name.trim(),roleIds:[...new Set(p.roleIds)],scope,status:p.status,version:target.version+1,epoch:target.epoch+1});
 }else if(c.action==='accountRevoke'){
  target=a.accounts.find(x=>x.id===c.id);check(target&&target.version===c.version,'账号版本变化');before=structuredClone(target);target.epoch++;target.version++;
 }else if(c.action==='roleSave'){
  target=a.roles.find(x=>x.id===c.id);if(c.id)check(target&&target.version===c.version,'角色版本变化');check(target?.id!=='administrator','系统管理员角色不可修改');before=target?structuredClone(target):null;
  check(typeof p.name==='string'&&p.name.trim()&&p.name.length<=60,'填写角色名称');check(!a.roles.some(r=>r.name===p.name.trim()&&r.id!==c.id),'角色名称重复');check(['ops','dispatch','warehouse','finance'].includes(p.base),'工作席无效');check(Array.isArray(p.permissions)&&p.permissions.every(x=>Object.hasOwn(permissions,x)),'权限项无效');
  if(!target){target={id:'R-'+crypto.randomUUID(),version:0,builtin:false};a.roles.push(target)}Object.assign(target,{name:p.name.trim(),base:p.base,permissions:[...new Set(p.permissions)],version:target.version+1});
  for(const account of a.accounts)if(account.roleIds.includes(target.id)){account.epoch++;account.version++;}
 }else throw Error('未知账号管理操作');
 check(a.accounts.some(x=>x.status==='active'&&x.roleIds.includes('administrator')&&x.scope.mode==='all'),'必须保留至少一个启用的全范围系统管理员');
 a.audit.push({at,actorId:actor.id,action:c.action,target:target.id,kind:'access',before,after:structuredClone(target),summary:c.action==='accountRevoke'?'撤销该账号全部模拟会话':'更新授权；相关旧会话失效'});next.requests[key]={fingerprint};return next;
}
