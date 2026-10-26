import {ensure} from './errors.mjs';
// shortcut: reuse the existing pure city-scale planar geometry; replace with approved GeoCore/PostGIS before geographic production use.
import {validatePolygon,checkArea} from '../../../prototype/service-areas.mjs';

export function areaPoints(data){
 ensure(data.name.trim(),422,'INVALID_AREA','区域名称不能为空');
 const rings=data.polygon.coordinates;
 ensure(rings.length===1,422,'CAPABILITY_DISABLED','本地几何切片只支持单外环，不接受孔洞');
 const ring=rings[0];ensure(ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1],422,'INVALID_POLYGON','GeoJSON外环须首尾闭合');
 const points=ring.slice(0,-1),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 ensure(Math.max(...xs)-Math.min(...xs)<=1&&Math.max(...ys)-Math.min(...ys)<=1&&ys.every(y=>Math.abs(y)<=70),422,'CAPABILITY_DISABLED','本地几何仅支持经纬跨度不超过1度且纬度绝对值不超过70度的城市范围');
 try{validatePolygon(points);}catch(error){ensure(false,422,'INVALID_POLYGON',error.message);}
 return points;
}
export function validateEvidence(order,input){
 for(const side of ['pickup','delivery'])for(const field of ['reference','entrance'])ensure(input[side][field].trim(),422,'EVIDENCE_REQUIRED','请填写确认依据与具体交接入口');
 const keys=new Set(input.measurements.map(m=>m.clientItemId));
 ensure(keys.size===input.measurements.length&&keys.size===order.items.length&&order.items.every(i=>keys.has(i.clientItemId)),422,'CARGO_EVIDENCE_MISMATCH','尺寸来源须与当前每一行货物一一对应');
 ensure(input.measurements.every(m=>m.reference.trim()),422,'EVIDENCE_REQUIRED','每行货物须有来源说明');
}
export function evaluateIntake(order,evidence,coverage,now=Date.now()){
 const blockers=[],add=(code,path,message)=>blockers.push({code,path,message});
 const source=order.intake?.sourceOrderVersion??order.order.version;
 if(!evidence||evidence.orderVersion!==source)add('EVIDENCE_MISSING','/evidence','当前订单版本尚无人工核验依据');
 if(!coverage.revision)add('COVERAGE_UNPUBLISHED','/coverage','尚无已发布配送区域，不能视为可送');
 if(['validating','quoted'].includes(order.order.state)&&order.intake.areaRevision!==coverage.revision)add('COVERAGE_CHANGED','/coverage','区域版本已变，保留原受理记录并退回草稿重新核验');
 const zones=coverage.areas.filter(a=>Date.parse(a.data.effectiveFrom)<=now).map(a=>({id:a.id,name:a.data.name,kind:a.data.type.toLowerCase(),enabled:true,points:areaPoints(a.data)}));
 for(const side of ['pickup','delivery']){
  const p=order.draft[side].point;
  if(!p){add('LOCATION_REQUIRED','/'+side+'/point','取送点须有人工确认的坐标');continue;}
  if(coverage.revision){const result=checkArea(zones,[p.lng,p.lat]);if(result.code!=='allowed')add(result.code==='denied'?'AREA_DENIED':'AREA_OUTSIDE','/'+side+'/point',result.text);}
 }
 for(const [i,item] of order.items.entries()){
  if(['lengthCm','widthCm','heightCm','weightKg'].some(k=>item[k]===null))add('MEASUREMENT_REQUIRED',`/items/${i}`,'尺寸或重量未知，不能完成受理输入检查');
  const m=evidence?.data.measurements.find(x=>x.clientItemId===item.clientItemId);
  if(m&&!m.packagingConfirmed)add('PACKAGING_UNCONFIRMED',`/items/${i}`,'须确认测量数据对应实际包装');
 }
 if(Date.parse(order.draft.requestedDeliveryWindow.end)<=now)add('DELIVERY_WINDOW_EXPIRED','/requestedDeliveryWindow','期望送达窗口已结束，请重新协商并修改草稿');
 return {orderId:order.order.id,orderVersion:order.order.version,evidenceId:evidence?.id??null,evidence,areaRevision:coverage.revision,checkedAt:new Date(now).toISOString(),ready:blockers.length===0,automationEligible:false,sourceQuality:'MANUAL_RECORDED',blockers};
}
