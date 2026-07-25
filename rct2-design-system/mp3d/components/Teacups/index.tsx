import React from 'react';
import * as THREE from 'three';
import { cyl, box, ball, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildPeep, SKIN_TONES } from '../Guest';
import { createMotionGate } from '../GameManager';
import { ConfigurableRide } from '../Park';
import type { ComposableRideProps, RideLayout } from '../Park';

// Spinning cups matched to the RCT2 COFFEECU sprite: a wooden turntable with a
// coffee-grinder centrepiece (brown mill body, silver dome, big black CRANK
// that turns), and four tilted WHITE cups with PINK interiors sitting on
// saucers, each spinning on its own axis while the deck rotates.

export interface TeacupsOpts {
  /** decorative peep riders in the cups (default true). A ride registered in
   *  a <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface TeacupsBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live spinning cup) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** a cup for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — the deck spins down while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildTeacupsScene(three: typeof THREE, opts: TeacupsOpts = {}): TeacupsBuilt {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const WOODL = 0xa87848; // deck wood (sprite #b07050)
  const WOODD = 0x5a3820; // tub band (sprite #503010)
  const CUP = 0xe8e6ee; // white cup (sprite #e0e0f0)
  const PINK = 0xc23a7a; // cup interior
  const BRASS = 0x8a6a3a;
  const SHELL = 0x2b2028; // moulded bench shell inside each cup
  const CUSH = 0x7e3048; // upholstery fabric (muted claret)

  g.add(cyl(t, 1.85, 1.95, 0.24, WOODD, [0, 0.12, 0], { tex: 'wood', repeat: [12, 1], rough: 0.9, seg: 32 })); // base ring
  const deck = new t.Group();
  g.add(deck);
  deck.add(cyl(t, 1.7, 1.7, 0.12, WOODL, [0, 0.3, 0], { tex: 'wood', repeat: [10, 1], rough: 0.85, seg: 32 }));
  // dark scalloped tub segments around the deck edge (sprite's brown lobes)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8; // offset so lobes sit BETWEEN the cups
    // r 0.32 at radius 1.46, y 0.34: clears the spinning cups (gap 0.07), the rail
    // posts at 1.66, the static base-ring flank, and stays above the ground plane
    deck.add(ball(t, 0.32, WOODD, [Math.cos(a) * 1.46, 0.34, Math.sin(a) * 1.46], { tex: 'wood', repeat: [3, 2], flat: true, rough: 0.9 }));
  }

  // ---- coffee-grinder centrepiece ----
  deck.add(box(t, [0.56, 0.7, 0.56], 0x9a6a42, [0, 0.72, 0], { tex: 'wood', repeat: [3, 2], rough: 0.8 })); // mill body
  deck.add(box(t, [0.62, 0.08, 0.62], WOODD, [0, 0.4, 0], { tex: 'wood', rough: 0.85 })); // plinth
  deck.add(box(t, [0.62, 0.06, 0.62], WOODD, [0, 1.08, 0], { tex: 'wood', rough: 0.85 })); // cap plate
  deck.add(box(t, [0.16, 0.2, 0.03], 0x3a2412, [0, 0.72, 0.29], { rough: 0.7 })); // drawer
  deck.add(cyl(t, 0.2, 0.26, 0.18, 0xd8d8de, [0, 1.2, 0], { tex: 'metal', metal: 0.7, rough: 0.3, seg: 18 })); // silver dome
  // crank: vertical shaft, horizontal arm, knob — spins with the ride
  const crank = new t.Group();
  crank.position.set(0, 1.32, 0);
  deck.add(crank);
  crank.add(cyl(t, 0.03, 0.03, 0.5, 0x24242a, [0, 0.22, 0], { metal: 0.6, rough: 0.4, seg: 10 }));
  crank.add(box(t, [0.34, 0.05, 0.05], 0x24242a, [0.15, 0.47, 0], { metal: 0.6, rough: 0.4 }));
  crank.add(ball(t, 0.06, 0x111114, [0.32, 0.42, 0], { rough: 0.5 }));

  // ---- four tilted cups on saucers ----
  const spin: { grp: { rotation: { y: number } }; phase: number }[] = [];
  const cups: THREE.Group[] = [];
  const seats: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cup = new t.Group();
    cup.position.set(Math.cos(a) * 1.05, 0.36, Math.sin(a) * 1.05); // saucer resting on the deck top (0.3 + 0.12/2)
    cup.rotation.y = -a; // local +X = radially outward, so the handle starts on the outward-facing side
    // saucer stays flat on the deck; only the cup assembly above it tilts
    cup.add(cyl(t, 0.5, 0.42, 0.05, CUP, [0, 0.025, 0], { rough: 0.35, seg: 24 }));
    cup.add(cyl(t, 0.34, 0.34, 0.02, 0xc9c6d0, [0, 0.06, 0], { rough: 0.35, seg: 24 })); // raised seat ring
    const body = new t.Group();
    body.position.y = 0.07; // cup bottom on the saucer's seat ring
    body.rotation.z = 0.12; // tilted like the sprite
    cup.add(body);
    // cup body: OPEN flared OUTER wall (wall radius r(y) = 0.26 + 0.35*y,
    // DoubleSide), pink inner liner + floor pan below (see next), gold TORUS
    // lip on the rim edge
    const wallM = new t.Mesh(
      new t.CylinderGeometry(0.4, 0.26, 0.4, 24, 1, true),
      new t.MeshStandardMaterial({ color: CUP, roughness: 0.3, side: t.DoubleSide }),
    );
    wallM.position.y = 0.2;
    wallM.castShadow = true;
    body.add(wallM);
    body.add(cyl(t, 0.26, 0.26, 0.02, CUP, [0, 0.01, 0], { rough: 0.35, seg: 24 })); // bottom cap
    // PINK interior liner — the cup's INNER wall, a sleeve 0.03 inside the
    // outer wall (r 0.2965 at y 0.19 → 0.37 at the rim, where it meets the
    // gold lip's inner surface exactly) so the cup reads pink inside like the
    // sprite AND has real wall thickness: the handle roots bury in that 0.03
    // of "porcelain" instead of showing through into the cup. The ride floor
    // now sits 0.20 DOWN in the cup instead of the old flat disc parked at the
    // rim, which is what made riders look like they sat on a table top.
    const liner = new t.Mesh(
      new t.CylinderGeometry(0.37, 0.2965, 0.21, 24, 1, true),
      new t.MeshStandardMaterial({ color: PINK, roughness: 0.5, side: t.DoubleSide }),
    );
    liner.position.y = 0.295;
    body.add(liner);
    body.add(cyl(t, 0.3, 0.27, 0.04, 0x3a2c32, [0, 0.23, 0], { tex: 'metal', repeat: [6, 1], rough: 0.9, seg: 24 })); // floor pan (top 0.25) — riders' feet land here
    const lip = new t.Mesh(new t.TorusGeometry(0.4, 0.03, 8, 28), new t.MeshStandardMaterial({ color: 0xd8b040, metalness: 0.5, roughness: 0.35 }));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.4;
    lip.castShadow = true;
    body.add(lip); // gold ring wraps the wall's top edge; pink stays visible inside it
    // ---- upholstered bench ring inside the cup --------------------------
    // 20 tangential segments over 280° (the 80° gap faces +X — the step-in /
    // handle side): dark moulded shell pan + fabric seat cushion (top y 0.30 =
    // the hip plane) and a backrest leaning 0.34 rad to follow the wall flare.
    // Segment widths exceed the 14° tangential pitch at each part's OUTER
    // radius (0.071 at r 0.29, 0.075 at r 0.305, 0.085 at r 0.347) so the ring
    // reads continuous, and every outer CORNER stays inside the pink liner
    // (pan 0.2928 at y 0.21 vs liner 0.3035; cushion 0.3076 at y 0.26 vs
    // 0.321; backrest 0.349 at y 0.387 vs 0.3656).
    // Batched through mergedBoxes: 2 draw calls per cup, not 80.
    const shellParts: MergedBoxSpec[] = [];
    const cushParts: MergedBoxSpec[] = [];
    const segM = (th: number, y: number, z: number, tilt = 0) =>
      new t.Matrix4()
        .makeRotationY(Math.PI / 2 - th) // local +Z = radially outward, +X = tangent
        .multiply(new t.Matrix4().makeTranslation(0, y, z))
        .multiply(new t.Matrix4().makeRotationX(tilt)); // lean about the TANGENT
    for (let k = 0; k < 20; k++) {
      const th = 0.698 + ((k + 0.5) / 20) * 4.887; // 40°..320°
      shellParts.push({ dims: [0.08, 0.05, 0.14], matrix: segM(th, 0.235, 0.22) }); // pan shell 0.21..0.26
      cushParts.push({ dims: [0.082, 0.04, 0.12], matrix: segM(th, 0.28, 0.245) }); // cushion, top 0.30
      shellParts.push({ dims: [0.088, 0.09, 0.035], matrix: segM(th, 0.345, 0.315, 0.34) }); // backrest shell
      cushParts.push({ dims: [0.08, 0.075, 0.025], matrix: segM(th, 0.345, 0.29, 0.34) }); // back cushion
    }
    body.add(mergedBoxes(t, shellParts, SHELL, { rough: 0.7 }));
    body.add(mergedBoxes(t, cushParts, CUSH, { tex: 'fabric', repeat: [1, 1], rough: 0.95 }));
    // handle: C-shaped partial torus (arc 4.6 rad — the 96° gap faces the cup
    // wall so BOTH ends root INTO it), plane spanning the radial (+X) and Y
    // axes and TILTED 0.337 rad to follow the wall flare so both roots bury
    // the SAME 0.014 (ends at y 0.179 / 0.299 against wall radii 0.3226 /
    // 0.3645) — inside the 0.03 wall thickness, so nothing shows in the cup.
    // Top of the arc y 0.32, i.e. 0.05 clear of the gold lip's underside
    // (0.37); the old full torus poked 0.005 OVER the rim and drove its whole
    // inner arc through the wall into the cup interior.
    const handle = new t.Group();
    handle.position.set(0.3829, 0.22, 0);
    handle.rotation.z = -0.337;
    body.add(handle);
    const hRing = new t.Mesh(new t.TorusGeometry(0.085, 0.021, 8, 22, 4.6), new t.MeshStandardMaterial({ color: CUP, roughness: 0.3 }));
    hRing.rotation.z = Math.PI + 0.84; // rotate the arc gap onto the wall side (−X)
    hRing.castShadow = true;
    handle.add(hRing);
    // seat anchor — the decorative rider's transform, kept even without
    // riders so `seatWorld` can carry REAL GameManager guests in the cup
    const seat = new t.Group();
    seat.position.set(-0.22, 0.129, 0); // ON the bench at θ=180° (cushion band r 0.185..0.305): hips = 0.129 + 0.45·0.38 = 0.30 = cushion top
    seat.rotation.y = Math.PI / 2; // facing +X — radially OUTWARD across the bench gap
    body.add(seat);
    seats.push(seat);
    if (withRiders) {
      const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: [0xd6338c, 0x2f6fd0, 0x2e9e54, 0xe0a020][i], seated: true, expression: 'surprised' });
      p.group.scale.setScalar(0.38);
      p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
      seat.add(p.group);
    }
    deck.add(cup);
    cups.push(cup);
    spin.push({ grp: cup, phase: -a });
  }
  // brass safety rail around the deck
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    deck.add(cyl(t, 0.02, 0.02, 0.34, BRASS, [Math.cos(a) * 1.66, 0.5, Math.sin(a) * 1.66], { metal: 0.7, rough: 0.3, seg: 8 }));
  }
  const rail = new t.Mesh(new t.TorusGeometry(1.66, 0.02, 8, 40), new t.MeshStandardMaterial({ color: BRASS, metalness: 0.7, roughness: 0.3 }));
  rail.rotation.x = -Math.PI / 2;
  rail.position.y = 0.67; // top rail joining every post
  rail.castShadow = true;
  deck.add(rail);
  // night lighting: warm bulb above each rail post (rail tube top 0.69;
  // bulb bottoms 0.66 embed in it), riding the deck, + centre glow light
  // above the grinder and one static flood off the deck edge
  const bulbGeo = new t.SphereGeometry(0.04, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(Math.cos(a) * 1.66, 0.7, Math.sin(a) * 1.66);
    deck.add(bulb);
  }
  const centreLight = new t.PointLight(0xffc97a, 0, 4.5, 2);
  centreLight.position.set(0, 1.85, 0); // above the crank sweep (knob y 1.74)
  deck.add(centreLight);
  const floodLight = new t.PointLight(0xffc97a, 0, 5, 2);
  floodLight.position.set(1.7, 1.3, 1.7); // radial 2.4, outside the 1.95 base ring
  g.add(floodLight);

  // per-seat transform so REGISTERED rides carry real GameManager guests: the
  // guest's hips land on the live cup's bench CUSHION (top y 0.30 in body
  // space; anchor 0.129 + 0.45·0.38), facing radially outward — one per cup
  const _v = new t.Vector3();
  const _q = new t.Quaternion();
  const _e = new t.Euler();
  const seatWorld = (seat: number): [number, number, number, number] => {
    const s = seats[seat % seats.length];
    s.updateWorldMatrix(true, false);
    _v.set(0, 0, 0).applyMatrix4(s.matrixWorld);
    s.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };

  // FSM spin-down: the manager's ride state machine drives a speed target —
  // deck, crank and cups ease to a stop while brokenDown/beingRepaired
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  let angle = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const update = (time: number) => {
    // day -> night gate: rail bulbs + glow rise as the Stage darkens
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.2 + 0.1 * Math.sin(time * 3.1) - 0.15) * ease;
    centreLight.intensity = ease * 0.8;
    floodLight.intensity = ease * 0.7;
    const dt = Math.min(Math.max(time - lastT, 0), 0.1);
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    angle += dt * speedK; // = time while running free
    deck.rotation.y = angle * 0.6;
    crank.rotation.y = -angle * 2.4;
    spin.forEach((c, i) => (c.grp.rotation.y = c.phase + angle * (2.0 + i * 0.35)));
  };
  // station gate (RCT2: deck parked while guests board/unload) — composed
  // WITH the breakdown spin-down above
  const gate = createMotionGate(update);
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: cups[0], onStateChange: onStateChangeAll };
}

export interface TeacupsProps {
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** local access geometry: the base ring reaches radius 1.95, so the queue hut
 *  (spans front−1.12..front−0.12) and exit hut stand just clear of it */
const TEACUPS_LAYOUT: RideLayout = {
  front: 3.2,
  exit: [-2.5, 1.35],
  board: [0, 0.4, 0],
  defaults: { name: 'Teacups', capacity: 4, rideDuration: 8, intensity: 3, price: 3 },
};

/** <Teacups> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` (true or `{ name,
 *  capacity, rideDuration, price, intensity }`) wires the full GameManager
 *  ride via <ConfigurableRide>. Access geometry (local frame, yaw =
 *  `rotation`): queue HEAD 3.2 out the +z front — clear of the 1.95 base ring
 *  — lane extending +z (tail at `3.2 + laneLenOf(capacity) + 0.35`), exit hut
 *  at local [-2.5, 1.35]. REAL guests ride the cups via `seatWorld` (one per
 *  cup); the deck spins down on breakdown (`onStateChange`). Override with
 *  top-level props / `queue`. */
export const Teacups: React.FC<TeacupsProps & ComposableRideProps> = (all) => {
  const { riders, register, position, rotation, scale, deps, ...rest } = all;
  return (
    <ConfigurableRide
      build={(t) => buildTeacupsScene(t, { riders: riders ?? !register })}
      layout={TEACUPS_LAYOUT}
      register={register}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [register, riders, rest]}
      {...rest}
    />
  );
};
Teacups.displayName = 'Teacups';
