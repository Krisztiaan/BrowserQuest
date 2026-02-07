# Package-Mode Trial Decision (2026-02-07)

## Trial summary

- Trial action: temporary switch in `package.json` from `"type": "commonjs"` to `"type": "module"`.
- Gate command executed: `bun run verify:legacy:node22`.
- Outcome: **defer package-mode transition for now**.

## Evidence

- `bun run test` segment passed under trial.
- Failure occurred in legacy build step (`build:client`):
  - `bin/r.js` raises strict-mode syntax error under module mode:
  - `SyntaxError: Octal literals are not allowed in strict mode.`
- Baseline restored by reverting package-mode change.
- Post-rollback validation:
  - `bun run verify:legacy:node22` passed.
  - `bun run test:browser:protocol:node22` passed.

## Decision

Defer package-mode switch until legacy RequireJS build path (`bin/r.js` and related tooling) is isolated, upgraded, or replaced behind a compatibility boundary.

## Next steps

1. Isolate legacy build tooling behind explicit CJS boundary strategy.
2. Re-run package-mode trial once legacy build blocker is addressed.
