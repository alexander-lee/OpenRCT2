import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces, rateCoaster } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { gateCarLights } from '../CoasterCar';
import { buildEmitter } from '../ParticleKit';
import type { Emitter } from '../ParticleKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// GEARWORKS EXPRESS — the DARK RIDE of the BRASSWORK FOUNDRY: small brass-nosed
// cars winding slowly through a hall of WORKING MACHINERY. Built on the shared
// spline machinery like every tracked ride (`compileTrackPieces` +
// `buildRideSpline({ profile: 'coaster', type: 'steel' })`) — no forked track
// code — but authored at a near-flat bank and run at `speedScale` 0.70, because
// a dark ride does not lean and does not hurry.
//
// THE MACHINERY IS THE SHOW. Two machine bays are placed AGAINST the circuit,
// picked off the compiled spline (so a custom `pieces` list gets them too):
//
//   * THE GEAR GALLERY — on the lowest, straightest, most level stretch, 1.25
//     from the rail: a FOUR-GEAR TRAIN whose teeth actually engage (one
//     circular pitch shared by all four wheels, axle distance = the sum of the
//     pitch radii, and every gear's phase SOLVED from its neighbour's live
//     angle each frame, so the interleave can never drift), a spoked FLYWHEEL,
//     a horizontal STEAM CYLINDER driven off the flywheel by a real slider-crank
//     (rigid rod, exact crosshead solution), and an overhead LINE SHAFT driving
//     the lot through flat leather BELTS whose laced splice travels round the
//     loop. Guests pass a metre from the teeth at eye level.
//   * THE ENGINE BAY — on the highest, straightest stretch (the elevated leg of
//     the stock circuit), 1.6 from the rail: three VERTICAL PISTONS on a
//     three-throw crankshaft at 120°, so the riders go past at rod height with
//     the cylinders chuffing steam right beside them.
//   * between them, at the circuit's centroid, THE PLANT: a copper boiler with
//     a glowing firebox, a chimney trailing steam, a coal heap, and an iron
//     column/truss GANTRY whose sheeted roof covers only the BACK half.
//
// IT IS A DARK RIDE, BUT IT IS NOT A BOX. The house preference is exteriorly
// readable attractions, and the world's own stall learned the lesson the hard
// way: a full roof reads as a closed lid at the isometric camera and hides
// everything under it. So there are no walls — the machinery stands in open
// iron frames that read from BOTH faces, the roof is back-only, and the rest of
// the hall is an open beam gantry.
//
// PALETTE: the Brasswork Foundry metals, exactly the values in
// components/GoggleWorks and components/BrassworkScenery — aged brass, oxidised
// copper weeping verdigris, soot-grey iron, rust, coal. METALNESS CAUTION: a
// MeshStandardMaterial at metalness 0.6+ with no env map renders almost BLACK
// (metals are lit only by reflections), so every metal here sits in the
// 0.2-0.35 band and the brass reads through colour, texture and rivet detail.
// No shiny gold anywhere.
//
// Budgets: 4 real PointLights (firebox — day-and-night lerped, it is a fire;
// gear-gallery gaslight and station gaslight — night-gated; plus the lead car's
// headlamp through `gateCarLights`), 3 emitters / 186 particles (chimney steam
// 90, cylinder puffs 60, gear-mesh sparks 36), `mergedBoxes` for every static
// repeat (rivets, teeth, rims, trusses, ballast) and `userData.lodDetail` on
// fine detail. Deterministic throughout — hashed sines only, no Math.random /
// Date.now, and every updater takes ABSOLUTE time.
// ---------------------------------------------------------------------------

// ---- the Brasswork Foundry metals (shared with GoggleWorks / BrassworkScenery)
const BRASS = 0xb2913f; // muted brass — a dull yellow-brown, never gold
const BRASS_D = 0x86682f; // shadowed brass, castings, and every rivet head
const BRASS_L = 0xd0b26a; // the brightest brass: bezels, bearing collars
const COPPER = 0x96603a; // oxidised copper sheet
const VERDIGRIS = 0x36483a; // the patina staining it (muted green, not teal)
const IRON = 0x615c53; // THE WORLD'S DEFAULT METAL: soot-grey iron
const IRON_D = 0x38342e; // deep soot in the crevices
const IRON_P = 0x8a8378; // cast iron catching sky: gear rims, pedestals
const SOOT = 0x241f1b; // oil, grease, soot wash
const COAL = 0x302e36; // anthracite, pitched up off pure black
const RUST = 0x8a5230; // iron gone to orange-brown rust
const CINDER = 0x433d35; // cinder ballast and clinker grit
const TIMBER = 0x5b4a35; // creosoted sleeper timber
const FIREBRICK = 0x7a5b48; // sooted firebrick
const LEATHER = 0x5a3f24; // belt leather
const LEATHER_D = 0x3c2a18; // the oiled, blackened face of a running belt
const DIAL = 0xe8e0cc; // enamel gauge face
const NEEDLE = 0x8c2318; // the one red in the world
const LAMP_GLASS = 0xfff0cc;
const LAMP_GLOW = 0xffb050;
const FIRE_HOT = 0xffb060;
const FIRE_DEEP = 0xc9440e;

/** near-flat bank: a dark-ride car does not lean, and 0.18 rad keeps the
 *  compiler's `bankRate` gate trivially legal on the four slow corners */
const BANK = 0.18;
/** the compiled station straight runs along local −x and every compiled point
 *  has z ≤ 0, so the whole local +z face is free for the queue and the huts */
const HEADING = -Math.PI / 2;
const START: [number, number, number] = [0, 0.55, 0];
/**
 * The runner's pace multiplier, set so ONE LAP OF THE STOCK CIRCUIT TAKES
 * EXACTLY ONE FSM CYCLE — which is NOT the same as taking `rideDuration`, and
 * that difference is why this is derived rather than chosen.
 *
 * `createMotionGate` simply STOPS the runner's clock wherever the train happens
 * to be, so if the lap and the cycle disagree the train does not come back to
 * the station: it parks mid-circuit and the GameManager seats real guests onto
 * it there. Measured over the real state sequence (rideFsm.ts:124-195) at
 * `SPEED_SCALE` 0.70, the train's boarding position walked
 * **1.5 → 6.0 → 9.0 → 10.3 → 11.2 u** from `board` over successive cycles — by
 * cycle 5 the guests were loading on the far corner of the loop, 1.14 u above
 * the station deck (probe: /tmp/mp3d-render/aud-brass-facts.tsx). Exactly the
 * defect Reef Racer's audit found; same fix, same arithmetic.
 *
 * The gate advances the clock during `departing` (eased 0→1 over spinUp 0.8)
 * and `arriving` (eased 1→0 over spinDown 1.8), and the FSM counts NEITHER as
 * ride time: measured against a bare gate, one cycle hands this runner
 * **15.326 s** of clock for a `rideDuration` of 14 — a surplus of **1.326 s**
 * (probe: aud-brass-gate.tsx, which reproduces Reef Racer's published 1.291 for
 * spinDown 1.6 as its control). So the lap must close in `CYCLE_TRUE_LAP`.
 *
 * The scale is SOLVED, not divided: this kit's coaster pace is not exactly
 * `1/speedScale` (there is a gravity term), so `lap · scale` is not a constant —
 * measured 0.7000 → 13.925 s and 0.63601 → 15.200 s, which fits
 * `lap = 8.871/scale + 1.252` and puts 15.326 s at **0.6303**. Verified: at
 * 0.6303 the measured lap is 15.33 s and the train parks 1.31 u from `board`
 * on every one of 7 cycles (probe: aud-brass-facts.tsx).
 *
 * `rideDuration` is deliberately left at 14: the world's acceptance window is
 * `max(60, 2.5·maxDur + 20)` and the Brasswork Foundry sits on the 60-s FLOOR
 * with all three cycles at 13-14 s, so raising a registration would move the
 * whole land's sim window. Bring the LAP to the cycle, never the reverse.
 *
 * Re-measure if `DEFAULT_PIECES` changes. A caller passing custom `pieces`
 * keeps this scale and will read a different lap — a known limitation of a
 * single constant, and the reason it is named.
 */
const GATE_SURPLUS = 1.326; // measured: aud-brass-gate.tsx, spinDown 1.8
const CYCLE_TRUE_LAP = 14 + GATE_SURPLUS; // 15.326 s of runner clock per cycle
/** solved so the lap closes in `CYCLE_TRUE_LAP`; measured lap 15.333 s */
const SPEED_SCALE = 8.871 / (CYCLE_TRUE_LAP - 1.252); // 0.6303

/** RCT2 TrackColour: worn rail, creosoted sleepers, soot-iron columns */
const TRACK_COLOURS: TrackScheme = { main: 0x9a9288, additional: 0x6b4a30, supports: 0x5d574e };
/** car livery: soot-iron tub, brass trim, rust-oxide panels */
const CAR_LIVERY: VehicleScheme = { body: 0x4c4a44, trim: BRASS, tertiary: RUST };

/**
 * THE GEAR GALLERY — the shipped circuit. A rounded rectangle 41.3 u round:
 * a 1.0-unit chain hoist out of the station up into the machine gallery, a
 * slow corner, the level ENGINE BAY leg at y 1.55 (the riders pass the piston
 * frame at rod height), a corner, the 1.0 back down through the PRESS HALL,
 * then the long low GEAR GALLERY straight past the four-gear train and the
 * flywheel, and two wider low corners home.
 *
 * Verified COMPILE-ONLY before shipping (see Context.md): design clean with
 * ZERO violations, worst clearance 2.39, ZERO synthesized closure (the last
 * authored piece lands 0.30 u short of the station dead on its axis — a piece
 * list that does NOT end facing the station makes the compiler synthesize a
 * closing piece straight through the track), peak grade 18.1°, E 1.11 / I 1.03
 * / N 0.35 — gentle, which is exactly what a family dark ride should score.
 *
 * The two straight lengths are SOLVED: a four-corner circuit has exactly two
 * degrees of freedom, and these are the pair that closes it.
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.4 },
  { type: 'lift', height: 1.0, length: 4.0 }, // the chain hoist into the gallery
  { type: 'straight', length: 0.8 }, // level crest at the top of the hoist
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'straight', length: 3.4 }, // THE ENGINE BAY (high, level)
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'drop', height: 1.0, length: 4.0 }, // down through the press hall
  { type: 'straight', length: 5.5 }, // THE GEAR GALLERY (low, level)
  { type: 'turnR', angle: 90, radius: 2.6 }, // the two faster low corners: wider
  { type: 'straight', length: 2.2 },
  { type: 'turnR', angle: 90, radius: 2.6 },
  { type: 'straight', length: 1.4 }, // brake tail, 0.30 u short of the station
];

// ===========================================================================
// THE CAR — a small riveted iron tub with a brass boiler nose and a hooded
// headlamp. Origin on the wheel axle line: wheel bottoms sit at −0.15, so the
// runner's `wheelOffset` 0.195 drops them exactly onto the 0.045 rail tops
// (the same convention as CoasterCar / MineTrainCar, which is what lets
// `gateCarLights` and `makeSeatWorld` work on it unchanged).
// ===========================================================================
/** 2 riders per car at these car-local offsets (peep GROUP origin — hips settle
 *  0.015 INTO the 0.435 cushion top). `seatWorld` reads these off the LIVE car
 *  transform, so real GameManager guests ride the train. */
export const GEARWORKS_CAR_SEATS: { y: number; z: number }[] = [
  { y: 0.195, z: 0.21 },
  { y: 0.195, z: -0.21 },
];

export type GearworksCarVariant = 'front' | 'middle' | 'end';

/** one car. `scheme` is an RCT2 VehicleColour: body → tub plate, trim → the
 *  brass hoops and nose, tertiary → the oxide end panels. */
export function buildGearworksCar(
  t: typeof THREE,
  variant: GearworksCarVariant = 'front',
  scheme?: VehicleScheme,
  opts: { riders?: boolean } = {},
): THREE.Group {
  const g = new t.Group();
  const PLATE = scheme?.body ?? 0x4c4a44;
  const TRIM = scheme?.trim ?? BRASS;
  const PANEL = scheme?.tertiary ?? RUST;

  // ---- underframe + axle boxes ---------------------------------------------
  g.add(box(t, [0.48, 0.08, 0.86], IRON_D, [0, 0.015, 0], { tex: 'metal', repeat: [3, 5], metal: 0.24, rough: 0.62 }));
  [-0.3, 0.3].forEach((z) => g.add(box(t, [0.56, 0.06, 0.2], IRON_D, [0, -0.03, z], { tex: 'metal', repeat: [2, 1], metal: 0.24, rough: 0.62 })));

  // ---- the tub: riveted plate with brass hoops and an open dark well -------
  g.add(box(t, [0.54, 0.3, 0.9], PLATE, [0, 0.2, 0], { tex: 'metal', repeat: [3, 2], metal: 0.26, rough: 0.6 }));
  [-0.47, 0.47].forEach((z) => g.add(box(t, [0.5, 0.28, 0.04], PANEL, [0, 0.21, z], { tex: 'metal', repeat: [2, 2], metal: 0.22, rough: 0.66 })));
  g.add(box(t, [0.46, 0.16, 0.82], SOOT, [0, 0.3, 0], { rough: 0.95 })); // interior well, floor at 0.38
  [-0.24, 0.24].forEach((z) => g.add(box(t, [0.58, 0.05, 0.05], TRIM, [0, 0.28, z], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.44 }))); // hoops
  [-0.28, 0.28].forEach((x) => g.add(box(t, [0.05, 0.045, 0.92], TRIM, [x, 0.37, 0], { tex: 'metal', repeat: [1, 5], metal: 0.3, rough: 0.44 }))); // top rails
  const rivets: MergedBoxSpec[] = [];
  for (let i = 0; i < 7; i += 1) {
    const z = -0.36 + i * 0.12;
    [-1, 1].forEach((s) => rivets.push({ dims: [0.014, 0.016, 0.016], pos: [s * 0.276, 0.325, z] }));
  }
  const rivetMesh = mergedBoxes(t, rivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.44 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  g.add(rivetMesh);

  // ---- two in-line bench seats --------------------------------------------
  GEARWORKS_CAR_SEATS.forEach(({ z }, i) => {
    g.add(box(t, [0.4, 0.07, 0.3], LEATHER, [0, 0.4, z + 0.01], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // cushion top 0.435
    g.add(box(t, [0.4, 0.22, 0.05], LEATHER, [0, 0.49, z - 0.17], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back pad
    g.add(cyl(t, 0.016, 0.016, 0.42, TRIM, [0, 0.47, z + 0.15], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.4, seg: 10, rotZ: Math.PI / 2 })); // grab bar
    if (opts.riders === false) return;
    const p = buildPeep(t, {
      skin: SKIN_TONES[(i * 3 + 2) % SKIN_TONES.length],
      shirt: SHIRTS[[5, 9][i % 2] % SHIRTS.length],
      trousers: 0x37312a,
      seated: true,
      expression: i === 0 ? 'surprised' : 'happy',
    });
    p.group.scale.setScalar(0.5);
    p.group.position.set(0, 0.195, z);
    p.group.userData.lodDetail = true; // park runtime sheds riders beyond NEAR
    g.add(p.group);
  });

  // ---- per-variant dressing ------------------------------------------------
  if (variant === 'front') {
    // the brass boiler nose, its little stack, and a hooded headlamp
    g.add(cyl(t, 0.1, 0.1, 0.2, TRIM, [0, 0.24, 0.55], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.46, seg: 14, rotX: Math.PI / 2 }));
    g.add(cyl(t, 0.105, 0.105, 0.03, BRASS_L, [0, 0.24, 0.65], { tex: 'metal', repeat: [4, 1], metal: 0.32, rough: 0.36, seg: 14, rotX: Math.PI / 2 })); // smokebox ring
    g.add(cyl(t, 0.032, 0.04, 0.14, COPPER, [0, 0.38, 0.5], { tex: 'metal', repeat: [2, 1], metal: 0.24, rough: 0.56, seg: 10 })); // stack
    g.add(box(t, [0.13, 0.12, 0.1], IRON_D, [0, 0.45, 0.6], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.55 })); // lamp housing
    g.add(box(t, [0.17, 0.03, 0.14], IRON_D, [0, 0.52, 0.61], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.55 })); // hood
    const glass = ball(t, 0.048, LAMP_GLASS, [0, 0.45, 0.66], { emissive: LAMP_GLOW, rough: 0.32 });
    (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    g.add(glass);
    const headlamp = new t.PointLight(LAMP_GLOW, 0, 3.0, 2);
    headlamp.position.set(0, 0.46, 0.85);
    g.add(headlamp);
    g.userData.headlamp = headlamp; // gateCarLights (CoasterCar) reads these
    g.userData.headlampMat = glass.material;
  } else {
    g.add(cyl(t, 0.03, 0.03, 0.14, IRON_D, [0, 0.11, 0.53], { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.45, seg: 10, rotX: Math.PI / 2 })); // coupler
  }
  if (variant === 'end') {
    const tail = ball(t, 0.034, 0xd94a3a, [0, 0.4, -0.5], { emissive: 0xff2412, rough: 0.32 });
    (tail.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    g.add(tail);
    g.userData.taillampMat = tail.material;
  }
  g.add(cyl(t, 0.03, 0.03, 0.14, IRON_D, [0, 0.11, -0.53], { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.45, seg: 10, rotX: Math.PI / 2 }));

  // ---- four flanged wheels (bottoms at −0.15) ------------------------------
  [
    [-0.26, 0.3],
    [0.26, 0.3],
    [-0.26, -0.3],
    [0.26, -0.3],
  ].forEach(([x, z]) => {
    g.add(cyl(t, 0.085, 0.085, 0.06, IRON_D, [x, -0.065, z], { tex: 'metal', repeat: [4, 1], metal: 0.28, rough: 0.45, seg: 16, rotZ: Math.PI / 2 }));
    g.add(cyl(t, 0.098, 0.098, 0.016, IRON_D, [x > 0 ? x + 0.034 : x - 0.034, -0.065, z], { metal: 0.28, rough: 0.45, seg: 14, rotZ: Math.PI / 2 }));
  });

  return g;
}

// ===========================================================================
// THE MACHINE PARTS — a spur gear, a belt pulley, a flat belt with a travelling
// splice, and the slider-crank solution every piston on the ride uses.
// ===========================================================================

interface SpurGear {
  group: THREE.Group;
  /** tooth count — the ratio numerator */
  teeth: number;
  /** pitch radius: axle distance between two meshing gears = the sum of these */
  pitchR: number;
}

/**
 * One cast spur gear, lying in its own XY plane and turning about local +Z.
 * A gear reads by its TEETH, so the teeth are the piece: N of them, tangential
 * width 0.46 of the circular pitch (the rest is backlash, which is what makes
 * the mesh read), straddling the pitch circle, with a few hashed teeth worn
 * round. Rim segments + teeth + spokes are ONE merged mesh — a single draw call
 * that still rotates.
 *
 * MESHING RULE: two gears mesh iff they share the CIRCULAR PITCH `pitch` and
 * their axles are `a.pitchR + b.pitchR` apart. Nothing else has to line up —
 * the phase is solved per frame (see `gearChain`).
 */
function spurGear(
  t: typeof THREE,
  o: { teeth: number; pitch: number; thick?: number; colour?: number; spokes?: number; seed?: number },
): SpurGear {
  const N = o.teeth;
  const P = o.pitch;
  const RP = (N * P) / (2 * Math.PI);
  const TH = P * 0.52; // radial tooth height, straddling the pitch circle
  const TW = P * 0.46; // tangential tooth width — the rest is backlash
  const W = o.thick ?? Math.max(0.075, P * 0.6);
  const RIM_O = RP - TH * 0.5;
  const RIM_T = Math.max(0.05, RP * 0.19);
  const RIM_C = RIM_O - RIM_T / 2;
  const HUB_R = Math.max(0.05, RP * 0.24);
  const seed = o.seed ?? 1;
  const parts: MergedBoxSpec[] = [];
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    // rim segment: the box's local +x is RADIAL (rotZ = a), so its dims read
    // [radial thickness, tangential chord, axial width]
    const chord = 2 * RIM_C * Math.tan(Math.PI / N) * 1.06; // a hair of overlap keeps the ring closed
    parts.push({ dims: [RIM_T, chord, W], pos: [Math.cos(a) * RIM_C, Math.sin(a) * RIM_C, 0], rotZ: a });
    const wear = hash01(i * 3.7 + seed * 1.9);
    const th = wear > 0.9 ? TH * 0.68 : TH; // ~2 teeth in 20 worn round
    parts.push({ dims: [th, TW, W * 0.94], pos: [Math.cos(a) * (RIM_O + th * 0.5), Math.sin(a) * (RIM_O + th * 0.5), 0], rotZ: a });
  }
  const S = o.spokes ?? (RP > 0.42 ? 6 : 0);
  for (let i = 0; i < S; i += 1) {
    const a = (i / S) * Math.PI * 2 + 0.13;
    const inner = HUB_R * 0.8;
    const len = RIM_O - RIM_T - inner;
    parts.push({ dims: [len, W * 0.44, W * 0.5], pos: [Math.cos(a) * (inner + len / 2), Math.sin(a) * (inner + len / 2), 0], rotZ: a });
  }
  const g = new t.Group();
  g.add(mergedBoxes(t, parts, o.colour ?? IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.62, bump: 0.03 }));
  if (S === 0) {
    // a small pinion is a solid little cast disc, not a spoked wheel
    g.add(cyl(t, RIM_O - RIM_T * 0.35, RIM_O - RIM_T * 0.35, W * 0.8, o.colour ?? IRON_P, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.26, rough: 0.64, seg: 16, rotX: Math.PI / 2 }));
  }
  g.add(cyl(t, HUB_R, HUB_R, W * 1.8, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.46, seg: 12, rotX: Math.PI / 2 })); // bearing boss
  return { group: g, teeth: N, pitchR: RP };
}

/** a flat-belt pulley on its own axle, turning about local +Z. The keys across
 *  the face are not decoration — a plain disc turning about its own axis reads
 *  as a STATIC disc, and the keys are what make the rotation visible. */
function pulley(t: typeof THREE, r: number, w: number, colour = IRON_P): THREE.Group {
  const g = new t.Group();
  g.add(cyl(t, r, r, w, colour, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.28, rough: 0.55, seg: 16, rotX: Math.PI / 2 }));
  [-1, 1].forEach((s) => g.add(cyl(t, r * 1.07, r * 1.07, w * 0.16, colour, [0, 0, s * w * 0.5], { tex: 'metal', repeat: [3, 1], metal: 0.28, rough: 0.55, seg: 16, rotX: Math.PI / 2 })));
  g.add(cyl(t, r * 0.32, r * 0.32, w * 1.7, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.46, seg: 10, rotX: Math.PI / 2 }));
  for (let i = 0; i < 3; i += 1) {
    const key = box(t, [r * 1.5, r * 0.14, w * 0.4], IRON_D, [0, 0, w * 0.56], { tex: 'metal', repeat: [2, 1], metal: 0.24, rough: 0.6, rotZ: (i / 3) * Math.PI });
    key.userData.lodDetail = true;
    g.add(key);
  }
  return g;
}

/**
 * A FLAT LEATHER BELT between two pulleys in the same plane: the two straight
 * runs (each leaving one rim and landing on the other, so neither strap cuts
 * through a hub — the GoggleWorks lesson) plus the ONE LACED SPLICE in the
 * belt, which travels round the loop at the belt's real linear speed. That
 * travelling splice is the whole reason a belt reads as RUNNING: the straps
 * themselves cannot move, and scrolling a texture offset is not available here
 * because Stage's canvas textures are globally cached and shared.
 *
 * `omega` is the DRIVING pulley's angular speed (about +z); an open belt keeps
 * both pulleys turning the same way, and the splice runs with them.
 */
function beltDrive(
  t: typeof THREE,
  host: THREE.Group,
  o: { a: [number, number]; ra: number; b: [number, number]; rb: number; z: number; width?: number; omega: number },
): (time: number) => void {
  const W = o.width ?? 0.07;
  const [ax, ay] = o.a;
  const [bx, by] = o.b;
  const L = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  const nx = -uy; // left normal of A → B
  const ny = ux;
  const A = { x: ax, y: ay };
  const B = { x: bx, y: by };
  // the two straps
  (
    [
      [
        [ax + nx * o.ra, ay + ny * o.ra],
        [bx + nx * o.rb, by + ny * o.rb],
      ],
      [
        [bx - nx * o.rb, by - ny * o.rb],
        [ax - nx * o.ra, ay - ny * o.ra],
      ],
    ] as [number, number][][]
  ).forEach(([p1, p2]) => {
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    host.add(
      box(t, [len, W, 0.045], LEATHER_D, [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, o.z], {
        tex: 'fabric',
        repeat: [Math.max(2, Math.round(len * 5)), 1],
        rough: 0.92,
        rotZ: Math.atan2(p2[1] - p1[1], p2[0] - p1[0]),
      }),
    );
  });
  // the laced splice — a brass-stitched joint, and it goes round
  const splice = new t.Group();
  splice.position.z = o.z;
  splice.add(box(t, [0.05, W * 1.4, 0.056], BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.46 }));
  host.add(splice);
  // the closed path, traversed in the direction a POSITIVE omega drives it:
  // upper strap B → A, round A the outer way, lower strap A → B, round B
  const per = 2 * L + Math.PI * o.ra + Math.PI * o.rb;
  const s1 = L;
  const s2 = s1 + Math.PI * o.ra;
  const s3 = s2 + L;
  const pathAt = (s: number): [number, number] => {
    if (s < s1) {
      const f = s / L;
      return [B.x + nx * o.rb + (A.x + nx * o.ra - (B.x + nx * o.rb)) * f, B.y + ny * o.rb + (A.y + ny * o.ra - (B.y + ny * o.rb)) * f];
    }
    if (s < s2) {
      const phi = (s - s1) / o.ra; // 0 → π, from +n round the far side to −n
      return [A.x + o.ra * (nx * Math.cos(phi) - ux * Math.sin(phi)), A.y + o.ra * (ny * Math.cos(phi) - uy * Math.sin(phi))];
    }
    if (s < s3) {
      const f = (s - s2) / L;
      return [A.x - nx * o.ra + (B.x - nx * o.rb - (A.x - nx * o.ra)) * f, A.y - ny * o.ra + (B.y - ny * o.rb - (A.y - ny * o.ra)) * f];
    }
    const phi = (s - s3) / o.rb;
    return [B.x + o.rb * (-nx * Math.cos(phi) + ux * Math.sin(phi)), B.y + o.rb * (-ny * Math.cos(phi) + uy * Math.sin(phi))];
  };
  const v = Math.abs(o.omega) * o.ra; // belt linear speed
  const back = o.omega < 0;
  return (time: number) => {
    let s = (v * time) % per;
    if (back) s = per - s;
    const p = pathAt(s);
    const q = pathAt((s + 0.04) % per);
    splice.position.x = p[0];
    splice.position.y = p[1];
    splice.rotation.z = Math.atan2(q[1] - p[1], q[0] - p[0]);
  };
}

/** the exact slider-crank solution: a RIGID rod of length `rod` from the crank
 *  pin to a crosshead constrained to the cylinder axis through the crank centre.
 *  `axis` is the axis the crosshead slides along; the returned `head` is its
 *  coordinate on that axis and `rodAngle` orients the rod (its long axis is +x).
 *  Used by the gallery's horizontal cylinder and all three engine-bay pistons —
 *  a piston animated by a bare sine slides, but the ROD does not swing, and the
 *  swing is what says reciprocating. */
function crankSlider(cx: number, cy: number, r: number, rod: number, theta: number, axis: 'x' | 'y') {
  const px = cx + r * Math.cos(theta);
  const py = cy + r * Math.sin(theta);
  let hx: number;
  let hy: number;
  if (axis === 'x') {
    const off = py - cy;
    hx = px + Math.sqrt(Math.max(0.0001, rod * rod - off * off));
    hy = cy;
  } else {
    const off = px - cx;
    hx = cx;
    hy = py + Math.sqrt(Math.max(0.0001, rod * rod - off * off));
  }
  return { pin: [px, py] as [number, number], head: [hx, hy] as [number, number], rodAngle: Math.atan2(hy - py, hx - px) };
}

/** a small rusted iron plinth/apron of clinker under a machine bay */
function sootApron(t: typeof THREE, w: number, d: number, pos: [number, number, number]): THREE.Mesh {
  const m = box(t, [w, 0.03, d], CINDER, pos, { tex: 'concrete', repeat: [Math.round(w * 2), Math.round(d * 2)], rough: 1, bump: 0.05 });
  m.receiveShadow = true;
  return m;
}

export interface GearworksExpressOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Gear Gallery circuit. Compiled with this ride's own rules
   *  (`profile: 'coaster'`, `type: 'steel'`, bank 0.18, heading −90°). */
  pieces?: TrackPiece[];
  /** raw control points `[x, y, z]` — the escape hatch past the piece compiler
   *  (still swept and validated). `pieces` wins. */
  points?: [number, number, number][];
  /** cars in the train (default 3 — 6 seats) */
  cars?: number;
  /** decorative riders (default true; <GearworksExpress register> turns them
   *  OFF so the GameManager's real guests fill the train through seatWorld) */
  riders?: boolean;
  /** terrain sampler so the bays, supports and plant land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the GEAR GALLERY bay (default: auto — the lowest,
   *  straightest, most level stretch away from the station) */
  galleryU?: number;
  /** loop parameter of the ENGINE BAY (default: auto — the highest, straightest,
   *  most level stretch) */
  engineU?: number;
  /** steam / spark emitters (default true) */
  effects?: boolean;
}

export interface GearworksExpressBuilt {
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
 * The whole dark ride: the compiled circuit, the two machine bays placed
 * against it, the boiler plant and gantry at its centroid, a soot-iron station
 * and a 3-car train. `update` is motion-gated (the train parks in the station
 * while guests board — and the whole factory winds down with it), `seatWorld`
 * seats real guests, `vehicle` is the lead car for the RideViewer follow cam.
 */
export function buildGearworksExpressScene(three: typeof THREE, opts: GearworksExpressOpts = {}): GearworksExpressBuilt {
  const t = three;
  const g = new t.Group();
  const extras: {
    vehicle?: THREE.Object3D;
    crashed?: () => boolean;
    invalid?: boolean;
    ratings?: GearworksExpressBuilt['ratings'];
  } = {};
  const seatAnchors: THREE.Object3D[] = [];
  const machines: ((time: number) => void)[] = []; // every moving part
  const lampMats: THREE.MeshStandardMaterial[] = []; // night-gated glass
  const lights: THREE.PointLight[] = []; // night-gated (2)
  const fireMats: THREE.MeshStandardMaterial[] = []; // day-AND-night lerped
  const emitters: Emitter[] = [];
  const carCount = Math.max(1, Math.min(6, opts.cars ?? 3));
  const groundAt = opts.groundAt ?? (() => 0);
  const wantFx = opts.effects !== false;

  // ---- 1. LAYOUT: the shared spline machinery ------------------------------
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
    wood: false, // soot-iron columns: this is a foundry, not a fairground
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
  // the circuit's centroid — the machine bays face IN toward it (that is where
  // the hall is), and the boiler plant stands on it
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;

  // ---- 2. WHERE THE MACHINERY GOES ----------------------------------------
  // Both bays are picked off the compiled spline, so a custom circuit gets
  // them too: the GEAR GALLERY wants the lowest, straightest, most level
  // stretch (the riders are at eye level with the teeth), the ENGINE BAY the
  // highest (the riders pass the piston rods).
  // A machine bay is 3.5-7 units long, so it wants the LONGEST straight run at
  // the right height — not merely the least curved sample. `runAt` walks out
  // both ways from u while the heading holds within 5° and the grade stays flat,
  // and returns the length of that run; the first pass scored instantaneous
  // curvature instead and put the engine frame against the 0.8-unit crest
  // straight between two corners.
  const yawAt = (u: number) => {
    const f = ride.frameAt(u);
    return Math.atan2(f.fwd.x, f.fwd.z);
  };
  const runAt = (u: number) => {
    const y0 = yawAt(u);
    const step = 0.35 / total;
    let back = 0;
    let fwd = 0;
    const dev = (v: number) => Math.abs((((yawAt(v) - y0 + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    for (let k = 1; k <= 30; k += 1) {
      const v = u + k * step;
      if (Math.abs(dev(v)) > 0.09 || Math.abs(ride.frameAt(v).fwd.y) > 0.12) break;
      fwd = k * 0.35;
    }
    for (let k = 1; k <= 30; k += 1) {
      const v = u - k * step;
      if (Math.abs(dev(v)) > 0.09 || Math.abs(ride.frameAt(v).fwd.y) > 0.12) break;
      back = k * 0.35;
    }
    return { run: back + fwd, centred: Math.min(back, fwd) };
  };
  const pickStretch = (want: 'low' | 'high', skip?: number) => {
    let best = want === 'low' ? 0.6 : 0.3;
    let bestScore = Infinity;
    for (let i = 0; i < 200; i += 1) {
      const u = i / 200;
      if (u < 0.12 || u > 0.86) continue; // never over the station or the brake tail
      if (skip !== undefined && Math.abs(u - skip) < 0.12) continue;
      const f = ride.frameAt(u);
      const h = f.p.y - groundAt(f.p.x, f.p.z);
      const r = runAt(u);
      // a long, level, well-centred run at the wanted height
      const score = -r.run * 3 - r.centred * 2 + Math.abs(f.fwd.y) * 14 + (want === 'low' ? h * 1.4 : -h * 2.2);
      if (score < bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return best;
  };
  const galleryU = opts.galleryU ?? pickStretch('low');
  const engineU = opts.engineU ?? pickStretch('high', galleryU);

  /** a machine bay's frame: `off` units to the side of the rail that faces the
   *  circuit's interior, with local +z pointing AWAY from the track (so a gear
   *  plane at local z is parallel to the rails and its FACE looks at the
   *  riders) and local +x running along the track. Heights are world y. */
  const bayFrame = (u: number, off: number) => {
    const f = ride.frameAt(u);
    const sl = Math.hypot(f.side.x, f.side.z) || 1;
    const inward = (cx - f.p.x) * (f.side.x / sl) + (cz - f.p.z) * (f.side.z / sl) >= 0 ? 1 : -1;
    const nx = (f.side.x / sl) * inward;
    const nz = (f.side.z / sl) * inward;
    const grp = new t.Group();
    grp.position.set(f.p.x + nx * off, 0, f.p.z + nz * off);
    grp.rotation.y = Math.atan2(nx, nz);
    g.add(grp);
    // component-local pose of the bay, for harness/agent introspection and for
    // authors framing a shot on the machinery
    return { grp, railY: f.p.y, yaw: yawOf(f) };
  };
  /** a bay-local point in COMPONENT-local coordinates (emitters live on `g`) */
  const toLocal = (grp: THREE.Group, x: number, y: number, z: number): [number, number, number] => {
    const c = Math.cos(grp.rotation.y);
    const s = Math.sin(grp.rotation.y);
    return [grp.position.x + x * c + z * s, grp.position.y + y, grp.position.z - x * s + z * c];
  };

  // =========================================================================
  // 3. THE GEAR GALLERY — the show. A four-gear train, a flywheel, a steam
  //    cylinder on a real slider-crank, and the line shaft that drives them.
  //    Bay-local: +x along the rails, +z away from them, y = world height.
  // =========================================================================
  const sparkAt: [number, number, number][] = [];
  {
    const bay = bayFrame(galleryU, 1.25);
    const G = bay.grp;
    const RY = bay.railY;
    g.userData.gallery = { u: galleryU, at: [G.position.x, RY, G.position.z], yaw: G.rotation.y };
    const GZ = -0.3; // the GEAR PLANE: 0.95 clear of the rail centreline
    const SZ = 0.06; // the SHAFT plane, 0.36 behind the gears
    G.add(sootApron(t, 7.6, 1.9, [-0.1, 0.015, 0.25]));

    // ---- the bed and the pedestals ---------------------------------------
    const frame: MergedBoxSpec[] = [];
    frame.push({ dims: [7.2, 0.16, 0.5], pos: [-0.1, RY - 0.42, GZ + 0.16], repeat: [8, 1] }); // bed casting
    [-3.45, -1.1, 1.3, 3.35].forEach((x) => {
      frame.push({ dims: [0.3, RY + 1.9, 0.3], pos: [x, (RY + 1.9) / 2, SZ + 0.12], repeat: [1, 6] }); // hall columns
      frame.push({ dims: [0.52, 0.08, 0.52], pos: [x, 0.04, SZ + 0.12] }); // base plate
      frame.push({ dims: [0.42, 0.18, 0.42], pos: [x, RY + 1.86, SZ + 0.12] }); // shaft-bearing block
    });
    // knee braces under the shaft bearings — cast iron is always webbed
    [-3.45, -1.1, 1.3, 3.35].forEach((x) =>
      [-1, 1].forEach((s) => frame.push({ dims: [0.5, 0.06, 0.12], pos: [x + s * 0.26, RY + 1.6, SZ + 0.12], rotZ: s * 0.6 })),
    );
    G.add(mergedBoxes(t, frame, IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.7, bump: 0.035 }));

    // ---- the GEAR TRAIN: four wheels on ONE circular pitch ---------------
    // Axle distance = the sum of the pitch radii, so the teeth engage; the
    // phase of every wheel after the first is SOLVED from its neighbour's live
    // angle each frame, so the interleave holds forever:
    //   φB = θ + π + π/Nb − (Na/Nb)·(φA − θ)
    // where θ is the line of centres A → B. Differentiate it and you get the
    // gear law ωB = −(Na/Nb)·ωA for free.
    const PITCH = 0.2;
    const chain = [
      { teeth: 22, dir: 0, colour: IRON_P },
      { teeth: 11, dir: -0.34, colour: RUST },
      { teeth: 16, dir: 0.55, colour: IRON_P },
      { teeth: 9, dir: -0.2, colour: BRASS },
    ];
    const gears: { gear: SpurGear; at: [number, number]; theta: number }[] = [];
    let gx = -2.75;
    let gy = RY + 0.62;
    chain.forEach((c, i) => {
      const gear = spurGear(t, { teeth: c.teeth, pitch: PITCH, colour: c.colour, seed: 3 + i * 2 });
      if (i > 0) {
        const prev = gears[i - 1];
        const dist = prev.gear.pitchR + gear.pitchR;
        gx = prev.at[0] + Math.cos(c.dir) * dist;
        gy = prev.at[1] + Math.sin(c.dir) * dist;
      }
      gear.group.position.set(gx, gy, GZ);
      G.add(gear.group);
      gears.push({ gear, at: [gx, gy], theta: c.dir });
      // the pedestal carrying this axle, standing BEHIND the gear plane so it
      // never hides the spokes, plus a brass bearing cap and grease cup
      const ped: MergedBoxSpec[] = [];
      const legH = gy - 0.06;
      ped.push({ dims: [0.3, legH, 0.34], pos: [gx, legH / 2, GZ + 0.34], repeat: [1, 3] });
      ped.push({ dims: [0.5, 0.09, 0.5], pos: [gx, 0.045, GZ + 0.34] });
      ped.push({ dims: [0.32, 0.24, 0.4], pos: [gx, gy, GZ + 0.3] });
      G.add(mergedBoxes(t, ped, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.7, bump: 0.03 }));
      G.add(cyl(t, 0.045, 0.045, 0.62, IRON_P, [gx, gy, GZ + 0.2], { tex: 'metal', repeat: [2, 2], metal: 0.28, rough: 0.5, seg: 10, rotX: Math.PI / 2 })); // the axle
      G.add(cyl(t, 0.036, 0.03, 0.07, BRASS_L, [gx, gy + 0.15, GZ + 0.3], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.38, seg: 8 })); // grease cup
    });
    // the mesh point between the first two wheels is where the sparks come off
    {
      const a = gears[0];
      const b = gears[1];
      const th = b.theta;
      sparkAt.push(toLocal(G, a.at[0] + Math.cos(th) * a.gear.pitchR, a.at[1] + Math.sin(th) * a.gear.pitchR, GZ + 0.05));
    }

    // ---- the FLYWHEEL and the steam cylinder it drives -------------------
    const FLY = { x: 0.95, y: RY + 0.8, r: 0.72 };
    const fly = new t.Group();
    fly.position.set(FLY.x, FLY.y, SZ - 0.04);
    G.add(fly);
    {
      // a heavy rim on six spokes — no teeth: a flywheel stores momentum, and
      // it is the belt pulley for the whole gallery
      const rim: MergedBoxSpec[] = [];
      const N = 20;
      for (let i = 0; i < N; i += 1) {
        const a = (i / N) * Math.PI * 2;
        const chord = 2 * (FLY.r - 0.06) * Math.tan(Math.PI / N) * 1.06;
        rim.push({ dims: [0.12, chord, 0.15], pos: [Math.cos(a) * (FLY.r - 0.06), Math.sin(a) * (FLY.r - 0.06), 0], rotZ: a });
      }
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.2;
        const len = FLY.r - 0.18;
        rim.push({ dims: [len, 0.075, 0.08], pos: [Math.cos(a) * (0.1 + len / 2), Math.sin(a) * (0.1 + len / 2), 0], rotZ: a });
      }
      fly.add(mergedBoxes(t, rim, IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.62, bump: 0.03 }));
      fly.add(cyl(t, 0.14, 0.14, 0.3, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.46, seg: 12, rotX: Math.PI / 2 })); // boss
      const rust: MergedBoxSpec[] = [];
      for (let i = 0; i < 8; i += 1) {
        const a = hash01(i * 5.7 + 11) * Math.PI * 2;
        const s = 0.05 + hash01(i * 9.3) * 0.06;
        rust.push({ dims: [s, s * 1.6, 0.006], pos: [Math.cos(a) * (FLY.r - 0.07), Math.sin(a) * (FLY.r - 0.07), 0.08], rotZ: a });
      }
      const rustMesh = mergedBoxes(t, rust, RUST, { tex: 'concrete', repeat: [1, 1], rough: 0.95, bump: 0.03 });
      rustMesh.userData.lodDetail = true;
      fly.add(rustMesh);
    }
    // the flywheel's own pedestal + axle
    G.add(
      mergedBoxes(
        t,
        [
          { dims: [0.34, FLY.y - 0.06, 0.36], pos: [FLY.x, (FLY.y - 0.06) / 2, SZ + 0.28], repeat: [1, 4] },
          { dims: [0.56, 0.09, 0.56], pos: [FLY.x, 0.045, SZ + 0.28] },
          { dims: [0.36, 0.26, 0.42], pos: [FLY.x, FLY.y, SZ + 0.26] },
        ],
        IRON,
        { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.7, bump: 0.03 },
      ),
    );
    // THE CYLINDER: crank r 0.42 on the flywheel, a RIGID rod 1.0 long, and the
    // crosshead sliding on the cylinder axis (stroke 0.84, so the guides run
    // 1.4 → 2.42 and the rod enters the gland at 2.44)
    const CR = 0.42;
    const ROD = 1.0;
    const GLAND = 2.46;
    const crankPin = new t.Group();
    fly.add(crankPin);
    crankPin.add(cyl(t, 0.05, 0.05, 0.16, BRASS_L, [CR, 0, 0.14], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.4, seg: 10, rotX: Math.PI / 2 }));
    crankPin.add(box(t, [CR * 0.9, 0.12, 0.09], IRON_P, [CR * 0.55, 0, 0.14], { tex: 'metal', repeat: [3, 1], metal: 0.28, rough: 0.55 })); // crank web
    const conrod = box(t, [ROD, 0.075, 0.075], IRON_P, [0, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.28, rough: 0.52 });
    const conrodG = new t.Group();
    conrodG.position.z = SZ + 0.1;
    conrodG.add(conrod);
    conrod.position.x = ROD / 2; // the rod pivots on the crank PIN
    G.add(conrodG);
    const crosshead = new t.Group();
    crosshead.position.set(0, FLY.y, SZ + 0.1);
    crosshead.add(box(t, [0.14, 0.2, 0.16], IRON_D, [0, 0, 0], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.55 }));
    G.add(crosshead);
    const pistonRod = cyl(t, 0.035, 0.035, 1, BRASS_L, [0, 0, 0], { tex: 'metal', repeat: [1, 4], metal: 0.32, rough: 0.34, seg: 8, rotZ: Math.PI / 2 });
    const pistonRodG = new t.Group();
    pistonRodG.position.set(0, FLY.y, SZ + 0.1);
    pistonRodG.add(pistonRod);
    G.add(pistonRodG);
    // guides, the gland, the cylinder barrel with its lagging bands and end caps
    G.add(
      mergedBoxes(
        t,
        [
          { dims: [1.1, 0.05, 0.14], pos: [1.9, FLY.y + 0.16, SZ + 0.1], repeat: [4, 1] },
          { dims: [1.1, 0.05, 0.14], pos: [1.9, FLY.y - 0.16, SZ + 0.1], repeat: [4, 1] },
          { dims: [0.16, 0.5, 0.4], pos: [GLAND, FLY.y, SZ + 0.1] },
          { dims: [0.34, FLY.y - 0.06, 0.36], pos: [3.0, (FLY.y - 0.06) / 2, SZ + 0.16], repeat: [1, 4] },
          { dims: [0.5, 0.09, 0.5], pos: [3.0, 0.045, SZ + 0.16] },
        ],
        IRON,
        { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.7, bump: 0.03 },
      ),
    );
    G.add(cyl(t, 0.2, 0.2, 0.72, IRON_P, [2.92, FLY.y, SZ + 0.1], { tex: 'metal', repeat: [4, 2], metal: 0.28, rough: 0.6, seg: 16, rotZ: Math.PI / 2 })); // barrel
    [2.66, 2.92, 3.18].forEach((x) => G.add(cyl(t, 0.215, 0.215, 0.06, BRASS, [x, FLY.y, SZ + 0.1], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.44, seg: 16, rotZ: Math.PI / 2 }))); // lagging bands
    G.add(cyl(t, 0.22, 0.19, 0.08, IRON_D, [3.32, FLY.y, SZ + 0.1], { tex: 'metal', repeat: [4, 1], metal: 0.26, rough: 0.6, seg: 16, rotZ: Math.PI / 2 })); // head
    G.add(cyl(t, 0.05, 0.05, 0.34, COPPER, [2.92, FLY.y + 0.3, SZ + 0.1], { tex: 'metal', repeat: [1, 2], metal: 0.24, rough: 0.58, seg: 8 })); // steam pipe
    G.add(cyl(t, 0.05, 0.05, 0.5, COPPER, [2.92, FLY.y + 0.5, SZ + 0.1], { tex: 'metal', repeat: [1, 3], metal: 0.24, rough: 0.58, seg: 8, rotZ: Math.PI / 2 }));

    // ---- the LINE SHAFT and its belts ------------------------------------
    const SHY = RY + 1.8;
    G.add(cyl(t, 0.05, 0.05, 7.0, IRON_P, [-0.1, SHY, SZ + 0.12], { tex: 'metal', repeat: [1, 12], metal: 0.28, rough: 0.5, seg: 10, rotZ: Math.PI / 2 }));
    const pulleyA = pulley(t, 0.5, 0.14); // driven off the flywheel
    pulleyA.position.set(-0.2, SHY, SZ + 0.12);
    G.add(pulleyA);
    const pulleyB = pulley(t, 0.16, 0.12); // drives the gear train
    pulleyB.position.set(-2.75, SHY, SZ + 0.12);
    G.add(pulleyB);
    const pulleyC = pulley(t, 0.34, 0.12, BRASS_D); // on the first gear's axle
    pulleyC.position.set(gears[0].at[0], gears[0].at[1], SZ + 0.12);
    G.add(pulleyC);
    // the pace of the whole gallery: 1.25 rad/s at the flywheel is a 5 s
    // revolution — a big low-speed mill engine, and a 5 s piston stroke reads
    // as a deliberate chuff rather than a sewing machine. Everything else is
    // GEARED off it, so no two parts can drift.
    const OM_FLY = 1.25;
    const OM_SHAFT = (OM_FLY * FLY.r) / 0.5; // open belt: same sense, 1.80
    const OM_G1 = (OM_SHAFT * 0.16) / 0.34; // 0.85 → an 7.4 s revolution
    const beltFly = beltDrive(t, G, { a: [FLY.x, FLY.y], ra: FLY.r, b: [-0.2, SHY], rb: 0.5, z: SZ + 0.12, width: 0.1, omega: OM_FLY });
    const beltGear = beltDrive(t, G, { a: [-2.75, SHY], ra: 0.16, b: [gears[0].at[0], gears[0].at[1]], rb: 0.34, z: SZ + 0.12, width: 0.075, omega: OM_SHAFT });

    // ---- the gallery gaslight, on a bracket off the middle column --------
    const lampG = new t.Group();
    lampG.position.set(-1.1, RY + 1.2, SZ - 0.05);
    G.add(lampG);
    lampG.add(cyl(t, 0.02, 0.02, 0.34, BRASS, [0, 0.06, -0.16], { tex: 'metal', repeat: [1, 2], metal: 0.3, rough: 0.44, seg: 8, rotX: Math.PI / 2 }));
    lampG.add(cyl(t, 0.055, 0.07, 0.04, BRASS_D, [0, 0.09, -0.32], { tex: 'metal', repeat: [2, 1], metal: 0.28, rough: 0.48, seg: 10 }));
    const gGlass = ball(t, 0.06, LAMP_GLASS, [0, 0.03, -0.32], { emissive: LAMP_GLOW, rough: 0.34 });
    (gGlass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
    lampG.add(gGlass);
    lampMats.push(gGlass.material as THREE.MeshStandardMaterial);
    const gLight = new t.PointLight(LAMP_GLOW, 0, 5.4, 2);
    gLight.position.set(-1.1, RY + 1.1, SZ - 0.42);
    G.add(gLight);
    lights.push(gLight);

    // ---- three live pressure gauges on the bed, facing the riders --------
    const needles: THREE.Mesh[] = [];
    [-2.2, -1.7, -1.2].forEach((x, i) => {
      const r = i === 1 ? 0.11 : 0.085;
      G.add(cyl(t, r, r, 0.05, BRASS, [x, RY - 0.42, GZ - 0.12], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.42, seg: 14, rotX: Math.PI / 2 }));
      G.add(cyl(t, r * 0.86, r * 0.86, 0.012, DIAL, [x, RY - 0.42, GZ - 0.15], { rough: 0.75, seg: 14, rotX: Math.PI / 2 }));
      const needle = box(t, [0.01, r * 0.76, 0.008], NEEDLE, [x, RY - 0.42, GZ - 0.16], { rough: 0.6 });
      needle.geometry = needle.geometry.clone();
      needle.geometry.translate(0, r * 0.32, 0); // pivot at the dial centre
      needle.userData.lodDetail = true;
      G.add(needle);
      needles.push(needle);
    });

    machines.push((time: number) => {
      // 1. THE GEAR TRAIN — the first wheel turns, and every other wheel's
      //    phase is solved from its neighbour so the teeth stay interleaved
      let phi = OM_G1 * time;
      gears[0].gear.group.rotation.z = phi;
      for (let i = 1; i < gears.length; i += 1) {
        const th = gears[i].theta;
        const ratio = gears[i - 1].gear.teeth / gears[i].gear.teeth;
        phi = th + Math.PI + Math.PI / gears[i].gear.teeth - ratio * (phi - th);
        gears[i].gear.group.rotation.z = phi;
      }
      // 2. THE FLYWHEEL, its crank pin and the slider-crank it drives
      const th = OM_FLY * time;
      fly.rotation.z = th;
      const sc = crankSlider(FLY.x, FLY.y, CR, ROD, th, 'x');
      conrodG.position.set(sc.pin[0], sc.pin[1], SZ + 0.1);
      conrodG.rotation.z = sc.rodAngle;
      crosshead.position.x = sc.head[0];
      const rodLen = Math.max(0.05, GLAND + 0.2 - sc.head[0]);
      pistonRod.scale.y = rodLen; // the rod slides INTO the gland — correct, and free
      pistonRodG.position.x = sc.head[0] + rodLen / 2;
      // 3. the line shaft, its pulleys and the belts' travelling splices
      pulleyA.rotation.z = OM_SHAFT * time;
      pulleyB.rotation.z = OM_SHAFT * time;
      pulleyC.rotation.z = OM_G1 * time;
      beltFly(time);
      beltGear(time);
      // 4. the gauges: three pressures drifting at their own rates
      needles.forEach((n, i) => {
        n.rotation.z = -(-1.4 + 1.1 * Math.sin(time * (0.33 + i * 0.17) + i * 1.9) + 0.14 * Math.sin(time * 2.1 + i));
      });
    });
  }

  // =========================================================================
  // 4. THE ENGINE BAY — three vertical pistons on a three-throw crankshaft at
  //    120°, standing beside the ELEVATED leg so the riders go past at rod
  //    height with the cylinders chuffing right next to them.
  // =========================================================================
  const puffAt: [number, number, number][] = [];
  {
    const bay = bayFrame(engineU, 1.6);
    const E = bay.grp;
    const RY = bay.railY;
    g.userData.engine = { u: engineU, at: [E.position.x, RY, E.position.z], yaw: E.rotation.y };
    const MZ = -0.28; // the engine plane: 1.32 clear of the rail centreline
    E.add(sootApron(t, 4.2, 2.0, [0, 0.015, 0.2]));
    const CRY = RY - 0.25; // crankshaft height
    const CR = 0.2; // throw
    const ROD = 0.62;
    const BORE = [-0.95, 0, 0.95]; // the three cylinder axes

    // the engine house frame: four columns, a top girder, a cross girder
    const frame: MergedBoxSpec[] = [];
    [-1.55, 1.55].forEach((x) =>
      [MZ + 0.02, 0.62].forEach((z) => {
        frame.push({ dims: [0.26, RY + 1.3, 0.26], pos: [x, (RY + 1.3) / 2, z], repeat: [1, 6] });
        frame.push({ dims: [0.46, 0.08, 0.46], pos: [x, 0.04, z] });
      }),
    );
    frame.push({ dims: [3.5, 0.2, 0.26], pos: [0, RY + 1.34, MZ + 0.02], repeat: [6, 1] }); // top girder
    frame.push({ dims: [3.5, 0.2, 0.26], pos: [0, RY + 1.34, 0.62], repeat: [6, 1] });
    [-1.55, 1.55].forEach((x) => frame.push({ dims: [0.22, 0.18, 1.0], pos: [x, RY + 1.34, MZ + 0.32], repeat: [1, 2] })); // cross girders
    frame.push({ dims: [3.3, 0.16, 0.44], pos: [0, CRY - 0.4, MZ + 0.34], repeat: [6, 1] }); // crankshaft bed
    BORE.forEach((x) => {
      // saddle and main bearing both stand BEHIND the engine plane: in front of
      // it they hid the very rods they carry (the first pass put the crank chain
      // 0.24 behind the cylinders and the barrels masked the whole stroke)
      frame.push({ dims: [0.44, 0.2, 0.4], pos: [x, RY + 0.34, MZ + 0.32] }); // cylinder saddle
      frame.push({ dims: [0.34, 0.22, 0.36], pos: [x, CRY, MZ + 0.3] }); // main bearing
    });
    E.add(mergedBoxes(t, frame, IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.7, bump: 0.035 }));
    // the crankshaft itself, and the cylinders above it
    E.add(cyl(t, 0.05, 0.05, 3.4, IRON_P, [0, CRY, MZ], { tex: 'metal', repeat: [1, 8], metal: 0.28, rough: 0.5, seg: 10, rotZ: Math.PI / 2 }));
    const cranks: THREE.Group[] = [];
    const rods: THREE.Group[] = [];
    const heads: THREE.Group[] = [];
    const rodShafts: THREE.Mesh[] = [];
    BORE.forEach((x, i) => {
      // the CYLINDER: an iron barrel with brass lagging bands, a domed head and
      // a copper steam feed off the header running along the girder
      E.add(cyl(t, 0.15, 0.15, 0.56, IRON_P, [x, RY + 0.78, MZ], { tex: 'metal', repeat: [4, 2], metal: 0.28, rough: 0.6, seg: 16 }));
      [RY + 0.6, RY + 0.78, RY + 0.96].forEach((y) => E.add(cyl(t, 0.163, 0.163, 0.05, BRASS, [x, y, MZ], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.44, seg: 16 })));
      E.add(cyl(t, 0.13, 0.16, 0.09, IRON_D, [x, RY + 1.08, MZ], { tex: 'metal', repeat: [4, 1], metal: 0.26, rough: 0.6, seg: 16 })); // head
      E.add(cyl(t, 0.06, 0.06, 0.1, BRASS_L, [x, RY + 1.17, MZ], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.36, seg: 10 })); // relief valve
      E.add(cyl(t, 0.16, 0.15, 0.08, IRON_D, [x, RY + 0.48, MZ], { tex: 'metal', repeat: [4, 1], metal: 0.26, rough: 0.6, seg: 16 })); // gland
      E.add(cyl(t, 0.042, 0.042, 0.36, COPPER, [x, RY + 1.22, MZ + 0.1], { tex: 'metal', repeat: [1, 2], metal: 0.24, rough: 0.58, seg: 8, rotX: 0.5 }));
      puffAt.push(toLocal(E, x, RY + 1.24, MZ));
      // the crank throw, the connecting rod and the crosshead
      const crank = new t.Group();
      crank.position.set(x, CRY, MZ); // the crank, the rod and the bore share ONE plane
      E.add(crank);
      crank.add(box(t, [CR * 1.1, 0.14, 0.1], IRON_P, [CR * 0.5, 0, -0.02], { tex: 'metal', repeat: [2, 1], metal: 0.28, rough: 0.55 }));
      crank.add(cyl(t, 0.045, 0.045, 0.16, BRASS_L, [CR, 0, 0.04], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.4, seg: 10, rotX: Math.PI / 2 }));
      cranks.push(crank);
      const rodG = new t.Group();
      const rod = box(t, [ROD, 0.06, 0.06], IRON_P, [ROD / 2, 0, 0], { tex: 'metal', repeat: [5, 1], metal: 0.28, rough: 0.52 });
      rodG.add(rod);
      rodG.position.z = MZ + 0.04;
      E.add(rodG);
      rods.push(rodG);
      const head = new t.Group();
      head.position.set(x, CRY + ROD, MZ + 0.04);
      head.add(box(t, [0.16, 0.1, 0.14], IRON_D, [0, 0, 0], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.55 }));
      E.add(head);
      heads.push(head);
      const shaftG = new t.Group();
      shaftG.position.set(x, CRY, MZ);
      const shaft = cyl(t, 0.028, 0.028, 1, BRASS_L, [0, 0, 0], { tex: 'metal', repeat: [1, 4], metal: 0.32, rough: 0.34, seg: 8 });
      shaftG.add(shaft);
      E.add(shaftG);
      rodShafts.push(shaft);
    });
    // the bay's own flywheel on the end of the crankshaft — and a bank of
    // rivets down the girder, because that is what says wrought iron
    const eFly = new t.Group();
    eFly.position.set(1.9, CRY, MZ - 0.02);
    E.add(eFly);
    {
      const rim: MergedBoxSpec[] = [];
      const R = 0.46;
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        const chord = 2 * (R - 0.05) * Math.tan(Math.PI / 16) * 1.06;
        rim.push({ dims: [0.1, chord, 0.12], pos: [Math.cos(a) * (R - 0.05), Math.sin(a) * (R - 0.05), 0], rotZ: a });
      }
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        rim.push({ dims: [R - 0.14, 0.06, 0.07], pos: [Math.cos(a) * (0.08 + (R - 0.14) / 2), Math.sin(a) * (0.08 + (R - 0.14) / 2), 0], rotZ: a });
      }
      eFly.add(mergedBoxes(t, rim, IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.62, bump: 0.03 }));
      eFly.add(cyl(t, 0.1, 0.1, 0.22, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.46, seg: 12, rotX: Math.PI / 2 }));
    }
    const girderRivets: MergedBoxSpec[] = [];
    for (let i = 0; i < 16; i += 1) {
      const x = -1.5 + i * 0.2;
      girderRivets.push({ dims: [0.02, 0.02, 0.016], pos: [x, RY + 1.34, MZ - 0.12] });
      girderRivets.push({ dims: [0.02, 0.02, 0.016], pos: [x, CRY - 0.4, MZ - 0.17] });
    }
    const girderRivetMesh = mergedBoxes(t, girderRivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.45 });
    girderRivetMesh.userData.lodDetail = true;
    E.add(girderRivetMesh);

    // 2.1 rad/s → a 3 s stroke cycle, faster than the gallery's big mill
    // engine, with the three throws at 120° so one is always at mid-stroke
    const OM = 2.1;
    machines.push((time: number) => {
      eFly.rotation.z = OM * time;
      BORE.forEach((x, i) => {
        const th = OM * time + (i * Math.PI * 2) / 3;
        cranks[i].rotation.z = th;
        const sc = crankSlider(x, CRY, CR, ROD, th, 'y');
        rods[i].position.set(sc.pin[0], sc.pin[1], MZ + 0.04);
        rods[i].rotation.z = sc.rodAngle;
        heads[i].position.y = sc.head[1];
        const len = Math.max(0.05, RY + 0.5 - sc.head[1]);
        rodShafts[i].scale.y = len;
        rodShafts[i].position.y = sc.head[1] - CRY + len / 2;
      });
    });
  }

  // =========================================================================
  // 5. THE PLANT — a copper boiler with a glowing firebox, a chimney, a coal
  //    heap and the gantry that ties the hall together. The roof covers only
  //    the BACK half: a full roof reads as a closed lid at the isometric
  //    camera and hides the machinery under it (the GoggleWorks lesson).
  // =========================================================================
  {
    const P = new t.Group();
    P.position.set(cx, 0, cz);
    g.add(P);
    P.add(sootApron(t, 5.6, 3.8, [0, 0.015, 0]));
    // ---- the boiler: a lagged copper barrel on firebrick saddles ---------
    const BY = 0.95;
    P.add(cyl(t, 0.5, 0.5, 2.3, COPPER, [0, BY, -0.5], { tex: 'metal', repeat: [7, 3], metal: 0.24, rough: 0.58, seg: 18, rotZ: Math.PI / 2 }));
    [-0.9, -0.3, 0.3, 0.9].forEach((x) => P.add(cyl(t, 0.52, 0.52, 0.09, BRASS, [x, BY, -0.5], { tex: 'metal', repeat: [7, 1], metal: 0.3, rough: 0.44, seg: 18, rotZ: Math.PI / 2 }))); // hoop bands
    [-1.18, 1.18].forEach((x) => P.add(cyl(t, 0.46, 0.5, 0.1, IRON_D, [x, BY, -0.5], { tex: 'metal', repeat: [6, 1], metal: 0.26, rough: 0.62, seg: 18, rotZ: Math.PI / 2 }))); // end plates
    // verdigris weeping down the barrel
    const patina: MergedBoxSpec[] = [];
    for (let i = 0; i < 10; i += 1) {
      const a = -0.9 + hash01(i * 2.3) * 1.8;
      const h = 0.12 + hash01(i * 6.7) * 0.2;
      patina.push({ dims: [0.07, h, 0.014], pos: [-1.0 + hash01(i * 4.1) * 2.0, BY + Math.cos(a) * 0.5 - h * 0.2, -0.5 + Math.sin(a) * 0.5], rotX: -a });
    }
    const patinaMesh = mergedBoxes(t, patina, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.88, bump: 0.02 });
    patinaMesh.userData.lodDetail = true;
    P.add(patinaMesh);
    // saddles + the firebrick base
    P.add(
      mergedBoxes(
        t,
        [
          { dims: [2.6, 0.42, 1.0], pos: [0, 0.21, -0.5], repeat: [6, 1] },
          { dims: [2.7, 0.1, 1.1], pos: [0, 0.47, -0.5], repeat: [6, 1] },
        ],
        FIREBRICK,
        { tex: 'concrete', repeat: [4, 1], rough: 1, bump: 0.05 },
      ),
    );
    // THE FIREBOX — on the barrel's −z face, i.e. the side that looks at the
    // GEAR GALLERY, so the riders (and the isometric camera, which sees the −z
    // faces once the ride is turned to show its machinery) get the fire. Its
    // door stands open on a fire that burns by DAY as well as by night — it is
    // a fire, not a lamp — just brighter after dark.
    const fireMat = new t.MeshStandardMaterial({ color: FIRE_HOT, emissive: FIRE_DEEP, emissiveIntensity: 0.5, roughness: 0.6 });
    fireMats.push(fireMat);
    const mouth = new t.Mesh(new t.BoxGeometry(0.46, 0.3, 0.05), fireMat);
    mouth.position.set(0, 0.32, -1.06);
    P.add(mouth);
    P.add(box(t, [0.62, 0.42, 0.1], IRON_D, [0, 0.32, -0.98], { tex: 'metal', repeat: [2, 1], metal: 0.26, rough: 0.65 })); // door frame
    P.add(box(t, [0.3, 0.4, 0.06], IRON, [0.44, 0.34, -1.08], { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.68, rotY: 0.9 })); // the open door
    P.add(cyl(t, 0.022, 0.022, 0.2, BRASS_L, [0.56, 0.34, -1.16], { metal: 0.32, rough: 0.38, seg: 8, rotZ: Math.PI / 2 })); // door handle
    const fireLight = new t.PointLight(0xff8a34, 0, 4.0, 2);
    fireLight.position.set(0, 0.4, -1.3);
    P.add(fireLight);
    // ---- the chimney -----------------------------------------------------
    // the stack goes up the BACK (+z) side, clear of the roof sheets, and tops
    // out ABOVE the gantry so its plume is released in open air
    P.add(cyl(t, 0.2, 0.28, 2.6, FIREBRICK, [-1.15, 2.2, 0.34], { tex: 'concrete', repeat: [4, 7], rough: 1, bump: 0.05 }));
    P.add(cyl(t, 0.24, 0.21, 0.14, BRASS_D, [-1.15, 3.56, 0.34], { tex: 'metal', repeat: [4, 1], metal: 0.28, rough: 0.5, seg: 14 })); // the cap
    P.add(cyl(t, 0.15, 0.15, 0.86, IRON_D, [-1.15, 1.5, -0.1], { tex: 'metal', repeat: [2, 3], metal: 0.26, rough: 0.62, seg: 12, rotX: Math.PI / 2 })); // uptake duct
    P.add(cyl(t, 0.17, 0.17, 0.1, BRASS_D, [-1.15, 1.5, -0.45], { tex: 'metal', repeat: [3, 1], metal: 0.28, rough: 0.5, seg: 12, rotX: Math.PI / 2 })); // duct flange
    const chimneyTop = toLocal(P, -1.15, 3.7, 0.34);
    // ---- the coal heap + a shovel ---------------------------------------
    const lumps: MergedBoxSpec[] = [];
    for (let i = 0; i < 24; i += 1) {
      const h1 = hash01(i * 4.7 + 5);
      const h2 = hash01(i * 8.3 + 9);
      const r = 0.15 + h1 * 0.75;
      const a = hash01(i * 3.1 + 2) * Math.PI * 2;
      const s = 0.1 + h2 * 0.14;
      lumps.push({ dims: [s, s * 0.8, s * 1.1], pos: [1.55 + Math.cos(a) * r, 0.06 + (1 - r) * 0.22, 0.55 + Math.sin(a) * r * 0.7], rotY: h1 * 3.1, rotZ: (h2 - 0.5) * 0.6 });
    }
    P.add(mergedBoxes(t, lumps, COAL, { tex: 'concrete', repeat: [1, 1], rough: 0.95, bump: 0.06, flat: true }));
    P.add(box(t, [0.05, 0.5, 0.05], TIMBER, [2.3, 0.28, 0.15], { tex: 'wood', repeat: [1, 3], rough: 0.9, rotZ: 0.4 }));
    P.add(box(t, [0.18, 0.03, 0.22], IRON_P, [2.19, 0.05, 0.15], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.6 }));
    // ---- THE GANTRY: iron columns, open trusses, and a BACK-ONLY roof ----
    const gan: MergedBoxSpec[] = [];
    const CH = 2.9;
    [-2.3, 2.3].forEach((x) =>
      [-1.5, 1.5].forEach((z) => {
        gan.push({ dims: [0.24, CH, 0.24], pos: [x, CH / 2, z], repeat: [1, 7] });
        gan.push({ dims: [0.44, 0.08, 0.44], pos: [x, 0.04, z] });
      }),
    );
    [-1.5, 1.5].forEach((z) => gan.push({ dims: [5.0, 0.18, 0.2], pos: [0, CH + 0.09, z], repeat: [8, 1] })); // eaves beams
    [-2.3, 0, 2.3].forEach((x) => gan.push({ dims: [0.2, 0.18, 3.2], pos: [x, CH + 0.09, 0], repeat: [1, 5] })); // tie beams
    // the LATTICE of the trusses: diagonals in both directions, which is what
    // makes an open gantry read as ironwork rather than as goalposts
    for (let i = 0; i < 8; i += 1) {
      const x = -2.2 + i * 0.63;
      [-1.5, 1.5].forEach((z) => gan.push({ dims: [0.72, 0.06, 0.1], pos: [x, CH - 0.2, z], rotZ: i % 2 ? 0.7 : -0.7 }));
    }
    // the ROOF: sheeted over the BACK THIRD only (z > 0.6), open over the rest
    for (let i = 0; i < 3; i += 1) {
      gan.push({ dims: [5.1, 0.06, 0.34], pos: [0, CH + 0.22, 0.62 + i * 0.34], repeat: [8, 1] });
    }
    gan.push({ dims: [5.1, 0.12, 0.12], pos: [0, CH + 0.3, 1.52], repeat: [8, 1] }); // ridge trim
    P.add(mergedBoxes(t, gan, IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.72, bump: 0.04 }));
    // a rusted sheet-iron valance hanging off the front eaves, and a soot-brick
    // cutaway wall along the BACK with two big openings — the hall has an
    // envelope without ever becoming a box
    P.add(box(t, [5.0, 0.28, 0.06], RUST, [0, CH - 0.06, -1.58], { tex: 'metal', repeat: [10, 1], metal: 0.22, rough: 0.78 }));
    // the back wall is a WAIST-HIGH DADO on piers, not a wall: at full height
    // (head course at 2.6) it read as one brown slab filling the middle of the
    // build, and the whole point of an open works is that you see INTO it
    const wall: MergedBoxSpec[] = [];
    wall.push({ dims: [5.0, 0.72, 0.24], pos: [0, 0.36, 1.62], repeat: [8, 1] }); // dado course
    wall.push({ dims: [5.0, 0.14, 0.3], pos: [0, 0.79, 1.62], repeat: [8, 1] }); // capping
    [-2.4, -0.05, 2.3].forEach((x) => wall.push({ dims: [0.44, 1.5, 0.24], pos: [x, 1.1, 1.62], repeat: [1, 3] })); // piers
    P.add(mergedBoxes(t, wall, FIREBRICK, { tex: 'concrete', repeat: [3, 2], rough: 1, bump: 0.05 }));

    machines.push((time: number) => {
      const flick = 0.82 + 0.18 * Math.sin(time * 3.1) + 0.1 * Math.sin(time * 7.3 + 1.1);
      const nk = nightKOf(g);
      fireMat.emissiveIntensity = (0.55 + 0.95 * nk) * flick;
      fireLight.intensity = (0.45 + 0.9 * nk) * flick;
    });
    if (wantFx) {
      const steam = buildEmitter(t, {
        max: 90,
        rate: 15,
        life: 3.6,
        lifeVar: 0.9,
        velocity: [0.05, 0.95, 0],
        spread: 0.28,
        gravity: -0.22, // buoyant
        size: 0.24,
        sizeEnd: 1.0,
        color: 0xd8d2c8,
        colorEnd: 0x8e8880,
        opacity: 0.28,
      });
      steam.setOrigin(chimneyTop[0], chimneyTop[1], chimneyTop[2]);
      g.add(steam.points);
      emitters.push(steam);
    }
  }

  // =========================================================================
  // 6. THE PIPE ARCHES — two riveted pipe gantries straddling the track, so
  //    the cars visibly run THROUGH the works rather than past them. Legs 0.85
  //    off the centreline, 1.15 of clear head height over the rails.
  // =========================================================================
  [-0.075, 0.075].forEach((d, k) => {
    const u = (((galleryU + d) % 1) + 1) % 1;
    const f = ride.frameAt(u);
    const arch = new t.Group();
    arch.position.set(f.p.x, 0, f.p.z);
    arch.rotation.y = yawOf(f);
    g.add(arch);
    const RY = f.p.y;
    const parts: MergedBoxSpec[] = [];
    [-1, 1].forEach((s) => {
      parts.push({ dims: [0.18, RY + 1.24, 0.18], pos: [s * 0.85, (RY + 1.24) / 2, 0], repeat: [1, 4] });
      parts.push({ dims: [0.34, 0.07, 0.34], pos: [s * 0.85, 0.035, 0] });
      parts.push({ dims: [0.4, 0.06, 0.1], pos: [s * 0.68, RY + 1.1, 0], rotZ: s * 0.7 }); // knee brace
    });
    parts.push({ dims: [1.9, 0.16, 0.2], pos: [0, RY + 1.3, 0], repeat: [4, 1] }); // the lintel
    arch.add(mergedBoxes(t, parts, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.72, bump: 0.04 }));
    // the pipes over the top, and a small gear on the lintel that turns
    [0.06, -0.06].forEach((z, i) =>
      arch.add(cyl(t, 0.06 + i * 0.015, 0.06 + i * 0.015, 1.86, COPPER, [0, RY + 1.44 + i * 0.14, z], { tex: 'metal', repeat: [1, 5], metal: 0.24, rough: 0.58, seg: 10, rotZ: Math.PI / 2 })),
    );
    [-0.62, 0, 0.62].forEach((x) => arch.add(cyl(t, 0.075, 0.075, 0.1, BRASS, [x, RY + 1.44, 0.06], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.44, seg: 12, rotZ: Math.PI / 2 }))); // flanges
    const small = spurGear(t, { teeth: 13, pitch: 0.14, colour: k === 0 ? IRON_P : BRASS, seed: 7 + k });
    small.group.position.set(0.72, RY + 1.62, 0.12);
    arch.add(small.group);
    machines.push((time: number) => {
      small.group.rotation.z = (k === 0 ? 1 : -1) * 0.9 * time;
    });
  });

  // =========================================================================
  // 7. THE STATION — a soot-iron deck under a gantry canopy on the free +z
  //    face, with a gaslight, a departure gauge and a brass nameplate.
  // =========================================================================
  {
    const st = ride.frameAt(0);
    const yard = new t.Group();
    yard.position.set(st.p.x, 0, st.p.z);
    yard.rotation.y = yawOf(st);
    g.add(yard);
    // yard-local: +z runs along the station straight, +x is the boarding side
    // (which maps to the component's free +z face), y is WORLD height
    const deckTop = st.p.y + 0.02; // just under the 0.045 rail tops
    const DX = 1.0; // inner deck edge 0.5, clear of the 0.48 tie ends
    yard.add(box(t, [1.0, 0.1, 2.9], IRON_D, [DX, deckTop - 0.05, 1.3], { tex: 'metal', repeat: [3, 8], metal: 0.22, rough: 0.72 }));
    yard.add(box(t, [0.96, 0.03, 2.86], CINDER, [DX, deckTop + 0.015, 1.3], { tex: 'concrete', repeat: [3, 8], rough: 1, bump: 0.04 })); // grit surface
    const deck: MergedBoxSpec[] = [];
    [0.6, 1.4].forEach((x) => deck.push({ dims: [0.12, 0.12, 2.9], pos: [x, deckTop - 0.16, 1.3], repeat: [1, 6] }));
    [0.2, 1.3, 2.4].forEach((z) =>
      [0.6, 1.4].forEach((x) => {
        deck.push({ dims: [0.13, deckTop - 0.22, 0.13], pos: [x, (deckTop - 0.22) / 2, z], repeat: [1, 3] });
        deck.push({ dims: [0.3, 0.06, 0.3], pos: [x, 0.03, z] });
      }),
    );
    [0.34, 0.7].forEach((y) => deck.push({ dims: [0.07, 0.06, 2.9], pos: [1.52, deckTop + y, 1.3], repeat: [1, 6] })); // edge rails
    [0.2, 1.3, 2.4].forEach((z) => deck.push({ dims: [0.08, 0.76, 0.08], pos: [1.52, deckTop + 0.38, z], repeat: [1, 2] }));
    [0, 1, 2].forEach((k) => deck.push({ dims: [0.7, 0.06, 0.26], pos: [1.1, 0.14 + k * 0.13, -0.5 + k * 0.12], repeat: [2, 1] })); // steps
    yard.add(mergedBoxes(t, deck, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.68, bump: 0.03 }));
    // the canopy: four posts and an open lattice with corrugated sheet over the
    // deck ONLY (inner post face 0.57 vs the 0.35 car half-width)
    const can: MergedBoxSpec[] = [];
    [0.62, 1.38].forEach((x) => [0.35, 2.25].forEach((z) => can.push({ dims: [0.11, 1.18, 0.11], pos: [x, deckTop + 0.59, z], repeat: [1, 3] })));
    [0.62, 1.38].forEach((x) => can.push({ dims: [0.1, 0.1, 3.0], pos: [x, deckTop + 1.23, 1.3], repeat: [1, 8] }));
    for (let i = 0; i < 7; i += 1) can.push({ dims: [0.9, 0.05, 0.3], pos: [DX, deckTop + 1.3, 0.05 + i * 0.42], repeat: [3, 1] }); // sheets
    for (let i = 0; i < 5; i += 1) can.push({ dims: [0.34, 0.05, 0.09], pos: [DX, deckTop + 1.12, 0.4 + i * 0.55], rotZ: i % 2 ? 0.6 : -0.6 }); // lattice
    yard.add(mergedBoxes(t, can, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.7, bump: 0.03 }));
    yard.add(box(t, [0.06, 0.26, 3.0], RUST, [1.46, deckTop + 1.16, 1.3], { tex: 'metal', repeat: [6, 1], metal: 0.22, rough: 0.78 })); // valance
    // the gaslight on the canopy beam over the boarding edge
    const lampY = deckTop + 1.06;
    yard.add(box(t, [0.12, 0.14, 0.12], IRON_D, [DX, lampY, 1.3], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.6 }));
    const glass = ball(t, 0.085, LAMP_GLASS, [DX, lampY - 0.16, 1.3], { emissive: LAMP_GLOW, rough: 0.34 });
    (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.13;
    yard.add(glass);
    lampMats.push(glass.material as THREE.MeshStandardMaterial);
    const sl = new t.PointLight(LAMP_GLOW, 0, 5, 2);
    sl.position.set(DX, lampY - 0.3, 1.3);
    yard.add(sl);
    lights.push(sl);
    // a brass nameplate with engraved bars (no text render) over the entrance
    // end, and one big departure gauge beside it
    const plate = new t.Group();
    plate.position.set(1.44, deckTop + 0.95, 2.5);
    plate.rotation.y = Math.PI / 2;
    plate.add(box(t, [0.86, 0.2, 0.04], BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [5, 1], metal: 0.28, rough: 0.5 }));
    const engrave: MergedBoxSpec[] = [
      { dims: [0.6, 0.035, 0.012], pos: [-0.02, 0.045, 0.025] },
      { dims: [0.44, 0.028, 0.012], pos: [-0.08, -0.02, 0.025] },
    ];
    const engraveMesh = mergedBoxes(t, engrave, BRASS_L, { tex: 'metal', repeat: [1, 1], metal: 0.32, rough: 0.34 });
    engraveMesh.userData.lodDetail = true;
    plate.add(engraveMesh);
    yard.add(plate);
    const dialG = new t.Group();
    dialG.position.set(1.44, deckTop + 0.62, 0.42);
    dialG.rotation.y = Math.PI / 2;
    dialG.add(cyl(t, 0.15, 0.15, 0.06, BRASS, [0, 0, 0], { tex: 'metal', repeat: [5, 1], metal: 0.3, rough: 0.42, seg: 18, rotX: Math.PI / 2 }));
    dialG.add(cyl(t, 0.13, 0.13, 0.012, DIAL, [0, 0, 0.036], { rough: 0.75, seg: 18, rotX: Math.PI / 2 }));
    const ticks: MergedBoxSpec[] = [];
    for (let k = 0; k < 10; k += 1) {
      const a = -2.2 + (k / 9) * 4.4;
      ticks.push({ dims: [0.009, 0.03, 0.006], pos: [Math.sin(a) * 0.1, Math.cos(a) * 0.1, 0.042], rotZ: -a });
    }
    const tickMesh = mergedBoxes(t, ticks, IRON_D, { rough: 0.8 });
    tickMesh.userData.lodDetail = true;
    dialG.add(tickMesh);
    const bigNeedle = box(t, [0.012, 0.12, 0.008], NEEDLE, [0, 0, 0.048], { rough: 0.6 });
    bigNeedle.geometry = bigNeedle.geometry.clone();
    bigNeedle.geometry.translate(0, 0.05, 0);
    dialG.add(bigNeedle);
    dialG.add(cyl(t, 0.018, 0.018, 0.014, BRASS_L, [0, 0, 0.05], { metal: 0.32, rough: 0.36, seg: 8, rotX: Math.PI / 2 }));
    yard.add(dialG);
    machines.push((time: number) => {
      bigNeedle.rotation.z = -(-0.9 + 0.8 * Math.sin(time * 0.29) + 0.12 * Math.sin(time * 2.6));
    });
  }

  // =========================================================================
  // 8. LINESIDE CLUTTER — pipe runs, oil drums and clinker along the rails.
  // =========================================================================
  {
    const drums: MergedBoxSpec[] = [];
    const grit: MergedBoxSpec[] = [];
    for (let i = 0; i < 12; i += 1) {
      const u = (i + 0.4) / 12;
      const f = ride.frameAt(u);
      const sl = Math.hypot(f.side.x, f.side.z) || 1;
      const outward = (cx - f.p.x) * (f.side.x / sl) + (cz - f.p.z) * (f.side.z / sl) >= 0 ? -1 : 1;
      const h1 = hash01(i * 5.9 + 17);
      const off = (1.25 + h1 * 0.7) * outward;
      const px = f.p.x + (f.side.x / sl) * off;
      const pz = f.p.z + (f.side.z / sl) * off;
      const gy = groundAt(px, pz);
      if (h1 > 0.55) {
        const drum = cyl(t, 0.16, 0.16, 0.42, h1 > 0.8 ? RUST : IRON, [px, gy + 0.21, pz], { tex: 'metal', repeat: [4, 2], metal: 0.24, rough: 0.72, seg: 12 });
        g.add(drum);
        g.add(cyl(t, 0.17, 0.17, 0.04, IRON_D, [px, gy + 0.36, pz], { tex: 'metal', repeat: [4, 1], metal: 0.24, rough: 0.7, seg: 12 }));
      } else {
        drums.push({ dims: [0.3 + h1 * 0.2, 0.14, 0.24], pos: [px, gy + 0.07, pz], rotY: h1 * 3.1 }); // stacked plate
      }
      for (let k = 0; k < 3; k += 1) {
        const h2 = hash01(i * 3.7 + k * 1.9);
        grit.push({
          dims: [0.1 + h2 * 0.1, 0.05 + h2 * 0.05, 0.1 + h2 * 0.08],
          pos: [px + (h2 - 0.5) * 0.7, gy + 0.03, pz + (hash01(k * 7.3 + i) - 0.5) * 0.7],
          rotY: h2 * 3.1,
        });
      }
    }
    if (drums.length) g.add(mergedBoxes(t, drums, IRON_D, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.74, bump: 0.03 }));
    const gritMesh = mergedBoxes(t, grit, CINDER, { tex: 'concrete', repeat: [1, 1], rough: 1, bump: 0.05, flat: true });
    gritMesh.userData.lodDetail = true; // clinker: close-up only
    g.add(gritMesh);
  }

  // =========================================================================
  // 9. THE EFFECTS — cylinder puffs and gear-mesh sparks (budgeted, and both
  //    cycle their origin off a hashed tick rather than a random draw).
  // =========================================================================
  let puffs: Emitter | null = null;
  let sparks: Emitter | null = null;
  if (wantFx) {
    puffs = buildEmitter(t, {
      max: 60,
      rate: 20,
      life: 1.5,
      lifeVar: 0.4,
      velocity: [0.1, 0.7, 0],
      spread: 0.3,
      gravity: -0.15,
      size: 0.1,
      sizeEnd: 0.42,
      color: 0xe4e0d8,
      colorEnd: 0xa8a29a,
      opacity: 0.34,
    });
    sparks = buildEmitter(t, {
      max: 36,
      rate: 8,
      life: 0.7,
      lifeVar: 0.25,
      velocity: [0, 0.5, 0],
      spread: 0.9,
      gravity: 1.6,
      size: 0.045,
      sizeEnd: 0.012,
      color: 0xffd48a,
      colorEnd: 0xc9440e,
      opacity: 0.95,
      additive: true,
    });
    if (puffAt.length) puffs.setOrigin(puffAt[0][0], puffAt[0][1], puffAt[0][2]);
    if (sparkAt.length) sparks.setOrigin(sparkAt[0][0], sparkAt[0][1], sparkAt[0][2]);
    g.add(puffs.points);
    g.add(sparks.points);
    emitters.push(puffs, sparks);
  }

  // =========================================================================
  // 10. THE TRAIN — RCT2 order: index 0 leads (run() places car i at
  //     uHead − i·spacing), so nose car first, plain middles, tail car last.
  // =========================================================================
  const cars = Array.from({ length: carCount }, (_, i) =>
    buildGearworksCar(t, carCount === 1 || i === 0 ? 'front' : i === carCount - 1 ? 'end' : 'middle', CAR_LIVERY, { riders: opts.riders ?? true }),
  );
  cars.forEach((car) =>
    GEARWORKS_CAR_SEATS.forEach((sp) => {
      const anchor = new t.Group();
      anchor.position.set(0, sp.y, sp.z);
      car.add(anchor); // rides WITH the car, so real guests ride the train
      seatAnchors.push(anchor);
    }),
  );
  extras.vehicle = cars[0];
  const seatWorld = makeSeatWorld(t, seatAnchors);
  const run = ride.run(cars, { spacing: 1.15, wheelOffset: 0.195, speedScale: SPEED_SCALE });

  // ---- 11. the gated updater ----------------------------------------------
  let puffTick = -1;
  const gate = createMotionGate(
    (clock) => {
      run(clock);
      const nk = nightKOf(g);
      const ease = nk * nk * (3 - 2 * nk); // smoothstep
      cars.forEach((c) => gateCarLights(c, nk));
      lampMats.forEach((m) => (m.emissiveIntensity = 0.13 + 1.2 * ease));
      lights.forEach((l) => (l.intensity = 0.9 * ease));
      machines.forEach((m) => m(clock));
      if (puffs && puffAt.length) {
        // the three cylinders exhaust in turn — one relief valve every half
        // second, picked off a hashed tick (deterministic, never Math.random)
        const tick = Math.floor(clock * 2);
        if (tick !== puffTick) {
          puffTick = tick;
          const a = puffAt[Math.floor(hash01(tick * 1.37 + 0.5) * puffAt.length) % puffAt.length];
          puffs.setOrigin(a[0], a[1], a[2]);
        }
      }
      sparks?.setRate(5 + 6 * nk);
      emitters.forEach((e) => e.update(clock));
    },
    { spinDown: 1.8 },
  );

  return { group: g, update: gate.update, seatWorld, onStateChange: gate.onStateChange, ...extras };
}

const GearworksExpressBase = composableRide<GearworksExpressOpts & { register?: boolean }>(
  'GearworksExpress',
  (t, props) =>
    buildGearworksExpressScene(t, {
      pieces: props.pieces,
      points: props.points,
      cars: props.cars,
      groundAt: props.groundAt,
      galleryU: props.galleryU,
      engineU: props.engineU,
      effects: props.effects,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the train (capacity 6 = 3 cars × 2 seats)
      riders: props.riders ?? !props.register,
    }),
  {
    // the station straight is compiled along local −x and every compiled point
    // has z ≤ 0, so the local +z face is free: queue HEAD 2.0 out the front,
    // exit hut beside the brake tail, boarding on the deck at rail level
    front: 2.0,
    exit: [1.6, 1.9],
    board: [-1.3, 0.6, 0],
    defaults: { name: 'Gearworks Express', capacity: 6, rideDuration: 14, intensity: 2, price: 4 },
  },
);

/** <GearworksExpress> — the Brasswork Foundry's DARK RIDE as a composable ride
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.0 out the local +z front (the face the circuit deliberately
 *  keeps clear), exit hut at local [1.6, 1.9], boarding on the iron deck.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Straight/><Lift/><Drop/><TurnR/>…` — children win) are
 *  compiled by `compileTrackPieces` with this ride's rule set
 *  (`profile: 'coaster'`, `type: 'steel'`, bank 0.18 — a dark-ride car does not
 *  lean) and swept by `buildRideSpline`; `points` is the raw-control-point
 *  escape hatch. No pieces = the stock "Gear Gallery" circuit. A FATAL compile
 *  marks the build `invalid` (no registration). The lead car is the ride
 *  `vehicle` (onboard cam) and the measured RCT2 rating triple goes to
 *  `registerRide`.
 *
 *  THE MACHINERY FOLLOWS THE TRACK: the four-gear train, flywheel, steam
 *  cylinder and line shaft go on the lowest, straightest, most level stretch
 *  and the three-piston engine on the highest (or pin them with
 *  `galleryU` / `engineU`) — so a custom layout wants one long flat straight
 *  and one long high one. */
export const GearworksExpress: React.FC<ComposableRideProps & GearworksExpressOpts & { children?: React.ReactNode }> = ({ children, pieces, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <GearworksExpressBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
