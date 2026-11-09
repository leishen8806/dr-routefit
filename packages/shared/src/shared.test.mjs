import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiError,
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
