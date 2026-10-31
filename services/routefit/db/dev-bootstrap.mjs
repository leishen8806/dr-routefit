import {mkdir,writeFile,access} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {localFixture} from './local-fixture.mjs';
import {digest,developmentPermissions,developmentCaseDeciderPermissions} from '../adapters/development-auth.mjs';

if(process.env.NODE_ENV==='production'||!process.env.ROUTEFIT_PG_ADMIN_URL)throw Error('Set ROUTEFIT_PG_ADMIN_URL to a local development PostgreSQL administrator');
const dir=new URL('../.local/',import.meta.url);
try{await access(dir);throw Error('.local already exists; reuse it rather than overwriting sessions');}catch(error){if(error.code!=='ENOENT')throw error;}
const fixture=await localFixture(process.env.ROUTEFIT_PG_ADMIN_URL);
try{
 await mkdir(dir,{recursive:true});
 const basePermissions=developmentPermissions.filter(p=>!['pricing:review','pricing:publish','prepayment:verify','prepayment:review','prepayment:approve','prepayment:post'].includes(p));
 const permissionSets=[basePermissions,basePermissions];
 for(const role of ['review','publish']){
  const principalId=randomUUID(),companyId=fixture.principals[0].companyId;
  await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF',$3,$4,'ACTIVE')",[principalId,companyId,'DEMO Pricing '+role,'local:'+principalId]);
  fixture.principals.push({companyId,principalId});permissionSets.push(['pricing:read','pricing:'+role]);
 }
 const caseDeciderPrincipalId=randomUUID(),caseDeciderCompanyId=fixture.principals[0].companyId;
 await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF','DEMO Case Decider',$3,'ACTIVE')",[caseDeciderPrincipalId,caseDeciderCompanyId,'local:'+caseDeciderPrincipalId]);
 await fixture.owner.query('INSERT INTO party.customer_access VALUES($1,$2,$3)',[caseDeciderCompanyId,fixture.customers[0],caseDeciderPrincipalId]);
 fixture.principals.push({companyId:caseDeciderCompanyId,principalId:caseDeciderPrincipalId});permissionSets.push(developmentCaseDeciderPermissions);
 for(const role of ['review','approve']){
  const principalId=randomUUID(),companyId=fixture.principals[0].companyId;
  await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF',$3,$4,'ACTIVE')",[principalId,companyId,'DEMO Finance '+role,'local:'+principalId]);
  await fixture.owner.query('INSERT INTO party.customer_access VALUES($1,$2,$3)',[companyId,fixture.customers[0],principalId]);
  fixture.principals.push({companyId,principalId});permissionSets.push(['prepayment:read','prepayment:'+role,role==='review'?'prepayment:verify':'prepayment:post']);
 }
 const clients=fixture.principals.map(()=>({token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),origin:'http://127.0.0.1:4180'}));
 const sessions=fixture.principals.map((p,i)=>({...p,tokenHash:digest(clients[i].token),csrfHash:digest(clients[i].csrf),permissions:permissionSets[i],expiresAt:new Date(Date.now()+86400000).toISOString()}));
 await writeFile(new URL('sessions.json',dir),JSON.stringify(sessions,null,2),{flag:'wx',mode:0o600});
 await writeFile(new URL('client.json',dir),JSON.stringify(clients[0],null,2),{flag:'wx',mode:0o600});
 await writeFile(new URL('dev.env',dir),`NODE_ENV=development\nROUTEFIT_AUTH_MODE=development\nROUTEFIT_DATABASE_URL=${fixture.runtimeUrl}\nROUTEFIT_SESSION_FILE="${fileURLToPath(new URL('sessions.json',dir)).replaceAll('\\','/')}"\nROUTEFIT_PORT=4180\n`,{flag:'wx',mode:0o600});
 console.log(`Created synthetic local database ${fixture.database}; credentials written only to .local. Sessions expire in 24 hours.`);
}finally{await fixture.owner.end();await fixture.admin.end();}
