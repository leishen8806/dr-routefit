export function createDemoDriverFlow() {
  return {
    screen: 'login',
    reviewState: 'draft',
    registrationReady: false,
    selectedTripId: null,
    withdrawalState: 'idle',
  };
}

export function transitionDemoDriverFlow(flow, event) {
  switch (event.type) {
    case 'start_registration':
      return { ...flow, screen: 'registration_profile', reviewState: 'draft' };
    case 'set_registration_ready':
      return { ...flow, registrationReady: true };
    case 'submit_registration':
      return flow.screen === 'registration_documents' && flow.registrationReady
        ? { ...flow, screen: 'review', reviewState: 'submitted' }
        : flow;
    case 'accept_offer':
      return flow.screen === 'offer' ? { ...flow, screen: 'trips' } : flow;
    case 'open_trip':
      return flow.screen === 'trips'
        ? { ...flow, screen: 'trip_detail', selectedTripId: event.tripId }
        : flow;
    case 'start_withdrawal':
      return flow.screen === 'profile'
        ? { ...flow, screen: 'withdrawal_confirm', withdrawalState: 'confirming' }
        : flow;
    case 'confirm_withdrawal':
      return flow.screen === 'withdrawal_confirm'
        ? { ...flow, screen: 'profile', withdrawalState: 'submitted' }
        : flow;
    default:
      return flow;
  }
}
