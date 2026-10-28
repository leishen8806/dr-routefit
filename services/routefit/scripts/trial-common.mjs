import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {dirname} from 'node:path';
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
