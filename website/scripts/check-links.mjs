import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const pages = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(target);
    else if (entry.name.endsWith('.html')) pages.push(target);
  }
}

await collect(dist);
const failures = [];
for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
  for (const match of html.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(raw) || raw === '#') continue;
    if (raw.startsWith('#')) {
      if (!ids.has(raw.slice(1))) failures.push(`${path.relative(dist, page)} -> ${raw}`);
      continue;
    }
    const url = new URL(raw, `https://site.invalid/${path.relative(dist, page).replaceAll('\\', '/')}`);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target = path.join(dist, relative.endsWith('/') ? relative : relative.replace(/\/$/, ''));
    const candidates = [target, path.join(target, 'index.html')];
    let exists = false;
    for (const candidate of candidates) {
      try { if ((await stat(candidate)).isFile()) exists = true; } catch {}
    }
    if (!exists) failures.push(`${path.relative(dist, page)} -> ${raw}`);
  }
}

if (failures.length) {
  console.error(`LINK_CHECK=FAIL (${failures.length})`);
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`LINK_CHECK=PASS PAGES=${pages.length}`);
