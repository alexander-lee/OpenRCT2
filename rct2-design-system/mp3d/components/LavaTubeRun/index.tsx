import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces, rateCoaster } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildCoasterCar, COASTER_CAR_SEATS, gateCarLights } from '../CoasterCar';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { buildEmitter } from '../ParticleKit';
import type { Emitter } from '../ParticleKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';
// THE EMBERFALL LAVA LANGUAGE lives in the world's other flagship so both
// attractions burn with ONE palette — see components/EmberWings/Context.md.
// near-black basalt plates + an emissive CRACK network, a white-yellow →
// orange → deep-red → black temperature ramp, and a glow LERPED between day
// and night values (never gated to zero).
import { buildWater, buildWaterRibbon, LAVA } from '../WaterTile';
import { lavaMaterial, lavaGlow } from '../EmberWings';
import type { LavaSurface } from '../EmberWings';

// ---------------------------------------------------------------------------
// LavaTubeRun — attraction 3 of the EMBERFALL CALDERA: a steel coaster that
// plunges INTO a lava tube in the volcano's flank and bursts out the other
// side. Built on the shared spline machinery like every tracked ride: the
// layout is compiled by SplineRideKit's `compileTrackPieces` and swept by
// `buildRideSpline({ profile: 'coaster', type: 'steel' })`.
//
// WHY 'steel' IS the rule set — this is a modern looping-family coaster
// (ride/rtd/coaster/LoopingRollerCoaster.h): `TYPE_RULES.steel` gives it
// vertical-capable slopes and banking to ~55°, and its `RatingsData` table is
// the one RCT2 scores a steel train with. The circuit does NOT invert — it has
// no corkscrew group in it at all — but it DOES want the 40° auto-bank the
// steel cap allows, because that is what soaks the lateral G on the fast low
// turns either side of the tube (`eff = v²·κ_h·(1 − min(1, |roll|/0.6))`).
//
// THE SIGNATURE — THE TUNNEL
//   * a basalt RIDGE (the volcano's flank) crosses the circuit's long, dead
//     straight low run — the fastest track on the layout — with a rock PORTAL
//     driven through each side of it.
//   * between them runs an ENCLOSED LAVA TUBE: a rock liner with dark inner
//     panels (so the mouths read as holes in the hill, not a shed) whose
//     interior is lit FROM WITHIN by magma — molten veins down both walls, a
//     lava gutter along one side of the floor, and two real PointLights inside
//     that are day-AND-night lerped, because lava is incandescent by daylight.
//   * an older lava flow spills down the ridge's outer face, and a magma pool
//     boils at its foot, so the tube reads as the drained roof of a real flow.
//   * the tube section is picked automatically (the lowest, straightest, most
//     level stretch clear of the station) or pinned with `tunnelU`.
//
// Budget: 2 ParticleKit emitters (220 particle capacity — portal smoke +
// embers), 3 real PointLights (two inside the tube, day-and-night lerped
// because they ARE the lava; one night-gated station lamp) plus the lead car's
// headlamp. Everything static and repeated goes through `mergedBoxes`.
// Deterministic throughout: hashed sines only, no Math.random / Date.now.
// ---------------------------------------------------------------------------

/** steel banking cap. `coasterBankCap('steel', 0.7)` = 0.7 rad (40°), which is
 *  the value the verified §4 archetypes are measured at — the auto-bank that
 *  soaks the lateral G. Do not lower it: the 1.27 g gate re-opens. */
const BANK = 0.7;
/** the compiled station straight runs along local −x, so every compiled point
 *  has z ≤ 0 and the whole local +z face is clear for the queue and huts. */
const HEADING = -Math.PI / 2;
const START: [number, number, number] = [0, 0.55, 0];

/** RCT2 TrackColour: heat-scaled steel rail, ember-oxide ties, charred columns */
const TRACK_COLOURS: TrackScheme = { main: 0x8d949e, additional: 0x9a5228, supports: 0x6b7280 };
/** train livery: basalt-black hull, ember trim, dull-red nose/tail fairings */
const CAR_LIVERY: VehicleScheme = { body: 0x33383f, trim: 0xe8842f, tertiary: 0x8f2a10 };

const ROCK = 0x4c473e; // the cut rock face of the ridge (volcanic, not granite)
const ROCK_D = 0x3c372f; // shaded rock / voussoirs
const BASALT = 0x2a2622; // cold basalt boulders + the ridge crest
const DARK = 0x171412; // unlit bore liner
const STEEL_D = 0x5c626b; // ironwork
const CONCRETE = 0x9a958a;

/** Cinder Bore — the shipped circuit. A 4.0-unit chain lift out of the station,
 *  a curvature-ramped 90° corner at the crest, the whole 4.0 back in ONE plunge
 *  down the far side, a banked 90° sweep and then 14.3 units of dead-straight
 *  low run at full speed — which is where the lava tube sits — then a long
 *  shallow camelback for the airtime and two more banked sweeps home.
 *
 *  Verified COMPILE-ONLY before shipping (see Context.md): design clean with
 *  ZERO violations, worst clearance 5.60, ZERO synthesized closure, worst
 *  effective lateral 1.13 g against the 1.5 g derail guard, E 5.44 / I 6.78 /
 *  N 2.15 (thrilling), 99.4 u, 15 s a lap.
 *
 *  The corners come in two flavours, and BOTH are curvature-ramped rather than
 *  bare arcs (the MineTrainCoaster lesson — a chorded arc welded onto a fast
 *  straight leaves a ~10° kink where the auto-bank has not developed, and that
 *  junction is the G spike): the SLOW crest corner ramps in two stages, the
 *  three FAST low corners ramp in three (5° r14 → 10° r9 → 18° r6 → core). */
const crestCorner = (radius: number): TrackPiece[] => [
  { type: 'turnR', angle: 12, radius: radius * 2.6 },
  { type: 'turnR', angle: 66, radius },
  { type: 'turnR', angle: 12, radius: radius * 2.6 },
];
const fastCorner = (radius: number): TrackPiece[] => [
  { type: 'turnR', angle: 5, radius: 14 },
  { type: 'turnR', angle: 10, radius: 9 },
  { type: 'turnR', angle: 18, radius: 6 },
  { type: 'turnR', angle: 24, radius },
  { type: 'turnR', angle: 18, radius: 6 },
  { type: 'turnR', angle: 10, radius: 9 },
  { type: 'turnR', angle: 5, radius: 14 },
];

const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 4.0, length: 9 }, // 30° chain lift to a 4.55 summit
  { type: 'straight', length: 0.8 }, // level crest
  ...crestCorner(3.6), // slow corner off the crest
  { type: 'straight', length: 1.0 },
  { type: 'drop', height: 4.0, length: 9 }, // THE PLUNGE — all 4.0 in one drop
  { type: 'straight', length: 3.0 },
  ...fastCorner(3.2),
  { type: 'straight', length: 14.318 }, // ← THE LAVA-TUBE RUN (solved)
  ...fastCorner(3.2),
  { type: 'hill', height: 1.1, length: 10 }, // long shallow camelback: the airtime
  { type: 'straight', length: 2.618 }, // solved
  ...fastCorner(3.2),
  { type: 'straight', length: 1.4 }, // brake tail, 0.30 u short of the station
];

/** one merged box spanning A → B (its Y axis runs along the bar) */
function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat?: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, repeat };
}

export interface LavaTubeRunOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Cinder Bore circuit. Compiled with this ride's own rules:
   *  `profile: 'coaster'`, `type: 'steel'`, bank 0.70, heading −90°. */
  pieces?: TrackPiece[];
  /** raw control points `[x, y, z]` — the escape hatch past the piece compiler
   *  (still swept and validated). `pieces` wins. */
  points?: [number, number, number][];
  /** cars in the train (default 3 — 6 seats) */
  cars?: number;
  /** decorative riders (default true; <LavaTubeRun register> turns them OFF so
   *  the GameManager's real guests fill the train through seatWorld) */
  riders?: boolean;
  /** terrain sampler so the ridge, supports and props land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the LAVA TUBE (default: auto — the lowest, straightest,
   *  most level stretch away from the station) */
  tunnelU?: number;
  /** half-length of the enclosed bore in world units (default 4.0 → an 8-unit
   *  tube; the stock circuit's straight run is 14.3 long) */
  tunnelHalf?: number;
  /** portal smoke + ember emitters (default true) */
  smoke?: boolean;
}

export interface LavaTubeRunBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  crashed?: () => boolean;
  /** FATAL pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
  ratings?: { excitement: number; intensity: number; nausea: number; ratingBand?: string; nauseaExtreme?: boolean };
}

/**
 * The whole coaster: a steel-rule spline circuit, the basalt RIDGE with its
 * rock portals and glowing lava tube, an older flow down the outer face, a
 * magma pool at its foot, a basalt station platform and a 3-car train.
 * `update` is motion-gated (the train parks in the station while guests board),
 * `seatWorld` seats real guests, `vehicle` is the lead car for the RideViewer
 * follow cam and `crashed` reports the live 1.5 g derail guard.
 */
export function buildLavaTubeRunScene(three: typeof THREE, opts: LavaTubeRunOpts = {}): LavaTubeRunBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; crashed?: () => boolean; invalid?: boolean; ratings?: LavaTubeRunBuilt['ratings'] } = {};
  const seatAnchors: THREE.Object3D[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = []; // night-gated lamp glass
  const lights: THREE.PointLight[] = []; // night-gated (1 here)
  const lavaLights: THREE.PointLight[] = []; // day-AND-night lerped (2, in the bore)
  const lava: LavaSurface[] = [];
  /** WaterTile LAVA-palette liquid sheets: the bore's gutter ribbon and the
   *  boiling pool at the flow's toe. Driven on the same clock as `lava`, but a
   *  third of the rate — a pool convects, it does not flow like a channel. */
  const liquids: { update: (time: number) => void }[] = [];
  const emitters: Emitter[] = [];
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
      const carCount = Math.max(1, Math.min(6, opts.cars ?? 3));
      const groundAt = opts.groundAt ?? (() => 0);

      // ---- 1. LAYOUT: the shared spline machinery -------------------------
      let pts = opts.points;
      if (!pts) {
        const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, {
          profile: 'coaster',
          type: 'steel',
          bank: BANK,
          start: START,
          heading: HEADING,
        });
        pts = compiled.points;
        g.userData.trackReport = compiled.report; // harness/agent introspection
        if (compiled.report.fatal) extras.invalid = true;
      }
      const ride = buildRideSpline(t, pts, {
        profile: 'coaster',
        type: 'steel',
        wood: false, // steel columns; the theming is rock, not timber
        bank: BANK,
        groundAt,
        colours: TRACK_COLOURS,
        vehicleSchemes: [CAR_LIVERY],
      });
      g.add(ride.group);
      extras.crashed = () => ride.crashed();
      extras.ratings = rateCoaster(pts, { type: 'steel', bank: BANK, cars: carCount });
      const total = ride.curve.getLength();
      const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);

      // ---- 2. WHERE THE TUBE GOES ----------------------------------------
      // the lowest, straightest, most level stretch clear of the station and
      // the brake run — on the stock circuit that is the 14.3-unit dead
      // straight at the far side, ridden at full post-plunge speed
      const tunnelU = (() => {
        if (opts.tunnelU !== undefined) return opts.tunnelU;
        let best = 0.5;
        let bestScore = Infinity;
        const d = 2.4 / total;
        for (let i = 0; i < 240; i++) {
          const u = i / 240;
          if (u < 0.14 || u > 0.84) continue; // never over the station or the brake tail
          const f = ride.frameAt(u);
          const a = ride.frameAt(u - d).fwd;
          const b = ride.frameAt(u + d).fwd;
          const ah = Math.hypot(a.x, a.z) || 1;
          const bh = Math.hypot(b.x, b.z) || 1;
          const bend = 1 - (a.x * b.x + a.z * b.z) / (ah * bh); // 0 = dead straight
          const score = (f.p.y - groundAt(f.p.x, f.p.z)) * 0.7 + bend * 40 + Math.abs(f.fwd.y) * 9;
          if (score < bestScore) {
            bestScore = score;
            best = u;
          }
        }
        return best;
      })();

      // ---- 3. THE RIDGE, THE PORTALS AND THE GLOWING LAVA TUBE -----------
      const smokePts: [number, number, number][] = [];
      {
        const HALF = Math.max(2.0, opts.tunnelHalf ?? 4.0);
        const fMid = ride.frameAt(tunnelU);
        const shaft = new t.Group();
        shaft.position.copy(fMid.p);
        shaft.rotation.y = yawOf(fMid);
        g.add(shaft);
        // component-local pose of the bore, for harness/agent introspection and
        // for authors framing a shot on the portal
        g.userData.tunnel = { u: tunnelU, at: [fMid.p.x, fMid.p.y, fMid.p.z], yaw: yawOf(fMid), half: HALF };
        // shaft-local frame: +z runs ALONG the track, +x is the track's side,
        // y is measured from the RAIL CENTRELINE (so the ground sits at `gy`)
        const gy = groundAt(fMid.p.x, fMid.p.z) - fMid.p.y;
        const CLEAR = 1.5; // opening head height above the rails (train tops out ~0.95)
        const HW = 1.3; // wall centreline half-width (inner faces at 1.08)

        // ---- the BORE LINER. Structural roof and walls are ROCK — they are
        // the cut faces of the flank, and a flat DARK slab this big reads as a
        // black shed from outside — while thin DARK panels just inside them
        // keep the bore itself unlit, so the mouths read as holes in the hill.
        shaft.add(box(t, [HW * 2 + 0.1, 0.4, HALF * 2], ROCK, [0, CLEAR + 0.18, 0], { tex: 'concrete', repeat: [4, 8], rough: 1, bump: 0.06 }));
        shaft.add(box(t, [2.16, 0.06, HALF * 2 - 0.1], DARK, [0, CLEAR - 0.02, 0], { tex: 'concrete', repeat: [3, 8], rough: 1, bump: 0.04 }));
        [-1, 1].forEach((s) => {
          shaft.add(box(t, [0.42, CLEAR - gy, HALF * 2], ROCK, [s * HW, gy + (CLEAR - gy) / 2, 0], { tex: 'concrete', repeat: [2, 8], rough: 1, bump: 0.06 }));
          shaft.add(box(t, [0.05, CLEAR - gy - 0.06, HALF * 2 - 0.1], DARK, [s * 1.075, gy + (CLEAR - gy) / 2, 0], { tex: 'concrete', repeat: [1, 8], rough: 1, bump: 0.04 }));
        });
        // ---- THE TUBE FLOOR + THE LAVA GUTTER. A real lava tube is the
        // drained roof of a flow, and the last of that flow is still in the
        // bottom of it: a cooled crust floor under the track with an open
        // molten GUTTER down one side, hot at the middle of the bore and
        // cooling toward both mouths.
        {
          const SEG = 8;
          for (let i = 0; i < SEG; i++) {
            const f = (i + 0.5) / SEG;
            const mid = 1 - Math.abs(f - 0.5) * 2; // 1 in the middle, 0 at the mouths
            const z = -HALF + (HALF * 2 * (i + 0.5)) / SEG;
            const L = (HALF * 2) / SEG;
            // cooled crust floor, plate-dark, warming toward the middle
            const floor = lavaMaterial(t, 0.98 - mid * 0.42, [2, 1]);
            lava.push(floor);
            const fm = new t.Mesh(new t.BoxGeometry(2.1, 0.07, L * 1.06), floor.mat);
            fm.position.set(0, gy + 0.035, z);
            shaft.add(fm);
            // the OPEN GUTTER — a narrow molten channel hugging one wall.
            // Narrow on purpose: the plates are the bulk of the surface and
            // they are black; the light comes out of the crack.
            const gut = lavaMaterial(t, Math.max(0.03, 0.5 - mid * 0.45), [0.6, 0.5]);
            lava.push(gut);
            const gm = new t.Mesh(new t.BoxGeometry(0.34 + mid * 0.16, 0.09, L * 1.08), gut.mat);
            gm.position.set(0.72, gy + 0.05, z);
            shaft.add(gm);
            // NOTE the gutter's crust box stays: it is the channel BED and its
            // lip. The liquid that runs in it is one continuous LAVA ribbon laid
            // over the whole bore below — a per-segment sheet would seam.
            // MOLTEN VEINS up both walls at rail height — the inner faces are
            // what a rider actually sees, and they have to be lit from within
            [-1, 1].forEach((s) => {
              const vein = lavaMaterial(t, Math.max(0.05, 0.62 - mid * 0.5), [0.7, 0.6]);
              lava.push(vein);
              const vm = new t.Mesh(new t.BoxGeometry(0.05, 0.28 + mid * 0.2, L * 1.02), vein.mat);
              vm.position.set(s * 1.05, 0.16 + mid * 0.1, z);
              shaft.add(vm);
            });
          }
          // THE LIVE GUTTER — one continuous molten ribbon down the bore, in
          // the crust gutter's own channel (x 0.72, 0.42 wide → 0.51..0.93, so
          // it is clear of the 1.08 wall faces and far outside the train's
          // measured 0.373 half-width). A rider passes within half a unit of
          // this at 9.5 u/s, which is why the tube's liquid is the one that
          // most needed to stop being a static plate.
          {
            const pts = Array.from({ length: 26 }, (_, i) => ({
              p: new t.Vector3(0.72, gy + 0.1, -HALF - 0.1 + ((HALF * 2 + 0.2) * i) / 25),
              side: new t.Vector3(1, 0, 0),
              up: new t.Vector3(0, 1, 0),
            }));
            const gutter = buildWaterRibbon(t, pts, 0.42, { amp: 0.07, waviness: 0.26, palette: LAVA });
            shaft.add(gutter.mesh);
            liquids.push(gutter);
          }
          // a lava DRIP down the middle of the roof, hottest at the centre
          for (let i = 0; i < 5; i++) {
            const f = (i + 0.5) / 5;
            const mid = 1 - Math.abs(f - 0.5) * 2;
            const drip = lavaMaterial(t, Math.max(0.04, 0.5 - mid * 0.44), [0.6, 0.6]);
            lava.push(drip);
            const dm = new t.Mesh(new t.BoxGeometry(0.3 + mid * 0.2, 0.05, 0.5), drip.mat);
            dm.position.set((hash01(i * 3.7 + 2) - 0.5) * 0.7, CLEAR - 0.06, -HALF + HALF * 2 * f);
            shaft.add(dm);
          }
        }
        // ---- the two real lights INSIDE the bore. These are LAVA, not lamps:
        // they are lerped between a daylight and a night value and never gated
        // to zero, so the mouths glow at noon too.
        [-0.42, 0.42].forEach((k) => {
          const L = new t.PointLight(0xff7a24, 0, 5.5, 2);
          L.position.set(0.4, 0.35, k * HALF);
          shaft.add(L);
          lavaLights.push(L);
        });

        // ---- THE PORTALS. A basalt arch at each mouth: raked jamb blocks, a
        // ring of voussoirs stepped round the opening, a heavy lintel and a
        // row of obsidian teeth over it.
        const arch: MergedBoxSpec[] = [];
        const teeth: MergedBoxSpec[] = [];
        [-1, 1].forEach((s) => {
          const z = s * HALF;
          [-1, 1].forEach((sx) => {
            // jamb: three stepped blocks leaning out of the rock face
            for (let k = 0; k < 3; k++) {
              const h = (CLEAR - gy) / 3;
              arch.push({
                dims: [0.46 + k * 0.05, h * 1.06, 0.38 + k * 0.06],
                pos: [sx * (1.14 + k * 0.03), gy + h * (k + 0.5), z + s * 0.05],
                rotY: (hash01(k * 4.1 + s + sx * 3) - 0.5) * 0.22,
              });
            }
          });
          // voussoirs stepped over the opening
          for (let k = -3; k <= 3; k++) {
            const fx = k / 3;
            arch.push({
              dims: [0.44, 0.34 + (1 - Math.abs(fx)) * 0.14, 0.42],
              pos: [fx * 1.08, CLEAR + 0.18 + (1 - fx * fx) * 0.16, z + s * 0.08],
              rotZ: fx * 0.28,
            });
          }
          arch.push({ dims: [2.9, 0.34, 0.5], pos: [0, CLEAR + 0.62, z + s * 0.06], repeat: [5, 1] }); // lintel
          // OBSIDIAN TEETH over the lintel — the flank's frozen spatter
          for (let k = 0; k < 7; k++) {
            const hx = hash01(k * 5.9 + s * 2.3);
            teeth.push({
              dims: [0.16 + hx * 0.1, 0.34 + hx * 0.34, 0.16 + hx * 0.08],
              pos: [-1.15 + k * 0.383, CLEAR + 0.82 + (0.34 + hx * 0.34) / 2, z + s * 0.04],
              rotZ: (hx - 0.5) * 0.4,
            });
          }
        });
        shaft.add(mergedBoxes(t, arch, ROCK_D, { tex: 'concrete', repeat: [2, 2], rough: 1, bump: 0.07 }));
        shaft.add(mergedBoxes(t, teeth, BASALT, { tex: 'concrete', repeat: [1, 2], rough: 0.9, bump: 0.06 }));

        // ---- THE RIDGE: the volcano's flank the bore is driven through.
        // Boulders in three tiers — a CREST over the bore, an UPPER FLANK
        // leaning on the top of the cut face and a LOWER FLANK bedded at
        // ground level — big enough to break the liner's box silhouette from
        // any angle. A flank stone is stood off far enough that its inner face
        // can never reach past |x| 0.72, so it cannot poke into the train
        // envelope (half-width 0.35) inside the bore.
        for (let i = 0; i < 34; i++) {
          const h1 = hash01(i * 5.3 + 2);
          const h2 = hash01(i * 9.7 + 7);
          const side = hash01(i * 3.1 + 29) < 0.5 ? -1 : 1;
          const tier = i % 4; // 0 crest, 1 upper flank, 2-3 lower flank
          const sc = tier === 0 ? 0.7 + h1 * 0.65 : tier === 1 ? 0.95 + h1 * 0.6 : 1.3 + h1 * 0.7;
          const rock = buildRock(t, { scale: sc, seed: 340 + i * 3, tint: tier === 0 ? BASALT : ROCK });
          const x = tier === 0 ? (h2 - 0.5) * 2.2 : side * (0.72 + 1.05 * sc + h2 * (tier === 1 ? 0.14 : 0.26));
          const y = tier === 0 ? CLEAR + 0.5 : tier === 1 ? gy + 1.0 : gy - 0.1;
          rock.position.set(x, y, (h1 - 0.5) * (HALF * 2.8));
          shaft.add(rock);
        }
        // THE RIDGE runs PERPENDICULAR to the track — out along the shaft's
        // local ±X, which is the track's SIDE — so the flank is a landform the
        // circuit is cut THROUGH rather than a mound sitting on top of it.
        // (First draft ran it along local ±Z, i.e. along the rails, and buried
        // 20 units of track either side of the bore.) Faceted `buildRock`
        // boulders over a LOW buried box core: any box tall enough to show a
        // flat face above the boulder skin reads as a crate.
        {
          const core: MergedBoxSpec[] = [];
          for (let i = 0; i < 10; i++) {
            const h1 = hash01(i * 7.1 + 4);
            const h2 = hash01(i * 2.9 + 9);
            const side = i % 2 === 0 ? -1 : 1;
            const out = side * (2.0 + (i >> 1) * 1.7);
            const hgt = 0.85 + h2 * 0.5;
            core.push({
              dims: [2.4 + h1 * 1.2, hgt, 2.6 + h1 * 1.0],
              pos: [out, gy + hgt / 2 - 0.3, (h2 - 0.5) * 1.6],
              rotY: (h1 - 0.5) * 0.6,
            });
          }
          shaft.add(mergedBoxes(t, core, ROCK_D, { tex: 'concrete', repeat: [3, 3], rough: 1, bump: 0.08 }));
          // the boulder skin: two staggered rows marching out along the flank,
          // tapering in scale as the ridge runs away from the cut
          for (let i = 0; i < 22; i++) {
            const h1 = hash01(i * 4.7 + 13);
            const h2 = hash01(i * 8.3 + 21);
            const side = i % 2 === 0 ? -1 : 1;
            const step = i >> 1; // 0..10 out from the bore
            const out = side * (1.9 + step * 1.4);
            const taper = 1 - step / 14;
            const sc = (1.1 + h1 * 0.95) * taper;
            const rock = buildRock(t, { scale: sc, seed: 470 + i * 5, tint: h2 > 0.65 ? BASALT : ROCK });
            rock.position.set(out + (h1 - 0.5) * 0.8, gy + (h1 - 0.25) * 0.6 + sc * 0.3, (h2 - 0.5) * 2.2);
            shaft.add(rock);
          }
        }
        // scree apron so the ridge meets the ground instead of floating
        {
          const scree: MergedBoxSpec[] = [];
          for (let i = 0; i < 26; i++) {
            const h1 = hash01(i * 4.1 + 11);
            const h2 = hash01(i * 7.3 + 13);
            scree.push({
              dims: [0.24 + h1 * 0.3, 0.12 + h2 * 0.16, 0.24 + h2 * 0.26],
              pos: [(i % 2 ? 1 : -1) * (1.3 + h1 * 2.6), gy + 0.06, (h2 - 0.5) * (HALF * 3.0)],
              rotY: h1 * 3.1,
            });
          }
          shaft.add(mergedBoxes(t, scree, ROCK_D, { tex: 'concrete', repeat: [2, 2], rough: 1, bump: 0.05 }));
        }
        // ---- THE OLDER FLOW spilling down the ridge's outer face + the pool
        // it feeds. This is what makes the bore read as a drained lava tube:
        // the same magma that hollowed it is still coming out of the flank.
        {
          const flow = new t.Group();
          flow.position.set(0, 0, 0);
          shaft.add(flow);
          const SEG = 7;
          for (let i = 0; i < SEG; i++) {
            const f = i / (SEG - 1); // 0 = the vent high on the flank, 1 = the toe
            const surf = lavaMaterial(t, 0.16 + f * 0.8, [1, 1]);
            lava.push(surf);
            // SHORT AND STEEP: the flow spills over the ridge's near shoulder
            // right beside the portal. A long shallow flow hung in mid-air
            // (nothing under it out there) and read as glowing planks.
            const w = 0.9 - f * 0.28;
            const yTop = CLEAR + 0.45 - f * (CLEAR + 0.45 - gy - 0.06);
            const slab = new t.Mesh(new t.BoxGeometry(w, 0.16, 1.1), surf.mat);
            slab.position.set(-1.85 - f * 2.5, yTop, -3.2 + (hash01(i * 3.3) - 0.5) * 0.5);
            slab.rotation.z = -0.75 + f * 0.62;
            slab.rotation.y = (hash01(i * 5.1) - 0.5) * 0.24;
            flow.add(slab);
            // the MOLTEN CORE strip — a wide crust slab averages to dark rock
            // at ride distance because its crack network falls under a pixel
            const core = lavaMaterial(t, Math.max(0.03, 0.16 + f * 0.8 - 0.4), [0.5, 0.5]);
            lava.push(core);
            const cm = new t.Mesh(new t.BoxGeometry(w * 0.34, 0.19, 1.12), core.mat);
            cm.position.copy(slab.position);
            cm.position.y += 0.02;
            cm.rotation.copy(slab.rotation);
            flow.add(cm);
          }
          // the boiling POOL at the toe, inside a basalt levee. The concentric
          // crust rings stay as its cooling shore; a real `buildWater` sheet on
          // WaterTile's LAVA palette sits in the middle of them so the pool
          // actually BOILS — the word in the comment was doing all the work
          // before, because every ring was static geometry.
          const px = -6.0;
          const pz = -3.4;
          {
            const live = buildWater(t, 2.5, 48, 1.16, 0.24, 0.15, 0.26, LAVA);
            live.mesh.position.set(px, gy + 0.085, pz);
            live.mesh.castShadow = false;
            live.mesh.receiveShadow = false;
            shaft.add(live.mesh);
            liquids.push(live);
          }
          for (let r = 0; r < 4; r++) {
            const r1 = 0.4 + r * 0.4;
            const surf = lavaMaterial(t, 0.05 + (r / 3) * 0.7, [2, 1]);
            lava.push(surf);
            const geo = new t.RingGeometry(r === 0 ? 0 : r1 - 0.4, r1, 20, 1);
            geo.rotateX(-Math.PI / 2);
            const m = new t.Mesh(geo, surf.mat);
            m.position.set(px, gy + 0.06 - r * 0.012, pz);
            shaft.add(m);
          }
          const levee: MergedBoxSpec[] = [];
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            const hb = hash01(i * 5.9 + 3);
            levee.push({
              dims: [0.32 + hb * 0.22, 0.22 + hb * 0.2, 0.38],
              pos: [px + Math.cos(a) * (1.7 + hb * 0.16), gy + 0.08, pz + Math.sin(a) * (1.7 + hb * 0.16)],
              rotY: -a,
            });
          }
          shaft.add(mergedBoxes(t, levee, BASALT, { tex: 'concrete', repeat: [2, 2], rough: 1, bump: 0.06 }));
          // smoke rises out of both PORTAL MOUTHS and off the pool
          const wp = new t.Vector3();
          [
            [0, CLEAR + 0.4, -HALF - 0.2],
            [0, CLEAR + 0.4, HALF + 0.2],
            [px, gy + 0.3, pz],
            [-2.6, gy + 1.4, -3.2],
          ].forEach((p) => {
            wp.set(p[0], p[1], p[2]).applyMatrix4(shaft.matrix.identity().makeRotationY(shaft.rotation.y)).add(shaft.position);
            smokePts.push([wp.x, wp.y, wp.z]);
          });
          shaft.updateMatrix();
        }
      }

      // ---- 4. STATION: basalt platform under an ember-lit canopy ----------
      {
        const st = ride.frameAt(0);
        const yard = new t.Group();
        yard.position.set(st.p.x, 0, st.p.z);
        yard.rotation.y = yawOf(st);
        g.add(yard);
        // yard-local: +z runs along the station straight, +x is the boarding
        // side (the free face the queue lane comes in on), y is WORLD height
        const deckTop = st.p.y + 0.02; // just under the 0.045 rail tops
        const DX = 1.0; // inner edge 0.5 clears the 0.48 tie ends
        yard.add(box(t, [1.0, 0.1, 2.9], ROCK_D, [DX, deckTop - 0.05, 1.3], { tex: 'concrete', repeat: [3, 8], rough: 1, bump: 0.06 }));
        yard.add(box(t, [0.96, 0.03, 2.86], 0x4d4a46, [DX, deckTop + 0.015, 1.3], { tex: 'concrete', repeat: [3, 8], rough: 0.95 })); // grit surface
        const deckSpecs: MergedBoxSpec[] = [];
        [0.6, 1.4].forEach((x) => deckSpecs.push({ dims: [0.12, 0.12, 2.9], pos: [x, deckTop - 0.16, 1.3], repeat: [1, 6] }));
        [0.2, 1.3, 2.4].forEach((z) =>
          [0.6, 1.4].forEach((x) => {
            deckSpecs.push({ dims: [0.13, deckTop - 0.22, 0.13], pos: [x, (deckTop - 0.22) / 2, z], repeat: [1, 3] });
            deckSpecs.push({ dims: [0.3, 0.06, 0.3], pos: [x, 0.03, z] });
          }),
        );
        [0.34, 0.7].forEach((y) => deckSpecs.push({ dims: [0.07, 0.06, 2.9], pos: [1.52, deckTop + y, 1.3], repeat: [1, 6] })); // edge rails
        [0.2, 1.3, 2.4].forEach((z) => deckSpecs.push({ dims: [0.08, 0.76, 0.08], pos: [1.52, deckTop + 0.38, z], repeat: [1, 2] }));
        [0, 1, 2].forEach((k) => deckSpecs.push({ dims: [0.7, 0.06, 0.26], pos: [1.1, 0.14 + k * 0.13, -0.5 + k * 0.12], repeat: [2, 1] })); // steps
        yard.add(mergedBoxes(t, deckSpecs, STEEL_D, { tex: 'metal', metal: 0.24, rough: 0.6, bump: 0.03 }));
        // canopy on four posts — only over the DECK (inner post face 0.57 vs a
        // 0.35 train half-width)
        const canSpecs: MergedBoxSpec[] = [];
        [0.62, 1.38].forEach((x) => [0.35, 2.25].forEach((z) => canSpecs.push({ dims: [0.11, 1.18, 0.11], pos: [x, deckTop + 0.59, z], repeat: [1, 3] })));
        canSpecs.push({ dims: [1.0, 0.1, 3.0], pos: [DX, deckTop + 1.21, 1.3], repeat: [3, 8] });
        [0.62, 1.38].forEach((x) => canSpecs.push({ dims: [0.1, 0.1, 3.0], pos: [x, deckTop + 1.23, 1.3], repeat: [1, 8] }));
        yard.add(mergedBoxes(t, canSpecs, STEEL_D, { tex: 'metal', metal: 0.24, rough: 0.6 }));
        const roofSpecs: MergedBoxSpec[] = [];
        [-1, 1].forEach((s) => roofSpecs.push({ dims: [0.78, 0.08, 3.2], pos: [DX + s * 0.3, deckTop + 1.38, 1.3], rotZ: s * 0.42, repeat: [3, 9] }));
        roofSpecs.push({ dims: [0.16, 0.1, 3.24], pos: [DX, deckTop + 1.5, 1.3], repeat: [1, 9] });
        yard.add(mergedBoxes(t, roofSpecs, BASALT, { tex: 'concrete', rough: 1, bump: 0.05 }));
        // ember BRAZIERS either end of the platform (lava-lit — they burn by day)
        [0.15, 2.5].forEach((z) => {
          const br = new t.Group();
          br.position.set(1.9, 0, z);
          yard.add(br);
          br.add(cyl(t, 0.05, 0.07, deckTop + 0.36, STEEL_D, [0, (deckTop + 0.36) / 2, 0], { tex: 'metal', metal: 0.26, rough: 0.55, seg: 10 }));
          br.add(cyl(t, 0.22, 0.13, 0.18, STEEL_D, [0, deckTop + 0.44, 0], { tex: 'metal', metal: 0.26, rough: 0.55, seg: 14 }));
          const coals = lavaMaterial(t, 0.16, [1, 1]);
          lava.push(coals);
          const bowl = new t.Mesh(new t.CylinderGeometry(0.19, 0.19, 0.06, 14), coals.mat);
          bowl.position.set(0, deckTop + 0.52, 0);
          br.add(bowl);
        });
        // the one night-gated lamp, on the canopy tie beam over the boarding edge
        const lampY = deckTop + 1.08;
        yard.add(box(t, [0.12, 0.14, 0.12], STEEL_D, [DX, lampY, 1.3], { tex: 'metal', metal: 0.26, rough: 0.55 }));
        const glass = ball(t, 0.085, 0xffe6b0, [DX, lampY - 0.16, 1.3], { emissive: 0xffb45e, rough: 0.35 });
        (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
        yard.add(glass);
        lampMats.push(glass.material as THREE.MeshStandardMaterial);
        const sl = new t.PointLight(0xffb45e, 0, 5, 2);
        sl.position.set(DX, lampY - 0.3, 1.3);
        yard.add(sl);
        lights.push(sl);
      }

      // ---- 5. LINESIDE ROCK DRESSING -------------------------------------
      {
        for (let i = 0; i < 16; i++) {
          const u = (i + 0.5) / 16;
          if (Math.abs(u - tunnelU) < 0.1) continue; // the ridge already covers the bore
          const f = ride.frameAt(u);
          const ln = Math.hypot(f.side.x, f.side.z) || 1;
          const lx = f.side.x / ln;
          const lz = f.side.z / ln;
          const h1 = hash01(i * 5.9 + 17);
          const sc = 0.38 + h1 * 0.62;
          const sgn = i % 2 ? 1 : -1;
          const off = 1.7 + h1 * 1.5;
          const rx = f.p.x + lx * sgn * off;
          const rz = f.p.z + lz * sgn * off;
          const rock = buildRock(t, { scale: sc, seed: 12 + i * 7, tint: h1 > 0.6 ? BASALT : ROCK });
          rock.position.set(rx, groundAt(rx, rz), rz);
          if (sc < 0.55) rock.userData.lodDetail = true;
          g.add(rock);
        }
      }

      // ---- 6. PORTAL SMOKE + EMBERS --------------------------------------
      let smoke: Emitter | null = null;
      let embers: Emitter | null = null;
      if (opts.smoke !== false && smokePts.length) {
        smoke = buildEmitter(t, {
          max: 120,
          rate: 13,
          life: 3.4,
          lifeVar: 1.0,
          velocity: [0, 1.0, 0],
          spread: 0.5,
          gravity: -0.24, // buoyant
          size: 0.6,
          sizeEnd: 2.0,
          color: 0x6e6459,
          colorEnd: 0x9a9186,
          opacity: 0.3,
        });
        embers = buildEmitter(t, {
          max: 100,
          rate: 15,
          life: 2.6,
          lifeVar: 0.9,
          velocity: [0, 1.7, 0],
          spread: 0.6,
          gravity: -0.1,
          size: 0.13,
          sizeEnd: 0.03,
          color: 0xffd070,
          colorEnd: 0x8a1403,
          opacity: 0.95,
          additive: true,
        });
        g.add(smoke.points);
        g.add(embers.points);
        emitters.push(smoke, embers);
      }

      // ---- 7. THE TRAIN --------------------------------------------------
      // RCT2 train order: index 0 leads (run() places car i at
      // uHead − i·spacing) — nose car first, plain middles, tail car last.
      // The vehicle is a themed `buildCoasterCar`: the DS's shared coaster car
      // in a basalt/ember VehicleColour, so COASTER_CAR_SEATS drives seatWorld
      // and gateCarLights drives the headlamp exactly as everywhere else.
      const cars = Array.from({ length: carCount }, (_, i) =>
        buildCoasterCar(t, carCount === 1 || i === 0 ? 'front' : i === carCount - 1 ? 'end' : 'middle', CAR_LIVERY, {
          riders: opts.riders ?? true,
        }),
      );
      cars.forEach((car) =>
        COASTER_CAR_SEATS.forEach((sp) => {
          const anchor = new t.Group();
          anchor.position.set(0, sp.y, sp.z);
          car.add(anchor); // rides WITH the car, so real guests ride the train
          seatAnchors.push(anchor);
        }),
      );
      extras.vehicle = cars[0];
      seatWorld = makeSeatWorld(t, seatAnchors);
      const run = ride.run(cars, { spacing: 1.4, wheelOffset: 0.195 });

      // ---- 8. the gated updater -----------------------------------------
      let smokeTick = -1;
      const gate = createMotionGate(
        (clock) => {
          run(clock);
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          cars.forEach((c) => gateCarLights(c, nk));
          lampMats.forEach((m) => (m.emissiveIntensity = 0.14 + 1.16 * ease));
          lights.forEach((l) => (l.intensity = 0.85 * ease));
          // LAVA: day AND night, never gated to zero (the Volcano house rule)
          const glow = lavaGlow(nk);
          const breathe = 1 + 0.11 * Math.sin(clock * 0.42 + 0.7);
          lava.forEach((s, i) => {
            const wave = 1 + 0.22 * Math.sin(clock * 0.31 - i * 0.55);
            s.mat.emissiveIntensity = s.heat * glow * breathe * wave;
            s.tex[0].offset.y = -clock * 0.02; // the crust creeps downhill
            s.tex[1].offset.y = -clock * 0.02;
          });
          for (const q of liquids) q.update(clock * 0.34);
          lavaLights.forEach((l, i) => (l.intensity = (0.7 + 1.5 * nk) * (1 + 0.1 * Math.sin(clock * 1.7 + i * 2.1))));
          if (smoke && embers) {
            const tick = Math.floor(clock * 2);
            if (tick !== smokeTick) {
              smokeTick = tick;
              const a = smokePts[Math.floor(hash01(tick * 1.37 + 0.5) * smokePts.length) % smokePts.length];
              const b = smokePts[Math.floor(hash01(tick * 2.71 + 3.1) * smokePts.length) % smokePts.length];
              smoke.setOrigin(a[0], a[1], a[2]);
              embers.setOrigin(b[0], b[1], b[2]);
            }
            embers.setRate(12 + 8 * nk);
          }
          emitters.forEach((e) => e.update(clock));
        },
        { spinDown: 1.6 },
      );
      onStateChange = gate.onStateChange;
      return gate.update;
    })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const LavaTubeRunBase = composableRide<LavaTubeRunOpts & { register?: boolean }>(
  'LavaTubeRun',
  (t, props) =>
    buildLavaTubeRunScene(t, {
      pieces: props.pieces,
      points: props.points,
      cars: props.cars,
      groundAt: props.groundAt,
      tunnelU: props.tunnelU,
      tunnelHalf: props.tunnelHalf,
      smoke: props.smoke,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the train (capacity 6 = 3 cars × 2 seats)
      riders: props.riders ?? !props.register,
    }),
  {
    // the station straight runs along local −x and every compiled point has
    // z ≤ 0, so the local +z face is free: queue HEAD 2.0 out the front, exit
    // hut beside the brake tail, boarding on the platform at rail level
    front: 2.0,
    exit: [1.6, 1.9],
    board: [-1.3, 0.6, 0],
    defaults: { name: 'Lava Tube Run', capacity: 6, rideDuration: 16, intensity: 7, price: 6 },
  },
);

/** <LavaTubeRun> — the Emberfall Caldera's TUNNEL COASTER as a composable ride
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.0 out the local +z front (the face the circuit deliberately
 *  keeps clear), exit hut at local [1.6, 1.9], boarding on the basalt platform.
 *  Override with top-level props / `queue`.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Lift/><Drop/><Hill/><TurnR/>…` — children win) are
 *  compiled by `compileTrackPieces` with this ride's rule set
 *  (`profile: 'coaster'`, `type: 'steel'`, bank 0.70 — the 40° auto-bank that
 *  soaks the lateral G on the fast turns either side of the tube) and swept by
 *  `buildRideSpline`; `points` is the raw-control-point escape hatch. No pieces
 *  = the stock "Cinder Bore" circuit. A FATAL compile marks the build `invalid`
 *  (no registration). The lead car is the ride `vehicle` (onboard cam),
 *  `crashed` reports the live 1.5 g derail guard, and the measured RCT2 rating
 *  triple is passed to `registerRide`.
 *
 *  The LAVA TUBE is placed on the lowest, straightest, most level stretch of
 *  whatever circuit you give it (or pin it with `tunnelU` / size it with
 *  `tunnelHalf`) — so a custom layout wants one long, flat, fast straight for
 *  the flank to cross. */
export const LavaTubeRun: React.FC<ComposableRideProps & LavaTubeRunOpts & { children?: React.ReactNode }> = ({ children, pieces, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <LavaTubeRunBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
