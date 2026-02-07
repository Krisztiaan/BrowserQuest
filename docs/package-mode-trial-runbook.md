# Package-Mode Trial Runbook

Date: 2026-02-07

## Goal

Run an isolated trial of switching package mode to `"type": "module"` with deterministic rollback.

## Trial branch workflow

1. Create a dedicated trial branch from `modernize`.
2. Change only package-mode/boundary files needed for the trial.
3. Do not mix unrelated refactors in the same trial branch.

## Trial steps

1. Update `package.json` package mode:
   - `"type": "commonjs"` -> `"type": "module"`
2. Keep intentional CJS tools as `.cjs`.
3. Verify server/runtime entry scripts still resolve correctly.

## Mandatory gates

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

1. Revert package-mode trial commit(s).
2. Re-run:
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
3. Confirm baseline is restored before further edits.
