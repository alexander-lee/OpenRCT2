import * as THREE from 'three';
import { ball, box, cyl, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';
import type { ComposableRideBuilt, RideLayout } from '../Park';

// ---------------------------------------------------------------------------
// AETHER BALLOONS — the BRASSWORK FOUNDRY world's stately family flat ride:
// six ornate brass-and-glass GONDOLAS on a spider of riveted arms that ROTATE
// around a lattice hoisting mast WHILE THEY RISE, hold at the top of the mast,
// and settle back onto the boarding deck. Slow, high, scenic; the sort of ride
// a Victorian engineer would call an "aerial promenade".
//
// THE MECHANISM IS THE THEME — this world is about EXPOSED working machinery,
// so every part of the drive train is modelled and every part MOVES:
//
//   * a square RIVETED LATTICE MAST (four posts, six bays of crossed
//     bracing, gusseted ties) standing on a bolted plinth on the deck;
//   * a CARRIAGE SLEEVE that slides up the mast's four face rails on rollers.
//     The arm spider turns on a SLEW RING at the sleeve's foot, so the sleeve
//     itself never rotates and its cable lugs (on top, well above the arm
//     plane) can never be swept by an arm;
//   * TWO HOIST CABLES off those lugs, up over TWO CROWN SHEAVES and back
//     DOWN INSIDE the lattice to TWO CAST-IRON COUNTERWEIGHTS, which visibly
//     DESCEND as the gondolas rise (opposite motion through the sheave is what
//     makes a hoist read as a hoist). Both cable runs are live: the risers
//     shorten, the falls lengthen, the sheaves turn at exactly the rope speed
//     (`rotation = travel / sheaveR`);
//   * a VERTICAL DRIVE SHAFT up the middle of the lattice, splined so the
//     carriage's slew pinion stays engaged AT EVERY HEIGHT — one shaft both
//     turns the arms and (through the bevel gear under the crown) drives the
//     hoist, which is why the ride rotates and rises together;
//   * a BASE WINCH on the deck: engine bed, rope drum with real wraps, a
//     pinion driving a big spur gear (exact 0.06 : 0.20 ratio), a spoked
//     flywheel, a spinning ball GOVERNOR, a live pressure gauge and a relief
//     valve that wisps steam.
//
// The gondolas hang from yokes on fore-and-aft pivot pins and SWAY: a small
// outward lean from the rotation (centrifugal, ∝ ω²) plus a gentle hashed
// tangential rock, both scaled by the motion envelope so a PARKED gondola
// hangs dead level for boarding.
//
// SCALE — checked against components/Carousel (base r 1.86, canopy 2.8) and
// components/Teacups (deck r 1.95): boarding deck radius 1.90 with its top at
// y 0.26, gondola floors DOCKED at 0.34 and lifted to 1.44, mast crown 2.96,
// aether globe 3.11. A park guest is ≈ 0.55 tall, so a lifted gondola floor stands
// two and a half guests off the ground — the ride reads as "up" from any
// camera without becoming a tower.
//
// PALETTE — the Brasswork Foundry values (BrassworkScenery's BRASSWORK, the
// same brass/copper/iron GoggleWorks uses). METALNESS CEILING 0.34: a
// MeshStandardMaterial at metalness ≥ 0.6 with no environment map renders
// NEAR-BLACK, because metals are lit only by reflections and this Stage has a
// sun and nothing to reflect. Every metal here sits in the 0.2–0.34 band and
// gets its brass from COLOUR + TEXTURE + rivets. No shiny gold anywhere.
//
// Budgets: 2 real PointLights (crown beacon + deck gaslight, both
// night-gated), 24 particles (the winch's relief-valve steam), the whole mast
// (posts, bracing, ties) and every rivet ring / gondola rib set batched
// through `mergedBoxes`, fine detail tagged `userData.lodDetail`.
// Deterministic: hashed sines only, no Math.random / Date.now; the updater
// takes ABSOLUTE time and is wrapped in `createMotionGate`, so a registered
// ride is PARKED (docked, level, still) while guests board.
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// ---- the Brasswork Foundry metals (BrassworkScenery.BRASSWORK) -------------
const BRASS = 0xb2913f; // muted brass — a dull yellow-brown, never gold
const BRASS_D = 0x86682f; // castings, shadowed brass, rivet heads
const BRASS_L = 0xd0b26a; // the brightest brass: bezels, rims, lap bars
const COPPER = 0x96603a; // oxidised copper sheet
const VERDIGRIS = 0x36483a; // the patina staining it (muted green, not teal)
const IRON = 0x615c53; // the world's default metal: soot-grey iron
const IRON_D = 0x38342e; // deep soot in the crevices
const IRON_P = 0x8a8378; // cast iron catching sky: plates, decks, pedestals
const CINDER = 0x433d35; // clinker ground apron
const LEATHER = 0x6b3a2a; // gondola upholstery: oxblood buttoned leather
const GLASS = 0x86aab4; // gondola glazing / lamp glass: pale grey-blue
const DIAL = 0xe8e0cc; // enamel gauge face
const NEEDLE = 0x8c2318; // the one red in the world
const ROPE = 0x9a958c; // galvanised hoist rope — PALE, so it reads against the lattice

// ---- the ride's dimensions, in ONE place -----------------------------------
const DECK_R = 1.9; // octagonal boarding deck (top y 0.26)
const DECK_TOP = 0.26;
const R_ARM = 1.42; // gondola pivot radius
const FLOOR_DOCK = 0.34; // gondola floor when docked (pan underside 0.29 — 0.03 over the deck)
const HANGER = 0.85; // pivot pin above the gondola floor
const R_SLEW = 0.56; // slew-ring radius: OUTSIDE the square sleeve's own corners (0.506)
const ARM_Y0 = FLOOR_DOCK + HANGER; // arm plane, docked (1.15)
const LIFT = 1.1; // hoist travel
const SLEEVE_H = 0.42; // carriage sleeve height (cable lugs on top)
const SHEAVE_Y = 2.8; // crown sheave axle height
const SHEAVE_X = 0.265; // sheave centre — its two tangents ARE the rope lines: 0.13 / 0.40
const SHEAVE_R = 0.135;
// THE RISER LINE MUST CLEAR THE MAST. At 0.31 it ran INSIDE the corner posts'
// outer face (0.30) and the face rails (0.307) and simply vanished into them;
// 0.40 stands it proud of the posts, of the carriage sleeve (0.355) and inside
// everything that rotates (slew ring 0.52+).
const LUG_X = 0.4;
const CW_X = 0.13; // counterweight / fall line, INSIDE the lattice
const CW_TOP = 2.02; // counterweight centre with the gondolas docked
const OMEGA = 0.55; // arm rotation, rad/s at full speed
/**
 * ONE CYCLE OF GATED CLOCK — and that is NOT `loadTime + rideDuration`.
 *
 * `createMotionGate` also advances the runner during `departing` (eased 0→1 over
 * spinUp 0.8) and `arriving` (eased 1→0 over spinDown 1.8), neither of which the
 * ride FSM counts as ride time. Measured against a bare gate driven through the
 * real state sequence (rideFsm.ts:124-195), one cycle hands this updater
 * **15.326 s** for `rideDuration` 14 — a surplus of **1.326 s** (probe:
 * /tmp/mp3d-render/aud-brass-gate.tsx, which reproduces Reef Racer's published
 * 1.291 for spinDown 1.6 as its control).
 *
 * At PERIOD 15 the hoist profile therefore slid **+0.326 s of phase per cycle**
 * against the station. Nothing looked wrong for the first four cycles (and the
 * gondolas can never be caught mid-air at a station, because `motionK` scales
 * the travel to zero the moment the FSM parks) — but by cycle 5 `departing`
 * began at p 0.109 instead of 0, and 23 cycles in it begins at the TOP of the
 * hold, so the gondolas would shoot 1.1 u in the gate's 0.8 s spin-up instead of
 * rising over 4.8. Phase-locking the period to the cycle puts every `departing`
 * at p = 0: docked dwell, rise, hold, descend, docked again before the gate
 * winds down. Bring the CLOCK to the cycle, never `rideDuration` to the clock —
 * the world's sim window sits on its 60-s floor and a registration change moves it.
 */
const PERIOD = 15.326;
const N_GOND = 6;
const SEATS_PER = 2;

/** the hoist's height profile over one cycle phase (0..1): dwell docked, a
 *  4.8 s rise, a 4.2 s hold at the top, a 3.6 s descent, docked again BEFORE
 *  the cycle ends — so the gondolas are already home when the FSM parks. */
const riseProfile = (p: number): number =>
  p < 0.1 ? 0 : p < 0.42 ? smooth((p - 0.1) / 0.32) : p < 0.7 ? 1 : p < 0.94 ? 1 - smooth((p - 0.7) / 0.24) : 0;

/** polar helper: azimuth measured from +x toward +z. A box/group at `P(a, r)`
 *  with `rotation.y = -a` has its local +x pointing radially OUTWARD and its
 *  local +z along the tangent. */
const P = (a: number, r: number, y = 0): [number, number, number] => [Math.cos(a) * r, y, Math.sin(a) * r];

// ===========================================================================
// THE GONDOLA — an ornate brass-and-glass basket. Local origin at the FLOOR
// CENTRE, +x radially OUTWARD (the direction the riders face), the yoke pivot
// pin at local y `HANGER`.
//
// SEATS ARE REAL SEATS: a moulded iron pan, a buttoned leather cushion whose
// TOP sits exactly 0.225 above the floor, and a leaning backrest with its own
// cushion. 0.225 is not a guess — a park guest is `GUEST_SCALE` 0.5 and a
// peep's hip box sits at peep-local y 0.45, so an anchor ON THE FLOOR puts a
// rider's hips exactly ON the cushion and their feet exactly ON the floor,
// whether the manager seats them (legs down, arms folded onto the lap bar) or
// a decorative `seated` peep takes the place (legs folded forward).
// ===========================================================================
function gondolaRig(
  t: typeof THREE,
  idx: number,
  o: { riders?: boolean; lampMat: THREE.MeshStandardMaterial },
): { group: THREE.Group; seats: THREE.Group[] } {
  const g = new t.Group();
  const seats: THREE.Group[] = [];

  // ---- hull: riveted brass tub below, GLAZED above so the riders read ------
  g.add(cyl(t, 0.32, 0.3, 0.05, IRON_D, [0, -0.025, 0], { tex: 'metal', repeat: [6, 1], metal: 0.24, rough: 0.7, seg: 8 })); // floor pan (top y 0)
  const hull = new t.Mesh(
    new t.CylinderGeometry(0.345, 0.325, 0.17, 8, 1, true),
    mat(t, BRASS, { tex: 'metal', repeat: [8, 1], metal: 0.3, rough: 0.46, bump: 0.03 }),
  );
  hull.material.side = t.DoubleSide; // an OPEN tub: we see the bench inside it
  hull.position.y = 0.085;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  const glazing = new t.Mesh(
    new t.CylinderGeometry(0.35, 0.345, 0.14, 8, 1, true),
    new t.MeshStandardMaterial({ color: GLASS, roughness: 0.16, metalness: 0.14, transparent: true, opacity: 0.44, side: t.DoubleSide }),
  );
  glazing.position.y = 0.235;
  g.add(glazing);
  // copper skirt under the tub, weeping verdigris (lodDetail)
  g.add(cyl(t, 0.335, 0.3, 0.05, COPPER, [0, 0.025, 0], { tex: 'metal', repeat: [8, 1], metal: 0.22, rough: 0.6, seg: 8 }));
  // the rim: a brass moulding wrapping the top edge of the glazing
  const rim = new t.Mesh(new t.TorusGeometry(0.352, 0.022, 6, 24), mat(t, BRASS_L, { metal: 0.32, rough: 0.34 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.305;
  rim.castShadow = true;
  g.add(rim);
  // eight corner ribs + two rivet rings + the verdigris streaks: ONE mesh each
  const ribs: MergedBoxSpec[] = [];
  const rivets: MergedBoxSpec[] = [];
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    ribs.push({ dims: [0.028, 0.32, 0.03], pos: P(a, 0.348, 0.15), rotY: -a, repeat: [1, 2] });
    [0.03, 0.155].forEach((y) => rivets.push({ dims: [0.016, 0.016, 0.012], pos: P(a + Math.PI / 8, 0.35, y), rotY: -a }));
    rivets.push({ dims: [0.016, 0.016, 0.012], pos: P(a, 0.352, 0.09), rotY: -a });
  }
  g.add(mergedBoxes(t, ribs, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.48 }));
  const rivetMesh = mergedBoxes(t, rivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.36 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  g.add(rivetMesh);
  const patina: MergedBoxSpec[] = [];
  for (let k = 0; k < 5; k += 1) {
    const a = hash01(idx * 3.1 + k * 7.7) * Math.PI * 2;
    const h = 0.02 + hash01(k * 4.3 + idx) * 0.03;
    patina.push({ dims: [0.02, h, 0.008], pos: P(a, 0.336, 0.02 + h / 2), rotY: -a });
  }
  const patinaMesh = mergedBoxes(t, patina, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.88, bump: 0.02 });
  patinaMesh.userData.lodDetail = true;
  g.add(patinaMesh);

  // ---- the BENCH: moulded pan + leather cushions, two places side by side --
  g.add(box(t, [0.19, 0.06, 0.46], IRON_D, [-0.12, 0.16, 0], { tex: 'metal', repeat: [2, 1], metal: 0.24, rough: 0.66 })); // pan shell, top 0.19
  g.add(box(t, [0.18, 0.04, 0.44], LEATHER, [-0.12, 0.205, 0], { tex: 'fabric', repeat: [2, 1], rough: 0.95, bump: 0.03 })); // CUSHION — top 0.225
  g.add(box(t, [0.05, 0.26, 0.4], IRON_D, [-0.235, 0.3, 0], { tex: 'metal', repeat: [1, 2], metal: 0.24, rough: 0.66, rotZ: -0.09 })); // backrest shell
  g.add(box(t, [0.03, 0.22, 0.36], LEATHER, [-0.205, 0.31, 0], { tex: 'fabric', repeat: [1, 2], rough: 0.95, bump: 0.03, rotZ: -0.09 })); // back cushion
  // buttoning + a brass divider between the two places (lodDetail)
  const buttons: MergedBoxSpec[] = [];
  for (let k = 0; k < 6; k += 1) buttons.push({ dims: [0.012, 0.012, 0.012], pos: [-0.19, 0.27 + (k % 2) * 0.07, -0.14 + Math.floor(k / 2) * 0.14] });
  const buttonMesh = mergedBoxes(t, buttons, BRASS_D, { metal: 0.3, rough: 0.4 });
  buttonMesh.userData.lodDetail = true;
  g.add(buttonMesh);
  g.add(box(t, [0.15, 0.03, 0.03], BRASS_L, [-0.07, 0.255, 0], { metal: 0.32, rough: 0.36 })); // divider rail
  // the LAP BAR across both places, on two uprights off the pan
  g.add(cyl(t, 0.017, 0.017, 0.44, BRASS_L, [-0.02, 0.3, 0], { metal: 0.32, rough: 0.34, seg: 8, rotX: Math.PI / 2 }));
  [-0.2, 0.2].forEach((z) => g.add(box(t, [0.03, 0.13, 0.03], BRASS_D, [-0.02, 0.24, z], { metal: 0.3, rough: 0.4 })));
  // a brass footrest bar on the floor in front of the bench
  g.add(cyl(t, 0.014, 0.014, 0.4, BRASS_D, [0.1, 0.03, 0], { metal: 0.3, rough: 0.42, seg: 8, rotX: Math.PI / 2 }));

  // ---- seat anchors: ON THE FLOOR, hips landing on the cushion ------------
  [-1, 1].forEach((sgn, k) => {
    const seat = new t.Group();
    seat.position.set(-0.12, 0, sgn * 0.115);
    seat.rotation.y = Math.PI / 2; // facing local +x — radially OUTWARD, over the rim
    g.add(seat);
    seats.push(seat);
    if (o.riders) {
      const n = idx * SEATS_PER + k;
      const p = buildPeep(t, {
        skin: SKIN_TONES[n % SKIN_TONES.length],
        shirt: SHIRTS[(n * 3) % SHIRTS.length],
        female: n % 3 === 1,
        seated: true,
        expression: 'happy',
      });
      p.group.scale.setScalar(0.5); // GameManager GUEST_SCALE — decorative riders match real ones
      p.group.userData.lodDetail = true;
      seat.add(p.group);
    }
  });

  // ---- ornament: a gas lamp on the outboard rim, a gauge, a nameplate ------
  g.add(cyl(t, 0.012, 0.012, 0.1, BRASS_D, [0.34, 0.35, 0], { metal: 0.3, rough: 0.42, seg: 6, rotZ: 0.5 })); // lamp bracket
  const lampGlass = new t.Mesh(new t.SphereGeometry(0.032, 10, 8), o.lampMat);
  lampGlass.position.set(0.375, 0.4, 0);
  g.add(lampGlass);
  g.add(cyl(t, 0.036, 0.026, 0.022, BRASS_L, [0.375, 0.437, 0], { metal: 0.32, rough: 0.36, seg: 8 })); // lamp cap
  const gauge = new t.Group();
  gauge.position.set(0.322, 0.14, 0.12);
  gauge.rotation.y = -0.4;
  gauge.add(cyl(t, 0.036, 0.036, 0.02, BRASS, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.42, seg: 12, rotX: Math.PI / 2 }));
  gauge.add(cyl(t, 0.03, 0.03, 0.008, DIAL, [0, 0, 0.014], { rough: 0.76, seg: 12, rotX: Math.PI / 2 }));
  const needle = box(t, [0.005, 0.026, 0.004], NEEDLE, [0, 0, 0.02], { rough: 0.6, rotZ: -0.8 });
  needle.userData.lodDetail = true;
  gauge.add(needle);
  gauge.userData.lodDetail = true;
  g.add(gauge);
  const plate = new t.Group();
  plate.position.set(0.33, 0.16, -0.1);
  plate.rotation.y = 0.4;
  plate.add(box(t, [0.11, 0.045, 0.012], BRASS_L, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.38 }));
  const engrave: MergedBoxSpec[] = [
    { dims: [0.07, 0.008, 0.006], pos: [-0.004, 0.008, 0.008] },
    { dims: [0.05, 0.006, 0.006], pos: [-0.014, -0.008, 0.008] },
  ];
  const engraveMesh = mergedBoxes(t, engrave, BRASS_D, { metal: 0.3, rough: 0.4 });
  engraveMesh.userData.lodDetail = true;
  plate.add(engraveMesh);
  g.add(plate);
  // four scrollwork brackets under the tub (lodDetail).
  // THE DROP IS 0.020, NOT 0.030. Tipped 0.5 rad a 0.1-long bracket reaches
  // 0.0345 below its own centre, and the gondola SWAYS while it is docked (the
  // hoist is home from p 0.94 to p 0.10 but the arms are still turning, so the
  // lean/rock are live) — which took the lowest bracket corner to y 0.2588
  // against a deck plate whose top is 0.26. Measured: a 1.2 mm dip into the
  // deck at t = 16.0 s, invisible in the rest pose, which is exactly the class
  // of defect a cycle sweep exists to find. At 0.020 the same sweep bottoms out
  // at 0.2688 — 8.8 mm clear (probe: /tmp/mp3d-render/aud-brass-clip.tsx).
  const scroll: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    scroll.push({ dims: [0.1, 0.024, 0.024], pos: P(a, 0.26, -0.02), rotY: -a, rotZ: 0.5 });
  }
  const scrollMesh = mergedBoxes(t, scroll, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.46 });
  scrollMesh.userData.lodDetail = true;
  g.add(scrollMesh);

  // ---- the YOKE: two side plates up to the fore-and-aft pivot pin ---------
  // THE DIAGONAL STAY LEANS OUTBOARD, NOT INBOARD, AND THAT IS STRUCTURAL.
  // Its first pass ran from the yoke plate DOWN AND IN (centre z ±0.20, tipped
  // 0.5 rad) — straight through the outboard rider's fist. The seats sit at
  // z ±0.115 and a peep's arm pivot is 0.0975 off its own centre-line, so the
  // outboard fist lands at z ±0.2125, y 0.334-0.401, and the stay swept z
  // 0.226-0.262 across exactly that height: measured **28.5 mm of the fist
  // inside the stay**, on BOTH outer seats, in the rest pose and every phase of
  // the cycle. That is the Emberfall yoke-plate defect, in a yoke.
  // Now the stay leans the other way — from the plate at z ±0.27 down and OUT
  // to the rim moulding at z ±0.34, clear of the fist by 25.6 mm — which is
  // also what a brace to a rim actually does. Shortened to 0.18 so its foot
  // lands ON the rim (y 0.309) instead of running down through the glazing.
  [-1, 1].forEach((sgn) => {
    g.add(box(t, [0.05, 0.6, 0.06], IRON_P, [0, 0.55, sgn * 0.27], { tex: 'metal', repeat: [1, 4], metal: 0.26, rough: 0.6, rotX: sgn * 0.03 }));
    g.add(box(t, [0.035, 0.18, 0.035], IRON, [0, 0.4, sgn * 0.3], { metal: 0.26, rough: 0.62, rotX: -sgn * 0.253 })); // diagonal stay to the rim
  });
  g.add(box(t, [0.07, 0.05, 0.62], IRON_P, [0, HANGER - 0.01, 0], { tex: 'metal', repeat: [1, 3], metal: 0.26, rough: 0.6 })); // yoke cross beam
  g.add(cyl(t, 0.026, 0.026, 0.66, BRASS_L, [0, HANGER, 0], { metal: 0.32, rough: 0.34, seg: 10, rotX: Math.PI / 2 })); // the PIVOT PIN
  [-1, 1].forEach((sgn) => g.add(cyl(t, 0.042, 0.042, 0.05, BRASS_D, [0, HANGER, sgn * 0.28], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.42, seg: 10, rotX: Math.PI / 2 }))); // bearings
  return { group: g, seats };
}

/** ONE gondola on its own, for the close-up preview: the basket, the bench,
 *  the yoke and (optionally) its two riders, hung from a stub arm end. */
export function buildAetherGondola(three: typeof THREE, opts: { riders?: boolean } = {}): THREE.Group {
  const t = three;
  const g = new t.Group();
  const lampMat = new t.MeshStandardMaterial({ color: 0xfff0cc, emissive: 0xffb050, emissiveIntensity: 0.5, roughness: 0.3 });
  const rig = gondolaRig(t, 0, { riders: opts.riders ?? true, lampMat });
  g.add(rig.group);
  // the arm end it hangs from (a stub, so the pin has something to hang on)
  g.add(box(t, [0.5, 0.055, 0.075], IRON, [-0.25, HANGER + 0.06, 0], { tex: 'metal', repeat: [4, 1], metal: 0.26, rough: 0.6 }));
  g.add(box(t, [0.1, 0.1, 0.1], IRON_P, [0, HANGER + 0.06, 0], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.6 }));
  return g;
}

export interface AetherBalloonsOpts {
  /** decorative peep riders in the gondolas (default true). A ride registered
   *  in a <Park> turns them off so the GameManager seats REAL guests through
   *  `seatWorld` instead (empty gondolas must read as empty). */
  riders?: boolean;
  /** the winch's relief-valve steam wisp (default true) */
  effects?: boolean;
}

/** the Aether Balloons. Group origin on the ground at the mast centre; the
 *  BOARDING side (the railing gap) faces local +z. */
export function buildAetherBalloonsScene(three: typeof THREE, opts: AetherBalloonsOpts = {}): ComposableRideBuilt & {
  seatWorld: (seat: number) => [number, number, number, number];
  vehicle: THREE.Object3D;
  onStateChange: (state: string) => void;
} {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const wantFx = opts.effects ?? true;
  const seats: THREE.Group[] = [];

  // =========================================================================
  // 1. THE GROUND + THE OCTAGONAL BOARDING DECK (top y 0.26)
  // =========================================================================
  const apron = cyl(t, 1, 1.04, 0.045, CINDER, [0, -0.006, 0], { tex: 'concrete', repeat: [14, 14], rough: 0.98, bump: 0.05, seg: 26 });
  apron.scale.set(2.3, 1, 2.24); // elliptical — a perfect circle of clinker reads as a dinner plate
  g.add(apron);
  g.add(cyl(t, 2.08, 2.14, 0.1, IRON, [0, 0.05, 0], { tex: 'metal', repeat: [16, 1], metal: 0.2, rough: 0.78, seg: 8 })); // step 1
  g.add(cyl(t, 1.98, 2.04, 0.1, IRON_P, [0, 0.14, 0], { tex: 'metal', repeat: [16, 1], metal: 0.22, rough: 0.72, seg: 8 })); // step 2
  g.add(cyl(t, DECK_R, 1.94, 0.08, IRON_P, [0, 0.22, 0], { tex: 'metal', repeat: [14, 1], metal: 0.24, rough: 0.68, seg: 8 })); // deck plate (top 0.26)
  // deck seams (eight radial checker-plate joints) + a rivet ring round the edge
  const deckBits: MergedBoxSpec[] = [];
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    deckBits.push({ dims: [1.7, 0.014, 0.05], pos: P(a, 0.95, 0.263), rotY: -a, repeat: [8, 1] });
  }
  const deckSeams = mergedBoxes(t, deckBits, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.22, rough: 0.74 });
  deckSeams.userData.lodDetail = true;
  g.add(deckSeams);
  const deckRivets: MergedBoxSpec[] = [];
  for (let k = 0; k < 40; k += 1) {
    const a = (k / 40) * Math.PI * 2;
    deckRivets.push({ dims: [0.02, 0.014, 0.02], pos: P(a, 1.82, 0.264), rotY: -a });
  }
  const deckRivetMesh = mergedBoxes(t, deckRivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.38 });
  deckRivetMesh.userData.lodDetail = true;
  g.add(deckRivetMesh);
  // brass railing round the deck, with a 60° GAP facing +z (a = π/2) where the
  // queue lands: posts every 30°, rails chorded between neighbours
  // ...and a gas BULB on every post: one SHARED emissive material for all
  // eleven (no extra PointLights — the budget is 2), night-gated in the updater
  const bulbGeo = new t.SphereGeometry(0.042, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  const railBits: MergedBoxSpec[] = [];
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    if (Math.abs(Math.sin(a) - 1) < 0.001) continue; // skip the post dead on +z
    g.add(cyl(t, 0.022, 0.026, 0.34, BRASS_D, P(a, 1.84, 0.43), { tex: 'metal', repeat: [1, 3], metal: 0.28, rough: 0.46, seg: 8 }));
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(...P(a, 1.84, 0.62)); // post top 0.60 — the bulb base embeds in it
    g.add(bulb);
    g.add(cyl(t, 0.036, 0.026, 0.02, BRASS_L, P(a, 1.84, 0.665), { metal: 0.32, rough: 0.36, seg: 8 })); // bulb cap
    const b = ((k + 1) / 12) * Math.PI * 2;
    const mid = (a + b) / 2;
    if (Math.abs(Math.sin(a) - 1) < 0.26 || Math.abs(Math.sin(b) - 1) < 0.26) continue; // leave the boarding gap open
    const chord = 2 * 1.84 * Math.sin(Math.PI / 12);
    [0.56, 0.4].forEach((y) => railBits.push({ dims: [0.028, 0.028, chord], pos: P(mid, 1.84 * Math.cos(Math.PI / 12), y), rotY: -mid, repeat: [1, 1] }));
  }
  g.add(mergedBoxes(t, railBits, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.46 }));
  // THE BOARDING WAY, in the railing gap on +z: the deck's three ring ledges
  // (0.10 / 0.19 / 0.26) already ARE the stair, so what the gap needs is
  // GUIDANCE — a raked brass handrail each side and a checker-plate threshold
  // where the queue lane meets the bottom ledge (`layout.front` lands here).
  [-1, 1].forEach((s) => {
    g.add(cyl(t, 0.02, 0.024, 0.42, BRASS_D, [s * 0.5, 0.31, 2.05], { tex: 'metal', repeat: [1, 3], metal: 0.28, rough: 0.46, seg: 8 }));
    g.add(cyl(t, 0.02, 0.024, 0.38, BRASS_D, [s * 0.5, 0.45, 1.72], { tex: 'metal', repeat: [1, 3], metal: 0.28, rough: 0.46, seg: 8 }));
    g.add(box(t, [0.028, 0.028, 0.36], BRASS_D, [s * 0.5, 0.58, 1.885], { metal: 0.28, rough: 0.46, rotX: 0.349 })); // raked handrail
  });
  g.add(box(t, [0.92, 0.04, 0.46], IRON_P, [0, 0.07, 2.3], { tex: 'metal', repeat: [6, 1], metal: 0.24, rough: 0.7, rotX: 0.2 })); // threshold RAMP: apron 0.03 up to the bottom ledge 0.11

  // =========================================================================
  // 2. THE LATTICE MAST — one merged mesh: plinth-to-crown posts, six bays of
  //    crossed bracing on all four faces, horizontal ties at every bay line.
  //    A diagonal is a box with its LENGTH on local +y, tipped by
  //    atan2(0.52, bay) so it lands corner to corner inside its own face.
  // =========================================================================
  g.add(box(t, [0.86, 0.14, 0.86], IRON_D, [0, 0.33, 0], { tex: 'metal', repeat: [6, 1], metal: 0.22, rough: 0.76 })); // bolted plinth (0.26..0.40)
  const mastParts: MergedBoxSpec[] = [];
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => mastParts.push({ dims: [0.08, 2.56, 0.08], pos: [sx * 0.26, 1.62, sz * 0.26], repeat: [1, 12] })),
  );
  const BAYS = 6;
  const Y0 = 0.44;
  const BAY = (2.84 - Y0) / BAYS; // 0.4
  const diag = Math.hypot(0.52, BAY);
  const tip = Math.atan2(0.52, BAY);
  for (let b = 0; b < BAYS; b += 1) {
    const ym = Y0 + (b + 0.5) * BAY;
    [-1, 1].forEach((s) => {
      // the two faces whose normal is ±x: the diagonal lies in the y-z plane
      mastParts.push({ dims: [0.032, diag, 0.032], pos: [s * 0.26, ym, 0], rotX: tip, repeat: [1, 3] });
      mastParts.push({ dims: [0.032, diag, 0.032], pos: [s * 0.26, ym, 0], rotX: -tip, repeat: [1, 3] });
      // the two faces whose normal is ±z: the diagonal lies in the x-y plane
      mastParts.push({ dims: [0.032, diag, 0.032], pos: [0, ym, s * 0.26], rotZ: tip, repeat: [1, 3] });
      mastParts.push({ dims: [0.032, diag, 0.032], pos: [0, ym, s * 0.26], rotZ: -tip, repeat: [1, 3] });
    });
  }
  for (let b = 0; b <= BAYS; b += 1) {
    const y = Y0 + b * BAY;
    [-1, 1].forEach((s) => {
      mastParts.push({ dims: [0.52, 0.042, 0.042], pos: [0, y, s * 0.26], repeat: [3, 1] });
      mastParts.push({ dims: [0.042, 0.042, 0.52], pos: [s * 0.26, y, 0], repeat: [1, 3] });
    });
  }
  g.add(mergedBoxes(t, mastParts, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.72, bump: 0.03 }));
  // gusset rivets at every post/tie node — 4 posts x 7 bay lines, ONE mesh
  const gussets: MergedBoxSpec[] = [];
  for (let b = 0; b <= BAYS; b += 1) {
    const y = Y0 + b * BAY;
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => gussets.push({ dims: [0.03, 0.024, 0.03], pos: [sx * 0.28, y, sz * 0.28] })));
  }
  const gussetMesh = mergedBoxes(t, gussets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.38 });
  gussetMesh.userData.lodDetail = true;
  g.add(gussetMesh);
  // the four FACE RAILS the carriage rollers ride, and the counterweights'
  // own guide rails inside the lattice
  [-1, 1].forEach((s) => {
    // the rails are IRON, not IRON_P: the only PALE verticals on this mast are
    // the hoist ropes, so a glance can tell rope from rail
    g.add(cyl(t, 0.022, 0.022, 2.36, IRON, [s * 0.285, 1.62, 0], { tex: 'metal', repeat: [1, 10], metal: 0.26, rough: 0.62, seg: 8 }));
    g.add(cyl(t, 0.022, 0.022, 2.36, IRON, [0, 1.62, s * 0.285], { tex: 'metal', repeat: [1, 10], metal: 0.26, rough: 0.62, seg: 8 }));
    [-1, 1].forEach((s2) => {
      const cwRail = cyl(t, 0.012, 0.012, 2.2, IRON_D, [s * CW_X, 1.6, s2 * 0.17], { metal: 0.26, rough: 0.62, seg: 6 });
      cwRail.userData.lodDetail = true;
      g.add(cwRail);
    });
  });

  // =========================================================================
  // 3. THE CROWN — cap plate, the two hoist sheaves on their brackets, the
  //    bevel gear the drive shaft turns them through, and the aether globe.
  // =========================================================================
  // NO full cap plate: a lid over the crown hides both sheaves at the
  // isometric camera elevation (the first pass did exactly that). Two spanning
  // beams at z ±0.26 carry the sheave brackets and leave the rope wheels in
  // plain sight between them.
  [-1, 1].forEach((s) => g.add(box(t, [0.84, 0.06, 0.09], IRON_P, [0, 2.95, s * 0.26], { tex: 'metal', repeat: [6, 1], metal: 0.26, rough: 0.62 })));
  g.add(box(t, [0.2, 0.05, 0.6], IRON_D, [0, 2.98, 0], { tex: 'metal', repeat: [1, 4], metal: 0.24, rough: 0.66 })); // finial saddle across them
  const sheaves: THREE.Group[] = [];
  [-1, 1].forEach((s) => {
    const sh = new t.Group();
    sh.position.set(s * SHEAVE_X, SHEAVE_Y, 0);
    g.add(sh);
    sh.add(cyl(t, SHEAVE_R, SHEAVE_R, 0.05, BRASS, [0, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.3, rough: 0.42, seg: 18, rotX: Math.PI / 2 })); // rope wheel
    sh.add(cyl(t, SHEAVE_R - 0.022, SHEAVE_R - 0.022, 0.07, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.3, rough: 0.46, seg: 18, rotX: Math.PI / 2 })); // rope groove between the flanges
    sh.add(cyl(t, 0.036, 0.036, 0.08, BRASS_L, [0, 0, 0], { metal: 0.32, rough: 0.34, seg: 10, rotX: Math.PI / 2 })); // hub
    for (let k = 0; k < 3; k += 1) sh.add(box(t, [0.024, SHEAVE_R * 1.7, 0.016], BRASS_D, [0, 0, 0], { metal: 0.3, rough: 0.4, rotZ: (k / 3) * Math.PI })); // spokes
    sheaves.push(sh);
    // the cheek plates that carry the axle, up to the crown beams
    [-1, 1].forEach((z) => g.add(box(t, [0.05, 0.2, 0.02], IRON_D, [s * SHEAVE_X, 2.87, z * 0.08], { metal: 0.24, rough: 0.66 })));
  });
  g.add(cyl(t, 0.11, 0.11, 0.04, BRASS_D, [0, 2.8, 0], { tex: 'metal', repeat: [5, 1], metal: 0.3, rough: 0.44, seg: 16 })); // bevel gear on the shaft top
  const bevelTeeth: MergedBoxSpec[] = [];
  for (let k = 0; k < 14; k += 1) {
    const a = (k / 14) * Math.PI * 2;
    bevelTeeth.push({ dims: [0.03, 0.03, 0.022], pos: P(a, 0.115, 2.8), rotY: -a });
  }
  const bevelMesh = mergedBoxes(t, bevelTeeth, BRASS_D, { metal: 0.3, rough: 0.44 });
  bevelMesh.userData.lodDetail = true;
  g.add(bevelMesh);
  // finial + the AETHER GLOBE (the ride's night beacon)
  g.add(cyl(t, 0.05, 0.09, 0.09, BRASS, [0, 3.0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.42, seg: 10 }));
  const globeMat = new t.MeshStandardMaterial({ color: 0xd8e6e0, emissive: 0x8fd0c0, emissiveIntensity: 0.1, roughness: 0.22, metalness: 0.12 });
  const globe = new t.Mesh(new t.SphereGeometry(0.085, 14, 10), globeMat);
  globe.position.y = 3.11;
  g.add(globe);
  g.add(cyl(t, 0.02, 0.03, 0.05, BRASS_L, [0, 3.21, 0], { metal: 0.32, rough: 0.36, seg: 8 }));
  const vane: MergedBoxSpec[] = [
    { dims: [0.2, 0.012, 0.03], pos: [0.06, 3.27, 0] },
    { dims: [0.05, 0.012, 0.09], pos: [-0.06, 3.27, 0] },
  ];
  const vaneMesh = mergedBoxes(t, vane, BRASS_L, { metal: 0.32, rough: 0.36 });
  vaneMesh.userData.lodDetail = true;
  g.add(vaneMesh);

  // =========================================================================
  // 4. THE HOIST LINE SHAFT — up the middle of the lattice from the winch's
  //    bevel box to the crown gear, so the crown sheaves are visibly DRIVEN
  //    rather than idling. Its bearing brackets tie to the ±z ties only: the
  //    counterweights ride the ±x lines and must have a clear bore.
  // =========================================================================
  const shaft = new t.Group();
  g.add(shaft);
  shaft.add(cyl(t, 0.045, 0.045, 2.38, IRON_P, [0, 1.61, 0], { tex: 'metal', repeat: [2, 10], metal: 0.28, rough: 0.52, seg: 12 }));
  const keys: MergedBoxSpec[] = [];
  for (let k = 0; k < 2; k += 1) keys.push({ dims: [0.012, 2.3, 0.012], pos: [k ? 0.05 : -0.05, 1.61, 0] });
  const keyMesh = mergedBoxes(t, keys, IRON_D, { metal: 0.28, rough: 0.56 });
  keyMesh.userData.lodDetail = true;
  shaft.add(keyMesh);
  shaft.add(cyl(t, 0.07, 0.07, 0.05, BRASS_D, [0, 0.44, 0], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.44, seg: 12 })); // thrust collar
  [0.84, 1.64, 2.44].forEach((y) => {
    const brk = mergedBoxes(
      t,
      [
        { dims: [0.05, 0.05, 0.2], pos: [0, y, 0.14] }, // shaft (r 0.045) -> the ±z tie inner face (0.24)
        { dims: [0.05, 0.05, 0.2], pos: [0, y, -0.14] },
      ],
      IRON,
      { metal: 0.26, rough: 0.64 },
    );
    brk.userData.lodDetail = true;
    g.add(brk); // static bearing brackets (the shaft turns inside them)
    g.add(cyl(t, 0.065, 0.065, 0.05, BRASS_D, [0, y, 0], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.44, seg: 10 }));
  });

  // =========================================================================
  // 5. THE BASE WINCH — bed, rope drum, pinion + spur gear, flywheel,
  //    governor, gauge, relief valve. Sits WELL INSIDE the gondola ring
  //    (mounted at radius 0.62, reaching 0.91, top y 0.80) so nothing it
  //    carries can be swept by an arm (arm plane 1.19) or fouled by a DOCKED
  //    gondola (inner face radius 1.046, underside 0.29).
  // =========================================================================
  // AZIMUTH MATTERS: at Math.PI * 1.18 (behind the mast) the whole winch was
  // invisible at the isometric camera — the machinery IS the theme, so it sits
  // on the mast's +x flank where a park actually looks at the ride from.
  const winchA = -Math.PI * 0.1;
  const winch = new t.Group();
  winch.position.set(...P(winchA, 0.62, DECK_TOP));
  winch.rotation.y = -winchA; // local +x = radially outward
  g.add(winch);
  winch.add(box(t, [0.58, 0.09, 0.44], IRON_D, [0, 0.045, 0], { tex: 'metal', repeat: [5, 1], metal: 0.22, rough: 0.76 })); // engine bed
  winch.add(box(t, [0.18, 0.24, 0.28], IRON, [-0.18, 0.21, 0], { tex: 'metal', repeat: [2, 2], metal: 0.24, rough: 0.7 })); // bevel box under the line shaft
  const drum = new t.Group();
  drum.position.set(0.08, 0.26, 0);
  winch.add(drum);
  drum.add(cyl(t, 0.15, 0.15, 0.32, IRON, [0, 0, 0], { tex: 'metal', repeat: [6, 2], metal: 0.24, rough: 0.66, seg: 16, rotZ: Math.PI / 2 }));
  [-1, 1].forEach((s) => drum.add(cyl(t, 0.19, 0.19, 0.03, IRON_P, [s * 0.17, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.26, rough: 0.6, seg: 16, rotZ: Math.PI / 2 }))); // flanges
  for (let k = 0; k < 7; k += 1) {
    const wrap = cyl(t, 0.158, 0.158, 0.03, IRON_D, [-0.12 + k * 0.04, 0, 0], { metal: 0.26, rough: 0.5, seg: 14, rotZ: Math.PI / 2 }); // rope wraps
    wrap.userData.lodDetail = true;
    drum.add(wrap);
  }
  drum.add(cyl(t, 0.06, 0.06, 0.05, BRASS_D, [-0.2, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.44, seg: 12, rotZ: Math.PI / 2 })); // drive pinion
  const spur = new t.Group();
  spur.position.set(-0.12, 0.06, 0);
  winch.add(spur);
  spur.add(cyl(t, 0.2, 0.2, 0.04, IRON_P, [0, 0, 0], { tex: 'metal', repeat: [8, 1], metal: 0.26, rough: 0.58, seg: 22, rotZ: Math.PI / 2 }));
  const spurTeeth: MergedBoxSpec[] = [];
  for (let k = 0; k < 20; k += 1) {
    const a = (k / 20) * Math.PI * 2;
    spurTeeth.push({ dims: [0.026, 0.05, 0.032], pos: [0, Math.cos(a) * 0.21, Math.sin(a) * 0.21], rotX: -a });
  }
  spur.add(mergedBoxes(t, spurTeeth, IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.58 }));
  for (let k = 0; k < 4; k += 1) spur.add(box(t, [0.022, 0.36, 0.03], IRON, [0, 0, 0], { metal: 0.24, rough: 0.62, rotX: (k / 4) * Math.PI })); // spokes
  const fly = new t.Group();
  fly.position.set(0.26, 0.3, 0);
  winch.add(fly);
  fly.add(cyl(t, 0.24, 0.24, 0.035, IRON, [0, 0, 0], { tex: 'metal', repeat: [9, 1], metal: 0.24, rough: 0.6, seg: 24, rotZ: Math.PI / 2 }));
  fly.add(cyl(t, 0.05, 0.05, 0.07, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.44, seg: 12, rotZ: Math.PI / 2 }));
  for (let k = 0; k < 5; k += 1) fly.add(box(t, [0.02, 0.44, 0.024], IRON_D, [0, 0, 0], { metal: 0.24, rough: 0.62, rotX: (k / 5) * Math.PI })); // spokes
  const gov = new t.Group();
  gov.position.set(-0.2, 0.36, 0);
  winch.add(gov);
  winch.add(cyl(t, 0.016, 0.016, 0.14, BRASS_D, [-0.2, 0.4, 0], { metal: 0.3, rough: 0.42, seg: 8 })); // governor column
  [-1, 1].forEach((s) => {
    gov.add(cyl(t, 0.008, 0.008, 0.12, BRASS_L, [s * 0.045, 0.1, 0], { metal: 0.32, rough: 0.36, seg: 6, rotZ: -s * 0.6 }));
    gov.add(ball(t, 0.03, BRASS_L, [s * 0.08, 0.05, 0], { metal: 0.32, rough: 0.34 }));
  });
  // the winch's own pressure gauge + relief valve (the steam origin)
  const winchGauge = new t.Group();
  winchGauge.position.set(-0.18, 0.3, 0.16);
  winch.add(winchGauge);
  winchGauge.add(cyl(t, 0.055, 0.055, 0.026, BRASS, [0, 0, 0], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.42, seg: 14, rotX: Math.PI / 2 }));
  winchGauge.add(cyl(t, 0.046, 0.046, 0.008, DIAL, [0, 0, 0.018], { rough: 0.76, seg: 14, rotX: Math.PI / 2 }));
  winchGauge.add(cyl(t, 0.055, 0.05, 0.008, BRASS_L, [0, 0, 0.022], { tex: 'metal', repeat: [4, 1], metal: 0.32, rough: 0.34, seg: 14, rotX: Math.PI / 2 }));
  const gTicks: MergedBoxSpec[] = [];
  for (let k = 0; k < 9; k += 1) {
    const a = -2.2 + (k / 8) * 4.4;
    gTicks.push({ dims: [0.005, 0.012, 0.005], pos: [Math.sin(a) * 0.036, Math.cos(a) * 0.036, 0.026], rotZ: -a });
  }
  const gTickMesh = mergedBoxes(t, gTicks, IRON_D, { rough: 0.82 });
  gTickMesh.userData.lodDetail = true;
  winchGauge.add(gTickMesh);
  const winchNeedle = box(t, [0.005, 0.042, 0.004], NEEDLE, [0, 0, 0.03], { rough: 0.62 });
  winchNeedle.geometry = winchNeedle.geometry.clone();
  winchNeedle.geometry.translate(0, 0.017, 0); // pivot at the dial centre
  winchGauge.add(winchNeedle);
  winch.add(cyl(t, 0.03, 0.036, 0.16, COPPER, [0.02, 0.4, -0.14], { tex: 'metal', repeat: [2, 2], metal: 0.22, rough: 0.6, seg: 10 })); // relief riser
  winch.add(cyl(t, 0.042, 0.032, 0.03, BRASS_L, [0.02, 0.49, -0.14], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.36, seg: 10 })); // valve cap
  const steamOrigin = new t.Vector3(0.02, DECK_TOP + 0.52, -0.14).applyAxisAngle(new t.Vector3(0, 1, 0), -winchA);
  steamOrigin.x += Math.cos(winchA) * 0.62;
  steamOrigin.z += Math.sin(winchA) * 0.62;

  // a gaslight standard beside the boarding steps — OFF the deck, at radius
  // 2.29 on the clinker apron, because ANYTHING inside radius 1.79 at deck
  // height is inside the docked gondolas' own sweep. (The second and last real
  // PointLight lives here.)
  const lampMat = new t.MeshStandardMaterial({ color: 0xfff0cc, emissive: 0xffb050, emissiveIntensity: 0.12, roughness: 0.3 });
  const post = new t.Group();
  post.position.set(-1.62, 0.02, 1.62);
  g.add(post);
  post.add(cyl(t, 0.04, 0.055, 0.08, IRON_D, [0, 0.04, 0], { tex: 'metal', repeat: [2, 1], metal: 0.22, rough: 0.74, seg: 10 }));
  post.add(cyl(t, 0.026, 0.032, 0.78, IRON, [0, 0.47, 0], { tex: 'metal', repeat: [2, 6], metal: 0.24, rough: 0.66, seg: 10 }));
  post.add(cyl(t, 0.05, 0.04, 0.05, BRASS_D, [0, 0.88, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.44, seg: 10 }));
  const postFlame = new t.Mesh(new t.SphereGeometry(0.05, 10, 8), lampMat);
  postFlame.position.y = 0.94;
  post.add(postFlame);
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => post.add(cyl(t, 0.007, 0.007, 0.14, BRASS, [sx * 0.045, 0.94, sz * 0.045], { metal: 0.3, rough: 0.4, seg: 6 }))),
  );
  post.add(cyl(t, 0.062, 0.046, 0.03, BRASS_L, [0, 1.03, 0], { tex: 'metal', repeat: [3, 1], metal: 0.32, rough: 0.36, seg: 10 }));

  // =========================================================================
  // 6. THE CARRIAGE + ARM SPIDER + SIX GONDOLAS
  //    `hoist` carries everything that rises. Inside it the SLEEVE keeps its
  //    azimuth (its cable lugs must never be swept by an arm) and the SPIDER
  //    turns on the slew ring at the sleeve's foot.
  // =========================================================================
  const hoist = new t.Group();
  hoist.position.y = ARM_Y0;
  g.add(hoist);
  // a SQUARE tube of four riveted plates, 0.66 across the flats — its own
  // corners land at radius 0.506, which is what sets R_SLEW (0.56): a rotating
  // ring any tighter than that would saw straight through them
  const sleeve = new t.Group();
  hoist.add(sleeve);
  [-1, 1].forEach((s) => {
    sleeve.add(box(t, [0.05, SLEEVE_H, 0.66], IRON_P, [s * 0.33, SLEEVE_H / 2, 0], { tex: 'metal', repeat: [1, 4], metal: 0.26, rough: 0.62 }));
    sleeve.add(box(t, [0.66, SLEEVE_H, 0.05], IRON_P, [0, SLEEVE_H / 2, s * 0.33], { tex: 'metal', repeat: [4, 1], metal: 0.26, rough: 0.62 }));
  });
  [0.035, SLEEVE_H - 0.035].forEach((y) => {
    [-1, 1].forEach((s) => {
      sleeve.add(box(t, [0.66, 0.045, 0.08], IRON_D, [0, y, s * 0.33], { tex: 'metal', repeat: [5, 1], metal: 0.24, rough: 0.66 }));
      sleeve.add(box(t, [0.08, 0.045, 0.66], IRON_D, [s * 0.33, y, 0], { tex: 'metal', repeat: [1, 5], metal: 0.24, rough: 0.66 }));
    });
  });
  // guide rollers on the four face rails, and the two cable lugs on top
  // eight guide rollers, two per face rail. The ORIENTATION lives on the
  // parent group and the SPIN on the wheel's own local +y axis, so one
  // `rotation.y` per wheel is right whichever rail it rides.
  const rollers: THREE.Mesh[] = [];
  [-1, 1].forEach((s) => {
    [
      [s * 0.285, 0],
      [0, s * 0.285],
    ].forEach(([x, z]) => {
      [0.08, SLEEVE_H - 0.08].forEach((y) => {
        const mount = new t.Group();
        mount.position.set(x, y, z);
        mount.rotation.set(z === 0 ? Math.PI / 2 : 0, 0, z === 0 ? 0 : Math.PI / 2);
        sleeve.add(mount);
        const wheel = cyl(t, 0.035, 0.035, 0.03, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.42, seg: 10 });
        mount.add(wheel);
        rollers.push(wheel);
      });
    });
  });
  [-1, 1].forEach((s) => {
    sleeve.add(box(t, [0.12, 0.05, 0.07], IRON_P, [s * 0.36, SLEEVE_H + 0.01, 0], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.62 })); // lug bracket off the sleeve
    sleeve.add(box(t, [0.08, 0.09, 0.09], IRON_D, [s * LUG_X, SLEEVE_H + 0.03, 0], { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.66 })); // cable lug
    sleeve.add(cyl(t, 0.016, 0.016, 0.11, BRASS_L, [s * LUG_X, SLEEVE_H + 0.02, 0], { metal: 0.32, rough: 0.36, seg: 8, rotX: Math.PI / 2 })); // shackle pin
  });
  // THE SLEW DRIVE, on the carriage where a real balloon tower carries it: a
  // brass gearbox bolted to the sleeve's +x face with a vertical PINION at
  // radius 0.46 (outer 0.52) engaging the toothed inner face of the slew ring
  // (0.52). The gearbox rides the SLEEVE, the ring turns with the spider —
  // which is exactly what "the arms rotate at every height" means.
  sleeve.add(box(t, [0.14, 0.2, 0.18], BRASS_D, [0.42, 0.2, 0], { tex: 'metal', repeat: [1, 2], metal: 0.3, rough: 0.46 }));
  sleeve.add(box(t, [0.16, 0.04, 0.2], IRON_D, [0.42, 0.09, 0], { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.66 })); // motor bed
  const pinion = new t.Group();
  pinion.position.set(0.46, 0.02, 0);
  sleeve.add(pinion);
  pinion.add(cyl(t, 0.055, 0.055, 0.06, BRASS_L, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.32, rough: 0.4, seg: 12 }));
  const pinTeeth: MergedBoxSpec[] = [];
  for (let k = 0; k < 10; k += 1) {
    const a = (k / 10) * Math.PI * 2;
    pinTeeth.push({ dims: [0.022, 0.055, 0.018], pos: P(a, 0.058, 0), rotY: -a });
  }
  const pinTeethMesh = mergedBoxes(t, pinTeeth, BRASS_L, { metal: 0.32, rough: 0.4 });
  pinTeethMesh.userData.lodDetail = true;
  pinion.add(pinTeethMesh);
  sleeve.add(cyl(t, 0.014, 0.014, 0.14, BRASS_D, [0.46, 0.1, 0], { metal: 0.3, rough: 0.42, seg: 8 })); // pinion shaft up into the box

  const spider = new t.Group();
  hoist.add(spider);
  const slewRing = new t.Mesh(new t.TorusGeometry(R_SLEW, 0.04, 8, 30), mat(t, IRON_P, { tex: 'metal', repeat: [14, 1], metal: 0.26, rough: 0.58 }));
  slewRing.rotation.x = Math.PI / 2;
  slewRing.position.y = 0.02;
  slewRing.castShadow = true;
  spider.add(slewRing);
  // the ring's INNER gear teeth (what the carriage pinion drives)
  const ringTeeth: MergedBoxSpec[] = [];
  for (let k = 0; k < 30; k += 1) {
    const a = (k / 30) * Math.PI * 2;
    ringTeeth.push({ dims: [0.03, 0.05, 0.026], pos: P(a, R_SLEW - 0.045, 0.02), rotY: -a });
  }
  const ringTeethMesh = mergedBoxes(t, ringTeeth, IRON_D, { metal: 0.26, rough: 0.6 });
  ringTeethMesh.userData.lodDetail = true;
  spider.add(ringTeethMesh);
  const stayRing = new t.Mesh(new t.TorusGeometry(R_SLEW - 0.02, 0.026, 6, 26), mat(t, IRON, { metal: 0.26, rough: 0.6 }));
  stayRing.rotation.x = Math.PI / 2;
  stayRing.position.y = SLEEVE_H - 0.04;
  spider.add(stayRing);
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    spider.add(box(t, [0.06, SLEEVE_H - 0.06, 0.06], IRON, P(a, R_SLEW - 0.01, (SLEEVE_H - 0.04) / 2), { tex: 'metal', repeat: [1, 3], metal: 0.26, rough: 0.6, rotY: -a })); // ring standards
  }
  // six arms + six stays: ONE merged mesh (they never move inside the spider)
  const armParts: MergedBoxSpec[] = [];
  const ARM_IN = R_SLEW; // arms are welded to the slew ring, never inside it
  const stayLen = Math.hypot(R_ARM - ARM_IN, SLEEVE_H - 0.04);
  const stayTip = Math.atan2(SLEEVE_H - 0.04, R_ARM - ARM_IN);
  for (let i = 0; i < N_GOND; i += 1) {
    const a = (i / N_GOND) * Math.PI * 2;
    armParts.push({ dims: [R_ARM - ARM_IN + 0.06, 0.055, 0.085], pos: P(a, (ARM_IN + R_ARM) / 2 + 0.03, 0.05), rotY: -a, repeat: [8, 1] }); // main beam, just OVER the pivot line
    armParts.push({ dims: [0.5, 0.032, 0.032], pos: P(a, 0.86, -0.02), rotY: -a, repeat: [4, 1] }); // lower tie
    armParts.push({ dims: [stayLen, 0.028, 0.028], pos: P(a, (ARM_IN + R_ARM) / 2, (SLEEVE_H - 0.04) / 2 + 0.05), rotY: -a, rotZ: -stayTip, repeat: [5, 1] }); // stay off the upper ring
    armParts.push({ dims: [0.1, 0.1, 0.11], pos: P(a, R_ARM, 0.05), rotY: -a }); // arm-end bearing block, wrapping the pin
  }
  spider.add(mergedBoxes(t, armParts, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.64, bump: 0.03 }));
  // arm rivet plates (lodDetail)
  const armRivets: MergedBoxSpec[] = [];
  for (let i = 0; i < N_GOND; i += 1) {
    const a = (i / N_GOND) * Math.PI * 2;
    for (let k = 0; k < 4; k += 1) armRivets.push({ dims: [0.02, 0.02, 0.014], pos: P(a, 0.66 + k * 0.24, 0.05), rotY: -a });
  }
  const armRivetMesh = mergedBoxes(t, armRivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.38 });
  armRivetMesh.userData.lodDetail = true;
  spider.add(armRivetMesh);

  const gondolaLampMat = new t.MeshStandardMaterial({ color: 0xfff0cc, emissive: 0xffb050, emissiveIntensity: 0.1, roughness: 0.3 });
  const hangers: THREE.Group[] = [];
  const gondolas: THREE.Group[] = [];
  for (let i = 0; i < N_GOND; i += 1) {
    const a = (i / N_GOND) * Math.PI * 2;
    const hanger = new t.Group();
    hanger.position.set(...P(a, R_ARM, 0)); // the pivot IS the arm plane, so FLOOR_DOCK is exact
    hanger.rotation.y = -a; // local +x radially outward, +z tangential
    spider.add(hanger);
    hangers.push(hanger);
    const rig = gondolaRig(t, i, { riders: withRiders, lampMat: gondolaLampMat });
    rig.group.position.y = -HANGER; // the pivot pin sits AT the arm end
    hanger.add(rig.group);
    gondolas.push(rig.group);
    rig.seats.forEach((s) => seats.push(s));
  }

  // =========================================================================
  // 7. THE LIVE CABLES + COUNTERWEIGHTS. Each cable is a unit-height cylinder
  //    whose position/scale.y are rewritten per frame from its two endpoints —
  //    the risers SHORTEN as the carriage climbs, the falls LENGTHEN as the
  //    counterweights drop, and the sheaves turn at the rope speed.
  // =========================================================================
  const riser: THREE.Mesh[] = [];
  const fall: THREE.Mesh[] = [];
  const cws: THREE.Group[] = [];
  [-1, 1].forEach((s) => {
    // 0.019 and PALE, not 0.011 and soot: a dark hair-thin rope inside a dark
    // lattice is invisible at park zoom and the hoist stops reading as a hoist
    const r = cyl(t, 0.022, 0.022, 1, ROPE, [s * LUG_X, 0, 0], { metal: 0.3, rough: 0.5, seg: 6 });
    g.add(r);
    riser.push(r);
    const f = cyl(t, 0.022, 0.022, 1, ROPE, [s * CW_X, 0, 0], { metal: 0.3, rough: 0.5, seg: 6 });
    g.add(f);
    fall.push(f);
    const cw = new t.Group();
    cw.position.set(s * CW_X, CW_TOP, 0);
    g.add(cw);
    cws.push(cw);
    // PALE cast iron on purpose: seen THROUGH the lattice a dark slab is just
    // more shadow, and the counterweight's motion is the whole point
    cw.add(box(t, [0.14, 0.15, 0.3], IRON_P, [0, 0.08, 0], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.7 })); // stacked slabs
    cw.add(box(t, [0.14, 0.15, 0.3], IRON, [0, -0.08, 0], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.72 }));
    cw.add(box(t, [0.16, 0.03, 0.34], BRASS_D, [0, 0.17, 0], { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.5 })); // cap + shackle
    cw.add(cyl(t, 0.016, 0.016, 0.06, BRASS_L, [0, 0.21, 0], { metal: 0.32, rough: 0.36, seg: 6 }));
    [-1, 1].forEach((s2) => {
      const shoe = box(t, [0.03, 0.05, 0.03], BRASS_D, [0, 0.14, s2 * 0.17], { metal: 0.3, rough: 0.42 }); // guide shoes on the rails
      shoe.userData.lodDetail = true;
      cw.add(shoe);
    });
  });
  /** stretch a unit-height cable between two heights on its own vertical line */
  const spanCable = (m: THREE.Mesh, y0: number, y1: number) => {
    const len = Math.max(0.02, y1 - y0);
    m.position.y = (y0 + y1) / 2;
    m.scale.y = len;
  };
  // SPAN THEM AT BUILD TIME TOO: a unit cylinder still centred at y 0 pushes the
  // group's Box3 to −0.5, and `registerComposedRide` measures that box for the
  // hut clearance before the first frame ever runs
  riser.forEach((m) => spanCable(m, ARM_Y0 + SLEEVE_H + 0.02, SHEAVE_Y));
  fall.forEach((m) => spanCable(m, CW_TOP + 0.19, SHEAVE_Y));

  // ---- night lighting: the crown beacon + the deck gaslight (2 lights) -----
  const beacon = new t.PointLight(0x9fe0d0, 0, 5.5, 2);
  beacon.position.set(0, 3.11, 0);
  g.add(beacon);
  const deckLight = new t.PointLight(0xffb968, 0, 4.4, 2);
  deckLight.position.set(-1.62, 1.0, 1.62);
  g.add(deckLight);

  // ---- the relief valve's steam: 24 particles ------------------------------
  let steam: ReturnType<typeof buildEmitter> | null = null;
  if (wantFx) {
    steam = buildEmitter(t, {
      max: 24,
      rate: 8,
      life: 1.8,
      lifeVar: 0.4,
      velocity: [0.07, 0.44, 0.02],
      spread: 0.12,
      gravity: -0.05,
      size: 0.07,
      sizeEnd: 0.26,
      color: 0xe8e4dc,
      colorEnd: 0xbdb8b0,
      opacity: 0.34,
    });
    steam.setOrigin(steamOrigin.x, steamOrigin.y, steamOrigin.z);
    g.add(steam.points);
  }

  // =========================================================================
  // THE UPDATER — ABSOLUTE time in, everything geared off ONE cycle phase.
  // `motionK` is the motion gate's eased 0..1 envelope: it scales the hoist
  // travel and the sway, so a PARKED ride is docked, level and still.
  // =========================================================================
  const update = (time: number, motionK = 1) => {
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    // 1. lights + emissives — gaslight and aether globe, strictly after dark
    lampMat.emissiveIntensity = 0.12 + (1.35 + 0.1 * Math.sin(time * 2.9) - 0.12) * ease;
    bulbMat.emissiveIntensity = 0.15 + (1.3 + 0.09 * Math.sin(time * 3.1) - 0.15) * ease;
    gondolaLampMat.emissiveIntensity = 0.1 + (1.15 + 0.08 * Math.sin(time * 3.4) - 0.1) * ease;
    globeMat.emissiveIntensity = 0.1 + (1.5 + 0.22 * Math.sin(time * 1.3) - 0.1) * ease;
    beacon.intensity = ease * 1.1;
    deckLight.intensity = ease * 1.15;
    // 2. the cycle: dwell docked -> rise -> hold -> descend -> docked
    const p = ((time % PERIOD) + PERIOD) / PERIOD - Math.floor(((time % PERIOD) + PERIOD) / PERIOD);
    const rp = riseProfile(p);
    const h = LIFT * rp * motionK;
    hoist.position.y = ARM_Y0 + h;
    // 3. rotation: the spider turns on the gated clock, so it freezes parked.
    //    The carriage pinion is geared off the ring it drives — ring radius
    //    0.52 : pinion 0.058, so 8.97 turns of pinion per turn of spider.
    const ang = time * OMEGA;
    spider.rotation.y = ang;
    pinion.rotation.y = -ang * (0.52 / 0.058);
    // 4. the hoist train, geared EXACTLY off the travel: drum r 0.15, its
    //    pinion 0.06 into the 0.20 spur, the line shaft up to the crown, and
    //    both sheaves paying rope at exactly the carriage's own speed
    drum.rotation.x = h / 0.15;
    spur.rotation.x = -(h / 0.15) * 0.3;
    shaft.rotation.y = -(h / 0.15) * 1.6;
    sheaves.forEach((sh, i) => (sh.rotation.z = (i === 0 ? -1 : 1) * (h / SHEAVE_R)));
    fly.rotation.x = ang * 3.1 + h * 2.4;
    gov.rotation.y = ang * 5.2;
    rollers.forEach((r, i) => (r.rotation.y = (h / 0.035) * (i % 2 ? -1 : 1)));
    winchNeedle.rotation.z = -(-1.5 + 2.2 * riseProfile(p) + 0.1 * Math.sin(time * 3.1));
    // 5. counterweights DESCEND as the gondolas rise; the cables follow
    cws.forEach((cw) => (cw.position.y = CW_TOP - h));
    riser.forEach((m) => spanCable(m, ARM_Y0 + h + SLEEVE_H + 0.02, SHEAVE_Y));
    fall.forEach((m) => spanCable(m, CW_TOP - h + 0.19, SHEAVE_Y));
    // 6. the gondolas SWAY: an outward lean from the rotation (centrifugal,
    //    ∝ ω²) plus a gentle hashed tangential rock, faded with motionK so a
    //    docked gondola hangs dead level for boarding — AND faded with the
    //    HOIST as well, which is the part that had to be measured.
    //    A docked gondola's floor is 0.34 and the deck plate's top is 0.26, so
    //    there are only 30 mm under a pan whose underside is 0.29 and whose rim
    //    is 0.32 out from the pivot line. A 0.08-rad tilt eats 29 mm of that:
    //    swept over the cycle the pan's outer bottom edge reached y 0.2588 —
    //    1.2 mm INSIDE the deck it is supposed to hover over, at a phase no
    //    rest-pose check can see (probe: /tmp/mp3d-render/aud-brass-clip.tsx).
    //    Scaling the sway by the rise leaves the gondolas settled while they are
    //    near the plate and lively while they are up, which is both the right
    //    read and 27 mm of measured clearance.
    const swayK = motionK * (0.15 + 0.85 * rp);
    const lean = 0.06 * swayK * swayK;
    hangers.forEach((hg, i) => {
      const ph = hash01(i * 5.7) * Math.PI * 2;
      hg.rotation.z = lean + Math.sin(time * 0.9 + ph) * 0.018 * swayK;
      hg.rotation.x = Math.sin(time * 1.23 + ph * 1.7) * 0.05 * swayK;
    });
    steam?.update(time);
  };

  // station gate: PARKED through waitingForPassengers / waitingToDepart /
  // unloadingPassengers, eased 0->1 on departing, and a LONG spinDown (1.8 s)
  // so the arriving gondolas settle onto the deck instead of dropping onto it
  const gate = createMotionGate((tt, k) => update(tt, k), { spinDown: 1.8 });
  return {
    group: g,
    update: gate.update,
    vehicle: gondolas[0], // the RideViewer follow cam rides gondola 0
    seatWorld: makeSeatWorld(t, seats),
    onStateChange: gate.onStateChange,
    dispose() {
      steam?.dispose();
      lampMat.dispose();
      bulbMat.dispose();
      bulbGeo.dispose();
      gondolaLampMat.dispose();
      globeMat.dispose();
      beacon.dispose();
      deckLight.dispose();
    },
  };
}

export interface AetherBalloonsProps extends AetherBalloonsOpts {}

/** local access geometry: the deck reaches radius 2.14, so the queue hut
 *  (which spans front−1.12 … front−0.12) stands clear of it and the railing
 *  GAP faces the lane; the exit hut sits flush off the −x edge. */
const AETHER_LAYOUT: RideLayout = {
  // measured: the built footprint spans x ±2.37, z −2.33…2.53, so the chassis'
  // compact-ride rule wants front ≥ 2.53 + 1.27 = 3.80 and the exit flush at
  // x ≤ −2.99. Both are written down rather than left to the auto-correction.
  front: 3.8,
  exit: [-3.0, 1.4],
  board: [0, DECK_TOP + 0.04, 1.1],
  defaults: { name: 'Aether Balloons', capacity: N_GOND * SEATS_PER, rideDuration: 14, intensity: 2, price: 3 },
};

/** <AetherBalloons> — "Aether Balloons", the Brasswork Foundry world's stately
 *  family flat ride, composable (components/Park/Context.md): six ornate
 *  brass-and-glass gondolas rotating around a riveted lattice mast WHILE a
 *  cable hoist lifts them, with visible counterweights, crown sheaves, a
 *  splined drive shaft and a base winch. Mounts at `position`/`rotation`;
 *  inside a <Park>, `register` wires the full GameManager ride — queue HEAD
 *  3.5 out the local +z front (which is where the deck railing's boarding GAP
 *  is), exit hut at local [-2.8, 1.4], boarding on the deck at [0, 0.30, 1.1].
 *  Capacity 12 = 6 gondolas x 2 places: REAL guests ride the leather cushions
 *  via `seatWorld` (decorative riders off when registered) and the ride is
 *  motion-gated — docked, level and still for boarding, easing into rotation
 *  and lift on departure. Override with top-level props / `queue`. */
export const AetherBalloons = composableRide<AetherBalloonsProps>(
  'AetherBalloons',
  (t, props) =>
    buildAetherBalloonsScene(t, {
      riders: props.riders ?? !(props as { register?: unknown }).register,
      effects: props.effects,
    }),
  AETHER_LAYOUT,
);
