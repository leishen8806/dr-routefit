import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const openapi=new URL('../../../contracts/openapi.json',import.meta.url);

test('optimization paths declare conflict and standard failure responses', async () => {
 const api=JSON.parse(await readFile(openapi,'utf8'));
 const expectations=[
  ['post','/api/ops/v1/dispatch/optimization-runs',['400','401','403','409','422','429','503']],
  ['get','/api/ops/v1/dispatch/optimization-runs',['400','401','403','429','503']],
  ['get','/api/ops/v1/dispatch/optimization-runs/{runId}',['400','401','403','404','429','503']],
  ['post','/api/ops/v1/dispatch/optimization-runs/{runId}/actions/adopt',['400','401','403','404','409','412','422','428','429','503']]
 ];
 for(const [method,path,codes] of expectations){
  const responses=api.paths[path]?.[method]?.responses;
  assert.ok(responses,`missing ${method.toUpperCase()} ${path}`);
  for(const code of codes) assert.ok(responses[code],`${method.toUpperCase()} ${path} missing ${code}`);
 }
});
