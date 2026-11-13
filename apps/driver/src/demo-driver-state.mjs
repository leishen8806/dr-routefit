const REQUIRED_DOCUMENTS = ['idFront', 'idBack', 'license', 'vehicle'];

export function isRegistrationReady(registration) {
  return Boolean(
    registration.fullName?.trim()
    && registration.vehicleType
    && registration.plateNumber?.trim()
    && registration.acceptedTerms
    && REQUIRED_DOCUMENTS.every((document) => registration.documents?.[document]),
  );
}

export function nextReviewState(currentState, action) {
  const transitions = {
    submitted: { return: 'needs_revision', approve: 'approved' },
    needs_revision: { resubmit: 'submitted' },
  };
  return transitions[currentState]?.[action] ?? currentState;
}

export function withdrawalConfirmationStep(isArmed) {
  return isArmed ? 'submit' : 'confirm';
}

export function selectTrip(trips, tripId) {
  return trips.find((trip) => trip.id === tripId) ?? null;
}
