# Boulevard

**CANONICAL IMPORT — copy exactly:** `import { Boulevard, boulevardPlan } from './components/Boulevard';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A MACRO SET-PIECE (contract: components/SetPieceKit/Context.md) for the **long walk between districts** — the piece that makes the default size-128 plot read as EXPANSIVE instead of huddled. A straight carriageway between TWO ports, dressed at regular stations with lamp pairs, night-gated string-light spans across the avenue, a street-tree allée, benches and planters.

## Use

```tsx
import { Boulevard, boulevardPlan } from './components/Boulevard';

const AVE = boulevardPlan({ id: 'ave', from: HUB.port('W'), to: MARKET.port('E'), spacing: 3.6 });
const NET = buildParkNet({ pieces: [HUB, MARKET, AVE] });   // shared port cells MERGE
…
<Boulevard plan={AVE} />        {/* AFTER <Paths> */}
```

Because the avenue's two end nodes ARE its neighbours' port cells, `buildParkNet` merges them and the three pieces come out as one connected street net — no index arithmetic, no dangling stub. A gate can stand on a terminus: `boulevardPlan({ from: [0, 22.8], to: HUB.port('N') })` + a bare `<Gate />`.

## Geometry (world; `from`/`to` should share an x or a z — a diagonal DEGRADES, it no longer throws)

```
port A ·──o──────o──────o──────o──────o──────o──· port B    nodes every 1.2 (CELL)
       T  L  b   L      L  p   L      L  b   L              L = lamp pair, ±1.35
          ·      ·      ·      ·      ·      ·              b = bench, p = planter, ±1.7
       T     tree pair     tree pair     tree pair          T = trees, ±2.45
```

- **Stations** every `spacing` (rounded to the lattice) carry a lamp PAIR; spans cross the avenue on every OTHER pair; **tree pairs** face each other at the half-stations — a deliberate allée, never scattered planting.
- Every anchor is ≥ 1.35 u off the centreline, clear of the 1.1-wide slab and its kerbs, so a ride's queue lane can still tail onto any node.
- `avoid` cells (planned queue lanes, exit huts, ride pads, other pieces) are skipped within `clear` (default 1.3) — dressing can never collide with the wiring the composition solves separately.

### NON-AXIS-ALIGNED ENDPOINTS: THE L-ROUTE (wave-9 P0-A)

This planner used to `throw` on a diagonal, **at module scope**, which is where a park's plans live — so one bad avenue rendered the entire page BLACK. It killed both round-8 parks (`from [0,68.4] → to [4.8,50.4]` and `from [-26.4,86.4] → to [-27.6,68.4]`: 3.5/100, eight blank frames, `validatePark` never reached).

It now synthesizes an **L-ROUTE through a corner cell** — the elbow turns on the LONGER leg's row, both legs are cardinal, and **both endpoints stay CONNECTED** (snapping the stray endpoint onto the axis instead would strand the neighbouring piece's port: prune → island → `accessibility` FAIL). A §0-FATAL `boulevardDiagonal` plan lint is recorded, and when the offset is only one or two cells the lint says so explicitly, because that is nearly always a mistyped coordinate — round 8 authored a spine node at `x −27.6` against a `W` port at `x −26.4`.

```tsx
AVE.corner;   // the elbow cell, or null on a normal straight avenue
AVE.legs;     // [[from, corner], [corner, to]] — world waypoint pairs
AVE.axis;     // the direction the avenue LEAVES port A along (first leg)
AVE.length;   // total centreline length (both legs)
```

**Read `corner !== null` as a defect to fix, not a feature to use.** Two explicit boulevards through a shared corner node say what you mean; better still, ask the piece for a port that faces the right way (`bazaarPlan({ facing: { port: 'E', toward: HUB.port('S') } })`) — a `<Bazaar>` only has `W`/`E`, on its aisle axis.

## Ports and the footprint — the one place a street piece differs

`reserve` defaults to **FALSE**. A boulevard's whole job is to be walked, tailed onto and branched off; a reserved OBB would "overlap" every queue lane that legitimately ends on it. `plan.footprint` (the dressed verge strip, `hx` 2.4 × `hz` length/2) is still computed so a composition can space districts and sweep coaster corridors against the avenue as one object — pass `reserve` to opt in when an avenue really must be exclusive land.

Its two ports are marked `prunable: false` (structural chain ends): `buildParkNet` prunes dedicated port STUBS nobody wired, but never shortens a carriageway.

## Props

`<Boulevard plan reserve? />`. `boulevardPlan(input)`:

| prop | default | notes |
|---|---|---|
| `id` / `title` | — / derived | port refs `'<id>:A'` (at `from`), `'<id>:B'` (at `to`) |
| `from` / `to` | — | lattice cells sharing an x or a z; ≥ 3 cells apart. A diagonal is L-ROUTED with a §0-FATAL `boulevardDiagonal` lint; under 3 cells is built as-is with `boulevardTooShort` (use a plain street edge instead). Neither throws any more |
| `spacing` | 4.8 | lamp-pair spacing, rounded to the lattice |
| `lamps` / `trees` / `benches` / `planters` | true | per-layer switches |
| `stringLights` | true | spans across the carriageway on alternating pairs |
| `avoid` / `clear` | `[]` / 1.3 | keep the verges clear of the queue wiring |
| `reserve` | **false** | see above |
| `theme` | `DEFAULT_THEME` | the WORLD this avenue is dressed for (see SetPieceKit/Context.md → *The theme layer*) |
| `seed` | 1 | deterministic species/prop variation (the theme's `seedOffset` is added) |

### Theming

`theme` changes the avenue's **dress** only — the carriageway, the station rhythm, the ports and the verge offsets are untouched:

| what | from the theme |
|---|---|
| allée species | `planting.trees` weights via `pickTreeShape` (default 0.3 pine / 0.55 round / 0.15 willow — the historic thresholds) |
| verge planter slot | `planting.planters` via `pickSpecies` (default `['topiarySpiral', 'planterBox']` — the historic `h > 0.5` split) |
| lamp ironwork / glass / glow / character | `palette.iron`, `palette.lampGlass`, `palette.lampGlow`, `lamp` |
| span bulbs across the carriageway | the FIRST and LAST of `palette.spanBulbs` (default `[0xffd9a0, 0xfff0c8]`) |

Both species picks reuse the avenue's existing hashed-sine rolls, so a themed avenue is as deterministic as the default one; `DEFAULT_THEME` reproduces it exactly.

The plan exposes `length`, `axis`, `corner`, `legs`, `lampSpots`, `spans`, `treeSpots`, `benchSpots`, `props`. On a straight avenue the dressing is bit-identical to the pre-L-route planner (pinned by `harness/park-eval/probe-boulevard-avoid.mjs`, 46 reference anchors); on an L-route each leg dresses in its own frame, so the verge stays beside its own carriageway.

## Round-6 channels

Every verge item is registered through `park.registerPlanted`, so validatePark's `scenery` gate audits it for dryness and for standing in a walked slab. **Nothing here registers a blocker**: a thin lamp column or a tree trunk 1.35-2.45 u off the centreline is something guests brush past, and fencing an avenue would strand the park. Real PointLights go on every OTHER station only (all lanterns still glow emissively at night) so one long avenue cannot eat the park's global light budget.

Deterministic (hashed sine only); every item settles through `park.floorAt`, and trees sink 0.05 so nothing floats on a rolling verge.

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
