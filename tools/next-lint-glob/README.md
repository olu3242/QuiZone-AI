# Next lint glob adapter

This private development-only package implements the **single API used by the pinned `@next/eslint-plugin-next@16.3.8`**: `globSync(string, { onlyDirectories: true })`.

That plugin pins `fast-glob@3.3.1`, which brings the unpatched `braces@3.0.3` parser through `micromatch`. A version-scoped npm override routes this one dependency edge to this package instead. The vulnerable implementation is removed from the installed graph; no audit finding is suppressed and no lint rule is disabled.

The adapter uses pinned `tinyglobby@0.2.17`. It supplies static-directory lookup, absolute-path preservation, trailing-slash normalization, and `expandDirectories: false` so Next's resolver retains its expected directory semantics. It deliberately throws for unsupported API calls instead of claiming to replace all of fast-glob.

Tests invoke the installed Next plugin's actual root resolver, including default/static/wildcard/brace-choice/array/Windows-separator/missing/file cases. Further tests demonstrate that the Next image rule, React Hooks rule, and image accessibility rule still report invalid JSX.

The override is scoped to version 16.3.8. Re-check the upstream resolver and these tests before upgrading `eslint-config-next` or changing root-directory discovery. Tinyglobby does not implement advanced brace step ranges or zero-padded ranges; QuiZone does not use those patterns. This is not a general-purpose globbing replacement for application code.

References:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://superchupu.dev/tinyglobby/comparison
- https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides
