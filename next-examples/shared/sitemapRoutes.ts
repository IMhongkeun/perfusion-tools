const defaultSiteUrl = 'https://perfusiontools.com';

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
  '/phn-echo',
  '/quick-reference',
  '/faq',
  '/contact',
  '/info'
] as const;

/**
 * Resolves canonical site URL with environment override support.
 * Priority:
 * 1) NEXT_PUBLIC_SITE_URL (recommended)
 * 2) VERCEL_URL (auto-provided by Vercel)
 * 3) defaultSiteUrl
 */
export function resolveSiteUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (!envUrl) return defaultSiteUrl;

  const withProtocol = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
  return withProtocol.replace(/\/+$/, '');
}

export function getLastModifiedDate() {
  return new Date();
}
