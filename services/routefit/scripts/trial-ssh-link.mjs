import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createBrowserGrant} from '../adapters/local-browser.mjs';

export function resolveStaffActor(people,login){
 const name=String(login||'').trim();
 if(!name)return -1;
 return people.findIndex(person=>person.sshLogin===name||person.login===name||person.humanId===name);
}

async function main(){
 if(process.env.NODE_ENV==='production'||process.env.ROUTEFIT_AUTH_MODE!=='development')throw Error('Explicit local development mode required');
 const staffFile=process.env.ROUTEFIT_TRIAL_STAFF_FILE||fileURLToPath(new URL('../.local/trial-staff.json',import.meta.url));
 const sessionsFile=process.env.ROUTEFIT_SESSION_FILE||fileURLToPath(new URL('../.local/sessions.json',import.meta.url));
 const people=JSON.parse(await readFile(staffFile,'utf8'));
 const login=process.env.SSH_LOGIN||process.env.USER||process.env.LOGNAME;
 const actor=resolveStaffActor(people,login);
 if(actor<0)throw Error('SSH 登录名未登记，拒绝建立试运营会话');
 const grant=await createBrowserGrant({sessionsFile,actor,origin:process.env.ROUTEFIT_ALLOWED_ORIGIN||`http://127.0.0.1:${process.env.ROUTEFIT_PORT||4180}`});
 console.log('LOCAL DEVELOPMENT ONLY — one-use browser link (expires in 60 seconds):');
 console.log(grant.url);
 await new Promise((resolve,reject)=>{process.stdin.on('error',reject);process.stdin.on('end',resolve);process.stdin.resume();});
}

if(process.argv[1]===fileURLToPath(import.meta.url))await main();
