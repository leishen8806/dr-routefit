const check=(ok,message)=>{if(!ok)throw Error(message)};
export const importFields={sourceSystem:'来源平台',externalOrderId:'外部订单号',pickupAddress:'上门收货地址',pickupContact:'取件联系人',pickupPhone:'取件联系电话',destination:'送货地址',deliveryContact:'收货人',deliveryPhone:'收货联系电话',amount:'配送费',insuranceAmount:'配送保险费',cargo:'货物名称',qty:'件数',weight:'单件重量',length:'单件长度',width:'单件宽度',height:'单件高度',expected:'期望送达时间',customer:'客户名称'};
const aliases={sourcePlatform:'sourcePlatform',订单来源平台:'sourcePlatform',币种:'currency',currency:'currency',取货地址:'pickupAddress',寄件地址:'pickupAddress',发货地址:'pickupAddress',上门收货地址:'pickupAddress',联系人:'pickupContact',取货人:'pickupContact',寄件人:'pickupContact',电话:'pickupPhone',取货电话:'pickupPhone',送货地址:'destination',收货地址:'destination',收件人:'deliveryContact',收货人:'deliveryContact',联系电话:'deliveryPhone',收件电话:'deliveryPhone',收货电话:'deliveryPhone',配送价格:'amount',配送保险价格:'insuranceAmount',保险费:'insuranceAmount',订单号:'externalOrderId',平台:'sourceSystem'};
export function parseExternalText(text){
 check(typeof text==='string'&&text.length<=20000,'粘贴内容最多 20000 字符');const fields={},warnings=[];
 const assign=(label,value)=>{const key=Object.hasOwn(importFields,label)?label:Object.entries(importFields).find(([,v])=>v===label)?.[0]||aliases[label];if(!key){if(label.trim())warnings.push('未识别字段：'+label.slice(0,60));return}if(typeof value!=='string'&&typeof value!=='number'){warnings.push('字段须为文字或数字：'+label);return}if(Object.hasOwn(fields,key)){warnings.push('重复字段，须人工核对：'+importFields[key]);return}fields[key]=String(value).trim();if(['amount','insuranceAmount'].includes(key))fields[key]=fields[key].replace(/^USD\s*|^\$\s*/i,'').replace(/\s*USD$/i,'');};
 const raw=text.trim();if(raw.startsWith('{')){let parsed;try{parsed=JSON.parse(raw)}catch{throw Error('JSON 格式不正确，请修正后解析')}check(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'需要 JSON 对象');for(const [key,value]of Object.entries(parsed))assign(key,value);
 }else for(const line of raw.split(/\r?\n|[;；]/)){if(!line.trim())continue;const m=line.match(/^\s*([^:：]+)[:：]\s*(.*)$/);if(m)assign(m[1].trim(),m[2]);else warnings.push('未识别行，请手工填写：'+line.trim().slice(0,50));}
 return {fields,warnings};
}
export function validateContacts(p){for(const key of ['pickupAddress','pickupContact','pickupPhone','destination','deliveryContact','deliveryPhone'])check(typeof p[key]==='string'&&p[key].trim()&&p[key].length<=300,'请核对 '+importFields[key]+'，最多 300 字符');for(const key of ['pickupPhone','deliveryPhone'])check(/^\+?[\d ()-]{6,30}$/.test(p[key])&&p[key].replace(/\D/g,'').length>=6,'联系电话格式不正确');}
export function validateExternal(p){
 check(['warehouse','customer'].includes(p.sourceType),'请选择仓库或用户平台来源');
 for(const key of ['sourceSystem','externalOrderId','pickupAddress','pickupContact','pickupPhone','destination','deliveryContact','deliveryPhone'])check(typeof p[key]==='string'&&p[key].trim()&&p[key].length<=300,'请填写 '+(importFields[key]||key)+'，最多 300 字符');
 for(const key of ['pickupPhone','deliveryPhone'])check(/^\+?[\d ()-]{6,30}$/.test(p[key])&&p[key].replace(/\D/g,'').length>=6,'联系电话格式不正确，请保留国家区号并核对原文');
 check(p.reviewed===true,'请逐项核对取送地址、联系人、电话和配送/保险价格');
 check(p.currency==='USD','本原型仅支持 USD，不自动换汇');check(p.insuranceAmount!==undefined&&String(p.insuranceAmount).trim()!=='','请明确填写保险费，无保险填 0');
 if(p.sourceSystem==='DEMO-USER-001')check(typeof p.sourcePlatform==='string'&&p.sourcePlatform.trim()&&p.sourcePlatform.length<=300,'请填写订单来源平台');return Object.fromEntries(['sourceType','sourceSystem','sourcePlatform','externalOrderId',...Object.keys(importFields),'insuranceAmount','currency','payment','reviewed'].map(k=>[k,typeof p[k]==='string'?p[k].trim():p[k]]));
}
export function validateCustomerRequest(p){
  validateContacts(p);
  check(typeof p.expected==='string'&&Number.isFinite(Date.parse(p.expected+':00+07:00')),'请填写期望送达时间。');
  return {pickupAddress:p.pickupAddress.trim(),pickupContact:p.pickupContact.trim(),pickupPhone:p.pickupPhone.trim(),destination:p.destination.trim(),deliveryContact:p.deliveryContact.trim(),deliveryPhone:p.deliveryPhone.trim(),cargo:typeof p.cargo==='string'&&p.cargo.trim()?p.cargo.trim():'待调度确认货物',expected:p.expected.trim(),customer:p.pickupContact.trim()};
}
export function importExternal(db,c,create,now=Date.now()){
 check(['ops','dispatch','customer'].includes(c.role),'无权限导入订单');check(c.key,'缺少幂等键');const quickCustomerRequest=c.role==='customer'&&(c.payload?.quickRequest===true||c.payload?.quickRequest==='true');const p=quickCustomerRequest?{...validateCustomerRequest(c.payload||{}),sourceType:'customer',sourceSystem:'DEMO-USER-001',sourcePlatform:'DR RouteFit 用户端',externalOrderId:'USER-'+c.key,amount:0,insuranceAmount:0,payment:'pending',quotePending:true}:{...validateExternal(c.role==='customer'?{...c.payload,sourceType:'customer',sourceSystem:'DEMO-USER-001'}:(c.payload||{})),quotePending:false},fingerprint=JSON.stringify(['importExternal',c.role,p]);
 if(db.requests[c.key]){check(db.requests[c.key].fingerprint===fingerprint,'幂等键冲突');return db}
 const prior=(db.externalIntakes||[]).find(x=>x.sourceType===p.sourceType&&x.sourceSystem===p.sourceSystem&&x.externalOrderId===p.externalOrderId&&(x.sourcePlatform||'')===(p.sourcePlatform||''));
 if(prior){check(prior.fingerprint===JSON.stringify(p),'外部订单号已存在且内容不同，请人工核对，禁止覆盖');return db}
 const next=create(db,{...c,role:c.role==='customer'?'ops':c.role,action:'create',payload:{...p,customer:p.customer||p.pickupContact,quoteMode:'manual'}},now),o=next.orders[0];
 const intake={id:'EXT-'+String((next.externalIntakes||[]).length+1).padStart(3,'0'),sourceType:p.sourceType,sourceSystem:p.sourceSystem,sourcePlatform:p.sourcePlatform||null,externalOrderId:p.externalOrderId,orderId:o.id,version:1,fingerprint:JSON.stringify(p),createdAt:new Date(now).toISOString(),dispatchRequestedAt:quickCustomerRequest?new Date(now).toISOString():null};
 (next.externalIntakes??=[]).push(intake);if(c.role==='customer')o.events[0].role='customer';o.externalSource={sourceType:p.sourceType,sourceSystem:p.sourceSystem,sourcePlatform:p.sourcePlatform||null,externalOrderId:p.externalOrderId,intakeId:intake.id};o.events.push({text:quickCustomerRequest?'用户提交配送需求，等待调度核验货物、报价与服务区域；尚未派车':'外部订单人工校对后导入；仅建立草稿，不代表已派单',role:c.role,at:new Date(now).toISOString()});next.requests[c.key]={fingerprint,id:o.id};return next;
}
export function requestExternalDispatch(db,c,now=Date.now()){
 check(['ops','dispatch','customer'].includes(c.role),'无权限申请派单');check(c.key,'缺少幂等键');const fingerprint=JSON.stringify([c.action,c.id,c.role,c.payload||{}]);if(db.requests[c.key]){check(db.requests[c.key].fingerprint===fingerprint,'幂等键冲突');return db}
 const next=structuredClone(db),o=next.orders.find(x=>x.id===c.id),item=next.externalIntakes?.find(x=>x.orderId===c.id);check(o&&item&&(c.role!=='customer'||item.sourceSystem==='DEMO-USER-001'&&item.sourceType==='customer'),'外部订单不存在');check(o.version===c.version,'订单版本变化，请刷新');check(['draft','awaiting_dispatch'].includes(o.status),'订单已进入执行或结束，不能重复申请');
 if(!item.dispatchRequestedAt){item.dispatchRequestedAt=new Date(now).toISOString();item.version++;o.version++;o.events.push({text:'来源申请派单，等待调度核验报价和运力；尚未分配车辆',role:c.role,at:new Date(now).toISOString()});}next.requests[c.key]={fingerprint,id:o.id};return next;
}
export function contactDetails(o,{e}){if(!o.pickupAddress)return '';return `<div class="info-box"><strong>取送联系信息 · 仅合成演示</strong><p>取件：${e(o.pickupAddress)}<br>${e(o.pickupContact)} · ${e(o.pickupPhone)}</p><p>送件：${e(o.destination)}<br>${e(o.deliveryContact)} · ${e(o.deliveryPhone)}</p><small>上门取件不等于已入仓；现场放行、点收交接仍须分别留证。</small></div>`;}
