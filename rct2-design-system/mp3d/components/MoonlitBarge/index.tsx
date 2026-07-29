import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, alongDir, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWaterRibbon } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { buildPeep, SHIRTS, SKIN_TONES, HAIRS } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';
import { THORNWICK, buildIvyStrand } from '../WyrmsHollow';

// ---------------------------------------------------------------------------
// MoonlitBarge — "The Moonlit Barge", attraction 2 of the THORNWICK GLADE (the
// enchanted forest whose flagship is `components/WyrmsHollow` and whose palette
// this file imports from there): a SLOW LANTERN-LIT BOAT DRIFT with no drops,
// no lift and no thrill in it at all. The charm IS the atmosphere.
//
// A lantern-hung barge leaves a timber landing stage and drifts round a still
// stone-lined channel at 1.75 units a second — under a broken RUIN ARCH furred
// with moss and hung with ivy, past leaning statue plinths and a collapsed
// wall, beneath twisted trees that lean right out over the water, and through a
// hollow where the banks are crusted with toadstools and glow-worms. Motes
// drift in the air over the channel and a low mist lies on it.
//
// SAME SPLINE MACHINERY as every tracked ride in the fleet: `compileTrackPieces`
// compiles the circuit and `buildRideSpline({ profile: 'flume' })` sweeps the
// wooden U-channel trough with its water strip — the water-ride drawer, which
// is what a boat ride runs in. The layout is DELIBERATELY, COMPLETELY LEVEL:
// there is not one `lift` or `drop` piece in it (`components/DeepDrift` is the
// other level flume in the system and the model this follows). A gentle boat
// ride's whole budget goes on the glade, not on a gradient.
//
// THE CYCLE IS SHORT ON PURPOSE. 26.33 units of arc at DRIFT_V 1.75 u/s is a
// 15.05-second lap, so `rideDuration: 15` completes exactly one circuit per
// dispatch and the world's set-piece passes validatePark's `sim` gate (a long
// cycle starves the smoke run — it has cost this project park failures before).
// 1.75 u/s is about three times a strolling guest's 0.55 u/s: a drift, not a
// dash, and the slowest thing on rails in the glade.
//
// Budget: 4 real PointLights (all NIGHT-GATED — this is a night-forward ride:
// two bank lanterns, the landing-stage lantern, and the barge's own lantern
// hoop travelling with it); 2 ParticleKit emitters / 220 particles; every
// static repeat batched through `mergedBoxes`/`mergedParts`; close-up-only
// detail tagged `userData.lodDetail`. Deterministic throughout — hashed sines
// only, one absolute-time updater, no Math.random / Date.now.
// ---------------------------------------------------------------------------

/** the station straight runs along the local −x, so every compiled point has
 *  z ≤ 0 and the whole local +z face stays clear for the queue lane, the huts
 *  and the street the composition puts in front of them */
const HEADING = -Math.PI / 2;
/** station rail height above the local ground */
const START: [number, number, number] = [0, 0.6, 0];

/**
 * "The Lantern Round" — the shipped layout. A LEVEL rounded rectangle:
 *   A (−x)  the landing stage · the run out under the ruin wall
 *   B (−z)  the WILLOW REACH — twisted trees leaning over the water
 *   C (+x)  the far reach, with the BROKEN ARCH across the channel at its middle
 *   D (+z)  the TOADSTOOL HOLLOW and the home run
 *   → a 1.2-u tail landing 0.3 u short of the station on its own axis.
 *
 * NOT ONE `lift` OR `drop`: every compiled point sits at y 0.60 (measured
 * level = 0.000). Verified with the kit's own checks through a compile-only
 * probe: `ok=true`, `fatal=false`, 22 control points, **26.33 u of arc**, worst
 * clearance **1.56**, footprint **8.50 × 6.05**, closure CLOSED with **ZERO
 * synthesized track**, zero warnings — the same closure signature as
 * DeepDrift's verified circuit, because it is the same arithmetic: with the
 * station 2.6 u long, `A(2.6 + lead) + tail + 0.3 = C` and `B = D`.
 * The one design line is informational (`shortDrop:warn` — RCT2's excitement
 * stat gate noting the first drop after the lift is 0.00 units, which is
 * meaningless on a ride with no drops and no lift; the flume profile does not
 * enforce checkCoasterDesign and nothing is logged).
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 1.2 }, // out of the landing stage
  { type: 'turnR', angle: 90, radius: 1.6 },
  { type: 'straight', length: 2.85 }, // THE WILLOW REACH
  { type: 'turnR', angle: 90, radius: 1.6 },
  { type: 'straight', length: 5.3 }, // the far reach — the BROKEN ARCH at its middle
  { type: 'turnR', angle: 90, radius: 1.6 },
  { type: 'straight', length: 2.85 }, // THE TOADSTOOL HOLLOW
  { type: 'turnR', angle: 90, radius: 1.6 },
  { type: 'straight', length: 1.2 }, // tail onto the station axis
];

/** the BOARDING PAD, ride-local — where <ConfigurableRide> delivers a guest.
 *  A module constant because the STATION LOCK (§13) parks the hull on the same
 *  point the composable hands the GameManager, and two copies would drift. */
const BOARD: [number, number, number] = [-1.3, 0.6, 0];

/** drift speed, units/second. 26.33 u of arc / 1.75 = a 15.05 s lap, which is
 *  what `rideDuration: 15` is set from — one circuit per dispatch. */
const DRIFT_V = 1.75;

// ---- palette (Thornwick Glade — imported, never re-invented) --------------
/** RCT2 TrackColour for the channel: a lichen-grey stone trough with a mossy
 *  timber rim rail on root-brown trestles, so the waterway reads as cut into
 *  the same ruin masonry Wyrm's Hollow threads */
const TRACK_COLOURS: TrackScheme = { main: 0x5f6257, additional: 0x53442f, supports: 0x4b4e45 };
/** the barge: dark waxed timber, pale ash trim, tarnished brass fittings.
 *  Metals stay at 0.2-0.35 — with no env map anything ≥ 0.6 renders near-black
 *  in this fleet. */
const BARGE_LIVERY: VehicleScheme = { body: 0x413526, trim: 0x8b7c5c, tertiary: 0x8a7b46 };

const STONE = THORNWICK.stone;
const STONE_D = THORNWICK.stoneDark;
const STONE_S = THORNWICK.stoneShade;
const MOSS = THORNWICK.moss;
const MOSS_D = THORNWICK.mossDeep;
const IVY = THORNWICK.ivy;
const IVY_L = THORNWICK.ivyLight;
const LANTERN = THORNWICK.lantern;
/** the glade's own earth: leaf-litter brown under the moss.
 *  ⚠️ OLIVE, NOT WARM BROWN, and the same land-scale finding ThornwickGlade
 *  records for its own floor: 0x4a3c2c and `THORNWICK.mossDeep` are the SAME
 *  VALUE (luma 62 vs 71) but sit at OPPOSITE hues (32° orange, 92° green) at
 *  equal saturation, and over a bank this wide maximum hue contrast reads exactly
 *  like maximum value contrast — a patchwork. The land holds these two tones in
 *  common with this ride, so they move together. */
const LOAM = 0x4a4838;
const LOAM_D = 0x3b3a2c;
/** bark of the twisted trees — grey-brown, never black */
const BARK = 0x4e4336;
const BARK_D = 0x3f362b;
/** iron: lantern posts, hoops, the mooring rings. 0.28 metalness. */
const IRON = 0x4a4b46;
const TIMBER = 0x6b5a40;
const TIMBER_D = 0x54462f;
const LAMP_GLASS = 0xfff2d0;
/** THE GLOW-WORM GREEN — the one cold light in a warm-lantern ride. Pale and
 *  low in saturation so it reads as living light, not as a neon tube. */
const WORM = 0x9fe8b4;
const WORM_D = 0x4e8c6a;
/** toadstool caps: a deep red and a dusk violet, both muted */
const CAP_RED = 0x8e4038;
const CAP_VIOLET = 0x63496f;
const STIPE = 0xd6cdb2;

// ---------------------------------------------------------------------------
// small geometry helpers (the fleet's usual shapes — Stage's `mergedBoxes`
// only takes boxes, so bars and blades are built as matrices)
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

/** a FLAT blade spanning A → B, its width axis kept horizontal (fern fronds,
 *  reed leaves): a frond has to read as a leaf, not as a green joist */
function bladeSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, w: number, thick: number): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  dir.normalize();
  const side = new t.Vector3().crossVectors(new t.Vector3(0, 1, 0), dir);
  if (side.lengthSq() < 1e-5) side.set(1, 0, 0);
  side.normalize();
  // ⚠️ `side × dir`, NOT `dir × side`. `makeBasis(x, y, z)` needs a RIGHT-handed
  // triple: cross is anticommutative, so `dir × side = −(side × dir)` gives
  // determinant −1, which MIRRORS the matrix and turns every face normal
  // inward — the fronds and reed leaves then render near-black in daylight.
  // ThornwickScenery shipped the identical bug in its own `bladeSpec` and
  // found it; this is the same one line.
  const up2 = new t.Vector3().crossVectors(side, dir).normalize();
  const m = new t.Matrix4().makeBasis(side, dir, up2);
  m.setPosition(a.clone().addScaledVector(dir, len * 0.5));
  return { dims: [w, len, thick], matrix: m, repeat: [1, 2] };
}

/** a SAGGING line (a hanging chain, a mooring rope, a vine) between two points */
function sagLine(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, sag: number, r: number, material: THREE.Material): THREE.Mesh {
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

// ---------------------------------------------------------------------------
// THE GLADE LANTERN — the ride's signature light fitting, hung everywhere: a
// wrought-iron cage on a ring, four uprights, a little peaked cap and a warm
// glass globe. The glass material is returned so the caller can night-gate it;
// the fitting never owns a PointLight (the caller places the ≤4 real ones).
// ---------------------------------------------------------------------------
function gladeLantern(t: typeof THREE, scale = 1): { group: THREE.Group; glass: THREE.MeshStandardMaterial } {
  const grp = new t.Group();
  const s = scale;
  const cage: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + 0.38;
    // the uprights lean IN toward the cap — a straight cage reads as a crate
    cage.push(
      barSpec(
        t,
        new t.Vector3(Math.cos(a) * 0.062 * s, -0.13 * s, Math.sin(a) * 0.062 * s),
        new t.Vector3(Math.cos(a) * 0.036 * s, 0.14 * s, Math.sin(a) * 0.036 * s),
        0.013 * s,
      ),
    );
  }
  // base tray, cap plate, finial, hanger
  cage.push({ dims: [0.15 * s, 0.022 * s, 0.15 * s], pos: [0, -0.14 * s, 0], rotY: 0.38 });
  cage.push({ dims: [0.13 * s, 0.026 * s, 0.13 * s], pos: [0, 0.15 * s, 0], rotY: 0.38 });
  cage.push({ dims: [0.075 * s, 0.05 * s, 0.075 * s], pos: [0, 0.185 * s, 0], rotY: 0.78 });
  cage.push({ dims: [0.016 * s, 0.09 * s, 0.016 * s], pos: [0, 0.25 * s, 0] });
  grp.add(mergedBoxes(t, cage, IRON, { tex: 'metal', metal: 0.28, rough: 0.62, bump: 0.04 }));
  const hoop = new t.Mesh(new t.TorusGeometry(0.032 * s, 0.008 * s, 5, 10), mat(t, IRON, { tex: 'metal', metal: 0.28, rough: 0.6 }));
  hoop.position.set(0, 0.3 * s, 0);
  hoop.userData.lodDetail = true;
  grp.add(hoop);
  const globe = ball(t, 0.058 * s, LAMP_GLASS, [0, 0.0, 0], { emissive: LANTERN, rough: 0.3 });
  (globe.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
  globe.castShadow = false;
  grp.add(globe);
  return { group: grp, glass: globe.material as THREE.MeshStandardMaterial };
}

// ---------------------------------------------------------------------------
// TOADSTOOLS — the glade's ground cover, and half its night light.
//
// A cluster of 4-7 stools: a leaning tapered stipe with a real DOME cap (a
// sphere cap, never a cone — a cone reads as a traffic bollard), gills under
// the wide ones, and hashed white spots on the red caps. One cap per cluster
// gets an EMISSIVE material pushed into `glowMats`, so a fairy ring lights up
// after dark without costing a PointLight.
// ---------------------------------------------------------------------------
function toadstoolCluster(t: typeof THREE, seed: number, scale = 1, glowMats: THREE.MeshStandardMaterial[]): THREE.Group {
  const grp = new t.Group();
  const h = (n: number) => hash01(seed * 1.71 + n * 4.13);
  const n = 4 + Math.floor(h(1) * 4);
  const stipes: PartSpec[] = [];
  const capsA: PartSpec[] = [];
  const capsB: PartSpec[] = [];
  const glowCaps: PartSpec[] = [];
  const spots: MergedBoxSpec[] = [];
  const gills: PartSpec[] = [];
  const glowIdx = Math.floor(h(2) * n);
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2 + h(k + 3) * 1.1;
    const rr = scale * (0.05 + 0.17 * h(k + 4));
    const hh = scale * (0.1 + 0.17 * h(k + 5)); // stipe height
    const cr = scale * (0.05 + 0.055 * h(k + 6)); // cap radius
    const lean = 0.1 + h(k + 7) * 0.34;
    const la = h(k + 8) * Math.PI * 2;
    const foot = new t.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    const dir = new t.Vector3(Math.cos(la) * Math.sin(lean), Math.cos(lean), Math.sin(la) * Math.sin(lean));
    const top = foot.clone().addScaledVector(dir, hh);
    stipes.push({ geo: new t.CylinderGeometry(cr * 0.34, cr * 0.46, hh, 7), matrix: alongDir(t, foot, dir, hh), uv: [1, 2] });
    const capGeo = new t.SphereGeometry(cr, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const capM = mtx(t, [top.x, top.y - cr * 0.1, top.z], [0, h(k + 9) * 3.1, 0], [1, 0.66 + 0.2 * h(k + 10), 1]);
    if (k === glowIdx) glowCaps.push({ geo: capGeo, matrix: capM });
    else if (h(k + 11) > 0.52) capsA.push({ geo: capGeo, matrix: capM });
    else capsB.push({ geo: capGeo, matrix: capM });
    // gills: a thin disc under the wider caps
    if (cr > scale * 0.075)
      gills.push({ geo: new t.CylinderGeometry(cr * 0.9, cr * 0.7, cr * 0.1, 9), matrix: mtx(t, [top.x, top.y - cr * 0.14, top.z]) });
    // hashed white spots on the cap crown
    for (let s2 = 0; s2 < 3; s2 += 1) {
      const sa = h(k * 3 + s2 + 12) * Math.PI * 2;
      const sr = cr * 0.5 * h(k * 5 + s2 + 13);
      spots.push({
        dims: [cr * 0.2, cr * 0.1, cr * 0.2],
        pos: [top.x + Math.cos(sa) * sr, top.y + cr * 0.42 - sr * 0.3, top.z + Math.sin(sa) * sr],
        rotY: sa,
      });
    }
  }
  grp.add(mergedParts(t, stipes, mat(t, STIPE, { tex: 'fabric', rough: 0.94, bump: 0.03 })));
  if (capsA.length) grp.add(mergedParts(t, capsA, mat(t, CAP_RED, { rough: 0.72, bump: 0.04 })));
  if (capsB.length) grp.add(mergedParts(t, capsB, mat(t, CAP_VIOLET, { rough: 0.74, bump: 0.04 })));
  if (gills.length) {
    const gm = mergedParts(t, gills, mat(t, 0xc9bfa4, { rough: 0.9 }));
    gm.userData.lodDetail = true;
    grp.add(gm);
  }
  if (glowCaps.length) {
    // a pale bone cap that GLOWS after dark — the diffuse stays muted so the
    // fairy ring is not a row of white dots in daylight
    const gmat = mat(t, 0x93a892, { emissive: WORM, rough: 0.55 });
    gmat.emissiveIntensity = 0.14;
    glowMats.push(gmat);
    const gm = mergedParts(t, glowCaps, gmat);
    gm.castShadow = false;
    grp.add(gm);
  }
  const sp = mergedBoxes(t, spots, 0xe8e2cf, { rough: 0.85 });
  sp.userData.lodDetail = true;
  grp.add(sp);
  if (scale < 0.9) grp.userData.lodDetail = true;
  return grp;
}

// ---------------------------------------------------------------------------
// A TWISTED TREE — the glade's canopy, and the reason the channel feels
// enclosed without being a tunnel.
//
// The trunk is a chain of tapered segments that LEAN and TWIST as they climb
// (a straight stack reads as a pole), the branches all reach the SAME way —
// out over the water — and the canopy is a cluster of flat-shaded leaf lumps
// held above `clear` so the barge and its riders always pass under it. Three
// ivy strands hang off the lowest limb (`buildIvyStrand`, shared from
// WyrmsHollow). Local +x is the LEAN direction: the caller yaws the group so
// +x points at the channel.
// ---------------------------------------------------------------------------
function twistedTree(
  t: typeof THREE,
  seed: number,
  opts: { height?: number; lean?: number; clear?: number } = {},
): THREE.Group {
  const grp = new t.Group();
  const h = (n: number) => hash01(seed * 2.37 + n * 5.71);
  const H = opts.height ?? 2.6;
  const LEAN = opts.lean ?? 0.55; // total sideways reach of the trunk, in +x
  const CLEAR = opts.clear ?? 1.5; // nothing hangs below this
  const SEG = 7;
  const wood: PartSpec[] = [];
  const nodes: THREE.Vector3[] = [new t.Vector3(0, 0, 0)];
  let r0 = 0.15 + h(1) * 0.06;
  for (let k = 0; k < SEG; k += 1) {
    const f0 = k / SEG;
    const f1 = (k + 1) / SEG;
    const prev = nodes[k];
    // the lean develops as a smooth curve, with a hashed wobble across it
    const next = new t.Vector3(
      LEAN * f1 * f1 + (h(k + 2) - 0.5) * 0.12,
      H * f1,
      Math.sin(f1 * 4.1 + h(3) * 6) * 0.16 + (h(k + 4) - 0.5) * 0.1,
    );
    const dir = next.clone().sub(prev);
    const len = dir.length();
    const r1 = r0 * (0.78 - f0 * 0.1);
    wood.push({ geo: new t.CylinderGeometry(r1, r0, len * 1.06, 8), matrix: alongDir(t, prev, dir, len), uv: [2, 2] });
    // a burl / root flare on the lowest two segments
    if (k < 2)
      wood.push({
        geo: new t.SphereGeometry(r0 * (0.9 + 0.4 * h(k + 5)), 7, 5),
        matrix: mtx(t, [prev.x, prev.y + 0.02, prev.z], [0, h(k + 6) * 3, 0], [1.2, 0.7, 1.1]),
      });
    nodes.push(next);
    r0 = r1;
  }
  // ROOTS spreading out of the ground — a trunk that just stops at y=0 floats
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * Math.PI * 2 + h(k + 20) * 0.8;
    const rr = 0.22 + h(k + 21) * 0.3;
    const tip = new t.Vector3(Math.cos(a) * rr, -0.06, Math.sin(a) * rr);
    const from = new t.Vector3(Math.cos(a) * 0.06, 0.12, Math.sin(a) * 0.06);
    const d = tip.clone().sub(from);
    wood.push({ geo: new t.CylinderGeometry(0.024, 0.075, d.length(), 6), matrix: alongDir(t, from, d, d.length()), uv: [1, 2] });
  }
  // BRANCHES — every one reaching out over the water (+x), starting above CLEAR
  const tips: THREE.Vector3[] = [];
  for (let k = 0; k < 5; k += 1) {
    const at = nodes[3 + (k % 4)];
    const y0 = Math.max(CLEAR + 0.12, at.y);
    const from = new t.Vector3(at.x, y0, at.z);
    const reach = 0.55 + h(k + 30) * 0.7;
    const rise = 0.16 + h(k + 31) * 0.4;
    const side = (h(k + 32) - 0.5) * 0.7;
    const knee = from.clone().add(new t.Vector3(reach * 0.5, rise * 0.7, side * 0.5));
    const tip = knee.clone().add(new t.Vector3(reach * 0.6, rise * 0.5, side * 0.7));
    [
      [from, knee, 0.052],
      [knee, tip, 0.03],
    ].forEach(([a, b, r]) => {
      const av = a as THREE.Vector3;
      const bv = b as THREE.Vector3;
      const d = bv.clone().sub(av);
      wood.push({ geo: new t.CylinderGeometry((r as number) * 0.6, r as number, d.length(), 6), matrix: alongDir(t, av, d, d.length()), uv: [1, 2] });
    });
    tips.push(tip);
  }
  grp.add(mergedParts(t, wood, mat(t, h(9) > 0.5 ? BARK : BARK_D, { tex: 'wood', repeat: [2, 3], rough: 0.94, bump: 0.06 })));

  // CANOPY — flat-shaded leaf lumps over the branch tips and the crown, every
  // one of them held clear of the channel
  const leafA: PartSpec[] = [];
  const leafB: PartSpec[] = [];
  const crown = nodes[SEG];
  const spots: THREE.Vector3[] = [...tips, crown, crown.clone().add(new t.Vector3(0.2, 0.16, 0.18)), crown.clone().add(new t.Vector3(-0.22, 0.1, -0.14))];
  // THREE SMALLER LUMPS per spot rather than two big ones: a canopy built from
  // few large spheres reads as a lollipop whatever you rotate it to, and these
  // trees are meant to be gnarled. Each lump is flattened and yaw-hashed so the
  // silhouette is broken everywhere.
  spots.forEach((p, i) => {
    for (let k = 0; k < 3; k += 1) {
      const rr = 0.15 + h(i * 3 + k + 40) * 0.17;
      const cy = Math.max(CLEAR + rr * 0.7, p.y + (h(i + k + 41) - 0.3) * 0.26);
      const m = mtx(
        t,
        [p.x + (h(i * 5 + k + 42) - 0.5) * 0.44, cy, p.z + (h(i * 7 + k + 43) - 0.5) * 0.44],
        [h(i + k + 44) * 2, h(i + k * 3 + 45) * 3, h(i + k + 46) * 2],
        [1.35, 0.6, 1.2],
      );
      (h(i * 11 + k + 47) > 0.5 ? leafA : leafB).push({ geo: new t.IcosahedronGeometry(rr, 1), matrix: m });
    }
  });
  grp.add(mergedParts(t, leafA, mat(t, IVY, { tex: 'fabric', repeat: [2, 2], rough: 0.95, flat: true })));
  grp.add(mergedParts(t, leafB, mat(t, MOSS_D, { tex: 'fabric', repeat: [2, 2], rough: 0.95, flat: true })));
  // ivy trailing off the lowest limb — Wyrm's Hollow's own strand builder
  for (let k = 0; k < 3; k += 1) {
    const p = tips[k % tips.length];
    const strand = buildIvyStrand(t, 0.5 + h(k + 60) * 0.6, seed * 7 + k);
    strand.position.set(p.x * 0.7, Math.max(CLEAR + 0.1, p.y - 0.06), p.z * 0.7 + (h(k + 61) - 0.5) * 0.2);
    strand.userData.lodDetail = true;
    grp.add(strand);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// THE BROKEN ARCH — the hero piece of the drift, and the one thing on the ride
// the barge passes THROUGH.
//
// A ruined masonry arch across the channel: two block piers, a real ring of
// voussoirs with a keystone, moss caps on every horizontal, ivy hanging off the
// crown, a lantern on an iron bracket — and the top BROKEN, one voussoir gone
// and the parapet snapped off, because an intact arch in a ruin is a gate.
//
// Local frame: **+x is ACROSS the channel** (the piers stand at ±R) and +z is
// the channel direction (the arch's thickness), and **y = 0 is the CHANNEL
// RAIL**, so the caller hangs it straight off a spline frame. The springing is
// at y +0.55 and the inner crown at **y +1.45**, against a barge whose lantern
// hoop tops out 0.90 above the water and a seated rider's head at 0.66.
// ---------------------------------------------------------------------------
/** inner radius of the arch ring: the piers stand 0.9 out, clear of the 0.45
 *  half-width channel and its trough walls */
const ARCH_R = 0.9;
/** height of the springing above the rail — with ARCH_R that puts the inner
 *  crown at 1.45 and the underside at |x| = 0.45 at 1.33 */
const ARCH_SPRING = 0.55;

export interface RuinArchOpts {
  /** arch depth along the channel (default 0.72) */
  depth?: number;
  /** hashed-variation salt */
  seed?: number;
  /** lantern glass materials are pushed here for night gating */
  lamps?: THREE.MeshStandardMaterial[];
}

/**
 * The broken ruin arch. Exported for parks dressing their own glade paths.
 * `group.userData.lampAt` is the local point the caller may hang a real
 * PointLight at; `group.userData.crownY` is the inner crown height.
 */
export function buildRuinArch(t: typeof THREE, opts: RuinArchOpts = {}): THREE.Group {
  const grp = new t.Group();
  const D = opts.depth ?? 0.72;
  const seed = opts.seed ?? 3;
  const h = (n: number) => hash01(seed * 1.93 + n * 3.37);

  // ---- the two piers: stacked blocks, each hashed in size and yaw ----
  const blocks: MergedBoxSpec[] = [];
  const shade: MergedBoxSpec[] = [];
  for (const sx of [-1, 1] as const) {
    let y = -0.62; // buried in the bank so the pier has a footing
    let k = 0;
    while (y < ARCH_SPRING - 0.05) {
      const bh = 0.17 + h(k * 3 + (sx > 0 ? 7 : 2)) * 0.09;
      const bw = 0.46 + h(k * 5 + (sx > 0 ? 11 : 4)) * 0.1;
      const spec: MergedBoxSpec = {
        dims: [bw, bh, D + h(k * 7) * 0.1],
        pos: [sx * (ARCH_R + 0.16) + (h(k * 11) - 0.5) * 0.05, y + bh / 2, (h(k * 13) - 0.5) * 0.05],
        rotY: (h(k * 17) - 0.5) * 0.1,
        repeat: [2, 1],
      };
      (h(k * 19) > 0.62 ? shade : blocks).push(spec);
      y += bh;
      k += 1;
    }
    // an impost course the arch springs from
    blocks.push({ dims: [0.62, 0.1, D + 0.16], pos: [sx * (ARCH_R + 0.14), ARCH_SPRING - 0.05, 0], repeat: [2, 1] });
  }

  // ---- THE RING: voussoirs on a real circle, one of them MISSING ----
  const N = 13;
  const gone = 3 + Math.floor(h(41) * 3); // the gap in the ring
  const voussoirs: MergedBoxSpec[] = [];
  const extrados: MergedBoxSpec[] = [];
  for (let k = 0; k < N; k += 1) {
    // a is measured from the springing (0) to the far springing (π)
    const a = (k + 0.5) * (Math.PI / N);
    if (k === gone) continue; // the fallen stone
    const rMid = ARCH_R + 0.13;
    const x = -Math.cos(a) * rMid;
    const y = ARCH_SPRING + Math.sin(a) * rMid;
    // ROTATION −a, not a − π/2. A voussoir's long axis has to lie along the
    // ring's TANGENT (that is what makes its joints radial): the tangent at
    // angle `a` is (sin a, cos a), and a Z rotation by θ sends the box's own +Y
    // to (−sin θ, cos θ), so θ = −a. The first pass used a − π/2, which is 90°
    // out — every stone pointed along its own radius and the "arch" rendered as
    // a scatter of slabs standing on end with no ring in it at all.
    const m = new t.Matrix4().makeRotationZ(-a);
    m.setPosition(x, y, 0);
    voussoirs.push({ dims: [0.27, (Math.PI * (ARCH_R + 0.13)) / N + 0.03, D], matrix: m, repeat: [1, 1] });
    // the extrados course over it, the top of which is snapped off on the
    // right-hand haunch (k > N*0.66) — the whole point of a BROKEN arch
    if (k < N * 0.66 || h(k + 51) > 0.55) {
      const m2 = new t.Matrix4().makeRotationZ(-a);
      const rOut = ARCH_R + 0.32;
      m2.setPosition(-Math.cos(a) * rOut, ARCH_SPRING + Math.sin(a) * rOut, (h(k + 61) - 0.5) * 0.06);
      extrados.push({ dims: [0.16, (Math.PI * rOut) / N + 0.02, D - 0.06], matrix: m2 });
    }
  }
  // the KEYSTONE, wedged proud of the ring
  voussoirs.push({ dims: [0.3, 0.36, D + 0.09], pos: [0, ARCH_SPRING + ARCH_R + 0.16, 0], repeat: [1, 2] });
  grp.add(mergedBoxes(t, [...blocks, ...voussoirs], STONE, { tex: 'concrete', repeat: [2, 2], rough: 0.94, bump: 0.07 }));
  grp.add(mergedBoxes(t, [...shade, ...extrados], STONE_D, { tex: 'concrete', repeat: [2, 2], rough: 0.95, bump: 0.07 }));

  // ---- MOSS on every horizontal, and a fern in the joint the stone fell out
  const moss: MergedBoxSpec[] = [];
  for (let k = 0; k < 26; k += 1) {
    const a = h(k * 2.3 + 71) * Math.PI;
    const rOut = ARCH_R + 0.3 + h(k * 3.1 + 72) * 0.1;
    moss.push({
      dims: [0.13 + h(k + 73) * 0.1, 0.05, 0.16 + h(k + 74) * 0.12],
      pos: [-Math.cos(a) * rOut, ARCH_SPRING + Math.sin(a) * rOut + 0.03, (h(k + 75) - 0.5) * (D - 0.1)],
      rotY: h(k + 76) * 3,
    });
  }
  for (const sx of [-1, 1] as const)
    for (let k = 0; k < 7; k += 1)
      moss.push({
        dims: [0.2, 0.05, 0.2],
        pos: [sx * (ARCH_R + 0.16) + (h(k + 81) - 0.5) * 0.34, -0.4 + k * 0.14, (h(k + 82) - 0.5) * (D - 0.1)],
        rotY: h(k + 83) * 3,
      });
  const mm = mergedBoxes(t, moss, MOSS, { tex: 'fabric', repeat: [1, 1], rough: 0.96, bump: 0.06, flat: true });
  mm.castShadow = false;
  grp.add(mm);
  // a fern growing out of the gap the fallen voussoir left
  {
    const ga = (gone + 0.5) * (Math.PI / N);
    const gx = -Math.cos(ga) * (ARCH_R + 0.13);
    const gy = ARCH_SPRING + Math.sin(ga) * (ARCH_R + 0.13);
    const fronds: MergedBoxSpec[] = [];
    for (let k = 0; k < 5; k += 1) {
      const fa = -0.5 + k * 0.32;
      const len = 0.2 + h(k + 91) * 0.16;
      const from = new t.Vector3(gx, gy, (h(k + 92) - 0.5) * 0.3);
      fronds.push(bladeSpec(t, from, from.clone().add(new t.Vector3(Math.cos(fa) * len * 0.4, len, Math.sin(fa) * len * 0.5)), 0.07, 0.016));
    }
    const fm = mergedBoxes(t, fronds, IVY_L, { tex: 'fabric', rough: 0.95, bump: 0.03 });
    fm.userData.lodDetail = true;
    grp.add(fm);
  }
  // IVY down both haunches
  for (let k = 0; k < 4; k += 1) {
    const sx = k % 2 ? 1 : -1;
    const strand = buildIvyStrand(t, 0.7 + h(k + 101) * 0.6, seed * 13 + k);
    strand.position.set(sx * (ARCH_R + 0.34), ARCH_SPRING + 0.5 + h(k + 102) * 0.5, (h(k + 103) - 0.5) * (D - 0.1));
    grp.add(strand);
  }

  // ---- an iron bracket lantern on the left pier, over the water ----
  const bracket: MergedBoxSpec[] = [
    barSpec(t, new t.Vector3(-(ARCH_R + 0.14), ARCH_SPRING + 0.34, 0), new t.Vector3(-(ARCH_R - 0.32), ARCH_SPRING + 0.5, 0), 0.03),
    barSpec(t, new t.Vector3(-(ARCH_R + 0.14), ARCH_SPRING + 0.56, 0), new t.Vector3(-(ARCH_R - 0.3), ARCH_SPRING + 0.5, 0), 0.024),
  ];
  grp.add(mergedBoxes(t, bracket, IRON, { tex: 'metal', metal: 0.28, rough: 0.62 }));
  const lamp = gladeLantern(t, 1.0);
  lamp.group.position.set(-(ARCH_R - 0.3), ARCH_SPRING + 0.2, 0);
  grp.add(lamp.group);
  opts.lamps?.push(lamp.glass);
  grp.userData.lampAt = [-(ARCH_R - 0.3), ARCH_SPRING + 0.2, 0];
  grp.userData.crownY = ARCH_SPRING + ARCH_R;
  return grp;
}

// ---------------------------------------------------------------------------
// THE BARGE — a lantern-hung punt.
//
// Built the way a punt is built: VERTICAL SIDES on a flat bottom, so the hull
// is an `ExtrudeGeometry` of the PLAN OUTLINE with the interior as a real HOLE
// (an extruded shape-with-hole is a hollow tube — open top and bottom — which
// is exactly a hull wall, and unlike a lofted shell it cannot leave a seam).
// The bottom is a second, thinner extrusion of the inner plan; the gunwale is a
// tube swept along the outer plan, so the rim is rounded wherever you look at
// it. Local frame: **+z is the bow, y = 0 is the hull bottom**, so the caller
// drops it on the water surface with a 0.03 draught.
//
// Four seats on two benches = capacity 4, with the seat anchors parented INTO
// the hull so `makeSeatWorld` hands REAL GameManager guests a live transform.
// ---------------------------------------------------------------------------
const BARGE_LEN = 2.3;
const BARGE_BEAM = 0.84;
const HULL_H = 0.28;
/** interior floor (the sole) — a rider's feet stand on this */
const SOLE_Y = 0.05;
/** bench top: 0.19 above the sole, which is a 0.4 m seat at the sim's 0.5 scale */
const SEAT_TOP = 0.24;
/** a seated peep's hips sit 0.45·scale above its group origin (its feet) — the
 *  fleet's number, at the GameManager's own 0.5 guest scale */
const HIP_RISE = 0.45 * 0.5;
/** the two benches, fore and aft of amidships */
const BENCH_Z = [0.62, -0.62];
/** two seats per bench, either side of the centre aisle the lanterns hang down */
const SEAT_X = [-0.185, 0.185];
/** the lantern hoop's crown — clear of a seated rider's head at 0.66 */
const HOOP_Y = 0.9;

/** half-beam at station z: full amidships, tapering LATE to a squared swim end
 *  at each extremity — the punt silhouette */
function hwOf(z: number): number {
  const u = Math.min(1, Math.abs(z) / (BARGE_LEN / 2));
  return Math.max(0.085, (BARGE_BEAM / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 3.2))));
}

/** the plan outline, inset by `inset`, as a closed list of [x, z] */
function planOutline(inset: number): [number, number][] {
  const pts: [number, number][] = [];
  const K = 18;
  for (let k = 0; k <= K; k += 1) {
    const z = -BARGE_LEN / 2 + (k / K) * BARGE_LEN;
    pts.push([Math.max(0.02, hwOf(z) - inset), z]);
  }
  for (let k = K; k >= 0; k -= 1) {
    const z = -BARGE_LEN / 2 + (k / K) * BARGE_LEN;
    pts.push([-Math.max(0.02, hwOf(z) - inset), z]);
  }
  return pts;
}

function shapeOf(t: typeof THREE, pts: [number, number][]): THREE.Shape {
  const s = new t.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

export interface MoonlitBargeBoatOpts {
  /** decorative seated riders (default true) */
  riders?: boolean;
  /** seat anchor groups are pushed here for `makeSeatWorld` */
  seats?: THREE.Object3D[];
  /** lantern glass materials are pushed here for night gating */
  lamps?: THREE.MeshStandardMaterial[];
  /** hashed-variation salt (the moored barge uses a different one) */
  seed?: number;
}

/**
 * One lantern-hung barge. Exported so a park can moor its own along a glade
 * waterway. `group.userData.lampAt` is the local point for a real PointLight.
 */
export function buildMoonlitBargeBoat(t: typeof THREE, scheme?: VehicleScheme, opts: MoonlitBargeBoatOpts = {}): THREE.Group {
  const g = new t.Group();
  const PAINT = scheme?.body ?? BARGE_LIVERY.body!;
  const CUT = scheme?.trim ?? BARGE_LIVERY.trim!;
  const METAL = scheme?.tertiary ?? BARGE_LIVERY.tertiary!;
  const seed = opts.seed ?? 1;
  const h = (n: number) => hash01(seed * 3.11 + n * 2.71);
  const INSET = 0.055;

  // ---- the hull wall: an extruded ring (outer plan with the inner plan as a
  // HOLE), rotated so the extrusion axis becomes world +Y ----
  const outer = planOutline(0);
  const inner = planOutline(INSET);
  const shell = shapeOf(t, outer);
  shell.holes.push(shapeOf(t, inner.slice().reverse()));
  const shellMat = mat(t, PAINT, { tex: 'wood', repeat: [3, 2], rough: 0.88, bump: 0.035 });
  shellMat.side = t.DoubleSide;
  const wall = new t.Mesh(new t.ExtrudeGeometry(shell, { depth: HULL_H, bevelEnabled: false }), shellMat);
  wall.rotation.x = -Math.PI / 2; // shape plane (x, z) → world (x, z); depth → +y
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  // ---- the bottom: the inner plan, SOLE_Y thick ----
  const floor = new t.Mesh(
    new t.ExtrudeGeometry(shapeOf(t, inner), { depth: SOLE_Y, bevelEnabled: false }),
    mat(t, TIMBER_D, { tex: 'wood', repeat: [2, 4], rough: 0.94, bump: 0.03 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // ---- the gunwale: one tube swept along the outer plan, so the rim reads
  // rounded from every angle (a box rim reads as a picture frame) ----
  const rimPts = outer.map(([x, z]) => new t.Vector3(x, HULL_H, z));
  const rim = new t.Mesh(
    new t.TubeGeometry(new t.CatmullRomCurve3(rimPts, true), 60, 0.03, 6, true),
    mat(t, CUT, { tex: 'wood', repeat: [1, 12], rough: 0.86, bump: 0.03 }),
  );
  rim.castShadow = true;
  g.add(rim);

  // ---- external ribs + a rubbing strake, and the raked swim ends ----
  const ribs: MergedBoxSpec[] = [];
  for (let k = 0; k < 7; k += 1) {
    const z = -0.84 + k * 0.28;
    const w = hwOf(z);
    for (const sx of [-1, 1] as const)
      ribs.push({ dims: [0.035, HULL_H - 0.02, 0.09], pos: [sx * (w + 0.005), HULL_H / 2 - 0.01, z], rotY: sx * 0.06, repeat: [1, 2] });
  }
  // the strake: short chords hugging the taper, not one straight plank
  for (let k = 0; k < 12; k += 1) {
    const z0 = -BARGE_LEN / 2 + (k / 12) * BARGE_LEN;
    const z1 = -BARGE_LEN / 2 + ((k + 1) / 12) * BARGE_LEN;
    for (const sx of [-1, 1] as const) {
      const a = new t.Vector3(sx * hwOf(z0), HULL_H * 0.62, z0);
      const b = new t.Vector3(sx * hwOf(z1), HULL_H * 0.62, z1);
      const dir = b.clone().sub(a);
      const m = new t.Matrix4().makeRotationFromQuaternion(
        new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
      );
      m.setPosition(a.clone().addScaledVector(dir, 0.5).setX(sx * (hwOf((z0 + z1) / 2) + 0.012)));
      ribs.push({ dims: [0.028, dir.length() * 1.06, 0.055], matrix: m });
    }
  }
  g.add(mergedBoxes(t, ribs, CUT, { tex: 'wood', rough: 0.88, bump: 0.03 }));
  // the swim ends: a raked plate closing each extremity, so the barge has a
  // bow and a stern rather than two blunt walls
  const swim: MergedBoxSpec[] = [];
  for (const sz of [-1, 1] as const) {
    swim.push({ dims: [0.2, 0.3, 0.06], pos: [0, HULL_H * 0.5, sz * (BARGE_LEN / 2 + 0.05)], rotX: sz * 0.4, repeat: [1, 1] });
    swim.push({ dims: [0.13, 0.1, 0.16], pos: [0, HULL_H + 0.02, sz * (BARGE_LEN / 2 - 0.02)], rotX: -sz * 0.2 }); // the post head
  }
  g.add(mergedBoxes(t, swim, PAINT, { tex: 'wood', repeat: [1, 1], rough: 0.88, bump: 0.035 }));

  // ---- the carved prow: a FERN SPIRAL, the glade's motif ----
  {
    const spiralMat = mat(t, CUT, { tex: 'wood', rough: 0.82, bump: 0.03 });
    const spiral = new t.Mesh(new t.TorusGeometry(0.058, 0.02, 6, 14, Math.PI * 1.6), spiralMat);
    spiral.position.set(0, HULL_H + 0.19, BARGE_LEN / 2 - 0.03);
    spiral.rotation.set(0, Math.PI / 2, -0.5);
    spiral.castShadow = true;
    g.add(spiral);
    g.add(cyl(t, 0.022, 0.03, 0.16, CUT, [0, HULL_H + 0.06, BARGE_LEN / 2 - 0.03], { tex: 'wood', rough: 0.85, seg: 7 }));
    // small carved leaves either side of the stem
    const leaves: MergedBoxSpec[] = [];
    for (const sx of [-1, 1] as const)
      leaves.push(
        bladeSpec(
          t,
          new t.Vector3(sx * 0.02, HULL_H + 0.03, BARGE_LEN / 2 - 0.05),
          new t.Vector3(sx * 0.11, HULL_H + 0.11, BARGE_LEN / 2 - 0.12),
          0.05,
          0.014,
        ),
      );
    const lm = mergedBoxes(t, leaves, CUT, { tex: 'wood', rough: 0.85 });
    lm.userData.lodDetail = true;
    g.add(lm);
  }

  // ---- interior: sole boards, two benches, mooring rings ----
  const sole: MergedBoxSpec[] = [];
  for (let k = 0; k < 9; k += 1) {
    const z = -0.9 + k * 0.225;
    sole.push({ dims: [Math.max(0.1, (hwOf(z) - INSET) * 1.96), 0.022, 0.2], pos: [0, SOLE_Y + 0.011, z], repeat: [2, 1] });
  }
  g.add(mergedBoxes(t, sole, TIMBER, { tex: 'wood', rough: 0.94, bump: 0.03 }));
  const bench: MergedBoxSpec[] = [];
  BENCH_Z.forEach((bz) => {
    const w = (hwOf(bz) - INSET) * 1.94;
    bench.push({ dims: [w, 0.04, 0.19], pos: [0, SEAT_TOP - 0.02, bz], repeat: [2, 1] }); // the plank
    bench.push({ dims: [w * 0.96, 0.1, 0.028], pos: [0, SEAT_TOP + 0.05, bz - 0.1], repeat: [2, 1] }); // low back rail
    bench.push({ dims: [w * 0.9, 0.026, 0.05], pos: [0, SEAT_TOP - 0.056, bz], repeat: [2, 1] }); // bearer
    for (const sx of [-1, 1] as const)
      bench.push({ dims: [0.05, SEAT_TOP - SOLE_Y - 0.04, 0.05], pos: [sx * w * 0.36, SOLE_Y + (SEAT_TOP - SOLE_Y) / 2 - 0.02, bz] }); // legs
  });
  g.add(mergedBoxes(t, bench, 0xa8996f, { tex: 'wood', repeat: [2, 1], rough: 0.86, bump: 0.03 }));
  for (const sz of [-1, 1] as const) {
    const ring = new t.Mesh(new t.TorusGeometry(0.032, 0.01, 5, 12), mat(t, METAL, { tex: 'metal', metal: 0.3, rough: 0.55 }));
    ring.position.set(0, HULL_H - 0.03, sz * (BARGE_LEN / 2 - 0.16));
    ring.rotation.x = Math.PI / 2;
    ring.userData.lodDetail = true;
    g.add(ring);
  }

  // ---- THE LANTERN HOOP: two iron ribs across the beam fore and aft of the
  // benches, a ridge spar joining their crowns, three lanterns hanging down
  // the centre aisle. Everything is above HOOP_Y − 0.3, so nothing crosses a
  // rider's face and the barge still reads as an open boat.
  const hoopParts: PartSpec[] = [];
  const ribGeo = new t.TorusGeometry(0.3, 0.016, 5, 18, Math.PI);
  for (const rz of [-1.02, 1.02]) {
    hoopParts.push({ geo: ribGeo, matrix: mtx(t, [0, HOOP_Y - 0.3, rz], [0, Math.PI / 2, 0]) });
  }
  const hoopBars: MergedBoxSpec[] = [];
  for (const rz of [-1.02, 1.02])
    for (const sx of [-1, 1] as const)
      hoopBars.push({ dims: [0.026, HOOP_Y - 0.3 - HULL_H + 0.1, 0.026], pos: [sx * 0.3, (HOOP_Y - 0.3 + HULL_H - 0.1) / 2, rz] });
  hoopBars.push({ dims: [0.028, 0.028, 2.1], pos: [0, HOOP_Y, 0], repeat: [1, 7] }); // the ridge spar
  hoopBars.push({ dims: [0.16, 0.02, 0.16], pos: [0, HOOP_Y - 0.01, 0] });
  const hoopMat = mat(t, IRON, { tex: 'metal', metal: 0.28, rough: 0.62, bump: 0.04 });
  g.add(mergedParts(t, hoopParts, hoopMat, false));
  ribGeo.dispose();
  g.add(mergedBoxes(t, hoopBars, IRON, { tex: 'metal', metal: 0.28, rough: 0.62, bump: 0.04 }));
  const lamps: THREE.MeshStandardMaterial[] = [];
  [-1.02, 0, 1.02].forEach((lz, i) => {
    const lam = gladeLantern(t, i === 1 ? 0.9 : 0.78);
    lam.group.position.set(0, HOOP_Y - 0.2 - (i === 1 ? 0.02 : 0), lz);
    g.add(lam.group);
    lamps.push(lam.glass);
    opts.lamps?.push(lam.glass);
    // the chain up to the spar
    g.add(cyl(t, 0.007, 0.007, 0.16, IRON, [0, HOOP_Y - 0.08, lz], { tex: 'metal', metal: 0.3, rough: 0.6, seg: 5 }));
  });
  g.userData.lamps = lamps;
  g.userData.lampAt = [0, HOOP_Y - 0.24, 0];

  // ---- a coil of rope and a punt pole lashed inside (close-up dressing) ----
  const coil = new t.Mesh(new t.TorusGeometry(0.05, 0.016, 5, 12), mat(t, 0x9a8b68, { tex: 'fabric', rough: 0.96 }));
  coil.position.set(0.1, SOLE_Y + 0.03, BARGE_LEN / 2 - 0.28);
  coil.rotation.x = Math.PI / 2;
  coil.userData.lodDetail = true;
  g.add(coil);
  const pole = cyl(t, 0.017, 0.021, 1.5, TIMBER, [-(hwOf(0) - INSET - 0.05), HULL_H - 0.06, 0.1], {
    tex: 'wood',
    repeat: [1, 6],
    rough: 0.9,
    seg: 7,
    rotX: Math.PI / 2,
  });
  pole.userData.lodDetail = true;
  g.add(pole);

  // ---- seat anchors ride WITH the hull, so real guests ride the barge ----
  BENCH_Z.forEach((bz, bi) => {
    SEAT_X.forEach((sx, si) => {
      const anchor = new t.Group();
      anchor.position.set(sx, SEAT_TOP - HIP_RISE, bz);
      // aft bench faces forward too: everyone looks over the bow at the glade
      g.add(anchor);
      opts.seats?.push(anchor);
      if (opts.riders ?? true) {
        const i = bi * 2 + si;
        const p = buildPeep(t, {
          skin: SKIN_TONES[(i + Math.floor(h(i + 1) * 5)) % SKIN_TONES.length],
          shirt: SHIRTS[(i * 3 + Math.floor(h(i + 2) * 8)) % SHIRTS.length],
          hair: HAIRS[(i + Math.floor(h(i + 3) * 4)) % HAIRS.length],
          female: h(i + 4) > 0.5,
          seated: true,
          expression: 'happy',
        });
        p.group.scale.setScalar(0.5);
        p.group.position.copy(anchor.position);
        p.group.rotation.y = (h(i + 5) - 0.5) * 0.5; // everyone looking about
        g.add(p.group);
      }
    });
  });
  return g;
}

// ---------------------------------------------------------------------------
export interface MoonlitBargeOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  "Lantern Round". Compiled on the 'flume' profile at heading −90°. KEEP IT
   *  LEVEL (no `lift`, no `drop`) and keep the arc near 26 units, or the lap
   *  drifts away from `rideDuration`. */
  pieces?: TrackPiece[];
  /** decorative riders in the barge (default true; `register` turns them OFF
   *  so REAL GameManager guests fill the four seats through seatWorld) */
  riders?: boolean;
  /** terrain sampler so the bank, the ruin and the trees land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the BROKEN ARCH (default: auto — the middle of the
   *  longest straight run farthest from the landing stage) */
  archU?: number;
  /** seconds to advance the drift at t = 0 — previews use it to open with the
   *  barge already at a chosen point of the circuit */
  phase0?: number;
  /** FREEZE the barge at `phase0` instead of drifting (default false). A
   *  reproducible STILL: the lap is only 15 s, so a moving barge is somewhere
   *  different in every screenshot and a documented close-up of it could never
   *  be re-shot. Everything else — the water, the mist, the lanterns, the
   *  glow-worms — still runs, so a still frame is not a dead one. */
  still?: boolean;
}

export interface MoonlitBargeBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** FATAL pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
}

/**
 * The whole ride: the level stone channel, the mossy banks, the broken arch,
 * the twisted trees, the toadstool hollow, the glow-worms, the landing stage
 * and the lantern-hung barge. `update` is motion-gated (the barge lies at the
 * stage while guests board — RCT2's Vehicle.cpp status cycle) while the WATER,
 * the glow-worms and the lanterns keep running off the real clock, so a parked
 * ride is not a frozen glade. `seatWorld` seats real guests on the four bench
 * places and `vehicle` is the barge for the RideViewer follow cam.
 */
export function buildMoonlitBargeScene(three: typeof THREE, opts: MoonlitBargeOpts = {}): MoonlitBargeBuilt {
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

        // frame scan — footprint, centroid and the inside/outside test every
        // placement below is taken against, so the dressing follows ANY layout
        const M = 176;
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
        /** which side of a frame points AWAY from the loop's centre */
        const outSign = (f: { p: THREE.Vector3; side: THREE.Vector3 }) =>
          f.side.x * (f.p.x - cen.x) + f.side.z * (f.p.z - cen.z) >= 0 ? 1 : -1;
        const distToTrack = (x: number, z: number) => {
          let d = Infinity;
          for (const [px, pz] of poly) d = Math.min(d, Math.hypot(px - x, pz - z));
          return d;
        };
        const st0 = ride.frameAt(0);
        const railH = st0.p.y - groundAt(st0.p.x, st0.p.z); // 0.60 on the stock layout

        // ---- 2. WHERE THE ARCH GOES -------------------------------------
        // The arch has to straddle the channel on a STRAIGHT, level stretch, so
        // the contiguous straight runs are collected and the midpoint of
        // whichever long-enough run lies farthest from the landing stage wins
        // (on the stock layout: the middle of the far reach). Scoring individual
        // samples instead picks the END of a run and puts a pier in the turn.
        const archU = (() => {
          if (opts.archU !== undefined) return opts.archU;
          const d = 1.2 / total;
          const runs: { u0: number; u1: number }[] = [];
          let cur: { u0: number; u1: number } | null = null;
          for (let i = 0; i < 360; i += 1) {
            const u = i / 360;
            const f = ride.frameAt(u);
            const a = ride.frameAt(u - d).fwd;
            const b = ride.frameAt(u + d).fwd;
            const bend = 1 - (a.x * b.x + a.z * b.z) / ((Math.hypot(a.x, a.z) || 1) * (Math.hypot(b.x, b.z) || 1));
            const ok = bend < 0.004 && Math.abs(f.fwd.y) < 0.05 && u > 3.4 / total && u < 1 - 3.4 / total;
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
            return Math.hypot(f.p.x - st0.p.x, f.p.z - st0.p.z) + (len >= 1.8 ? 40 : 0) + len;
          };
          let best = runs[0];
          for (const r of runs) if (score(r) > score(best)) best = r;
          return (best.u0 + best.u1) / 2;
        })();
        const archF = ride.frameAt(archU);
        g.userData.archU = archU;
        g.userData.archAt = [archF.p.x, archF.p.y, archF.p.z];

        const lampMats: THREE.MeshStandardMaterial[] = [];
        const glowMats: THREE.MeshStandardMaterial[] = [];

        // ---- 3. THE BANK: the ride brings its own ground -----------------
        // The flume profile stands the trough on trestles 0.60 above the ground;
        // a glade canal is CUT INTO the earth, so the ride lays its own bank —
        // overlapping loam and stone plates rising to rail level right against
        // the channel, which both hides the trestles and makes the water read as
        // sunk between banks. The +z FRONT is deliberately trimmed short (the
        // queue lane, the huts and the street live there).
        const PAD = 2.6;
        /** how far the bank reaches, as a 0..1 radius of the padded footprint */
        const bankR = (x: number, z: number) => {
          const dx = (x - cen.x) / ((x1 - x0) / 2 + PAD);
          const dz = (z - cen.z) / ((z1 - z0) / 2 + PAD);
          const az = Math.atan2(dz, dx);
          const wob = 1 + 0.08 * Math.sin(az * 3 + 0.9) + 0.05 * Math.sin(az * 5 - 2.1) + 0.03 * Math.sin(az * 9 + 0.4);
          return Math.hypot(dx, dz) / wob;
        };
        /** the front cut: nothing is laid past +z 1.7, so the ride's own local
         *  +z face stays clear ground for the access rig */
        const FRONT_CUT = 1.7;
        /** how much the bank rises toward the channel at a point: 0 out at the
         *  rim, 1 right against the revetment */
        const bankLift = (d: number) => Math.max(0, Math.min(1, (1.9 - d) / 1.24));
        /** the WALKABLE TOP of the bank at a world point — every single thing
         *  planted on the bank below (trees, toadstools, rocks, lantern posts,
         *  the ruins) is settled with this one function, so nothing floats and
         *  nothing sinks whatever layout is compiled */
        const bankY = (x: number, z: number) => groundAt(x, z) + 0.07 + bankLift(distToTrack(x, z)) * (railH - 0.06);
        {
          const STEP = 0.95;
          const loam: MergedBoxSpec[] = [];
          const loamD: MergedBoxSpec[] = [];
          const mossy: MergedBoxSpec[] = [];
          const rocky: MergedBoxSpec[] = [];
          for (let x = x0 - PAD; x <= x1 + PAD; x += STEP)
            for (let z = z0 - PAD; z <= z1 + PAD; z += STEP) {
              if (z > FRONT_CUT) continue;
              if (bankR(x, z) > 1.1) continue;
              const d = distToTrack(x, z);
              if (d < 0.66) continue; // never pave over the channel itself
              const h1 = hash01(x * 1.9 + z * 3.3);
              const h2 = hash01(x * 5.1 + z * 1.1);
              const h3 = hash01(x * 2.7 + z * 6.1);
              const gy = groundAt(x, z);
              // the plates RISE toward the channel: the bank is a berm, so the
              // trough is embanked instead of standing on stilts in a field
              const lift = bankLift(d);
              const spec: MergedBoxSpec = {
                dims: [STEP + 0.42 + h3 * 0.22, 0.1, STEP + 0.42 + h1 * 0.22],
                pos: [x, gy + 0.02 + lift * (railH - 0.06) + h2 * 0.02, z],
                rotY: (h1 - 0.5) * 1.3,
                repeat: [2, 2],
              };
              // ⚠️ THE TONE MUST CLUMP. Four tones picked by independent per-cell
              // hashes on a 0.95-u lattice is uniformly random, and uniformly
              // random on a lattice is what the eye reads as a CHEQUER BOARD from
              // the park's ~50° camera — the same defect ThornwickGlade's court and
              // forest floor both had, graded by the ADJACENT-DIFFER fraction
              // rather than by the share table. A smooth low-frequency field
              // carries the choice and the hash only ragged-edges it, so the bank
              // reads as DRIFTS of leaf litter with moss and old stone breaking
              // through — which is also what a canal bank looks like.
              const zone = 0.5 + 0.3 * Math.sin(x * 0.62 + 0.4) * Math.cos(z * 0.55 - 0.9) + 0.17 * Math.sin((x + z) * 0.38 + 1.4) + (h1 - 0.5) * 0.3;
              if (lift > 0.55) (zone > 0.5 ? mossy : rocky).push(spec);
              else if (zone > 0.68) mossy.push(spec);
              else (zone > 0.36 ? loam : loamD).push(spec);
            }
          const eOpt = { tex: 'concrete' as const, rough: 0.97, bump: 0.07, flat: true };
          const lm = mergedBoxes(t, loam, LOAM, eOpt);
          lm.castShadow = false;
          g.add(lm);
          const lm2 = mergedBoxes(t, loamD, LOAM_D, eOpt);
          lm2.castShadow = false;
          g.add(lm2);
          g.add(mergedBoxes(t, mossy, MOSS_D, { tex: 'fabric', repeat: [2, 2], rough: 0.97, bump: 0.06, flat: true }));
          g.add(mergedBoxes(t, rocky, STONE_S, eOpt));
        }

        // ---- 4. THE REVETMENT: cut-stone kerbs lining both banks ---------
        // A run of hashed masonry blocks at ±0.66 off the centreline, topped at
        // rail level with a moss course — this is what makes the channel read as
        // a built canal through a ruin rather than a flume in a park.
        {
          const kerb: MergedBoxSpec[] = [];
          const kerbD: MergedBoxSpec[] = [];
          const moss: MergedBoxSpec[] = [];
          const N = Math.max(48, Math.round(total / 0.34));
          for (let i = 0; i < N; i += 1) {
            const f = ride.frameAt(i / N);
            const gy = groundAt(f.p.x, f.p.z);
            const yaw = yawOf(f);
            for (const s of [-1, 1] as const) {
              const bx = f.p.x + f.side.x * s * 0.66;
              const bz = f.p.z + f.side.z * s * 0.66;
              const h1 = hash01(i * 2.3 + (s > 0 ? 5 : 11));
              const h2 = hash01(i * 4.7 + (s > 0 ? 3 : 7));
              const top = f.p.y + 0.02 + (h1 - 0.5) * 0.05;
              const hh = Math.max(0.14, top - gy + 0.16);
              const spec: MergedBoxSpec = {
                dims: [0.3 + h2 * 0.1, hh, 0.36 + h1 * 0.1],
                pos: [bx, top - hh / 2, bz],
                rotY: yaw + (h1 - 0.5) * 0.14,
                repeat: [1, 2],
              };
              // ⚠️ THE REVETMENT TONE RUNS IN COURSES, NOT PER STONE. A per-block
              // `h2 > 0.55` roll put light and dark blocks in an even alternation
              // all the way round a 26-u channel, and from the park's ~50° camera
              // that is not masonry — it is a DASHED KERB, a zebra edging round a
              // pond (the rubric's repetition artefact; Emberfall's oxblood stripe
              // and Brasswork's grate bars are the same failure in other shapes).
              // Real revetment weathers in RUNS: a low-frequency function of the
              // arc parameter, hash-ragged at the joins.
              const runK = 0.5 + 0.36 * Math.sin((i / N) * Math.PI * 2 * 5.3 + s * 1.1) + 0.2 * Math.sin((i / N) * Math.PI * 2 * 11.7);
              (runK + (h2 - 0.5) * 0.3 > 0.62 ? kerbD : kerb).push(spec);
              // a moss course, in RUNS for the same reason — `i % 3` is a hard
              // 3-block rhythm and reads as dashes of its own
              if (runK + (h1 - 0.5) * 0.4 < 0.46)
                moss.push({
                  dims: [0.26, 0.05, 0.3],
                  pos: [bx - f.side.x * s * 0.06, top + 0.03, bz - f.side.z * s * 0.06],
                  rotY: yaw + (h2 - 0.5) * 0.3,
                });
            }
          }
          g.add(mergedBoxes(t, kerb, STONE, { tex: 'concrete', repeat: [2, 1], rough: 0.94, bump: 0.07 }));
          g.add(mergedBoxes(t, kerbD, STONE_D, { tex: 'concrete', repeat: [2, 1], rough: 0.95, bump: 0.07 }));
          const mm = mergedBoxes(t, moss, MOSS, { tex: 'fabric', rough: 0.96, bump: 0.06, flat: true });
          mm.castShadow = false;
          mm.userData.lodDetail = true;
          g.add(mm);
        }

        // ---- 5. THE WATER: one still ribbon round the whole channel ------
        // amp 0.06 × waviness 0.22 ≈ 0.013 of swell: what a sheltered channel
        // does on a windless night. A DARK liner strip under it is what makes
        // the water read as deep (the inverse of the tide-pool rule — a pale
        // bottom reads shallow, a dark one reads bottomless).
        const RIBBON_N = 260;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        const liner: MergedBoxSpec[] = [];
        for (let k = 0; k <= RIBBON_N; k += 1) {
          const u = k / RIBBON_N;
          const f = ride.frameAt(u);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, 0.03), side: f.side.clone(), up: f.up.clone() });
          if (k % 3 === 0) {
            const m = new t.Matrix4().makeRotationY(yawOf(f));
            m.setPosition(f.p.x, f.p.y - 0.075, f.p.z);
            liner.push({ dims: [0.84, 0.04, 0.42], matrix: m });
          }
        }
        const chanWater = buildWaterRibbon(t, ribbonPts, 0.74, { amp: 0.06, waviness: 0.22 });
        // RE-TINTED, not re-shadered. WaterTile's ribbon ships the lagoon
        // blue-grey the seaside worlds use, and against moss and violet stone it
        // read as a swimming pool cut through a forest. The material exposes its
        // three ramp colours as uniforms, so the glade just writes its own into
        // them: a green-black still water over a dark bed. Everything else — the
        // swell octaves, the night dim, the fog sync — is the kit's, unchanged.
        {
          const u = (chanWater.mesh.material as THREE.ShaderMaterial).uniforms;
          (u.uShallow.value as THREE.Color).setHex(0x4e5f4a);
          (u.uMid.value as THREE.Color).setHex(0x2b3a30);
          (u.uDeep.value as THREE.Color).setHex(0x18231c);
        }
        g.add(chanWater.mesh);
        const lin = mergedBoxes(t, liner, 0x22301f, { rough: 0.9 });
        lin.castShadow = false;
        g.add(lin);

        // ---- 6. THE RUIN — the arch across the channel, and its ruins ----
        // The lantern's real PointLight is added as a CHILD of the arch group at
        // the arch's own `lampAt` contract point, so no world-space arithmetic
        // has to be re-derived here and it follows any layout.
        const archLight = new t.PointLight(LANTERN, 0, 7.0, 2);
        {
          const arch = buildRuinArch(t, { seed: 3, lamps: lampMats });
          arch.position.set(archF.p.x, archF.p.y, archF.p.z);
          arch.rotation.y = yawOf(archF);
          const al = arch.userData.lampAt as [number, number, number];
          archLight.position.set(al[0], al[1] - 0.08, al[2]);
          arch.add(archLight);
          g.add(arch);
          // the FALLEN VOUSSOIR, lying on the bank beside the arch
          const fx = archF.p.x + archF.side.x * 1.6;
          const fz = archF.p.z + archF.side.z * 1.6;
          g.add(
            box(t, [0.28, 0.24, 0.5], STONE, [fx, bankY(fx, fz) + 0.12, fz], {
              tex: 'concrete',
              repeat: [1, 1],
              rough: 0.94,
              bump: 0.07,
              rotY: 0.6,
              rotZ: 0.3,
            }),
          );
        }

        // ---- the RUINED WALL, standing on the outboard bank of the willow
        // reach, with a real arched WINDOW the camera sees the glade through ----
        {
          const wf = ride.frameAt(0.3);
          const s = outSign(wf);
          const wx = wf.p.x + wf.side.x * s * 2.0;
          const wz = wf.p.z + wf.side.z * s * 2.0;
          const wall = new t.Group();
          wall.position.set(wx, bankY(wx, wz), wz);
          wall.rotation.y = yawOf(wf);
          g.add(wall);
          const blocks: MergedBoxSpec[] = [];
          const dark: MergedBoxSpec[] = [];
          const moss: MergedBoxSpec[] = [];
          // the wall runs along its local z, 2.5 long, with a broken skyline
          for (let i = 0; i < 9; i += 1) {
            const lz = -1.25 + i * 0.3;
            // the skyline steps down toward both ends — a wall with a level top
            // reads as a garden wall, never as a ruin
            const top = 1.9 - Math.abs(i - 3.4) * 0.24 - hash01(i * 3.1) * 0.2;
            let y = 0;
            let k = 0;
            while (y < top) {
              const bh = 0.19 + hash01(i * 5.3 + k * 2.1) * 0.08;
              // the WINDOW: a void from y 0.62 to 1.24 over 0.6 of length
              const inWindow = lz > -0.32 && lz < 0.3 && y + bh > 0.62 && y < 1.24;
              if (!inWindow) {
                const spec: MergedBoxSpec = {
                  dims: [0.44 + hash01(i + k * 7) * 0.08, bh, 0.31],
                  pos: [(hash01(i * 7 + k) - 0.5) * 0.05, y + bh / 2, lz],
                  rotY: (hash01(i * 11 + k) - 0.5) * 0.08,
                  repeat: [2, 1],
                };
                (hash01(i * 13 + k * 3) > 0.6 ? dark : blocks).push(spec);
              }
              y += bh;
              k += 1;
            }
            if (hash01(i * 17) > 0.4) moss.push({ dims: [0.4, 0.05, 0.3], pos: [0, top + 0.02, lz], rotY: hash01(i * 19) * 3 });
          }
          // the window's arched head, five little voussoirs
          for (let k = 0; k < 5; k += 1) {
            const a = Math.PI * (0.1 + (k / 4) * 0.8);
            const m = new t.Matrix4().makeRotationX(Math.PI / 2 - a);
            m.setPosition(0, 1.24 + Math.sin(a) * 0.16, -0.01 + Math.cos(a) * 0.32);
            blocks.push({ dims: [0.46, 0.16, 0.15], matrix: m });
          }
          wall.add(mergedBoxes(t, blocks, STONE, { tex: 'concrete', repeat: [2, 1], rough: 0.94, bump: 0.07 }));
          wall.add(mergedBoxes(t, dark, STONE_D, { tex: 'concrete', repeat: [2, 1], rough: 0.95, bump: 0.07 }));
          const mm = mergedBoxes(t, moss, MOSS, { tex: 'fabric', rough: 0.96, bump: 0.06, flat: true });
          mm.castShadow = false;
          wall.add(mm);
          for (let k = 0; k < 3; k += 1) {
            const iv = buildIvyStrand(t, 0.8 + hash01(k * 3.7) * 0.7, 41 + k);
            iv.position.set(0.22, 1.1 + hash01(k * 5.1) * 0.5, -0.9 + k * 0.9);
            wall.add(iv);
          }
        }

        // ---- LEANING PLINTHS: three ruined statue bases along the inboard
        // bank of the far reach, each with the stump of a carved figure ----
        for (let k = 0; k < 3; k += 1) {
          const f = ride.frameAt(archU + (k - 1) * 0.075);
          const s = -outSign(f); // INBOARD, so they frame the arch from inside
          const px = f.p.x + f.side.x * s * 1.35;
          const pz = f.p.z + f.side.z * s * 1.35;
          const gy = bankY(px, pz);
          const lean = (hash01(k * 4.3 + 7) - 0.5) * 0.28;
          const plinth: MergedBoxSpec[] = [
            { dims: [0.46, 0.16, 0.46], pos: [0, 0.08, 0], repeat: [2, 1] },
            { dims: [0.38, 0.5, 0.38], pos: [0, 0.41, 0], repeat: [2, 2] },
            { dims: [0.44, 0.1, 0.44], pos: [0, 0.71, 0], repeat: [2, 1] },
          ];
          // the stump: legs and a broken torso, never a whole statue
          const figure: MergedBoxSpec[] = [
            { dims: [0.1, 0.34, 0.11], pos: [-0.07, 0.93, 0], rotZ: 0.05 },
            { dims: [0.1, 0.3, 0.11], pos: [0.07, 0.91, 0.01], rotZ: -0.04 },
            { dims: [0.24, 0.2 + hash01(k * 9.1) * 0.2, 0.16], pos: [0, 1.2, 0], rotZ: (hash01(k) - 0.5) * 0.2 },
          ];
          const grp2 = new t.Group();
          grp2.position.set(px, gy, pz);
          grp2.rotation.set(lean * 0.5, yawOf(f) + hash01(k * 2.1) * 1.2, lean);
          grp2.add(mergedBoxes(t, plinth, STONE_D, { tex: 'concrete', repeat: [2, 1], rough: 0.95, bump: 0.07 }));
          grp2.add(mergedBoxes(t, figure, STONE, { tex: 'concrete', repeat: [1, 2], rough: 0.9, bump: 0.05 }));
          grp2.add(
            mergedBoxes(
              t,
              [
                { dims: [0.4, 0.05, 0.4], pos: [0, 0.78, 0], rotY: hash01(k * 3.3) * 3 },
                { dims: [0.2, 0.05, 0.2], pos: [0.1, 1.32, 0.05], rotY: hash01(k * 5.9) * 3 },
              ],
              MOSS,
              { tex: 'fabric', rough: 0.96, flat: true },
            ),
          );
          g.add(grp2);
        }

        // ---- 7. THE TREES: four twisted trees leaning over the water -----
        // Every tree stands on the OUTBOARD bank so a camera from inside the loop
        // looks in UNDER the branches instead of at a wall of leaves (DeepDrift's
        // cave-overhang rule), and every canopy is held 1.2 above the RAIL — the
        // barge's lantern hoop tops out 0.93 over the water and a seated rider's
        // head at 0.66, so `clear` is solved per tree against its own footing
        // rather than hard-coded, and it stays correct on a graded terrain.
        const RIDER_CLEAR = 1.2;
        [0.18, 0.27, 0.35, 0.7, 0.9].forEach((u, k) => {
          // KEEP CLEAR OF THE ARCH. A canopy 1.6 units off the channel reaches
          // right over it, and the first pass planted one at u 0.44 whose crown
          // sat in front of the arch's crown from the only camera that can look
          // down the reach at it — the arch simply vanished behind a tree.
          if (Math.abs(u - archU) < 0.14) return;
          const f = ride.frameAt(u);
          const s = outSign(f);
          const off = 1.55 + hash01(k * 3.7) * 0.4;
          const tx = f.p.x + f.side.x * s * off;
          const tz = f.p.z + f.side.z * s * off;
          if (tz > FRONT_CUT) return;
          const footY = bankY(tx, tz);
          const tree = twistedTree(t, 11 + k * 7, {
            height: 2.4 + hash01(k * 5.1) * 0.9,
            lean: 0.5 + hash01(k * 7.3) * 0.35,
            clear: f.p.y + RIDER_CLEAR - footY,
          });
          tree.position.set(tx, footY, tz);
          // local +x is the lean direction: point it AT the channel
          tree.rotation.y = Math.atan2(-f.side.x * s, -f.side.z * s) - Math.PI / 2;
          g.add(tree);
        });

        // ---- 8. THE HOLLOW: toadstools, ferns, rocks, glow-worms ---------
        {
          const glowSpecs: MergedBoxSpec[] = [];
          const fern: MergedBoxSpec[] = [];
          let placed = 0;
          for (let k = 0; k < 120 && placed < 46; k += 1) {
            const h1 = hash01(k * 1.7 + 13);
            const h2 = hash01(k * 3.9 + 29);
            const h3 = hash01(k * 6.3 + 47);
            const ang = h1 * Math.PI * 2;
            const rr = 0.3 + 0.85 * h2;
            const cx = cen.x + Math.cos(ang) * ((x1 - x0) / 2 + PAD) * rr;
            const cz = cen.z + Math.sin(ang) * ((z1 - z0) / 2 + PAD) * rr;
            if (cz > FRONT_CUT - 0.3) continue;
            const d = distToTrack(cx, cz);
            if (d < 0.82 || bankR(cx, cz) > 1.05) continue;
            placed += 1;
            const gy = bankY(cx, cz);
            if (h3 > 0.52) {
              const cl = toadstoolCluster(t, k * 3 + 1, 0.85 + h1 * 0.5, glowMats);
              cl.position.set(cx, gy, cz);
              cl.rotation.y = h2 * 6;
              g.add(cl);
            } else if (h3 > 0.3) {
              // a fern crown
              for (let f2 = 0; f2 < 6; f2 += 1) {
                const fa = (f2 / 6) * Math.PI * 2 + h1 * 2;
                const len = 0.24 + hash01(k * 9 + f2) * 0.2;
                const from = new t.Vector3(cx, gy, cz);
                fern.push(
                  bladeSpec(
                    t,
                    from,
                    from.clone().add(new t.Vector3(Math.cos(fa) * len * 0.75, len * 0.8, Math.sin(fa) * len * 0.75)),
                    0.085,
                    0.018,
                  ),
                );
              }
            } else {
              const rk = buildRock(t, { scale: 0.2 + h1 * 0.22, seed: 300 + k, tint: h2 > 0.5 ? STONE_S : STONE_D });
              rk.position.set(cx, gy - 0.04, cz);
              g.add(rk);
              // moss cap on the boulder
              g.add(
                box(t, [0.24, 0.05, 0.24], MOSS, [cx, gy + 0.16 + h1 * 0.1, cz], { tex: 'fabric', rough: 0.96, flat: true, rotY: h2 * 3 }),
              );
            }
            // GLOW-WORMS: little emissive grains scattered on the bank round
            // whatever landed here — they cost nothing and they are the ride's
            // whole night read at ground level
            for (let w = 0; w < 3; w += 1) {
              const wa = hash01(k * 11 + w) * Math.PI * 2;
              const wr = 0.16 + hash01(k * 13 + w) * 0.42;
              glowSpecs.push({
                dims: [0.022, 0.02, 0.022],
                pos: [cx + Math.cos(wa) * wr, gy + 0.04 + hash01(k * 17 + w) * 0.26, cz + Math.sin(wa) * wr],
                rotY: wa,
              });
            }
          }
          const fm = mergedBoxes(t, fern, IVY_L, { tex: 'fabric', repeat: [1, 2], rough: 0.95, bump: 0.03 });
          fm.userData.lodDetail = true;
          g.add(fm);
          // THE GLOW-WORMS. Their BASE colour is a dull grey-green, not the glow
          // colour: a lit-colour diffuse made every grain read as a white speck
          // of litter across the whole bank by day. The glow is entirely
          // emissive, so by day they are damp specks and after dark they are the
          // ride's ground-level light.
          const wm = mergedBoxes(t, glowSpecs, WORM_D, { rough: 0.55 });
          const wmm = wm.material as THREE.MeshStandardMaterial;
          wmm.emissive = new t.Color(WORM);
          wmm.emissiveIntensity = 0.2;
          glowMats.push(wmm);
          wm.castShadow = false;
          wm.userData.lodDetail = true;
          g.add(wm);
        }

        // ---- 9. LANTERN POSTS on the bank, and the ride's 4 REAL LIGHTS --
        // Four night-gated PointLights, and NOT ONE MORE (the fleet cap): the
        // arch's bracket lantern (added in §6 as a child of the arch, so it
        // follows any layout), the hollow's lantern post, the landing stage's,
        // and the barge's own — the only one that moves. Every other lantern on
        // the ride is emissive glass only.
        const hollowLight = new t.PointLight(LANTERN, 0, 6.6, 2);
        const stageLight = new t.PointLight(LANTERN, 0, 6.6, 2);
        const bargeLight = new t.PointLight(LANTERN, 0, 5.0, 2);
        {
          // four hashed iron CROOK POSTS along the banks, each reaching its
          // lantern out over the water; the third one carries the real light
          [0.2, 0.38, 0.62, 0.84].forEach((u, k) => {
            const f = ride.frameAt(u);
            const s = outSign(f);
            const px = f.p.x + f.side.x * s * 1.0;
            const pz = f.p.z + f.side.z * s * 1.0;
            if (pz > FRONT_CUT) return;
            const gy = bankY(px, pz);
            const H = 1.25 + hash01(k * 5.7) * 0.25;
            const grp2 = new t.Group();
            grp2.position.set(px, gy, pz);
            grp2.rotation.y = Math.atan2(-f.side.x * s, -f.side.z * s);
            const bars: MergedBoxSpec[] = [
              { dims: [0.075, H, 0.075], pos: [0, H / 2, 0], repeat: [1, 4] },
              { dims: [0.17, 0.07, 0.17], pos: [0, 0.035, 0] }, // base plate
            ];
            // the crook: three short bars stepping over the water
            bars.push(barSpec(t, new t.Vector3(0, H, 0), new t.Vector3(0, H + 0.16, 0.14), 0.045));
            bars.push(barSpec(t, new t.Vector3(0, H + 0.16, 0.14), new t.Vector3(0, H + 0.2, 0.36), 0.04));
            bars.push({ dims: [0.05, 0.05, 0.05], pos: [0, H + 0.19, 0.36] });
            grp2.add(mergedBoxes(t, bars, IRON, { tex: 'metal', metal: 0.28, rough: 0.64, bump: 0.04 }));
            // moss climbing the post foot
            grp2.add(
              mergedBoxes(t, [{ dims: [0.13, 0.28, 0.13], pos: [0, 0.16, 0], rotY: 0.4 }], MOSS_D, {
                tex: 'fabric',
                rough: 0.96,
                flat: true,
              }),
            );
            const lam = gladeLantern(t, 1.05);
            lam.group.position.set(0, H - 0.02, 0.36);
            grp2.add(lam.group);
            lampMats.push(lam.glass);
            if (k === 1) {
              hollowLight.position.set(0, H - 0.1, 0.36);
              grp2.add(hollowLight); // a child of the post, so it needs no world maths
            }
            g.add(grp2);
          });
        }

        // ---- 10. THE LANDING STAGE --------------------------------------
        // Local frame: +z runs along the station straight, +x is the BOARDING
        // side (which is the ride's own local +z, where the queue comes from).
        {
          const yard = new t.Group();
          yard.position.set(st0.p.x, groundAt(st0.p.x, st0.p.z), st0.p.z);
          yard.rotation.y = yawOf(st0);
          g.add(yard);
          const deckTop = st0.p.y + 0.04;
          const DX = 1.0;
          const DZ = 1.15;
          // the plank deck on its piles
          yard.add(box(t, [0.95, 0.1, 2.2], TIMBER, [DX, deckTop - 0.05, DZ], { tex: 'wood', repeat: [3, 6], rough: 0.92, bump: 0.03 }));
          const deck: MergedBoxSpec[] = [];
          [0.62, 1.38].forEach((x) => deck.push({ dims: [0.12, 0.12, 2.2], pos: [x, deckTop - 0.16, DZ], repeat: [1, 5] }));
          [0.2, 1.15, 2.1].forEach((z) =>
            [0.62, 1.38].forEach((x) =>
              deck.push({ dims: [0.15, Math.max(0.12, deckTop - 0.2), 0.15], pos: [x, Math.max(0.06, deckTop - 0.2) / 2, z], repeat: [1, 3] }),
            ),
          );
          // three steps down off the deck's far end, onto the bank
          [0, 1, 2].forEach((k) => deck.push({ dims: [0.66, 0.07, 0.24], pos: [1.1, deckTop - 0.09 - k * 0.15, 2.36 + k * 0.14], repeat: [2, 1] }));
          // a low guard rail along the OUTER edge only (the channel side stays
          // open — that is where the barge comes alongside)
          [0.32, 0.66].forEach((y) => deck.push({ dims: [0.07, 0.06, 2.2], pos: [1.5, deckTop + y, DZ], repeat: [1, 5] }));
          [0.2, 1.15, 2.1].forEach((z) => deck.push({ dims: [0.09, 0.72, 0.09], pos: [1.5, deckTop + 0.36, z], repeat: [1, 2] }));
          yard.add(mergedBoxes(t, deck, TIMBER_D, { tex: 'wood', repeat: [1, 2], rough: 0.92, bump: 0.03 }));
          // the canopy: four posts, two beams, a shingled saddle roof
          const posts: MergedBoxSpec[] = [];
          [0.66, 1.36].forEach((x) => [0.3, 2.0].forEach((z) => posts.push({ dims: [0.11, 1.32, 0.11], pos: [x, deckTop + 0.66, z], repeat: [1, 3] })));
          [0.3, 2.0].forEach((z) => posts.push({ dims: [0.95, 0.1, 0.11], pos: [DX, deckTop + 1.3, z], repeat: [3, 1] }));
          posts.push({ dims: [0.1, 0.1, 2.3], pos: [DX, deckTop + 1.48, DZ], repeat: [1, 6] }); // ridge
          // carved brackets in the corners — the glade is a built place
          [0.66, 1.36].forEach((x) =>
            [0.3, 2.0].forEach((z) =>
              posts.push({ dims: [0.09, 0.2, 0.2], pos: [x, deckTop + 1.16, z + (z < 1 ? 0.18 : -0.18)], rotX: (z < 1 ? -1 : 1) * 0.7 }),
            ),
          );
          yard.add(mergedBoxes(t, posts, TIMBER, { tex: 'wood', repeat: [1, 3], rough: 0.9, bump: 0.03 }));
          // shingled roof panels + a moss course on the ridge
          const roof: MergedBoxSpec[] = [];
          for (const sx of [-1, 1] as const)
            roof.push({ dims: [0.72, 0.06, 2.5], pos: [DX + sx * 0.28, deckTop + 1.4, DZ], rotZ: -sx * 0.42, repeat: [3, 8] });
          yard.add(mergedBoxes(t, roof, 0x4c4034, { tex: 'wood', rough: 0.94, bump: 0.05 }));
          yard.add(
            mergedBoxes(
              t,
              [{ dims: [0.24, 0.06, 2.4], pos: [DX, deckTop + 1.53, DZ], repeat: [1, 8] }],
              MOSS_D,
              { tex: 'fabric', rough: 0.96, flat: true },
            ),
          );
          // two lanterns hung under the ridge (the stage light rides with them)
          [0.6, 1.7].forEach((z, i) => {
            const lam = gladeLantern(t, 1.0);
            lam.group.position.set(DX, deckTop + 1.16, z);
            yard.add(lam.group);
            lampMats.push(lam.glass);
            if (i === 0) {
              stageLight.position.set(DX, deckTop + 1.0, z);
              yard.add(stageLight);
            }
          });
          // mooring bollards + a rope loop, and the ferryman's lamp store
          const kit: MergedBoxSpec[] = [];
          [0.35, 1.95].forEach((z) => {
            kit.push({ dims: [0.13, 0.34, 0.13], pos: [0.56, deckTop + 0.17, z], repeat: [1, 2] });
            kit.push({ dims: [0.19, 0.06, 0.19], pos: [0.56, deckTop + 0.36, z] });
          });
          yard.add(mergedBoxes(t, kit, TIMBER_D, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          const ropeMat = mat(t, 0x9a8b68, { tex: 'fabric', rough: 0.96 });
          yard.add(
            sagLine(t, new t.Vector3(0.56, deckTop + 0.34, 0.35), new t.Vector3(0.56, deckTop + 0.34, 1.95), 0.16, 0.017, ropeMat),
          );
          // a notice board with a lantern-lit plaque, and crates of spare glass
          const shed: MergedBoxSpec[] = [
            { dims: [0.9, 0.06, 0.6], pos: [2.15, deckTop + 0.76, 1.9], rotX: -0.24, repeat: [3, 2] },
            { dims: [0.1, 0.8, 0.1], pos: [1.78, deckTop + 0.4, 1.9], repeat: [1, 3] },
            { dims: [0.1, 0.8, 0.1], pos: [2.52, deckTop + 0.4, 1.9], repeat: [1, 3] },
          ];
          yard.add(mergedBoxes(t, shed, TIMBER_D, { tex: 'wood', repeat: [2, 2], rough: 0.92, bump: 0.04 }));
          const crates: MergedBoxSpec[] = [];
          for (let k = 0; k < 4; k += 1) {
            const h1 = hash01(k * 6.7 + 5);
            crates.push({
              dims: [0.34 + h1 * 0.1, 0.28, 0.34 + h1 * 0.08],
              pos: [2.2 + (h1 - 0.5) * 0.4, 0.14 + Math.floor(k / 2) * 0.28, 0.5 + (k % 2) * 0.44],
              rotY: (h1 - 0.5) * 0.6,
              repeat: [2, 1],
            });
          }
          yard.add(mergedBoxes(t, crates, TIMBER_D, { tex: 'wood', rough: 0.94, bump: 0.04 }));

          // THE FERRYMAN'S KIT: spare punt poles leaning in the corner, a
          // lamp-oil barrel, a bucket. There is deliberately NO second barge —
          // a spare hull cannot lie in the channel (that is where the live one
          // parks when the motion gate closes) and hauled out on the bank it read
          // as a second live boat adrift inside the loop.
          const kit2: MergedBoxSpec[] = [];
          for (let k = 0; k < 4; k += 1)
            kit2.push(
              barSpec(
                t,
                new t.Vector3(1.86 + k * 0.055, 0.02, 2.42),
                new t.Vector3(1.62 + k * 0.05, 1.34 + k * 0.04, 2.06),
                0.03,
                [1, 4],
              ),
            );
          yard.add(mergedBoxes(t, kit2, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          yard.add(
            cyl(t, 0.19, 0.21, 0.42, TIMBER_D, [2.62, 0.21, 1.22], { tex: 'wood', repeat: [4, 1], rough: 0.92, bump: 0.04, seg: 12 }),
          );
          yard.add(
            mergedBoxes(
              t,
              [
                { dims: [0.42, 0.05, 0.42], pos: [2.62, 0.44, 1.22], rotY: 0.3 },
                { dims: [0.44, 0.05, 0.06], pos: [2.62, 0.13, 1.22], repeat: [2, 1] },
                { dims: [0.44, 0.05, 0.06], pos: [2.62, 0.33, 1.22], repeat: [2, 1] },
              ],
              IRON,
              { tex: 'metal', metal: 0.28, rough: 0.68 },
            ),
          );
        }

        // ---- 11. THE BARGE ----------------------------------------------
        const bargeLamps: THREE.MeshStandardMaterial[] = [];
        const barge = buildMoonlitBargeBoat(t, BARGE_LIVERY, { riders: opts.riders ?? true, seats: seatAnchors, lamps: bargeLamps });
        const la = barge.userData.lampAt as [number, number, number];
        bargeLight.position.set(la[0], la[1], la[2]);
        barge.add(bargeLight);
        g.add(barge);
        extras.vehicle = barge;
        seatWorld = makeSeatWorld(t, seatAnchors);

        // ---- 12. EFFECTS: 220 particles over 2 emitters ------------------
        // MOTES drifting up off the water — additive, so they read as specks
        // catching the lantern light rather than as smoke.
        const moteFx = buildEmitter(t, {
          max: 120,
          rate: 22,
          life: 5.4,
          lifeVar: 1.6,
          velocity: [0, 0.16, 0],
          spread: 0.5,
          gravity: -0.01,
          size: 0.05,
          sizeEnd: 0.09,
          color: 0xfff0c0,
          colorEnd: WORM_D,
          opacity: 0.42,
          additive: true,
        });
        moteFx.setOrigin(cen.x, st0.p.y + 0.6, cen.z + (z0 - cen.z) * 0.4);
        g.add(moteFx.points);
        // a low MIST lying on the channel — not additive: mist occludes
        const mistFx = buildEmitter(t, {
          max: 100,
          rate: 11,
          life: 8.5,
          lifeVar: 2.2,
          velocity: [0.06, 0.015, 0.04],
          spread: 0.6,
          gravity: -0.002,
          size: 0.4,
          sizeEnd: 0.8,
          color: 0xa8b4a2,
          colorEnd: 0x7d8a7c,
          opacity: 0.15,
        });
        mistFx.setOrigin(archF.p.x, archF.p.y + 0.1, archF.p.z);
        g.add(mistFx.points);

        // ---- 13. the drift + the updater --------------------------------
        // The barge is MOTION-GATED (a registered ride lies at the stage while
        // guests board — RCT2's Vehicle.cpp status cycle); the water, the mist,
        // the glow-worms and every lantern run off the REAL clock outside the
        // gate, so a parked barge is not a frozen glade.
        const LAP = total / DRIFT_V;
        g.userData.lap = LAP;
        const mtx4 = new t.Matrix4();

        // THE STATION LOCK. ⚠️ `rideDuration` IS NOT THE LAP. createMotionGate
        // keeps integrating its clock through the spin-UP of `departing` (whose
        // length is `loadTime`, which configurableRide defaults to 1.6, not the
        // FSM's bare 1.0) and through the eased brake of `arriving`, so the
        // clock advance per dispatch is  1.2 + rideDuration + 0.67, not
        // rideDuration. Registered at 15 against a 15.05 s lap the barge
        // therefore overshot every dispatch and PARKED SOMEWHERE NEW each time:
        // measured over 8 cycles the nearest seat sat 0.5 / 2.4 / 4.5 / 6.5 /
        // 5.9 / 6.4 / 5.2 / 3.4 u from the boarding pad — right round the
        // channel, with guests boarding a barge that is not at the stage.
        // Cancelling the surplus in `rideDuration` alone leaves an unbounded
        // creep (0.065 u a cycle at the best value), so the barge instead COMES
        // ALONGSIDE and stays there: the drift arc is clamped so it can never
        // pass the parked pose while the FSM is braking it in, and resumes only
        // on dispatch. Exact and dt-independent, because the drift is analytic.
        //
        // The pose is DERIVED: the arc of the point nearest the boarding pad the
        // composable publishes. Measured there — nearest seat 0.185 u, mean
        // 0.722, against 0.705 / 1.317 at the raw build pose.
        const boardLocal = new t.Vector3(...BOARD);
        let stopS = 0;
        let stopD = Infinity;
        for (let i = 0; i < 720; i += 1) {
          const s = (i / 720) * total;
          const d = ride.frameAt(s / total).p.distanceTo(boardLocal);
          if (d < stopD) {
            stopD = d;
            stopS = s;
          }
        }
        g.userData.stationStop = { s: stopS };
        let railS = stopS; // arc of the hull; the barge parks HERE
        let lastClock: number | null = null;
        let gated = false; // only a REGISTERED ride parks — a preview drifts on
        let braking = false;

        const gate = createMotionGate(
          (clock) => {
            const dc = lastClock === null ? 0 : Math.max(0, clock - lastClock);
            lastClock = clock;
            if (gated && !opts.still) {
              let adv = dc * DRIFT_V;
              if (braking) {
                // room left to the stage: a clamp, so the hull comes alongside
                // and cannot drift past it however the frame time falls
                const room = (((stopS - railS) % total) + total) % total;
                adv = Math.min(adv, room);
              }
              railS = (railS + adv) % total;
            }
            const ph = opts.still ? (opts.phase0 ?? 0) : clock + (opts.phase0 ?? 0);
            const s = gated && !opts.still ? railS : (ph * DRIFT_V) % total;
            const f = ride.frameAt((s / total) % 1);
            barge.position.copy(f.p).addScaledVector(f.up, -0.03); // 0.03 of draught
            mtx4.makeBasis(f.side, f.up, f.fwd);
            barge.setRotationFromMatrix(mtx4);
            // the barge breathes on the water: a slow hashed roll and pitch,
            // applied AFTER the frame basis so it composes with the banking
            // (keyed off `ph`, so a `still` frame is byte-reproducible)
            barge.rotateZ(0.022 * Math.sin(ph * 0.9) + 0.012 * Math.sin(ph * 1.7 + 1.1));
            barge.rotateX(0.014 * Math.sin(ph * 1.3 + 0.4));
            barge.position.y += 0.008 * Math.sin(ph * 1.1);
          },
          { spinDown: 1.5 },
        );
        onStateChange = (state: string) => {
          gated = true;
          braking = !(state === 'departing' || state === 'travelling');
          gate.onStateChange(state);
        };

        return (time: number) => {
          chanWater.update(time); // the water moves whatever the ride does
          const nk = nightKOf(g);
          const ease = smooth(nk);
          const flick = 1 + 0.1 * Math.sin(time * 6.7) + 0.06 * Math.sin(time * 11.9 + 1.3);
          // the lanterns: purely night-gated, with a candle flicker
          archLight.intensity = 2.7 * ease * flick;
          hollowLight.intensity = 2.3 * ease * flick;
          stageLight.intensity = 2.5 * ease * flick;
          bargeLight.intensity = 1.9 * ease * (1 + 0.08 * Math.sin(time * 8.3));
          for (const m of lampMats) m.emissiveIntensity = 0.14 + 2.5 * ease * flick;
          for (const m of bargeLamps) m.emissiveIntensity = 0.16 + 2.6 * ease * flick;
          // GLOW-WORMS breathe, and they never gate fully to zero: a glow-worm
          // is alive at noon too, it is just outshone (LavaTubeRun's lava rule).
          const breathe = 0.84 + 0.16 * Math.sin(time * 0.7) + 0.07 * Math.sin(time * 1.9 + 0.9);
          for (let i = 0; i < glowMats.length; i += 1)
            glowMats[i].emissiveIntensity = (0.2 + 2.0 * ease) * breathe * (0.85 + 0.25 * Math.sin(time * 1.1 + i * 0.8));
          moteFx.update(time);
          mistFx.update(time);
          gate.update(time);
        };
      })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const MoonlitBargeBase = composableRide<MoonlitBargeOpts & { register?: boolean }>(
  'MoonlitBarge',
  (t, props) =>
    buildMoonlitBargeScene(t, {
      pieces: props.pieces,
      groundAt: props.groundAt,
      archU: props.archU,
      phase0: props.phase0,
      still: props.still,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the four bench places (capacity 4 = 4 seats)
      riders: props.riders ?? !props.register,
    }),
  {
    // the station straight runs along the local −x and every compiled point has
    // z ≤ 0, so the local +z face is free for the queue lane and the huts (the
    // bank is cut off at +z 1.7 to keep it that way)
    front: 2.1,
    exit: [1.9, 2.1],
    board: BOARD,
    // rideDuration 13.7, NOT the 15.05 s lap: the gate adds 1.87 s of ramp
    // integral to every dispatch, so 13.7 + 1.87 = 15.57 carries the hull just
    // PAST the stage and §13's station lock clamps it alongside. Registering the
    // lap itself parked the barge up to 6.5 u away, round the channel.
    defaults: { name: 'The Moonlit Barge', capacity: 4, rideDuration: 13.7, intensity: 1, price: 3 },
  },
);

/** <MoonlitBarge> — Thornwick Glade's lantern-lit boat drift as a composable
 *  ride (components/Park/Context.md): mounts at `position` / `rotation`; inside
 *  a <Park>, `register` wires the full GameManager ride via <ConfigurableRide>
 *  — queue HEAD 2.1 out the local +z front, exit hut at local [1.9, 2.1],
 *  boarding on the landing stage.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Straight/><TurnR/>…` — children win) are compiled by
 *  `compileTrackPieces` on the 'flume' profile and swept by `buildRideSpline`;
 *  no pieces = the stock "Lantern Round", a LEVEL circuit with no lift and no
 *  drop in it. A FATAL compile marks the build `invalid` so a broken circuit
 *  never registers. The barge is the ride `vehicle` (onboard cam) and its four
 *  bench places are live `seatWorld` anchors, so REAL guests drift the glade. */
export const MoonlitBarge: React.FC<ComposableRideProps & MoonlitBargeOpts & { children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <MoonlitBargeBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
