// Draft fee settings and arithmetic preview only; approved order snapshots stay unchanged.
export const feeOwners={DR:'DR 对客收费',VET:'VET 采购费用',ZTO:'中通采购费用',CE:'CE 采购费用',JT:'极兔采购费用'};
export const feeGroups={transport:'基础运输',service:'附加服务',funds:'COD 与保险',warehouse:'仓储作业'};
export const feeMethods={fixed:'每单固定金额',unit:'按单位计费',percent:'按基数比例'};
export const feeUnits={kg:'计费重量 kg',km:'核验道路里程 km',piece:'件',stop:'新增停靠点',minute:'等待分钟',floor:'搬运楼层',day:'计费天数',cbmDay:'m³·日'};
export const feeCatalog=[
 {code:'base',name:'基础运费／首重',group:'transport',units:['kg'],share:true},
 {code:'weight',name:'续重费',group:'transport',units:['kg'],share:true},
 {code:'distance',name:'超距费',group:'transport',units:['km'],share:true},
 {code:'flash',name:'独享闪送费',group:'transport',units:[],share:true},
 {code:'pickup',name:'上门取件费',group:'service',units:['piece','stop']},
 {code:'door',name:'送货上门费',group:'service',units:['piece','stop']},
 {code:'remote',name:'偏远区域附加费',group:'service',units:['km']},
 {code:'handling',name:'搬运费',group:'service',units:['piece']},
 {code:'stairs',name:'上楼费',group:'service',units:['floor']},
 {code:'waiting',name:'等待费',group:'service',units:['minute']},
 {code:'redelivery',name:'二次配送费',group:'service',units:['stop']},
 {code:'return',name:'拒收／退回运输费',group:'service',units:['km','kg']},
 {code:'cancel',name:'取消服务费',group:'service',units:[]},
 {code:'cod',name:'COD 服务费',group:'funds',units:[],basis:'cod',locked:true},
 {code:'insurance',name:'配送保险费',group:'funds',units:[],basis:'goods',locked:true},
 {code:'storage',name:'仓储费',group:'warehouse',units:['day','cbmDay'],locked:true},
 {code:'inbound',name:'入库作业费',group:'warehouse',units:['piece'],locked:true},
 {code:'outbound',name:'出库作业费',group:'warehouse',units:['piece'],locked:true},
 {code:'packing',name:'包装服务费',group:'warehouse',units:['piece'],locked:true}
];
const check=(ok,message,field)=>{if(!ok)throw Object.assign(Error(message),{field});};
const safe=n=>{check(n<=BigInt(Number.MAX_SAFE_INTEGER),'金额或计费量过大');return Number(n);};
export function decimalUnits(value,precision,field='amount'){
 const s=String(value??'').trim();
 check(new RegExp('^\\d+(?:\\.\\d{1,'+Math.max(1,precision)+'})?$').test(s)&&!(precision===0&&s.includes('.')),`请填写非负数字，最多 ${precision} 位小数`,field);
 const [whole,fraction='']=s.split('.');check(s.length<24,'金额或计费量过大',field);
 return safe(BigInt(whole)*10n**BigInt(precision)+BigInt(fraction.padEnd(precision,'0')||'0'));
}
export const feeMoney=(minor,currency)=>`${currency} ${currency==='USD'?(minor/100).toFixed(2):minor}`;
export const feeKey=(owner,currency,code)=>`${owner}:${currency}:${code}`;
export function initFees(db){return db.feeSettings?db:{...db,feeSettings:{revision:0,rules:{},history:[],trials:[]}};}
export function feeRule(db,id){return db.feeSettings?.rules[id]||null;}
export const feeActions=new Set(['feeSave','feeTrial']);
function parseKey(id){const [owner,currency,code,...rest]=String(id||'').split(':');check(!rest.length&&Object.hasOwn(feeOwners,owner)&&['USD','KHR'].includes(currency)&&feeCatalog.some(x=>x.code===code),'费用对象不存在');return {owner,currency,code};}
function validateRule(id,p){
 const {owner,currency,code}=parseKey(id),item=feeCatalog.find(x=>x.code===code);
 check(typeof p.enabled==='boolean','请选择启用或停用','enabled');
 check(typeof p.scope==='string'&&p.scope.trim()&&p.scope.length<=300,'请填写适用线路、服务与包含范围（最多300字）','scope');
 check(typeof p.evidence==='string'&&p.evidence.trim()&&p.evidence.length<=300,'请填写配置依据／变更原因（最多300字）','evidence');
 check(['fixed',...(item.units.length?['unit']:[]),...(item.basis?['percent']:[])].includes(p.method),'该费目不支持所选计费方式','method');
 const precision=currency==='USD'?2:0;
 const amount=decimalUnits(p.amount,p.method==='percent'?2:precision,'amount');
 if(p.method==='percent')check(amount<=10000,'比例须在 0–100% 之间','amount');
 let unit=null,included=0,step=1000;
 if(p.method==='unit'){
  check(item.units.includes(p.unit),'请选择有效计费单位','unit');unit=p.unit;
  included=decimalUnits(p.included,3,'included');step=decimalUnits(p.step,3,'step');check(step>0,'计费步长须大于零','step');
 }
 check(typeof p.share==='boolean','请选择分成归属','share');
 check(!p.share||owner==='DR'&&!item.locked,'保险、COD服务、仓储及采购费用不能计入配送分成','share');
 return {id,owner,currency,code,enabled:p.enabled,scope:p.scope.trim(),evidence:p.evidence.trim(),method:p.method,amount,unit,included,step,share:p.share};
}
export function calculateFeeTrial(db,p){
 check(Object.hasOwn(feeOwners,p.owner)&&['USD','KHR'].includes(p.currency),'请选择有效价表与币种','owner');
 const precision=p.currency==='USD'?2:0,lines=[];
 for(const item of feeCatalog){
  if(p['use_'+item.code]!==true)continue;
  const rule=feeRule(db,feeKey(p.owner,p.currency,item.code));check(rule?.enabled,`${item.name}尚未配置或已停用`);
  let quantity=1000,units=1,amount=rule.amount;
  if(rule.method==='unit'){
   quantity=decimalUnits(p['qty_'+item.code],3,'qty_'+item.code);
   const extra=BigInt(Math.max(0,quantity-rule.included));units=safe((extra+BigInt(rule.step)-1n)/BigInt(rule.step));amount=safe(BigInt(units)*BigInt(rule.amount));
  }else if(rule.method==='percent'){
   quantity=decimalUnits(p['qty_'+item.code],precision,'qty_'+item.code);
   amount=safe((BigInt(quantity)*BigInt(rule.amount)+5000n)/10000n);
  }
  lines.push({code:item.code,name:item.name,quantity,units,amountMinor:amount,rule:structuredClone(rule)});
 }
 check(lines.length>0,'至少选择一项已启用费用');
 const totalMinor=safe(lines.reduce((n,x)=>n+BigInt(x.amountMinor),0n));
 const insuranceMinor=lines.filter(x=>x.code==='insurance').reduce((n,x)=>n+x.amountMinor,0);
 const shareMinor=lines.filter(x=>x.rule.share).reduce((n,x)=>n+x.amountMinor,0);
 return {owner:p.owner,currency:p.currency,totalMinor,insuranceMinor,shareMinor,separateMinor:totalMinor-shareMinor,lines,revision:db.feeSettings.revision};
}
export function applyFees(db,c,now=Date.now()){
 check(feeActions.has(c.action),'未知费用操作');
 check(c.action==='feeSave'?c.role==='ops':['ops','finance'].includes(c.role),'当前工作席无权配置或试算费用');
 check(typeof c.key==='string'&&c.key,'缺少幂等键');
 const fingerprint=JSON.stringify([c.action,c.id,c.role,c.actorId,c.payload]);
 if(db.requests[c.key]){check(db.requests[c.key].fingerprint===fingerprint,'幂等键冲突');return db;}
 const source=initFees(db),p=c.payload||{},next=structuredClone(source),settings=next.feeSettings,at=new Date(now).toISOString();
 if(c.action==='feeSave'){
  const before=feeRule(source,c.id);check(c.version===(before?.version||0),'费用版本已变化，请重新打开配置');
  const rule={...validateRule(c.id,p),version:(before?.version||0)+1,at};settings.rules[c.id]=rule;settings.revision++;
  settings.history.push({id:c.id,at,role:c.role,actorId:c.accountId||'demo:'+c.role,before:before?structuredClone(before):null,after:structuredClone(rule)});
 }else{
  check(c.version===settings.revision,'费用配置已变化，请重新打开试算');
  const result=calculateFeeTrial(source,p);settings.trials.push({...result,id:'TRIAL-'+(settings.trials.length+1),at,role:c.role});
 }
 next.requests[c.key]={fingerprint};return next;
}
