# MineTrainCoaster

**CANONICAL IMPORT — copy exactly:** `import { MineTrainCoaster } from './components/MineTrainCoaster';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The RCT2 **MINE TRAIN** (`ride/rtd/coaster/MineTrainCoaster.h`) as its own composable ride, riding the EXISTING spline machinery: the layout is compiled by SplineRideKit's `compileTrackPieces` and swept by `buildRideSpline({ profile: 'coaster', type: 'wooden' })`. No new CoasterType, no forked track code — a mine-themed dressing over the kit's wooden rule set, which is exactly how RCT2 models the ride.

## Why the `wooden` envelope IS the mine train's rule set

`MineTrainCoaster.h:27` enables `straight, stationEnd, liftHill, flatRollBanking, slope, slopeSteepUp/Down, slopeCurve, sBend, curveSmall, curve, curveLarge, helixDownBankedHalf, helixUpBankedHalf, brakes, onridePhoto, blockBrakes, diag*` — steep slopes and half-banked helixes are in, and there is **no corkscrew or loop group at all**. That is precisely `TYPE_RULES.wooden` in SplineRideKit (slopes ≤ 60°, banking ≤ ~25°, `inversions: false`), so the component compiles and validates with `type: 'wooden'` and everything downstream agrees: `checkCoasterDesign`'s whitelist, the design frames' bank cap (`coasterBankCap('wooden', 0.42)` → 0.42 rad ≈ 24°), `rateCoaster`'s ratings table and the runner's live 1.5 g derail guard. RCT2 even carries the ride on `WoodenSupportType::mine` (`:26`) with `ColourPresets` darkBrown / grey / darkBrown (`:50-53`) — the palette this component ships.

(One documented simplification: `rateCoaster` scores the circuit off the kit's **wooden** ratings table, not the mine train's own `RatingsData` base 2.90/2.30/2.10 × multipliers 50/30/10; the kit only ports wooden / steel / inverted tables.)

## API

```tsx
<MineTrainCoaster position={[x, z]} rotation={rad} register>
  <Station /><Straight length={0.6} /><Lift height={4.5} length={9} /> …
</MineTrainCoaster>
```

`MineTrainCoaster: React.FC<ComposableRideProps & MineTrainCoasterOpts & { children }>` — mounts at `position`/`rotation` like every composable ride. Inside a `<Park>`, `register` wires the full GameManager ride through `<ConfigurableRide>`.

`MineTrainCoasterOpts`:

| prop | meaning |
| --- | --- |
| `pieces?: TrackPiece[]` | RCT2 piece list (`compileTrackPieces` vocabulary). JSX piece children (`<Station/><Lift/><HelixR/>…`, read with `collectTrackPieces`) **win** over `pieces`. |
| `points?: [x,y,z][]` | raw control points — the escape hatch past the piece compiler (still swept + validated). `pieces` wins. |
| `carts?: number` | ore carts in the train, 1-6, default **3** |
| `riders?: boolean` | decorative riders (default true; `register` turns them OFF so real GameManager guests fill the carts through `seatWorld`) |
| `groundAt?: (x,z) => number` | terrain sampler so trestles / portal / props land on the ground (default flat) |
| `tunnelU?: number` | loop parameter of the mine-shaft portal (default: auto — the lowest, straightest, most level stretch away from the station) |

Builder: `buildMineTrainCoasterScene(three, opts) → { group, update, vehicle, seatWorld, onStateChange, crashed, invalid?, ratings? }`.
`update` is motion-gated (`createMotionGate`, spinDown 1.6 — the train parks in the station while guests board, RCT2 `Vehicle.cpp` status cycle) and drives the night gating; `vehicle` is the **lead ore cart** (RideViewer onboard/follow cam); `crashed()` reports the live 1.5 g derail guard; `ratings` is the measured RCT2 triple handed to `registerRide`. A FATAL compile sets `invalid` so the circuit never registers as a working ride. `group.userData.trackReport` carries the full compile report for harness/agent introspection.

**Capacity: 6** — 3 carts × 2 `MINE_CART_SEATS` (`MineTrainCar`'s bench offsets, read off the live cart transform by `makeSeatWorld`, so real guests ride the ore train). Registered defaults: `{ name: 'Mine Train', capacity: 6, rideDuration: 18, intensity: 6, price: 5 }`.

**Layout offsets** (component-local; the station straight is compiled along local **−x** with `heading: -π/2`, which deliberately leaves the local +z face clear of track): queue HEAD `front: 2.0` out the +z face, exit hut `exit: [1.6, 1.9]`, boarding `board: [-1.3, 0.6, 0]` on the plank deck at rail height. Circuit start `[0, 0.55, 0]`, bank `0.42`.

## What makes it a mine train (not a re-skin)

Rough-hewn sleepers hashed in length and yaw over the kit's machined crossties; log **cribbing** stacked under the tall trestle bents; a timber-framed **MINE-SHAFT PORTAL** the ore train dives through — rock-faced bore liner with dark inner panels (so the mouth reads as a hole, not a shed), timber posts/lintel/knee-braces at both mouths, timber ribs down the bore, a 26-boulder three-tier rock mound (crest / upper flank / lower flank, stood off far enough that no stone can reach the 0.29-half-width train envelope) and a scree apron; a plank **boarding deck** under a shingle canopy with edge rails and steps; an **ore hopper** on timber legs with a chute and spoil pile; a timber **pit-head headframe** with raking legs, sheave platform, pulley wheel, hoist cable and a timber-curbed shaft collar; yard clutter (timber stack, banded barrels, pick, shovel); lineside gallows lanterns and boulders in the cutting; and `MineTrainCar` ore carts (`front` lantern cart → `middle` → `end`). Night gating: all lamp glass lifts emissive on `nightKOf` and exactly **two** real point lights (portal + station) fade up, plus the lead cart's headlamp via `gateCarLights`. Everything is deterministic (`hash01` sine hashes only) and animates off the Stage clock.

## Preview circuits

Both are compiled with the component's own options (coaster / wooden / bank 0.42 / heading −90°) and were tuned with a COMPILE-ONLY probe, then re-read live out of the browser scene (`group.userData.trackReport`): **`ok: true`, design clean with ZERO violations, ZERO synthesized closure, no warnings**.

- **3D rig — Prospector's Plunge (LEAD)** — the steepest legal mine-train drop.
  `station · straight 0.6 · lift 4.5 (run 10.7) · straight 0.8 · helixR 180° r4.84 −0.5 · straight 1.0 · drop 4.0 (run 10.0) · straight 5.35 · [ramped 180° turnaround] · straight 1.4`.
  Summit **5.05**, and all 4.0 units come back in ONE plunge peaking at **31.8°** — not the 60° slope cap but RCT2's **pitch-RATE** grammar (~0.55 rad/unit; `rampPoints` spreads a 4.0 fall over a 10.0-unit run) is what caps it. The half-banked descending 180° helix off the crest is `TrackGroup::helixDownBankedHalf`; the plunge lands on the dead-straight low run where the portal sits (the auto `tunnelU` picks it — lowest, straightest, most level). Numbers: worst clearance **4.09**, closure gap 1.67 with **nothing synthesized** (the last piece lands 0.27 u short of the station, on the axis), worst effective lateral **1.09 g** vs the 1.5 g derail guard (validatePark margin 1.27), peak roll 23.7° of the 25° cap, 66.9 u of track, 17 s a lap, E **5.87** / I **9.19** / N **3.86** (intense), 2 drops, highest drop 4.0.
- **Ore Bin Spiral (alternate)** — the signature helix.
  `station · straight 0.6 · lift 4.4 (run 10.6) · straight 0.8 · helixR 360° r3.0 −1.15 · straight 1.2 · turnR 180° r4.84 · straight 1.0 · drop 3.25 · straight 7.36 · [ramped 180° turnaround] · straight 1.4`.
  A full 360° half-banked descending helix — the **−1.15 of descent IS the clearance** the spiral passes over itself with (worst clearance **1.15**; at −0.8 it fails the 0.9 guard and the compile goes FATAL) — then a level summit turnaround taken at helix speed and a 3.25 drop through the portal. 90.2 u, 20 s, peak grade 31.5°, worst lateral **1.04 g**, E **5.87** / I **8.80** / N **3.71**.

### Two hard-won layout rules (both apply to any `pieces` you write)

1. **End FACING the station.** The compiler closes whatever the pieces leave open; a residual 0.63 u / 0.48 u-off-axis end made it synthesize `turnL 211° + straight + turnL 149°` straight THROUGH the track (clearance 0.12 → FATAL). Land the last straight ~0.3 u short of the start, on the station axis.
2. **Ramp curvature into fast turns.** A chorded 40°+ arc welded onto the brake straight leaves a ~10° kink where the auto-banking (curvature-driven and smoothed) has not developed yet: that single junction read **1.28-1.42 g** effective lateral — over validatePark's 1.27 g margin — and *widening* the arc made it worse (coarser chords). Ramping the same 180° through `8° r14 · 15° r9 · 30° r6 · 74° r3.6 · 30° r6 · 15° r9 · 8° r14` (Δz 9.68, zero net Δx) drops it to **1.04-1.09 g**. Both previews share that `rampedTurnaround` fragment.
3. Corollary: the kit's `hill` camelback is a **slow-section** piece here. At the 10 u/s speeds these layouts reach on the low run, a 0.7-unit camelback reads about −4 vertical g (no vertical derail guard fires, but the ratings and the look are wrong). Keep hills high and slow.

Framing: the Stage's 34° vertical FOV crops a 29-unit circuit easily, so both previews are held still (`autoRotate={false}` — dragging still orbits) with the pose set from a 24° elevation via `dress`/`setCameraPose`, and the component is offset so the circuit centres in frame. The lead is rotated 0.42π (a shade past broadside) so the camera looks obliquely INTO the lit portal mouth; the alternate sits broadside at π/4 so the helix coil reads.

Original three.js model on the shared Stage (day/night lighting); palette, proportions and track rules referenced from the RCT2 asset library and `MineTrainCoaster.h`.
