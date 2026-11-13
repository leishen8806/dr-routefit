import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';

if (!process.env.ROUTEFIT_TEST_DATABASE_URL) throw Error('ROUTEFIT_TEST_DATABASE_URL must point to a local disposable PostgreSQL cluster administrator');

test('P0 database controls reject payout and appeal separation bypasses', async t => {
 const fixture = await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 let runtime;
 try {
  const [{companyId, principalId: preparerPrincipal}] = fixture.principals;
  const driver = fixture.driver;
  const preparer = (await fixture.owner.query('SELECT id, person_id FROM org.principal WHERE company_id=$1 AND id=$2', [companyId, preparerPrincipal])).rows[0];
  const approver = {id: randomUUID(), person_id: randomUUID()};
  await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Approver',$3,'ACTIVE',$4)", [approver.id, companyId, 'local:'+approver.id, approver.person_id]);
  const decider = {id: randomUUID(), person_id: randomUUID()};
  await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Decider',$3,'ACTIVE',$4)", [decider.id, companyId, 'local:'+decider.id, decider.person_id]);
  const driverPerson = (await fixture.owner.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2', [companyId, driver.principalId])).rows[0].person_id;
  runtime = new pg.Pool({connectionString: fixture.runtimeUrl, max: 1});
  async function asCompanyPrincipal(activeCompanyId, principalId, work) {
   const client = await runtime.connect();
   try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.company_id',$1,true)", [activeCompanyId]);
    await client.query("SELECT set_config('app.principal_id',$1,true)", [principalId]);
    await work(client);
    await client.query('COMMIT');
   } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
   } finally {
    client.release();
   }
  }
  const asPrincipal = (principalId, work) => asCompanyPrincipal(companyId, principalId, work);
  async function createDefinition(definitionVersionId, definitionId) {
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await asPrincipal(approver.id, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, approver.person_id]));
  }

  await t.test('payout cannot begin paid or use one person for approval and confirmation', async () => {
   const id = randomUUID();
   const values = [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'p'.repeat(16)];
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,approved_by_principal_id,approved_by_person_id,confirmed_by_principal_id,confirmed_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','paid',$4,$5,$4,$5,$4,$5,$6,1,'{}')", values)),
    error => error.code === '23514'
   );
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", values));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, preparerPrincipal, preparer.person_id])),
    error => error.code === '23514'
   );
   await asPrincipal(approver.id, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id]));
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("UPDATE finance.payout_approval SET state='paid',version=3,confirmed_by_principal_id=$3,confirmed_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('payout rejects a person that does not belong to the approving principal', async () => {
   const id = randomUUID();
   const secondPrincipalId = randomUUID();
   await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Second Principal',$3,'ACTIVE',$4)", [secondPrincipalId, companyId, 'local:'+secondPrincipalId, preparer.person_id]);
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'q'.repeat(16)]));
   await assert.rejects(
    asPrincipal(secondPrincipalId, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, secondPrincipalId, driverPerson])),
    error => error.code === '23514'
   );
  });

  await t.test('payout rejects a person that does not belong to the preparer principal', async () => {
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [randomUUID(), companyId, randomUUID(), preparerPrincipal, driverPerson, 'z'.repeat(16)])),
    error => error.code === '23514'
   );
  });

  await t.test('payout rejects a person that does not belong to the confirming principal', async () => {
   const id = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'c'.repeat(16)]));
   await asPrincipal(approver.id, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id]));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("UPDATE finance.payout_approval SET state='paid',version=3,confirmed_by_principal_id=$3,confirmed_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, preparerPrincipal, driverPerson])),
    error => error.code === '23514'
   );
   const event = (await fixture.owner.query("SELECT principal_id,person_id FROM finance.payout_approval_event WHERE company_id=$1 AND payout_approval_id=$2 AND action='APPROVED'", [companyId, id])).rows[0];
   assert.deepEqual(event, {principal_id: approver.id, person_id: approver.person_id});
  });

  await t.test('appeal submitter and penalty author cannot decide an appeal', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID(), penaltyId = randomUUID(), appealId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, approver.person_id]));
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.appeal(id,company_id,assessment_id,reward_penalty_id,state,version,submitted_by_person_id,reward_penalty_author_person_id,reason) VALUES($1,$2,$3,$4,'submitted',1,$5,$6,'appeal')", [appealId, companyId, assessmentId, penaltyId, driverPerson, approver.person_id]));
   const decide = (principalId, personId) => asPrincipal(principalId, client => client.query("UPDATE kpi.appeal SET state='accepted',version=2,decision_person_id=$3,decision_reason='decision',decided_at=clock_timestamp() WHERE company_id=$1 AND id=$2", [companyId, appealId, personId]));
   await assert.rejects(decide(driver.principalId, driverPerson), error => error.code === '42501');
   await assert.rejects(decide(approver.id, approver.person_id), error => ['23514', '42501'].includes(error.code));
   await assert.rejects(decide(preparerPrincipal, decider.person_id), error => error.code === '42501');
   await assert.rejects(decide(randomUUID(), randomUUID()), error => error.code === '23514');
   const foreignPerson = (await fixture.owner.query('SELECT person_id FROM org.principal WHERE company_id=$1 LIMIT 1', [fixture.principals[1].companyId])).rows[0].person_id;
   await assert.rejects(decide(randomUUID(), foreignPerson), error => error.code === '23514');
   await decide(decider.id, decider.person_id);
   assert.equal((await fixture.owner.query('SELECT state FROM kpi.appeal WHERE company_id=$1 AND id=$2', [companyId, appealId])).rows[0].state, 'accepted');
  });

  await t.test('appeal rejects an invalid submission and immutable history changes', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), otherDefinitionId = randomUUID(), otherDefinitionVersionId = randomUUID(), assessmentId = randomUUID(), otherAssessmentId = randomUUID(), penaltyId = randomUUID(), otherPenaltyId = randomUUID(), appealId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await createDefinition(otherDefinitionVersionId, otherDefinitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}'),($6,$2,$7,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson, otherAssessmentId, otherDefinitionVersionId]));
   await asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, approver.person_id]));
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [otherPenaltyId, companyId, assessmentId, preparerPrincipal, preparer.person_id]));
   const submit = (id, assessment, person, author, state = 'submitted') => asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.appeal(id,company_id,assessment_id,reward_penalty_id,state,version,submitted_by_person_id,reward_penalty_author_person_id,reason) VALUES($1,$2,$3,$4,$5,1,$6,$7,'appeal')", [id, companyId, assessment, penaltyId, state, person, author]));
   await assert.rejects(submit(randomUUID(), assessmentId, decider.person_id, approver.person_id), error => error.code === '42501');
   await assert.rejects(submit(randomUUID(), otherAssessmentId, driverPerson, approver.person_id), error => error.code === '23514');
   await assert.rejects(submit(randomUUID(), assessmentId, driverPerson, decider.person_id), error => error.code === '23514');
   await assert.rejects(submit(randomUUID(), assessmentId, driverPerson, approver.person_id, 'accepted'), error => error.code === '23514');
   await submit(appealId, assessmentId, driverPerson, approver.person_id);
   const rewriteDuringDecision = (column, value) => asPrincipal(decider.id, client => client.query(`UPDATE kpi.appeal SET state='accepted',version=2,decision_person_id=$3,decision_reason='decision',decided_at=clock_timestamp(),${column}=$4 WHERE company_id=$1 AND id=$2`, [companyId, appealId, decider.person_id, value]));
   await assert.rejects(rewriteDuringDecision('id', randomUUID()), error => error.code === '23514');
   await assert.rejects(rewriteDuringDecision('assessment_id', otherAssessmentId), error => error.code === '23514');
   await assert.rejects(rewriteDuringDecision('reward_penalty_id', otherPenaltyId), error => error.code === '23514');
   await assert.rejects(rewriteDuringDecision('submitted_by_person_id', decider.person_id), error => error.code === '23514');
   await assert.rejects(rewriteDuringDecision('reward_penalty_author_person_id', decider.person_id), error => error.code === '23514');
   await assert.rejects(asPrincipal(driver.principalId, client => client.query("UPDATE kpi.appeal SET reason='rewritten',version=2 WHERE company_id=$1 AND id=$2", [companyId, appealId])), error => error.code === '23514');
   await assert.rejects(asPrincipal(driver.principalId, client => client.query("UPDATE kpi.appeal SET state='submitted',version=2 WHERE company_id=$1 AND id=$2", [companyId, appealId])), error => error.code === '23514');
   await assert.rejects(asPrincipal(decider.id, client => client.query("UPDATE kpi.appeal SET state='accepted',decision_person_id=$3,decision_reason='decision',decided_at=clock_timestamp() WHERE company_id=$1 AND id=$2", [companyId, appealId, decider.person_id])), error => error.code === '23514');
   await assert.rejects(asPrincipal(driver.principalId, client => client.query('DELETE FROM kpi.appeal WHERE company_id=$1 AND id=$2', [companyId, appealId])), error => error.code === '42501');
   await asPrincipal(decider.id, client => client.query("UPDATE kpi.appeal SET state='accepted',version=2,decision_person_id=$3,decision_reason='decision',decided_at=clock_timestamp() WHERE company_id=$1 AND id=$2", [companyId, appealId, decider.person_id]));
   await assert.rejects(asPrincipal(decider.id, client => client.query("UPDATE kpi.appeal SET state='rejected',version=3 WHERE company_id=$1 AND id=$2", [companyId, appealId])), error => error.code === '23514');
  });

  await t.test('appeal permits only one submission per penalty with a non-empty bounded reason', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID(), penaltyId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, approver.person_id]));
   const submit = (id, reason) => asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.appeal(id,company_id,assessment_id,reward_penalty_id,state,version,submitted_by_person_id,reward_penalty_author_person_id,reason) VALUES($1,$2,$3,$4,'submitted',1,$5,$6,$7)", [id, companyId, assessmentId, penaltyId, driverPerson, approver.person_id, reason]));
   await assert.rejects(submit(randomUUID(), ''), error => error.code === '23514');
   await assert.rejects(submit(randomUUID(), 'x'.repeat(2001)), error => error.code === '23514');
   await submit(randomUUID(), 'appeal');
   await assert.rejects(submit(randomUUID(), 'another appeal'), error => error.code === '23505');
  });

  await t.test('KPI tables deny cross-company reads and appeal writes', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID(), penaltyId = randomUUID(), appealId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, approver.person_id]));
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.appeal(id,company_id,assessment_id,reward_penalty_id,state,version,submitted_by_person_id,reward_penalty_author_person_id,reason) VALUES($1,$2,$3,$4,'submitted',1,$5,$6,'appeal')", [appealId, companyId, assessmentId, penaltyId, driverPerson, approver.person_id]));
   const otherCompany = fixture.principals[1];
   await asCompanyPrincipal(otherCompany.companyId, otherCompany.principalId, async client => {
    for (const table of ['definition_version', 'assessment', 'reward_penalty', 'appeal']) {
     assert.equal((await client.query(`SELECT count(*)::int AS count FROM kpi.${table} WHERE company_id=$1`, [companyId])).rows[0].count, 0);
    }
   });
   await assert.rejects(
    asCompanyPrincipal(otherCompany.companyId, otherCompany.principalId, client => client.query("INSERT INTO kpi.appeal(id,company_id,assessment_id,reward_penalty_id,state,version,submitted_by_person_id,reward_penalty_author_person_id,reason) VALUES($1,$2,$3,$4,'submitted',1,$5,$6,'appeal')", [randomUUID(), companyId, assessmentId, penaltyId, driverPerson, approver.person_id])),
    error => error.code === '42501'
   );
  });

  await t.test('assessment accepts a manager session assigning another subject', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
  });

  await t.test('definition version rejects a prepared principal that differs from the session', async () => {
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [randomUUID(), companyId, randomUUID(), preparerPrincipal, preparer.person_id])),
    error => error.code === '42501'
   );
  });

  await t.test('definition version rejects a preparer person that differs from its principal', async () => {
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [randomUUID(), companyId, randomUUID(), preparerPrincipal, approver.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('definition version rejects an unrelated preparer person with a matching session', async () => {
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [randomUUID(), companyId, randomUUID(), preparerPrincipal, driverPerson])),
    error => error.code === '23514'
   );
  });

  await t.test('definition version requires the approver session for the approval transition', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, approver.person_id])),
    error => error.code === '42501'
   );
   await asPrincipal(approver.id, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, approver.person_id]));
  });

  await t.test('definition version rejects an approver person that differs from its principal', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, driverPerson])),
    error => error.code === '23514'
   );
  });

  await t.test('definition version rejects changing the preparer person during approval', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4,prepared_by_person_id=$5 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, approver.person_id, approver.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('definition version rejects rewriting the preparer person to an unrelated value during approval', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4,prepared_by_person_id=$5 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, approver.person_id, randomUUID()])),
    error => error.code === '23514'
   );
  });

  await t.test('definition version rejects one principal approving its own draft', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, preparerPrincipal, preparer.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('definition version rejects a second principal for the preparer person', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), alternatePrincipalId = randomUUID();
   await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Preparer Alternate',$3,'ACTIVE',$4)", [alternatePrincipalId, companyId, 'local:'+alternatePrincipalId, preparer.person_id]);
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await assert.rejects(
    asPrincipal(alternatePrincipalId, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, alternatePrincipalId, preparer.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('definition version rejects deletion and non-approval history rewrites', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   await assert.rejects(asPrincipal(preparerPrincipal, client => client.query('DELETE FROM kpi.definition_version WHERE company_id=$1 AND id=$2', [companyId, definitionVersionId])), error => error.code === '42501');
   await assert.rejects(asPrincipal(approver.id, client => client.query("UPDATE kpi.definition_version SET state='retired',approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, approver.person_id])), error => error.code === '23514');
   await assert.rejects(asPrincipal(approver.id, client => client.query("UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4,example_label='rewritten' WHERE company_id=$1 AND id=$2", [companyId, definitionVersionId, approver.id, approver.person_id])), error => error.code === '23514');
  });

  await t.test('definition version approval cannot rewrite any protected draft field', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), otherCompanyId = fixture.principals[1].companyId;
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.definition_version(id,company_id,definition_id,version,state,effective_from,prepared_by_principal_id,prepared_by_person_id,snapshot) VALUES($1,$2,$3,1,'draft',clock_timestamp(),$4,$5,'{}')", [definitionVersionId, companyId, definitionId, preparerPrincipal, preparer.person_id]));
   const rewrite = expression => asPrincipal(approver.id, client => client.query(`UPDATE kpi.definition_version SET state='approved',approved_by_principal_id=$3,approved_by_person_id=$4,${expression} WHERE company_id=$1 AND id=$2`, [companyId, definitionVersionId, approver.id, approver.person_id]));
   for (const expression of [
    `id='${randomUUID()}'`, `company_id='${otherCompanyId}'`, `definition_id='${randomUUID()}'`, 'version=2',
    "example_label='rewritten'", 'effective_from=CURRENT_DATE+1', `prepared_by_principal_id='${approver.id}'`,
    `prepared_by_person_id='${approver.person_id}'`, "snapshot='{\"rewritten\":true}'::jsonb", 'created_at=clock_timestamp()'
   ]) await assert.rejects(rewrite(expression), error => error.code === '23514');
  });

  await t.test('assessment rejects a subject person that is not bound to its subject principal', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await assert.rejects(
    asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, preparer.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('assessment cannot rewrite its subject person away from the subject principal', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await assert.rejects(
    fixture.owner.query('UPDATE kpi.assessment SET subject_person_id=$3 WHERE company_id=$1 AND id=$2', [companyId, assessmentId, preparer.person_id]),
    error => error.code === '23514'
   );
  });

  await t.test('assessment rejects reversed periods and duplicate subject periods', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await assert.rejects(
    asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE-1,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson])),
    error => error.code === '23514'
   );
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await assert.rejects(
    asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [randomUUID(), companyId, definitionVersionId, driver.principalId, driverPerson])),
    error => error.code === '23505'
   );
  });

  await t.test('reward penalty rejects an author person that is not bound to its author principal', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID(), penaltyId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, preparer.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('reward penalty rejects invalid money values and history rewrites', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID(), penaltyId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',0,'USD',$4,$5,'{}')", [randomUUID(), companyId, assessmentId, approver.id, approver.person_id])),
    error => error.code === '23514'
   );
   await assert.rejects(
    asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'EUR',$4,$5,'{}')", [randomUUID(), companyId, assessmentId, approver.id, approver.person_id])),
    error => error.code === '23514'
   );
   await asPrincipal(approver.id, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, approver.person_id]));
   await fixture.owner.query(`GRANT UPDATE ON kpi.reward_penalty TO "${fixture.role}"`);
   if(process.env.ROUTEFIT_P0_DROP_REWARD_PENALTY_APPEND_ONLY_TRIGGER==='1'){
    await fixture.owner.query('DROP TRIGGER kpi_reward_penalty_append_only ON kpi.reward_penalty');
   }
   await assert.rejects(
    asPrincipal(approver.id, client => client.query('UPDATE kpi.reward_penalty SET money_amount_minor=2 WHERE company_id=$1 AND id=$2', [companyId, penaltyId])),
    error => error.code === '42501'
   );
  });

  await t.test('payout rejects an approver principal that differs from the session principal', async () => {
   const id = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 's'.repeat(16)]));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id])),
    error => error.code === '42501'
   );
   await assert.rejects(
    asPrincipal('not-a-uuid', client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id])),
    error => error.code === '42501'
   );
  });

  await t.test('payout approval history cannot change its amount after submission', async () => {
   const id = randomUUID();
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'h'.repeat(16)]));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("UPDATE finance.payout_approval SET money_amount_minor=2,version=2 WHERE company_id=$1 AND id=$2", [companyId, id])),
    error => error.code === '42501'
   );
  });

  await t.test('payout rejects approval by a second principal for the preparer person', async () => {
   const id = randomUUID(), alternatePrincipalId = randomUUID();
   await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Preparer Alternate',$3,'ACTIVE',$4)", [alternatePrincipalId, companyId, 'local:'+alternatePrincipalId, preparer.person_id]);
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'a'.repeat(16)]));
   await assert.rejects(
    asPrincipal(alternatePrincipalId, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, alternatePrincipalId, preparer.person_id])),
    error => error.code === '23514'
   );
  });

  await t.test('payout accepts separate preparer approver and confirmer sessions', async () => {
   const id = randomUUID(), confirmer = {id: randomUUID(), person_id: randomUUID()};
   await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Confirmer',$3,'ACTIVE',$4)", [confirmer.id, companyId, 'local:'+confirmer.id, confirmer.person_id]);
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'l'.repeat(16)]));
   await asPrincipal(approver.id, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id]));
   await asPrincipal(confirmer.id, client => client.query("UPDATE finance.payout_approval SET state='paid',version=3,confirmed_by_principal_id=$3,confirmed_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, confirmer.id, confirmer.person_id]));
   assert.equal((await fixture.owner.query('SELECT state FROM finance.payout_approval WHERE company_id=$1 AND id=$2', [companyId, id])).rows[0].state, 'paid');
   await assert.rejects(
    asPrincipal(confirmer.id, client => client.query("INSERT INTO finance.payout_approval_event(company_id,payout_approval_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,99,'CONFIRMED_PAID',$3,$4,'{}')", [companyId, id, approver.id, randomUUID()])),
    error => error.code === '23514'
   );
  });

  await t.test('payout requires the confirmer session for payment', async () => {
   const id = randomUUID(), confirmer = {id: randomUUID(), person_id: randomUUID()};
   await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'STAFF','DEMO Session Confirmer',$3,'ACTIVE',$4)", [confirmer.id, companyId, 'local:'+confirmer.id, confirmer.person_id]);
   await asPrincipal(preparerPrincipal, client => client.query("INSERT INTO finance.payout_approval(id,company_id,source_type,source_id,money_amount_minor,money_currency,state,prepared_by_principal_id,prepared_by_person_id,idempotency_key,version,snapshot) VALUES($1,$2,'DRIVER_WITHDRAWAL',$3,1,'USD','submitted',$4,$5,$6,1,'{}')", [id, companyId, randomUUID(), preparerPrincipal, preparer.person_id, 'm'.repeat(16)]));
   await asPrincipal(approver.id, client => client.query("UPDATE finance.payout_approval SET state='approved',version=2,approved_by_principal_id=$3,approved_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, approver.id, approver.person_id]));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("UPDATE finance.payout_approval SET state='paid',version=3,confirmed_by_principal_id=$3,confirmed_by_person_id=$4 WHERE company_id=$1 AND id=$2", [companyId, id, confirmer.id, confirmer.person_id])),
    error => error.code === '42501'
   );
  });

  await t.test('reward penalty rejects an author principal that differs from the session principal', async () => {
   const definitionId = randomUUID(), definitionVersionId = randomUUID(), assessmentId = randomUUID(), penaltyId = randomUUID();
   await createDefinition(definitionVersionId, definitionId);
   await asPrincipal(driver.principalId, client => client.query("INSERT INTO kpi.assessment(id,company_id,definition_version_id,subject_principal_id,subject_person_id,period_start,period_end,version,snapshot) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE,1,'{}')", [assessmentId, companyId, definitionVersionId, driver.principalId, driverPerson]));
   await assert.rejects(
    asPrincipal(preparerPrincipal, client => client.query("INSERT INTO kpi.reward_penalty(id,company_id,assessment_id,type,money_amount_minor,money_currency,author_principal_id,author_person_id,snapshot) VALUES($1,$2,$3,'penalty',1,'USD',$4,$5,'{}')", [penaltyId, companyId, assessmentId, approver.id, approver.person_id])),
    error => error.code === '42501'
   );
  });

 } finally {
  await runtime?.end();
  await fixture.cleanup();
 }
});
