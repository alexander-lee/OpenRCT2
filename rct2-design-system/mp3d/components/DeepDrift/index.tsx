import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWater, buildWaterRibbon } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';
import { TIDEWATER } from '../TidewaterScenery';
import { buildReefBoat } from '../ReefRacer';

// ---------------------------------------------------------------------------
// DeepDrift — "Deep Drift", attraction 2 of TIDEWATER HOLLOW: a slow boat
// ride in TWO ACTS.
//
//   ACT 1  the boats DRIFT THROUGH SEA CAVES — a level channel winding under
//          rock arches and a long collapsed cave roof, dripping water, kelp,
//          the first faint bioluminescence on the wet rock. No drops at all.
//   ACT 2  the boat drifts into an iron LOCK HOUSE and a riveted DIVING BELL
//          lowers it, boat and all, 3.6 units into a TRENCH — a fissure in the
//          reef ledge whose walls are alight with bioluminescence. The bell's
//          portholes catch the glow, it hangs there, then the hoist brings it
//          back up and the boat drifts home to the station.
//
// SAME SPLINE MACHINERY as every other tracked ride: `compileTrackPieces`
// compiles the circuit and `buildRideSpline({ profile: 'flume' })` sweeps the
// wooden channel — the Water/River-ride drawer, a U-channel trough carrying a
// water strip on truss trestles, which is what a boat ride runs in. The layout
// is DELIBERATELY LEVEL: there is not one `lift` or `drop` in it, because this
// ride's vertical move is the BELL, not a hill.
//
// HOW THE TWO ACTS ARE STITCHED. The bell descent is a scripted, motion-gated
// STAGE rather than spline geometry (a spline cannot stop, and a Catmull-Rom
// through a 3.6-unit vertical drop and back would fail every clearance and
// pitch check the kit runs). So the boat is paced by this component's own act
// machine — an ANALYTIC piecewise map from the gated clock to arc length:
//
//   drift out  s = clock·V                       (0 … sBell)
//   THE BELL   s = sBell, depth = 0 → 3.6 → 0    (a 13.8 s stage)
//   drift home s = sBell + (clock − …)·V         (sBell … total)
//
// Everything else (the frames, the trough, the trestles, the banking, the
// closure legality) is the shared kit's. Because the map is analytic and not
// dt-integrated, a given clock always produces the same pose — screenshots are
// reproducible, and `phase0` opens a preview straight into the trench.
//
// Budget: 4 real PointLights (2 trench bioluminescence, DAY-AND-NIGHT lerped
// like LavaTubeRun's lava — a fissure under a rock ledge is dark at noon; the
// bell's interior lamp, which comes up as it submerges; one night-gated
// station lantern); 3 ParticleKit emitters / 230 particles; every static
// repeat batched through `mergedBoxes`; fine detail tagged `lodDetail`.
// Deterministic — hashed sines only, absolute-time updater.
// ---------------------------------------------------------------------------

/** the station straight runs along the local −x, so the local +z face (where
 *  <ConfigurableRide> puts the queue lane and the huts) stays clear: every
 *  turn is a RIGHT turn and the whole loop lives in the local −z half-plane */
const HEADING = -Math.PI / 2;
/** station rail height above the local ground */
const START: [number, number, number] = [0, 0.6, 0];

/**
 * "Bell Trench Drift" — the shipped layout. A LEVEL rounded rectangle:
 *   A (−x)  station · the run out to the cave mouth
 *   B (−z)  THE SEA CAVES — arches and the long collapsed roof
 *   C (+x)  the ledge leg, with the LOCK HOUSE and the TRENCH at its middle
 *   D (+z)  the home reach
 *   → a 1.2-u tail landing 0.3 u short of the station on its own axis.
 * Not one `lift` or `drop`: the whole circuit sits at y 0.60 and the only
 * vertical move on the ride is the diving bell. Verified with the kit's own
 * checks — ok, 0 design violations (one informational `shortDrop` stat-gate
 * note, which is meaningless on a ride with no drops), worst clearance 2.46,
 * closure CLOSED with zero synthesized track (see DeepDrift/Context.md).
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 2.6 }, // out of the station toward the caves
  { type: 'turnR', angle: 90, radius: 2.4 },
  { type: 'straight', length: 6.6 }, // THE SEA CAVES
  { type: 'turnR', angle: 90, radius: 2.4 },
  { type: 'straight', length: 6.7 }, // the ledge leg — the bell dock at its middle
  { type: 'turnR', angle: 90, radius: 2.4 },
  { type: 'straight', length: 6.6 }, // the home reach
  { type: 'turnR', angle: 90, radius: 2.4 },
  { type: 'straight', length: 1.2 }, // tail onto the station axis
];

// ---- the act machine -------------------------------------------------------
/** drift speed, units/second — slow and cinematic (a boat, not a coaster) */
const DRIFT_V = 1.25;
/** how far the bell takes the boat down, in world units */
const BELL_DEPTH = 3.6;
const T_DOWN = 3.6;
const T_HOLD = 6.6;
const T_UP = 3.6;
const BELL_T = T_DOWN + T_HOLD + T_UP; // 13.8 s in the trench

// ---- palette (Tidewater Hollow) --------------------------------------------
/** RCT2 TrackColour for the flooded channel — the same brine-stained green
 *  trough, driftwood rim rails and tarred trestles Reef Racer runs in, so the
 *  two rides read as one waterway */
const TRACK_COLOURS: TrackScheme = { main: 0x47624f, additional: 0x8a7c66, supports: 0x6a5a44 };
/** the dive skiff: iron-dark topsides, salt-bleached sheer, brass */
const BOAT_LIVERY: VehicleScheme = { body: 0x2c4a4c, trim: 0xb3aa90, tertiary: 0x94793f };

const IRON = 0x59524a; // TIDEWATER.iron, one step lighter — the lock house is
// 4.5 units of plate and at 0x4a443f the whole thing read as a black shed
const IRON_D = 0x474139; // the shadowed plate between the rivet bands
const RUST = TIDEWATER.rust;
const RUST_D = TIDEWATER.rustDark;
const BRASS = TIDEWATER.brass;
const TIMBER = TIDEWATER.driftwood;
const TIMBER_D = TIDEWATER.timberWet;
const TAR = TIDEWATER.tar;
const ROPE = TIDEWATER.rope;
const WEED = TIDEWATER.weed;
const WEED_D = TIDEWATER.weedDark;
const BARNACLE = TIDEWATER.barnacle;
/** the reef ledge: wet dark rock at the waterline, drier grey above it */
const LEDGE_WET = TIDEWATER.rockWet;
const LEDGE_DRY = 0x968e80; // TIDEWATER.rockDry, lifted a step: a whole apron
const SAND_WET = TIDEWATER.sandWet; // of 0x817c72 read as one muddy grey mass
const SAND_DRY = TIDEWATER.sandDry;
/** cave rock — darker than the open ledge, because it never sees the sun */
const CAVE_ROCK = 0x635b50;
const CAVE_ROCK_D = 0x5a5248;
const LAMP_GLASS = 0xfff4d2;
const LAMP_GLOW = 0xffb84c;
/** BIOLUMINESCENCE — the one cold colour in the world. A blue-green that is
 *  bright in value but low in saturation, so it reads as living light and not
 *  as a neon tube: the coral in this world is bleached, and the only thing
 *  that glows is alive. */
const BIO = 0x6fe0d0;
const BIO_DEEP = 0x2f7f8c;

// ---------------------------------------------------------------------------
// geometry helpers (local copies of the ReefRacer/Emberfall shapes — Stage's
// `mergedBoxes` only takes boxes, so bars/blades are built as matrices)
// ---------------------------------------------------------------------------

/** one merged box spanning A → B (its Y axis runs along the bar) */
function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat?: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, ...(repeat ? { repeat } : {}) };
}

/** a FLAT blade spanning A → B (kelp fronds): the width axis is kept
 *  horizontal, so a frond reads as a leaf and not as a green joist */
function bladeSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, w: number, thick: number): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  dir.normalize();
  const side = new t.Vector3().crossVectors(new t.Vector3(0, 1, 0), dir);
  if (side.lengthSq() < 1e-5) side.set(1, 0, 0);
  side.normalize();
  const up2 = new t.Vector3().crossVectors(dir, side).normalize();
  const m = new t.Matrix4().makeBasis(side, dir, up2);
  m.setPosition(a.clone().addScaledVector(dir, len * 0.5));
  return { dims: [w, len, thick], matrix: m, repeat: [1, 2] };
}

/** a TAPERED round spar between two points (piles, spars, hose runs) */
function spar(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, colour: number, tex: 'wood' | 'metal' = 'wood'): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = Math.max(0.05, dir.length());
  const m = cyl(t, r1, r0, len, colour, [0, 0, 0], {
    tex,
    repeat: [3, Math.max(1, Math.round(len * 1.6))],
    rough: 0.9,
    seg: 10,
  });
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

/** a SAGGING line (hose, chain, mooring rope) between two points */
function line(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, sag: number, r: number, material: THREE.Material): THREE.Mesh {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y -= sag;
  const m = new t.Mesh(new t.TubeGeometry(new t.CatmullRomCurve3([a, mid, b]), 12, r, 5, false), material);
  m.castShadow = true;
  return m;
}

/** smoothstep 0..1 */
const smooth = (k: number) => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

/**
 * THE MOON POOL CUT — the one piece of geometry surgery on this ride, and the
 * reason the bell no longer passes through its own channel.
 *
 * `buildRideSpline` sweeps ONE continuous trough over the whole loop; it has no
 * notion of an opening and this component does not get to add one to the shared
 * kit. So the opening is cut out of the swept mesh afterwards: a triangle is
 * dropped from its geometry's index if ANY of its vertices lies inside `hole`.
 *
 * Any-vertex, not centroid, and the difference matters: with a centroid test
 * the surviving quad still REACHES a whole frame into the opening (the frames
 * are 0.13 u apart on the stock layout and 0.17 on the Kelp Gallery), so the
 * clearance between the cradle pan and the cut trough end would depend on how
 * long the author's circuit happens to be. Any-vertex guarantees the surviving
 * trough starts at or beyond the requested edge on EVERY layout; the cut simply
 * runs up to one frame long the other way, which the head castings cover.
 *
 * TWO TRAPS, both of which bite:
 *   * `box()` / `cyl()` hand out CACHED, SHARED geometries keyed by their
 *     dimensions (Stage `getGeo`) — the trough's transverse ribs are all one
 *     BoxGeometry, shared with every other component in the design system.
 *     Cutting one in place would punch a hole in half the park, so every
 *     geometry is CLONED before it is touched.
 *   * a cut geometry keeps its old bounding box/sphere and can be culled (or
 *     not culled) wrongly, so both are recomputed here.
 */
function cutOpening(
  t: typeof THREE,
  root: THREE.Object3D,
  hole: (x: number, y: number, z: number) => boolean,
): { meshes: number; removed: number; kept: number; emptied: number } {
  const stat = { meshes: 0, removed: 0, kept: 0, emptied: 0 };
  const v = new t.Vector3();
  const dead: THREE.Object3D[] = [];
  const walk = (o: THREE.Object3D, parent: THREE.Matrix4) => {
    o.updateMatrix();
    const mw = new t.Matrix4().multiplyMatrices(parent, o.matrix);
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const src = mesh.geometry as THREE.BufferGeometry;
      const pos = src.getAttribute('position');
      const index = src.getIndex();
      if (pos) {
        const n = index ? index.count : pos.count;
        const keep: number[] = [];
        let cut = 0;
        for (let i = 0; i + 2 < n; i += 3) {
          const ia = index ? index.getX(i) : i;
          const ib = index ? index.getX(i + 1) : i + 1;
          const ic = index ? index.getX(i + 2) : i + 2;
          let hit = false;
          for (const k of [ia, ib, ic]) {
            v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(mw);
            if (hole(v.x, v.y, v.z)) { hit = true; break; }
          }
          if (hit) cut += 1;
          else keep.push(ia, ib, ic);
        }
        if (cut > 0) {
          stat.meshes += 1;
          stat.removed += cut;
          stat.kept += keep.length / 3;
          // CLONE: box()/cyl() geometries are shared across the whole DS
          const geo = src.clone();
          geo.clearGroups();
          geo.setIndex(keep);
          geo.computeBoundingBox();
          geo.computeBoundingSphere();
          mesh.geometry = geo;
          if (keep.length === 0) {
            stat.emptied += 1;
            dead.push(mesh);
          }
        }
      }
    }
    for (const c of [...o.children]) walk(c, mw);
  };
  walk(root, new t.Matrix4());
  for (const d of dead) d.parent?.remove(d);
  return stat;
}

/** a small brass-caged LANTERN: cage, glass globe, hanger. The glass material
 *  is returned so the caller can night-gate it. */
function shipLantern(t: typeof THREE, scale = 1): { group: THREE.Group; glass: THREE.MeshStandardMaterial } {
  const grp = new t.Group();
  const s = scale;
  grp.add(cyl(t, 0.07 * s, 0.05 * s, 0.05 * s, BRASS, [0, 0.16 * s, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 }));
  grp.add(cyl(t, 0.055 * s, 0.07 * s, 0.04 * s, BRASS, [0, -0.14 * s, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 }));
  const cage: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    cage.push({ dims: [0.014 * s, 0.28 * s, 0.014 * s], pos: [Math.cos(a) * 0.055 * s, 0, Math.sin(a) * 0.055 * s] });
  }
  cage.push({ dims: [0.016 * s, 0.09 * s, 0.016 * s], pos: [0, 0.22 * s, 0] });
  grp.add(mergedBoxes(t, cage, BRASS, { tex: 'metal', metal: 0.65, rough: 0.45 }));
  const globe = ball(t, 0.058 * s, LAMP_GLASS, [0, 0, 0], { emissive: LAMP_GLOW, rough: 0.3 });
  (globe.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
  grp.add(globe);
  return { group: grp, glass: globe.material as THREE.MeshStandardMaterial };
}

// ---------------------------------------------------------------------------
// BIOLUMINESCENT LIFE — the trench's light, and the cave's first hint of it.
//
// Three silhouettes, because "a glow" is not a creature: a CLUSTER of tube
// anemones (stalks with a lit crown), a soft PATCH of glowing polyps crusted
// on rock, and a hanging JELLY (a lit bell with trailing tentacles). All of
// them return their emissive materials so the caller can lerp them; none of
// them own a PointLight.
// ---------------------------------------------------------------------------

/** a clump of tube anemones on rock: dark stalks, lit crowns */
function bioAnemones(t: typeof THREE, seed: number, scale = 1, mats: THREE.MeshStandardMaterial[]): THREE.Group {
  const grp = new t.Group();
  const h = (n: number) => hash01(seed * 1.37 + n * 5.11);
  const stalks: MergedBoxSpec[] = [];
  const n = 5 + Math.floor(h(1) * 4);
  const crownMat = mat(t, BIO, { emissive: BIO, rough: 0.4 });
  crownMat.emissiveIntensity = 0.5;
  mats.push(crownMat);
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2 + h(k + 2) * 0.9;
    const rr = scale * (0.06 + 0.14 * h(k + 3));
    const len = scale * (0.16 + 0.24 * h(k + 4));
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const tip = new t.Vector3(x + (h(k + 5) - 0.5) * len * 0.5, len, z + (h(k + 6) - 0.5) * len * 0.5);
    stalks.push(barSpec(t, new t.Vector3(x, 0, z), tip, scale * 0.035));
    // the lit crown — a small flattened ball, the only part that glows
    const crown = new t.Mesh(new t.IcosahedronGeometry(scale * (0.038 + 0.026 * h(k + 7)), 1), crownMat);
    crown.position.copy(tip);
    crown.scale.y = 0.62;
    grp.add(crown);
  }
  grp.add(mergedBoxes(t, stalks, 0x2b3a3a, { rough: 0.9 }));
  if (scale < 0.9) grp.userData.lodDetail = true;
  return grp;
}

/** a soft PATCH of glowing polyps crusted flat on rock — the cheap, wide read
 *  of "this wall is alive". Local +y is the rock's outward normal. */
function bioPatch(t: typeof THREE, seed: number, scale = 1, mats: THREE.MeshStandardMaterial[]): THREE.Group {
  const grp = new t.Group();
  const h = (n: number) => hash01(seed * 2.71 + n * 3.19);
  const m = mat(t, BIO, { emissive: BIO, rough: 0.55, opacity: 0.85 });
  m.emissiveIntensity = 0.42;
  mats.push(m);
  const specs: MergedBoxSpec[] = [];
  for (let k = 0; k < 9; k += 1) {
    const a = h(k + 1) * Math.PI * 2;
    const rr = scale * 0.42 * h(k + 2);
    const s = scale * (0.09 + 0.13 * h(k + 3));
    specs.push({ dims: [s, scale * 0.03, s * (0.5 + 0.7 * h(k + 4))], pos: [Math.cos(a) * rr, 0, Math.sin(a) * rr], rotY: h(k + 5) * 3.1 });
  }
  const patch = mergedBoxes(t, specs, BIO, { rough: 0.55 });
  (patch.material as THREE.MeshStandardMaterial).emissive = new t.Color(BIO);
  (patch.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.42;
  mats.push(patch.material as THREE.MeshStandardMaterial);
  patch.castShadow = false;
  grp.add(patch);
  grp.userData.lodDetail = true;
  return grp;
}

/** a hanging JELLY: a lit bell with four trailing tentacles. Returned with a
 *  `drift` phase in userData so the caller can pulse it. */
function bioJelly(t: typeof THREE, seed: number, scale = 1, mats: THREE.MeshStandardMaterial[]): THREE.Group {
  const grp = new t.Group();
  const h = (n: number) => hash01(seed * 4.13 + n * 7.37);
  const bellMat = mat(t, BIO, { emissive: BIO, rough: 0.35, opacity: 0.7 });
  bellMat.emissiveIntensity = 0.55;
  mats.push(bellMat);
  const bell = new t.Mesh(new t.SphereGeometry(scale * 0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), bellMat);
  bell.castShadow = false;
  grp.add(bell);
  const tent: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + h(k) * 0.6;
    const len = scale * (0.28 + 0.24 * h(k + 2));
    tent.push(
      barSpec(
        t,
        new t.Vector3(Math.cos(a) * scale * 0.1, -scale * 0.04, Math.sin(a) * scale * 0.1),
        new t.Vector3(Math.cos(a) * scale * 0.05, -len, Math.sin(a) * scale * 0.05),
        scale * 0.016,
      ),
    );
  }
  const tm = mergedBoxes(t, tent, BIO_DEEP, { rough: 0.6 });
  (tm.material as THREE.MeshStandardMaterial).emissive = new t.Color(BIO_DEEP);
  (tm.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
  mats.push(tm.material as THREE.MeshStandardMaterial);
  tm.castShadow = false;
  grp.add(tm);
  grp.userData.lodDetail = true;
  return grp;
}

/** a clump of KELP — five flat blades off one holdfast, all leaning one way.
 *  'fabric', never 'leaf': the leaf texture's 1.3× saturation boost turns
 *  weed into bright lawn green (the ReefRacer note). */
function kelpClump(t: typeof THREE, seed: number, scale = 1): THREE.Group {
  const grp = new t.Group();
  const h = (n: number) => hash01(seed * 3.61 + n * 2.29);
  const lean = h(1) * Math.PI * 2;
  const specs: MergedBoxSpec[] = [];
  for (let k = 0; k < 5; k += 1) {
    const a = lean + (k - 2) * 0.32 + (h(k + 2) - 0.5) * 0.3;
    const len = scale * (0.5 + 0.55 * h(k + 3));
    const foot = new t.Vector3((h(k + 4) - 0.5) * scale * 0.16, 0, (h(k + 5) - 0.5) * scale * 0.16);
    const knee = foot.clone().add(new t.Vector3(Math.cos(a) * len * 0.2, len * 0.6, Math.sin(a) * len * 0.2));
    const tip = knee.clone().add(new t.Vector3(Math.cos(a) * len * 0.62, len * 0.26, Math.sin(a) * len * 0.62));
    specs.push(bladeSpec(t, foot, knee, scale * 0.1, scale * 0.024));
    specs.push(bladeSpec(t, knee, tip, scale * 0.14, scale * 0.02));
  }
  grp.add(mergedBoxes(t, specs, h(9) > 0.5 ? WEED : WEED_D, { tex: 'fabric', rough: 0.94, bump: 0.03 }));
  grp.userData.lodDetail = true;
  return grp;
}

// ---------------------------------------------------------------------------
// THE DIVING BELL — the signature.
//
// A riveted iron bell built as PLATE STAVES around its circumference rather
// than as a lathed cone, for two reasons: the boat has to drift IN and OUT of
// it, so it needs a real arched opening at each end (a `CylinderGeometry`
// cannot have a hole in it), and plate-and-rivet construction is the whole
// read of a Victorian salvage bell. Local frame: +z along the channel (the
// arches face ±z), y = 0 is the CHANNEL RAIL, so the bell hangs at rail level
// when the hoist is up and the caller simply moves it down in y.
//
// The bell carries its own CRADLE PAN — a shallow iron caisson floor with a
// water strip, flush with the trough floor when raised, so the channel reads
// continuous; when the bell descends, the pan goes with it and takes the boat
// with it. That is the whole mechanism.
// ---------------------------------------------------------------------------

/** How far out the arch openings reach, in radians either side of ±z. 0.85 rad
 *  (48.7°) is not a styling choice: the fissure is skewed 45° to the channel, so
 *  the camera that can see down the fissure is 45° off the arch normal, and a
 *  ±0.62 arch was still edge-on at that angle — the riders were invisible at the
 *  bottom of the stage. At ±0.85 the opening is wider than the view angle. */
const ARCH_HALF = 0.85;
/** clear height of the arch above the rail — the boat's carved prow tops out
 *  0.67 above its own rail and a seated rider's head about 0.80 */
const ARCH_CLEAR = 1.18;
const BELL_R = 1.16;
const BELL_TOP = 1.92;
/** HALF-LENGTH OF THE CRADLE PAN, along the channel. The pan is the removable
 *  section of channel — the plug that fills the moon pool when the hoist is up
 *  — so this number and `POOL_HZ` are a matched pair: the joint at each end of
 *  the pan is exactly `POOL_HZ − PAN_HZ`. */
export const PAN_HZ = 1.36;
/** the two HOIST GUIDES the bell runs on, as a radius from the bell's axis.
 *  They stand on the fissure's own CENTRELINE (the fissure is skewed 45° to the
 *  channel, so in the bell's frame that is the 135°/315° quarters — the same
 *  quarters the lifting eyes are already on) which keeps them out of the one
 *  sightline that can see down the trench into the arch. */
export const GUIDE_R = 1.42;
const GUIDE_Q = [(3 * Math.PI) / 4, (7 * Math.PI) / 4];

export interface DivingBellOpts {
  /** porthole glass + interior glow materials are pushed here for gating */
  ports?: THREE.MeshStandardMaterial[];
  /** decorative rivet/rib detail (default true) */
  detail?: boolean;
  /** the two guide shoes that ride the shaft's guide rails (default true) */
  guides?: boolean;
}

/**
 * The diving bell + its cradle pan. Exported for parks dressing their own
 * salvage stations. `group.userData.eyes` are the four lifting-eye points the
 * hoist cables land on, in local space.
 */
export function buildDivingBell(t: typeof THREE, opts: DivingBellOpts = {}): THREE.Group {
  const bell = new t.Group();
  const ports = opts.ports ?? [];

  // ---- the shell: 30 riveted plate staves, arched open fore and aft ----
  const STAVES = 30;
  const plate: MergedBoxSpec[] = [];
  const bands: MergedBoxSpec[] = [];
  for (let k = 0; k < STAVES; k += 1) {
    const a = (k / STAVES) * Math.PI * 2;
    // an arch at ±z (a = π/2 and 3π/2 in the x–z plane measured from +x)
    const dz = Math.min(Math.abs(Math.sin(a)) >= 0 ? Math.abs(Math.abs(a - Math.PI / 2)) : 9, Math.abs(a - (3 * Math.PI) / 2));
    const inArch = Math.min(Math.abs(a - Math.PI / 2), Math.abs(a - (3 * Math.PI) / 2)) < ARCH_HALF;
    const y0 = inArch ? ARCH_CLEAR : -0.16;
    const y1 = BELL_TOP;
    if (y1 - y0 < 0.06) continue;
    const m = new t.Matrix4().makeRotationY(-a);
    m.setPosition(Math.cos(a) * BELL_R, (y0 + y1) / 2, Math.sin(a) * BELL_R);
    plate.push({ dims: [0.07, y1 - y0, (Math.PI * 2 * BELL_R) / STAVES + 0.02], matrix: m, repeat: [1, 2] });
    // rivet bands: three horizontal straps per stave, skipped inside the arch
    [0.12, 0.92, 1.72].forEach((by) => {
      if (by < y0) return;
      const mb = new t.Matrix4().makeRotationY(-a);
      mb.setPosition(Math.cos(a) * (BELL_R + 0.035), by, Math.sin(a) * (BELL_R + 0.035));
      bands.push({ dims: [0.03, 0.1, (Math.PI * 2 * BELL_R) / STAVES + 0.02], matrix: mb });
    });
    void dz;
  }
  bell.add(mergedBoxes(t, plate, IRON_D, { tex: 'metal', metal: 0.45, rough: 0.72, bump: 0.05 }));
  if (opts.detail ?? true) {
    const bandMesh = mergedBoxes(t, bands, RUST, { tex: 'metal', metal: 0.3, rough: 0.9 });
    bandMesh.userData.lodDetail = true;
    bell.add(bandMesh);
  }

  // ---- the arch heads: a stepped iron lintel over each opening ----
  const lint: MergedBoxSpec[] = [];
  [1, -1].forEach((s) => {
    for (let k = 0; k < 2; k += 1) {
      lint.push({
        dims: [BELL_R * 1.5 - k * 0.24, 0.11, 0.16],
        pos: [0, ARCH_CLEAR + 0.06 + k * 0.12, s * (BELL_R + 0.02 - k * 0.06)],
        repeat: [3, 1],
      });
    }
    // jamb blocks either side of the opening
    [-1, 1].forEach((sx) => {
      lint.push({ dims: [0.14, ARCH_CLEAR + 0.3, 0.2], pos: [sx * BELL_R * 0.68, (ARCH_CLEAR + 0.3) / 2 - 0.16, s * (BELL_R * 0.78)], rotY: sx * s * 0.5 });
    });
  });
  bell.add(mergedBoxes(t, lint, IRON, { tex: 'metal', metal: 0.5, rough: 0.68, bump: 0.04 }));

  // ---- the dome + top hatch ----
  const domeMat = mat(t, IRON, { tex: 'metal', metal: 0.5, rough: 0.7, bump: 0.05 });
  domeMat.side = t.DoubleSide;
  // A SHALLOW cap, seated on the plates. The full-radius cap it used to be had
  // its rim 0.24 ABOVE the top of the staves — an open band all the way round
  // the crown, which the close preview shows as a slot into the bell — and rose
  // to 3.06, which swallowed the brass hatch whole and put a 2.32-wide dome
  // straight through the lock house roof. Squashed to 0.42 and dropped so the
  // rim lands exactly on BELL_TOP, it closes the crown, the hatch sits on top
  // of it where a hatch belongs, and the whole crown fits the hoist well.
  const dome = new t.Mesh(new t.SphereGeometry(BELL_R + 0.04, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), domeMat);
  dome.scale.y = 0.42;
  dome.position.y = BELL_TOP - (BELL_R + 0.04) * Math.cos(Math.PI * 0.42) * 0.42;
  dome.castShadow = true;
  bell.add(dome);
  bell.add(cyl(t, 0.3, 0.34, 0.16, IRON, [0, BELL_TOP + 0.42, 0], { tex: 'metal', metal: 0.55, rough: 0.6, seg: 12 })); // hatch coaming
  bell.add(cyl(t, 0.26, 0.26, 0.05, BRASS, [0, BELL_TOP + 0.53, 0], { tex: 'metal', metal: 0.65, rough: 0.45, seg: 12 })); // its brass cover
  const dogs: MergedBoxSpec[] = [];
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    dogs.push({ dims: [0.05, 0.07, 0.1], pos: [Math.cos(a) * 0.3, BELL_TOP + 0.5, Math.sin(a) * 0.3], rotY: -a });
  }
  bell.add(mergedBoxes(t, dogs, BRASS, { tex: 'metal', metal: 0.6, rough: 0.5 }));

  // ---- FOUR VIEWING PORTS: brass rings on lit glass, at rider eye level ----
  // set on the QUARTERS (±45° off the arches) so an arch never eats one and
  // there is always a port facing the camera
  // the ports sit on the two surviving plate QUARTERS (centred on ±x, i.e.
  // square across the channel) — the old ±45° positions now fall inside the
  // widened arches
  [0.34, -0.34, Math.PI + 0.34, Math.PI - 0.34].forEach((a, i) => {
    const px = Math.cos(a) * (BELL_R + 0.02);
    const pz = Math.sin(a) * (BELL_R + 0.02);
    // the ring lies FLAT round the glass — its axis is the port's own radial
    // direction (a torus's axis is +z, and rotating θ about y sends +z to
    // (sin θ, 0, cos θ), so θ = π/2 − a). The old triple rotation left it
    // standing edge-on like a hoop, 0.23 proud of the plate, and on the way
    // down it took a 0.09 bite out of the lock house's bottom flange.
    const ring = new t.Mesh(new t.TorusGeometry(0.2, 0.045, 6, 14), mat(t, BRASS, { tex: 'metal', metal: 0.62, rough: 0.45 }));
    ring.position.set(px, 0.86, pz);
    ring.rotation.y = Math.PI / 2 - a;
    bell.add(ring);
    const glass = cyl(t, 0.17, 0.17, 0.06, LAMP_GLASS, [px, 0.86, pz], { emissive: BIO, rough: 0.28, seg: 12 });
    glass.rotation.z = Math.PI / 2;
    glass.rotation.y = -a;
    (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1;
    ports.push(glass.material as THREE.MeshStandardMaterial);
    bell.add(glass);
    // eight brass bolts round each port
    const bolts: MergedBoxSpec[] = [];
    for (let k = 0; k < 8; k += 1) {
      const b = (k / 8) * Math.PI * 2;
      const m = new t.Matrix4().makeRotationY(-a);
      m.setPosition(px + Math.cos(a) * 0.02, 0.86 + Math.sin(b) * 0.26, pz + Math.sin(a) * 0.02);
      m.multiply(new t.Matrix4().makeTranslation(0, 0, Math.cos(b) * 0.26));
      bolts.push({ dims: [0.04, 0.05, 0.05], matrix: m });
    }
    const bm = mergedBoxes(t, bolts, BRASS, { tex: 'metal', metal: 0.6, rough: 0.5 });
    bm.userData.lodDetail = true;
    bell.add(bm);
    void i;
  });

  // ---- the lifting yoke: two crossed iron beams over the dome + four eyes --
  const yoke: MergedBoxSpec[] = [];
  [0, Math.PI / 2].forEach((a) => {
    yoke.push({ dims: [BELL_R * 2.1, 0.13, 0.16], pos: [0, BELL_TOP + 0.66, 0], rotY: a, repeat: [4, 1] });
  });
  const eyes: [number, number, number][] = [];
  for (let k = 0; k < 4; k += 1) {
    // on the QUARTERS, not the axes: a cable dropping to an eye on the channel
    // axis had to slant right across the headframe to reach its sheave
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const ex = Math.cos(a) * BELL_R * 0.94;
    const ez = Math.sin(a) * BELL_R * 0.94;
    yoke.push({ dims: [0.16, 0.2, 0.16], pos: [ex, BELL_TOP + 0.78, ez] });
    eyes.push([ex, BELL_TOP + 0.9, ez]);
  }
  bell.add(mergedBoxes(t, yoke, IRON, { tex: 'metal', metal: 0.55, rough: 0.6, bump: 0.04 }));
  bell.userData.eyes = eyes;

  // ---- THE GUIDE SHOES: what makes the descent a guided one ----
  // Two shoes per rail, one off the lifting yoke's quarter and one off the
  // arch plate at mid-height, each a forked bracket that embraces a fixed
  // rail in the shaft. A bell on four cables alone swings; a bell on guides
  // reads as machinery running in a shaft, which is the whole point of the
  // stage. The shoes sit on the 135°/315° quarters, i.e. on the fissure's
  // centreline, so they never cross the arch a camera looks in through.
  if (opts.guides ?? true) {
    const shoe: MergedBoxSpec[] = [];
    for (const a of GUIDE_Q) {
      const ux = Math.cos(a);
      const uz = Math.sin(a);
      for (const sy of [1.45, BELL_TOP + 0.78] as const) {
        // THE FORK: two cheeks either side of the rail, each on its own arm.
        // The arms are offset to the cheeks' own tangential line rather than
        // run down the centre — an arm on the centreline ends exactly where the
        // rail web is and drives 0.28 straight through it (measured).
        for (const s2 of [-1, 1] as const) {
          const ox = -uz * s2 * 0.17;
          const oz = ux * s2 * 0.17;
          shoe.push(
            barSpec(
              t,
              new t.Vector3(ux * (BELL_R * 0.9) + ox, sy, uz * (BELL_R * 0.9) + oz),
              new t.Vector3(ux * GUIDE_R + ox, sy, uz * GUIDE_R + oz),
              0.09,
              [1, 2],
            ),
          );
          shoe.push({ dims: [0.13, 0.22, 0.08], pos: [ux * GUIDE_R + ox, sy, uz * GUIDE_R + oz], rotY: -a });
        }
      }
    }
    bell.add(mergedBoxes(t, shoe, IRON, { tex: 'metal', metal: 0.55, rough: 0.62, bump: 0.04 }));
  }

  // ---- THE CRADLE PAN: a shallow iron caisson floor with a water strip ----
  // Flush with the trough floor (−0.10 below the rail) when the hoist is up,
  // so the channel reads continuous; it descends WITH the bell.
  // 0.86 WIDE, not 1.10: the pan has to fit INSIDE the swept trough (inner
  // width 0.90) because it descends THROUGH it — a pan wider than the channel
  // clipped straight through both trough walls on its way down.
  const L = PAN_HZ * 2;
  const pan: MergedBoxSpec[] = [
    { dims: [0.86, 0.07, L], pos: [0, -0.135, 0], repeat: [3, 6] }, // the floor plate
    { dims: [0.07, 0.3, L], pos: [-0.4, 0.02, 0], repeat: [1, 6] }, // its coamings
    { dims: [0.07, 0.3, L], pos: [0.4, 0.02, 0], repeat: [1, 6] },
    // the SEALING END SILLS: these are the faces that butt the moon pool's own
    // head castings when the hoist is up, which is what makes the channel read
    // continuous straight through the house
    { dims: [0.88, 0.08, 0.12], pos: [0, 0.16, -(PAN_HZ - 0.06)], repeat: [3, 1] },
    { dims: [0.88, 0.08, 0.12], pos: [0, 0.16, PAN_HZ - 0.06], repeat: [3, 1] },
  ];
  for (let k = 0; k < 7; k += 1) {
    // transverse ribs under the pan, so it reads as a fabricated tank
    pan.push({ dims: [0.88, 0.11, 0.1], pos: [0, -0.21, -1.2 + k * 0.4], repeat: [3, 1] });
  }
  bell.add(mergedBoxes(t, pan, IRON_D, { tex: 'metal', metal: 0.45, rough: 0.74, bump: 0.05 }));
  // the water lying in the pan — the profile's own strip colour, so the pan
  // and the channel are the same water
  const pond = box(t, [0.78, 0.03, L - 0.08], 0x447588, [0, -0.06, 0], { rough: 0.8, opacity: 0.9, emissive: 0x1b2b37 });
  pond.castShadow = false;
  bell.add(pond);
  bell.userData.pond = pond.material as THREE.MeshStandardMaterial;

  // ---- an interior lamp in the crown: emissive glass, the real PointLight is
  // added by the caller at `userData.lampAt` ----
  const lampGlass = ball(t, 0.1, LAMP_GLASS, [0, BELL_TOP - 0.22, 0], { emissive: LAMP_GLOW, rough: 0.3 });
  (lampGlass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1;
  ports.push(lampGlass.material as THREE.MeshStandardMaterial);
  bell.add(lampGlass);
  bell.add(cyl(t, 0.05, 0.07, 0.1, BRASS, [0, BELL_TOP - 0.09, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 }));
  bell.userData.lampAt = [0, BELL_TOP - 0.3, 0];
  // barnacle crust and weed along the bell's own old waterline
  const crust: MergedBoxSpec[] = [];
  for (let k = 0; k < 26; k += 1) {
    const a = hash01(k * 1.9 + 3) * Math.PI * 2;
    const y = 0.1 + hash01(k * 4.7 + 9) * 0.34;
    const s = 0.035 + hash01(k * 7.1) * 0.045;
    crust.push({ dims: [s, s * 0.6, s], pos: [Math.cos(a) * (BELL_R + 0.05), y, Math.sin(a) * (BELL_R + 0.05)], rotY: -a });
  }
  const cm = mergedBoxes(t, crust, BARNACLE, { tex: 'concrete', rough: 0.95, flat: true });
  cm.userData.lodDetail = true;
  bell.add(cm);
  return bell;
}

// ---------------------------------------------------------------------------
export interface DeepDriftOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Bell Trench Drift. Compiled on the 'flume' profile, heading −90°. Keep it
   *  LEVEL: this ride's vertical move is the bell. */
  pieces?: TrackPiece[];
  /** decorative riders (default true; `register` turns them OFF so REAL
   *  GameManager guests fill the four thwarts through seatWorld) */
  riders?: boolean;
  /** terrain sampler so the ledge, the trench and the caves land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the BELL DOCK (default: auto — the straightest, most
   *  level stretch farthest from the station) */
  bellU?: number;
  /** seconds to advance the act machine at t = 0 — the previews use it to open
   *  straight into the trench stage */
  phase0?: number;
}

export interface DeepDriftBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** FATAL pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
}

/**
 * The whole ride: the level channel, the sea caves, the reef ledge, the lock
 * house + diving bell + trench, the station, and the dive skiff. `update` is
 * motion-gated (the boat parks in the station while guests board — RCT2's
 * Vehicle.cpp status cycle) while the SEA and the bioluminescence keep moving;
 * `seatWorld` seats real guests on the four thwarts and `vehicle` is the boat
 * for the RideViewer follow cam.
 */
export function buildDeepDriftScene(three: typeof THREE, opts: DeepDriftOpts = {}): DeepDriftBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; invalid?: boolean } = {};
  const seatAnchors: THREE.Object3D[] = [];
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const groundAt = opts.groundAt ?? (() => 0);

        // ---- 1. LAYOUT: the shared spline machinery ----------------------
        const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, { profile: 'flume', start: START, heading: HEADING });
        g.userData.trackReport = compiled.report;
        if (compiled.report.fatal) extras.invalid = true; // never registers
        const ride = buildRideSpline(t, compiled.points, {
          profile: 'flume',
          colours: TRACK_COLOURS,
          groundAt,
          wood: true,
        });
        g.add(ride.group);
        const total = ride.curve.getLength();
        const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);

        // frame scan — footprint, centroid, and the "inside/outside" test every
        // placement below is taken against, so the dressing follows ANY layout
        const M = 192;
        const cen = new t.Vector3();
        let x0 = Infinity;
        let x1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        const poly: [number, number][] = [];
        for (let i = 0; i < M; i += 1) {
          const f = ride.frameAt(i / M);
          cen.add(f.p);
          x0 = Math.min(x0, f.p.x);
          x1 = Math.max(x1, f.p.x);
          z0 = Math.min(z0, f.p.z);
          z1 = Math.max(z1, f.p.z);
          poly.push([f.p.x, f.p.z]);
        }
        cen.multiplyScalar(1 / M).setY(0);
        /** which side of the frame points AWAY from the loop's centre */
        const outSign = (f: { p: THREE.Vector3; side: THREE.Vector3 }) =>
          f.side.x * (f.p.x - cen.x) + f.side.z * (f.p.z - cen.z) >= 0 ? 1 : -1;
        const distToTrack = (x: number, z: number) => {
          let d = Infinity;
          for (const [px, pz] of poly) d = Math.min(d, Math.hypot(px - x, pz - z));
          return d;
        };

        // ---- 2. WHERE THE BELL DOCK GOES --------------------------------
        // The lock house is 4.5 units long and has to straddle the fissure, so
        // it needs the MIDDLE of a long straight, level run — not merely a
        // straight, level sample. Collect the contiguous runs, then take the
        // MIDPOINT of whichever long-enough run lies farthest from the station
        // (on the stock layout: the middle of the far ledge leg). Scoring
        // individual samples instead picked the FAR END of the run, which put
        // half the house in the turn. Override with `bellU`.
        const st0 = ride.frameAt(0);
        const bellU = (() => {
          if (opts.bellU !== undefined) return opts.bellU;
          const d = 1.8 / total;
          const runs: { u0: number; u1: number }[] = [];
          let cur: { u0: number; u1: number } | null = null;
          for (let i = 0; i < 400; i += 1) {
            const u = i / 400;
            const f = ride.frameAt(u);
            const a = ride.frameAt(u - d).fwd;
            const b = ride.frameAt(u + d).fwd;
            const bend = 1 - (a.x * b.x + a.z * b.z) / ((Math.hypot(a.x, a.z) || 1) * (Math.hypot(b.x, b.z) || 1));
            const ok = bend < 0.004 && Math.abs(f.fwd.y) < 0.05 && u > 5.5 / total && u < 1 - 5.5 / total;
            if (ok) {
              if (!cur) {
                cur = { u0: u, u1: u };
                runs.push(cur);
              } else cur.u1 = u;
            } else cur = null;
          }
          if (!runs.length) return 0.5;
          const score = (r: { u0: number; u1: number }) => {
            const f = ride.frameAt((r.u0 + r.u1) / 2);
            const len = (r.u1 - r.u0) * total;
            return Math.hypot(f.p.x - st0.p.x, f.p.z - st0.p.z) + (len >= 2.6 ? 40 : 0) + len;
          };
          let best = runs[0];
          for (const r of runs) if (score(r) > score(best)) best = r;
          return (best.u0 + best.u1) / 2;
        })();
        const dockF = ride.frameAt(bellU);
        const dockYaw = yawOf(dockF);
        const sBell = bellU * total;
        g.userData.bellAt = [dockF.p.x, dockF.p.y, dockF.p.z];
        g.userData.bellU = bellU;

        // ---- the TRENCH footprint, in world space -----------------------
        // the fissure runs PERPENDICULAR to the channel (local ±x), so its
        // open arms stick out either side of the lock house and the bell is
        // visible hanging in it from both flanks
        const RIFT_HX = 3.5; // half-length, across the channel
        const RIFT_HZ = 1.45; // half-width, along the channel (at the middle)
        const RIFT_DEPTH = 4.35; // below the ledge surface
        // The fissure is NOT a constant slot, and this is the single most
        // important number on the ride: a 2.9-wide slot 4.35 deep can only be
        // looked into from within ~17° of its own axis, so from any normal DS
        // camera the bell was in a letterbox. The SEAWARD arm (local +x) opens
        // out and its floor ramps up, so the trench reads as a chasm that
        // collapsed open on one side — and a 40°-ish camera on that side looks
        // straight down the ramp, under the raised lock house, onto the bell.
        // THE MOUTH IS BULGED WHERE THE BELL COMES DOWN. A 2.9-wide fissure and
        // a 2.5-wide bell leave 0.2 of annulus, and the wall courses step IN as
        // they descend — so the stock fissure was NARROWER than the bell over
        // the whole of its travel and the bell ploughed through nine courses of
        // rock, the boulders jammed in them and the colonies growing on them
        // (measured: 10 754 intersecting triangle pairs against the wall mesh
        // alone). The fix is the one a salvage company would have paid for:
        // the mouth was CUT WIDER where the bell has to pass, a smooth bulge
        // dying away over ~2.6 units either side. Everything else that follows
        // riftHZ — the lip rock, the weed, the bed, the ledge cut-out and the
        // published riftRect — widens with it for free.
        const SHAFT_BULGE = 0.7;
        const bulge = (lx: number) => SHAFT_BULGE * Math.max(0, 1 - (Math.abs(lx) / 2.6) ** 2) ** 1.4;
        const riftHZ = (lx: number) => RIFT_HZ + Math.max(0, lx) * 0.34 + bulge(lx);
        const RIFT_LIP_OUT = 4.7; // the seaward lip reaches further out
        const dockGY = groundAt(dockF.p.x, dockF.p.z);
        const railH = dockF.p.y - dockGY; // 0.60 on the stock layout
        // THE FISSURE IS SKEWED 45° TO THE CHANNEL. It has to be: the bell's
        // arches face along the channel (that is how the boat gets in), so a
        // fissure running square across the channel can only ever be looked into
        // from a direction in which the bell shows its blank side. At 45° a
        // camera on the open arm looks down the fissure AND 45° into the arch, so
        // the boat and its riders are visible in the bell at the bottom of the
        // stage. The lock house stays square to the channel, so the two live in
        // SEPARATE frames sharing one origin.
        const riftYaw = dockYaw - Math.PI / 4;
        const cosY = Math.cos(riftYaw);
        const sinY = Math.sin(riftYaw);
        /** world (x, z) → the trench's local (across, along) coordinates */
        const riftLocal = (x: number, z: number): [number, number] => {
          const dx = x - dockF.p.x;
          const dz = z - dockF.p.z;
          return [dx * cosY - dz * sinY, dx * sinY + dz * cosY];
        };
        // a park needs this: the fissure is the ONE thing on the ride that goes
        // BELOW the ground datum (it needs 4.35 units of depth under a channel
        // that sits only 0.60 above the ground), so a composition that wants the
        // trench to read must depress its terrain over this rect — the same
        // contract a coaster tunnel has with its hill.
        g.userData.riftRect = { cx: dockF.p.x, cz: dockF.p.z, hx: (RIFT_HX + RIFT_LIP_OUT) / 2, hz: riftHZ(RIFT_LIP_OUT), yaw: riftYaw, depth: RIFT_DEPTH };
        const inRift = (x: number, z: number, pad = 0) => {
          const [lx, lz] = riftLocal(x, z);
          return lx > -(RIFT_HX + pad) && lx < RIFT_LIP_OUT + pad && Math.abs(lz) < riftHZ(lx) + pad;
        };

        // ---- 2b. THE MOON POOL: the opening the bell descends through ----
        //
        // THE COMPLAINT THIS FIXES: "when the bell goes down the track
        // containing the ride is still there, so it looks like the bell clips
        // through the track." It did. The kit sweeps ONE continuous trough and
        // the old answer was to HIDE the offending span behind the lock house's
        // roof and walls — but hiding it does not stop the cradle pan, the boat
        // and the riders passing bodily through a wooden floor, its ribs and a
        // trestle bent, and from any camera low enough to see under the house
        // that is exactly what you saw.
        //
        // A real diving bell goes down through an OPENING, so this one does
        // too. The trough is CUT — a genuine moon pool 2.92 units long and 2.8
        // wide, big enough for the whole bell (the shell is 2.5 across, its
        // lifting yoke 2.44 and its arch lintels reach z ±1.26), framed by
        // authored ironwork: a head casting closing each cut end of the wooden
        // channel, a raised kerb along the two long sides, transverse head
        // beams hung off the lock house's own plate girders where the trestle
        // used to stand, a plated throat lining the top of the fissure, and two
        // guide rails running from the headgear right down to the trench floor.
        //
        // WHY NOT DOORS, AND WHY NOT FADE THE SPAN. Doors were the tempting
        // answer — a pair of trough-floor leaves parting as the bell arrives —
        // but the bell is 2.5 across and the channel only 1.0, so no leaf that
        // opens within the trough can ever let the bell through; a door big
        // enough is a door the size of the whole dock, which is a moon pool
        // with extra steps. Fading the span was cheaper still and reads as a
        // bug. The pool needs no door anyway, because THE CRADLE PAN IS THE
        // PLUG: 2.72 long against the pool's 2.92, so it seats with a 0.10
        // joint at each end, the channel reads continuous when the hoist is up,
        // and the water it carries is the water in the channel.
        const POOL_HX = 1.40; // half-width across the channel (bell 1.25 + 0.15)
        const POOL_HZ = PAN_HZ + 0.1; // half-length: the pan plus its seating joint
        const cosD = Math.cos(dockYaw);
        const sinD = Math.sin(dockYaw);
        /** world (x, y, z) → the DOCK's local frame (x across the channel, z
         *  along it, y = 0 at the channel rail) */
        const dockLocal = (x: number, y: number, z: number): [number, number, number] => {
          const dx = x - dockF.p.x;
          const dz = z - dockF.p.z;
          return [dx * cosD - dz * sinD, y - dockF.p.y, dx * sinD + dz * cosD];
        };
        // The cut window is WIDER than the pool itself (1.62 vs 1.40) because it
        // has to take the trestle bent as well: `addSplineSupports` foots its
        // splayed legs 0.67 out from the centreline, and a bent standing in the
        // mouth of the fissure — on ground the fissure does not have — was its
        // own bug. What carries the trough here instead is the lock house.
        const cutStat = cutOpening(t, ride.group, (x, y, z) => {
          const [lx, ly, lz] = dockLocal(x, y, z);
          return Math.abs(lx) < 1.62 && Math.abs(lz) < POOL_HZ && ly > -1.45 && ly < 0.9;
        });
        g.userData.moonPool = { hx: POOL_HX, hz: POOL_HZ, cut: cutStat };

        // ---- 3. THE REEF LEDGE: the ride brings its own ground -----------
        // Tidewater Hollow's other two attractions stand in open lagoon; Deep
        // Drift stands on the COVE'S ROCK LEDGE — a wet, awash rock platform
        // with tide pools in it, because a fissure 4.35 units deep has to be
        // cut in something, and because WaterTile's sheet is ~80% opaque: a
        // trench under open water would have hidden the bell completely.
        const PAD = 4.8;
        const ledgeR = (x: number, z: number) => {
          const dx = (x - cen.x) / ((x1 - x0) / 2 + PAD);
          const dz = (z - cen.z) / ((z1 - z0) / 2 + PAD);
          const az = Math.atan2(dz, dx);
          const wob = 1 + 0.07 * Math.sin(az * 3 + 0.7) + 0.04 * Math.sin(az * 5 - 1.9) + 0.02 * Math.sin(az * 9 + 0.3);
          return Math.hypot(dx, dz) / wob;
        };
        // THE TIDE POOLS ARE CHOSEN FIRST, because the ledge has to be cleared
        // for them: the first pass laid the plate lattice over the whole ledge
        // and every pool sat UNDER it — a 0.03 water sheet cannot be seen
        // through a 0.08 rock plate, and all five pools were simply invisible.
        const poolList: [number, number, number][] = [];
        {
          const cand: [number, number, number][] = [
            [cen.x - 1.6, cen.z + 1.0, 2.3],
            [cen.x + 3.1, cen.z - 3.6, 1.5],
            [cen.x - 5.6, cen.z - 4.4, 1.35],
            [cen.x + 0.4, cen.z + 4.8, 1.7],
            [cen.x - 6.8, cen.z + 3.6, 1.2],
            [cen.x + 5.4, cen.z + 2.2, 1.3],
          ];
          cand.forEach(([px, pz, pr]) => {
            if (distToTrack(px, pz) < pr + 0.8) return;
            if (ledgeR(px, pz) > 0.94) return;
            const [lx, lz] = riftLocal(px, pz);
            if (Math.abs(lx) < RIFT_HX + pr + 0.6 && Math.abs(lz) < RIFT_HZ + pr + 0.6) return;
            poolList.push([px, pz, pr]);
          });
        }
        /** > 0 inside a tide pool basin (the plate lattice is cut out of it) */
        const inPool = (x: number, z: number, pad = 0) => {
          for (const [px, pz, pr] of poolList) if (Math.hypot(px - x, pz - z) < pr + pad) return true;
          return false;
        };
        {
          const STEP = 1.1;
          const wet: MergedBoxSpec[] = [];
          const dry: MergedBoxSpec[] = [];
          const dry2: MergedBoxSpec[] = [];
          const shelf: MergedBoxSpec[] = [];
          const sand: MergedBoxSpec[] = [];
          const sand2: MergedBoxSpec[] = [];
          for (let x = x0 - PAD; x <= x1 + PAD; x += STEP)
            for (let z = z0 - PAD; z <= z1 + PAD; z += STEP) {
              if (inRift(x, z, 0.78)) continue; // never pave over the fissure — 0.78
              // of clearance, because a 1.6-wide plate centred 0.42 out still
              // overhung the hole by a third of its width
              if (inPool(x, z, -0.34)) continue; // nor over a pool
              const h1 = hash01(x * 1.7 + z * 3.1);
              const h2 = hash01(x * 5.3 + z * 0.9);
              const h3 = hash01(x * 2.3 + z * 6.7);
              const gy = groundAt(x, z);
              const r = ledgeR(x, z);
              if (r > 1.12) continue; // past the ledge: open sea, nothing to stand on
              // plates rotated hard and sized unevenly, or the lattice reads as
              // a paved courtyard from the DS camera
              const spec: MergedBoxSpec = {
                dims: [STEP + 0.5 + h3 * 0.24, 0.09, STEP + 0.5 + h1 * 0.24],
                pos: [x, gy + 0.02 + h2 * 0.01, z],
                rotY: (h1 - 0.5) * 0.6,
                repeat: [2, 2],
              };
              if (r > 0.98 || inPool(x, z, 0.5)) {
                spec.pos = [x, gy - 0.03 - h2 * 0.01, z];
                wet.push(spec);
              } else if (h3 > 0.72) {
                shelf.push({ ...spec, pos: [x, gy + 0.08 + h2 * 0.02, z] });
              } else if (h1 > 0.66) {
                // SAND caught in the rock — the pale patches that stop the
                // apron reading as one grey mass, and the tie to Reef Racer's
                // coral-sand beach on the other side of the cove
                (h2 > 0.5 ? sand : sand2).push(spec);
              } else {
                (h3 > 0.34 ? dry : dry2).push(spec);
              }
            }
          const opt = { tex: 'concrete' as const, rough: 0.96, bump: 0.06, flat: true };
          const wm = mergedBoxes(t, wet, LEDGE_WET, opt);
          wm.castShadow = false;
          g.add(wm);
          g.add(mergedBoxes(t, dry, LEDGE_DRY, opt));
          g.add(mergedBoxes(t, dry2, LEDGE_WET, opt));
          g.add(mergedBoxes(t, shelf, LEDGE_DRY, opt));
          const sOpt = { tex: 'sand' as const, rough: 1, bump: 0.05, flat: true };
          const sm1 = mergedBoxes(t, sand, SAND_DRY, sOpt);
          sm1.castShadow = false;
          g.add(sm1);
          const sm2 = mergedBoxes(t, sand2, SAND_WET, sOpt);
          sm2.castShadow = false;
          g.add(sm2);
          // rubble + shell litter, so the plate lattice never draws a straight
          // edge the camera can find
          const litter: MergedBoxSpec[] = [];
          for (let k = 0; k < 240; k += 1) {
            const h1 = hash01(k * 1.7 + 11);
            const h2 = hash01(k * 3.9 + 29);
            const h3 = hash01(k * 6.3 + 47);
            const ang = h1 * Math.PI * 2;
            const rr = 0.24 + 0.86 * h2;
            const cx = cen.x + Math.cos(ang) * ((x1 - x0) / 2 + PAD) * rr;
            const cz = cen.z + Math.sin(ang) * ((z1 - z0) / 2 + PAD) * rr;
            if (inRift(cx, cz, 0.3) || distToTrack(cx, cz) < 0.9) continue;
            const sz = 0.08 + h3 * 0.15;
            litter.push({
              dims: [sz, 0.04 + h1 * 0.03, sz * (0.6 + h2 * 0.7)],
              pos: [cx, groundAt(cx, cz) + 0.07, cz],
              rotY: h2 * 3.1,
              rotZ: (h3 - 0.5) * 0.4,
            });
          }
          const lm = mergedBoxes(t, litter, 0xbfb7a4, { tex: 'concrete', rough: 0.95, bump: 0.05, flat: true });
          lm.userData.lodDetail = true;
          g.add(lm);
        }

        // ---- 4. TIDE POOLS: WaterTile, used exactly as it comes ----------
        // amp 0.12 × waviness 0.3 ≈ 0.010 of swell — what a rock pool does
        // between waves — with a shallow depth skirt so a side-on view reads a
        // volume of water. The palette is WaterTile's own retuned desaturated
        // blue-grey; nothing here re-saturates it.
        const pools: { update: (time: number) => void }[] = [];
        {
          poolList.forEach(([px, pz, pr], i) => {
            const gy = groundAt(px, pz);
            // the pale wet-rock basin FLOOR — a light bottom is what makes
            // shallow water read as shallow (TidePool's rule)
            const floor = cyl(t, pr + 0.16, pr + 0.16, 0.12, 0x8b8478, [px, gy - 0.1, pz], {
              tex: 'concrete',
              repeat: [4, 1],
              rough: 0.95,
              bump: 0.05,
              seg: 24,
            });
            floor.castShadow = false;
            g.add(floor);
            const pool = buildWater(t, pr * 2.08, 72, pr, 0.14, 0.12, 0.3);
            pool.mesh.position.set(px, gy + 0.0, pz);
            g.add(pool.mesh);
            pools.push(pool);
            // a wet, slick rim the water laps over, plus rocks standing in it
            const rim: MergedBoxSpec[] = [];
            for (let k = 0; k < 13; k += 1) {
              const a = (k / 13) * Math.PI * 2 + hash01(i * 3.1 + k) * 0.5;
              const rr = pr * (0.93 + 0.16 * hash01(i * 5.7 + k * 2.3));
              const s = pr * (0.3 + 0.24 * hash01(i * 7.9 + k));
              rim.push({ dims: [s, 0.1 + 0.07 * hash01(k + i), s * 0.8], pos: [px + Math.cos(a) * rr, gy + 0.06, pz + Math.sin(a) * rr], rotY: a });
            }
            g.add(mergedBoxes(t, rim, LEDGE_WET, { tex: 'concrete', rough: 0.7, bump: 0.06, flat: true }));
            for (let k = 0; k < 3; k += 1) {
              const a = hash01(i * 9.1 + k * 4.3) * Math.PI * 2;
              const rr = pr * 0.5 * hash01(i * 2.7 + k);
              const rk = buildRock(t, { scale: pr * (0.18 + 0.12 * hash01(k + i * 3)), seed: 700 + i * 11 + k, tint: LEDGE_WET });
              rk.position.set(px + Math.cos(a) * rr, gy - 0.02, pz + Math.sin(a) * rr);
              g.add(rk);
            }
            // kelp round the pool
            for (let k = 0; k < 4; k += 1) {
              const a = hash01(i * 6.7 + k * 3.7) * Math.PI * 2;
              const rr = pr * (1.02 + 0.2 * hash01(i + k));
              const kx = px + Math.cos(a) * rr;
              const kz = pz + Math.sin(a) * rr;
              if (distToTrack(kx, kz) < 0.85) continue;
              const kelp = kelpClump(t, 300 + i * 13 + k, 0.5 + 0.3 * hash01(k * 2.9 + i));
              kelp.position.set(kx, groundAt(kx, kz) + 0.05, kz);
              g.add(kelp);
            }
          });
        }

        // ---- 4b. WHAT STANDS ON THE LEDGE -------------------------------
        // A plate lattice on its own reads as a quarry floor whatever you do to
        // the plate sizes: the ledge needs things STANDING on it. Rock knuckles,
        // kelp, bleached driftwood, mooring bollards and the odd staved cask,
        // hashed over the whole apron and kept 1.0 clear of the channel, out of
        // the fissure and out of the pools.
        {
          const casks: MergedBoxSpec[] = [];
          const bollards: MergedBoxSpec[] = [];
          for (let k = 0; k < 78; k += 1) {
            const h1 = hash01(k * 2.1 + 301);
            const h2 = hash01(k * 4.7 + 317);
            const h3 = hash01(k * 8.3 + 331);
            const ang = h1 * Math.PI * 2 + k * 0.41;
            const rr = 0.2 + 0.88 * h2;
            const cx = cen.x + Math.cos(ang) * ((x1 - x0) / 2 + PAD) * rr;
            const cz = cen.z + Math.sin(ang) * ((z1 - z0) / 2 + PAD) * rr;
            if (ledgeR(cx, cz) > 1.06) continue;
            if (inRift(cx, cz, 0.7) || inPool(cx, cz, 0.35) || distToTrack(cx, cz) < 1.0) continue;
            const gy = groundAt(cx, cz);
            if (h3 < 0.44) {
              // a rock knuckle, mostly buried
              const rk = buildRock(t, {
                scale: 0.3 + h1 * 0.75,
                seed: 2200 + k * 7,
                tint: h2 > 0.5 ? LEDGE_DRY : LEDGE_WET,
              });
              rk.position.set(cx, gy - 0.16 - h2 * 0.1, cz);
              if (h1 < 0.4) rk.userData.lodDetail = true;
              g.add(rk);
            } else if (h3 < 0.68) {
              const kelp = kelpClump(t, 2400 + k * 11, 0.5 + 0.45 * h1);
              kelp.position.set(cx, gy + 0.05, cz);
              g.add(kelp);
            } else if (h3 < 0.84) {
              // bleached driftwood, half-drifted into the rock
              const a2 = ang + 1.1;
              const L = 0.7 + h1 * 1.1;
              const a = new t.Vector3(cx - Math.cos(a2) * L, gy + 0.1, cz - Math.sin(a2) * L);
              const b = new t.Vector3(cx + Math.cos(a2) * L, gy + 0.08 + h2 * 0.22, cz + Math.sin(a2) * L);
              g.add(spar(t, a, b, 0.13 + h2 * 0.06, 0.08, 0xa79a80));
            } else if (h3 < 0.93) {
              casks.push({
                dims: [0.36 + h1 * 0.1, 0.4, 0.36 + h1 * 0.1],
                pos: [cx, gy + 0.2, cz],
                rotY: h2 * 3.1,
                rotZ: h1 > 0.6 ? 1.45 : 0,
                repeat: [2, 1],
              });
            } else {
              // a mooring bollard with a rope turn — the cove is worked, not wild
              bollards.push({ dims: [0.22, 0.62, 0.22], pos: [cx, gy + 0.29, cz], rotY: h1 * 0.6, repeat: [1, 2] });
              bollards.push({ dims: [0.3, 0.1, 0.3], pos: [cx, gy + 0.6, cz], rotY: h1 * 0.6 });
            }
          }
          g.add(mergedBoxes(t, casks, TIMBER_D, { tex: 'wood', rough: 0.94, bump: 0.04 }));
          g.add(mergedBoxes(t, bollards, IRON, { tex: 'metal', metal: 0.4, rough: 0.8, bump: 0.04 }));
        }

        // ---- 5. THE CHANNEL WATER: one ribbon, with a real GAP at the dock
        // The bell's cradle pan carries its own water, so the ribbon STOPS at
        // the pan and picks up on the far side — as one open ribbon walked
        // from the far lip right round to the near one, so the wave field is
        // still continuous everywhere the boat can see it.
        const PAN_HALF = POOL_HZ / total; // the ribbon stops at the pool's edge
        const RIBBON_N = 300;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        for (let k = 0; k <= RIBBON_N; k += 1) {
          const u = bellU + PAN_HALF + (k / RIBBON_N) * (1 - 2 * PAN_HALF);
          const f = ride.frameAt(u);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, 0.035), side: f.side.clone(), up: f.up.clone() });
        }
        const chanWater = buildWaterRibbon(t, ribbonPts, 0.72, { amp: 0.14, waviness: 0.5 });
        g.add(chanWater.mesh);

        const lampMats: THREE.MeshStandardMaterial[] = [];
        const bioMats: THREE.MeshStandardMaterial[] = [];
        const jellies: { grp: THREE.Group; y0: number; ph: number }[] = [];

        // ---- 6. THE SEA CAVES (ACT 1) -----------------------------------
        // Rock walls close in on the channel and a roof comes over it: arches
        // the boat ducks under, then a long collapsed span. Every underside is
        // held at CAVE_CLEAR above the rail (the boat's carved prow tops out
        // 0.67 above its own rail, a rider's head about 0.80) and every
        // stalactite is cut off 0.45 higher again.
        const CAVE_CLEAR = 1.62;
        const DRIP_CLEAR = 1.24;
        /** roof + walls over the channel between two loop parameters */
        const caveSpan = (ua: number, ub: number, seed: number, opts2: { roof?: boolean; height?: number } = {}) => {
          const roofOn = opts2.roof ?? true;
          const H = opts2.height ?? CAVE_CLEAR;
          const N = Math.max(3, Math.round((ub - ua) * total * 1.6));
          const slab: MergedBoxSpec[] = [];
          const drip: MergedBoxSpec[] = [];
          for (let i = 0; i <= N; i += 1) {
            const u = ua + ((ub - ua) * i) / N;
            const f = ride.frameAt(u);
            const h1 = hash01(seed * 3.7 + i * 5.3);
            const h2 = hash01(seed * 1.9 + i * 7.1);
            const basis = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
            // THE CAVE IS AN OVERHANG, NOT A TUBE, and this is the difference
            // between a shot and no shot. A roof carried on rock BOTH sides
            // encloses the channel completely, and a covered channel can only be
            // looked into from within a few degrees of its own axis — every
            // camera outside that read as a pile of boulders. So the rock stands
            // on the OUTBOARD side only and the roof cantilevers over the water
            // from it, leaving the inboard side open to the sky: the boats run
            // under a ledge of rock, and a normal DS camera from inside the loop
            // looks straight in under it.
            const so = outSign(f);
            if (roofOn) {
              // the roof: a thick slab, offset OUTBOARD, hashed in height,
              // thickness AND YAW — a row of axis-aligned slabs read as stacked
              // concrete lintels, and the yaw is what breaks the row
              const p = f.p.clone().addScaledVector(f.up, H + 0.36 + h1 * 0.22).addScaledVector(f.side, so * 0.62);
              const mm = basis.clone().multiply(new t.Matrix4().makeRotationY((h2 - 0.5) * 0.5));
              mm.setPosition(p);
              slab.push({ dims: [2.7 + h2 * 0.8, 0.6 + h1 * 0.4, (ub - ua) * total / N + 0.5], matrix: mm, repeat: [3, 1] });
              // BOULDERS piled over the slab: what the camera sees from above is
              // a rock mass, never the flat top of a merged box
              if (i % 2 === 0)
                for (const sx of [0, 1, 2] as const) {
                  const rk = buildRock(t, {
                    scale: 0.8 + 0.6 * hash01(seed * 6.1 + i * 3.7 + sx * 2),
                    seed: 1500 + seed * 23 + i * 11 + sx,
                    tint: hash01(seed + i + sx) > 0.5 ? CAVE_ROCK : CAVE_ROCK_D,
                  });
                  rk.position
                    .copy(f.p)
                    .addScaledVector(f.up, H + 0.86 + 0.3 * hash01(i + sx))
                    .addScaledVector(f.side, so * (0.2 + sx * (0.85 + 0.3 * hash01(seed + sx))));
                  g.add(rk);
                }
              // stalactites hanging off it, cut off well clear of the boat
              if (h2 > 0.42) {
                const len = 0.12 + h1 * 0.24;
                const dp = f.p
                  .clone()
                  .addScaledVector(f.up, H + 0.06 - len / 2 + 0.06)
                  .addScaledVector(f.side, so * (h1 * 1.4 - 0.35));
                if (H + 0.06 - len > DRIP_CLEAR - 0.02) {
                  const md = basis.clone();
                  md.setPosition(dp);
                  drip.push({ dims: [0.08 + h2 * 0.06, len, 0.08 + h1 * 0.05], matrix: md });
                }
              }
            }
            // the walls: rock standing on the OUTBOARD side, kept out of the
            // envelope; the inboard flank keeps a low fringe only
            for (const s of [so, -so] as const) {
              const off = 1.35 + 0.3 * hash01(seed * 2.3 + i * 3.1 + s);
              const px = f.p.x + f.side.x * s * off;
              const pz = f.p.z + f.side.z * s * off;
              if (i % 2 === 0) {
                const inboard = s !== so;
                const rk = buildRock(t, {
                  // inboard: LOW knuckles only (0.34-0.6), so the camera can see
                  // in over them; outboard: the full cave wall
                  scale: inboard ? 0.34 + 0.26 * hash01(seed + i * 4.1) : 0.75 + 0.55 * hash01(seed + i * 2.7 + s * 5),
                  seed: 900 + seed * 31 + i * 7 + (s > 0 ? 3 : 0),
                  tint: hash01(seed + i) > 0.5 ? CAVE_ROCK : CAVE_ROCK_D,
                });
                rk.position.set(px, groundAt(px, pz) - (inboard ? 0.06 : 0.12), pz);
                if (inboard) rk.userData.lodDetail = true;
                g.add(rk);
              }
              // bioluminescent crust low on the cave walls — the FIRST hint of
              // what waits in the trench, and the reason act 2 is not a
              // non-sequitur
              if (roofOn && hash01(seed * 5.9 + i * 4.7 + s) > 0.62) {
                const patch = bioPatch(t, seed * 17 + i * 3 + s, 0.5 + 0.4 * hash01(i + s), bioMats);
                patch.position.set(f.p.x + f.side.x * s * 1.12, f.p.y + 0.42 + 0.5 * hash01(i * 2.1 + s), f.p.z + f.side.z * s * 1.12);
                patch.rotation.set(Math.PI / 2, yawOf(f) + (s > 0 ? 0 : Math.PI), 0, 'YXZ');
                g.add(patch);
              }
            }
          }
          if (slab.length) {
            const roof = mergedBoxes(t, slab, CAVE_ROCK, { tex: 'concrete', rough: 0.97, bump: 0.09, flat: true });
            g.add(roof);
          }
          if (drip.length) {
            const dm = mergedBoxes(t, drip, CAVE_ROCK_D, { tex: 'concrete', rough: 0.97, bump: 0.08, flat: true });
            dm.userData.lodDetail = true;
            g.add(dm);
          }
        };

        /** a free-standing ARCH the boat ducks under: two rock piers and a
         *  spanning lintel of stacked rock, no enclosed roof */
        const caveArch = (u: number, seed: number) => {
          const f = ride.frameAt(u);
          const basis = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
          const h1 = hash01(seed * 2.9);
          const specs: MergedBoxSpec[] = [];
          // the spanning lintel: three stacked slabs, each narrower than the last
          for (let k = 0; k < 3; k += 1) {
            const m = basis.clone().multiply(new t.Matrix4().makeRotationY((hash01(seed * 7.3 + k) - 0.5) * 0.6));
            m.setPosition(f.p.clone().addScaledVector(f.up, CAVE_CLEAR + 0.3 + k * 0.42).addScaledVector(f.side, (hash01(seed + k) - 0.5) * 0.3));
            specs.push({ dims: [3.3 - k * 0.5, 0.44 + h1 * 0.16, 1.5 - k * 0.3], matrix: m, repeat: [3, 1] });
          }
          g.add(mergedBoxes(t, specs, CAVE_ROCK, { tex: 'concrete', rough: 0.97, bump: 0.09, flat: true }));
          // boulders over the crown, so the arch reads as rock and not masonry
          for (let k = 0; k < 4; k += 1) {
            const rk = buildRock(t, { scale: 0.7 + 0.5 * hash01(seed * 9.7 + k), seed: 1700 + seed * 13 + k, tint: k % 2 ? CAVE_ROCK : CAVE_ROCK_D });
            rk.position
              .copy(f.p)
              .addScaledVector(f.up, CAVE_CLEAR + 1.42 + 0.3 * hash01(seed + k))
              .addScaledVector(f.side, (hash01(seed * 2.1 + k) - 0.5) * 2.2)
              .addScaledVector(f.fwd, (hash01(seed * 4.3 + k) - 0.5) * 1.1);
            g.add(rk);
          }
          // the piers
          const so = outSign(f);
          for (const s of [-1, 1] as const) {
            for (let k = 0; k < 3; k += 1) {
              const off = 1.32 + 0.26 * hash01(seed * 3.3 + k + s);
              const along = (k - 1) * 0.62;
              const px = f.p.x + f.side.x * s * off + f.fwd.x * along;
              const pz = f.p.z + f.side.z * s * off + f.fwd.z * along;
              const rk = buildRock(t, {
                scale: (s === so ? 0.85 : 0.6) + 0.5 * hash01(seed + k * 3.1 + s * 7),
                seed: 1200 + seed * 17 + k * 5 + (s > 0 ? 2 : 0),
                tint: k % 2 ? CAVE_ROCK : CAVE_ROCK_D,
              });
              rk.position.set(px, groundAt(px, pz) - 0.1 + k * (s === so ? 0.28 : 0.16), pz);
              g.add(rk);
            }
          }
          // weed hanging off the arch, and a couple of jellies under it
          const fringe: MergedBoxSpec[] = [];
          for (let k = 0; k < 7; k += 1) {
            const hk = hash01(seed * 4.1 + k * 2.7);
            const a = f.p
              .clone()
              .addScaledVector(f.up, CAVE_CLEAR + 0.1)
              .addScaledVector(f.side, (hk - 0.5) * 2.4)
              .addScaledVector(f.fwd, (hash01(seed + k) - 0.5) * 0.9);
            fringe.push(bladeSpec(t, a, a.clone().add(new t.Vector3((hk - 0.5) * 0.1, -0.12 - hk * 0.16, 0)), 0.1, 0.02));
          }
          const fm = mergedBoxes(t, fringe, WEED_D, { tex: 'fabric', rough: 0.95 });
          fm.userData.lodDetail = true;
          g.add(fm);
        };

        // Act 1 runs from the station to the dock. Lay the arches and the long
        // collapsed span along it, always on a stretch clear of the station.
        {
          const a0 = 4.6 / total;
          const a1 = bellU - 3.4 / total;
          if (a1 > a0 + 0.06) {
            const span = a1 - a0;
            caveArch(a0 + span * 0.1, 3);
            caveSpan(a0 + span * 0.26, a0 + span * 0.62, 7); // THE LONG CAVE
            caveArch(a0 + span * 0.78, 11);
            caveSpan(a0 + span * 0.9, a0 + span * 0.98, 13, { roof: false });
            // jellies hanging in the cave mouth
            for (let k = 0; k < 6; k += 1) {
              const u = a0 + span * (0.28 + 0.32 * hash01(k * 3.7));
              const f = ride.frameAt(u);
              const s = k % 2 ? 1 : -1;
              const j = bioJelly(t, 40 + k * 5, 0.6 + 0.4 * hash01(k * 5.1), bioMats);
              j.position.copy(f.p).addScaledVector(f.up, 1.1 + 0.24 * hash01(k * 2.3)).addScaledVector(f.side, s * (0.62 + 0.3 * hash01(k)));
              g.add(j);
              jellies.push({ grp: j, y0: j.position.y, ph: k * 1.7 });
            }
          }
        }

        // ---- 7. THE TRENCH (ACT 2) --------------------------------------
        // A fissure across the ledge, dressed in the trench's own frame so the
        // lock house, the hoist and the walls are all placed off ONE pose.
        const rift = new t.Group();
        rift.position.set(dockF.p.x, dockF.p.y, dockF.p.z); // local y = 0 is the RAIL
        rift.rotation.y = riftYaw; // the fissure, skewed 45° off the channel
        g.add(rift);
        /** the LOCK HOUSE's frame: same origin, square to the channel */
        const dockGrp = new t.Group();
        dockGrp.position.copy(rift.position);
        dockGrp.rotation.y = dockYaw;
        g.add(dockGrp);
        const bioLightA = new t.PointLight(BIO, 0, 8.4, 2);
        const bioLightB = new t.PointLight(BIO, 0, 7.2, 2);
        {
          const LEDGE = -railH; // local y of the ledge surface
          const FLOOR = LEDGE - RIFT_DEPTH;
          // ---- THE SHAFT: a clear cylinder nothing in the trench may stand in.
          // The bell's widest point is its barnacle crust at 1.25 and its guide
          // shoes reach 1.54; 1.72 leaves the fattest thing on it 0.18 of air.
          // The bulge in `riftHZ` already opens the mouth to 2.15, so on the
          // stock layout this guard is a BACKSTOP — but it is the thing that
          // makes the clearance a fact rather than an intention, and it keeps
          // holding if someone retunes the bulge.
          const SHAFT_R = 1.72;
          const SHAFT_Y0 = LEDGE - RIFT_DEPTH + 0.9; // below the pan's lowest point
          const SHAFT_Y1 = 0.5;
          /** push a wall/boulder placement radially clear of the shaft; the
           *  trench dressing all lives at ±z, so the push is in z */
          const clearShaft = (lx: number, y: number, halfY: number, halfR: number, lz: number) => {
            if (y + halfY < SHAFT_Y0 || y - halfY > SHAFT_Y1) return lz;
            const need = Math.sqrt(Math.max(0, (SHAFT_R + halfR) ** 2 - lx * lx));
            return Math.abs(lz) >= need ? lz : Math.sign(lz || 1) * need;
          };
          /** … and for the loose things (boulders, colonies, jellies) it is
           *  better to DROP the one that would intrude than to shove it off the
           *  wall it is supposed to be growing on */
          const intrudes = (lx: number, y: number, halfY: number, halfR: number, lz: number) =>
            clearShaft(lx, y, halfY, halfR, lz) !== lz;
          // ---- the walls: stacked rock courses stepping IN as they go down,
          // so the fissure narrows toward the bottom like a real one
          const walls: MergedBoxSpec[] = [];
          const COURSES = 9;
          /** the fissure floor: flat under the bell, ramping UP along the open
           *  seaward arm so the eye can walk down into it */
          const floorAt = (lx: number) => (lx <= 1.4 ? FLOOR : FLOOR + ((lx - 1.4) / (RIFT_LIP_OUT - 1.4)) ** 2.4 * (RIFT_DEPTH - 1.2));
          for (let c = 0; c < COURSES; c += 1) {
            const fy = c / (COURSES - 1);
            const yBase = LEDGE - 0.1 - fy * (RIFT_DEPTH - 0.5);
            // the two long walls, following the widening plan
            for (const s of [-1, 1] as const) {
              const N = 13;
              for (let i = 0; i < N; i += 1) {
                const h1 = hash01(c * 3.1 + i * 5.7 + (s > 0 ? 2.3 : 0));
                const h2 = hash01(c * 7.3 + i * 2.9 + (s > 0 ? 1.7 : 0));
                const lx = -(RIFT_HX + 0.55) + ((RIFT_HX + RIFT_LIP_OUT + 1.1) / (N - 1)) * i;
                if (yBase < floorAt(lx) - 0.1) continue; // no wall below the ramp
                const hz = riftHZ(lx) - fy * 0.3;
                const dims: [number, number, number] = [
                  (RIFT_HX + RIFT_LIP_OUT + 1.1) / (N - 1) + 0.44 + h1 * 0.3,
                  0.52 + h2 * 0.3,
                  0.5 + h1 * 0.35,
                ];
                const rotY = (h1 - 0.5) * 0.5;
                const wx = lx + (h1 - 0.5) * 0.3;
                const wy = yBase + (h2 - 0.5) * 0.14;
                // the block's own half-extent toward the shaft, rotation included
                const halfR = (dims[2] / 2) * Math.cos(rotY) + (dims[0] / 2) * Math.abs(Math.sin(rotY));
                walls.push({
                  dims,
                  pos: [wx, wy, clearShaft(wx, wy, dims[1] / 2 + 0.1, halfR, s * (hz + 0.22 + h2 * 0.16))],
                  rotY,
                  rotZ: (h2 - 0.5) * 0.18,
                  repeat: [2, 1],
                });
              }
            }
            // the LANDWARD end, closing the fissure off (the seaward end is open)
            for (let i = 0; i < 3; i += 1) {
              const h1 = hash01(c * 4.7 + i * 6.1);
              walls.push({
                dims: [0.7 + h1 * 0.4, 0.6 + h1 * 0.3, (riftHZ(-RIFT_HX) * 2) / 2.2 + 0.5],
                pos: [-(RIFT_HX + 0.5), yBase + (h1 - 0.5) * 0.16, -riftHZ(-RIFT_HX) + i * riftHZ(-RIFT_HX) + (h1 - 0.5) * 0.2],
                rotY: (h1 - 0.5) * 0.6,
                repeat: [2, 1],
              });
            }
          }
          rift.add(mergedBoxes(t, walls, CAVE_ROCK_D, { tex: 'concrete', rough: 0.97, bump: 0.1, flat: true }));
          // boulders jammed in the walls — nine stacked courses read as a
          // staircase without something faceted breaking them
          for (let k = 0; k < 21; k += 1) {
            const h1 = hash01(k * 4.1 + 201);
            const h2 = hash01(k * 6.7 + 213);
            const s2 = k % 2 ? 1 : -1;
            const wlx = -RIFT_HX * 0.8 + h1 * (RIFT_HX + RIFT_LIP_OUT) * 0.8;
            const wy = Math.max(floorAt(wlx) + 0.4, LEDGE - 0.4 - h2 * (RIFT_DEPTH - 1.0));
            const sc = 0.4 + 0.55 * h2;
            // buildRock's displaced hull reaches ~1.4 × its scale horizontally
            if (intrudes(wlx, wy, sc, sc * 1.4, s2 * (riftHZ(wlx) + 0.12))) continue;
            const rk = buildRock(t, { scale: sc, seed: 2600 + k * 9, tint: h1 > 0.5 ? CAVE_ROCK : CAVE_ROCK_D });
            rk.position.set(wlx, wy, s2 * (riftHZ(wlx) + 0.12));
            rift.add(rk);
          }
          // the floor: a flat bed under the bell plus the ramped seaward arm,
          // laid as a run of plates so it follows `floorAt`
          const bed: MergedBoxSpec[] = [];
          for (let i = 0; i < 14; i += 1) {
            const lx = -(RIFT_HX + 0.4) + i * ((RIFT_HX + RIFT_LIP_OUT + 0.8) / 13);
            const h1 = hash01(i * 3.7 + 61);
            bed.push({
              dims: [(RIFT_HX + RIFT_LIP_OUT + 0.8) / 13 + 0.6, 0.44, riftHZ(lx) * 2 + 0.7],
              pos: [lx, floorAt(lx) - 0.22 + (h1 - 0.5) * 0.08, 0],
              rotZ: (h1 - 0.5) * 0.06,
              repeat: [2, 3],
            });
          }
          const bedMesh = mergedBoxes(t, bed, 0x413b35, { tex: 'concrete', rough: 0.98, bump: 0.1, flat: true });
          rift.add(bedMesh);
          const rubble: MergedBoxSpec[] = [];
          for (let k = 0; k < 22; k += 1) {
            const h1 = hash01(k * 2.3 + 5);
            const h2 = hash01(k * 5.9 + 13);
            const s = 0.24 + h1 * 0.42;
            rubble.push({
              dims: [s, s * (0.4 + h2 * 0.4), s * (0.6 + h1 * 0.6)],
              pos: [(h1 - 0.5) * RIFT_HX * 1.9, floorAt((h1 - 0.5) * RIFT_HX * 1.9) + 0.1 + h2 * 0.16, (h2 - 0.5) * RIFT_HZ * 1.4],
              rotY: h1 * 3.1,
              rotZ: (h2 - 0.5) * 0.3,
              repeat: [2, 1],
            });
          }
          rift.add(mergedBoxes(t, rubble, CAVE_ROCK_D, { tex: 'concrete', rough: 0.97, bump: 0.09, flat: true }));
          // ---- THE LIFE. This is the point of the trench: anemone clusters
          // and polyp patches all down both walls, jellies hanging in the
          // middle, and the floor crusted with them.
          for (let k = 0; k < 33; k += 1) {
            const h1 = hash01(k * 3.7 + 21);
            const h2 = hash01(k * 6.1 + 37);
            const h3 = hash01(k * 8.9 + 53);
            const s = k % 2 ? 1 : -1;
            const lx = -RIFT_HX * 0.9 + h1 * (RIFT_HX + RIFT_LIP_OUT) * 0.85;
            const ly = Math.max(floorAt(lx) + 0.3, LEDGE - 0.5 - h2 * (RIFT_DEPTH - 1.1));
            const lz = s * (riftHZ(lx) - 0.06);
            if (Math.abs(lx) < 1.5 && ly > LEDGE - 1.2) continue; // keep the bell's path clear
            if (intrudes(lx, ly, 0.6, 0.5, lz)) continue; // …and clear all the way down it
            if (h3 > 0.45) {
              const an = bioAnemones(t, 60 + k * 7, 0.7 + 0.5 * h3, bioMats);
              an.position.set(lx, ly, lz);
              an.rotation.set(-s * Math.PI * 0.5, 0, 0);
              rift.add(an);
            } else {
              const pt = bioPatch(t, 90 + k * 11, 0.8 + 0.7 * h1, bioMats);
              pt.position.set(lx, ly, lz);
              pt.rotation.set(s * Math.PI * 0.5, 0, 0);
              rift.add(pt);
            }
          }
          for (let k = 0; k < 13; k += 1) {
            const h1 = hash01(k * 4.3 + 71);
            const h2 = hash01(k * 7.7 + 89);
            const an = bioAnemones(t, 140 + k * 9, 0.8 + 0.6 * h2, bioMats);
            const alx = (h1 - 0.5) * RIFT_HX * 1.9;
            an.position.set(alx, floorAt(alx) + 0.14, (h2 - 0.5) * RIFT_HZ * 1.3);
            rift.add(an);
          }
          for (let k = 0; k < 13; k += 1) {
            const h1 = hash01(k * 5.3 + 101);
            const h2 = hash01(k * 2.7 + 113);
            const lx = (h1 - 0.5) * RIFT_HX * 1.85;
            if (Math.abs(lx) < 1.45) continue;
            const jy = LEDGE - 0.9 - h2 * (RIFT_DEPTH - 2.0);
            const jz = (h1 - 0.5) * RIFT_HZ * 1.1;
            // jellies DRIFT ±0.18 on the clock, so the guard is given the swing
            if (intrudes(lx, jy, 1.1, 0.55, jz)) continue;
            const j = bioJelly(t, 170 + k * 13, 0.8 + 0.6 * h2, bioMats);
            j.position.set(lx, jy, jz);
            rift.add(j);
            jellies.push({ grp: j, y0: j.position.y, ph: 20 + k * 2.3 });
          }
          // weed and old rope over the lip, so the fissure is not a clean cut
          const lip: MergedBoxSpec[] = [];
          for (let k = 0; k < 28; k += 1) {
            const h1 = hash01(k * 2.9 + 131);
            const h2 = hash01(k * 6.7 + 149);
            const s = k % 2 ? 1 : -1;
            const wlx = -RIFT_HX + h1 * (RIFT_HX + RIFT_LIP_OUT);
            const a = new t.Vector3(wlx, LEDGE + 0.04, s * (riftHZ(wlx) + 0.1));
            lip.push(bladeSpec(t, a, a.clone().add(new t.Vector3((h2 - 0.5) * 0.12, -0.2 - h2 * 0.3, -s * 0.06)), 0.11, 0.022));
          }
          const lm2 = mergedBoxes(t, lip, WEED_D, { tex: 'fabric', rough: 0.95 });
          lm2.userData.lodDetail = true;
          rift.add(lm2);
          // THE LIP itself: a broken rock course all round the opening, filling
          // the band the plate lattice is held out of and giving the fissure a
          // raised, fractured edge instead of a cut line
          const lipRock: MergedBoxSpec[] = [];
          for (let i = 0; i < 17; i += 1) {
            const wlx = -(RIFT_HX + 0.5) + i * ((RIFT_HX + RIFT_LIP_OUT + 1.0) / 16);
            for (const s2 of [-1, 1] as const) {
              const h1 = hash01(i * 3.9 + (s2 > 0 ? 5.1 : 1.3));
              const h2 = hash01(i * 7.1 + (s2 > 0 ? 2.7 : 8.9));
              lipRock.push({
                dims: [0.8 + h1 * 0.5, 0.24 + h2 * 0.3, 0.66 + h2 * 0.4],
                pos: [wlx + (h1 - 0.5) * 0.3, LEDGE + 0.02 + h2 * 0.12, s2 * (riftHZ(wlx) + 0.5 + h1 * 0.2)],
                rotY: (h1 - 0.5) * 0.7,
                rotZ: s2 * (0.06 + h2 * 0.12),
                repeat: [2, 1],
              });
            }
          }
          // and across the landward end
          for (let i = 0; i < 4; i += 1) {
            const h1 = hash01(i * 5.3 + 44);
            lipRock.push({
              dims: [0.8 + h1 * 0.4, 0.3 + h1 * 0.24, 0.8],
              pos: [-(RIFT_HX + 0.5), LEDGE + 0.04 + h1 * 0.1, -1.2 + i * 0.8],
              rotY: h1 * 0.8,
              repeat: [2, 1],
            });
          }
          rift.add(mergedBoxes(t, lipRock, LEDGE_WET, { tex: 'concrete', rough: 0.96, bump: 0.08, flat: true }));
          // ---- THE THROAT: the lined mouth of the shaft ------------------
          // Riveted plate down the top 1.5 units of both fissure walls where
          // the bell passes, with a ring beam under the lip and a hoop strap
          // lower down. It follows the WALL (|lz| = riftHZ(lx) − 0.12), so it
          // costs the bell no clearance at all, and it is the thing that tells
          // the eye this hole was cut and lined on purpose rather than being a
          // crack the boat happens to be lowered into.
          {
            const throat: MergedBoxSpec[] = [];
            const NT = 11;
            const TX = 2.7;
            for (let i = 0; i < NT; i += 1) {
              const lx = -TX + (i * TX * 2) / (NT - 1);
              const w = (TX * 2) / (NT - 1) + 0.1;
              for (const s of [-1, 1] as const) {
                const lz = s * (riftHZ(lx) - 0.12);
                throat.push({ dims: [w, 1.5, 0.14], pos: [lx, LEDGE - 0.68, lz], repeat: [2, 3] });
                // vertical stiffener + a bolt strip on each panel joint
                throat.push({ dims: [0.12, 1.44, 0.2], pos: [lx - w / 2, LEDGE - 0.68, lz - s * 0.06] });
                // ring beam under the lip and a hoop strap lower down — laid as
                // segments so they follow the widening plan like everything else
                throat.push({ dims: [w, 0.18, 0.3], pos: [lx, LEDGE - 0.02, s * (riftHZ(lx) - 0.1)], repeat: [2, 1] });
                throat.push({ dims: [w, 0.12, 0.22], pos: [lx, LEDGE - 1.16, s * (riftHZ(lx) - 0.14)], repeat: [2, 1] });
              }
            }
            rift.add(mergedBoxes(t, throat, IRON, { tex: 'metal', metal: 0.5, rough: 0.72, bump: 0.05 }));
            // rivet lines along the lining's panel joints, and weed hanging off
            // the ring beam — iron that has been in seawater for thirty years
            const rv2: MergedBoxSpec[] = [];
            const wd2: MergedBoxSpec[] = [];
            for (let i = 0; i < NT; i += 1) {
              const lx = -TX + (i * TX * 2) / (NT - 1);
              for (const s of [-1, 1] as const) {
                const lz = s * (riftHZ(lx) - 0.16);
                for (let k = 0; k < 4; k += 1)
                  rv2.push({ dims: [0.05, 0.05, 0.05], pos: [lx - 0.22, LEDGE - 0.24 - k * 0.36, lz] });
                const h3 = hash01(i * 4.3 + (s > 0 ? 11 : 5));
                const a2 = new t.Vector3(lx + (h3 - 0.5) * 0.3, LEDGE - 0.1, lz);
                wd2.push(bladeSpec(t, a2, a2.clone().add(new t.Vector3(0, -0.28 - h3 * 0.34, -s * 0.05)), 0.1, 0.02));
              }
            }
            const rvm = mergedBoxes(t, rv2, RUST, { tex: 'metal', metal: 0.3, rough: 0.92 });
            rvm.userData.lodDetail = true;
            rift.add(rvm);
            const wdm = mergedBoxes(t, wd2, WEED_D, { tex: 'fabric', rough: 0.95 });
            wdm.userData.lodDetail = true;
            rift.add(wdm);
          }
          // the two real lights, hung in the fissure where the life is thickest
          bioLightA.position.set(-RIFT_HX * 0.55, LEDGE - 1.5, 0);
          bioLightB.position.set(RIFT_HX * 0.55, LEDGE - 2.6, 0);
          rift.add(bioLightA);
          rift.add(bioLightB);
        }

        // ---- 8. THE LOCK HOUSE + THE HOIST ------------------------------
        // The house is a roofed iron box straddling the fissure on two cross
        // girders, open at both ends where the channel runs through. It exists
        // for a reason beyond theming: the kit sweeps ONE continuous trough
        // over the whole loop, so the few units of trough that bridge the
        // fissure cannot be removed — the house HIDES them (roof against the
        // overhead view, walls against the flanks, a hanging portcullis at each
        // end against the low view down the channel), and what the camera sees
        // instead is the bell coming out of its underside into the trench.
        const HOUSE_HZ = 2.25; // half-length, along the channel
        const WALL_X = 1.5; // wall centreline (bell radius 1.16 + 0.34 of daylight)
        const FOOT_Y = 0.68; // the house stands this far clear of the ledge, on
        const PLATE_TOP = 1.72; // its girders — daylight under it, so the trench
        // stays visible from a normal camera; plated to PLATE_TOP, lattice above
        const ROOF_Y = 2.26;
        const bellPorts: THREE.MeshStandardMaterial[] = [];
        const bellLight = new t.PointLight(LAMP_GLOW, 0, 4.4, 2);
        const carriage = new t.Group();
        const cables: THREE.Mesh[] = [];
        let sheaves: [number, number, number][] = [];
        let eyes: [number, number, number][] = [];
        const stationLight = new t.PointLight(LAMP_GLOW, 0, 5.6, 2);
        {
          const LEDGE = -railH;
          const iron: MergedBoxSpec[] = [];
          // HOW THE HOUSE STANDS OVER THE FISSURE. The first pass slung two
          // lattice cross girders under it, and from the one camera angle that
          // can see into the trench they crossed the frame right in front of the
          // bell like a footbridge. There is a better answer, and it is the one a
          // real builder would use: THE WALLS ARE THE GIRDERS. Each riveted side
          // wall is a 4.5-unit plate girder with a heavy bottom flange, carried
          // on four masonry piers standing on solid ledge just beyond the skewed
          // fissure's lips — so nothing at all spans the opening the bell comes
          // down through.
          const PIER_Z = 2.9;
          for (const sx of [-1, 1] as const) {
            iron.push({ dims: [0.34, 0.2, PIER_Z * 2 + 0.4], pos: [sx * WALL_X, LEDGE + FOOT_Y - 0.08, 0], repeat: [1, 8] }); // bottom flange
            for (const sz of [-1, 1] as const) {
              iron.push({ dims: [0.66, FOOT_Y + 0.5, 0.7], pos: [sx * WALL_X, LEDGE + (FOOT_Y - 0.5) / 2, sz * PIER_Z], repeat: [2, 2] });
              iron.push({ dims: [0.8, 0.14, 0.84], pos: [sx * WALL_X, LEDGE + FOOT_Y - 0.2, sz * PIER_Z], repeat: [2, 2] }); // pier cap
            }
          }
          // a plank walkway out to the pump along the landward pier line
          for (let k = 0; k < 5; k += 1)
            iron.push({ dims: [0.5, 0.09, 0.44], pos: [-WALL_X - 0.4 - k * 0.52, LEDGE + FOOT_Y - 0.1, -PIER_Z + 0.1], rotY: hash01(k * 3.3) * 0.2, repeat: [2, 1] });
          // THE TWO SIDE WALLS. Riveted PLATE up to 1.72 and open LATTICE above
          // it: the plate is what hides the trough from the flanks (a 50°
          // sightline over a 1.72 wall top is cut by the roof's own 1.9 eaves),
          // and the lattice is what stops a 3-unit iron box from reading as a
          // windowless shed dropped on the reef.
          for (const s of [-1, 1] as const) {
            const foot = LEDGE + FOOT_Y;
            iron.push({ dims: [0.14, PLATE_TOP - foot, HOUSE_HZ * 2], pos: [s * WALL_X, (PLATE_TOP + foot) / 2, 0], repeat: [1, 6] });
            // vertical stiffeners on the plate + the two lattice chords
            for (let k = 0; k < 7; k += 1)
              iron.push({ dims: [0.2, PLATE_TOP - foot - 0.1, 0.13], pos: [s * (WALL_X + 0.12), (PLATE_TOP + foot) / 2, -HOUSE_HZ + 0.3 + k * ((HOUSE_HZ * 2 - 0.6) / 6)] });
            iron.push({ dims: [0.26, 0.14, HOUSE_HZ * 2], pos: [s * WALL_X, PLATE_TOP + 0.05, 0], repeat: [1, 7] });
            iron.push({ dims: [0.26, 0.14, HOUSE_HZ * 2], pos: [s * WALL_X, ROOF_Y - 0.1, 0], repeat: [1, 7] });
            for (let k = 0; k < 6; k += 1)
              iron.push({
                dims: [0.12, ROOF_Y - PLATE_TOP - 0.1, 0.12],
                pos: [s * WALL_X, (ROOF_Y + PLATE_TOP) / 2 - 0.02, -HOUSE_HZ + 0.4 + k * ((HOUSE_HZ * 2 - 0.8) / 5)],
                rotX: (k % 2 ? 1 : -1) * 0.72,
              });
          }
          // THE ROOF, AND THE HOIST WELL THROUGH IT. The first version was three
          // plated bays with a pair of 0.33-wide cable slots — and the bell's
          // domed crown is 2.32 across and rises to 3.06, its yoke 2.44, so all
          // of it stood straight THROUGH the roof plate whenever the hoist was
          // up (2 236 intersecting triangle pairs). Two 0.33 slots were never
          // going to be enough for a 2.5-unit bell: a headgear over a shaft has
          // an open WELL under its sheaves, so this one does — |x| ≤ 1.32,
          // |z| ≤ 1.34, kerbed all round. What the overhead view sees through it
          // is the bell's own crown filling it when the hoist is up, and the lit
          // shaft when it is down; either way, never a length of bare trough.
          const WELL_HX = 1.32;
          const WELL_HZ = 1.34;
          const ROOF_HX = WALL_X + 0.395; // 1.895, unchanged
          for (const s of [-1, 1] as const) {
            // the two side strips, full length
            iron.push({ dims: [ROOF_HX - WELL_HX, 0.16, HOUSE_HZ * 2], pos: [s * (ROOF_HX + WELL_HX) / 2, ROOF_Y, 0], repeat: [2, 7] });
            // the two end bays, between the strips
            iron.push({ dims: [WELL_HX * 2, 0.16, HOUSE_HZ - WELL_HZ], pos: [0, ROOF_Y, s * (HOUSE_HZ + WELL_HZ) / 2], repeat: [4, 2] });
            // the WELL KERB: an upstand round the opening, which is what makes
            // the hole read as an opening and not as a missing roof panel
            iron.push({ dims: [0.16, 0.22, WELL_HZ * 2 + 0.32], pos: [s * (WELL_HX + 0.08), ROOF_Y + 0.19, 0], repeat: [1, 5] });
            iron.push({ dims: [WELL_HX * 2 + 0.32, 0.22, 0.16], pos: [0, ROOF_Y + 0.19, s * (WELL_HZ + 0.08)], repeat: [5, 1] });
          }
          // purlins over the two end bays only — a purlin across the well would
          // be a footbridge in front of the descending bell
          for (const s of [-1, 1] as const)
            [WELL_HZ + 0.42, HOUSE_HZ - 0.28].forEach((zz) =>
              iron.push({ dims: [WALL_X * 2 + 0.5, 0.13, 0.22], pos: [0, ROOF_Y + 0.13, s * zz], repeat: [4, 1] }),
            );
          // the HEADGEAR: four raking legs off the eaves into two head beams,
          // with the sheaves directly over the bell's corner eyes
          const HEAD_Y = ROOF_Y + 1.34;
          const SH_X = 0.78;
          const SH_Z = 0.95;
          for (const sx of [-1, 1] as const)
            for (const sz of [-1, 1] as const) {
              iron.push(
                barSpec(
                  t,
                  new t.Vector3(sx * (WALL_X + 0.16), ROOF_Y + 0.06, sz * (HOUSE_HZ - 0.3)),
                  new t.Vector3(sx * (SH_X + 0.24), HEAD_Y, sz * SH_Z),
                  0.14,
                  [1, 4],
                ),
              );
            }
          for (const sz of [-1, 1] as const)
            iron.push({ dims: [(SH_X + 0.34) * 2, 0.2, 0.24], pos: [0, HEAD_Y + 0.06, sz * SH_Z], repeat: [4, 1] });
          iron.push({ dims: [0.24, 0.2, SH_Z * 2], pos: [0, HEAD_Y + 0.2, 0], repeat: [1, 4] });
          iron.push({ dims: [0.24, 0.16, SH_Z * 2], pos: [SH_X + 0.3, HEAD_Y + 0.2, 0], repeat: [1, 4] });
          iron.push({ dims: [0.24, 0.16, SH_Z * 2], pos: [-(SH_X + 0.3), HEAD_Y + 0.2, 0], repeat: [1, 4] });
          dockGrp.add(mergedBoxes(t, iron, IRON, { tex: 'metal', metal: 0.5, rough: 0.68, bump: 0.05 }));
          // rivet-rusted straps and bolt heads on the plate — one merged pass
          const rivets: MergedBoxSpec[] = [];
          for (const s of [-1, 1] as const)
            for (let k = 0; k < 30; k += 1) {
              const h1 = hash01(k * 1.9 + (s > 0 ? 7 : 3));
              rivets.push({
                dims: [0.05, 0.06, 0.06],
                pos: [s * (WALL_X + 0.09), LEDGE + 0.3 + h1 * (ROOF_Y - LEDGE - 0.5), -HOUSE_HZ + 0.2 + hash01(k * 5.3 + s) * (HOUSE_HZ * 2 - 0.4)],
              });
            }
          const rv = mergedBoxes(t, rivets, RUST, { tex: 'metal', metal: 0.3, rough: 0.92 });
          rv.userData.lodDetail = true;
          dockGrp.add(rv);
          // FOUR SHEAVE WHEELS on the headframe
          sheaves = [];
          for (const sx of [-1, 1] as const)
            for (const sz of [-1, 1] as const) {
              const px = sx * SH_X;
              const pz = sz * SH_Z;
              const wheel = new t.Mesh(new t.TorusGeometry(0.24, 0.07, 6, 16), mat(t, IRON_D, { tex: 'metal', metal: 0.6, rough: 0.55 }));
              wheel.position.set(px, HEAD_Y - 0.06, pz);
              wheel.rotation.y = Math.PI / 2;
              dockGrp.add(wheel);
              dockGrp.add(cyl(t, 0.09, 0.09, 0.16, RUST, [px, HEAD_Y - 0.06, pz], { tex: 'metal', metal: 0.4, rough: 0.85, seg: 8, rotZ: Math.PI / 2 }));
              sheaves.push([px, HEAD_Y - 0.28, pz]);
            }
          // the PORTCULLIS at each end: a hanging iron grate whose bottom edge
          // is held 1.18 above the rail, so the boat passes under it and the
          // camera cannot see down the channel into the house
          const grate: MergedBoxSpec[] = [];
          for (const s of [-1, 1] as const) {
            const gz = s * HOUSE_HZ;
            grate.push({ dims: [WALL_X * 2 + 0.2, 0.16, 0.16], pos: [0, PLATE_TOP + 0.02, gz], repeat: [4, 1] });
            for (let k = 0; k < 9; k += 1)
              grate.push({ dims: [0.09, PLATE_TOP - 0.06 - ARCH_CLEAR, 0.1], pos: [-WALL_X + 0.16 + k * ((WALL_X * 2 - 0.32) / 8), (PLATE_TOP - 0.06 + ARCH_CLEAR) / 2, gz] });
            [0.4, 0.8].forEach((f2) =>
              grate.push({ dims: [WALL_X * 2 - 0.2, 0.08, 0.1], pos: [0, ARCH_CLEAR + (PLATE_TOP - 0.06 - ARCH_CLEAR) * f2, gz], repeat: [4, 1] }),
            );
          }
          dockGrp.add(mergedBoxes(t, grate, RUST_D, { tex: 'metal', metal: 0.35, rough: 0.9, bump: 0.04 }));

          // ================= THE MOON POOL'S IRONWORK =====================
          // `cutOpening` has taken 2.92 units of wooden trough and the trestle
          // bent that stood in the fissure's mouth out of the swept mesh. Six
          // authored members put an engineered edge on what is left, so the
          // opening reads as a fabricated shaft head and never as a gap where
          // the track should be:
          //
          //   1  HEAD CASTINGS  the wooden channel is stopped at each end of the
          //      pool by a pair of iron jambs and a head band under the floor —
          //      the wood butts into iron instead of ending in a ragged cut.
          //   2  THE KERB       a raised riveted coaming down both long sides,
          //      standing on the lock house's own bottom flanges: the rim.
          //   3  HEAD BEAMS     two transverse plate beams hung off those
          //      flanges, carrying the cut trough ends where the trestle used
          //      to stand. Both sit OUTSIDE the pool: nothing spans the opening.
          //   4  THE THROAT     a plated lining down the top 1.4 units of the
          //      fissure, following its own walls (so it costs no clearance),
          //      which is what says the mouth was cut and lined for the bell.
          //   5  GUIDE RAILS    two T-rails from the headgear down to the trench
          //      floor, with the bell's four shoes running on them.
          //   6  LAMPS + a warning chain along the kerb.
          const pool: MergedBoxSpec[] = [];
          for (const s of [-1, 1] as const) {
            // 1 — head castings
            for (const sx of [-1, 1] as const) {
              pool.push({ dims: [0.19, 0.62, 0.28], pos: [sx * 0.585, 0.03, s * (POOL_HZ + 0.14)], repeat: [1, 2] });
              pool.push({ dims: [0.27, 0.12, 0.34], pos: [sx * 0.585, 0.28, s * (POOL_HZ + 0.14)], repeat: [1, 1] }); // its cap
            }
            pool.push({ dims: [1.5, 0.2, 0.28], pos: [0, -0.3, s * (POOL_HZ + 0.14)], repeat: [4, 1] }); // head band under the floor
            // the NOSING: the swept trough floor is a zero-thickness ribbon, so
            // at the cut it would simply stop in mid-air. This is the iron
            // nosing that gives it an edge — and it goes UNDER the floor, not
            // over it: the dive skiff's keel line rides at −0.07 and the floor
            // is at −0.10, so there is no room for a proud plate (a first pass
            // put its top at −0.07 and the hull cleared it by 0.1 mm).
            pool.push({ dims: [1.0, 0.2, 0.48], pos: [0, -0.21, s * (POOL_HZ + 0.24)], repeat: [3, 1] });
            // 3 — head beam + its two hangers off the plate girders
            pool.push({ dims: [WALL_X * 2 + 0.34, 0.2, 0.28], pos: [0, -0.34, s * (POOL_HZ + 0.52)], repeat: [5, 1] });
            for (const sx of [-1, 1] as const)
              pool.push({ dims: [0.26, 0.36, 0.28], pos: [sx * WALL_X, -0.24, s * (POOL_HZ + 0.52)], repeat: [1, 1] });
            // 2 — the kerb, standing on the girders' bottom flanges
            pool.push({ dims: [0.16, 0.26, POOL_HZ * 2 + 0.9], pos: [s * 1.46, 0.23, 0], repeat: [1, 6] });
            for (let k = 0; k < 7; k += 1)
              pool.push({ dims: [0.24, 0.1, 0.14], pos: [s * 1.46, 0.14, -POOL_HZ - 0.3 + k * ((POOL_HZ * 2 + 0.6) / 6)] });
          }
          dockGrp.add(mergedBoxes(t, pool, IRON, { tex: 'metal', metal: 0.5, rough: 0.66, bump: 0.05 }));
          // bolt heads down the kerb and round the head castings — one merged
          // LOD pass, because a plain iron kerb is a skirting board
          const poolBolts: MergedBoxSpec[] = [];
          for (const s of [-1, 1] as const) {
            for (let k = 0; k < 22; k += 1)
              poolBolts.push({ dims: [0.05, 0.05, 0.06], pos: [s * 1.54, 0.2 + (k % 2) * 0.09, -POOL_HZ - 0.4 + k * ((POOL_HZ * 2 + 0.8) / 21)] });
            for (const sx of [-1, 1] as const)
              for (let k = 0; k < 5; k += 1)
                poolBolts.push({ dims: [0.06, 0.05, 0.05], pos: [sx * 0.69, -0.2 + k * 0.13, s * (POOL_HZ + 0.14)] });
          }
          const pb = mergedBoxes(t, poolBolts, RUST, { tex: 'metal', metal: 0.32, rough: 0.9 });
          pb.userData.lodDetail = true;
          dockGrp.add(pb);

          // 5 — THE GUIDE RAILS. They stand on the 135°/315° quarters, which is
          // the FISSURE'S OWN CENTRELINE (it is skewed 45° to the channel): the
          // one direction in which a vertical member cannot get between the
          // trench camera and the bell's open arch.
          const rails: MergedBoxSpec[] = [];
          const RAIL_TOP = ROOF_Y + 0.95; // above the yoke shoe's highest pass
          const RAIL_BOT = LEDGE - RIFT_DEPTH + 0.1;
          const RAIL_H = RAIL_TOP - RAIL_BOT;
          for (const a of [(3 * Math.PI) / 4, (7 * Math.PI) / 4]) {
            const ux = Math.cos(a);
            const uz = Math.sin(a);
            const at = (r: number): [number, number, number] => [ux * r, (RAIL_TOP + RAIL_BOT) / 2, uz * r];
            rails.push({ dims: [0.09, RAIL_H, 0.09], pos: at(GUIDE_R), rotY: -a, repeat: [1, 14] }); // the web
            rails.push({ dims: [0.06, RAIL_H, 0.3], pos: at(1.6), rotY: -a, repeat: [1, 14] }); // its back flange
            // the foot block on the trench bed
            rails.push({ dims: [0.4, 0.34, 0.5], pos: [ux * GUIDE_R, RAIL_BOT - 0.02, uz * GUIDE_R], rotY: -a, repeat: [2, 1] });
            // wall stays, taken off the OUTBOARD flange so the shoes never meet
            // one, and short enough to die into the throat lining
            [-1.0, -2.4, -3.8].forEach((sy) => {
              rails.push({ dims: [0.42, 0.1, 0.1], pos: [ux * 1.82, sy, uz * 1.82], rotY: -a });
              rails.push({ dims: [0.1, 0.3, 0.24], pos: [ux * 2.02, sy, uz * 2.02], rotY: -a });
            });
          }
          dockGrp.add(mergedBoxes(t, rails, IRON_D, { tex: 'metal', metal: 0.6, rough: 0.55, bump: 0.04 }));
          // the AIR PUMP house on the ledge beside the fissure, with its hose
          // running up to the headframe — the bell has to breathe
          const pumpX = -(RIFT_HX + 1.9);
          const pump: MergedBoxSpec[] = [
            { dims: [1.5, 0.9, 1.2], pos: [pumpX, LEDGE + 0.45, 0], repeat: [4, 2] },
            { dims: [1.66, 0.14, 1.36], pos: [pumpX, LEDGE + 0.95, 0], repeat: [4, 3] },
            { dims: [0.3, 0.5, 0.3], pos: [pumpX + 0.5, LEDGE + 1.2, 0.3], repeat: [1, 2] },
          ];
          dockGrp.add(mergedBoxes(t, pump, IRON_D, { tex: 'metal', metal: 0.45, rough: 0.75, bump: 0.05 }));
          dockGrp.add(cyl(t, 0.4, 0.4, 0.22, RUST, [pumpX, LEDGE + 1.14, -0.3], { tex: 'metal', metal: 0.4, rough: 0.88, seg: 14 })); // the flywheel
          const flyw = new t.Mesh(new t.TorusGeometry(0.42, 0.06, 6, 18), mat(t, IRON_D, { tex: 'metal', metal: 0.55, rough: 0.6 }));
          flyw.position.set(pumpX, LEDGE + 1.36, -0.3);
          flyw.rotation.x = Math.PI / 2;
          dockGrp.add(flyw);
          const hoseMat = mat(t, TAR, { tex: 'fabric', rough: 0.96 });
          dockGrp.add(line(t, new t.Vector3(pumpX + 0.4, LEDGE + 1.3, 0.3), new t.Vector3(-(SH_X + 0.34), HEAD_Y - 0.3, SH_Z), 0.5, 0.045, hoseMat));
          // coils of spare hose and a pile of lead weights
          const coil = new t.Mesh(new t.TorusGeometry(0.42, 0.09, 6, 16), hoseMat);
          coil.position.set(pumpX - 0.2, LEDGE + 0.12, 1.1);
          coil.rotation.x = Math.PI / 2;
          coil.userData.lodDetail = true;
          dockGrp.add(coil);
          const weights: MergedBoxSpec[] = [];
          for (let k = 0; k < 6; k += 1) {
            const h1 = hash01(k * 3.3 + 17);
            weights.push({ dims: [0.34, 0.16, 0.26], pos: [pumpX + 0.9 + (h1 - 0.5) * 0.3, LEDGE + 0.09 + Math.floor(k / 3) * 0.17, -1.2 + (k % 3) * 0.32], rotY: h1 * 0.6 });
          }
          dockGrp.add(mergedBoxes(t, weights, IRON_D, { tex: 'metal', metal: 0.5, rough: 0.7 }));
          // GEAR ON THE OUTSIDE OF THE PLATE, because 4.5 units of riveted wall
          // is a slab until something hangs off it: a boiler, its gauges, and a
          // ladder up to the roof
          {
            const bx = -(WALL_X + 0.42);
            const boiler = cyl(t, 0.34, 0.34, 1.5, RUST, [bx, LEDGE + FOOT_Y + 0.45, 0.5], {
              tex: 'metal',
              repeat: [4, 2],
              rough: 0.9,
              metal: 0.35,
              seg: 14,
              rotX: Math.PI / 2,
            });
            dockGrp.add(boiler);
            dockGrp.add(cyl(t, 0.36, 0.36, 0.09, IRON_D, [bx, LEDGE + FOOT_Y + 0.45, 1.28], { tex: 'metal', metal: 0.5, rough: 0.6, seg: 14, rotX: Math.PI / 2 }));
            dockGrp.add(cyl(t, 0.36, 0.36, 0.09, IRON_D, [bx, LEDGE + FOOT_Y + 0.45, -0.28], { tex: 'metal', metal: 0.5, rough: 0.6, seg: 14, rotX: Math.PI / 2 }));
            const bits: MergedBoxSpec[] = [
              { dims: [0.2, 0.3, 0.2], pos: [bx, LEDGE + FOOT_Y + 0.92, 0.5] }, // its chimney stub
              { dims: [0.14, 0.5, 0.14], pos: [bx - 0.1, LEDGE + FOOT_Y + 1.2, 0.5] },
            ];
            dockGrp.add(mergedBoxes(t, bits, IRON_D, { tex: 'metal', metal: 0.45, rough: 0.72 }));
            [0.15, 0.62].forEach((f2, k) => {
              const gauge = new t.Mesh(new t.TorusGeometry(0.11, 0.035, 6, 12), mat(t, BRASS, { tex: 'metal', metal: 0.62, rough: 0.45 }));
              gauge.position.set(-(WALL_X + 0.12), LEDGE + FOOT_Y + 0.5 + f2, -0.9 - k * 0.4);
              gauge.rotation.y = Math.PI / 2;
              dockGrp.add(gauge);
            });
            // the ladder to the roof
            const rungs: MergedBoxSpec[] = [];
            for (let k = 0; k < 7; k += 1) rungs.push({ dims: [0.36, 0.05, 0.05], pos: [WALL_X + 0.2, LEDGE + FOOT_Y + 0.1 + k * 0.24, -1.7] });
            [-0.14, 0.14].forEach((dz) => rungs.push({ dims: [0.06, 1.9, 0.06], pos: [WALL_X + 0.28, LEDGE + FOOT_Y + 0.9, -1.7 + dz] }));
            const lad = mergedBoxes(t, rungs, RUST, { tex: 'metal', metal: 0.35, rough: 0.9 });
            lad.userData.lodDetail = true;
            dockGrp.add(lad);
          }
          // a lantern on the headframe (the ride's one night-gated lamp)
          const lamp = shipLantern(t, 1.0);
          lamp.group.position.set(SH_X + 0.34, HEAD_Y - 0.42, -SH_Z);
          dockGrp.add(lamp.group);
          lampMats.push(lamp.glass);
          stationLight.position.set(SH_X + 0.34, HEAD_Y - 0.62, -SH_Z);
          dockGrp.add(stationLight);

          // ---- THE BELL itself, on the moving carriage ----
          dockGrp.add(carriage);
          const bell = buildDivingBell(t, { ports: bellPorts });
          carriage.add(bell);
          eyes = bell.userData.eyes as [number, number, number][];
          const la = bell.userData.lampAt as [number, number, number];
          bellLight.position.set(la[0], la[1], la[2]);
          carriage.add(bellLight);
          // four hoist cables, re-stretched every frame between sheave and eye
          for (let k = 0; k < 4; k += 1) {
            const c = cyl(t, 0.026, 0.026, 1, IRON_D, [0, 0, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 6 });
            c.castShadow = false;
            dockGrp.add(c);
            cables.push(c);
          }
        }

        // ---- 9. THE STATION: a plank landing stage under a canvas awning --
        {
          const st = ride.frameAt(0);
          const yard = new t.Group();
          yard.position.set(st.p.x, groundAt(st.p.x, st.p.z), st.p.z);
          yard.rotation.y = yawOf(st);
          g.add(yard);
          // local frame: +z along the station straight, +x the BOARDING side
          const deckTop = st.p.y + 0.03;
          const DX = 1.02;
          const DZ = 1.15;
          yard.add(box(t, [1.0, 0.09, 2.1], TIMBER, [DX, deckTop - 0.045, DZ], { tex: 'wood', repeat: [3, 6], rough: 0.92, bump: 0.03 }));
          const deck: MergedBoxSpec[] = [];
          [0.62, 1.42].forEach((x) => deck.push({ dims: [0.12, 0.12, 2.1], pos: [x, deckTop - 0.15, DZ], repeat: [1, 5] }));
          [0.25, 1.15, 2.05].forEach((z) =>
            [0.62, 1.42].forEach((x) => {
              deck.push({ dims: [0.15, Math.max(0.1, deckTop - 0.18), 0.15], pos: [x, Math.max(0.05, deckTop - 0.18) / 2, z], repeat: [1, 3] });
            }),
          );
          [0.34, 0.7].forEach((y) => deck.push({ dims: [0.07, 0.06, 2.1], pos: [1.54, deckTop + y, DZ], repeat: [1, 5] }));
          [0.25, 1.15, 2.05].forEach((z) => deck.push({ dims: [0.09, 0.76, 0.09], pos: [1.54, deckTop + 0.38, z], repeat: [1, 2] }));
          [0, 1, 2].forEach((k) => deck.push({ dims: [0.72, 0.06, 0.26], pos: [1.12, 0.13 + k * 0.14, 2.42 + k * 0.13], repeat: [2, 1] }));
          yard.add(mergedBoxes(t, deck, TIMBER, { tex: 'wood', rough: 0.92, bump: 0.03 }));
          const posts: MergedBoxSpec[] = [];
          [0.64, 1.4].forEach((x) => [0.3, 2.0].forEach((z) => posts.push({ dims: [0.11, 1.2, 0.11], pos: [x, deckTop + 0.6, z], repeat: [1, 3] })));
          [0.3, 2.0].forEach((z) => posts.push({ dims: [1.0, 0.09, 0.11], pos: [DX, deckTop + 1.18, z], repeat: [3, 1] }));
          posts.push({ dims: [0.09, 0.09, 2.2], pos: [DX, deckTop + 1.3, DZ], repeat: [1, 6] });
          yard.add(mergedBoxes(t, posts, TIMBER, { tex: 'wood', rough: 0.92, bump: 0.03 }));
          const awnMat = mat(t, 0xcdc5ad, { tex: 'fabric', repeat: [3, 6], rough: 0.94 });
          awnMat.side = t.DoubleSide;
          [-1, 1].forEach((s) => {
            const panel = new t.Mesh(new t.PlaneGeometry(0.78, 2.36, 3, 5), awnMat);
            panel.position.set(DX + s * 0.31, deckTop + 1.22, DZ);
            panel.rotation.set(Math.PI / 2, 0, 0);
            panel.rotateX(s * 0.42);
            panel.castShadow = true;
            yard.add(panel);
          });
          // the DIVE OFFICE: a small iron-roofed shed with a gauge board, and
          // the spare bell parts stacked outside it
          const shed: MergedBoxSpec[] = [
            { dims: [1.5, 1.5, 1.3], pos: [2.5, 0.75, 2.0], repeat: [4, 4] },
            { dims: [1.7, 0.12, 1.5], pos: [2.5, 1.56, 2.0], repeat: [4, 4] },
            { dims: [0.5, 0.7, 0.06], pos: [1.76, 0.9, 2.0], repeat: [2, 2] },
          ];
          yard.add(mergedBoxes(t, shed, TIMBER_D, { tex: 'wood', rough: 0.94, bump: 0.04 }));
          const gaugeBoard: MergedBoxSpec[] = [];
          for (let k = 0; k < 3; k += 1)
            gaugeBoard.push({ dims: [0.2, 0.2, 0.06], pos: [1.74, 1.16, 1.55 + k * 0.28] });
          yard.add(mergedBoxes(t, gaugeBoard, BRASS, { tex: 'metal', metal: 0.6, rough: 0.5 }));
          const crates: MergedBoxSpec[] = [];
          for (let k = 0; k < 5; k += 1) {
            const h1 = hash01(k * 6.7 + 5);
            crates.push({
              dims: [0.42 + h1 * 0.12, 0.34, 0.42 + h1 * 0.1],
              pos: [2.3 + (h1 - 0.5) * 0.5, 0.17 + Math.floor(k / 3) * 0.34, -0.2 + (k % 3) * 0.52],
              rotY: (h1 - 0.5) * 0.5,
              repeat: [2, 1],
            });
          }
          yard.add(mergedBoxes(t, crates, TIMBER_D, { tex: 'wood', rough: 0.94, bump: 0.04 }));
          // a spare porthole ring and a coil of rope on the deck
          const spare = new t.Mesh(new t.TorusGeometry(0.24, 0.05, 6, 14), mat(t, BRASS, { tex: 'metal', metal: 0.6, rough: 0.5 }));
          spare.position.set(2.0, 0.26, 0.8);
          spare.rotation.x = 0.3;
          spare.userData.lodDetail = true;
          yard.add(spare);
          const rope = new t.Mesh(new t.TorusGeometry(0.24, 0.06, 5, 14), mat(t, ROPE, { tex: 'fabric', rough: 0.96 }));
          rope.position.set(1.2, deckTop + 0.05, 2.1);
          rope.rotation.x = Math.PI / 2;
          rope.userData.lodDetail = true;
          yard.add(rope);
          // two lanterns on the ridge spar (emissive only — the real light is
          // the one on the bell headframe)
          [0.55, 1.75].forEach((z) => {
            const lamp = shipLantern(t, 0.9);
            lamp.group.position.set(DX, deckTop + 1.06, z);
            yard.add(lamp.group);
            lampMats.push(lamp.glass);
          });
        }

        // ---- 10. THE DIVE SKIFF -----------------------------------------
        // The world's own boat: `buildReefBoat` from ReefRacer (exported for
        // exactly this), in Deep Drift's iron-and-brass livery with a bow lamp
        // added. Reusing the hull keeps the two rides' fleets identical where
        // it matters — the rocker, the thwart heights and the HIP_RISE the
        // seat anchors are built off are the numbers already verified against
        // this profile's trough.
        const boat = buildReefBoat(t, BOAT_LIVERY, { riders: opts.riders ?? true, seats: seatAnchors });
        {
          const lamp = shipLantern(t, 0.8);
          lamp.group.position.set(0, 0.46, 0.52);
          boat.add(lamp.group);
          boat.add(cyl(t, 0.016, 0.02, 0.3, IRON, [0, 0.26, 0.52], { tex: 'metal', metal: 0.5, rough: 0.6, seg: 6 }));
          const bl = (boat.userData.lamps ?? []) as THREE.MeshStandardMaterial[];
          bl.push(lamp.glass);
          boat.userData.lamps = bl;
        }
        g.add(boat);
        extras.vehicle = boat;
        seatWorld = makeSeatWorld(t, seatAnchors);
        const boatLamps = (boat.userData.lamps ?? []) as THREE.MeshStandardMaterial[];

        // ---- 11. EFFECTS: 230 particles over 3 emitters -----------------
        const dripFx = buildEmitter(t, {
          max: 60,
          rate: 14,
          life: 1.5,
          lifeVar: 0.4,
          velocity: [0, -0.5, 0],
          spread: 0.25,
          gravity: 3.2,
          size: 0.05,
          sizeEnd: 0.03,
          color: 0xcfdde2,
          colorEnd: 0xa9c0c6,
          opacity: 0.7,
        });
        {
          const f = ride.frameAt(Math.min(0.999, 4.6 / total + (bellU - 3.4 / total - 4.6 / total) * 0.44));
          dripFx.setOrigin(f.p.x, f.p.y + 1.5, f.p.z);
        }
        g.add(dripFx.points);
        // MARINE SNOW rising out of the trench — additive, so it reads as
        // motes catching the bioluminescence rather than as smoke
        const moteFx = buildEmitter(t, {
          max: 90,
          rate: 16,
          life: 4.2,
          lifeVar: 1.2,
          velocity: [0, 0.34, 0],
          spread: 0.4,
          gravity: -0.02,
          size: 0.07,
          sizeEnd: 0.13,
          color: BIO,
          colorEnd: BIO_DEEP,
          opacity: 0.4,
          additive: true,
        });
        moteFx.setOrigin(dockF.p.x, dockF.p.y - railH - 2.6, dockF.p.z);
        g.add(moteFx.points);
        // the bell's exhaust: a stream of bubbles up its skirt while it is down
        const bubbleFx = buildEmitter(t, {
          max: 80,
          rate: 0,
          life: 1.8,
          lifeVar: 0.5,
          velocity: [0, 1.1, 0],
          spread: 0.35,
          gravity: -0.5,
          size: 0.06,
          sizeEnd: 0.12,
          color: 0xdfeef2,
          colorEnd: 0xbcd6dc,
          opacity: 0.5,
        });
        g.add(bubbleFx.points);

        // ---- 12. THE ACT MACHINE ----------------------------------------
        // analytic: clock → (arc, bell depth). Nothing here integrates dt, so
        // the same clock always yields the same pose.
        const LAP = total / DRIFT_V + BELL_T;
        const T1 = sBell / DRIFT_V;
        const mtx = new t.Matrix4();
        const place = (s: number, dy: number) => {
          const f = ride.frameAt((s / total) % 1);
          boat.position.copy(f.p).addScaledVector(f.up, 0.25);
          boat.position.y += dy;
          mtx.makeBasis(f.side, f.up, f.fwd);
          boat.setRotationFromMatrix(mtx);
        };
        /** the act state at a gated clock: arc travelled + bell depth 0..1 */
        const actAt = (clock: number) => {
          const ph = ((clock % LAP) + LAP) % LAP;
          if (ph < T1) return { s: ph * DRIFT_V, k: 0, stage: 'driftOut' as const };
          const b = ph - T1;
          if (b < BELL_T) {
            let k: number;
            if (b < T_DOWN) k = smooth(b / T_DOWN);
            else if (b < T_DOWN + T_HOLD) k = 1;
            else k = 1 - smooth((b - T_DOWN - T_HOLD) / T_UP);
            return { s: sBell, k, stage: 'bell' as const };
          }
          return { s: sBell + (b - BELL_T) * DRIFT_V, k: 0, stage: 'driftHome' as const };
        };
        g.userData.actLap = LAP;

        // ---- 12b. CYCLE-TRUE CLOCK — why the act machine is not fed the raw
        // gated clock. `createMotionGate` advances its clock by dt·speed, and
        // `travelling` is NOT the only state that moves it: `departing` eases
        // 0→1 over spinUp 0.8 and `arriving` eases 1→0 over spinDown 1.6, and
        // the ride FSM counts neither as ride time. Measured against a bare gate
        // driven through the real state sequence (rideFsm.ts:124-195), one cycle
        // hands the runner 1.291 s MORE clock than `rideDuration`.
        //
        // With `LAP` tuned to rideDuration exactly, that surplus is not absorbed
        // anywhere: the boat overshoots its landing stage a little every cycle
        // and the error accumulates. Probed over six FSM cycles it boarded
        // 0.5 → 1.0 → 2.5 → 4.0 → 5.3 → 6.3 u from the boardPoint — by the sixth
        // load the boat is out on the channel and the landing stage is
        // decorative (probe: tw-cycletrue.tsx).
        //
        // The fix is one divide and it touches NOTHING else: scale the clock so
        // one FSM CYCLE maps onto exactly one LAP. The pace table, the act
        // boundaries and their ratios are untouched; the whole ride simply runs
        // 2.7 % slower, which stretches the bell's 6.6-second hold to 6.8.
        // `rideDuration` is DELIBERATELY not touched — this world's acceptance
        // window is max(60, 2.5·maxDur + 20) and this ride's 47 s owns it
        // (TidewaterHollow/Context.md); changing it moves the whole park.
        const GATE_SURPLUS = 1.291;
        const CYCLE_SCALE = LAP / (47 + GATE_SURPLUS);
        g.userData.cycleScale = CYCLE_SCALE;

        // ---- 13. the updater --------------------------------------------
        // The BOAT and the BELL are motion-gated (a registered ride parks with
        // the boat in the station while guests board, RCT2's Vehicle.cpp status
        // cycle); the SEA, the bioluminescence and the lamps run off the REAL
        // clock outside the gate, so a parked ride is not a frozen ocean.
        const gate = createMotionGate((clock) => {
          const act = actAt(clock * CYCLE_SCALE + (opts.phase0 ?? 0));
          const dy = -BELL_DEPTH * act.k;
          place(act.s, dy);
          carriage.position.y = dy;
          // the hoist cables: re-stretch each one between its sheave and its eye
          cables.forEach((c, i) => {
            const sh = sheaves[i] ?? [0, 0, 0];
            const ey = eyes[i % Math.max(1, eyes.length)] ?? [0, 0, 0];
            const top = sh[1];
            const bot = ey[1] + dy;
            const len = Math.max(0.05, top - bot);
            c.position.set((sh[0] + ey[0]) / 2, (top + bot) / 2, (sh[2] + ey[2]) / 2);
            c.scale.set(1, len, 1);
            const dx = ey[0] - sh[0];
            const dz = ey[2] - sh[2];
            c.rotation.set(0, 0, 0);
            if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
              const q = new t.Quaternion().setFromUnitVectors(
                new t.Vector3(0, 1, 0),
                new t.Vector3(dx, -(len), dz).normalize(),
              );
              c.quaternion.copy(q);
            }
          });
          // bubbles stream off the bell's skirt while it is submerged
          bubbleFx.setRate(act.k > 0.08 ? 34 : 0);
          bubbleFx.setOrigin(dockF.p.x, dockF.p.y + dy + 0.1, dockF.p.z);
          bubbleFx.update(clock);
          g.userData.bellDepth = act.k;
          g.userData.actStage = act.stage;
        }, { spinDown: 1.6 });
        onStateChange = gate.onStateChange;

        return (time: number) => {
          chanWater.update(time); // the water keeps moving whatever the ride does
          pools.forEach((p) => p.update(time));
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          const flick = 1 + 0.11 * Math.sin(time * 7.3) + 0.06 * Math.sin(time * 13.1 + 1.7);
          // BIOLUMINESCENCE IS NOT NIGHT-GATED, and that is deliberate: the
          // trench is a fissure 4.35 units under a rock ledge, so it is dark
          // at noon. The glow is LERPED between a daylight and a night value
          // (LavaTubeRun's lava rule) and never gates to zero — plus a slow
          // breath, because living light pulses.
          const breathe = 0.86 + 0.14 * Math.sin(time * 0.9) + 0.06 * Math.sin(time * 2.3 + 1.1);
          const bioK = (1.15 + 1.15 * ease) * breathe;
          bioLightA.intensity = 2.1 * bioK;
          bioLightB.intensity = 1.7 * bioK * (0.9 + 0.1 * Math.sin(time * 1.7));
          for (let i = 0; i < bioMats.length; i += 1) {
            const m = bioMats[i];
            m.emissiveIntensity = (0.85 + 0.95 * ease) * (0.82 + 0.28 * Math.sin(time * 1.1 + i * 0.7));
          }
          jellies.forEach((j, i) => {
            j.grp.position.y = j.y0 + 0.18 * Math.sin(time * 0.5 + j.ph);
            const p = 1 + 0.09 * Math.sin(time * 1.6 + j.ph);
            j.grp.scale.set(p, 1 / p, p);
            void i;
          });
          // the bell's own lamp: it comes UP as the bell goes down (a lit bell
          // in a dark trench), and stays lit after dark at the surface too
          const depth = (g.userData.bellDepth as number) ?? 0;
          const bellK = Math.max(smooth(depth * 1.4), ease);
          bellLight.intensity = 2.0 * bellK * flick;
          for (const m of bellPorts) m.emissiveIntensity = 0.1 + 1.5 * bellK;
          stationLight.intensity = 0.85 * ease * flick;
          for (const m of lampMats) m.emissiveIntensity = 0.1 + 1.35 * ease * flick;
          for (const m of boatLamps) m.emissiveIntensity = 0.12 + 1.2 * Math.max(ease, bellK * 0.8);
          dripFx.update(time);
          moteFx.update(time);
          gate.update(time);
        };
      })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const DeepDriftBase = composableRide<DeepDriftOpts & { register?: boolean }>(
  'DeepDrift',
  (t, props) =>
    buildDeepDriftScene(t, {
      pieces: props.pieces,
      groundAt: props.groundAt,
      bellU: props.bellU,
      phase0: props.phase0,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the four thwarts (capacity 4 = 4 seats)
      riders: props.riders ?? !props.register,
    }),
  {
    // the station straight runs along the local −x and every compiled point
    // has z ≤ 0, so the local +z face is free for the queue lane and the huts
    front: 2.1,
    exit: [1.9, 2.1],
    board: [-1.3, 0.6, 0],
    defaults: { name: 'Deep Drift', capacity: 4, rideDuration: 47, intensity: 3, price: 4 },
  },
);

/** <DeepDrift> — Tidewater Hollow's sea-cave and diving-bell boat ride as a
 *  composable ride (components/Park/Context.md): mounts at `position` /
 *  `rotation`; inside a <Park>, `register` wires the full GameManager ride via
 *  <ConfigurableRide> — queue HEAD 2.1 out the local +z front, exit hut at
 *  local [1.9, 2.1], boarding on the landing stage.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Straight/><TurnR/>…` — children win) are compiled by
 *  `compileTrackPieces` on the 'flume' profile and swept by `buildRideSpline`;
 *  no pieces = the stock "Bell Trench Drift" (a LEVEL circuit — the only
 *  vertical move on this ride is the bell). A FATAL compile marks the build
 *  `invalid` so a broken circuit never registers. The dive skiff is the ride
 *  `vehicle` (onboard cam) and its four thwarts are live `seatWorld` anchors,
 *  so REAL guests ride it — including all the way down into the trench. */
export const DeepDrift: React.FC<ComposableRideProps & DeepDriftOpts & { children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <DeepDriftBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
