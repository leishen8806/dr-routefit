const check=(ok,message)=>{if(!ok)throw Error(message)};
export const areaConfig=db=>db.serviceAreas||{version:0,draft:[],published:null,revision:0,history:[]};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment=(p,a,b)=>Math.abs(cross(a,b,p))<1e-10&&p[0]>=Math.min(a[0],b[0])-1e-10&&p[0]<=Math.max(a[0],b[0])+1e-10&&p[1]>=Math.min(a[1],b[1])-1e-10&&p[1]<=Math.max(a[1],b[1])+1e-10;
const intersects=(a,b,c,d)=>onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d)||(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0);
export const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
export function validatePolygon(points){
 check(Array.isArray(points)&&points.length>=3&&points.length<=100,'区域需要 3–100 个顶点');check(points.every(validPoint),'坐标须为有效的经度、纬度');
 check(new Set(points.map(p=>JSON.stringify(p))).size===points.length,'顶点不能重复，系统自动闭合首尾');
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(j!==i+1&&!(i===0&&j===points.length-1))check(!intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]),'区域边界不能交叉或相互接触');
 check(Math.abs(points.reduce((n,p,i)=>n+p[0]*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*p[1],0))>1e-8,'区域面积太小或顶点在同一直线上');return points;
}
export function contains(points,point){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if(onSegment(point,a,b))return true;if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside;}
export function checkArea(zones,point){if(!validPoint(point))return {code:'unknown',text:'地址坐标待核验'};const hits=zones.filter(z=>z.enabled&&contains(z.points,point));const denied=hits.find(z=>z.kind==='deny');if(denied)return {code:'denied',text:'禁送区：'+denied.name};const allowed=hits.find(z=>z.kind==='allow');return allowed?{code:'allowed',text:'可配送：'+allowed.name}:{code:'outside',text:'不在已开放的配送区域'};}
export function orderArea(db,o){const cfg=areaConfig(db);if(cfg.published===null)return {code:'inactive',text:'配送区域尚未发布'};if(!o)return {code:'unknown',text:'请选择订单'};for(const kind of o.pickupAddress?['delivery','pickup']:['delivery']){const address=kind==='pickup'?o.pickupAddress:o.destination,point=o.areaPoints?.[kind];if(!point||point.address!==address)return {code:'unknown',text:(kind==='pickup'?'取件':'送货')+'地址坐标待核验'};const result=checkArea(cfg.published,point.coordinates);if(result.code!=='allowed')return {...result,text:(kind==='pickup'?'取件：':'送货：')+result.text};}return {code:'allowed',text:'取送地址通过当前区域规则'};}
export const areaActions=new Set(['areaSave','areaPublish','areaPoint']);
export function applyArea(db,c,now=Date.now()){
 check(c.action==='areaPoint'?['ops','dispatch'].includes(c.role):c.role==='ops','当前角色无权修改配送区域');check(typeof c.key==='string'&&c.key,'缺少幂等键');
 const fingerprint=JSON.stringify([c.action,c.id,c.role,c.payload||{}]);if(db.requests[c.key]){check(db.requests[c.key].fingerprint===fingerprint,'幂等键冲突');return db}
 const next=structuredClone(db),cfg=next.serviceAreas=structuredClone(areaConfig(db)),p=c.payload||{},at=new Date(now).toISOString();
 if(c.action==='areaPoint'){
  const o=next.orders.find(x=>x.id===c.id);check(o,'订单不存在');check(o.version===c.version,'订单版本变化，请重新核验');check(['draft','awaiting_dispatch'].includes(o.status),'已有提案或正在履约，先按原流程撤回提案；在途地址不能直接改动');check(['pickup','delivery'].includes(p.kind),'请选择取件或送货地址');const address=p.kind==='pickup'?o.pickupAddress:o.destination;check(address&&p.address===address,'地址已变化，请重新选点');check(validPoint(p.coordinates)&&p.confirmed===true,'请确认地图坐标与地址一致');
  (o.areaPoints??={})[p.kind]={coordinates:p.coordinates,address,at,role:c.role};o.version++;o.events.push({text:'人工核验'+(p.kind==='pickup'?'取件':'送货')+'地址坐标（演示）',role:c.role,at});
 }else{
  check(c.version===cfg.version,'区域版本变化，请刷新后重试');
  if(c.action==='areaSave'){
   check(Array.isArray(p.zones)&&p.zones.length<=50,'最多保存 50 个区域');const ids=new Set();cfg.draft=p.zones.map(z=>{check(typeof z.id==='string'&&z.id&&!ids.has(z.id),'区域编号缺失或重复');ids.add(z.id);check(typeof z.name==='string'&&z.name.trim()&&z.name.length<=80,'填写 1–80 字区域名称');check(['allow','deny'].includes(z.kind)&&typeof z.enabled==='boolean','区域类型或启用状态无效');validatePolygon(z.points);return {id:z.id,name:z.name.trim(),kind:z.kind,enabled:z.enabled,points:structuredClone(z.points)}});
  }else{check(p.confirmed===true,'请确认发布影响：禁送优先，区外拒单，待派订单重新校验');cfg.published=structuredClone(cfg.draft);cfg.revision++;cfg.history.push({revision:cfg.revision,at,role:c.role,zones:structuredClone(cfg.published)});}
  cfg.version++;
 }
 next.requests[c.key]={fingerprint};return next;
}
export function finalizeAreas(before,next,c,now=Date.now()){
 if(next===before)return next;
 if(['promise','offer','partnerOffer','bookingDraft','bookingConfirm','accept'].includes(c.action)){
  const o=next.orders.find(x=>x.id===c.id),result=orderArea(next,o);check(['allowed','inactive'].includes(result.code),result.text+'；不能以加价或人工批准代替区域准入');
  if(result.code==='allowed')o.areaValidation={revision:areaConfig(next).revision,at:new Date(now).toISOString(),action:c.action};
 }
 return next;
}
