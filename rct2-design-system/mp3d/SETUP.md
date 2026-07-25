# SETUP — building scenes and parks with the RCT2 3D rigs

The end-to-end manual: everything a new composition needs, from a single
spinning ride to a full simulated park. Component-specific detail lives in
each `components/<Name>/Context.md`; park composition principles live in
`rules/park-generation.md` (start at its §0 pre-flight checklist — all
validator/probe warnings are FATAL); UI placement rules in `rules/ui.md`;
the asset shipping gate in `rules/asset-testing.md`.

## 0. The shipping gate (rules/asset-testing.md)

**Every new or changed 3D asset MUST be screenshot-tested before it ships.**
Render it with the harness (`/tmp/mp3d-render`, `node render.mjs <Name>
[--night] [--angle=deg]`) in **day + night + at least one alternate angle**,
score the renders **/100** on looks, mesh richness, detail, texture+bump
usage and placement continuity (rides also score the seat rubric: no rider
clipping, cushioning, restraints, seat placement), then fix and re-render
iteratively. **An asset cannot ship until it scores 100/100.** Previews must
be deterministic and must transpile through esbuild. Full rubric + harness
rebuild steps (`npm i three@0.169 react react-dom esbuild playwright; npx
playwright install chromium`): `rules/asset-testing.md`.

## 1. Stage — the shared viewport

The Stage is the render surface — but **catalog components never render one**.
Only two owners render a `<Stage>`: `<Park>` (real compositions, §5) and
`<ScenePreview>` (the host every `*.previews.tsx` wraps components in, §5.1).
You still write `build`-style code inside builders and ScenePreview `dress`:

```tsx
import { Stage, box, cyl, ball, mat } from './components/Stage';

<Stage
  distance={12}        // orbit radius (also scales fog + ground disc)
  targetY={0.5}        // orbit target height
  background="#9ec7d8" // sky colour (fog matches)
  ground={true}        // grass disc — turn OFF for terrain/water scenes
  autoRotate={true}    // parks turn this OFF (see §7)
  night={false}        // start in night mode
  height={340}         // default only — the canvas tracks its wrapper (ResizeObserver)
  fullscreen={false}   // parks turn this ON: 100% x 100vh, no radius (see §5)
  groundAt={heightAt}  // terrain-follow clamp — the camera can't clip underground
  fog={true}           // true = default haze | false | { near, far } — a custom
                       // far also tightens the camera far plane (real culling, §13)
  build={(t, g, api) => {
    // t = the THREE namespace, g = your scene group, api = StageApi (§2)
    g.add(box(t, [1, 1, 1], 0x7d2e28, [0, 0.5, 0], { tex: 'wood', repeat: [2, 2] }));
    return (time) => { /* per-frame updater */ };
  }}
/>
```

Stage provides: renderer + PCFSoft shadows, warm sun + hemisphere rig, a
night rig (moon + park floods), drag-orbit camera, fog, the day/night
toggle button (top-right, always), and disposal on unmount.

**Geometry helpers + procedural textures.** `box(t, dims, color, pos, opts)`,
`cyl(t, rTop, rBot, h, color, pos, opts)`, `ball(t, r, color, pos, opts)`,
`mat(t, color, opts)`. `opts.tex` picks a procedural canvas texture — `wood |
metal | asphalt | leaf | fabric | concrete | grass | plastic | sand` — with
`repeat: [rx, ry]`, paired bump maps (`bump`), plus `rough / metal / flat /
emissive / opacity / rotX / rotY / rotZ`. No external image assets, ever.
For MANY static boxes sharing one material, use `mergedBoxes(t, specs, color,
opts)` instead of N `box()` calls — one mesh, one draw call (§13).

## 2. StageApi — the third build argument

```ts
interface StageApi {
  scene; camera; renderer;
  addViewport(cam, rect, opts?): () => void; // extra scissor viewport, returns disposer
  setCameraPose?(pos, target?): void;  // re-aim the main orbit camera
  setGroundSampler?(fn): void;         // runtime terrain-follow clamp (like groundAt)
  onPick?(cb): () => void;             // click-pick registration (§7)
  stats?(): { drawCalls, triangles, fps }; // last-frame render totals (§13)
}
```

- **`addViewport(cam, { x, y, w, h }, opts?)`** — normalized rect from the
  canvas TOP-LEFT; rendered after the main view each frame. ALL insets render
  at a 4:3 pixel aspect: build the rect with `rect43(x, y, w, canvasAspect)`
  and cover it with a `ViewportFrame` (UIWindow) — RideViewer and PlayerCam
  do this for you. `opts.hide: [objects]` hides the listed roots (descendants
  too) during THAT viewport's render pass only — `attachPlayerCam` passes the
  vehicle so onboard/chase POVs aren't blocked by the car itself.
- **`setCameraPose(pos, target?)`** — teleports the orbit camera (ParkInfo's
  click-a-ride does this); dragging keeps working afterwards.
- **`setGroundSampler(fn)` / the `groundAt` prop** — terrain following: with
  a sampler set (e.g. TerrainKit's `heightAt`), the camera is clamped every
  frame to y ≥ ground + 0.35 and the orbit target to y ≥ ground + 0.15,
  smoothed (instant push-up, lerped release) — the view can never clip under
  terrain or walls. Set it on every terrain scene.
- **`onPick(cb)`** — raycasts CLICKS (not drags) into the scene, walks up
  the parent chain from the hit mesh and delivers the first ancestor whose
  `userData` carries `rideRef` or `guestRef` (§7).
- **Keyboard navigation** is always live (key-repeat safe, no page scroll):
  **↑ ↓ / W S** glide the view (orbit target + camera) forward/back along the
  camera's ground-plane heading, **← → / A D** strafe — Minecraft-fly hands,
  speed scales with camera distance; **Space / Shift** fly UP / DOWN
  (~2.2 units/s); **drag** orbits; **scroll wheel** dollies from a
  first-person eye (0.9 units off the player pill) out to ~3× the stage
  distance. The canvas is responsive — it tracks BOTH dimensions of its
  wrapper, so parents may stretch it.
- **`api.player`** — the invisible player PILL (capsule): it stands on the
  view target and IS "the user" in the scene — WASD moves it, the terrain
  clamp keeps its feet dry, the camera orbits it and wheel-zooms down to its
  eyes. Never rendered, never click-captured; probe its position for
  player-aware logic.
- **Guest player camera (§7):** clicking a guest opens GuestInfo WITH a live
  follow-cam inset (bottom-left 4:3, ViewportFrame) and a **Walk with
  guest** first-person toggle. Every peep carries an invisible body-capsule
  click proxy, so guest clicks land reliably even mid-stride.

## 3. Day/night — nightKOf

The Stage writes the day→night factor onto your build group every frame:
`group.userData.nightK` (0 = day, 1 = night, smoothly lerped). Components
read it with `nightKOf(anyObject)` (walks up the parents; 0 when unmounted).

**Lights stay OFF until dark.** Every PointLight / emissive lamp gates its
intensity on `nightKOf` — string lights, path lamps, vehicle headlamps
(`gateCarLights`), NeonSign and DanceFloor already do. Daytime = intensity 0
with a faint glass tint. Keep real PointLights ≤ ~4 per component; prefer
emissive materials for the rest.

## 4. Building a scene

1. Model from the matching RCT2 sprite (all 4 rotations) — silhouette and
   part breakdown; realistic colours only (muted brick red, forest green,
   navy, cream, silver, grey-brown — never orange/pink plastic).
2. World units: 1 unit ≈ one tile edge; a guest is ~1.1 tall (0.5 scale
   seated). Bases at y = 0; settle to `terrain.heightAt` when terrain exists.
3. Reuse the shared builders — never re-invent: `buildPeep` (Guest) for every
   human, `buildWater` (WaterTile) for ALL water, `buildCoasterCar` for
   coaster trains, `buildTerrain` for ground, `tree`/`bench`/`lamp` (Kit),
   `buildRock`/`buildRockCluster`, `buildPathNetwork` + `attachWalkers` +
   `buildCrowd`, `buildStringLights` + `buildLightPole`.
4. Animate what the ride animates; return ONE updater from `build` and fold
   sub-updaters into it.

## 5. The park workflow — compose with `<Park>` (React first)

**YOU compose every park — there is no `generatePark`.** The primary surface
is the REACT COMPOSITION API (`components/Park`): a whole park as JSX on ONE
shared canvas. The composing flow is: seed a `<Terrain>`, lay `<Paths>`,
declare the `<GameManager/>`, mount the `<Gate>` (the park entrance), then
creatively place rides and attractions straight from the catalog by just
adding them — `<FerrisWheel position rotation register />`. **If it's in
the catalog, use the component** (full inventory: recipe book §0) — a
custom one-off carousel/teacups/tree built from raw primitives is a defect,
not creativity; trees/rocks come from Kit (`tree`/`rock`), scenery from
SceneryPack, colours from ColorKit (`rideColourPreset` lives in ColorKit,
NOT SplineRideKit), `compileTrackPieces` from SplineRideKit. `<Park>` renders
the single Stage (full-screen by default, autoRotate off, fog,
terrain-clamped camera); once a `<GameManager/>` is declared ALL the game
logic comes for free — guest spawning/needs, every ride's FSM + breakdowns,
queue flow, purchases, clickability + the UI-window suite (ride click →
RideViewer with live/onboard cams, guest click → GuestInfo, ParkInfo
bottom-right) — and `validatePark` runs once the children settle:

```tsx
import { Park, GameManager, Terrain, Paths, Gate, Coaster, Fountain,
         Restroom, Neon, Scenery, Lights, Placed } from './components/Park';
import { FerrisWheel } from './components/FerrisWheel';
import { BurgerShop } from './components/BurgerShop';
import { Torch } from './components/Torch';

<Park seed={7} climate="temperate" size={16} guests={10}  {/* compact demo — OMIT size for the expansive 48 default */}
      onReady={(report) => { /* report.ok MUST be true */ }}>
  <Terrain keepDry={KEEP_DRY} coasterPts={COASTER_PTS} />   {/* probed landform + lake */}
  <Paths nodes={NODES} edges={EDGES} plazas={[PLAZA]} walkers={4} bins={[[1.5, 2.4]]} />
  <GameManager />                                           {/* the sim brain — declare it */}
  <Gate />                                                  {/* sole guest spawn */}
  <Coaster name="Timberline Run" points={COASTER_PTS} type="wooden" capacity={3}
    queueTailNode={12} queueDir={[0, -1]} exit={[-3.6, 1.2]} exitDir={[1, 0]} deck={[-4.31, 0]} />
  <FerrisWheel position={[6.69, -2.4]} rotation={-Math.PI / 2}
    register={{ name: 'Grand Wheel', capacity: 4, price: 3 }} />  {/* catalog ride, one line */}
  <BurgerShop position={[3.0, -0.5]} rotation={-Math.PI / 2} register price={3} value={5} />
  <Fountain /> <Restroom position={[-1.2, 4.8]} rotation={Math.PI / 2} />
  <Torch position={[1.65, 4.05]} /> <Neon text="ARCADE" position={[3.6, 1.7, -6]} rotation={Math.PI} />
  <Scenery name="planterBox" position={[1.65, 0.75]} />
  <Lights from={[-0.95, -1.2]} to={[0.95, -1.2]} />
  <Placed build={(t) => tree(t, { shape: 'pine' })} position={[-2.8, 4.6]} />
</Park>
```

- **The default plot is EXPANSIVE — size 48** (nine 16-parks of land; sizes
  up to 96+ compose and validate). USE it: spread 4+ rides into districts
  anchored on the composition's flat fields (the seed table lists two
  meadows per seed), link them with long approach boulevards, and give
  every ride breathing room — the minimum 6-u pitch is a floor, not a
  target. Terrain mesh density, hills/water/flat-zone counts, the fog +
  ride-runtime LOD (auto beyond size ~20-24) and the validators all scale
  with size; the 1.2 street lattice is unchanged — there are just more
  cells. Pass a smaller `size` only for deliberately compact scenes.
- **Composition order is mount order** (sibling effects run in JSX order):
  `<Terrain>` → `<Paths>` → `<GameManager>` → `<Gate>` → rides/stalls/
  amenities → scenery — the same order as the imperative recipe. Wrappers
  throw when a prerequisite is missing.
- `position` props are `[x, z]` (y settles onto the plaza/terrain) or
  `[x, y, z]`; `rotation` is Y yaw. Everything is deterministic off
  `<Park seed>`; prop changes REMOUNT the object (manager registrations
  can't unregister — remount the whole `<Park>` via `key` to change sim
  config).
- The Park wrapper set: `GameManager, Terrain, Paths, Gate, Coaster,
  FlatRide` (generic flat ride from your builder), `Placed` (escape hatch
  for ANY built group), `Stall` (balloon — `sell` makes it a REGISTERED
  selling stall like any catalog stall; `sell` alone uses the kind's
  defaults), `Restroom, Fountain, Torch, Neon,
  DanceFloorR, Scenery, Lights` + the `usePark()` hook (`{ three, root, api,
  addObject, manager(), ground, paths, composition, groundAt, floorAt,
  registerFootprint, registerCoaster }`) for custom children. A bare
  `<Gate/>` defaults to the lattice cell hugging the FRONT terrain edge
  (z = `1.2·round((size/2 − 0.8)/1.2)`: 22.8 on the default 48, 7.2 on a
  compact 16), facing out — keep a street node under it. Details:
  `components/Park/Context.md`; JSX worked example: the Park preview
  (`Park.previews.tsx`, `DemoPark`, `validatePark ok: true`).
- **Every catalog component is composable too** (§5.1) — rides, stalls,
  tiles, scenery scenes all mount with `position/rotation/scale` inside a
  `<Park>`.

**PARK PRE-FLIGHT — static arithmetic, do it before finishing (full list +
footprint table + canonical imports: rules/park-generation.md §0).** Any
`validatePark` failure or guard-probe / grid / closure / `placeAccess`
warning is FATAL — re-lay the layout. On paper: everything inside ±size/2,
summed with the piece run-length table (recipe book §4 — lifts/drops run
≈ 1.6 + 3.9×height, far longer than they look); the last coaster piece
heading within ~30° of the STATION ENTRY heading (the direction you left
the station on) AND within ~3 u of the start — alignment, not "pointing at
the station"; capacity-4 rides
≥ 6 u centre-to-centre (queue lane = `1.8 + 0.35×capacity` + 0.35 to a
street node, exit hut at local `[-1.5, 1.35]`); `rideDuration ≤ 12` (the
60 sim-s acceptance window must fit one full cycle); path level hugs the
MEDIAN node ground (bulge nodes get moved or a `nodeY` ramp — never a
street-long berm); gate within ~1 u of the front edge facing OUT; imports
from the canonical block (never a `build<Name>Scene` preview builder inside
a park, never `FerrisWheel` from `'./Park'`); Neon `scale` 0.4-0.7; ≥ 12
trees, ≥ 6 scenery pieces, ≥ 1 stall per 2 rides, exactly ONE water body
≤ ~12% of the park area; and the TRACK CORRIDOR rule — list every cell
within 0.8 u of the compiled coaster polyline (a 1.6-u corridor): no street
edge, stall or other ride's pad/hut/lane may sit there unless the track is
≥ 2.2 u above it (grade crossings / roof-skims FAIL `validatePark` with a
`corridor` failure; the ride's own station/lane is exempt) — COPY the
published per-archetype corridor CELL TABLES + the pinned-seed composition
table (rules/park-generation.md §1 seed table, §4 cell tables) instead of
deriving either by hand.

**ROUND-5 RUNTIME SELF-HEALING (safety net — every use is a warning, not a
licence):** once all `<Park>` children have mounted (before guests spawn and
before `validatePark` reads anything) the settle pass (1) auto-shifts any
MOVABLE stall/flat-ride rig whose registered footprint landed inside a
coaster's 1.6-u track corridor — outward along the least-move axis to the
first clear cell (≤ 4 cells; exit-hut-only relocation and queue-lane trims
as fallbacks; pass `pinned` on the component to opt out; streets and
coasters never move) — then (2) runs AUTO-keepDry: `reclampTerrain`
re-clamps the ground under EVERY registered footprint (derived/trimmed/
flipped/shifted rigs included) + the as-built circuits, and `<Terrain>`
rebuilds mesh/colours/heightAt in place. Authors' `keepDry` lists are a
hint, not a requirement. The water-fraction guard keeps the ONE water body
at ≥ ~3% of the plot through all clamping (steep-bank raises + probed
edge-basin regrowth). Tooling: `manager().corridorCells(name?)` lists the
live corridor cells of any registered circuit.

### 5.1 Componentized catalog — the composable convention

Every catalog component exports ONE React component that COMPOSES. No
component renders its own `<Stage>` — a component mounts its built group
into the surrounding scene context and renders null; `*.previews.tsx` files
wrap components in the `<ScenePreview>` host to reproduce the classic
standalone staging. The whole convention lives in `components/Park`:

- **`useComposable(build, { position, rotation, scale, deps }) → boolean`** —
  the primitive hook: inside a `<Park>`/`<ScenePreview>` it builds once,
  mounts via `addObject` with the prop transform, disposes on unmount and
  REMOUNTS on any prop change (`deps` is the extra remount key). Returns
  false outside any scene context (the component renders nothing).
- **`composable(displayName, build, cfg?)`** — the factory most components
  use: `build(t, props, park) → Group | { group, update?, dispose? }`.
  `cfg.props` are defaults; `cfg.compose(park, { built, props, position,
  rotation, scale })` is the registration hook (real parks only — skipped
  under a preview host), returning an optional cleanup.
- **`<ScenePreview distance targetY autoRotate ground background night height
  fog groundAt dress>`** — the preview Stage host. `dress(t, g, api)` builds
  the staging AROUND the composed children (plaza discs, camera poses via
  the StageApi) and may return an updater. Previews look exactly like the
  old per-component Stages — same props, same pixels.
- **`<ConfigurableRide build layout register name capacity rideDuration
  loadTime intensity price queue position rotation scale>`** — the universal
  ride chassis EVERY catalog ride delegates to (via the `composableRide`
  factory). When `register` is set inside a real `<Park>` it wires the whole
  GameManager life in one place: the RCT2 ride FSM (waiting → departing →
  travelling → breakdowns/repairs, with the builder's `onStateChange` hook
  spinning the visual down and back up), queue lane + entrance/exit huts
  derived from position+rotation (`layout`: queue HEAD `front` out the local
  +z face — default 1.8 — exit hut at local `exit` — default `[-1.5, 1.35]`
  — boarding at local `board`), `groundRideAccess` berms, real riders in the
  vehicle when the builder exposes `seatWorld`, crash wiring via `crashed`,
  and clickability (`userData.rideRef` → RideViewer; `vehicle` → the onboard
  cam). `queue={{ anchor, dir }}` overrides the derived lane in world space;
  lane LENGTH always follows `capacity` (`laneLenOf`). Place the ride so the
  lane TAIL (`front + laneLenOf(capacity) + 0.35` out the +z face) lands on
  or near a street node — the manager attaches it to the network.
- **`<ConfigurableStall build stall register name price value>`** — the shop
  counterpart (via `composableStall`): registers a selling stall; the
  serving front faces local +z (attach point 0.72 out), so aim `rotation`
  at the customers' path.
- **Exemplars to copy:** `FerrisWheel` (full ride: seatWorld gondola riders,
  FSM spin-down, onboard-cam vehicle, layout geometry documented),
  `BurgerShop` (selling stall + `withGuest` preview flavour), `Torch`
  (simple composable + rich preview `dress`), `GrassTile` (minimal).
- The demo park (`Park.previews.tsx`) composes `<FerrisWheel register>` +
  `<BurgerShop register>` + `<Torch>`es alongside the classic wrappers and
  ships `validatePark ok: true`.

**Migration checklist** (how any remaining/new component joins the fleet):

1. **Extract the builder** — `build<Name>[Scene](t, opts?) → { group,
   update? }`, group based at y = 0, deterministic, everything the old Stage
   build did (merged meshes, instancing, `nightKOf(group)` night gates).
   Rides also expose `seatWorld` / `vehicle` / `onStateChange` / `crashed`
   where they can.
2. **Componentize** — `export const <Name> = composable('<Name>', …)` (or
   `composableRide` with a `layout` + register defaults / `composableStall`
   with sale defaults). Keep every existing export working.
3. **Previews use the component** — wrap in `<ScenePreview>` with the SAME
   Stage props as before; move any extra staging into `dress`. Only preview
   files (and Park/ScenePreview) may touch `<Stage>`.
4. **Cleanup audit** — remove dead code/unused imports/redundant exports;
   esbuild the previews; screenshot day + night standalone AND composed in a
   park (the §0 shipping gate still applies).

**Track piece composition.** Track-based rides compose from PIECES,
RCT2-style — two equivalent syntaxes, compiled to spline control points by
SplineRideKit's `compileTrackPieces` under the hood:

```tsx
// pieces ARRAY (bare names take all defaults)
<LogFlume position={[4, -3]} pieces={['station', { type: 'lift', height: 1.2 }, 'turnL', 'drop', 'turnL']} />
// JSX piece CHILDREN (children WIN when both are given)
<TrackRide profile="coaster" type="steel" position={[-1, -7]}>
  <Station /><Lift height={1.6} /><TurnR /><Drop /><TurnR /><Hill height={0.7} />
</TrackRide>
```

- **Vocabulary** (every piece starts and ends LEVEL, so pieces chain
  freely): `station` (flat straight marking boarding — make it FIRST),
  `flat`/`straight` (`length`), `lift` (`height` — rampPoints-eased climb,
  legal pitch by construction), `drop` (`height`, default back to station
  level), `hill` (camelback, `height`/`length`), `turnL`/`turnR` (`angle`
  default 90°, `radius` default 1.5), `helixL`/`helixR` (`angle` 360°,
  `height` eased along the arc), `corkscrewL`/`corkscrewR` (a real inverting
  loop — **steel coasters only**; wooden warns per the RCT2 whitelist, water
  profiles substitute an sbend), `sbend` (`length`; `radius` = lateral
  offset, +ve left).
- **JSX components** (from `components/Park`): `<Station/> <Straight/>
  <Lift/> <Drop/> <Hill/> <TurnL/> <TurnR/> <HelixL/> <HelixR/>
  <Corkscrew dir="L"|"R"/> <SBend/>` — pure descriptors (they render null);
  props `length/height/radius/angle` mirror the array form.
- **CLOSURE semantics**: the cursor starts at the local origin heading +z
  and walks the pieces; wherever they end, the compiler CLOSES the circuit
  legally (RCT2 refuses an unclosed circuit) — an eased ramp back to station
  height, then the shortest arc–straight–arc return (radius 2.2 for
  coasters, 1.5 other profiles) onto the START POSE: the start point AND
  the heading you left the station on. Coaster closures land via a
  synthesized 1.2-u straight BRAKE TAIL before the station (round-4: an arc
  welded straight onto the station read a lateral-G spike at the wrap). End
  your pieces heading within ~30°
  of that ENTRY heading and within ~3 u of the start — HEADING ALIGNMENT,
  not "pointing at the station". A synthesized closure over 40% of the
  authored length is FATAL: the ride renders translucent red and is NOT
  registered. **When YOUR OWN pieces reach the start (nothing synthesized),
  the last piece must be a straight brake tail ≥ ~1.2 u along the station
  axis, landing ~0.3 u short** — landing from a turn leaves the station
  weld curved + unbanked at full speed and the crash replay FAILs it (the
  compiler warns "lands on the station from a curve"; warnings are FATAL).
  The recipe book's §4 archetypes are re-verified WITH this tail through
  the full validatePark gate (wooden AND steel, lift 0.6/0.7/1.0). Budget with the run-length table (recipe book §4): station
  2.6, straight default 1.3, lift/drop ≈ 1.6 + 3.9×height (auto-extended —
  short `length` ignored), hill default 6.0, 90° turn = R forward + R
  sideways, helix 360° returns to its entry point, corkscrew 2.4, sbend
  3.6. **Closure-synthesized pieces COUNT toward the park bounds** — land
  the last authored leg ~0.3 u SHORT of the start (overshooting it makes the
  return loop wrap around outside the park: fatal). Coaster banking
  SATURATES at the type's bankLimit (`coasterBankCap` — wooden 25°,
  steel 55°), so the default bank is legal on every type.
  `checkCoasterDesign` + `validateSpline` ALWAYS run on the result;
  the full report lands in the console and on `group.userData.trackReport`.
  Prefer PIECES mode; points mode gets no leniency — raw `points` circuits
  face the same fatal gate without the grammar's by-construction legality.
- **Where it plugs in**: `<Coaster pieces|children start heading>` (park
  coaster — same queue/hut/register machinery; `type` gates corkscrews;
  compile once up front and pass the points to `<Terrain coasterPts>` so
  the landform is pre-capped under the circuit — recipe book §4; `start`
  accepts `[x, z]` or the same `[x, y, z]` you gave compileTrackPieces),
  the generic `<TrackRide profile='coaster'|'flume'|'rapids'|'bobsled'>`
  (works in `<ScenePreview>` too; default vehicles per profile, `register`
  for the full sim), and `<LogFlume/> <RiverRapids/> <Monorail/>
  <Bobsleigh/>` all accept `pieces`/piece children on their own profiles
  (Monorail turns its shuttle into a closed-loop beam). **Defaults are
  unchanged when no pieces are given.** Worked demo: SplineRideKit's
  "Track pieces" preview.

**The imperative path underneath.** Every wrapper is a thin layer over the
builders, and a custom composition can still write the `build` by hand (the
ParkBuilder preview, `buildExamplePark`, is the imperative worked example).
The skeleton is always compose → validate:

```tsx
const comp = parkComposition(t, seed, 16, climate, { keepDry, coasterPts }); // probed landform (guards POST-ENFORCED: wet/bulging guarded cells are clamp-terraformed; comp.report.violations is post-clamp)
const terrain = buildTerrain(t, { size: 16, seed: comp.terrainSeed, peaks: [...comp.peaks, ...comp.clampPeaks], basins: [...comp.basins, ...comp.clampBasins], waterLevel: -0.26, ... });
tintTerrainForClimate(t, terrain.mesh, comp.climate, comp.basins); // + ONE buildWater sheet
const gate = buildParkEntrance(t); // centred on the flat apron
const net = buildPathNetwork(t, parkNet, { grid: true, plazas, ... }); // YOUR lattice skeleton
// ...rides (buildRideSpline + flat-ride podiums), stalls, amenities, scenery,
// all registered with ONE createGameManager (gate = sole spawn)...
const report = validatePark(t, { net: parkNet, manager: mgr, terrain, coasters, group: g });
// report.ok MUST be true before the park opens — log the report.
```

Pick a CLIMATE → `parkComposition` (guarded by YOUR planned cells) +
`buildTerrain` + ONE `buildWater` → `buildParkEntrance` on the flat apron →
your lattice street skeleton (`snapNetToGrid`, `buildPathNetwork` with
`grid: true` + `plazas`, `nodeY` ramps only where a spur must climb,
`bermNetToGround` under everything) → 2-4 themed lands (rides in-zone,
ColorKit presets per zone, climate species mix) → register everything with
ONE GameManager (`planRideAccess`/`groundRideAccess` for queue assemblies) →
run `validatePark` LAST; it must report `ok: true`. `<Park>` does all of
this wiring for you — drop to the imperative layer only when a layout needs
something the wrappers don't express (then wrap it in `<Placed>`/`usePark`).

**Parks render FULL-SCREEN** either way: `<Park fullscreen>` is the default;
a hand-rolled Stage must set `fullscreen` and pass the terrain's `heightAt`
as `groundAt` so navigation can't clip underground.

## 6. GameManager — the simulation brain

```ts
const mgr = createGameManager(t, { groundAt, net, laneY, bins });
g.add(mgr.group);
mgr.registerParkEntrance(gate);            // the SOLE spawn/despawn point
const h = mgr.registerRide({ name, capacity, rideDuration, intensity, price,
  queueAnchor, queueDir, boardPoint, exitPoint, seatWorld?, vehicleHandle? });
mgr.registerStall({ name, item: 'food', price, value, anchor, dir });
mgr.registerRestroom({ anchor, yaw });
mgr.spawnGuests(10);
// per frame: mgr.update(time, dt)
```

Give it the SAME `{nodes, edges}` object the PathNetwork rendered — guests
walk ONLY on that graph. It builds queue lanes + entrance/exit huts, runs the
RCT2 vehicle status cycle and guest needs/queue/purchase/litter logic, audits
hut/lane/pad footprints (`placeAccess`), and models deterministic breakdowns.
Accessors for UI + validation: `stats()`, `guests()`, `rides()`,
`accessPoints()`, `footprints()`; ride handles expose `status() /
queueLength() / occupancy() / totalRides() / boardPoint() / exitPoint()`.

**BLOCKERS (round-6) — guests do not walk through solid objects.** Every solid
thing registers a world-space OBB/circle: `mgr.registerBlocker({ rect | circle,
label, kind?, owner?, pad?, height? })` → `{ remove, move, set }` (from a Park
child: `usePark().registerBlocker(spec)`). Rides/stalls register their pad,
body and queue railings automatically; `<Fountain>`, `<Restroom>` and every
`<Fence>` run register themselves. Path edges crossing a blocker are refused by
the routing layer, off-network hops slide along the edge, and `validatePark`
gains a `blockers` check (no street through a blocker, every queue tail
reachable). Read side: `blockers()`, `blocked(x, z, opts?)`,
`blockerDepth(x, z, opts?)`, `edgeWalkable(a, b)`.
Full mechanics: `components/GameManager/Context.md`.

## 7. UI windows + clickability

All overlay UI lives inside a `position: relative` wrapper around the Stage
(rules/ui.md; pixel icons from UIIcons only).

- **Clickability tags:** the GameManager tags every guest group
  `userData.guestRef = () => liveRecord` automatically; YOU tag each ride's
  visual group `userData.rideRef = registerRide handle` (and optionally
  `userData.rideVehicle = a train car` for the onboard cam). Stage `onPick`
  then delivers the tagged ancestor on click.
- **RideViewer** — the RCT2 ride window: colour-coded status line, queue /
  riders / customers, plus a LIVE 4:3 camera inset (bottom-left,
  `ViewportFrame`d) orbiting the boardPoint; with `vehicle` set, the
  "View ride" button switches it to an onboard chase cam.
- **GuestInfo** — six RCT2 stat bars + the 5-slot thoughts ring; poll the
  picked guest's accessor every ~300 ms for a live window (never per frame).
- **ParkInfo** — bottom-right, collapsible (mandatory); one row per
  registered ride (status dot + queue), click a row to `setCameraPose` to
  that ride.
- **PlayerCam** — `attachPlayerCam(t, api, vehicle, { mode: 'onboard' |
  'chase' })` for a rider's-eye inset on any vehicle. The vehicle goes on the
  inset's hide list automatically (override with `hide: [...]` — e.g. the
  whole train for a chase cam) so the POV shows the track ahead; cover the
  rect with a `ViewportFrame` like every inset.
- **One floating window at a time** (RideViewer or GuestInfo); ParkInfo may
  stay mounted. Never cover the top-right day/night switcher.
- **Parks hold the camera still** — `autoRotate={false}` on the ParkBuilder
  example park and the GameManager preview; navigation is drag / arrow keys /
  ParkInfo teleports. (Single-rig showcases may keep the slow auto-orbit.)

## 8. ColorKit — RCT2 ride colour schemes

`rideColourPreset(seed, type)` with `type: 'wooden' | 'steel' | 'water' |
'kart'` rolls a real RCT2 TRACK_COLOUR_PRESETS entry → `{ track: { main,
additional, supports }, vehicles: [{ body, trim }...] }`. In parks, seed it
`seed + zoneIndex` so each themed land rolls its own scheme, and thread it
through `buildRideSpline({ colours, vehicleSchemes })`, `buildCoasterCar(t,
variant, scheme.vehicles[0])` and flat-ride dressings. `RCT2_COLOURS` is the
full Colour.h palette; `shade(c, f)` derives trims. Never invent ride hexes.

## 9. ParticleKit

`buildEmitter(t, { max, rate, life, lifeVar, velocity, spread, gravity,
size, sizeEnd, color, colorEnd, opacity, additive })` → `{ points, update,
burst(n, origin?), setOrigin, setRate, dispose }`. One `THREE.Points`
ring-buffer per emitter — splashes, smoke, sparks, fountain spray, the
vomit burst; `additive: true` for fire/glow. Deterministic (hashed
sequences). Add `points` to your group and fold `update` into your updater.

## 10. Catalogs — SceneryPack, NeonSign, DanceFloor

- **SceneryPack** — `buildScenery(t, name, { scale?, seed? })` /
  `buildSceneryAnimated` (some pieces return an updater). `SCENERY_NAMES`:
  marbleStatue, birdbath, picnicTable, planterBox, topiarySpiral,
  topiaryElephant, signpost, tvMonitorPost, parkClock, flagpole,
  ironArchway, brickWall, picketFence, lionStatue, cactusCluster, fallenLog,
  mushroomCluster, wishingWell, gazebo, hotAirBalloon.
- **NeonSign** — `buildNeonSign(t, { text | path, color, secondary, scale,
  backboard })` → emissive tube lettering (16-seg vector font, or any SVG
  path string) that flickers on at night. Marquee flavour for boardwalk
  stalls and plaza gates.
- **DanceFloor** — `buildDanceFloor(t, { size, tile })` → beat-synced disco
  tiles + DJ booth (night-gated), `floorTopY` for placing dancers
  (`buildCrowd` with `dance`). Plaza/boardwalk flavour — at most one per park.

## 11. Validators — nothing ships unchecked

- **`validateSpline(t, curve)`** (SplineRideKit) — self-intersection /
  clearance ≥ 0.9 on every composed spline.
- **`checkCoasterDesign(t, points, { type, bank })`** — RCT2 construction
  rules: per-type slope/bank whitelists, windowed pitch-rate (one grade step
  per 1.2-unit tile), bank-rate, a real station flat. Failing violations =
  re-author; `shortDrop`/`shortLength` are stat-gate warnings.
- **Crash physics are the last validator** — guarded profiles derail past
  1.5 g lateral (no-upstop check) and station-brake failures ram the parked
  train; `handle.crashed()` feeds the GameManager.
- **`placeAccess`** (inside registerRide) — SAT footprint audit of huts,
  queue lanes and pads; heed its warnings.
- **`validatePark(t, { net, manager, terrain, coasters, group, rebuild? })`**
  (ParkBuilder) — the park acceptance gate: accessibility, terrain vibe
  (ONE water body, flat apron, hills clear), footprint sweep, coaster
  legality + crash margin, the track-CORRIDOR sweep (a 1.6-u corridor along
  every registered circuit must clear stalls, other rides' access rects and
  street edges unless the track flies ≥ 2.2 u above them), a 60 sim-s
  GameManager smoke run, the area-scaled mesh budget (a warning, fatal by
  policy) + double-build determinism hash, plus the ROUND-6 gates: a hard
  `bounds` check over every audited footprint corner AND every
  GameManager-derived queue-tail/exit attach node; a `scenery` check (nothing
  `<Scenery>`/`<Placed>` may stand in the water or inside a path slab — plaza
  dressing exempt); a STRICT corridor re-audit against each obstacle's own
  roof (a relocated hut under the rails now FAILs); and `autofix` — every
  build-time auto-fix (`queueDir` flip, causeway, corridor shift, relocated
  exit hut) is a §0-FATAL failure instead of a console whisper.
  `{ ok, failures: [{ check, detail }], warnings: [{ kind, detail, fatal }] }` —
  ship only `ok: true` WITH an EMPTY `warnings` array; every failure is FATAL
  (re-plan the layout) and every warning is an auto-fix that rescued something
  you were supposed to plan.
  Details: rules/park-generation.md §6; static pre-flight: §0.

## 12. Determinism rules

- Hashed-sine PRNGs ONLY (`hash01(n) = fract(sin(n·12.9898 + 78.233) ·
  43758.5453)` keyed by seed/index/counter). Never `Math.random`, never
  `Date.now` — the same seed must rebuild the identical park, byte for byte
  (validatePark's double-build hash enforces it).
- Time comes in through the updater argument; derive everything per-frame
  from it (clamp dt like the GameManager does).
- Keep previews deterministic too — the render harness screenshots them.
- Budget: a whole park well under the area-scaled mesh budget (~2500 per
  16² of plot — ~22 500 on the default 48); single rigs far less. Cache
  textures (Stage does), build held/reused meshes once, cap particle rings.

## 13. Performance

What the Stage and the Park ride runtime do for you, and the budgets your
scenes must respect.

**The Park ride runtime (automatic — every composed object gets it):**

Everything mounted through a `<Park>` (all wrappers, every composable,
`<Placed>`) becomes a runtime entry — no ride is an always-on standalone
scene. Each frame the runtime measures every entry against ALL active cameras
(the orbit cam plus any RideViewer/PlayerCam inset) and the main frustum:

| tier | when | updates | sheds |
| --- | --- | --- | --- |
| NEAR | `d < ~0.75·size`, or close to any inset cam | every frame | nothing — full detail |
| MID | `d < ~1.4·size` | every 2nd frame | `userData.lodDetail` children (passengers, cockpit dressing) |
| FAR | beyond MID | every 4th frame | + particles (`Points`) + its PointLights; geometry stays as a static silhouette |
| OFFSCREEN | outside the frustum > 0.4 s | every 32nd frame (keep-warm) | same as FAR |

Updaters take ABSOLUTE time (§12), so throttled frames mean coarser motion,
never slowed/drifted motion. Boundaries carry ±5% hysteresis; update phases
are staggered. Park-spanning backdrops (terrain, water, paths) opt out with
`addObject(obj, update, { lod: 'full' })`. Tag expensive close-up dressing in
your builders with `group.userData.lodDetail = true` (GoKarts/GhostTrain/
FlyingSaucers riders are the exemplars) so the MID tier can shed it.

**Explicit scene budgets (`<Park budgets>` + globals):**

- **Active lights:** the runtime keeps only the **nearest
  `budgets.lights` (default 16) PointLights `visible`** across the whole
  park, re-sorted every 0.3 s with swap stickiness (a constant active count
  also avoids three.js shader recompiles). Components keep animating
  `intensity` (night gates) — the budget only owns `visible`.
- **Particles:** ParticleKit enforces a **global cross-emitter capacity
  budget (default 4000)** on top of the ≤300-per-component rule — over
  budget, new emitters are clamped (and one warning logged). Tune with
  `setParticleBudget(n)`; probe with `particleBudget()`.
- **Draw calls / triangles:** the Stage logs a one-time warning ~5 s in when
  a scene sits over ~3000 draws or ~2.5M triangles.
- **Inset viewports are FULL scene render passes.** Shadow maps are reused
  across insets automatically, but the colour pass is full price — keep ONE
  live inset (the Stage warns on 2+).

**Built into the Stage:**

- **Quality tiers** — `<Stage quality>` / `<Park quality>`:
  `'high'` (default for previews: pixel-ratio cap 2, AA, 2048² shadows),
  `'medium'` (the `<Park>` default: cap 1.5, AA, 1024² shadows — invisible
  from the orbit cam at park scale), `'low'` (cap 1, no AA, 512² shadows).
- **Pixel ratio is capped** at `min(devicePixelRatio, cap)` — >2x retina
  buffers quadruple fill cost for no visible gain at park scale.
- **Shadows:** one PCFSoft map on the sun (sized by quality). **Static
  scenes** (a `build` that returns NO updater) get their shadow map **frozen
  after ~1 s** — the sun never moves and the day/night lerp only changes
  light colour/intensity, so the depth map is final. Animated scenes keep
  per-frame shadow updates, and inset viewport passes always REUSE the main
  pass's maps.
- **Geometry is cached:** `box`/`cyl`/`ball` share one BufferGeometry per
  distinct dimensions (cached geometries carry `userData.shared` and are
  skipped by disposal helpers — never hand-dispose them).
- **Textures are cached** (one CanvasTexture per `name:color:repeat`).
  **Materials are deliberately NOT cached:** ~20 components mutate their
  meshes' materials after creation (night-gated `emissiveIntensity` on
  bulbs/lamp heads, `.side`, opacity) — a shared cached material would leak
  one bulb's glow onto every same-coloured mesh. Keep materials per-mesh.
- **Light-budget warning:** a build group carrying more than ~8 real
  Point/Spot lights logs a console warning (each one recompiles the forward
  shaders and adds per-fragment cost).

**Your budgets (per component / per park):**

- **≤ 4 real PointLights per component** — beyond that, use emissive
  materials gated on `nightKOf` (§3); they read as "on" without lighting cost.
- **≤ 300 particles per component** (one ParticleKit ring-buffer, §9).
- **A whole park well under the area-scaled mesh budget** — ~2500 per 16²
  of plot area (~22 500 at the default size 48); validatePark `console.warn`s
  past it (warnings are fatal under the pre-flight policy).
- **UI polls accessors at ≥ 300 ms intervals** (rules/ui.md) — never every
  frame.

**Techniques:**

- **`mergedBoxes` for static dressing** — kerbs, seams, ties, trestles,
  spokes, pickets: N same-material boxes become ONE mesh (one draw call, one
  shadow draw). Per-box texture `repeat`s are baked into UVs so mixed-length
  parts still share one texture. Do NOT merge boxes that move independently
  or mutate their material per frame. PathNetwork, SplineCoaster supports/
  ties and FerrisWheel batch this way — copy their pattern.
- **`InstancedMesh` for repeated identical geometry** (FerrisWheel's 32 rim
  bulbs: one draw call, and the shared material still takes the night ramp).
- **Big parks: `fullscreen` + `fog={{ near, far }}`** — a custom fog range
  pulls the horizon in AND tightens the camera far plane just past the fog
  wall, so distant geometry is genuinely frustum-culled, not just tinted.
- **Measure with `api.stats()`** — `{ drawCalls, triangles, fps, frameMs,
  lights }` for the last complete frame (all passes). A composed `<Park>`
  also logs one `[Park] perf:` line ~3 s after settle. The harness twin is
  `/tmp/mp3d-render/stats.mjs <Name>` (GL-level draw/triangle counts).
  Reference points: a single rig ≲ 300 draw calls, the ParkBuilder example
  park ~2000; if a new scene blows past its class, batch before shipping.
