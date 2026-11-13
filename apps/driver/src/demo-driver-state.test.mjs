import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRegistrationReady,
  nextReviewState,
  withdrawalConfirmationStep,
  selectTrip,
} from './demo-driver-state.mjs';

test('registration needs identity, vehicle, documents, and agreement', () => {
  const complete = {
    fullName: 'Sample Driver',
    vehicleType: 'box_truck',
    plateNumber: '2BB-4471',
    documents: { idFront: true, idBack: true, license: true, vehicle: true },
    acceptedTerms: true,
  };

  assert.equal(isRegistrationReady(complete), true);
  assert.equal(isRegistrationReady({ ...complete, acceptedTerms: false }), false);
  assert.equal(isRegistrationReady({ ...complete, documents: { ...complete.documents, license: false } }), false);
});

test('review flow preserves a returned-document state before approval', () => {
  assert.equal(nextReviewState('submitted', 'return'), 'needs_revision');
  assert.equal(nextReviewState('needs_revision', 'resubmit'), 'submitted');
  assert.equal(nextReviewState('submitted', 'approve'), 'approved');
});

test('withdrawal requires a separate confirmation action', () => {
  assert.equal(withdrawalConfirmationStep(false), 'confirm');
  assert.equal(withdrawalConfirmationStep(true), 'submit');
});

test('trip selection returns the selected mock trip without changing its amount', () => {
  const trips = [{ id: 'trip-1', demoPayoutMinor: 65000n }];
  assert.deepEqual(selectTrip(trips, 'trip-1'), trips[0]);
  assert.equal(selectTrip(trips, 'missing'), null);
});
