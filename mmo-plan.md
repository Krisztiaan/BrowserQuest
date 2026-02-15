# MMO Plan (Stardew × WoW) — Server-Authoritative ECS, Independent Shards

Status: draft

This document proposes a pragmatic, resilient simulation + netcode + persistence architecture for a moderately sized MMO world game (farming, building, battling, shared mines), targeting:

- ~2000 concurrent players per shard
- ~30 Hz server simulation for fast systems (movement/combat)
- Dynamic world growth via expansions/domains over time
- Claimed land + permissions, parties, guilds
- Optional instances later (while keeping shared mines initially)
- Offline play (single-player / local-hosted) as a first-class mode without contaminating MMO authority

The plan is designed to be idiomatic to our current direction: server-side ECS tick pipeline + client kernel + interest replication.

---

## Roadmap (Itemized)

Source of truth for execution is `TODO.md` (active tickets only).

- [x] Milestone 199: stable core + feature modules (Tickets 214–216)
- [x] Milestone 200: lock down client→server `TELEPORT` (Ticket 210)
- [x] Milestone 201: server-side door/portal traversal outcomes (Ticket 213)
- [x] Milestone 202: protocol v2 `seq` + `ACK/REJECT/CORRECTION` (Tickets 220–222)
- [x] Milestone 203: chunk overlay store + `CHUNK_SNAPSHOT/DELTA` streaming (Tickets 230–238)
- [x] Milestone 204: claims + ACL enforcement (Tickets 240–241)
- [x] Milestone 205: tiered scheduler/jobs for crops/respawns/weather (Ticket 250 + follow-ups)
- [x] Milestone 207: headless bot load/soak harness + budgets (Tickets 260–261)

---

## 0) Decision Matrix (v1 defaults)

This section is the canonical place to review v1 defaults, trade-offs, and alternatives. The intent is to keep the **core stable**: new features should be additive (new modules + new data) rather than kernel edits.

### 0.0 Open decisions (resolve incrementally)

These are “safe to decide now” because they mostly affect knobs and extension points rather than content.

- [ ] **Shard time vs zone time**: default shard-global clock; allow zone time bands for offsets/rates later.
- [ ] **Chunk size per region**: default 32×32; allow 64×64 for sparse/wild regions.
- [x] **Message caps + splitting contract**: snapshots can be split into `CHUNK_SNAPSHOT_PART` frames under caps (server streams parts, client reassembles atomically).
- [ ] **Compression choice**: default deflate/gzip; decide if/when to add brotli/zstd (CPU trade-offs).
- [ ] **Client prediction policy**: default predict movement only; no client-auth world edits/combat.
- [ ] **Persistence durability tiers**: default WAL+NORMAL and “lose ~10s on power loss”; decide if Tier-0 should be WAL+FULL on the VPS.
- [ ] **Instancing strategy (future)**: default shared zones everywhere; decide first instancing trigger (party, solo dungeon, guild).

### 0.1 Persistence (starter VPS)

- **Default**
  - Chunk overlays (tile state): SQLite blob store (WAL) per shard.
  - Player profiles + small globals: SQLite tables (Tier 0/1).
  - Flush cadence: every **10s** (configurable 5–30s), plus zone hibernate and best-effort shutdown flush.
  - Loss window: accept losing the last **~10s** of unflushed edits on power loss.
- **Pros**
  - Single-file ops, atomic transactions, easy backups, good enough throughput for one shard on one VPS.
  - Clear durability posture (“bounded loss”, not corruption).
- **Cons**
  - Large blob IO can stall if not strictly budgeted (must bound flush work and keep IO off the fast path).
  - Scaling past one machine requires a migration path.
- **Alternatives**
  - Chunk blobs as files-on-disk (simpler, faster sequential writes; harder to query/compact).
  - Postgres for metadata + object storage for blobs (better scale, higher ops complexity).
- **Revisit when**
  - Per-shard overlay size grows beyond comfortable single-file behavior, or flush contention shows up in bot budgets.

### 0.2 Chunking + overlay versioning

- **Default**
  - Chunk size: **32×32** tiles (configurable per region).
  - Chunk key: `(shardId, zoneId, chunkX, chunkY)`.
  - `chunkVersion: u32` monotonic per chunk overlay mutation.
  - Delta model: server emits bounded `fromVersion → toVersion` patches; on gaps, send snapshot.
- **Pros**
  - Makes persistence and replication align on one unit (chunk), simplifying caching and AOI.
  - Versioned deltas provide a clean resync contract (no “guessing” about client state).
- **Cons**
  - Fine-grained edits can cause write amplification if you version per edit (must coalesce within a flush window).
- **Alternatives**
  - Append-only event log (replay) for chunks (strong audit, more complexity).
  - Global tile event stream (hard to scope and compact).

### 0.3 Net transport + payload limits

- **Default**
  - JSON envelopes for control/opcodes; large payload fields may be compressed and base64-encoded.
  - Target cap: **64KB** per message (tunable).
  - If a chunk snapshot exceeds cap: split into `CHUNK_SNAPSHOT_PART` frames; client reassembles and applies atomically.
  - If a snapshot would require “too many parts”: treat as “resync required” and retry under tighter scope (e.g. smaller chunks / different region settings).
- **Pros**
  - Fast iteration, debuggable in dev, lower friction for content experiments.
- **Cons**
  - Base64+JSON overhead; binary becomes attractive as snapshot volume grows.
- **Alternatives**
  - Binary framing (flatbuffers/protobuf/custom) for chunk snapshots/deltas (less overhead, more tooling).

### 0.4 Sequencing, idempotency, throttling, and replay safety

- **Default**
  - Per-player `seq` for all intent-bearing messages (movement + interactions + edits).
  - Server accept window: `[lastAccepted+1, lastAccepted+128]` (tunable).
  - Duplicates: idempotent (re-ACK), never apply twice.
  - Throttling: do not “temporal dedupe” user commands; instead:
    - allow **client-side coalescing** of high-rate movement intents only,
    - never coalesce/drop interaction intents (doors, attacks, tile edits),
    - enforce server-side rate limits with explicit `REJECT` reasons.
  - Responses:
    - `ACK(seq, ...)` for accepted intents
    - `REJECT(seq, reason, ...)` for invalid/rate-limited/unauthorized
    - `CORRECTION(seq, authoritativeState, ...)` when prediction diverges
- **Pros**
  - Avoids the “click does nothing” class of bugs caused by naive dedupe.
  - Cleanly separates “duplicate” vs “invalid” vs “rate-limited”.
- **Cons**
  - Requires per-player seq state and some bookkeeping.
- **Alternatives**
  - Temporal command dedupe (simpler; risks dropping legit commands and causing desyncy UX).
  - Lockstep/shared simulation merge (complex and a cheat surface; not recommended for MMO authority).

### 0.5 AOI (interest) defaults

- **Default**
  - Chunk AOI subscribe radius: **3 chunks** (7×7) around current chunk (tunable).
  - Recompute subscriptions on chunk boundary crossings; opportunistic resync on version gaps.
  - Hard caps per client for subscribed chunks and replicated entities; degrade by priority/LOD.
- **Pros**
  - Predictable bandwidth and CPU; server remains in control under load.
- **Cons**
  - Requires careful priority rules to avoid “important thing disappeared” bugs.

### 0.6 Door/portal traversal defaults (authoritative)

- **Default**
  - Trigger: both stepping onto door tiles and explicit “interact door” intents (click/tap).
  - Teleport policy:
    - clear queued movement
    - clear combat target (explicit)
    - apply short traversal cooldown (**250ms**) to prevent oscillation loops
- **Pros**
  - Supports keyboard movement and click-to-enter/exit consistently.
  - Cooldown prevents oscillation exploits and accidental re-entry loops.
- **Cons**
  - Requires careful UX to avoid “I clicked but nothing happened” (always ACK/REJECT).

### 0.7 Time + weather defaults

- **Default**
  - Shard clock: authoritative time (seconds + day index).
  - Zone ambient: weather + time band derived from shard clock + scheduler jobs.
  - Replication: broadcast ambient on change (and low-frequency keepalive, e.g. 1Hz).
- **Pros**
  - Simple for social gameplay and events; easy to reason about.
- **Cons**
  - Some players expect “personal time” (single-player vibe); we can simulate via time bands.

### 0.8 Instances and future domains

- **Default**
  - IDs include `instanceKey` now; v1 uses `"shared"` everywhere.
  - Shared mines are default; instancing is additive later.
- **Pros**
  - Keeps shard identity simple while preserving a migration path.

### 0.9 Shared simulator core + offline play

- **Default**
  - Share **pure logic and data** across client/server (combat formulas, item tables, interaction kind IDs, encoding helpers).
  - Keep **stateful simulation** authoritative on the server; clients run prediction only where it buys UX (movement).
  - Offline play runs the same server sim in-process (local-host or embedded), not a separate client-authoritative universe.
- **Pros**
  - Reuse without turning MMO into a distributed merge system.
  - Offline stays “real game” without creating upload/merge pressure.
- **Cons**
  - Offline and MMO saves should be treated as separate domains (no uploading offline saves into shards without strict rules).

### 0.10 Capacity planning baseline (VPS-first, ~2000 CCU target)

This is intentionally rough: it’s meant to produce *actionable caps* and highlight which knobs control cost. Treat the numbers as a starting hypothesis, then validate with `bots:soak` and real gameplay telemetry.

**Assumptions**

- Server tick: ~30 Hz for fast systems, tiered for the rest.
- Chunk size: 32×32, AOI radius: 3 chunks (49 chunks/player).
- Players are usually spread across zones; worst-case “all in one place” should degrade gracefully via caps/priority.

**Memory budgets (rules of thumb)**

- **Overlay memory per loaded chunk (server)**:
  - values: `chunkSize² * 4B` (Uint32Array)
  - present: `chunkSize² * 1B` (Uint8Array)
  - pending-delta mask: `chunkSize² * 1B` (Uint8Array)
  - For 32×32: `1024 * (4+1+1) ≈ 6 KiB` + JS/Map overhead ⇒ plan **~8–12 KiB/chunk**.
- **Client chunk cache** is similar (values+present only) ⇒ plan **~5–8 KiB/chunk**.
  - With 49 chunks/player, that’s **~250–400 KiB/player** just for chunk overlays (client-side).
- **Immediate caps to enforce** (so a single hotspot can’t OOM the shard):
  - max loaded chunks per zone (LRU/evict on pressure)
  - max subscribed chunks per client (already a protocol-level concept)
  - max entities replicated per client (priority-based)

**Bandwidth budgets (AOI-driven)**

- **Movement/combat**: treat as “hot path”; budget and prioritize it above world-state cosmetics.
- **Chunks**:
  - Snapshot cost is proportional to `overrides.length` (sparse is cheap; dense farm chunks can be expensive).
  - Hard caps (already in code): snapshot payload target **64KB**; decompressed cap **512KB**.
  - Budget policy:
    - if snapshot cannot fit even after compression: split into `CHUNK_SNAPSHOT_PART` frames (bounded per tick per player), then mark the chunk “known” only after the final part is sent.
    - deltas must stay bounded (cap changes per delta; split if needed).
  - Operator knobs (server config):
    - `chunk_snapshot_payload_max_utf8_bytes` (default `65536`)
    - `chunk_snapshot_max_parts` (default `128`)
- **Pragmatic starter budgets** (tune with soak results):
  - per-client outbound average: **< 20 KiB/s**
  - per-client inbound average: **< 10 KiB/s**
  - shard aggregate outbound (2000 players): **< ~40 MiB/s** sustained (this is already “large VPS” territory; the real goal is to keep typical play far below this via AOI overlap and caps).

**Persistence growth + IO (current implementation notes)**

- Current chunk overlay persistence stores dense `values_blob` + `present_blob` per chunk (uncompressed):
  - bytes per chunk ≈ `chunkSize² * (4+1)` ⇒ for 32×32: `1024 * 5 = 5120B` ≈ **5 KiB/chunk** + SQLite overhead.
  - rough DB size: `modifiedChunks * ~5 KiB` (e.g. 10k modified chunks ≈ ~50MB).
- Flush policy knobs (already configurable):
  - `chunk_overlay_flush_interval_ms` (default 10s)
  - `chunk_overlay_flush_max_chunks` (default 64)
  - `chunk_overlay_bootstrap_load_limit_chunks` (default 4096)
- Starter guidance:
  - keep flush work bounded per interval (avoid blocking sim)
  - if dirty backlog grows faster than flush rate: increase `flush_max_chunks`, reduce interval, or implement coalescing/compression sooner
  - plan periodic VACUUM/maintenance windows only if DB bloat shows up (WAL mode can grow temporarily)

---

## 0) Glossary

- **Shard**: an independent world. No cross-shard state sync. (This is our chosen model.)
- **Region**: a content domain (overworld, desert, mine, etc.). Versioned content.
- **Zone**: a runtime simulation instance of a region (shared zone = one instance; instanced zone = many).
- **Chunk**: a fixed tile rectangle (e.g. 32×32 or 64×64) used as the unit of persistence + streaming.
- **Overlay**: persisted player-modified state layered on top of region content.
- **Intent**: client→server request (“try move step”, “try till tile”, “try place building”).
- **Outcome**: server-authenticated result (“tile changed”, “item spawned”, “damage applied”).
- **AOI / Interest**: which entities/chunks a client should receive based on proximity/visibility rules.

---

## 1) Non-negotiable design principles

### 1.1 Single-writer authority (avoid merge/conflict by construction)

In multiplayer:

- The **server is the only authority** that can mutate world state.
- The client never sends “results” (teleport, damage, item spawn, crop growth). It sends **intents**.
- Each piece of persistent state has exactly one writer:
  - within a shard: the server
  - within the server: one zone owns a chunk at a time

This avoids the “client + server both simulate then agree/disagree” trap that turns into a distributed merge system and a cheat surface.

### 1.2 Tiered simulation rates (30 Hz only where it matters)

Do not “tick the whole world” at 30 Hz. Split systems into:

- **Fast (30 Hz)**: movement, combat, collisions, short-lived effects, nearby interactions
- **Medium (1–5 Hz)**: aggro decay, NPC local behaviors, ambient events
- **Slow (time-boundary)**: crops, watering evaporation, weather transitions, resource respawns

### 1.3 Content vs state: expansions without breaking saves

Split the world into:

- **World content** (versioned, mostly static): base map, door graph, biome, spawn tables
- **World state** (persistent overlays): what players changed, stored per chunk

Expansions should be additive by default (new regions/chunk ranges), with explicit migration tooling only when editing existing claimable space.

---

## 1.4 Stable core + feature modules (so we stop touching “core” for every feature)

Goal: new interactions, effects, items, crops, mobs, quests, buildings, and ambient systems should be implemented as **additive modules** (new code + new data), not invasive edits to the simulation kernel.

This requires the kernel to expose a small number of stable extension points:

- **Intent handlers**: validate + apply an intent into world state, producing outcomes.
- **Outcome producers**: world mutations emit outcomes; replication sends outcomes to clients.
- **Interaction kinds**: data-driven identifiers that map content (tiles/entities) to behavior modules.
- **Effect kinds**: damage over time, buffs, debuffs, movement modifiers, VFX hooks.
- **Persistence adapters**: modules can declare what persistent records they own, but the kernel controls flush scheduling and IO budgets.
- **Scheduler jobs**: modules register periodic/at-time job kinds without adding per-tick scanning.

### 1.4.1 Layering boundaries (dependency direction)

Recommended layering to keep coupling low:

1. **`shared/` (contracts)**: IDs, protocol shapes, math, serialization helpers, canonical enum/string IDs.
2. **`server/core/` (kernel)**:
   - zone lifecycle + tick loop
   - intent sequencing/idempotency
   - AOI + replication envelopes
   - chunk overlay store + persistence flush scheduler
   - scheduler/time-wheel plumbing
3. **`server/features/*` (modules)**:
   - doors/portals, farming, building placement, combat effects, mobs, mining, fishing, quests, guilds
4. **`client/core/` (prediction + UI glue)**: input, prediction buffers, reconciliation, rendering interfaces.
5. **`client/features/*` (modules)**: visual/UI behavior that mirrors server feature modules; unknown feature IDs degrade gracefully.

Rule: core depends only on contracts; features depend on core + contracts; features do not depend on each other directly (use registries/interfaces).

### 1.4.2 Module registry and dependency graph (static, not “plugin loading”)

We do not need dynamic runtime plugin loading. We need a **compile-time registry** so new features are added by:

- creating a module file in `server/features/<feature>/`
- exporting a small manifest
- registering it in one central list (or build-time glob)

Module manifest shape (conceptual):

- `id`: stable string (namespaced, e.g. `core.doors`, `farm.crops`)
- `deps`: list of module ids (rare; prefer none)
- `register(registry)`: add intent handlers, job kinds, interaction kinds, effect kinds, persistence tables/blobs

The registry does:

- checks for duplicate IDs
- topologically sorts by deps
- exposes stable query APIs for dispatch (by intent type id / interaction kind id / effect kind id)

### 1.4.3 Namespaced IDs everywhere (expandability without migrations)

To avoid “add new enum value in core” churn:

- All extensible kinds use stable namespaced string IDs:
  - `interactionKindId`: `core.door`, `farm.till`, `mine.ladder`, `build.place`, `quest.board`
  - `effectKindId`: `combat.poison`, `combat.stun`, `food.buff.speed`
  - `intentTypeId`: `move.step`, `interact.tile`, `edit.tile`, `combat.attack`
  - `outcomeTypeId`: `teleport`, `tile.patch`, `damage`, `spawn.item`, `quest.progress`

The core only needs to understand:

- the envelope (seq, routing, AOI)
- the registry lookup by `*KindId` / `*TypeId`
- generic persistence flush and scheduler plumbing

### 1.4.4 Cross-module protocol: stable envelopes + forward compatibility

Protocol should be stable at the envelope level:

- `INTENT` messages contain `{ seq, intentTypeId, payload }`
- `OUTCOME` replication contains `{ outcomeTypeId, payload }` and/or typed opcodes for hot paths

Forward compatibility:

- client ignores unknown `outcomeTypeId` (but still applies core state like position corrections)
- server rejects unknown `intentTypeId` with a clear reason
- capability negotiation on connect can communicate supported feature IDs + protocol revision

### 1.4.5 Data-driven interactions (tiles/entities carry kind IDs)

Content (Tiled map, prefab metadata) references interaction kind IDs:

- tile metadata: `interactionKindId = "core.door"` + params `{ destination: ... }`
- entities/prefabs: `interactionKindId = "mine.ladder"` + params

This keeps “new mechanic” work mostly in:

- adding a module handler for the new kind id
- adding content entries that reference the kind id

No kernel edits needed unless we’re adding a new *extension point* (rare).

---

## 2) World model: Regions → Zones → Chunks

### 2.1 Regions (content)

A region is identified by a stable `RegionId` and has:

- a base tile map + metadata (collisions, doors, spawn points, biome rules)
- an optional **content revision** (`regionRevision`) when base content changes

Guideline: avoid in-place edits inside claimable areas; prefer additive expansions and “new land”.

### 2.2 Zones (runtime simulation)

A zone is a runtime instance:

- `ZoneId = { shardId, regionId, instanceKey }`
  - shared zones: `instanceKey = "shared"`
  - instanced zones later: `instanceKey = partyId | dungeonInstanceId | playerId | guildId | ...`

The server runs a zone’s **fast sim** loop only while it has active players (or pending scheduled jobs).

### 2.2.1 Zone ambient state (time bands, weather, seasons)

Each zone maintains a small “ambient state” record that is replicated to clients:

- `timeBandId` (zone-specific time offset/rate policy)
- `weatherId` + parameters (rain intensity, storm, fog)
- `seasonId` (if applicable)

The server is authoritative for ambient state transitions. Clients can smoothly interpolate visuals/audio between states.

### 2.3 Chunks (persistence + streaming)

Chunks are the unit of:

- persistent storage (overlay)
- network streaming (snapshots + diffs)
- caching and hibernation
- permission/claim indexing (can be chunk-indexed)

Chunk size should be chosen to balance:

- snapshot size (bigger chunks = fewer messages)
- edit locality (smaller chunks = less waste)

Pragmatic default: 32×32 for dense edits (farms/buildings), 64×64 for sparse areas.

---

## 3) Persistence model (players build/till/plant/water/mine)

### 3.1 Base content is immutable per revision

Persist only **overlays**:

- soil state
- crop state
- placed objects/buildings
- resource nodes (ore/tree)
- claims/permissions
- quest/event progress (global + per-player)

### 3.2 Chunk overlay format (sparse + compact)

Do not store a row per tile in a relational DB for the entire world. Store a compact overlay per chunk:

- `modifiedMask` (bitset) or sparse list of modified tile indices
- per-layer compact arrays (struct-of-arrays)
- `chunkVersion` (monotonic) for replication

Example overlay layers (illustrative, not exhaustive):

- `soil`: untilled/tilled, moisture, fertilizerId, lastWateredDay
- `crop`: cropId, plantedDay, growthStage, health, qualitySeed
- `object`: placedObjectId, orientation, state flags
- `building`: buildingId, footprint occupancy mask, owner/claim reference
- `resource`: node type, depletedUntilDay, rngSeed

### 3.2.1 Overlay encoding and compression (pragmatic)

Start with a representation that’s easy to evolve:

- `ChunkOverlay` is a binary blob with a versioned header:
  - `overlaySchemaVersion`
  - `regionRevisionBase`
  - `chunkVersion`
  - layer presence flags
- Each layer is either:
  - dense (fixed-length arrays) when most tiles are modified, or
  - sparse (index + value arrays) when modifications are rare

Compression:

- Transport: apply a fast compressor (zstd/brotli) to chunk snapshots/deltas.
- Storage: compress per-chunk blobs; keep small metadata (versions, timestamps) separate for indexing.

### 3.2.2 Chunk deltas

Chunk diffs should be:

- **bounded** (cap diff size per tick; split if needed)
- **versioned** (`fromVersion → toVersion`)
- **resyncable**: if a client misses versions, it requests a snapshot rather than replaying a long diff chain

### 3.3 Indices and access patterns

You will need fast reads/writes for:

- “load visible chunks for player”
- “apply edits to a handful of tiles”
- “scan scheduled jobs for chunk”

Maintain:

- in-memory LRU cache of hot chunks per zone
- persistent store keyed by `(shardId, regionId, regionRevision, chunkCoord)`
- optional secondary index for claims by chunk coordinate

### 3.3.1 Storage backend choices (staged)

Stage 1 (dev / single-machine shard):

- SQLite for player profiles + small global tables
- Chunk overlay blobs stored as:
  - SQLite blobs (acceptable initially), or
  - files on disk keyed by `(regionId, revision, cx, cy)` (fast and simple)

Durability posture for a single VPS:

- prefer “lose last N seconds of world edits” over “risk DB corruption”
- achieve this via application-level batching + periodic flush, not by turning SQLite `synchronous` fully off

Stage 2 (production multi-machine):

- PostgreSQL for metadata (players, claims, guilds, quest states, chunk headers)
- Chunk blobs in:
  - Postgres `bytea`/large objects (simpler ops, OK until very large), or
  - object storage (S3/R2) with strong key naming (better long-term scaling)

### 3.3.2 Draft persistence tables (per shard)

Keep shards independent by using a separate DB per shard (or a `shard_id` column if co-hosting physically).

Minimum viable schema (illustrative):

- `players`
  - `player_id` (PK)
  - `name_key` (unique)
  - `display_name`
  - `created_at`, `updated_at`
- `player_profiles`
  - equipment, cosmetics, stats, checkpoint, etc.
- `player_sessions`
  - active connection/session bookkeeping (enforce one active session per name)
- `guilds`, `guild_members`
  - `guild_id` (PK)
  - `player_id` + role
- `parties`, `party_members`
- `claims`
  - `claim_id` (PK)
  - `owner_type` (player/guild), `owner_id`
  - `region_id`, `region_revision`
  - geometry (start with rects): `x0,y0,x1,y1`
  - `acl_policy_id` (or inline ACL rules)
  - indexes: by `(region_id, region_revision)` plus spatial bucketing (chunk coord or coarse grid)
- `chunk_headers`
  - `(region_id, region_revision, cx, cy)` (PK)
  - `chunk_version`
  - `updated_at`
  - optional: `etag`, `compressed_size`
- `chunk_blobs`
  - `(region_id, region_revision, cx, cy, chunk_version)` (PK)
  - `blob` (compressed overlay)
  - optional retention policy (keep last N versions for debugging)
- `global_state_kv`
  - `(key)` (PK)
  - `version`, `value_blob`
- `zone_state`
  - `(zone_id)` (PK)
  - ambient (time band, weather), instance metadata

Notes:

- Keep chunk writes coalesced: writing every tiny edit as a new version can explode IO; batch and checkpoint.
- If you later need auditing/crash recovery for chunk edits, add an append-only log, but do not start there.

### 3.3.3 VPS bootstrap durability tiers (what must survive power loss)

On a single VPS, define explicit durability tiers so we can be aggressive where it’s safe:

- **Tier 0 (must not corrupt / should persist):**
  - player identities + session claims
  - player inventory/equipment/currencies
  - guild membership/roles
  - claim definitions + ACLs
- **Tier 1 (should persist, small loss OK):**
  - quest progress
  - global event toggles
  - mine depletion/respawn timers
- **Tier 2 (loss OK, recoverable):**
  - last seconds/minutes of crop moisture, growth timers, ambient effects
  - “dirty chunk” state not yet flushed

Implementation guidance (starter):

- SQLite (Tier 0/1):
  - use WAL mode
  - `synchronous=NORMAL` (or `FULL` if you want maximum safety, slower)
  - keep transactions small and explicit
- Chunk overlays (Tier 1/2):
  - keep hot chunks in memory
  - flush dirty chunks periodically (e.g. every 5–30s, configurable)
  - write snapshots atomically (write temp file → fsync/close → rename)
  - on restart, accept that unflushed edits are lost

Concrete SQLite knobs (starter, single VPS):

- `PRAGMA journal_mode = WAL;`
- `PRAGMA synchronous = NORMAL;` (trade-off: integrity preserved, last transactions may be lost on power outage)
- `PRAGMA temp_store = MEMORY;`
- `PRAGMA busy_timeout = 5000;`
- choose one of:
  - (simpler) one writer path (serialize DB writes on the server loop)
  - (better) a dedicated persistence queue/worker to avoid blocking the sim loop

Filesystem layout (starter):

- `server/.data/shards/<shardId>/`
  - `players.sqlite` (Tier 0/1)
  - `chunks/<regionId>/<revision>/<cx_shard>/<cy_shard>/<cx>_<cy>.bin` (Tier 1/2 overlays)
  - `snapshots/` (optional periodic backups)

Chunk flush policy (starter):

- flush cadence: every 5–30 seconds (configurable)
- flush triggers:
  - cadence timer
  - zone hibernate
  - server shutdown (best-effort)
  - memory pressure (eviction)
- per flush:
  - write new chunk blob with incremented `chunk_version`
  - update `chunk_headers` metadata (or adjacent file header) last
  - cap write amplification: coalesce multiple edits into one version per interval

### 3.4 Scheduled jobs (don’t tick tiles at 30 Hz)

Use a scheduler/time-wheel keyed by `(zoneId, chunkCoord)` for slow systems:

- crop growth / decay
- respawns
- weather transitions
- mine node regeneration

Only load chunks into memory when:

- a player is nearby, or
- a scheduled job is due

### 3.5 Global state (quests, world events, economy knobs)

Some state is not naturally chunk-local:

- global quests and world events
- global weather/season policy (even if zones differ)
- economy knobs (drop rates, event multipliers)

Treat this as a small authoritative store per shard with:

- explicit versioning
- broadcast deltas (low frequency)
- deterministic seeding for “daily” rotations (shop stock, fish spawns) per shard

---

## 4) Permissions model: claims, parties, guilds

### 4.1 Claims

Introduce claim objects:

- geometry: rect/polygon (prefer rects for simplicity first)
- owner: playerId / guildId
- ACL: role rules (owner, party, guild roles, friends list, public)

### 4.1.1 Permission primitives

Define a small set of permission checks used everywhere:

- `canEnterZone(player, zone)`
- `canEditTile(player, tilePos, actionType)`
- `canPlaceBuilding(player, footprint)`
- `canUseObject(player, objectId)` (doors, chests, machines)

Back these by:

- claim ownership
- party membership
- guild membership + roles
- explicit allowlists (friends / custom ACL entries)

### 4.2 Parties and guilds (gameplay-facing contracts)

Parties (small) and guilds (large) should provide:

- membership + roles
- permission presets for claims (“guild farm”, “party house”)
- chat channels + invites (not part of sim-core)

### 4.3 Server-side enforcement

Every world-edit intent must be validated server-side:

- within claim? if yes, does ACL allow this action?
- if no claim, is this a public edit area?

Clients may show “ghost previews” but cannot commit edits without server acceptance.

---

## 5) World evolution (expansions, edits, migrations)

### 5.1 Additive expansions (recommended default)

- Add new regions or new chunk ranges within a region.
- Keep old content stable; overlays remain valid forever.

### 5.2 In-place edits (requires policy)

If base content changes in an existing region:

- bump `regionRevision`
- define a migration policy per changed area:
  - **forbid edits** in claimable space (best), or
  - migrate overlays using deterministic transforms, or
  - invalidate overlays (refund items) with explicit patch notes

Never silently change collision/layout under player-built structures.

---

## 6) Netcode model (server authoritative, client predictive)

### 6.1 Intents vs outcomes

Client→server:

- movement: adjacent step intents
- interaction: “try” actions (till, plant, water, harvest, open, place, attack intent)
- social: chat, party invite, guild actions

Server→client:

- authoritative state changes: entity spawn/despawn/move, damage, item drops, tile updates, quest progress

### 6.2 Sequencing and idempotency

Add a per-player monotonic `seq`:

- the server processes intents in seq order
- duplicates (same seq) are idempotent
- old seq values are ignored

This is required to avoid “position-as-ack” ambiguity and to make retries safe.

### 6.3 Acks, rejects, and corrections

For intents that the client predicts (especially movement):

- `ACK(seq)` when accepted/applied
- `REJECT(seq, reason)` when denied
- `CORRECTION(seq, x, y, serverTick)` when client prediction diverged

The client uses these to reconcile smoothly.

### 6.4 Concrete message flows (movement, interact, build)

Movement (adjacent steps, predicted):

- Client:
  - predicts local step immediately (for responsiveness)
  - sends `MOVE_STEP(seq, x, y)` at most once per step (coalesce to latest intent if input is noisy)
- Server:
  - validates: adjacency, collision, zoning/doors, cooldown, stun/dead states
  - on accept:
    - applies authoritative position on tick boundary
    - emits `ACK(seq)` (optional but recommended) and the authoritative `MOVE` replication
  - on reject:
    - emits `REJECT(seq, reason)` + `CORRECTION(seq, x, y, tick)` (or a single correction message)
- Client:
  - if `ACK(seq)`: marks that predicted step as confirmed (no snapping)
  - if `CORRECTION`: smoothly reconcile (snap if far; otherwise blend)

Interact/build (not predicted as state, only predicted as UI):

- Client:
  - shows ghost/preview, plays “start” animation optimistically
  - sends `INTERACT(seq, kind, target...)` / `PLACE(seq, ...)`
- Server:
  - validates permissions, inventory, adjacency/range, cooldowns
  - applies outcomes (tile diffs, item consumption, entity spawns)
  - emits authoritative deltas/events (tile change, inventory change, spawn)
- Client:
  - updates UI based on deltas; if rejected, reverts ghost and shows reason

### 6.5 Replication rates

Keep server simulation at 30 Hz, but do not broadcast everything at 30 Hz:

- local player: immediate ack/correct path (small messages)
- remote entities: 10–15 Hz movement updates + interpolation (smoother and cheaper)
- tiles/chunks: event-driven diffs; snapshots on entry/resync

Rule of thumb targets (per player, steady state, not worst-case):

- entities: ~0.5–3 KB/s (AOI dependent)
- chunk diffs: ~0–5 KB/s (depends on “busy farm” vs wilderness)
- bursts on zone entry: chunk snapshots + entity spawns (chunked batching required)

### 6.6 Interest management (AOI)

Maintain two AOI streams:

- **entity AOI**: players/mobs/items/chests
- **chunk AOI**: tile overlays, buildings, claims

Chunk AOI is typically a radius around the player or a camera window (plus some prefetch margin).

### 6.7 RNG and “fairness” (loot, fishing, quality rolls)

Use server-controlled RNG for any outcome that matters:

- loot drops and quality
- crop quality rolls (if any)
- fishing rewards

To keep things debuggable:

- seed RNG from `(shardId, zoneId, dayIndex[, chunkCoord])` plus a server-held secret salt
- log the minimal inputs needed to reproduce outcomes in tests

---

## 7) Server runtime topology (per shard)

### 7.1 Process model

For ~2000 concurrent players, plan for a per-shard runtime that can scale across CPU cores:

- **Shard gateway** (WebSocket front door):
  - authenticates and routes per-connection traffic to the correct zone worker
  - applies backpressure and rate limits
- **Zone workers** (single-threaded simulation loops):
  - each worker owns one or more zones
  - each zone is single-writer for its chunks and ECS entity set
- **Persistence service** (can be embedded initially):
  - chunk overlay load/save
  - player profile/inventory persistence
  - quest/global state persistence

A practical staged approach:

1) single process per shard (simplest) with zones as in-memory objects
2) then split into a gateway + N worker processes/threads for zones

### 7.2 Zone assignment and migration

When a player crosses a zone boundary:

- gateway switches the connection’s upstream to the new zone worker
- the new zone streams required entities/chunks
- the old zone can hibernate if empty

Avoid “entity migration mid-tick” by only transferring ownership on tick boundaries.

### 7.3 Backpressure, rate limiting, and abuse controls

At the gateway:

- cap inbound intent rate per connection (e.g. movement steps per second)
- drop or coalesce duplicate intents (seq makes idempotency safe)
- protect expensive operations (chunk snapshot requests) with quotas

---

## 7.4 Performance budgets (30 Hz, 2000 players/shard)

### 7.4.1 Tick-time budget

At 30 Hz, the wall-clock frame budget is ~33.3ms/tick. In practice:

- target p50 tick time: <5–8ms
- target p95 tick time: <15ms
- hard ceiling: never exceed 33ms for sustained periods (or the sim “falls behind”)

Avoid one giant zone. Use many zones so the busiest zone worker is bounded.

Implementation note: our ECS scheduler already supports hooks (`server/ecs/scheduler.ts`). Use this to:

- record per-system elapsed times
- set budgets for high-risk systems
- emit structured events when budgets are exceeded

### 7.4.2 Zone-worker partitioning targets

These are starting targets (adjust after load tests):

- keep “busy” zones (towns, shared mines) under ~150–400 concurrent players per zone
- prefer 4–16 zone workers per shard (depending on CPU) rather than a single event-loop

If a zone exceeds its budget:

- shrink AOI (entity and/or chunk)
- reduce remote movement replication rate
- split the region into multiple zones (seams) or introduce instances for hotspots

### 7.4.3 Network budget roughing

The key control knobs:

- remote move rate (10–15 Hz)
- AOI size (#entities and #chunks)
- chunk diff batch size and max delta per tick

Rule of thumb: keep steady-state outbound under ~5–15 KB/s per player on average.

When players enter a dense zone, expect bursts. Always chunk and cap:

- max actions per batch (already present in transport chunking patterns)
- max bytes per tick per connection (backpressure)

---

## 7.5 Memory plan (single VPS starter)

Goal: keep the server stable under load and predictable under GC pressure.

### 7.5.1 Explicit caps (configure early)

- per-connection outbound queue cap (bytes and/or message count)
- per-zone “hot chunk” cache cap (bytes and/or chunk count)
- per-zone “dirty chunk” cap (if exceeded, force flush or throttle edits)

Starter sizing heuristics (tune with bots/metrics):

- outbound queue cap: start with 256KB–1MB per connection (hard drop/close if exceeded)
- hot chunk cache: start with 128–512 chunks per busy zone (or ~64–512MB), whichever comes first
- dirty chunk cap: start with 25–200 chunks per zone; if exceeded, flush more frequently or throttle edit intents

### 7.5.2 What lives in memory

- ECS entity state for active zones (players/mobs/items)
- interest tracking sets per active player
- chunk overlay cache for nearby/hot chunks
- scheduled jobs for active zones and due jobs for sleeping zones

### 7.5.3 Eviction and hibernation

- Evict least-recently-used chunks first (after flushing if dirty).
- Hibernate zones with no players:
  - flush dirty chunks
  - drop ECS entities not needed for persistence
  - keep only lightweight schedule metadata to wake on due jobs

### 7.5.4 Data structure guidance (to avoid memory blowups)

- prefer compact arrays/typed arrays for chunk overlays over `Map<string, ...>` per tile
- bound and chunk outgoing queues (already aligned with our existing transport batching approach)
- avoid per-tile string keys in hot paths; use integer indices within a chunk

### 7.5.5 Ops checklist (single VPS)

Track and alert on:

- tick duration p50/p95 by zone worker and by system
- RSS/heap usage and GC pause times
- outbound bytes/sec and queue drops
- chunk cache hit rate and chunk flush latency

If memory grows without bound:

- reduce chunk AOI radius and prefetch margin
- reduce hot chunk cache caps and ensure eviction flush is working
- reduce remote movement replication rate
- verify interest tracking sets are cleared on disconnect

---

## 8) Protocol evolution (fits our opcode-array protocol)

Current protocol is numeric opcode arrays with a manifest/schema. Evolve it in a compatible way:

### 8.1 New messages (v2)

Add opcodes (names illustrative):

- C2S:
  - `MOVE_STEP(seq, x, y)` (adjacent; replaces ambiguous MOVE eventually)
  - `INTERACT(seq, kind, target...)`
  - `PLACE(seq, blueprintId, x, y, rotation)`
  - `CHUNK_SUBSCRIBE(regionId, cx, cy, radius)`
- S2C:
  - `ACK(seq)`
  - `REJECT(seq, code)`
  - `CORRECTION(seq, x, y, tick)`
  - `TIME_SYNC(serverTick, day, minute, zoneTimeBandId)`
  - `CHUNK_SNAPSHOT(regionId, cx, cy, version, payloadCompressed)`
  - `CHUNK_DELTA(regionId, cx, cy, fromVersion, toVersion, payloadCompressed)`

### 8.2 Backward compatibility

For a transition period:

- accept legacy `MOVE` as step-intent (server already treats it as adjacent)
- ignore/deny legacy result-like messages (notably C2S `TELEPORT`)
- keep legacy S2C messages while clients migrate, then consolidate

### 8.3 Protocol payload efficiency (JSON now, binary later)

Our current wire format is JSON arrays. This is fine early, but at ~2000 concurrent players it becomes a real cost.

Pragmatic approach:

1) Keep opcodes + manifest/schema validation (good ergonomics and safety).
2) For chunk snapshots/deltas, ship `payloadCompressed` as:
   - base64 string in JSON initially (simple but overhead), then
   - switch to WebSocket binary frames (ArrayBuffer) once stable.
3) Consider a binary codec later that still preserves the manifest layer:
   - opcode byte + varint args
   - typed blob messages for chunk overlays

### 8.4 Sequence numbers: scope and storage

Define `seq` as a per-player monotonic counter stored:

- on client: increment per intent emission
- on server: last accepted seq per player (persist optionally for reconnect safety)

Server processing rules:

- if `seq <= lastSeq`: ignore (duplicate or replay)
- if `seq > lastSeq + window`: optionally reject (client jumped; likely bug/desync)
- update `lastSeq` only when the intent is accepted for application

---

## 9) ECS boundaries: what belongs in ECS vs chunk store

### 9.1 ECS for dynamic entities and fast systems

Use ECS for:

- players, mobs, items, projectiles/effects
- movement queues, combat state machines, aggro, interest tracking, outbox

### 9.2 Chunk store for tile-scale state

Do not represent every tile as an ECS entity in an MMO shard; it will be too heavy.

Instead:

- chunk overlays live in a dedicated store (in-memory + persistent)
- ECS systems operate on chunks via:
  - “tile intent application” systems (validate + mutate overlays)
  - “chunk dirty diff” systems (emit CHUNK_DELTA to outbox)
  - “scheduled jobs” systems (advance crops/respawns when due)

---

## 10) Shared mines now, instances later

### 10.1 Shared mines

Treat mines as a shared zone per shard initially:

- one `ZoneId(shard, mineRegion, "shared")`
- mine node overlays stored in chunks (depletion/respawn)
- mine mobs as normal ECS entities with spawn tables

### 10.2 Instancing later (without rewriting the world)

Instances are created by choosing a different `instanceKey`:

- party dungeons
- guild halls
- housing interiors

Persistence choices per instance:

- ephemeral (discard on exit)
- persistent (store overlays keyed by instanceKey)

---

## 11) Offline mode (and why it stays separate)

Offline works by running the same sim-core + persistence locally:

- local zone loop
- local chunk store
- same intent/outcome flow, just in-process

Do **not** plan on uploading offline saves into MMO shards unless you’re willing to accept:

- cheating/forged resources
- complex merge/migration tooling

Treat offline as its own save domain.

---

## 12) Observability and invariants (to prevent sync bugs)

Track per shard/zone:

- invalid intent rate (moves rejected, permission denied)
- correction rate (how often clients diverge)
- average outstanding seq window (client prediction depth)
- outgoing bytes per player per second (entities vs chunks)
- chunk cache hit rate and load latency

Invariants worth unit-testing:

- movement: server never applies non-adjacent steps
- teleport: server never accepts arbitrary client teleports
- tile edits: server applies edits only if permission allows
- chunk versions: deltas apply cleanly; snapshot heals gaps

---

## 13) Rollout tickets (dependency-ordered)

### Ticket A (P0): Remove/lock down client→server TELEPORT

- Scope: disallow arbitrary C2S teleport; reserve teleport for server-issued outcomes (doors/GM tools only).
- Acceptance: cannot move to arbitrary tiles by sending TELEPORT.
- Verification: unit test + Playwright “attempt teleport” harness.

### Ticket B (P0): Server-side door/portal traversal

- Scope: door traversal becomes a server outcome; client sends an intent (step or interact).
- Acceptance: entering/exiting buildings always works; no client-side teleport authority.
- Verification: Playwright door suite.

### Ticket C (P1): Sequenced intents + ACK/REJECT/CORRECTION

- Scope: add `seq` for movement and critical interactions; client reconciliation uses seq.
- Acceptance: retries are safe; repeated positions don’t confuse ack matching.
- Verification: unit tests around reconciliation; jitter simulation.

### Ticket D (P1): Chunk overlay store + CHUNK_SNAPSHOT/DELTA streaming

- Scope: implement persistent overlay per chunk; stream snapshots/diffs via AOI.
- Acceptance: farms/buildings sync across players; chunk diffs are bounded and resyncable.
- Verification: multi-client test editing same area + reconnect/resync.

### Ticket E (P2): Claims + permission enforcement

- Scope: claim objects + ACL; server validates all edit intents.
- Acceptance: unauthorized edits rejected; UI shows denied reason.
- Verification: unit tests + Playwright.

### Ticket F (P2): Tiered sim scheduler for crops/respawns/weather

- Scope: move slow systems to scheduled jobs; zones hibernate when empty.
- Acceptance: no 30 Hz scanning of tiles; state advances correctly.
- Verification: deterministic time-advance tests.

### 13.1 Verification strategy (always-on regression net)

Add/maintain these layers:

- **Unit tests**: intent validation, permission checks, overlay mutation, versioning, reconciliation logic.
- **Deterministic sim tests**: advance ticks/days and assert outcomes for crops/respawns/quests.
- **Multi-client integration tests**: two or more simulated clients editing the same area + reconnect/resync.
- **Browser tests** (Playwright): critical player journeys (move, fight, build, farm, mine, claim).

### 13.2 Load and soak testing plan (per shard)

Before raising concurrency targets:

- build a headless client bot that:
  - connects, wanders, farms, fights, mines
  - exercises chunk streaming and permissions
- measure:
  - tick time percentiles per zone worker
  - outbound bytes/player
  - correction/reject rates
  - chunk cache hit rates and persistence latency

Set an initial hard guardrail:

- if the shard cannot keep tick time under budget (e.g. <10–15ms at 30 Hz in the busiest zone worker), reduce AOI/replication rate or split zones across more workers before increasing player caps.

---

## 14) Implementation mapping (to current BrowserQuest code)

This section ties the plan to the existing code layout so we can execute incrementally without a rewrite.

### 14.1 Protocol surface (shared)

Where to implement protocol changes:

- `shared/protocol/manifest.ts`: add new opcodes + schemas
- `shared/protocol/types.ts`: extend action unions with new message tuple types
- `shared/protocol/schema.ts`: validation for new message shapes
- `shared/protocol/registry.ts`: decoding/encoding stays centralized

Guideline: keep the manifest/schema as the “single source of truth” for protocol evolution.

### 14.2 Server inbound command boundary

Current authoritative entry point is the server ECS command pipeline:

- `server/world/ecs-command-pipeline.ts`: applies inbound commands and runs sim stages
- `server/ecs/commands.ts`: command union (add `seq`, new intents)

Planned changes:

- lock down C2S `TELEPORT` (reject/ignore except server-authorized traversal)
- add `seq` handling for movement + interactions (store last accepted seq per player)
- move door/portal traversal to server outcomes (tile/door lookup + server teleport action)

### 14.3 Interest and replication

Current interest replication:

- `server/world/ecs-command-pipeline.ts:#replicateInterest` uses map “groups” + adjacent groups
- `server/ecs/interest-tracker.ts` tracks enter/leave per observer

Planned extensions:

- keep group-based AOI for entities initially (cheap and already wired)
- optionally move to radius-based AOI later using the existing spatial index primitive (`server/ecs/spatial-index.ts`)
- add a second AOI stream for chunks (chunk subscribe radius or camera window)
- extend the outbox model (`server/ecs/outbox.ts`) to carry chunk snapshot/delta messages

### 14.4 Server transport and batching

Current batching:

- `server/world/transport.ts` chunks outgoing queues to avoid huge JSON stringify stalls

Planned improvements:

- add a per-connection “bytes per tick” cap (backpressure)
- treat chunk snapshots as “large payloads” with dedicated limits

### 14.5 Persistence

Current persistence:

- `server/player-persistence.ts`: SQLite player profiles + achievements (good pattern for shard-local persistence)

Planned additions:

- add a chunk overlay persistence module (new):
  - suggested location: `server/world/chunks/` or `server/world/chunk-store.ts`
  - key: `(regionId, regionRevision, cx, cy)`
  - values: header metadata + compressed blob
- add claims persistence (new):
  - suggested location: `server/world/claims/` or `server/world/claims-store.ts`

### 14.6 Client input, prediction, reconciliation

Current client boundaries:

- `client/gameclient.ts`: WebSocket IO + inbound action handlers; updates kernel
- `client/ecs/world-kernel.ts`: authoritative client kernel state + replication bookkeeping
- `client/ecs/systems/*`: intent, command apply, replication sync, simulation

Planned changes:

- add `seq` to outbound intents (client maintains monotonic counter)
- reconcile local prediction using `ACK/CORRECTION` instead of “position-as-ack”
- add chunk subscription requests based on camera/player AOI
- apply chunk snapshots/deltas into a client-side chunk overlay cache (separate from entity kernel)

### 14.7 Shared sim-core extraction (optional, staged)

Do not block progress on a full extraction. Stage it:

1) Make server systems deterministic (seeded RNG, tick-driven) and move shared rules into `shared/` modules.
2) Extract “tile rules” (till/plant/water/harvest/build placement) into `shared/sim-core/tiles`.
3) Later extract additional rules (combat tables, crafting) as needed.

---

## 15) Open decisions (need answers before coding)

- Chunk size (32 vs 64) and AOI radius for chunk streaming.
- World tile dimensions per region (overworld size, mine size).
- Claim geometry: start with rects only, or allow polygons.
- Time model: global per shard with zone bands (recommended), or per-zone clocks.
- Weather: per-zone deterministic seed + override events.
