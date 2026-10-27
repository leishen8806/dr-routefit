import {FeeClient} from './fee-api-client.mjs';
import {display,feeDTO,trialDTO,snapshotChanged,formatTrialInput,policyErrorMessage} from './fee-api-model.mjs';
import {requiredReason} from './orders-ui-rules.mjs';
import {policySnapshotRows} from './policy-view.mjs';
const controlsStylesheet=document.createElement('link');controlsStylesheet.rel='stylesheet';controlsStylesheet.href='controls.css';document.head.append(controlsStylesheet);
const $=id=>document.getElementById(id),client=new FeeClient(),form=$('fee-form');
let catalog=[],tariffs=[],current=null,etag=null,code=null,dirty=false,busy=false,connected=false,sequence=0,nextAfter=null,historyAfter=null,historyId=null,latest=null,pendingApply=null,tab='edit',snapshot=null,createDirty=false,policy=null,policyEtag=null;
const field=name=>form.elements.namedItem(name);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const message=text=>$('status').textContent=text;
const canWrite=()=>connected&&client.identity?.permissions.includes('pricing:write');
const canRead=()=>connected&&client.identity?.permissions.includes('pricing:read');
function errorsClear(){ $('errors').hidden=true;$('error-list').replaceChildren();form.querySelectorAll('[aria-invalid]').forEach(x=>{x.removeAttribute('aria-invalid');x.removeAttribute('aria-describedby');});document.title='费用设置 · DR RouteFit'; }
const messages={VERSION_CONFLICT:'服务端版本已变化。你的输入已保留，请读取最新版本并比较。',RESULT_UNKNOWN:'连接失败或结果未知。若为保存请求，请保留输入并按原请求重试，勿重新创建。',IDENTITY_CHANGED:'开发身份已变化。已清除旧身份资源与待处理请求，请重新读取当前企业草稿。',FORBIDDEN:'无此操作权限，请联系负责人。',INDEPENDENT_REVIEW_REQUIRED:'职责分离校验未通过，请使用独立的复核或发布会话。',INVALID_STATE:'策略状态不允许此操作，请先读取当前策略。',SOURCE_VERSION_CHANGED:'来源费率草稿已变化，请重新提交策略。',CAPABILITY_DISABLED:'当前费目能力未接通，不能发布策略。',BASE_FEE_REQUIRED:'发布策略前必须显式配置基础费。',INVALID_POLICY_WINDOW:'请检查策略有效期、报价有效期和服务等级。',NOT_FOUND:'对象不可用或已无访问权限。',PENDING_OPERATION:'有一笔操作尚未确认，请先按原请求重试。',INVALID_RESPONSE:'响应无法确认，尚未显示保存成功。'};
function showError(error){
 const text=(error.code==='VERSION_CONFLICT'||error.code==='INDEPENDENT_REVIEW_REQUIRED')?policyErrorMessage(error.code):messages[error.code]||(error.status===401?'会话已失效，请重新建立本机开发会话。':error.status===403?'无此操作权限或会话校验失败，请重新连接或联系负责人。':error.status===404?'对象不可用或已无访问权限。':error.status===422?'字段或费用规则不正确，请检查输入。':error.status===429?'请求过于频繁，请稍后按原请求重试。':error.status>=500?'服务暂不可用，保存结果尚未确认。':error.message||'操作失败');
 $('errors').hidden=false;$('error-list').replaceChildren(el('p',text));
 for(const f of error.fields||[]){const name=String(f.path||'').replace(/^\//,'').split('/').at(-1);const input=field(name);if(!input)continue;input.id||='fee-'+name;input.setAttribute('aria-invalid','true');const p=el('p',f.message||f.code||'请检查此字段');p.id='error-'+name;input.setAttribute('aria-describedby',p.id);const a=el('a',`${({amount:'金额或比例',step:'计费步长',included:'包含数量',scope:'适用范围',evidence:'配置依据',unit:'单位'})[name]||'输入'}：${f.message||f.code||'请检查输入'}`);a.href='#'+input.id;$('error-list').append(a,p);}
 if(error.requestId){const d=el('details'),s=el('summary','诊断信息');d.append(s,el('p',`${error.code} · ${error.requestId}`));$('error-list').append(d);}
 if(error.status===401){connected=false;$('source').textContent='本机数据库 · 会话不可用';}
 if(error.code==='IDENTITY_CHANGED'){current=null;etag=null;code=null;snapshot=null;createDirty=false;$('create-form').reset();tariffs=[];catalog=[];pendingApply=null;dirty=false;$('tariff').replaceChildren(new Option('请选择草稿',''));$('fees').replaceChildren();form.reset();$('context').textContent='身份已变化，请重新连接';$('trial-inputs').replaceChildren();$('history-list').replaceChildren();$('trial-result').replaceChildren();$('snapshot-result').replaceChildren();$('comparison').hidden=true;}
 $('latest').hidden=error.status!==412;document.title='错误：费用设置 · DR RouteFit';$('errors').focus();sync();
}
async function run(fn){if(busy)return;busy=true;errorsClear();sync();try{await fn();}catch(e){showError(e);}finally{busy=false;sync();}}
function sync(){
 const locked=busy||!!client.pending;
 $('create').disabled=!canWrite()||locked||dirty;$('tariff').disabled=!canRead()||locked;$('more').disabled=!canRead()||locked||!nextAfter;$('refresh').disabled=!canRead()||locked||!current;
 $('fee-fields').disabled=!canWrite()||!current||!code||locked;
 $('save').disabled=!canWrite()||!dirty||locked||!!latest;$('discard').disabled=!dirty||locked;
 $('calculate').disabled=!canRead()||!current||locked||dirty;
 $('retry').hidden=!client.pending;$('retry').disabled=busy;$('connect').disabled=busy;
 $('latest').disabled=busy||!!client.pending;$('accept-version').disabled=busy||!!client.pending;
 $('history-load').disabled=!canRead()||!current||busy;$('history-more').disabled=!canRead()||!historyAfter||busy;
 $('dirty').textContent=dirty?`${catalog.find(x=>x.code===code)?.name||'费目'} · 1项未保存`:'未修改';$('save').textContent=busy?'处理中…':'保存此费目';
 document.querySelectorAll('#create-form input,#create-form select').forEach(n=>n.disabled=!canWrite()||locked);
 $('snapshot-form').querySelector('button').disabled=!canRead()||busy;
 $('policy-panel').hidden=!current;
 if($('policy-load'))$('policy-load').disabled=!canRead()||locked;
 $('policy-submit').disabled=!canWrite()||locked||!current||!!policy;
 $('policy-review').disabled=!connected||locked||!policy||policy.state!=='SUBMITTED'||!client.identity?.permissions.includes('pricing:review');
 $('policy-publish').disabled=!connected||locked||!policy||policy.state!=='REVIEWED'||!client.identity?.permissions.includes('pricing:publish');
 document.querySelectorAll('#fees button').forEach(n=>n.disabled=!current||locked);dynamicFields();
}
function leaveGuard(action){
 if(busy||client.pending){showError({code:'PENDING_OPERATION'});return;}
 if(!dirty&&!createDirty){action();return;}
 const d=$('leave-dialog');d.showModal();$('stay').onclick=()=>d.close();$('leave').onclick=()=>{dirty=false;createDirty=false;$('create-form').reset();edit(code);d.close();action();};
}
window.addEventListener('beforeunload',e=>{if(dirty||createDirty||client.pending){e.preventDefault();e.returnValue='';}});
document.querySelector('[data-leave]').addEventListener('click',e=>{e.preventDefault();const href=e.currentTarget.href;leaveGuard(()=>location.assign(href));});
function options(){const previous=current?.id;$('tariff').replaceChildren(new Option(tariffs.length?'请选择草稿':'本企业尚无草稿',''));for(const t of tariffs)$('tariff').add(new Option(`${t.name} · ${t.owner} / ${t.currency}`,t.id));$('tariff').value=previous||'';}
async function list(append=false){const r=await client.get('/tariffs?limit=50'+(append&&nextAfter?'&after='+encodeURIComponent(nextAfter):''));tariffs=append?[...tariffs,...r.data.items.filter(x=>!tariffs.some(t=>t.id===x.id))]:r.data.items;nextAfter=r.data.nextAfter;options();}
async function connect(){
 await client.connect();connected=true;catalog=(await client.get('/catalog')).data;await list();$('source').textContent='本机数据库 · 开发会话';message(tariffs.length?'已连接，请选择草稿。':'已连接，本企业尚无草稿；可新建数据库草稿。');
}
function context(){ if(snapshot)resultView($('snapshot-result'),snapshot);$('context').textContent=current?`${current.name} · ${current.owner} / ${current.currency} · ${current.state} · v${current.version} · ${current.id} · 最近读取 ${new Date().toLocaleTimeString()}`:'尚未选中草稿';}
async function select(id){
 const ticket=++sequence;if(!id){current=null;etag=null;code=null;policy=null;policyEtag=null;dirty=false;latest=null;form.reset();context();renderList();renderTrial();$('trial-result').replaceChildren();$('history-list').replaceChildren();historyAfter=null;historyId=null;$('comparison').hidden=true;renderPolicy();sync();return;}
 const r=await client.get('/tariffs/'+encodeURIComponent(id));if(ticket!==sequence)return;
 current=r.data;etag=r.etag;policy=null;policyEtag=null;dirty=false;latest=null;$('comparison').hidden=true;$('latest').hidden=true;historyAfter=null;historyId=null;$('history-list').replaceChildren();$('trial-result').replaceChildren();context();renderList();edit(catalog[0]?.code);renderTrial();renderPolicy();message('数据库草稿已读取 · v'+current.version);options();
}
function renderList(){
 const q=$('search').value.trim().toLowerCase(),g=$('group').value,f=$('filter').value;$('fees').replaceChildren();
 for(const item of catalog){const r=current?.rules.find(x=>x.code===item.code),state=!r?'none':r.enabled?'on':'off';if(q&&!(`${item.name} ${item.code}`.toLowerCase().includes(q))||g&&item.group!==g||f&&f!==state)continue;
  const b=el('button',item.name);b.type='button';b.disabled=!current||busy||!!client.pending;b.setAttribute('aria-current',String(item.code===code));b.append(el('small',!r?'未配置':!r.enabled?'已停用':`${({fixed:'固定费用',unit:'按单位',percent:'比例'})[r.method]} · ${r.method==='percent'?display(r.amount,2)+'%':current.currency+' '+display(r.amount,current.currency==='USD'?2:0)}`));b.onclick=()=>leaveGuard(()=>edit(item.code));const li=el('li');li.append(b);$('fees').append(li);
 }
}
function dynamicFields(){
 const item=catalog.find(x=>x.code===code);if(!item)return;const method=field('method').value;$('unit-fields').hidden=method!=='unit';
 $('amount-label').firstChild.textContent=method==='percent'?'比例 · %':`金额 · ${current?.currency||''}`;
 $('basis').textContent=method==='percent'?(item.basis==='goods'?'基数为申报货值，不是费用合计。':'基数为COD代收本金，本金不计入费用合计。'):'金额不得缺失；单位数量最多3位小数。';
 field('share').disabled=!canWrite()||current?.owner!=='DR'||!!item.locked||busy||!!client.pending;if(current?.owner!=='DR'||item.locked)field('share').checked=false;
}
function edit(next){
 errorsClear();code=next;latest=null;dirty=false;$('comparison').hidden=true;$('latest').hidden=true;form.reset();const item=catalog.find(x=>x.code===code),r=current?.rules.find(x=>x.code===code);if(!item){sync();return;}
 $('fee-title').textContent='编辑'+item.name;$('code').textContent=item.code;
 field('method').replaceChildren(new Option('固定费用','fixed'),...(item.units.length?[new Option('按单位','unit')]:[]),...(item.basis?[new Option('比例','percent')]:[]));
 field('unit').replaceChildren(...item.units.map(x=>new Option(x,x)));
 field('enabled').checked=r?.enabled??false;field('method').value=r?.method||'fixed';field('amount').value=r?display(r.amount,r.method==='percent'?2:current.currency==='USD'?2:0):'';field('unit').value=r?.unit||item.units[0]||'';field('included').value=r?display(r.includedMilli,3):'';field('step').value=r?display(r.stepMilli,3):'';field('scope').value=r?.scope||'';field('evidence').value=r?.evidence||'';field('share').checked=r?.share||false;
 sync();dynamicFields();renderList();
}
function formValue(){return Object.fromEntries(['method','amount','unit','included','step','scope','evidence'].map(k=>[k,field(k).value]).concat([['code',code],['enabled',field('enabled').checked],['share',field('share').checked]]));}
form.addEventListener('input',()=>{dirty=true;sync();dynamicFields();});form.addEventListener('change',()=>{dirty=true;sync();dynamicFields();});
async function mutate(path,body,version,apply,permission){pendingApply=apply;const r=await client.mutate(path,body,version,permission);pendingApply=null;await apply(r);}
const isoInput=value=>value?new Date(value+':00+07:00').toISOString():'';
function renderPolicy(){
 if(!$('policy-load')){const row=document.createElement('div');row.className='toolbar';row.innerHTML='<label>读取策略 ID<input id="policy-id" pattern="[0-9a-fA-F-]{36}"></label><button id="policy-load" type="button">读取策略</button>';document.querySelector('#policy-submit-form').before(row);$('policy-load').onclick=()=>run(loadPolicy);}
 const box=$('policy-status'),snapshotBox=$('policy-snapshot');
 if(!current){box.textContent='请选择费用草稿';snapshotBox.hidden=true;sync();return;}
 if(!policy){box.textContent='当前草稿尚未在本页面提交策略申请';snapshotBox.hidden=true;sync();return;}
 box.textContent=`策略 ${policy.state} · v${policy.version} · ${policy.id}`;
 snapshotBox.hidden=false;snapshotBox.replaceChildren();
 const table=el('table');const head=el('tr');head.append(el('th','字段'),el('th','值'));table.append(head);for(const [label,value] of policySnapshotRows(policy,x=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Phnom_Penh',dateStyle:'short',timeStyle:'short'}).format(new Date(x)))){const row=el('tr'),cell=el('td');if(value&&typeof value==='object'){cell.textContent=value.text;if(value.title)cell.title=value.title;}else cell.textContent=String(value);row.append(el('th',label),cell);table.append(row);}snapshotBox.append(el('h3','冻结快照与审核事实'),table);
 sync();
}
async function loadPolicy(){const id=$('policy-id')?.value.trim();if(!id)throw Error('请填写策略 ID');const r=await client.get('/policy-versions/'+encodeURIComponent(id));policy=r.data;policyEtag=r.etag;renderPolicy();message(`策略已读取 · ${policy.state}`);}
function policySubmitValue(){return {validFrom:isoInput($('policy-valid-from').value),validUntil:isoInput($('policy-valid-until').value),quoteValiditySeconds:Number($('policy-ttl').value),serviceLevels:[...document.querySelectorAll('[name="policy-level"]:checked')].map(x=>x.value),reason:$('policy-reason').value.trim()};}
async function applyPolicy(r){policy=r.data;policyEtag=r.etag;renderPolicy();message(`策略已更新 · ${policy.state}`);}
async function policyAction(kind){
 const reason=$(`policy-${kind}-reason`).value.trim();
 if(!requiredReason(reason)){$(`policy-${kind}-reason`).setAttribute('aria-invalid','true');message(kind==='review'?'请填写复核说明。':'请填写发布说明。');$(`policy-${kind}-reason`).focus();return;}
 $(`policy-${kind}-reason`).removeAttribute('aria-invalid');
 const permission=kind==='review'?'pricing:review':'pricing:publish';
 await mutate(`/policy-versions/${policy.id}/actions/${kind}`,{reason:reason.trim()},policyEtag,applyPolicy,permission);
}
async function appliedTariff(r){current=r.data;etag=r.etag;dirty=false;latest=null;if(!tariffs.some(x=>x.id===current.id))tariffs.push(current);options();context();edit(code||catalog[0]?.code);renderTrial();message(`数据库已保存 · v${current.version}${r.replayed?' · 原操作结果重放':''}`);}
form.onsubmit=e=>{e.preventDefault();run(async()=>{const dto=feeDTO(formValue(),catalog.find(x=>x.code===code),current.owner,current.currency);await mutate('/tariffs/'+current.id+'/actions/save-fee',dto,etag,appliedTariff);});};
$('discard').onclick=()=>leaveGuard(()=>edit(code));
$('create-form').onsubmit=e=>{e.preventDefault();const target=e.target,data=new FormData(target),body=Object.fromEntries(['name','owner','currency','scope'].map(k=>[k,String(data.get(k)||'').trim()]));run(async()=>{if(!body.name||!body.scope)throw Error('请填写名称和适用范围');if(dirty)throw Error('请先处理未保存修改');await mutate('/tariffs',body,null,async r=>{code=null;await appliedTariff(r);$('create-panel').open=false;createDirty=false;target.reset();});});};
$('create-form').addEventListener('input',()=>{createDirty=true;});
$('tariff').onchange=e=>{const id=e.target.value;e.target.value=current?.id||'';leaveGuard(()=>run(()=>select(id)));};
$('more').onclick=()=>run(()=>list(true));$('refresh').onclick=()=>leaveGuard(()=>run(()=>select(current.id)));
$('connect').onclick=()=>run(connect);
$('retry').onclick=()=>run(async()=>{const apply=pendingApply;const result=await client.retry();pendingApply=null;if(apply)await apply(result);});
$('latest').onclick=()=>run(async()=>{if(!current)return;const r=await client.get('/tariffs/'+current.id);latest=r;$('comparison').hidden=false;$('compare-values').replaceChildren();for(const [title,value]of [['原已存值',current.rules.find(x=>x.code===code)||'未配置'],['我的输入',formValue()],['最新服务端值',r.data.rules.find(x=>x.code===code)||'未配置']]){const col=el('div');col.append(el('h3',title),el('pre',JSON.stringify(value,null,2)));$('compare-values').append(col);}message('最新版本已读取，原输入未变；请比较后确认编辑基线。');});
$('accept-version').onclick=()=>{if(!latest)return;current=latest.data;etag=latest.etag;latest=null;$('comparison').hidden=true;$('latest').hidden=true;context();renderTrial();sync();message('已采用最新版本为基线；你的输入保留，请检查后显式保存。');};
for(const id of ['search','group','filter'])$(id).addEventListener('input',renderList);
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>leaveGuard(()=>{tab=b.dataset.tab;for(const name of ['edit','trial','history','snapshot'])$(name+'-panel').hidden=name!==tab;document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(tab==='history'&&current)run(()=>history(false));}));
function renderTrial(){
 $('trial-inputs').replaceChildren();for(const r of current?.rules.filter(x=>x.enabled)||[]){const row=el('div');row.className='trial-line';row.dataset.code=r.code;const label=el('label'),check=el('input');check.type='checkbox';check.name='choose';label.className='check';label.append(check,document.createTextNode(catalog.find(x=>x.code===r.code)?.name||r.code));row.append(label);
 if(r.method!=='fixed'){const l=el('label',r.method==='unit'?`计费数量 · ${r.unit}`:r.code==='insurance'?`申报货值 · ${current.currency}`:`COD本金 · ${current.currency}`);const input=el('input');input.name='value';input.inputMode='decimal';l.append(input);row.append(l);}$('trial-inputs').append(row);}
 if(!$('trial-inputs').children.length)$('trial-inputs').append(el('p','没有已配置且启用的费目。'));
}
function resultView(target,t){
 target.replaceChildren(el('h3',`${t.state} · ${t.currency} · 草稿 v${t.tariffVersion}`),el('p',`试算ID ${t.id} · 草稿ID ${t.tariffId}`));
 if(snapshotChanged(current,t))target.append(el('p','当前草稿已变化，此快照仍绑定旧版本。'));
 const table=el('table'),head=el('tr');for(const h of ['费目','数量/基数','计费步数','金额'])head.append(el('th',h));table.append(head);
 for(const line of t.lines){const tr=el('tr');for(const v of [line.code,formatTrialInput(line,t.currency),String(line.units),display(line.amountMinor,t.currency==='USD'?2:0)])tr.append(el('td',v));table.append(tr);}target.append(table);
 for(const [label,key]of [['费用合计','totalMinor'],['配送分成基数','shareMinor'],['不参与分成费用','separateMinor'],['其中保险独立金额','insuranceMinor']])target.append(el('p',`${label}：${t.currency} ${display(t[key],t.currency==='USD'?2:0)}`));
 target.append(el('p','保险属于不参与分成费用子集，不重复相加。SIMULATION不是正式收费、分成批准或司机收入。'));
}
$('trial-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(dirty)throw Error('请先保存或放弃修改');const inputs=[...$('trial-inputs').children].filter(row=>row.querySelector('[name=choose]')?.checked).map(row=>({code:row.dataset.code,value:row.querySelector('[name=value]')?.value}));const body=trialDTO(current.rules,inputs,current.currency);await mutate('/tariffs/'+current.id+'/trials',body,etag,async r=>{resultView($('trial-result'),r.data);$('trial-id').value=r.data.id;message('持久试算已创建 · SIMULATION'+(r.replayed?' · 原操作结果重放':''));});});};
async function history(append){if(!current)return;const id=current.id,cursor=append?historyAfter:null,r=await client.get('/tariffs/'+id+'/revisions?limit=10'+(cursor?'&afterVersion='+cursor:''));if(current?.id!==id)return;if(!append||historyId!==id)$('history-list').replaceChildren();historyId=id;for(const entry of r.data.items){const d=el('details'),s=el('summary',`v${entry.version} · ${entry.createdAt}`);d.append(s,el('pre',JSON.stringify(entry.snapshot,null,2)));$('history-list').append(d);}historyAfter=r.data.nextAfterVersion;}
$('history-load').onclick=()=>run(()=>history(false));$('history-more').onclick=()=>run(()=>history(true));
$('snapshot-form').onsubmit=e=>{e.preventDefault();run(async()=>{const id=$('trial-id').value.trim();if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('请填写有效的试算ID');const r=await client.get('/trials/'+encodeURIComponent(id));snapshot=r.data;resultView($('snapshot-result'),snapshot);message('已从数据库读取不可改试算快照。');});};
$('policy-submit-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(!current)throw Error('请先选择费用草稿');const body=policySubmitValue();if(body.serviceLevels.length===0)throw Error('至少选择一个服务等级');if(!body.validFrom||!body.validUntil||!body.reason)throw Error('请填写策略有效期、服务等级和提交依据');await mutate('/tariffs/'+current.id+'/policy-versions',body,etag,applyPolicy,'pricing:write');});};
$('policy-review').onclick=()=>run(()=>policyAction('review'));
$('policy-publish').onclick=()=>run(()=>policyAction('publish'));
await run(connect);
