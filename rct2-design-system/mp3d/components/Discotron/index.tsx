import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mtx, mergedBoxes, mergedParts, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { buildEmitter } from '../ParticleKit';
import { buildNeonSign } from '../NeonSign';
import { DISCO_PALETTE } from '../DanceFloor';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// Discotron — the PULSE DISTRICT's mirror-ball GYRO SPINNER. A giant faceted
// mirror ball turns on a graphite mast in the middle of a black-gloss stage;
// six sweep arms radiate from the rotor below it, each carrying a two-seat pod
// on its own slew-ring turntable. The rotor spins, the arms RISE AND FALL (a
// gyro sweep, twice per revolution) and every pod turns slowly on its ring, so
// riders face a different part of the club every second. Overhead a circular
// LASER TRUSS on four legs rings the whole stage, its four heads trained on the
// ball's facets.
//
// THE BEAT IS THE POINT. The whole district runs on ONE clock — the same
// ~2.2 Hz beat the existing <DanceFloor> flashes its tiles to (and the Guest
// pose layer dances to), cycling the same DISCO_PALETTE. Off that beat:
//   * the ball's facets scintillate — 128 mirror tiles split into 4 shells,
//     each stepping its own palette colour on a hashed beat offset;
//   * THREE SHARD RIGS (5 light shafts + 5 elongated floor patches each) sweep
//     the stage at different rates and palette offsets, so rotating light
//     shards visibly rake across the floor and up over the pods;
//   * the four laser beams from the truss punch on the downbeat;
//   * the stage-rim LEDs chase in four steps, one step per beat;
//   * the speaker woofers thump, and the pods' trim strips pulse;
//   * even the ARM SWEEP is beat-locked — one full rise-and-fall of the arms
//     takes exactly 8 beats (3.64 s).
// The LIGHTING clock is ABSOLUTE (a club never stops, and a mirror ball never
// stops turning); only the RIDE motion runs on the `createMotionGate` clock, so
// the rotor is dead still with the arms level while guests board.
//
// DAYTIME READ: a dark club exterior in daylight is the real risk here, so the
// form carries the ride with no glow at all — a two-tier concrete/gloss stage
// with painted magenta+cyan radial inlays inside chrome inlay rings, a
// chrome-banded mast, real speaker stacks with inset woofer cones, a chorded
// steel truss ring and a SILVER faceted ball that reads as a mirror ball at
// noon. Every emissive sits at ~12-20% by day and ramps on `nightKOf`; THREE
// real PointLights total (ball wash, boarding gate, and the neon marquee's own).
// Deterministic (hashed sine only), absolute-time updaters, 140/300 particles.
//
// GEOMETRY NOTE (cost a rebuild): the pods are PEDESTAL-mounted on top of the
// sweep arms, not hung under them. A hanging pod puts its headrests and the
// riders' heads at the arm's own height, so the arm cuts through the tub and
// through the riders — there is no yoke length that fixes it while the pod
// still clears the deck. Cars-on-turntables is also how RCT2's spinning flat
// rides are built, and it gives every rider an unobstructed view of the ball.
// ---------------------------------------------------------------------------

/** the district beat — the SAME rate <DanceFloor> flashes its tiles at and the
 *  Guest pose layer's 'dance' state uses. Everything in the Pulse District keys
 *  off this so the three attractions read as one place. */
const BEAT_HZ = 2.2;
/** integer beat index (colours STEP once per beat) */
const beatStep = (time: number, off = 0) => Math.floor(time * BEAT_HZ + off);
/** 0.55…1 bloom that DIPS exactly on the colour change (DanceFloor's curve) */
const beatPulse = (time: number, ph = 0) => 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * (time * BEAT_HZ + ph)));
/** sharp downbeat spike — 1 on the beat, decaying to ~0 across it */
const beatKick = (time: number, ph = 0) => {
  const f = (((time * BEAT_HZ + ph) % 1) + 1) % 1;
  return Math.exp(-7 * f);
};
/** deterministic pseudo-random from an integer key (hashed sine) */
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (k: number) => k * k * (3 - 2 * k);

/** The district's COOL SUBSET of <DanceFloor>'s DISCO_PALETTE: magenta, cyan,
 *  violet and blue. The floor may flash amber and lime — a mirror ball throwing
 *  amber and lime shards read as a fairground carousel rather than a nightclub
 *  in the harness, and the world's brief is magenta/cyan/violet on graphite. The
 *  BEAT and the palette family stay shared; only the two warm slots are dropped
 *  (violet is inserted in their place). */
export const PULSE_PALETTE = [DISCO_PALETTE[0], DISCO_PALETTE[1], 0x7b3fe4, DISCO_PALETTE[4]];
const paletteAt = (i: number) => PULSE_PALETTE[((i % PULSE_PALETTE.length) + PULSE_PALETTE.length) % PULSE_PALETTE.length];

// ---- palette: graphite base, black gloss, chrome, magenta/cyan -------------
const GRAPHITE = 0x3a3d45; // arms, mast, pod shells
const GRAPHITE_D = 0x2a2d34; // shadow-side graphite, bearings, cone surrounds
const GLOSS = 0x16171c; // black gloss panels (tub walls, speaker cabinets, stage face)
const DECK = 0x21232a; // the stage DECK — a shade off pure black so pods, riders
// and shard patches all stay legible against it in daylight
const STEEL = 0x6e737d; // structural steel (truss ring + legs). Graphite at
// metal 0.3 went near-black against grass and the ring read as coaster track —
// this is deliberately the lightest tone in the kit so the truss stays truss.
const CHROME = 0xa6adb6; // brushed chrome bands, rails, rings (metal ≤0.35)
const CONCRETE = 0x9b9a96; // apron slab, footings
const MIRROR = 0xd9dbe3; // mirror-ball facet tiles
const MAGENTA = 0xd815b8; // district accent A (DISCO_PALETTE[0])
const CYAN = 0x18c8d8; // district accent B (DISCO_PALETTE[1])
const FABRIC = 0x2b2f3c; // seat upholstery (charcoal-blue)

// ---- dimensions (park scale — a guest is ~0.55 tall) ----------------------
const APRON_R = 2.2; // outer concrete apron radius
const APRON_H = 0.145;
const STAGE_R = 1.98; // raised gloss stage disc
const STAGE_H = 0.4; // its top
const HUB_Y = 0.58; // sweep-arm plane (underside 0.53 — 0.13 over the deck)
const ARM_IN = 0.32; // arm root radius
const ARM_OUT = 1.32; // turntable radius (swept envelope 1.89 — inside the stage)
const ARM_LEN = ARM_OUT - ARM_IN;
const ARMS = 6;
const TILT_MAX = 0.42; // arms sweep 0 → 0.42 rad (they never dip below parked)
const BALL_Y = 2.6;
const BALL_R = 0.44;
const TRUSS_R = 2.3; // truss ring + its four legs, outside apron and pods
const TRUSS_Y = 3.0;
const TRUSS_LOW = TRUSS_Y - 0.28; // the ring's lower chord

export interface DiscotronOpts {
  /** decorative riders in the pods (default true; <Discotron register> turns
   *  them OFF so REAL GameManager guests fill the 12 seats via seatWorld) */
  riders?: boolean;
}

export interface DiscotronBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
}

/** tub floor height above the pod origin (= the turntable top) */
const FLOOR = 0.11;

/**
 * One two-seat pod, standing on its turntable (local origin = the slew-ring
 * top, +z = the direction the riders face). REAL SEATS: a moulded pan on a
 * chrome frame, a fabric cushion sunk into it, a shell backrest with its own
 * fabric pad and lumbar roll, a headrest cap and a padded lap bar — and the
 * `seatWorld` anchor is placed so a 0.5-scale guest's HIPS land ON the cushion
 * (cushion top FLOOR+0.245; a peep's hip line sits 0.24 above its group origin,
 * so the anchor goes at FLOOR+0.005).
 */
function buildPod(
  t: typeof THREE,
  n: number,
  opts: { seats: THREE.Group[]; riders: boolean; trims: THREE.MeshStandardMaterial[] },
): THREE.Group {
  const pod = new t.Group();
  // Everything static in a pod is BATCHED by material family: six pods of
  // hand-placed boxes cost ~210 draw calls, which put the ride at 2.4× the
  // fleet's flat-ride budget (Enterprise: 175 meshes unregistered). Batched it
  // is ~9 meshes per pod.
  const graphite: MergedBoxSpec[] = []; // pan, capping rim, seat pans, backrests
  const gloss: MergedBoxSpec[] = []; // tub walls + front lip
  const chrome: MergedBoxSpec[] = []; // footwell plate, seat frames, boarding step
  const fabric: MergedBoxSpec[] = []; // cushions + back pads
  const dark: PartSpec[] = []; // slew ring, headrests, lap bars
  const chromeRound: PartSpec[] = []; // ring cap, grab handles, bar stems
  const rolls: PartSpec[] = []; // lumbar rolls
  const cylGeo = (rt: number, rb: number, h: number, seg: number) => new t.CylinderGeometry(rt, rb, h, seg);

  // ---- pedestal: slew-ring collar + the tub's structural spreader plate ----
  dark.push({ geo: cylGeo(0.3, 0.33, 0.06, 20), matrix: mtx(t, [0, 0.03, 0]) });
  dark.push({ geo: new t.BoxGeometry(0.62, 0.05, 0.5), matrix: mtx(t, [0, 0.075, 0]) });
  chromeRound.push({ geo: cylGeo(0.335, 0.335, 0.02, 20), matrix: mtx(t, [0, 0.06, 0]) });

  // ---- tub: black-gloss shell on a graphite floor pan --------------------
  graphite.push({ dims: [0.88, 0.06, 0.6], pos: [0, FLOOR - 0.03, 0], repeat: [3, 2] }); // floor pan
  gloss.push({ dims: [0.9, 0.5, 0.08], pos: [0, FLOOR + 0.25, -0.29], repeat: [3, 2] }); // back wall
  [-1, 1].forEach((s) => gloss.push({ dims: [0.07, 0.44, 0.6], pos: [s * 0.415, FLOOR + 0.22, 0], repeat: [2, 2] })); // side walls
  gloss.push({ dims: [0.9, 0.2, 0.08], pos: [0, FLOOR + 0.1, 0.29], repeat: [3, 1] }); // front lip
  // capping rail: a RIM of four bars round the OPEN tub (never a lid — the
  // first cut used one 0.94 × 0.66 slab and every pod read as a black box)
  graphite.push({ dims: [0.94, 0.05, 0.1], pos: [0, FLOOR + 0.225, 0.29], repeat: [3, 1] });
  graphite.push({ dims: [0.94, 0.05, 0.1], pos: [0, FLOOR + 0.525, -0.29], repeat: [3, 1] });
  [-1, 1].forEach((s) => graphite.push({ dims: [0.1, 0.05, 0.66], pos: [s * 0.415, FLOOR + 0.465, 0], repeat: [1, 2] }));
  chrome.push({ dims: [0.7, 0.02, 0.44], pos: [0, FLOOR + 0.01, 0.03], repeat: [3, 2] }); // chequer-plate footwell
  // boarding step + grab handles on the front face (the tub floor stands 0.34
  // above the stage deck — guests need somewhere to put a foot)
  chrome.push({ dims: [0.5, 0.04, 0.14], pos: [0, 0.09, 0.4], repeat: [3, 1] });
  [-1, 1].forEach((s) => chromeRound.push({ geo: cylGeo(0.018, 0.018, 0.26, 8), matrix: mtx(t, [s * 0.46, FLOOR + 0.24, 0.16]) }));
  pod.add(box(t, [0.34, 0.06, 0.02], n % 2 ? CYAN : MAGENTA, [0, FLOOR + 0.14, 0.335], { rough: 0.45 })); // painted chevron
  // neon trim strip round the tub (beat-pulsed, ONE material per pod)
  const trim = new t.MeshStandardMaterial({
    color: n % 2 ? CYAN : MAGENTA,
    emissive: n % 2 ? CYAN : MAGENTA,
    emissiveIntensity: 0.18,
    roughness: 0.4,
  });
  const trimParts: PartSpec[] = [
    { geo: new t.BoxGeometry(0.03, 0.03, 0.62), matrix: mtx(t, [-0.45, FLOOR + 0.4, 0]) },
    { geo: new t.BoxGeometry(0.03, 0.03, 0.62), matrix: mtx(t, [0.45, FLOOR + 0.4, 0]) },
    { geo: new t.BoxGeometry(0.86, 0.03, 0.03), matrix: mtx(t, [0, FLOOR + 0.22, 0.335]) },
  ];
  const trimMesh = mergedParts(t, trimParts, trim);
  trimMesh.castShadow = false;
  pod.add(trimMesh);
  opts.trims.push(trim);

  // ---- the two REAL seats ------------------------------------------------
  [-0.22, 0.22].forEach((sx, k) => {
    chrome.push({ dims: [0.38, 0.035, 0.36], pos: [sx, FLOOR + 0.115, -0.02] }); // seat frame
    graphite.push({ dims: [0.36, 0.06, 0.34], pos: [sx, FLOOR + 0.165, -0.02], repeat: [2, 1] }); // moulded pan
    fabric.push({ dims: [0.32, 0.06, 0.3], pos: [sx, FLOOR + 0.215, -0.02], repeat: [2, 1] }); // cushion → top FLOOR+0.245
    graphite.push({ dims: [0.36, 0.32, 0.06], pos: [sx, FLOOR + 0.37, -0.2], repeat: [2, 2] }); // backrest shell
    fabric.push({ dims: [0.3, 0.27, 0.05], pos: [sx, FLOOR + 0.365, -0.155], repeat: [2, 2] }); // back pad, biting the cushion
    rolls.push({ geo: cylGeo(0.032, 0.032, 0.3, 10), matrix: mtx(t, [sx, FLOOR + 0.245, -0.15], [0, 0, Math.PI / 2]) }); // lumbar roll ON the cushion
    dark.push({ geo: new t.BoxGeometry(0.24, 0.08, 0.07), matrix: mtx(t, [sx, FLOOR + 0.555, -0.185]) }); // headrest cap
    dark.push({ geo: cylGeo(0.03, 0.03, 0.34, 10), matrix: mtx(t, [sx, FLOOR + 0.29, 0.14], [0, 0, Math.PI / 2]) }); // padded lap bar
    chromeRound.push({ geo: cylGeo(0.016, 0.016, 0.13, 8), matrix: mtx(t, [sx, FLOOR + 0.23, 0.14]) }); // bar stem
    // seat anchor — REAL guests ride here, hips ON the cushion top
    const seat = new t.Group();
    seat.position.set(sx, FLOOR + 0.005, -0.01);
    pod.add(seat);
    opts.seats.push(seat);
    if (opts.riders) {
      const idx = n * 2 + k;
      const p = buildPeep(t, {
        skin: SKIN_TONES[idx % SKIN_TONES.length],
        shirt: SHIRTS[(idx * 3 + 2) % SHIRTS.length],
        seated: true,
        expression: idx % 3 === 0 ? 'surprised' : 'happy',
        female: idx % 2 === 1,
      });
      p.group.scale.setScalar(0.5); // GUEST_SCALE — decorative riders match real ones
      p.group.userData.lodDetail = true;
      seat.add(p.group);
    }
  });

  // ---- flush the batches: 7 meshes for the whole pod ---------------------
  pod.add(mergedBoxes(t, graphite, GRAPHITE, { tex: 'metal', metal: 0.3, rough: 0.42 }));
  pod.add(mergedBoxes(t, gloss, GLOSS, { tex: 'plastic', rough: 0.18 }));
  pod.add(mergedBoxes(t, chrome, CHROME, { tex: 'metal', metal: 0.32, rough: 0.32 }));
  pod.add(mergedBoxes(t, fabric, FABRIC, { tex: 'fabric', rough: 0.95 }));
  pod.add(mergedParts(t, dark, mat(t, GRAPHITE_D, { tex: 'metal', metal: 0.3, rough: 0.45 })));
  pod.add(mergedParts(t, chromeRound, mat(t, CHROME, { tex: 'metal', metal: 0.32, rough: 0.3 })));
  pod.add(mergedParts(t, rolls, mat(t, FABRIC, { tex: 'fabric', rough: 0.95 })));
  return pod;
}

export function buildDiscotronScene(three: typeof THREE, opts: DiscotronOpts = {}): DiscotronBuilt {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const seats: THREE.Group[] = []; // 6 pods × 2 = capacity 12

  /** pure-emissive additive material — light, never lit geometry */
  const additive = (tint: number, emi: number, op: number) =>
    new t.MeshStandardMaterial({
      color: 0x000000,
      emissive: tint,
      emissiveIntensity: emi,
      transparent: true,
      opacity: op,
      depthWrite: false,
      blending: t.AdditiveBlending,
      side: t.DoubleSide,
      roughness: 1,
    });

  // =========================================================================
  // 1. THE STAGE — concrete apron + raised gloss disc with painted inlays
  // =========================================================================
  g.add(cyl(t, APRON_R, APRON_R + 0.06, APRON_H, CONCRETE, [0, APRON_H / 2, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.94, seg: 40 }));
  g.add(cyl(t, STAGE_R, STAGE_R + 0.04, STAGE_H - APRON_H, GLOSS, [0, APRON_H + (STAGE_H - APRON_H) / 2, 0], { tex: 'plastic', repeat: [10, 1], rough: 0.2, seg: 40 }));
  g.add(cyl(t, STAGE_R - 0.02, STAGE_R - 0.02, 0.03, DECK, [0, STAGE_H - 0.015, 0], { tex: 'plastic', repeat: [6, 6], rough: 0.16, seg: 40 }));
  // painted radial inlays inside two chrome inlay rings — the DAYTIME graphic
  const wedge = (colour: number, phase: number) => {
    const parts: PartSpec[] = [];
    for (let i = phase; i < 12; i += 2) {
      const a = (i / 12) * Math.PI * 2;
      parts.push({
        geo: new t.BoxGeometry(0.14, 0.008, 1.1),
        matrix: new t.Matrix4().makeRotationY(a).setPosition(Math.sin(a) * 1.29, STAGE_H + 0.004, Math.cos(a) * 1.29),
      });
    }
    const mesh = mergedParts(t, parts, mat(t, colour, { rough: 0.42 }));
    mesh.castShadow = false;
    return mesh;
  };
  g.add(wedge(MAGENTA, 0));
  g.add(wedge(CYAN, 1));
  [0.72, 1.86, STAGE_R + 0.02].forEach((rr) => {
    const ring = new t.Mesh(new t.TorusGeometry(rr, rr > 1.9 ? 0.035 : 0.022, 5, 44), mat(t, CHROME, { tex: 'metal', metal: 0.32, rough: 0.32 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = STAGE_H;
    ring.castShadow = false;
    g.add(ring);
  });

  // ---- stage-rim LEDs: 32 lamps in 4 chase groups (one step per beat) -----
  const rimMats: THREE.MeshStandardMaterial[] = [];
  for (let grp = 0; grp < 4; grp += 1) {
    const parts: PartSpec[] = [];
    for (let i = grp; i < 32; i += 4) {
      const a = (i / 32) * Math.PI * 2;
      parts.push({
        geo: new t.BoxGeometry(0.08, 0.05, 0.05),
        matrix: new t.Matrix4().makeRotationY(a).setPosition(Math.sin(a) * (STAGE_R + 0.05), STAGE_H - 0.1, Math.cos(a) * (STAGE_R + 0.05)),
      });
    }
    const m = new t.MeshStandardMaterial({ color: paletteAt(grp), emissive: paletteAt(grp), emissiveIntensity: 0.2, roughness: 0.35 });
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = false;
    g.add(mesh);
    rimMats.push(m);
  }

  // =========================================================================
  // 2. THE MAST + the giant faceted MIRROR BALL
  // =========================================================================
  g.add(cyl(t, 0.42, 0.46, 0.22, GRAPHITE, [0, STAGE_H + 0.11, 0], { tex: 'metal', repeat: [6, 1], metal: 0.3, rough: 0.45, seg: 24 })); // machinery drum
  g.add(cyl(t, 0.44, 0.44, 0.04, CHROME, [0, STAGE_H + 0.23, 0], { tex: 'metal', metal: 0.32, rough: 0.28, seg: 24 })); // drum band
  g.add(cyl(t, 0.34, 0.38, 0.2, GRAPHITE_D, [0, HUB_Y, 0], { tex: 'metal', repeat: [5, 1], metal: 0.3, rough: 0.4, seg: 20 })); // rotor bearing housing
  g.add(cyl(t, 0.15, 0.2, 1.4, GRAPHITE, [0, 1.34, 0], { tex: 'metal', repeat: [3, 5], metal: 0.3, rough: 0.45, seg: 16 })); // mast 0.64…2.04
  [1.0, 1.45, 1.9].forEach((y) => g.add(cyl(t, 0.17, 0.17, 0.05, CHROME, [0, y, 0], { tex: 'metal', metal: 0.32, rough: 0.28, seg: 16 }))); // collars
  g.add(cyl(t, 0.12, 0.12, 0.24, GRAPHITE_D, [0, 2.11, 0], { tex: 'metal', metal: 0.3, rough: 0.4, seg: 14 })); // ball motor housing

  const ballRig = new t.Group();
  ballRig.position.set(0, BALL_Y, 0);
  g.add(ballRig);
  ballRig.add(ball(t, BALL_R - 0.03, 0x33363e, [0, 0, 0], { flat: true, rough: 0.55, metal: 0.2 })); // the seam core the tiles are glued to
  // 128 mirror tiles on a Fibonacci sphere (≈90% coverage — 48 left the ball
  // reading as a spotty dark sphere), split into 4 SHELLS so the facets
  // scintillate independently: each shell steps its own palette colour on the
  // beat with a hashed offset, and the whole ball still costs 4 draw calls.
  const facetMats: THREE.MeshStandardMaterial[] = [];
  const TILES = 128;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (let shell = 0; shell < 4; shell += 1) {
    const parts: PartSpec[] = [];
    for (let i = shell; i < TILES; i += 4) {
      const y = 1 - (2 * (i + 0.5)) / TILES;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = GOLDEN * i;
      const nrm = new t.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
      const t1 = new t.Vector3(0, 1, 0).cross(nrm);
      if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = new t.Vector3().crossVectors(nrm, t1).normalize();
      parts.push({
        geo: new t.BoxGeometry(0.145, 0.145, 0.014),
        matrix: new t.Matrix4().makeBasis(t1, t2, nrm).setPosition(nrm.clone().multiplyScalar(BALL_R - 0.007)),
      });
    }
    const m = new t.MeshStandardMaterial({
      color: MIRROR,
      emissive: paletteAt(shell),
      emissiveIntensity: 0.12,
      roughness: 0.14,
      metalness: 0.28,
      flatShading: true,
    });
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = false;
    ballRig.add(mesh);
    facetMats.push(m);
  }
  // soft additive bloom shell around the ball — a mirror ball under four lasers
  // has a halo, and it anchors the shafts to their source
  const haloMat = additive(0xf2f6ff, 0.4, 0.1);
  const halo = new t.Mesh(new t.SphereGeometry(BALL_R * 1.5, 16, 12), haloMat);
  halo.castShadow = false;
  halo.renderOrder = 2;
  ballRig.add(halo);

  // =========================================================================
  // 3. THE SHARD RIGS — rotating light shafts + floor patches off the ball
  // =========================================================================
  // Three independent rigs, each 5 tapered light shafts + 5 elongated floor
  // patches merged into ONE additive mesh, spinning at its own rate with its
  // own palette offset. Every shaft is aimed to land INSIDE the stage disc, so
  // the ride's measured footprint (and therefore its queue geometry) stays
  // compact — the shards rake the floor and the pods, not the surrounding park.
  interface ShardRig {
    grp: THREE.Group;
    shafts: THREE.MeshStandardMaterial;
    patches: THREE.MeshStandardMaterial;
    rate: number;
    off: number;
  }
  const shardRigs: ShardRig[] = [];
  const SHARD_FLOOR = STAGE_H + 0.012;
  for (let s = 0; s < 3; s += 1) {
    const grp = new t.Group();
    grp.position.set(0, BALL_Y, 0);
    g.add(grp);
    const shaftParts: PartSpec[] = [];
    const patchParts: PartSpec[] = [];
    for (let j = 0; j < 6; j += 1) {
      const az = (j / 6) * Math.PI * 2 + s * 0.35;
      const el = 0.88 + hash01(s * 31 + j * 7 + 3) * 0.44; // 0.88…1.32 rad below horizontal
      const drop = BALL_Y - SHARD_FLOOR;
      const reach = drop / Math.tan(el); // 0.5…1.83 — inside STAGE_R
      const dir = new t.Vector3(Math.sin(az) * Math.cos(el), -Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      const near = BALL_R * 0.92;
      const len = drop / Math.sin(el) - near;
      // tapered open cone: local +y maps to `dir`, so rTop is the FLOOR end
      shaftParts.push({
        geo: new t.CylinderGeometry(0.16, 0.035, len, 6, 1, true),
        matrix: new t.Matrix4()
          .makeRotationFromQuaternion(new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir))
          .setPosition(dir.clone().multiplyScalar(near + len / 2)),
      });
      // the shard ITSELF on the floor: an ellipse stretched along the beam
      const fm = new t.Matrix4().makeRotationY(az);
      fm.setPosition(Math.sin(az) * reach, -drop + 0.004, Math.cos(az) * reach);
      fm.multiply(new t.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new t.Matrix4().makeScale(0.26, 0.7, 1));
      patchParts.push({ geo: new t.CircleGeometry(0.5, 16), matrix: fm });
    }
    const shaftMat = additive(paletteAt(s), 0.6, 0.1);
    const patchMat = additive(paletteAt(s), 0.9, 0.3);
    ([
      [shaftParts, shaftMat, 3],
      [patchParts, patchMat, 4],
    ] as [PartSpec[], THREE.Material, number][]).forEach(([parts, material, order]) => {
      const mesh = mergedParts(t, parts, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = order;
      grp.add(mesh);
    });
    // the three rigs take ADJACENT palette slots (magenta / cyan / violet) so
    // three colours of shard rake the floor at once — offsets of 2 on a 4-slot
    // palette had two rigs sharing a colour and the night shot went monochrome
    shardRigs.push({ grp, shafts: shaftMat, patches: patchMat, rate: 0.34 + s * 0.09, off: s });
  }

  // =========================================================================
  // 4. THE ROTOR — 6 sweep arms, gyro tilt, pods on their own turntables
  // =========================================================================
  const rotor = new t.Group();
  rotor.position.set(0, HUB_Y, 0);
  g.add(rotor);
  rotor.add(cyl(t, 0.3, 0.3, 0.18, GRAPHITE, [0, 0, 0], { tex: 'metal', repeat: [5, 1], metal: 0.3, rough: 0.42, seg: 18 })); // hub
  rotor.add(cyl(t, 0.32, 0.32, 0.04, CHROME, [0, 0.11, 0], { tex: 'metal', metal: 0.32, rough: 0.28, seg: 18 })); // hub cap
  const podTrims: THREE.MeshStandardMaterial[] = [];
  interface Arm {
    tilt: THREE.Group;
    podRoot: THREE.Group;
    podYaw: THREE.Group;
    phase: number;
    spin: number;
  }
  const arms: Arm[] = [];
  for (let i = 0; i < ARMS; i += 1) {
    const armPivot = new t.Group();
    armPivot.rotation.y = (i / ARMS) * Math.PI * 2;
    rotor.add(armPivot);
    const tilt = new t.Group(); // rotates about the TANGENTIAL axis (local z)
    tilt.position.set(ARM_IN, 0, 0);
    armPivot.add(tilt);
    tilt.add(box(t, [ARM_LEN, 0.1, 0.18], GRAPHITE, [ARM_LEN / 2, 0, 0], { tex: 'metal', repeat: [5, 1], metal: 0.3, rough: 0.44 })); // arm
    tilt.add(box(t, [ARM_LEN * 0.88, 0.04, 0.07], CHROME, [ARM_LEN / 2, 0.07, 0], { tex: 'metal', repeat: [4, 1], metal: 0.32, rough: 0.28 })); // arm cap strip
    tilt.add(box(t, [ARM_LEN * 0.72, 0.14, 0.05], GRAPHITE_D, [ARM_LEN * 0.46, -0.085, 0], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.44, rotZ: 0.05 })); // web
    tilt.add(cyl(t, 0.09, 0.09, 0.26, GRAPHITE_D, [0, 0, 0], { rotX: Math.PI / 2, metal: 0.3, rough: 0.4, seg: 12 })); // tilt trunnion
    // hydraulic ram. ⚠️ It used to sit at y −0.12 and be 0.5 long, which put its
    // lower end at arm-local −0.146 → world 0.34, i.e. **0.06 u inside the STATIC
    // stage disc** (top 0.40) — and because the rotor turns while the stage does
    // not, all six rams ploughed a circle through the deck all cycle. Found by
    // the exact ray-parity clash sweep (`/tmp/mp3d-render/aud-pd-clash2.tsx`:
    // 2 842 + 4 192 moving-vertex samples inside the two stage-disc cylinders),
    // never by a render — the deck is opaque and the rams are behind the pods.
    // Raised to −0.04 and shortened to 0.42: lower end arm-local −0.146 → world
    // 0.434, clear of the deck by 0.034, and the ram only ever RISES from there
    // (`tilt` is applied as 0.5 − 0.5·cos, so the arms never dip below parked).
    tilt.add(cyl(t, 0.026, 0.032, ARM_LEN * 0.42, CHROME, [ARM_LEN * 0.3, -0.04, 0], { rotZ: -1.2, tex: 'metal', metal: 0.32, rough: 0.3, seg: 10 }));
    const podRoot = new t.Group(); // gimbal: counter-rotates so riders lean, not tip
    podRoot.position.set(ARM_LEN, 0.05, 0);
    tilt.add(podRoot);
    const podYaw = new t.Group(); // the pod's own slew ring
    podRoot.add(podYaw);
    podYaw.add(buildPod(t, i, { seats, riders: withRiders, trims: podTrims }));
    arms.push({ tilt, podRoot, podYaw, phase: (i / ARMS) * Math.PI * 2, spin: 0.46 + 0.08 * i });
  }
  const vehicle = arms[0].podYaw; // lead pod — RideViewer follow/onboard cam

  // =========================================================================
  // 5. THE LASER TRUSS — a chorded steel RING on four legs, heads on the ball
  // =========================================================================
  const legSteel: PartSpec[] = [];
  const legChrome: PartSpec[] = [];
  const legFoot: PartSpec[] = [];
  const legFlange: PartSpec[] = [];
  ([
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as [number, number][]).forEach(([sx, sz]) => {
    const lx = (sx * TRUSS_R) / Math.SQRT2;
    const lz = (sz * TRUSS_R) / Math.SQRT2;
    legSteel.push({ geo: new t.CylinderGeometry(0.07, 0.1, TRUSS_Y, 12), matrix: mtx(t, [lx, TRUSS_Y / 2, lz]), uv: [2, 8] });
    [0.9, 1.8, 2.6].forEach((cy) => legChrome.push({ geo: new t.CylinderGeometry(0.095, 0.095, 0.05, 12), matrix: mtx(t, [lx, cy, lz]) })); // collars
    legFoot.push({ geo: new t.CylinderGeometry(0.17, 0.2, 0.07, 14), matrix: mtx(t, [lx, 0.035, lz]), uv: [3, 1] }); // footing pad
    legFlange.push({ geo: new t.CylinderGeometry(0.12, 0.14, 0.06, 12), matrix: mtx(t, [lx, 0.09, lz]) }); // base flange
  });
  g.add(mergedParts(t, legSteel, mat(t, STEEL, { tex: 'metal', metal: 0.22, rough: 0.42 })));
  g.add(mergedParts(t, legChrome, mat(t, CHROME, { tex: 'metal', metal: 0.32, rough: 0.28 })));
  g.add(mergedParts(t, legFoot, mat(t, CONCRETE, { tex: 'concrete', rough: 0.94 })));
  g.add(mergedParts(t, legFlange, mat(t, GRAPHITE_D, { tex: 'metal', metal: 0.3, rough: 0.45 })));
  // the ring: 32 upper + 32 lower chord segments with zigzag webbing between
  const SEGS = 32;
  const segLen = 2 * TRUSS_R * Math.sin(Math.PI / SEGS) + 0.01;
  const midR = TRUSS_R * Math.cos(Math.PI / SEGS);
  const trussParts: MergedBoxSpec[] = [];
  for (let k = 0; k < SEGS; k += 1) {
    const a = ((k + 0.5) / SEGS) * Math.PI * 2;
    const px = Math.sin(a) * midR;
    const pz = Math.cos(a) * midR;
    const tang = a + Math.PI / 2; // the chord runs along the tangent
    trussParts.push({ dims: [0.06, 0.07, segLen], pos: [px, TRUSS_Y, pz], rotY: tang, repeat: [1, 2] });
    trussParts.push({ dims: [0.055, 0.06, segLen], pos: [px, TRUSS_LOW, pz], rotY: tang, repeat: [1, 2] });
    trussParts.push({
      dims: [0.04, 0.36, 0.04],
      pos: [Math.sin(a) * TRUSS_R, (TRUSS_Y + TRUSS_LOW) / 2, Math.cos(a) * TRUSS_R],
      rotY: tang,
      rotZ: (k % 2 ? 1 : -1) * 0.55,
    });
  }
  g.add(mergedBoxes(t, trussParts, STEEL, { tex: 'metal', metal: 0.22, rough: 0.34 }));
  // LED nodes clipped along the ring's lower chord, in 2 chase groups — the
  // truss has to read as a LIGHTING truss, not as a hoop of coaster track
  const trussLedMats: THREE.MeshStandardMaterial[] = [];
  for (let grp = 0; grp < 2; grp += 1) {
    const parts: PartSpec[] = [];
    for (let k = grp; k < SEGS; k += 2) {
      const a = ((k + 0.5) / SEGS) * Math.PI * 2;
      parts.push({
        geo: new t.BoxGeometry(0.05, 0.05, 0.16),
        matrix: new t.Matrix4().makeRotationY(a + Math.PI / 2).setPosition(Math.sin(a) * (midR - 0.055), TRUSS_LOW - 0.045, Math.cos(a) * (midR - 0.055)),
      });
    }
    const m = new t.MeshStandardMaterial({ color: paletteAt(grp), emissive: paletteAt(grp), emissiveIntensity: 0.2, roughness: 0.35 });
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = false;
    g.add(mesh);
    trussLedMats.push(m);
  }

  // 4 laser heads on the ring, trained inward at the ball
  const laserMats: THREE.MeshStandardMaterial[] = [];
  const laserBeamParts: PartSpec[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const hx = Math.sin(a) * (TRUSS_R - 0.04);
    const hz = Math.cos(a) * (TRUSS_R - 0.04);
    const hy = TRUSS_LOW - 0.14;
    const head = new t.Group();
    head.position.set(hx, hy, hz);
    head.lookAt(0, BALL_Y, 0); // non-camera lookAt: local +z faces the ball
    g.add(head);
    head.add(box(t, [0.17, 0.15, 0.3], GLOSS, [0, 0, 0.02], { tex: 'plastic', repeat: [1, 2], rough: 0.22 })); // housing
    head.add(box(t, [0.21, 0.05, 0.09], CHROME, [0, 0.1, -0.04], { tex: 'metal', metal: 0.32, rough: 0.3 })); // yoke clamp
    const lensMat = new t.MeshStandardMaterial({ color: paletteAt(i + 1), emissive: paletteAt(i + 1), emissiveIntensity: 0.22, roughness: 0.3 });
    const lens = new t.Mesh(new t.CylinderGeometry(0.055, 0.055, 0.03, 12), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.18);
    head.add(lens);
    laserMats.push(lensMat);
    // the beam: a hair-thin additive rod from the head lens to the ball skin
    const from = new t.Vector3(hx, hy, hz);
    const d = new t.Vector3(0, BALL_Y, 0).sub(from);
    const L = d.length() - BALL_R * 0.85;
    const dir = d.clone().normalize();
    laserBeamParts.push({
      geo: new t.CylinderGeometry(0.026, 0.014, L, 5, 1, true),
      matrix: new t.Matrix4()
        .makeRotationFromQuaternion(new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir))
        .setPosition(from.clone().addScaledVector(dir, L / 2)),
    });
  }
  const laserBeamMat = additive(0xe8f4ff, 0.5, 0.16);
  const laserBeams = mergedParts(t, laserBeamParts, laserBeamMat);
  laserBeams.castShadow = false;
  laserBeams.renderOrder = 3;
  g.add(laserBeams);

  // =========================================================================
  // 6. SPEAKER STACKS — two flanking the boarding gate, two behind the stage
  // =========================================================================
  const wooferGroups: THREE.Group[] = [];
  const cabPlinth: MergedBoxSpec[] = [];
  const cabBody: MergedBoxSpec[] = [];
  const cabCap: MergedBoxSpec[] = [];
  const cabBadge: [MergedBoxSpec[], MergedBoxSpec[]] = [[], []];
  const tweeters: PartSpec[] = [];
  ([
    [-1.08, 2.36, 0.4], // flank the gate, cones aimed OUT at the queue
    [1.08, 2.36, -0.4],
    [-1.76, -1.76, 2.36], // stage monitors, cones aimed IN across the floor
    [1.76, -1.76, -2.36],
  ] as [number, number, number][]).forEach(([sx, sz, yaw], i) => {
    // the cabinet bodies are BATCHED at the top level (4 identical stacks × 4
    // boxes is 16 draw calls for nothing); only the woofers need a live group
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const at = (lx: number, ly: number, lz: number): [number, number, number] => [sx + lx * c + lz * s, ly, sz - lx * s + lz * c];
    cabPlinth.push({ dims: [0.56, 0.08, 0.48], pos: at(0, 0.04, 0), rotY: yaw, repeat: [2, 2] });
    cabBody.push({ dims: [0.5, 0.98, 0.42], pos: at(0, 0.57, 0), rotY: yaw, repeat: [2, 4] });
    cabCap.push({ dims: [0.52, 0.05, 0.44], pos: at(0, 1.08, 0), rotY: yaw });
    cabBadge[i % 2].push({ dims: [0.42, 0.04, 0.03], pos: at(0, 0.18, 0.215), rotY: yaw });
    tweeters.push({ geo: new t.CylinderGeometry(0.05, 0.038, 0.05, 12), matrix: mtx(t, at(0, 0.96, 0.205), [Math.PI / 2, yaw, 0]) });
    // woofer cones in their own group so they THUMP on the beat (an outer
    // group carries the stack pose, the inner one is free to translate)
    const stack = new t.Group();
    stack.position.set(sx, 0, sz);
    stack.rotation.y = yaw;
    g.add(stack);
    const wf = new t.Group();
    stack.add(wf);
    const cones: PartSpec[] = [];
    const caps: PartSpec[] = [];
    [0.44, 0.78].forEach((wy) => {
      cones.push({ geo: new t.CylinderGeometry(0.15, 0.085, 0.07, 18), matrix: mtx(t, [0, wy, 0.2], [Math.PI / 2, 0, 0]) });
      cones.push({ geo: new t.TorusGeometry(0.155, 0.016, 6, 20), matrix: mtx(t, [0, wy, 0.195]) }); // surround
      caps.push({ geo: new t.SphereGeometry(0.038, 10, 8), matrix: mtx(t, [0, wy, 0.215]) }); // dust cap
    });
    wf.add(mergedParts(t, cones, mat(t, 0x0b0b0e, { rough: 0.85 })));
    wf.add(mergedParts(t, caps, mat(t, 0x3c3f47, { rough: 0.5, metal: 0.3 })));
    wooferGroups.push(wf);
  });
  g.add(mergedBoxes(t, cabPlinth, CONCRETE, { tex: 'concrete', rough: 0.94 }));
  g.add(mergedBoxes(t, cabBody, GLOSS, { tex: 'plastic', rough: 0.2 }));
  g.add(mergedBoxes(t, cabCap, CHROME, { tex: 'metal', metal: 0.32, rough: 0.28 }));
  g.add(mergedBoxes(t, cabBadge[0], MAGENTA, { rough: 0.45 }));
  g.add(mergedBoxes(t, cabBadge[1], CYAN, { rough: 0.45 }));
  const twMesh = mergedParts(t, tweeters, mat(t, 0x0b0b0e, { rough: 0.75 }));
  twMesh.userData.lodDetail = true;
  g.add(twMesh);

  // =========================================================================
  // 7. BOARDING GATE (+z), operator console, neon marquee
  // =========================================================================
  // low chrome railing round the apron with a 1.5-u gate opening on the +z face
  const railParts: MergedBoxSpec[] = [];
  const RAIL_R = APRON_R - 0.09;
  const inGate = (px: number, pz: number) => pz > 1.5 && Math.abs(px) < 0.78;
  for (let i = 0; i < 30; i += 1) {
    const a = (i / 30) * Math.PI * 2;
    const a2 = ((i + 1) / 30) * Math.PI * 2;
    const wx = Math.sin(a) * RAIL_R;
    const wz = Math.cos(a) * RAIL_R;
    const nx = Math.sin(a2) * RAIL_R;
    const nz = Math.cos(a2) * RAIL_R;
    if (!inGate(wx, wz)) railParts.push({ dims: [0.05, 0.42, 0.05], pos: [wx, APRON_H + 0.21, wz] });
    if (inGate(wx, wz) || inGate(nx, nz)) continue;
    railParts.push({
      dims: [0.04, 0.04, Math.hypot(nx - wx, nz - wz) + 0.02],
      pos: [(wx + nx) / 2, APRON_H + 0.4, (wz + nz) / 2],
      rotY: Math.atan2(nx - wx, nz - wz),
    });
  }
  g.add(mergedBoxes(t, railParts, CHROME, { tex: 'metal', metal: 0.32, rough: 0.3 }));
  // steps: ground → apron → stage disc, on the gate axis
  const stepParts: MergedBoxSpec[] = [];
  stepParts.push({ dims: [1.6, 0.08, 0.3], pos: [0, 0.04, APRON_R + 0.13], repeat: [4, 1] });
  stepParts.push({ dims: [1.6, 0.1, 0.28], pos: [0, APRON_H + 0.05, STAGE_R + 0.12], repeat: [4, 1] });
  stepParts.push({ dims: [1.6, 0.1, 0.28], pos: [0, APRON_H + 0.15, STAGE_R - 0.13], repeat: [4, 1] });
  g.add(mergedBoxes(t, stepParts, GRAPHITE, { tex: 'metal', metal: 0.3, rough: 0.5 }));
  // gate posts + a beat-lit crown bar over the entrance
  const gateMat = new t.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 0.2, roughness: 0.4 });
  [-0.84, 0.84].forEach((px) =>
    g.add(cyl(t, 0.06, 0.075, 1.5, GRAPHITE, [px, APRON_H + 0.75, APRON_R - 0.06], { tex: 'metal', repeat: [1, 4], metal: 0.3, rough: 0.45, seg: 12 })),
  );
  const crown = new t.Mesh(new t.BoxGeometry(1.74, 0.07, 0.07), gateMat);
  crown.position.set(0, APRON_H + 1.46, APRON_R - 0.06);
  g.add(crown);
  // operator console just off the apron beside the gate
  const con = new t.Group();
  con.position.set(-1.92, 0, 1.72);
  con.rotation.y = -0.9;
  g.add(con);
  con.add(box(t, [0.72, 0.62, 0.44], GLOSS, [0, 0.31, 0], { tex: 'plastic', repeat: [2, 2], rough: 0.22 }));
  con.add(box(t, [0.78, 0.05, 0.5], CHROME, [0, 0.64, 0], { tex: 'metal', metal: 0.32, rough: 0.28 }));
  con.add(box(t, [0.3, 0.02, 0.18], GRAPHITE_D, [0.17, 0.675, -0.09], { rough: 0.5 })); // fader panel
  const conMat = new t.MeshStandardMaterial({ color: MAGENTA, emissive: MAGENTA, emissiveIntensity: 0.2, roughness: 0.35 });
  const conParts: PartSpec[] = [];
  for (let i = 0; i < 8; i += 1) {
    conParts.push({ geo: new t.BoxGeometry(0.05, 0.02, 0.05), matrix: new t.Matrix4().setPosition(-0.28 + i * 0.08, 0.673, 0.11) });
  }
  const conLeds = mergedParts(t, conParts, conMat);
  conLeds.castShadow = false;
  con.add(conLeds);

  // ---- the neon marquee, hung under the front of the truss ring ----------
  const sign = buildNeonSign(t, { text: 'DISCOTRON', color: MAGENTA, secondary: CYAN, scale: 0.26, backboard: true });
  sign.group.position.set(0, TRUSS_LOW - 0.86, TRUSS_R + 0.04);
  g.add(sign.group);
  [-0.8, 0.8].forEach((hx) =>
    g.add(cyl(t, 0.02, 0.02, 0.46, CHROME, [hx, TRUSS_LOW - 0.22, TRUSS_R + 0.0], { tex: 'metal', metal: 0.32, rough: 0.3, seg: 6 })),
  ); // hanger rods

  // =========================================================================
  // 8. HAZE — two low vents so the light shards read volumetrically
  // =========================================================================
  const hazes = [0, 1].map(() =>
    buildEmitter(t, {
      max: 70,
      rate: 9,
      life: 3.2,
      lifeVar: 0.8,
      velocity: [0, 0.13, 0],
      spread: 0.16,
      gravity: -0.012,
      size: 0.12,
      sizeEnd: 0.5,
      color: 0xdcd2ff,
      colorEnd: 0x3a2b6a,
      opacity: 0.2,
      additive: true,
    }),
  );
  ([
    [-1.42, 0.86],
    [1.42, -0.86],
  ] as [number, number][]).forEach(([vx, vz], i) => {
    hazes[i].setOrigin(vx, STAGE_H + 0.05, vz);
    g.add(hazes[i].points);
    g.add(box(t, [0.34, 0.05, 0.24], GRAPHITE_D, [vx, STAGE_H + 0.02, vz], { tex: 'metal', repeat: [3, 2], metal: 0.3, rough: 0.55 })); // vent grille
  });

  // =========================================================================
  // 9. REAL LIGHTS — 2 here (+1 inside the neon marquee) = 3 total
  // =========================================================================
  const ballLight = new t.PointLight(paletteAt(0), 0, 6.5, 2);
  ballLight.position.set(0, BALL_Y - 0.62, 0);
  g.add(ballLight);
  const gateLight = new t.PointLight(0xdfe6ff, 0, 4, 2);
  gateLight.position.set(0, APRON_H + 1.4, APRON_R - 0.24);
  g.add(gateLight);

  // =========================================================================
  // 10. UPDATERS — lighting on the ABSOLUTE beat clock, motion on the gate
  // =========================================================================
  const WHITE = new t.Color(0xffffff);
  /** the club's light show: beat-locked, and it runs even while parked */
  const lighting = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.35 + 1.25 * nk; // reads by day, full disco after dark
    const step = beatStep(time);
    const dom = paletteAt(step);

    // mirror-ball facets — 4 shells scintillating on hashed beat offsets. The
    // tint is pulled HALFWAY TO WHITE: at full palette saturation the four
    // shells turned the ball into a rainbow beach ball, where a mirror ball is
    // silver glass catching a colour.
    facetMats.forEach((m, i) => {
      const ph = hash01(i * 17 + 5);
      m.emissive.setHex(paletteAt(beatStep(time, ph) + i * 2)).lerp(WHITE, 0.55);
      m.emissiveIntensity = 0.1 + gain * 0.5 * beatPulse(time, ph) * (0.7 + 0.3 * Math.sin(time * 1.7 + i));
    });
    haloMat.emissive.setHex(dom).lerp(WHITE, 0.7);
    haloMat.emissiveIntensity = 0.3 + 1.1 * nk * beatPulse(time, 0);
    haloMat.opacity = 0.035 + 0.12 * nk;
    ballRig.rotation.y = time * 0.5; // a mirror ball never stops turning
    ballRig.rotation.x = 0.1 * Math.sin(time * 0.21); // faint wobble on the pin

    // shard rigs: sweep, colour-step and bloom on the beat
    shardRigs.forEach((r, i) => {
      r.grp.rotation.y = time * r.rate + i * 1.7;
      const col = paletteAt(step + r.off);
      const bloom = beatPulse(time, i * 0.17) * (0.78 + 0.22 * beatKick(time, i * 0.11));
      r.shafts.emissive.setHex(col);
      r.shafts.emissiveIntensity = 0.35 + 1.5 * nk * bloom;
      r.shafts.opacity = 0.055 + 0.2 * nk * bloom;
      r.patches.emissive.setHex(col);
      r.patches.emissiveIntensity = 0.5 + 2.3 * nk * bloom;
      r.patches.opacity = 0.15 + 0.5 * nk * bloom;
    });

    // laser heads + their beams punch on the downbeat
    const kick = beatKick(time);
    laserMats.forEach((m, i) => {
      m.emissive.setHex(paletteAt(step + i + 1));
      m.emissiveIntensity = 0.2 + gain * (0.5 + 1.7 * beatKick(time, i * 0.25));
    });
    laserBeamMat.emissiveIntensity = 0.4 + 1.9 * nk * (0.3 + 0.7 * kick);
    laserBeamMat.opacity = 0.06 + 0.26 * nk * (0.35 + 0.65 * kick);

    // stage-rim LED chase — one group per beat, so the ring walks round
    rimMats.forEach((m, i) => {
      const lit = ((step % 4) + 4) % 4 === i;
      const col = paletteAt(step + i);
      m.color.setHex(col);
      m.emissive.setHex(col);
      m.emissiveIntensity = (lit ? 0.35 + 1.75 * gain : 0.12 + 0.25 * gain) * beatPulse(time, i * 0.05);
    });
    // truss-ring LEDs alternate on the beat (the two groups trade off)
    trussLedMats.forEach((m, i) => {
      const on = ((step % 2) + 2) % 2 === i;
      const col = paletteAt(step + i * 2);
      m.color.setHex(col);
      m.emissive.setHex(col);
      m.emissiveIntensity = (on ? 0.3 + 1.5 * gain : 0.12 + 0.2 * gain) * beatPulse(time, i * 0.1);
    });
    // pod trim strips, gate crown and console LEDs breathe with the beat
    const trimGlow = 0.16 + gain * 0.95 * beatPulse(time, 0.25);
    podTrims.forEach((m, i) => (m.emissiveIntensity = trimGlow * (0.85 + 0.15 * Math.sin(time * 2.1 + i))));
    gateMat.emissiveIntensity = 0.18 + gain * 0.8 * beatPulse(time, 0.5);
    conMat.emissiveIntensity = 0.18 + gain * 0.7 * beatKick(time, 0.5);

    // speaker cones thump forward on every beat
    wooferGroups.forEach((wf, i) => {
      wf.position.z = 0.016 * beatKick(time, i * 0.05) - 0.004;
    });

    // the two real lights (night only) + the marquee's own
    ballLight.color.setHex(dom);
    ballLight.intensity = nk * (0.9 + 0.65 * beatPulse(time, 0));
    gateLight.intensity = nk * 0.7;
    sign.update(time);
    hazes.forEach((h) => h.update(time));
  };

  /** the RIDE itself — gated: parked, arms LEVEL, while guests board */
  const rideMotion = (clock: number, k: number) => {
    rotor.rotation.y = clock * 1.05;
    // ONE full arm rise-and-fall per 8 beats (twice per rotor revolution)
    const w = 2 * Math.PI * (BEAT_HZ / 8);
    arms.forEach((a, i) => {
      const tilt = k * TILT_MAX * (0.5 - 0.5 * Math.cos(clock * w * 2 + a.phase));
      a.tilt.rotation.z = tilt;
      a.podRoot.rotation.z = -tilt * 0.55; // the gimbal levels the pod (riders lean back)
      a.podYaw.rotation.y = hash01(i * 11) * 6.28 + clock * a.spin * k;
    });
  };

  const gate = createMotionGate((clock, k) => rideMotion(clock, k), { spinUp: 1.1, spinDown: 1.5 });
  // the light show runs on ABSOLUTE time; only the rotor is gated
  const update = (time: number) => {
    lighting(time);
    gate.update(time);
  };

  return { group: g, update, vehicle, seatWorld: makeSeatWorld(t, seats), onStateChange: gate.onStateChange };
}

/** <Discotron> — the Pulse District's mirror-ball gyro spinner as a composable
 *  ride (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 4.0 out the local +z front (the face the boarding gate, its steps
 *  and the two flanking speaker stacks are built on), exit hut flush on the −x
 *  edge, boarding on the raised stage disc. Capacity 12 = 6 pods × 2 REAL
 *  seats: guests ride the cushions via `seatWorld` (decorative riders off when
 *  registered) and the rotor is motion-gated — dead still with the arms LEVEL
 *  while boarding, easing into the gyro sweep on departure. The lead pod is the
 *  ride `vehicle` (RideViewer onboard cam). The mirror ball, the three shard
 *  rigs and every neon accent run on the district's shared ~2.2 Hz beat clock
 *  (the same one <DanceFloor> flashes to) and keep going while the ride is
 *  parked. Override access with top-level props / `queue`. */
export const Discotron = composableRide<DiscotronOpts>(
  'Discotron',
  (t, props) => buildDiscotronScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  {
    front: 4.0, // clears the apron + railing + the gate-flanking speaker stacks
    // (measured built footprint: x ±2.40, z −2.49…2.69 — the chassis's own
    // auto-clearance would raise anything under 3.96 anyway)
    exit: [-3.15, 1.3],
    board: [0, STAGE_H, 1.4],
    defaults: { name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 },
  },
);
