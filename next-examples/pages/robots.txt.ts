import type { GetServerSideProps } from 'next';
import { siteUrl } from '../shared/sitemapRoutes';

function buildRobotsTxt() {
  return [`User-agent: *`, `Allow: /`, `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/plain');
  res.write(buildRobotsTxt());
  res.end();

  return { props: {} };
};

export default function RobotsTxt() {
  return null;
}
