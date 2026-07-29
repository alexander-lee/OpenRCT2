# PathNetwork

**CANONICAL IMPORT — copy exactly:** `import { buildPathNetwork, buildRouting, snapNetToGrid } from './components/PathNetwork';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A footpath GRAPH renderer in the RCT2 grey-tarmac style: nodes + edges become kerbed asphalt slabs with expansion-joint seams, uniform SQUARE junction pads at every node (same width as the slabs), and RCT2 PATH ADDITIONS — benches, litter bins and lamp posts — lining the verge down BOTH sides of every street. RCT2 paths live on a TILE GRID — tiles connect only N/S/E/W, wide areas are full "center" tiles, sloped tiles ramp one height step per tile — and the `grid` / `plazas` / `nodeY` options carry those three rules over.

Kerb trim follows RCT2's footpath configurations: it appears ONLY where no neighbouring path continues. Each node pad places a kerb strip on every FREE cardinal side (no incident edge within 45° of that side's normal) plus the four kerb corner blocks — so a 4-way node reads as an RCT2 cross tile (corners only), a 3-way as a T, a bend as a corner tile, and edge kerbs butt exactly against the pad corners. Lamps/bins are planted in the widest angular gap between a node's approaches, so they never stand on a slab.

Built with three.js on top of the shared `Stage` component and its `box`/`cyl`/`ball` helpers.

## API

```ts
// PathNode = [x, z] | [x, z, elevation] — the optional third element is the
// node's height offset (the ELEVATION API's convenience form; same meaning
// as nodeY[i], used when opts.nodeY is absent)
buildPathNetwork(t: typeof THREE, net: { nodes: PathNode[]; edges: [number, number][] }, opts?: {
  width?: number; y?: number; kind?: 'tarmac' | 'dirt'; groundAt?: (x, z) => number;
  grid?: boolean;                              // warn on any non-axis-aligned edge
  plazas?: [number, number, number, number][]; // [cx, cz, w, d] center-tile rects
  nodeY?: number[];                            // per-node height offsets (ramps) — prefer node triples
})
// -> { group, pointAt(edgeIndex, u): THREE.Vector3, edgeLength(edgeIndex): number,
//      walkYAt(x, z): number, nodes, edges, update(time) }

snapNetToGrid(net: { nodes; edges }, cell = 1.2) // -> the SAME net, snapped in place
// [x, z, elevation] triples KEEP their elevation through the snap (first node
// wins on a merge) — that's why triples beat a parallel nodeY array, which
// would need re-indexing whenever merging changes node indices

// RCT2 wooden support scaffolding (see "Scaffolding" below) — shared with ParkBuilder
SCAFFOLD_LIFT  // 0.35 — above this lift a span/pad gets a scaffold (berms/piers below)
SCAFFOLD_WOOD  // 0x8a6b4a support-timber colour
scaffoldBay(t, specs: MergedBoxSpec[], cx, cz, ux, uz, halfSpread, topY, groundY, seed)
scaffoldTower(t, specs, x, z, w, d, topY, groundY, { rotY?, deck?, seed? })
buildElevatedWalkwayScene(t)  // ramp → elevated straight on scaffolds → ramp + scaffolded kiosk
<ElevatedWalkway/>            // the composable of that scene
```

- `nodes` are `[x, z]` positions or `[x, z, elevation]` triples; `edges` are index pairs into `nodes`.
- `pointAt` returns a point ON the path surface (y = opts.y + ~0.09, exact per-edge top) — walkers can be draped with it. On a ramp the height lerps along the incline; inside a plaza the one-level plaza top wins.
- `walkYAt(x, z)` is the WALKING-SURFACE sampler: the path surface height anywhere on the network — mid-ramp included — falling back to the base level (`y + 0.09`) off-network. Guests/walkers set their feet with it so they climb ramps instead of gliding at one flat lane level. It reads the live `{nodes, edges}` arrays, so `Routing.attach` spurs sample correctly too.
- `edgeLength` is the slope length for inclined edges (2D length when flat) so walker pacing stays uniform on ramps.
- `kind: 'dirt'` swaps the palette to trodden-earth browns.
- `groundAt` lets verge furniture (lamps/bins) stand on real terrain when the path is raised.
- `update` (optional per-frame hook) gates lamp glow by the Stage day/night cycle.
- Deterministic: no `Math.random`, safe for repeated renders.

Pair with `attachWalkers` from `components/PathWalkers` to populate it with guests.

## Path additions (benches, bins, lamps)

RCT2 additions live on path **TILES**, not on junctions — which is why a finished RCT2 street is *lined* with furniture rather than having one bin at the end of it. `furniture` plants them along the verge just outside the kerb, **on both sides**, facing the path:

```tsx
furniture={{ lampEvery: 7.2, seatEvery: 4.8, bothSides: true }}   // the defaults
furniture={false}                                                  // verge pass off
```

- `lampEvery` / `seatEvery` are the spacing in units between items of one kind on ONE side (default: a lamp every six tiles, a bench/bin pair every four). Items sit at interval **centres**, so a single-tile street still gets one in the middle instead of being skipped, and a long avenue gets an even run that never crowds either junction.
- Benches and bins **alternate** down the run and swap sides, so a verge reads as a row of seats punctuated by bins.
- `avoid(x, z)` vetoes a position. The network knows its own kerbs but nothing about rides, stalls, queue lanes or scenery, so a verge point can legitimately land inside someone else's footprint — a park passes its blocker test in here. Plaza interiors are skipped automatically (a plaza is paved to its boundary, so there is no verge to stand on), as is any verge that falls away more than 0.6 below the path.

The meshes are RCT2-faithful: the **bench** is a slatted timber seat and back on two cast-iron end frames; the **bin** is a ribbed tapered body under a domed lid with the posting slot left open across it; the **lamp** is a fluted base and tapered post under a real lantern — a glass box with a cap and a finial, not a bare bulb. Junction lamps and dead-end bins now use the same meshes.

**Cost is four draw calls, not one per item.** Every part is a BOX, collected into merged buckets (park ironwork / bench timber / lantern glass) and merged once. The lantern glass is ONE shared emissive material for the whole network, which is both why it is a single draw and why the entire street lights together on the night gate; real `PointLight`s stay capped at `MAX_LAMP_LIGHTS` (6).

**FIXED — every bench on the network faced AWAY from its street.** The furniture is authored looking down its own local −z (the backrest is at +z), and under `rotY(a)` that direction is world `(−sin a, −cos a)`. An item standing at `centreline + (−uz, ux)·sd·OFF` has to look back along `(uz, −ux)·sd`, which needs `sin a = −uz·sd` and `cos a = ux·sd` — i.e. `yaw ∓ π/2`. The code had `yaw ± π/2`, the exact negation of both, so every seat on every street had its back to the pavement and stared into the hedge behind it. Lamps and bins are rotationally symmetric and hid it. Measured by `harness/mp3d-render/probe-bench-facing.mjs`, which takes each published seat's yaw against the nearest centreline: **16 of 16 seats now face the path, worst dot 1.000** (it reports 16 of 16 facing AWAY if the sign is put back).

**`buildPathNetwork` PUBLISHES its bench seats** as `benches: BenchSeat[]` — one entry per seat (an RCT2 bench holds two), each `{ x, y, z, yaw }` where the point is the slat top a guest's hips land on and the yaw is the direction they look. `<Paths>` hands the list to `park.paths.benches` and `<Park>` forwards it into the GameManager as `benches`, which is what lets a worn-out guest walk to a real bench and SIT on it (RCT2 `PeepState::Sitting`) instead of freezing mid-street. No routing spur is attached per seat, deliberately: a park-scale lattice publishes hundreds of them and that many logical nodes would swamp the routing graph, so a bench is reached by a short off-network detour with `g.resume`, exactly the way a litter bin is.

## Grid rule (RCT2 tile grid)

RCT2 footpaths occupy map tiles that connect only north/south/east/west — there are no diagonal paths. With `grid: true`, `buildPathNetwork` validates every edge (`|dx| < 0.01` or `|dz| < 0.01`) and emits `console.warn("grid mode: edge k is diagonal — paths must run N/S/E/W")` for offenders (they still render; the warning is the contract).

`snapNetToGrid(net, cell = 1.2)` is the layout helper (used by ParkBuilder): it rounds every node to the nearest multiple of `cell` (default = path width, i.e. one tile), merges nodes that land on the same grid point, re-indexes the edges, and drops degenerate (self-loop after merging) and duplicate edges. It mutates `net.nodes`/`net.edges` **in place** — a `Routing` built over the same arrays stays consistent — and returns the same net. Snap **before** assigning a parallel `nodeY` array, since merging changes node indices — or sidestep the problem entirely with `[x, z, elevation]` triples, whose heights travel with the nodes through the snap.

## Center tiles / plazas

Wide open areas in RCT2 are made of full "center" path tiles — open on all four sides, kerb only around the outside of the paved region. `opts.plazas` takes `[centerX, centerZ, width, depth]` rects, each rendered as a flush grid of asphalt tiles (`round(w / width)` × `round(d / width)`):

- ONE surface level: every plaza tile top sits at exactly `y + 0.096` (just above the max jittered edge-slab top), so edges passing under it are covered with clearance — no per-tile jitter, no z-fighting, the plaza reads as a single slab.
- Kerb ONLY around the outer boundary (tile-length segments + the four corner blocks), with segments **skipped where a path edge crosses** so paths enter through open kerb gaps. No internal kerbs; expansion seams and edge kerbs are suppressed inside the rect.
- Nodes inside a plaza get no junction pad, no kerbs, and no lamp/bin — they are just part of the plaza surface, and edges between them connect seamlessly.
- Plazas render at the base `y` (they don't follow `nodeY`).

## Ramps (sloped path tiles) — the elevation API

Give nodes heights either as `[x, z, elevation]` TRIPLES (preferred — no parallel array, heights survive `snapNetToGrid` merging) or as `opts.nodeY` (parallel to `nodes`; missing/absent = 0, i.e. at `opts.y`; when both exist, `nodeY` wins inside `buildPathNetwork`, but `<Paths>` prefers the triples). An edge whose endpoints differ in height renders as the RCT2 sloped path element:

- **A flat inclined RIBBON at constant grade** — one tilted plane through both node centres at the pads' finished level, path-width, thin (~0.12), with the kerbs, expansion seams and a kerb-coloured transition strip at each knuckle all following the slope. Never a solid berm/wedge: a grounded ramp gets low concrete piers from the network (plus an inclined earth embankment UNDER the ribbon from `bermNetToGround`), an airborne one rides wooden scaffold bays.
- **Flush knuckles** — a node where grades change (ramp foot/head, crest) keeps its pad AT the node's height, but the pad BEVELS toward each sloped edge: a tilted wedge, coplanar with the ribbon and the same thickness, carries the surface from the node centre to the pad edge where the ribbon takes over. Zero steps, gaps or overhangs where a ramp meets a level span. Free-side kerbs split into flat + tilted halves and the four corner blocks plant on the LOCAL bevel surface. Flat slabs whose knuckle carries a PERPENDICULAR ramp stop at the pad edge (the bevel owns that ground).
- **Mid-slope nodes** — a degree-2 node whose two sloped edges run straight through at the same grade gets NO pad: the ribbons are one continuous plane (RCT2 slopes have no mid-slope landing). Supports still plant at the joint.
- **Slope cap (lint)**: RCT2 sloped path climbs exactly one height step per tile, i.e. **0.5 rise per 1.2 run** (grade ≈ 0.42). Steeper edges render but warn with the node indices (`ramp lint: edge k (node a -> b) grade …`). Two more ramp lints fire when any node is elevated: sloped edges meeting at an ANGLE at a node (RCT2 slopes run straight), and an elevated node with NO walkable-grade route down to the ground network (`deck unreachable`). All are part of the same console-warning contract as the grid lint — a composed park must produce ZERO warnings.
  - **`deck unreachable` only ever reports STREET nodes** (`degree > 0` counting the `renderEdges` prefix). The GameManager's `routing.attach()` appends stall-front and queue-tail spurs onto the same `nodes`/`edges` arrays, and those endpoints touch no pavement — they are unreachable *by construction*, not by defect. Until 2026-07-27 the flood fill correctly walked street edges only while the REPORT iterated every node, so every spur endpoint more than 0.05 off datum was warned about: skeleton-l emitted **11 such warnings, all of them degree 0 and none of them real**, while its accessibility graph reached all 130 nodes from the gate. A real elevated deck is built from street edges, so its nodes have `degree ≥ 1` and are still tested.
- Junction pads, free-side kerbs, and furniture all use the node's own height; furniture is skipped where the verge drops away and never lands mid-slope.
- `pointAt(edge, u)` interpolates the height along the incline and `walkYAt(x, z)` samples the surface anywhere, so walkers/guests climb ramps automatically. `buildRouting` is unchanged — routing stays 2D.

In `<Park>`, `<Paths nodes={[[x, z], [x, z, elevation], …]}>` threads everything automatically: ramps + scaffolds render, `park.paths.nodeY` (resolved) lets `<Stall>`/`<Restroom>` deck-match a nearby elevated node (explicit `elevation` prop overrides), and `park.paths.walkYAt` is handed to the GameManager for guest walking heights.

## Scaffolding (elevated spans)

OpenRCT2 draws support columns under every path element whose base sits above the map surface (`Paint.Path.cpp` `ShouldDrawSupports`), stacking wooden post segments with a horizontal member every 16 z-units plus slope-transition pieces (`WoodenSupports.cpp` `PathBoxSupportsPaintSetup`). `buildPathNetwork` mirrors that whenever `groundAt` is provided:

- **Threshold split** — sampled one bay per ~1.2 tile along every edge: lift (slab base − terrain) above `SCAFFOLD_LIFT` (0.35) plants a wooden scaffold bay down to the real ground; shallow raised FLAT spans (0.12–0.35) keep the low concrete mid-span pier, and the shallow stretch of a grounded RAMP gets a pier per bay (the inclined ribbon is thin — nothing is buried). Node pads above the threshold get a four-post `scaffoldTower` (a knuckle pad's tower rises to its lowest bevel corner with per-corner topping posts, never poking through a wedge; a pad-less mid-slope node gets a bay), below it the concrete pier.
- **Construction** — square 0.075 timber posts (sunk 0.06 into the ground, embedded in the slab above), a horizontal rung every 0.55 of drop (the 16-unit RCT2 segment) and one deterministic alternating diagonal brace per bay panel. Everything is emitted as `MergedBoxSpec`s and merged into ONE mesh/draw call per network (`SCAFFOLD_WOOD`, wood texture).
- **Division of labour with ParkBuilder** — `bermNetToGround(t, g, net, pathY, groundAt, nodeY?)` berms LOW spans only (a grounded RAMP gets an inclined earth embankment hugging the ribbon's underside at the ramp's grade — the walking surface stays the clean ribbon) and SKIPS anything lifted > `SCAFFOLD_LIFT` (the network's scaffolds carry those); it also reads `[x, z, elevation]` triples when no `nodeY` is given. `plinthUnder` / `groundRideAccess` switch from earth plinths/berms to `scaffoldTower`/`scaffoldBay` + plank decks above the same threshold, so stalls, restrooms, gates and ride entrance/exit huts beside elevated paths stand on scaffolds (deck top at `topY + 0.01`, exactly where the plinth top was). In `<Park>`, `<Stall>`/`<Restroom>` deck-match a street node with an elevation within 1.75 u automatically (explicit `elevation` prop overrides).
- `scaffoldBay`/`scaffoldTower` are exported for custom builds: append specs into your own array, then `mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood', rough: 0.85 })`. Deterministic (hashed-sine `seed`).

The `Elevated walkway` preview (`buildElevatedWalkwayScene` / `<ElevatedWalkway/>`) shows the full language: ground → two one-step ramps → an elevated straight on scaffold bays → ramps down, plus a kiosk beside the elevated section on its own scaffold deck.

## Routing

An RCT2-faithful movement layer over the same graph (guests travel node-to-node along edges, per OpenRCT2 `GuestPathfinding.cpp` / `Peep.cpp`). Fully deterministic — hashed-sine randomness, no `Math.random`/`Date.now`.

```ts
buildRouting(net: RouteNet, opts?: RoutingOpts): Routing
// RouteNet = { nodes: [number, number][]; edges: [number, number][] } — pass the SAME object given to buildPathNetwork
// RoutingOpts = { edgeAllowed?(a, b): boolean }   // the BLOCKER GATE (additive)
// Routing = {
//   adjacency: number[][];                        // neighbour node idxs per node (live)
//   edgeBetween(a, b): number;                    // edge index or -1
//   nearestNode(x, z): number;
//   route(from, to, memory?): number[];           // node path incl. endpoints; [] if unreachable
//   wanderNext(prevNode, atNode, seed): number;   // next wander node
//   attach(x, z): { node, x, z };                 // off-network attachment point
// }
posOnPath(net, a, b, u): [number, number]          // xz lerp between nodes a and b
```

**The blocker gate (`opts.edgeAllowed`, additive).** Return `false` for an edge whose span sits inside a solid obstacle and `route()` plans AROUND it while `wanderNext` never strolls into one. Both **fall back to the unfiltered graph** when the filter would leave a guest with nowhere to go, so a badly fenced layout degrades to the classic behaviour instead of deadlocking the sim (`validatePark`'s `blockers` check fails it loudly instead). Omitted = no gate, byte-identical to before. The GameManager wires its blocker registry in here (see GameManager/Context.md "Blockers"); the callback is hit often, so keep it cheap/cached.

- `route` — greedy best-first scored by Euclidean distance to the goal (RCT2's `Δx + Δy + 2Δz` heuristic without z, `GuestPathfinding.cpp:628`). `memory` is the guest's last-4 thin-junction nodes (`GuestPathfinding.cpp:1300`): those nodes are expanded LAST (large score penalty), never hard-blocked, and a visited set guarantees termination.
- `wanderNext` — RCT2 aimless wander (`GuestPathfinding.cpp:535,1926`): 50% chance (hashed sine of `seed`) of the straightest continuation of the prev→at heading, else a hashed uniform pick among neighbours; never returns to `prevNode` unless the node is degree-1 (dead end).
- `attach(x, z)` — how queue tails and stall fronts join the network: pushes a new node `[x, z]` plus a LOGICAL edge to the nearest existing node into the same `{nodes, edges}` arrays (and adjacency), returning the new node index. No visual slab is added — add a spur edge before building the mesh if you want it visible.

## The path cross-section (`./ribbon.ts`) — ONE definition, shared with ride access

A straight run of pavement in this system is THREE courses, and they are now
declared once so the street renderer and the RIDE ACCESS runs cannot drift apart:

```
PATH_H          0.09   walked surface above a path's DATUM (a node level, a ride pad level)
PATH_SLAB       0.11   rendered slab thickness (0.09 course + 0.02 carried below grade)
PATH_KERB_W     0.08   kerb strip width;  PATH_KERB_PROUD 0.01 above the slab top
PATH_SEAM_EVERY 0.5    expansion joints;  PATH_SEAM_PROUD 0.004
PATH_PAD_LIP    0.006  how far the DRAWN pavement stands above the walkYAt datum
PATH_PAD_TOP    0.096  a junction pad's / ramp ribbon's finished level (H + LIP)
pathRibbon(t, specs, run, opts)   emits slab + kerbs + seams into three merge buckets
```

`GameManager/access.ts` builds a ride's QUEUE LANE and its EXIT FOOTPATH with
`pathRibbon`, so both inherit the street's slab datum, kerb cross-section, seam
pitch, inclined-frame ramping and merge batching. A queue passes `kerbs: false`
(RCT2 edges a queue with its RAILING) but keeps the seams.

**`walkYAt` vs `surfaceYAt` — the units trap.** `walkYAt` is the SIM datum
(`node + PATH_H`): guest feet, queue slots, bench seats and stall fronts are all
expressed against it. `surfaceYAt` is what is actually DRAWN — the per-edge slab
top (`H` plus a 1.5-4.5 mm anti-z-fight jitter), a junction pad or ramp ribbon at
`PATH_PAD_TOP`, and a KNUCKLE pad's bevel toward each of its sloped edges. A ride
access run graded to `walkYAt` ends 5-12 mm UNDER the street it joins (measured
across six rides, `harness/mp3d-render/probe-lane-joins.mjs`); grade to
`surfaceYAt` sampled where the slab PHYSICALLY ENDS. Do not "fix" this by moving
`walkYAt`.

**Spur heights.** `routing.attach` links an access spur to its NEAREST node, and
that can be ANOTHER SPUR — a ride's queue tail and its exit end routinely land in
the same cell and the exit end's coordinates come out of `planExitLane` a
floating-point hair off the lattice. `<Paths>` therefore WALKS the spur chain to
find the street node a spur ultimately hangs off. A spur left at offset 0 still
gets a full 1.22 u junction pad drawn at the network's flat reference level,
standing proud of the graded street beside it (measured +0.0095 u).

**Mesh names.** `Stage`'s `mat()` bakes the colour into the TEXTURE and leaves
`material.color` white, so a raycast probe cannot identify a slab by colour. The
network names its merged buckets `streetPave` / `streetKerb` / `streetSeam`, and
the access rigs name theirs `queuePave` / `queueSeam` / `queueKerb` / `queueRail`
/ `exitPave` / `exitKerb` / `exitSeam` / `exitBerm`, plus `hutGround` on a hut's
apron and `access:<ride>` on each rig group. Measure joins against THOSE.
