# Release Checklist

Run from repo root before cutting a handoff archive or release candidate.

```bash
git status --short --branch
bun install --frozen-lockfile
bun audit
bun run verify:modern
bun run test:browser:protocol
bun run test:browser:modern
bun run check:handoff-hygiene -- <clean-archive-directory>
```

Expected:

- No unexpected dirty files.
- Dependency audit passes or has a current documented dev-only risk acceptance.
- Modern verification passes.
- Browser protocol and UI tests pass.
- Clean archive directory contains no generated, local, or private artifacts.

For local verification of the archive hygiene gate, use a clean fixture directory:

```bash
mkdir -p .tmp/clean-handoff-fixture
bun run check:handoff-hygiene -- .tmp/clean-handoff-fixture
```
