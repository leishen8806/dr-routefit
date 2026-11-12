import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
test('exemption range must be safe integers within 1..999 (CMP-1417 review: 1e308 hang)', () => {
  const ex = (from, to) => parseExemptions(JSON.stringify([{ from, to, reason: 'r', approvedBy: 'CMP-1' }]));
  const t0 = Date.now();
  for (const [f, t] of [[1, 1e308], [1e308, 1e308], [0, 5], [-1, 3], [1.5, 2], [1, 1000], [3, 2], [9007199254740992, 9007199254740992]]) {
    const r = ex(f, t);
    assert.equal(r.errors.length, 1, `${f}..${t} must be rejected`);
    assert.equal(r.ranges.length, 0);
  }
  assert.equal(ex(1, 999).errors.length, 0);
  assert.ok(Date.now() - t0 < 2000, 'must reject immediately, not loop');
  // even a huge range passed straight to checkGaps must terminate
  assert.equal(checkGaps([1, 2, 3], [[3, 1e308]]).length, 1); // only 003 is stale; no loop over the range
});
test('AC-3 modify/delete/add in 001-064 fail; 065+ ok; other paths ok', () => {
  const d = 'services/routefit/db/migrations';
  assert.equal(checkFrozen([`M\t${d}/001_a.sql`, `D\t${d}/064_b.sql`, `A\t${d}/010_c.sql`], d).length, 3);
  assert.equal(checkFrozen([`A\t${d}/065_a.sql`, 'M\tREADME.md'], d).length, 0);
});

// CLI-level boundary tests (CMP-1417 R1): assert concrete exit code + message, must not hang.
const SCRIPT = process.env.CHECK_SCRIPT_UNDER_TEST ?? fileURLToPath(new URL('./check-migration-numbering.mjs', import.meta.url));
function cli(exemptions) {
  const d = mkdtempSync(join(tmpdir(), 'mn-'));
  const mig = join(d, 'migrations'); const ex = join(d, 'ex.json');
  writeFileSync(ex, typeof exemptions === 'string' ? exemptions : JSON.stringify(exemptions));
  return { d, mig, ex };
}
function runCli(exemptions) {
  const { mig, ex } = cli(exemptions);
  mkdirSync(mig); writeFileSync(join(mig, '001_a.sql'), '');
  return spawnSync(process.execPath, [SCRIPT, '--dir', mig, '--exemptions', ex], { encoding: 'utf8', timeout: 15000 });
}
const item = (from, to) => [{ from, to, reason: 'probe', approvedBy: 'CMP-1' }];
for (const [name, ex] of [
  ['1e308', item(1e308, 1e308)],
  ['Number.MAX_SAFE_INTEGER', item(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)],
  ['from=1,to=1e308', item(1, 1e308)],
  ['to<from', item(5, 3)],
]) {
  test(`CLI rejects exemption ${name}: exit 1 + exemption[0] message`, () => {
    const r = runCli(ex);
    assert.equal(r.error, undefined, 'must not time out');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /FAIL: exemption\[0\]: from\/to must be safe integers within 1\.\.999, to>=from/);
  });
}
test('CLI rejects blank reason', () => {
  const r = runCli([{ from: 3, reason: '   ', approvedBy: 'CMP-1' }]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL: exemption\[0\]: reason and approvedBy/);
});