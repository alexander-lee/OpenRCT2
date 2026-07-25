# FountainPlaza

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
| `seed` | 1 | deterministic prop variation |

The plan also exposes the resolved dressing anchors (`fountain`, `benchSpots`, `lampSpots`, `spans`, `props`, `openPorts`, `ring`, `half`) so a composition can reason about them (e.g. feed them to another piece's `avoid` list).

## What it renders

Paving accents 12 mm over the plaza surface (a fountain apron rosette + a border course broken by an opening at every entrance — RCT2 plazas are patterned, never one flat grey field), `buildFountain` on the centre tile, benches facing the water, `setPieceLamp` lanterns with night-gated glow + real PointLights, night-gated `setPieceSpan` festival spans between real lamp hooks, `buildScenery` topiary flanking each entrance, a `marbleStatue` closing any side without a port, and 2 bins (rendered + manager-registered by `<Paths bins>`).

Deterministic (hashed sine only). Nothing floats: every item settles through `park.floorAt`.
