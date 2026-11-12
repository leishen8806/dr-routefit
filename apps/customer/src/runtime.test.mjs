import assert from 'node:assert/strict';
import test from 'node:test';
import { activateTelegram, detectRuntime, shouldLoadTelegramScript } from './runtime.mjs';

test('ordinary browser is H5 and does not load Telegram script', () => {
  const input = { location: { search: '', hash: '' }, telegram: undefined };
  assert.equal(detectRuntime(input), 'h5');
  assert.equal(shouldLoadTelegramScript(input), false);
});

test('Telegram object selects Mini App mode and calls ready plus expand', () => {
  const calls = [];
  const telegram = { WebApp: {
    ready: () => calls.push('ready'),
    expand: () => calls.push('expand'),
    themeParams: { bg_color: '#ffffff' },
  } };
  assert.equal(detectRuntime({ location: {}, telegram }), 'telegram');
  assert.deepEqual(activateTelegram(telegram), {
    activated: true,
    themeParams: { bg_color: '#ffffff' },
  });
  assert.deepEqual(calls, ['ready', 'expand']);
});

test('Telegram launch signal loads the official script only when object is absent', () => {
  const input = { location: { search: '?tgWebAppData=synthetic', hash: '' }, telegram: undefined };
  assert.equal(detectRuntime(input), 'telegram');
  assert.equal(shouldLoadTelegramScript(input), true);
});
