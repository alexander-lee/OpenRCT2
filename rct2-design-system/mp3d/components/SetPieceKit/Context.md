# SetPieceKit

**CANONICAL IMPORT — copy exactly:** `import { buildParkNet } from './components/SetPieceKit';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The **PORTS + FOOTPRINT contract** every MACRO SET-PIECE speaks. A set-piece (`<FountainPlaza>`, `<Bazaar>`, `<Boulevard>`, …) bundles several primitives, their interior paths, their stalls and their GameManager registrations into ONE correct-by-construction unit. This folder holds only the contract and the shared dressing language — **each set-piece is its own component folder.**

## Why it exists

Agent-composed parks kept failing on WIRING arithmetic, not on art: street nets that were pure trees with spurs dead-ending in grass, queue tails outside the plot or stranded in a coaster circuit, stalls off the traffic flow, rides 3-8 units off the path lattice. Those defects all come from hand-computing interior geometry at JSX-authoring time. The kit removes the arithmetic instead of detecting its failures.

## The contract — PLAN FIRST, MOUNT SECOND

1. **A pure planner returns the whole piece as data, before anything mounts.**

   ```tsx
   const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 12], ports: ['N', 'E', 'W'] });
   ```

   Every plan (`SetPiecePlan`) carries:
   - `ports` — **a FIXED set per piece** (`<FountainPlaza>`: `N`/`E`/`S`/`W`; `<Bazaar>`: `W`/`E` ONLY, both on the aisle axis; `<Boulevard>`: `A`/`B`, its two termini). The names are LOCAL, not compass — a bazaar rotated `Math.PI / 2` has its `'W'` port facing NORTH. Read the direction as data (`plan.portDir('W')`, and on a bazaar `plan.portNames` / `plan.portDirs` / `plan.aisleAxis`) or let `bazaarPlan({ facing: { port, toward } })` pick the rotation for you — named connector cells in **world** coords, already lattice-snapped, each one lattice cell **OUTSIDE** the piece footprint (so a street or a ride's queue lane can meet a port without ever overlapping the piece). `plan.port('W')` / `plan.portDir('W')`.
   - `nodes` / `edges` — the piece's **interior path sub-net** in world coords, cardinal and on the 1.2 lattice. It becomes part of the park's ONE shared graph, so guests really walk it and queue tails may land on it.
   - `plazas` / `bins` — the paving rects and bin spots `<Paths>` renders (bins get their manager registration for free).
   - `cells` — every cell the piece paves or places on, for `<Terrain keepDry>`.
   - `footprint` — ONE `ParkFootRect` OBB covering the piece, for validatePark's footprint sweep + the coaster-corridor SAT sweep.
   - `reserve` — whether the component registers that OBB (land-owning pieces: yes; street-like pieces: no).
   - `theme` — the `WorldTheme` the piece is dressed for (`DEFAULT_THEME` when none was passed; see **The theme layer** below). Its fingerprint is part of `key`.
   - `toWorld(local)` / `toWorldYaw(localYaw)` / `key`.

   Because the plan exists **before** mount, the composing agent lays its street skeleton, its keepDry list and its ride queue tails AROUND the piece — the whole class of defects that used to surface only at settle time.

2. **`buildParkNet` fuses the streets.**

   ```tsx
   const NET = buildParkNet({
     nodes: MY_STREET_NODES,          // optional — indices are PRESERVED
     edges: [[0, 1], ['hub:E', 'east:A']],   // endpoints: your index, or 'pieceId:PORT'
     pieces: [HUB, MARKET, GATE_AVE, EAST_MIDWAY],
     keepDry: [...RIDE_CELLS],
   });
   <Terrain keepDry={NET.keepDry} />
   <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
   ```

   Guarantees, by construction:
   - **your** node indices survive (piece nodes are appended), so a `queueTailNode={7}` you computed against your own list keeps meaning node 7;
   - everything snapped to the lattice, no duplicate cells, no duplicate/degenerate edges — so `<Paths>`' own `snapNetToGrid` is a **no-op** and indices stay stable;
   - every long edge is **SPLIT** at any node lying on it (a crossing without a junction is a routing dead end guests can never turn at);
   - **unconnected port stubs are PRUNED** (a dangling port IS the "spur dead-ending in open grass" defect). Structural chain ends — a boulevard's two termini — are marked `prunable: false` and never dropped;
   - a lint pass reports diagonal edges and disconnected islands (`NET.warnings`, also `console.warn`ed) — **and since wave 9 every entry is ALSO recorded as a §0-FATAL `netWarnings` plan lint, so `validatePark` cannot return `ok` over one.** rules §3.1 always called these fatal; round 8 shipped two diagonal street edges anyway, because a console warning reaches nobody.

   Lookups: `NET.node([x, z])` → index of a world cell, `NET.port('hub:E')` → index of a port, `NET.pruned`.

### PLAN BUILDERS DEGRADE — THEY NEVER THROW (wave-9 P0-A)

Plans and `buildParkNet` are evaluated at **module scope**, before React mounts anything. A `throw` there is not a local failure: it takes the entire page, so there is no park, no `validatePark` line and nothing to diagnose. Both round-8 parks died that way — one diagonal `boulevardPlan` each, score 3.5/100, eight identical blank frames.

So every plan-time error path now **degrades, records a `reportPlanLint` entry and carries on** (`components/ParkBuilder/planLints.ts`). `<Park>` replays the bus into `validatePark` one frame after mount, where §0's FATAL-WARNINGS POLICY turns the fatal ones into hard `autofix` failures:

| situation | old | now |
|---|---|---|
| `boulevardPlan` endpoints not axis-aligned | `throw` | L-ROUTE through a corner cell (both legs cardinal, both ends still connected) + FATAL `boulevardDiagonal`; a ≤ 2-cell offset is named as the mistyped coordinate it usually is |
| `boulevardPlan` shorter than 3 cells | `throw` | built as-is + FATAL `boulevardTooShort` |
| `plan.port('N')` on a piece without one | `throw` | falls back to the piece's first real port + FATAL `unknownPort`, printing the port list it DOES have |
| `buildParkNet` edge to an unknown `'id:PORT'` | `throw` | the edge is DROPPED + FATAL `unknownPort` |
| `buildParkNet` edge to a non-existent node index | `throw` | the edge is DROPPED + FATAL `badEdgeEndpoint` |
| `NET.node([x, z])` with no node on that cell | `throw` | the NEAREST node index + FATAL `noNodeOnCell` (with the distance) |
| `bazaarPlan` under 3 stalls / `fountainPlazaPlan` tiles out of range | `console.info` | same clamp + a non-fatal lint that reaches the report |

**A plan lint means the park that rendered is not the park you designed.** Fix the coordinate; never accept the degraded shape.

3. **The component takes the plan and nothing else.**

   ```tsx
   <FountainPlaza plan={HUB} />
   ```

   Ports, footprint, keepDry cells, stall anchors and the mounted visual therefore all derive from the SAME numbers — they cannot disagree. Declare set-pieces **after `<Paths>`** (their dressing settles onto the paving through `park.floorAt`).

## The THEME LAYER — one set-piece, any WORLD

A set-piece describes **structure**: where the paving, the ports, the sub-net, the lamp stations and the prop slots are. A `WorldTheme` describes the **dress** those slots wear. It is a thin, purely additive layer: `theme` is optional on every planner and every shared builder, and it defaults to `DEFAULT_THEME`, whose values ARE the consts the pieces used to bake in — so omitting it is a **no-op** (verified: identical plan data and identical scene geometry/materials for every existing preview and for DistrictPark).

```tsx
import { bazaarPlan } from './components/Bazaar';
import { EMBERFALL_CALDERA } from './components/SetPieceKit';

const MARKET = bazaarPlan({ id: 'market', position: [-16.8, 12], theme: EMBERFALL_CALDERA });
```

### What a WorldTheme carries

```ts
interface WorldTheme {
  id: string;                 // stable id (labels + the remount fingerprint)
  title: string;
  palette: WorldPalette;      // every colour a piece used to hard-code
  planting: WorldPlanting;    // which catalog species this world plants
  lamp: LampCharacter;        // 'warm' | 'cold' | 'flame'
  ridePreset: RidePresetType; // ColorKit family for rides placed in the world
  seedOffset: number;         // added to every piece seed
}
```

- **`palette`** — `pavingLight` / `pavingDark` (the plaza's two accent greys), `canopyPrimary` / `canopySecondary` (awning field + edge courses/hem), `bunting` / `buntingAccent` (pennants 3 and 4), `cable` (rope/wire), `iron` (lamp posts, cages, finials), `lampGlass`, `lampGlow`, and `spanBulbs: number[]` (festival bulb colours; a piece wanting only two takes the **first and the last**, which is exactly the boulevard's historic pair).
- **`planting`** — `trees: { shape, weight }[]` (the world's allée species; `pickTreeShape(theme, h)` walks the weights with the piece's existing hashed-sine roll), `planters: string[]` (verge slot, rolled with `pickSpecies`), `flanker` (cheeks either side of an open entrance), `hedge` (the low mass on a closed side), `monument` (what closes a portless side), `markers: [string, string]` (a bazaar's two verge markers). Names are `Kit.tree` shapes and `SceneryPack` piece names — validated against the catalog.
- **`lamp`** — the lantern's character. Only the emissive curve and the PointLight change; the lamp **geometry is identical in every world**, and night gating is still `nightKOf` exactly as before. `LAMP_CHARACTER` holds the curves: `warm` reproduces today's numbers exactly (`0.1 + 1.55·ease·flicker`, 3 % flicker at 5.3 rad/s, intensity 0.9, range 5.2), `cold` is a near-steady gas/neon light, `flame` breathes hard (17 % flicker at 11.7 rad/s) on a shorter range.
- **`ridePreset`** — a *hint*, not a mount: pass it to `rideColourPreset(seed, theme.ridePreset)` (components/ColorKit) when you place a ride in that world.
- **`seedOffset`** — added to a piece's own seed (`themedSeed`), so the same planner dressed for two worlds never repeats the same seeded variation. `DEFAULT_THEME`'s offset is 0.

A theme is **data only**. It never changes geometry, so a themed piece keeps the default piece's nodes, cells, footprint and validatePark verdict — only its materials and its planted species differ.

### The five worlds (plus the default)

| preset | world | palette | lamp | planting | ride hint |
|---|---|---|---|---|---|
| `DEFAULT_THEME` | Classic Park | today's concrete greys, cream/red canvas, navy + gold pennants, iron | `warm` | pine/round/willow allée, topiary + planter boxes, marble statue, signpost + flagpole | `steel` |
| `EMBERFALL_CALDERA` | Emberfall Caldera (volcanic) | basalt paving, ember canvas, oxblood courses, obsidian iron | `flame` | charred pines, cactus + fallen logs, lion statue | `steel` |
| `TIDEWATER_HOLLOW` | Tidewater Hollow (shipwreck cove) | bleached sand, sailcloth + brine green, tarred rope | `warm` | palms + willows, driftwood, wishing well | `water` |
| `BRASSWORK_FOUNDRY` | Brasswork Foundry (steampunk) | soot flag paving, oiled canvas, brass/copper trim | `warm` | clipped municipal planting, brick wall course, park clock | `steel` |
| `THORNWICK_GLADE` | Thornwick Glade (enchanted forest) | mossy stone, deep-green canvas, faerie glass | `cold` | willows, toadstool clusters, birdbath shrine | `wooden` |
| `PULSE_DISTRICT` | Pulse District (disco) | black-glass paving, magenta + cyan canvas, chrome cable | `cold` | uplit palms, TV-monitor post marker | `kart` |

`WORLD_THEMES` maps id → theme (`WORLD_THEMES.emberfall`).

## WORLDS — the level ABOVE a set-piece (`worldPlan` / `<World>`)

`rules/park-generation-composition.md` §3 composes a park **worlds-first**: pick ≥ 3 presets, build each one out as a self-contained district, then connect them. `worldPlan` is the planner for that level, and it obeys the same PLAN-FIRST contract — pure, returns before anything mounts.

```tsx
const QUARTER = bazaarPlan({ id: 'quarter', position: [33.6, 15.6], theme: PULSE_DISTRICT, stalls: ['soda', 'cottonCandy'], seed: 7 });
const PULSE = worldPlan({
  id: 'pulse',                       // what crossTheme findings + probe.worlds name
  theme: PULSE_DISTRICT,             // a world IS its theme (DEFAULT_THEME is a FATAL lint here)
  pieces: [QUARTER],
  include: [[33.6, 26.4], [27.6, 26.4]],  // the hand-placed ride pad + scenery cells
});
const NET = buildParkNet({ nodes: [GATE], edges: [[0, 'hub:N']], pieces: [HUB, AVE], worlds: [PULSE, …] });
// after <Paths>:
<World plan={PULSE} /> <Bazaar plan={QUARTER} /> <Bassline … /> <MirrorBallPylon … />
```

> **THE FIVE LAND MACROS ARE GONE (v6.0).** `emberfallCalderaPlan`,
> `tidewaterHollowPlan`, `brassworkFoundryPlan`, `thornwickGladePlan` and
> `pulseDistrictPlan` — and the `<EmberfallCaldera>` … `<PulseDistrict>`
> components that went with them — were removed from the design system.
> Importing any of them breaks the whole bundle. **`worldPlan`, `<World>`,
> `WorldTheme` and all five PRESETS are unaffected**, and every world's own
> rides, stall and scenery survive: you now assemble a district from a themed
> structural set-piece (`bazaarPlan`/`fountainPlazaPlan` take `theme`) plus that
> world's themed rides/stall/scenery, and list every hand-placed cell in
> `include` so the region covers them. See
> `rules/park-generation-composition.md` §3 for the per-world content table.

`worldPlan` is deliberately THIN — it COMPOSES member plans into one named place:

| field | what it is |
|---|---|
| `region` / `centre` / `half` / `bounds` | the world's rect — the union of every member piece's `extent` (or `footprint`) + `include` cells + `margin` (default 2.4). **Never registered for the OBB sweep**: it CONTAINS pieces that reserve their own land and rides that register their own pads/huts/lanes |
| `ports` | every member piece's port as a `buildParkNet` ref (`'quarter:S'`) |
| `gateway(toward)` / `gatewayCell(toward)` | **how worlds are connected.** The port nearest `toward` that actually faces it (a port pointing away pays a ×1.75 penalty rather than being excluded, so a one-port world still answers). Ask from the ELBOW CELL the avenue leaves from, not from the hub, and you get the port on the approach axis |
| `rideSlots` / `stallSlots` | the attractions and shop spots the member plans already published (duck-typed off `plan.rides` / `plan.stalls` / `plan.stallSlot`) |
| `cells` | every cell the world paves or places on — `<Terrain keepDry>` |
| `pieces` | pass whole worlds to `buildParkNet({ worlds })` and their pieces join the shared graph (deduped against `pieces`) |
| `contains(at)` | is this cell in the world? |

`<World plan={W} />` builds **no geometry** — it calls `park.registerWorld(W.region)` so the gate and the eval probe can see the world. Skip it and the park has no worlds as far as any check is concerned. `<Worlds plans={[A, B, C]} />` declares several.

### THEME COHERENCE — a themed piece belongs to its OWN world

The theme layer used to be a palette handed to a set-piece, with nothing able to notice a lava fissure dressed into the disco street. That is now MECHANICAL, and it lives in `components/ParkBuilder/worlds.ts` (there, not here, because both `Park/parkRoot` and `ParkBuilder/validate` need it and SetPieceKit imports `../Park`):

- **`COMPONENT_THEME`** — the machine-readable theme tag: 47 catalog components mapped to their world by displayName (`LavaFissure` → `emberfall`, `MirrorBallPylon` → `pulse` — each world's own ride/stall/scenery pack; the five land macros were dropped from the table in v6.0 along with the components themselves). **Anything absent is NEUTRAL and legal in every world** — benches, bins, paths, generic trees, `SceneryPack`, `Torch`, every stock flat ride, and `DanceFloor`/`NeonSign`/`BalloonStand` (the rulebook uses those as generic boardwalk flavour).
- **The component tag** — `composable` / `composableRide` / `composableStall` / `setPiece` all stamp `userData.dsComponent` + `dsClass` via `Park/composable.tsx: tagComponent`. `setPiece` also stamps `dsWorldTheme = plan.theme.id`, which is how a STRUCTURAL piece is classified: an un-dressed `<Bazaar>` is neutral, an Emberfall-dressed one inside the Pulse District is a finding.
- **`auditWorldThemes(root, worlds)`** — `<Park>` runs it at settle time, stores it on the store (`_worldAudit`, read by the eval probe as `probe.worlds`) and hands it to `validatePark`, which raises one **`crossTheme` WARNING** per offending piece. A warning, not a failure: the park still opens and the rubric charges it once (axis 16, −0.5 each). `worldIdReused` and `worldUnthemed` ARE fatal — they make the audit meaningless rather than reporting a bad placement.
- A themed piece OUTSIDE every declared world is reported (`themedPieceOutsideWorlds`) and **not charged** — a caldera's flume legitimately sprawls past the rect you drew.

### Writing a themed set-piece

1. Take `theme?: WorldTheme` in your plan input and resolve it once: `const theme = themeOf(input.theme)`.
2. Offset your seed: `const seed = themedSeed(theme, input.seed ?? 1)`.
3. Pass `theme` to `makeSetPiecePlan`. It stores it on the plan (`plan.theme`) **and folds `themeKey(theme)` into the same remount `key` your `keyData` feeds** — `key` is what `setPiece` deps on, so re-dressing a piece for another world really rebuilds it instead of leaving the old palette on screen. The fingerprint hashes the whole theme (palette, planting, lamp, preset, offset), not just its `id`, so an inline theme variant also remounts.
4. Resolve species in the PLANNER (`theme.planting.*`, `pickSpecies`, `pickTreeShape`) so the plan still describes the piece completely; resolve colours in the BUILD from `plan.theme.palette`.
5. Pass `theme: plan.theme` to `setPieceLamp` (ironwork + glass + glow + character) and take span bulbs from `plan.theme.palette.spanBulbs` (or pass `theme` to `setPieceSpan` and let it default).
6. Keep geometry theme-independent. If a world needs a different *shape*, that is a structural switch on the planner input, not a theme.

## Exports

- `fountainPlazaPlan` / `bazaarPlan` / `boulevardPlan` live in their OWN component folders (`components/FountainPlaza`, `components/Bazaar`, `components/Boulevard`).
- `buildParkNet(input) → ParkNetResult` — the street fuser above.
- `makeSetPiecePlan(spec) → SetPiecePlan` — the shared half of a plan (local sub-net + ports + plazas + footprint → world). **Write a new set-piece by calling this**, then extend the result with your own resolved dressing anchors.
- `setPiece(displayName, build) → React.FC<SetPieceProps<P>>` — the component factory. The build runs in WORLD coordinates (the group mounts at the origin) so each item can settle on its own surface; inside a real `<Park>` it registers `plan.footprint` unless `reserve: false`, which also pulls the terrain guard clamp (AUTO-keepDry) under the piece so it can never sit in water or on a bulge.
- Dressing language shared by the whole family: `setPieceLamp` (iron post + night-gated lantern + optional PointLight + a `hook` for spans; takes `theme`), `setPieceSpan` (bulb-capped festival span between two REAL hooks; takes `colors` or a `theme`), `setPieceBench`, `yawToward`.
- Theme layer: `WorldTheme` / `WorldPalette` / `WorldPlanting` / `LampCharacter` types, `DEFAULT_THEME` (= today's consts) and the five world presets `EMBERFALL_CALDERA`, `TIDEWATER_HOLLOW`, `BRASSWORK_FOUNDRY`, `THORNWICK_GLADE`, `PULSE_DISTRICT`, `WORLD_THEMES`, `LAMP_CHARACTER`, plus the helpers `themeOf`, `themeKey`, `themedSeed`, `pickSpecies`, `pickTreeShape`.
- World layer: `worldPlan(input) → WorldPlan`, `<World plan>`, `<Worlds plans>`, the `WorldPlanInput` / `WorldRideSlot` / `WorldStallSlot` types, and `buildParkNet({ worlds })`. The machine-readable half (`COMPONENT_THEME`, `themeOfComponent`, `isNeutralComponent`, `componentsOfWorld`, `WorldRegionRec`, `worldAt`, `auditWorldThemes`) is exported from **`components/ParkBuilder`**.
- Lattice helpers: `CELL` (1.2), `snapCell`, `snapXZ`, `quarterTurns`, `quantYaw`, `rotateXZ`, `hash01`.
- Preview staging: `setPiecePaving(plans, opts)` → a `<ScenePreview dress={…}>` callback that renders the paving a real park's `<Paths>` would render (port stubs included). `buildPortMarkers` / `<PortMarkers plans>` → the debug overlay (gold port posts + arrows, red footprint corners).

## Rules for a new set-piece

- Rotations are quantized to quarter turns and local offsets are lattice multiples, so rotated coordinates stay EXACT (no float drift into off-grid nodes).
- A port is always one cell outside the footprint; a piece that owns land reserves its OBB, a piece that is a street does not (a reserved street would "overlap" every queue lane that legitimately tails onto it).
- Interior traffic must route AROUND obstacles (the plaza's ring, not a cross through the fountain), so every port can reach every other port.
- Register everything: stalls through the catalog stall components (`register`, unique names), bins through `plan.bins`, the footprint through `setPiece`.
- Deterministic only — hashed sine (`hash01`), never `Math.random` / `Date.now`.

## `theme.furniture` — the COMMON props, themed (2026-07)

A theme dressed what a LAND builds but not what the PARK builds through it. `WorldFurniture` (declared in `PathNetwork/surfaces` — a leaf module, so `PathNetwork/build.ts` can read it without the `SetPieceKit → PathNetwork → Park → SetPieceKit` cycle) adds thirteen tokens for the shared furniture:

| tokens | used by |
|---|---|
| `benchFrame` `benchSlat` | verge BENCHES |
| `binBody` `binLid` | LITTER BINS |
| `lampPost` `lantern` `lanternGlow` | LAMP POSTS + their night gate |
| `basin` `water` `spray` | FOUNTAINS |
| `stallCanopy` `stallTrim` `stallPost` | market stalls / BAZAARS |

`furniture` is **optional** and resolves token-by-token through `furnitureOf(theme)`, so a theme may override just the two colours it cares about; every default is the exact constant its builder previously baked in, making an unthemed park byte-identical. All five shipped worlds now declare one — Emberfall's charred iron with lava lanterns and a molten basin, Pulse's black steel with magenta neon over cyan water, Tidewater's verdigris and driftwood, Brasswork's riveted brass, Thornwick's mossed iron with a cold witch-light.

Applied automatically over a region by `<Park>`'s `<ThemeRegion>` — see Park/Context.md.

## Theme ids are GENRES, not place names (renamed 2026-07)

The five themes were originally named after invented places — *Emberfall Caldera, Tidewater Hollow, Brasswork Foundry, Thornwick Glade, Pulse District*. That is the wrong surface to hand a generator. A proper noun invites it to invent matching lore (an "Emberfall Ashworks", a backstory, place names for every stall) instead of just picking the LOOK it wants, and it has to remember which made-up name means "volcanic". The canonical ids are now plain genres:

| id | const | was |
|---|---|---|
| `fire` | `FIRE` | Emberfall Caldera |
| `steampunk` | `STEAMPUNK` | Brasswork Foundry |
| `pirateBeach` | `PIRATE_BEACH` | Tidewater Hollow |
| `enchantedForest` | `ENCHANTED_FOREST` | Thornwick Glade |
| `neon` | `NEON_CITY` | Pulse District |
| `default` | `DEFAULT_THEME` | (unchanged — the no-op) |

`THEME_IDS` is the canonical list in a stable order; pick from it. **Nothing broke:** `WORLD_THEMES` still answers to all five legacy ids, and the old exported consts remain as `@deprecated` aliases, so every park and preview that already names a world keeps building.

Naming a WORLD in a park is still yours — `<ThemeRegion>` takes an `id` prop, so a "Cinder Bay" district can be dressed `theme="fire"`. The theme says what it looks like; the name is the park's business.

## The STRUCTURAL theme layer — `SetPieceKit/dress.ts` (2026-07)

`WorldTheme` on its own is data (palette, species, lamp curve, seed offset), and data alone makes a themed piece the default piece in different paint. That was measurable, not a matter of taste: `harness/mp3d-render/probe-setpiece-theme.mjs` hashed the `enchantedForest` and `neon` plazas to the **same geometry fingerprint as `default`**, because those two themes plant the same SceneryPack species in every slot.

`dressOf(theme)` (`SetPieceKit/dress.ts` → `dressShared.ts` + one module per world) adds the missing half. Each of the five shipped worlds supplies its own:

| slot | what varies |
| --- | --- |
| `lamp` | a different OBJECT, not a recolour — basalt brazier (open bowl, no cage) / leaning ship's mast with a yard and an off-centre hanging lantern / 3.15 u gaslight standard with a hexagonal head and a ladder-bar / forked branch carrying two globes at two heights / neon totem with a halo ring |
| `bench` | stone slab on block piers / planks on beached casks / iron scroll frame / felled log on sawn stumps / lit cantilever slab |
| `span` | and crucially whether it **sags**: chain with hanging fire pots, signal-flag bunting, a RIGID pipe truss, a deep vine swag, a rigid lit bar. Two of the five are straight, which is the difference an ortho elevation shows most plainly |
| `kerb` | the avenue's edge run, one merged mesh per verge: broken basalt with ember slits / deck boards with pilings and rope swags / one unbroken iron channel with a brass handrail / mossy boulders and arching roots / a continuous black channel with a light reveal |
| `paving` | the plaza floor: 12 radiating ash spokes with glowing cracks / plank decking with a rope coil / four riveted plates with a brass compass rose / a 3.2-turn flagstone spiral / concentric light rings on a chequer |
| `parapet` | the plaza rim, broken at every open port: basalt blocks / pilings + rope / iron railing / boulders + hedge / lit bollards |
| `centrepiece` | a four-legged armature straddling the fountain, ~3 u tall — the single biggest silhouette difference between two plazas |
| `landmark` | a real prop from THAT world's own scenery component (`basaltColumns`, `dockPilings`, `giantGear`, `giantToadstools`, `speakerStack`), dropped into a prop slot the pure planner already vetted |

Three properties hold, and each is pinned by a probe that has been made to fail on purpose:

1. **`dressOf` returns `null` for `DEFAULT_THEME` and for any unrecognised id.** The un-themed piece never enters a themed branch, so "identical with no theme" is a property of the control flow. Pinned by `probe-setpiece-theme.mjs --baseline=…`, whose baseline is recorded from the reconstructed pre-theme components `mutate-setpiece.mjs` writes (HEAD is not a valid "before" while the work is uncommitted).
2. **No plan fields were added.** Everything is derived at MOUNT time from `plan.theme` plus anchors the planner already published, so ports, sub-net, footprint, keepDry cells, `solids` and `key` are identical for EVERY theme — pinned for all 12 piece x theme rows.
3. **Theming these pieces REDUCES draw calls.** Every themed part is batched (`mergedBoxes` / `mergedParts`), and the themed lamp (3-4 meshes) and bench (1-2) come in under the default iron lamp (9) and Kit bench they replace. No theme is above the default on either piece.

Nothing floats: `probe-setpiece-attach.mjs` splits every mesh into CONNECTED COMPONENTS first (a merged batch would otherwise hide a detached island), then resolves each airborne part by exact point-to-triangle distance with a ray-parity inside test. It found five real defects while this was being written — a mast running down through the fountain basin, a gear ring orbiting a hub 0.16 too small for it, a gauge on a diagonal with no arch under it, four foliage clumps on a bare ring, and a mirror ball hung off a frame with no member at its axis.
