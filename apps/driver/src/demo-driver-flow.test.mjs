import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoDriverFlow, transitionDemoDriverFlow } from './demo-driver-flow.mjs';

test('login starts the local registration journey without an API call', () => {
  const flow = createDemoDriverFlow();
  const next = transitionDemoDriverFlow(flow, { type: 'start_registration' });

  assert.equal(flow.screen, 'login');
  assert.equal(next.screen, 'registration_profile');
  assert.equal(next.reviewState, 'draft');
});

test('registration can only submit after the local documents are complete', () => {
  const flow = {
    ...createDemoDriverFlow(),
    screen: 'registration_documents',
    registrationReady: false,
  };

  assert.equal(transitionDemoDriverFlow(flow, { type: 'submit_registration' }).screen, 'registration_documents');

  const ready = transitionDemoDriverFlow(flow, { type: 'set_registration_ready' });
  const submitted = transitionDemoDriverFlow(ready, { type: 'submit_registration' });
  assert.equal(submitted.screen, 'review');
  assert.equal(submitted.reviewState, 'submitted');
});

test('accepting a sample offer opens the selected sample trip locally', () => {
  const flow = { ...createDemoDriverFlow(), screen: 'offer' };
  const accepted = transitionDemoDriverFlow(flow, { type: 'accept_offer' });
  const detailed = transitionDemoDriverFlow(accepted, { type: 'open_trip', tripId: 'sample-trip-1' });

  assert.equal(accepted.screen, 'trips');
  assert.equal(detailed.screen, 'trip_detail');
  assert.equal(detailed.selectedTripId, 'sample-trip-1');
});

test('sample withdrawal uses a separate confirmation before it is submitted', () => {
  const flow = { ...createDemoDriverFlow(), screen: 'profile' };
  const confirm = transitionDemoDriverFlow(flow, { type: 'start_withdrawal' });
  const submitted = transitionDemoDriverFlow(confirm, { type: 'confirm_withdrawal' });

  assert.equal(confirm.screen, 'withdrawal_confirm');
  assert.equal(submitted.screen, 'profile');
  assert.equal(submitted.withdrawalState, 'submitted');
});
