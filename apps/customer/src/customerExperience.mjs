const ORDER_ID = 'EXAMPLE-CUSTOMER-001';

const order = Object.freeze({
  id: ORDER_ID,
  isExample: true,
  status: 'driver_assigned',
  pickup: 'Example pickup area',
  destination: 'Example destination area',
  recipient: { name: 'Example recipient', phoneMasked: '*** *** 321' },
  quote: {
    status: 'confirmed',
    deliveryFeeMinor: 85000n,
    insuranceFeeMinor: 0n,
  },
  payment: {
    status: 'confirmation_required',
    action: 'frontend_only',
  },
  cod: {
    amountMinor: 125000n,
    status: 'declared',
  },
  stops: Object.freeze([
    { state: 'created', active: false },
    { state: 'driver_assigned', active: true },
    { state: 'delivered', active: false },
  ]),
});

export function createCustomerExperience() {
  return Object.freeze({
    getOverview() {
      return {
        isExample: true,
        sendModes: { single: true, bulk: true },
        startupAd: { kind: 'example' },
        homePopup: { kind: 'example' },
        order,
        messages: Object.freeze([{ id: 'example-message-1', kind: 'example', state: 'driver_assigned' }]),
      };
    },
    findRecipientTracking(orderId) {
      if (orderId !== ORDER_ID) return null;
      return {
        isExample: true,
        orderId: order.id,
        recipient: order.recipient,
        stops: order.stops,
      };
    },
  });
}
