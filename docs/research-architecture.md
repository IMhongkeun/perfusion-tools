# Research architecture audit and publication workflow

## Before implementation

- Audited latest main `7528d2afde8bd8c4e3fdfd707c5effba0ba199d6` (includes AdSense preparation #213).
- Static HTML, shared vanilla JavaScript and Tailwind CDN; no runtime framework or package dependencies.
- `research/index.html` holds five weekly issues (2026-10-25 through 2026-11-22), with 18 research entries. Latest content is expanded; four historical issues use details/summary.
- Existing `week-YYYY-MM-DD` fragment identifiers are the only historical issue deep links. Paper cards have no identifiers.
- Research already has CollectionPage metadata and a static sitemap registry, but no independent issue documents or explicit tool relevance mappings.
- About, Privacy, Terms and Contact use the existing home-document informational routing. About remains there; its canonical/noindex policy is outside this task.
- `scripts/build.js` copies static assets into tracked `dist/`; `generate-sitemap.js` derives calculator lastmod only from supported MedicalWebPage dates.
- `analytics.js` owns GA4, Clarity and identifier-only calculator events. `main.js` contains clinical behavior and routing. Neither requires modification for this migration.
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
- `main.js`, `analytics.js`, `tool-workspace.js`, `mobile.css`, clinical data, ads.txt and robots.txt remain unchanged. GDP/cannula source documents differ only by the generated reference block. Privacy text remains byte-identical. Existing calculator regression and AdSense/GA4/Clarity tests pass, including verification tags on the new documents.
- No extra navigation analytics event was added. Existing shared analytics and full-document navigation continue using the existing page-view architecture, without changes to calculator events or patient/input collection.
- No ad-serving scripts, auto ads, slots, subscriptions, accounts, databases or runtime dependencies were added.

## Limitations and maintainer review

Local visual/browser verification was attempted, but loopback access is denied by this execution environment (`WinError 10013`); both browser preview attempts failed to reach the local server. Mobile/desktop screenshots and interactive browser checks are therefore unverified. Existing responsive shell/classes are retained; a responsive preview should be reviewed on the PR before merging. Production checks and external structured-data validators were not run, since this task stops at PR review without deployment.

Maintainer review should confirm the public editorial wording and the four relevance mappings. No additional architectural or clinical decision is required. Source-review status for historical entries remains unknown. This migration does not independently re-review the research literature or change its clinical interpretation.
