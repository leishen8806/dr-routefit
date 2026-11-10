import assert from 'node:assert/strict';
import test from 'node:test';
import { createCustomerExperience } from './customerExperience.mjs';

test('provides an example-only customer journey without a real payment action', () => {
  const experience = createCustomerExperience();
  const overview = experience.getOverview();

  assert.equal(overview.isExample, true);
  assert.equal(overview.homePopup.kind, 'example');
  assert.equal(overview.startupAd.kind, 'example');
  assert.equal(overview.sendModes.single, true);
  assert.equal(overview.sendModes.bulk, true);
  assert.equal(overview.order.cod.amountMinor, 125000n);
  assert.equal(overview.order.payment.status, 'confirmation_required');
  assert.equal(overview.order.payment.action, 'frontend_only');
  assert.equal(overview.order.quote.deliveryFeeMinor, 85000n);
  assert.equal(overview.order.quote.insuranceFeeMinor, 0n);
  assert.equal(overview.messages.length > 0, true);
});

test('keeps recipient tracking limited to synthetic order information', () => {
  const experience = createCustomerExperience();
  const tracking = experience.findRecipientTracking('EXAMPLE-CUSTOMER-001');

  assert.equal(tracking.isExample, true);
  assert.equal(tracking.orderId, 'EXAMPLE-CUSTOMER-001');
  assert.equal(tracking.stops.length, 3);
  assert.equal(tracking.recipient.phoneMasked, '*** *** 321');
  assert.equal(experience.findRecipientTracking('unknown'), null);
});

test('provides example-only order detail, message, and profile views', () => {
  const experience = createCustomerExperience();

  const detail = experience.findOrderDetail('EXAMPLE-CUSTOMER-001');
  assert.equal(detail.isExample, true);
  assert.equal(detail.id, 'EXAMPLE-CUSTOMER-001');
  assert.equal(detail.recipient.phoneMasked, '*** *** 321');
  assert.equal(detail.payment.action, 'frontend_only');
  assert.equal(experience.findOrderDetail('unknown'), null);

  const messages = experience.listMessages();
  assert.deepEqual(messages.map((entry) => entry.id), ['example-message-1']);
  assert.equal(messages[0].isExample, true);

  const profile = experience.getProfileSummary();
  assert.equal(profile.isExample, true);
  assert.equal(profile.customer.phoneMasked, '*** *** 321');
  assert.equal(profile.settings.languageSelection, 'frontend_only');
});

test('labels the payment confirmation as an example-only frontend action', () => {
  const intent = createCustomerExperience().getExamplePaymentConfirmation();

  assert.equal(intent.isExample, true);
  assert.equal(intent.requiresConfirmation, true);
  assert.equal(intent.action, 'frontend_only');
});
