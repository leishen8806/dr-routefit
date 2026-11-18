import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const spec=JSON.parse(readFileSync(new URL('../../../contracts/openapi.json',import.meta.url),'utf8'));
const operations=[
 ['get','/api/ops/v1/api-clients','listApiClients'],['post','/api/ops/v1/api-clients','createApiClient'],['get','/api/ops/v1/api-clients/{clientId}','getApiClient'],['get','/api/ops/v1/api-clients/{clientId}/api-keys','listApiKeys'],['post','/api/ops/v1/api-clients/{clientId}/api-keys','createApiKey'],['post','/api/ops/v1/api-keys/{keyId}/actions/revoke','revokeApiKey'],['get','/api/ops/v1/webhook-endpoints','listWebhookEndpoints'],['post','/api/ops/v1/webhook-endpoints','createWebhookEndpoint'],['get','/api/ops/v1/webhook-endpoints/{endpointId}/deliveries','listWebhookDeliveries'],['post','/api/ops/v1/webhook-deliveries/{deliveryId}/actions/retry','retryWebhookDelivery'],['get','/api/ops/v1/api-call-logs','listApiCallLogs'],['get','/api/ops/v1/ad-campaigns','listAdCampaigns'],['post','/api/ops/v1/ad-campaigns','createAdCampaign'],['patch','/api/ops/v1/ad-campaigns/{campaignId}','patchAdCampaign'],['post','/api/ops/v1/ad-campaigns/{campaignId}/actions','actOnAdCampaign'],['get','/api/ops/v1/ad-campaigns/{campaignId}/stats','getAdCampaignStats'],['get','/api/ops/v1/roles','listRoles'],['post','/api/ops/v1/roles','createRole'],['patch','/api/ops/v1/roles/{roleId}','patchRole'],['get','/api/ops/v1/staff','listStaff'],['post','/api/ops/v1/staff','assignStaffRoles'],['patch','/api/ops/v1/staff/{personId}','patchStaffRoles'],['get','/api/ops/v1/audit-logs','listAuditLogs'],['get','/api/ops/v1/dashboard/summary','getDashboardSummary'],['post','/api/open/v1/quotes','openCreateQuote'],['post','/api/open/v1/orders','openCreateOrder'],['get','/api/open/v1/orders/{orderId}','openGetOrder'],['post','/api/open/v1/orders/{orderId}/actions/cancel','openCancelOrder'],['get','/api/open/v1/orders/{orderId}/tracking','openGetTracking'],['get','/api/driver/v1/ads','getDriverAd'],['post','/api/driver/v1/ad-interactions','recordDriverAdInteraction'],['get','/api/customer/v1/ads','getCustomerAd'],['post','/api/customer/v1/ad-interactions','recordCustomerAdInteraction']
];

test('OpsLead paths and OpenApiKey security scheme are present in the shared contract',()=>{
 for(const [method,path,operationId] of operations){
  const operation=spec.paths[path]?.[method];
  assert.equal(operation?.operationId,operationId,`${method.toUpperCase()} ${path}`);
  if(method!=='get')assert.ok(operation.requestBody?.content?.['application/json']?.schema,`${operationId} request body`);
  const codes=Object.keys(operation.responses).map(Number);
  for(const code of [400,401,403,404,429,503])assert.ok(codes.includes(code),`${operationId} ${code}`);
  if(method!=='get')for(const code of [412,428])assert.ok(codes.includes(code),`${operationId} ${code}`);
  assert.ok(Object.entries(operation.responses).some(([code,response])=>/^2/.test(code)&&response.content?.['application/json']?.schema),`${operationId} success schema`);
 }
 assert.equal(spec.components.securitySchemes.OpenApiKey?.scheme,'bearer');
});
