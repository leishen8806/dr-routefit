import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog,calculate,validateFee} from '../domain/pricing.mjs';
import {validate,specification} from '../adapters/contract.mjs';
import {developmentAuth,digest} from '../adapters/development-auth.mjs';
import {fingerprint,routes} from '../application/http.mjs';
import {policyRoutes} from '../application/policy.mjs';
import {intakeRoutes} from '../application/intake.mjs';
import {orderRoutes} from '../application/orders.mjs';
import {quoteRoutes} from '../application/quotes.mjs';
import {prepaymentRoutes} from '../application/prepayment.mjs';
import {caseRoutes} from '../application/cases.mjs';
import {financeRoutes} from '../application/finance.mjs';
import {dispatchRoutes} from '../application/dispatch.mjs';
import {evidenceRoutes} from '../application/evidence.mjs';
import {customerRoutes} from '../application/customer.mjs';
import {exceptionRoutes} from '../application/exceptions.mjs';
import {partnerRoutes} from '../application/partners.mjs';
import {bookingRoutes} from '../application/bookings.mjs';
import {driverRoutes} from '../application/driver.mjs';
import {custodyRoutes} from '../application/custody.mjs';
import {deliveryRoutes} from '../application/delivery.mjs';
import {returnRoutes} from '../application/returns.mjs';
import {integrationRoutes} from '../application/integration.mjs';
import {publicRoutes} from '../application/public.mjs';
import {warehouseRoutes} from '../application/warehouse.mjs';
import {notificationRoutes} from '../application/notifications.mjs';
import {accessRoutes} from '../application/access.mjs';
import {merchantRoutes,partnerPortalRoutes} from '../application/external-subjects.mjs';
import {exportRoutes} from '../application/exports.mjs';
import {recipientRoutes} from '../application/recipient.mjs';
import {feeCatalog} from '../../../prototype/fee-settings.mjs';

export const fixed=(code='base',amount=200,share=true)=>({code,enabled:true,method:'fixed',amount,unit:null,includedMilli:0,stepMilli:1000,share,scope:'DEMO only',evidence:'Synthetic fixture'});
const tariff={owner:'DR',currency:'USD',rules:[]};
test('catalog parity and exact local operation mapping',()=>{
 assert.deepEqual(catalog,feeCatalog);validate('PricingCatalog',catalog);
 const implemented=Object.entries(specification.paths).filter(([path])=>path.startsWith('/api/ops/v1/pricing/')).flatMap(([,methods])=>Object.values(methods)).filter(x=>x['x-implementation-status']==='LOCAL_IMPLEMENTED_NOT_DEPLOYED');
 assert.deepEqual(implemented.map(x=>x.operationId).sort(),[...routes,...policyRoutes].map(x=>x.operation).sort());
 for(const r of routes){const op=implemented.find(x=>x.operationId===r.operation);assert.deepEqual(op['x-permissions'],[r.write?'pricing:write':'pricing:read']);}
 const all=Object.values(specification.paths).flatMap(Object.values).filter(x=>x['x-implementation-status']==='LOCAL_IMPLEMENTED_NOT_DEPLOYED');
 assert.deepEqual(all.map(x=>x.operationId).sort(),[...routes,...policyRoutes,...orderRoutes,...intakeRoutes,...quoteRoutes,...prepaymentRoutes,...caseRoutes,...financeRoutes,...exportRoutes,...customerRoutes,...merchantRoutes,...partnerPortalRoutes,...dispatchRoutes,...driverRoutes,...custodyRoutes,...deliveryRoutes,...returnRoutes,...integrationRoutes,...publicRoutes,...recipientRoutes,...warehouseRoutes,...notificationRoutes,...accessRoutes,...exceptionRoutes,...partnerRoutes,...bookingRoutes,...evidenceRoutes].map(x=>x.operation).sort());
 for(const r of [...orderRoutes,...intakeRoutes,...quoteRoutes,...prepaymentRoutes,...caseRoutes,...financeRoutes,...exportRoutes,...customerRoutes,...merchantRoutes,...partnerPortalRoutes,...dispatchRoutes,...driverRoutes,...custodyRoutes,...deliveryRoutes,...returnRoutes,...integrationRoutes,...publicRoutes,...recipientRoutes,...warehouseRoutes,...notificationRoutes,...accessRoutes,...exceptionRoutes,...partnerRoutes,...bookingRoutes,...evidenceRoutes])assert.deepEqual(all.find(x=>x.operationId===r.operation)['x-permissions'],[r.permission]);
});
test('contract fixtures validate with the actual HTTP validator',async()=>{
 const cases=JSON.parse(await readFile(new URL('../../../contracts/examples/schema-cases.json',import.meta.url),'utf8')).filter(x=>x.schema.startsWith('Pricing'));
 assert.equal(cases.length,32);
 for(const c of cases){if(c.valid)validate(c.schema,c.value);else assert.throws(()=>validate(c.schema,c.value),{code:'VALIDATION_FAILED'});}
});
test('fixed + rounded unit + insurance, with a separate distribution base',()=>{
 const rules=[fixed(),{...fixed('weight',100),method:'unit',unit:'kg',includedMilli:1000,stepMilli:1000},{...fixed('insurance',125,false),method:'percent'}];
 rules.forEach(r=>{validate('PricingFeeDraft',r);validateFee(r,tariff);});
 const result=calculate({...tariff,rules},[{code:'base',quantityMilli:null,basisMinor:null},{code:'weight',quantityMilli:1001,basisMinor:null},{code:'insurance',quantityMilli:null,basisMinor:10000}]);
 assert.deepEqual([result.totalMinor,result.shareMinor,result.insuranceMinor,result.separateMinor],[425,300,125,125]);
 assert.equal(calculate({...tariff,rules:[rules[1]]},[{code:'weight',quantityMilli:1000,basisMinor:null}]).totalMinor,0);
});
test('percentage HALF_UP, KHR integer currency and no COD principal in fees',()=>{
 const rules=[{...fixed('cod',100,false),method:'percent'}];
 const result=calculate({...tariff,currency:'KHR',rules},[{code:'cod',quantityMilli:null,basisMinor:50}]);
 assert.equal(result.totalMinor,1);assert.equal(result.shareMinor,0);
});
test('cross-field restrictions block invalid units, shares and missing basis',()=>{
 for(const code of ['insurance','cod','storage','inbound','outbound','packing'])assert.throws(()=>validateFee(fixed(code),tariff),{code:'INVALID_SHARE_BASIS'});
 assert.throws(()=>validateFee(fixed(),{owner:'VET'}),{code:'INVALID_SHARE_BASIS'});
 assert.throws(()=>validateFee({...fixed(),method:'unit',unit:'floor'},tariff),{code:'INVALID_FEE_UNIT'});
 assert.throws(()=>validateFee({...fixed(),method:'percent'},tariff),{code:'INVALID_PERCENT_FEE'});
 assert.throws(()=>validateFee({...fixed('insurance',10001,false),method:'percent'},tariff),{code:'INVALID_PERCENT_FEE'});
 assert.throws(()=>validateFee({...fixed(),unit:'kg'},tariff),{code:'UNUSED_UNIT_FIELDS'});
 assert.throws(()=>calculate({...tariff,rules:[fixed()]},[{code:'base',quantityMilli:1,basisMinor:null}]),{code:'INVALID_FEE_INPUT'});
});
test('overflow, duplicate fees, disabled and unknown fees fail closed',()=>{
 const input={code:'base',quantityMilli:null,basisMinor:null};
 assert.throws(()=>calculate({...tariff,rules:[fixed()]},[input,input]),{code:'DUPLICATE_FEE'});
 assert.throws(()=>calculate({...tariff,rules:[{...fixed(),enabled:false}]},[input]),{code:'FEE_NOT_ENABLED'});
 const rules=[fixed('base',9000000000000),fixed('flash',1)];
 assert.throws(()=>calculate({...tariff,rules},[input,{...input,code:'flash'}]),{code:'AMOUNT_OUT_OF_RANGE'});
 for(const change of [{amount:0.1},{amount:-1},{amount:9000000000001},{companyId:'spoof'}])assert.throws(()=>validate('PricingFeeDraft',{...fixed(),...change}),{code:'VALIDATION_FAILED'});
});
test('fingerprint normalizes object keys but preserves order, values and version',()=>{
 assert.equal(fingerprint({a:1,b:{c:2,d:3}}),fingerprint({b:{d:3,c:2},a:1}));
 assert.notEqual(fingerprint({version:1}),fingerprint({version:2}));
 assert.notEqual(fingerprint([1,2]),fingerprint([2,1]));
});
test('development auth requires valid identity, exact Origin and CSRF',()=>{
 const token='a'.repeat(64),csrf='b'.repeat(64),origin='http://127.0.0.1:4180';
 const session={tokenHash:digest(token),csrfHash:digest(csrf),companyId:'00000000-0000-4000-8000-000000000001',principalId:'00000000-0000-4000-8000-000000000002',permissions:['pricing:read'],expiresAt:new Date(Date.now()+60000).toISOString()};
 const auth=developmentAuth([session],origin),headers={cookie:'rf_session='+token,origin,'x-csrf-token':csrf};
 assert.equal(auth({method:'POST',headers}).companyId,session.companyId);
 for(const bad of [{...headers,origin:'http://evil.test'},{...headers,origin:undefined},{...headers,'x-csrf-token':'x'.repeat(64)}])assert.throws(()=>auth({method:'POST',headers:bad}),e=>e.status===403);
 assert.throws(()=>auth({method:'GET',headers:{}}),e=>e.status===401);
 assert.throws(()=>developmentAuth([{...session,expiresAt:'2000-01-01'}],origin)({method:'GET',headers}),e=>e.status===401);
});
