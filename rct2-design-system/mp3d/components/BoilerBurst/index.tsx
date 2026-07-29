import * as THREE from 'three';
import { ball, box, cyl, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';
import type { ComposableRideBuilt, RideLayout } from '../Park';

// ---------------------------------------------------------------------------
// BOILER BURST — the BRASSWORK FOUNDRY world's spinner, themed as the foundry's
// PRESSURE-TEST RIG: eight riveted test carts circle a live boiler on a
// turntable, each cart spinning on its own valve hub, while the boiler winds
// itself up and VENTS — four brass nozzles blowing steam across the ride.
//
// THE VENT IS THE RIDE, AND IT IS TELEGRAPHED. The big gauge bolted to the
// boiler's front — the face the QUEUE looks at — has a needle that CLIMBS
// toward a red danger arc over a FIXED 3.6 s period; at the top the safety
// valve lever pops, the pressure lamp flashes, the whistle shrieks and all four
// nozzles blow for 0.55 s. Then the needle drops to zero and starts climbing
// again, so a rider always knows what is coming.
//
// THE RHYTHM RUNS OFF THE ABSOLUTE CLOCK, NOT THE GATED ONE:
//
//   vent index = floor(time / VENT_PERIOD)
//
// A burst fires on the frame that index changes, and the jet decays from
// `index · VENT_PERIOD` (the ideal vent instant, not the frame time), so the
// rhythm is frame-rate independent and bit-identical run to run — no
// Math.random, no Date.now. `userData.ventPeriod` / `userData.ventCount` expose
// it to probes. A pressure rig vents whether or not the carts are turning, so
// `ventUpdate` sits OUTSIDE the motion gate — and so do the night lights, which
// must not freeze with a parked ride.
//
// The carts are the other half of the theme: an iron test tub banded in brass
// with a full-size VALVE HANDWHEEL on its outboard face (the thing a rider
// grips — and it spins), its own little gauge, a copper relief loop over the
// back, a stencilled test number, and a moulded seat with a leather cushion.
// They spin waltzer-style at hashed rates in alternating directions and the
// seat anchors ride the spin, so REAL GameManager guests go round twice: once
// about the boiler, once about their own hub.
//
// SCALE — checked against components/Teacups (deck r 1.95) and
// components/Carousel (base r 1.86): static base radius 2.05, turntable top
// y 0.28, cart floors 0.34, cart rims 0.60, riders' heads ≈ 0.90, boiler crown
// 1.86, chimney cap 2.19. A park guest is ≈ 0.55 tall.
//
// PALETTE — the Brasswork Foundry values (BrassworkScenery's BRASSWORK, the
// same brass/copper/iron GoggleWorks uses). METALNESS CEILING 0.34: a
// MeshStandardMaterial at metalness ≥ 0.6 with no environment map renders
// NEAR-BLACK, because metals are lit only by reflections and this Stage has a
// sun and nothing to reflect. The brass comes from COLOUR + TEXTURE + rivets,
// never from metalness, and there is no shiny gold anywhere.
//
// Budgets: 3 real PointLights (the firebox — which keeps a small ember floor by
// DAY, because a lit fire is lit — plus a night-gated deck flood and a
// night-gated vent flash), 140 particles (4 vent nozzles at 30 + a 20-particle
// chimney wisp that also throws the whistle burst), rivets / gauge ticks / ring
// gear teeth / rust weeps batched through `mergedBoxes` and tagged
// `userData.lodDetail`.
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---- the Brasswork Foundry metals (BrassworkScenery.BRASSWORK) -------------
const BRASS = 0xb2913f;
const BRASS_D = 0x86682f;
const BRASS_L = 0xd0b26a;
const COPPER = 0x96603a;
const VERDIGRIS = 0x36483a;
const IRON = 0x615c53;
const IRON_D = 0x38342e;
const IRON_P = 0x8a8378;
const SOOT = 0x241f1b;
const RUST = 0x8a5230;
const CINDER = 0x433d35;
const FIREBRICK = 0x7a5b48;
const LEATHER = 0x6b3a2a;
const DIAL = 0xe8e0cc;
const NEEDLE = 0x8c2318;
const FIRE_HOT = 0xffb060;
const FIRE_DEEP = 0xc9440e;

// ---- the ride's dimensions, in ONE place -----------------------------------
const BASE_R = 2.05; // static base ring
const DECK_TOP = 0.28; // rotating turntable top
const R_CAR = 1.35; // cart hub radius
const CAR_FLOOR = 0.34; // cart floor height (deck top + 0.06 of chassis)
const N_CARS = 8;
const OMEGA = 0.85; // turntable rotation, rad/s at full speed
const VENT_PERIOD = 3.6; // seconds between vents — FIXED, off ABSOLUTE time
const VENT_JET = 0.9; // how long each nozzle keeps blowing after the pop
const VENT_LEAK = 6; // particles/s each nozzle wisps BETWEEN vents — a test rig LEAKS, and
// a still frame at a random phase must still read as "venting" (the 0.9 s blast
// is only a quarter of the 3.6 s period)

/** capacity IS the seat count (one seat per cart): `makeSeatWorld`'s modulo
 *  must never double two riders into one cushion. */
export const BOILER_BURST_CAPACITY = N_CARS;

/** polar helper: azimuth from +x toward +z. A part at `P(a, r)` with
 *  `rotation.y = -a` has its local +x pointing radially OUTWARD. */
const P = (a: number, r: number, y = 0): [number, number, number] => [Math.cos(a) * r, y, Math.sin(a) * r];

/** a pressure gauge facing local +Z, radius `r`, with the RED DANGER ARC at the
 *  top of the scale — a climbing needle needs a visible target, or the burst is
 *  sprung rather than telegraphed. Returns the group + its live needle (pivot
 *  already moved to the dial centre). */
function gaugeFace(t: typeof THREE, r: number): { group: THREE.Group; needle: THREE.Mesh } {
  const g = new t.Group();
  g.add(cyl(t, r, r, 0.04, BRASS, [0, 0, 0], { tex: 'metal', repeat: [5, 1], metal: 0.3, rough: 0.42, seg: 18, rotX: Math.PI / 2 })); // case
  g.add(cyl(t, r * 0.88, r * 0.88, 0.01, DIAL, [0, 0, 0.024], { rough: 0.76, seg: 18, rotX: Math.PI / 2 })); // dial
  g.add(cyl(t, r, r * 0.97, 0.012, BRASS_L, [0, 0, 0.03], { tex: 'metal', repeat: [5, 1], metal: 0.32, rough: 0.3, seg: 18, rotX: Math.PI / 2 })); // bezel
  const ticks: MergedBoxSpec[] = [];
  for (let k = 0; k < 11; k += 1) {
    const a = -1.45 + (k / 10) * 2.9;
    ticks.push({ dims: [r * 0.05, r * 0.2, 0.006], pos: [Math.sin(a) * r * 0.66, Math.cos(a) * r * 0.66, 0.034], rotZ: -a });
  }
  const tickMesh = mergedBoxes(t, ticks, IRON_D, { rough: 0.82 });
  tickMesh.userData.lodDetail = true;
  g.add(tickMesh);
  const danger: MergedBoxSpec[] = [];
  for (let k = 0; k < 3; k += 1) {
    const a = 1.05 + k * 0.2;
    danger.push({ dims: [r * 0.075, r * 0.24, 0.006], pos: [Math.sin(a) * r * 0.66, Math.cos(a) * r * 0.66, 0.036], rotZ: -a });
  }
  g.add(mergedBoxes(t, danger, NEEDLE, { rough: 0.7 }));
  const needle = box(t, [r * 0.07, r * 0.8, 0.008], NEEDLE, [0, 0, 0.042], { rough: 0.6 });
  needle.geometry = needle.geometry.clone();
  needle.geometry.translate(0, r * 0.33, 0); // pivot at the dial centre
  g.add(needle);
  g.add(cyl(t, r * 0.12, r * 0.12, 0.016, BRASS_L, [0, 0, 0.048], { metal: 0.32, rough: 0.32, seg: 10, rotX: Math.PI / 2 })); // boss
  return { group: g, needle };
}

// ===========================================================================
// THE TEST CART — local origin at the FLOOR CENTRE, +x radially outward (the
// way the seat faces at rest). The whole group SPINS about its own y.
//
// SEATS ARE REAL SEATS: moulded iron pan, buttoned leather cushion whose TOP
// sits exactly 0.225 above the floor, leaning backrest with its own cushion,
// lap bar on two uprights, footrest bar. 0.225 is arithmetic, not taste — a
// park guest is GUEST_SCALE 0.5 and a peep's hips sit at peep-local 0.45, so an
// anchor ON THE FLOOR lands a rider's hips ON the cushion and their feet ON the
// floor, whether the manager seats them (legs down, arms folded onto the bar)
// or a decorative `seated` peep takes the place.
// ===========================================================================
function cartRig(t: typeof THREE, idx: number, o: { riders?: boolean }): { group: THREE.Group; seat: THREE.Group; wheel: THREE.Group } {
  const g = new t.Group();

  // ---- the tub: riveted iron banded in brass, OPEN so the rider reads ------
  g.add(cyl(t, 0.28, 0.26, 0.06, IRON_D, [0, -0.03, 0], { tex: 'metal', repeat: [6, 1], metal: 0.24, rough: 0.7, seg: 10 })); // floor pan (top y 0)
  const tub = new t.Mesh(
    new t.CylinderGeometry(0.3, 0.27, 0.26, 10, 1, true),
    mat(t, IRON, { tex: 'metal', repeat: [8, 2], metal: 0.26, rough: 0.62, bump: 0.03 }),
  );
  tub.material.side = t.DoubleSide;
  tub.position.y = 0.13;
  tub.castShadow = true;
  tub.receiveShadow = true;
  g.add(tub);
  [0.06, 0.2].forEach((y, k) =>
    g.add(cyl(t, 0.307, 0.297, 0.035, BRASS, [0, y, 0], { tex: 'metal', repeat: [8, 1], metal: 0.3, rough: 0.44, seg: 10, rotY: k * 0.15 })),
  ); // hoop bands
  const rim = new t.Mesh(new t.TorusGeometry(0.303, 0.02, 6, 22), mat(t, BRASS_L, { metal: 0.32, rough: 0.34 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.26;
  rim.castShadow = true;
  g.add(rim);
  const cartRivets: MergedBoxSpec[] = [];
  for (let k = 0; k < 10; k += 1) {
    const a = (k / 10) * Math.PI * 2;
    [0.06, 0.2].forEach((y) => cartRivets.push({ dims: [0.016, 0.016, 0.012], pos: P(a, 0.31, y), rotY: -a }));
  }
  const cartRivetMesh = mergedBoxes(t, cartRivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.38 });
  cartRivetMesh.userData.lodDetail = true;
  g.add(cartRivetMesh);
  const weep: MergedBoxSpec[] = [];
  for (let k = 0; k < 5; k += 1) {
    const a = hash01(idx * 4.3 + k * 9.1) * Math.PI * 2;
    const h = 0.03 + hash01(k * 3.7 + idx) * 0.05;
    weep.push({ dims: [0.022, h, 0.008], pos: P(a, 0.297, 0.09 + h / 2), rotY: -a });
  }
  const weepMesh = mergedBoxes(t, weep, RUST, { tex: 'concrete', repeat: [1, 1], rough: 0.9, bump: 0.02 });
  weepMesh.userData.lodDetail = true;
  g.add(weepMesh);

  // ---- the seat ------------------------------------------------------------
  g.add(box(t, [0.17, 0.06, 0.34], IRON_D, [-0.1, 0.16, 0], { tex: 'metal', repeat: [2, 1], metal: 0.24, rough: 0.66 })); // pan shell, top 0.19
  g.add(box(t, [0.16, 0.04, 0.32], LEATHER, [-0.1, 0.205, 0], { tex: 'fabric', repeat: [2, 1], rough: 0.95, bump: 0.03 })); // CUSHION — top 0.225
  g.add(box(t, [0.045, 0.25, 0.3], IRON_D, [-0.2, 0.3, 0], { tex: 'metal', repeat: [1, 2], metal: 0.24, rough: 0.66, rotZ: -0.1 })); // backrest shell
  g.add(box(t, [0.03, 0.21, 0.26], LEATHER, [-0.174, 0.31, 0], { tex: 'fabric', repeat: [1, 2], rough: 0.95, bump: 0.03, rotZ: -0.1 })); // back cushion
  const buttons: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) buttons.push({ dims: [0.012, 0.012, 0.012], pos: [-0.162, 0.27 + (k % 2) * 0.07, -0.07 + Math.floor(k / 2) * 0.14] });
  const buttonMesh = mergedBoxes(t, buttons, BRASS_D, { metal: 0.3, rough: 0.4 });
  buttonMesh.userData.lodDetail = true;
  g.add(buttonMesh);
  g.add(cyl(t, 0.017, 0.017, 0.3, BRASS_L, [0.0, 0.3, 0], { metal: 0.32, rough: 0.34, seg: 8, rotX: Math.PI / 2 })); // LAP BAR
  [-0.13, 0.13].forEach((z) => g.add(box(t, [0.03, 0.13, 0.03], BRASS_D, [0, 0.24, z], { metal: 0.3, rough: 0.4 })));
  g.add(cyl(t, 0.014, 0.014, 0.28, BRASS_D, [0.12, 0.03, 0], { metal: 0.3, rough: 0.42, seg: 8, rotX: Math.PI / 2 })); // footrest bar

  const seat = new t.Group();
  seat.position.set(-0.1, 0, 0); // ON the floor, over the cushion
  seat.rotation.y = Math.PI / 2; // facing local +x — radially outward at rest
  g.add(seat);
  if (o.riders) {
    const p = buildPeep(t, {
      skin: SKIN_TONES[idx % SKIN_TONES.length],
      shirt: SHIRTS[(idx * 5) % SHIRTS.length],
      female: idx % 3 === 2,
      seated: true,
      expression: idx % 2 ? 'surprised' : 'happy',
    });
    p.group.scale.setScalar(0.5); // GameManager GUEST_SCALE
    p.group.userData.lodDetail = true;
    seat.add(p.group);
  }

  // ---- THE VALVE HANDWHEEL on the outboard face ----------------------------
  g.add(box(t, [0.07, 0.12, 0.16], IRON_P, [0.275, 0.19, 0], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.62 })); // valve body
  g.add(cyl(t, 0.022, 0.022, 0.1, BRASS_D, [0.305, 0.25, 0], { metal: 0.3, rough: 0.42, seg: 8, rotZ: -0.6 })); // stem
  // THE SWEEP BUDGET: hub spacing is 2·1.35·sin(π/8) = 1.033, so a spinning
  // cart may not reach past 0.516 from its own axis or neighbours collide. The
  // first pass (wheel r 0.13 centred at 0.40 → reach 0.53) did exactly that.
  const lean = new t.Group();
  lean.position.set(0.32, 0.3, 0);
  // YXZ ON PURPOSE: with the default XYZ order the x-tilt is applied about the
  // parent axis the wheel's own axis already lies on, so it does nothing. In
  // YXZ the yaw runs first and the tilt then leans the wheel BACK toward the
  // rider's hands, which is how a valve wheel is actually reached.
  lean.rotation.order = 'YXZ';
  lean.rotation.set(-0.5, Math.PI / 2, 0);
  g.add(lean);
  const wheel = new t.Group(); // THIS is what spins (about its own +z axis)
  lean.add(wheel);
  const hwR = 0.105; // reach = 0.32 + 0.105 + tube = 0.45 < 0.516
  const hw = new t.Mesh(new t.TorusGeometry(hwR, hwR * 0.2, 5, 18), mat(t, BRASS_L, { metal: 0.32, rough: 0.4 }));
  hw.castShadow = true;
  wheel.add(hw);
  for (let k = 0; k < 2; k += 1)
    wheel.add(cyl(t, hwR * 0.13, hwR * 0.13, hwR * 2, BRASS_L, [0, 0, 0], { metal: 0.32, rough: 0.4, seg: 6, rotZ: (k / 2) * Math.PI })); // spokes
  wheel.add(cyl(t, hwR * 0.32, hwR * 0.32, hwR * 0.5, BRASS_D, [0, 0, 0], { metal: 0.3, rough: 0.44, seg: 10, rotX: Math.PI / 2 })); // hub
  wheel.add(cyl(t, hwR * 0.18, hwR * 0.18, hwR * 0.55, BRASS_D, [hwR * 0.86, hwR * 0.5, 0], { metal: 0.3, rough: 0.44, seg: 6, rotX: Math.PI / 2 })); // grip knob
  // the cart's own little gauge, beside the handwheel — each reads its own
  // static test pressure (hashed, set once: this dial does not move)
  const cg = gaugeFace(t, 0.05);
  cg.group.position.set(0.255, 0.38, 0.15);
  cg.group.rotation.y = -0.9;
  cg.group.userData.lodDetail = true;
  cg.needle.rotation.z = -0.6 - hash01(idx * 7.1) * 1.4;
  g.add(cg.group);
  // A COPPER RELIEF LOOP ARCHING OVER THE BACK OF THE TUB — and "arching" took
  // a probe to become true. `rotation.set(π/2, 0, π/2)` in Euler XYZ maps the
  // torus's own ring plane onto the world x–z plane, so the first pass' half-ring
  // was HORIZONTAL: it lay across the open mouth of the tub at a constant
  // y 0.243-0.277, sweeping from (x −0.15, z +0.15) through x −0.30 and back,
  // with its outermost point buried inside the rim moulding's own tube
  // (0.283-0.323 radial, y 0.24-0.28). The cap that was meant to sit on its apex
  // was written at [−0.15, 0.42, 0] and therefore floated **0.120 u above the
  // pipe with nothing between**, on all eight carts — and, sitting directly
  // behind the rider's head, it also passed clean through the back hair of every
  // female rider (24.0 mm of hair-ball penetration, carts 2 and 5; probes
  // /tmp/mp3d-render/aud-brass-clip.tsx + aud-brass-cart.tsx).
  //
  // `rotation.set(0, −π/2, 0)` maps the ring plane onto y–z, which is the arch
  // that was always described: feet on the tub wall at (x −0.26, z ±0.15,
  // radius 0.30 — exactly where the shell and the rim moulding meet, so they
  // JOIN), rising over the back to an apex at y 0.41 with the cap on it. Pushed
  // out to x −0.26 it clears the backrest shell by 8.4 mm, the widest female
  // hair by 50 mm, and reaches only 0.296 from the cart's own hub — inside the
  // 0.5166 neighbour budget. Local −x is radially INWARD here, so this also
  // checks against the boiler: the cap's inner face stands 0.354 u off the
  // plinth it faces.
  const loop = new t.Mesh(new t.TorusGeometry(0.15, 0.017, 6, 16, Math.PI), mat(t, COPPER, { tex: 'metal', repeat: [4, 1], metal: 0.22, rough: 0.6 }));
  loop.rotation.set(0, -Math.PI / 2, 0);
  loop.position.set(-0.26, 0.26, 0);
  g.add(loop);
  g.add(cyl(t, 0.03, 0.036, 0.05, BRASS_D, [-0.26, 0.43, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.44, seg: 10 })); // loop cap, ON the apex
  const patina = box(t, [0.03, 0.05, 0.012], VERDIGRIS, [-0.29, 0.3, 0.02], { tex: 'concrete', repeat: [1, 1], rough: 0.88 });
  patina.userData.lodDetail = true;
  g.add(patina);
  // the stencilled test number on the tub flank (engraved bars, no text render)
  const stencil: MergedBoxSpec[] = [
    { dims: [0.012, 0.05, 0.008], pos: [0.06, 0.15, 0.29] },
    { dims: [0.012, 0.036, 0.008], pos: [0.02, 0.14, 0.3] },
  ];
  const stencilMesh = mergedBoxes(t, stencil, BRASS_L, { metal: 0.3, rough: 0.4 });
  stencilMesh.userData.lodDetail = true;
  g.add(stencilMesh);
  return { group: g, seat, wheel };
}

/** ONE test cart on its slew hub and a stub of turntable plate, for close-ups. */
export function buildBoilerCart(three: typeof THREE, opts: { riders?: boolean } = {}): THREE.Group {
  const t = three;
  const g = new t.Group();
  g.add(cartRig(t, 0, { riders: opts.riders ?? true }).group);
  g.add(cyl(t, 0.2, 0.22, 0.05, BRASS_D, [0, -0.085, 0], { tex: 'metal', repeat: [8, 1], metal: 0.3, rough: 0.46, seg: 16 }));
  g.add(cyl(t, 0.46, 0.48, 0.09, IRON_P, [0, -0.155, 0], { tex: 'metal', repeat: [10, 1], metal: 0.24, rough: 0.7, seg: 20 }));
  return g;
}

export interface BoilerBurstOpts {
  /** decorative peep riders in the carts (default true). A ride registered in a
   *  <Park> turns them off so the GameManager seats REAL guests via `seatWorld`. */
  riders?: boolean;
  /** the vent bursts + chimney wisp (default true) */
  effects?: boolean;
}

/** the Boiler Burst. Group origin on the ground at the boiler's axis; the
 *  BOARDING side — the fence gap, and the face the BIG GAUGE is bolted to, so
 *  the queue watches the needle climb — faces local +z. */
export function buildBoilerBurstScene(three: typeof THREE, opts: BoilerBurstOpts = {}): ComposableRideBuilt & {
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
  // 1. GROUND, STATIC BASE, TURNTABLE
  // =========================================================================
  const apron = cyl(t, 1, 1.04, 0.045, CINDER, [0, -0.006, 0], { tex: 'concrete', repeat: [14, 14], rough: 0.98, bump: 0.05, seg: 26 });
  apron.scale.set(2.45, 1, 2.38); // elliptical — a perfect circle of clinker reads as a dinner plate
  g.add(apron);
  g.add(cyl(t, BASE_R, BASE_R + 0.06, 0.12, IRON, [0, 0.06, 0], { tex: 'metal', repeat: [18, 1], metal: 0.2, rough: 0.78, seg: 32 })); // base ring
  g.add(cyl(t, 1.98, 2.02, 0.09, IRON_P, [0, 0.165, 0], { tex: 'metal', repeat: [16, 1], metal: 0.22, rough: 0.72, seg: 32 })); // the ledge the deck turns in
  // THE TURNTABLE is a full disc, not an annulus: it is CONCENTRIC with the
  // boiler plinth that stands on it, so the overlap can never show (a rotating
  // ring would be three more meshes and look identical).
  const deck = new t.Group();
  g.add(deck);
  deck.add(cyl(t, 1.9, 1.9, 0.1, IRON_P, [0, 0.23, 0], { tex: 'metal', repeat: [16, 1], metal: 0.24, rough: 0.68, seg: 32 })); // top 0.28
  deck.add(cyl(t, 1.92, 1.88, 0.07, IRON_D, [0, 0.185, 0], { tex: 'metal', repeat: [16, 1], metal: 0.22, rough: 0.74, seg: 32 })); // skirt
  const deckBits: MergedBoxSpec[] = [];
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    deckBits.push({ dims: [1.8, 0.014, 0.05], pos: P(a, 0.98, 0.283), rotY: -a, repeat: [8, 1] });
  }
  const deckSeams = mergedBoxes(t, deckBits, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.22, rough: 0.74 });
  deckSeams.userData.lodDetail = true;
  deck.add(deckSeams);
  const deckRivets: MergedBoxSpec[] = [];
  const ringTeeth: MergedBoxSpec[] = [];
  for (let k = 0; k < 44; k += 1) {
    const a = (k / 44) * Math.PI * 2;
    deckRivets.push({ dims: [0.02, 0.014, 0.02], pos: P(a, 1.82, 0.284), rotY: -a });
    ringTeeth.push({ dims: [0.05, 0.05, 0.04], pos: P(a, 1.935, 0.185), rotY: -a });
  }
  const deckRivetMesh = mergedBoxes(t, deckRivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.38 });
  deckRivetMesh.userData.lodDetail = true;
  deck.add(deckRivetMesh);
  deck.add(mergedBoxes(t, ringTeeth, IRON, { tex: 'metal', repeat: [1, 1], metal: 0.24, rough: 0.7 })); // THE RING GEAR

  // ---- the perimeter DRIVE UNIT (static): motor housing, a spur pinion into
  //      the turntable's ring gear, a spoked flywheel and a starting lever ---
  const driveA = -Math.PI * 0.22;
  const drive = new t.Group();
  drive.position.set(...P(driveA, 2.12, 0.12));
  drive.rotation.y = -driveA; // local +x radially outward
  g.add(drive);
  drive.add(box(t, [0.46, 0.1, 0.42], IRON_D, [0.1, 0.05, 0], { tex: 'metal', repeat: [4, 1], metal: 0.22, rough: 0.76 })); // bed
  drive.add(box(t, [0.24, 0.28, 0.3], IRON, [0.2, 0.23, 0], { tex: 'metal', repeat: [2, 2], metal: 0.24, rough: 0.7 })); // motor housing
  drive.add(box(t, [0.1, 0.06, 0.34], BRASS_D, [0.2, 0.4, 0], { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.46 })); // housing cap
  const drivePinion = new t.Group();
  drivePinion.position.set(-0.1, 0.135, 0);
  drive.add(drivePinion);
  drivePinion.add(cyl(t, 0.085, 0.085, 0.055, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.46, seg: 14 }));
  const dpTeeth: MergedBoxSpec[] = [];
  for (let k = 0; k < 10; k += 1) {
    const a = (k / 10) * Math.PI * 2;
    dpTeeth.push({ dims: [0.036, 0.055, 0.026], pos: P(a, 0.09, 0), rotY: -a });
  }
  const dpTeethMesh = mergedBoxes(t, dpTeeth, BRASS_D, { metal: 0.3, rough: 0.46 });
  dpTeethMesh.userData.lodDetail = true;
  drivePinion.add(dpTeethMesh);
  const driveFly = new t.Group();
  driveFly.position.set(0.34, 0.32, 0);
  drive.add(driveFly);
  driveFly.add(cyl(t, 0.19, 0.19, 0.03, IRON, [0, 0, 0], { tex: 'metal', repeat: [8, 1], metal: 0.24, rough: 0.62, seg: 20, rotZ: Math.PI / 2 }));
  driveFly.add(cyl(t, 0.045, 0.045, 0.06, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.44, seg: 10, rotZ: Math.PI / 2 }));
  for (let k = 0; k < 4; k += 1) driveFly.add(box(t, [0.018, 0.34, 0.022], IRON_D, [0, 0, 0], { metal: 0.24, rough: 0.64, rotX: (k / 4) * Math.PI })); // spokes
  drive.add(cyl(t, 0.02, 0.02, 0.38, IRON_P, [0.06, 0.3, 0.19], { metal: 0.26, rough: 0.6, seg: 8, rotZ: 0.3 })); // starting lever
  drive.add(ball(t, 0.032, BRASS_L, [0.12, 0.47, 0.19], { metal: 0.32, rough: 0.36 })); // lever knob

  // ---- the static perimeter fence, with a 60° gap facing +z ---------------
  // one SHARED emissive material for all eleven gas bulbs (no extra lights)
  const bulbGeo = new t.SphereGeometry(0.042, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  const fenceBits: MergedBoxSpec[] = [];
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    if (Math.abs(Math.sin(a) - 1) < 0.001) continue; // no post dead on +z
    g.add(cyl(t, 0.024, 0.028, 0.36, BRASS_D, P(a, 2.0, 0.3), { tex: 'metal', repeat: [1, 3], metal: 0.28, rough: 0.46, seg: 8 }));
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(...P(a, 2.0, 0.5)); // post top 0.48 — the bulb base embeds in it
    g.add(bulb);
    g.add(cyl(t, 0.036, 0.026, 0.02, BRASS_L, P(a, 2.0, 0.545), { metal: 0.32, rough: 0.36, seg: 8 }));
    const b = ((k + 1) / 12) * Math.PI * 2;
    const mid = (a + b) / 2;
    if (Math.abs(Math.sin(a) - 1) < 0.26 || Math.abs(Math.sin(b) - 1) < 0.26) continue; // leave the boarding gap open
    const chord = 2 * 2.0 * Math.sin(Math.PI / 12);
    [0.42, 0.26].forEach((y) => fenceBits.push({ dims: [0.028, 0.028, chord], pos: P(mid, 2.0 * Math.cos(Math.PI / 12), y), rotY: -mid, repeat: [1, 1] }));
  }
  g.add(mergedBoxes(t, fenceBits, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.28, rough: 0.46 }));
  [-1, 1].forEach((s) => {
    g.add(cyl(t, 0.022, 0.026, 0.4, BRASS_D, [s * 0.54, 0.28, 2.18], { tex: 'metal', repeat: [1, 3], metal: 0.28, rough: 0.46, seg: 8 }));
    g.add(box(t, [0.028, 0.028, 0.34], BRASS_D, [s * 0.54, 0.46, 2.34], { metal: 0.28, rough: 0.46, rotX: 0.3 })); // raked handrail into the gap
  });
  g.add(box(t, [0.96, 0.04, 0.44], IRON_P, [0, 0.08, 2.36], { tex: 'metal', repeat: [6, 1], metal: 0.24, rough: 0.7, rotX: 0.22 })); // threshold ramp

  // =========================================================================
  // 2. THE BOILER — static, on its own plinth on the turntable's axis.
  //    Firebox (glowing, day AND night) → riveted barrel with hoop bands →
  //    copper crown and dome → offset chimney → safety valve + whistle, with
  //    the BIG GAUGE on the +z face where the queue can read it.
  // =========================================================================
  const boiler = new t.Group();
  g.add(boiler);
  boiler.add(cyl(t, 0.66, 0.7, 0.16, IRON_D, [0, 0.36, 0], { tex: 'metal', repeat: [12, 1], metal: 0.22, rough: 0.76, seg: 20 })); // plinth 0.28..0.44
  boiler.add(cyl(t, 0.58, 0.62, 0.3, FIREBRICK, [0, 0.59, 0], { tex: 'concrete', repeat: [12, 2], rough: 0.95, bump: 0.05, seg: 20 })); // firebox 0.44..0.74
  boiler.add(cyl(t, 0.6, 0.6, 0.04, IRON, [0, 0.755, 0], { tex: 'metal', repeat: [12, 1], metal: 0.24, rough: 0.7, seg: 20 })); // firebox top plate
  // the barrel is TALL and slightly tapered (0.52 → 0.46 over 0.86): the first
  // pass at 0.55 with a 0.4 dome read as a brick kiln, not a boiler
  boiler.add(cyl(t, 0.46, 0.52, 0.86, IRON, [0, 1.17, 0], { tex: 'metal', repeat: [14, 3], metal: 0.26, rough: 0.62, bump: 0.03, seg: 22 })); // barrel 0.74..1.60
  const barrelR = (y: number) => 0.52 - (y - 0.74) * 0.0698; // the taper, in one place
  [0.82, 1.06, 1.3, 1.52].forEach((y, k) =>
    boiler.add(cyl(t, barrelR(y) + 0.015, barrelR(y) + 0.015, 0.05, BRASS, [0, y, 0], { tex: 'metal', repeat: [14, 1], metal: 0.3, rough: 0.44, seg: 22, rotY: k * 0.12 })),
  ); // hoop bands
  boiler.add(cyl(t, 0.34, 0.46, 0.14, COPPER, [0, 1.67, 0], { tex: 'metal', repeat: [12, 1], metal: 0.22, rough: 0.58, seg: 20 })); // shoulder 1.60..1.74
  const dome = ball(t, 0.33, COPPER, [0, 1.72, 0], { tex: 'metal', repeat: [8, 4], metal: 0.22, rough: 0.58 });
  dome.scale.set(1, 0.5, 1); // 1.72..1.885
  boiler.add(dome);
  boiler.add(cyl(t, 0.15, 0.19, 0.06, BRASS_D, [0, 1.9, 0], { tex: 'metal', repeat: [6, 1], metal: 0.3, rough: 0.46, seg: 14 })); // valve mounting pad
  // rivet rings up the barrel + verdigris on the copper (both lodDetail)
  const boilerRivets: MergedBoxSpec[] = [];
  for (let k = 0; k < 22; k += 1) {
    const a = (k / 22) * Math.PI * 2;
    [0.82, 1.06, 1.3, 1.52].forEach((y) => boilerRivets.push({ dims: [0.024, 0.024, 0.016], pos: P(a, barrelR(y) + 0.022, y), rotY: -a }));
  }
  const boilerRivetMesh = mergedBoxes(t, boilerRivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.38 });
  boilerRivetMesh.userData.lodDetail = true;
  boiler.add(boilerRivetMesh);
  const crownPatina: MergedBoxSpec[] = [];
  for (let k = 0; k < 9; k += 1) {
    const a = hash01(k * 5.7) * Math.PI * 2;
    const h = 0.04 + hash01(k * 3.1) * 0.07;
    crownPatina.push({ dims: [0.03, h, 0.012], pos: P(a, 0.42, 1.63 + hash01(k * 8.3) * 0.06), rotY: -a });
  }
  const crownPatinaMesh = mergedBoxes(t, crownPatina, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.88, bump: 0.02 });
  crownPatinaMesh.userData.lodDetail = true;
  boiler.add(crownPatinaMesh);
  // ---- the FIREBOX DOOR on +z: a swung-open brass door, a grate, and the
  //      fire itself (its own emissive material — a lit fire is lit BY DAY) --
  const fireMat = new t.MeshStandardMaterial({ color: FIRE_DEEP, emissive: FIRE_HOT, emissiveIntensity: 0.6, roughness: 0.5 });
  boiler.add(cyl(t, 0.2, 0.2, 0.05, IRON_D, [0, 0.6, 0.6], { tex: 'metal', repeat: [6, 1], metal: 0.24, rough: 0.7, seg: 16, rotX: Math.PI / 2 })); // door frame
  const fire = new t.Mesh(new t.CircleGeometry(0.155, 16), fireMat);
  fire.position.set(0, 0.6, 0.618);
  boiler.add(fire);
  const grate: MergedBoxSpec[] = [];
  for (let k = 0; k < 5; k += 1) grate.push({ dims: [0.3, 0.02, 0.012], pos: [0, 0.48 + k * 0.06, 0.626] });
  boiler.add(mergedBoxes(t, grate, IRON_D, { rough: 0.8 }));
  boiler.add(cyl(t, 0.19, 0.19, 0.03, BRASS, [0.3, 0.6, 0.5], { tex: 'metal', repeat: [6, 1], metal: 0.3, rough: 0.44, seg: 16, rotX: Math.PI / 2, rotY: -0.9 })); // door, swung open
  boiler.add(box(t, [0.03, 0.03, 0.1], BRASS_L, [0.44, 0.6, 0.44], { metal: 0.32, rough: 0.36, rotY: -0.9 })); // door handle
  // a coal heap and a shovel by the firebox door
  const coal = ball(t, 0.17, 0x302e36, [0.5, 0.4, 0.72], { tex: 'concrete', repeat: [3, 2], flat: true, rough: 0.95, bump: 0.06 });
  coal.scale.set(1, 0.45, 0.8);
  g.add(coal);
  g.add(cyl(t, 0.016, 0.016, 0.42, 0x7a6a52, [0.66, 0.42, 0.6], { tex: 'wood', repeat: [1, 4], rough: 0.9, seg: 6, rotZ: 0.6, rotX: -0.3 })); // shovel shaft
  g.add(box(t, [0.11, 0.02, 0.14], IRON_P, [0.5, 0.31, 0.66], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.66, rotY: 0.3 })); // shovel blade
  // ---- the CHIMNEY, offset to −z so it never hides the safety valve -------
  boiler.add(cyl(t, 0.13, 0.15, 0.62, IRON_D, [0, 1.86, -0.24], { tex: 'metal', repeat: [5, 5], metal: 0.24, rough: 0.72, seg: 14 })); // 1.55..2.17
  boiler.add(cyl(t, 0.17, 0.14, 0.05, BRASS_D, [0, 2.19, -0.24], { tex: 'metal', repeat: [6, 1], metal: 0.3, rough: 0.46, seg: 14 })); // cap
  const sootRing: MergedBoxSpec[] = [];
  for (let k = 0; k < 7; k += 1) {
    const a = hash01(k * 2.9 + 1.3) * Math.PI * 2;
    sootRing.push({ dims: [0.03, 0.06 + hash01(k * 4.7) * 0.08, 0.012], pos: [Math.cos(a) * 0.145, 2.05 - hash01(k * 6.1) * 0.16, -0.24 + Math.sin(a) * 0.145], rotY: -a });
  }
  const sootMesh = mergedBoxes(t, sootRing, SOOT, { tex: 'concrete', repeat: [1, 1], rough: 0.95 });
  sootMesh.userData.lodDetail = true;
  boiler.add(sootMesh);
  // ---- the SAFETY VALVE (its lever POPS on the vent) + the WHISTLE ---------
  boiler.add(cyl(t, 0.06, 0.07, 0.14, BRASS, [0, 1.97, 0], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.44, seg: 12 })); // valve body
  const lever = new t.Group();
  lever.position.set(0, 2.04, 0);
  boiler.add(lever);
  lever.add(box(t, [0.3, 0.028, 0.05], IRON_P, [0.13, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.26, rough: 0.6 })); // the lever arm
  lever.add(cyl(t, 0.045, 0.045, 0.07, IRON_D, [0.26, -0.02, 0], { tex: 'metal', repeat: [2, 1], metal: 0.24, rough: 0.66, seg: 10 })); // its weight
  boiler.add(cyl(t, 0.026, 0.03, 0.16, BRASS_L, [0.2, 1.98, 0.06], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.36, seg: 10 })); // whistle column
  boiler.add(cyl(t, 0.05, 0.036, 0.06, BRASS_L, [0.2, 2.09, 0.06], { tex: 'metal', repeat: [3, 1], metal: 0.32, rough: 0.36, seg: 10 })); // whistle bell
  const whistleMouth: [number, number, number] = [0.2, 2.14, 0.06];
  // ---- THE BIG GAUGE on +z (the queue's own view of the pressure) ----------
  const bigGauge = gaugeFace(t, 0.2);
  bigGauge.group.position.set(0, 1.12, 0.5);
  boiler.add(bigGauge.group);
  boiler.add(box(t, [0.42, 0.05, 0.06], BRASS_D, [0, 0.88, 0.48], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.46 })); // gauge shelf
  boiler.add(cyl(t, 0.022, 0.022, 0.26, COPPER, [0, 1.0, 0.48], { tex: 'metal', repeat: [1, 3], metal: 0.22, rough: 0.6, seg: 8 })); // feed pipe
  // two small gauges flanking it, angled outward
  const smallNeedles: THREE.Mesh[] = [];
  [-1, 1].forEach((s) => {
    const sg = gaugeFace(t, 0.09);
    sg.group.position.set(s * 0.32, 0.92, 0.4);
    sg.group.rotation.y = -s * 0.7;
    boiler.add(sg.group);
    smallNeedles.push(sg.needle);
  });
  // the red PRESSURE LAMP above the big gauge — it flashes on the vent, and it
  // is a warning lamp, so it keeps a small floor by day
  const lampMat = new t.MeshStandardMaterial({ color: 0xd8543a, emissive: 0xff4020, emissiveIntensity: 0.25, roughness: 0.3 });
  const pLamp = new t.Mesh(new t.SphereGeometry(0.055, 12, 9), lampMat);
  pLamp.position.set(0, 1.46, 0.48);
  boiler.add(pLamp);
  boiler.add(cyl(t, 0.06, 0.05, 0.03, BRASS_D, [0, 1.46, 0.44], { tex: 'metal', repeat: [3, 1], metal: 0.3, rough: 0.44, seg: 10, rotX: Math.PI / 2 })); // lamp collar
  // an inspection LADDER up the −z flank
  const ladder: MergedBoxSpec[] = [
    { dims: [0.03, 1.1, 0.03], pos: [-0.12, 1.15, -0.5], repeat: [1, 6] },
    { dims: [0.03, 1.1, 0.03], pos: [0.12, 1.15, -0.5], repeat: [1, 6] },
  ];
  for (let k = 0; k < 6; k += 1) ladder.push({ dims: [0.26, 0.022, 0.022], pos: [0, 0.68 + k * 0.19, -0.5] });
  const ladderMesh = mergedBoxes(t, ladder, IRON_P, { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.66 });
  ladderMesh.userData.lodDetail = true;
  boiler.add(ladderMesh);

  // ---- THE FOUR VENT NOZZLES ----------------------------------------------
  // flange on the barrel → elbow → nozzle cone pointing outward and 35° up.
  // The mouth is the emitter origin, and the jet's velocity is that same
  // direction — so the steam really does come OUT of the nozzle it is drawn on.
  const VENT_Y = 1.2;
  const VENT_TILT = 0.61; // ≈ 35°
  const nozzleDirs: { origin: [number, number, number]; vel: [number, number, number] }[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const rBarrel = 0.49; // the barrel's own radius at VENT_Y
    boiler.add(cyl(t, 0.075, 0.09, 0.05, BRASS, P(a, rBarrel + 0.02, VENT_Y), { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.44, seg: 12, rotZ: Math.PI / 2, rotY: -a })); // flange
    const elbow = new t.Group();
    elbow.position.set(...P(a, rBarrel + 0.08, VENT_Y));
    elbow.rotation.y = -a;
    boiler.add(elbow);
    elbow.add(cyl(t, 0.045, 0.05, 0.14, BRASS_D, [0.06, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.46, seg: 12, rotZ: Math.PI / 2 })); // stub
    const cone = new t.Group();
    cone.position.set(0.13, 0.02, 0);
    cone.rotation.z = VENT_TILT; // tip UP: local +y of the nozzle leans outward
    elbow.add(cone);
    cone.add(cyl(t, 0.03, 0.052, 0.16, BRASS_L, [0.08, 0.0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.38, seg: 12, rotZ: Math.PI / 2 })); // nozzle
    cone.add(cyl(t, 0.036, 0.036, 0.02, BRASS_D, [0.155, 0, 0], { metal: 0.3, rough: 0.44, seg: 12, rotZ: Math.PI / 2 })); // mouth ring
    // the mouth, in RIDE space: radius 0.21 + 0.16·cos(tilt) out from the elbow
    const outR = rBarrel + 0.08 + 0.13 + 0.17 * Math.cos(VENT_TILT);
    const upY = VENT_Y + 0.02 + 0.17 * Math.sin(VENT_TILT);
    const S = 1.15; // jet speed — 2.1 threw the plumes clean off the ride
    nozzleDirs.push({
      origin: [Math.cos(a) * outR, upY, Math.sin(a) * outR],
      vel: [Math.cos(a) * S * Math.cos(VENT_TILT), S * Math.sin(VENT_TILT), Math.sin(a) * S * Math.cos(VENT_TILT)],
    });
  }

  // =========================================================================
  // 3. THE EIGHT TEST CARTS on the turntable
  // =========================================================================
  const carts: { spin: THREE.Group; wheel: THREE.Group; rate: number; phase: number }[] = [];
  for (let i = 0; i < N_CARS; i += 1) {
    const a = (i / N_CARS) * Math.PI * 2;
    const mount = new t.Group();
    mount.position.set(...P(a, R_CAR, CAR_FLOOR));
    mount.rotation.y = -a; // local +x radially outward
    deck.add(mount);
    mount.add(cyl(t, 0.2, 0.23, 0.06, BRASS_D, [0, -0.03, 0], { tex: 'metal', repeat: [8, 1], metal: 0.3, rough: 0.46, seg: 16 })); // slew hub
    const hubTeeth: MergedBoxSpec[] = [];
    for (let k = 0; k < 14; k += 1) {
      const ta = (k / 14) * Math.PI * 2;
      hubTeeth.push({ dims: [0.03, 0.03, 0.024], pos: P(ta, 0.225, -0.03), rotY: -ta });
    }
    const hubTeethMesh = mergedBoxes(t, hubTeeth, BRASS_D, { metal: 0.3, rough: 0.46 });
    hubTeethMesh.userData.lodDetail = true;
    mount.add(hubTeethMesh);
    const rig = cartRig(t, i, { riders: withRiders });
    mount.add(rig.group);
    seats.push(rig.seat);
    // hashed spin rates in ALTERNATING directions — a waltzer never has two
    // neighbouring cars in step
    carts.push({
      spin: rig.group,
      wheel: rig.wheel,
      rate: (1.05 + hash01(i * 6.1) * 0.85) * (i % 2 ? -1 : 1),
      phase: hash01(i * 9.7) * Math.PI * 2,
    });
  }

  // =========================================================================
  // 4. LIGHTS (3) + PARTICLES (124)
  // =========================================================================
  const fireLight = new t.PointLight(0xff7a2a, 0, 3.4, 2);
  fireLight.position.set(0, 0.66, 0.78);
  g.add(fireLight);
  const floodLight = new t.PointLight(0xffc97a, 0, 5.4, 2);
  floodLight.position.set(1.5, 1.5, 1.5);
  g.add(floodLight);
  const ventLight = new t.PointLight(0xdfe8ee, 0, 4.2, 2);
  ventLight.position.set(0, 1.7, 0);
  g.add(ventLight);

  let vents: ReturnType<typeof buildEmitter>[] = [];
  let chimney: ReturnType<typeof buildEmitter> | null = null;
  if (wantFx) {
    vents = nozzleDirs.map((n) =>
      buildEmitter(t, {
        max: 30,
        rate: VENT_LEAK, // a permanent wisp; the rate opens right up for VENT_JET seconds
        life: 1.5,
        lifeVar: 0.35,
        velocity: n.vel,
        spread: 0.3,
        gravity: -0.05,
        size: 0.12,
        sizeEnd: 0.56, // BIG: at park zoom a 0.4 puff is a scatter of dots, not steam
        color: 0xf2f0ea,
        colorEnd: 0xbdb8b0,
        opacity: 0.52,
      }),
    );
    vents.forEach((v, i) => {
      v.setOrigin(...nozzleDirs[i].origin);
      g.add(v.points);
    });
    chimney = buildEmitter(t, {
      max: 20,
      rate: 5,
      life: 2.1,
      lifeVar: 0.5,
      velocity: [0.05, 0.5, -0.04],
      spread: 0.12,
      gravity: -0.06,
      size: 0.09,
      sizeEnd: 0.34,
      color: 0x6a635c,
      colorEnd: 0x9a948c,
      opacity: 0.34,
    });
    chimney.setOrigin(0, 2.24, -0.24);
    g.add(chimney.points);
  }

  // =========================================================================
  // 5. THE TWO UPDATERS
  //    `motionUpdate` runs on the GATED clock (turntable, cart spin, the drive
  //    train) — it freezes when the FSM parks the ride for boarding.
  //    `ventUpdate` runs on ABSOLUTE time (the vent rhythm, the gauges, the
  //    lights) — a pressure rig vents whether or not the carts are turning.
  // =========================================================================
  const motionUpdate = (clk: number) => {
    deck.rotation.y = clk * OMEGA;
    // ring gear 1.935 : pinion 0.09 — the pinion turns 21.5x the turntable
    drivePinion.rotation.y = -clk * OMEGA * (1.935 / 0.09);
    driveFly.rotation.x = clk * OMEGA * 7.4;
    carts.forEach((c) => {
      c.spin.rotation.y = c.phase + clk * c.rate;
      c.wheel.rotation.z = c.phase * 2 + clk * c.rate * 2.6; // the handwheel spins with the cart
    });
  };

  let ventIdx = -1;
  let ventAt = -99;
  let ventCount = 0;
  g.userData.ventPeriod = VENT_PERIOD;
  g.userData.ventCount = 0;
  const ventUpdate = (time: number) => {
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    // ---- the vent clock: FIXED period, absolute time -----------------------
    const ph = time / VENT_PERIOD;
    const idx = Math.floor(ph);
    const p = ph - idx; // 0..1 — how far the pressure has climbed
    if (idx !== ventIdx) {
      ventIdx = idx;
      ventAt = idx * VENT_PERIOD; // the IDEAL instant, not the frame time
      ventCount += 1;
      g.userData.ventCount = ventCount;
      vents.forEach((v) => v.burst(13));
      chimney?.burst(8, whistleMouth); // the whistle shrieks with the pop
    }
    const jet = Math.max(0, 1 - (time - ventAt) / VENT_JET); // 1 → 0 over the jet
    vents.forEach((v) => v.setRate(jet > 0 ? 22 : VENT_LEAK));
    // ---- the gauge TELEGRAPHS it -------------------------------------------
    // p^1.4 so the needle accelerates into the danger arc; the scale spans
    // -1.45..+1.45 rad and the arc starts at 1.05
    bigGauge.needle.rotation.z = -(-1.45 + 2.9 * Math.pow(p, 1.4));
    smallNeedles.forEach((n, i) => {
      n.rotation.z = -(-1.2 + 1.9 * Math.pow(p, 1.2 + i * 0.4) + 0.08 * Math.sin(time * (2.3 + i)));
    });
    lever.rotation.z = jet * 0.5; // the safety valve lever POPS
    lampMat.emissiveIntensity = 0.25 + jet * 2.1 + p * p * 0.5;
    // the boiler shudders on the pop (hashed, deterministic, tiny)
    const shake = jet * jet * 0.01;
    boiler.position.x = (hash01(idx * 3.7) - 0.5) * shake;
    boiler.position.z = (hash01(idx * 8.9) - 0.5) * shake;
    // ---- fire + lights ----------------------------------------------------
    const flick = 0.6 + 0.14 * Math.sin(time * 6.1) + 0.09 * Math.sin(time * 9.7 + 1.3);
    fireMat.emissiveIntensity = flick + 0.35 * ease; // a lit fire is lit BY DAY
    fireLight.intensity = 0.28 + 0.06 * Math.sin(time * 5.3) + ease * 0.95;
    bulbMat.emissiveIntensity = 0.15 + (1.3 + 0.09 * Math.sin(time * 3.1) - 0.15) * ease;
    floodLight.intensity = ease * 1.1;
    ventLight.intensity = ease * jet * 1.3; // the vent lights its own steam at night
    vents.forEach((v) => v.update(time));
    chimney?.update(time);
  };

  // the station gate wraps ONLY the motion half
  const gate = createMotionGate((clk) => motionUpdate(clk), { spinDown: 1.4 });
  const update = (time: number) => {
    gate.update(time);
    ventUpdate(time);
  };

  return {
    group: g,
    update,
    vehicle: carts[0].spin, // the RideViewer follow cam rides cart 0 — and spins with it
    seatWorld: makeSeatWorld(t, seats),
    onStateChange: gate.onStateChange,
    dispose() {
      vents.forEach((v) => v.dispose());
      chimney?.dispose();
      fireMat.dispose();
      lampMat.dispose();
      bulbMat.dispose();
      bulbGeo.dispose();
      fireLight.dispose();
      floodLight.dispose();
      ventLight.dispose();
    },
  };
}

export interface BoilerBurstProps extends BoilerBurstOpts {}

/** local access geometry: the base ring reaches 2.11 and the clinker apron
 *  2.47, so the queue hut (which spans front−1.12 … front−0.12) stands clear of
 *  the paving and the fence GAP faces the lane. */
const BOILER_LAYOUT: RideLayout = {
  // measured: the built footprint spans x ±2.53, z −2.48…2.58, so the chassis'
  // compact-ride rule wants front ≥ 2.58 + 1.27 = 3.85 and the exit flush at
  // x ≤ −3.15. Both are written down rather than left to the auto-correction.
  front: 3.9,
  exit: [-3.15, 1.4],
  board: [0, DECK_TOP + 0.04, 1.05],
  defaults: { name: 'Boiler Burst', capacity: BOILER_BURST_CAPACITY, rideDuration: 13, intensity: 6, price: 4 },
};

/** <BoilerBurst> — "Boiler Burst", the Brasswork Foundry world's spinner,
 *  composable (components/Park/Context.md): eight riveted test carts circling a
 *  live boiler on a turntable, each spinning on its own valve hub, while the
 *  boiler vents steam through four brass nozzles on a FIXED 3.6 s rhythm that a
 *  climbing gauge needle telegraphs. Mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride — queue HEAD 3.8 out the
 *  local +z front (the fence gap, and the face the big gauge is bolted to, so
 *  the queue watches the pressure rise), exit hut at local [-3.0, 1.4],
 *  boarding on the deck at [0, 0.32, 1.05]. Capacity 8 = one seat per cart:
 *  REAL guests ride the leather cushions via `seatWorld` (decorative riders off
 *  when registered) and the turntable is motion-gated — dead still for
 *  boarding, easing into rotation on departure — while the boiler keeps venting
 *  either way. Override with top-level props / `queue`. */
export const BoilerBurst = composableRide<BoilerBurstProps>(
  'BoilerBurst',
  (t, props) =>
    buildBoilerBurstScene(t, {
      riders: props.riders ?? !(props as { register?: unknown }).register,
      effects: props.effects,
    }),
  BOILER_LAYOUT,
);
