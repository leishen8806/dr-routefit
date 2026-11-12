import assert from 'node:assert/strict';
import test from 'node:test';

import { adminNavigation, ownedAdminRoutes } from './navigation.mjs';

test('exposes the twelve agreed admin navigation destinations', () => {
  assert.deepEqual(
    adminNavigation.map(({ id }) => id),
    [
      'dashboard',
      'orders',
      'dispatch',
      'capacity',
      'customers',
      'merchants',
      'finance',
      'pricing',
      'marketing',
      'integrations',
      'areas',
      'settings',
    ],
  );
});

test('keeps ReactSenior routes separate from page-owner routes', () => {
  assert.deepEqual(ownedAdminRoutes, ['/', '/dispatch', '/auto-routing', '/delivery-areas']);
});
