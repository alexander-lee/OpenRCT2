# DropTower

**CANONICAL IMPORT — copy exactly:** `import { DropTower } from './components/DropTower';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Roto-drop tower (RCT2 GDROP1): a ring gondola on live cables that climbs a lattice truss,
spins, and plummets.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## THE MESH (rebuilt 2026-07-28) — why, and what it is now

**What was wrong.** A tower is the most visible thing in a park from any distance, which makes
it the easiest rig in the catalog to fake, and this one was faked in three places at once:

* **The mast was a LADDER, not a truss** — four vertical sticks, horizontal rungs, and ONE
  diagonal pair on two of the four faces. Against sky a ladder has no silhouette.
* **The gondola was HIDDEN BY ITS OWN CANOPY.** `cyl()` builds a SOLID DISC, and the "canopy
  lip" was `cyl(0.84, 0.84, 0.04)` — a horizontal LID drawn straight across the ten riders,
  the drum, the seats and the bulbs. The baseline render is a lamp post under a blue plate.
* **The cap was a 6-segment cone**, i.e. a party hat. No winch, no sheave, no cable, no guide
  rail, no catch car, no brake, no pad, no fence.

**What it is now**, in the order it pays off against sky:

1. **A TRUSS.** 12 bays: four tubular corner chords, a rung on ALL FOUR faces at every bay
   line, a **full X-brace on all four faces of every bay**, plan bracing across the square
   every third bay, painted marker collars at the splices, gusseted feet and four splayed
   footings. ~230 members, in three merged meshes.
2. **GUIDE RAILS** the car really runs in (two proud webbed rails up the ±x faces with
   tie-backs onto the chords), the fixed **magnetic brake calipers** straddling them through
   the braking zone, and the car's own guide shoes and **brake fin** passing between the jaws.
3. **A VISIBLE WINCH CROWN:** a fascia'd machine deck with a **cable slot**, a railed walkway,
   two sheave wheels on a bearing shaft, the hoist motor and gearbox, a **lofted** peaked roof
   with a fascia at the eave, a finial and the aviation beacon.
4. **TWO LIVE CABLES** from the sheaves, through the deck slot, to the catch car — rescaled
   every frame, so the cable actually pays out as the gondola climbs.
5. **A GONDOLA:** a 10-panelled drum with gold mouldings and cornices, a **lofted canopy that
   SAGS between its ten ribs** over a warm lit ceiling, a scalloped **valance** with tassels, a
   20-bulb ring, and ten seats with contoured shells, wings, headrests, cushions,
   **over-the-shoulder restraints**, lap belts, footrests and frame arms back to the drum.
6. **A PAD:** tarmac, an alternating hazard kerb, a railed fence with the boarding gap at the
   local +z front, and the winch house behind it.

### The rules that made it read (copy these — they are the whole difference)

* **Anything that points somewhere is placed from its TWO ENDPOINTS.** `seg()` builds the
  quaternion taking +Y onto (b − a) and scales a shared unit geometry to the run length.
  `rotX/rotY/rotZ` cannot express an arbitrary direction, and reaching for them is exactly
  what left this mast as four parallel sticks. Every brace, rake, tie, restraint bar and frame
  arm here is endpoint-placed.
* **Anything curved IS a surface.** `loft()` / `panelLoft()` turn parameter curves into one
  indexed `BufferGeometry` with real UVs and `computeVertexNormals()`. A cone has no sag, no
  scallop and no eave, which is why the old canopy read as a plate even before it became a lid.
* **`cyl()` BUILDS A SOLID DISC**, so a solid disc used as a band is a horizontal LID. Use
  `ringWall()` (open-ended cylinder) + `ringTop()` (a `RingGeometry` annulus) for anything
  ring-shaped. This component is the fleet's clearest case: one 0.04-thick disc erased the
  entire vehicle.
* **`metalness` with no envMap is GREY PAINT.** three.js takes a metal's colour entirely from
  its reflections, so a steel tower "painted metal" with nothing to reflect reads as dull
  plastic. `steelEnv()` is one cached 256×128 equirectangular canvas (sky-dominant, because a
  tower is seen against sky); `shiny()`/`gilt()` attach it.
* **With `rot = [0, −a, 0]`, local +x is RADIAL and local +z TANGENTIAL.** Reading that the
  other way round turned the drum's ten *panels* into ten radial *fins* 0.26 deep and 0.05
  wide, and pushed the kerbstones past the registered footprint. Both were found by MEASURING
  the extreme mesh, not by looking — the canopy hid them.
* **The second canopy tone must be LIGHTER than the field, not darker** — the first pass used a
  darker red and the canopy read as one dark disc at mid-distance, which is exactly the range
  where the stripes have to do the work.
* **A valance has to hang BELOW the fascia**, not level with it. The first pass put both at the
  same radius and height and the close-up showed no scallops at all: one was inside the other.
* Determinism: hashed `h01` only, never `Math.random`. `nightKOf(group)` takes the OBJECT.

### THE CLEARANCE RULE — read this before moving any radius

The gondola **encircles the mast**, so the tower and the car share a volume: the car sweeps
y 0.75 → 4.30 past everything bolted to the tower. Hence `R_SHAFT = 0.39`:

| | rule | the numbers |
|---|---|---|
| fixed to the mast, inside the climb range | must stay **inside** 0.39 | chord corners 0.339 · guide rails 0.348 · caliper jaws 0.329 · marker collars 0.359 |
| on the gondola | must stay **outside** 0.39 | drum inner face 0.415 · drum lid annulus 0.39 · canopy inner edge 0.40 |
| on the gondola, *inside* the shaft | allowed — it rides with the car | guide shoes and the brake fin at 0.35 |
| fixed at r > 0.39 | only **below** the gondola's lowest sweep (0.53) | the splayed footings die at y 0.72 and are inside 0.46 by then; the fence sits at 0.76, outboard of the kick ring's 0.70 |

Break that rule and the canopy saws through the tower on every cycle — invisibly, which is what
the old solid disc did.

### Cost (measured, `harness/mp3d-render/probe-tower-cost.mjs`)

| | before | after |
|---|---|---|
| draw calls, registered (riders off) | 155 | **37** |
| draw calls, standalone preview (10 decorative riders) | 285 | 181 |
| triangles, registered | 3,400 | 21,104 |
| real lights | 2 | **2** (unchanged) |
| footprint (local XZ) | 1.70 × 1.70 | **1.68 × 1.68** |
| height | 5.91 | 6.08 |

~700 parts in 27 merged batches — well inside SETUP.md §13's "a single rig ≲ 300 draw calls",
and a park mounting this rig now pays **a fifth** of what it used to. The footprint is at or
just inside the old one on purpose: the canopy eave plus its fascia land on the 0.84 the old
lid's rim did, so the registered body blocker, the derived entrance-hut clearance and the
queue front are all unchanged. Night reading is one merged emissive bulb mesh (20 bulbs), the
canopy ceiling's emissive and the beacon — all gated on `nightKOf(group)`.

## RCT2 station behaviour (motion gate) + real seats

Capacity **10** = the 10 outward-facing gondola ring seats. REAL GameManager guests board
DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone /
**false when registered** — unfilled seats read visibly EMPTY); the anchors sit on the same
R_SEAT 0.56 ring at the same local offset the previous build used, so no rider moved in the
rebuild. The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride
sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases
0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board
and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the
gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews pass raw
time through until the first `onStateChange`. The climb height follows the gate's eased speed
and each `departing` restarts the climb from the base — the gondola is parked at the bottom for
boarding/unloading, and the cables shorten and lengthen with it.

## Previews

Two: the mid-distance **3D rig** (the park view — `distance 11`, because the crown is at 6.08
and a tighter frame clips it) and a **Night** framing on the parked gondola. `ScenePreview` has
no elevation prop, so an eye-level pass needs the render harness:
`node render.mjs DropTower --angle=15 --elev=8`. Note that `--preview=N` and `--elev` do not
combine (the elevation drag is silently lost).
