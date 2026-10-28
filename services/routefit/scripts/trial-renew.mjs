import {readFile} from 'node:fs/promises';
import {writePrivate,token,digest} from './trial-common.mjs';
if(process.env.NODE_ENV==='production')throw Error('trial:renew refuses NODE_ENV=production');
const file=process.env.ROUTEFIT_SESSION_FILE||new URL('../.local/sessions.json',import.meta.url).pathname;const sessions=JSON.parse(await readFile(file,'utf8'));const expiresAt=new Date(Date.now()+18*3600000).toISOString();
for(const session of sessions.filter(x=>x.authType!=='service')){session.tokenHash=digest(token());session.csrfHash=digest(token());session.expiresAt=expiresAt;}
await writePrivate(file,sessions);console.log('Trial identities renewed for 18 hours. Restart the service, then run session:link once per staff identity.');
