export function nextDriverAction(items,order){
 if(!order)return null;
 const available=items.filter(x=>!['reject','rescueReject'].includes(x.action));
 if(order.status==='in_transit'&&!order.rescueParent){
  const report=available.find(x=>x.action==='report');if(report)return report;
  const delivery=available.find(x=>x.action==='deliver');
  if(delivery&&order.payment==='transfer'&&order.collection!=='verified')return {...delivery,disabled:true,text:'等待财务核验后签收'};
 }
 return available.find(x=>x.style==='primary')||available[0]||null;
}
export const completedSlide=(distance,travel)=>Number.isFinite(distance)&&Number.isFinite(travel)&&travel>=40&&distance>=travel*.9;
export function bindDriverDock(root,{open,getState}){
 const app=root.querySelector('.driver-app'),dock=root.querySelector('.driver-dock');if(!app||!dock)return ()=>{};
 const position=()=>{const rect=app.getBoundingClientRect();dock.style.left=rect.left+'px';dock.style.width=rect.width+'px';app.style.setProperty('--driver-dock-space',dock.getBoundingClientRect().height+'px');const toast=document.querySelector('#toast');if(toast)toast.style.bottom=(dock.getBoundingClientRect().height+16)+'px'};
 const observer=new ResizeObserver(position);observer.observe(app);observer.observe(dock);window.addEventListener('resize',position);position();
 const track=dock.querySelector('.driver-slide'),handle=dock.querySelector('.driver-slide-handle'),snapshot=getState();let gesture=null,locked=false;
 const reset=()=>{gesture=null;if(handle)handle.style.transform='';if(track){track.style.setProperty('--slide-progress','0%');track.classList.remove('dragging')}};
 const activate=()=>{if(locked||handle?.disabled)return;const current=getState();if(JSON.stringify(current)!==JSON.stringify(snapshot)){reset();return;}locked=true;reset();open(handle.dataset.slideAction);locked=false;};
 if(handle){
  handle.addEventListener('pointerdown',ev=>{if(handle.disabled||!ev.isPrimary||ev.button!==0)return;const travel=track.clientWidth-handle.offsetWidth-8;if(travel<40)return;gesture={pointer:ev.pointerId,x:ev.clientX,y:ev.clientY,distance:0,travel};handle.setPointerCapture(ev.pointerId);track.classList.add('dragging')});
  handle.addEventListener('pointermove',ev=>{if(!gesture||gesture.pointer!==ev.pointerId)return;const dx=ev.clientX-gesture.x,dy=ev.clientY-gesture.y;if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){reset();return}gesture.distance=Math.max(0,Math.min(gesture.travel,dx));handle.style.transform=`translateX(${gesture.distance}px)`;track.style.setProperty('--slide-progress',100*gesture.distance/gesture.travel+'%')});
  handle.addEventListener('pointerup',ev=>{if(!gesture||gesture.pointer!==ev.pointerId)return;const complete=completedSlide(gesture.distance,gesture.travel);reset();if(handle.hasPointerCapture(ev.pointerId))handle.releasePointerCapture(ev.pointerId);if(complete)activate()});
  handle.addEventListener('pointercancel',reset);handle.addEventListener('lostpointercapture',reset);
  // A keyboard/assistive-technology click opens the same confirmation flow; pointer taps do not.
  handle.addEventListener('click',ev=>{if(ev.detail===0)activate()});
 }
 return ()=>{reset();observer.disconnect();window.removeEventListener('resize',position);document.querySelector('#toast')?.style.removeProperty('bottom')};
}
