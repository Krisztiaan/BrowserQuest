# Map Authoring Audit

The terrain authoring audit is a content-quality gate. It is separate from `check:world-map:target`, which validates structural safety. A map can be structurally valid and still have bad terrain painting, incomplete transitions, wrong-layer tiles, weak overlays, or missing authoring metadata.

The audit writes:

```text
artifacts/map-authoring/terrain-authoring-audit.json
artifacts/map-authoring/terrain-authoring-audit.md
```

Severity meanings:

- `error`: must block release or map-pack generation.
- `high`: must be fixed before the map is considered authored correctly.
- `medium`: fix in the same authoring pass unless a review entry explains why it is intentional.
- `low`: review opportunistically.
- `info`: evidence only.

Finding locations include enough data to inspect the issue later: layer path and tile coordinate for tile findings, object layer and object id for object findings, or tileset and tile id for tileset findings.
