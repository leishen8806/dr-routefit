import { en } from '../content/en';
import { km } from '../content/km';
import { zh } from '../content/zh';
import type { Language } from '../content/types';

export const languages: Language[] = ['km', 'en', 'zh'];
export const languageNames = { km: 'ខ្មែរ', en: 'English', zh: '中文' } as const;
export const content = { km, en, zh } as const;
export const placeholderSlugs = ['drivers', 'pricing', 'about', 'help', 'contact', 'terms', 'privacy'] as const;

export const localizedPath = (lang: Language, pathname = '/') => {
  const clean = pathname.replace(/^\/(km|en|zh)(?=\/|$)/, '').replace(/^\/+/, '');
  return `/${lang}/${clean}`.replace(/\/{2,}/g, '/');
};
