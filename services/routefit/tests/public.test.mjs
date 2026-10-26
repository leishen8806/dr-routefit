import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readPublicTracking} from '../adapters/public.mjs';

test('public tracking hashes its capability and returns only the safe projection',async()=>{
 const ref='r'.repeat(22),updatedAt=new Date('2026-10-25T00:00:00.000Z'),pool={query:async(sql,params)=>{assert.equal(sql,'SELECT * FROM sharing.public_tracking($1)');assert.deepEqual(params,[createHash('sha256').update(ref).digest('hex')]);return {rows:[{order_label:'RF-***-001',state:'in_transit',promise_window:null,eta_at:null,eta_type:'UNAVAILABLE',updated_at:updatedAt,quality:'fresh',contact_entry:'https://routefit.invalid/contact'}]};}};
 assert.deepEqual(await readPublicTracking(pool,ref),{orderLabel:'RF-***-001',state:'in_transit',promiseWindow:null,etaAt:null,etaType:'UNAVAILABLE',updatedAt:updatedAt.toISOString(),quality:'fresh',contactEntry:'https://routefit.invalid/contact'});
 await assert.rejects(readPublicTracking({query:async()=>({rows:[]})},ref),error=>error.code==='NOT_FOUND');
});
