const MAX=9000000000000;
export function decimal(value,digits,max=MAX){
 const text=String(value??'').trim();
 if(!new RegExp(`^\\d+${digits?'(?:\\.\\d{1,'+digits+'})?':''}$`).test(text))throw Error(`请填写非负数字，最多${digits}位小数`);
 const [whole,fraction='']=text.split('.');const n=BigInt(whole)*10n**BigInt(digits)+BigInt(fraction.padEnd(digits,'0')||'0');
 if(n>BigInt(max))throw Error('数值超出允许范围');return Number(n);
}
export function display(value,digits){
 const text=String(value);if(!digits)return text;return text.padStart(digits+1,'0').slice(0,-digits)+'.'+text.padStart(digits+1,'0').slice(-digits);
}
export function formatTrialInput(line,currency){
 const input=line?.input||{};
 const rule=line?.rule||{};
 if(rule.method==='unit'&&input.quantityMilli!==null&&input.quantityMilli!==undefined)
  return `${display(input.quantityMilli,3)} ${rule.unit||''}`.trim();
 if(rule.method==='percent'&&input.basisMinor!==null&&input.basisMinor!==undefined){
  const code=line?.code||rule.code;
  const basis=code==='insurance'?'货值':'COD本金';
  return `${display(input.basisMinor,currency==='USD'?2:0)} ${currency} ${basis}`;
 }
 return '—';
}
function input(name,work){try{return work();}catch(e){throw Object.assign(e,{status:422,code:'VALIDATION_FAILED',fields:[{path:'/'+name,code:'INVALID_VALUE',message:e.message}]});}}
export function feeDTO(form,item,owner,currency){
 if(!item||form.code!==item.code)throw Error('请选择目录费目');
 if(!form.scope.trim()||!form.evidence.trim())throw Error('请填写适用范围和配置依据');
 if(!['fixed','unit','percent'].includes(form.method))throw Error('请选择计费方式');
 if(form.method==='percent'&&!item.basis)throw Error('该费目不支持比例计费');
 const unit=form.method==='unit';if(unit&&!item.units?.includes(form.unit))throw Error('请选择允许的单位');
 const step=unit?input('step',()=>decimal(form.step,3)):1000;if(!step)throw Error('步长必须大于0');
 return {code:form.code,enabled:!!form.enabled,method:form.method,amount:input('amount',()=>decimal(form.amount,form.method==='percent'?2:currency==='USD'?2:0,form.method==='percent'?10000:MAX)),unit:unit?form.unit:null,includedMilli:unit?input('included',()=>decimal(form.included,3)):0,stepMilli:step,share:owner==='DR'&&!item.locked&&!!form.share,scope:form.scope.trim(),evidence:form.evidence.trim()};
}
export function trialDTO(rules,inputs,currency){
 if(!inputs.length||new Set(inputs.map(x=>x.code)).size!==inputs.length)throw Error('请显式选择不重复的已启用费目');
 return {lines:inputs.map(x=>{const r=rules.find(r=>r.code===x.code&&r.enabled);if(!r)throw Error('费目未配置或已停用');return {code:x.code,quantityMilli:r.method==='unit'?decimal(x.value,3):null,basisMinor:r.method==='percent'?decimal(x.value,currency==='USD'?2:0):null};})};
}

export function snapshotChanged(current,snapshot){return !!current&&snapshot.tariffId===current.id&&snapshot.tariffVersion!==current.version;}
