import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNames, checkGaps, checkFrozen, parseExemptions } from './check-migration-numbering.mjs';

test('AC-1 duplicate prefix reports both files', () => {
  const r = checkNames(['001_a.sql', '064_x.sql', '064_dup_probe.sql']);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /064_dup_probe\.sql/);
  assert.match(r.errors[0], /064_x\.sql/);
});
test('bad names fail', () => assert.equal(checkNames(['abc.sql', '1_a.sql']).errors.length, 2));
test('AC-2 gap fails; exemption covers it; stale exemption fails', () => {
  assert.equal(checkGaps([1, 2, 4], []).length, 1);
  assert.equal(checkGaps([1, 2, 4], [[3, 3]]).length, 0);
  assert.equal(checkGaps([1, 2, 3], [[3, 3]]).length, 1);
});
test('exemption needs reason and CMP approvedBy', () => {
  assert.equal(parseExemptions('[{"from":3,"reason":"r","approvedBy":"CMP-1"}]').errors.length, 0);
  assert.equal(parseExemptions('[{"from":3}]').errors.length, 1);
  assert.equal(parseExemptions('nope').errors.length, 1);
});
test('AC-3 modify/delete/add in 001-064 fail; 065+ ok; other paths ok', () => {
  const d = 'services/routefit/db/migrations';
  assert.equal(checkFrozen([`M\t${d}/001_a.sql`, `D\t${d}/064_b.sql`, `A\t${d}/010_c.sql`], d).length, 3);
  assert.equal(checkFrozen([`A\t${d}/065_a.sql`, 'M\tREADME.md'], d).length, 0);
});
