import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {digest,developmentPermissions} from '../adapters/development-auth.mjs';

export const localOnly=()=>{const url=new URL(process.env.ROUTEFIT_DATABASE_URL||process.env.ROUTEFIT_MIGRATION_DATABASE_URL||process.env.ROUTEFIT_PG_ADMIN_URL||'');if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('trial tooling only permits local PostgreSQL');return url;};
export const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
export const writePrivate=async(file,value)=>{await mkdir(dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value,null,2)+'\n',{mode:0o600});};
export const token=()=>randomBytes(32).toString('hex');
export const newSession=(principal,permissions,expiresAt)=>{const raw=token(),csrf=token();return [{...principal,tokenHash:digest(raw),csrfHash:digest(csrf),permissions,expiresAt},raw,csrf];};
export const poolFor=url=>new pg.Pool({connectionString:url,max:3});
export const rolePermissions=Object.freeze({order_quote:['orders:read','orders:create','orders:edit','orders:verify','orders:submit','areas:read','quotes:read','quotes:create','quotes:confirm','pricing:read'],policy_author:['pricing:read','pricing:write'],policy_reviewer:['pricing:read','pricing:review'],policy_publisher:['pricing:read','pricing:publish']});
export const fullStaffPermissions=Object.freeze([...new Set([...developmentPermissions])]);
export const localFile=(url,...parts)=>fileURLToPath(new URL(parts.join('/'),url));
export function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(quoted){if(ch==='"'&&next==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}else if(ch==='"'&&cell===''){quoted=true;}else if(ch===','){row.push(cell.trim());cell='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&next==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=ch;}if(quoted)throw Error('CSV contains an unterminated quote');if(cell||row.length){row.push(cell.trim());rows.push(row);}return rows;}
export function rowsToObjects(rows,name='CSV'){if(!rows.length)return [];const [head,...data]=rows;if(head.some(x=>!x)||data.some(row=>row.length!==head.length))throw Error(`${name}: invalid row width`);return data.map(row=>Object.fromEntries(head.map((key,i)=>[key,row[i]||''])));}
export function validateStaffAssignments(people){if(!Array.isArray(people)||!people.length)throw Error('trial-staff requires a non-empty trial-staff.json');const conflicting=new Set(['policy_author','policy_reviewer','policy_publisher']);const byHuman=new Map(),logins=new Set();for(const person of people){if(!person.humanId)throw Error('trial staff humanId is required');if(!person.sshLogin||logins.has(person.sshLogin))throw Error('trial staff sshLogin is required and must be unique');logins.add(person.sshLogin);const roles=person.roles||[];const prior=byHuman.get(person.humanId)||[];if(roles.filter(r=>conflicting.has(r)).length+prior.filter(r=>conflicting.has(r)).length>1)throw Error(`同一人不能兼任编制、复核、发布：${person.humanId}`);byHuman.set(person.humanId,[...prior,...roles]);}return people;}
export function assertBackupDirectoryOutsideRepo(repo,dir){const root=resolve(repo),target=resolve(dir);if(target===root||target.startsWith(root+sep))throw Error('backup directory must be outside the repository');return target;}
export function assertRestoreDatabase(name){if(!name||name==='routefit_trial')throw Error('usage: trial:restore BACKUP.dump NEW_DATABASE');return name;}
export function renewSessions(sessions,expiresAt){return sessions.map(session=>session.authType==='service'?session:{...session,tokenHash:digest(token()),csrfHash:digest(token()),expiresAt});}
