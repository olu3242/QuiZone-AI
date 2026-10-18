# Iteration 2 — development dependency remediation

## Change

The initial full dependency audit reported nine findings (seven high, two moderate). Four were removed by migrating Tailwind 3.4.13 and its PostCSS pipeline to Tailwind 4.3.3. The old nested CSS/selector parser and watcher dependencies are no longer needed.

Five findings belonged to the Next lint plugin's `fast-glob → micromatch → braces` chain. Upstream braces has no published patch. A private, version-scoped adapter now uses `tinyglobby@0.2.17` for the pinned plugin's narrow directory-discovery API. The vulnerable chain is actually absent. ESLint/Next/React Hooks/accessibility checks remain enabled, with regression tests demonstrating reported violations.

Brand tokens remain authoritative in `brand/brand-tokens.json`. `scripts/generate-brand.mjs` now produces Tailwind 4's CSS-first `@theme` variables and the existing application variables together. The old TypeScript Tailwind config is removed. CSS source scanning is explicitly limited to app/components, and the updated PostCSS plugin handles imports and prefixing.

## Guardrails

- Full dependency audit is now a required CI step, at `--audit-level=low`; no allowlist or suppression is used.
- Installed-plugin tests verify the adapter's expected directory-discovery behavior and fail if a future plugin upgrade bypasses it.
- A real PostCSS/Tailwind compilation test checks generated brand colors/radii/fonts/shadows and retained accessibility CSS.
- The lockfile and local adapter must be committed together. A clean npm 10 install is checked to match the Node 22 CI toolchain.

## Observed verification

- Clean `npm@10.9.4 ci`: passed.
- 31 tests: passed, zero failures/skips.
- Lint, typecheck, and production build: passed.
- Full and runtime audits: zero known vulnerabilities, zero suppressions.
- ESLint 9 still emits a lifecycle/deprecation warning; the dependency audit reports no known advisory against it. A future supported-major upgrade needs separate compatibility review.

## Compatibility limits

Tailwind 4 targets Safari 16.4+, Chrome 111+, and Firefox 128+. Browser/device/contrast QA is still pending; stylesheet compilation is not a substitute for visual testing.

The adapter is deliberately limited to the pinned Next lint plugin. It does not support fast-glob's entire API or advanced numeric brace patterns. Reassess it when upgrading the lint plugin; the scoped override, audit gate, and compatibility tests make that boundary visible.

## References

- https://tailwindcss.com/docs/upgrade-guide
- https://tailwindcss.com/docs/installation/using-postcss
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf
- https://superchupu.dev/tinyglobby/comparison

Current audit evidence is retained in `DEPENDENCY_AUDIT.json` and `RUNTIME_DEPENDENCY_AUDIT.json`. Hosted Auth/data/privacy and the wider PRD launch gates remain open; remediation of development dependencies is not production certification.
