import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localFixture} from '../db/local-fixture.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL must point to a local disposable PostgreSQL cluster administrator');

test('Backend1 history is append-only and freeze versions are unique in PostgreSQL',async()=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 try{
  const companyId=fixture.principals[0].companyId;
  const principalId=fixture.principals[0].principalId;
  const merchantId=fixture.customers[0];
  const contractId=randomUUID();
  const eventId=randomUUID();
  const freezeId=randomUUID();
  await fixture.owner.query(`INSERT INTO party.merchant_contract
   (id,company_id,merchant_id,pricing_plan,cod_settlement_cycle,cod_fee_bps,monthly_credit_limit_minor,payout_account_ref,state,version)
   VALUES($1,$2,$3,'DEMO','WEEKLY',0,0,'DEMO','DRAFT',1)`,[contractId,companyId,merchantId]);
  await fixture.owner.query(`INSERT INTO party.merchant_contract_event(id,company_id,contract_id,version,state)
   VALUES($1,$2,$3,1,'DRAFT')`,[eventId,companyId,contractId]);
  await assert.rejects(
   fixture.owner.query('UPDATE party.merchant_contract_event SET state=\'ACTIVE\' WHERE company_id=$1 AND id=$2',[companyId,eventId]),
   error=>error.code==='P0001'
  );
  await fixture.owner.query(`INSERT INTO party.account_freeze(id,company_id,principal_id,action,reason,version)
   VALUES($1,$2,$3,'FREEZE','DEMO',1)`,[freezeId,companyId,principalId]);
  await assert.rejects(
   fixture.owner.query(`INSERT INTO party.account_freeze(id,company_id,principal_id,action,reason,version)
    VALUES($1,$2,$3,'UNFREEZE','DEMO',1)`,[randomUUID(),companyId,principalId]),
   error=>error.code==='23505'
  );
  await assert.rejects(
   fixture.owner.query('DELETE FROM party.account_freeze WHERE company_id=$1 AND id=$2',[companyId,freezeId]),
   error=>error.code==='P0001'
  );
 }finally{await fixture.cleanup();}
});
