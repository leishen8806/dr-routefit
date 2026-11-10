const EXAMPLE_ORDER_ID = 'EXAMPLE-CUSTOMER-001';

export function createDemoCustomerFlow() {
  return {
    createDraft({ pickup, recipient, destination, codAmountMinor = 0n }) {
      if (typeof codAmountMinor !== 'bigint' || codAmountMinor < 0n) {
        throw new TypeError('codAmountMinor must be a non-negative bigint');
      }

      return {
        id: EXAMPLE_ORDER_ID,
        isExample: true,
        status: 'draft',
        pickup,
        recipient,
        destination,
        quote: { status: 'pending', deliveryFeeMinor: null, insuranceFeeMinor: null },
        payment: { status: 'not_requested' },
        cod: { amountMinor: codAmountMinor, status: codAmountMinor > 0n ? 'declared' : 'not_requested' },
      };
    },
  };
}
