> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Legacy Optimizer Provenance and Integrity Baseline (T-193)

Date: 2026-02-07

## Purpose

Track provenance and integrity of the vendored legacy RequireJS optimizer chain used by `build:client`.

## Baseline metadata

- Optimizer artifact: `bin/r.js`
- Header version: `0.26.0`
- Wrapper entrypoint: `bin/r.cjs`
- Build invoker: `bin/build.sh`
- RequireJS optimizer config: `client/js/build.js`

## Integrity hashes (SHA-256)

| File | SHA-256 |
|---|---|
| `bin/r.js` | `ea6d971c5d558e65b237a7495d580fa13281a6fd95509b2c9c194fd74c1a2d23` |
| `bin/r.cjs` | `5ba3dba590fe9fd125cee77cec2275f3051ca653e75b9393edb154b8273a0449` |
| `bin/build.sh` | `2492efc508a78d69cc0a3e104c14144ddf0e630a962ec1564ea393ffeddd50a1` |
| `client/js/build.js` | `885f5139a1939a27133dcd3ffac3e40f7da50c57091cb4adb1cfddd54de5b1f3` |

## Verification command

- `bun run check:legacy-optimizer-integrity`

This command validates:

1. Required files exist.
2. Hashes match this baseline.
3. `bin/r.js` header still reports expected version.

## Intentional update procedure

If updating legacy optimizer files intentionally:

1. Apply the file changes in a dedicated modernization ticket.
2. Recompute hashes:
   - `sha256sum bin/r.js bin/r.cjs bin/build.sh client/js/build.js`
3. Update both:
   - `tools/check-legacy-optimizer-integrity.cjs`
   - `docs/legacy-optimizer-provenance.md`
4. Run:
   - `bun run check:legacy-optimizer-integrity`
   - `bun run verify:legacy:node22`
