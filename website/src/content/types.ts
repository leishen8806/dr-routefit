export type Language = 'km' | 'en' | 'zh';

export type SiteCopy = {
  localeName: string;
  meta: { title: string; description: string };
  nav: { home: string; services: string; drivers: string; pricing: string; track: string; about: string; help: string; contact: string; menu: string; language: string; skip: string };
  pages: { drivers: string; pricing: string; about: string; help: string; contact: string; terms: string; privacy: string };
  hero: { eyebrow: string; title: string; body: string; primary: string; secondary: string; note: string; route: [string, string, string, string] };
  quick: Array<{ title: string; body: string; action: string; href: string; badge?: string }>;
  values: { eyebrow: string; title: string; items: Array<{ icon: string; title: string; body: string }> };
  process: { eyebrow: string; title: string; items: Array<{ title: string; body: string }> };
  coverage: { eyebrow: string; title: string; body: string; action: string; mapLabel: string };
  audiences: Array<{ eyebrow: string; title: string; body: string; action: string; href: string }>;
  faq: { eyebrow: string; title: string; items: Array<{ question: string; answer: string }> };
  footer: {
    summary: string;
    product: string;
    company: string;
    support: string;
    legal: string;
    terms: string;
    privacy: string;
    rights: string;
  };
  placeholder: { eyebrow: string; title: string; body: string; back: string; pricingFacts: [string, string, string] };
};
