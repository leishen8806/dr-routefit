import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell} from '../adapters/exports.mjs';

test('finance CSV values quote commas and neutralize spreadsheet formulas',()=>{
 assert.equal(csvCell('a,b'),'"a,b"');
 assert.equal(csvCell('=SUM(A1:A2)'),'"\'=SUM(A1:A2)"');
 assert.equal(csvCell('"quoted"'),'"""quoted"""');
});
