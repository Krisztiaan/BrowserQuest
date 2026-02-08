# Runtime Preflight Runbook

This project enforces runtime policy through `bun run check:runtime`.

## Policy

- Node.js: `22.x`
- Bun: `>= 1.3.0`

## When checks run

- `bun run verify:modern`
- `bun run test:browser:modern` (alias of `test:modern-browser`)
- `bun run test:browser:protocol`
- `bun run test:browser:protocol-invariant`

Each command now runs `check:runtime` first and fails fast on unsupported runtimes.

## Typical failure mode

Example:

`runtime-check: unsupported Node runtime v20.x. Required major is 22.`

## Recovery paths

1. Preferred: switch your shell runtime
- `nvm use` (uses `.nvmrc`)

2. No shell switch available: run command with the Node 22 wrapper
- `bash tools/node22-run.sh bun run check:runtime`
- `bun run verify:modern:node22`
- `bun run test:browser:modern:node22`
- `bun run test:browser:protocol:node22`
- `bun run test:browser:protocol-invariant:node22`

## Onboarding quick path

1. `bun run check:runtime`
2. If it fails on Node version, run `bun run check:runtime:node22`.
3. Run verification using wrapper shortcuts until shell runtime is updated:
- `bun run verify:modern:node22`

## CI expectations

- CI workflows pin Node 22 via `actions/setup-node@v4`.
- Runtime-preflight failures in CI indicate workflow drift or unexpected runner/toolchain changes.
