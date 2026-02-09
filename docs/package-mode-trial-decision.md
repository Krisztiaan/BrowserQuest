> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Package-Mode Trial Decision (2026-02-07)

## Trial summary

- Trial action: temporary switch in `package.json` from `"type": "commonjs"` to `"type": "module"`.
- Gate command executed: `bun run verify:legacy:node22`.
- Outcome: **advance and keep package-mode transition**.

## Evidence

- Initial trial found legacy build blocker:
  - `bin/r.js` strict-mode error under module mode (`Octal literals are not allowed in strict mode`).
- Mitigation implemented:
  - Added `bin/r.cjs` wrapper that compiles `bin/r.js` in explicit CJS context.
  - Updated `bin/build.sh` to run `node bin/r.cjs -o build.js`.
- Retry result under package mode (`"type": "module"`):
  - `bun run verify:legacy:node22` passed.
  - `bun run test:browser:protocol:node22` passed.
  - `bun run verify:modern:node22` passed.
  - `bun run check:class-fanout`, `bun run lint`, `bun run format:check` passed.

## Decision

Keep package mode as `"type": "module"` with explicit CJS boundaries (`.cjs`) for legacy/tooling compatibility.

## Next steps

1. Keep `bin/r.cjs` boundary stable and documented.
2. Continue reducing legacy/tooling friction behind explicit CJS boundaries.
