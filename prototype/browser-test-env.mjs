export function requireTestDatabaseUrl(task){
 const value=String(process.env.ROUTEFIT_TEST_DATABASE_URL||'').trim();
 if(!value){
  console.error(`[${task}] 拒绝运行：请设置 ROUTEFIT_TEST_DATABASE_URL 指向一次性合成测试库；不会写入日常开发库。`);
  process.exitCode=2;
  throw new Error('ROUTEFIT_TEST_DATABASE_URL is required');
 }
 const url=new URL(value);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!url.pathname.slice(1))throw new Error('ROUTEFIT_TEST_DATABASE_URL must be a local URL with a database name');
 return value;
}
export function databaseLabel(value){const url=new URL(value);return `${url.hostname}:${url.port||5432}/${url.pathname.slice(1)}`;}
export async function assertTestDatabase(page,value){
 const expected=new URL(value).pathname.slice(1);
 const observed=await page.evaluate(async()=>{const response=await fetch('/dev/database-name');return {status:response.status,body:await response.json().catch(()=>null)};});
 if(observed.status!==200||observed.body?.database!==expected)throw new Error(`测试库不匹配：期望 ${expected}，服务端返回 ${observed.body?.database||observed.status}`);
 return observed.body.database;
}
