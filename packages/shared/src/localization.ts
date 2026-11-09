export const languageLabels = {
  km: 'ខ្មែរ',
  en: 'English',
  zh: '中文',
  'zh-Hans': '中文',
} as const;

export type MessageCatalog<Language extends string, Messages extends Record<string, string>> =
  Record<Language, Messages>;

export function message<
  Language extends string,
  Messages extends Record<string, string>,
  Key extends keyof Messages,
>(catalog: MessageCatalog<Language, Messages>, language: Language, key: Key): Messages[Key] {
  return catalog[language][key];
}
