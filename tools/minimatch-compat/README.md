# minimatch compat adapter

Development-only. `minimatch < 11.0.1` carries GHSA-g3hv-75wg-m249 (moderate
ReDoS via globparts amplification). Every current ESLint 9/10 release, and the
plugins `eslint-config-next` pulls in, still depend on minimatch 3.x or 10.x,
so no upstream upgrade clears it.

A global npm override routes every `minimatch` edge to this package, which
re-exports patched `minimatch@11.0.3` behind a callable function so both the
legacy `minimatch(path, pattern)` call shape and the modern
`{ minimatch, Minimatch }` destructuring keep working. No audit finding is
suppressed and no lint rule is disabled; `tests/tooling.test.ts` verifies the
adapter is what the toolchain resolves and that real lint rules still fire.

Remove this adapter (and the `overrides.minimatch` entry) once ESLint and the
Next/React/import/a11y plugins ship on a patched minimatch.
