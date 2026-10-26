const check=(ok,message)=>{if(!ok)throw Error(message)};
function meters(value){const n=Number(value);check(String(value??'').trim()!==''&&Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*1000))&&Math.abs(n*1000-Math.round(n*1000))<1e-6,'距离须为非负公里数，最多三位小数');return Math.round(n*1000)}
export function distanceQuote(p,now=Date.now()){
 const mode=p.quoteMode||'manual';check(['manual','distance'].includes(mode),'请选择报价方式');if(mode==='manual')return null;
 const distanceMeters=meters(p.distanceKm),includedMeters=meters(p.includedKm),maximumMeters=meters(p.maxKm);
 check(maximumMeters>0&&maximumMeters>=includedMeters,'最远服务距离须大于零且不少于基础里程');
 const perKm=Number(p.perKm);check(String(p.perKm??'').trim()!==''&&Number.isFinite(perKm)&&perKm>=0&&Number.isSafeInteger(Math.round(perKm*100))&&Math.abs(perKm*100-Math.round(perKm*100))<1e-6,'每公里加价须明确填写，最多两位小数');
 check(['actual','ceilKm'].includes(p.distanceRounding),'请选择超距计费取整方式');check(['approved','pending','outside'].includes(p.areaStatus),'请选择地址服务区域核验结果');
 for(const key of ['distanceEvidence','entrance','quoteValidUntil'])check(typeof p[key]==='string'&&p[key].trim(),'请填写装卸入口、路程核验依据和报价有效期');
 const validUntil=Date.parse(p.quoteValidUntil);check(Number.isFinite(validUntil)&&validUntil>now,'报价有效期须在未来');
 const extraMeters=Math.max(0,distanceMeters-includedMeters),billableMeters=p.distanceRounding==='ceilKm'?Math.ceil(extraMeters/1000)*1000:extraMeters;
 const feeMinor=Math.round(billableMeters*Math.round(perKm*100)/1000);check(Number.isSafeInteger(feeMinor),'超距费用过大');
 return {distanceMeters,includedMeters,maximumMeters,extraMeters,billableMeters,rateMinor:Math.round(perKm*100),feeMinor,rounding:p.distanceRounding,areaStatus:p.areaStatus,evidence:p.distanceEvidence.trim(),entrance:p.entrance.trim(),destination:p.destination,warehouseId:p.warehouseId||'WH01',validUntil:new Date(validUntil).toISOString(),calculatedAt:new Date(now).toISOString()};
}
export function assertDistancePromise(o,p,now=Date.now()){
 const q=o.distanceQuote;if(!q)return;
 check(q.areaStatus==='approved','该地址服务区域尚未通过核验，不能以加价代替准入');
 check(q.distanceMeters<=q.maximumMeters,'地址超出最远服务距离，不能直接收费承诺配送');
 check(Date.parse(q.validUntil)>now,'报价已过期，请编辑草稿重新核价并取得客户确认');
 check(q.destination===o.destination&&q.warehouseId===o.warehouseId,'地址或出库仓变化，请重新核价');
 check(p.distanceConfirmed,'须确认客户已同意里程、超距费用及本次总价');
}
export function distanceBreakdown(o,{e,money}){
 const q=o.distanceQuote;if(!q)return `<p class="muted small">人工配送报价 · 未启用里程规则。配送 ${money(o.amountMinor-(o.insuranceFeeMinor||0))} + 保险 ${money(o.insuranceFeeMinor||0)} = 应收 ${money(o.amountMinor)}。保险费不参与分成；报价不代表已承保。</p>`;
 return `<div class="info-box ${q.areaStatus!=='approved'||q.distanceMeters>q.maximumMeters?'warning':''}"><strong>地址与超距报价</strong><p>${e(q.destination)} · 入口：${e(q.entrance)}</p><p>道路里程 ${q.distanceMeters/1000} km / 基础含 ${q.includedMeters/1000} km / 最远 ${q.maximumMeters/1000} km</p><p>超出 ${q.extraMeters/1000} km，计费 ${q.billableMeters/1000} km × ${money(q.rateMinor)}/km（${q.rounding==='actual'?'实际里程':'不足 1 km 向上取整'}）</p><p>基础 ${money(o.baseAmountMinor)} + 超距 ${money(q.feeMinor)} + 闪送 ${money(o.flashFeeMinor||0)} + 保险 ${money(o.insuranceFeeMinor||0)} = <strong>${money(o.amountMinor)}</strong></p><p>区域：${{approved:'人工核验通过',pending:'待核验',outside:'不在服务区'}[q.areaStatus]} · 依据：${e(q.evidence)}</p><small>有效至 ${e(new Date(q.validUntil).toLocaleString('zh-CN',{timeZone:'Asia/Phnom_Penh',hour12:false}))}（金边）。未接入地图测距；收费依据为人工录入快照。</small></div>`;
}
