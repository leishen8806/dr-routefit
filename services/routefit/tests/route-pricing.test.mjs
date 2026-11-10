import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateRouteQuote} from '../domain/pricing.mjs';

test('route quote uses volumetric weight, configured long-item fee and rounds KHR to 100',()=>{
 const quote=calculateRouteQuote({
  shipment:{weightGrams:1200,lengthCm:250,widthCm:40,heightCm:30,exclusiveVehicle:false},
  currency:'KHR',
  configuration:{baseMinor:1001,perKgMinor:100,longItemFeeMinor:205,volumetricDivisor:6000,khrRoundingMinor:100}
 });
 assert.equal(quote.chargeableWeightKg,50);
 assert.equal(quote.surchargeMinor,205);
 assert.equal(quote.totalMinor,6200);
 assert.throws(()=>calculateRouteQuote({shipment:{weightGrams:1000,lengthCm:301,widthCm:20,heightCm:20,exclusiveVehicle:false},currency:'KHR',configuration:{baseMinor:1000,perKgMinor:10,longItemFeeMinor:0,volumetricDivisor:6000,khrRoundingMinor:100}}),{code:'EXCLUSIVE_VEHICLE_REQUIRED'});
});
