# Boulevard

A MACRO SET-PIECE (contract: components/SetPieceKit/Context.md) for the **long walk between districts** — the piece that makes a size-48 plot read as EXPANSIVE instead of huddled. A straight carriageway between TWO ports, dressed at regular stations with lamp pairs, night-gated string-light spans across the avenue, a street-tree allée, benches and planters.

## Use

```tsx
import { Boulevard, boulevardPlan } from './components/Boulevard';

const AVE = boulevardPlan({ id: 'ave', from: HUB.port('W'), to: MARKET.port('E'), spacing: 3.6 });
const NET = buildParkNet({ pieces: [HUB, MARKET, AVE] });   // shared port cells MERGE
…
<Boulevard plan={AVE} />        {/* AFTER <Paths> */}
```

Because the avenue's two end nodes ARE its neighbours' port cells, `buildParkNet` merges them and the three pieces come out as one connected street net — no index arithmetic, no dangling stub. A gate can stand on a terminus: `boulevardPlan({ from: [0, 22.8], to: HUB.port('N') })` + a bare `<Gate />`.

## Geometry (world; `from`/`to` must share an x or a z — a diagonal throws)

```
port A ·──o──────o──────o──────o──────o──────o──· port B    nodes every 1.2 (CELL)
       T  L  b   L      L  p   L      L  b   L              L = lamp pair, ±1.35
          ·      ·      ·      ·      ·      ·              b = bench, p = planter, ±1.7
       T     tree pair     tree pair     tree pair          T = trees, ±2.45
```

- **Stations** every `spacing` (rounded to the lattice) carry a lamp PAIR; spans cross the avenue on every OTHER pair; **tree pairs** face each other at the half-stations — a deliberate allée, never scattered planting.
- Every anchor is ≥ 1.35 u off the centreline, clear of the 1.1-wide slab and its kerbs, so a ride's queue lane can still tail onto any node.
- `avoid` cells (planned queue lanes, exit huts, ride pads, other pieces) are skipped within `clear` (default 1.3) — dressing can never collide with the wiring the composition solves separately.

## Ports and the footprint — the one place a street piece differs

`reserve` defaults to **FALSE**. A boulevard's whole job is to be walked, tailed onto and branched off; a reserved OBB would "overlap" every queue lane that legitimately ends on it. `plan.footprint` (the dressed verge strip, `hx` 2.4 × `hz` length/2) is still computed so a composition can space districts and sweep coaster corridors against the avenue as one object — pass `reserve` to opt in when an avenue really must be exclusive land.

Its two ports are marked `prunable: false` (structural chain ends): `buildParkNet` prunes dedicated port STUBS nobody wired, but never shortens a carriageway.

## Props

`<Boulevard plan reserve? />`. `boulevardPlan(input)`:

| prop | default | notes |
|---|---|---|
| `id` / `title` | — / derived | port refs `'<id>:A'` (at `from`), `'<id>:B'` (at `to`) |
| `from` / `to` | — | lattice cells sharing an x or a z; ≥ 3 cells apart (else it throws — use a plain street edge) |
| `spacing` | 4.8 | lamp-pair spacing, rounded to the lattice |
| `lamps` / `trees` / `benches` / `planters` | true | per-layer switches |
| `stringLights` | true | spans across the carriageway on alternating pairs |
| `avoid` / `clear` | `[]` / 1.3 | keep the verges clear of the queue wiring |
| `reserve` | **false** | see above |
| `seed` | 1 | deterministic species/prop variation |

The plan exposes `length`, `axis`, `lampSpots`, `spans`, `treeSpots`, `benchSpots`, `props`.

## Round-6 channels

Every verge item is registered through `park.registerPlanted`, so validatePark's `scenery` gate audits it for dryness and for standing in a walked slab. **Nothing here registers a blocker**: a thin lamp column or a tree trunk 1.35-2.45 u off the centreline is something guests brush past, and fencing an avenue would strand the park. Real PointLights go on every OTHER station only (all lanterns still glow emissively at night) so one long avenue cannot eat the park's global light budget.

Deterministic (hashed sine only); every item settles through `park.floorAt`, and trees sink 0.05 so nothing floats on a rolling verge.
