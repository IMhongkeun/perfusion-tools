# PerfusionTools — Codex Project Instructions

## Project architecture

- This project is intentionally built with static HTML, vanilla JavaScript, and Tailwind CSS via CDN.
- Do NOT introduce React, Vue, Next.js, Vite, TypeScript, or another framework/build system unless the user explicitly requests and approves it.
- Preserve the existing repository architecture, route structure, shared JavaScript files, calculator directories, and styling patterns.
- Prefer the smallest safe change that solves the requested problem.
- Do not perform broad refactors, reorganizations, or architectural rewrites unless they are explicitly requested.

## Dependencies

- Do not add new libraries, npm packages, external APIs, frameworks, or runtime dependencies without explicit user approval.
- Prefer existing project utilities and browser APIs.
- If a new dependency appears genuinely necessary, explain why before adding it.

## Coding style

- Write readable, maintainable, straightforward code.
- Use English lowerCamelCase for JavaScript variables and functions.
- Avoid unnecessary abbreviations, magic numbers, dense one-line logic, and clever abstractions that make debugging harder.
- Reuse existing project patterns before creating new abstractions.
- Comments may be written in Korean or English, but identifiers should remain English.
- User-facing UI text, buttons, labels, helper text, and metadata should remain English unless multilingual support is explicitly requested.

## Medical calculator safety

- PerfusionTools contains CPB, ECMO, perfusion, and other clinical calculators.
- Do NOT modify medical formulas, coefficients, units, thresholds, reference data, or clinical assumptions unless the task explicitly requests that change.
- When the user provides a formula, unit convention, dataset, or clinical rule, treat it as the primary specification.
- Do not silently "correct" or replace a clinical formula based on general knowledge.
- If an implementation appears medically inconsistent or ambiguous, report the concern rather than changing it on your own.
- When adding or changing non-obvious medical calculation logic, document the formula and meaning clearly enough for future maintenance.
- Preserve existing clinical limitations, disclaimers, and safety wording unless explicitly asked to modify them.

## UI and responsive behavior

- Preserve the current visual language and existing Tailwind utility patterns.
- Prefer Tailwind responsive utilities such as `md:` and `lg:` over custom CSS media queries.
- If a direct media query is necessary, use the existing project conventions; when no existing convention applies, prefer `@media (max-width: 768px)`.
- Do not redesign unrelated areas while implementing a focused UI fix.
- Maintain mobile usability as a first-class requirement.

## Analytics and privacy

- Preserve the existing privacy-safe analytics architecture unless the task explicitly concerns analytics.
- Do not send calculator input values, result values, clinical values, free text, or possible patient-related information to GA4, Microsoft Clarity, or another analytics service.
- Preserve existing analytics event names, calculator slug/mode allowlists, and readiness/completion semantics unless explicitly requested.
- Do not add Clarity unmasking for clinical calculator inputs.

## Build and generated files

- Inspect `package.json` and the existing build workflow before changing build-related files.
- Source files are the primary implementation.
- Keep tracked `dist/` output synchronized using the repository's existing build process.
- Do not manually create divergent source and `dist/` implementations.
- If a source change affects generated output, run the established build command rather than inventing a new build process.

## Testing and regression safety

- Before editing, inspect relevant existing tests and surrounding implementation.
- Extend existing tests when practical instead of creating redundant test infrastructure.
- Run the relevant targeted tests after changes.
- For repository-wide changes or before completing a PR, run the established project validation commands, including `npm run build` and `npm test` when applicable.
- Do not weaken or delete existing tests merely to make a change pass.
- If an existing unrelated test is failing, report it separately rather than modifying unrelated behavior.

## Scope discipline

- Stay within the requested task.
- Do not make opportunistic SEO, UI, refactoring, formatting, dependency, or content changes outside the requested scope.
- If you notice a separate issue, report it as a follow-up instead of silently fixing it.
- Preserve backward compatibility unless the requested change intentionally changes behavior.

## Git and pull-request workflow

- Do not merge pull requests unless the user explicitly asks.
- Do not deploy production unless the user explicitly asks.
- When the requested workflow is to create a PR:
  - work on a dedicated branch;
  - run the relevant build/tests;
  - commit the completed changes;
  - push the branch;
  - open a PR targeting the intended base branch;
  - stop after the PR is created and report the PR URL and validation results.
- If an existing open PR already corresponds to the task, continue on the same branch and update that PR instead of creating a duplicate PR, unless explicitly instructed otherwise.

## Python

- For repository utility scripts written in Python, prefer the standard library.
- If data processing is required, `requests` and `pandas` are acceptable when already available or explicitly approved.
- Do not add unnecessary Python dependencies.

## General decision rule

When multiple implementations are possible, prefer the option that:

1. changes the fewest existing files and behaviors;
2. matches existing repository patterns;
3. introduces no unnecessary dependency;
4. is easy to understand and maintain;
5. preserves medical calculation correctness and analytics privacy;
6. can be covered by existing or focused regression tests.
