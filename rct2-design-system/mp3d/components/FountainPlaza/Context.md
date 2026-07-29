# FountainPlaza

**CANONICAL IMPORT — copy exactly:** `import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A MACRO SET-PIECE (contract: components/SetPieceKit/Context.md) for a park's **hub**: a fully paved RCT2 plaza pad with a central fountain, a walkable RING around the water and 3 or 4 STREET PORTS. It is a real **junction, never a dead end** — whichever ports you wire, a guest entering from one can reach every other, because the interior ring (not a cross through the fountain) carries the traffic.

## Use

```tsx
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { buildParkNet } from './components/SetPieceKit';

const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 12], ports: ['N', 'E', 'W'] });
const NET = buildParkNet({ pieces: [HUB, ...] });   // its sub-net/paving/bins/keepDry join the park graph

<Terrain keepDry={NET.keepDry} />
<Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} />
<GameManager /><Gate />
<FountainPlaza plan={HUB} />        {/* AFTER <Paths> */}
```

Wire a port by planning a `<Boulevard>` (or your own street edge) **onto its cell** — `boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') })`; `buildParkNet` merges the shared cell, so the junction exists by construction. A port nobody wires is pruned (with an info line) instead of dead-ending in grass.

## Geometry (local frame; `rotation` turns it in quarter turns, port names stay local)

```
┌───────── tiles × 1.2 ─────────┐      stub = half + 0.6  PORT cell, one lattice
│  T   L········port N·······L  │                         cell OUTSIDE the OBB
│      ·  ┌── ring (r) ──┐   ·  │      half = tiles × 0.6  pad + registered OBB
│ port W ─┤   fountain   ├─ port E     r    = half − 1.8   ring square (4 mid nodes)
│      ·  └──────────────┘   ·  │      L    = half − 0.9   band lamps/props
│  T   L········port S·······L  │
└───────────────────────────────┘
```

- **Sub-net**: 4 ring mid nodes (N/E/S/W) + 4 ring corners (8 edges) + one stub node per open port. The mid node of an open side has degree 3 — a genuine T junction.
- **Paving**: one plaza rect (`tiles × tiles` centre tiles), so the whole pad is ONE surface at `plazaY`; `park.floorAt` returns it, so every prop settles exactly on it.
- **Footprint**: the pad (`hx = hz = half`) — registered, so validatePark's footprint sweep and the coaster-corridor sweep see the plaza as one object, and AUTO-keepDry clamps the terrain flat/dry under it.

## Props

`<FountainPlaza plan reserve? />` — the plan is the single source of geometry; `reserve={false}` skips the footprint registration (rarely wanted).

`fountainPlazaPlan(input)`:

| prop | default | notes |
|---|---|---|
| `id` | — | required; port refs read `'<id>:N'` |
| `title` | derived from `id` | footprint label |
| `position` | — | plaza centre cell (snapped to the lattice) |
| `rotation` | 0 | quantized to a quarter turn |
| `tiles` | 7 | ODD, 7..13 (a smaller pad has no walkable ring — clamped up with an info line) |
| `radius` | — | half-extent in units instead of `tiles` |
| `ports` | `['N','E','S','W']` | 3 makes a T junction; a closed side gets a statue + planters |
| `fountainScale` | 0.6 (0.72 from 9 tiles) | `buildFountain` scale |
| `benches` | 4 | benches facing the water, inside the ring |
| `lamps` | true | 4 lantern lamps on the band diagonals |
| `stringLights` | true | 2 festival spans hook-to-hook; `'all'` = 4; `false` = none |
| `planters` | true | planter boxes on closed sides (false = topiary) |
| `reserve` | true | register the footprint |
| `theme` | `DEFAULT_THEME` | the WORLD this hub is dressed for (see SetPieceKit/Context.md → *The theme layer*) |
| `seed` | 1 | deterministic prop variation (the theme's `seedOffset` is added) |

### Theming

`theme` changes the plaza's **dress** only — pad size, ring, ports, sub-net and footprint are untouched:

| what | from the theme |
|---|---|
| apron rosette field | `palette.pavingLight` (was 0xc6c5bc) |
| inner apron ring + border course | `palette.pavingDark` (was 0x8a8a83) |
| lamp ironwork / glass / glow / character | `palette.iron`, `palette.lampGlass`, `palette.lampGlow`, `lamp` |
| festival span bulbs | `palette.spanBulbs` (was `[0xffd9a0, 0xffb46c, 0xfff0c8]`) |
| entrance cheeks (and every side when `planters: false`) | `planting.flanker` (was `topiarySpiral`) |
| the planter course on a closed side | `planting.hedge` (was `planterBox`) |
| the piece closing a portless side | `planting.monument` (was `marbleStatue`) |

`DEFAULT_THEME` carries exactly those old values, so an unthemed plaza is unchanged.

The plan also exposes the resolved dressing anchors (`fountain`, `benchSpots`, `lampSpots`, `spans`, `props`, `openPorts`, `ring`, `half`) so a composition can reason about them (e.g. feed them to another piece's `avoid` list).

## What it renders

Paving accents 12 mm over the plaza surface (a fountain apron rosette + a border course broken by an opening at every entrance — RCT2 plazas are patterned, never one flat grey field), `buildFountain` on the centre tile, benches facing the water, `setPieceLamp` lanterns with night-gated glow + real PointLights, night-gated `setPieceSpan` festival spans between real lamp hooks, `buildScenery` topiary flanking each entrance, a `marbleStatue` closing any side without a port, and 2 bins (rendered + manager-registered by `<Paths bins>`).

Deterministic (hashed sine only). Nothing floats: every item settles through `park.floorAt`.

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
