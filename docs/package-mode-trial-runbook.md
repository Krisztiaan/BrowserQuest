# Package-Mode Trial Runbook

Date: 2026-02-07

## Goal

Run deterministic package-mode regression checks and retain a clean rollback path.

## Change workflow

1. Create a dedicated branch from `modernize`.
2. Change only package-mode and boundary files in the same slice.
3. Do not mix unrelated refactors in the same branch.

## Regression steps

1. Confirm package mode remains `"type": "module"`.
2. Keep intentional CJS boundary scripts explicit (`.cjs`).
3. Confirm legacy build tooling still runs through `bin/r.cjs`.
4. Verify server/runtime entry scripts still resolve correctly.

## Mandatory gates

- `bun run check:package-mode-boundaries`
- `bun run check:class-fanout`
- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
- `bun run lint`
- `bun run format:check`

## Pass criteria

- All gates above pass without adding flaky opt-in flags.
- Legacy and protocol paths behave consistently with baseline.

## Rollback

If any gate fails:

1. Revert boundary/package-mode commit(s).
2. Re-run:
   - `bun run check:package-mode-boundaries`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
3. Confirm baseline is restored before further edits.
