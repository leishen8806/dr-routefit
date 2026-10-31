import {createHash,timingSafeEqual,randomBytes} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const developmentPermissions=['pricing:read','pricing:write','pricing:review','pricing:publish','session:read','session:logout','orders:read','orders:create','orders:edit','orders:verify','orders:submit','orders:cancel','areas:read','areas:create','areas:publish','quotes:read','quotes:create','quotes:confirm','prepayment:read','prepayment:write','prepayment:correct','prepayment:verify','prepayment:review','prepayment:approve','prepayment:post','fleet:read','dispatch:read','dispatch:offer','dispatch:revoke','dispatch:reassign','promise:check','promise:create','load:review','warehouse:read','warehouse:accept','inventory:reserve','inventory:release','inventory:consume','driver:tasks:read','driver:tasks:accept','driver:tasks:reject','driver:tasks:execute','driver:locations','driver:sync','driver:delivery:record','driver:custody:confirm','driver:evidence:create','driver:evidence:read','custody:create','custody:confirm','delivery:recipient:verify','returns:create','returns:authorize','returns:receive','returns:inspect','returns:close','exceptions:read','exceptions:create','exceptions:assign','exceptions:resolve','exceptions:close','partners:read','partners:create','partners:verify','partners:suspend','partners:reinstate','partners:exit','bookings:read','bookings:create','bookings:request','bookings:confirm','bookings:verify-delivery','bookings:request-cancel','bookings:confirm-cancel','bookings:event','ops:evidence:create','ops:evidence:read','ops-snapshot:read','portal:session:read','portal:orders:read','portal:orders:create','portal:quotes:read','portal:quotes:confirm','portal:finance:read','portal:payments:request','portal:refunds:request','portal:inventory:read','portal:warehouse:read','portal:warehouse:request','portal:cases:create','portal:cases:read','customer:evidence:create','customer:evidence:read','cases:read','cases:create','cases:decide','finance:tasks:read','finance:receipts:read','finance:receipts:report','finance:receipts:confirm','finance:ledger:read','finance:ledger-items:read','finance:reports:read','finance:documents:read','finance:documents:create','finance:documents:submit','finance:documents:review','finance:documents:approve','finance:documents:reject','finance:documents:post'];
developmentPermissions.push('notifications:send','notifications:read','access:read','access:grant','access:revoke','incident:dispatch','finance:bank:read','finance:bank:record','finance:cash:read','finance:cash:count','finance:tasks:hold','finance:receipts:query','finance:documents:revise','finance:documents:record-execution','finance:documents:record-result','finance:channel:create','finance:channel:read','finance:rules:read','finance:rules:create','finance:rules:activate','finance:statements:read','finance:statements:create','finance:statements:review','finance:statements:approve','finance:statements:issue','portal:statements:acknowledge','driver:cash:report','driver:cash:handover','driver:cash:read');
developmentPermissions.push('customer:accounts:read','driver:accounts:read','finance:accounts:read','driver:income:read','driver:withdrawal:request','portal:members:manage');
developmentPermissions.push('merchant:finance:read','merchant:settlement:request','merchant:accounts:read','partner:finance:read','partner:settlement:request','partner:accounts:read');
developmentPermissions.push('finance:export');
export const developmentServicePermissions=['warehouse:orders:create','warehouse:orders:read','warehouse:orders:dispatch-request','warehouse:inventory:write','external:orders:create','external:orders:read','external:orders:dispatch-request'];
// shortcut: explicit development sessions only; replace with verified IdP/BFF sessions before deployment.
export function developmentAuth(sessions,allowedOrigin){
 const origin=new URL(allowedOrigin);ensure(['127.0.0.1','localhost','[::1]'].includes(origin.hostname)&&origin.origin===allowedOrigin,500,'INVALID_DEV_ORIGIN','开发Origin必须为精确本地源');
 ensure(Array.isArray(sessions)&&sessions.length>0&&sessions.length<=100,500,'INVALID_DEV_SESSIONS','必须配置开发会话');
 const map=new Map();
 for(const s of sessions.filter(s=>s.authType!=='service')){
  ensure(/^[0-9a-f]{64}$/.test(s.tokenHash)&&/^[0-9a-f]{64}$/.test(s.csrfHash)&&uuid.test(s.companyId)&&uuid.test(s.principalId)&&Number.isFinite(Date.parse(s.expiresAt))&&Array.isArray(s.permissions)&&s.permissions.every(p=>developmentPermissions.includes(p)),500,'INVALID_DEV_SESSIONS','开发会话配置无效');
  ensure(!map.has(s.tokenHash),500,'INVALID_DEV_SESSIONS','开发会话重复');map.set(s.tokenHash,Object.freeze({...s}));
 }
 const authenticate=req=>{
  ensure(!req.headers.origin||req.headers.origin===allowedOrigin,403,'ORIGIN_FORBIDDEN','请求来源不在允许范围');
  const matches=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('rf_session='));
  ensure(matches.length===1,401,'UNAUTHENTICATED','需要有效会话');const token=matches[0].slice(11);
  ensure(token.length>=32&&token.length<=512,401,'UNAUTHENTICATED','需要有效会话');
  const p=map.get(digest(token));ensure(p&&Date.parse(p.expiresAt)>Date.now(),401,'UNAUTHENTICATED','会话无效或已过期');
  if(req.method!=='GET'){
   ensure(req.headers.origin===allowedOrigin,403,'ORIGIN_REQUIRED','写操作须带有效Origin');
   const csrf=req.headers['x-csrf-token'];ensure(typeof csrf==='string'&&csrf.length>=32&&csrf.length<=256&&timingSafeEqual(Buffer.from(digest(csrf),'hex'),Buffer.from(p.csrfHash,'hex')),403,'CSRF_INVALID','CSRF校验失败');
  }
  return p;
 };
 authenticate.source=hash=>{const p=map.get(hash);ensure(p&&!p.browser&&Date.parse(p.expiresAt)>Date.now(),401,'UNAUTHENTICATED','开发身份无效或已过期，请在本机续期并重启');return p;};
 authenticate.issue=hash=>{
  const source=authenticate.source(hash),now=Date.now();
  for(const [key,value] of map)if(value.browser&&Date.parse(value.expiresAt)<=now)map.delete(key);
  ensure([...map.values()].filter(x=>x.browser).length<128,429,'SESSION_LIMIT','开发会话过多，请退出旧会话或重启服务');
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
  const session={...source,tokenHash:digest(token),csrfHash:digest(csrf),csrf,browser:true,expiresAt:new Date(Math.min(now+8*3600000,Date.parse(source.expiresAt))).toISOString()};
  map.set(session.tokenHash,Object.freeze(session));return {token,session};
 };
 authenticate.revoke=p=>{if(p.browser)map.delete(p.tokenHash);};
 return authenticate;
}

// shortcut: local bearer sessions are a development-only stand-in; production must verify rotated service credentials outside the session file.
export function developmentServiceAuth(sessions){
 const map=new Map();
 for(const s of sessions.filter(s=>s.authType==='service')){
  ensure(/^[0-9a-f]{64}$/.test(s.tokenHash)&&uuid.test(s.companyId)&&uuid.test(s.principalId)&&Number.isFinite(Date.parse(s.expiresAt))&&Array.isArray(s.permissions)&&s.permissions.length>0&&s.permissions.every(p=>developmentServicePermissions.includes(p)),500,'INVALID_DEV_SERVICE_SESSIONS','服务凭据配置无效');
  ensure(!map.has(s.tokenHash),500,'INVALID_DEV_SERVICE_SESSIONS','服务凭据重复');map.set(s.tokenHash,Object.freeze({...s,browser:false,authType:'service'}));
 }
 return req=>{
  ensure(!req.headers.cookie,401,'SERVICE_TOKEN_REQUIRED','服务接口不接受浏览器会话');
  const match=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_-]{32,512})$/);
  ensure(match,401,'SERVICE_TOKEN_REQUIRED','需要有效服务凭据');const p=map.get(digest(match[1]));
  ensure(p&&Date.parse(p.expiresAt)>Date.now(),401,'SERVICE_TOKEN_REQUIRED','服务凭据无效或已过期');return p;
 };
}
