import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJson} from '../adapters/json.mjs';

test('JSON rejects duplicate decoded keys at every object depth',()=>{
 for(const text of [
  '{"amount":200,"amount":300}',
  '{"amount":200,"amou\\u006et":300}',
  '{"lines":[{"code":"base","code":"insurance"}]}',
  '{"nested":{"":{"x":1,"x":2}}}',
  '{"__proto__":1,"__proto__":2}',
  '{"保险":1,"\\u4fdd险":2}'
 ])assert.throws(()=>parseJson(Buffer.from(text)),{status:400,code:'INVALID_JSON'});
});

test('JSON preserves valid values, escapes and keys in separate objects',()=>{
 const value={name:'报价 តម្លៃ',lines:[{code:'base',amount:200},{code:'insurance',amount:125}],nested:{code:'base'},text:'[{}] "amount":200, "amount":300 \\ \\"',enabled:true,empty:null};
 const text=JSON.stringify(value);assert.deepEqual(parseJson(Buffer.from(text)),value);
 for(const text of ['{"constructor":1,"__proto__":{"constructor":2}}','{"":1,"nested":{"":2}}','[1e2,-2.5,null,true,false,"text"]','"top level"','123','null'])assert.deepEqual(parseJson(Buffer.from(text)),JSON.parse(text));
});

test('JSON rejects malformed syntax, BOM and invalid UTF-8 rather than replacing bytes',()=>{
 for(const bytes of [Buffer.from('{'),Buffer.from('{"x":NaN}'),Buffer.from('{"x":"raw\nnewline"}'),Buffer.from('\uFEFF{}'),Buffer.from([0x22,0xff,0x22]),Buffer.from([0x22,0xc0,0xaf,0x22]),Buffer.from([0x22,0xed,0xa0,0x80,0x22])])assert.throws(()=>parseJson(bytes),{status:400,code:'INVALID_JSON'});
 assert.deepEqual(parseJson(Buffer.from('{"x":"�"}')),{x:'�'});
});
