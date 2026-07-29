# LaunchedFreefall

**CANONICAL IMPORT — copy exactly:** `import { LaunchedFreefall } from './components/LaunchedFreefall';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Air-launched space-shot tower (RCT2 Launched Freefall): a 4-seat ring car blasts up a red
lattice truss on compressed air, floats weightless at the apex — riders' arms rise and wave —
then glides down. Deterministic 12 s cycle with a ParticleKit air-blast burst at each launch.
Optional ColorKit `scheme` recolours the truss, the accents and the car. Night: a pulsing red
aviation beacon, a warm under-car light and one station mast light (3 real PointLights), plus
the tower marker bulbs.

Built with three.js on the shared Stage; modelled on the RCT2 Launched Freefall silhouette.

## THE MESH (rebuilt 2026-07-28) — why, and what it is now

**What was wrong.** This was the best of the three towers in the catalog and it still had the
fleet-wide defect — every shape made from the cheapest primitive that would stand in for it:

* **The mast was braced on only TWO of its four faces**, so from the other two it was a rung
  ladder, and nothing braced the square in plan.
* **The head was a party hat:** `cyl(0, 0.52, 0.42, seg: 6)` in grey with a red brim over a
  plain drum. No machine deck, no sheaves, no air receiver.
* **The "safety railing" was 11 sticks with straight boxes between them**, the air plant was
  three plain tubes with a ball on top, and the compressor was a single grey box.
* **The car had two SOLID plates through the tower.** The mast passes through the middle of the
  car, and the 1.14 under-plate and the 0.98 top plate were both solid — sawing straight
  through the chords on every launch. Its seats were five boxes each.

**What it is now:**

1. **A TRUSS:** 11 bays, four tubular chords (in the scheme's accent, so the tower reads red and
   white against sky), a rung on **all four faces** at every bay line, a **full X-brace on all
   four faces of every bay**, plan bracing every third bay, marker collars and gusseted feet —
   ~220 members, in three merged meshes.
2. **THE LAUNCH PLANT** — the thing that makes this ride *this* ride: three vessels with
   **dished heads** on saddle legs, valve heads with handwheels, red pressure bands, a manifold
   across the three, and a feed run that goes elbow by elbow down, out and **into the pad wall**.
   Plus a compressor skid with a louvred grille, cooling fins and a gauge board, and the
   vertical **launch cylinder** up the middle of the mast with its glands.
3. **GUIDE RAILS**, the car's guide shoes, its brake **fin**, and the fixed fin-brake calipers
   over the landing zone.
4. **A HEAD ASSEMBLY:** a railed machine deck on bracketed cantilevers, the **air receiver**
   lying across it on saddles with dished ends, two sheaves, a **lofted** sheet-metal roof in
   two tones with a red fascia, a finial and the beacon.
5. **A CAR THAT IS A VEHICLE:** an open collar frame with a **hole for the mast**, capping and
   skirt rails, four corner **nose fairings**, a spoked floor frame, and four moulded seat pods
   — contoured back shells, wings, headrests with pads, cushions, **over-the-shoulder
   restraints** whose bars curve over the shoulder onto a chest pad, lap bars, footrests and
   grab handles.
6. **A PAD:** tarmac with a hazard kerb, a 16-block striped **launch pad** under the car, a
   railed fence with the boarding gap at the local +z front, and a boarding step.

### The rules that made it read

* **Endpoint placement** (`seg()`) for every brace, pipe elbow, rail, restraint bar and lamp
  bracket. `rotX/rotY/rotZ` cannot express an arbitrary direction, which is precisely why two
  faces of the old mast ended up with no diagonals at all.
* **Real lofted surfaces** (`loft()`/`panelLoft()`) for the head roof — a cone has no sag and no
  eave.
* **`metalness` with no envMap is grey paint.** `steelEnv()` is one cached 256×128
  equirectangular canvas. Note the other half of that lesson, found here: at `metal 0.7` against
  a bright sky environment the air vessels washed out to **pale frosted bottles**, so the tanks
  are deliberately darker and *less* metallic than the mast (0.45 / rough 0.45).
* **A ram inside a tower must read as a rod between the diagonals, not as the tower.** The first
  pass drew the launch cylinder at r 0.16 and it filled the middle of the truss as a fat grey
  mast, undoing the bracing the rebuild exists to show. It is r 0.105 now.
* **Route pipework outside the vehicle's swept envelope.** The first pass ran the tank feed
  straight in at y 0.5 — 0.055 under the parked car's skirt rail, and visibly across the
  vehicle in the close-up. The car's outermost parts reach r 0.88 and its lowest reaches y 0.31,
  so the horizontal leg stops at r 1.02 and the rest goes down and into the pad.
* Determinism: hashed `h01` only. `nightKOf(group)` takes the OBJECT.

### THE CLEARANCE RULE

The car **encircles the mast**. Nothing bolted to the tower inside the travel band (y 0.62 →
4.22) may exceed `R_SHAFT` 0.50 from the axis — chord corners 0.424, marker collars 0.474, guide
rails 0.375, launch cylinder 0.125 — and the car's collar frame clears 0.51 with a real hole
through it. The old solid plates ignored this completely.

### Cost (measured, `harness/mp3d-render/probe-tower-cost.mjs`)

| | before | after |
|---|---|---|
| draw calls, registered (riders off) | 167 | **33** |
| draw calls, standalone preview (4 decorative riders) | 223 | 87 |
| triangles, registered | 5,736 | 19,008 |
| real lights | 3 | **3** (unchanged) |
| footprint (local XZ) | 3.456 × 2.828 | **3.45 × 2.797** |
| height | 6.14 | 6.16 |

~750 parts in 30 merged batches — far inside SETUP.md §13's "a single rig ≲ 300 draw calls", and
a **5×** reduction in draws for a park that mounts it. The footprint is at or just inside the old
one: the compressor skid is still the widest thing at x 2.0 and the fence closes inside the old
1.456, so the registered body blocker, the derived hut clearance and the queue front are
unchanged. (The fence ring had to come in from 1.45 to 1.40 because its stanchion base plates
stick out another 0.05 — measured, then fixed.)

## RCT2 station behaviour (motion gate) + real seats

Capacity **4** = the 4-seat ring car, at the same r 0.58 ring and the same local anchor offset
as before the rebuild — no rider moved. REAL GameManager guests board DISTINCT live seat anchors
via `seatWorld` (decorative riders default true standalone / **false when registered** —
unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate`
(GameManager): a registered ride sits **PARKED** through
`waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on
`departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a
stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM
parks in `movingToEndOfStation` while broken). Un-registered previews pass raw time through
until the first `onStateChange`. The flight height follows the gate's eased speed and each
`departing` restarts the 12 s launch cycle — the car is parked at the station for
boarding/unloading. The arm-raise overlay only animates the decorative riders (skipped when
registered).

## Previews

Two: the mid-distance **3D rig** (`distance 13` — the head is at 6.16 and a tighter frame clips
it) and a **Night** framing that shows the marker bulbs up the truss, the station lamp and the
under-car glow on the striped launch pad. Eye level needs the render harness:
`node render.mjs LaunchedFreefall --angle=15 --elev=10` (`--preview=N` and `--elev` do not
combine — the elevation drag is silently lost).
