# Next.js Dynamic Sitemap Examples

이 폴더는 `perfusiontools.com`용 동적 sitemap/robots 생성 예시입니다.

## 포함 파일

- `shared/sitemapRoutes.ts`
  - sitemap 공통 URL 배열(추가 페이지는 여기만 수정)
  - `NEXT_PUBLIC_SITE_URL` / `VERCEL_URL` 환경변수 기반 BASE URL 해석
- `app/sitemap.ts`, `app/robots.ts`
  - Next.js 13+ App Router용
  - `MetadataRoute.Sitemap` / `MetadataRoute.Robots` 표준 타입 사용
  - `dynamic = 'force-static'`로 빌드 타임 정적 생성
- `pages/sitemap.xml.ts`, `pages/robots.txt.ts`
  - Pages Router용
  - `getServerSideProps` 기반 요청 시 동적 생성

## 환경변수 권장

```bash
NEXT_PUBLIC_SITE_URL=https://perfusiontools.com
```

Vercel에서는 `VERCEL_URL`이 자동 제공되며, 코드에서 fallback으로 사용합니다.

## 사용 방법

### App Router

1. `shared/sitemapRoutes.ts`를 프로젝트 내 적절한 경로(`lib/` 등)로 이동
2. `app/sitemap.ts`, `app/robots.ts`를 `app/` 폴더에 배치
3. 배포 후:
   - `/sitemap.xml`
   - `/robots.txt`
   가 동적으로 생성됨

## XML 출력 예시 (Pages Router)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://perfusiontools.com/bsa</loc>
    <lastmod>2026-04-08T00:00:00.000Z</lastmod>
  </url>
</urlset>
```

### Pages Router

1. `shared/sitemapRoutes.ts`를 프로젝트 내 적절한 경로(`lib/` 등)로 이동
2. `pages/sitemap.xml.ts`, `pages/robots.txt.ts`를 `pages/` 폴더에 배치
3. 배포 후:
   - `/sitemap.xml`
   - `/robots.txt`
   가 동적으로 생성됨
