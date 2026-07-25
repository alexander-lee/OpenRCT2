import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { computeSplineFrames } from '../SplineCoaster';
import { compileTrackPieces, ribbon, railTube } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import type { SplineFrame } from '../SplineCoaster';
import { buildEmitter } from '../ParticleKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// MagneticRide — a MAGLEV GLIDER: the trackless-dark-ride idea (slow, poised,
// cinematic pods drifting past show scenes) built as an OPEN-AIR attraction.
// There is deliberately NO show building: the whole circuit reads from outside
// the plot, which is the point of the ride — the guideway, the pods and every
// effect are exteriorly visible.
//
// The vocabulary is deliberately NOT coaster: no ties, no rails, no wheels.
// A slim graphite INDUCTION BEAM on single elegant pylons carries a polished
// levitation rail, glowing coil strips down both flanks, coil ribs, cable
// conduits and painted travel chevrons; four pod-shaped vehicles hover a
// VISIBLE 0.185-unit gap above the rail crown (guide fins skim past the beam
// flanks without ever touching) and glide at a constant walking pace, banking
// gently through the sweeps with a slow hashed yaw/pitch drift for the
// cinematic feel. The show piece they circle — a monolith with magnetically
// suspended rings — stands in the OPEN in the middle of the ring.
//
// The circuit is a closed compileTrackPieces layout on the level 'monorail'
// profile (SplineRideKit) resampled through computeSplineFrames — the same
// spline machinery every tracked ride uses — with a gentle two-crest levitation
// WAVE added to the control-point heights (±0.16 u, zero value AND slope at the
// station) so the beam breathes over its pylons instead of reading as a flat
// ring.
//
// Everything is deterministic (hashed sine off the updater's absolute time)
// and every light effect is gated on `nightKOf`: 2 real PointLights (lead-pod
// levitation glow + station canopy), everything else emissive materials.
// ---------------------------------------------------------------------------

// realistic-but-futuristic muted palette — graphite / brushed steel / deep navy
// with restrained cyan + violet accents (no neon plastic)
const GRAPHITE = 0x3e444d; // beam shell, pylon masts, pod shells
const GRAPHITE_D = 0x2c313a; // shadow-side graphite
const STEEL = 0x9aa2ab; // brushed steel rail, trims, cradles
const STEEL_D = 0x6d757e; // darker machined steel
const NAVY = 0x2c3e5a; // deep navy fairings + pod bodies
const CONCRETE = 0xa8adb4; // pylon footings, station deck
const CYAN = 0x9fe9f4; // accent paint / glass
const CYAN_E = 0x2fb6cf; // accent emissive
const VIOLET = 0xb9a6ff; // beacon glass
const VIOLET_E = 0x6a4fd0; // beacon emissive
const CABIN = 0xdff1f7; // pod cabin light glass

/** beam centreline height above the pad (the pylons make up the difference) */
const BEAM_Y = 1.15;
/** pod levitation plane above the beam centreline — the plate underside sits
 *  here, a VISIBLE 0.185 clear of the polished rail crown at +0.175 (nothing
 *  the pod carries ever reaches the rail: it floats) */
const HOVER = 0.36;
/** station deck top: 0.03 over the pod floor plate, so guests step in level */
const DECK_OVER = 0.39;
/** amplitude of the two-crest levitation wave layered on the compiled points
 *  (max gradient ≈ 4.4° on the default lap — a glide, never a hill) */
const WAVE = 0.32;

/**
 * The default circuit: a sleek hexagonal RING — six identical
 * `straight + 60° sweep` units, so it closes on the station EXACTLY with
 * nothing synthesized by the compiler (verified: closed, synth [], worst
 * clearance 1.66, zero compiler warnings, 26.4 u lap). The station piece is
 * the first unit's straight, so the boarding platform gets a full 2.6-u
 * level run. Authored on the LEVEL 'monorail' profile — a magnetic guideway
 * is precision-levelled; the height interest comes from the wave + pylons.
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'turnL', angle: 60, radius: 1.9 },
  { type: 'straight', length: 2.6 },
  { type: 'turnL', angle: 60, radius: 1.9 },
  { type: 'straight', length: 2.6 },
  { type: 'turnL', angle: 60, radius: 1.9 },
  { type: 'straight', length: 2.6 },
  { type: 'turnL', angle: 60, radius: 1.9 },
  { type: 'straight', length: 2.6 },
  { type: 'turnL', angle: 60, radius: 1.9 },
  { type: 'straight', length: 2.6 },
  { type: 'turnL', angle: 60, radius: 1.9 },
];
/** station straight centred on the local x axis, ring hanging off local −z so
 *  the +z face (queue side) stays clear of the guideway */
const START: [number, number, number] = [-1.3, BEAM_Y, -0.5];
const HEADING = Math.PI / 2; // station runs along local +x

/** hashed sine — deterministic per-index jitter (no Math.random) */
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s); // 0..1
};

interface PodLights {
  /** cabin + sill glass (soft interior glow after dark) */
  cabinMats: THREE.MeshStandardMaterial[];
  /** levitation coils + the under-pod glow disc */
  liftMats: THREE.MeshStandardMaterial[];
}

/**
 * One magnetic pod: an open cinematic 2-seater. Origin = the LEVITATION PLANE
 * (local y 0 is the plate underside, i.e. the hovering gap), +z is the
 * direction of travel. No wheels, no bogie — a flat induction plate, three
 * downward-facing levitation coils and two guide fins that straddle the beam
 * flanks with clear air on both sides.
 */
function buildPod(
  t: typeof THREE,
  n: number,
  lights: PodLights,
  opts: { seats: THREE.Group[]; riders: boolean },
): THREE.Group {
  const pod = new t.Group();
  // ---- levitation gear (the ride's signature: it floats) ----
  pod.add(box(t, [0.46, 0.06, 0.9], STEEL_D, [0, 0.03, 0], { tex: 'metal', repeat: [2, 4], metal: 0.4, rough: 0.3 })); // induction plate
  [-1, 1].forEach((s) => {
    // guide fins: skim DOWN alongside the beam flanks with 0.025 of clear air
    // on the inside and 0.03 under the fin shoe — the pod is GUIDED, never
    // supported (short in z, so the levitation gap stays wide open mid-pod)
    pod.add(box(t, [0.04, 0.275, 0.5], GRAPHITE_D, [s * 0.225, -0.0775, 0], { tex: 'metal', repeat: [1, 2], metal: 0.35, rough: 0.4 }));
    pod.add(box(t, [0.06, 0.035, 0.18], STEEL, [s * 0.225, -0.198, 0], { tex: 'metal', metal: 0.4, rough: 0.25 })); // fin shoe (pickup pad)
  });
  [-0.3, 0, 0.3].forEach((cz) => {
    // levitation coils, glass facing DOWN at the beam
    const coil = cyl(t, 0.1, 0.1, 0.022, CYAN, [0, -0.004, cz], { emissive: CYAN_E, rough: 0.3, seg: 14 });
    (coil.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35;
    pod.add(coil);
    lights.liftMats.push(coil.material as THREE.MeshStandardMaterial);
    pod.add(cyl(t, 0.115, 0.115, 0.016, STEEL_D, [0, 0.012, cz], { tex: 'metal', metal: 0.4, rough: 0.3, seg: 14 })); // coil housing
  });
  // soft under-pod glow disc (emissive only — the lead pod adds the one light)
  const glow = new t.Mesh(
    new t.CircleGeometry(0.26, 20),
    new t.MeshStandardMaterial({ color: CYAN, emissive: CYAN_E, emissiveIntensity: 0.25, roughness: 0.6, transparent: true, opacity: 0.5, side: t.DoubleSide }),
  );
  glow.rotation.x = Math.PI / 2; // faces down
  glow.position.set(0, -0.012, 0);
  glow.castShadow = false;
  pod.add(glow);
  lights.liftMats.push(glow.material as THREE.MeshStandardMaterial);

  // ---- hull: navy tub, brushed-steel shoulders, blistered nose + tail ------
  pod.add(box(t, [0.44, 0.3, 0.86], NAVY, [0, 0.21, 0], { tex: 'plastic', repeat: [3, 2], rough: 0.4 }));
  pod.add(box(t, [0.46, 0.05, 0.88], STEEL_D, [0, 0.075, 0], { tex: 'metal', repeat: [3, 2], metal: 0.4, rough: 0.35 })); // machined rub strip
  pod.add(box(t, [0.36, 0.09, 0.8], STEEL, [0, 0.39, 0], { tex: 'metal', repeat: [3, 2], metal: 0.4, rough: 0.32 })); // shoulder deck
  pod.add(box(t, [0.1, 0.05, 0.74], CYAN, [0, 0.45, 0], { rough: 0.45 })); // cyan roof spine (reads from above)
  [-1, 1].forEach((s) => pod.add(box(t, [0.06, 0.03, 0.76], STEEL_D, [s * 0.14, 0.44, 0], { tex: 'metal', metal: 0.4, rough: 0.3 }))); // roof rails
  pod.add(box(t, [0.42, 0.24, 0.22], STEEL_D, [0, 0.24, 0.43], { rotX: -0.38, tex: 'metal', repeat: [2, 1], metal: 0.4, rough: 0.35 })); // raked nose
  const noseCap = ball(t, 0.16, STEEL_D, [0, 0.22, 0.44], { tex: 'metal', metal: 0.4, rough: 0.3 });
  noseCap.scale.set(1.32, 0.85, 0.8); // sleek nose blister (no boxy snout)
  pod.add(noseCap);
  pod.add(box(t, [0.4, 0.2, 0.18], GRAPHITE_D, [0, 0.27, -0.42], { rotX: 0.32, tex: 'metal', repeat: [2, 1], metal: 0.35, rough: 0.4 })); // tail fairing
  pod.add(box(t, [0.3, 0.05, 0.06], CYAN, [0, 0.13, 0.49], { rough: 0.45 })); // nose accent chevron bar
  [-1, 1].forEach((s) => {
    pod.add(box(t, [0.035, 0.16, 0.8], NAVY, [s * 0.215, 0.28, 0], { tex: 'plastic', repeat: [3, 1], rough: 0.4 })); // sill
    pod.add(box(t, [0.05, 0.03, 0.82], CYAN, [s * 0.215, 0.37, 0], { rough: 0.45 })); // cyan sill pinstripe
    pod.add(cyl(t, 0.016, 0.016, 0.76, STEEL, [s * 0.235, 0.44, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.45, rough: 0.25, seg: 8 })); // grab rail
    // cabin glass under the sill line — the interior glow after dark
    const pane = new t.Mesh(
      new t.BoxGeometry(0.014, 0.1, 0.62),
      new t.MeshStandardMaterial({ color: CABIN, emissive: 0x2a6a80, emissiveIntensity: 0.15, roughness: 0.35 }),
    );
    pane.position.set(s * 0.229, 0.2, 0);
    pod.add(pane);
    lights.cabinMats.push(pane.material as THREE.MeshStandardMaterial);
  });
  // windscreen: raked pale-cyan glass in a steel frame
  const screen = box(t, [0.34, 0.17, 0.02], CYAN, [0, 0.44, 0.36], { rotX: -0.3, rough: 0.2, opacity: 0.45 });
  screen.castShadow = false;
  pod.add(screen);
  pod.add(box(t, [0.37, 0.03, 0.035], STEEL, [0, 0.52, 0.34], { rotX: -0.3, tex: 'metal', metal: 0.45, rough: 0.25 }));
  // roll hoop behind the rear seat
  [-1, 1].forEach((s) => pod.add(cyl(t, 0.018, 0.018, 0.26, STEEL_D, [s * 0.17, 0.52, -0.3], { tex: 'metal', metal: 0.4, rough: 0.3, seg: 8 })));
  pod.add(cyl(t, 0.018, 0.018, 0.34, STEEL_D, [0, 0.64, -0.3], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.4, rough: 0.3, seg: 8 }));
  // tail marker lamp (violet, night-gated with the cabin)
  const tail = ball(t, 0.032, VIOLET, [0, 0.3, -0.5], { emissive: VIOLET_E, rough: 0.35 });
  (tail.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
  pod.add(tail);
  lights.cabinMats.push(tail.material as THREE.MeshStandardMaterial);

  // ---- 2 tandem seats: pan + back pad + lap restraint + seat anchors ----
  [0.17, -0.17].forEach((sz, k) => {
    pod.add(box(t, [0.32, 0.05, 0.28], 0x2b3a4c, [0, 0.175, sz], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // cushion (top 0.20)
    pod.add(box(t, [0.32, 0.18, 0.045], 0x2b3a4c, [0, 0.28, sz - 0.14], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back pad
    pod.add(box(t, [0.34, 0.035, 0.05], STEEL_D, [0, 0.155, sz - 0.15], { tex: 'metal', metal: 0.35, rough: 0.4 })); // seat frame
    // lap restraint: padded bar on two stems, hinged at the sills
    const bar = box(t, [0.3, 0.035, 0.04], GRAPHITE_D, [0, 0.29, sz + 0.13], { metal: 0.4, rough: 0.5 });
    bar.userData.lodDetail = true;
    pod.add(bar);
    [-0.13, 0.13].forEach((bx) => {
      const stem = box(t, [0.028, 0.11, 0.028], GRAPHITE_D, [bx, 0.24, sz + 0.13], { metal: 0.4, rough: 0.5 });
      stem.userData.lodDetail = true;
      pod.add(stem);
    });
    // footwell light strip — the pods glow from INSIDE at night
    const strip = box(t, [0.2, 0.012, 0.05], CABIN, [0, 0.12, sz + 0.15], { emissive: 0x2a6a80, rough: 0.4 });
    (strip.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
    pod.add(strip);
    lights.cabinMats.push(strip.material as THREE.MeshStandardMaterial);
    // seat anchor — REAL GameManager guests ride here via seatWorld
    // (cushion top 0.20 = anchor 0.044 + 0.46 × scale 0.34)
    const seat = new t.Group();
    seat.position.set(0, 0.044, sz);
    pod.add(seat);
    opts.seats.push(seat);
    if (opts.riders) {
      const idx = n * 2 + k;
      const p = buildPeep(t, {
        skin: SKIN_TONES[idx % SKIN_TONES.length],
        shirt: SHIRTS[(idx * 3 + 1) % SHIRTS.length],
        seated: true,
        expression: idx % 3 === 0 ? 'surprised' : 'happy',
        female: idx % 2 === 1,
      });
      p.group.scale.setScalar(0.34);
      p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR
      seat.add(p.group);
    }
  });
  return pod;
}

export function buildMagneticRideScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[]; riders?: boolean } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** fatal pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
} {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests fill the pods
  const seats: THREE.Group[] = []; // 4 pods × 2 = capacity 8 (seatWorld)
  const extras: { invalid?: boolean } = {};

  // ---- the guideway spline -------------------------------------------------
  // compileTrackPieces closes the circuit and runs both validators; the level
  // 'monorail' profile keeps the beam precision-flat (no gravity plunges).
  const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, {
    profile: 'monorail',
    start: START,
    heading: HEADING,
  });
  g.userData.trackReport = compiled.report;
  if (compiled.report.fatal) extras.invalid = true; // an illegal circuit never registers as a real ride
  // levitation WAVE: two smooth crests over the lap, with value AND slope 0 at
  // the station (u = 0) so boarding stays dead level. Purely a control-point
  // height offset — the horizontal layout the validators checked is untouched.
  const M = compiled.points.length;
  const wavePts = compiled.points.map(([x, y, z], i) => [x, y + (WAVE / 2) * (1 - Math.cos((4 * Math.PI * i) / M)), z] as [number, number, number]);
  const fb = computeSplineFrames(t, wavePts, { bank: 0.16, bankGain: 0.5 }); // gentle lean, never a coaster bank

  // ---- beam section: graphite shell + polished rail + coil strips ----------
  const shell = mat(t, GRAPHITE, { tex: 'metal', repeat: [2, 26], metal: 0.35, rough: 0.42 });
  shell.side = t.DoubleSide;
  g.add(ribbon(t, fb.frames, -0.17, 0.1, 0.17, 0.1, shell)); // top face
  g.add(ribbon(t, fb.frames, -0.17, -0.1, 0.17, -0.1, shell)); // underside
  [-1, 1].forEach((s) => g.add(ribbon(t, fb.frames, s * 0.17, -0.1, s * 0.17, 0.1, shell))); // flanks
  g.add(railTube(t, fb.frames, 0, 0.135, 0.04, mat(t, STEEL, { tex: 'metal', repeat: [1, 40], metal: 0.35, rough: 0.22 }))); // levitation rail crown
  [-1, 1].forEach((s) => g.add(railTube(t, fb.frames, s * 0.15, -0.115, 0.03, mat(t, STEEL_D, { tex: 'metal', repeat: [1, 34], metal: 0.4, rough: 0.4 })))); // cable conduits
  g.add(ribbon(t, fb.frames, -0.13, -0.125, 0.13, -0.125, mat(t, NAVY, { tex: 'plastic', repeat: [2, 26], rough: 0.5 }))); // navy cable tray
  // coil strips: the induction windings' glow line down both flanks
  const coilMats: THREE.MeshStandardMaterial[] = [];
  [-1, 1].forEach((s) => {
    const cm = new t.MeshStandardMaterial({ color: CYAN, emissive: CYAN_E, emissiveIntensity: 0.2, roughness: 0.35, side: t.DoubleSide });
    g.add(ribbon(t, fb.frames, s * 0.177, 0.0, s * 0.177, 0.06, cm));
    coilMats.push(cm);
  });

  // ---- static beam detail, batched: coil ribs + travel chevrons ------------
  const basisOf = (f: SplineFrame, h: number) => new t.Matrix4().makeBasis(f.side, f.up, f.fwd).setPosition(f.p.clone().addScaledVector(f.up, h));
  const ribs: Parameters<typeof mergedBoxes>[1] = [];
  for (let i = 0; i < fb.N; i += 5) ribs.push({ dims: [0.36, 0.06, 0.055], matrix: basisOf(fb.frames[i], 0.0), repeat: [2, 1] }); // 64 coil ribs
  g.add(mergedBoxes(t, ribs, GRAPHITE_D, { tex: 'metal', metal: 0.35, rough: 0.45 }));
  const chevrons: Parameters<typeof mergedBoxes>[1] = [];
  for (let i = 0; i < fb.N; i += 15) {
    const base = basisOf(fb.frames[i], 0.107);
    [-1, 1].forEach((s) => {
      const m = base
        .clone()
        .multiply(new t.Matrix4().makeTranslation(s * 0.055, 0, 0))
        .multiply(new t.Matrix4().makeRotationY(s * 0.62));
      chevrons.push({ dims: [0.13, 0.018, 0.05], matrix: m });
    });
  }
  g.add(mergedBoxes(t, chevrons, CYAN, { rough: 0.5 })); // painted direction-of-travel chevrons

  // ---- pylons: single elegant masts, cradles, violet beacons --------------
  const beaconMats: THREE.MeshStandardMaterial[] = [];
  const pylonParts: Parameters<typeof mergedBoxes>[1] = [];
  const cradleParts: Parameters<typeof mergedBoxes>[1] = [];
  for (let i = 0; i < fb.N; i += 32) {
    const f = fb.frames[i];
    const h = f.p.y - 0.12; // mast rises to the beam underside
    if (h < 0.3) continue;
    g.add(cyl(t, 0.055, 0.105, h, GRAPHITE, [f.p.x, h / 2, f.p.z], { tex: 'metal', repeat: [2, 5], metal: 0.35, rough: 0.45, seg: 12 })); // tapered mast
    g.add(cyl(t, 0.085, 0.085, 0.07, STEEL_D, [f.p.x, h + 0.01, f.p.z], { tex: 'metal', metal: 0.4, rough: 0.35, seg: 12 })); // head collar
    pylonParts.push({ dims: [0.58, 0.1, 0.58], pos: [f.p.x, 0.05, f.p.z], repeat: [2, 2] }); // footing pad
    pylonParts.push({ dims: [0.34, 0.06, 0.34], pos: [f.p.x, 0.12, f.p.z] }); // pedestal step
    cradleParts.push({ dims: [0.46, 0.07, 0.2], matrix: basisOf(f, -0.135) }); // beam cradle
    cradleParts.push({ dims: [0.1, 0.34, 0.16], matrix: basisOf(f, -0.3) }); // cradle web
    // one violet beacon per pylon, out on the cradle's outboard tip
    const bp = f.p.clone().addScaledVector(f.side, 0.29).addScaledVector(f.up, -0.115);
    g.add(cyl(t, 0.014, 0.014, 0.09, STEEL_D, [bp.x, bp.y - 0.05, bp.z], { metal: 0.4, rough: 0.4, seg: 6 }));
    const bulb = ball(t, 0.036, VIOLET, [bp.x, bp.y, bp.z], { emissive: VIOLET_E, rough: 0.3 });
    (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.18;
    g.add(bulb);
    beaconMats.push(bulb.material as THREE.MeshStandardMaterial);
  }
  g.add(mergedBoxes(t, pylonParts, CONCRETE, { tex: 'concrete', metal: 0, rough: 0.92 }));
  g.add(mergedBoxes(t, cradleParts, STEEL_D, { tex: 'metal', metal: 0.4, rough: 0.4 }));

  // ---- station: elevated boarding platform, canopy, holographic panels ----
  const stF = fb.frameAt(1.3 / fb.total); // mid of the 2.6-u station straight
  const yaw = Math.atan2(stF.fwd.x, stF.fwd.z);
  const fwdH = new t.Vector3(stF.fwd.x, 0, stF.fwd.z).normalize();
  const centroid = new t.Vector3();
  fb.frames.forEach((f) => centroid.add(f.p));
  centroid.multiplyScalar(1 / fb.N);
  const sideH = new t.Vector3(stF.side.x, 0, stF.side.z).normalize();
  // the platform stands on the side of the station facing AWAY from the ring
  const outward = sideH.clone().multiplyScalar(sideH.dot(new t.Vector3().subVectors(stF.p, centroid).setY(0)) >= 0 ? 1 : -1);
  const DECK_TOP = stF.p.y + DECK_OVER;
  /** world position `alongFwd` down the station axis and `out` off the beam */
  const at = (alongFwd: number, out: number, y: number) =>
    stF.p.clone().addScaledVector(fwdH, alongFwd).addScaledVector(outward, out).setY(y);
  /** a station-aligned box: dims are [across (out), up, along the beam] */
  const stBox = (dims: [number, number, number], color: number, alongFwd: number, out: number, y: number, o: Parameters<typeof box>[4] = {}) => {
    const m = box(t, dims, color, [0, 0, 0], { ...o, rotY: yaw });
    m.position.copy(at(alongFwd, out, y));
    return m;
  };
  // deck slab (inner edge 0.32 off the centreline — clear of pods + fins)
  g.add(stBox([1.05, 0.14, 3.0], CONCRETE, 0, 0.845, DECK_TOP - 0.07, { tex: 'concrete', repeat: [3, 8], rough: 0.9 }));
  const deckParts: Parameters<typeof mergedBoxes>[1] = [];
  [-1, 1].forEach((s) => deckParts.push({ dims: [1.09, 0.16, 0.09], pos: at(s * 1.54, 0.845, DECK_TOP - 0.16).toArray() as [number, number, number], rotY: yaw, repeat: [3, 1] })); // end fascias
  deckParts.push({ dims: [0.09, 0.16, 3.0], pos: at(0, 1.37, DECK_TOP - 0.16).toArray() as [number, number, number], rotY: yaw, repeat: [8, 1] }); // outer fascia
  deckParts.push({ dims: [0.09, 0.16, 3.0], pos: at(0, 0.32, DECK_TOP - 0.16).toArray() as [number, number, number], rotY: yaw, repeat: [8, 1] }); // platform-edge kerb
  g.add(mergedBoxes(t, deckParts, STEEL_D, { tex: 'metal', metal: 0.35, rough: 0.5 }));
  // deck columns
  [-1.32, 1.32].forEach((fz) =>
    [0.45, 1.25].forEach((ox) => {
      const p = at(fz, ox, 0);
      g.add(cyl(t, 0.065, 0.085, DECK_TOP - 0.14, GRAPHITE, [p.x, (DECK_TOP - 0.14) / 2, p.z], { tex: 'metal', repeat: [2, 4], metal: 0.35, rough: 0.45, seg: 10 }));
    }),
  );
  // platform-edge light strip (the pods' boarding line) + painted boarding bays
  const edgeMat = new t.MeshStandardMaterial({ color: CYAN, emissive: CYAN_E, emissiveIntensity: 0.2, roughness: 0.4 });
  const edge = new t.Mesh(new t.BoxGeometry(0.07, 0.02, 2.96), edgeMat);
  edge.rotation.y = yaw;
  edge.position.copy(at(0, 0.38, DECK_TOP + 0.005));
  g.add(edge);
  const bayParts: Parameters<typeof mergedBoxes>[1] = [];
  [-0.95, 0, 0.95].forEach((fz) => {
    bayParts.push({ dims: [0.5, 0.014, 0.05], pos: at(fz, 0.66, DECK_TOP + 0.005).toArray() as [number, number, number], rotY: yaw }); // bay stop line
    [-1, 1].forEach((s) => bayParts.push({ dims: [0.16, 0.014, 0.05], pos: at(fz + s * 0.3, 0.52, DECK_TOP + 0.005).toArray() as [number, number, number], rotY: yaw })); // bay ticks
  });
  g.add(mergedBoxes(t, bayParts, CYAN, { rough: 0.55 }));
  // outer + end railings (the beam side stays open for boarding)
  const railParts: Parameters<typeof mergedBoxes>[1] = [];
  for (let k = 0; k < 8; k++) railParts.push({ dims: [0.05, 0.5, 0.05], pos: at(-1.4 + k * 0.4, 1.34, DECK_TOP + 0.25).toArray() as [number, number, number], rotY: yaw });
  [0.34, 0.5].forEach((ry) => railParts.push({ dims: [0.04, 0.04, 2.92], pos: at(0, 1.34, DECK_TOP + ry).toArray() as [number, number, number], rotY: yaw }));
  [-1, 1].forEach((s) => {
    railParts.push({ dims: [0.95, 0.05, 0.05], pos: at(s * 1.46, 0.86, DECK_TOP + 0.5).toArray() as [number, number, number], rotY: yaw });
    railParts.push({ dims: [0.05, 0.5, 0.05], pos: at(s * 1.46, 0.42, DECK_TOP + 0.25).toArray() as [number, number, number], rotY: yaw });
  });
  g.add(mergedBoxes(t, railParts, STEEL, { tex: 'metal', metal: 0.4, rough: 0.3 }));
  // stair flight off the −fwd end, pushed outboard so it clears the guideway's
  // incoming sweep: 8 treads + risers, sloped stringers and two handrails
  const RUN = 0.26;
  const RISE = 0.185;
  const SLOPE = Math.atan2(RISE, RUN); // 0.618 rad
  const flightLen = Math.hypot(8 * RUN, 8 * RISE);
  /** a box aligned with the stair slope (rotation about the outward axis) */
  const slopedMatrix = (alongFwd: number, out: number, y: number) =>
    new t.Matrix4()
      .makeBasis(outward, new t.Vector3(0, 1, 0), fwdH)
      .setPosition(at(alongFwd, out, y))
      .multiply(new t.Matrix4().makeRotationX(-SLOPE));
  const stairParts: Parameters<typeof mergedBoxes>[1] = [];
  for (let k = 0; k < 8; k++) {
    const y = DECK_TOP - 0.145 - k * RISE;
    stairParts.push({ dims: [0.95, 0.075, RUN], pos: at(-1.72 - k * RUN, 0.95, y).toArray() as [number, number, number], rotY: yaw, repeat: [3, 1] }); // tread
    stairParts.push({ dims: [0.95, RISE, 0.05], pos: at(-1.85 - k * RUN, 0.95, y - 0.09).toArray() as [number, number, number], rotY: yaw }); // riser
  }
  g.add(mergedBoxes(t, stairParts, CONCRETE, { tex: 'concrete', metal: 0, rough: 0.92 }));
  const stairSteel: Parameters<typeof mergedBoxes>[1] = [];
  const midFwd = -1.72 - 3.5 * RUN;
  const midY = DECK_TOP - 0.145 - 3.5 * RISE;
  [-1, 1].forEach((s) => {
    stairSteel.push({ dims: [0.06, 0.2, flightLen], matrix: slopedMatrix(midFwd, 0.95 + s * 0.5, midY - 0.11) }); // stringer
    stairSteel.push({ dims: [0.045, 0.045, flightLen], matrix: slopedMatrix(midFwd, 0.95 + s * 0.5, midY + 0.55) }); // handrail
    for (let k = 0; k < 4; k++) {
      const y = DECK_TOP - 0.2 - k * RISE * 2.2;
      stairSteel.push({ dims: [0.04, 0.6, 0.04], pos: at(-1.85 - k * RUN * 2.2, 0.95 + s * 0.5, y + 0.15).toArray() as [number, number, number], rotY: yaw }); // baluster
    }
  });
  g.add(mergedBoxes(t, stairSteel, STEEL, { tex: 'metal', metal: 0.4, rough: 0.3 }));
  // SLATTED canopy over the outer half of the deck (the boarding edge stays
  // open to the sky — a solid roof would hide the whole platform from above)
  [-1.05, 1.05].forEach((fz) => {
    const p = at(fz, 1.28, 0);
    g.add(cyl(t, 0.045, 0.06, 1.0, STEEL_D, [p.x, DECK_TOP + 0.5, p.z], { tex: 'metal', repeat: [2, 4], metal: 0.4, rough: 0.35, seg: 10 }));
  });
  const roofParts: Parameters<typeof mergedBoxes>[1] = [];
  [0.62, 1.3].forEach((ox) => roofParts.push({ dims: [0.07, 0.09, 2.8], pos: at(0, ox, DECK_TOP + 0.97).toArray() as [number, number, number], rotY: yaw, repeat: [8, 1] })); // longitudinal beams
  for (let k = 0; k < 9; k++) roofParts.push({ dims: [0.86, 0.04, 0.1], pos: at(-1.28 + k * 0.32, 0.96, DECK_TOP + 1.05).toArray() as [number, number, number], rotY: yaw, repeat: [2, 1] }); // slats
  g.add(mergedBoxes(t, roofParts, STEEL_D, { tex: 'metal', metal: 0.4, rough: 0.4 }));
  [-1, 1].forEach((s) => g.add(stBox([0.8, 0.07, 0.1], NAVY, s * 1.4, 0.96, DECK_TOP + 1.02, { tex: 'plastic', rough: 0.5 }))); // navy end trims
  const lipMat = new t.MeshStandardMaterial({ color: CYAN, emissive: CYAN_E, emissiveIntensity: 0.18, roughness: 0.4 });
  const lip = new t.Mesh(new t.BoxGeometry(0.05, 0.05, 2.76), lipMat);
  lip.rotation.y = yaw;
  lip.position.copy(at(0, 0.58, DECK_TOP + 0.94));
  g.add(lip);
  // two canopy downlights (emissive glass) + the station's ONE real PointLight
  const bulbMats: THREE.MeshStandardMaterial[] = [];
  [-0.7, 0.7].forEach((fz) => {
    const p = at(fz, 0.75, DECK_TOP + 0.92);
    const b = ball(t, 0.05, 0xfff4dd, [p.x, p.y, p.z], { emissive: 0xffcf8a, rough: 0.35 });
    (b.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
    g.add(b);
    bulbMats.push(b.material as THREE.MeshStandardMaterial);
  });
  const stationLight = new t.PointLight(0xdfe9ff, 0, 5, 2);
  const slp = at(0, 0.8, DECK_TOP + 0.8);
  stationLight.position.copy(slp);
  g.add(stationLight);
  // holographic departure boards: framed emissive screens on two short posts
  // up from the outer railing, faces turned IN over the platform
  const holoMats: THREE.MeshStandardMaterial[] = [];
  [-0.95, 0.95].forEach((fz, hi) => {
    [-0.26, 0.26].forEach((dz) => g.add(stBox([0.05, 0.24, 0.05], STEEL_D, fz + dz, 1.34, DECK_TOP + 0.6, { tex: 'metal', metal: 0.4, rough: 0.35 }))); // posts
    g.add(stBox([0.07, 0.36, 0.64], GRAPHITE_D, fz, 1.34, DECK_TOP + 0.88, { tex: 'metal', metal: 0.35, rough: 0.5 })); // frame/bezel
    const hm = new t.MeshStandardMaterial({ color: hi ? CYAN : VIOLET, emissive: hi ? CYAN_E : VIOLET_E, emissiveIntensity: 0.25, roughness: 0.28, transparent: true, opacity: 0.85 });
    const screen = new t.Mesh(new t.BoxGeometry(0.02, 0.29, 0.57), hm);
    screen.rotation.y = yaw;
    screen.position.copy(at(fz, 1.295, DECK_TOP + 0.88));
    screen.castShadow = false;
    g.add(screen);
    holoMats.push(hm);
    // two brighter "lines" of scrolling schedule text on the glass
    [0.06, -0.05].forEach((dy, li) => {
      const line = new t.Mesh(new t.BoxGeometry(0.015, 0.035, 0.36 - li * 0.12), hm);
      line.rotation.y = yaw;
      line.position.copy(at(fz - li * 0.06, 1.28, DECK_TOP + 0.88 + dy));
      line.castShadow = false;
      g.add(line);
    });
  });

  // ---- the show scene: the levitation MONOLITH the pods circle ------------
  // A trackless dark ride is built around what the pods drift PAST — here the
  // show piece stands in the middle of the ring, in the open, so it reads from
  // outside the plot with the rest of the ride: a hexagonal graphite monolith
  // on a stepped plinth with three magnetically SUSPENDED rings turning slowly
  // around it (emissive only — no extra real lights) and a vented ion haze.
  const cp = centroid.clone().setY(0);
  g.add(box(t, [1.7, 0.16, 1.7], CONCRETE, [cp.x, 0.08, cp.z], { tex: 'concrete', repeat: [3, 3], rough: 0.92 }));
  g.add(box(t, [1.24, 0.13, 1.24], CONCRETE, [cp.x, 0.21, cp.z], { tex: 'concrete', repeat: [2, 2], rough: 0.92 }));
  g.add(box(t, [0.96, 0.06, 0.96], STEEL_D, [cp.x, 0.3, cp.z], { tex: 'metal', repeat: [2, 2], metal: 0.35, rough: 0.5 }));
  g.add(cyl(t, 0.17, 0.34, 2.05, GRAPHITE, [cp.x, 1.33, cp.z], { tex: 'metal', repeat: [3, 6], metal: 0.35, rough: 0.45, seg: 6 })); // tapered hex prism
  [0.7, 1.3, 1.9].forEach((iy, k) => g.add(box(t, [0.34 - k * 0.06, 0.05, 0.34 - k * 0.06], STEEL_D, [cp.x, iy, cp.z], { tex: 'metal', metal: 0.4, rough: 0.4, rotY: 0.5 }))); // machined collars
  const monoSeamMat = new t.MeshStandardMaterial({ color: CYAN, emissive: CYAN_E, emissiveIntensity: 0.2, roughness: 0.4 });
  for (let k = 0; k < 3; k++) {
    const seam = new t.Mesh(new t.BoxGeometry(0.05, 1.6 - k * 0.3, 0.05), monoSeamMat);
    seam.position.set(cp.x + Math.sin(k * 2.09) * 0.2, 1.15, cp.z + Math.cos(k * 2.09) * 0.2);
    g.add(seam);
  }
  const tipMat = new t.MeshStandardMaterial({ color: CABIN, emissive: CYAN_E, emissiveIntensity: 0.3, roughness: 0.3 });
  const tip = new t.Mesh(new t.OctahedronGeometry(0.16, 0), tipMat);
  tip.position.set(cp.x, 2.5, cp.z);
  g.add(tip);
  const ringMats: THREE.MeshStandardMaterial[] = [];
  const rings = [
    { r: 0.66, y: 0.92, tilt: 0.16, spin: 0.16, violet: false },
    { r: 0.52, y: 1.46, tilt: -0.24, spin: -0.11, violet: true },
    { r: 0.4, y: 1.98, tilt: 0.3, spin: 0.2, violet: false },
  ].map((spec) => {
    const rm = new t.MeshStandardMaterial({
      color: spec.violet ? VIOLET : CYAN,
      emissive: spec.violet ? VIOLET_E : CYAN_E,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.4,
    });
    const ring = new t.Mesh(new t.TorusGeometry(spec.r, 0.028, 6, 22), rm);
    ring.rotation.x = Math.PI / 2 + spec.tilt;
    ring.position.set(cp.x, spec.y, cp.z);
    ring.castShadow = false;
    g.add(ring);
    ringMats.push(rm);
    return { ring, spec };
  });
  // vented ion haze drifting up the monolith (56-particle capacity)
  const haze = buildEmitter(t, {
    max: 56,
    rate: 7,
    life: 2.4,
    lifeVar: 0.6,
    velocity: [0, 0.22, 0],
    spread: 0.12,
    gravity: -0.02,
    size: 0.08,
    sizeEnd: 0.3,
    color: 0xcfeef8,
    colorEnd: 0x2e6b8c,
    opacity: 0.26,
    additive: true,
  });
  haze.setOrigin(cp.x, 0.34, cp.z);
  g.add(haze.points);

  // ---- travelling coil pulses (the effect that sells "magnetic") ----------
  // 10 pulse groups riding the beam frames FASTER than the pods and in the
  // same direction; they all share ONE material (the wave is their motion),
  // so the whole effect costs one night-gated emissive update per frame.
  const pulseMat = new t.MeshStandardMaterial({ color: 0xdcfbff, emissive: 0x3fcde6, emissiveIntensity: 0.3, roughness: 0.3 });
  const pTopGeo = new t.BoxGeometry(0.13, 0.028, 0.17);
  const pBladeGeo = new t.BoxGeometry(0.022, 0.055, 0.17);
  const pulses: THREE.Group[] = [];
  for (let i = 0; i < 10; i++) {
    const pg = new t.Group();
    [-1, 1].forEach((s) => {
      const top = new t.Mesh(pTopGeo, pulseMat);
      top.position.set(s * 0.115, 0.112, 0);
      top.castShadow = false;
      pg.add(top);
      const blade = new t.Mesh(pBladeGeo, pulseMat);
      blade.position.set(s * 0.184, 0.03, 0);
      blade.castShadow = false;
      pg.add(blade);
    });
    g.add(pg);
    pulses.push(pg);
  }

  // ---- the pods + their ion wake ------------------------------------------
  const podLights: PodLights = { cabinMats: [], liftMats: [] };
  const PODS = 4;
  const SPACING = fb.total / PODS; // evenly spread around the ring
  const pods = [0, 1, 2, 3].map((n) => {
    const p = buildPod(t, n, podLights, { seats, riders: withRiders });
    g.add(p);
    return p;
  });
  const vehicle = pods[0]; // lead pod — the RideViewer follow/onboard cam
  // ONE real PointLight for the lead pod's levitation glow (night-gated)
  const podLight = new t.PointLight(0x7fe3f2, 0, 2.4, 2);
  podLight.position.set(0, -0.16, 0);
  pods[0].add(podLight);
  // ion/mist wake: one small emitter per pod (4 × 48 = 192 particle capacity,
  // inside the 300-per-component budget), venting from the tail vents
  const wakes = pods.map(() =>
    buildEmitter(t, {
      max: 48,
      rate: 0,
      life: 0.9,
      lifeVar: 0.3,
      velocity: [0, 0.16, 0],
      spread: 0.26,
      gravity: -0.04, // faintly buoyant ion mist
      size: 0.05,
      sizeEnd: 0.17,
      color: 0xd6f4fb,
      colorEnd: 0x2c6f92,
      opacity: 0.4,
      additive: true,
    }),
  );
  wakes.forEach((w) => g.add(w.points));

  // ---- the updater: absolute time in, deterministic pose out --------------
  const V = 0.85; // constant magnetic glide (units/s) — a slow walking pace
  const m4 = new t.Matrix4();
  const tail = new t.Vector3();
  const update = (time: number, motionK = 1) => {
    // ---- night gate: emissive first, the two real lights last ----
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    const breathe = 0.5 + 0.5 * Math.sin(time * 1.3);
    coilMats.forEach((cm, i) => (cm.emissiveIntensity = 0.2 + (1.15 + 0.2 * Math.sin(time * 1.1 + i * 1.7) - 0.2) * ease));
    pulseMat.emissiveIntensity = 0.34 + (1.9 - 0.34) * ease;
    edgeMat.emissiveIntensity = 0.2 + (1.0 - 0.2) * ease;
    lipMat.emissiveIntensity = 0.18 + (0.95 - 0.18) * ease;
    holoMats.forEach((hm, i) => (hm.emissiveIntensity = 0.22 + (0.75 + 0.35 * Math.sin(time * 1.7 + i * 2.1) - 0.22) * ease));
    bulbMats.forEach((bm) => (bm.emissiveIntensity = 0.12 + (1.35 - 0.12) * ease));
    podLights.cabinMats.forEach((cm, i) => (cm.emissiveIntensity = 0.14 + (1.0 + 0.1 * Math.sin(time * 0.9 + i) - 0.14) * ease));
    podLights.liftMats.forEach((lm, i) => (lm.emissiveIntensity = 0.32 + 0.5 * breathe + (1.5 - 0.32) * ease + 0.12 * Math.sin(time * 3.1 + i * 0.9)));
    // pylon beacons: a runway-style chase, one sharp flash per pylon
    beaconMats.forEach((bm, i) => {
      const ph = ((time * 0.5 - i * 0.09) % 1 + 1) % 1;
      bm.emissiveIntensity = 0.18 + (0.25 + 2.4 * Math.exp(-16 * ph)) * ease;
    });
    stationLight.intensity = ease * 0.85;
    podLight.intensity = ease * 0.5 + 0.08 * ease * Math.sin(time * 2.7);
    monoSeamMat.emissiveIntensity = 0.2 + (0.9 + 0.25 * Math.sin(time * 0.8) - 0.2) * ease;
    tipMat.emissiveIntensity = 0.3 + (1.6 + 0.4 * Math.sin(time * 1.9) - 0.3) * ease;
    ringMats.forEach((rm, i) => (rm.emissiveIntensity = 0.25 + (1.25 + 0.3 * Math.sin(time * 1.1 + i * 2.4) - 0.25) * ease));

    // ---- the show monolith: rings turn and float, haze vents up ------------
    rings.forEach(({ ring, spec }, i) => {
      ring.rotation.z = time * spec.spin + i * 1.7; // slow magnetic spin
      ring.position.y = spec.y + 0.035 * Math.sin(time * 0.7 + i * 2.1); // suspended float
      ring.rotation.x = Math.PI / 2 + spec.tilt + 0.06 * Math.sin(time * 0.45 + i);
    });
    haze.update(time);

    // ---- travelling coil pulses (same direction as the pods, ~2.6× faster)
    const uPulse = (time * V * 2.6) / fb.total;
    pulses.forEach((pg, i) => {
      const f = fb.frameAt(uPulse + i / pulses.length);
      pg.position.copy(f.p);
      m4.makeBasis(f.side, f.up, f.fwd);
      pg.setRotationFromMatrix(m4);
    });

    // ---- pods: constant glide, hovering clear of the beam, cinematic drift
    const uHead = (time * V) / fb.total;
    pods.forEach((pod, i) => {
      const f = fb.frameAt(uHead - (i * SPACING) / fb.total);
      const bob = 0.012 * Math.sin(time * 1.6 + i * 2.2) + 0.006 * Math.sin(time * 3.7 + hash(i) * 6.28);
      pod.position.copy(f.p).addScaledVector(f.up, HOVER + bob);
      m4.makeBasis(f.side, f.up, f.fwd);
      pod.setRotationFromMatrix(m4);
      // slow magnetic drift: the pod yaws/pitches a few degrees off the beam
      pod.rotateY(0.05 * Math.sin(time * 0.62 + i * 1.9) * motionK);
      pod.rotateX(0.028 * Math.sin(time * 0.47 + i * 3.1 + hash(i + 7) * 6.28) * motionK);
      pod.rotateZ(0.03 * Math.sin(time * 0.55 + i * 2.6)); // extra lean over the frame bank
      // ion wake vents from the tail, only while the pod is actually gliding
      tail.copy(pod.position).addScaledVector(f.fwd, -0.48).addScaledVector(f.up, -0.02);
      wakes[i].setOrigin(tail.x, tail.y, tail.z);
      wakes[i].setRate(3 + 15 * motionK);
      wakes[i].update(time);
    });
  };

  // station gate: the pods PARK on the beam (levitating, coils still breathing
  // through the frozen clock's last pose) while guests board and unload —
  // spinDown 1.4 is the long, smooth magnetic glide to a stop
  const gate = createMotionGate((tt, k) => update(tt, k), { spinDown: 1.4, spinUp: 1.2 });
  return {
    group: g,
    update: gate.update,
    vehicle,
    seatWorld: makeSeatWorld(t, seats),
    onStateChange: gate.onStateChange,
    ...extras,
  };
}

const MagneticRideBase = composableRide(
  'MagneticRide',
  (t, props: { pieces?: TrackPiece[]; riders?: boolean }) =>
    buildMagneticRideScene(t, { pieces: props.pieces, riders: props.riders ?? !(props as { register?: unknown }).register }),
  {
    // access geometry clears the guideway: the ring hangs off local −z, so the
    // queue HEAD sits 2.7 out the local +z front (lane extending +z, past the
    // platform's outer railing at z ≈ 1.0), the exit hut goes beside it and
    // boarding is ON the elevated deck.
    front: 2.7,
    exit: [-2.6, 1.5],
    board: [0, BEAM_Y + DECK_OVER, 0.35],
    defaults: { name: 'Maglev Glider', capacity: 8, rideDuration: 22, intensity: 2, price: 3 },
  },
);

/** <MagneticRide> — composable ride (components/Park/Context.md): a slow,
 *  exteriorly visible MAGLEV attraction. Mounts at `position`/`rotation`;
 *  inside a <Park>, `register` wires the full GameManager ride via
 *  <ConfigurableRide> — queue HEAD 2.7 out the local +z front (the guideway
 *  ring hangs off local −z, so the queue side is clear), exit hut beside it,
 *  boarding on the elevated deck. Capacity 8 = 4 pods × 2 seats: REAL guests
 *  ride via `seatWorld` (decorative riders off when registered) and the pods
 *  are motion-gated — they hover PARKED at the platform for boarding and
 *  unloading. The lead pod is the ride `vehicle` (RideViewer onboard cam).
 *  OPTIONAL track pieces (SETUP §5.1): a `pieces` array or piece children
 *  (children win) replace the default hexagonal ring with any
 *  compileTrackPieces circuit on the level 'monorail' profile; a FATAL
 *  compile marks the build `invalid` (never registered). Override access with
 *  top-level props / `queue`. */
export const MagneticRide: React.FC<
  ComposableRideProps & { pieces?: TrackPiece[]; riders?: boolean; children?: React.ReactNode }
> = ({ children, pieces, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <MagneticRideBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
