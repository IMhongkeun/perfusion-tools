export const siteUrl = 'https://perfusiontools.com';

/**
 * Central route list for sitemap generation.
 * Add new pages here to include them in both App Router and Pages Router sitemap outputs.
 */
export const sitemapPaths = [
  '/',
  '/bsa',
  '/gdp',
  '/heparin',
  '/predicted-hct',
  '/lbm',
  '/timecalc',
  '/do2i',
  '/phn-echo',
  '/quick-reference',
  '/faq',
  '/contact',
  '/info'
] as const;

export function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}
