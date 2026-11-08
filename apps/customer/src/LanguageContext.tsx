import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { copy, Language, text } from './copy';
import { DEFAULT_LANGUAGE, readStoredLanguage, writeStoredLanguage } from './language.mjs';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof typeof copy.en) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function browserStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const userSelectedLanguage = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!userSelectedLanguage.current) {
        setLanguageState(readStoredLanguage(browserStorage()) as Language);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage(next) {
      userSelectedLanguage.current = true;
      setLanguageState(next);
      writeStoredLanguage(browserStorage(), next);
    },
    t: (key) => text(language, key),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is missing');
  return context;
}
