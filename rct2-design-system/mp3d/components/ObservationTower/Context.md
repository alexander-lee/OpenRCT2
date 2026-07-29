# ObservationTower

**CANONICAL IMPORT — copy exactly:** `import { ObservationTower } from './components/ObservationTower';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Observation tower (RCT2 OBS1): a glazed deep-blue cabin under a red/cream pinwheel roof, riding
a lattice mast on a rack-and-pinion drive while it slowly rotates for the view.

Original three.js model on the shared Stage (day/night lighting); proportions and palette
referenced from the RCT2 asset library.

## THE MESH (rebuilt 2026-07-28) — why, and what it is now

**What was wrong.** At the preview's own 9.5 u this rig read as a **red-and-white beach umbrella
halfway up a stick**, and the geometry says why:

* **The mast had NO DIAGONALS AT ALL** — four vertical sticks and horizontal rungs. A ladder.
  Against sky a ladder has no silhouette, and this is a 5.6 u tower.
* **The roof was a PARASOL:** 12 `CylinderGeometry` wedges, rTop 0.03 → rBot 1.05 over a 0.42
  rise. It overhung the r 0.95 drum by 0.10 all round, so from any camera above eye level it
  hid the *entire cabin* — drum, twelve windows, mullions and all eight riders.
* **The "floor ring" was a `cyl()`,** and `cyl()` builds a SOLID DISC, so the r 1.02 ring was a
  lid over the boarding platform.
* **The base was one grey concrete disc.** No station, no platform, no drive, no crown.

**What it is now:**

1. **A TRUSS:** 13 bays, four tubular chords, a rung on ALL FOUR faces at every bay line, a
   **full X-brace on all four faces of every bay**, plan bracing every third bay, painted
   marker collars, base plates, and a **caged service ladder** (stringers, 26 rungs, 7 hoops)
   up the −x face — the detail that gives a tower its sense of scale.
2. **A DRIVE:** two guide rails, a **toothed rack** of 62 teeth up the +x face, and the cabin's
   own pinion (a torus meshing outboard of the tooth line), shoe jaws straddling each rail, and
   four outrigger arms under the floor.
3. **A CROWN:** a railed machine deck with a cable slot, sheaves on a bearing shaft, the hoist
   motor, a **lofted sheet-metal roof in two tones**, a lightning finial and the aviation
   beacon.
4. **A CABIN THAT IS A ROOM:** a panelled sill band over a skirt with a cill capping, **twelve
   tall windows** each in a real frame (mullion, head transom, cill transom), an inner brass
   handrail on stanchions, a bench ring round the core, a floor that is a **ring**, an eave
   fascia with a gutter, a **lofted red/cream pinwheel roof that SAGS between its twelve ribs**
   over a lit cream ceiling, a 24-bulb ring under the eave, and a finial.
5. **A STATION:** an apron, a boarding platform with a yellow-nosed riser and a stepped
   approach at the local +z front, twelve deck studs, a curved **boarding gate** with two rails
   and a sign, the operator's **console** with its lever bank and visor, and the mast footing.

### The rules that made it read

* **Endpoint placement** (`seg()`): the quaternion taking +Y onto (b − a), scaled to the run
  length. `rotX/rotY/rotZ` cannot express an arbitrary direction — the complete absence of
  diagonals on the old mast is what happens when nobody reaches for the tool.
* **Real lofted surfaces** (`loft()`/`panelLoft()`): one indexed `BufferGeometry`, real UVs,
  `computeVertexNormals()`. A cone has no sag, no gutter and no eave, which is exactly why the
  old roof read as a parasol.
* **A SHALLOW roof seen from a park camera is a flat DISC.** The first pass of this rebuild kept
  the apex at 1.08 and the render still read as a lid; 1.14 plus a 0.04 sag between the ribs is
  what turned it into a roof.
* **`cyl()` builds a solid disc** — `ringWall()` + `ringTop()` for anything ring-shaped.
* **`metalness` with no envMap is grey paint.** `steelEnv()` is one cached 256×128
  equirectangular canvas; `shiny()`/`gilt()` attach it to the mast, the rack, the rails, the
  brass handrail and the glass.
* **A TRANSPARENT material's emissive is scaled by its own alpha.** The windows at opacity 0.34
  and emissive 0.85 produced a completely unlit cabin at night — the fix is to bring the
  *opacity* up with the night gate as well (a lit window at dusk is nearly opaque), and only
  then does the twelve-window ring read from across a park. At emissive 1.9 it then clipped to
  white-hot; 1.35 is the warm reading.
* Determinism: hashed `h01` only. `nightKOf(group)` takes the OBJECT.

### THE ONLY FREE RING IS r ≈ 1.025 — read this before adding station furniture

The **parked cabin owns the platform.** Its floor annulus spans r 0.40 → 0.98 at y 0.31 → 0.39,
and its sill/head band spans r 0.90 → 1.00 up to y 1.01, so *anything standing on the platform
above y ≈ 0.30 is inside the cabin when it lands.* The first pass of this rebuild put a
0.44-high railing ring at r 0.83 and an operator booth 0.55 high at r 0.83 straight through it:
invisible at rest, shearing through the cabin floor on every cycle.

What *is* free is the 0.045-wide slot just outboard of the cabin's widest band and under its
roof eave — **r 1.005 … 1.05, y 0.43 … 0.95** — so the gate and the console live there and
nowhere else. It also forces the gate to be an **arc**: a straight lintel across the boarding
opening dips to r 0.93 in the middle, which is inside the window band. Everything on that ring
follows the circle. (A gate narrower than its frontage reads as a stray piece of railing — the
first attempt at ±0.44 rad did; ±0.86 rad with a top and a mid rail reads as a gateway.)

The other clearance is the same one every tower here has: the cabin encircles the mast, so
nothing fixed to the mast inside the climb range may exceed `R_SHAFT` 0.37 (chord corners 0.283,
rails 0.291, rack teeth 0.318) and the cabin's own hole is 0.40.

### Cost (measured, `harness/mp3d-render/probe-tower-cost.mjs`)

| | before | after |
|---|---|---|
| draw calls, registered (riders off) | 98 | **41** |
| draw calls, standalone preview (4 decorative riders) | 150 | 99 |
| triangles, registered | 2,220 | 17,668 |
| real lights | 2 | **2** (unchanged) |
| footprint (local XZ) | 2.10 × 2.10 | **2.10 × 2.10** (unchanged) |
| height | 5.91 | 6.20 |

~800 parts in 28 merged batches — far inside SETUP.md §13's "a single rig ≲ 300 draw calls".
The footprint is unchanged by construction: the roof was the widest thing at r 1.05 and the eave
fascia now lands on exactly that radius, so the registered body blocker, the derived hut
clearance and the queue front are untouched. Night reading is the twelve windows (one merged
material, emissive **and** opacity gated), the ceiling, the 24-bulb ring and the beacon.

## RCT2 station behaviour (motion gate) + real seats

Capacity **8** = the 8 cabin window spots, at the same r 0.62 ring, the same height and the same
outward facing as before the rebuild — no rider moved. REAL GameManager guests board DISTINCT
live seat anchors via `seatWorld` (decorative riders default true standalone / **false when
registered** — unfilled spots read visibly EMPTY). The built `update` is wrapped in
`createMotionGate` (GameManager): a registered ride sits **PARKED** through
`waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on
`departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a
stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM
parks in `movingToEndOfStation` while broken). Un-registered previews pass raw time through
until the first `onStateChange`. The climb follows the gate's eased speed and each `departing`
restarts it — the cabin is parked at the base for boarding/unloading.

## Previews

Two: the mid-distance **3D rig** (`distance 12` — the crown is at 6.20 and a tighter frame clips
it) and a **Night** framing on the parked cabin, which is where the lit window ring reads. Eye
level needs the render harness: `node render.mjs ObservationTower --angle=15 --elev=8`
(`--preview=N` and `--elev` do not combine — the elevation drag is silently lost).
