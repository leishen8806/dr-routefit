import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const outputDirectory = await mkdtemp(join(tmpdir(), 'routefit-driver-export-'));
const npxCli = join(dirname(process.env.npm_execpath), 'npx-cli.js');

try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npxCli, 'expo', 'export', '--platform', 'android', '--output-dir', outputDirectory], {
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
