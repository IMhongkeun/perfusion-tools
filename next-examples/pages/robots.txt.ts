import type { GetServerSideProps } from 'next';
import { resolveSiteUrl } from '../shared/sitemapRoutes';

function buildRobotsTxt() {
  const siteUrl = resolveSiteUrl();
  return [`User-agent: *`, `Allow: /`, `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  // Pages Router example is request-time dynamic by design (runs on each request).
  res.setHeader('Content-Type', 'text/plain');
  res.write(buildRobotsTxt());
  res.end();

  return { props: {} };
};

export default function RobotsTxt() {
  return null;
}
