// Canonical form field and accessible feedback shared by the workbench and finance review surface.
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const formField=(name,label,value='',type='text',full=false,hint='')=>`<label class="field ${full?'full':''}"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" id="f-${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" aria-describedby="err-${escapeHtml(name)}" ${type==='number'?'step="any"':''}><small class="field-error" id="err-${escapeHtml(name)}"></small>${hint?`<span class="hint">${escapeHtml(hint)}</span>`:''}</label>`;
let timer;
export function showToast(message){
 const node=document.querySelector('#toast');clearTimeout(timer);node.replaceChildren(document.createTextNode(message));const close=document.createElement('button');close.type='button';close.textContent='关闭';close.onclick=()=>{clearTimeout(timer);node.classList.remove('show');node.inert=true};node.append(close);node.inert=false;node.classList.add('show');const pause=()=>clearTimeout(timer),resume=()=>{pause();timer=setTimeout(()=>{node.classList.remove('show');node.inert=true},6000)};node.onmouseenter=node.onfocusin=pause;node.onmouseleave=node.onfocusout=resume;resume();
}
