# AdSense approval preparation

This change prepares site verification only. It does not activate advertising,
request production deployment, or guarantee Google's site approval.

## Current implementation

- Account: `pub-2705461910278176`.
- Static HTML pages contain one `google-adsense-account` meta tag in `head`.
  The site has independent HTML documents and no shared head template. Keeping
  the tag in the source HTML also makes it visible without JavaScript. `/info/`,
  `/privacy/`, `/terms/`, and `/contact/` reuse the root document via `_redirects`.
- The existing root `ads.txt` already contains the required record:
  `google.com, pub-2705461910278176, DIRECT, f08c47fec0942fa0`.
  The established build copies it unchanged to `dist/ads.txt`.
- The previous homepage advertising script has been removed. No ad SDK, ad
  slots, pixels, preconnects, consent SDK, or advertising event calls are added.
- GA4, Microsoft Clarity, routing, canonical tags, sitemaps, search verification
  assets, calculator formulas, and calculator analytics are unchanged.
- Privacy Policy describes existing analytics and storage separately from
  prospective advertising. There is currently no on-site consent manager;
  this preparation does not claim to implement one.
- `tests/ads-txt.test.js` checks source and delivered HTML/JS for advertising code,
  verifies static ownership tags, and verifies the exact authorized record.

## Future manual advertising: design review only

Implement in a separate change after approval and consent/privacy review:

1. Allow exactly `/research/` (and its static `index.html` equivalent), with one
   manually placed, clearly labeled advertising unit after all research content
   and the educational note, before `</main>` in `research/index.html`. Do not
   insert units between studies, inside clinical summaries, or into the global
   footer. Keep Auto ads off in AdSense. Do not add a loader to `analytics.js`,
   `main.js`, `tool-workspace.js`, the root page, or calculator HTML.
2. Default to disabled. Require an explicit release decision, a configured ad
   unit, and applicable consent before loading any ad SDK or making ad requests.
   Where required, provide a Google-certified TCF CMP, refusal and withdrawal
   controls, and assess non-personalized/limited ads separately: those modes
   must not be assumed to be free of storage or consent requirements. Update
   the public policy to match the actual partners and behavior before release.
3. Keep the research loader independent of calculator state. Never read form
   inputs, calculator outputs, localStorage case data, feedback text, URL query
   values, or patient information for ad parameters or targeting. Review GA4
   account-side advertising links/personalization separately; this PR does not
   change remote GA4, Clarity, AdSense, or consent account settings.
4. Verify document navigation, including mobile `data-route` links, browser
   history, restored pages, and future router changes. An ad SDK already loaded
   in a research document must never survive a transition to a calculator view.
   Require full-document navigation out of research if necessary. Removing a
   visible ad element alone does not unload the SDK.
5. Before activation, test fresh loads and Research-to-calculator navigation
   with a browser network log, synthetic inputs, denied/withdrawn consent,
   storage inspection, and ad blockers. Confirm zero advertising requests on
   every clinical calculator. Review Clarity masking and GA4 advertising
   features before connecting advertising to existing analytics. Preserve
   layout stability when the research-only unit is eventually introduced.

No loader, placeholder, feature flag, or ad markup is implemented in this PR.

## Verification after a separately authorized production deployment

- [ ] Open `https://perfusiontools.com/ads.txt` without authentication. Expect
      HTTP 200, plain text (not a homepage fallback), and exactly the record
      above. Verify the deployed artifact is built from this PR's commit.
- [ ] Check root-domain and `www` behavior. The root ads.txt must be directly
      reachable; any host redirect must retain `/ads.txt` and reach that file.
- [ ] View the original HTML response for `/`, `/research/`, `/bsa/`, `/gdp/`,
      `/predicted-hct/`, and `/privacy/`. Confirm exactly one account tag in
      `head`, correct publisher ID, and no advertising SDK.
- [ ] Confirm robots.txt, redirects, CDN cache, and security settings allow
      Google's crawler to retrieve pages and ads.txt. Purge stale cache if the
      deployed response still includes the previous homepage ad script.
- [ ] In DevTools Network, test Home, Weekly Research, each clinical calculator,
      and navigation between them. Expect zero AdSense/advertising-network
      requests and no new advertising cookies, including after calculator
      input. Existing GA4 and Clarity traffic is expected and is not proof of
      advertising activation. Check synthetic input values are not in events.
- [ ] Confirm GA4 page views and existing calculator event names in DebugView,
      Clarity loading/masking, Search Console verification, canonical URLs,
      sitemap access, calculator results, mobile navigation, and Privacy Policy.
- [ ] In AdSense, keep Auto ads off. Select meta-tag verification, verify the
      site, then request review. Use ads.txt **Check for updates**. Crawl/status
      updates can lag deployment; a correct HTTP response does not immediately
      change the AdSense dashboard. Do not add an ad SDK just to speed crawling.
- [ ] Leave advertising disabled even after approval. Future activation requires
      the separate implementation and checks above.

## Official references

Reviewed November 25, 2026:

- [Connect your site: meta-tag verification and review](https://support.google.com/adsense/answer/7584263?hl=en)
- [Resolve ads.txt crawl and status delays](https://support.google.com/adsense/answer/12171244?hl=en)
- [Ensure root-domain ads.txt can be crawled](https://support.google.com/adsense/answer/7679060?hl=en)
- [Required privacy content for advertising cookies](https://support.google.com/adsense/answer/1348695?hl=en)
- [Consent management requirements for publishers](https://support.google.com/adsense/answer/13554116?hl=en)
