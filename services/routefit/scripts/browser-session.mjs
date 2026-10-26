import {createBrowserGrant} from '../adapters/local-browser.mjs';
if(process.env.NODE_ENV==='production'||process.env.ROUTEFIT_AUTH_MODE!=='development')throw Error('Explicit local development mode required');
if(!process.env.ROUTEFIT_SESSION_FILE)throw Error('ROUTEFIT_SESSION_FILE is required');
const actor=process.argv[2]===undefined?0:Number(process.argv[2]);
const grant=await createBrowserGrant({sessionsFile:process.env.ROUTEFIT_SESSION_FILE,actor,origin:process.env.ROUTEFIT_ALLOWED_ORIGIN||`http://127.0.0.1:${process.env.ROUTEFIT_PORT||4180}`});
console.log(`LOCAL DEVELOPMENT ONLY — company ${grant.companyId}; identity ${grant.principalId}`);
console.log('Open this one-use link in the browser within 60 seconds. Do not share or record it:');
console.log(grant.url);
