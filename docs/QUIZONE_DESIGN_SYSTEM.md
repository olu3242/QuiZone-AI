# QuiZone AI — design system

**Source of truth:** `brand/brand-tokens.json` → `scripts/generate-brand.mjs` → `brand/theme.css` (Tailwind 4 `@theme`) → `app/globals.css`. Change tokens in the JSON, never by hand-editing generated CSS.

## Tokens

| Group    | Values                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand    | primary `#0B5FFF` · primaryDark `#083A8C` · navy `#102A56` · sky `#00B8D9` · violet `#7C4DFF` · coral `#FF4D6D` · orange `#FF8A00` · yellow `#FFD43B` · green `#35C76F` |
| Neutrals | ink `#17223B` · muted `#667085` · surface `#ffffff` · surfaceSoft `#f5f7fc` · border `#e4e8f1`                                                                          |
| Radius   | sm 8 · md 16 · lg 24 · xl 32 px                                                                                                                                         |
| Shadow   | card `0 8px 32px #102a560a` · lifted `0 20px 60px #102a5618`                                                                                                            |
| Type     | Poppins (display), Inter (body/UI), loaded via `<link>`                                                                                                                 |

## Zone identity

| Zone       | Accent                                    |
| ---------- | ----------------------------------------- |
| QuickZone  | yellow / orange                           |
| SolveZone  | blue                                      |
| BuildZone  | violet                                    |
| DebateZone | coral                                     |
| WorldZone  | sky / green                               |
| SafeZone   | green (`#35c76f` borders; text `#1d6b40`) |

## Shared components

| Component                                                      | File                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Workspace shell (sidebar, mobile bar, loading/error states)    | `components/workspace.tsx`                                                                          |
| Page heading, empty state, feedback, cards                     | `components/family-ui.tsx`                                                                          |
| Accessible modal (native `<dialog>`, labelled, restores focus) | `components/modal.tsx`                                                                              |
| Buttons                                                        | `.btn`, `.btn.secondary`, `.btn.small`, `.btn.full`, `.btn.danger`                                  |
| Panels and forms                                               | `.panel`, `.form-panel`, `.form-grid`, `.checkbox`, `.notice` / `.notice.error` / `.notice.success` |
| SafeZone                                                       | `.sz-card` (choice card), `.sz-hall`, `.sz-feed`, `.sz-queue`, `.sz-agenda`, `.sz-state`            |

## Accessibility rules (tested by `e2e/*`)

- **Contrast:** text must reach ≥ 4.5:1. Brand hues may be darkened for text (e.g. chip text `#0a5af0`, `#7347ed`, `#956500`), never lightened.
- **Focus:** a visible 3px `#0b5fff` ring via `:focus-visible`. Date/time inputs and the native picker button get an explicit ring. Skip link is the first Tab stop.
- **Layout:** no horizontal scroll at 390 / 1024 / 1280–1440. The mobile bar is shown at ≤ 390, with labels at 10px.
- **Motion:** respect `prefers-reduced-motion` (no transforms or transitions).
- **Semantics:** native controls, `fieldset`/`legend` for choice groups, `aria-pressed` on toggle-like cards and filters, `role="status"`/`role="alert"` for async feedback, and `aria-current="step"` on the live agenda item.
- **States:** every surface has loading, empty, error (with retry), disabled, and permission-denied states. Lost connections keep the last good view and say so.
