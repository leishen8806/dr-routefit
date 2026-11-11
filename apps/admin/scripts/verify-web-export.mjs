import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const fonts = ['ibm-plex-sans', 'noto-sans-sc', 'noto-sans-khmer'];
const html = await readFile(path.join(root, 'index.html'), 'utf8');

for (const font of fonts) {
  const href = `/fonts/${font}/index.css`;
  if (!html.includes(`href="${href}"`)) {
    throw new Error(`Missing exported font stylesheet link: ${href}`);
  }

  const css = await stat(path.join(root, 'fonts', font, 'index.css'));
  if (css.size === 0) {
    throw new Error(`Empty exported font stylesheet: ${href}`);
  }
}

console.log(`Verified static export links and font CSS for ${fonts.length} families.`);
