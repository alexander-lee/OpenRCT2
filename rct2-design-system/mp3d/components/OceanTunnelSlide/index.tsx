import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWater, buildWaterRibbon } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';
import { TIDEWATER } from '../TidewaterScenery';

// ---------------------------------------------------------------------------
// SIBLING MODULES — ./parts (palette + the rig's reusable parts) and ./basin
// (the reef basin, the BORE and the PORTAL) exist ONLY because Magic Patterns
// writes WHOLE files and this rig no longer fits a single write. Nothing about
// the rig changed. <OceanTunnelSlide> and its props stay DECLARED in this file
// on purpose: the prop extractor reads only components/<Name>/index.tsx and
// cannot see through `export { X } from './y'`.
// ---------------------------------------------------------------------------
import {
  BRASS,
  GLASS,
  GLASS_GLOW,
  IRON,
  LAMP_GLOW,
  RAFT_LIVERY,
  REEF,
  REEF_D,
  RUST,
  SAND,
  SAND_2,
  SAND_BED,
  SAND_DEEP,
  SAND_SHOAL,
  SAND_WET,
  TIMBER,
  TIMBER_D,
  TRACK_COLOURS,
  TUBE_C,
  TUBE_R,
  barSpec,
  buildFishShoal,
  buildTubeRaft,
  buildTubeShell,
  drawAfterWater,
  kelpClump,
  shipLantern,
} from './parts';
import { buildReefBasin } from './basin';

/** Plain builder functions — re-exported so `import { buildTubeRaft,
 *  buildFishShoal } from '../OceanTunnelSlide'` keeps working after the split. */
export { buildFishShoal, buildTubeRaft } from './parts';
export type { FishShoalOpts, TubeRaftOpts } from './parts';

// ---------------------------------------------------------------------------
// OceanTunnelSlide — "Deepwater Chute", attraction 3 of TIDEWATER HOLLOW: a
// RAFT SLIDE down a translucent TUBE that runs THROUGH the lagoon.
//
// The station is at the TOP of the launch tower, so the first piece after it is
// THE TUBE — a 4.4-unit, 32° plunge inside a transparent shell — and the raft
// comes home on a haul-back belt at the very end. Half way down the tube dives
// clean through a REEF BASIN: a rock pool standing in the lagoon, water 2.2
// deep, with shoals of fish and kelp in it and god-rays coming down through the
// surface. Riders drop through a pool of water and out the far wall of it.
//
// SAME SPLINE MACHINERY as every other tracked ride: `compileTrackPieces`
// compiles the circuit, `buildRideSpline({ profile: 'flume' })` sweeps the
// flooded channel the raft runs in, and the TUBE is a shell swept over the
// kit's own frames — the tube is theming around the channel, not a second
// track system.
//
// WHY THE STATION IS AT THE TOP. You do not ride a slide from the bottom. The
// queue climbs a switchback stair to the LAUNCH DECK on the tower head, boards
// there, and the empty raft is hauled back up the belt at the end of the lap —
// which is exactly how a raft slide with a conveyor works. GameManager seats
// guests AT the boardPoint (registry.ts:76 — "they never walk onto the ride"),
// so an elevated boarding anchor is legal; the queue lane and both huts stay on
// the ground at the tower's foot.
//
// THE ONE RENDERING DECISION WORTH KNOWING. WaterTile's sheet is ~80% opaque by
// design, so ANYTHING under it is veiled to a fifth of its contrast — the first
// pass put the fish and the tube inside the water and lost both. The tube, the
// fish and the kelp are therefore drawn in the TRANSPARENT pass AFTER the water
// (renderOrder 2/3 against the sheet's 1) so they read as being in it rather
// than under it. The water itself is untouched: no re-saturation, no second
// shader, and nothing glossy anywhere near it (this system has de-glossed its
// water twice).
//
// Budget: 2 real PointLights (of 4), BOTH night-gated; 3 ParticleKit emitters / 240
// particles; every static repeat batched through `mergedBoxes`; fine detail
// tagged `userData.lodDetail`. Deterministic — hashed sines only, absolute-time
// updater.
// ---------------------------------------------------------------------------

/** the station straight runs along the local −x, which leaves the local +z face
 *  (where <ConfigurableRide> puts the queue lane and the huts) clear */
const HEADING = -Math.PI / 2;
/** THE STATION IS THE TOWER HEAD: the launch trough sits 4.95 above the local
 *  ground, and the whole circuit gives it back through the tube. */
const START: [number, number, number] = [0, 4.95, 0];
/** the drop, which is also the height of the tower */
const FALL = 4.4;

/**
 * THE RIDE'S OWN ACCESS GEOMETRY — the offsets `composableRide()` hands
 * <ConfigurableRide> at the foot of this file, hoisted to a named const so the
 * build can PUBLISH them on the group (`userData.access`, beside
 * `userData.lagoon`). This ride's access has to be checked AGAINST ITS OWN
 * WATER, and a probe that re-types these three numbers is a probe that measures
 * a ride nobody shipped the day one of them moves
 * (`harness/mp3d-render/probe-ots-water.mjs --access` reads this).
 *
 * ⚠️⚠️ WHY `front` IS 7.0 WHERE THE CATALOG RUNS 2.1–4.4. Because this ride
 * BRINGS ITS OWN SEA, and <ConfigurableRide> seats the queue lane and both huts
 * on the PARK's terrain (`configurableRide.tsx:684` — `max(groundAt,
 * WATER_LEVEL + 0.3)`), never on this component's sand. So every point the
 * chassis places has to stand OUTSIDE the lagoon — and the contour it has to
 * clear is not the visible waterline but the SHEET'S OWN CLIP ELLIPSE (plan
 * radius 1.16, §5b), because that is the last radius at which a fragment of
 * water can be drawn at all.
 *
 * At `front: 2.4` none of them did. Measured on the shipped component: queue
 * head at plan radius **0.854**, entrance hut 0.790, the two candidate exit
 * cells 0.751 and 0.834 — every one of them 3.4–4.5 u INSIDE the sheet, i.e.
 * standing in 0.57 of the ride's HERO WATER, with nothing but the §5b spit mask
 * keeping them dry. A hole punched in the water is not a station.
 *
 * `front` is the only lever, and both exit cells have to clear: `layout.exit` is
 * a SIDE HINT since the RCT2 adjacency rework (`configurableRide.tsx:1007`) and
 * the exit is DERIVED one 1.2 u tile along the station face from the entrance
 * hut, on whichever side the park's streets favour — so the number is set by the
 * −x cell, the deeper of the two into the cove. At 7.0 (probe, plan radii):
 * head 1.372, entrance hut 1.300, exit cells 1.276 / 1.327, so the worst of them
 * is **1.07 u outside the clip ellipse and 3.49 u outside the waterline**, and
 * the lane (laneLenOf(4) = 3.34) runs out to 1.769.
 *
 * AND ALL OF IT STAYS ON THE SPIT. The dry rectangle (`inSpit`, z ≤ 9.0) is the
 * one sand level pinned to the host's ground; outside it the apron crest climbs
 * to `SEA + 0.055` and would bury a hut seated on the park's terrain up to its
 * windows. `front` cannot be pushed past ~8.5 for that reason either.
 */
const ACCESS = {
  // the station is the TOWER HEAD, so `board` is 5.0 up; the queue lane and
  // both huts stay on the ground out the local +z face (every compiled point
  // has z ≤ 0). GameManager seats guests AT boardPoint — they never walk to it
  // — so an elevated boarding anchor is legal.
  front: 7.0,
  exit: [2.0, 2.2] as [number, number],
  board: [-1.3, 5.0, 0] as [number, number, number],
  defaults: { name: 'Deepwater Chute', capacity: 4, rideDuration: 45, intensity: 6, price: 5 },
};

/**
 * "Deepwater Chute" — the shipped layout. An out-and-back, because a slide is
 * one long plunge and a way back up:
 *   station (the LAUNCH DECK, y 4.95) · lead-in · THE TUBE (4.4 u at 31.8°)
 *   · the splash run-out · a 180° turn at the foot of the tower
 *   · the low return reach across the lagoon · THE HAUL-BACK BELT (4.4 u up)
 *   · a 180° turn round the tower head · a 1.2-u tail onto the station axis.
 * Verified with the kit's own checks: design report CLEAN (0 violations), worst
 * clearance 3.53, closure CLOSED with ZERO synthesized track, 60.04 u of arc
 * (see OceanTunnelSlide/Context.md).
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.4 },
  { type: 'drop', height: FALL }, // THE TUBE — 31.8°, advance 10.52
  { type: 'straight', length: 3.2 }, // the splash run-out
  { type: 'turnR', angle: 180, radius: 3.4 },
  { type: 'straight', length: 7.7 }, // the low return reach
  { type: 'lift', height: FALL }, // THE HAUL-BACK BELT
  { type: 'turnR', angle: 180, radius: 3.4 }, // round the tower head
  { type: 'straight', length: 1.2 }, // tail onto the station axis
];

// ---- pacing ---------------------------------------------------------------
/** free-running drift, plus the plunge term (the flume profile's own shape) */
const paceOf = (fwdY: number) => (fwdY > 0.12 ? 1.6 : 1.15 + 3.4 * Math.max(0, -fwdY));

// ---------------------------------------------------------------------------
export interface OceanTunnelSlideOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Deepwater Chute. Compiled on the 'flume' profile from the TOWER HEAD
   *  (`start [0, 4.95, 0]`, heading −90°), so the piece after the station is a
   *  `drop` and the last leg is the `lift` that hauls the raft back up. */
  pieces?: TrackPiece[];
  /** decorative riders (default true; `register` turns them OFF so REAL
   *  GameManager guests fill the four seats through seatWorld) */
  riders?: boolean;
  /** terrain sampler so the tower, the reef and the beach land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** seconds to advance the raft at t = 0 — the previews use it to open with
   *  the raft in the tube */
  phase0?: number;
}

export interface OceanTunnelSlideBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** FATAL pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
}

/**
 * The whole ride: the launch tower and its deck, the translucent tube, the reef
 * basin the tube dives through, the lagoon, the splash run-out, the haul-back
 * belt and the raft. `update` is motion-gated (the raft parks on the launch
 * deck while guests board — RCT2's Vehicle.cpp status cycle) while the SEA
 * keeps moving; `seatWorld` seats real guests in the four places and `vehicle`
 * is the raft for the RideViewer follow cam.
 */
export function buildOceanTunnelSlideScene(three: typeof THREE, opts: OceanTunnelSlideOpts = {}): OceanTunnelSlideBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; invalid?: boolean } = {};
  const seatAnchors: THREE.Object3D[] = [];
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const groundAt = opts.groundAt ?? (() => 0);

        // ---- 1. LAYOUT: the shared spline machinery ----------------------
        const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, { profile: 'flume', start: START, heading: HEADING });
        g.userData.trackReport = compiled.report;
        if (compiled.report.fatal) extras.invalid = true;
        const ride = buildRideSpline(t, compiled.points, {
          profile: 'flume',
          colours: TRACK_COLOURS,
          groundAt,
          wood: true,
        });
        g.add(ride.group);
        // the trough runs through the reef basin's water — see drawAfterWater
        drawAfterWater(ride.group, 2);
        const total = ride.curve.getLength();
        const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);

        // frame scan: footprint, summit, base and the descent window
        const M = 240;
        let x0 = Infinity;
        let x1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        let yTop = -Infinity;
        let yBot = Infinity;
        const poly: [number, number][] = [];
        for (let i = 0; i < M; i += 1) {
          const f = ride.frameAt(i / M);
          x0 = Math.min(x0, f.p.x);
          x1 = Math.max(x1, f.p.x);
          z0 = Math.min(z0, f.p.z);
          z1 = Math.max(z1, f.p.z);
          yTop = Math.max(yTop, f.p.y);
          yBot = Math.min(yBot, f.p.y);
          poly.push([f.p.x, f.p.z]);
        }
        const distToTrack = (x: number, z: number) => {
          let d = Infinity;
          for (const [px, pz] of poly) d = Math.min(d, Math.hypot(px - x, pz - z));
          return d;
        };

        // ---- 2. THE PACE TABLE: analytic u(t) ---------------------------
        // The kit's `run` integrates dt and starts the vehicle at the FOOT of a
        // long lift (makeGuardedRun's u0) — which on this layout is the far end
        // of the lagoon, so a registered ride would have parked its raft there
        // instead of on the launch deck. Instead: build t(u) once from the
        // profile's own pace, invert it, and read the raft's pose straight off
        // the gated clock. Pure, and the same clock always gives the same pose.
        const PN = 480;
        const dsArc = total / PN;
        const tAt: number[] = [0];
        for (let i = 0; i < PN; i += 1) {
          const f = ride.frameAt(i / PN);
          tAt.push(tAt[i] + dsArc / paceOf(f.fwd.y));
        }
        const LAP = tAt[PN];
        const uOf = (time: number) => {
          const ph = ((time % LAP) + LAP) % LAP;
          // tAt is monotonic — a walking index would need state, so bisect
          let lo = 0;
          let hi = PN;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (tAt[mid] <= ph) lo = mid;
            else hi = mid;
          }
          const span = tAt[hi] - tAt[lo] || 1;
          return (lo + (ph - tAt[lo]) / span) / PN;
        };
        g.userData.lapTime = LAP;

        // CYCLE-TRUE CLOCK. `createMotionGate` advances its clock by dt·speed
        // and `travelling` is not the only state that moves it: `departing`
        // eases 0→1 over spinUp 0.8 and `arriving` eases 1→0 over spinDown 1.6,
        // neither of which the ride FSM counts as ride time. Measured against a
        // bare gate driven through the real sequence (rideFsm.ts:124-195), one
        // cycle hands the runner 1.291 s MORE clock than `rideDuration`.
        //
        // `uOf` wraps on LAP, so with LAP tuned to `rideDuration` exactly that
        // surplus is never absorbed and the raft's parking spot walks round the
        // circuit. Probed over six FSM cycles it boarded 0.5 → 0.9 → 2.3 → 4.5
        // → 7.8 → 11.2 u from the boardPoint — and this ride boards on a launch
        // deck 5 u UP, so by the sixth load the raft was sitting at y 0.94 out
        // in the lagoon while the queue, the gate and the stair were still at
        // the top of the tower (probe: tw-cycletrue.tsx). That is the same
        // failure this pace table was written to avoid, one layer down.
        //
        // One divide fixes it: scale the clock so one FSM CYCLE is exactly one
        // LAP. The table, the descent window and the tube placement are all
        // untouched; the raft runs 2.8 % slower.
        const GATE_SURPLUS = 1.291;
        const CYCLE_SCALE = LAP / (45 + GATE_SURPLUS);
        g.userData.cycleScale = CYCLE_SCALE;

        // ---- 3. THE DESCENT WINDOW: where the tube runs ------------------
        // from the last level frame before the plunge to the first level frame
        // after it, plus a little run-out, so the tube is placed off the LAYOUT
        // and not off hard-coded loop parameters
        let uSteep = 0;
        let steep = 0;
        for (let i = 0; i < 480; i += 1) {
          const f = ride.frameAt(i / 480);
          if (f.fwd.y < steep) {
            steep = f.fwd.y;
            uSteep = i / 480;
          }
        }
        let uIn = uSteep;
        for (let i = Math.floor(uSteep * 480); i >= 0; i -= 1) {
          if (ride.frameAt(i / 480).fwd.y > -0.05) {
            uIn = i / 480;
            break;
          }
        }
        let uOut = uSteep;
        for (let i = Math.ceil(uSteep * 480); i < 480; i += 1) {
          if (ride.frameAt(i / 480).fwd.y > -0.05) {
            uOut = i / 480;
            break;
          }
        }
        const uTubeA = Math.max(0, uIn - 0.6 / total);
        const uTubeB = Math.min(1, uOut + 2.6 / total); // the tube runs on into the splash
        const runF = ride.frameAt(Math.min(1, uOut + 0.4 / total));
        const SPLASH_AT = runF.p.clone();

        // ---- 4. THE LAGOON'S PLAN ---------------------------------------
        // ONE `buildWater` sheet round the whole footprint, WaterTile's palette
        // untouched. The turquoise read comes from a pale coral-sand bed under
        // the surface, exactly as in ReefRacer — and, as in ReefRacer, getting
        // that read took rebuilding the whole basin rather than the shader.
        //
        // ⚠️⚠️ WHY THIS SECTION WAS REBUILT (2026-07): the lagoon read as a flat
        // painted teal disc, and every cause was structural rather than tonal.
        // Measured on the shipped component with `harness/mp3d-render/
        // probe-ots-water.mjs` (raycast, 4309 cells inside the sheet, previews'
        // flat ground):
        //
        //   * THE PALE BED WAS BURIED. Bed plates were seated at `groundAt −
        //     0.10`, top −0.065 — 65 mm UNDER the host's own surface (Stage's
        //     grass disc in a preview, the <Terrain> mesh in a park), which is
        //     drawn opaque and OCCLUDES it. So "the turquoise read comes from a
        //     pale coral-sand bed" was never true here: what showed through the
        //     sheet was the host's ground, at ONE constant 0.62 depth over the
        //     whole pool. Same defect, same cause as ReefRacer's §2a.
        //   * SO THERE WAS NO DEPTH READ AT ALL. Depth p10 → p90 spread over the
        //     floor: 0.0815 u against a 0.69 depth, i.e. flat to within 12 %,
        //     and all of it invisible under the host's surface anyway.
        //   * THE SHORELINE WAS THE SHADER'S CLIP ELLIPSE, not sand. The dry
        //     apron topped out at `groundAt + 0.113` — 0.507 UNDER a waterline
        //     at 0.620 — so the sheet ended in a half-metre WALL of water at a
        //     drawn ellipse, with the host's bare grass showing in the gap
        //     between that ellipse and the wobbled sand contour.
        //   * THE SHEET WAS PAINTED OVER THE RIDE'S OWN DRY LAND: 579 cells of
        //     the station SPIT (median depth 0.568) and 187 of the dry apron.
        //     The ride's ACCESS was inside its own cove too — queue head at plan
        //     radius 0.854, entrance hut 0.790, both candidate exit cells 0.751
        //     and 0.834 — so in a park the huts and the queue lane stood under
        //     0.57 of water. That one is fixed where it was caused, in the
        //     component's own `layout` (`front` 2.4 → 7.0, see ACCESS at the top
        //     of this file); it is NOT what the §5b spit mask is for.
        //   * 8 of 24 reef items stood PROUD of the surface (kelp tops to 1.25
        //     against a 0.62 waterline) because they were seated on `groundAt`
        //     while the water was 0.62 above it.
        //
        // ⚠️ AND THE WATERLINE IS NOT FREE TO MOVE. `SEA` is pinned by the RIDE:
        // the flume trough's centreline bottoms out at 0.55 and its walls reach
        // +0.18, so the run-out only reads as awash for `SEA` in ~0.55…0.73.
        // ReefRacer could spend ONE RCT2 land step (0.30) raising its beach
        // around a waterline it chose; here the waterline is 0.62 above the
        // host's ground and the beach has to climb to meet it. That is what the
        // §5 LIP does, and it is the one cost of this fix — see the note there.
        const LX = (x0 + x1) / 2;
        const LZ = (z0 + z1) / 2;
        const LA = (x1 - x0) / 2 + 4.2;
        const LB = (z1 - z0) / 2 + 4.6;
        const SEA = groundAt(LX, LZ) + 0.62; // the raft floats with the rails just awash
        /** the DRY SAND SPIT the tower foot, the stair, the queue lane and both
         *  huts stand on. It is tested FIRST, before any water class, because
         *  <ConfigurableRide> seats the huts and the lane on the PARK's terrain
         *  (`configurableRide.tsx:684` — `max(groundAt, WATER_LEVEL + 0.3)`),
         *  NOT on this component's sand: anything this file lifts under them
         *  buries them, and anything it floods drowns them. */
        const inSpit = (x: number, z: number) => x > -5.2 && x < 8.0 && z > -2.2 && z < 9.0;
        const lagoonR = (x: number, z: number) => {
          const dx = (x - LX) / LA;
          const dz = (z - LZ) / LB;
          const az = Math.atan2(dz, dx);
          const wob = 1 + 0.06 * Math.sin(az * 3 + 1.1) + 0.035 * Math.sin(az * 5 - 2.3) + 0.02 * Math.sin(az * 8 + 0.4);
          return Math.hypot(dx, dz) / wob;
        };
        const isWater = (x: number, z: number) => lagoonR(x, z) < 1 && !inSpit(x, z);
        /** how far INTO the spit a point is, measured from the spit's three
         *  WATER-FACING edges only (the +z edge backs onto the park and must stay
         *  at the host's level). Drives both the spit's shallow-wash strip and
         *  the §5b mask that hides the sheet over the dry service area. */
        const spitInset = (x: number, z: number) => Math.min(x + 5.2, 8.0 - x, z + 2.2);
        /** THE BASIN FLOOR, and it is a DISH: 0.61 of water over the middle
         *  shelving up to 0.12 at the rim, so the pool has a depth GRADIENT
         *  instead of one depth everywhere. Two floors it can never cross:
         *
         *   1. `groundAt + 0.012` — the host's own surface is opaque and drawn
         *      first, so a bed under it is invisible (the defect above). Depth
         *      here cannot be DUG, only BUILT UP.
         *   2. the FLUME TROOUGH. The dish shelves to 0.50 at the rim and parts
         *      of the circuit reach plan radius ~0.86, where the trough floor
         *      (`yBot − 0.10` = 0.45) would be UNDER the sand. So the bed is
         *      pushed back down to `yBot − 0.22` within 1.8 u of the track and
         *      eased out to the full dish by 3.0 u — the raft runs in a dredged
         *      channel through the shoals, which is also how a real flume in a
         *      lagoon looks. */
        const bedTopAt = (x: number, z: number) => {
          const floor = Math.max(groundAt(x, z) + 0.012, SEA - 0.62);
          const shelf = SEA - 0.12;
          const f = Math.min(1, Math.max(0, (lagoonR(x, z) - 0.35) / 0.55));
          const dish = floor + (shelf - floor) * f * f * (3 - 2 * f);
          const dredge = yBot - 0.22; // 0.12 clear under the trough's own floor
          const k = Math.min(1, Math.max(0, (distToTrack(x, z) - 1.8) / 1.2));
          return Math.min(dish, dredge + (dish - dredge) * k * k * (3 - 2 * k));
        };
        /** the DRY APRON's crest — the basin LIP the waterline sits just under.
         *
         *  ⚠️ THIS IS THE ONE COST OF THE FIX, and it is unavoidable while `SEA`
         *  is pinned by the ride (see §4). A beach has to cross the waterline, so
         *  with the water 0.62 above the host's ground the rim of this cove
         *  stands ~0.675 above the terrain around it — two-and-a-bit RCT2 land
         *  steps, where ReefRacer spent one. Only the RIM is raised: outside
         *  `lagoonR` 1.20 the lift eases back to the apron's original
         *  `groundAt + 0.07` by 1.75, which on this ellipse is a 4–9 u run, i.e.
         *  a 0.07–0.15 gradient — a dune face, not a kerb, and nothing the park
         *  places beyond 1.75 is touched. */
        const lipTopAt = (x: number, z: number) => {
          const base = groundAt(x, z) + 0.07;
          const crest = Math.max(base, SEA + 0.055);
          const f = Math.min(1, Math.max(0, (1.75 - lagoonR(x, z)) / 0.55));
          return base + (crest - base) * f * f * (3 - 2 * f);
        };
        // THE LAGOON'S NUMBERS, published like `trackReport` so "is the water
        // above the bed and below the beach" is a READ and not a re-derivation
        // (harness/mp3d-render/probe-ots-water.mjs measures against this).
        g.userData.lagoon = {
          x: LX,
          z: LZ,
          a: LA,
          b: LB,
          waterY: SEA,
          bedFloorY: bedTopAt(LX, LZ),
          bedShelfY: SEA - 0.12,
          wetY: SEA - 0.09,
          lipY: lipTopAt(LX + LA, LZ),
          spitY: groundAt(LX, LZ) + 0.012,
        };
        // THE ACCESS OFFSETS, published for the same reason: "is this ride's own
        // queue standing in this ride's own sea" is then a READ off one built
        // group, not two files' arithmetic compared by hand (which is how the
        // 0.854 defect survived a whole water rebuild). See ACCESS at the top.
        g.userData.access = ACCESS;

        // ---- 5. THE SAND: the ride brings its own ground ------------------
        // Built BEFORE the water, because the water is CUT TO IT (§5b).
        //
        // Every level is quoted as a TOP and expressed against the WATERLINE,
        // never against `groundAt` alone, because what matters about a beach is
        // where it meets the water:
        //
        //     dry apron crest   SEA + 0.055   <- the LIP, the basin's rim
        //     awash wet band    SEA − 0.090   <- the submerged shore strip
        //     rim shelf         SEA − 0.120   <- where the dish comes up to meet it
        //     bed floor         SEA − 0.608   <- PALE sand, now ABOVE the host's ground
        //     station spit      groundAt + 0.012  <- the ONE level that does NOT move
        //
        // ⚠️ EVERY PLATE IS A SLAB, NOT A TILE. `THK` was 0.07, which was only
        // ever safe while every plate sat ON `groundAt`. The lip's top is now
        // 0.675 ABOVE the host's surface, so a 0.07 tile would be a paving slab
        // floating with daylight under its edges. At 0.85 every plate's
        // underside is buried in the host's ground and the lattice reads as a
        // solid sand body; it costs nothing — a box is 12 triangles whatever its
        // height, and they are all in one merged mesh.
        const PAD = 7.0;
        const STEP = 1.15;
        const THK = 0.85;
        const GX = x0 - PAD;
        const GZ = z0 - PAD;
        const NX = Math.floor((x1 + PAD - GX) / STEP) + 1;
        const NZ = Math.floor((z1 + PAD - GZ) / STEP) + 1;
        // per-cell plate geometry, kept so the water sheet can be tucked under
        // whatever the lattice actually put there. Integer indices, not a float
        // accumulator: the old `for (x = x0 - PAD; x <= x1 + PAD; x += STEP)`
        // drifts, and an off-by-one cell at the shoreline is a hole in the beach.
        const pTop = new Float32Array(NX * NZ);
        const pRot = new Float32Array(NX * NZ);
        const pHX = new Float32Array(NX * NZ);
        const pHZ = new Float32Array(NX * NZ);
        {
          // THE BED IS SPLIT BY DEPTH, and that split is the depth-graded colour
          // (see SAND_DEEP / SAND_SHOAL in ./parts): three merged meshes instead
          // of one, +2 draw calls, and the only thing in this component that can
          // put a gradient into a depth-blind water shader.
          const bedDeep: MergedBoxSpec[] = [];
          const bedMid: MergedBoxSpec[] = [];
          const bedShoal: MergedBoxSpec[] = [];
          const wet: MergedBoxSpec[] = [];
          const dry: MergedBoxSpec[] = [];
          const dry2: MergedBoxSpec[] = [];
          const spit: MergedBoxSpec[] = [];
          const dunes: MergedBoxSpec[] = [];
          const ripples: MergedBoxSpec[] = [];
          for (let ix = 0; ix < NX; ix += 1)
            for (let iz = 0; iz < NZ; iz += 1) {
              const x = GX + ix * STEP;
              const z = GZ + iz * STEP;
              const h1 = hash01(x * 1.7 + z * 3.1);
              const h2 = hash01(x * 5.3 + z * 0.9);
              const h3 = hash01(x * 2.3 + z * 6.7);
              const gy = groundAt(x, z);
              const dimX = STEP + 0.52 + h3 * 0.22;
              const dimZ = STEP + 0.52 + h1 * 0.22;
              const rot = (h1 - 0.5) * 0.5;
              const spec: MergedBoxSpec = { dims: [dimX, THK, dimZ], pos: [x, gy, z], rotY: rot, repeat: [2, 2] };
              /** seat a plate by its TOP surface */
              const seatTop = (top: number) => {
                spec.pos = [x, top - THK / 2, z];
              };
              // ⚠️ THE PLATES OVERLAP, AND THAT IS WHAT PUTS SAND THROUGH WATER.
              // dims are STEP + 0.52…0.74 on a STEP 1.15 lattice and every plate
              // is rotated, so a plate classified by its CENTRE reaches up to
              // 1.29 u past it. A plate is DRY only when ALL FOUR of its rotated
              // corners are clear of the water (ReefRacer learned this after
              // 32 of 72 azimuths had the sheet's rim buried in proud sand).
              const cs = Math.cos(rot);
              const sn = Math.sin(rot);
              let cornerR = Infinity;
              for (const sx of [-1, 1] as const)
                for (const sz of [-1, 1] as const) {
                  const wx = x + cs * (sx * dimX * 0.5) + sn * (sz * dimZ * 0.5);
                  const wz = z - sn * (sx * dimX * 0.5) + cs * (sz * dimZ * 0.5);
                  cornerR = Math.min(cornerR, lagoonR(wx, wz));
                }
              const r = lagoonR(x, z);
              if (inSpit(x, z)) {
                // THE SPIT, and it is the one level that does not move: the huts
                // and the queue lane are seated on the PARK's terrain, so lifting
                // this buries them and flooding it drowns them (§4). Its outer
                // 1.6 u — the strip that faces the water and is inside the
                // lagoon at all — is toned as WET sand, because after §5b that
                // strip is exactly where the sheet thins out to nothing over it.
                seatTop(gy + 0.012 + h2 * 0.006);
                if (spitInset(x, z) < 1.6 && r < 1.05) wet.push(spec);
                else spit.push(spec);
              } else if (r < 0.92) {
                // THE BED. `bedTopAt` is the dish, floored ABOVE the host's own
                // surface so the pale sand is finally visible, and pushed back
                // under the trough near the track. Split three ways by how much
                // water stands over it — deep / mid / shoal.
                const top = bedTopAt(x, z);
                seatTop(top - h2 * 0.008);
                const d = SEA - top; // the local depth
                // ⚠️ DITHER THE CLASS BOUNDARY. Classified on the raw depth, the
                // three tones drew clean depth CONTOURS across a lattice of
                // hard-edged rectangles, and the first render came back reading
                // as a tiled swimming-pool floor rather than sand. ±0.09 of hashed
                // depth interleaves the classes over ~2 plates either side of each
                // boundary, so the floor is mottled — which is also what a real
                // sand bed does, patch by patch.
                const dd = d + (h1 - 0.5) * 0.18;
                (dd > 0.42 ? bedDeep : dd > 0.22 ? bedMid : bedShoal).push(spec);
                // RIPPLE RIDGES on the bed: sand bars under clear water, which is
                // the cheapest thing there is that reads as "you can see the
                // bottom" — and they lie ACROSS the plate seams, which is the other
                // half of why they are here. Anywhere the bottom is actually
                // legible (under 0.42 of water), never in the raft's channel, and
                // ONE merged mesh whatever the count.
                if (d < 0.42 && h3 > 0.42 && distToTrack(x, z) > 2.0)
                  ripples.push({
                    dims: [0.28 + h1 * 0.5, 0.05, 1.1 + h2 * 0.8],
                    pos: [x + (h2 - 0.5) * 0.9, top + 0.02, z + (h3 - 0.5) * 0.9],
                    rotY: h1 * 3.1 + 0.9,
                    repeat: [1, 2],
                  });
              } else if (cornerR < 1.04) {
                // the awash WET band: 0.09 UNDER the waterline, so it is a
                // submerged shore strip and not the wide dry shelf it used to be
                // — and 0.034 under the swell's own trough (±0.056), which is the
                // clearance that stops the sheet clipping through to bare sand.
                // Same level the dish shelves up to, so bed and band meet flush.
                seatTop(SEA - 0.09 - h2 * 0.006);
                wet.push(spec);
              } else {
                // the DRY APRON — the basin LIP, 0.055 over the waterline
                seatTop(lipTopAt(x, z) + h2 * 0.008);
                (h3 > 0.5 ? dry : dry2).push(spec);
                // low DUNES on the outer berm, so the shoreline has a back to it
                if (r > 1.22 && h3 > 0.78)
                  for (let k = 0; k < 2; k += 1)
                    dunes.push({
                      dims: [(1.7 - k * 0.4) * (0.85 + h1 * 0.5), 0.14, (1.7 - k * 0.4) * (0.85 + h2 * 0.5)],
                      pos: [x + (h1 - 0.5) * 0.4, lipTopAt(x, z) + 0.03 + k * 0.1, z + (h2 - 0.5) * 0.4],
                      rotY: h3 * 2.4 + k,
                      repeat: [2, 2],
                    });
              }
              const k = ix * NZ + iz;
              pTop[k] = (spec.pos as [number, number, number])[1] + THK / 2;
              pRot[k] = rot;
              pHX[k] = dimX * 0.5;
              pHZ[k] = dimZ * 0.5;
            }
          // SHELL AND CORAL RUBBLE ON THE BED, pushed into the RIPPLE mesh so it
          // costs no extra draw call. Same job as the litter on the berm: the
          // plate lattice draws straight edges and a scatter of small chips breaks
          // every one of them — but these are the ones you see THROUGH the water,
          // which is where the rectangles were most obvious.
          for (let k = 0; k < 150; k += 1) {
            const h1 = hash01(k * 2.7 + 301);
            const h2 = hash01(k * 5.1 + 307);
            const h3 = hash01(k * 8.3 + 311);
            const ang = h1 * Math.PI * 2;
            const rr = 0.25 + 0.72 * h2;
            const cx = LX + Math.cos(ang) * LA * rr;
            const cz = LZ + Math.sin(ang) * LB * rr;
            if (!isWater(cx, cz) || distToTrack(cx, cz) < 1.7) continue;
            const sz = 0.11 + h3 * 0.2;
            ripples.push({
              dims: [sz, 0.05 + h1 * 0.03, sz * (0.55 + h2 * 0.8)],
              pos: [cx, bedTopAt(cx, cz) + 0.02, cz],
              rotY: h2 * 3.1,
              rotZ: (h3 - 0.5) * 0.35,
            });
          }
          const opt = { tex: 'sand' as const, rough: 1, bump: 0.05, flat: true };
          // every lattice mesh is TAGGED with the level it carries. All the sand
          // classes are the same `mat()` white-with-a-texture material (the colour
          // goes into the generated texture), so a probe cannot tell them apart by
          // material colour — and "which of these is the beach and which is the
          // bed" is exactly the question a waterline has to be checked against.
          const tag = (m: THREE.Object3D, sand: string) => {
            m.userData.sand = sand;
            return m;
          };
          for (const [specs, col] of [
            [bedDeep, SAND_DEEP],
            [bedMid, SAND_BED],
            [bedShoal, SAND_SHOAL],
          ] as const) {
            const bm = tag(mergedBoxes(t, specs, col, opt), 'bed');
            bm.castShadow = false; // a shadow cast INSIDE the water reads as silt
            g.add(bm);
          }
          const rip = tag(mergedBoxes(t, ripples, SAND_SHOAL, opt), 'bed');
          rip.castShadow = false;
          rip.userData.lodDetail = true;
          g.add(rip);
          const wm = tag(mergedBoxes(t, wet, SAND_WET, opt), 'wet');
          wm.castShadow = false;
          g.add(wm);
          g.add(tag(mergedBoxes(t, dry, SAND, opt), 'dry'));
          g.add(tag(mergedBoxes(t, dry2, SAND_2, opt), 'dry'));
          g.add(tag(mergedBoxes(t, spit, SAND, opt), 'spit'));
          g.add(tag(mergedBoxes(t, dunes, SAND_2, opt), 'dune'));
          const litter: MergedBoxSpec[] = [];
          for (let k = 0; k < 220; k += 1) {
            const h1 = hash01(k * 1.7 + 11);
            const h2 = hash01(k * 3.9 + 29);
            const h3 = hash01(k * 6.3 + 47);
            const ang = h1 * Math.PI * 2;
            const rr = 1.1 + 0.3 * h2;
            const cx = LX + Math.cos(ang) * LA * rr;
            const cz = LZ + Math.sin(ang) * LB * rr;
            if (inSpit(cx, cz)) continue;
            // ⚠️ REJECT ON THE WOBBLED RADIUS, not on `rr`. `rr` is a multiple of
            // the PLAIN ellipse and the shoreline is `lagoonR` = plain / wobble,
            // with the wobble reaching 1.115 — so chips laid at rr 1.06 landed at
            // lagoonR 0.95, inside the cove, and were seated on `lipTopAt`'s crest
            // 0.15 above sand that is 0.09 UNDER the waterline. They read as four
            // white tiles floating on the lagoon, which is the exact "pasted on a
            // decal" look this whole pass exists to remove.
            if (lagoonR(cx, cz) < 1.1) continue;
            const sz = 0.09 + h3 * 0.15;
            litter.push({
              dims: [sz, 0.045 + h1 * 0.03, sz * (0.6 + h2 * 0.7)],
              // ON the apron, not on the host's ground: the apron's crest moved
              // up with the waterline, and chips left at `groundAt + 0.11` would
              // have been swallowed by it
              pos: [cx, lipTopAt(cx, cz) + 0.005, cz],
              rotY: h2 * 3.1,
              rotZ: (h3 - 0.5) * 0.4,
            });
          }
          const lm = mergedBoxes(t, litter, 0xe4dcc0, { tex: 'concrete', rough: 0.95, bump: 0.05, flat: true });
          lm.userData.lodDetail = true;
          g.add(lm);
        }

        /** the TOP of the sand at (x, z): the max over every plate that really
         *  covers the point. Plates overlap by design, so this is a max over the
         *  ±2 lattice cells a 1.89-wide plate on a 1.15 lattice can reach from —
         *  not a lookup of the nearest cell. */
        const sandTopAt = (px: number, pz: number) => {
          const fx = Math.round((px - GX) / STEP);
          const fz = Math.round((pz - GZ) / STEP);
          let best = -Infinity;
          for (let ix = fx - 2; ix <= fx + 2; ix += 1) {
            if (ix < 0 || ix >= NX) continue;
            for (let iz = fz - 2; iz <= fz + 2; iz += 1) {
              if (iz < 0 || iz >= NZ) continue;
              const k = ix * NZ + iz;
              if (pTop[k] <= best) continue;
              const dx = px - (GX + ix * STEP);
              const dz = pz - (GZ + iz * STEP);
              const cs = Math.cos(pRot[k]);
              const sn = Math.sin(pRot[k]);
              if (Math.abs(cs * dx - sn * dz) > pHX[k]) continue;
              if (Math.abs(sn * dx + cs * dz) > pHZ[k]) continue;
              best = pTop[k];
            }
          }
          return best;
        };

        // ---- 5b. THE SHEET, TUCKED INTO ITS OWN BASIN --------------------
        // amp 0.22 × waviness 0.85 → ±0.056 of swell about `SEA`. Waviness went
        // 0.6 → 0.85 deliberately: in WaterTile it scales the fragment stage's
        // RIPPLE-NORMAL wobble, the crest foam and the twinkle as well as the
        // swell, and "no surface life" was half of what made this pool read as
        // paint. The troughs still clear the rim shelf (`SEA − 0.12`) by 0.064,
        // so the sheet never clips through to bare sand, and it is one uniform
        // knob on the existing shader — no per-ripple meshes, no second shader.
        //
        // ⚠️ THE SHEET IS AN ELLIPSE AND THE COVE IS NOT, and that was the hard
        // teal-to-sand cut. The shader clips `length(vLocal) > uRadius`, so the
        // waterline used to BE that clip: a 0.5-high wall of water where it met
        // an apron 0.507 below the surface, with bare host grass in the gap
        // between the clip and the wobbled sand contour (measured: shore-band
        // widths from −1.57 to +3.93 u, i.e. dry plates INSIDE the last water
        // cell on 11 of 24 azimuths).
        //
        // The fix is ReefRacer's §3b, and it is not "raise the sheet" (that
        // floods the apron) or "punch a hole in it" (that loses the shader's own
        // shore foam and edge alpha-fade, which live on `uRadius`). It is to BAKE
        // A DIVE into the plane's own vertices: wherever the sand stands above
        // the water plane the sheet slides 0.05 UNDER it and is hidden by it, so
        // THE VISIBLE WATERLINE BECOMES THE REAL SAND SURFACE. `vLocal` is
        // `position.xy`, which a height-only displacement does not touch, so the
        // rim fade and the foam ring are untouched.
        //
        // ⚠️ AND THE SHEET MUST BE BIGGER THAN THE COVE. The sand's shoreline is
        // the WOBBLED `lagoonR`, whose wobble reaches 1.115, while the shader
        // clips the UNWOBBLED ellipse at 1.0 — so on every azimuth where the
        // wobble pushed the sand out past 1.0 there was wet sand with no water on
        // it. `uRadius` therefore goes to LB · 1.16, past the wobble's own
        // maximum, and the plane grows with it (2.06 → 2.39) so the clip circle
        // still falls inside the plane's own rim.
        //
        // ⚠️ THE DIVE ALSO CARRIES THE SPIT, and that part is NOT in ReefRacer.
        // The spit cannot be raised (the huts and the queue lane are seated on
        // the park's terrain, §4) so it can never occlude a sheet 0.6 above it —
        // yet 579 cells of it were being painted teal. So the dive is driven by a
        // MASK, not by sand height alone: over the spit, past 1.6 u in from its
        // water-facing edges, the sheet is pushed below the host's ground, where
        // the host's own opaque surface depth-rejects it. The cone dilation then
        // makes that boundary a 2 u ramp of thinning water rather than a cut —
        // shallow water running out over flat sand, which is what the top of a
        // beach actually looks like.
        const lagoon = buildWater(t, LB * 2.39, 128, LB * 1.16, false, 0.22, 0.85);
        lagoon.mesh.position.set(LX, SEA, LZ);
        lagoon.mesh.scale.set(LA / LB, 1, 1); // local circle -> world ellipse
        {
          const HIDE = 0.05; // how far under proud sand the sheet is tucked
          const SLOPE = 0.3; // the dive's own gradient — a 17° water surface
          const RAD = 3; // cone-dilation radius, in vertices
          const attr = lagoon.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
          const SEG = 128;
          const W = SEG + 1;
          const kx = LA / LB; // the mesh's x scale: local x -> world x
          const raw = new Float32Array(W * W);
          for (let i = 0; i < attr.count; i += 1) {
            // mesh.rotation.x = −π/2, so local (x, y, z) lands at world
            // (LX + kx·x, SEA + z, LZ − y)
            const wx = LX + kx * attr.getX(i);
            const wz = LZ - attr.getY(i);
            const over = sandTopAt(wx, wz) - SEA;
            let need = over > 0 ? over + HIDE : 0;
            // the SPIT mask: no sand here is above the water, so the sheet is
            // sunk under the HOST's ground instead and depth-rejected by it
            if (inSpit(wx, wz) && spitInset(wx, wz) > 1.6) need = Math.max(need, SEA - groundAt(wx, wz) + HIDE);
            raw[i] = need;
          }
          // MAX-PLUS (cone) dilation: smooths the plate rectangles into a
          // shoreline and can only ever dive DEEPER, so nothing the raw pass
          // caught can resurface. Spacing differs per axis because of the scale.
          const sx = (kx * LB * 2.39) / SEG; // = the plane size passed to buildWater
          const sz = (LB * 2.39) / SEG;
          const dive = new Float32Array(W * W);
          for (let iy = 0; iy < W; iy += 1)
            for (let ix = 0; ix < W; ix += 1) {
              let best = 0;
              for (let dy = -RAD; dy <= RAD; dy += 1) {
                const jy = iy + dy;
                if (jy < 0 || jy >= W) continue;
                for (let dx = -RAD; dx <= RAD; dx += 1) {
                  const jx = ix + dx;
                  if (jx < 0 || jx >= W) continue;
                  const v = raw[jy * W + jx] - SLOPE * Math.hypot(dx * sx, dy * sz);
                  if (v > best) best = v;
                }
              }
              dive[iy * W + ix] = best;
            }
          for (let i = 0; i < attr.count; i += 1) attr.setZ(i, -dive[i]);
          attr.needsUpdate = true;
          lagoon.mesh.geometry.computeBoundingSphere();
        }
        lagoon.mesh.userData.lagoonSheet = true; // so a probe can find the sheet by name
        g.add(lagoon.mesh);
        g.userData.lagoon.sheetRadius = LB * 1.16;

        const lampMats: THREE.MeshStandardMaterial[] = [];
        /** the tube's glass, kept for the night gate (see the shell build) */
        let tubeGlassMat: THREE.MeshStandardMaterial | null = null;
        const shoals: { grp: THREE.Group; c: THREE.Vector3; r: number; ph: number; sp: number; yaw0: number }[] = [];

        // ---- 6. THE REEF BASIN: the water the tube dives through ---------
        // A rock pool standing in the lagoon, walled to ~2.6-3.1, water at
        // BASIN_Y and a floor 2.2 units under it — deep on purpose: the tube
        // crosses at 31.8°, so every 0.1 of depth buys only 0.16 of submerged
        // run, and a shallow "shelf" pool gave the tube barely a unit inside
        // the water. The tube enters through the air above the surface, runs
        // ~3.5 units THROUGH the water, dips below the level of the pool's own
        // floor, and leaves through the seaward wall below the waterline, where
        // the wall is broken and the pool spills into the lagoon.
        //
        // AND IT IS BORED THROUGH THAT WALL — see 6a and 6b below. The first
        // pass merely NOTCHED the wall down to the tube's crown, which buried
        // the tube in the rock instead of opening it; measured along the tube's
        // own axis, 30 of 401 stations sat inside solid rock and the clear
        // radius on the crossing was 0.00. "It looks blocked" was literally
        // true.
        const basinInfo = (() => {
          const BASIN_Y = yBot + 0.45 * (yTop - yBot);
          // the frame on the plunge whose rail is at BASIN_Y
          let uB = (uIn + uOut) / 2;
          let best = Infinity;
          for (let i = Math.floor(uIn * 480); i <= Math.ceil(uOut * 480); i += 1) {
            const f = ride.frameAt(i / 480);
            const d = Math.abs(f.p.y - BASIN_Y);
            if (d < best) {
              best = d;
              uB = i / 480;
            }
          }
          return { u: uB, y: BASIN_Y, f: ride.frameAt(uB) };
        })();
        const BASIN_R = 3.5;
        const BASIN_FLOOR = basinInfo.y - 2.2;
        const basin = basinInfo.f.p.clone();
        g.userData.basinAt = [basin.x, basinInfo.y, basin.z];
        const basinWater = buildWater(t, BASIN_R * 2.06, 96, BASIN_R, 0.9, 0.14, 0.35);
        // ---- 6a/6b THE BORE + THE PORTAL — see ./basin.ts, lifted verbatim
        buildReefBasin({
          t,
          g,
          ride,
          groundAt,
          distToTrack,
          yawOf,
          basin,
          basinInfo,
          basinWater,
          BASIN_R,
          BASIN_FLOOR,
          SEA,
          uTubeA,
          uTubeB,
          shoals,
        });

        // ---- 7. THE TUBE -------------------------------------------------
        const tubeFrames: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        const TN = 120;
        for (let i = 0; i <= TN; i += 1) {
          const f = ride.frameAt(uTubeA + ((uTubeB - uTubeA) * i) / TN);
          tubeFrames.push({ p: f.p.clone(), side: f.side.clone(), up: f.up.clone() });
        }
        {
          // THE SHELL IS DRAWN LAST AND WRITES NO DEPTH, and this is the whole
          // ball game. A transparent shell that writes depth puts its NEAR wall
          // in the depth buffer, and everything inside the tube — the raft, its
          // riders, the channel — is then depth-rejected: the first pass had a
          // beautiful empty tube and an invisible raft. With `depthWrite` off and
          // renderOrder 4 the layering is: water (1) → channel + raft (2) →
          // ironwork, fish and kelp (3) → glass (4), so the shell TINTS what is
          // inside it instead of hiding it.
          const shellMat = mat(t, GLASS, { rough: 0.55, metal: 0, opacity: 0.4 });
          shellMat.side = t.DoubleSide;
          shellMat.depthWrite = false;
          // AND IT IS LIT FROM WITHIN AFTER DARK. The night render of the first
          // pass lost the tube completely: the ride's two lamps light the tower
          // and the stair, and the SIGNATURE — a glass tunnel through a reef
          // pool — went to a few dark hoop lines. An oceanarium tunnel is lit
          // from inside, so the shell carries its own night-gated emissive
          // (emissive only: no third PointLight, the budget stays at 2). Kept
          // low — 0.34 — because this glass is also 40 % transparent, and a
          // transparent emissive shell blooms fast; the target is "you can see
          // where the tunnel goes", not a neon tube.
          shellMat.emissive = new t.Color(GLASS_GLOW);
          shellMat.emissiveIntensity = 0.02;
          tubeGlassMat = shellMat;
          const shell = buildTubeShell(t, tubeFrames, shellMat);
          shell.renderOrder = 4;
          g.add(shell);
          // HOOP RIBS every ~1.05 units, plus a keel rail and two side rails —
          // one merged mesh for the lot
          const ribs: MergedBoxSpec[] = [];
          const RIBS = Math.max(4, Math.round((uTubeB - uTubeA) * total / 1.45));
          for (let r = 0; r <= RIBS; r += 1) {
            const f = ride.frameAt(uTubeA + ((uTubeB - uTubeA) * r) / RIBS);
            const fwd = new t.Vector3().crossVectors(f.side, f.up);
            for (let j = 0; j < 16; j += 1) {
              const a = (j / 16) * Math.PI * 2;
              const c = f.p
                .clone()
                .addScaledVector(f.up, TUBE_C + Math.sin(a) * (TUBE_R + 0.035))
                .addScaledVector(f.side, Math.cos(a) * (TUBE_R + 0.035));
              const m = new t.Matrix4().makeBasis(
                f.side.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.up, Math.sin(a)).normalize(),
                f.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.side, -Math.sin(a)).normalize(),
                fwd,
              );
              m.setPosition(c);
              ribs.push({ dims: [0.055, (Math.PI * 2 * TUBE_R) / 16 + 0.02, 0.075], matrix: m });
            }
          }
          // longitudinal rails: crown, keel and both quarters
          for (const [ang, thick] of [[Math.PI / 2, 0.07], [-Math.PI / 2, 0.09], [0, 0.06], [Math.PI, 0.06]] as [number, number][]) {
            const N2 = 60;
            for (let i = 0; i < N2; i += 1) {
              const fa = ride.frameAt(uTubeA + ((uTubeB - uTubeA) * i) / N2);
              const fb = ride.frameAt(uTubeA + ((uTubeB - uTubeA) * (i + 1)) / N2);
              const pa = fa.p
                .clone()
                .addScaledVector(fa.up, TUBE_C + Math.sin(ang) * (TUBE_R + 0.03))
                .addScaledVector(fa.side, Math.cos(ang) * (TUBE_R + 0.03));
              const pb = fb.p
                .clone()
                .addScaledVector(fb.up, TUBE_C + Math.sin(ang) * (TUBE_R + 0.03))
                .addScaledVector(fb.side, Math.cos(ang) * (TUBE_R + 0.03));
              ribs.push(barSpec(t, pa, pb, thick));
            }
          }
          const ribMesh = mergedBoxes(t, ribs, IRON, { tex: 'metal', metal: 0.45, rough: 0.62, bump: 0.04 });
          drawAfterWater(ribMesh, 3);
          g.add(ribMesh);
          // BRASS COLLARS at both mouths — the detail that says "you go in here"
          [uTubeA, uTubeB].forEach((u, k) => {
            const f = ride.frameAt(u);
            const collar = new t.Mesh(
              new t.TorusGeometry(TUBE_R + 0.08, 0.1, 8, 22),
              mat(t, BRASS, { tex: 'metal', metal: 0.6, rough: 0.45 }),
            );
            collar.position.copy(f.p).addScaledVector(f.up, TUBE_C);
            // makeBasis(side, up, fwd). The first pass used
            // makeBasis(side, fwd, up), whose determinant is −1 (fwd = side ×
            // up, so side × fwd = −up): a MIRRORED basis, and
            // `setRotationFromMatrix` extracts a quaternion from it assuming a
            // proper rotation. The collar came out as a big tilted ellipse
            // lassoing the mouth instead of a ring around the tube's section —
            // visible in the run-out shot. The torus's hole must point along
            // the tube, which is what mapping local +Z to `fwd` does.
            collar.setRotationFromMatrix(
              new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up)),
            );
            drawAfterWater(collar, 3);
            g.add(collar);
            void k;
          });
        }

        // ---- 8. THE LAUNCH TOWER ----------------------------------------
        const deckLight = new t.PointLight(LAMP_GLOW, 0, 6.4, 2);
        const stairLight = new t.PointLight(LAMP_GLOW, 0, 5.2, 2);
        {
          const st = ride.frameAt(0);
          const tower = new t.Group();
          tower.position.set(st.p.x, groundAt(st.p.x, st.p.z), st.p.z);
          tower.rotation.y = yawOf(st);
          g.add(tower);
          // LOCAL FRAME: +z is the direction the raft TRAVELS (down the tube),
          // +x is the queue side. Which means the deck must run BACK from the
          // station (−z), not forward: the first pass ran it 7.6 units forward
          // and buried the whole tube and the top of the drop under a deck and
          // its bracing.
          const DECK = st.p.y - 0.08; // the deck top, just under the rails
          const HZ0 = -1.4;
          const HZ1 = 3.4;
          const DX0 = -1.6;
          const DX1 = 1.6;
          const planks: MergedBoxSpec[] = [];
          for (let z = HZ0; z < HZ1; z += 0.62) {
            planks.push({ dims: [DX1 - DX0, 0.1, 0.58], pos: [(DX0 + DX1) / 2, DECK - 0.05, z + 0.31], repeat: [6, 1] });
          }
          tower.add(mergedBoxes(t, planks, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          // joists, legs and cross-bracing down to the ground
          const frame: MergedBoxSpec[] = [];
          [DX0 + 0.3, 0, DX1 - 0.3].forEach((x) => frame.push({ dims: [0.16, 0.2, HZ1 - HZ0], pos: [x, DECK - 0.2, (HZ0 + HZ1) / 2], repeat: [1, 8] }));
          const legZ = [HZ0 + 0.45, (HZ0 + HZ1) / 2, HZ1 - 0.45];
          [DX0 + 0.35, DX1 - 0.35].forEach((x) =>
            legZ.forEach((z) => {
              frame.push({ dims: [0.3, DECK - 0.3, 0.3], pos: [x, (DECK - 0.3) / 2, z], repeat: [1, 6] });
            }),
          );
          // X-bracing on the two long faces
          [DX0 + 0.35, DX1 - 0.35].forEach((x) => {
            for (let k = 0; k < legZ.length - 1; k += 1) {
              const za = legZ[k];
              const zb = legZ[k + 1];
              frame.push(barSpec(t, new t.Vector3(x, 0.2, za), new t.Vector3(x, DECK - 0.4, zb), 0.11, [1, 5]));
            }
          });
          // NOT across the short faces as well: a full cage of diagonals under
          // a 3-unit-wide deck read as scaffolding and buried the stair behind
          // it. One brace per bay on the two long faces, and a single sill beam
          // across each leg pair, is enough to look built.
          legZ.forEach((z) => {
            frame.push({ dims: [DX1 - DX0 - 0.4, 0.16, 0.18], pos: [(DX0 + DX1) / 2, DECK * 0.5, z], repeat: [3, 1] });
          });
          tower.add(mergedBoxes(t, frame, TIMBER_D, { tex: 'wood', rough: 0.92, bump: 0.04 }));
          // deck railings — all round, except the launch gate and the stair head
          const rail: MergedBoxSpec[] = [];
          const post = (x: number, z: number) => {
            rail.push({ dims: [0.1, 0.95, 0.1], pos: [x, DECK + 0.48, z], repeat: [1, 2] });
          };
          for (let z = HZ0 + 0.4; z < HZ1; z += 1.1) {
            if (z > 2.2 && z < 3.4) continue; // the launch gate
            post(DX1 - 0.12, z);
            post(DX0 + 0.12, z);
          }
          [0.52, 0.88].forEach((y) => {
            rail.push({ dims: [0.07, 0.08, HZ1 - HZ0 - 0.6], pos: [DX1 - 0.12, DECK + y, (HZ0 + HZ1) / 2], repeat: [1, 8] });
            rail.push({ dims: [0.07, 0.08, HZ1 - HZ0 - 0.6], pos: [DX0 + 0.12, DECK + y, (HZ0 + HZ1) / 2], repeat: [1, 8] });
            rail.push({ dims: [DX1 - DX0 - 0.3, 0.08, 0.07], pos: [(DX0 + DX1) / 2, DECK + y, HZ0 + 0.15], repeat: [4, 1] });
          });
          tower.add(mergedBoxes(t, rail, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          // the DISPATCH HUT on the deck, with a canvas roof and a lantern
          const hut: MergedBoxSpec[] = [
            { dims: [1.2, 1.4, 1.2], pos: [DX0 + 0.75, DECK + 0.7, HZ1 - 0.9], repeat: [3, 4] },
            { dims: [1.4, 0.12, 1.4], pos: [DX0 + 0.75, DECK + 1.46, HZ1 - 0.9], repeat: [3, 4] },
            { dims: [0.6, 0.8, 0.06], pos: [DX0 + 0.75, DECK + 0.75, HZ1 - 1.52], repeat: [2, 2] },
          ];
          tower.add(mergedBoxes(t, hut, TIMBER_D, { tex: 'wood', rough: 0.93, bump: 0.04 }));
          // a big painted DEPTH BOARD facing the queue: the world's signage idiom
          tower.add(box(t, [0.1, 0.9, 1.5], 0x2c5a5f, [DX1 - 0.05, DECK + 1.0, HZ1 - 2.2], { tex: 'wood', repeat: [1, 4], rough: 0.9 }));
          const marks: MergedBoxSpec[] = [];
          for (let k = 0; k < 5; k += 1) marks.push({ dims: [0.05, 0.08, 0.44 - (k % 2) * 0.18], pos: [DX1 - 0.11, DECK + 0.66 + k * 0.17, HZ1 - 2.2] });
          tower.add(mergedBoxes(t, marks, 0xd9d2ba, { tex: 'plastic', rough: 0.8 }));
          // THE STAIR: a switchback up the tower's queue face, four flights
          // THE STAIR: four switchback flights up the QUEUE face (local +x),
          // running in z between the two landings and kept clear of the ride's
          // own entrance hut, which stands on the sand at local x ≈ 0
          const stair: MergedBoxSpec[] = [];
          const FLIGHTS = 4;
          const SX = DX1 + 1.15;
          const SZ0 = HZ0 + 0.5;
          const SZ1 = HZ1 - 0.5;
          const RUN = SZ1 - SZ0;
          for (let fl = 0; fl < FLIGHTS; fl += 1) {
            const y0 = (DECK * fl) / FLIGHTS;
            const y1 = (DECK * (fl + 1)) / FLIGHTS;
            const dir = fl % 2 ? -1 : 1;
            const zA = fl % 2 ? SZ1 : SZ0;
            const steps = 5;
            for (let s2 = 0; s2 < steps; s2 += 1) {
              const fy = y0 + ((y1 - y0) * (s2 + 1)) / steps;
              const z = zA + dir * (RUN * (s2 + 0.5)) / steps;
              stair.push({ dims: [1.15, 0.09, RUN / steps + 0.08], pos: [SX, fy, z], repeat: [2, 1] });
              stair.push({ dims: [1.15, 0.42, 0.1], pos: [SX, fy - 0.24, z - dir * (RUN / steps) * 0.5], repeat: [2, 1] }); // riser
            }
            // the landing at the head of the flight, and its newel posts
            const lz = fl % 2 ? SZ0 - 0.3 : SZ1 + 0.3;
            stair.push({ dims: [1.3, 0.12, 1.1], pos: [SX, y1, lz], repeat: [2, 2] });
            [SX - 0.58, SX + 0.58].forEach((px) => stair.push({ dims: [0.12, 0.95, 0.12], pos: [px, y1 - 0.42, lz], repeat: [1, 2] }));
            // the outboard handrail, raked with the flight
            [0.5, 0.86].forEach((h) => {
              stair.push({
                dims: [0.07, 0.07, RUN + 0.3],
                pos: [SX + 0.6, (y0 + y1) / 2 + h, (SZ0 + SZ1) / 2],
                rotX: -dir * Math.atan2(y1 - y0, RUN),
                repeat: [1, 6],
              });
            });
          }
          // the stair tower's own legs
          [SZ0 - 0.3, (SZ0 + SZ1) / 2, SZ1 + 0.3].forEach((z) =>
            [SX - 0.58, SX + 0.58].forEach((px) => stair.push({ dims: [0.2, DECK, 0.2], pos: [px, DECK / 2, z], repeat: [1, 6] })),
          );
          tower.add(mergedBoxes(t, stair, TIMBER, { tex: 'wood', rough: 0.91, bump: 0.03 }));
          // the launch trough's own gate frame + a lantern either side
          tower.add(box(t, [0.14, 1.5, 0.14], IRON, [-0.62, DECK + 0.75, 2.9], { tex: 'metal', metal: 0.4, rough: 0.7 }));
          tower.add(box(t, [0.14, 1.5, 0.14], IRON, [0.62, DECK + 0.75, 2.9], { tex: 'metal', metal: 0.4, rough: 0.7 }));
          tower.add(box(t, [1.5, 0.16, 0.2], IRON, [0, DECK + 1.5, 2.9], { tex: 'metal', metal: 0.4, rough: 0.7, repeat: [4, 1] }));
          [[-0.62, 2.9], [0.62, 2.9]].forEach(([x, z]) => {
            const lamp = shipLantern(t, 0.9);
            lamp.group.position.set(x, DECK + 1.35, z);
            tower.add(lamp.group);
            lampMats.push(lamp.glass);
          });
          deckLight.position.set(0, DECK + 1.3, 1.2);
          tower.add(deckLight);
          stairLight.position.set(DX1 + 1.15, DECK * 0.55, HZ1 - 0.2);
          tower.add(stairLight);
          // coiled hose, a stack of spare rafts and a bucket at the foot
          const spare: MergedBoxSpec[] = [];
          for (let k = 0; k < 3; k += 1)
            spare.push({ dims: [1.24, 0.22, 1.24], pos: [DX0 - 1.5, 0.2 + k * 0.22, HZ1 - 1.0], rotY: k * 0.4, repeat: [3, 1] });
          tower.add(mergedBoxes(t, spare, RAFT_LIVERY.body!, { tex: 'fabric', rough: 0.9 }));
        }

        // ---- 9. THE REEF: coral-ish rock, kelp and shoals in the lagoon ---
        {
          const STEP = 2.2;
          let placed = 0;
          for (let x = x0 - 3.4; x <= x1 + 3.4; x += STEP)
            for (let z = z0 - 3.4; z <= z1 + 3.4; z += STEP) {
              const h1 = hash01(x * 2.9 + z * 1.3 + 7);
              const h2 = hash01(x * 0.7 + z * 4.1 + 13);
              const h3 = hash01(x * 3.7 + z * 2.3 + 29);
              const cx = x + (h1 - 0.5) * STEP * 0.7;
              const cz = z + (h2 - 0.5) * STEP * 0.7;
              if (!isWater(cx, cz)) continue;
              if (distToTrack(cx, cz) < 1.3) continue;
              if (Math.hypot(cx - basin.x, cz - basin.z) < BASIN_R + 1.6) continue;
              // ⚠️ ON THE BED, NOT ON `groundAt`. The reef used to be seated on
              // the HOST's ground, under a bed that was itself buried beneath it,
              // while the water stood 0.62 higher — so probed, 8 of 24 items were
              // PROUD of the surface (kelp tops to 1.25 against a 0.62 waterline)
              // and the lagoon read as a rockery someone had hosed down. `bedTopAt`
              // is the dish, so a clump near the middle now has 0.61 of water over
              // the sand it grows out of and one on the rim shelf has 0.12.
              const by = bedTopAt(cx, cz);
              const depth = SEA - by;
              if (h3 < 0.4) {
                // A REEF ROCK, and it is CAPPED TO STAY UNDER. Bare rock reads
                // DRY the moment it breaks the surface, and that is what read as
                // "drained pond" more than anything else here. A rock is
                // ~0.90·scale tall (ReefRacer measured it off the built group),
                // so the cap is the local depth plus a hair.
                const sc = Math.min(0.28 + h1 * 0.5, (depth + 0.02 + 0.10 * h2) / 0.9);
                const rk = buildRock(t, { scale: sc, seed: 600 + placed * 7, tint: h2 > 0.5 ? REEF : REEF_D });
                rk.position.set(cx, by - 0.12, cz);
                rk.userData.reef = 'rock'; // tagged so probes can measure it
                if (h1 < 0.4) rk.userData.lodDetail = true;
                g.add(rk);
                placed += 1;
              } else if (h3 < 0.72) {
                // KELP standing on the bed and breaking the surface — the read
                // that the lagoon has a bottom and things live on it. Kelp is the
                // ONE thing here that is meant to come through the surface, so it
                // is capped to the local depth plus an overshoot rather than held
                // under: a clump is ~1.06·scale tall, one in five gets a big
                // overshoot and stands clear, and the rest just break the top.
                const over = h2 > 0.8 ? 0.42 : 0.14;
                const sc = Math.min(0.7 + 0.7 * h1, (depth + over) / 1.06);
                const kelp = kelpClump(t, 1200 + placed * 13, Math.max(0.28, sc), 3);
                kelp.position.set(cx, by - 0.05, cz);
                kelp.userData.reef = 'kelp'; // tagged so probes can measure it
                g.add(kelp);
                placed += 1;
              }
            }
          // three SHOALS in the open lagoon, just under the surface
          for (let k = 0; k < 3; k += 1) {
            const h1 = hash01(k * 7.1 + 91);
            const h2 = hash01(k * 3.3 + 97);
            const a = h1 * Math.PI * 2;
            const cx = LX + Math.cos(a) * LA * (0.4 + 0.3 * h2);
            const cz = LZ + Math.sin(a) * LB * (0.4 + 0.3 * h2);
            if (!isWater(cx, cz) || distToTrack(cx, cz) < 1.4) continue;
            const sh = buildFishShoal(t, 21 + k * 6, { count: 13, size: 0.18 });
            // BETWEEN the bed and the surface. The dish shelves up to 0.12 under
            // the waterline at the rim, so a fixed −0.24…−0.38 would have swum
            // shoals THROUGH the sand out there; clamped 0.16 off the bed and
            // 0.20 under the surface, a shoal is always in open water.
            const sy = Math.min(SEA - 0.2, Math.max(bedTopAt(cx, cz) + 0.16, SEA - 0.24 - 0.14 * h1));
            const c = new t.Vector3(cx, sy, cz);
            sh.position.copy(c);
            g.add(sh);
            shoals.push({ grp: sh, c, r: 1.6 + 0.9 * h2, ph: 3 + k * 1.7, sp: 0.12 + 0.05 * h1, yaw0: h2 * 6.28 });
          }
        }

        // ---- 10. THE SPLASH RUN-OUT --------------------------------------
        const splashFx = buildEmitter(t, {
          max: 100,
          rate: 0,
          life: 0.75,
          lifeVar: 0.25,
          velocity: [0, 2.1, 0],
          spread: 1.3,
          gravity: 5.8,
          size: 0.08,
          sizeEnd: 0.17,
          color: 0xeaf6fb,
          colorEnd: 0xbfe0ee,
          opacity: 0.85,
        });
        splashFx.setOrigin(SPLASH_AT.x, SEA + 0.1, SPLASH_AT.z);
        g.add(splashFx.points);
        const mistFx = buildEmitter(t, {
          max: 70,
          rate: 10,
          life: 2.8,
          lifeVar: 0.8,
          velocity: [0.1, 0.55, 0.04],
          spread: 0.5,
          gravity: -0.03,
          size: 0.24,
          sizeEnd: 1.0,
          color: 0xd6e2e6,
          colorEnd: 0xeef4f6,
          opacity: 0.15,
        });
        mistFx.setOrigin(SPLASH_AT.x, SEA + 0.25, SPLASH_AT.z);
        g.add(mistFx.points);
        // the waterfall's own spray, off the basin's broken lip
        const fallFx = buildEmitter(t, {
          max: 70,
          rate: 26,
          life: 1.5,
          lifeVar: 0.4,
          velocity: [0, 0.4, 0],
          spread: 0.5,
          gravity: -0.02,
          size: 0.16,
          sizeEnd: 0.6,
          color: 0xe6f2f5,
          colorEnd: 0xf2f8fa,
          opacity: 0.2,
        });
        {
          const sp = g.userData.spillAt as [number, number, number];
          fallFx.setOrigin(sp[0], sp[1] + 0.2, sp[2]);
        }
        g.add(fallFx.points);
        const foam: THREE.Mesh[] = [];
        {
          const sprayGrp = new t.Group();
          sprayGrp.position.set(SPLASH_AT.x, SEA + 0.04, SPLASH_AT.z);
          sprayGrp.rotation.y = yawOf(runF);
          for (let i = 0; i < 7; i += 1) {
            const a = i * 2.39;
            const rr = 0.18 + 0.5 * Math.abs(Math.sin(i * 12.9898));
            const fb = ball(t, 0.16 + 0.045 * ((i * 7) % 3), 0xeaf6fb, [Math.cos(a) * rr * 0.5, 0.06 + 0.09 * Math.abs(Math.sin(i * 4.7)), Math.sin(a) * rr * 1.2 + 0.07 * i], {
              rough: 0.4,
              opacity: 0.85,
            });
            fb.scale.y = 0.7;
            fb.renderOrder = 3;
            sprayGrp.add(fb);
            foam.push(fb);
          }
          g.add(sprayGrp);
        }

        // ---- 11. WATER IN THE CHANNEL: one continuous animated ribbon ----
        const RIBBON_N = 280;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        for (let k = 0; k < RIBBON_N; k += 1) {
          const f = ride.frameAt(k / RIBBON_N);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, 0.035), side: f.side.clone(), up: f.up.clone() });
        }
        ribbonPts.push({ ...ribbonPts[0] });
        const chute = buildWaterRibbon(t, ribbonPts, 0.72, { amp: 0.16, waviness: 0.6 });
        chute.mesh.renderOrder = 2; // inside the tube, and over the lagoon sheet
        g.add(chute.mesh);

        // ---- 12. THE HAUL-BACK BELT: cleats + rollers up the climb -------
        {
          const cleats: MergedBoxSpec[] = [];
          const rollers: MergedBoxSpec[] = [];
          const CN = 260;
          for (let i = 0; i < CN; i += 1) {
            const f = ride.frameAt(i / CN);
            if (f.fwd.y <= 0.13) continue;
            const basis = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
            for (const s of [-1, 1] as const) {
              const m = basis.clone();
              m.setPosition(f.p.clone().addScaledVector(f.side, s * 0.3).addScaledVector(f.up, -0.02));
              cleats.push({ dims: [0.1, 0.05, 0.075], matrix: m });
            }
            if (i % 7 === 0) {
              const m = basis.clone();
              m.setPosition(f.p.clone().addScaledVector(f.up, -0.06));
              rollers.push({ dims: [0.86, 0.09, 0.09], matrix: m });
            }
          }
          if (cleats.length) g.add(mergedBoxes(t, cleats, 0x1d1b1a, { tex: 'plastic', rough: 0.8 }));
          if (rollers.length) g.add(mergedBoxes(t, rollers, RUST, { tex: 'metal', metal: 0.35, rough: 0.9 }));
        }

        // ---- 13. THE RAFT ------------------------------------------------
        const raft = buildTubeRaft(t, RAFT_LIVERY, { riders: opts.riders ?? true, seats: seatAnchors });
        drawAfterWater(raft, 2); // riders have to read while the raft is submerged
        g.add(raft);
        extras.vehicle = raft;
        seatWorld = makeSeatWorld(t, seatAnchors);
        const mtx = new t.Matrix4();
        const place = (u: number) => {
          const f = ride.frameAt(u);
          raft.position.copy(f.p).addScaledVector(f.up, 0.2); // the profile's own wheelOffset
          mtx.makeBasis(f.side, f.up, f.fwd);
          raft.setRotationFromMatrix(mtx);
        };

        // ---- 14. the updater --------------------------------------------
        const gate = createMotionGate((clock) => {
          const u = uOf(clock * CYCLE_SCALE + (opts.phase0 ?? 0));
          place(u);
          chute.update(clock);
          basinWater.update(clock);
          // the splash erupts by proximity as the raft hits the run-out
          const d = Math.hypot(raft.position.x - SPLASH_AT.x, raft.position.z - SPLASH_AT.z);
          const k = Math.max(0, 1 - d / 1.5);
          splashFx.setRate(k * 150);
          splashFx.update(clock);
          mistFx.setRate(10 + 24 * k);
          mistFx.update(clock);
          foam.forEach((fb, i) => {
            const ki = Math.max(0, k - 0.14 * ((i * 5) % 4));
            const pulse = 0.75 + 0.25 * Math.sin(clock * 9 + i * 2.1);
            fb.scale.setScalar(Math.max(0.02, ki * pulse));
            fb.scale.y = Math.max(0.02, ki * pulse * 0.7);
          });
          g.userData.rideU = u;
        }, { spinDown: 1.6 });
        onStateChange = gate.onStateChange;

        return (time: number) => {
          lagoon.update(time); // the sea keeps rolling whatever the ride does
          fallFx.update(time); // and so does the waterfall
          // the shoals: each swims a slow hashed circle about its own centre,
          // banking as it turns — one absolute-time term, no skinning
          shoals.forEach((s) => {
            const a = time * s.sp + s.ph;
            s.grp.position.set(
              s.c.x + Math.cos(a) * s.r,
              s.c.y + 0.14 * Math.sin(a * 1.7 + s.ph),
              s.c.z + Math.sin(a) * s.r * 0.8,
            );
            s.grp.rotation.y = s.yaw0 - a + Math.PI / 2;
            s.grp.rotation.z = 0.12 * Math.sin(a * 2.3 + s.ph);
          });
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk);
          const flick = 1 + 0.1 * Math.sin(time * 7.3) + 0.05 * Math.sin(time * 13.1 + 1.7);
          deckLight.intensity = 1.0 * ease * flick;
          stairLight.intensity = 0.7 * ease * flick;
          for (const m of lampMats) m.emissiveIntensity = 0.1 + 1.35 * ease * flick;
          // the glass tunnel lights from within — steady, not flickering: the
          // lamps are flames and gutter, an aquarium tunnel does not
          if (tubeGlassMat) tubeGlassMat.emissiveIntensity = 0.02 + 0.32 * ease;
          gate.update(time);
        };
      })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const OceanTunnelSlideBase = composableRide<OceanTunnelSlideOpts & { register?: boolean }>(
  'OceanTunnelSlide',
  (t, props) =>
    buildOceanTunnelSlideScene(t, {
      pieces: props.pieces,
      groundAt: props.groundAt,
      phase0: props.phase0,
      riders: props.riders ?? !props.register,
    }),
  // ACCESS (declared at the top of this file, with the measurements that set
  // `front`): the queue head, both huts and the lane stand OUT PAST THE
  // SHORELINE of the ride's own lagoon, on the dry spit.
  ACCESS,
);

/** <OceanTunnelSlide> — Tidewater Hollow's raft slide as a composable ride
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.4 out the local +z front at the tower's foot, exit hut at local
 *  [2.0, 2.2], boarding on the LAUNCH DECK 5.0 up.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Drop/><TurnR/><Lift/>…` — children win) are compiled by
 *  `compileTrackPieces` on the 'flume' profile from the tower head and swept by
 *  `buildRideSpline`; no pieces = the stock "Deepwater Chute" (one 4.4-unit tube
 *  through the reef basin, a splash run-out, and the haul-back belt home). A
 *  FATAL compile marks the build `invalid` so a broken circuit never registers.
 *  The raft is the ride `vehicle` (onboard cam) and its four seats are live
 *  `seatWorld` anchors, so REAL guests ride down the tube. */
export const OceanTunnelSlide: React.FC<ComposableRideProps & OceanTunnelSlideOpts & { children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <OceanTunnelSlideBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
