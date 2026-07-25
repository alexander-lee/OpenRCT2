# Bazaar

A MACRO SET-PIECE (contract: components/SetPieceKit/Context.md) for a park's **shopping row**: a paved market courtyard with 3-6 CATALOG STALLS facing a central aisle, striped canopies and pennant bunting overhead, lantern lamps + festival spans at both entrances, benches and bins on the verges, its own spine path and TWO end ports.

**The defect it kills:** hand-placed stalls kept landing off the traffic flow — a shop whose serving front faced a hedge sells nothing, and an anchor more than ~1 u from a walkable edge attaches nowhere. Here the aisle IS a street in the park's shared graph and every stall is planted 1.2 u off it, serving front toward it, registered with the GameManager. The manager's attach point (`anchor + 0.72 × front`) lands 0.48 u from the aisle centreline, ON the path.

## Use

```tsx
import { Bazaar, bazaarPlan } from './components/Bazaar';

const MARKET = bazaarPlan({ id: 'market', title: 'Commons Market', position: [-16.8, 12],
                            stalls: ['burger', 'soda', 'cottonCandy', 'balloon'] });
const NET = buildParkNet({ pieces: [MARKET, ...] });
…
<Bazaar plan={MARKET} />      {/* AFTER <Paths> */}
```

## Geometry (local frame, aisle along local x; `rotation` turns it in quarter turns)

```
port W ·─┬───────────────── aisle (z = 0) ─────────────────┬─· port E
         │   [stall]      [stall]      [stall]             │
  z=+1.2 │        [stall]      [stall]                     │   rows stagger by 1.2,
  z=−1.2 └─────────────────────────────────────────────────┘   stall PITCH 2.4
```

- `tiles = 2k + 1` for k stalls: pitch 2.4 along the aisle (the catalog shops carry big signature props — the burger ball, the candy cloud — so same-side neighbours need 4.8 u), plus a free end tile at each entrance for the lamps.
- `half = tiles × 0.6` along the aisle, pad depth 3 tiles (±1.8). Ports at `±(half + 0.6)` — one lattice cell OUTSIDE the footprint.
- **Sub-net**: one node per aisle tile + a stub node at each end. **Paving**: one plaza rect (the whole courtyard). **Footprint**: `hx = half, hz = 1.8`, registered.

## Props

`<Bazaar plan reserve? />`. `bazaarPlan(input)`:

| prop | default | notes |
|---|---|---|
| `id` / `title` | — / derived | port refs `'<id>:W'`, `'<id>:E'`; the title prefixes stall names |
| `position` | — | courtyard centre cell |
| `rotation` | 0 | quarter turn (0 = aisle east/west) |
| `stalls` | `['burger','soda','cottonCandy','balloon']` | 3-6 of `'burger' \| 'hotDog' \| 'soda' \| 'cottonCandy' \| 'balloon'`; repeats get a numbered name |
| `canopies` | true | cream sailcloth strips with red edge courses, strung ACROSS the aisle in the gaps between stalls (no posts in the walkway) |
| `bunting` | true | pennant garlands down both rows between real lamp hooks — flags only, no lights (costs nothing against the park light budget) |
| `stringLights` | true | night-gated festival spans framing both entrances |
| `benches` | true | benches on the entrance verges (bins take the opposite corners) |
| `pinStalls` | true | the set-piece is ONE unit: the settle-time corridor resolver must not shuffle a single shop out of the row |
| `reserve` | true | register the footprint |
| `seed` | 1 | deterministic bunting/prop variation |

The plan exposes `slots` (per stall: `kind`, unique `name`, world `at`, world `yaw`, `side`), `lampSpots`, `spans`, `bunting`, `canopies`, `benchSpots`, `props`, `tiles`, `half`.

## What it renders

`<Bazaar>` is a fragment: a `BazaarShell` set-piece (4 `setPieceLamp` lanterns in the free end tiles, entrance spans, two pennant garlands, the canopy strips, verge benches, a signpost + flagpole on the grass beside the two entrances) plus **the catalog stall components mounted on the plan's anchors with `register`** — `BurgerShop` / `HotDogStand` / `SodaStand` / `CottonCandyStand` / `BalloonStand`, each a real selling GameManager stall (guest hunger/thirst seeking, purchases, litter) with a unique name like `"Commons Market Soda Stand 2"`.

Under `<ScenePreview>` the registrations are skipped automatically, so the previews show the row without a sim.

Deterministic (hashed sine only); everything settles through `park.floorAt` (courtyard paving inside the pad, terrain on the verges).
