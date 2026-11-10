import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoCustomerFlow } from './customerFlow.mjs';

test('creates a mock draft that keeps COD separate from delivery fees', () => {
  const flow = createDemoCustomerFlow();
  const order = flow.createDraft({
    pickup: 'Example pickup',
    recipient: 'Example recipient',
    destination: 'Example destination',
    codAmountMinor: 125000n,
  });

  assert.equal(order.status, 'draft');
  assert.equal(order.quote.status, 'pending');
  assert.equal(order.cod.amountMinor, 125000n);
  assert.equal(order.payment.status, 'not_requested');
  assert.equal(order.isExample, true);
});
