import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const spec=JSON.parse(readFileSync(fileURLToPath(new URL('../../../contracts/openapi.json',import.meta.url)),'utf8'));

test('mock-sessions operations exist in the assembled contract',()=>{
  for(const [path,operationId] of [['/api/driver/v1/auth/mock-sessions','driverMockSession'],['/api/customer/v1/auth/mock-sessions','customerMockSession']]){
    const operation=spec.paths[path]?.post;
    assert.ok(operation,`${path} POST missing from contracts/openapi.json`);
    assert.equal(operation.operationId,operationId);
    assert.equal(operation['x-implementation-status'],'DEV_ONLY_LOCAL_NOT_DEPLOYED');
    assert.deepEqual(operation['x-permissions'],['dev:mock-login']);
    assert.equal(operation['x-contract-module'],'auth');
    assert.ok(Array.isArray(operation.parameters));
  }
});
