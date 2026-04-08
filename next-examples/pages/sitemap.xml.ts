import type { GetServerSideProps } from 'next';
import { siteUrl, sitemapPaths, todayIsoDate } from '../shared/sitemapRoutes';

function buildSitemapXml() {
  const lastModified = todayIsoDate();
  const urls = sitemapPaths
    .map((path) => {
      return [
        '<url>',
        `<loc>${siteUrl}${path}</loc>`,
        `<lastmod>${lastModified}</lastmod>`,
        '</url>'
      ].join('');
    })
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>'
  ].join('');
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const sitemapXml = buildSitemapXml();

  res.setHeader('Content-Type', 'application/xml');
  res.write(sitemapXml);
  res.end();

  return { props: {} };
};

export default function SitemapXml() {
  return null;
}
