import {readFile} from 'node:fs/promises';
import {createKessSandboxClient} from './kess-pay.mjs';
// Explicit operator invocation only; no automatic live calls during tests or static builds.
const [action,file]=process.argv.slice(2);
if(!['create','query'].includes(action)||!file)throw Error('Usage: node integrations/kess-sandbox.mjs create|query <authorized-intent.json>');
const intent=JSON.parse(await readFile(file,'utf8'));
const config=Object.fromEntries(['clientId','clientSecret','username','password','secretKey','sellerCode'].map(k=>[k,process.env['KESS_'+k.replace(/[A-Z]/g,c=>'_'+c).toUpperCase()]]));
const result=await createKessSandboxClient(config)[action](intent);
console.log(JSON.stringify(result,null,2));
