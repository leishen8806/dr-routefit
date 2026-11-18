import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openapiPath = new URL('../../../contracts/openapi.json', import.meta.url);
const indexPath = new URL('../../../contracts/rf-ux-v1-r2-api-index.md', import.meta.url);

const readOnlyOperations = [
  ['/api/ops/v1/pricing/policy-versions', 'get'],
  ['/api/ops/v1/route-pricing/configurations', 'get'],
  ['/api/ops/v1/coupons', 'get'],
  ['/api/ops/v1/merchants/{merchantId}/sku-dimensions', 'get'],
];

const standardReadErrors = ['400', '401', '403', '404', '429', '503'];

test('four reviewed read operations declare the standard error responses', async () => {
  const openapi = JSON.parse(await readFile(openapiPath, 'utf8'));

  for (const [path, method] of readOnlyOperations) {
    const responses = openapi.paths[path][method].responses;
    assert.deepEqual(
      standardReadErrors.filter((status) => !(status in responses)),
      [],
      `${method.toUpperCase()} ${path} lacks standard error responses`,
    );
  }
});

test('index marks every already-defined operation as 已定义', async () => {
  const [openapiText, index] = await Promise.all([
    readFile(openapiPath, 'utf8'),
    readFile(indexPath, 'utf8'),
  ]);
  const openapi = JSON.parse(openapiText);
  const staleRows = [];

  for (const line of index.split(/\r?\n/)) {
    const match = line.match(/^\| `([A-Z]+) ([^`]+)` \|.*\| 待定义 \|$/);
    if (!match) continue;
    const [, method, path] = match;
    if (openapi.paths[path]?.[method.toLowerCase()]) staleRows.push(`${method} ${path}`);
  }

  assert.deepEqual(staleRows, [], '已存在的 OpenAPI 操作仍被索引标为待定义');
});
