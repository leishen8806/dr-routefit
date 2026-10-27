import {createOrderClient,OrderApiError} from './order-client.mjs';
import {escapeHtml as esc,formField as field,showToast} from './ui-primitives.mjs';
import {quoteDetailHtml} from './quote-view.mjs';
import {intakeInputFromValues} from './order-intake-view.mjs';
import {intakeFieldForPath,retainedPoint} from './orders-ui-rules.mjs';

const $=s=>document.querySelector(s),api=createOrderClient(),form=$('#order-form');
let customers=[],customerCursor=null,current=null,latest=null,dirty=false,busy=false,connected=false,page=0,cursors=[null],nextCursor=null,intakeReport=null,quote=null,quoteEtag=null;
const serviceNames={S1:'及时送',S2:'当日送',S3:'预约送'};
const stateNames={draft:'草稿',validating:'核验中',quoted:'已生成报价'};
const blankItem=()=>({clientItemId:crypto.randomUUID(),name:'',quantity:1,lengthCm:null,widthCm:null,heightCm:null,weightKg:null,rotationAllowed:false,stackable:false,uprightOnly:false,restrictions:[],measurementEvidenceIds:[]});
const blank=()=>({customerId:customers[0]?.id||'',pickup:{address:'',contactName:'',phone:'',point:null},delivery:{address:'',contactName:'',phone:'',point:null},items:[blankItem()],serviceLevel:'S2',exclusiveVehicle:false,paymentTerms:'PREPAID',requestedPickupWindow:{},requestedDeliveryWindow:{},notes:''});
const localTime=iso=>iso?new Date(Date.parse(iso)+7*3600000).toISOString().slice(0,16):'';
const displayTime=iso=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Phnom_Penh',dateStyle:'short',timeStyle:'short'}).format(new Date(iso));
const check=(name,label,value)=>`<label class="checks"><input type="checkbox" name="${name}" ${value?'checked':''}> ${label}</label>`;
function notice(message){$('#notice').textContent=message;$('#notice').hidden=!message;if(message)$('#notice').focus();}
function step(name){document.querySelectorAll('[data-panel]').forEach(n=>n.hidden=n.dataset.panel!==name);document.querySelectorAll('[data-step]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.step===name)));}
function controls(){
 const readonly=current&&current.order.state!=='draft';
 $('#new-order').disabled=!connected||busy||api.pending||!api.session?.permissions.includes('orders:create');
 $('#refresh-list').disabled=!connected||busy;
 $('#reconnect').disabled=busy;
 $('#editor-fields').disabled=busy||api.pending||!connected||readonly;
 $('#fill-sample').disabled=busy||api.pending||!connected||readonly;
 $('#save-order').disabled=busy||api.pending||!connected||readonly||!api.session?.permissions.includes(current?'orders:edit':'orders:create');
 $('#retry-save').hidden=!api.pending;$('#retry-save').disabled=busy||!connected;
 const intakeReady=!!current&&connected;
 $('#intake-panel').hidden=!current;
 $('#save-intake-evidence').disabled=busy||api.pending||!intakeReady||current?.order.state!=='draft'||!api.session?.permissions.includes('orders:verify');
 $('#check-intake').disabled=busy||api.pending||!intakeReady||!api.session?.permissions.includes('orders:read');
 $('#submit-intake').disabled=busy||api.pending||!intakeReady||current?.order.state!=='draft'||!api.session?.permissions.includes('orders:submit')||!intakeReport?.ready;
 $('#return-to-draft').disabled=busy||api.pending||!intakeReady||!['validating','quoted'].includes(current?.order.state)||!api.session?.permissions.includes('orders:edit');
 $('#quote-panel').hidden=!current;
 $('#load-quote').disabled=busy||api.pending||!current||!api.session?.permissions.includes('quotes:read')||!current.order.quoteId;
 $('#generate-quote').disabled=busy||api.pending||!current||!['validating','quoted'].includes(current.order.state)||!api.session?.permissions.includes('quotes:create')||!!quote&&quote.state==='issued';
 $('#confirm-quote').disabled=busy||api.pending||!quote||quote.state!=='issued'||!api.session?.permissions.includes('quotes:confirm');
 $('#back-list').disabled=busy||api.pending;$('#compare-latest').disabled=busy;$('#use-latest').disabled=busy;
 $('#previous-page').disabled=busy||!connected||page===0;$('#next-page').disabled=busy||!connected||!nextCursor;
 form.setAttribute('aria-busy',String(busy));
}
function failure(error){
 const messages={RESULT_UNKNOWN:'尚未确认保存结果。输入已保留并锁定；恢复连接后重试原请求，避免重复建单。',UNAUTHENTICATED:'开发会话已过期。请在终端生成一次性链接，在另一个标签页激活同一身份，再点“重新连接”。',FORBIDDEN:'当前身份没有此操作权限。请使用获授权的开发身份。',VERSION_CONFLICT:'订单或报价版本已变化，请重新读取后再决定。',CAPABILITY_DISABLED:'所提交的能力尚未接通，请检查当前切片支持范围。',POLICY_NOT_PUBLISHED:'只能选择已独立复核批准的策略。',POLICY_NOT_EFFECTIVE:'策略当前不在有效期内。',SERVICE_NOT_SUPPORTED:'策略不支持本单服务等级。',FEE_NOT_ENABLED:'策略缺少已启用费目，请先完成费率审核。',INTAKE_BLOCKED:'受理依据或配送区域已失效，请退回草稿重新核验。',INVALID_STATE:'当前订单状态不允许生成报价。',QUOTE_NOT_USABLE:'报价已过期或被替代，不能确认。',INVALID_TIME_WINDOW:'请检查时间窗：开始须早于结束，送货不能完全早于取货。',MEASUREMENT_REASON_REQUIRED:'尺寸或重量未知时，请填写未知原因。',NOT_FOUND:'记录不存在或当前身份无权访问。'};
 if(error.status===401){connected=false;$('#connection').textContent='会话不可用 · 输入暂留本页';}
 if(error.status===412){$('#conflict').hidden=false;latest=null;$('#use-latest').hidden=true;$('#latest-summary').textContent='';}
 notice((error.status===0||error.status>=500)?(api.pending?messages.RESULT_UNKNOWN:'暂时无法读取服务端，请恢复连接后重试。'):messages[error.code]||(error.status===401?messages.UNAUTHENTICATED:error.status===412?messages.VERSION_CONFLICT:`操作未完成（${error.code||'ERROR'}）。请核对字段或重新连接。`));
 for(const e of error.fields||[]){const name=e.path.replace(/^\//,'').replaceAll('/','.');mark(name,'请检查此项的格式或范围');}
 focusFirstError();controls();
}
function customerOptions(value){$('#customer').innerHTML=customers.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');$('#customer').value=value;$('#more-customers').hidden=!customerCursor;}
async function loadCustomers(reset=false){
 const selected=$('#customer').value;
 const data=await api.read('/api/ops/v1/customers?limit=100'+(!reset&&customerCursor?'&cursor='+encodeURIComponent(customerCursor):''));
 const retained=customers.find(c=>c.id===selected);
 customers=reset?data.items:[...customers,...data.items];if(retained&&!customers.some(c=>c.id===selected))customers.push(retained);customerCursor=data.nextCursor;customerOptions(selected||customers[0]?.id||'');
}
async function loadList(){
 $('#order-rows').innerHTML='<tr><td colspan="5">正在读取服务端…</td></tr>';
 const data=await api.read('/api/ops/v1/orders?limit=10'+(cursors[page]?'&cursor='+encodeURIComponent(cursors[page]):''));nextCursor=data.nextCursor;
 $('#order-rows').innerHTML=data.items.length?data.items.map(o=>`<tr><td><strong>${esc(o.orderNo)}</strong><br><small>版本 ${o.version}</small></td><td>${esc(serviceNames[o.serviceLevel]||o.serviceLevel)}</td><td>${esc(stateNames[o.state]||o.state)} · 未派单<br>${esc(({unpaid:"未收款",reported:"收款资料待核销",partial:"部分核销",allocated:"已核销",disputed:"有争议"})[o.collectionState]||"收款状态待核实")}</td><td>${esc(displayTime(o.updatedAt))}</td><td><button class="btn" data-open="${esc(o.id)}">${o.state==="draft"?"查看 / 编辑":"只读查看"}</button></td></tr>`).join(''):'<tr><td colspan="5">还没有草稿。从“新建订单”记录第一笔需求。</td></tr>';
 $('#page-range').textContent=`第 ${page+1} 页 · 本页 ${data.items.length} 单 · 时间为金边时间`;
}
async function work(action){if(busy)return;let failed=false;busy=true;controls();try{await action();}catch(e){failed=true;failure(e);}finally{busy=false;controls();if(failed)focusFirstError();}}
async function refresh(){await work(async()=>{try{await loadList();notice('');}catch(e){$('#order-rows').innerHTML='<tr><td colspan="5">读取失败，请恢复连接后刷新；这里不代表订单为空。</td></tr>';throw e;}});}
async function connect(){await work(async()=>{
 try{await api.connect();}catch(e){if(e.code==='IDENTITY_CHANGED'){current=null;latest=null;dirty=false;form.reset();$('#order-editor').hidden=true;$('#orders-list').hidden=false;$('#contacts-fields').replaceChildren();$('#cargo-items').replaceChildren();$('#service-fields').replaceChildren();$('#customer').replaceChildren();$('#latest-summary').textContent='';$('#order-rows').replaceChildren();customers=[];page=0;cursors=[null];notice('身份已变化，旧身份输入已清除。请在原身份下查询未确认的保存结果。');}else throw e;}
 connected=true;$('#connection').textContent='已连接本机数据库 · 开发会话';$('#identity').textContent=`企业 ${api.session.companyId} · 身份 ${api.session.principalId} · 非生产登录`;
 await loadCustomers(true);await loadList();
 });}
function renderCargo(items){$('#cargo-items').innerHTML=items.map((item,i)=>`<fieldset class="orders-cargo" data-item="${esc(item.clientItemId)}"><legend>货物 ${i+1}</legend><div class="form-grid">${field(`items.${i}.name`,'货物名称',item.name)}${field(`items.${i}.quantity`,'数量（件）',item.quantity,'number')}${['lengthCm','widthCm','heightCm','weightKg'].map((k,j)=>field(`items.${i}.${k}`,['长（cm）','宽（cm）','高（cm）','单件重量（kg）'][j],item[k]??'','number')).join('')}${field(`items.${i}.unknownReason`,'未知尺寸 / 重量的原因',item.unknownReason||'','text',true)}${field(`items.${i}.restrictions`,'运输限制（逗号分隔）',item.restrictions.join(', '),'text',true)}</div><div>${check(`items.${i}.rotationAllowed`,'允许旋转',item.rotationAllowed)}${check(`items.${i}.stackable`,'允许堆叠',item.stackable)}${check(`items.${i}.uprightOnly`,'必须直立',item.uprightOnly)}</div><button class="btn" type="button" data-remove="${i}" ${items.length===1?'disabled':''}>移除货物 ${i+1}</button></fieldset>`).join('');}
function render(draft,detail=null){
 current=detail;latest=null;dirty=false;intakeReport=null;quote=null;quoteEtag=null;notice('');$('#conflict').hidden=true;$('#use-latest').hidden=true;$('#latest-summary').textContent='';
 customerOptions(draft.customerId);
 $('#contacts-fields').innerHTML=['pickup','delivery'].map((side,i)=>`<h3>${i?'送货':'取货'}信息</h3><div class="form-grid">${field(`${side}.address`,'详细地址',draft[side].address,'text',true)}${field(`${side}.contactName`,'联系人',draft[side].contactName)}${field(`${side}.phone`,'联系电话',draft[side].phone,'tel')}${field(`${side}.landmark`,'地标 / 交接点',draft[side].landmark||'','text',true)}${field(`${side}.lng`,'经度（可选）',draft[side].point?.lng??'','number',true)}${field(`${side}.lat`,'纬度（可选）',draft[side].point?.lat??'','number',true)}</div><p class="hint">经纬度可留空；不填则按未定位处理，受理检查会阻断。</p>`).join('');
 renderCargo(draft.items);
 $('#service-fields').innerHTML=`<div class="form-grid"><label class="field"><span>服务要求（尚未承诺）</span><select name="serviceLevel">${Object.entries(serviceNames).map(([v,n])=>`<option value="${v}" ${v===draft.serviceLevel?'selected':''}>${n}</option>`).join('')}</select></label><div class="field">${check('exclusiveVehicle','申请独享车辆',draft.exclusiveVehicle)}</div></div><p class="muted">以下均为金边时间（UTC+07），填写期望时间，不构成配送承诺。</p><div class="form-grid">${['requestedPickupWindow','requestedDeliveryWindow'].map((k,i)=>['start','end'].map((part,j)=>field(`${k}.${part}`,`${i?'送货':'取货'}${j?'结束':'开始'}`,localTime(draft[k][part]),'datetime-local')).join('')).join('')}${field('notes','备注',draft.notes||'','text',true)}</div>`;
 $('#orders-list').hidden=true;$('#order-editor').hidden=false;$('#edit-state').textContent=detail?`${stateNames[detail.order.state]||detail.order.state}${detail.order.state==='draft'?'':' · 只读'} ${detail.order.orderNo} · 版本 ${detail.order.version}`:'新草稿 · 尚未保存';$('#save-state').textContent=detail?'已从服务端读取':'尚未保存';$('#intake-check').hidden=true;renderIntakeFields();renderQuote();step('contacts');controls();
 if(detail&&detail.order.state!=='draft')notice('本单只读查看。未确认报价的订单可经受理接口有原因退回；已确认报价须走后续受控变更。报价有效性与付款结果请读取对应接口。');else $('#customer').focus();
}
function renderQuote(){
 $('#quote-state').textContent=quote?`${quote.state} · ${quote.id} · v${quote.version}`:(current?.order.quoteId?'当前订单已有报价，点击读取':'尚未读取报价');const box=$('#quote-detail');if(!quote){box.hidden=true;$('#quote-confirm').hidden=true;return;}box.hidden=false;box.innerHTML=quoteDetailHtml(quote,esc,displayTime);$('#quote-confirm').hidden=false;controls();
}
async function loadQuote(){if(!current?.order.quoteId)return;const data=await api.read('/api/ops/v1/quotes/'+current.order.quoteId);quote=data;quoteEtag=String(data.version);renderQuote();}
const localIso=id=>{const value=$(id).value;return value?new Date(value+(value.length===16?':00':'')+'+07:00').toISOString():new Date().toISOString();};
function renderIntakeFields(){
 if(!current){$('#intake-evidence-fields').replaceChildren();return;}
 const existing=intakeReport?.evidence?.data||{};const prior=Object.fromEntries([...document.querySelectorAll('#intake-evidence-fields [name]')].map(node=>[node.name,node.type==='checkbox'?node.checked:node.value]));const priorValue=name=>prior[name]??'';
 const side=(name,label)=>`<fieldset class="orders-intake-side"><legend>${label}确认</legend><div class="form-grid"><label class="field"><span>确认渠道</span><select name="intake.${name}.method"><option value="PHONE">电话 PHONE</option><option value="IN_PERSON">现场 IN_PERSON</option><option value="MESSAGE">消息 MESSAGE</option></select></label><label class="field"><span>依据 reference</span><input name="intake.${name}.reference" value="${esc(existing[name]?.reference||priorValue(`intake.${name}.reference`))}" required></label><label class="field full"><span>具体入口 entrance</span><input name="intake.${name}.entrance" value="${esc(existing[name]?.entrance||priorValue(`intake.${name}.entrance`))}" required></label></div></fieldset>`;
 const measurements=current.draft.items.map((item,i)=>{const found=existing.measurements?.find(x=>x.clientItemId===item.clientItemId)||{};return `<fieldset class="orders-intake-measurement"><legend>货物 ${i+1} · ${esc(item.name||'未命名')}</legend><div class="form-grid"><label class="field"><span>来源</span><select name="intake.measurements.${i}.source"><option value="CUSTOMER_DECLARED">客户申报</option><option value="WAREHOUSE_MEASURED">仓库实测</option></select></label><label class="field"><span>来源说明</span><input name="intake.measurements.${i}.reference" value="${esc(found.reference||priorValue(`intake.measurements.${i}.reference`))}" required></label></div><label class="checks"><input type="checkbox" name="intake.measurements.${i}.packagingConfirmed" ${found.packagingConfirmed||priorValue(`intake.measurements.${i}.packagingConfirmed`)?'checked':''}> 已确认对应实际包装</label></fieldset>`;}).join('');
 $('#intake-evidence-fields').innerHTML=side('pickup','取货')+side('delivery','送货')+`<h3>每行货物来源</h3>${measurements}`;
 if(existing.pickup)$('#intake-evidence-fields [name="intake.pickup.method"]').value=existing.pickup.method||'PHONE';if(existing.delivery)$('#intake-evidence-fields [name="intake.delivery.method"]').value=existing.delivery.method||'PHONE';
 $('#return-intake').hidden=!['validating','quoted'].includes(current.order.state);$('#intake-state').textContent=current.order.state==='draft'?'草稿 · 可登记依据':`${stateNames[current.order.state]||current.order.state} · 只读`;
}
function intakeInput(){const get=name=>document.querySelector(`[name="${name}"]`)?.value.trim()||'';const checked=name=>!!document.querySelector(`[name="${name}"]`)?.checked;return intakeInputFromValues(get,checked,current.draft.items);}
function showIntakeCheck(report){intakeReport=report;$('#intake-check').hidden=false;$('#intake-state').textContent=report.ready?'检查通过 · 可提交受理':'存在阻断项 · 请修正后重新检查';$('#intake-check').innerHTML=report.ready?'<strong>PASS</strong>：当前依据、配送区域与订单资料满足提交条件。':'<strong>阻断项</strong><ul>'+report.blockers.map(x=>`<li><code>${esc(x.code)}</code> · ${esc(x.message)}</li>`).join('')+'</ul>';for(const blocker of report.blockers||[]){const path=intakeFieldForPath(blocker.path);if(path)mark(path,blocker.message||'请修正此项');}renderIntakeFields();controls();if(!report.ready)focusFirstError();}
async function loadIntakeCheck(){if(!current)return;const report=await api.read('/api/ops/v1/orders/'+current.order.id+'/intake-check');showIntakeCheck(report);}
const value=name=>form.elements.namedItem(name)?.value.trim()||'';
function cargo(){return [...document.querySelectorAll('[data-item]')].map((node,i)=>{
 const item={clientItemId:node.dataset.item,name:value(`items.${i}.name`),quantity:Number(value(`items.${i}.quantity`)),restrictions:value(`items.${i}.restrictions`).split(/[,，]/).map(v=>v.trim()).filter(Boolean),measurementEvidenceIds:[]};
 for(const k of ['lengthCm','widthCm','heightCm','weightKg'])item[k]=value(`items.${i}.${k}`)===''?null:Number(value(`items.${i}.${k}`));
 for(const k of ['rotationAllowed','stackable','uprightOnly'])item[k]=form.elements.namedItem(`items.${i}.${k}`).checked;
 if(value(`items.${i}.unknownReason`))item.unknownReason=value(`items.${i}.unknownReason`);return item;
 });}
function readDraft(){
 const draft={customerId:value('customerId'),serviceLevel:value('serviceLevel'),exclusiveVehicle:form.elements.exclusiveVehicle.checked,paymentTerms:'PREPAID',items:cargo(),notes:value('notes')};
 for(const k of ['pickup','delivery']){const lng=value(k+'.lng'),lat=value(k+'.lat'),address=value(k+'.address'),landmark=value(k+'.landmark'),prior=current?.draft[k],point=lng&&lat?{lng:Number(lng),lat:Number(lat)}:null;draft[k]={address,contactName:value(k+'.contactName'),phone:value(k+'.phone'),point:retainedPoint(prior,address,landmark,point)};if(landmark)draft[k].landmark=landmark;}
 for(const k of ['requestedPickupWindow','requestedDeliveryWindow'])draft[k]=Object.fromEntries(['start','end'].map(part=>{const entered=value(k+'.'+part),old=current?.draft[k][part];return [part,old&&entered===localTime(old)?old:entered?new Date(entered+':00+07:00').toISOString():''];}));return draft;
}
function mark(name,message){const input=form.elements.namedItem(name),error=document.getElementById('err-'+name);if(input){input.setAttribute('aria-invalid','true');if(error)error.textContent=message;}}
function focusFirstError(){const first=form.querySelector('[aria-invalid=true]');if(first){step(first.closest('[data-panel]').dataset.panel);first.focus();}}
function validate(draft){
 form.querySelectorAll('[aria-invalid]').forEach(n=>n.removeAttribute('aria-invalid'));form.querySelectorAll('.field-error').forEach(n=>n.textContent='');
 for(const name of ['customerId','pickup.address','pickup.contactName','pickup.phone','delivery.address','delivery.contactName','delivery.phone',...['requestedPickupWindow','requestedDeliveryWindow'].flatMap(k=>[k+'.start',k+'.end'])])if(!value(name))mark(name,'请填写此项');
 draft.items.forEach((item,i)=>{if(!item.name)mark(`items.${i}.name`,'请填写货物名称');if(!Number.isInteger(item.quantity)||item.quantity<1)mark(`items.${i}.quantity`,'请填写正整数');for(const k of ['lengthCm','widthCm','heightCm','weightKg'])if(item[k]!==null&&(!Number.isFinite(item[k])||item[k]<=0))mark(`items.${i}.${k}`,'请填写大于零的数值，未知请留空');if(['lengthCm','widthCm','heightCm','weightKg'].some(k=>item[k]===null)&&!item.unknownReason)mark(`items.${i}.unknownReason`,'请说明哪些参数未知及原因');});
 if(form.querySelector('[aria-invalid=true]')){notice('请修正标出的输入后保存。');focusFirstError();return false;}return true;
}
function discard(action){
 if(busy||api.pending){notice('保存结果仍在确认中，请先完成原请求核实。');return;}
 if(!dirty){action();return;}
 const dialog=$('#leave-dialog');$('#leave').onclick=()=>{dialog.close();dirty=false;action();};$('#stay').onclick=()=>dialog.close();dialog.showModal();$('#stay').focus();
}
async function save(retry=false){
 if(current&&current.order.state!=='draft'){notice('本单只读查看。未确认报价的订单可经受理接口有原因退回；已确认报价须走后续受控变更。报价有效性与付款结果请读取对应接口。');return;}
 let draft;if(!retry){try{draft=readDraft();}catch{notice('请检查日期和时间的格式。');return;}if(!validate(draft))return;}
 await work(async()=>{
 $('#save-state').textContent='正在保存到数据库…';const saved=retry?await api.retry():await api.save(draft,current?.order);
 dirty=false;current=saved;$('#order-editor').hidden=true;$('#orders-list').hidden=false;notice('');showToast(`草稿已保存，版本 ${saved.order.version}`);page=0;cursors=[null];await loadList();$('#list-title').setAttribute('tabindex','-1');$('#list-title').focus();
 });if(api.pending)$('#save-state').textContent='结果待核实 · 原请求已保留';else if(!$('#order-editor').hidden)$('#save-state').textContent='尚未保存当前修改';}

form.addEventListener('input',()=>{dirty=true;$('#save-state').textContent='有未保存修改';});
form.addEventListener('submit',event=>{event.preventDefault();if(!busy&&!api.pending)save();});
document.querySelectorAll('[data-step]').forEach(n=>n.onclick=()=>step(n.dataset.step));
$('#new-order').onclick=()=>discard(()=>render(blank()));
$('#back-list').onclick=()=>discard(()=>{$('#order-editor').hidden=true;$('#orders-list').hidden=false;$('#new-order').focus();});
$('#demo-link').onclick=e=>{e.preventDefault();const href=e.currentTarget.href;discard(()=>location.assign(href));};
$('#refresh-list').onclick=refresh;$('#reconnect').onclick=connect;$('#retry-save').onclick=()=>save(true);
$('#previous-page').onclick=()=>{page--;refresh();};$('#next-page').onclick=()=>{page++;cursors[page]=nextCursor;refresh();};
$('#more-customers').onclick=()=>work(()=>loadCustomers());
$('#order-rows').onclick=e=>{const id=e.target.closest('[data-open]')?.dataset.open;if(id)work(async()=>{const detail=await api.read('/api/ops/v1/orders/'+id);if(!customers.some(c=>c.id===detail.order.customerId))customers.push({id:detail.order.customerId,name:'当前订单客户（授权记录）'});render(detail.draft,detail);await loadIntakeCheck();await loadQuote();});};
$('#add-item').onclick=()=>{renderCargo([...cargo(),blankItem()]);dirty=true;$('#cargo-items fieldset:last-child input').focus();};
$('#cargo-items').onclick=e=>{const button=e.target.closest('[data-remove]');if(button){const items=cargo();items.splice(Number(button.dataset.remove),1);renderCargo(items);dirty=true;$('#add-item').focus();}};
$('#fill-sample').onclick=()=>discard(()=>work(async()=>{const spec=await api.read('/dev/openapi.json');const draft=structuredClone(spec.paths['/api/ops/v1/orders'].post.requestBody.content['application/json'].examples.synthetic.value);draft.customerId=current?.draft.customerId||customers[0]?.id||'';render(draft,current);dirty=true;$('#save-state').textContent='合成样例 · 尚未保存';}));
$('#compare-latest').onclick=()=>work(async()=>{latest=await api.read('/api/ops/v1/orders/'+current.order.id);$('#latest-summary').textContent=`服务端版本 ${latest.order.version}\n`+JSON.stringify(latest.draft,null,2);$('#use-latest').hidden=false;});
$('#use-latest').onclick=()=>discard(()=>render(latest.draft,latest));
$('#save-intake-evidence').onclick=()=>work(async()=>{if(!current)return;const result=await api.command('/api/ops/v1/orders/'+current.order.id+'/intake-evidence',intakeInput(),current.order.version);intakeReport=null;$('#intake-check').hidden=true;showToast('受理依据已登记，请重新检查条件。');await loadIntakeCheck();});
$('#check-intake').onclick=()=>work(loadIntakeCheck);
$('#submit-intake').onclick=()=>work(async()=>{const result=await api.command('/api/ops/v1/orders/'+current.order.id+'/actions/submit',{},current.order.version);current=result;render(result.draft,result);await loadIntakeCheck();notice('受理已提交，订单进入核验中；当前页面只读。');});
$('#return-to-draft').onclick=()=>work(async()=>{const reason=$('#return-reason').value.trim();if(!reason){$('#return-reason').setAttribute('aria-invalid','true');notice('退回原因必填。');$('#return-reason').focus();return;}const result=await api.command('/api/ops/v1/orders/'+current.order.id+'/actions/return-to-draft',{reason},current.order.version);current=result;$('#return-reason').value='';render(result.draft,result);await loadIntakeCheck();notice('订单已退回草稿，请修改后重新登记受理依据。');});
$('#load-quote').onclick=()=>work(loadQuote);
$('#generate-quote').onclick=()=>work(async()=>{const policyId=$('#quote-policy-id').value.trim();if(!policyId){notice('请填写已发布费率策略 ID。');return;}const result=await api.command('/api/ops/v1/orders/'+current.order.id+'/quotes',{pricingPolicyVersionId:policyId,insuranceRequested:$('#quote-insurance').checked},current.order.version);const detail=await api.read('/api/ops/v1/orders/'+current.order.id);render(detail.draft,detail);quote=result;quoteEtag=String(result.version);renderQuote();await loadIntakeCheck();notice('报价已生成；金额与有效期以服务端报价为准。');});
$('#confirm-quote').onclick=()=>work(async()=>{if(!quote)return;const reference=$('#quote-confirm-reference').value.trim(),body={customerContact:$('#quote-customer-contact').value.trim(),method:$('#quote-confirm-method').value,reference,confirmedAt:localIso('#quote-confirmed-at')};if(!body.customerContact||!reference){notice('请填写客户联系人和确认依据。');return;}const confirmed=await api.command('/api/ops/v1/quotes/'+quote.id+'/actions/record-customer-confirmation',body,quote.version);const detail=await api.read('/api/ops/v1/orders/'+current.order.id);render(detail.draft,detail);quote=confirmed;quoteEtag=String(confirmed.version);renderQuote();await loadIntakeCheck();notice('客户确认已记录；后续付款与派单仍需独立流程。');});
window.addEventListener('beforeunload',e=>{if(dirty||api.pending){e.preventDefault();e.returnValue='';}});
document.querySelectorAll('#reconnect,#back-list,[data-step],#more-customers,#add-item,#compare-latest,#use-latest,#fill-sample,#stay,#leave').forEach(n=>n.disabled=false);
connect();
