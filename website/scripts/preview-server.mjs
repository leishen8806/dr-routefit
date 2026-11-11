import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const baseURL = 'http://127.0.0.1:4322';

export async function startPreview() {
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'preview', '--host', '127.0.0.1', '--port', '4322'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  for (let attempt = 0; attempt < 1800; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Preview exited early: ${output.trim()}`);
    try {
      const response = await fetch(`${baseURL}/km/`);
      if (response.ok) return child;
    } catch {}
    await delay(100);
  }
  child.kill();
  throw new Error(`Preview did not become ready: ${output.trim()}`);
}

export async function stopPreview(child) {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2000).then(() => child.kill('SIGKILL'))
  ]);
}
