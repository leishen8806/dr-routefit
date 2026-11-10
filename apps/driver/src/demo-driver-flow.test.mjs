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

test('registration only becomes ready when supplied details are complete', () => {
  const flow = {
    ...createDemoDriverFlow(),
    screen: 'registration_documents',
    registrationReady: false,
  };

  assert.equal(transitionDemoDriverFlow(flow, { type: 'submit_registration' }).screen, 'registration_documents');

  const incomplete = transitionDemoDriverFlow(flow, {
    type: 'set_registration_ready',
    registration: {
      fullName: 'Sample Driver',
      vehicleType: 'box_truck',
      plateNumber: '2BB-4471',
      documents: { idFront: true, idBack: true, license: true, vehicle: true },
      acceptedTerms: false,
    },
  });
  assert.equal(incomplete.registrationReady, false);

  const ready = transitionDemoDriverFlow(flow, {
    type: 'set_registration_ready',
    registration: {
      fullName: 'Sample Driver',
      vehicleType: 'box_truck',
      plateNumber: '2BB-4471',
      documents: { idFront: true, idBack: true, license: true, vehicle: true },
      acceptedTerms: true,
    },
  });
  const submitted = transitionDemoDriverFlow(ready, { type: 'submit_registration' });
  assert.equal(ready.registrationReady, true);
  assert.equal(submitted.screen, 'review');
  assert.equal(submitted.reviewState, 'submitted');
});

test('registration advances through profile, vehicle, and document steps in order', () => {
  const profile = { ...createDemoDriverFlow(), screen: 'registration_profile' };
  const vehicle = transitionDemoDriverFlow(profile, { type: 'continue_registration' });
  const documents = transitionDemoDriverFlow(vehicle, { type: 'continue_registration' });

  assert.equal(vehicle.screen, 'registration_vehicle');
  assert.equal(documents.screen, 'registration_documents');
});

test('accepting a sample offer opens the selected sample trip locally', () => {
  const flow = { ...createDemoDriverFlow(), screen: 'offer' };
  const accepted = transitionDemoDriverFlow(flow, { type: 'accept_offer' });
  const detailed = transitionDemoDriverFlow(accepted, {
    type: 'open_trip',
    trips: [{ id: 'sample-trip-1' }],
    tripId: 'sample-trip-1',
  });

  assert.equal(accepted.screen, 'trips');
  assert.equal(detailed.screen, 'trip_detail');
  assert.equal(detailed.selectedTripId, 'sample-trip-1');
});

test('approved review can show an offer and return from a trip detail', () => {
  const review = { ...createDemoDriverFlow(), screen: 'review', reviewState: 'submitted' };
  const approved = transitionDemoDriverFlow(review, { type: 'approve_demo' });
  const offer = transitionDemoDriverFlow(approved, { type: 'show_offer' });
  const trips = transitionDemoDriverFlow({ ...offer, screen: 'trips' }, { type: 'show_trips' });

  assert.equal(approved.reviewState, 'approved');
  assert.equal(offer.screen, 'offer');
  assert.equal(trips.screen, 'trips');
});

test('sample withdrawal uses a separate confirmation before it is submitted', () => {
  const flow = { ...createDemoDriverFlow(), screen: 'profile' };
  const confirm = transitionDemoDriverFlow(flow, { type: 'start_withdrawal' });
  const submitted = transitionDemoDriverFlow(confirm, { type: 'confirm_withdrawal' });

  assert.equal(confirm.screen, 'withdrawal_confirm');
  assert.equal(submitted.screen, 'profile');
  assert.equal(submitted.withdrawalState, 'submitted');
});

test('review, trip selection, and withdrawal confirmation expose reversible local paths', () => {
  const review = { ...createDemoDriverFlow(), screen: 'review', reviewState: 'submitted' };
  const returned = transitionDemoDriverFlow(review, { type: 'return_review' });
  const resubmitted = transitionDemoDriverFlow(returned, { type: 'resubmit_registration' });
  const trip = transitionDemoDriverFlow(
    { ...createDemoDriverFlow(), screen: 'trips' },
    { type: 'open_trip', trips: [{ id: 'sample-trip-1' }], tripId: 'sample-trip-1' },
  );
  const cancelled = transitionDemoDriverFlow(
    { ...createDemoDriverFlow(), screen: 'withdrawal_confirm', withdrawalState: 'confirming' },
    { type: 'cancel_withdrawal' },
  );

  assert.equal(returned.reviewState, 'needs_revision');
  assert.equal(resubmitted.reviewState, 'submitted');
  assert.equal(trip.selectedTripId, 'sample-trip-1');
  assert.equal(cancelled.screen, 'profile');
  assert.equal(cancelled.withdrawalState, 'idle');
});
