import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);
const approvedTargetPattern = '^(?:https://[^\\s/]+(?:/[^\\s]*)?|/(?!/)[^\\s]*)$';

test('ad link schemas only allow HTTPS targets or single-slash in-app paths', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const schemas = document.components.schemas;
  const targets = [
    schemas.AdCampaignCreate.properties.link,
    schemas.AdCampaignUpdate.properties.link,
    schemas.AdCampaign.properties.linkTarget,
    schemas.AdCampaign.properties.imageRef
  ];

  for (const target of targets) {
    assert.equal(target.pattern, approvedTargetPattern);
    const matcher = new RegExp(target.pattern);
    assert.equal(matcher.test('https://cdn.example/ad.png'), true);
    assert.equal(matcher.test('/campaigns/current'), true);
    assert.equal(matcher.test('javascript:alert(1)'), false);
    assert.equal(matcher.test('data:text/html;base64,AAAA'), false);
    assert.equal(matcher.test('http://outside.example/path'), false);
    assert.equal(matcher.test('//outside.example/path'), false);
  }
});
