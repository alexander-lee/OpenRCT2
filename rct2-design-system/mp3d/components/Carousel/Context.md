# Carousel

**CANONICAL IMPORT — copy exactly:** `import { Carousel } from './components/Carousel';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Merry-go-round: jumping horses and a chariot under a scalloped canopy, from the RCT2 sprite.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## THE MESH (rebuilt 2026-07-28) — why, and what it is now

**What was wrong.** The standing complaint about this fleet is that set-pieces "read as
primitives stuck together rather than as the thing they depict", and this component was a
clean example. Part for part it was: three fat orange rings (a wedding cake), one plain tan
disc, one plain brown cylinder with eight 0.1-wide gold strips glued to it, a 16-wedge flat
cone, a fat orange ring band with 18 balls round it, and eight horses each made of a 0.48
box + a 0.13 box + a 0.18 box + four 0.05 sticks. From mid-distance it read as a beach
umbrella over a stool; at eye level the horses read as blocky grey dogs. Every part that
should have been a **surface** was a primitive, and every part that should have **pointed
somewhere** was axis-aligned.

**What it is now** — the six things a carousel actually has, in the order they pay off:

1. **CENTRE DRUM (the mirror barrel).** 16 alternating panels — mirror glass and painted
   red boards with cream medallions — in an upper band over a green dado, divided by 16
   vertical gold mouldings and closed by cornices top and bottom, on a wider r 0.42 barrel.
   The mirrors are **real reflections**: metalness 1 / roughness 0.05 against a cached
   256×128 equirectangular `CanvasTexture` envMap (`fairEnv()`), never an `emissive` fake.
2. **CROWN + CANOPY.** The canopy is a **lofted surface**, not a cone: 16 stripe patches
   whose canvas SAGS 0.055 u between the sweeps (zero on the ridges and at the eave), a
   `pow(u, 0.75)` profile that is steep off the crown and flat at the rim, a warm inner
   **ceiling** 0.06 below it (so the inside of the top is a lit canvas, not a black cone),
   a scalloped **VALANCE** with tassels, and a crown drum, cresting, finial and pennant.
3. **SWEEPS + POLES.** 16 brass sweeps ride the canvas ridges from the crown to the eave,
   each in 5 endpoint-placed pieces so they **follow** the profile curve. Six brass poles
   sit on the horse ring radius, so a pole really passes through each horse's withers,
   with collars at deck and canopy.
4. **ROUNDING BOARDS.** 16 upright boards at the rim carrying a red **name band** between
   gold beadings, a framed medallion each, two **bulb rows** and gold cresting spikes.
5. **HORSES + CHARIOT.** Six jumping horses in two poses (galloping / prancing): chest,
   barrel and croup as ellipsoid masses, an arched neck, head with jaw / muzzle / ears, a
   **lofted mane**, a flowing tail, four **two-segment legs** with joints and hooves,
   saddle with pommel / cantle / fringed cloth, girth, stirrups, bridle and reins. Plus a
   two-seat **chariot** with lofted swan-scroll sides.
6. **PLATFORM.** 24 radial planks in two tones with dark seams, a studded rim kerb, a
   stationary panelled **skirt** hiding the machinery, a ring step and a boarding stair
   with brass handrails at the local +z front.

### The rules that made it read (copy these, they are the whole difference)

* **Anything that points somewhere is placed from its TWO ENDPOINTS** — `seg()` builds the
  quaternion that takes +Y onto (b − a) and scales a shared unit geometry to the run
  length. `rotX/rotY/rotZ` cannot express an arbitrary direction, and reaching for them is
  what flattened the old horses (four parallel sticks for legs).
* **Anything curved IS a surface** — `loft()` turns parameter curves into one indexed
  `BufferGeometry` with real UVs + `computeVertexNormals()`. Canopy, ceiling, valance,
  manes and chariot sides are all lofts.
* **`cyl()` BUILDS A SOLID DISC, and a solid disc used as a band is a horizontal LID.**
  This cost two whole reads during the rebuild: the deck kerb's top face (r 1.66) covered
  the radial planking so the platform rendered as a plain red disc, and the five rim rings
  (name band, two beadings, top and bottom rail, all r ≈ 1.82) stacked five discs in the
  air over the horses so the inside of the top read as a flat lid. Use `ringWall()` /
  `ringTop()` — an open-ended cylinder plus a `RingGeometry` — for anything ring-shaped.
* **Metalness without an envMap is grey paint.** three.js feeds a metal's colour entirely
  from its reflections, so the first render came back with every gold rail, pilaster and
  stud reading as dull grey. `gilt()` attaches the environment to helper-built meshes;
  `shiny()` builds the material for merged batches.
* Determinism: hashed `h01` jitter only, never `Math.random` / `Date.now`.
* `nightKOf(group)` takes the OBJECT, never a time value.

### Cost (measured, `harness/mp3d-render`)

| | before | after |
|---|---|---|
| meshes / draw calls, registered (riders off) | 48 | **75** |
| meshes, standalone preview (4 decorative riders) | 100 | 129 |
| triangles, registered | 9,720 | 44,056 |
| real lights | 2 | **2** (unchanged — no new lights) |
| footprint radius at rest | 1.88 | **1.86** (marginally smaller) |
| height | 2.89 | 3.195 |

30 of those 75 meshes are **merged batches** standing in for ~700 individual parts
(`mergedBoxes` / `mergedParts`, one per colour or material). Well inside SETUP.md §13's
"a single rig ≲ 300 draw calls". Night reading is one merged emissive bulb mesh (60 bulbs)
plus the ceiling's emissive, both gated on `nightKOf(group)` — the two warm centre
PointLights are the ones this component always had.

## RCT2 station behaviour (motion gate) + real seats

Capacity **8** = six horse saddles + the chariot's two bench places, one anchor each, pushed
in **angular order** so seat index and station agree. REAL GameManager guests board DISTINCT
live seat anchors via `seatWorld` (decorative riders default true standalone / **false when
registered** — unfilled seats read visibly EMPTY); each anchor sits 0.19 under its seat top
because `buildPeep`'s origin is at the peep's FEET and its hips are 0.46·scale above that.
The horse anchors ride the bobbing horse, so a real guest jumps with it. The built `update`
is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through
`waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on
`departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a
stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the
FSM parks in `movingToEndOfStation` while broken). Un-registered previews pass raw time
through until the first `onStateChange`.

## Previews

Two: the mid-distance **3D rig** (the park view) and a **Night** framing that shows the two
bulb rows, the crown ring and the lit ceiling coming up at dusk — the old build's night was
one bulb row and nothing else. `ScenePreview` has no elevation prop, so an eye-level pass
needs the render harness: `node render.mjs Carousel --angle=20 --elev=4`. Note that
`--preview=N` and `--elev` do not combine (the elevation drag is silently lost).
