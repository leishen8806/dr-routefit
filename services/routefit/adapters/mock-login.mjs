import {timingSafeEqual} from 'node:crypto';
import {ApiError,ensure} from '../domain/errors.mjs';

// shortcut: development-only mock login (CMP-1464). Fixed demo code, no SMS/Telegram. Must stay off in production.
export const MOCK_LOGIN_CODE='123456';
export const MOCK_LOGIN_PATHS={'/api/driver/v1/auth/mock-login':'driver','/api/customer/v1/auth/mock-login':'customer'};
const phonePattern=/^\+?[0-9]{6,15}$/;

// Fail closed: every condition must be explicitly present. Missing NODE_ENV counts as "not development".
export function mockLoginEnabled(env=process.env){
 return ['development','test'].includes(env.NODE_ENV)&&env.ROUTEFIT_AUTH_MODE==='development'&&env.ROUTEFIT_MOCK_LOGIN==='1';
}

const same=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
const fail=()=>new ApiError(401,'INVALID_CREDENTIALS','手机号或验证码不正确');

async function readJson(req){
 ensure(/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']||''),415,'UNSUPPORTED_MEDIA_TYPE','请使用application/json');
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;ensure(size<=2048,413,'BODY_TOO_LARGE','请求体过大');chunks.push(chunk);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{ensure(false,422,'INVALID_BODY','请求体必须是JSON');}
 ensure(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).sort().join()==='code,phone'&&typeof body.phone==='string'&&typeof body.code==='string',422,'INVALID_BODY','只接受 phone 和 code');
 return body;
}

// identities: [{audience:'driver'|'customer', phone, tokenHash}] — tokenHash points at an existing explicit development session.
// authenticate.issueMock(tokenHash, audience) returns {token, session}. Never reads secrets; the code is a fixed public demo value.
export function mockLogin({env=process.env,identities=[],authenticate,rateLimit=()=>{}}){
 return async(req,res,send)=>{
  const url=new URL(req.url,'http://127.0.0.1'),audience=MOCK_LOGIN_PATHS[url.pathname];
  if(!audience)return false;
  ensure(mockLoginEnabled(env),404,'NOT_FOUND','资源不存在');
  ensure(req.method==='POST'&&url.search==='',405,'METHOD_NOT_ALLOWED','请求方法不支持');
  ensure(req.socket.remoteAddress==='127.0.0.1'||req.socket.remoteAddress==='::ffff:127.0.0.1',403,'LOCAL_ONLY','仅允许本机请求');
  rateLimit(req.socket.remoteAddress);
  const body=await readJson(req);
  const identity=phonePattern.test(body.phone)?identities.find(i=>i.audience===audience&&i.phone===body.phone):null;
  // Always compare the code so unknown phone and wrong code are indistinguishable.
  const codeOk=same(body.code,MOCK_LOGIN_CODE);
  if(!identity||!codeOk)throw fail();
  const {token,session}=authenticate.issueMock(identity.tokenHash,audience);
  send(200,{mode:'mock-development',audience,tokenType:'Bearer',accessToken:token,expiresAt:session.expiresAt,companyId:session.companyId,principalId:session.principalId,permissions:session.permissions});
  return true;
 };
}
