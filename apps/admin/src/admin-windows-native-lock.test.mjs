import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const win32X64Package = /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+-win32-x64(?:-msvc)?$/;

test('locks every Windows x64 native optional dependency declared by an admin package', async () => {
  const lockfile = new URL('../../../package-lock.json', import.meta.url);
  const lock = JSON.parse(await readFile(lockfile, 'utf8'));
  const expected = [];

  for (const [parentPath, parent] of Object.entries(lock.packages)) {
    if (!parentPath.startsWith('apps/admin/node_modules/')) continue;

    for (const [name, version] of Object.entries(parent.optionalDependencies ?? {})) {
      if (win32X64Package.test(`node_modules/${name}`)) {
        expected.push({ name, parentPath, version });
      }
    }
  }

  expected.sort((left, right) => left.name.localeCompare(right.name));
  console.log(`admin Windows x64 native optional dependencies: ${expected.map(({ name }) => name).join(', ')}`);
  assert.ok(expected.length > 0, 'expected admin packages to declare Windows x64 native optional dependencies');

  for (const { name, parentPath, version } of expected) {
    const packagePath = `apps/admin/node_modules/${name}`;
    const nativePackage = lock.packages[packagePath];
    assert.ok(nativePackage, `${parentPath} declares ${name}, but ${packagePath} is absent from the lockfile`);
    assert.equal(nativePackage.version, version, `${packagePath} must match ${parentPath}'s declared version`);
    assert.equal(nativePackage.optional, true, `${packagePath} must be optional`);
    assert.deepEqual(nativePackage.os, ['win32'], `${packagePath} must be Windows-only`);
    assert.deepEqual(nativePackage.cpu, ['x64'], `${packagePath} must be x64-only`);
  }
});
