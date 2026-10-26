import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {token,csrf,origin}=JSON.parse(await readFile(new URL('../.local/client.json',import.meta.url),'utf8'));
const prefix=origin+'/api/ops/v1/pricing';
async function request(path,body,version){
 const response=await fetch(prefix+path,{method:body?'POST':'GET',headers:{Cookie:`rf_session=${token}`,Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const value=await response.json();assert.ok(response.ok,`${response.status}: ${value.error?.code}`);return value;
}
const tariff=await request('/tariffs',{name:'DEMO smoke tariff',owner:'DR',currency:'USD',scope:'Synthetic local trial only'});
const updated=await request(`/tariffs/${tariff.id}/actions/save-fee`,{code:'base',enabled:true,method:'fixed',amount:200,unit:null,includedMilli:0,stepMilli:1000,share:true,scope:'DEMO',evidence:'Synthetic test'},tariff.version);
const trial=await request(`/tariffs/${tariff.id}/trials`,{lines:[{code:'base',quantityMilli:null,basisMinor:null}]},updated.version);
assert.equal(trial.totalMinor,200);assert.equal((await request(`/trials/${trial.id}`)).totalMinor,200);
console.log('Created draft, saved fee, calculated 200 USD cents, read persisted simulation. No order or payment changed.');
