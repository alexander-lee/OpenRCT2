import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces, rateCoaster } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildMineTrainCart, MINE_CART_SEATS } from '../MineTrainCar';
import { gateCarLights } from '../CoasterCar';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// MineTrainCoaster — the RCT2 MINE TRAIN (ride/rtd/coaster/MineTrainCoaster.h)
// as its own component, riding the EXISTING spline machinery: the layout is
// compiled by SplineRideKit's `compileTrackPieces` and swept by
// `buildRideSpline({ profile: 'coaster', type: 'wooden' })`.
//
// WHY 'wooden' IS the mine train's rule set — MineTrainCoaster.h:27 enables
// straight / stationEnd / liftHill / flatRollBanking / slope / slopeSteep
// (up+down) / slopeCurve / sBend / curveSmall / curve / curveLarge /
// helixUpBankedHalf / helixDownBankedHalf / brakes / blockBrakes / diagonals —
// and NO corkscrew or loop group at all. That is EXACTLY the envelope of the
// kit's `TYPE_RULES.wooden` (slopes ≤ 60°, banking ≤ ~25°, `inversions:
// false`), so no new CoasterType is needed: the mine train is a wooden-rule
// circuit on mine-themed track, which is precisely how RCT2 models it
// (WoodenSupportType::mine, ColourPresets darkBrown/grey/darkBrown).
//
// What makes this component a MINE TRAIN rather than a re-skin: rough-hewn
// sleepers over the kit's ties, rusted rail + weathered trestle bents, a
// timber-framed MINE-SHAFT PORTAL the ore train dives through (rock mound,
// timber ribs, hanging lanterns), a plank boarding deck under a shingle
// canopy, an ore hopper + chute, a timber pit-head HEADFRAME with its pulley
// wheel, rocky cutting/scree dressing, and MineTrainCar ore carts. Everything
// is deterministic (hashed sine only) and animates off the Stage clock.
// ---------------------------------------------------------------------------

/** wooden banking cap — `coasterBankCap('wooden')` saturates here anyway, so
 *  geometry, design frames, ratings and the derail guard all agree (~24°). */
const BANK = 0.42;
/** the compiled station straight runs along the local −x, which leaves the
 *  local +z face (where <ConfigurableRide> puts the queue lane and the huts)
 *  completely clear of the circuit. */
const HEADING = -Math.PI / 2;

/** RCT2 TrackColour for the mine train (MineTrainCoaster.h:50-53 ColourPresets
 *  — darkBrown / grey / darkBrown): rusted rail, rough timber ties + stringers,
 *  weathered trestle timber. */
const TRACK_COLOURS: TrackScheme = { main: 0x7a5a44, additional: 0x5d4228, supports: 0x4e3a26 };
/** ore-cart livery: rough timber tub, wrought-iron bands, dark end planks */
const CART_LIVERY: VehicleScheme = { body: 0x6a4a2a, trim: 0x2a2a2e, tertiary: 0x4a3018 };

const TIMBER = 0x5a4128; // sawn structural timber (deck, portal frame, headframe)
const TIMBER_D = 0x453320; // shaded/older timber (sleepers, cribbing, shingles)
const IRON = 0x33333a; // ironwork (hopper bands, pulley, rails)
const DARK = 0x241f1c; // inside the bore — reads as unlit rock
const ROCK = 0x6f695e; // the cut rock face of the outcrop (Rock's own tint family)

/** Gold Gulch — the shipped circuit. Lift hill to a 4.15-unit summit, a
 *  half-banked descending 360° HELIX off the crest (the mine train's signature
 *  element — TrackGroup::helixDownBankedHalf), a 180° summit turnaround, the
 *  2.0-unit first drop, a dead-straight low run THROUGH the mine-shaft portal
 *  and a wide compound turnaround home. Verified with the kit's own checks:
 *  design clean, worst clearance 1.15, ZERO synthesized closure, worst
 *  effective lateral 0.99 g (guard 1.5 g), E 2.85 / I 4.17 / N 1.78. */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 3.6, length: 6.8 }, // 29.5° chain lift — the steepest a 3.6 rise can legally hold
  { type: 'straight', length: 0.8 }, // level crest (RCT2 tops every ramp with a transition)
  { type: 'helixR', angle: 360, radius: 2.8, height: -1.15 }, // banked descending helix
  { type: 'helixR', angle: 180, radius: 4.25, height: -0.45 }, // summit turnaround
  { type: 'straight', length: 1.2 }, // lets the bank unwind before the drop
  { type: 'drop', height: 2.0, length: 4.2 }, // first drop
  { type: 'straight', length: 6.4 }, // the low straight the tunnel portal sits on
  { type: 'turnR', angle: 40, radius: 7.0 }, // compound turnaround: curvature ramps in…
  { type: 'turnR', angle: 100, radius: 3.4 }, // …tightens…
  { type: 'turnR', angle: 40, radius: 7.0 }, // …and ramps out (keeps the fast turn under 1 g)
  { type: 'straight', length: 1.2 }, // brake tail onto the station axis
];

/** one merged box spanning A → B (its Y axis runs along the bar) — raking
 *  headframe legs and braces, the same trick SplineCoaster's trestles use */
function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, repeat };
}

export interface MineTrainCoasterOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Gold Gulch circuit. Compiled with the mine train's own rules:
   *  `profile: 'coaster'`, `type: 'wooden'`, bank 0.42, heading −90°. */
  pieces?: TrackPiece[];
  /** raw control points `[x, y, z]` — an escape hatch past the piece compiler
   *  (still swept and validated by buildRideSpline). `pieces` wins. */
  points?: [number, number, number][];
  /** ore carts in the train (default 3 — 6 seats) */
  carts?: number;
  /** decorative riders (default true; <MineTrainCoaster register> turns them
   *  OFF so REAL GameManager guests fill the carts through seatWorld) */
  riders?: boolean;
  /** terrain sampler so trestles/portal/props land on the ground (default flat) */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the mine-shaft portal (default: auto — the lowest,
   *  straightest, most level stretch away from the station) */
  tunnelU?: number;
}

export interface MineTrainCoasterBuilt {
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
 * The whole mine train: mine-themed wooden-rule spline circuit + station,
 * mine-shaft portal, pit-head and ore train. `update` is motion-gated (the
 * train parks in the station while guests board — RCT2 Vehicle.cpp status
 * cycle), `seatWorld` seats real guests in the carts, `vehicle` is the lead
 * cart for the RideViewer follow cam and `crashed` reports the coaster
 * profile's live 1.5 g derail guard.
 */
export function buildMineTrainCoasterScene(three: typeof THREE, opts: MineTrainCoasterOpts = {}): MineTrainCoasterBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; crashed?: () => boolean; invalid?: boolean; ratings?: MineTrainCoasterBuilt['ratings'] } = {};
  const seatAnchors: THREE.Object3D[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = []; // night-gated lantern glass
  const lights: THREE.PointLight[] = []; // ≤ 2 real lights here (+ the lead cart's headlamp)
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const cartCount = Math.max(1, Math.min(6, opts.carts ?? 3));
        const groundAt = opts.groundAt ?? (() => 0);

        // ---- 1. LAYOUT: the same spline machinery every tracked ride uses ----
        let pts = opts.points;
        if (!pts) {
          const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, {
            profile: 'coaster',
            type: 'wooden', // MineTrainCoaster.h:27 == TYPE_RULES.wooden (no inversions, 60° slopes, ~25° bank)
            bank: BANK,
            start: [0, 0.55, 0],
            heading: HEADING,
          });
          pts = compiled.points;
          g.userData.trackReport = compiled.report; // harness/agent introspection
          if (compiled.report.fatal) extras.invalid = true; // never registers as a working ride
        }
        const ride = buildRideSpline(t, pts, {
          profile: 'coaster',
          type: 'wooden',
          wood: true, // timber stringers under the rail + splayed trestle bents
          bank: BANK,
          groundAt,
          colours: TRACK_COLOURS,
          vehicleSchemes: [CART_LIVERY],
        });
        g.add(ride.group);
        extras.crashed = () => ride.crashed(); // the 1.5 g derail guard is LIVE on this profile
        extras.ratings = rateCoaster(pts, { type: 'wooden', bank: BANK, cars: cartCount });
        const total = ride.curve.getLength();
        const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);

        // ---- 2. ROUGH-HEWN SLEEPERS over the kit's machined crossties -------
        // hand-cut mine sleepers: longer than the ties, hashed length and a few
        // degrees of yaw jitter, bedded just under the tie line. One draw call.
        {
          const specs: MergedBoxSpec[] = [];
          const N = 96;
          for (let i = 0; i < N; i++) {
            const f = ride.frameAt(i / N);
            const h1 = hash01(i * 3.7 + 1);
            const h2 = hash01(i * 8.1 + 5);
            const m = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
            m.multiply(new t.Matrix4().makeRotationY((h2 - 0.5) * 0.22)); // hand-laid, never square
            m.setPosition(f.p.clone().addScaledVector(f.up, -0.115));
            specs.push({ dims: [1.16 + h1 * 0.28, 0.075, 0.17 + h1 * 0.05], matrix: m, repeat: [3, 1] });
          }
          g.add(mergedBoxes(t, specs, TIMBER_D, { tex: 'wood', rough: 0.95, bump: 0.03 }));
        }

        // ---- 3. TIMBER CRIBBING under the tall trestle bents ----------------
        // stacked log cribbing at the foot of the high supports (the kit draws
        // the bents themselves) — merged, alternating courses
        {
          const specs: MergedBoxSpec[] = [];
          for (let i = 0; i < 20; i++) {
            const f = ride.frameAt(i / 20);
            const gy = groundAt(f.p.x, f.p.z);
            if (f.p.y - gy < 1.6) continue; // only the tall bents get cribbing
            const yaw = yawOf(f);
            for (let k = 0; k < 4; k++) {
              const even = k % 2 === 0;
              specs.push({
                dims: even ? [1.5, 0.14, 0.16] : [0.16, 0.14, 1.5],
                pos: [f.p.x, gy + 0.07 + k * 0.13, f.p.z],
                rotY: yaw,
                repeat: [4, 1],
              });
            }
          }
          if (specs.length) g.add(mergedBoxes(t, specs, TIMBER_D, { tex: 'wood', rough: 0.95, bump: 0.03 }));
        }

        // ---- 4. THE MINE-SHAFT PORTAL the ore train runs through ------------
        // pick the lowest, straightest, most level stretch clear of the station
        const tunnelU = (() => {
          if (opts.tunnelU !== undefined) return opts.tunnelU;
          let best = 0.5;
          let bestScore = Infinity;
          const d = 1.8 / total;
          for (let i = 0; i < 220; i++) {
            const u = i / 220;
            if (u < 0.12 || u > 0.86) continue; // never over the station or the brake run
            const f = ride.frameAt(u);
            const a = ride.frameAt(u - d).fwd;
            const b = ride.frameAt(u + d).fwd;
            const ah = Math.hypot(a.x, a.z) || 1;
            const bh = Math.hypot(b.x, b.z) || 1;
            const bend = 1 - (a.x * b.x + a.z * b.z) / (ah * bh); // 0 = dead straight
            const score = (f.p.y - groundAt(f.p.x, f.p.z)) * 0.7 + bend * 30 + Math.abs(f.fwd.y) * 9;
            if (score < bestScore) {
              bestScore = score;
              best = u;
            }
          }
          return best;
        })();
        {
          const HALF = 2.2; // arc half-length of the bore
          const fMid = ride.frameAt(tunnelU);
          const shaft = new t.Group();
          shaft.position.copy(fMid.p);
          shaft.rotation.y = yawOf(fMid);
          g.add(shaft);
          // local frame: +z runs along the track, +x is the track's side, y is
          // measured from the RAIL CENTRELINE (so the ground sits at `gy`)
          const gy = groundAt(fMid.p.x, fMid.p.z) - fMid.p.y;
          const CLEAR = 1.5; // opening head height above the rails (train tops out at 0.92)
          // BORE LINER. The structural roof and side walls are ROCK-coloured —
          // they are the cut faces of the outcrop, and a flat DARK slab this
          // big read as a black shed from the side (verified in the harness) —
          // while thin DARK panels just inside them keep the bore itself unlit,
          // so the mouth still reads as a hole in the hill.
          shaft.add(box(t, [2.52, 0.34, HALF * 2], ROCK, [0, CLEAR + 0.14, 0], { tex: 'concrete', repeat: [4, 6], rough: 1, bump: 0.05 }));
          shaft.add(box(t, [2.12, 0.06, HALF * 2 - 0.1], DARK, [0, CLEAR - 0.02, 0], { tex: 'concrete', repeat: [3, 6], rough: 1, bump: 0.04 })); // unlit bore ceiling
          [-1.24, 1.24].forEach((x) =>
            shaft.add(box(t, [0.36, CLEAR - gy, HALF * 2], ROCK, [x, gy + (CLEAR - gy) / 2, 0], { tex: 'concrete', repeat: [2, 6], rough: 1, bump: 0.05 })),
          );
          [-1.055, 1.055].forEach((x) =>
            shaft.add(box(t, [0.05, CLEAR - gy - 0.06, HALF * 2 - 0.1], DARK, [x, gy + (CLEAR - gy) / 2, 0], { tex: 'concrete', repeat: [1, 6], rough: 1, bump: 0.04 })),
          ); // unlit bore walls
          // timber portal frame at BOTH mouths + timber ribs down the bore
          const frameSpecs: MergedBoxSpec[] = [];
          const plankSpecs: MergedBoxSpec[] = [];
          [-1, 1].forEach((s) => {
            const z = s * HALF;
            [-1.05, 1.05].forEach((x) => frameSpecs.push({ dims: [0.26, CLEAR - gy, 0.3], pos: [x, gy + (CLEAR - gy) / 2, z], repeat: [1, 4] })); // posts
            frameSpecs.push({ dims: [2.66, 0.3, 0.36], pos: [0, CLEAR + 0.15, z], repeat: [5, 1] }); // lintel
            plankSpecs.push({ dims: [2.72, 0.52, 0.16], pos: [0, CLEAR + 0.56, z], repeat: [6, 1] }); // plank facing above the lintel
            [-1, 1].forEach((sx) =>
              frameSpecs.push({ dims: [0.5, 0.18, 0.2], pos: [sx * 0.82, CLEAR - 0.22, z], rotZ: sx * 0.7, repeat: [2, 1] }),
            ); // knee braces
          });
          for (let k = -1; k <= 1; k++) {
            const z = k * (HALF * 0.55);
            [-0.98, 0.98].forEach((x) => frameSpecs.push({ dims: [0.18, CLEAR - gy - 0.1, 0.2], pos: [x, gy + (CLEAR - gy) / 2, z], repeat: [1, 3] }));
            frameSpecs.push({ dims: [2.2, 0.2, 0.22], pos: [0, CLEAR - 0.12, z], repeat: [4, 1] });
          }
          shaft.add(mergedBoxes(t, frameSpecs, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          shaft.add(mergedBoxes(t, plankSpecs, TIMBER_D, { tex: 'wood', rough: 0.92, bump: 0.03 }));
          // ROCK MOUND: the outcrop the bore is driven through — boulders piled
          // over the liner and banked against both walls, big enough to break
          // the liner's box silhouette from any angle (buildRock is a
          // deterministic faceted icosahedron, seeded per boulder). The flank
          // stones are DELIBERATELY tall (0.95-1.55): they have a 1.5-unit wall
          // to bury, and the earlier 0.62-1.14 pile left it showing.
          // Three tiers: a CREST over the bore, an UPPER FLANK leaning on the
          // top of the cut face and a LOWER FLANK bedded at ground level. The
          // wall is 2.05 units tall above the ground and a buildRock stands
          // ~1.15× its `scale`, so the lower stones are scaled 1.15-1.85 and
          // the upper tier finishes the cover — one flat slab of exposed liner
          // was the only thing that read as "shed" instead of "outcrop".
          for (let i = 0; i < 26; i++) {
            const h1 = hash01(i * 5.3 + 2);
            const h2 = hash01(i * 9.7 + 7);
            const side = hash01(i * 3.1 + 29) < 0.5 ? -1 : 1;
            const tier = i % 4; // 0 crest, 1 upper flank, 2-3 lower flank
            const s = tier === 0 ? 0.6 + h1 * 0.55 : tier === 1 ? 0.8 + h1 * 0.5 : 1.15 + h1 * 0.55;
            const rock = buildRock(t, { scale: s, seed: 40 + i * 3 });
            // a boulder's x half-extent is ~1.05 × its scale, so a flank stone
            // is stood off far enough that its inner face cannot reach past
            // |x| 0.62 — it still overlaps the 1.42 wall face (no gap) but can
            // never poke into the 0.29-half-width train envelope
            const x =
              tier === 0
                ? (h2 - 0.5) * 2.0
                : side * (0.62 + 1.05 * s + h2 * (tier === 1 ? 0.12 : 0.22));
            const y = tier === 0 ? CLEAR + 0.24 : tier === 1 ? gy + 0.85 : gy - 0.08;
            // stones march the whole length of the bore and a little past each
            // mouth, so the mound reads as a hill the track is cut through
            rock.position.set(x, y, (h1 - 0.5) * (HALF * 2.6));
            shaft.add(rock);
          }
          // scree apron so the mound meets the ground instead of floating
          const screeSpecs: MergedBoxSpec[] = [];
          for (let i = 0; i < 16; i++) {
            const h1 = hash01(i * 4.1 + 11);
            const h2 = hash01(i * 7.3 + 13);
            screeSpecs.push({
              dims: [0.2 + h1 * 0.24, 0.1 + h2 * 0.12, 0.2 + h2 * 0.2],
              pos: [(i % 2 ? 1 : -1) * (1.15 + h1 * 1.5), gy + 0.05, (h2 - 0.5) * (HALF * 2.7)],
              rotY: h1 * 3.1,
            });
          }
          shaft.add(mergedBoxes(t, screeSpecs, 0x6b675c, { tex: 'concrete', repeat: [2, 2], rough: 1, bump: 0.04 }));
          // hanging lanterns either side of the entry mouth + the ONE real
          // light at the portal (bulbs elsewhere are emissive-only)
          [-1, 1].forEach((s) => {
            const x = s * 0.92;
            shaft.add(box(t, [0.1, 0.12, 0.12], IRON, [x, CLEAR - 0.1, -HALF - 0.02], { tex: 'metal', metal: 0.6, rough: 0.5 }));
            const glass = ball(t, 0.075, 0xffe6b0, [x, CLEAR - 0.26, -HALF - 0.02], { emissive: 0xffb45e, rough: 0.35 });
            (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
            shaft.add(glass);
            lampMats.push(glass.material as THREE.MeshStandardMaterial);
          });
          const portalLight = new t.PointLight(0xffb45e, 0, 4.5, 2);
          portalLight.position.set(0, CLEAR - 0.2, -HALF - 0.5);
          shaft.add(portalLight);
          lights.push(portalLight);
        }

        // ---- 5. STATION: plank deck, shingle canopy, ore hopper, pit head ---
        {
          const st = ride.frameAt(0);
          const yard = new t.Group();
          yard.position.set(st.p.x, 0, st.p.z);
          yard.rotation.y = yawOf(st);
          g.add(yard);
          // local frame: +z along the station straight, +x the boarding side
          // (the free face the queue lane comes in on), y in WORLD height
          const deckTop = st.p.y + 0.02; // just under the 0.045 rail tops
          const DX = 1.0; // deck centre offset: inner edge 0.5 clears the 0.48 tie ends
          yard.add(box(t, [1.0, 0.09, 2.9], TIMBER, [DX, deckTop - 0.045, 1.3], { tex: 'wood', repeat: [3, 8], rough: 0.9, bump: 0.03 }));
          // deck bearers, posts, footers, edge rail and steps — one merged mesh
          const deckSpecs: MergedBoxSpec[] = [];
          [0.6, 1.4].forEach((x) => deckSpecs.push({ dims: [0.12, 0.12, 2.9], pos: [x, deckTop - 0.15, 1.3], repeat: [1, 6] })); // bearers
          [0.2, 1.3, 2.4].forEach((z) =>
            [0.6, 1.4].forEach((x) => {
              deckSpecs.push({ dims: [0.14, deckTop - 0.21, 0.14], pos: [x, (deckTop - 0.21) / 2, z], repeat: [1, 3] }); // post
              deckSpecs.push({ dims: [0.3, 0.06, 0.3], pos: [x, 0.03, z] }); // footer
            }),
          );
          [0.35, 0.72].forEach((y) => deckSpecs.push({ dims: [0.08, 0.07, 2.9], pos: [1.52, deckTop + y, 1.3], repeat: [1, 6] })); // 2 edge rails
          [0.2, 1.3, 2.4].forEach((z) => deckSpecs.push({ dims: [0.09, 0.78, 0.09], pos: [1.52, deckTop + 0.39, z], repeat: [1, 2] })); // rail posts
          [0, 1, 2].forEach((k) => deckSpecs.push({ dims: [0.7, 0.06, 0.26], pos: [1.1, 0.14 + k * 0.15, -0.55 + k * 0.12], repeat: [2, 1] })); // steps up from the queue
          yard.add(mergedBoxes(t, deckSpecs, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          // shingle canopy on four posts — clear of the train envelope because
          // it only covers the DECK (inner post face 0.57, train half-width 0.35)
          const canSpecs: MergedBoxSpec[] = [];
          [0.62, 1.38].forEach((x) => [0.35, 2.25].forEach((z) => canSpecs.push({ dims: [0.11, 1.14, 0.11], pos: [x, deckTop + 0.57, z], repeat: [1, 3] })));
          canSpecs.push({ dims: [1.0, 0.1, 3.0], pos: [DX, deckTop + 1.17, 1.3], repeat: [3, 8] }); // tie beam
          [0.62, 1.38].forEach((x) => canSpecs.push({ dims: [0.1, 0.1, 3.0], pos: [x, deckTop + 1.19, 1.3], repeat: [1, 8] })); // purlins
          yard.add(mergedBoxes(t, canSpecs, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          const roofSpecs: MergedBoxSpec[] = [];
          [-1, 1].forEach((s) => roofSpecs.push({ dims: [0.78, 0.08, 3.2], pos: [DX + s * 0.3, deckTop + 1.34, 1.3], rotZ: s * 0.42, repeat: [3, 9] }));
          roofSpecs.push({ dims: [0.16, 0.1, 3.24], pos: [DX, deckTop + 1.46, 1.3], repeat: [1, 9] }); // ridge cap
          yard.add(mergedBoxes(t, roofSpecs, TIMBER_D, { tex: 'wood', rough: 0.95, bump: 0.04 }));
          // ORE HOPPER on timber legs with a chute aimed at the track, and the
          // spoil pile under it
          const hop = new t.Group();
          hop.position.set(2.55, 0, 0.5);
          yard.add(hop);
          hop.add(box(t, [1.05, 0.62, 1.05], TIMBER_D, [0, 1.25, 0], { tex: 'wood', repeat: [3, 2], rough: 0.92, bump: 0.03 }));
          hop.add(box(t, [0.78, 0.42, 0.78], TIMBER_D, [0, 0.86, 0], { tex: 'wood', repeat: [2, 2], rough: 0.92, bump: 0.03 })); // tapered throat
          const hopSpecs: MergedBoxSpec[] = [];
          [-0.44, 0.44].forEach((x) => [-0.44, 0.44].forEach((z) => hopSpecs.push({ dims: [0.13, 0.94, 0.13], pos: [x, 0.47, z], repeat: [1, 3] })));
          hopSpecs.push({ dims: [0.62, 0.07, 0.5], pos: [-0.72, 0.72, 0], rotZ: 0.5, repeat: [2, 1] }); // chute plank toward the track
          hop.add(mergedBoxes(t, hopSpecs, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          [-0.53, 0.53].forEach((z) => hop.add(box(t, [1.08, 0.08, 0.07], IRON, [0, 1.3, z], { tex: 'metal', metal: 0.6, rough: 0.55 }))); // iron bands
          for (let i = 0; i < 4; i++) {
            const r = buildRock(t, { scale: 0.3 + hash01(i * 6.1 + 3) * 0.2, seed: 70 + i * 5, tint: 0x4f4a42 });
            r.position.set(-0.9 + hash01(i * 2.3) * 0.5, 0, -0.9 - hash01(i * 3.9) * 0.7);
            r.userData.lodDetail = true;
            hop.add(r);
          }
          // yard clutter: timber stack, two barrels, a pick and a shovel
          const stackSpecs: MergedBoxSpec[] = [];
          for (let k = 0; k < 6; k++)
            stackSpecs.push({ dims: [0.9, 0.15, 0.16], pos: [2.1, 0.08 + Math.floor(k / 2) * 0.16, 2.9 + (k % 2) * 0.19], rotY: (hash01(k * 4.7) - 0.5) * 0.14, repeat: [3, 1] });
          yard.add(mergedBoxes(t, stackSpecs, TIMBER, { tex: 'wood', rough: 0.95, bump: 0.03 }));
          [
            [1.85, -0.55],
            [2.2, -0.85],
          ].forEach(([x, z]) => {
            yard.add(cyl(t, 0.24, 0.21, 0.52, TIMBER_D, [x, 0.26, z], { tex: 'wood', repeat: [6, 1], rough: 0.92, bump: 0.03, seg: 14 }));
            [0.12, 0.4].forEach((y) => yard.add(cyl(t, 0.245, 0.245, 0.05, IRON, [x, y, z], { tex: 'metal', metal: 0.6, rough: 0.55, seg: 14 })));
          });
          const pick = new t.Group();
          pick.position.set(1.62, 0, 2.05);
          pick.rotation.z = -0.34;
          pick.userData.lodDetail = true;
          yard.add(pick);
          pick.add(cyl(t, 0.028, 0.032, 0.95, TIMBER, [0, 0.48, 0], { tex: 'wood', repeat: [1, 6], rough: 0.9, seg: 8 }));
          pick.add(box(t, [0.07, 0.08, 0.46], IRON, [0, 0.95, 0], { tex: 'metal', metal: 0.65, rough: 0.5, rotX: 0.16 }));
          const shovel = new t.Group();
          shovel.position.set(1.62, 0, 1.75);
          shovel.rotation.z = -0.28;
          shovel.userData.lodDetail = true;
          yard.add(shovel);
          shovel.add(cyl(t, 0.026, 0.03, 0.9, TIMBER, [0, 0.45, 0], { tex: 'wood', repeat: [1, 6], rough: 0.9, seg: 8 }));
          shovel.add(box(t, [0.2, 0.04, 0.26], IRON, [0, 0.94, 0.02], { tex: 'metal', metal: 0.65, rough: 0.5 }));
          // PIT-HEAD HEADFRAME beside the lift: four raking timber legs, a
          // sheave platform, the pulley wheel and its hoist cable down the
          // shaft (timber-curbed collar in the ground)
          const head = new t.Group();
          head.position.set(2.3, 0, 5.2);
          yard.add(head);
          const H = 2.65;
          const headSpecs: MergedBoxSpec[] = [];
          [-1, 1].forEach((sx) =>
            [-1, 1].forEach((sz) => {
              const bx = sx * 0.78;
              const bz = sz * 0.78;
              headSpecs.push(barSpec(t, new t.Vector3(bx, 0.02, bz), new t.Vector3(sx * 0.3, H, sz * 0.3), 0.15, [1, 5])); // raking leg
              headSpecs.push({ dims: [0.34, 0.07, 0.34], pos: [bx, 0.035, bz] }); // footer
            }),
          );
          [0.9, 1.75].forEach((y) =>
            [-1, 1].forEach((s) => {
              const w = 0.78 - (y / H) * 0.48; // legs rake inward, so the girts narrow with height
              headSpecs.push({ dims: [w * 2 + 0.14, 0.1, 0.11], pos: [0, y, s * w], repeat: [4, 1] });
              headSpecs.push({ dims: [0.11, 0.1, w * 2 + 0.14], pos: [s * w, y, 0], repeat: [1, 4] });
            }),
          );
          headSpecs.push({ dims: [0.86, 0.12, 0.86], pos: [0, H + 0.06, 0], repeat: [3, 3] }); // sheave platform
          headSpecs.push({ dims: [1.0, 0.14, 0.18], pos: [0, H + 0.34, 0], rotZ: 0.32, repeat: [3, 1] }); // raking head beam
          head.add(mergedBoxes(t, headSpecs, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          const sheaveGeo = new t.TorusGeometry(0.3, 0.05, 8, 22);
          const sheave = new t.Mesh(sheaveGeo, mat(t, IRON, { tex: 'metal', metal: 0.7, rough: 0.45 }));
          sheave.position.set(0, H + 0.42, 0);
          sheave.rotation.y = Math.PI / 2;
          head.add(sheave);
          head.add(cyl(t, 0.04, 0.04, 0.44, IRON, [0, H + 0.42, 0], { rotZ: Math.PI / 2, metal: 0.7, rough: 0.45, seg: 10 })); // axle
          head.add(cyl(t, 0.018, 0.018, H + 0.1, IRON, [0.29, (H + 0.1) / 2 + 0.05, 0], { metal: 0.7, rough: 0.5, seg: 6 })); // hoist cable
          const collarSpecs: MergedBoxSpec[] = [];
          [-1, 1].forEach((s) => {
            collarSpecs.push({ dims: [1.3, 0.14, 0.16], pos: [0, 0.07, s * 0.57], repeat: [4, 1] });
            collarSpecs.push({ dims: [0.16, 0.14, 1.3], pos: [s * 0.57, 0.07, 0], repeat: [1, 4] });
          });
          head.add(mergedBoxes(t, collarSpecs, TIMBER_D, { tex: 'wood', rough: 0.95, bump: 0.03 }));
          head.add(box(t, [1.0, 0.04, 1.0], 0x120f0d, [0, 0.02, 0], { rough: 1 })); // the shaft itself
          // station lantern on the canopy tie beam — emissive glass plus the
          // component's other real light, over the boarding deck
          const lampY = deckTop + 1.05;
          yard.add(box(t, [0.13, 0.15, 0.13], IRON, [DX, lampY, 1.3], { tex: 'metal', metal: 0.6, rough: 0.5 }));
          const stGlass = ball(t, 0.085, 0xffe6b0, [DX, lampY - 0.16, 1.3], { emissive: 0xffb45e, rough: 0.35 });
          (stGlass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
          yard.add(stGlass);
          lampMats.push(stGlass.material as THREE.MeshStandardMaterial);
          const stLight = new t.PointLight(0xffb45e, 0, 5, 2);
          stLight.position.set(DX, lampY - 0.3, 1.3);
          yard.add(stLight);
          lights.push(stLight);
        }

        // ---- 6. LINESIDE DRESSING: lantern posts + rocky cutting ------------
        {
          const postSpecs: MergedBoxSpec[] = [];
          [0.2, 0.42, 0.68].forEach((u) => {
            const f = ride.frameAt(u);
            const side = new t.Vector3(f.side.x, 0, f.side.z).normalize();
            const bx = f.p.x + side.x * 1.55;
            const bz = f.p.z + side.z * 1.55;
            const gy = groundAt(bx, bz);
            const top = gy + 1.8; // lineside height, never chasing a high trestle
            postSpecs.push({ dims: [0.14, top - gy, 0.14], pos: [bx, gy + (top - gy) / 2, bz], repeat: [1, 5] });
            postSpecs.push({ dims: [0.5, 0.11, 0.14], pos: [bx - side.x * 0.18, top, bz - side.z * 0.18], rotY: Math.atan2(side.x, side.z), repeat: [2, 1] }); // gallows arm
            const glass = ball(t, 0.075, 0xffe6b0, [bx - side.x * 0.34, top - 0.17, bz - side.z * 0.34], { emissive: 0xffb45e, rough: 0.35 });
            (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
            g.add(glass);
            lampMats.push(glass.material as THREE.MeshStandardMaterial);
          });
          g.add(mergedBoxes(t, postSpecs, TIMBER, { tex: 'wood', rough: 0.92, bump: 0.03 }));
          // boulders in the cutting: bedded beside the track, biggest under the
          // high trestles where the rock face would have been blasted
          for (let i = 0; i < 14; i++) {
            const u = (i + 0.5) / 14;
            const f = ride.frameAt(u);
            if (Math.abs(u - tunnelU) < 0.06) continue; // the mound already covers the portal
            const side = new t.Vector3(f.side.x, 0, f.side.z).normalize();
            const h1 = hash01(i * 5.9 + 17);
            const s = 0.34 + h1 * 0.5;
            const sign = i % 2 ? 1 : -1;
            const off = 1.5 + h1 * 1.3;
            const rock = buildRock(t, { scale: s, seed: 12 + i * 7 });
            rock.position.set(f.p.x + side.x * sign * off, groundAt(f.p.x + side.x * sign * off, f.p.z + side.z * sign * off), f.p.z + side.z * sign * off);
            if (s < 0.5) rock.userData.lodDetail = true;
            g.add(rock);
          }
        }

        // ---- 7. THE ORE TRAIN ----------------------------------------------
        // RCT2 train order: index 0 leads (run() places car i at
        // uHead − i·spacing) — lantern cart first, plain middles, tail cart
        const carts = Array.from({ length: cartCount }, (_, i) =>
          buildMineTrainCart(t, cartCount === 1 || i === 0 ? 'front' : i === cartCount - 1 ? 'end' : 'middle', CART_LIVERY, {
            riders: opts.riders ?? true,
          }),
        );
        carts.forEach((cart) =>
          MINE_CART_SEATS.forEach((sp) => {
            // seat anchors ride WITH the cart, so real guests ride the ore train
            const anchor = new t.Group();
            anchor.position.set(0, sp.y, sp.z);
            cart.add(anchor);
            seatAnchors.push(anchor);
          }),
        );
        extras.vehicle = carts[0]; // lead cart — RideViewer onboard/follow cam
        seatWorld = makeSeatWorld(t, seatAnchors);
        // spacing 1.15: carts span −0.6..+0.6 (couplers/lantern), so the gap
        // stays visible even through the drop's relative-pitch pinch
        const run = ride.run(carts, { spacing: 1.15, wheelOffset: 0.195 });

        // RCT2 station behaviour: the train WAITS in the station while guests
        // board and brakes to a stop on arrival (Vehicle.cpp status cycle) —
        // createMotionGate freezes the runner's clock while parked. Ungated
        // until the first onStateChange, so previews run identically.
        const gate = createMotionGate((clock) => {
          run(clock);
          const k = nightKOf(g); // lanterns + cart lamps only after dark
          const ease = k * k * (3 - 2 * k); // smoothstep
          carts.forEach((c) => gateCarLights(c, k));
          lampMats.forEach((m) => (m.emissiveIntensity = 0.14 + 1.16 * ease));
          lights.forEach((l) => (l.intensity = 0.85 * ease));
        }, { spinDown: 1.6 });
        onStateChange = gate.onStateChange;
        return gate.update;
      })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const MineTrainCoasterBase = composableRide<MineTrainCoasterOpts & { register?: boolean }>(
  'MineTrainCoaster',
  (t, props) =>
    buildMineTrainCoasterScene(t, {
      pieces: props.pieces,
      points: props.points,
      carts: props.carts,
      groundAt: props.groundAt,
      tunnelU: props.tunnelU,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the carts (capacity 6 = 3 carts × 2 seats) and empty
      // seats read empty
      riders: props.riders ?? !props.register,
    }),
  {
    // the circuit's station straight runs along the local −x, so the local +z
    // face is free: queue HEAD 2.0 out the front, exit hut beside the brake
    // tail at [1.6, 1.9], boarding at the station centre (rail level 0.6)
    front: 2.0,
    exit: [1.6, 1.9],
    board: [-1.3, 0.6, 0],
    defaults: { name: 'Mine Train', capacity: 6, rideDuration: 18, intensity: 6, price: 5 },
  },
);

/** <MineTrainCoaster> — the RCT2 Mine Train as a composable ride
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.0 out the local +z front (the face the circuit deliberately
 *  keeps clear), exit hut at local [1.6, 1.9], boarding on the plank deck.
 *  Override with top-level props / `queue`.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Lift/><HelixR/>…` — children win) are compiled by
 *  `compileTrackPieces` with the mine train's rule set (`profile: 'coaster'`,
 *  `type: 'wooden'` — MineTrainCoaster.h:27's track groups ARE the wooden
 *  whitelist: steep slopes, half-banked helixes, sBends, NO inversions) and
 *  swept by `buildRideSpline`; `points` is the raw-control-point escape hatch.
 *  No pieces = the stock "Gold Gulch" circuit. A FATAL compile marks the build
 *  `invalid` (no registration). The lead ore cart is the ride `vehicle`
 *  (onboard cam), `crashed` reports the live 1.5 g derail guard, and the
 *  measured RCT2 rating triple is passed to `registerRide`. */
export const MineTrainCoaster: React.FC<
  ComposableRideProps & MineTrainCoasterOpts & { children?: React.ReactNode }
> = ({ children, pieces, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <MineTrainCoasterBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
