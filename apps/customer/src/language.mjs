export const DEFAULT_LANGUAGE = 'km';
export const LANGUAGE_STORAGE_KEY = 'routefit.customer.language';
export const SUPPORTED_LANGUAGES = Object.freeze(['km', 'en', 'zh']);

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

export function readStoredLanguage(storage) {
  try {
    return normalizeLanguage(storage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function writeStoredLanguage(storage, language) {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
    return true;
  } catch {
    return false;
  }
}
