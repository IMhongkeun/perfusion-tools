# Research architecture audit and publication workflow

## Before implementation

- Audited latest main `7528d2afde8bd8c4e3fdfd707c5effba0ba199d6` (includes AdSense preparation #213).
- Static HTML, shared vanilla JavaScript and Tailwind CDN; no runtime framework or package dependencies.
- `research/index.html` holds five weekly issues (2026-10-25 through 2026-11-22), with 18 research entries. Latest content is expanded; four historical issues use details/summary.
- Existing `week-YYYY-MM-DD` fragment identifiers are the only historical issue deep links. Paper cards have no identifiers.
- Research already has CollectionPage metadata and a static sitemap registry, but no independent issue documents or explicit tool relevance mappings.
- About, Privacy, Terms and Contact use the existing home-document informational routing. About remains there; its canonical/noindex policy is outside this task.
- `scripts/build.js` copies static assets into tracked `dist/`; `generate-sitemap.js` derives calculator lastmod only from supported MedicalWebPage dates.
- `analytics.js` owns GA4, Clarity and identifier-only calculator events. It remains unchanged. `main.js` contains clinical behavior and routing; its only change is a narrow Research/About fragment-scroll exception identified in final review.
- AdSense verification is a metadata-only tag. Preserve ads.txt, robots.txt, Privacy wording and shared analytics initialization byte-for-byte.

## Implementation strategy

Keep the existing static architecture. Extract issue summaries and study card HTML without rewriting their clinical content into one JSON source. A standard-library build renderer uses the existing Research shell to produce the landing page, every issue document, limited calculator reference links and sitemap routes. No individual-paper pages, runtime content fetches, databases or dependencies are needed.

Stable issue URLs use their existing issue date, not the paper's publication date. Retain old week fragment identifiers on the archive. Entry links use PMID-based anchors within the corresponding issue. Unknown review scope stays absent; future explicit source-review states are supported only with recorded provenance. Explicit relevance mappings are separate editorial metadata, not automatic keyword matching or claims of calculator validation.

## Resulting structure

`/research/` now contains an editorial note, the latest issue preview and chronological links to all published issues. Complete summaries live in the weekly documents, accessible without JavaScript or opening disclosures. No paper-level documents were created.

| Issue URL | Entries |
| --- | ---: |
| `/research/2026-11-22/` | 5 |
| `/research/2026-11-15/` | 2 |
| `/research/2026-11-08/` | 1 |
| `/research/2026-11-01/` | 5 |
| `/research/2026-10-25/` | 5 |

All 18 original card bodies and five issue summaries were preserved exactly, including scores, study designs, findings, limitations and PubMed references. Migration fixtures record their original SHA-256 hashes. Existing `#week-YYYY-MM-DD` archive fragments remain addressable; cards gain `#pmid-NNNNNNNN` anchors within issue pages. Exact trailing-slash redirects are generated with the issues.

The existing About view at `/info/` now describes the operator's professional background and contains `#editorial-methodology`. The public identity is **PerfusionTools Editorial — Practicing Clinical Perfusionist · South Korea**. No names, credentials, employer or review history were invented. Historic review scope is absent. The About view retains its existing informational routing and noindex policy.

## Explicit relevance mappings

| Tool | Issue / PMID | Relationship |
| --- | --- | --- |
| GDP | 2026-11-15 / 42684926 | Circuit-coating metabolic markers; oxygen-delivery context in the existing briefing |
| GDP | 2026-11-01 / 42956360 | ECPR lactate response and perfusion context |
| Cannula Pressure Drop | 2026-11-15 / 42985492 | Watershed physiology and cannulation configuration; technical curves only |
| Cannula Pressure Drop | 2026-10-25 / 42940214 | Axillary versus femoral return; technical flow/pressure reference |

Each mapped card links to the tool, and each tool links back to that precise issue anchor. Calculator links sit after the existing calculator and informational content, limited to three references. No meaningful direct link was established for the other calculators, so none was forced. The accompanying text explains that linked studies do not validate the calculators, set targets, select a configuration or establish superiority.

## Metadata and future publishing

- The landing page has a self-canonical URL, unique metadata and CollectionPage/ItemList JSON-LD.
- Weekly pages have topic-specific titles/descriptions, self-canonical URLs, `og:type=article`, Article and BreadcrumbList JSON-LD, source issue dates, Organization author/publisher and original publication citations.
- Modification dates are omitted for these historic issues; builds do not invent timestamps. The schema supports an explicitly documented `dateModified` when appropriate.
- `sitemap-paths.js` derives issue routes directly from the data; calculator routes and their lastmod behavior are preserved.

To publish a new weekly issue:

1. Add a complete published issue to `data/research-issues.json` with its real issue date, research window, concise topics, optional existing summary HTML and entries. Each entry has a stable PMID identifier, title and complete card body. Keep unpublished drafts outside this published dataset. Do not edit generated source or dist documents.
2. Optionally record a verified `sourceReview` with `scope: "abstract"` or `scope: "full-text"` and a nonempty `evidence` record. Omit it when unknown. Never infer status from a publication link.
3. Update `data/research-tool-links.json` only when a new, meaningful relationship should appear. Unmapped studies render normally.
4. Run `npm run build` and `npm test`. Review and commit generated source documents, `dist/`, sitemap and redirects with the data change.

One issue addition automatically generates its page, chronological position, previous/next navigation, redirect and sitemap entry. Removed issues and removed mappings clean up their generated output. Tests exercise this entire workflow using an isolated temporary issue; that fixture is never published.

## Validation and preservation

- Full established build and test suite passes with `TZ=UTC`, matching the CI timezone. The Windows host's configured npm Bash shell could not run the scripts; using npm's `cmd.exe` script shell resolves that environment issue. An unchanged Time Calculator test assumes UTC and fails on this host's local timezone; no time or calculator code was changed.
- Research tests compare original content hashes, parse JSON-LD, resolve research links and anchors, check both directions of relevance mappings and all publication dates, preserve archive fragments, exercise optional/invalid review scope and mappings, and run repeated full builds with a future issue and its removal.
- Existing sitemap and workspace tests now verify independent issue documents and crawlable archive links while retaining prior checks of historical PubMed references and card counts.
- `analytics.js`, `tool-workspace.js`, `mobile.css`, clinical data, ads.txt and robots.txt remain unchanged. `main.js` changes only fragment-scroll handling for existing Research/PMID and editorial targets; formulas, constants, calculator events and input/result behavior are untouched. GDP/cannula source documents differ only by the generated reference block. Privacy text remains byte-identical. Existing calculator regression and AdSense/GA4/Clarity tests pass, including verification tags on the new documents.
- No extra navigation analytics event was added. Existing shared analytics and full-document navigation continue using the existing page-view architecture, without changes to calculator events or patient/input collection.
- No ad-serving scripts, auto ads, slots, subscriptions, accounts, databases or runtime dependencies were added.

## Limitations and maintainer review

Final review used the existing automatic Cloudflare PR preview, removing the local-loopback limitation. The tested code is commit `90b6333`, available at https://4e38300d.perfusion-tools.pages.dev/research/ . No manual deployment was performed.

### Final review findings and resolutions

1. The synthetic publication date was fixed to November 29, 2026 and could collide with a real issue. It now derives deterministically from the latest published date plus seven UTC days. Tests verify input-order independence and select a later date when the formerly selected date becomes published. All page, archive, redirect, sitemap and removal assertions use that derived date.
2. The unknown-review assertion covered every weekly issue. Historical preservation remains limited to the five migration-baseline issues and their 18 original entries. Other entries are checked against their actual documented scope. The full temporary publication build includes abstract-reviewed, full-text-reviewed and unreviewed entries together, with no fabricated historical review status.
3. Common scroll-reset handlers could erase PMID, historical archive and About editorial fragments. A route- and target-specific exception now restores valid targets after the informational view is revealed. Executable regression tests run the real route and DOMContentLoaded/load/pageshow/popstate handlers; invalid/missing targets and ordinary calculator routes keep prior reset behavior. Existing Home and Quick Reference fragment exceptions remain covered.

Repeated-build tests now hash every research document, sitemap, redirect and dist asset. The complete 37-file test suite passed locally in UTC and in GitHub Actions for the reviewed code commit.

### Browser evidence

| Check | Result |
| --- | --- |
| Desktop 1440 × 1000 | Landing page and all five issues load with correct 5/2/1/5/5 card counts; no horizontal overflow |
| Mobile 390 × 844 | Landing page and all five issues load; no horizontal overflow; study text 14.72px; mobile navigation visible |
| Latest/archive/previous/next links | Followed real links to the expected destinations |
| PMID anchors and historical archive fragment | Selected targets settle approximately 96px below the viewport top, clear of the fixed header |
| Editorial methodology | Followed the visible link on desktop and mobile to `/info/#editorial-methodology`; target visible at approximately 96px |
| Research ↔ GDP and Research ↔ Cannula | Both directions exercised; calculator backlinks land on the intended study |
| GDP smoke test | BSA 1.8, Hb 8, SaO2 100, PaO2 200, flow 4.5 produces 284 mL/min/m² on desktop and mobile |
| Cannula smoke test | Target flow 4.5, arterial filtering and EOPA 3D 20 Fr chart selection work; displayed 52.0 mmHg estimate and chart present |
| Navigation/dark mode/back-to-top | Research/About desktop emphasis and mobile Research accent verified; dark mode persists across navigation; back-to-top returns to zero and hides above the bottom bar |
| Nested-route resources | Root-relative shared scripts present; main initialization and workspace execute; shared mobile.css colors apply on every issue; injected GA4/Clarity scripts present |
| Preview SEO/static files | Canonicals, og:type, Article/BreadcrumbList JSON-LD and dates checked on all issues; CollectionPage on archive; sitemap contains all five issue URLs; ads.txt and robots.txt match expected preserved content |
| Console | No site application errors observed. Two ad-filter browser-extension errors occurred while viewing raw XML; their chrome-extension origins are outside site code |

Mobile dark-mode study and desktop light-mode archive screenshots were displayed in the review conversation. No real patient data was entered. The browser viewport and theme were restored after testing.

Production checks, external structured-data validators, other browser engines and physical devices were not tested. Calculator browser smoke tests were representative (GDP and Cannula); the full existing calculator suite provides the broader regression coverage. These are validation limits, not known code blockers.

Maintainer review should confirm the public editorial wording and the four relevance mappings. No additional architectural or clinical decision is required. Source-review status for historical entries remains unknown. This migration does not independently re-review the research literature or change its clinical interpretation.
