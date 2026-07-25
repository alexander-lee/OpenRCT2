---
name: park-composition
description: Use whenever the request is to build, compose, generate, design, lay out or extend a theme park / amusement park / fairground / RCT2 park scene with the mp3d rigs — anything that produces a <Park> with terrain, paths, a gate, rides, stalls and scenery. Covers the mandatory composition order, buildParkNet as the ONLY way to build a street network, the FountainPlaza/Bazaar/Boulevard set-pieces, district planning and plot utilisation, keepDry, off-lattice pad placement, and driving validatePark to zero failures AND zero warnings.
---

# Composing a park — the layout is the hard part

Read this before you write a single node. **The coaster is not where parks
fail.** Four measured agent parks scored 8/8 on Thrill (verbatim archetype
copies) and 1.5-2.5 / 8 on Paths with 0-3 / 10 on Accessibility. Two of them
hand-rolled a street lattice and ignored `buildParkNet` and the set-pieces
entirely, even though both were available.

The rule that follows from that: **you do not compute path geometry. The kit
does.** Every time you hand-roll node arithmetic you are re-entering the exact
failure mode that has cost every park half its score.

## The composition order — mount order IS build order

Sibling effects run in JSX order. Declare exactly this:

```
<Terrain>  →  <Paths>  →  <GameManager/>  →  <Gate>  →  coaster
           →  flat rides  →  stalls / <Restroom>  →  SET-PIECES  →  scenery
```

Set-pieces (`<FountainPlaza>`, `<Bazaar>`, `<Boulevard>`) must be declared
**after `<Paths>`** — their dressing settles onto the paving through
`park.floorAt`. Wrappers throw a named error when a prerequisite is missing.

But the *planning* order is the reverse of the mount order: **plans first,
JSX last.** Everything below step 1 happens as pure data before any component
mounts.

---

## Step 1 — declare the park's type, climate, seed and size

`size` defaults to **48** — the EXPANSIVE plot, x,z ∈ [−24, 24], nine 16-parks
of land. Do not pass `size={16}` unless the brief asks for a compact park.

Pick THRILL or FAMILY (it decides the coaster archetype — see the
**coaster-pieces** skill) and one climate: `temperate | desert | alpine |
coastal`. Climate re-seeds the terrain palette, the water story, sand coverage,
scenery species and the land names:

| climate | water story | ground | scenery | land names |
|---|---|---|---|---|
| `temperate` | one big lake / lazy river, beach flank | green lawns | rounds + pines, palms at the shore | Main Street / Lakeside Boardwalk / Alpine Frontier / Fairground |
| `desert` | ONE small oasis | sand nearly everywhere | palms only AT water; cacti + rock on the flats | Oasis Boardwalk / Mesa Frontier / Dune Fairground |
| `alpine` | a small dark tarn, NO beach | darker grass, snow-capped summits | pines everywhere | Tarn Promenade / Summit Frontier / Meadow Fairground |
| `coastal` | the biggest water — lagoon chain / bay on one flank, WIDE palm beach | lush green | palms + rounds | Boardwalk Bay / Headland Frontier / Seaside Fairground |

Pin a seed from the published table (`rules/park-generation.md` §1) so you know
roughly where the landform wants its water and mountains.

### ⚠ The seed table's water coordinates are PRE-GUARD and CAN MOVE

`parkComposition` probes candidates and **re-picks the water body whenever your
`keepDry` list overlaps the listed disc.** Round-7's park planned around
seed 7's river at (18.1, −5.9); the composition settled a lake at ~(9, 12…15)
instead, and the park then bridged it on stilts and planted a tree in it.

So use the seed table for *character* (how much water, where the mountains
are, which meadows are big), never as a coordinate you place against. There is
exactly ONE reliable way to know where the water is:

```tsx
const park = usePark();
park.terrain?.water        // { x, z, r } — the ACTUAL body, POST-guard
park.isDry([9, 12])        // false — that "meadow" is the lake now
park.isDryCell([9, 12])    // the whole 1.2 cell (centre + 8 ring samples)
```

These are only readable **after `<Terrain>` has mounted**, i.e. inside a
`<Placed build>` or any `usePark()` child. For static props, the robust
strategy is the other direction: **put every cell you will build on into
`keepDry` and let the water go wherever it must.** A guarded layout is never
composed under water.

---

## Step 2 — plan DISTRICTS on paper, then check them against the coaster corridor

A 48 plot needs **4+ registered rides** and 3-4 districts plus the hub. A
three-ride huddle in one corner reads abandoned and scores like it.

Plot-utilisation targets to hit before you stop:

- **≥ 4 registered rides** (6 is a good number on 48), **≥ 1 stall per 2 rides**;
- the bounding box of everything you build spans **≥ 32 u in BOTH x and z**
  (two thirds of the plot) — and **no quadrant of the plot is empty**;
- **≥ 12 trees**, **≥ 6 scenery pieces**, exactly **1 water body** ≤ ~12 % of area;
- rides span the intensity bands: a gentle (≤ 3), a moderate (4-6), an intense
  (≥ 7) beside the flagship coaster;
- mesh budget ~2500 per 16² of land → **~22 500 on a 48 plot**.

Compile the coaster FIRST, then subtract its corridor from the buildable land:

```tsx
const COMPILED = compileTrackPieces(A_PIECES, {
  profile: 'coaster', type: 'steel', start: START, heading: 0,
});
```

Copy the archetype's published corridor cell table, add your `(dx, dz)` offset
to every cell, and treat those cells as land you cannot pave, stall or park a
pad on. **You may cross UNDER an apex leg** (the RCT2 look) wherever the table
does not list the cell — that is the whole point of the flying-corner
archetypes.

Districts: anchor each on a different flat field, link them with **boulevards**,
and give each one a theme that decides its ride assignment, scenery species and
`rideColourPreset` flavour:

| district | contents | colour preset |
|---|---|---|
| hub / Main Street | `<FountainPlaza>` + gate street, kiosks abutting the street, light poles, the plaza crowd | — |
| waterside land | the water-flavoured ride + sand; one `<DanceFloorR>` terrace and/or one `<Neon>` marquee, max | `rideColourPreset(seed + zone, 'water')` |
| hills land | the coaster on the foothills, rock outcrops on the park-side flank | `'wooden'` |
| fairground | flat rides on grid cells, the `<Bazaar>` | `'steel'` (karts `'kart'`) |

---

## Step 3 — plan the SET-PIECES (this is where your paths come from)

Set-pieces are pure planners that return the whole piece as data before
anything mounts: ports, interior sub-net, paving rects, bins, keepDry cells and
one footprint OBB. **Ports, footprint, keepDry cells, stall anchors and the
visual all derive from the same numbers, so they cannot disagree.** This is the
mechanism that removes the arithmetic you keep getting wrong.

```tsx
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { buildParkNet } from './components/SetPieceKit';
```

### `fountainPlazaPlan` — every park's HUB

```tsx
const HUB = fountainPlazaPlan({
  id: 'hub',                  // port refs read 'hub:N', 'hub:E', …
  title: 'Fountain Square',
  position: [9.6, 12.0],      // plaza CENTRE cell, lattice-snapped
  tiles: 7,                   // ODD, 7..13 (7 → an 8.4 u square pad)
  ports: ['N', 'S', 'W'],     // 3 = a T junction; a closed side gets a statue
  seed: 7,
});
```

Geometry you can compute: `half = tiles × 0.6`; the pad and its registered OBB
span `position ± half`; each port cell sits at `position ± (half + 0.6)` —
**one lattice cell OUTSIDE the footprint**, so a street or a queue lane can
meet a port without overlapping the piece. Traffic routes around a walkable
RING (never a cross through the fountain), so every open port reaches every
other. It is a real junction, never a dead end.

`tiles: 7` → half 4.2, ports at ±4.8. Also exposed: `fountain`, `benchSpots`,
`lampSpots`, `spans`, `props`, `openPorts`, `ring`, `half`.

### `bazaarPlan` — the shop cluster (kills the "stall sells nothing" defect)

```tsx
const MARKET = bazaarPlan({
  id: 'market', title: 'Commons Market',
  position: [-9.6, 12.0],                                  // courtyard centre
  stalls: ['burger', 'soda', 'cottonCandy', 'balloon'],    // 3-6 of
    // 'burger' | 'hotDog' | 'soda' | 'cottonCandy' | 'balloon'
  seed: 5,
});
```

`tiles = 2k + 1` for k stalls (4 stalls → 9 tiles, `half = 5.4`); pad depth is
3 tiles (±1.8); ports `W` / `E` at `position ± (half + 0.6)` along the aisle.
The aisle IS a street in the shared graph and every stall is planted 1.2 u off
it with its serving front toward it, so the manager's attach point
(`anchor + 0.72 × front`) lands 0.48 u from the centreline — **on the path**.
Each stall is a real registered catalog component (`"Commons Market Soda
Stand 2"`), and `pinStalls` defaults true so the corridor resolver cannot
shuffle one out of the row.

Hand-placing stalls is how you get shops facing a hedge. Use the Bazaar.

### `boulevardPlan` — the long walk between districts

```tsx
const AVE_W = boulevardPlan({
  id: 'aveW',
  from: HUB.port('W'),        // its two end nodes ARE its neighbours' ports
  to: MARKET.port('E'),       // → buildParkNet MERGES the cells: connected by construction
  spacing: 3.6,               // lamp-pair spacing (default 4.8)
  avoid: [...PLANNED_LANE_CELLS, ...PAD_CELLS],   // keeps verge dressing off the wiring
  seed: 4,
});
```

`from`/`to` must share an x or a z (a diagonal throws) and be ≥ 3 cells apart.
Nodes every 1.2; lamp pairs at `spacing`; string-light spans on alternate
pairs; a tree allée at the half-stations. Every anchor is ≥ 1.35 u off the
centreline, so a queue lane can still tail onto any node. `reserve` defaults
**false** (a street must stay tailable and branchable), and its two ports are
`prunable: false` so the carriageway is never shortened.

**A boulevard is the single cheapest thing you can add to make a 48 plot read
as expansive instead of huddled.** Use two or three.

A gate can stand on a terminus:
`boulevardPlan({ from: [0, 22.8], to: HUB.port('N') })` + a bare `<Gate />`.

---

## Step 4 — `buildParkNet` is MANDATORY. Never hand-roll a lattice.

```tsx
const NET = buildParkNet({
  nodes: MY_STREET_NODES,          // OPTIONAL — your indices are PRESERVED
  edges: [
    [0, 1], [1, 2],                // your own index → index
    [2, 'hub:N'],                  // your index → a PORT by name
    ['hub:E', 'market:W'],         // port → port
  ],
  pieces: [HUB, MARKET, AVE_W, AVE_S],
  keepDry: [...RIDE_PAD_CELLS, ...LANE_CELLS, ...EXIT_CELLS],
  bins: [[1.5, 12.0]],
  plazas: [],                      // pieces contribute their own
});

<Terrain keepDry={NET.keepDry} coasterPts={COMPILED.points} />
<Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas}
       bins={NET.bins} walkers={6} />
```

What it guarantees **by construction** — i.e. what you no longer have to get
right by hand:

- **your** node indices survive (piece nodes are appended), so a
  `queueTailNode` you computed against your own list keeps its meaning;
- everything lattice-snapped (1.2), deduped, cardinal — `<Paths>`' own
  `snapNetToGrid` becomes a no-op and indices stay stable;
- **every long edge is SPLIT at any node lying on it.** A crossing without a
  junction is a routing dead end guests can never turn at — this is a large
  part of the missing Accessibility score;
- **unconnected port stubs are PRUNED** rather than dead-ending in grass;
- a lint pass reports diagonal edges and disconnected islands in
  `NET.warnings` (and `console.warn`s them).

Lookups: `NET.node([x, z])` → the index of a world cell (throws if there is no
node there); `NET.port('hub:E')` → the index of a port (throws if it was
pruned); `NET.pruned`; `NET.warnings`.

### Three buildParkNet rules that bite

1. **An unwired port is PRUNED.** A port stub has degree 1 from its own
   interior edge, and pruning drops any prunable port with `deg <= 1`. If you
   want a ride's queue tail to land on `hub:S`, you must run a street edge off
   that port, or the node will not exist when `<Coaster>` looks it up.
2. **`NET.node([x, z])` THROWS if the cell has no node.** Look up the tail cell
   only after you have actually added a node (or a piece) there.
3. **Every edge must be cardinal.** A diagonal edge is a lint warning here and
   a hard `validatePark` FAIL later.

### The wrong pattern vs the right one

```tsx
// ✗ WRONG — the round-6/7 failure. Hand-rolled lattice: a tree of spurs with
//   no ring, crossings that aren't junctions, plaza tiles invented by hand,
//   keepDry listing only the nodes, stalls placed by eyeballed offsets.
const NODES: [number, number][] = [[0, 22.8], [0, 21.6], /* … 40 more … */];
const EDGES: [number, number][] = [[0, 1], [1, 2], /* … */];
const PLAZA: [number, number, number, number] = [0, 12, 3.6, 3.6];
const KEEP_DRY = [...NODES];                 // ← misses every span → causeway
<Paths nodes={NODES} edges={EDGES} plazas={[PLAZA]} />
<BurgerShop position={[3.0, 11.4]} rotation={-Math.PI / 2} register />

// ✓ RIGHT — plans, then one fuse, then mount from the same plans.
const HUB = fountainPlazaPlan({ id: 'hub', position: [9.6, 12.0], ports: ['N', 'S', 'W'] });
const MARKET = bazaarPlan({ id: 'market', position: [-9.6, 12.0],
                            stalls: ['burger', 'soda', 'cottonCandy', 'balloon'] });
const AVE_W = boulevardPlan({ id: 'aveW', from: HUB.port('W'), to: MARKET.port('E') });
const NET = buildParkNet({ nodes: GATE_STREET, edges: [...GATE_EDGES, [8, 'hub:N']],
                           pieces: [HUB, MARKET, AVE_W] });
<Terrain keepDry={NET.keepDry} coasterPts={COMPILED.points} />
<Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
{/* … after <Paths>: */}
<FountainPlaza plan={HUB} />
<Boulevard plan={AVE_W} />
<Bazaar plan={MARKET} />
```

---

## Step 5 — keepDry covers the whole SPINE, not just the nodes

`<Terrain keepDry>` is the terrain probe's guard list: every world cell you
will pave or place on. `buildParkNet` builds it correctly for you — it pushes
every node, **every 1.2 step along every edge**, every paved plaza tile centre
and every piece cell.

That per-step sampling is the point. A keepDry list of NODES ONLY leaves the
ground between them unguarded, a span crosses a river bank, `<Paths>` quietly
puts it on a wooden viaduct, and the **causeway** lint fires — a FATAL
`autofix` failure. Round-6 hoisted an edge 2.21 u exactly this way. The
thresholds: a span lifted **> 1.0 u** over the ground is a fatal `causeway`;
**> 2.0 u** is `causewayRefused` and the edge is DELETED from the net; a span
whose ground dips below `waterLevel + 0.05` is `latticeInWater` and is likewise
DELETED. A path level more than **0.8 u** above the median node ground is the
node-side `causeway`.

Add to `NET.keepDry` (via the `keepDry` input) everything the net does not
know about: ride pad cells, queue-lane cells, exit-hut cells, and the cells
under off-path scenery.

**Path level:** `<Paths>` picks ONE level from the ground under your nodes.
Check node ground heights first and keep the whole run on comparable ground. A
node on a 2-3 u bulge gets **moved**, or gets its own ramp as an
`[x, z, elevation]` triple — never hoist the street onto berms. Ramp rules:
max one 0.5 step per 1.2 tile (grade ≈ 0.42), sloped runs go STRAIGHT (no bends
or junctions mid-slope), and every elevated node needs a walkable ramp route
back down.

**AUTO-keepDry is a safety net, not a design tool.** After every child mounts,
the runtime collects every registered footprint plus the as-built coaster
polylines and re-runs the guard clamp. It will rescue a sinking pad — and print
`[Park] AUTO-keepDry`, which means the layout was mis-planned.

---

## Step 6 — place rides OFF the lattice, with the tail ON it

Two separate rules, and round-7 broke both.

**(a) The pad must stand ≥ 1.8 u clear of every street node AND every edge
centreline.** Round-7 put its ride pads straight ON the lattice nodes: 20
`blockers` failures and 5 unreachable queues. A 2.4-u pad at 1.8 u clearance
clears a 1.1-u slab by 0.05. Solid props want `pathWidth/2 + ground radius`
(≈ 1.15 for a planter on a 1.1 slab) — a "cell centre" 0.6 u from an edge
centreline is *half a slab inside the walked surface* and fails `scenery`.

Do not guess. Ask:

```tsx
import { offPathCell, pathClearance } from './components/Park';

pathClearance(NET, [-12, 9.6]).clearance          // how far off the street am I?
offPathCell(NET, [-12, 9.6], { clear: 1.8, size: 48, isDry: park.isDry })
// → [-13.8, 10.8]: park the pad THERE, not on the node. null = your street
//   skeleton is too dense here; re-plan it, don't shrink the rule.
```

`offPathCell` searches the 0.6-u half-cell lattice outward, so results land on
cell centres as well as nodes. Defaults: `clear` 1.8, `step` 0.6, `rings` 8
(4.8 u), `margin` 1.2.

**(b) A street node must sit exactly at the tail reach along the ride's lane
axis.** The lane runs out the ride's **local +z** face (rotated by
`rotation`), and the tail lands at

```
tailDistance = front + laneLenOf(capacity) + 0.35
laneLenOf(c)  = max(2.2, 1.1 + 0.56·c)
```

`front` is per-ride (1.8 default; wide-sweep rides carry more). Capacity 4,
front 1.8 → `1.8 + 3.34 + 0.35 = 5.49`. So: pick the street node, then put the
pad 5.49 u away from it along a cardinal, with `rotation` aimed so local +z
points at that node.

> The **1.8 + 0.35×capacity + 0.35 = 3.55** figure in the older rules text is
> the OLD formula and is wrong against the code. Use `laneLenOf`. Getting this
> wrong either strands the ride (no node on the axis) or trims the lane.

If a node sits on the axis **shorter** than the reach (within 0.3 u laterally,
between `front + 1.55` and the reach), the lane is TRIMMED to land on it — a
`laneTrim` lint, reported but not fatal, which starves queue slots.

**On a compact rig (span ≤ 10 u) `front` is auto-raised** to
`min(6.5, footMaxZ × scale + 1.27)`, so for most catalog flat rides you cannot
compute the reach from the documented `front` at all. When it must be exact,
PIN the lane in world space with `queue={{ anchor, dir }}` — that also opts out
of trimming, of the `queueDir` auto-flip and of the derived-exit snap.

**Never point two rides at the same tail node** — that is a FATAL
`queueTailShared` lint.

Queue lanes are **railed on both sides and enterable only at the tail**, so a
tail that is not a real walked street node makes the ride permanently
unreachable. This is the single biggest Accessibility scorer.

```tsx
// worked: a capacity-4 flat ride hanging off hub:S, which we extended south
// street nodes … (9.6, 6.0), (9.6, 4.8) …           ← (9.6, 4.8) is the tail
// rotation 0 → local +z is world +z → the lane runs NORTH toward the node.
// Pin the lane so the tail lands exactly, whatever this ride's `front` is:
const TAIL: [number, number] = [9.6, 4.8];
const DIR:  [number, number] = [0, 1];                    // hut → tail
const JOIN = Math.max(2.2, 1.1 + 0.56 * 4) + 0.35;        // 3.69
<SwingRide position={[9.6, -1.2]} rotation={0}
  register={{ name: 'Sky Swings', capacity: 4, rideDuration: 9, intensity: 5, price: 3 }}
  queue={{ anchor: [TAIL[0] - DIR[0] * JOIN, TAIL[1] - DIR[1] * JOIN], dir: DIR }} />
// anchor = (9.6, 1.11) — 2.31 u out the ride front, clear of its swing envelope;
// pathClearance(NET, [9.6, -1.2]) = 6.0 ✔ (≥ 1.8)
```

Stagger rides on opposite sides of a street to pack tighter; two capacity-4
rides on the SAME street clear each other only at centre-to-centre pitch
**≥ 6 u**. Pad ~2.4 × 2.4; exit hut ~1 × 1 at local `[-1.5, 1.35]`.

Keep **`rideDuration ≤ 12`** — the acceptance sim runs 60 sim-s and needs one
full cycle (~20 s gate→queue walk + load + duration + unload).

See the **ride-and-stall-roster** skill for which components exist and what
each one's `front`, capacity and placement constraints are.

---

## Step 7 — the rest of the composition

- **`<Gate/>`** bare: it defaults to the lattice cell hugging the front (+z)
  edge — `z = 1.2·round((size/2 − 0.8)/1.2)` = **22.8 on a 48 plot** (7.2 on
  16), facing OUT. Put a street node under that cell. The gate spawn must sit
  within `max(1.25, size × 0.025)` u of the edge — **1.25 u on a 48 plot** — so
  a gate a few units inside the park is a hard `accessibility` failure.
- **`<GameManager/>`** right after `<Paths>` — one manager, explicit child.
- **Always give `<Coaster name>`.** The `corridor` gate exempts a ride's own
  access rects by matching the ride NAME; an unnamed circuit makes the whole
  ride-footprint sweep skip, so you lose the check rather than pass it.
- **`<Restroom>` must come from `./components/Park`.** There are two components
  with that name: the Park wrapper registers with the manager and registers its
  blocker; `./components/Restroom` is a bare `composable` around the preview
  staging builder and is NOT registered.
- **`<Stall kind>` accepts `'balloon'` only**, and it takes **`sell`**, not
  `register`. The four food shops are their own catalog components — mount
  those directly with `register` and a themed `name` (names are the manager's
  primary key; duplicates make the corridor resolver move the wrong shop).
- **Catalog only.** If a ride, tree, stall or prop exists in the catalog, use
  the component. A hand-built "carousel" or primitive trees are a DEFECT (they
  render as black blobs). Trees and rocks come only from
  `tree(t, { shape: 'round'|'pine'|'palm'|'willow' })` and `rock(t, scale)`.
- **Never mount a `build<Name>Scene` builder** inside a park — those are
  preview staging and ship their own ground (the floating-oval failure). Use
  the component or its plain `build<Name>`.
- **`<Neon scale={0.4…0.7}>`** — the auto-scale is giant, and the backboard
  hugs the text automatically, so never build a placard behind a sign.
- **Solid objects are solid.** Streets stay ≥ 1.2 u from a fountain centre, off
  every pad and shop body, and out of every `<Fence>` run. Fencing a boundary a
  street crosses? Author TWO runs with a **gateway gap** (or `<Fence inset>`).
- **Scenery ≥ 1.2 u off every edge centreline.** A planted piece fails when
  `distance + 0.1 < pathWidth/2 + min(r, 0.6)` — with the default 1.1 slab that
  is 1.05 u for anything with a 0.6-u base, so use one full cell. Plaza dressing
  is exempt. Nothing may stand where the ground is below `waterLevel + 0.05`.
- **Colours from ColorKit presets only** (`rideColourPreset` — from
  `./components/ColorKit`, never SplineRideKit). Muted brick red, forest green,
  navy, cream, grey-brown. No orange/pink plastic.
- **Deterministic only** — hashed-sine PRNGs, never `Math.random` / `Date.now`.

### Canonical imports

```tsx
import { Park, GameManager, Terrain, Paths, Gate, Coaster, TrackRide,
         FlatRide, Stall, Restroom, Fountain, Neon, DanceFloorR, Scenery,
         Lights, Placed, usePark, offPathCell, pathClearance,
         Station, Straight, Lift, Drop, Hill, TurnL, TurnR, HelixL, HelixR,
         Corkscrew, SBend } from './components/Park';
import { buildParkNet } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { FerrisWheel } from './components/FerrisWheel';        // NEVER from './Park'
import { BurgerShop } from './components/BurgerShop';
import { Fence } from './components/Fence';
import { Torch } from './components/Torch';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { rideColourPreset, RCT2_COLOURS, shade } from './components/ColorKit';
import { buildScenery, SCENERY_NAMES } from './components/SceneryPack';
import { tree, rock } from './components/Kit';
```

`SceneryPack` names for `<Scenery name>`: marbleStatue, birdbath, picnicTable,
planterBox, topiarySpiral, topiaryElephant, signpost, tvMonitorPost, parkClock,
flagpole, ironArchway, brickWall, picketFence, lionStatue, cactusCluster,
fallenLog, mushroomCluster, wishingWell, gazebo, hotAirBalloon.

---

## Step 8 — validate to ZERO failures AND ZERO warnings

`<Park validate>` defaults **true**: one frame after the children settle it
spawns the guests, runs `validatePark` and logs the report.

**`report.ok === true` is NOT the bar. An empty `report.warnings` array is.**
Every build-time lint the wrappers recorded is echoed in
`report.warnings: { kind, detail, fatal }[]`, and the fatal kinds become real
`failures` with check `'autofix'`:

FATAL: `causeway`, `causewayRefused`, `latticeInWater`, `padOnStreet`,
`plantedInWater`, `queueTailShared`, `queueDirFlip`, `queueDirUnfixable`,
`exitHutRelocated`, `exitHutUnfixable`, `corridorShift`,
`corridorExitRelocated`, `corridorLaneTrim`, `corridorPinned`,
`corridorUnresolved`, `coaster:shortDrop`.

Reported but not fatal — and still evidence of a mis-planned layout:
`laneTrim`, `exitSnapped`, `padNearStreet`, `plantedWetCell`,
`pathLevelMedian`, `coaster:shortLength`.

Two of these do more than warn: `latticeInWater` and `causewayRefused`
**DELETE the offending street edge from the net**, which then manufactures
`accessibility` failures further down the report. Always fix the fatal lints
before chasing the failures they caused.

An auto-fix must never silently rescue a design you were supposed to re-plan.
If a warning appears, **re-lay the layout** — do not rationalise it.

The gate's checks: `accessibility` (the gate routes to EVERY queue tail),
`terrain` (exactly one flood-filled water body, flat dry apron, no footprint on
a hill flank), `footprints` (OBB SAT sweep, no overlaps), `coaster`
(design + clearance + crash-free), `corridor` (1.6-u track corridor clear at
grade, ≥ 2.2 u to fly over), `blockers` (no rendered street edge through a
solid; every tail reachable), `scenery` (nothing planted in water or in a
slab), `bounds` (every footprint corner and attach node inside ±size/2),
`autofix`, `sim` (≥ 1 completed cycle in ~60 sim-s), plus mesh budget and
determinism.

When a check fails, go to the **park-troubleshooting** skill — it has the fix
for each failure by name.

---

## Worked skeleton — a THRILL park on the default 48 plot

Archetype A at its reference start is a 37.6 × 37.6 ring around the whole plot
with a clear middle; **the layout lives in the ring's interior and on the east
apron.** Every number below is derived, and the derivation is shown.

```tsx
// ── 1. the coaster, compiled first so its corridor is known ────────────────
const START: [number, number, number] = [16.8, 0.55, -3.6];       // A reference
const TAIL: [number, number]  = [START[0] + 6.0, START[2]];        // [22.8, -3.6]
const EXIT: [number, number]  = [START[0] + 2.4, START[2] + 2.4];  // [19.2, -1.2]
const COMPILED = compileTrackPieces(A_PIECES,
  { profile: 'coaster', type: 'steel', start: START, heading: 0 });
// A's corridor, absolute (table offsets + START):
//   west valley   x -21.6/-20.4 : z -10.8..9.6
//   south valley  x -12.0..8.4  : z -20.4..-18.0
//   north valley  x  -9.6..7.2  : z  16.8..19.2
//   station leg   x  15.6..18.0 : z -10.8..4.8      (own ride — exempt)
// FREE interior: x -19.2..14.4 × z -16.8..15.6.  East apron: x >= 19.2.

// ── 2. set-pieces, placed in the free interior ─────────────────────────────
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Fountain Square',
  position: [9.6, 12.0], tiles: 7, ports: ['N', 'S', 'E', 'W'], seed: 7 });
// half 4.2 → pad x 5.4..13.8, z 7.8..16.2 (clear of the north valley at 16.8 ✔)
// ports: N (9.6, 16.8) · S (9.6, 7.2) · E (14.4, 12.0) · W (4.8, 12.0)

const MARKET = bazaarPlan({ id: 'market', title: 'Commons Market',
  position: [-9.6, 12.0], stalls: ['burger', 'soda', 'cottonCandy', 'balloon'], seed: 5 });
// 4 stalls → 9 tiles, half 5.4 → pad x -15.0..-4.2, z 10.2..13.8
// ports: W (-15.6, 12.0) · E (-3.6, 12.0)

const AVE_W = boulevardPlan({ id: 'aveW', from: HUB.port('W'), to: MARKET.port('E'),
  spacing: 3.6, seed: 4 });                    // (4.8,12.0) → (-3.6,12.0), 8.4 u

// ── 3. MY streets: the gate approach, a south spur, the east spine ─────────
// The gate is at (0, 22.8). Any street heading south must cross A's NORTH
// VALLEY (x -9.6..7.2, z 16.8..19.2) — so cross it at x = 9.6, one cell EAST
// of the band, where the first drop is already ~3 u up: a legal fly-over and
// the RCT2 look. The plaza's N port then catches the street at (9.6, 16.8).
// NEVER author a node inside a piece's footprint — reach a piece by its PORTS.
// Open the hub's E port too, so the east spine can hang off it.
const MY: [number, number][] = [
  [0, 22.8], [1.2, 22.8], [2.4, 22.8], [3.6, 22.8], [4.8, 22.8],   //  0.. 4  gate street, east
  [6.0, 22.8], [7.2, 22.8], [8.4, 22.8], [9.6, 22.8],              //  5.. 8
  [9.6, 21.6], [9.6, 20.4], [9.6, 19.2], [9.6, 18.0],              //  9..12  south, under the drop
  [9.6, 6.0], [9.6, 4.8],                                          // 13,14   south spur off hub:S
  [15.6, 12.0], [16.8, 12.0], [18.0, 12.0], [19.2, 12.0],          // 15..18  east, UNDER the lift top
  [20.4, 12.0], [21.6, 12.0], [22.8, 12.0],                        // 19..21
  [22.8, 10.8], [22.8, 9.6], [22.8, 8.4], [22.8, 7.2], [22.8, 6.0],// 22..26  east spine, south
  [22.8, 4.8], [22.8, 3.6], [22.8, 2.4], [22.8, 1.2], [22.8, 0.0], // 27..31
  [22.8, -1.2], [22.8, -2.4], [22.8, -3.6],                        // 32..34  34 = the coaster TAIL
];
const MY_EDGES: [number | string, number | string][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
  [8, 9], [9, 10], [10, 11], [11, 12], [12, 'hub:N'],
  ['hub:S', 13], [13, 14],
  ['hub:E', 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 20], [20, 21],
  [21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 27], [27, 28],
  [28, 29], [29, 30], [30, 31], [31, 32], [32, 33], [33, 34],
];
// hub:E is at (14.4, 12.0), so node 15 at (15.6, 12.0) is one cell east of it.
// The spine crosses x = 16.8 at z = 12.0 — where the lift-top straight flies
// ~5.5 u overhead, far past the 2.2 u the corridor gate demands.
// x = 22.8 is the largest lattice node inside the ±24 bounds check (±23.95).

const NET = buildParkNet({
  nodes: MY, edges: MY_EDGES, pieces: [HUB, MARKET, AVE_W],
  keepDry: [...PAD_CELLS, ...LANE_CELLS, EXIT, TAIL],
});

// ── 4. mount, in order ────────────────────────────────────────────────────
<Park seed={1} climate="temperate" guests={14}>          {/* size defaults to 48 */}
  <Terrain keepDry={NET.keepDry} coasterPts={COMPILED.points} />
  <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas}
         bins={NET.bins} walkers={6} />
  <GameManager />
  <Gate />
  <Coaster name="Thunderhead" pieces={A_PIECES} start={START} heading={0}
    type="steel" cars={5} capacity={4} rideDuration={10} loadTime={2}
    intensity={7} price={6}
    queueTailNode={NET.node(TAIL)} queueDir={[1, 0]}
    exit={EXIT} exitDir={[1, 0]} deck={[START[0], START[2] + 1.2]} />
  {/* flat rides: pad ≥ 1.8 off every edge, lane PINNED so its tail is exact */}
  <SwingRide position={[9.6, -1.2]} rotation={0}
    register={{ name: 'Sky Swings', capacity: 4, rideDuration: 9, intensity: 5 }}
    queue={{ anchor: [9.6, 1.11], dir: [0, 1] }} />   {/* tail = (9.6, 4.8) = node 14 */}
  {/* … more rides in the interior / on the east apron … */}
  <Restroom position={[/* off-path cell */]} rotation={Math.PI / 2} />
  {/* SET-PIECES AFTER <Paths> */}
  <FountainPlaza plan={HUB} />
  <Boulevard plan={AVE_W} />
  <Bazaar plan={MARKET} />
  {/* scenery last: ≥ 12 trees, ≥ 6 pieces, all off the slabs and out of the water */}
</Park>
```

`NET.node(TAIL)` resolves to node 34 — the east spine's last cell. Everything
else (the west market district, the south fairground in
`x −12.0..6.0 × z −16.8..−4.8`, the waterside land) hangs off the same three
ports and one more boulevard.

---

## The anti-template clause

If your park could pass for the worked example with different colours, change
the street skeleton, the district line-up, the ride mix and the water story
until it can't. Two different briefs must produce two structurally different
parks. What is NOT negotiable: the composition order, `buildParkNet`, the
set-pieces for hubs/shop rows/avenues, keepDry, off-lattice pads with tails on
nodes, and a `validatePark` run with zero failures and zero warnings.
