import { isRegistrationReady, nextReviewState, selectTrip } from './demo-driver-state.mjs';

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
      return { ...flow, registrationReady: isRegistrationReady(event.registration ?? {}) };
    case 'continue_registration':
      if (flow.screen === 'registration_profile') return { ...flow, screen: 'registration_vehicle' };
      if (flow.screen === 'registration_vehicle') return { ...flow, screen: 'registration_documents' };
      return flow;
    case 'submit_registration':
      return flow.screen === 'registration_documents' && flow.registrationReady
        ? { ...flow, screen: 'review', reviewState: 'submitted' }
        : flow;
    case 'approve_demo':
      return flow.screen === 'review' ? { ...flow, reviewState: 'approved' } : flow;
    case 'return_review':
      return flow.screen === 'review'
        ? { ...flow, reviewState: nextReviewState(flow.reviewState, 'return') }
        : flow;
    case 'resubmit_registration':
      return flow.screen === 'review'
        ? { ...flow, reviewState: nextReviewState(flow.reviewState, 'resubmit') }
        : flow;
    case 'show_offer':
      return flow.screen === 'review' && flow.reviewState === 'approved'
        ? { ...flow, screen: 'offer' }
        : flow;
    case 'accept_offer':
      return flow.screen === 'offer' ? { ...flow, screen: 'trips' } : flow;
    case 'open_trip': {
      const trip = selectTrip(event.trips ?? [], event.tripId);
      return flow.screen === 'trips' && trip
        ? { ...flow, screen: 'trip_detail', selectedTripId: trip.id }
        : flow;
    }
    case 'show_trips':
      return { ...flow, screen: 'trips' };
    case 'show_profile':
      return { ...flow, screen: 'profile' };
    case 'start_withdrawal':
      return flow.screen === 'profile'
        ? { ...flow, screen: 'withdrawal_confirm', withdrawalState: 'confirming' }
        : flow;
    case 'confirm_withdrawal':
      return flow.screen === 'withdrawal_confirm'
        ? { ...flow, screen: 'profile', withdrawalState: 'submitted' }
        : flow;
    case 'cancel_withdrawal':
      return flow.screen === 'withdrawal_confirm'
        ? { ...flow, screen: 'profile', withdrawalState: 'idle' }
        : flow;
    default:
      return flow;
  }
}
