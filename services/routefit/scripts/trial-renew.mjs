import {readFile} from 'node:fs/promises';
import {writePrivate,localFile,renewSessions} from './trial-common.mjs';
if(process.env.NODE_ENV==='production')throw Error('trial:renew refuses NODE_ENV=production');
const file=process.env.ROUTEFIT_SESSION_FILE||localFile(import.meta.url,'../.local/sessions.json');const sessions=JSON.parse(await readFile(file,'utf8'));const expiresAt=new Date(Date.now()+18*3600000).toISOString();
const renewed=renewSessions(sessions,expiresAt);
await writePrivate(file,renewed);console.log('Trial identities renewed for 18 hours. Restart the service, then run session:link once per staff identity.');
