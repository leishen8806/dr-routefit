export function requireTestDatabaseUrl(task){
 const value=String(process.env.ROUTEFIT_TEST_DATABASE_URL||'').trim();
 if(!value){
  console.error(`[${task}] 拒绝运行：请设置 ROUTEFIT_TEST_DATABASE_URL 指向一次性合成测试库；不会写入日常开发库。`);
  process.exitCode=2;
  throw new Error('ROUTEFIT_TEST_DATABASE_URL is required');
 }
 return value;
}
