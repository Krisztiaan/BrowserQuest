# Legacy AMD jQuery 4 Risk Scan (T-041)

Date: 2026-02-06

## Scope

- Scanned legacy client runtime code in `client/js/**` for jQuery 4 migration risks.
- Focused on deprecated/removed jQuery APIs that may break if legacy AMD path is moved from current bundled jQuery to modern jQuery.

## Key finding

- Legacy path currently ships a bundled jQuery inside `client/js/lib/require-jquery.js` (legacy runtime insulation).
- jQuery 4 upgrade risk is therefore mostly future-facing for legacy runtime retirement/migration work, not an immediate production break in the current legacy path.

## Risk inventory

1. Confirmed jQuery 4 incompatible pattern (`P1`)
- `.size()` usage:
  - `client/js/main.js:433`
- Impact: breaks keyboard/chat focus guard logic if legacy runtime uses jQuery 4 directly.
- Replacement: use `.length`.

2. High-probability deprecated alias risk (`P1`)
- `.bind()` / `.unbind()` usage:
  - `client/js/main.js:117`
  - `client/js/main.js:145`
  - `client/js/main.js:183`
  - `client/js/main.js:184`
  - `client/js/main.js:185`
  - `client/js/main.js:274`
  - `client/js/main.js:291`
  - `client/js/main.js:429`
  - `client/js/app.js:52`
  - `client/js/app.js:66`
  - `client/js/app.js:228`
  - `client/js/app.js:231`
- Impact: potential event wiring regressions under jQuery 4.
- Replacement: `.on()` / `.off()`.

3. No hits for older high-risk APIs (`P2`)
- No direct matches in legacy app/runtime files for:
  - `.live()`, `.die()`, `.delegate()`, `.undelegate()`

## Recommended remediation order

1. `T-042` (done): Replaced legacy `.size()` usage with `.length` in `client/js/main.js`.
2. `T-043` (done): Replaced direct legacy `.bind()` / `.unbind()` callsites with compatibility wrappers that use `.on()` / `.off()` when available and fall back to `.bind()` / `.unbind()` for old bundled jQuery in `client/js/{main,app}.js`.
3. `T-044` (done): Added legacy-focused browser smoke in `tests/browser/legacy-ui-smoke.playwright.ts` to guard intro event wiring after compatibility updates.
