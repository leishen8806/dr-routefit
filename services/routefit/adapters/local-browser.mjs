import {readFile,realpath,unlink,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname,extname,sep,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {digest} from './development-auth.mjs';
import {transaction} from './postgres.mjs';
import {specification} from './contract.mjs';

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const grantDirectory=file=>join(dirname(resolve(file)),'browser-grants');
export async function createBrowserGrant({sessionsFile,actor=0,origin='http://127.0.0.1:4180'}){
 const url=new URL(origin);ensure(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.origin===origin,400,'INVALID_DEV_ORIGIN','仅支持127.0.0.1本机HTTP源');
 const sessions=JSON.parse(await readFile(sessionsFile,'utf8'));
 ensure(Number.isInteger(actor)&&actor>=0&&actor<sessions.length,400,'INVALID_ACTOR','本机身份序号不存在');
 const source=sessions[actor];ensure(Date.parse(source.expiresAt)>Date.now(),401,'UNAUTHENTICATED','开发身份已过期，请续期并重启服务');
 const ticket=randomBytes(32).toString('hex'),directory=grantDirectory(sessionsFile);
 await mkdir(directory,{recursive:true});
 await writeFile(join(directory,digest(ticket)+'.json'),JSON.stringify({source:source.tokenHash,origin,expiresAt:Date.now()+60000}),{flag:'wx',mode:0o600});
 return {url:origin+'/dev/activate?ticket='+ticket,companyId:source.companyId,principalId:source.principalId};
}

// shortcut: local synthetic identities only; replace this adapter with approved BFF/IdP before deployment.
export function localBrowser({origin,root,sessionsFile,authenticate,pool}){
 const expected=new URL(origin),grantRoot=grantDirectory(sessionsFile);
 ensure(expected.protocol==='http:'&&expected.hostname==='127.0.0.1'&&expected.origin===origin,500,'INVALID_DEV_ORIGIN','同源开发仅支持127.0.0.1 HTTP');
 return async(req,res,send)=>{
  ensure(req.socket.remoteAddress==='127.0.0.1'||req.socket.remoteAddress==='::ffff:127.0.0.1',403,'LOCAL_ONLY','仅允许本机请求');
  ensure(req.headers.host===expected.host&&req.url.startsWith('/')&&!req.url.startsWith('//'),403,'HOST_FORBIDDEN','请求Host必须匹配本机服务地址');
  ensure(!req.headers.origin||req.headers.origin===origin,403,'ORIGIN_FORBIDDEN','请求来源不在允许范围');
  ensure(!req.headers['sec-fetch-site']||['none','same-origin'].includes(req.headers['sec-fetch-site']),403,'ORIGIN_FORBIDDEN','不允许跨站或跨端口访问');
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  const url=new URL(req.url,origin);
  if(url.pathname==='/dev/openapi.json'){
   ensure(req.method==='GET'&&url.search==='',405,'METHOD_NOT_ALLOWED','仅支持GET且不接受查询参数');
   const paths=Object.fromEntries(Object.entries(specification.paths).map(([path,methods])=>[path,Object.fromEntries(Object.entries(methods).filter(([,op])=>op['x-implementation-status']==='LOCAL_IMPLEMENTED_NOT_DEPLOYED').map(([method,op])=>[method,{...op,servers:[{url:origin}]}]))]).filter(([,methods])=>Object.keys(methods).length));
   send(200,{...specification,info:{...specification.info,title:'DR RouteFit — implemented local APIs only'},servers:[{url:origin}],paths});return true;
  }
  if(url.pathname==='/dev/activate'){
   ensure(req.method==='GET',405,'METHOD_NOT_ALLOWED','仅支持GET');
   const ticket=url.searchParams.get('ticket');ensure(/^[a-f0-9]{64}$/.test(ticket||'')&&[...url.searchParams].length===1,401,'INVALID_ACTIVATION','激活链接无效、已使用或已过期');
   let grant;
   try{
    const file=join(grantRoot,digest(ticket)+'.json'),claimed=file+'.'+randomBytes(8).toString('hex');
    await rename(file,claimed);
    try{grant=JSON.parse(await readFile(claimed,'utf8'));}finally{await unlink(claimed);}
   }catch{ensure(false,401,'INVALID_ACTIVATION','激活链接无效、已使用或已过期');}
   ensure(grant.origin===origin&&Number.isSafeInteger(grant.expiresAt)&&grant.expiresAt>Date.now()&&grant.expiresAt<=Date.now()+60000,401,'INVALID_ACTIVATION','激活链接无效、已使用或已过期');
   const principal=authenticate.source(grant.source);await transaction(pool,principal,async()=>{}, {readOnly:true});
   if(req.headers.cookie){try{authenticate.revoke(authenticate({headers:req.headers,method:'GET'}));}catch{}}
   const {token,session}=authenticate.issue(grant.source),age=Math.max(1,Math.floor((Date.parse(session.expiresAt)-Date.now())/1000));
   send(303,{mode:'local-development',next:'/prototype/'},{Location:'/prototype/','Set-Cookie':`rf_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`});return true;
  }
  if(url.pathname==='/dev/session'||url.pathname==='/dev/session/logout'){
   const logout=url.pathname.endsWith('/logout');ensure(req.method===(logout?'POST':'GET')&&url.search==='',405,'METHOD_NOT_ALLOWED','请求方法或查询参数不支持');
   const principal=authenticate(req);ensure(principal.browser,401,'BROWSER_SESSION_REQUIRED','请使用本机一次性链接建立浏览器会话');
   await transaction(pool,principal,async()=>{}, {readOnly:true});
   if(logout){authenticate.revoke(principal);send(200,{mode:'local-development',signedOut:true},{'Set-Cookie':'rf_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});}
   else send(200,{mode:'local-development',companyId:principal.companyId,principalId:principal.principalId,permissions:principal.permissions,expiresAt:principal.expiresAt,csrfToken:principal.csrf});
   return true;
  }
  if(url.pathname==='/dev/database-name'){
   ensure(req.method==='GET'&&url.search==='',405,'METHOD_NOT_ALLOWED','仅支持GET且不接受查询参数');
   const principal=authenticate(req);ensure(principal.browser,401,'BROWSER_SESSION_REQUIRED','请使用本机一次性链接建立浏览器会话');
   const result=await pool.query('SELECT current_database() AS database');send(200,{database:result.rows[0].database});return true;
  }
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/health/'))return false;
  ensure(req.method==='GET',405,'METHOD_NOT_ALLOWED','静态资源仅支持GET');
  let name;try{name=decodeURIComponent(url.pathname);}catch{ensure(false,404,'NOT_FOUND','资源不存在');}
  if(['/','/prototype','/prototype/'].includes(name))name='/prototype/index.html';
  const parts=name.split('/');
  ensure(!parts.some(p=>p==='..'||p==='.'||p.startsWith('.')||p.includes('\\'))&&!name.includes('\0'),404,'NOT_FOUND','资源不存在');
  const allowed=(parts.length===3&&parts[1]==='prototype')||(parts.length===4&&parts[1]==='brand'&&parts[2]==='logo');
  ensure(allowed&&mime[extname(name)]&&!/\/(?:browser-|server\.mjs$|integration-server\.mjs$)/.test(name)&&!name.endsWith('.test.mjs'),404,'NOT_FOUND','资源不存在');
  let file,body;
  try{const requested=resolve(root,'.'+name);file=await realpath(requested);const comparable=p=>process.platform==='win32'?p.toLowerCase():p;ensure(comparable(file)===comparable(requested)&&file.startsWith(resolve(root)+sep),404,'NOT_FOUND','资源不存在');body=await readFile(file);}catch{ensure(false,404,'NOT_FOUND','资源不存在');}
  res.writeHead(200,{'Content-Type':mime[extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);return true;
 };
}
