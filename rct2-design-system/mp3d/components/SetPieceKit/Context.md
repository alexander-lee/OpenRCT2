# SetPieceKit

The **PORTS + FOOTPRINT contract** every MACRO SET-PIECE speaks. A set-piece (`<FountainPlaza>`, `<Bazaar>`, `<Boulevard>`, …) bundles several primitives, their interior paths, their stalls and their GameManager registrations into ONE correct-by-construction unit. This folder holds only the contract and the shared dressing language — **each set-piece is its own component folder.**

## Why it exists

Agent-composed parks kept failing on WIRING arithmetic, not on art: street nets that were pure trees with spurs dead-ending in grass, queue tails outside the plot or stranded in a coaster circuit, stalls off the traffic flow, rides 3-8 units off the path lattice. Those defects all come from hand-computing interior geometry at JSX-authoring time. The kit removes the arithmetic instead of detecting its failures.

## The contract — PLAN FIRST, MOUNT SECOND

1. **A pure planner returns the whole piece as data, before anything mounts.**

   ```tsx
   const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 12], ports: ['N', 'E', 'W'] });
   ```

   Every plan (`SetPiecePlan`) carries:
   - `ports` — named connector cells in **world** coords, already lattice-snapped, each one lattice cell **OUTSIDE** the piece footprint (so a street or a ride's queue lane can meet a port without ever overlapping the piece). `plan.port('W')` / `plan.portDir('W')`.
   - `nodes` / `edges` — the piece's **interior path sub-net** in world coords, cardinal and on the 1.2 lattice. It becomes part of the park's ONE shared graph, so guests really walk it and queue tails may land on it.
   - `plazas` / `bins` — the paving rects and bin spots `<Paths>` renders (bins get their manager registration for free).
   - `cells` — every cell the piece paves or places on, for `<Terrain keepDry>`.
   - `footprint` — ONE `ParkFootRect` OBB covering the piece, for validatePark's footprint sweep + the coaster-corridor SAT sweep.
   - `reserve` — whether the component registers that OBB (land-owning pieces: yes; street-like pieces: no).
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
   - a lint pass reports diagonal edges and disconnected islands (`NET.warnings`, also `console.warn`ed).

   Lookups: `NET.node([x, z])` → index of a world cell, `NET.port('hub:E')` → index of a port (throws if it was pruned), `NET.pruned`.

3. **The component takes the plan and nothing else.**

   ```tsx
   <FountainPlaza plan={HUB} />
   ```

   Ports, footprint, keepDry cells, stall anchors and the mounted visual therefore all derive from the SAME numbers — they cannot disagree. Declare set-pieces **after `<Paths>`** (their dressing settles onto the paving through `park.floorAt`).

## Exports

- `fountainPlazaPlan` / `bazaarPlan` / `boulevardPlan` live in their OWN component folders (`components/FountainPlaza`, `components/Bazaar`, `components/Boulevard`).
- `buildParkNet(input) → ParkNetResult` — the street fuser above.
- `makeSetPiecePlan(spec) → SetPiecePlan` — the shared half of a plan (local sub-net + ports + plazas + footprint → world). **Write a new set-piece by calling this**, then extend the result with your own resolved dressing anchors.
- `setPiece(displayName, build) → React.FC<SetPieceProps<P>>` — the component factory. The build runs in WORLD coordinates (the group mounts at the origin) so each item can settle on its own surface; inside a real `<Park>` it registers `plan.footprint` unless `reserve: false`, which also pulls the terrain guard clamp (AUTO-keepDry) under the piece so it can never sit in water or on a bulge.
- Dressing language shared by the whole family: `setPieceLamp` (iron post + night-gated lantern + optional PointLight + a `hook` for spans), `setPieceSpan` (bulb-capped festival span between two REAL hooks), `setPieceBench`, `yawToward`.
- Lattice helpers: `CELL` (1.2), `snapCell`, `snapXZ`, `quarterTurns`, `quantYaw`, `rotateXZ`, `hash01`.
- Preview staging: `setPiecePaving(plans, opts)` → a `<ScenePreview dress={…}>` callback that renders the paving a real park's `<Paths>` would render (port stubs included). `buildPortMarkers` / `<PortMarkers plans>` → the debug overlay (gold port posts + arrows, red footprint corners).

## Rules for a new set-piece

- Rotations are quantized to quarter turns and local offsets are lattice multiples, so rotated coordinates stay EXACT (no float drift into off-grid nodes).
- A port is always one cell outside the footprint; a piece that owns land reserves its OBB, a piece that is a street does not (a reserved street would "overlap" every queue lane that legitimately tails onto it).
- Interior traffic must route AROUND obstacles (the plaza's ring, not a cross through the fountain), so every port can reach every other port.
- Register everything: stalls through the catalog stall components (`register`, unique names), bins through `plan.bins`, the footprint through `setPiece`.
- Deterministic only — hashed sine (`hash01`), never `Math.random` / `Date.now`.
