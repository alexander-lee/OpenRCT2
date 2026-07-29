import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces, rateCoaster } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildPeep, SHIRTS, SKIN_TONES, TROUSERS } from '../Guest';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { buildEmitter } from '../ParticleKit';
import type { Emitter } from '../ParticleKit';
import { buildRock } from '../Rock';
import { buildWater, LAVA } from '../WaterTile';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composable, composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// EmberWings — attraction 2 of the EMBERFALL CALDERA: a SUSPENDED FLYER that
// sweeps around the volcano's crater rim through rising heat haze. Built on the
// shared spline machinery exactly like every other tracked ride in the design
// system: the layout is compiled by SplineRideKit's `compileTrackPieces` and
// swept by `buildRideSpline({ profile: 'coaster', type: 'inverted' })`.
//
// WHY 'inverted' IS the rule set — the kit's `TYPE_RULES.inverted` is the
// hangs-BELOW-the-track family (ride/rtd/coaster/InvertedRollerCoaster.h): its
// ratings table is the one RCT2 scores a hanging train with, its piece table
// stops at ~75° drops, and it is the only CoasterType whose *semantics* match
// a car that is not sitting on the rail. The BANK, though, is deliberately
// pinned far below that type's 55° ceiling — RCT2's own SuspendedSwingingCoaster
// has NO banking track group at all, because on a suspended coaster the TRACK
// stays flat and the CARS roll. So the component compiles and sweeps with
// `bank: 0.20` (11.5°, a construction tolerance rather than a design bank) and
// the visible roll is the pendulum on each car's yoke.
//
// THE SIGNATURE — THE SUSPENDED VEHICLE
//   * the car's group origin sits ON the rail centreline (`wheelOffset: 0`):
//     a bogie rides on TOP of the twin rails, two yoke arms drop past the
//     crossties to a cross beam 0.40 below them, and a fore-and-aft PIVOT PIN
//     under that beam carries the whole gondola.
//   * every frame the swing is integrated as a real damped PENDULUM driven by
//     the car's own MEASURED motion (position + orientation deltas → speed and
//     yaw rate → lateral acceleration), composed with the apparent gravity of
//     the banked frame, and clamped at 0.42 rad by mechanical stops. So the
//     cars fling OUTWARD through every turn, overshoot, and settle level by
//     themselves when the motion gate parks the train — no private copy of the
//     runner's pacing anywhere.
//   * riders sit in open flying harnesses with their LEGS DANGLING free over a
//     footrest bar (no floor in front of the seats), arms out to the sides.
//   * WING FAIRINGS with raised tips sweep off both flanks of every gondola.
//
// WHY THIS COMPONENT BUILDS ITS OWN SUPPORTS — `addSplineSupports` drops a
// column onto the ground directly UNDER the rail centreline, which is precisely
// where a suspended car hangs. EmberWings therefore hands `buildRideSpline` a
// `groundAt` that reports "ground" 0.40 below the rail everywhere (so
// `addSplineSupports` skips every bent: `topY - gC < 0.3`) plus a huge
// `supportEvery`, and raises the ride's REAL structure itself: steel A-frame
// TOWERS standing BESIDE the track on the true terrain with cantilever arms
// that reach in over the wings and clamp the crosstie ends. One documented
// consequence: a derailment's ballistic debris (crashTrain) settles just under
// the track instead of on the terrain.
//
// LAVA — this file also owns the EMBERFALL LAVA LANGUAGE (the exported
// `lavaMaterial` / `lavaGlow` / `LAVA_HEAT` below), modelled on
// components/Volcano/index.tsx: near-black basalt plates with an emissive
// CRACK network (never a uniform orange blob), a white-yellow → orange →
// deep-red → black temperature ramp, and a glow that is LERPED between a
// daylight and a night value — lava is incandescent by day too, so it is never
// gated to zero. LavaTubeRun imports the same helpers so both attractions in
// the world burn with one palette.
//
// Budget: 2 ParticleKit emitters (230 particle capacity — heat haze + embers),
// 3 real PointLights (station lamp + brazier, night-gated; one fissure glow,
// day-and-night lerped) plus the lead car's headlamp. Everything static and
// repeated goes through `mergedBoxes`. Deterministic throughout: hashed sines
// only, no Math.random / Date.now.
// ---------------------------------------------------------------------------

// ===========================================================================
// THE EMBERFALL LAVA LANGUAGE (shared with LavaTubeRun)
// ===========================================================================

const hash2 = (a: number, b: number) => hash01(a * 37.19 + b * 91.73 + 3.11);

const CRUST_S = 192;
let _crustPair: { crust: HTMLCanvasElement; crack: HTMLCanvasElement } | null = null;

/**
 * The crust field: a jittered-grid Voronoi diagram over a toroidal 192² tile,
 * baked into TWO canvases — a near-black basalt PLATE albedo (also used as the
 * bump map, so the fissures read as recessed grooves) and a black-with-bright-
 * CRACKS emissive mask. `d2 - d1` is zero exactly on a plate boundary and grows
 * inward, so `exp(-(d2-d1)/w)` is a soft-shouldered crack line: a hot core with
 * a short glow shoulder onto the plate, which is what a real cooling pahoehoe
 * crust looks like. Per-EDGE hashing makes some fissures run hotter than
 * others and a few plates keep a hot centre (an incipient breakout).
 *
 * Cached module-wide as CANVASES rather than textures: each consumer owns its
 * own CanvasTexture because it animates `offset` for the downhill crawl.
 */
export function lavaCrustCanvases(): { crust: HTMLCanvasElement; crack: HTMLCanvasElement } {
  if (_crustPair) return _crustPair;
  const S = CRUST_S;
  const G = 6; // 6×6 jittered grid = 36 plates
  const N = G * G;
  const cell = S / G;
  const sx = new Float32Array(N);
  const sy = new Float32Array(N);
  for (let gy = 0; gy < G; gy += 1) {
    for (let gx = 0; gx < G; gx += 1) {
      const i = gy * G + gx;
      sx[i] = (gx + 0.18 + hash01(i * 1.7 + 0.3) * 0.64) * cell;
      sy[i] = (gy + 0.18 + hash01(i * 2.9 + 5.1) * 0.64) * cell;
    }
  }
  const crust = document.createElement('canvas');
  const crack = document.createElement('canvas');
  crust.width = crust.height = crack.width = crack.height = S;
  const cxA = crust.getContext('2d')!;
  const cxB = crack.getContext('2d')!;
  const imA = cxA.createImageData(S, S);
  const imB = cxB.createImageData(S, S);
  const A = imA.data;
  const B = imB.data;
  const BASE = [30, 25, 22]; // basalt, near-black
  for (let py = 0; py < S; py += 1) {
    for (let px = 0; px < S; px += 1) {
      let d1 = 1e9;
      let d2 = 1e9;
      let i1 = 0;
      let i2 = 0;
      for (let i = 0; i < N; i += 1) {
        let dx = px - sx[i];
        let dy = py - sy[i];
        if (dx > S / 2) dx -= S; // toroidal wrap keeps the tile seamless
        else if (dx < -S / 2) dx += S;
        if (dy > S / 2) dy -= S;
        else if (dy < -S / 2) dy += S;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          i2 = i1;
          d1 = d;
          i1 = i;
        } else if (d < d2) {
          d2 = d;
          i2 = i;
        }
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1); // 0 on a plate boundary
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      const edgeHeat = 0.34 + 0.66 * hash2(lo, hi);
      // DELIBERATELY NARROW: on real crust the black plates are the bulk of
      // the surface. Widen these and the whole flow collapses into the fake
      // uniform-orange look this language exists to avoid.
      let g = (0.95 * Math.exp(-e / 1.5) + 0.22 * Math.exp(-e / 3.6)) * edgeHeat;
      if (hash01(i1 * 4.3 + 0.7) > 0.88) g += 0.34 * Math.exp(-Math.sqrt(d1) / (cell * 0.36));
      g = Math.min(1, g);
      const o = (py * S + px) * 4;
      B[o] = B[o + 1] = B[o + 2] = Math.round(255 * g ** 0.85);
      B[o + 3] = 255;
      const tone = (hash01(i1 * 7.7 + 1.9) - 0.5) * 26;
      const grain = (hash2(px * 0.61, py * 0.83) - 0.5) * 16;
      const groove = 1 - 0.72 * Math.exp(-e / 1.9); // cracks darken → bump map
      for (let c = 0; c < 3; c += 1)
        A[o + c] = Math.max(0, Math.min(255, Math.round((BASE[c] + tone + grain) * groove)));
      A[o + 3] = 255;
    }
  }
  cxA.putImageData(imA, 0, 0);
  cxB.putImageData(imB, 0, 0);
  _crustPair = { crust, crack };
  return _crustPair;
}

/** the temperature ramp: `u = 0` is the vent (~1100 °C), `u = 1` cold basalt.
 *  Emissive COLOUR and INTENSITY fall off together — with no tone mapping an
 *  intensity over 1 clips the hot channels toward white, which is physically
 *  the right direction (hotter = whiter). */
export const LAVA_HEAT: [number, number, number][] = [
  [0.0, 0xfff0c0, 1.85], // white-yellow, crack cores clip to white
  [0.12, 0xffd166, 1.45], // yellow
  [0.28, 0xff9422, 1.08], // orange, ~950 °C
  [0.45, 0xf05a12, 0.78], // orange-red
  [0.62, 0xcb2807, 0.46], // deep red, ~800 °C
  [0.8, 0x8a1403, 0.22], // dull red, ~700 °C
  [1.0, 0x280502, 0.035], // black crust, cooled out
];

export function lavaHeatAt(t: typeof THREE, u: number): { emissive: THREE.Color; intensity: number; crust: THREE.Color } {
  const k = Math.max(0, Math.min(1, u));
  let i = 0;
  while (i < LAVA_HEAT.length - 2 && k > LAVA_HEAT[i + 1][0]) i += 1;
  const [t0, c0, e0] = LAVA_HEAT[i];
  const [t1, c1, e1] = LAVA_HEAT[i + 1];
  const f = t1 > t0 ? (k - t0) / (t1 - t0) : 0;
  return {
    emissive: new t.Color(c0).lerp(new t.Color(c1), f),
    intensity: e0 + (e1 - e0) * f,
    // fresh crust is a warm dark grey settling to dark basalt — NOT a void, or
    // the cold end of a flow reads as a hole punched in the ground
    crust: new t.Color(0x2e2622).lerp(new t.Color(0x211c19), k),
  };
}

function lavaTex(t: typeof THREE, canvas: HTMLCanvasElement, rx: number, ry: number): THREE.CanvasTexture {
  const tex = new t.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  return tex;
}

/** one lava surface: near-black basalt crust, glow ONLY through the crack map.
 *  `heat` is the ramp parameter; keep the returned `heat`/`mat` pair and drive
 *  `mat.emissiveIntensity = heat * lavaGlow(nightK) * …` every frame. */
export interface LavaSurface {
  mat: THREE.MeshStandardMaterial;
  /** the material's BASE emissive intensity off the ramp (multiply, never set) */
  heat: number;
  /** the two textures, so the caller can crawl their offsets */
  tex: [THREE.CanvasTexture, THREE.CanvasTexture];
}

export function lavaMaterial(t: typeof THREE, heatU: number, repeat: [number, number] = [1, 1]): LavaSurface {
  const { crust, crack } = lavaCrustCanvases();
  const h = lavaHeatAt(t, heatU);
  const cTex = lavaTex(t, crust, repeat[0], repeat[1]);
  const kTex = lavaTex(t, crack, repeat[0], repeat[1]);
  const m = new t.MeshStandardMaterial({
    color: h.crust,
    map: cTex,
    bumpMap: cTex,
    bumpScale: 0.05,
    emissive: h.emissive,
    emissiveMap: kTex,
    emissiveIntensity: h.intensity,
    roughness: 0.78,
    metalness: 0.1,
  });
  return { mat: m, heat: h.intensity, tex: [cTex, kTex] };
}

/** DAY-AND-NIGHT house rule: lava is not a lamp. `nightKOf` only lerps between
 *  a daylight multiplier and a stronger night one — never to zero. */
export const LAVA_GLOW_DAY = 1.0;
export const LAVA_GLOW_NIGHT = 1.85;
export const lavaGlow = (nightK: number) => LAVA_GLOW_DAY + (LAVA_GLOW_NIGHT - LAVA_GLOW_DAY) * nightK;

// ===========================================================================
// EMBERWINGS
// ===========================================================================

/** construction tolerance, not a design bank: suspended track stays flat and
 *  the CARS roll (RCT2's SuspendedSwingingCoaster has no banking group). */
const BANK = 0.2;
/** the compiled station straight runs along local −x, which leaves the whole
 *  local +z face (boarding deck, queue lane, huts) clear of the circuit —
 *  every compiled point has z ≤ 0. */
const HEADING = -Math.PI / 2;
/** the station rail height. A suspended car hangs 1.05 below the rail, so the
 *  circuit is authored HIGH: rail 1.75 puts the riders' dangling feet at 0.80,
 *  a tenth of a unit clear of the 0.70 boarding deck. */
const START: [number, number, number] = [0, 1.75, 0];

/** RCT2 TrackColour: obsidian-grey running rails, ember-oxide crossties,
 *  charred-steel towers. */
const TRACK_COLOURS: TrackScheme = { main: 0x9098a2, additional: 0xa85e33, supports: 0x6d7480 };
/** flyer livery: basalt-black fuselage, ember-orange trim, hot-gold fairings */
const CAR_LIVERY: VehicleScheme = { body: 0x3d434c, trim: 0xe8842f, tertiary: 0xf6bd58 };

const STEEL = 0x7b828c; // tower legs, bogie, yoke
const STEEL_D = 0x5c626b; // braces, ironwork, arms
const CONCRETE = 0x9a958a; // footers
const BASALT = 0x2a2622; // the rim's cold rock dressing
const SEATFAB = 0x6b2430; // harness padding

/** swing stop: 0.42 rad (24°) — a hard mechanical limit, with a 0.4 restitution
 *  bounce. Everything inside |x| 0.44 has to stay under the yoke cross beam
 *  (0.155 above the pin) at full roll: the tallest such part is a rider's head,
 *  0.03 above the pin, which climbs to 0.121. The wings clear it too (tip 0.11
 *  under the beam) thanks to their anhedral and aft sweep. */
const SWING_MAX = 0.42;

/** Crater Rim Flight — the shipped circuit. A 2.4-unit chain lift out of the
 *  station onto the rim, then a full 360° sweep of the caldera on four
 *  curvature-RAMPED corners with two swooping descents (0.9 then 1.5) and two
 *  wide, fast low turns home. Verified COMPILE-ONLY before shipping (see
 *  Context.md): design clean with ZERO violations, worst clearance 4.71, ZERO
 *  synthesized closure, worst effective lateral 0.88 g against the 1.5 g
 *  derail guard, E 2.72 / I 3.44 / N 2.42, 80.0 u, 19 s a lap.
 *
 *  Each corner is `12° r(2.6R) · 66° rR · 12° r(2.6R)` — the MineTrainCoaster
 *  lesson: a bare chorded arc welded onto a fast straight leaves a ~10° kink
 *  where the curvature banking has not developed, and on a near-UNBANKED
 *  suspended circuit (nothing discounts the lateral G) that junction is the
 *  whole G budget. The four cores sum to exactly 4 × 90° = 360°, so the train
 *  comes home on the station heading. */
const corner = (radius: number): TrackPiece[] => [
  { type: 'turnR', angle: 12, radius: radius * 2.6 },
  { type: 'turnR', angle: 66, radius },
  { type: 'turnR', angle: 12, radius: radius * 2.6 },
];

const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.4 },
  { type: 'lift', height: 2.4, length: 5.6 }, // 22° chain lift onto the rim
  { type: 'straight', length: 0.6 }, // level crest
  ...corner(4.0), // tight, SLOW corner (taken at crest speed)
  { type: 'straight', length: 0.6 },
  { type: 'drop', height: 0.9, length: 4.2 }, // first swoop along the far rim
  { type: 'straight', length: 1.2 },
  ...corner(4.4),
  { type: 'straight', length: 0.6 },
  { type: 'drop', height: 1.5, length: 5.5 }, // the plunge back to rim level
  { type: 'straight', length: 5.553 }, // solved: lands the loop on the station axis
  ...corner(6.0), // WIDE, fast low corner
  { type: 'straight', length: 1.636 }, // solved
  ...corner(6.0),
  { type: 'straight', length: 1.3 }, // brake tail, 0.30 u short of the station
];

/** one merged box spanning A → B (its Y axis runs along the bar) — tower legs,
 *  cantilever arms and knee braces */
function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat?: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, repeat };
}

/** seat anchors in SWING-local space (the pendulum group): two abreast. The
 *  offsets are the peep GROUP origin, so a rider's hips settle onto the
 *  harness cushion and their feet reach the footrest bar. Park's seatWorld
 *  reads these off the live transform, so real guests swing with the car. */
export const EMBER_WINGS_SEATS: { x: number; y: number; z: number }[] = [
  { x: -0.19, y: -0.55, z: 0.06 },
  { x: 0.19, y: -0.55, z: 0.06 },
];

export type EmberWingsCarVariant = 'front' | 'middle' | 'end';

/**
 * ONE SUSPENDED FLYER CAR. The group origin sits on the RAIL CENTRELINE
 * (`run(..., { wheelOffset: 0 })`), +z forward, +x the frame's side. The
 * vertical stack — every number here was checked against the swing envelope,
 * the crossties and the towers' cantilever cheek plates:
 *
 *   y +0.29 … +0.14   bogie beam + king-pin cap, ON TOP of the twin rails
 *   y +0.12           four running wheels (rail tube tops are +0.045)
 *   y +0.03           side guide wheels, fore and aft of the yoke arms
 *   y +0.22 … −0.31   two YOKE ARMS at |x| 0.40, dropping past the crossties
 *   y −0.26 … −0.35   yoke CROSS BEAM (|x| ≤ 0.44, |z| ≤ 0.10)
 *   y −0.33 … −0.53   two drop plates at |x| 0.30 carrying the pin
 *   y −0.50           the PIVOT PIN, running fore-and-aft
 *   below             `userData.swing`: the gondola, free to roll about z
 *
 * The 0.155 of daylight between the pin and the cross beam is LOAD-BEARING
 * geometry, not styling: at the full 0.42 rad of swing every part of the
 * gondola inside |x| 0.44 has to stay under that beam, and the tallest of them
 * (a rider's head at 0.03 above the pin) climbs to 0.121. The pendulum's own
 * bearing is a cylinder CONCENTRIC with the pin, so it cannot sweep at all.
 *
 * Everything below the pin lives in the swing group, so the pendulum carries
 * the shell, the wings, the harnesses, the riders and the seat anchors.
 */
export function buildEmberWingsCar(
  t: typeof THREE,
  variant: EmberWingsCarVariant = 'front',
  scheme: VehicleScheme = CAR_LIVERY,
  opts: { riders?: boolean; seed?: number } = {},
): THREE.Group {
  const g = new t.Group();
  const BODY = scheme.body ?? 0x3d434c;
  const TRIM = scheme.trim ?? 0xe8842f;
  const FAIR = scheme.tertiary ?? 0xf6bd58;
  const seed = opts.seed ?? 0;

  // ---- BOGIE: slim, rides on TOP of the rails ------------------------------
  g.add(box(t, [0.86, 0.09, 0.5], STEEL, [0, 0.185, 0], { tex: 'metal', repeat: [3, 2], metal: 0.28, rough: 0.52 }));
  g.add(box(t, [0.24, 0.085, 0.28], STEEL_D, [0, 0.25, 0], { tex: 'metal', metal: 0.28, rough: 0.52 })); // king-pin cap
  [-0.34, 0.34].forEach((x) =>
    [-0.2, 0.2].forEach((z) =>
      // running wheel: bottom at +0.045 = the rail tube top
      g.add(cyl(t, 0.075, 0.075, 0.055, 0x14161a, [x, 0.12, z], { rotZ: Math.PI / 2, tex: 'metal', repeat: [4, 1], metal: 0.6, rough: 0.4, seg: 16 })),
    ),
  );
  // side guide wheels, vertical axis, hugging the rail flanks — set FORE AND
  // AFT of the yoke arms (z ±0.24) so they never sit inside them
  [-0.39, 0.39].forEach((x) =>
    [-0.24, 0.24].forEach((z) => g.add(cyl(t, 0.05, 0.05, 0.05, 0x14161a, [x, 0.005, z], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 12 }))),
  );
  // ---- YOKE: arms past the ties, cross beam, drop plates, pivot pin -------
  [-0.4, 0.4].forEach((x) => g.add(box(t, [0.075, 0.52, 0.15], STEEL, [x, -0.045, 0], { tex: 'metal', repeat: [1, 4], metal: 0.28, rough: 0.52 })));
  g.add(box(t, [0.88, 0.09, 0.2], STEEL, [0, -0.3, 0], { tex: 'metal', repeat: [3, 1], metal: 0.28, rough: 0.52 }));
  // PIN BEARING BLOCKS, FORE AND AFT. These hung at |x| 0.30 either SIDE of the
  // gondola, which was wrong twice over — a 64-sample swing sweep caught both:
  //   * they never touched the pin they are documented to carry. The pin is a
  //     0.042-radius rod on the centreline, so a plate at |x| 0.265..0.335 hung
  //     in mid-air 0.22 away from it;
  //   * |x| 0.265..0.335 × y −0.53..−0.33 is exactly where the up-swinging
  //     rider's OUTSTRETCHED ARM arrives at the ±0.42 rad mechanical stop —
  //     measured 26 mm INSIDE the plate. Nothing shows at rest, which is why it
  //     survived the first pass.
  // Moving them INBOARD to |x| 0.115 only traded the collision: the rider's
  // inboard shoulder then measured 22.5 mm inside them. There is no free x
  // window at all in that y band — the riders sweep |x| 0.08…0.33 and the yoke
  // arms own 0.362…0.438 — so the blocks move OUT OF THE SWING PLANE instead,
  // to z ±0.27: fore and aft of the gondola's bearing (which is only z ±0.17
  // long) and outboard of the riders (z ≤ 0.14), with the pin (z ±0.4) passing
  // through them, which is what a bearing block actually does. Their tops
  // overlap the cross beam's underside by 15 mm, so they hang off it.
  [-0.27, 0.27].forEach((z) => g.add(box(t, [0.18, 0.2, 0.06], STEEL_D, [0, -0.43, z], { tex: 'metal', repeat: [2, 2], metal: 0.3, rough: 0.5 })));
  g.add(cyl(t, 0.042, 0.042, 0.8, STEEL_D, [0, -0.5, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.3, rough: 0.5, seg: 12 })); // the pin

  // ---- THE SWINGING GONDOLA ----------------------------------------------
  // The tub is a BACK-PACK: seat carrier, back wall and REAR-HALF side walls
  // only. Everything forward of z = 0 is open air, which is what lets the
  // riders' legs hang free and read as dangling from any orbit angle.
  const swing = new t.Group();
  swing.position.set(0, -0.5, 0);
  g.add(swing);
  g.userData.swing = swing;
  swing.add(cyl(t, 0.075, 0.075, 0.34, STEEL_D, [0, 0, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.3, rough: 0.5, seg: 14 })); // bearing, CONCENTRIC with the pin
  [-0.22, 0.22].forEach((x) => swing.add(box(t, [0.055, 0.26, 0.32], STEEL_D, [x, -0.19, -0.04], { tex: 'metal', repeat: [1, 2], metal: 0.3, rough: 0.5 }))); // hanger cheeks
  swing.add(box(t, [0.56, 0.07, 0.26], STEEL_D, [0, -0.33, -0.04], { tex: 'metal', metal: 0.28, rough: 0.52 })); // hanger yoke plate
  swing.add(box(t, [0.94, 0.075, 0.3], BODY, [0, -0.4, -0.22], { tex: 'plastic', repeat: [3, 1], rough: 0.4 })); // seat carrier, top −0.3625, ENDS at z −0.07
  swing.add(box(t, [0.8, 0.15, 0.28], BODY, [0, -0.49, -0.22], { tex: 'plastic', repeat: [3, 1], rough: 0.4 })); // belly fairing — also stops short of the legs
  swing.add(box(t, [0.94, 0.32, 0.09], BODY, [0, -0.25, -0.36], { tex: 'plastic', repeat: [3, 2], rough: 0.4 })); // back wall
  [-0.44, 0.44].forEach((x) => swing.add(box(t, [0.075, 0.32, 0.44], BODY, [x, -0.25, -0.14], { tex: 'plastic', repeat: [2, 2], rough: 0.4 }))); // REAR-HALF side walls
  [-0.46, 0.46].forEach((x) => swing.add(box(t, [0.06, 0.05, 0.46], TRIM, [x, -0.1, -0.14], { tex: 'plastic', rough: 0.35 }))); // ember-orange gunwale
  // FOOTREST bar out in front on two stays — the riders' dangling feet land on it
  swing.add(cyl(t, 0.03, 0.03, 0.82, STEEL_D, [0, -0.535, 0.16], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.28, rough: 0.52, seg: 10 }));
  [-0.32, 0.32].forEach((x) => swing.add(box(t, [0.05, 0.05, 0.34], STEEL_D, [x, -0.47, 0.02], { rotX: -0.42, tex: 'metal', metal: 0.28, rough: 0.52 })));

  // ---- WING FAIRINGS — the "flying" idea ----------------------------------
  // One swept panel per side mounted at the HIP line and pushed AFT (z −0.06),
  // (z −0.18) so the riders' dangling legs — which live forward of z 0 — are
  // never occluded, from any orbit angle. A touch of ANHEDRAL (tips down) plus the aft sweep keeps the
  // rising tip 0.11 under the yoke cross beam at full swing. Reach |x| 0.91,
  // which still leaves 0.11 to the boarding deck's inner edge.
  [-1, 1].forEach((s) => {
    const wing = new t.Group();
    wing.position.set(s * 0.46, -0.3, -0.18);
    wing.rotation.z = -s * 0.14; // ANHEDRAL — tips down
    wing.rotation.y = s * 0.2; // swept back
    swing.add(wing);
    wing.add(box(t, [0.34, 0.05, 0.5], FAIR, [s * 0.17, 0, 0], { tex: 'plastic', repeat: [2, 2], rough: 0.36 })); // panel
    wing.add(box(t, [0.36, 0.09, 0.11], TRIM, [s * 0.18, 0.012, 0.21], { tex: 'plastic', repeat: [2, 1], rough: 0.36 })); // leading edge
    wing.add(box(t, [0.12, 0.045, 0.32], FAIR, [s * 0.4, 0, -0.1], { tex: 'plastic', rough: 0.36 })); // raked outboard panel
    wing.add(box(t, [0.055, 0.22, 0.24], TRIM, [s * 0.43, -0.11, -0.05], { tex: 'plastic', repeat: [1, 2], rough: 0.36 })); // WINGLET, hanging BELOW the tip
    wing.add(box(t, [0.34, 0.05, 0.075], STEEL_D, [s * 0.17, -0.045, -0.14], { tex: 'metal', metal: 0.26, rough: 0.55 })); // under-spar
    wing.add(box(t, [0.14, 0.06, 0.2], STEEL_D, [s * 0.02, -0.02, 0], { tex: 'metal', metal: 0.26, rough: 0.55 })); // root fitting
  });

  // ---- nose / tail dressing (RCT2 trains use distinct end sprites) --------
  // NOTE the nose is a CHIN FAIRING slung under the footrest, not a cone in
  // front of the riders: the whole point of this vehicle is that you can see
  // the legs hanging out the open front, so nothing is allowed to sit there.
  if (variant === 'front') {
    swing.add(box(t, [0.4, 0.12, 0.2], BODY, [0, -0.66, 0.1], { rotX: -0.35, tex: 'plastic', repeat: [2, 1], rough: 0.4 })); // chin fairing, tucked UNDER the footrest
    swing.add(box(t, [0.42, 0.04, 0.05], TRIM, [0, -0.62, 0.17], { rotX: -0.35, rough: 0.35 })); // ember stripe
    swing.add(box(t, [0.28, 0.08, 0.03], 0xf5e6c8, [0, -0.63, 0.19], { rotX: -0.35, rough: 0.5 })); // number panel
    const glass = ball(t, 0.05, 0xfff3c0, [0, -0.69, 0.2], { emissive: 0xffcc55, rough: 0.3 });
    (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    swing.add(glass);
    const headlamp = new t.PointLight(0xffcc66, 0, 3.2, 2);
    headlamp.position.set(0, -0.69, 0.4);
    swing.add(headlamp);
    g.userData.headlamp = headlamp;
    g.userData.headlampMat = glass.material;
  } else {
    swing.add(cyl(t, 0.035, 0.035, 0.16, STEEL, [0, -0.44, 0.32], { rotX: Math.PI / 2, metal: 0.35, rough: 0.4, seg: 10 })); // coupler
  }
  if (variant === 'end') {
    swing.add(box(t, [0.07, 0.3, 0.28], FAIR, [0, -0.22, -0.45], { tex: 'plastic', repeat: [1, 2], rough: 0.36 })); // tail fin
    const tail = ball(t, 0.035, 0xd94a3a, [0, -0.42, -0.44], { emissive: 0xff2412, rough: 0.3 });
    (tail.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    swing.add(tail);
    g.userData.taillampMat = tail.material;
  } else {
    swing.add(cyl(t, 0.035, 0.035, 0.16, STEEL, [0, -0.44, -0.34], { rotX: Math.PI / 2, metal: 0.35, rough: 0.4, seg: 10 }));
  }

  // ---- SEATS + FLYING HARNESSES + dangling riders ------------------------
  EMBER_WINGS_SEATS.forEach((sp, i) => {
    const x = sp.x;
    swing.add(box(t, [0.34, 0.09, 0.32], SEATFAB, [x, -0.335, -0.05], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // cushion, top −0.29, cantilevered forward of the carrier
    swing.add(box(t, [0.36, 0.34, 0.07], 0x191a1e, [x, -0.22, -0.22], { tex: 'plastic', repeat: [2, 1], rough: 0.55 })); // back shell
    swing.add(box(t, [0.28, 0.28, 0.05], SEATFAB, [x, -0.23, -0.175], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back pad
    swing.add(cyl(t, 0.032, 0.032, 0.3, SEATFAB, [x, -0.36, -0.16], { rotZ: Math.PI / 2, tex: 'fabric', rough: 0.95, seg: 10 })); // lumbar roll
    swing.add(box(t, [0.26, 0.07, 0.1], 0x191a1e, [x, -0.03, -0.2], { tex: 'plastic', rough: 0.55 })); // headrest
    // OVER-SHOULDER FLYING HARNESS: two padded bars swinging down over the
    // chest onto a lap yoke — the restraint that makes the dangle safe
    [-1, 1].forEach((s) => {
      swing.add(box(t, [0.055, 0.36, 0.07], 0x2a2c31, [x + s * 0.1, -0.17, -0.11], { rotX: 0.5, tex: 'metal', metal: 0.24, rough: 0.55 }));
      swing.add(box(t, [0.075, 0.26, 0.075], SEATFAB, [x + s * 0.1, -0.2, -0.05], { rotX: 0.5, tex: 'fabric', rough: 0.95 }));
    });
    swing.add(box(t, [0.28, 0.07, 0.11], SEATFAB, [x, -0.31, 0.06], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // lap yoke
    if (opts.riders === false) return;
    const h = hash01(seed * 7.3 + i * 3.1 + 1.7);
    const p = buildPeep(t, {
      skin: SKIN_TONES[Math.floor(h * SKIN_TONES.length) % SKIN_TONES.length],
      shirt: SHIRTS[(i * 3 + seed * 2 + 2) % SHIRTS.length],
      trousers: TROUSERS[(i + seed) % TROUSERS.length],
      female: h > 0.55,
      expression: h > 0.4 ? 'surprised' : 'happy',
    });
    p.group.scale.setScalar(0.5);
    p.group.position.set(sp.x, sp.y, sp.z);
    p.group.rotation.x = -0.12; // reclined into the harness
    // LEGS DANGLING FREE — swung a touch forward, feet on the footrest bar
    p.legL.rotation.x = 0.34 + h * 0.12;
    p.legR.rotation.x = 0.28 + h * 0.14;
    // arms OUT to the sides: flying
    p.armL.rotation.z = 0.5 + h * 0.35;
    p.armR.rotation.z = -(0.5 + h * 0.35);
    p.armL.rotation.x = -0.3;
    p.armR.rotation.x = -0.3;
    p.group.userData.lodDetail = true; // the park runtime sheds riders past NEAR
    swing.add(p.group);
  });

  return g;
}

/** dim/raise a flyer's lamps with the day/night cycle (the CoasterCar contract) */
export function gateFlyerLights(car: THREE.Group, k: number) {
  const ease = k * k * (3 - 2 * k);
  const lamp = car.userData.headlamp as THREE.PointLight | undefined;
  if (lamp) lamp.intensity = ease * 0.55;
  const m = car.userData.headlampMat as THREE.MeshStandardMaterial | undefined;
  if (m) m.emissiveIntensity = 0.15 + 1.05 * ease;
  const tail = car.userData.taillampMat as THREE.MeshStandardMaterial | undefined;
  if (tail) tail.emissiveIntensity = 0.15 + 1.25 * ease;
}

// ---------------------------------------------------------------------------
// THE HANGER RIG — a dead-straight 5-unit section of the same rail profile
// (twin tubes at ±0.34, crossties, box spine), two of our own cantilever
// towers, a scrap of boarding deck and TWO cars hanging under it, swinging on
// their yokes. This is the close-up that proves the vehicle: the bogie is ON
// the rail, the yoke drops past the ties, the gondola hangs 0.42 below it and
// the riders' legs dangle over the footrest bar. Deterministic sine swing.
// ---------------------------------------------------------------------------
export function buildEmberWingsHangerScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const t = three;
  const RAIL_Y = 1.75;
  const LEN = 5.2;
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const lights: THREE.PointLight[] = [];
  const lava: LavaSurface[] = [];

  // ---- the rail section (the SAME profile buildSplineCoaster sweeps) ------
  [-0.34, 0.34].forEach((x) =>
    group.add(cyl(t, 0.045, 0.045, LEN, TRACK_COLOURS.main, [x, RAIL_Y, 0], { rotX: Math.PI / 2, tex: 'metal', repeat: [1, 24], metal: 0.3, rough: 0.5, seg: 10 })),
  );
  group.add(cyl(t, 0.07, 0.07, LEN, 0x494e56, [0, RAIL_Y - 0.17, 0], { rotX: Math.PI / 2, tex: 'metal', repeat: [1, 20], metal: 0.28, rough: 0.525, seg: 8 }));
  {
    const ties: MergedBoxSpec[] = [];
    for (let z = -LEN / 2 + 0.1; z <= LEN / 2 - 0.1; z += 0.34) ties.push({ dims: [0.96, 0.055, 0.13], pos: [0, RAIL_Y - 0.06, z], repeat: [3, 1] });
    group.add(mergedBoxes(t, ties, TRACK_COLOURS.additional, { tex: 'metal', rough: 0.9, bump: 0.03 }));
  }
  // ---- two cantilever towers, one each side -------------------------------
  {
    const legs: MergedBoxSpec[] = [];
    const braces: MergedBoxSpec[] = [];
    const cheeks: MergedBoxSpec[] = [];
    const footers: MergedBoxSpec[] = [];
    ([[-1.9, -1] as const, [1.9, 1] as const]).forEach(([z, sgn]) => {
      const bx = sgn * 1.85;
      const top = new t.Vector3(bx, RAIL_Y + 0.04, z);
      legs.push(barSpec(t, new t.Vector3(bx, -0.05, z), top, 0.15, [1, 3]));
      footers.push({ dims: [0.4, 0.09, 0.4], pos: [bx, 0.03, z] });
      const inner = new t.Vector3(sgn * 0.52, RAIL_Y + 0.04, z);
      braces.push(barSpec(t, top, inner, 0.11, [1, 3]));
      braces.push(barSpec(t, new t.Vector3(bx, (RAIL_Y + 0.04) * 0.58, z), top.clone().lerp(inner, 0.55), 0.075, [1, 2]));
      legs.push(barSpec(t, new t.Vector3(sgn * 2.9, -0.05, z), new t.Vector3(bx, (RAIL_Y + 0.04) * 0.62, z), 0.11, [1, 3]));
      footers.push({ dims: [0.3, 0.07, 0.3], pos: [sgn * 2.9, 0.03, z] });
      cheeks.push({ dims: [0.09, 0.19, 0.28], pos: [sgn * 0.5, RAIL_Y - 0.005, z] });
    });
    group.add(mergedBoxes(t, legs, TRACK_COLOURS.supports, { tex: 'metal', metal: 0.25, rough: 0.55, bump: 0.03 }));
    group.add(mergedBoxes(t, braces, STEEL_D, { tex: 'metal', metal: 0.26, rough: 0.55 }));
    group.add(mergedBoxes(t, cheeks, STEEL_D, { tex: 'metal', metal: 0.28, rough: 0.52 }));
    group.add(mergedBoxes(t, footers, CONCRETE, { tex: 'concrete', repeat: [2, 2], rough: 0.95 }));
  }
  // ---- a scrap of boarding deck with airgates + a brazier ----------------
  {
    const DECK = 0.6;
    group.add(box(t, [0.92, 0.1, 2.6], TRACK_COLOURS.supports, [1.48, DECK - 0.05, 0], { tex: 'metal', repeat: [2, 6], metal: 0.24, rough: 0.6 }));
    group.add(box(t, [0.9, 0.03, 2.56], 0x4d4a46, [1.48, DECK + 0.015, 0], { tex: 'concrete', repeat: [2, 6], rough: 0.95 }));
    const specs: MergedBoxSpec[] = [];
    [-1.05, 0, 1.05].forEach((z) =>
      [1.1, 1.86].forEach((x) => {
        specs.push({ dims: [0.12, DECK - 0.22, 0.12], pos: [x, (DECK - 0.22) / 2, z], repeat: [1, 3] });
        specs.push({ dims: [0.28, 0.06, 0.28], pos: [x, 0.03, z] });
      }),
    );
    [0.34, 0.68].forEach((y) => specs.push({ dims: [0.07, 0.06, 2.6], pos: [1.94, DECK + y, 0], repeat: [1, 6] }));
    [-0.7, 0.7].forEach((z) => {
      specs.push({ dims: [0.08, 0.72, 0.08], pos: [1.04, DECK + 0.36, z], repeat: [1, 2] });
      specs.push({ dims: [0.07, 0.06, 0.66], pos: [1.04, DECK + 0.6, z + 0.34], repeat: [1, 2] });
    });
    group.add(mergedBoxes(t, specs, TRACK_COLOURS.supports, { tex: 'metal', metal: 0.24, rough: 0.6, bump: 0.03 }));
    const br = new t.Group();
    br.position.set(2.15, 0, -1.15);
    group.add(br);
    br.add(cyl(t, 0.05, 0.07, DECK + 0.34, STEEL_D, [0, (DECK + 0.34) / 2, 0], { tex: 'metal', metal: 0.26, rough: 0.55, seg: 10 }));
    br.add(cyl(t, 0.22, 0.13, 0.18, STEEL_D, [0, DECK + 0.42, 0], { tex: 'metal', metal: 0.26, rough: 0.55, seg: 14 }));
    const coals = lavaMaterial(t, 0.18, [1, 1]);
    lava.push(coals);
    const bowl = new t.Mesh(new t.CylinderGeometry(0.19, 0.19, 0.06, 14), coals.mat);
    bowl.position.set(0, DECK + 0.5, 0);
    br.add(bowl);
    const bl = new t.PointLight(0xff8a30, 0, 3.4, 2);
    bl.position.set(2.15, DECK + 0.68, -1.15);
    group.add(bl);
    lights.push(bl);
    const post = box(t, [0.12, 0.14, 0.12], STEEL_D, [1.5, DECK + 1.5, 0.9], { tex: 'metal', metal: 0.26, rough: 0.55 });
    group.add(post);
    group.add(cyl(t, 0.05, 0.06, 1.5, TRACK_COLOURS.supports, [1.5, DECK + 0.75, 0.9], { tex: 'metal', metal: 0.25, rough: 0.55, seg: 10 }));
    const glass = ball(t, 0.085, 0xffe6b0, [1.5, DECK + 1.34, 0.9], { emissive: 0xffb45e, rough: 0.35 });
    (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
    group.add(glass);
    lampMats.push(glass.material as THREE.MeshStandardMaterial);
    const sl = new t.PointLight(0xffb45e, 0, 5, 2);
    sl.position.set(1.5, DECK + 1.2, 0.9);
    group.add(sl);
    lights.push(sl);
  }
  // ---- the two cars, hanging ---------------------------------------------
  const cars = (['front', 'end'] as const).map((v, i) => {
    const car = buildEmberWingsCar(t, v, CAR_LIVERY, { riders: true, seed: i });
    car.position.set(0, RAIL_Y, (1 - i * 2) * 0.7); // front car leads at +z
    group.add(car);
    return car;
  });

  return {
    group,
    update: (time: number) => {
      const nk = nightKOf(group);
      const ease = nk * nk * (3 - 2 * nk);
      cars.forEach((car, i) => {
        const sw = car.userData.swing as THREE.Group;
        // a slow figure-of-eight pendulum so a still frame always catches the
        // cars mid-swing (deterministic — hashed phase, absolute time)
        sw.rotation.z = 0.3 * Math.sin(time * 0.85 + i * 1.9) + 0.08 * Math.sin(time * 2.3 + i);
        gateFlyerLights(car, nk);
      });
      lampMats.forEach((m) => (m.emissiveIntensity = 0.14 + 1.16 * ease));
      lights.forEach((l) => (l.intensity = 0.85 * ease));
      const glow = lavaGlow(nk);
      const breathe = 1 + 0.11 * Math.sin(time * 0.42 + 0.7);
      lava.forEach((s) => (s.mat.emissiveIntensity = s.heat * glow * breathe));
    },
  };
}

/** <EmberWingsHanger> — composable (components/Park/Context.md): the flyer's
 *  vehicle rig on a straight test section of its own track, for close-ups. */
export const EmberWingsHanger = composable('EmberWingsHanger', (t) => buildEmberWingsHangerScene(t));

export interface EmberWingsOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Crater Rim Flight circuit. Compiled with the flyer's own rules:
   *  `profile: 'coaster'`, `type: 'inverted'`, bank 0.20, heading −90°. */
  pieces?: TrackPiece[];
  /** raw control points `[x, y, z]` — the escape hatch past the piece
   *  compiler (still swept and validated). `pieces` wins. */
  points?: [number, number, number][];
  /** cars in the train (default 4 — 8 seats) */
  cars?: number;
  /** decorative riders (default true; <EmberWings register> turns them OFF so
   *  the GameManager's real guests fill the harnesses through seatWorld) */
  riders?: boolean;
  /** terrain sampler so towers, fissures and props land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** heat-haze + ember emitters (default true) */
  haze?: boolean;
}

export interface EmberWingsBuilt {
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
 * The whole flyer: an inverted-rule spline circuit over the caldera rim, its
 * own side-mounted tower structure, a raised boarding deck, glowing lava
 * fissures with heat haze rising through the flight path, and a train of
 * suspended wing cars that swing on their yokes. `update` is motion-gated,
 * `seatWorld` seats real guests in the harnesses, `vehicle` is the lead car
 * for the RideViewer follow cam and `crashed` reports the live derail guard.
 */
export function buildEmberWingsScene(three: typeof THREE, opts: EmberWingsOpts = {}): EmberWingsBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; crashed?: () => boolean; invalid?: boolean; ratings?: EmberWingsBuilt['ratings'] } = {};
  const seatAnchors: THREE.Object3D[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = []; // night-gated lamp glass
  const lights: THREE.PointLight[] = []; // night-gated (≤ 2 here)
  const lava: LavaSurface[] = []; // day-AND-night lerped
  /** WaterTile LAVA-palette liquid: the vent pool's live molten eye */
  const liquids: { update: (time: number) => void }[] = [];
  const emitters: Emitter[] = [];
  let ventLight: THREE.PointLight | null = null; // lava glow — never gated to 0
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
      const carCount = Math.max(1, Math.min(6, opts.cars ?? 4));
      const groundAt = opts.groundAt ?? (() => 0);

      // ---- 1. LAYOUT: the shared spline machinery -------------------------
      let pts = opts.points;
      if (!pts) {
        const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, {
          profile: 'coaster',
          type: 'inverted',
          bank: BANK,
          start: START,
          heading: HEADING,
        });
        pts = compiled.points;
        g.userData.trackReport = compiled.report; // harness/agent introspection
        if (compiled.report.fatal) extras.invalid = true;
      }
      // SUPPORT SUPPRESSION (see the header): report "ground" 0.40 under the
      // nearest rail point, so addSplineSupports' `topY - gC < 0.3` test skips
      // every bent and no column is ever planted where a car hangs.
      const railGround = (x: number, z: number) => {
        let best = pts![0][1];
        let bd = Infinity;
        for (const p of pts!) {
          const d = (p[0] - x) * (p[0] - x) + (p[2] - z) * (p[2] - z);
          if (d < bd) {
            bd = d;
            best = p[1];
          }
        }
        return best - 0.4;
      };
      const ride = buildRideSpline(t, pts, {
        profile: 'coaster',
        type: 'inverted',
        wood: false, // steel rails + spine; the towers are ours
        bank: BANK,
        supportEvery: 1e9, // belt-and-braces with railGround
        groundAt: railGround,
        colours: TRACK_COLOURS,
        vehicleSchemes: [CAR_LIVERY],
      });
      g.add(ride.group);
      extras.crashed = () => ride.crashed();
      extras.ratings = rateCoaster(pts, { type: 'inverted', bank: BANK, cars: carCount });
      const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);
      // the circuit's own centroid — the CALDERA FLOOR the rim loop encloses.
      // All the ground lava is sited INSIDE it, so a rim flight really does
      // circle a cracked, glowing crater rather than a field of hotspots.
      const centroid = pts.reduce((a, p) => [a[0] + p[0] / pts!.length, a[1] + p[2] / pts!.length], [0, 0]);

      // ---- 2. THE TOWERS: our own side-mounted structure ------------------
      // A steel column stands 1.85 out on one flank (sides alternate), rises to
      // rail height and cantilevers an arm in over the wings to a cheek plate
      // welded onto the crosstie ends at |x| 0.50. Tall towers get a splayed
      // A-frame leg. Three merged meshes for the whole run.
      {
        const legs: MergedBoxSpec[] = [];
        const braces: MergedBoxSpec[] = [];
        const footers: MergedBoxSpec[] = [];
        const cheeks: MergedBoxSpec[] = [];
        const EVERY = 14;
        const N = 224; // frameAt samples — one tower every ~5 units of arc
        let towerN = 0;
        for (let i = 0; i < N; i += EVERY) {
          const f = ride.frameAt(i / N);
          if (Math.abs(f.up.y) < 0.6) continue; // too rolled to land a column
          const ln = Math.hypot(f.side.x, f.side.z) || 1;
          const lx = f.side.x / ln;
          const lz = f.side.z / ln;
          const sgn = towerN % 2 === 0 ? 1 : -1;
          towerN += 1;
          const OFF = 1.85;
          const bx = f.p.x + sgn * OFF * lx;
          const bz = f.p.z + sgn * OFF * lz;
          const gy = groundAt(bx, bz);
          const topY = f.p.y + 0.04; // the cantilever arm's height
          if (topY - gy < 0.8) continue;
          const base = new t.Vector3(bx, gy - 0.05, bz);
          const top = new t.Vector3(bx, topY, bz);
          legs.push(barSpec(t, base, top, 0.15, [1, Math.max(2, Math.round((topY - gy) / 0.8))]));
          footers.push({ dims: [0.4, 0.09, 0.4], pos: [bx, gy + 0.03, bz] });
          // cantilever arm in to the cheek plate
          const inner = new t.Vector3(f.p.x + sgn * 0.52 * lx, topY, f.p.z + sgn * 0.52 * lz);
          braces.push(barSpec(t, top, inner, 0.11, [1, 3]));
          // knee brace from 55 % of the column up to the arm's midpoint
          const knee = new t.Vector3(bx, gy + (topY - gy) * 0.58, bz);
          braces.push(barSpec(t, knee, top.clone().lerp(inner, 0.55), 0.075, [1, 2]));
          // splayed A-frame leg for the tall towers
          if (topY - gy > 2.0) {
            const ax = f.p.x + sgn * (OFF + 1.05) * lx;
            const az = f.p.z + sgn * (OFF + 1.05) * lz;
            const ay = groundAt(ax, az);
            legs.push(barSpec(t, new t.Vector3(ax, ay - 0.05, az), new t.Vector3(bx, gy + (topY - gy) * 0.62, bz), 0.11, [1, 3]));
            footers.push({ dims: [0.3, 0.07, 0.3], pos: [ax, ay + 0.03, az] });
          }
          // cheek plate bolted onto the tie ends, oriented with the frame
          const m = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
          m.setPosition(f.p.clone().addScaledVector(f.side, sgn * 0.5).addScaledVector(f.up, -0.005));
          cheeks.push({ dims: [0.09, 0.19, 0.28], matrix: m });
        }
        if (legs.length) g.add(mergedBoxes(t, legs, TRACK_COLOURS.supports, { tex: 'metal', metal: 0.25, rough: 0.55, bump: 0.03 }));
        if (braces.length) g.add(mergedBoxes(t, braces, STEEL_D, { tex: 'metal', metal: 0.26, rough: 0.55 }));
        if (cheeks.length) g.add(mergedBoxes(t, cheeks, STEEL_D, { tex: 'metal', metal: 0.28, rough: 0.52 }));
        if (footers.length) g.add(mergedBoxes(t, footers, CONCRETE, { tex: 'concrete', repeat: [2, 2], rough: 0.95 }));
      }

      // ---- 3. LAVA FISSURES under the flight path -------------------------
      // The rim is cracked open: four fissures split the basalt, each a chain
      // of slabs carrying the Volcano crust/crack material with a temperature
      // gradient from a hot vent end to a cooled black toe. Rubble lips keep
      // the slabs from reading as painted decals.
      const hazePts: [number, number, number][] = [];
      {
        // Sited off the circuit's own frames and pushed well clear of the track
        // so a fissure never lands under a tower footing. DELIBERATELY FEW AND
        // BIG: the crack network is a texture, and a narrow slab reads as a
        // dark plank from a ride-sized camera distance — the fissures have to
        // be wide enough for the plates and their glowing grooves to resolve.
        const sites: { u: number; len: number; wide: number; off: number }[] = [
          { u: 0.18, len: 6.4, wide: 1.5, off: 3.4 },
          { u: 0.52, len: 5.0, wide: 1.15, off: 3.0 },
          { u: 0.82, len: 7.0, wide: 1.7, off: 3.8 },
        ];
        const lipSpecs: MergedBoxSpec[] = [];
        sites.forEach((site, k) => {
          const f = ride.frameAt(site.u);
          const ln = Math.hypot(f.side.x, f.side.z) || 1;
          const lx = f.side.x / ln;
          const lz = f.side.z / ln;
          // always step INWARD, toward the caldera floor
          const inward = (centroid[0] - f.p.x) * lx + (centroid[1] - f.p.z) * lz >= 0 ? 1 : -1;
          const cx = f.p.x + inward * site.off * lx;
          const cz = f.p.z + inward * site.off * lz;
          const yaw = yawOf(f) + (hash01(k * 9.1 + 5) - 0.5) * 1.1;
          const gy = groundAt(cx, cz);
          const fis = new t.Group();
          fis.position.set(cx, gy + 0.015, cz);
          fis.rotation.y = yaw;
          g.add(fis);
          const SEG = 6;
          for (let sg = 0; sg < SEG; sg++) {
            const u = sg / (SEG - 1); // 0 = vent (white-hot), 1 = cooled toe
            const surf = lavaMaterial(t, 0.24 + u * 0.74, [1, 1]);
            lava.push(surf);
            const w = site.wide * (1.1 - 0.5 * u) * (0.85 + hash01(k * 3.3 + sg) * 0.35);
            const L = site.len / SEG;
            const sx0 = (hash01(k * 4.7 + sg * 2.1) - 0.5) * site.wide * 0.45;
            const sz0 = -site.len / 2 + L * (sg + 0.5);
            const syaw = (hash01(k * 6.1 + sg) - 0.5) * 0.26;
            const slab = new t.Mesh(new t.BoxGeometry(w, 0.08, L * 1.14), surf.mat);
            slab.position.set(sx0, 0, sz0);
            slab.rotation.y = syaw;
            slab.receiveShadow = true;
            fis.add(slab);
            // THE MOLTEN CORE. The crust plates are the bulk of the surface and
            // they are black — but at ride-camera distance the crack network in
            // the texture falls under a pixel and the whole slab averages to
            // dark rock. So each segment also gets a NARROW open channel down
            // its middle, two ramp steps HOTTER than the plates around it: a
            // continuous incandescent line that survives any distance while
            // still being a crack in black basalt rather than an orange blob.
            const core = lavaMaterial(t, Math.max(0.03, 0.24 + u * 0.74 - 0.34), [0.5, 0.5]);
            lava.push(core);
            const coreMesh = new t.Mesh(new t.BoxGeometry(w * (0.3 - 0.12 * u), 0.1, L * 1.16), core.mat);
            coreMesh.position.set(sx0 + (hash01(k * 2.3 + sg * 5.1) - 0.5) * w * 0.2, 0.012, sz0);
            coreMesh.rotation.y = syaw;
            fis.add(coreMesh);
            // basalt rubble lips either side of the crack (world space, merged)
            const zc = -site.len / 2 + L * (sg + 0.5);
            [-1, 1].forEach((sx) => {
              const ox = sx * (w * 0.5 + 0.13);
              lipSpecs.push({
                dims: [0.2 + hash01(k + sg * 1.7) * 0.18, 0.13 + hash01(sg * 2.9 + k) * 0.12, L * 1.12],
                pos: [cx + Math.cos(yaw) * ox + Math.sin(yaw) * zc, gy + 0.06, cz - Math.sin(yaw) * ox + Math.cos(yaw) * zc],
                rotY: yaw,
              });
            });
          }
          // the haze rises out of the HOT end, up through the flight path above
          hazePts.push([cx + Math.sin(yaw) * -site.len * 0.36, gy + 0.12, cz + Math.cos(yaw) * -site.len * 0.36]);
          // scattered basalt boulders along the crack
          for (let b = 0; b < 5; b++) {
            const hb = hash01(k * 11.3 + b * 2.7);
            const rock = buildRock(t, { scale: 0.3 + hb * 0.5, seed: 210 + k * 9 + b * 3, tint: BASALT });
            const rr = site.len * (hb - 0.5) * 1.2;
            const ro = (hash01(k * 3.9 + b) - 0.5) * (site.wide + 2.0);
            rock.position.set(cx + Math.cos(yaw) * ro + Math.sin(yaw) * rr, gy, cz - Math.sin(yaw) * ro + Math.cos(yaw) * rr);
            if (hb < 0.35) rock.userData.lodDetail = true;
            g.add(rock);
          }
        });
        if (lipSpecs.length) g.add(mergedBoxes(t, lipSpecs, BASALT, { tex: 'concrete', repeat: [2, 2], rough: 1, bump: 0.05 }));

        // ---- THE VENT POOL: the caldera's open magma eye ------------------
        // A ring of crust plates around a white-hot centre — the one place the
        // ramp's hot end gets enough area to read at ride distance, and where
        // the component's single lava PointLight lives (day AND night).
        {
          const px = centroid[0];
          const pz = centroid[1];
          const gy = groundAt(px, pz);
          const pool = new t.Group();
          pool.position.set(px, gy + 0.02, pz);
          g.add(pool);
          const RINGS = 4;
          for (let r = 0; r < RINGS; r++) {
            const r0 = 0.42 + r * 0.42;
            const surf = lavaMaterial(t, 0.03 + (r / (RINGS - 1)) * 0.72, [2, 1]);
            lava.push(surf);
            const geo = new t.RingGeometry(r === 0 ? 0 : r0 - 0.42, r0, 22, 1);
            geo.rotateX(-Math.PI / 2);
            const ringMesh = new t.Mesh(geo, surf.mat);
            ringMesh.position.y = 0.05 - r * 0.012; // the crust sags outward
            pool.add(ringMesh);
          }
          // basalt levee round the pool so it is a HOLE, not a painted decal
          const levee: MergedBoxSpec[] = [];
          for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2;
            const hb = hash01(i * 5.9 + 3);
            levee.push({
              dims: [0.34 + hb * 0.24, 0.2 + hb * 0.2, 0.4],
              pos: [Math.cos(a) * (1.78 + hb * 0.16), 0.05, Math.sin(a) * (1.78 + hb * 0.16)],
              rotY: -a,
            });
          }
          pool.add(mergedBoxes(t, levee, BASALT, { tex: 'concrete', repeat: [2, 2], rough: 1, bump: 0.06 }));
          // …and the EYE itself is now a real liquid: a WaterTile `buildWater`
          // sheet on the LAVA palette, radius-clipped inside the innermost
          // crust ring (1.1 < the levee's 1.78) and sitting 30 mm over it.
          // The rings stay as the cooling shore that keeps the pool reading as
          // a hole in the basalt rather than a glowing disc on top of it; what
          // changes is that the middle of the caldera's eye now MOVES, which is
          // the whole reason a rim flight circles it.
          {
            const live = buildWater(t, 2.4, 48, 1.1, 0.22, 0.15, 0.26, LAVA);
            live.mesh.position.set(0, 0.08, 0);
            live.mesh.castShadow = false;
            live.mesh.receiveShadow = false;
            pool.add(live.mesh);
            liquids.push(live);
          }
          ventLight = new t.PointLight(0xff7a24, 0, 7.5, 2);
          ventLight.position.set(px, gy + 0.7, pz);
          g.add(ventLight);
          hazePts.push([px, gy + 0.2, pz]);
        }
      }

      // ---- 4. STATION: raised boarding deck under a basalt canopy ---------
      {
        const st = ride.frameAt(0);
        const yard = new t.Group();
        yard.position.set(st.p.x, 0, st.p.z);
        yard.rotation.y = yawOf(st);
        g.add(yard);
        // local frame: +z runs along the station straight (i.e. world −x), +x
        // is the FREE face the queue lane and huts come in on. Careful: the
        // car's WINGS reach 0.92 along the frame's side, so the deck's inner
        // edge is held at 1.02.
        const DECK = 0.6; // deck top — the riders' dangling feet hang at 0.73
        yard.add(box(t, [0.92, 0.1, 2.9], TRACK_COLOURS.supports, [1.48, DECK - 0.05, 1.3], { tex: 'metal', repeat: [2, 7], metal: 0.24, rough: 0.6 }));
        yard.add(box(t, [0.9, 0.03, 2.86], 0x4d4a46, [1.48, DECK + 0.015, 1.3], { tex: 'concrete', repeat: [2, 7], rough: 0.95 })); // grit deck surface
        const deckSpecs: MergedBoxSpec[] = [];
        [1.1, 1.86].forEach((x) => deckSpecs.push({ dims: [0.11, 0.11, 2.9], pos: [x, DECK - 0.16, 1.3], repeat: [1, 6] })); // bearers
        [0.15, 1.3, 2.45].forEach((z) =>
          [1.1, 1.86].forEach((x) => {
            deckSpecs.push({ dims: [0.12, DECK - 0.22, 0.12], pos: [x, (DECK - 0.22) / 2, z], repeat: [1, 3] });
            deckSpecs.push({ dims: [0.28, 0.06, 0.28], pos: [x, 0.03, z] });
          }),
        );
        [0.34, 0.68].forEach((y) => deckSpecs.push({ dims: [0.07, 0.06, 2.9], pos: [1.94, DECK + y, 1.3], repeat: [1, 6] })); // outer edge rails
        [0.15, 1.3, 2.45].forEach((z) => deckSpecs.push({ dims: [0.08, 0.74, 0.08], pos: [1.94, DECK + 0.37, z], repeat: [1, 2] }));
        // AIRGATES on the inner edge — a suspended coaster's platform gates
        [0.5, 1.3, 2.1].forEach((z) => {
          deckSpecs.push({ dims: [0.08, 0.72, 0.08], pos: [1.04, DECK + 0.36, z], repeat: [1, 2] });
          deckSpecs.push({ dims: [0.07, 0.06, 0.66], pos: [1.04, DECK + 0.6, z + 0.4], repeat: [1, 2] });
        });
        // STAIRS up from the ground at the far end of the deck
        for (let k = 0; k < 5; k++)
          deckSpecs.push({ dims: [0.8, 0.05, 0.28], pos: [1.5, 0.12 + k * 0.13, 2.95 + k * 0.15], repeat: [2, 1] });
        yard.add(mergedBoxes(t, deckSpecs, TRACK_COLOURS.supports, { tex: 'metal', metal: 0.24, rough: 0.6, bump: 0.03 }));
        // CANOPY on four posts, held clear of the wings (inner posts at 1.12)
        const canSpecs: MergedBoxSpec[] = [];
        [1.12, 1.9].forEach((x) => [0.35, 2.25].forEach((z) => canSpecs.push({ dims: [0.1, 1.2, 0.1], pos: [x, DECK + 0.6, z], repeat: [1, 3] })));
        canSpecs.push({ dims: [0.95, 0.09, 3.0], pos: [1.5, DECK + 1.23, 1.3], repeat: [2, 7] });
        [1.12, 1.9].forEach((x) => canSpecs.push({ dims: [0.09, 0.09, 3.0], pos: [x, DECK + 1.25, 1.3], repeat: [1, 7] }));
        yard.add(mergedBoxes(t, canSpecs, TRACK_COLOURS.supports, { tex: 'metal', metal: 0.24, rough: 0.6 }));
        const roofSpecs: MergedBoxSpec[] = [];
        [-1, 1].forEach((s) => roofSpecs.push({ dims: [0.72, 0.08, 3.2], pos: [1.5 + s * 0.28, DECK + 1.38, 1.3], rotZ: s * 0.4, repeat: [2, 8] }));
        roofSpecs.push({ dims: [0.14, 0.1, 3.24], pos: [1.5, DECK + 1.5, 1.3], repeat: [1, 8] });
        yard.add(mergedBoxes(t, roofSpecs, BASALT, { tex: 'concrete', rough: 1, bump: 0.05 }));
        // EMBER BRAZIERS on the deck: iron bowls of glowing coals (lava-lit,
        // so they burn by day too)
        [0.3, 2.35].forEach((z, i) => {
          const br = new t.Group();
          br.position.set(2.15, 0, z);
          yard.add(br);
          br.add(cyl(t, 0.05, 0.07, DECK + 0.34, STEEL_D, [0, (DECK + 0.34) / 2, 0], { tex: 'metal', metal: 0.26, rough: 0.55, seg: 10 }));
          br.add(cyl(t, 0.22, 0.13, 0.18, STEEL_D, [0, DECK + 0.42, 0], { tex: 'metal', metal: 0.26, rough: 0.55, seg: 14 }));
          const coals = lavaMaterial(t, 0.18, [1, 1]);
          lava.push(coals);
          const bowl = new t.Mesh(new t.CylinderGeometry(0.19, 0.19, 0.06, 14), coals.mat);
          bowl.position.set(0, DECK + 0.5, 0);
          br.add(bowl);
          if (i === 0) {
            const bl = new t.PointLight(0xff8a30, 0, 3.4, 2);
            bl.position.set(0, DECK + 0.68, 0);
            br.add(bl);
            lights.push(bl);
          }
        });
        // station lamp on the canopy tie beam (the only other real light)
        const lampY = DECK + 1.1;
        yard.add(box(t, [0.12, 0.14, 0.12], STEEL_D, [1.5, lampY, 1.3], { tex: 'metal', metal: 0.26, rough: 0.55 }));
        const glass = ball(t, 0.085, 0xffe6b0, [1.5, lampY - 0.16, 1.3], { emissive: 0xffb45e, rough: 0.35 });
        (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
        yard.add(glass);
        lampMats.push(glass.material as THREE.MeshStandardMaterial);
        const sl = new t.PointLight(0xffb45e, 0, 5, 2);
        sl.position.set(1.5, lampY - 0.3, 1.3);
        yard.add(sl);
        lights.push(sl);
      }

      // ---- 5. HEAT HAZE + EMBERS rising through the flight path ----------
      let haze: Emitter | null = null;
      let embers: Emitter | null = null;
      if (opts.haze !== false && hazePts.length) {
        haze = buildEmitter(t, {
          max: 120,
          rate: 15,
          life: 3.6,
          lifeVar: 1.0,
          velocity: [0, 0.95, 0],
          spread: 0.5,
          gravity: -0.22, // buoyant: heat RISES through the track above
          size: 0.7,
          sizeEnd: 2.1,
          color: 0xc9a184,
          colorEnd: 0x9a8b80,
          opacity: 0.24,
        });
        embers = buildEmitter(t, {
          max: 110,
          rate: 17,
          life: 2.7,
          lifeVar: 0.9,
          velocity: [0, 1.6, 0],
          spread: 0.6,
          gravity: -0.12,
          size: 0.14,
          sizeEnd: 0.035,
          color: 0xffd070,
          colorEnd: 0x8a1403,
          opacity: 0.95,
          additive: true,
        });
        g.add(haze.points);
        g.add(embers.points);
        emitters.push(haze, embers);
      }

      // ---- 6. THE TRAIN --------------------------------------------------
      const cars = Array.from({ length: carCount }, (_, i) =>
        buildEmberWingsCar(t, carCount === 1 || i === 0 ? 'front' : i === carCount - 1 ? 'end' : 'middle', CAR_LIVERY, {
          riders: opts.riders ?? true,
          seed: i,
        }),
      );
      cars.forEach((car) => {
        const sw = car.userData.swing as THREE.Group;
        EMBER_WINGS_SEATS.forEach((sp) => {
          const anchor = new t.Group();
          anchor.position.set(sp.x, sp.y, sp.z);
          sw.add(anchor); // rides the PENDULUM, so real guests swing too
          seatAnchors.push(anchor);
        });
      });
      extras.vehicle = cars[0];
      seatWorld = makeSeatWorld(t, seatAnchors);
      // wheelOffset 0: the car's origin IS the rail centreline (see the car
      // doc). spacing 1.35 keeps daylight between 1.1-long gondolas.
      const run = ride.run(cars, { spacing: 1.35, wheelOffset: 0 });

      // ---- 7. THE PENDULUM ----------------------------------------------
      // Integrated from each car's OWN measured motion, so it needs no copy of
      // the runner's pacing: speed and yaw rate give the lateral acceleration,
      // the frame's roll gives the rest of the apparent gravity, and a damped
      // spring chases the resulting hang angle with real overshoot. When the
      // motion gate parks the train the measured speed goes to zero, the target
      // goes to zero and the cars settle level by themselves.
      const W0 = 4.3; // sqrt(g / pendulum length ≈ 0.53)
      const ZETA = 0.34; // damping ratio — visible overshoot, no jitter
      const st: { p: THREE.Vector3; fwd: THREE.Vector3; side: THREE.Vector3; ang: number; vel: number; init: boolean }[] = cars.map(() => ({
        p: new three.Vector3(),
        fwd: new three.Vector3(),
        side: new three.Vector3(),
        ang: 0,
        vel: 0,
        init: false,
      }));
      const _f = new t.Vector3();
      const _s = new t.Vector3();
      const _u = new t.Vector3();
      const swingCars = cars.map((c) => c.userData.swing as THREE.Group);

      const stepSwing = (dt: number, absTime: number) => {
        cars.forEach((car, i) => {
          const s = st[i];
          _f.set(0, 0, 1).applyQuaternion(car.quaternion);
          _s.set(1, 0, 0).applyQuaternion(car.quaternion);
          _u.set(0, 1, 0).applyQuaternion(car.quaternion);
          let aSide = 0;
          let speed = 0;
          if (s.init) {
            speed = s.p.distanceTo(car.position) / dt;
            // signed yaw rate: how far the forward vector rotated toward the
            // PREVIOUS side axis → centripetal acceleration = v · ω
            const dTheta = Math.asin(Math.max(-1, Math.min(1, _f.dot(s.side))));
            aSide = speed * (dTheta / dt);
          }
          s.p.copy(car.position);
          s.fwd.copy(_f);
          s.side.copy(_s);
          s.init = true;
          // apparent gravity in car-local space; the bob hangs along it
          const gx = -9.8 * _s.y - aSide;
          const gy = -9.8 * _u.y;
          let target = Math.atan2(gx, -gy);
          // a hair of idle sway so parked cars are never dead still (hashed
          // sine on ABSOLUTE time — deterministic)
          target += 0.03 * Math.sin(absTime * 0.9 + hash01(i * 5.3 + 1) * 6.28);
          if (!Number.isFinite(target)) target = 0;
          target = Math.max(-1.1, Math.min(1.1, target));
          // damped spring toward the hang angle
          s.vel += (-W0 * W0 * (s.ang - target) - 2 * ZETA * W0 * s.vel) * dt;
          s.ang += s.vel * dt;
          if (s.ang > SWING_MAX) {
            s.ang = SWING_MAX;
            s.vel = Math.min(0, s.vel) * 0.4; // mechanical stop, with a bounce
          } else if (s.ang < -SWING_MAX) {
            s.ang = -SWING_MAX;
            s.vel = Math.max(0, s.vel) * 0.4;
          }
          swingCars[i].rotation.z = s.ang;
        });
      };

      // ---- 8. the gated updater -----------------------------------------
      // the pendulum spring, the lava breath and the night gate all run on
      // ABSOLUTE time (so the cars settle and the fissures keep breathing
      // while the train is parked); only `run` sees the gated clock.
      let absTime = 0;
      let absDt = 1 / 60;
      let hazeTick = -1;
      const gate = createMotionGate(
        (clock) => {
          run(clock);
          stepSwing(absDt, absTime);
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          cars.forEach((c) => gateFlyerLights(c, nk));
          lampMats.forEach((m) => (m.emissiveIntensity = 0.14 + 1.16 * ease));
          lights.forEach((l) => (l.intensity = 0.85 * ease));
          // LAVA: day AND night, never gated to zero (Volcano's house rule)
          const glow = lavaGlow(nk);
          const breathe = 1 + 0.11 * Math.sin(absTime * 0.42 + 0.7);
          lava.forEach((s, i) => {
            const wave = 1 + 0.2 * Math.sin(absTime * 0.31 - i * 0.7);
            s.mat.emissiveIntensity = s.heat * glow * breathe * wave;
            s.tex[0].offset.y = -absTime * 0.02; // the crust creeps
            s.tex[1].offset.y = -absTime * 0.02;
          });
          for (const q of liquids) q.update(absTime * 0.34); // a pool convects slowly
          if (ventLight) ventLight.intensity = (0.55 + 1.5 * nk) * breathe;
          // walk the haze/ember origin between the fissure vents so the plume
          // is spread over the whole rim from two emitters
          if (haze && embers) {
            const tick = Math.floor(absTime * 2.5);
            if (tick !== hazeTick) {
              hazeTick = tick;
              const a = hazePts[Math.floor(hash01(tick * 1.37 + 0.5) * hazePts.length) % hazePts.length];
              const b = hazePts[Math.floor(hash01(tick * 2.71 + 3.1) * hazePts.length) % hazePts.length];
              haze.setOrigin(a[0], a[1], a[2]);
              embers.setOrigin(b[0], b[1], b[2]);
            }
            haze.setRate(15 * (1 + 0.25 * Math.sin(absTime * 0.23)));
            embers.setRate(13 + 7 * nk);
          }
          emitters.forEach((e) => e.update(absTime));
        },
        { spinDown: 1.8 },
      );
      onStateChange = gate.onStateChange;
      return (time: number) => {
        absDt = Math.min(0.06, Math.max(1 / 240, time - (absTime || time - 1 / 60)));
        absTime = time;
        gate.update(time);
      };
    })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const EmberWingsBase = composableRide<EmberWingsOpts & { register?: boolean }>(
  'EmberWings',
  (t, props) =>
    buildEmberWingsScene(t, {
      pieces: props.pieces,
      points: props.points,
      cars: props.cars,
      groundAt: props.groundAt,
      haze: props.haze,
      // decorative riders standalone; OFF when registered so the real
      // GameManager guests fill the harnesses (capacity 8 = 4 cars × 2 seats)
      riders: props.riders ?? !props.register,
    }),
  {
    // the circuit's station straight runs along local −x and every compiled
    // point has z ≤ 0, so the whole local +z face is free: the boarding deck
    // occupies z 1.02..1.94, the queue HEAD sits at 3.1 (clear of the deck and
    // its stairs), the exit hut beside the brake tail, and boarding is on the
    // deck at its 0.70 top.
    front: 3.1,
    exit: [1.9, 2.6],
    board: [-1.3, 0.6, 1.35],
    defaults: { name: 'Ember Wings', capacity: 8, rideDuration: 18, intensity: 4, price: 5 },
  },
);

/** <EmberWings> — the Emberfall Caldera's SUSPENDED FLYER as a composable ride
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 3.1 out the local +z front (the face the circuit deliberately
 *  keeps clear), exit hut at local [1.9, 2.6], boarding on the raised deck.
 *  Override with top-level props / `queue`.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Lift/><Drop/><TurnR/>…` — children win) are compiled
 *  by `compileTrackPieces` with the flyer's rule set (`profile: 'coaster'`,
 *  `type: 'inverted'` — the hangs-below-the-rail family — bank pinned at 0.20
 *  because suspended track is flat and the CARS roll) and swept by
 *  `buildRideSpline`; `points` is the raw-control-point escape hatch. No pieces
 *  = the stock "Crater Rim Flight" circuit. A FATAL compile marks the build
 *  `invalid` (no registration). The lead wing car is the ride `vehicle`
 *  (onboard cam), `crashed` reports the live 1.5 g derail guard, and the
 *  measured RCT2 rating triple is passed to `registerRide`.
 *
 *  NOTE ON HEIGHT: the stock circuit is authored with its station rail at
 *  y = 1.75 because a suspended car hangs 1.05 BELOW the rail. Any `pieces`
 *  you write are compiled from that same `start`, so keep your own layouts at
 *  least ~1.6 above the terrain. */
export const EmberWings: React.FC<ComposableRideProps & EmberWingsOpts & { children?: React.ReactNode }> = ({ children, pieces, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <EmberWingsBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
