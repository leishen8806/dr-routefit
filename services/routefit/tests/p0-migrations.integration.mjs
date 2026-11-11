import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localFixture} from '../db/local-fixture.mjs';

if (!process.env.ROUTEFIT_TEST_DATABASE_URL) throw Error('ROUTEFIT_TEST_DATABASE_URL must point to a local disposable PostgreSQL cluster administrator');

test('P0 database controls reject payout and appeal separation bypasses', async t => {
 const fixture = await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 try {
  const [{companyId, principalId: preparerPrincipal}] = fixture.principals;
  const driver = fixture.driver;
  const preparer = (await fixture.owner.query('SELECT id, person_id FROM org.principal WHERE company_id=$1 AND id=$2', [companyId, preparerPrincipal])).rows[0];
  const approver = {id: randomUUID(), person_id: randomUUID()};
  await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Approver',$3,'ACTIVE',$4)", [approver.id, companyId, 'local:'+approver.id, approver.person_id]);
  const driverPerson = (await fixture.owner.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2', [companyId, driver.principalId])).rows[0].person_id;

  await t.test('payout cannot begin paid or use one person for approval and confirmation', async () => {
   const id = randomUUID();
   const values = [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'p'.repeat(16)];
   await assert.rejects(
    fixture.owner.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,approved_by_principal_id,approved_by_person_id,confirmed_by_principal_id,confirmed_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','paid',$4,$5,$4,$5,$4,$5,$6,1,'{}')", values),
    error => error.code === '23514'
   );
   await fixture.owner.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", values);
   await assert.rejects(
    fixture.owner.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, preparerPrincipal, preparer.person_id]),
    error => error.code === '23514'
   );
   await fixture.owner.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id]);
   await assert.rejects(
    fixture.owner.query("UPDATE finance.payout_approval SET state='paid',version=3,confirmed_by_principal_id=$3,confirmed_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id]),
    error => error.code === '23514'
   );
  });

  await t.test('payout rejects a person that does not belong to the approving principal', async () => {
   const id = randomUUID();
   const secondPrincipalId = randomUUID();
   await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Second Principal',$3,'ACTIVE',$4)", [secondPrincipalId, companyId, 'local:'+secondPrincipalId, preparer.person_id]);
   await fixture.owner.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'q'.repeat(16)]);
   await assert.rejects(
    fixture.owner.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, secondPrincipalId, driverPerson]),
    error => error.code === '23514'
   );
  });

  await t.test('payout rejects a person that does not belong to the confirming principal', async () => {
   const id = randomUUID();
   await fixture.owner.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'c'.repeat(16)]);
   await fixture.owner.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id]);
   await assert.rejects(
    fixture.owner.query("UPDATE finance.payout_approval SET state='paid',version=3,confirmed_by_principal_id=$3,confirmed_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, preparerPrincipal, driverPerson]),
    error => error.code === '23514'
   );
   const event = (await fixture.owner.query("SELECT principal_id,person_id FROM finance.payout_approval_event WHERE company_id=$1 AND payout_approval_id=$2 AND action='APPROVED'", [companyId, id])).rows[0];
   assert.deepEqual(event, {principal_id: approver.id, person_id: approver.person_id});
  });

  await t.test('appeal submitter and penalty author cannot decide an appeal', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID(), penaltyId = randomUUID(), appealId = randomUUID();
   await fixture.owner.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,approved_by_principal_id,snapshot) VALUES($1,$2,$3,1,'approved',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, approver.id]);
   await fixture.owner.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]);
   await fixture.owner.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, approver.person_id]);
   await fixture.owner.query("INSERT INTO kpi.appeal(id,company_id,assessment_id,reward_penalty_id,state,version,submitted_by_person_id,reward_penalty_author_person_id,reason) VALUES($1,$2,$3,$4,'submitted',1,$5,$6,'appeal')", [appealId, companyId, assessmentId, penaltyId, driverPerson, approver.person_id]);
   const decide = personId => fixture.owner.query("UPDATE kpi.appeal SET state='accepted',version=2,decision_person_id=$3,decision_reason='decision',decided_at=clock_timestamp() WHERE company_id=$1 AND id=$2", [companyId, appealId, personId]);
   await assert.rejects(decide(driverPerson), error => error.code === '42501');
   await assert.rejects(decide(approver.person_id), error => ['23514', '42501'].includes(error.code));
   await assert.rejects(decide(randomUUID()), error => error.code === '23514');
   const foreignPerson = (await fixture.owner.query('SELECT person_id FROM org.principal WHERE company_id=$1 LIMIT 1', [fixture.principals[1].companyId])).rows[0].person_id;
   await assert.rejects(decide(foreignPerson), error => error.code === '23514');
  });

 } finally {
  await fixture.cleanup();
 }
});
