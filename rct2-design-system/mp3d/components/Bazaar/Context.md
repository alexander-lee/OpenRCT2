# Bazaar

**CANONICAL IMPORT — copy exactly:** `import { Bazaar, bazaarPlan } from './components/Bazaar';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A MACRO SET-PIECE (contract: components/SetPieceKit/Context.md) for a park's **shopping row**: a paved market courtyard with 3-6 CATALOG STALLS facing a central aisle, striped canopies and pennant bunting overhead, lantern lamps + festival spans at both entrances, benches and bins on the verges, its own spine path and TWO end ports.

**The defect it kills:** hand-placed stalls kept landing off the traffic flow — a shop whose serving front faced a hedge sells nothing, and an anchor more than ~1 u from a walkable edge attaches nowhere. Here the aisle IS a street in the park's shared graph and every stall is planted 1.2 u off it, serving front toward it, registered with the GameManager. The manager's attach point (`anchor + 0.72 × front`) lands 0.48 u from the aisle centreline, ON the path.

## THE TWO-PORT CONSTRAINT (read this before you wire anything)

**A bazaar has EXACTLY TWO PORTS, `W` and `E`, and they always lie on the AISLE
AXIS.** There is no `N` and no `S` port, at any rotation — the two rows of stalls
close those sides. The names are LOCAL, not compass: at `rotation: Math.PI / 2`
the aisle runs north/south and the port *named* `W` faces **north**.

This is the wiring that killed a round-8 park. It set `rotation` by hand,
assumed "its `E` port faces the hub side after the default rotation", wired an
avenue from the hub's `S` port to `market:E`, and got
`from [0,68.4] → to [4.8,50.4] is DIAGONAL` — thrown at module scope, so the
whole page rendered BLACK and nothing was scoreable. Two ways to make that
impossible:

```tsx
// 1. LET THE PLAN AIM ITSELF: `facing` picks the rotation that points a NAMED
//    port at a world point. No compass reasoning at all.
const MARKET = bazaarPlan({ id: 'market', position: [0, 50.4],
                            stalls: ['burger', 'soda', 'cottonCandy'],
                            facing: { port: 'E', toward: HUB.port('S') } });
const AVE = boulevardPlan({ id: 'ave', from: HUB.port('S'), to: MARKET.port('E') });

// 2. Or READ THE DIRECTIONS AS DATA and choose the port yourself
MARKET.portNames;            // ['W', 'E'] — the only two, always
MARKET.portDirs;             // { W: [0, -1], E: [0, 1] }  (outward, WORLD)
MARKET.aisleAxis;            // [0, 1] — the only axis this piece connects on
MARKET.portDir('E');         // same thing, per port
```

Asking for a port the piece does not have no longer throws either: it records a
§0-FATAL `unknownPort` plan lint, falls back to the first real port, and lets the
park render so you can see the mistake (`components/ParkBuilder/planLints.ts`).

## Use

```tsx
import { Bazaar, bazaarPlan } from './components/Bazaar';

const MARKET = bazaarPlan({ id: 'market', title: 'Commons Market', position: [-16.8, 12],
                            stalls: ['burger', 'soda', 'cottonCandy', 'balloon'],
                            facing: { port: 'E', toward: HUB.port('W') } });
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
| `rotation` | 0 | quarter turn (0 = aisle east/west). The piece has ONLY `W`/`E` ports and they stay on the aisle axis — rotating moves them, it never adds any |
| `facing` | — | `{ port: 'W' \| 'E', toward: [x, z] }` — pick the rotation that aims that port at a world point. Wins over `rotation`. **Use this instead of reasoning about compass names** |
| `stalls` | `['burger','soda','cottonCandy','balloon']` | 3-6 stall kinds; repeats get a numbered name. **NEUTRAL (legal in any world):** `'burger' \| 'hotDog' \| 'soda' \| 'cottonCandy' \| 'balloon'`. **THEMED (one per world preset, added 2026-07-27):** `'emberRoast'` (fire) `\| 'sushi'` (pirateBeach) `\| 'goggles'` (steampunk) `\| 'honeywitch'` (enchantedForest) `\| 'neonSlush'` (neon) — see `THEMED_STALL_OF`. A themed counter is only coherent inside its OWN world; stocking another world's shop raises the non-fatal `bazaarForeignStall` plan lint, because at settle time `auditWorldThemes` would report it as a `crossTheme` defect. Before the themed five existed a bazaar could only mount the neutral catalog, so every world's market was the same three shops in different canopy colours. |
| `lamps` | true | the four lantern lamps in the two free end tiles, at `(±xEnd, ±1.2)` local. They are also the HOOKS `bunting` and `stringLights` hang from, so `lamps: false` empties `lampSpots`, `spans` and `bunting` (the canopies are unaffected). See *Switching the corner lamps off* below |
| `canopies` | true | cream sailcloth strips with red edge courses, strung ACROSS the aisle in the gaps between stalls (no posts in the walkway) |
| `bunting` | true | pennant garlands down both rows between real lamp hooks — flags only, no lights (costs nothing against the park light budget). Needs `lamps` |
| `stringLights` | true | night-gated festival spans framing both entrances. Needs `lamps` |
| `benches` | true | benches on the entrance verges (bins take the opposite corners) |
| `pinStalls` | true | the set-piece is ONE unit: the settle-time corridor resolver must not shuffle a single shop out of the row |
| `reserve` | true | register the footprint |
| `theme` | `DEFAULT_THEME` | the WORLD this row is dressed for (see SetPieceKit/Context.md → *The theme layer*) |
| `seed` | 1 | deterministic bunting/prop variation (the theme's `seedOffset` is added) |

### Theming

`theme` swaps the row's **dress** only — geometry, stalls, ports, sub-net and footprint are untouched. It supplies:

| what | from the theme |
|---|---|
| canopy field | `palette.canopyPrimary` (was `CANOPY_CREAM` 0xe8dfc8) |
| canopy edge courses, hem, scallops | `palette.canopySecondary` (was `CANOPY_RED` 0xa8443c) |
| pennant colours 3 and 4 | `palette.bunting` (was `BUNT_NAVY` 0x2f4a6d) / `palette.buntingAccent` (was 0xd8b54a) |
| bunting cable + canopy carrying wires | `palette.cable` (was `CABLE` 0x26262c) |
| lamp ironwork / glass / glow / character | `palette.iron`, `palette.lampGlass`, `palette.lampGlow`, `lamp` |
| entrance span bulbs | `palette.spanBulbs` (was `[0xffd9a0, 0xffb46c, 0xfff0c8]`) |
| the two verge markers | `planting.markers` (was `['signpost', 'flagpole']`) |

`DEFAULT_THEME` carries exactly those old values, so an unthemed bazaar is unchanged. Preview 3 ("One bazaar, two WORLDS") mounts the same plan twice under `EMBERFALL_CALDERA` and `PULSE_DISTRICT`.

The plan exposes `slots` (per stall: `kind`, unique `name`, world `at`, world `yaw`, `side`), `lampSpots`, `spans`, `bunting`, `canopies`, `benchSpots`, `props`, `tiles`, `half`, plus the port contract as data: `portNames` (`['W', 'E']`), `portDirs` (`{ W, E }` outward world dirs) and `aisleAxis`.

### Switching the corner lamps off

The four corner lamps sit at `(±xEnd, ±1.2)` in the local frame — the outer
corners of the two free end tiles, i.e. the **farthest** cells the piece dresses
from its centre. On broken ground that is exactly where a lamp can compose a few
centimetres under the waterline while the whole courtyard is dry:

```
[Park] validatePark FAIL [scenery] <Bazaar gladeRow> lamp at [-60.0, 58.8] stands in the
water: ground -0.26 under its 0.20 u footprint is below waterline+0.05 = -0.21
```

`lamps: false` is the fix, and it is the RIGHT fix. A bazaar's guard cells are
load-bearing for the terrain composition — they are what pins a nearby water
body in place — so relocating the row to save a lamp trades a composition for a
decoration. The lamps are dressing; drop the dressing.

```tsx
// skeleton-c, seed 107 alpine: two of this row's corner lamps composed 0.01 and
// 0.05 u under the waterline. Moving the row dropped the plot's SECONDARY water
// body from 33 % of the dominant to 6 % — a composition violation and a hard
// `terrain` FAIL. Switching the lamps off cost nothing.
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', position: [-56.4, 57.6], facing: { port: 'E', toward: [-45.6, 57.6] },
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE,
  benches: false, lamps: false,
});
```

Because the lamps carry the hooks, `lamps: false` also empties `spans` and
`bunting` (`lampSpots.length < 4` → no run) — the same guard `FountainPlaza`
uses. `canopies` are independent and keep rendering. If you want the row's
overhead dress to stay coherent without lamps, pass `canopies: false` too.

**Stall names.** The stalls the piece mounts are named from `title` automatically
(`"Commons Market Soda Stand 2"`). If you mount a stall of your own, both
spellings work and the top-level one wins:
`<SodaStand register={{ name: 'Lakeside Soda', price: 2, value: 4 }} />` or
`<SodaStand register name="Lakeside Soda" price={2} value={4} />`
(`ConfigurableStall`: `name ?? register.name ?? catalogDefault`).

## What it renders

`<Bazaar>` is a fragment: a `BazaarShell` set-piece (4 `setPieceLamp` lanterns in the free end tiles unless `lamps: false`, entrance spans, two pennant garlands, the canopy strips, verge benches, a signpost + flagpole on the grass beside the two entrances) plus **the catalog stall components mounted on the plan's anchors with `register`** — `BurgerShop` / `HotDogStand` / `SodaStand` / `CottonCandyStand` / `BalloonStand`, each a real selling GameManager stall (guest hunger/thirst seeking, purchases, litter) with a unique name like `"Commons Market Soda Stand 2"`.

Under `<ScenePreview>` the registrations are skipped automatically, so the previews show the row without a sim.

Deterministic (hashed sine only); everything settles through `park.floorAt` (courtyard paving inside the pad, terrain on the verges).
