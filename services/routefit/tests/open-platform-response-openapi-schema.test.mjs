import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate} from '../adapters/contract.mjs';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);

test('OpsLead response schemas expose safe projections and response pages', async () => {
  const schemas = JSON.parse(await readFile(specification, 'utf8')).components.schemas;
  for (const name of ['OpenApiClient','OpenApiClientPage','OpenApiKeyCreated','OpenApiKey','WebhookEndpoint','WebhookDelivery','WebhookDeliveryPage','AdCampaign','AdCampaignPage','AdStatsDaily','Role','RolePage','Staff','StaffPage','AuditLogEntry','AuditLogEntryPage','DashboardSummary','AdServed','AdInteractionResult']) assert.ok(schemas[name], `missing ${name}`);
  assert.doesNotThrow(() => validate('OpenApiKeyCreated', {id:'demo-001',clientId:'demo-001',keyPrefix:'rfs_example',environment:'sandbox',scopes:['quote:create'],rateLimitPerMinute:60,state:'active',createdAt:'2026-11-10T00:00:00Z',revokedAt:null,secret:'one-time'}));
  assert.throws(() => validate('OpenApiKey', {id:'demo-001',secret:'leak'}), {code:'VALIDATION_FAILED'});
});
