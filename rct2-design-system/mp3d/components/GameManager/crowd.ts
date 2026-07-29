// ---------------------------------------------------------------------------
// THE INSTANCED FAR CROWD — how a park affords 500 guests.
//
// ---- THE MEASUREMENT THIS EXISTS FOR -------------------------------------
//
// `harness/mp3d-render/probe-frame-cost.mjs --sample=parkA-99 --gpu=metal`
// (REAL hardware, ANGLE Metal on an M4 Pro — never SwiftShader, which measures
// a different machine entirely), size-128 park, population PINNED by setting
// `guestCapForSize === guestsForSize`:
//
//   guests   frame (gpuMs)   draws   meshes   crowd's share
//   ------   -------------   -----   ------   -------------
//      99         16.32       3176    8005    3.4 ms /  839 draws
//     500         35.34       6614   13269   20.6 ms / 4272 draws
//
// i.e. ONE guest is ~8.5 draw calls and ~0.041 ms of frame, because `buildPeep`
// is a 13-mesh articulated rig with its own material per mesh. Five hundred of
// them is 22 ms of frame on the fastest machine this project has — 45 fps
// before the park draws a single ride. Triangles are NOT the problem (the frame
// is CPU-bound in three.js's per-object walk and draw submission: `cpuMs`
// measured 35.40 against `gpuMs` 35.34); MESH COUNT is.
//
// A second, quieter cost showed up in the same table: `guestsHidden` (every rig
// `visible = false`) read 12.93 ms at 99 guests and 14.76 ms at 500. Hiding a
// rig removes its draws but three.js still WALKS it — `updateMatrixWorld`
// recurses ~25 nodes per guest whether or not anything is drawn. That +1.8 ms
// is the scene-graph walk alone, and it is why far guests here are taken OUT OF
// THE SCENE GRAPH rather than merely hidden. Their CLICK PROXY stays behind as a
// root-level sibling (spawn.ts) so picking a guest keeps working at any distance.
//
// ---- WHAT THIS DOES ------------------------------------------------------
//
// Guests within `CROWD_DETAIL_RADIUS` of a live camera keep their FULL rig and
// the entire pose/overlay stack, unchanged. Everyone else is drawn by this
// module: EIGHT `InstancedMesh` pools (hip, torso, skull, hair, 2 arms, 2 legs),
// one instance per guest per pool, so the whole far crowd is **8 draw calls at
// any population** and their rigs LEAVE THE SCENE GRAPH (`removeFromParent`), so
// three.js neither draws nor walks them. Removal rather than `visible = false`
// because in three r169 `Object3D.updateMatrixWorld` recurses into children
// UNCONDITIONALLY — `visible` is only read by `projectObject`, so a hidden rig
// still costs its whole matrix walk, which is the +1.8 ms measured above.
//
// The proxy figure is `buildPeep`'s silhouette minus the parts that are
// sub-pixel at the crossover distance — no nose (r 0.018), no hand balls
// (r 0.05), no shoes, and low-detail `IcosahedronGeometry(r, 1)` heads (80
// faces) instead of detail 3 (1280). At 26 u a 0.9-u guest is ~38 px tall; at
// the orbit distance of a size-128 park (~180 u) it is ~5 px, which is roughly
// what an RCT2 peep is on screen anyway.
//
// Limbs still SWING: the walk cycle is periodic in phase, so the four limb
// angles' sines and cosines plus the body bob are precomputed once into a
// 64-step table (`SWING`) and looked up — zero trig per guest per frame. The
// curves are `buildPeep`'s own `walkTargets` at amplitude 1 (a guest walking at
// this sim's speeds solves to `amp = 1`, see `cadenceForSpeed`), so a guest
// crossing the boundary does not visibly change gait.
//
// ---- WHY A BUDGET AND NOT JUST A RADIUS ----------------------------------
//
// A fixed radius has a pathological case: park the camera in a busy plaza and
// hundreds of guests are inside it. So the radius is a CONTROLLER, not a
// constant: it shrinks 6 % per frame while more than `CROWD_DETAIL_BUDGET` rigs
// are inside it and grows back toward `CROWD_DETAIL_RADIUS` when under, which
// bounds the articulated population absolutely without a per-frame sort.
//
// ---- DETERMINISM ---------------------------------------------------------
//
// THE SIM MUST NOT DEPEND ON WHERE THE CAMERA IS. Everything gated on the LOD
// here is VISUAL ONLY: `guestPass` resolves the three timed events that carry
// sim consequences (the litter fling's release, the vomit's nausea/happiness
// relief and ground splat, the post-ride hop's balloon-slip roll) BEFORE the
// gate, on every guest, near or far. No hashed draw is skipped, and `hash01`
// carries no cursor, so the sequence of rolls is identical whatever the camera
// does. A remount with the same seed produces the same park.
//
// ---- OPT-IN ---------------------------------------------------------------
//
// With no `opts.cameras` the LOD is OFF and every guest keeps its full rig —
// which is what component PREVIEWS need (screenshots must stay pixel-identical)
// and what the `<ScenePreview>` host wires. `<Park>` passes its Stage cameras,
// so parks get the crowd.
//
// Implementation detail of createGameManager.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { GUEST_SCALE } from './types';
import type { SimGuest } from './types';
import type { Sim } from './sim';

/** WORLD-UNIT radius around any live camera inside which a guest keeps its full
 *  articulated rig. 26 u puts the crossover at ~38 px of guest height on a
 *  900-px viewport, past which the dropped detail (nose, hands, shoes, head
 *  tessellation) is at or under a pixel. */
export const CROWD_DETAIL_RADIUS = 26;
/** …and the HARD CEILING on how many rigs that radius may admit. 72 is below
 *  the 99-guest crowd this project already shipped and measured at 3.4 ms, so
 *  the articulated half of a 500-guest park costs LESS than the whole crowd of
 *  a 100-guest one did. */
export const CROWD_DETAIL_BUDGET = 72;
/** per-frame contraction/expansion of the radius controller (6 %: converges in
 *  ~12 frames, slow enough that an orbit never pops a whole district of rigs) */
const RADIUS_RATE = 0.06;
/** the controller never shrinks below this — a camera shoved into a crowd must
 *  still render the guests it is nose-to-nose with as real peeps */
const RADIUS_FLOOR = 6;

const TAU = Math.PI * 2;
/** phase quantisation of the precomputed walk cycle (64 steps ≈ 5.6° — the
 *  limb angle error is under 0.05 rad, i.e. sub-pixel at any distance this
 *  proxy is used at) */
const STEPS = 64;
/** 9 floats per step: sin/cos of legL, legR, armL, armR, then the body bob */
const SWING = new Float32Array(STEPS * 9);
for (let k = 0; k < STEPS; k += 1) {
  const ph = (k / STEPS) * TAU;
  const sn = Math.sin(ph);
  const cs = Math.cos(ph);
  // buildPeep's walkTargets, at amp = 1 (see the header)
  const knee = Math.sin(ph * 2) * 0.05;
  const a = [0.5 * sn + knee, -0.5 * sn + knee, -0.45 * sn, 0.45 * sn];
  const o = k * 9;
  for (let i = 0; i < 4; i += 1) {
    SWING[o + i * 2] = Math.sin(a[i]);
    SWING[o + i * 2 + 1] = Math.cos(a[i]);
  }
  SWING[o + 8] = Math.abs(cs) * 0.032;
}

/** PROXY CADENCE. The full rig solves its walk cadence per frame with
 *  `cadenceForSpeed`'s 8-iteration Newton loop; 500 of those is not free and the
 *  proxy does not need that accuracy (its feet are 5 px from the ground plane).
 *  The solve is very nearly linear in speed over this sim's range, so the proxy
 *  uses the slope through the walking speed band: stride = 1.6·sin(0.5)·0.5 u
 *  of ground per 2π of phase at amp 1, i.e. phase advance = 2π·v / stride. */
const CADENCE_PER_SPEED = TAU / (1.6 * Math.sin(0.5) * GUEST_SCALE);

/** which per-guest palette colour tints a part */
type Tint = 'shirt' | 'trousers' | 'skin' | 'hair';
interface PartSpec {
  /** geometry key (see `makeGeo`) */
  geo: 'hip' | 'torso' | 'skull' | 'hair' | 'arm' | 'leg';
  tint: Tint;
  /** PEEP-LOCAL offset (pre-GUEST_SCALE), matching buildPeep exactly */
  pos: [number, number, number];
  /** non-uniform scale (the hair cap is squashed) */
  scale?: [number, number, number];
  /** SWING channel — 0 legL, 1 legR, 2 armL, 3 armR. Present ⇒ the part hangs
   *  from a pivot at `pos` and rotates about local x, like buildPeep's `limb` */
  limb?: number;
  /** limb length: the box is centred at pivot-local (0, -len/2, 0) */
  len?: number;
}

/** the proxy figure — buildPeep's silhouette minus the sub-pixel parts.
 *  Positions are copied from buildPeep, NOT re-derived, so the two agree. */
const PARTS: PartSpec[] = [
  { geo: 'hip', tint: 'trousers', pos: [0, 0.52, 0] },
  { geo: 'torso', tint: 'shirt', pos: [0, 0.74, 0] },
  { geo: 'skull', tint: 'skin', pos: [0, 0.99, 0] },
  { geo: 'hair', tint: 'hair', pos: [0, 1.03, -0.012], scale: [1.02, 0.72, 1.02] },
  { geo: 'arm', tint: 'shirt', pos: [-0.19, 0.88, 0], limb: 2, len: 0.32 },
  { geo: 'arm', tint: 'shirt', pos: [0.19, 0.88, 0], limb: 3, len: 0.32 },
  { geo: 'leg', tint: 'trousers', pos: [-0.08, 0.46, 0], limb: 0, len: 0.4 },
  { geo: 'leg', tint: 'trousers', pos: [0.08, 0.46, 0], limb: 1, len: 0.4 },
];

export function createCrowd(s: Sim) {
  const t = s.t;
  const camsOf = s.opts.cameras ?? null;

  const makeGeo = (key: PartSpec['geo']): THREE.BufferGeometry => {
    switch (key) {
      case 'hip':
        return new t.BoxGeometry(0.26, 0.14, 0.18);
      case 'torso':
        return new t.BoxGeometry(0.3, 0.32, 0.2);
      case 'skull':
        return new t.IcosahedronGeometry(0.12, 1);
      case 'hair':
        return new t.IcosahedronGeometry(0.128, 1);
      case 'arm':
        return new t.BoxGeometry(0.09, 0.32, 0.11);
      default:
        return new t.BoxGeometry(0.09, 0.4, 0.11);
    }
  };

  // ONE material for all eight pools: white base modulated by `instanceColor`
  // (three r169 defines USE_COLOR in the fragment prefix whenever
  // `instancingColor` is set, so `diffuseColor.rgb *= vColor` applies without
  // `vertexColors`). No map — the fabric weave and the painted face are both
  // under a pixel out here, and one material means one shader program for the
  // entire crowd.
  // NOTHING IS BUILT WHEN THE LOD IS OFF (no `opts.cameras` — every preview).
  // `attach`/`place` become no-ops, `isNear` is always true, and the sim runs
  // the full rig on every guest exactly as it did before this module existed.
  const mat = camsOf ? new t.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 }) : null;
  const geos = camsOf ? PARTS.map((p) => makeGeo(p.geo)) : [];
  const root = new t.Group();
  root.name = 'crowdProxy';
  if (camsOf) s.group.add(root);

  let cap = 0;
  let pools: THREE.InstancedMesh[] = [];
  /** live slot count handed to `pool.count` — instances past it are not drawn */
  let used = 0;

  const grow = (n: number) => {
    if (!camsOf || n <= cap) return;
    const next = Math.max(64, cap * 2, Math.ceil(n / 64) * 64);
    const fresh = PARTS.map((_, i) => {
      const im = new t.InstancedMesh(geos[i], mat!, next);
      im.instanceMatrix.setUsage(t.DynamicDrawUsage);
      im.instanceColor = new t.InstancedBufferAttribute(new Float32Array(next * 3), 3);
      im.frustumCulled = false;
      im.castShadow = true;
      im.receiveShadow = true;
      im.name = `crowd:${PARTS[i].geo}`;
      // an InstancedMesh allocates its matrices ZEROED, and a zero matrix is
      // degenerate — an unallocated slot draws nothing, which is exactly the
      // "hidden instance" three.js has no flag for.
      if (pools[i]) {
        im.instanceMatrix.array.set(pools[i].instanceMatrix.array);
        const oc = pools[i].instanceColor;
        if (oc) im.instanceColor.array.set(oc.array);
        root.remove(pools[i]);
        // geometry + material are SHARED with the replacement — never disposed
      }
      root.add(im);
      return im;
    });
    pools = fresh;
    cap = next;
  };

  // ---- the detail radius controller (see the header) -------------------------
  let radius = CROWD_DETAIL_RADIUS;
  let nearN = 0;
  const camPos: THREE.Vector3[] = [];
  let camN = 0;
  /** OFF = nobody is looking. See `setVisuals`. */
  let visuals = true;

  /**
   * HEADLESS MODE — no guest gets a pose, and no instance matrix is written.
   *
   * `validatePark`'s sim smoke steps the manager ~2550 times (85 sim-s at a fixed
   * 1/30) with NOTHING rendered in between: it is a behaviour test, and it is the
   * one place where the whole population is stepped as fast as the CPU can go.
   * At 500 guests the visual half of that was the dominant term — 500 guests x
   * 8 parts x 16 floats x 2550 steps is 163 MILLION array writes for matrices no
   * frame will ever read, on top of 1.3 million pose updates.
   *
   * Everything with a SIM consequence stays on (guestPass resolves those above
   * the LOD gate), so the smoke tests exactly what it tested before — it just
   * stops paying to animate an audience of nobody. `<Park>` turns it back on the
   * moment the gate returns.
   */
  const setVisuals = (on: boolean) => {
    visuals = on;
  };

  const _c = new t.Color();
  /** register a freshly spawned guest's palette in every pool. Colours are
   *  written ONCE — the slot is `g.idx`, which never moves (the `guests` array
   *  only ever grows; despawned guests keep their index). */
  const attach = (g: SimGuest) => {
    if (!camsOf) return;
    grow(g.idx + 1);
    for (let i = 0; i < PARTS.length; i += 1) {
      _c.setHex(g.tint[PARTS[i].tint]);
      pools[i].setColorAt(g.idx, _c);
      const ic = pools[i].instanceColor;
      if (ic) ic.needsUpdate = true;
    }
  };

  /** per-frame prologue: sample the cameras, close the radius loop, reset */
  const beginFrame = () => {
    if (!camsOf || !visuals) return;
    const cams = camsOf();
    camN = cams.length;
    while (camPos.length < camN) camPos.push(new t.Vector3());
    for (let i = 0; i < camN; i += 1) cams[i].getWorldPosition(camPos[i]);
    // shrink while over budget, relax back when under (never past the ceiling)
    if (nearN > CROWD_DETAIL_BUDGET) radius = Math.max(RADIUS_FLOOR, radius * (1 - RADIUS_RATE));
    else if (radius < CROWD_DETAIL_RADIUS) radius = Math.min(CROWD_DETAIL_RADIUS, radius * (1 + RADIUS_RATE));
    nearN = 0;
    used = 0;
  };

  /** LOD verdict for one guest. `false` ⇒ this guest is drawn by the crowd
   *  pools and its rig is switched off. With no cameras wired every guest is
   *  near, i.e. the pre-crowd behaviour exactly. */
  const isNear = (g: SimGuest): boolean => {
    if (!visuals) return false; // headless: nobody gets a pose (see setVisuals)
    if (!camsOf) return true;
    const r2 = radius * radius;
    for (let i = 0; i < camN; i += 1) {
      const c = camPos[i];
      const dx = c.x - g.x;
      const dy = c.y - (g.baseY + 0.5);
      const dz = c.z - g.z;
      if (dx * dx + dy * dy + dz * dz < r2) {
        nearN += 1;
        return true;
      }
    }
    return false;
  };

  /** write one far guest's eight part matrices. `moving` runs the swing table;
   *  a standing guest gets the neutral pose (straight limbs, no bob). */
  const place = (g: SimGuest, moving: boolean, dt: number) => {
    if (!camsOf || !visuals) return;
    if (g.idx >= cap) grow(g.idx + 1);
    if (g.idx >= used) used = g.idx + 1;
    const S = GUEST_SCALE;
    const c = Math.cos(g.yaw);
    const sn = Math.sin(g.yaw);
    let o = -1;
    if (moving) {
      g.farPhase += g.farCadence * dt;
      if (g.farPhase >= TAU || g.farPhase < 0) g.farPhase -= TAU * Math.floor(g.farPhase / TAU);
      o = ((g.farPhase / TAU) * STEPS) | 0;
      if (o >= STEPS) o = STEPS - 1;
      o *= 9;
    }
    const bob = o >= 0 ? SWING[o + 8] : 0;
    const ox = g.x;
    const oy = g.baseY + bob * S;
    const oz = g.z;
    for (let i = 0; i < PARTS.length; i += 1) {
      const p = PARTS[i];
      const e = pools[i].instanceMatrix.array;
      const b = g.idx * 16;
      const px = p.pos[0];
      const py = p.pos[1];
      const pz = p.pos[2];
      if (p.limb === undefined) {
        const sx = p.scale ? p.scale[0] : 1;
        const sy = p.scale ? p.scale[1] : 1;
        const sz = p.scale ? p.scale[2] : 1;
        e[b] = S * sx * c;
        e[b + 1] = 0;
        e[b + 2] = -S * sx * sn;
        e[b + 3] = 0;
        e[b + 4] = 0;
        e[b + 5] = S * sy;
        e[b + 6] = 0;
        e[b + 7] = 0;
        e[b + 8] = S * sz * sn;
        e[b + 9] = 0;
        e[b + 10] = S * sz * c;
        e[b + 11] = 0;
        e[b + 12] = ox + S * (c * px + sn * pz);
        e[b + 13] = oy + S * py;
        e[b + 14] = oz + S * (c * pz - sn * px);
        e[b + 15] = 1;
      } else {
        // pivot at `pos`, rotation θ about local x, box centred at (0, -len/2, 0):
        // M = Ry(yaw)·Rx(θ), translation = root + S·(Ry·pivot + M·(0, -len/2, 0))
        const sa = o >= 0 ? SWING[o + p.limb * 2] : 0;
        const ca = o >= 0 ? SWING[o + p.limb * 2 + 1] : 1;
        const h = -(p.len as number) / 2;
        e[b] = S * c;
        e[b + 1] = 0;
        e[b + 2] = -S * sn;
        e[b + 3] = 0;
        e[b + 4] = S * sn * sa;
        e[b + 5] = S * ca;
        e[b + 6] = S * c * sa;
        e[b + 7] = 0;
        e[b + 8] = S * sn * ca;
        e[b + 9] = -S * sa;
        e[b + 10] = S * c * ca;
        e[b + 11] = 0;
        e[b + 12] = ox + S * (c * px + h * sn * sa);
        e[b + 13] = oy + S * (py + h * ca);
        e[b + 14] = oz + S * (h * c * sa - sn * px);
        e[b + 15] = 1;
      }
    }
    g.farShown = true;
  };

  /** blank a guest's instances — called once when a guest goes back to its full
   *  rig, hides (inside a hut, aboard a ride's entrance) or despawns */
  const clear = (g: SimGuest) => {
    if (!g.farShown || g.idx >= cap) return;
    for (let i = 0; i < PARTS.length; i += 1) {
      pools[i].instanceMatrix.array.fill(0, g.idx * 16, g.idx * 16 + 16);
    }
    g.farShown = false;
    if (g.idx >= used) used = g.idx + 1; // the blanking still has to be uploaded
  };

  const endFrame = () => {
    if (!camsOf || !visuals) return;
    for (let i = 0; i < pools.length; i += 1) {
      pools[i].count = used;
      pools[i].instanceMatrix.needsUpdate = true;
    }
  };

  /** live numbers for `stats()` / the perf probes */
  const snapshot = () => ({
    crowdRadius: +radius.toFixed(1),
    crowdRigs: nearN,
    crowdInstanced: Math.max(0, used),
    crowdDraws: camsOf ? pools.length : 0,
  });

  return { attach, beginFrame, isNear, place, clear, endFrame, setVisuals, snapshot, CADENCE_PER_SPEED, group: root };
}
