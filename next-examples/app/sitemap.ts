import type { MetadataRoute } from 'next';
import { resolveSiteUrl, sitemapPaths, getLastModifiedDate } from '../shared/sitemapRoutes';

// Build-time static generation (recommended for stable marketing/calculator routes).
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const lastModified = getLastModifiedDate();

  return sitemapPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified
  }));
}
