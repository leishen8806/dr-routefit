import test from 'node:test';
import assert from 'node:assert/strict';
import * as dispatch from '../adapters/dispatch.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'};
const input={orderIds:['33333333-3333-4333-8333-333333333333'],vehicleIds:['44444444-4444-4444-8444-444444444444']};
const plan={routes:[{vehicleId:input.vehicleIds[0],slot:'am',orderIds:input.orderIds,usedVolume:12}],unassignedOrderIds:[]};

test('writeOptimizationRun stores a company-scoped immutable input and every generated route', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{calls.push({sql,params});return {rows:[]};}};

 assert.equal(typeof dispatch.writeOptimizationRun,'function');
 const result=await dispatch.writeOptimizationRun(client,principal,input,plan,'routefit-test-key-0001');

 assert.equal(result.state,'generated');
 assert.equal(result.version,1);
 assert.deepEqual(result.input,input);
 assert.deepEqual(result.routes,plan.routes);
 assert.match(calls[0].sql,/INSERT INTO dispatch\.optimization_run/);
 assert.equal(calls[0].params[1],principal.companyId);
 assert.deepEqual(calls[0].params[6],input);
 assert.match(calls[1].sql,/INSERT INTO dispatch\.optimization_route/);
 assert.equal(calls[1].params[1],principal.companyId);
 assert.deepEqual(calls[1].params[8],plan.routes[0]);
});
