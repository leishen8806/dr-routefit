import type { APIRoute } from 'astro';
import { languages } from '../lib/site';

export const GET: APIRoute = ({ site }) => {
  const paths = languages.map((lang) => `/${lang}/`);
  const urls = paths.map((path) => `<url><loc>${new URL(path, site)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml' }
  });
};
