import React from 'react';
import * as THREE from 'three';
import { cyl, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate } from '../GameManager';
import { ConfigurableRide } from '../Park';
import type { ComposableRideProps, RideLayout } from '../Park';

// Ferris wheel matched to the RCT2 FWH1 sprite geometry, in realistic classic
// RED wheel steel with lattice cross-bracing between paired rings, a CREAM rim,
// dark slate-teal lattice A-frame supports, and open two-seat bench gondolas
// (dark teal) that hang inside the rim and stay upright as the wheel turns.

export interface FerrisWheelOpts {
  /** decorative peep riders in the gondolas (default true). A ride registered
   *  in a <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface FerrisWheelBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live gondola) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** a gondola for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — the wheel spins down while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildFerrisWheel(t: typeof THREE, opts: FerrisWheelOpts = {}): FerrisWheelBuilt {
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const R = 2.4;
  const cy = 2.7;
  const PINK = 0xc23434; // classic red wheel steel (realistic)
  const ORANGE = 0xe8e2d2; // cream outer rim band
  const SLATE = 0x3c5454; // support lattice (sprite #305050)
  const SEAT = 0x24383a; // gondola benches

  // A-frame lattice supports (two planes), dark slate like the sprite.
  // Static dressing — legs, rungs, ties and pads are batched with
  // mergedBoxes (one draw call per material) instead of ~26 meshes.
  const legSpecs: MergedBoxSpec[] = [];
  const rungSpecs: MergedBoxSpec[] = [];
  const padSpecs: MergedBoxSpec[] = [];
  for (const sx of [-1, 1])
    for (const z of [-0.52, 0.52]) {
      const x0 = sx * 1.5;
      const L = Math.hypot(x0, cy);
      const ang = Math.atan2(cy, -x0) - Math.PI / 2;
      legSpecs.push({ dims: [0.11, L, 0.11], pos: [x0 / 2, cy / 2, z], rotZ: ang, repeat: [1, 6] });
      // lattice rungs up each leg
      for (let k = 1; k < 5; k++) {
        const yy = (cy * k) / 5;
        const xx = x0 * (1 - k / 5);
        rungSpecs.push({ dims: [0.32, 0.05, 0.05], pos: [xx, yy, z] });
      }
    }
  // cross ties between the two support planes + footing pads
  [-1, 1].forEach((sx) => {
    rungSpecs.push({ dims: [0.08, 0.08, 1.05], pos: [sx * 0.75, cy / 2, 0] });
    [-0.52, 0.52].forEach((z) => padSpecs.push({ dims: [0.5, 0.12, 0.4], pos: [sx * 1.5, 0.06, z] }));
  });
  g.add(mergedBoxes(t, legSpecs, SLATE, { tex: 'metal', metal: 0.4, rough: 0.6 }));
  g.add(mergedBoxes(t, rungSpecs, SLATE, { metal: 0.4, rough: 0.6 }));
  g.add(mergedBoxes(t, padSpecs, 0x8a8f98, { tex: 'concrete', rough: 0.9 }));
  g.add(cyl(t, 0.1, 0.1, 1.16, 0x9aa2ab, [0, cy, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.8, rough: 0.3, seg: 16 })); // axle

  const wheel = new t.Group();
  wheel.position.set(0, cy, 0);
  g.add(wheel);

  // paired pink inner rings + ORANGE outer rim rings (slightly larger)
  for (const z of [-0.4, 0.4]) {
    const inner = new t.Mesh(new t.TorusGeometry(R * 0.82, 0.045, 8, 48), new t.MeshStandardMaterial({ color: PINK, metalness: 0.3, roughness: 0.5 }));
    inner.position.z = z;
    inner.castShadow = true;
    wheel.add(inner);
    const outer = new t.Mesh(new t.TorusGeometry(R, 0.055, 8, 48), new t.MeshStandardMaterial({ color: ORANGE, metalness: 0.3, roughness: 0.5 }));
    outer.position.z = z;
    outer.castShadow = true;
    wheel.add(outer);
  }
  // hub discs
  [-0.42, 0.42].forEach((z) => wheel.add(cyl(t, 0.16, 0.16, 0.06, 0x9aa2ab, [0, 0, z], { rotX: Math.PI / 2, metal: 0.7, rough: 0.35, seg: 18 })));

  // 16 pink spokes per plane + lattice cross-bracing between rings —
  // all rigid parts of the rotating wheel, so the 80 boxes merge into
  // ONE mesh (added to `wheel`, they still spin together)
  const NS = 16;
  const wheelSpecs: MergedBoxSpec[] = [];
  for (let i = 0; i < NS; i++) {
    const a = (i / NS) * Math.PI * 2;
    [-0.4, 0.4].forEach((z) => {
      // half-spoke hub -> rim (16 DISTINCT spokes; full-diameter boxes would coincide in pairs)
      wheelSpecs.push({ dims: [0.035, R, 0.035], pos: [Math.cos(a + Math.PI / 2) * (R / 2), Math.sin(a + Math.PI / 2) * (R / 2), z], rotZ: a });
    });
    // radial cross-tie connecting the two planes at the rim
    wheelSpecs.push({ dims: [0.05, 0.05, 0.86], pos: [Math.cos(a + Math.PI / 2) * R * 0.91, Math.sin(a + Math.PI / 2) * R * 0.91, 0] });
    // zig-zag lattice between inner and outer ring (per plane)
    [-0.4, 0.4].forEach((z) => {
      const mid = (R * 0.82 + R) / 2;
      wheelSpecs.push({ dims: [0.03, 0.42, 0.03], pos: [Math.cos(a + Math.PI / 2 + 0.1) * mid, Math.sin(a + Math.PI / 2 + 0.1) * mid, z], rotZ: a + 0.5 });
    });
  }
  wheel.add(mergedBoxes(t, wheelSpecs, PINK, { metal: 0.3, rough: 0.5 }));

  // night lighting: warm bulb string on both outer rim rings at every
  // spoke angle (r = R, z ±0.47 half-buried in the torus tube whose
  // surface reaches z ±0.455) + two real lights flanking the hub.
  // One InstancedMesh (32 instances, 1 draw call) — the shared bulbMat
  // still takes the night-gated emissive ramp below.
  const bulbGeo = new t.SphereGeometry(0.05, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  const bulbs = new t.InstancedMesh(bulbGeo, bulbMat, NS * 2);
  {
    const m4 = new t.Matrix4();
    let bi = 0;
    for (let i = 0; i < NS; i++) {
      const a = (i / NS) * Math.PI * 2;
      [-0.47, 0.47].forEach((z) => {
        m4.makeTranslation(Math.cos(a) * R, Math.sin(a) * R, z);
        bulbs.setMatrixAt(bi++, m4);
      });
    }
    bulbs.instanceMatrix.needsUpdate = true;
  }
  wheel.add(bulbs);
  const nightLights: { intensity: number }[] = [];
  [-1.2, 1.2].forEach((z) => {
    const pl = new t.PointLight(0xffc97a, 0, 7, 2);
    pl.position.set(0, cy, z);
    g.add(pl);
    nightLights.push(pl);
  });

  // 8 open bench gondolas, dark teal, hanging inside the rim, kept upright
  const N = 8;
  const gondolas: THREE.Group[] = [];
  for (let i = 0; i < N; i++) {
    const gd = new t.Group();
    // the gondola shell is rigid — batch its 9 boxes into 4 meshes
    // (one per material) so 8 gondolas cost 32 draws instead of 72
    gd.add(mergedBoxes(t, [
      { dims: [0.46, 0.07, 0.4], pos: [0, -0.16, 0] }, // bench seat
      { dims: [0.46, 0.3, 0.06], pos: [0, -0.02, -0.17] }, // seat back
    ], SEAT, { rough: 0.8 }));
    gd.add(mergedBoxes(t, [
      { dims: [0.4, 0.035, 0.32], pos: [0, -0.115, 0.005], repeat: [2, 1] }, // padded seat cushion (top 0.02 proud of the bench)
      { dims: [0.4, 0.24, 0.025], pos: [0, -0.01, -0.13], repeat: [2, 2] }, // back cushion on the seat-back face
    ], 0x7a2626, { tex: 'fabric', rough: 0.95 }));
    gd.add(mergedBoxes(t, [
      { dims: [0.46, 0.05, 0.05], pos: [0, -0.04, 0.16] }, // safety bar at chest height
      { dims: [0.04, 0.09, 0.04], pos: [-0.19, -0.085, 0.16] }, // bar stanchions down into the bench
      { dims: [0.04, 0.09, 0.04], pos: [0.19, -0.085, 0.16] },
    ], ORANGE, { rough: 0.5 }));
    gd.add(mergedBoxes(t, [
      { dims: [0.04, 0.44, 0.04], pos: [-0.2, 0.05, 0] }, // hangers, buried in the bench
      { dims: [0.04, 0.44, 0.04], pos: [0.2, 0.05, 0] },
      { dims: [0.44, 0.045, 0.06], pos: [0, 0.25, 0] }, // top crossbar that clamps the rim cross-tie
    ], SLATE, { metal: 0.4, rough: 0.6 }));
    if (withRiders) {
      const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true });
      p.group.scale.setScalar(0.36);
      p.group.position.set(0, -0.29, -0.1);
      p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
      gd.add(p.group);
    }
    g.add(gd);
    gondolas.push(gd);
  }

  // per-seat transform so REGISTERED rides carry real GameManager guests: the
  // guest's group origin (feet) lands on the live gondola bench
  const _v = new t.Vector3();
  const _q = new t.Quaternion();
  const _e = new t.Euler();
  const seatWorld = (seat: number): [number, number, number, number] => {
    const gd = gondolas[seat % N];
    gd.updateWorldMatrix(true, false);
    _v.set(0, -0.29, -0.05).applyMatrix4(gd.matrixWorld);
    gd.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };

  // FSM spin-down: the manager's ride state machine drives a speed target —
  // the wheel eases to a stop while brokenDown/beingRepaired, then restarts
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  let angle = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const update = (time: number) => {
    // day -> night gate: bulbs glow + hub lights rise as the Stage darkens
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.2 + 0.15 * Math.sin(time * 2.3) - 0.15) * ease;
    nightLights.forEach((pl) => (pl.intensity = ease * 1.1));
    const dt = Math.min(Math.max(time - lastT, 0), 0.1);
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    angle += dt * 0.35 * speedK; // = time * 0.35 while running free
    wheel.rotation.z = angle;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + angle;
      const gd = gondolas[i];
      gd.position.set(Math.cos(a) * R * 0.91, cy + Math.sin(a) * R * 0.91 - 0.25, 0); // crossbar sits on the rim cross-tie at R*0.91
      gd.rotation.z = Math.sin(time * 2 + i) * 0.06 * (0.4 + 0.6 * speedK); // gentle sway, stays upright
    }
  };
  // station gate (RCT2: the wheel is PARKED while guests board/unload and only
  // turns departing→arriving) — composed WITH the breakdown spin-down above
  const gate = createMotionGate(update);
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: gondolas[0], onStateChange: onStateChangeAll };
}

export interface FerrisWheelProps {
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

const FERRIS_LAYOUT: RideLayout = {
  front: 1.8,
  exit: [-1.5, 1.35],
  board: [0, 0.25, 0],
  defaults: { name: 'Ferris Wheel', capacity: 8, rideDuration: 8, intensity: 3, price: 3 }, // capacity = the 8 gondolas (seatWorld anchors)
};

/** <FerrisWheel> — composable ride (components/Park/Context.md): mounts the
 *  wheel at `position`/`rotation`; inside a <Park>, `register` (true or
 *  `{ name, capacity, rideDuration, price, intensity }`) wires the full
 *  GameManager ride via <ConfigurableRide>. Access geometry (local frame,
 *  yaw = `rotation`): queue HEAD 1.8 out the +z front, lane extending +z —
 *  its tail at `1.8 + laneLenOf(capacity) + 0.35` is the spot to land on or
 *  near a street node — exit hut beside it at local [-1.5, 1.35], boarding
 *  at the wheel base (real guests ride the gondolas via seatWorld).
 *  Renders <ConfigurableRide> DIRECTLY (not the composableRide factory, which
 *  strips `register` out of the props it hands the builder) so the
 *  decorative riders really do turn off when the ride is registered. */
export const FerrisWheel: React.FC<FerrisWheelProps & ComposableRideProps> = (all) => {
  const { riders, register, position, rotation, scale, deps, ...rest } = all;
  return (
    <ConfigurableRide
      build={(t) => buildFerrisWheel(t, { riders: riders ?? !register })}
      layout={FERRIS_LAYOUT}
      register={register}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [register, riders, rest]}
      {...rest}
    />
  );
};
FerrisWheel.displayName = 'FerrisWheel';
