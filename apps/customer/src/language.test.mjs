import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  writeStoredLanguage,
} from './language.mjs';

test('defaults to Khmer when no preference exists', () => {
  assert.equal(readStoredLanguage({ getItem: () => null }), DEFAULT_LANGUAGE);
});

test('reads and writes a supported language', () => {
  const values = new Map([[LANGUAGE_STORAGE_KEY, 'en']]);
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readStoredLanguage(storage), 'en');
  assert.equal(writeStoredLanguage(storage, 'zh'), true);
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), 'zh');
});

test('storage failures fall back to Khmer without throwing', () => {
  const broken = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(readStoredLanguage(broken), DEFAULT_LANGUAGE);
  assert.equal(writeStoredLanguage(broken, 'en'), false);
});
