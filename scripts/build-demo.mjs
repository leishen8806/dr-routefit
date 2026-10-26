import {mkdir,readdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.resolve(process.argv[2]||path.join(root,'dist/demo'));
try{await stat(out);throw Error('Output directory must not exist: '+out);}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(path.join(out,'prototype'),{recursive:true});await mkdir(path.join(out,'brand/logo'),{recursive:true});
const files=(await readdir(path.join(root,'prototype'))).filter(n=>/\.(html|css|mjs)$/.test(n)&&!n.endsWith('.test.mjs')&&!['server.mjs','integration-server.mjs'].includes(n));
for(const name of files)await copyFile(path.join(root,'prototype',name),path.join(out,'prototype',name));
await mkdir(path.join(out,'prototype/designs/finance-v01'),{recursive:true});
for(const name of await readdir(path.join(root,'prototype/designs/finance-v01')))if(name.endsWith('.png'))await copyFile(path.join(root,'prototype/designs/finance-v01',name),path.join(out,'prototype/designs/finance-v01',name));
for(const name of await readdir(path.join(root,'brand/logo')))if(name.endsWith('.svg'))await copyFile(path.join(root,'brand/logo',name),path.join(out,'brand/logo',name));
await writeFile(path.join(out,'.nojekyll'),'');
await writeFile(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./prototype/showcase.html"><title>DR RouteFit Demo</title><a href="./prototype/showcase.html">打开 DR RouteFit 闭环演示</a></html>');
await writeFile(path.join(out,'README.md'),'# DR RouteFit Demo\n\nStatic demo snapshot. Synthetic data only; no real authentication, GPS, banking or insurance. Progress is per browser tab and is not shared between visitors.\n\nPages source: branch `codex/demo-pages`, folder `/ (root)`. Start at `prototype/showcase.html`; full workspace at `prototype/index.html`. The local HTTP integration server is not deployed.\n\nOnly runtime HTML/CSS/JS and brand SVG assets are included; no PRD, records, test scripts or credentials. Publish a fresh snapshot after source changes.\n');
// Check relative runtime dependencies before publishing; dynamic scenario links remain browser-tested.
for(const name of files){const content=await readFile(path.join(out,'prototype',name),'utf8');const refs=[...content.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g),...content.matchAll(/(?:src|href)=["'](\.\.?\/[^"'$]+)["']/g)];for(const match of refs){const ref=match[1].split(/[?#]/)[0];const target=path.resolve(out,'prototype',ref);if(!target.startsWith(out+path.sep))throw Error('Dependency escapes output: '+ref);await stat(target);}}
console.log(JSON.stringify({output:out,runtimeFiles:files.length,checked:'relative module and HTML links',entry:'prototype/showcase.html'}));
