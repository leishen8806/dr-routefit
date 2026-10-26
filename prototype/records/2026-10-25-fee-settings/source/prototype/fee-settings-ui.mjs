import {feeOwners,feeGroups,feeCatalog,feeMethods,feeUnits,feeRule,feeKey,feeMoney} from './fee-settings.mjs';
let owner='DR',currency='USD',group='transport',historyPage=1;
const select=(name,label,values,current,e)=>`<label class="field"><span>${e(label)}</span><select name="${name}" data-fee-filter="${name}">${Object.entries(values).map(([key,text])=>`<option value="${key}" ${current===key?'selected':''}>${e(text)}</option>`).join('')}</select></label>`;
const ruleText=r=>r.method==='fixed'?`${feeMoney(r.amount,r.currency)} / 单`:r.method==='percent'?`${r.amount/100}% × ${r.code==='insurance'?'申报货值':'COD 本金'}`:`${feeMoney(r.amount,r.currency)} / ${r.step/1000} ${feeUnits[r.unit]}；含 ${r.included/1000}`;
const configured=db=>feeCatalog.map(item=>({item,rule:feeRule(db,feeKey(owner,currency,item.code))}));
export function feeSettingsView(h){
 const {db,e,role,sectionTab,time}=h,rows=configured(db),settings=db.feeSettings;
 const controls=`<div class="form-grid">${select('owner','费用对象',feeOwners,owner,e)}${select('currency','独立计价币种',{USD:'USD · 美元',KHR:'KHR · 瑞尔'},currency,e)}</div>`;
 const note=`<div class="info-box"><strong>${e(feeOwners[owner])} · 演示配置</strong><p>对客收费与承运采购分开设置；未知费率留空，明确免费才填 0。当前仅保存配置和人工试算，不自动给订单加价。保险、COD 本金独立记账。</p></div>`;
 if(sectionTab==='fee-history'){
  const all=[...(settings?.history||[])].filter(x=>x.after.owner===owner&&x.after.currency===currency).reverse();historyPage=Math.min(historyPage,Math.max(1,Math.ceil(all.length/8)));
  return `<div class="platform-detail">${controls}${note}<h3>费用配置变更 · ${all.length} 条</h3><div class="table-wrap data-table-scroll"><table><thead><tr><th>费用 / 版本</th><th>变更前 → 变更后</th><th>原因与操作者</th></tr></thead><tbody>${all.slice((historyPage-1)*8,historyPage*8).map(x=>`<tr><td>${e(feeCatalog.find(f=>f.code===x.after.code).name)}<small>v${x.after.version} · ${time(x.at)}</small></td><td>${x.before?e(ruleText(x.before)):'未配置'} → ${e(ruleText(x.after))}<small>${x.after.enabled?'启用试算':'停用'} · ${e(x.after.scope)}</small></td><td>${e(x.after.evidence)}<small>${e(x.actorId)} / ${e(x.role)}</small></td></tr>`).join('')||'<tr><td colspan="3">暂无配置变更。保存一项费用后可查看前后版本。</td></tr>'}</tbody></table></div><div class="table-foot"><button class="btn" data-fee-page="-1" ${historyPage===1?'disabled':''}>上一页</button><span>${historyPage} / ${Math.max(1,Math.ceil(all.length/8))}</span><button class="btn" data-fee-page="1" ${historyPage*8>=all.length?'disabled':''}>下一页</button></div></div>`;
 }
 if(sectionTab==='fee-trial'){
  const trial=[...(settings?.trials||[])].reverse().find(x=>x.owner===owner&&x.currency===currency),stale=trial&&trial.revision!==settings.revision;
  return `<div class="platform-detail">${controls}${note}<div class="actions">${h.btn('新建费用试算','feeTrial','primary',!rows.some(x=>x.rule?.enabled))}</div><p class="muted">仅勾选本次实际需要的服务；请先配置并启用至少一项费用。试算不代表已承诺配送、承保或产生应付。</p>${trial?`<h3>最近试算 · ${e(trial.id)} <span class="pill ${stale?'warning':''}">${stale?'配置已有变更，请重新试算':'已保存试算快照'}</span></h3><div class="facts">${h.fact(owner==='DR'?'服务费用合计':'采购费用合计',feeMoney(trial.totalMinor,currency))}${h.fact('其中保险费',feeMoney(trial.insuranceMinor,currency))}${h.fact('配送分成基数',feeMoney(trial.shareMinor,currency))}${h.fact('不参与分成费用',feeMoney(trial.separateMinor,currency))}</div><div class="table-wrap data-table-scroll"><table><thead><tr><th>费用</th><th>计费依据</th><th>小计 / 归属</th></tr></thead><tbody>${trial.lines.map(x=>`<tr><td>${e(x.name)}<small>v${x.rule.version} · ${e(x.rule.scope)}</small></td><td>${e(ruleText(x.rule))}<small>${x.rule.method==='unit'?`输入 ${x.quantity/1000} / 计费 ${x.units} 个步长`:x.rule.method==='percent'?`计费基数 ${feeMoney(x.quantity,currency)}`:'固定单次服务'}</small></td><td>${feeMoney(x.amountMinor,currency)}<small>${x.rule.share?'参与配送分成':'独立记账，不分成'}</small></td></tr>`).join('')}</tbody></table></div><p class="muted small">${time(trial.at)} · 按费用项四舍五入到币种最小单位。COD 本金未加入上述服务费用；司机收入仍按订单确认的分成处理。</p>`:'<div class="status-panel"><h3>尚未试算</h3><p>保存费用规则后，选择服务项目并填写本次计费量。</p></div>'}</div>`;
 }
 return `<div class="platform-detail">${controls}${note}<div class="tabs" aria-label="费用分类">${Object.entries(feeGroups).map(([id,label])=>`<button data-fee-group="${id}" class="${id===group?'active':''}" aria-pressed="${id===group}">${label}</button>`).join('')}</div><div class="table-wrap data-table-scroll"><table><thead><tr><th>独立费目</th><th>规则与适用范围</th><th>状态 / 分成</th><th>配置</th></tr></thead><tbody>${rows.filter(({item})=>item.group===group).map(({item,rule})=>`<tr><td><strong>${item.name}</strong><small>${item.code==='cod'?'仅服务费，货款本金另记':item.code==='insurance'?'收费不代表已经承保':''}</small></td><td>${rule?e(ruleText(rule)):'尚未配置'}<small>${e(rule?.scope||'需填写线路、服务及包含范围')}</small></td><td>${rule?(rule.enabled?'已启用试算':'已停用'):'待配置'}<small>${rule?.share?'参与配送分成':'不参与配送分成'}</small></td><td>${role==='ops'?`<button class="btn small" data-fee-edit="${feeKey(owner,currency,item.code)}" data-fee-write>${rule?'编辑':'设置'}</button>`:'只读'}</td></tr>`).join('')}</tbody></table></div><p class="muted small">VET、中通、CE、极兔的公开宣传价未预填。配置只在本浏览器会话保存，正式上线需后台鉴权、审核发布及报价版本服务。</p></div>`;
}
export function feeSettingsForm(action,h){
 if(!['feeEdit','feeTrial'].includes(action))return null;
 const {db,e,field,checkField,selectedResource}=h;
 if(action==='feeEdit'){
  const id=selectedResource,[targetOwner,targetCurrency,code]=id.split(':'),item=feeCatalog.find(x=>x.code===code),r=feeRule(db,id);
  if(!item)return null;
  const methods={fixed:feeMethods.fixed,...(item.units.length?{unit:feeMethods.unit}:{}),...(item.basis?{percent:feeMethods.percent}:{})},method=r?.method||'fixed';
  return {title:'设置'+item.name,submit:'保存演示配置',action:'feeSave',target:{id,version:r?.version||0},body:`<div class="info-box">${e(feeOwners[targetOwner])} · ${targetCurrency} · 仅影响后续试算，已确认订单金额保持原快照。</div><div class="form-grid">${select('method','计费方式',methods,method,e)}${field('amount','金额或比例数值',r?r.amount/(method==='percent'||targetCurrency==='USD'?100:1):'','text',false,'固定／按单位：填写当前币种金额；按比例：填写百分数，例如 1 表示 1%。')}${select('unit','按单位计费时的单位',Object.fromEntries(item.units.map(x=>[x,feeUnits[x]])),r?.unit||item.units[0],e)}${field('included','包含量／免费额度',r?r.included/1000:'0','text',false,'按单位时生效；计费量不足包含量不收费。')}${field('step','每个计费步长',r?r.step/1000:'1','text',false,'超出包含量后，按此步长向上取整；最多三位小数。')}${field('scope','适用线路、服务与包含范围',r?.scope||'','text',true)}${field('evidence','配置依据／变更原因',r?.evidence||'','text',true)}</div>${checkField('enabled','启用此项费用供人工试算').replace('type="checkbox"','type="checkbox"'+(r?.enabled?' checked':''))}${targetOwner==='DR'&&!item.locked?checkField('share','此项费用参与订单配送费分成').replace('type="checkbox"','type="checkbox"'+(r?.share?' checked':'')):'<input type="hidden" name="share" value="false"><p class="muted">此费目独立记账，不参与配送分成。</p>'}<p class="muted small">按比例时：保险以申报货值为基数，COD 服务费以代收货款本金为基数。计费量、地区与服务适配由人工核验。</p>`};
 }
 const rows=configured(db).filter(x=>x.rule?.enabled);
 return {title:'费用明细试算',submit:'计算并保存试算',action:'feeTrial',target:{id:'fee-trial',version:db.feeSettings?.revision||0},body:`<div class="info-box">${e(feeOwners[owner])} · ${currency}。只勾选本次实际服务，退回、取消、二次配送不自动叠加。COD 本金不计入服务费用合计。</div><input type="hidden" name="owner" value="${owner}"><input type="hidden" name="currency" value="${currency}">${rows.map(({item,rule})=>`<fieldset><legend>${item.name}</legend>${checkField('use_'+item.code,'计入本次：'+ruleText(rule))}<p class="muted small">${e(rule.scope)}</p>${rule.method==='fixed'?'':field('qty_'+item.code,rule.method==='percent'?(item.basis==='goods'?'申报货值':'COD 本金')+' · '+currency:'本次总计费量 · '+feeUnits[rule.unit],'','text',false,rule.method==='unit'?'输入总量，系统扣除包含量后按步长向上取整。':'本金仅作计算依据，不计入服务费合计。')}</fieldset>`).join('')}`};
}
export function bindFeeSettings(root,h,render,edit){
 root.querySelectorAll('[data-fee-filter]').forEach(el=>el.onchange=()=>{if(el.name==='owner')owner=el.value;else currency=el.value;historyPage=1;render();root.querySelector(`[data-fee-filter="${el.name}"]`)?.focus();});
 root.querySelectorAll('[data-fee-group]').forEach(el=>el.onclick=()=>{group=el.dataset.feeGroup;render();root.querySelector(`[data-fee-group="${group}"]`)?.focus();});
 root.querySelectorAll('[data-fee-edit]').forEach(el=>el.onclick=()=>edit(el.dataset.feeEdit));
 root.querySelectorAll('[data-fee-page]').forEach(el=>el.onclick=()=>{historyPage+=Number(el.dataset.feePage);render();});
}
export function bindFeeForm(dialog){
 const method=dialog.querySelector('[name=method]');if(!method)return;
 const update=()=>{
  for(const name of ['unit','included','step']){const input=dialog.querySelector(`[name=${name}]`);if(input){input.closest('label').style.display=method.value==='unit'?'':'none';input.disabled=method.value!=='unit';}}
  const amount=dialog.querySelector('[name=amount]');amount.closest('label').querySelector('span').textContent=method.value==='percent'?'费率 %':'金额（当前价表币种）';
 };
 method.addEventListener('change',update);update();
 const share=dialog.querySelector('[name=share][type=hidden]');if(share){share.type='checkbox';share.hidden=true;share.checked=false;}
}
