# RollerCoaster Tycoon 2 — 3D Rigs

Real-time **three.js** models of RCT2 assets, hand-built to match the original
isometric sprites (their 4 rotations are the modelling reference), plus a
functional layer for composing whole parks. True 3D: orbit, day/night light,
animate. **Start with `SETUP.md` (design-system root)** — the end-to-end
manual (Stage api, day/night, GameManager wiring, UI windows + clickability,
catalogs, validators, determinism); `rules/park-generation.md` is the park
recipe book — its §0 pre-flight checklist (static arithmetic, footprint
table, canonical imports) is mandatory before any park ships, and every
validator/probe warning is FATAL.

## Architecture
- **Stage** — the shared viewport (renderer, orbit camera, sun + soft shadows,
  optional ground, built-in day/night toggle) + geometry helpers
  `box` / `cyl` / `ball` / `mat` with procedural textures (wood, metal, asphalt,
  leaf, fabric, concrete, grass, plastic, sand). Every rig is
  `<Stage build={(THREE, group) => { ... return (time) => {...} }} />`.
- **Shared builders — always reuse, never re-invent:**
  - `buildPeep` (Guest) — THE guest. Every rider, walker, queuer and crowd
    member in every component uses it (skin tones, outfits, expressions,
    `walk(time, phase)`, seated pose). Never build a bespoke figure.
  - `buildWater` (WaterTile) — THE water. Lakes, ponds, rapids channels
    (RiverRapids, PaddleBoats, TerrainKit all use it). Never a flat blue disc.
  - `buildCoasterCar` (CoasterCar) — the train car (2 peeps, headlamp
    PointLight). All coaster trains use it.
  - `buildTerrain` (TerrainKit) `heightAt(x, z)` — ground truth for placement;
    `buildRock`/`buildRockCluster`, `tree` (Kit), `buildStringLights` +
    `buildLightPole`, `buildPathNetwork`/`attachWalkers`/`buildCrowd`.

## Component priority (avoid duplicates)
- **Coasters: `SplineCoaster` is the PRIMARY system** — freeform spline rails
  (parallel-transport frames, curvature banking, chain lift, energy-paced
  trains, ground supports; `wood: true` for the wooden look). Use `TrackKit` /
  `CoasterBuilder` only when RCT2-style grid pieces with circuit-closure rules
  are the point. **`WoodenCoaster` is deprecated** (alias of SplineCoaster).
- **All TRACKED rides compose via `buildRideSpline` (SplineRideKit)** — one
  control-point workflow, profiles `coaster | flume | bobsled | rapids |
  gokart` (LogFlume and Bobsleigh are built on it). Every spline is checked by
  `validateSpline` (self-intersections warn and must be re-authored) and
  coasters also run `checkCoasterDesign` — RCT2's per-type construction rules
  (slope/bank whitelists, bank-rate limit, station flat). Guarded profiles
  carry RCT2 crash physics: 1.5 g no-upstop derailment, `setBrakesFailure`
  station collisions, ballistic explode-on-impact; the handle exposes
  `crashed()` / `forceCrash()` / `resetCrash()`.
- **Every ride in a park is RIDEABLE: `createGameManager` (GameManager)** runs
  the OpenRCT2 vehicle status cycle and RCT2 guest logic: given the SAME
  `{nodes, edges}` object the PathNetwork rendered, guests walk ONLY on the
  path graph (GuestPathfinding-style wander + goal seeking), queue with the
  tick-true misery curve, pay, ride, buy from `registerStall` stalls, drop
  litter or use `bins`, and leave when worn out — mood is posture, never an
  overhead orb. It builds queue lanes + `buildRideEntrance` huts per
  `registerRide` (place them on pad edges adjacent to the platform), and a
  tracked ride's `vehicleHandle.crashed()` flips the sim ride to 'crashed'.
  Every generated park registers its rides, stalls and bins with ONE manager.
- **Paths: `buildPathNetwork` for any connected layout** (square junction pads
  + 4-way crosswalks, lamps at junctions, bins at dead ends). Single tiles:
  `NormalPath` / `DirtPath` / `QueuePath` (one-guest-wide). **`Road` is
  deprecated** (alias of NormalPath).
- **Whole parks: the AGENT composes them — there is NO park generator.**
  `rules/park-generation.md` is the recipe book (climate → composed terrain →
  entrance → lattice paths → themed lands → GameManager → `validatePark`).
  `ParkBuilder` ships the composition UTILITIES: `parkComposition` with 4
  CLIMATES (`temperate | desert | alpine | coastal`, hashed from the seed;
  ONE flood-filled water body, clustered back hills, climate
  sand/species/palette, flat entrance apron — probed against YOUR layout
  guards), `tintTerrainForClimate`, placement helpers (`terrainLint`,
  `planRideAccess`, `bermNetToGround`/`plinthUnder`/`groundRideAccess`) and
  the **`validatePark`** acceptance gate (accessibility, terrain vibe,
  footprint SAT sweep, coaster legality + crash-free margin, 60 sim-s
  GameManager smoke run, mesh budget + determinism hash) — every composed
  park MUST pass it before it "opens"; do the §0 pre-flight arithmetic
  (rules/park-generation.md) FIRST so it passes on the first run. The
  ParkBuilder preview
  (`buildExamplePark`) is the hand-composed worked example. Park previews
  hold the camera still (no auto-rotate) and are CLICKABLE: rides open
  RideViewer, guests open a live GuestInfo, ParkInfo sits bottom-right
  (rules/ui.md).

## Conventions
1. Model from the matching RCT2 sprite (all 4 rotations) for silhouette and
   part breakdown; **realistic colours** — muted brick red, forest green, navy,
   cream, silver, grey-brown wood — never remap orange/pink plastic.
2. World units: 1 unit ≈ one tile edge; a guest is ~1.1 tall (scale 0.5 when
   seated in vehicles). Anchor bases at y = 0; settle to terrain `heightAt`
   when terrain exists.
3. Animate what the ride animates; every vehicle carries an emissive headlight
   plus a real `PointLight` so night mode works. **Lights stay OFF until dark**:
   gate every PointLight/emissive by `nightKOf(group)` (Stage writes the
   day→night factor to the build group each frame; `gateCarLights` does it for
   coaster cars). Daytime = intensity 0 with a faint glass tint.
4. Deterministic only — hashed-sine PRNGs, never `Math.random`/`Date.now`.
