> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Legacy Artifact Consumer Inventory (T-194)

Date: 2026-02-07

## Scope

Inventory downstream consumers of legacy `client-build/` artifacts and related `build:client`/`verify:legacy` dependencies that can block retirement.

## Discovery method

- Repo scan:
  - `rg -n "client-build|build:client|verify:legacy|client/index.html" .github docs README.md package.json bin client tests tools`

## In-repo consumers

| Consumer | Dependency type | Blocker level | Migration path | Owner |
|---|---|---|---|---|
| `package.json` (`build:client`, `verify:legacy`) | Primary build + required compatibility gate | High | Demote/remove after retirement readiness criteria are met | Maintainers |
| `.github/workflows/verify-legacy.yml` | CI required compatibility gate for legacy-sensitive paths | High | Convert to advisory/manual workflow before full removal | Maintainers |
| `bin/build.sh` + `client/js/build.js` | Legacy artifact generation pipeline (`client-build/`) | High | Remove after gate demotion and rollback release tag is prepared | Maintainers |
| Browser tests targeting `/client/index.html` (`tests/browser/*legacy*`, `tests/browser/protocol-invariant.playwright.ts`) | Compatibility runtime coverage | Medium | Keep until cutover; then archive or replace with modern-only smoke | Maintainers |
| Static entry smoke (`tests/smoke/static-server-entry-default.test.ts`) | Ensures `/index.html` compatibility routing | Medium | Narrow to modern default-only assertions at retirement cutover | Maintainers |
| Docs/runbooks (`README.md`, `docs/client-build-support.md`, `docs/legacy-retirement-checklist.md`) | Operational guidance for legacy artifacts | Medium | Update docs in same PR that demotes/removes legacy pipeline | Maintainers |
| `client/README.md` legacy deployment notes | Claims `client-build/` can be deployed independently | Medium | Replace with retirement notice + migration instructions | Maintainers |

## External consumer status

- No external consumer is discoverable from repository code/config alone.
- Treat external dependency status as **unknown** until maintainers confirm release/deploy consumers of `client-build/`.

## Retirement blockers

1. `verify:legacy` is still part of default CI compatibility posture.
2. Legacy browser/protocol tests still intentionally validate `/client/index.html`.
3. External `client-build/` consumers are not yet explicitly confirmed.

## Recommended next step

Proceed with a reversible gate-demotion rehearsal plan (`T-195`) only after maintainers confirm external consumer status for `client-build/`.
