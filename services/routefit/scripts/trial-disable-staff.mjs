import {fileURLToPath} from 'node:url';
import {runDisableStaff} from './trial-disable.mjs';
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.env.NODE_ENV==='production')throw Error('trial:staff:disable refuses NODE_ENV=production');const result=await runDisableStaff();console.log(`Staff disabled; customer grants cleared: ${result.cleared}; sessions removed: ${result.removed}.`);}
