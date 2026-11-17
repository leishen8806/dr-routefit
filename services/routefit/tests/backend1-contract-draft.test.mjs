import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const draft = new URL('../../../contracts/rf-ux-v1-r2-backend1-api.md', import.meta.url);
const specification = new URL('../../../contracts/openapi.json', import.meta.url);

test('Backend1 contract records that all 16 operations already have paths and gives reusable error responses', async () => {
  const [markdown, documentText] = await Promise.all([
    readFile(draft, 'utf8'),
    readFile(specification, 'utf8')
  ]);
  const document = JSON.parse(documentText);
  const section = markdown.match(/## 正式契约差异核验（e6c2916）[\s\S]*?```json\n([\s\S]*?)\n```/);

  assert.ok(section, 'missing the verified contract-delta JSON block');
  const supplement = JSON.parse(section[1]);
  assert.deepEqual(supplement.missingPaths, []);

  for (const response of Object.values(supplement.responses)) {
    const name = response.$ref?.replace('#/components/responses/', '');
    assert.ok(name && document.components.responses[name], `missing response component ${name}`);
  }
});
