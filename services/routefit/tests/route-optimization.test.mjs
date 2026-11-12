import test from 'node:test';
import assert from 'node:assert/strict';
import {planOptimizationRoutes} from '../domain/route-optimization.mjs';

const vehicles=[
 {id:'small-1',type:'small',capacityVolume:10,availableSlots:['am']},
 {id:'medium-1',type:'medium',capacityVolume:20,availableSlots:['am','pm']}
];

test('optimization assigns long cargo only to a configured eligible vehicle type',()=>{
 const result=planOptimizationRoutes({vehicles,orders:[{id:'long',volume:5,slot:'am',requiredVehicleType:'medium'}]});
 assert.deepEqual(result.routes,[{vehicleId:'medium-1',slot:'am',orderIds:['long'],usedVolume:5}]);
 assert.deepEqual(result.unassignedOrderIds,[]);
});

test('optimization returns an unassigned order instead of exceeding vehicle capacity',()=>{
 const result=planOptimizationRoutes({vehicles:[vehicles[0]],orders:[{id:'a',volume:10,slot:'am'},{id:'b',volume:1,slot:'am'}]});
 assert.deepEqual(result.routes,[{vehicleId:'small-1',slot:'am',orderIds:['a'],usedVolume:10}]);
 assert.deepEqual(result.unassignedOrderIds,['b']);
});

test('optimization produces the same route order regardless of input order',()=>{
 const input={vehicles,orders:[{id:'b',volume:1,slot:'am'},{id:'a',volume:1,slot:'am'}]};
 const reversed={...input,orders:[...input.orders].reverse()};
 assert.deepEqual(planOptimizationRoutes(input),planOptimizationRoutes(reversed));
});
