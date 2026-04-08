# Next.js Dynamic Sitemap Examples

이 폴더는 `perfusiontools.com`용 동적 sitemap/robots 생성 예시입니다.

## 포함 파일

- `shared/sitemapRoutes.ts`
  - sitemap 공통 URL 배열(추가 페이지는 여기만 수정)
- `app/sitemap.ts`, `app/robots.ts`
  - Next.js 13+ App Router용
- `pages/sitemap.xml.ts`, `pages/robots.txt.ts`
  - Pages Router용

## 사용 방법

### App Router

1. `shared/sitemapRoutes.ts`를 프로젝트 내 적절한 경로(`lib/` 등)로 이동
2. `app/sitemap.ts`, `app/robots.ts`를 `app/` 폴더에 배치
3. 배포 후:
   - `/sitemap.xml`
   - `/robots.txt`
   가 동적으로 생성됨

### Pages Router

1. `shared/sitemapRoutes.ts`를 프로젝트 내 적절한 경로(`lib/` 등)로 이동
2. `pages/sitemap.xml.ts`, `pages/robots.txt.ts`를 `pages/` 폴더에 배치
3. 배포 후:
   - `/sitemap.xml`
   - `/robots.txt`
   가 동적으로 생성됨
