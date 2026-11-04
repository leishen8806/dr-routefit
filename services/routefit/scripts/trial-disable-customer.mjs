import {fileURLToPath} from 'node:url';
import {runDisableCustomer} from './trial-disable.mjs';
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.env.NODE_ENV==='production')throw Error('trial:customer:disable refuses NODE_ENV=production');const result=await runDisableCustomer();console.log(`Customer disabled; grants cleared: ${result.cleared}; sessions removed: ${result.removed}.`);}
