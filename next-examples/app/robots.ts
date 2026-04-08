import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '../shared/sitemapRoutes';

// Build-time static generation.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/'
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
