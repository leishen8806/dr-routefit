import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
test('all prototype relative module imports resolve to files',async()=>{
  const files=(await readdir(root)).filter(name=>name.endsWith('.mjs'));
  const missing=[];
  for(const file of files){
    const source=await readFile(resolve(root,file),'utf8');
    for(const match of source.matchAll(/from\s+['"](\.\/[^'"]+\.mjs)['"]/g)){
      const target=resolve(root,match[1]);
      try{await readFile(target);}catch{missing.push(`${file} -> ${match[1]}`);}
    }
  }
  assert.deepEqual(missing,[]);
});
