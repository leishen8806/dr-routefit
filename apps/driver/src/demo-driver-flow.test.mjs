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

test('a returning demo driver can sign in, decline an offer, and open the wallet locally', () => {
  const signedIn = transitionDemoDriverFlow(createDemoDriverFlow(), { type: 'sign_in_demo' });
  const declined = transitionDemoDriverFlow(signedIn, { type: 'decline_offer' });
  const wallet = transitionDemoDriverFlow(declined, { type: 'show_wallet' });

  assert.equal(signedIn.screen, 'offer');
  assert.equal(declined.screen, 'trips');
  assert.equal(wallet.screen, 'wallet');
});

test('an approved driver can go online and offline before accepting a sample offer', () => {
  const approved = { ...createDemoDriverFlow(), screen: 'review', reviewState: 'approved' };
  const online = transitionDemoDriverFlow(approved, { type: 'show_offer' });
  const offline = transitionDemoDriverFlow(online, { type: 'go_offline' });
  const onlineAgain = transitionDemoDriverFlow(offline, { type: 'go_online' });

  assert.equal(online.online, true);
  assert.equal(offline.online, false);
  assert.equal(onlineAgain.online, true);
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

test('accepting an online sample offer opens the selected sample trip locally', () => {
  const flow = { ...createDemoDriverFlow(), screen: 'offer', online: true };
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

test('a driver can reach profile, cancel a sample withdrawal, and return to profile', () => {
  const signedIn = transitionDemoDriverFlow(createDemoDriverFlow(), { type: 'sign_in_demo' });
  const trips = transitionDemoDriverFlow(signedIn, { type: 'decline_offer' });
  const profile = transitionDemoDriverFlow(trips, { type: 'show_profile' });
  const confirmation = transitionDemoDriverFlow(profile, { type: 'start_withdrawal' });
  const cancelled = transitionDemoDriverFlow(confirmation, { type: 'cancel_withdrawal' });

  assert.equal(profile.screen, 'profile');
  assert.equal(confirmation.screen, 'withdrawal_confirm');
  assert.equal(cancelled.screen, 'profile');
  assert.equal(cancelled.withdrawalState, 'idle');
});

test('a wallet withdrawal returns to the wallet after confirmation', () => {
  const signedIn = transitionDemoDriverFlow(createDemoDriverFlow(), { type: 'sign_in_demo' });
  const wallet = transitionDemoDriverFlow(signedIn, { type: 'show_wallet' });
  const confirmation = transitionDemoDriverFlow(wallet, { type: 'start_withdrawal' });
  const submitted = transitionDemoDriverFlow(confirmation, { type: 'confirm_withdrawal' });

  assert.equal(submitted.screen, 'wallet');
  assert.equal(submitted.withdrawalState, 'submitted');
});

test('the approved local registration can go online, accept a trip, and reach withdrawal confirmation', () => {
  const details = {
    fullName: 'Sample Driver', vehicleType: 'box_truck', plateNumber: '2BB-4471', acceptedTerms: true,
    documents: { idFront: true, idBack: true, license: true, vehicle: true },
  };
  const profile = transitionDemoDriverFlow(createDemoDriverFlow(), { type: 'start_registration' });
  const vehicle = transitionDemoDriverFlow(profile, { type: 'continue_registration' });
  const documents = transitionDemoDriverFlow(vehicle, { type: 'continue_registration' });
  const ready = transitionDemoDriverFlow(documents, { type: 'set_registration_ready', registration: details });
  const review = transitionDemoDriverFlow(ready, { type: 'submit_registration' });
  const approved = transitionDemoDriverFlow(review, { type: 'approve_demo' });
  const offer = transitionDemoDriverFlow(approved, { type: 'show_offer' });
  const trips = transitionDemoDriverFlow(offer, { type: 'accept_offer' });
  const profileTab = transitionDemoDriverFlow(trips, { type: 'show_profile' });
  const withdrawal = transitionDemoDriverFlow(profileTab, { type: 'start_withdrawal' });

  assert.equal(offer.screen, 'offer');
  assert.equal(trips.screen, 'trips');
  assert.equal(profileTab.screen, 'profile');
  assert.equal(withdrawal.screen, 'withdrawal_confirm');
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
