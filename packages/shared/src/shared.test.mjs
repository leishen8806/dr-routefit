import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiError,
  designTokens,
  languageLabels,
  localizedHeaders,
  message,
  serverErrorCode,
  serverErrorMessage,
} from './index.ts';

test('adds a language without mutating authentication headers', () => {
  const auth = { Cookie: 'synthetic-session' };
  assert.deepEqual(localizedHeaders(auth, 'km'), {
    Cookie: 'synthetic-session',
    'Accept-Language': 'km',
  });
  assert.deepEqual(auth, { Cookie: 'synthetic-session' });
});

test('normalizes API errors without losing server details', () => {
  const payload = { error: { code: 'SYNTHETIC_ERROR', message: 'synthetic message' } };
  assert.equal(serverErrorCode(payload), 'SYNTHETIC_ERROR');
  assert.equal(serverErrorMessage(payload), 'synthetic message');
  assert.equal(new ApiError(412, 'TASK_CHANGED', null).status, 412);
});

test('shares the trilingual catalog shape while preserving app language codes', () => {
  const catalog = {
    km: { title: 'ខ្មែរ' },
    en: { title: 'English' },
    zh: { title: '中文' },
  };
  assert.equal(message(catalog, 'en', 'title'), 'English');
  assert.equal(languageLabels['zh-Hans'], languageLabels.zh);
});

test('shares product-neutral design tokens without native dependencies', () => {
  assert.equal(designTokens.color.navy, '#0B2545');
  assert.equal(designTokens.type.khmer, 'Noto Sans Khmer');
  assert.equal(designTokens.space.x6, 24);
  assert.deepEqual(designTokens.type.size, {
    caption: 12,
    small: 14,
    body: 16,
    lead: 20,
    title: 32,
    display: 48,
  });
  assert.deepEqual(designTokens.radius, { small: 6, medium: 10, large: 16 });
  assert.equal(designTokens.platform.web.fontFamily, 'IBM Plex Sans, Noto Sans SC, Noto Sans Khmer, sans-serif');
  assert.deepEqual(designTokens.platform.native.fontFamily, [
    'IBM Plex Sans',
    'Noto Sans SC',
    'Noto Sans Khmer',
  ]);
});
