import assert from 'node:assert/strict';
import test from 'node:test';

const safety = await import('./renderSafety.mjs').catch(() => ({}));

test('allows only site-relative paths and HTTPS URLs on the configured host allowlist', () => {
  assert.equal(safety.safeNavigationTarget('/track?order=demo'), '/track?order=demo');
  assert.equal(
    safety.safeNavigationTarget('https://partner.routefit.example/campaign', ['partner.routefit.example']),
    'https://partner.routefit.example/campaign',
  );
  assert.equal(safety.safeNavigationTarget('https://untrusted.example/campaign', ['partner.routefit.example']), null);
});

test('rejects executable, non-HTTPS, and protocol-relative promotion targets', () => {
  for (const target of ['javascript:alert(1)', 'data:text/html,unsafe', 'http://partner.routefit.example', '//partner.routefit.example']) {
    assert.equal(safety.safeNavigationTarget(target, ['partner.routefit.example']), null, target);
  }
});

test('uses a fixed indexed test id rather than an order identifier', () => {
  assert.equal(safety.indexedTestId('order-row', 2), 'order-row-2');
  assert.equal(safety.indexedTestId('order-row', -1), null);
});
