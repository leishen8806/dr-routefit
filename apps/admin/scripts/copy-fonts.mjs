import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fonts = [
  ['@fontsource-variable/ibm-plex-sans', 'ibm-plex-sans'],
  ['@fontsource-variable/noto-sans-sc', 'noto-sans-sc'],
  ['@fontsource-variable/noto-sans-khmer', 'noto-sans-khmer'],
];
const output = fileURLToPath(new URL('../public/fonts/', import.meta.url));

await rm(output, { force: true, recursive: true });
for (const [packageName, directory] of fonts) {
  const source = path.dirname(fileURLToPath(import.meta.resolve(packageName)));
  const target = path.join(output, directory);
  await mkdir(target, { recursive: true });
  await cp(path.join(source, 'index.css'), path.join(target, 'index.css'));
  await cp(path.join(source, 'files'), path.join(target, 'files'), { recursive: true });
}
