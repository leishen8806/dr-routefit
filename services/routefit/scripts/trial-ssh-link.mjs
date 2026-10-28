import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createBrowserGrant} from '../adapters/local-browser.mjs';

export function resolveStaffActor(people,login){
 const name=String(login||'').trim();
 if(!name)return -1;
 const matches=people.reduce((found,person,index)=>person.sshLogin===name?[...found,index]:found,[]);
 return matches.length===1?matches[0]:-1;
}

export function parseEnvironment(text){
 const env={};
 for(const line of text.split(/\r?\n/)){const trimmed=line.trim();if(!trimmed||trimmed.startsWith('#'))continue;const match=trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);if(match)env[match[1]]=match[2].replace(/^['"]|['"]$/g,'');}
 return env;
}

async function main(){
 const envFile=process.env.ROUTEFIT_ENV_FILE||'/etc/routefit/routefit.env';
 const configured=parseEnvironment(await readFile(envFile,'utf8'));
 const setting=name=>process.env[name]??configured[name];
 if(setting('NODE_ENV')==='production'||setting('ROUTEFIT_AUTH_MODE')!=='development')throw Error('Explicit local development mode required');
 const sessionsFile=setting('ROUTEFIT_SESSION_FILE')||fileURLToPath(new URL('../.local/sessions.json',import.meta.url));
 const people=JSON.parse(await readFile(sessionsFile,'utf8'));
 const login=process.env.SUDO_USER;
 const actor=resolveStaffActor(people,login);
 if(actor<0)throw Error('SSH 登录名未登记或不唯一，拒绝建立试运营会话');
 const grant=await createBrowserGrant({sessionsFile,actor,origin:setting('ROUTEFIT_ALLOWED_ORIGIN')||`http://127.0.0.1:${setting('ROUTEFIT_PORT')||4180}`});
 console.log('LOCAL DEVELOPMENT ONLY — one-use browser link (expires in 60 seconds):');
 console.log(grant.url);
 await new Promise((resolve,reject)=>{process.stdin.on('error',reject);process.stdin.on('end',resolve);process.stdin.resume();});
}

if(process.argv[1]===fileURLToPath(import.meta.url))await main();
