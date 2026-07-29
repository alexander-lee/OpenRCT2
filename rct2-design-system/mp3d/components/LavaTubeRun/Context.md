# LavaTubeRun

**CANONICAL IMPORT — copy exactly:** `import { LavaTubeRun } from './components/LavaTubeRun';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Attraction **3** of the **Emberfall Caldera**: a steel coaster that plunges **INTO a lava tube in the volcano's flank and bursts out the other side**.

Built on the **existing** spline machinery like every tracked ride in the design system: the layout is compiled by SplineRideKit's `compileTrackPieces` and swept by `buildRideSpline({ profile: 'coaster', type: 'steel' })`. No forked track code.

The lava palette is imported from `components/EmberWings` (`lavaMaterial` / `lavaGlow` / `LAVA_HEAT`) so both flagships of the world burn with **one** language — near-black basalt plates with an emissive **crack** network, a white-yellow → orange → deep-red → black temperature ramp, and a glow **lerped** between a daylight and a night value, never gated to zero. See `components/EmberWings/Context.md` for the language itself.

## Why `type: 'steel'`

This is a modern looping-family coaster (`ride/rtd/coaster/LoopingRollerCoaster.h`): `TYPE_RULES.steel` gives it vertical-capable slopes and banking to ~55°, and its `RatingsData` table is the one RCT2 scores a steel train with. The circuit does **not** invert — there is no corkscrew group anywhere in it — but it very much wants the **40° auto-bank** that the steel cap allows, because that is what soaks the lateral G on the fast low turns either side of the tube:

```
eff = v² · κ_h · (1 − min(1, |roll|/0.6))
```

At the tube run the train is doing 9.46 u/s. **Do not lower `bank`**: at 0.7 the fast corners develop 25.4° of roll and the worst effective lateral is 1.13 g; drop the cap and the 1.27 g crash-replay margin re-opens. (This is the exact opposite of the world's `EmberWings`, whose bank is deliberately pinned at 0.20 because a suspended coaster's track is flat — the two rides sit at the two ends of the same formula.)

## API

```tsx
<LavaTubeRun position={[x, z]} rotation={rad} register>
  <Station /><Straight length={0.6} /><Lift height={4.0} length={9} /> …
</LavaTubeRun>
```

`LavaTubeRun: React.FC<ComposableRideProps & LavaTubeRunOpts & { children }>` — mounts at `position`/`rotation` like every composable ride. Inside a `<Park>`, `register` wires the full GameManager ride through `<ConfigurableRide>`.

| prop | meaning |
| --- | --- |
| `pieces?: TrackPiece[]` | RCT2 piece list (`compileTrackPieces` vocabulary). JSX piece children (`<Station/><Lift/><Drop/><Hill/><TurnR/>…`, read with `collectTrackPieces`) **win** over `pieces`. |
| `points?: [x,y,z][]` | raw control points — the escape hatch past the piece compiler (still swept + validated). `pieces` wins. |
| `cars?: number` | cars in the train, 1-6, default **3** |
| `riders?: boolean` | decorative riders (default true; `register` turns them OFF so real GameManager guests fill the train through `seatWorld`) |
| `groundAt?: (x,z) => number` | terrain sampler so the ridge, the supports and the props land on the ground (default flat) |
| `tunnelU?: number` | loop parameter of the bore (default **auto** — the lowest, straightest, most level stretch away from the station) |
| `tunnelHalf?: number` | half-length of the enclosed bore (default **4.0** → an 8-unit tube) |
| `smoke?: boolean` | portal smoke + ember emitters (default true) |

Builder: `buildLavaTubeRunScene(three, opts) → { group, update, vehicle, seatWorld, onStateChange, crashed, invalid?, ratings? }`.
`update` is motion-gated (`createMotionGate`, spinDown 1.6 — the train parks in the station while guests board, RCT2 `Vehicle.cpp` status cycle); `vehicle` is the **lead car** (RideViewer onboard/follow cam); `crashed()` reports the live 1.5 g derail guard; `ratings` is the measured RCT2 triple handed to `registerRide`. A FATAL compile sets `invalid` so the circuit never registers.
`group.userData.trackReport` carries the full compile report and `group.userData.tunnel` = `{ u, at: [x,y,z], yaw, half }` the bore's component-local pose (introspection, and for authors framing a shot on the portal).

**Capacity: 6** — 3 cars × 2 `COASTER_CAR_SEATS`, read off the live car transform by `makeSeatWorld`. Registered defaults: `{ name: 'Lava Tube Run', capacity: 6, rideDuration: 16, intensity: 7, price: 6 }`.

**Layout offsets** (component-local; the station straight is compiled along local **−x** with `heading: -π/2`, and every compiled point has **z ≤ 0**, so the local +z face is clear of track): queue **HEAD `front: 2.0`** out the +z face, exit hut `exit: [1.6, 1.9]`, boarding `board: [-1.3, 0.6, 0]` on the basalt platform at rail level. Circuit start `[0, 0.55, 0]`, bank 0.70.

**The vehicle is the shared `buildCoasterCar`** in a basalt/ember `VehicleColour` (`body 0x33383f` / `trim 0xe8842f` / `tertiary 0x8f2a10`), so `COASTER_CAR_SEATS` drives `seatWorld` and `gateCarLights` drives the headlamp exactly as everywhere else in the DS. A bespoke car would have bought nothing the tunnel does not buy more of.

## THE SIGNATURE — the tunnel

Everything is assembled in a `shaft` group parented at the chosen frame and yawed onto the track, so its local axes are **+z along the rails, +x the track's side, y measured from the RAIL CENTRELINE** (the ground therefore sits at a negative `gy`).

* **Bore liner.** Roof and side walls are **ROCK** — they are the cut faces of the flank, and a flat dark slab that size reads as a black shed from outside — with thin **DARK** panels just inside them so the mouths still read as *holes in a hill*. Opening head height `CLEAR = 1.5` above the rails (the train tops out ~0.95); wall centrelines at \|x\| 1.3, inner faces at 1.08, against a 0.35 train half-width.
* **The floor is a lava tube floor.** A real lava tube is the drained roof of a flow and the last of that flow is still in the bottom of it: a cooled crust floor under the track, an open molten **GUTTER** hugging one wall, **molten veins** up both inner faces at rider eye level, and drips down the roof — each in 8 segments whose heat is hottest in the middle of the bore and cools toward both mouths.
* **Two real PointLights inside**, and they are **LAVA, not lamps**: day-and-night lerped (`0.7 + 1.5·nightK`, flickering), never gated to zero, so the portal mouths glow at noon and blaze after dark.
* **Portals at both mouths**: three stepped, hashed-yaw jamb blocks per side, a ring of seven voussoirs stepped over the opening, a heavy lintel, and a row of seven **obsidian teeth** (the flank's frozen spatter) above it.
* **The ridge** — the volcano's flank the bore is driven through. 34 `buildRock` boulders in three tiers over the bore (crest / upper flank / lower flank, each flank stone stood off far enough that its inner face can never reach past \|x\| 0.72, so it cannot poke into the train envelope), then the ridge **runs on out along the shaft's local ±X** — perpendicular to the rails — as 22 more tapering boulders over a **low buried box core**, plus a scree apron so it meets the ground.
* **An older flow** spills over the ridge's near shoulder beside the portal into a **levee'd magma pool**, so the bore reads as the drained roof of a real flow rather than a hole someone dug. Smoke and embers rise from both mouths and off the pool.

### Two hard-won rules baked into the ridge

1. **The ridge must run PERPENDICULAR to the track.** The first draft marched it along the shaft's local ±**Z** — i.e. along the rails — and buried 20 units of track either side of the bore; the portal was invisible from every angle.
2. **Keep the box core LOW.** Any merged box tall enough to show a flat face above the boulder skin reads as a shipping crate. The core is 0.85-1.35 tall and supplies mass only; every silhouette above it is a faceted `buildRock`.
3. Corollary for the flow: **short and steep beats long and shallow.** A flow stepped 7 slabs out across the ash had nothing under it and read as glowing planks hanging in mid-air. It now drops from the ridge shoulder to the pool in 2.5 units.

## Measured numbers — "Cinder Bore" (the stock circuit)

`station · straight 0.6 · lift 4.0 (run 10.2) · straight 0.8 · [crest corner r3.6] · straight 1.0 · drop 4.0 (run 10.2) · straight 3.0 · [fast corner r3.2] · straight 14.318 · [fast corner r3.2] · hill 1.1 (run 10) · straight 2.618 · [fast corner r3.2] · straight 1.4`

where `[crest corner r]` = `turnR 12° r(2.6·r) · 66° r · 12° r(2.6·r)` and `[fast corner r]` = `turnR 5° r14 · 10° r9 · 18° r6 · 24° r · 18° r6 · 10° r9 · 5° r14`. Each fragment sums to exactly **90°**, so the four of them bring the train home on the station heading.

Verified COMPILE-ONLY with the component's own options (`coaster` / `steel` / bank 0.70 / start `[0, 0.55, 0]` / heading −90°), then **re-read live out of the browser** from `group.userData.trackReport`:

| | |
| --- | --- |
| `report.ok` | **true**, `fatal` false |
| `checkCoasterDesign('steel')` | **clean — 0 violations, 0 warnings** |
| `validateSpline` worst clearance | **5.60** |
| closure | closed, **ZERO synthesized pieces** (last piece lands 0.30 u short of the station, on its axis) |
| peak grade / summit | 30.0° / y 4.55 |
| footprint | x −19.1..8.2 × z −25.6..0.0 (27.3 × 25.6) |
| worst effective lateral | **1.13 g** (guard 1.5 g, validatePark margin 1.27 g) |
| peak roll | 25.4° |
| max +G / −G | +4.60 / **−0.49** |
| ratings (`cars: 3`) | E **5.44** / I 6.78 / N 2.15 — **thrilling** |
| drops / highest drop | 2 / **4.00** |
| air time | 0.37 s |
| length / lap | 99.44 u / 14.8 s |

**Where the excitement comes from, and why the camelback is 10 units long.** RCT2 halves the whole rating triple four separate ways (`RideRatings.cpp:2091-2140`), and a single-drop layout trips two of them: `reqNumDrops` (2) and `reqNegativeGs` (any layout with *no* airtime at all). An early draft with one 4.0 drop and no camelback measured E 2.64 for exactly that reason. The fix is one long shallow hill:

* the kit's `hill` camelback has crest curvature `2π²h/L²`, and its default length `6.3·√h` makes that a **constant ≈0.50 / unit** whatever the height — so a default camelback ridden at 9.5 u/s reads about **−4 vertical g**;
* stretching the same 1.1-unit hill over a **10-unit** run drops the curvature to 0.13 and the crest to **−0.49 g** — real airtime, sane forces;
* and its descent counts as the second drop. Both gates clear and the rating goes 2.64 → **5.44**.

### Layout rules for any `pieces` you write

1. **End FACING the station**, ~0.30 u short of the start and dead on its axis. The compiler otherwise closes the loop with a Dubins return leg at radius 2.2, ridden at full post-plunge speed, straight through the circuit.
2. **The corner fragments must sum to 360° in total.** A `12 + core + 12` corner needs `core = 66`; four 94° corners drift the heading 16° and the compiler synthesizes its way home.
3. **Ramp curvature into the fast corners.** A bare chorded arc welded onto a fast straight leaves a ~10° kink where the auto-bank has not developed, and that single junction is the G spike (the MineTrainCoaster lesson).
4. **Give the flank one long, flat, fast straight to cross.** The bore is placed on the lowest, straightest, most level stretch clear of the station — with no such stretch it will land somewhere awkward. Pin it with `tunnelU` if you want it elsewhere.

## Second circuit — "Deep Bore" (preview 3)

Same skeleton with `lift 4.4` (a 4.95 summit, 31.5° plunge), tube straight **14.726**, return leg **3.026** and `tunnelHalf={5.2}` for a 10.4-unit bore. Clean: 0 violations, worst clearance 5.69, ZERO synthesized closure, highest drop 4.41, air time 0.21 s, 101.3 u, E **5.54** / I 6.98 / N 2.18 — and worst effective lateral **1.24 g**, which is *inside* the 1.27 g margin but is exactly why the stock circuit ships at 4.0 rather than 4.4: **every 0.4 of lift costs ~0.11 g on the fast corners.**

## Budget

2 ParticleKit emitters (**220** particle capacity: portal smoke 120 + embers 100, origins walking deterministically between the two mouths, the pool and the flow head). **4** PointLights total, measured live: two inside the bore (day-and-night lerped — they *are* the lava), one night-gated station lamp, and the lead car's headlamp via `gateCarLights`. 362 meshes; everything static and repeated goes through `mergedBoxes` (portal arch, teeth, ridge core, scree, pool levee, deck, canopy, station steps). `userData.lodDetail` on the smaller lineside boulders. Deterministic throughout: `hash01` sines only, no `Math.random` / `Date.now`. Console verified **clean** across all three previews — no `warning`, no `FATAL`, no `self-inter`, no `design violation`.

## Screenshot verdicts

* **Rig, day** — the whole circuit fits: the rock flank on the near side with the track diving into it, the older flow and the glowing magma pool beside the portal, the basalt station and canopy across the back, the train mid-plunge on the far side, and the long tube run + camelback sweeping across the foreground.
* **The tunnel, day** — the money shot, and it reads exactly as intended: the track runs into a rock portal (jamb blocks, lintel, obsidian teeth), the **bore interior glows warm from within** with the molten wall veins visible on the inner face, boulders pile over and around it, the flow cascades down the shoulder into the pool at the right, and smoke drifts off both.
* **The tunnel, night (`--nightwait=15000`)** — the bore blazes, the flow and pool are the brightest things in frame and light the surrounding boulders, and the difference from the day shot is *brightness*, not presence: the `lavaGlow` lerp never gates to zero.
* **Alternate angle (48° orbit, "Deep Bore")** — the longer 10.4-unit bore from the far side, with the flank, flow and pool at the crown of the circuit and the 4-car train coming off the taller plunge.

## The lava is a LIQUID now (2026-07-25)

Two sites on this ride were "molten" in name only — static emissive crust — and
both are the ones a rider passes closest to. They are now real WaterTile sheets
on the exported **`LAVA`** palette (dark chilled crust in the wave troughs,
incandescent only where the skin tears, `glow: 1` so they brighten after dark):

* **the bore's GUTTER** — one continuous `buildWaterRibbon` down the whole tube
  at x 0.72, 0.42 wide (→ 0.51..0.93), `amp` 0.07 / `waviness` 0.26. The crust
  gutter box stays underneath as the channel BED and its lip; a per-segment sheet
  would have seamed at all eight joints. The train passes this at 9.46 u/s with
  a measured half-width of 0.373, so the ribbon is 0.14 clear of the train
  envelope and 0.15 inside the wall faces.
* **the POOL at the older flow's toe** — `buildWater`, r 1.16, 48 seg, 0.085
  above the shaft floor, inside the concentric crust rings that stay as its
  cooling shore and inside the 1.7 basalt levee. The word "boiling" in this
  file's own description was doing all the work before.

Both run at a third of the ride clock: a pool convects, it does not flow like a
channel. Segment counts kept coarse — total displacement is `amp × waviness`, so
a fine grid buys nothing at park distance (48.9 k tris for the whole ride).

Preview staging changed too: `ashField` was two flat `CircleGeometry` discs,
which read as a tarmac pancake with a compass-drawn edge from the park camera. It
is now broken ash plates with hashed heights and a **clumped** rim dither (two
low-frequency sines — a per-cell hash checkerboards, rules/component-audit.md §6).

## THE BORE CLEARANCE, MEASURED ACROSS THE WHOLE CYCLE

The question this ride exists to answer — does the train clear the aperture, all
the way through, at every point of the lap — is now measured rather than argued.
3 200 frames at 1/40 s (80 s, five bore transits, 270 frames with a train inside
the tube), every car VERTEX transformed into the bore's own shaft-local frame
(+z along the rails, +x the track side, y from the rail centreline) and compared
against the **wall INNER FACES and the roof**, never against the tunnel's centre:

| | |
|---|---|
| worst gap to the wall face (\|x\| 1.08) | **0.707** (train reaches \|x\| 0.373) |
| worst gap to the roof (1.50 above rails) | **0.479** (train tops out at 1.021) |
| lowest car vertex | 0.023 above the rail centreline |
| bore transits sampled | 5 |

Two ways that measurement lied before it was right, both recorded so the next
pass does not repeat them:

1. **Cars cannot be found by `userData.headlamp`** — only the LEAD car of a
   coaster train carries one (`gateCarLights`), so the filter found one car and
   silently ignored two. They are found by MOTION instead: the ride-group
   children whose bbox centre moves between two update times.
2. **The bore window needs BOTH axes.** With `|z_shaft| ≤ half + 0.3` alone, the
   station — which sits 25.8 u away at a yaw of ~π/2 — maps to shaft-local
   (x −25.6, z +2.9), *inside* that z window. The probe cheerfully reported a
   "wall gap" of −24.9: it was measuring a train parked 26 units from the tunnel.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 361 meshes / 48 860 tris; portal arch, teeth, ridge core, scree, levee, deck, canopy, steps all `mergedBoxes`; 34 + 22 `buildRock` boulders carry the flank silhouette |
| Detail | 15/15 | tex+bump throughout; jamb blocks, seven voussoirs, lintel, obsidian teeth, molten wall veins, roof drips; 4 PointLights (2 in the bore day-and-night lerped, 1 night-gated lamp, 1 headlamp) |
| Cohesion | 20/20 | the bore sweep above (0.707 wall / 0.479 roof over 5 transits); compile `ok: true`, 0 violations, worst clearance 5.597, ZERO synthesized closure; gutter ribbon 0.14 clear of the train, 0.15 inside the walls |
| Guest comfort | 15/15 | shared `buildCoasterCar` (its own seat/restraint rubric); 6 seats read off the live car transform; worst effective lateral 1.13 g inside the 1.27 g margin, max −G 0.49 |
| Guest location | 15/15 | 6 distinct seat anchors for capacity 6, measured on the live train (x −5.20…−2.18, y 0.957-1.257) |
| Aesthetic | 20/20 | the tunnel close-up is the money shot — rock portal, glowing bore, flow and boiling pool; night is brighter, never gated; park camera reads as a coaster diving into a flank |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/ember-probe4.tsx` (the bore sweep), `ember-probe.tsx`
(counts, seats, compile report), `probe-tunnel.mjs`.
Shots: `shots/AUD5-LavaTubeRun-tunnel.png`, `AUD5-LavaTubeRun-el50.png`,
`FINAL-LavaTubeRun-tunnel-night.png`, `AUD2-LavaTubeRun-0-az115.png`.

Fixed this pass: the gutter and the pool became live LAVA-palette liquids; the
preview's flat ash discs became clumped broken plates; the bore clearance is
measured over the whole cycle against the wall FACES (it was never wrong — but it
was never measured either).
