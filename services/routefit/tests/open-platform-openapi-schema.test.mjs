import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate} from '../adapters/contract.mjs';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);

test('open platform write schemas keep secret handling, versioning, and payout-role separation explicit', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const schemas = document.components.schemas;

  for (const name of [
    'OpenApiClientCreate', 'OpenApiKeyCreate', 'OpenApiKeyAction',
    'WebhookEndpointCreate', 'WebhookDeliveryAction',
    'AdCampaignCreate', 'AdCampaignUpdate', 'AdCampaignAction',
    'RoleCreate', 'RoleUpdate', 'StaffCreate', 'StaffUpdate', 'AdInteractionCreate'
  ]) assert.ok(schemas[name], `missing ${name}`);

  assert.equal(schemas.OpenApiKeyCreate.properties.secret, undefined);
  assert.equal(schemas.OpenApiKeyAction.required.includes('version'), true);
  assert.equal(schemas.WebhookEndpointCreate.required.includes('clientId'), true);
  assert.equal(schemas.WebhookEndpointCreate.properties.clientId.type, 'string');
  assert.equal(schemas.AdCampaignAction.properties.action.enum.includes('approve'), true);
  assert.doesNotThrow(() => validate('RoleCreate', {name: 'cashier', permissions: ['payouts:confirm-paid']}));
  assert.throws(
    () => validate('RoleCreate', {name: 'conflicted', permissions: ['payouts:approve', 'payouts:confirm-paid']}),
    {code: 'VALIDATION_FAILED'}
  );
});

test('advertising frequency cap matches the persistence limit', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const schemas = document.components.schemas;

  for (const name of ['AdCampaignCreate', 'AdCampaignUpdate']) {
    assert.equal(schemas[name].properties.maxPerUserPerDay.maximum, 20, `${name} must cap daily impressions at 20`);
  }
});
