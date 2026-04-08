import type { MetadataRoute } from 'next';
import { siteUrl, sitemapPaths, todayIsoDate } from '../shared/sitemapRoutes';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = todayIsoDate();

  return sitemapPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified
  }));
}
