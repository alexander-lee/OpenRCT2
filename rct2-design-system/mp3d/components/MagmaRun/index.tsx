import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWater, buildWaterRibbon, LAVA } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// MagmaRun — "Magma Run", the flagship water ride of the EMBERFALL CALDERA:
// an RCT2 log flume threaded through a BASALT CANYON with a live magma fissure
// network running alongside, underneath and right through it.
//
// SAME SPLINE MACHINERY as every other tracked ride: `compileTrackPieces` on
// the 'flume' profile compiles the circuit, `buildRideSpline` sweeps the
// wooden U-channel trough, `run` drifts the boat and plunges it down the
// chute. Everything else here is THEMING derived from frame scans, so it
// follows ANY layout the caller passes in `pieces` / piece children.
//
// THE LAVA LOOK IS THE VOLCANO'S LOOK (components/Volcano/Context.md), ported
// deliberately so the whole land reads as one place. Real cooled lava is
// mostly BLACK — the light comes out of the CRACKS between the crust plates:
//   * one procedural Voronoi CRUST FIELD baked into TWO canvases (a dark
//     plate/groove albedo that doubles as the bump map, and a black-with-
//     bright-cracks emissive map), so every magma surface is `color:
//     near-black` + `emissiveMap: cracks` and only the fissure network lights.
//   * a TEMPERATURE GRADIENT down every channel: white-yellow (~1100 °C) at
//     the source through yellow-orange, orange, deep red to black basalt.
//   * SLOW MOTION only — a ~15 s breath of the crack glow, a travelling wave
//     down each channel, and a ~0.02 u/s crawl of the crust texture.
//   * DAY *AND* NIGHT: `nightKOf` lerps the emissive multiplier between a
//     daylight value and a night value. Lava is NEVER gated to zero — that is
//     the house rule for lava in this system.
//
// What makes it MAGMA RUN and not a re-skinned flume: a STEPPED basalt canyon
// cut either side of the trough (kerb → cutting wall → outer ridge, plus
// boulder scatter, cinder scree and an ash apron under the whole footprint), a
// MOLTEN CALDERA FLOOR filling the loop's interior in three temperature bands
// under drifting crustal rafts, a ground magma channel running BENEATH the
// elevated conveyor and chute and FLANKING the low legs, branch fissures
// draining out through gaps blasted in the canyon wall, a rock LAVA TUBE the
// boat runs through lit from within by a magma seam in its floor, a spatter
// cone spilling fresh lava on the rim beside the summit crest, ONE dramatic
// 4.6-unit chute (32° — the steepest a flume ramp can legally hold at this
// height) into a steaming splash run-out, and a hewn TIMBER BOAT: charred
// planking below the waterline, warm scorched topsides, iron banding and a
// carved flame-head prow.
//
// Budget: 4 real PointLights — THREE are the LAVA glow (the caldera floor, the
// chute pool and the lava tube; they burn day AND night, because lava is not a
// lamp) and one is the night-gated station lantern — 3 ParticleKit emitters /
// 220 particles, and every static repeat (canyon, apron, shore, rafts,
// conveyor cleats, ironwork, station) batched through `mergedBoxes`.
// Deterministic — hashed sines only, absolute-time updater.
// ---------------------------------------------------------------------------

/** the compiled station straight runs along the local −x, which leaves the
 *  local +z face (where <ConfigurableRide> puts the queue lane and the huts)
 *  clear of the circuit — every turn in the stock layout is a RIGHT turn, so
 *  the whole loop lives in the local −z half-plane. */
const HEADING = -Math.PI / 2;
/** station rail height above the local ground */
const START: [number, number, number] = [0, 0.6, 0];

/**
 * "Caldera Circuit" — the shipped layout. Five legs of a rectangle:
 *   A (−x)  station · lead-in · CONVEYOR FLIGHT 1 (2.3 u at 23.1°)
 *   B (−z)  CONVEYOR FLIGHT 2 (2.3 u) · level crest beside the spatter cone
 *   C (+x)  THE CHUTE — all 4.6 units back in one plunge at 32.3° — · run-out
 *   D (+z)  the low return leg, which the LAVA TUBE is driven through
 *   → a 1.2-u brake tail landing 0.3 u short of the station on its own axis.
 * Splitting the climb into two flights around a corner is what keeps a
 * 4.6-unit summit inside a 16 × 13 footprint: RCT2's flume table has `slope`
 * (25°) UP but only `slopeSteepDown` (LogFlume.h:26), so conveyors must stay
 * gentle and long while chutes can be steep and short. Verified with the
 * kit's own checks: design clean, worst clearance 3.09, ZERO synthesized
 * closure track (see MagmaRun/Context.md).
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.5 },
  { type: 'lift', height: 2.3, length: 7.5 }, // conveyor flight 1 — 23.1°
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'lift', height: 2.3, length: 7.5 }, // conveyor flight 2
  { type: 'straight', length: 0.8 }, // level crest (RCT2 tops every ramp with a transition)
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'drop', height: 4.6 }, // THE CHUTE — 32.3°, the legal ceiling at this height
  { type: 'straight', length: 1.74 }, // splash run-out
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'straight', length: 8.72 }, // the low return leg (the lava tube rides here)
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'straight', length: 1.2 }, // brake tail onto the station axis
];

// ---- palette ---------------------------------------------------------------
/** RCT2 TrackColour for the flume trough: warm scorched timber, a lighter
 *  hewn rim rail and dark trestle timber — deliberately WARMER than the rock
 *  so the trough reads against near-black basalt. */
const TRACK_COLOURS: TrackScheme = { main: 0x6b4a2e, additional: 0x8a6238, supports: 0x4a3524 };
/** the boat: warm scorched topside planking, iron banding, hewn cut wood */
const BOAT_LIVERY: VehicleScheme = { body: 0x6f4526, trim: 0x9c7440, tertiary: 0x2c2b30 };
const CHAR = 0x241a14; // charred planking below the waterline
const IRON = 0x2c2b30; // banding, hoops, cleats
const BASALT = 0x4a423a; // the canyon's cut rock (mid tone — near-black read as a void)
const BASALT_L = 0x5a5148; // the sun-caught cutting wall behind it
const BASALT_D = 0x38322c; // shadowed blocks / cinder scree
const ASH = 0x3a332d; // the scorched ground apron
const TIMBER = 0x5a4128; // station structure
const TIMBER_D = 0x453320; // shingles / older timber

// ---------------------------------------------------------------------------
// PROCEDURAL CRUST FIELD (the crack network — the whole magma illusion).
// A jittered-grid Voronoi diagram over a 256² torus: `d2 − d1` is 0 exactly on
// a plate boundary and grows inward, so `exp(-(d2-d1)/w)` draws a soft-
// shouldered crack — a hot core with a glow falloff onto the plate, which is
// how real cooling crust looks. Per-EDGE hashing makes some cracks hotter;
// a few plates keep a hot centre (an incipient breakout). Ported from
// components/Volcano so the caldera's lava all matches. Cached module-level as
// CANVASES, not textures: each channel owns its own CanvasTextures because it
// animates their `offset` for the downhill crawl.
// ---------------------------------------------------------------------------
const hash2 = (a: number, b: number) => hash01(a * 37.19 + b * 91.73 + 3.11);
let _crustPair: { crust: HTMLCanvasElement; crack: HTMLCanvasElement } | null = null;

function crustCanvases(): { crust: HTMLCanvasElement; crack: HTMLCanvasElement } {
  if (_crustPair) return _crustPair;
  const S = 256;
  // 9 x 9 = 81 plates per tile, jittered almost a full cell. A 6 x 6 grid with
  // half-cell jitter tiles VISIBLY over a big surface — the caldera floor came
  // out as a regular orange honeycomb — so the field needs both more plates
  // per tile and enough jitter that no row of plate centres lines up.
  const G = 9;
  const N = G * G;
  const cell = S / G;
  const sx = new Float32Array(N);
  const sy = new Float32Array(N);
  for (let gy = 0; gy < G; gy += 1)
    for (let gx = 0; gx < G; gx += 1) {
      const i = gy * G + gx;
      sx[i] = (gx + 0.06 + hash01(i * 1.7 + 0.3) * 0.88) * cell;
      sy[i] = (gy + 0.06 + hash01(i * 2.9 + 5.1) * 0.88) * cell;
    }
  const crust = document.createElement('canvas');
  const crack = document.createElement('canvas');
  crust.width = crust.height = crack.width = crack.height = S;
  const cxA = crust.getContext('2d')!;
  const cxB = crack.getContext('2d')!;
  const imA = cxA.createImageData(S, S);
  const imB = cxB.createImageData(S, S);
  const A = imA.data;
  const B = imB.data;
  const BASE = [30, 25, 22]; // basalt plate albedo
  for (let py = 0; py < S; py += 1)
    for (let px = 0; px < S; px += 1) {
      let d1 = 1e9;
      let d2 = 1e9;
      let i1 = 0;
      let i2 = 0;
      for (let i = 0; i < N; i += 1) {
        let dx = px - sx[i];
        let dy = py - sy[i];
        if (dx > S / 2) dx -= S; // toroidal wrap keeps the tile seamless
        else if (dx < -S / 2) dx += S;
        if (dy > S / 2) dy -= S;
        else if (dy < -S / 2) dy += S;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          i2 = i1;
          d1 = d;
          i1 = i;
        } else if (d < d2) {
          d2 = d;
          i2 = i;
        }
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      const edgeHeat = 0.34 + 0.66 * hash2(lo, hi);
      // DELIBERATELY NARROW: on real crust the plates are the bulk of the
      // surface and they are black. Widen these and the whole channel
      // collapses into the fake uniform-orange look.
      let g = (0.9 * Math.exp(-e / 1.15) + 0.06 * Math.exp(-e / 3.0)) * edgeHeat;
      if (hash01(i1 * 4.3 + 0.7) > 0.88) g += 0.34 * Math.exp(-Math.sqrt(d1) / (cell * 0.36));
      g = Math.min(1, g);
      const o = (py * S + px) * 4;
      B[o] = B[o + 1] = B[o + 2] = Math.round(255 * g ** 0.85);
      B[o + 3] = 255;
      // albedo: plate tone + speckle, cracks darkened toward black so the SAME
      // canvas works as a bump map (grooves = recessed)
      const tone = (hash01(i1 * 7.7 + 1.9) - 0.5) * 26;
      const grain = (hash2(px * 0.61, py * 0.83) - 0.5) * 16;
      const groove = 1 - 0.72 * Math.exp(-e / 2.2);
      for (let c = 0; c < 3; c += 1) A[o + c] = Math.max(0, Math.min(255, Math.round((BASE[c] + tone + grain) * groove)));
      A[o + 3] = 255;
    }
  cxA.putImageData(imA, 0, 0);
  cxB.putImageData(imB, 0, 0);
  _crustPair = { crust, crack };
  return _crustPair;
}

function texFrom(t: typeof THREE, canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new t.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  return tex;
}

/** the TEMPERATURE RAMP — `u = 0` is the source (~1100 °C), `u = 1` is cold
 *  basalt. Colour AND intensity fall off together: the renderer has no tone
 *  mapping, so intensity > 1 clips the hot channels toward white, which is
 *  physically the right direction (hotter = whiter). */
const HEAT: [number, number, number][] = [
  [0.0, 0xfff0c0, 1.85],
  [0.12, 0xffd166, 1.45],
  [0.28, 0xff9422, 1.08],
  [0.45, 0xf05a12, 0.78],
  [0.62, 0xcb2807, 0.46],
  [0.8, 0x8a1403, 0.22],
  [1.0, 0x280502, 0.035],
];

function heatAt(t: typeof THREE, u: number): { emissive: THREE.Color; intensity: number; crust: THREE.Color } {
  const k = Math.max(0, Math.min(1, u));
  let i = 0;
  while (i < HEAT.length - 2 && k > HEAT[i + 1][0]) i += 1;
  const [t0, c0, e0] = HEAT[i];
  const [t1, c1, e1] = HEAT[i + 1];
  const f = t1 > t0 ? (k - t0) / (t1 - t0) : 0;
  return {
    emissive: new t.Color(c0).lerp(new t.Color(c1), f),
    intensity: e0 + (e1 - e0) * f,
    // fresh crust is a warm dark grey, cooled pahoehoe a dark basalt with a
    // silvery skin — NOT a void, or the cold end reads as a hole in the ground
    crust: new t.Color(0x2e2622).lerp(new t.Color(0x211c19), k),
  };
}

/** the magma material: near-black crust, glow ONLY through the crack map */
function lavaMat(t: typeof THREE, u: number, crustTex: THREE.Texture, crackTex: THREE.Texture): THREE.MeshStandardMaterial {
  const h = heatAt(t, u);
  return new t.MeshStandardMaterial({
    color: h.crust,
    map: crustTex,
    bumpMap: crustTex,
    bumpScale: 0.055,
    emissive: h.emissive,
    emissiveMap: crackTex,
    emissiveIntensity: h.intensity,
    roughness: 0.78,
    metalness: 0.1,
    side: t.DoubleSide, // thin channels are seen edge-on from the DS camera
  });
}

// ---- geometry helpers ------------------------------------------------------
/** flip the winding when a surface came out facing down */
function faceUp(g: THREE.BufferGeometry) {
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  let sy = 0;
  for (let i = 0; i < n.count; i += 1) sy += n.getY(i);
  if (sy < 0) {
    const idx = g.getIndex()!;
    const arr = idx.array as unknown as number[];
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
    g.computeVertexNormals();
  }
}

interface RibbonPt {
  x: number;
  y: number;
  z: number;
  /** unit lateral direction (the ribbon widens along it) */
  dx: number;
  dz: number;
  w: number;
  /** how far the raised centre line rides above the levees */
  lift: number;
}
interface RibbonSeg {
  mat: THREE.MeshStandardMaterial;
  /** normalized position along the ribbon (0 = source) — the gradient key */
  u: number;
  heat: number;
}

/**
 * A magma channel: three columns wide (left levee / raised centre / right
 * levee) so the flow has a rounded cross-section instead of reading as a
 * decal, arc-length UVs so the crust pattern is continuous down the whole
 * channel (and a v-offset drift crawls DOWNHILL), cut into `segs`
 * separately-materialled pieces for the temperature gradient.
 */
function magmaChannel(
  t: typeof THREE,
  pts: RibbonPt[],
  segs: number,
  heat0: number,
  heat1: number,
  crustTex: THREE.Texture,
  crackTex: THREE.Texture,
  tscale: number,
): { group: THREE.Group; segs: RibbonSeg[]; geos: THREE.BufferGeometry[] } {
  const N = pts.length;
  const arc: number[] = [0];
  for (let k = 1; k < N; k += 1) {
    const a = pts[k - 1];
    const b = pts[k];
    arc.push(arc[k - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const total = arc[N - 1] || 1;
  const COLS = [-0.5, 0, 0.5];
  const group = new t.Group();
  const out: RibbonSeg[] = [];
  const geos: THREE.BufferGeometry[] = [];
  for (let j = 0; j < segs; j += 1) {
    const k0 = Math.round((j * (N - 1)) / segs);
    const k1 = Math.round(((j + 1) * (N - 1)) / segs);
    if (k1 <= k0) continue;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let k = k0; k <= k1; k += 1)
      for (let c = 0; c < 3; c += 1) {
        const p = pts[k];
        const off = COLS[c] * p.w;
        pos.push(p.x + p.dx * off, p.y + p.lift * (c === 1 ? 1 : 0.38), p.z + p.dz * off);
        uv.push(off * tscale, arc[k] * tscale);
      }
    const rows = k1 - k0;
    for (let k = 0; k < rows; k += 1)
      for (let c = 0; c < 2; c += 1) {
        const a = k * 3 + c;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
      }
    const g = new t.BufferGeometry();
    g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    faceUp(g);
    const uMid = arc[Math.round((k0 + k1) / 2)] / total;
    const heat = heat0 + (heat1 - heat0) * uMid;
    const m = lavaMat(t, heat, crustTex, crackTex);
    const mesh = new t.Mesh(g, m);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    out.push({ mat: m, u: uMid, heat: heatAt(t, heat).intensity });
    geos.push(g);
  }
  return { group, segs: out, geos };
}

/** an irregular lobed disc (a magma pool): hashed outline, slight dome */
function blobDisc(t: typeof THREE, r0: number, wob: number, dome: number, seed: number, tscale: number, seg = 28, rings = 3): THREE.BufferGeometry {
  const rAt = (az: number) =>
    r0 * (1 + wob * (Math.sin(az * 3 + seed) * 0.55 + Math.sin(az * 5 - seed * 1.7) * 0.3 + Math.sin(az * 7 + 2.1) * 0.15));
  const pos: number[] = [0, dome, 0];
  const uv: number[] = [0, 0];
  const idx: number[] = [];
  for (let k = 1; k <= rings; k += 1) {
    const f = k / rings;
    for (let i = 0; i < seg; i += 1) {
      const az = (i / seg) * Math.PI * 2;
      const r = rAt(az) * f;
      pos.push(Math.cos(az) * r, dome * (1 - f * f), Math.sin(az) * r);
      uv.push(Math.cos(az) * r * tscale, Math.sin(az) * r * tscale);
    }
  }
  for (let i = 0; i < seg; i += 1) idx.push(0, 1 + i, 1 + ((i + 1) % seg));
  for (let k = 1; k < rings; k += 1) {
    const a0 = 1 + (k - 1) * seg;
    const b0 = 1 + k * seg;
    for (let i = 0; i < seg; i += 1) {
      const j = (i + 1) % seg;
      idx.push(a0 + i, b0 + i, a0 + j, a0 + j, b0 + i, b0 + j);
    }
  }
  const g = new t.BufferGeometry();
  g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  faceUp(g);
  return g;
}

/** one merged box spanning A → B (its Y axis runs along the bar) — raking
 *  timbers, the same trick SplineCoaster's trestles use */
function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat?: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, ...(repeat ? { repeat } : {}) };
}

/**
 * Loft a hull-style surface from a list of cross-SECTIONS (each a list of
 * local `[x, y]` points at its own z), over the section index range
 * `i0…i1`. UVs are (girth, along-z) in WORLD units × `uvScale`, so a 'wood'
 * texture's grain runs FORE-AND-AFT — i.e. it reads as PLANKING.
 */
function loft(
  t: typeof THREE,
  stations: { z: number; pts: [number, number][] }[],
  i0: number,
  i1: number,
  material: THREE.Material,
  uvScale: number,
): THREE.Mesh {
  const rows = stations.length;
  const cols = i1 - i0 + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const zArc: number[] = [0];
  for (let r = 1; r < rows; r += 1) zArc.push(zArc[r - 1] + Math.abs(stations[r].z - stations[r - 1].z));
  for (let r = 0; r < rows; r += 1) {
    const st = stations[r];
    let girth = 0;
    for (let c = i0; c <= i1; c += 1) {
      const [x, y] = st.pts[c];
      if (c > i0) {
        const [px, py] = st.pts[c - 1];
        girth += Math.hypot(x - px, y - py);
      }
      pos.push(x, y, st.z);
      uv.push(girth * uvScale, zArc[r] * uvScale);
    }
  }
  for (let r = 0; r < rows - 1; r += 1)
    for (let c = 0; c < cols - 1; c += 1) {
      const a = r * cols + c;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  const g = new t.BufferGeometry();
  g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new t.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
// THE BOAT — a hewn TIMBER log-boat, not a plastic tub and not a metal pod.
//
// A real lofted hull: 15 cross-sections from a canoe stern (z −0.76) to a
// raked stem (z +0.78), each 9 points from sheer down over the turn of the
// bilge to a slight keel vee, with ROCKER (the bottom rises 0.135 toward each
// end) and SHEER (the gunwale rises toward the bow). Three lofts share those
// sections so the hull carries a hard scorch line at the waterline:
//   * topsides (sheer → mid strake) in warm scorched timber
//   * everything below (mid strake → keel → mid strake) in CHARRED near-black
// then swept cut-wood gunwale caps + a mid-strake plank batten, three wrought
// IRON BANDS chorded round the sections, a raked stem with a carved FLAME-HEAD
// prow (ember eyes), a stern post, and a charred interior with four hewn
// thwarts. Origin y = 0 is the thwart datum; the hull rides at the flume
// profile's own wheelOffset 0.25, which puts the keel 0.05 above the trough
// floor and the waterline (world 0.035) 0.11 up the charred band.
// ---------------------------------------------------------------------------
const BOW = 0.78;
const STERN = -0.76;
const SEAT_Z = [-0.45, -0.15, 0.15, 0.45];
/** hips sit 0.45 × scale above a seated buildPeep's group origin (Teacups) */
const HIP_RISE = 0.45 * 0.42;
const THWART_TOP = 0.02;

const hwOf = (z: number) => Math.max(0.05, 0.26 * (1 - Math.min(1, Math.abs(z) / 0.86) ** 2.4));
const botOf = (z: number) => -0.3 + 0.135 * Math.min(1, Math.abs(z) / 0.78) ** 2;
const shrOf = (z: number) => 0.14 + (z > 0 ? 0.15 : 0.09) * Math.min(1, Math.abs(z) / 0.78) ** 2;
/** the 9-point cross-section at z: [sheer, mid, bilge, garboard, keel, …] */
function sectionAt(z: number): [number, number][] {
  const hw = hwOf(z);
  const b = botOf(z);
  const s = shrOf(z);
  const d = s - b;
  return [
    [-hw, s],
    [-hw * 0.93, b + 0.45 * d],
    [-hw * 0.78, b + 0.14 * d],
    [-hw * 0.5, b],
    [0, b - 0.02],
    [hw * 0.5, b],
    [hw * 0.78, b + 0.14 * d],
    [hw * 0.93, b + 0.45 * d],
    [hw, s],
  ];
}

export interface TimberBoatOpts {
  /** decorative seated riders (default true — <MagmaRun register> turns them
   *  OFF so REAL GameManager guests fill the thwarts through seatWorld) */
  riders?: boolean;
  /** seat anchors are pushed here in thwart order (bow-last), for seatWorld */
  seats?: THREE.Object3D[];
}

/** The hewn timber boat. Exported for parks composing their own fleets. */
export function buildTimberBoat(t: typeof THREE, scheme?: VehicleScheme, opts: TimberBoatOpts = {}): THREE.Group {
  const boat = new t.Group();
  const PLANK = scheme?.body ?? BOAT_LIVERY.body!;
  const CUT = scheme?.trim ?? BOAT_LIVERY.trim!;
  const BAND = scheme?.tertiary ?? IRON;
  const stations: { z: number; pts: [number, number][] }[] = [];
  for (let k = 0; k <= 14; k += 1) {
    const z = STERN + ((BOW - STERN) * k) / 14;
    stations.push({ z, pts: sectionAt(z) });
  }

  // ---- the hull: charred bottom, scorched topsides ----
  const charMat = mat(t, CHAR, { tex: 'wood', rough: 0.95, bump: 0.035 });
  charMat.side = t.DoubleSide;
  boat.add(loft(t, stations, 1, 7, charMat, 5));
  const topMat = mat(t, PLANK, { tex: 'wood', rough: 0.88, bump: 0.03 });
  topMat.side = t.DoubleSide;
  boat.add(loft(t, stations, 0, 1, topMat, 5));
  const topMat2 = mat(t, PLANK, { tex: 'wood', rough: 0.88, bump: 0.03 });
  topMat2.side = t.DoubleSide;
  boat.add(loft(t, stations, 7, 8, topMat2, 5));

  // ---- swept rails: cut-wood gunwale caps (section 0 / 8) and the mid-strake
  // plank batten (section 1 / 7) — tubes that HUG the hull through the tapers
  ([
    [0, 0.028, CUT],
    [8, 0.028, CUT],
    [1, 0.016, CHAR],
    [7, 0.016, CHAR],
  ] as [number, number, number][]).forEach(([ci, r, col]) => {
    const pathPts = stations.map((st) => new t.Vector3(st.pts[ci][0], st.pts[ci][1], st.z));
    const tube = new t.Mesh(
      new t.TubeGeometry(new t.CatmullRomCurve3(pathPts), 26, r, 6),
      mat(t, col, { tex: 'wood', repeat: [1, 8], rough: 0.85 }),
    );
    tube.castShadow = true;
    boat.add(tube);
  });

  // ---- three wrought-iron bands chorded round the sections (one merged mesh)
  const bandSpecs: MergedBoxSpec[] = [];
  [-0.44, 0.02, 0.46].forEach((bz) => {
    const sec = sectionAt(bz);
    for (let c = 0; c < sec.length - 1; c += 1) {
      const [ax, ay] = sec[c];
      const [bx, by] = sec[c + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 0.01;
      // band Y axis runs along the chord, X axis is the outward normal
      const ux = dx / len;
      const uy = dy / len;
      const nx = uy;
      const ny = -ux;
      const outward = ax * nx + ay * ny > 0 ? 1 : -1;
      const m = new t.Matrix4().makeBasis(
        new t.Vector3(nx * outward, ny * outward, 0),
        new t.Vector3(ux, uy, 0),
        new t.Vector3(0, 0, 1),
      );
      m.setPosition((ax + bx) / 2 + nx * outward * 0.013, (ay + by) / 2 + ny * outward * 0.013, bz);
      bandSpecs.push({ dims: [0.022, len * 1.05, 0.07], matrix: m, repeat: [1, 2] });
    }
  });
  boat.add(mergedBoxes(t, bandSpecs, BAND, { tex: 'metal', metal: 0.55, rough: 0.55 }));

  // ---- raked stem + the CARVED FLAME-HEAD prow, and the stern post ----
  // Kept COMPACT and coplanar: the first pass raked a long stem back and a tall
  // crest fin forward, and the two crossed into a wooden X that read as a
  // signpost rather than a carving. The stem now stops just above the sheer and
  // every carved piece leans the SAME way, forward over the water.
  const woodSpecs: MergedBoxSpec[] = [
    barSpec(t, new t.Vector3(0, botOf(BOW) - 0.01, BOW - 0.08), new t.Vector3(0, 0.28, 0.86), 0.08, [1, 3]), // stem
    barSpec(t, new t.Vector3(0, botOf(STERN) - 0.01, STERN + 0.06), new t.Vector3(0, 0.2, -0.83), 0.075, [1, 3]), // stern post
    { dims: [0.09, 0.11, 0.13], pos: [0, 0.25, -0.85], rotX: 0.3, repeat: [1, 1] }, // the stern knob
  ];
  const carveSpecs: MergedBoxSpec[] = [
    { dims: [0.11, 0.13, 0.2], pos: [0, 0.32, 0.89], rotX: -0.22, repeat: [1, 1] }, // head block
    { dims: [0.08, 0.08, 0.15], pos: [0, 0.27, 0.99], rotX: -0.24 }, // snout
    { dims: [0.026, 0.12, 0.11], pos: [0, 0.42, 0.85], rotX: -0.18 }, // swept crest
    { dims: [0.026, 0.045, 0.12], pos: [-0.05, 0.38, 0.9], rotZ: 0.5, rotX: -0.3 }, // horns
    { dims: [0.026, 0.045, 0.12], pos: [0.05, 0.38, 0.9], rotZ: -0.5, rotX: -0.3 },
  ];
  boat.add(mergedBoxes(t, woodSpecs, CUT, { tex: 'wood', rough: 0.86, bump: 0.03 }));
  boat.add(mergedBoxes(t, carveSpecs, CUT, { tex: 'wood', rough: 0.8, bump: 0.03 }));
  // ember eyes — faint by day, brighter after dark (gated with the ride's lamps)
  const eyeMats: THREE.MeshStandardMaterial[] = [];
  [-1, 1].forEach((s) => {
    const eye = ball(t, 0.016, 0xffcf8a, [s * 0.046, 0.34, 0.955], { emissive: 0xff6a1e, rough: 0.35 });
    (eye.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
    eyeMats.push(eye.material as THREE.MeshStandardMaterial);
    boat.add(eye);
  });
  boat.userData.emberEyes = eyeMats;
  // iron stem cap + a mooring ring on the foredeck
  boat.add(box(t, [0.095, 0.045, 0.095], BAND, [0, 0.16, 0.8], { tex: 'metal', metal: 0.6, rough: 0.5, rotX: -0.2 }));
  const ring = new t.Mesh(new t.TorusGeometry(0.035, 0.011, 6, 12), mat(t, BAND, { tex: 'metal', metal: 0.65, rough: 0.45 }));
  ring.position.set(0, 0.14, 0.72);
  ring.rotation.x = Math.PI / 2;
  boat.add(ring);

  // ---- charred interior: sole boards + four hewn thwarts ----
  const soleSpecs: MergedBoxSpec[] = [];
  for (let k = 0; k < 7; k += 1) {
    const z = -0.6 + k * 0.2;
    soleSpecs.push({ dims: [Math.max(0.12, hwOf(z) * 1.5), 0.035, 0.185], pos: [0, -0.195, z], repeat: [2, 1] });
  }
  boat.add(mergedBoxes(t, soleSpecs, CHAR, { tex: 'wood', rough: 0.96, bump: 0.03 }));
  const thwartSpecs: MergedBoxSpec[] = [];
  SEAT_Z.forEach((sz) => {
    const w = hwOf(sz) * 1.92;
    thwartSpecs.push({ dims: [w, 0.045, 0.15], pos: [0, THWART_TOP - 0.022, sz], repeat: [2, 1] }); // the seat
    thwartSpecs.push({ dims: [w * 0.94, 0.085, 0.032], pos: [0, THWART_TOP + 0.038, sz - 0.09], repeat: [2, 1] }); // back lip
    thwartSpecs.push({ dims: [w * 0.9, 0.03, 0.05], pos: [0, THWART_TOP - 0.062, sz], repeat: [2, 1] }); // bearer under it
  });
  boat.add(mergedBoxes(t, thwartSpecs, CUT, { tex: 'wood', rough: 0.84, bump: 0.03 }));

  // ---- seat anchors ride WITH the boat, so REAL guests ride the flume ----
  SEAT_Z.forEach((sz, i) => {
    const anchor = new t.Group();
    anchor.position.set(0, THWART_TOP - HIP_RISE, sz);
    boat.add(anchor);
    opts.seats?.push(anchor);
    if (opts.riders ?? true) {
      const p = buildPeep(t, {
        skin: SKIN_TONES[i % SKIN_TONES.length],
        shirt: SHIRTS[(i + 2) % SHIRTS.length],
        seated: true,
        expression: i >= 2 ? 'surprised' : 'happy',
      });
      p.group.scale.setScalar(0.42);
      p.group.position.copy(anchor.position);
      boat.add(p.group);
    }
  });

  // ---- a hewn bailing bucket wedged in the stern (close-up detail) ----
  const bucket = cyl(t, 0.055, 0.045, 0.085, CUT, [0.055, -0.135, -0.63], { tex: 'wood', repeat: [4, 1], rough: 0.9, seg: 10 });
  bucket.userData.lodDetail = true;
  boat.add(bucket);
  return boat;
}

// ---------------------------------------------------------------------------
export interface MagmaRunOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Caldera Circuit. Compiled on the 'flume' profile, heading −90°. */
  pieces?: TrackPiece[];
  /** decorative riders (default true; `register` turns them OFF so REAL
   *  GameManager guests fill the four thwarts through seatWorld) */
  riders?: boolean;
  /** terrain sampler so supports / canyon / magma land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the LAVA TUBE (default: auto — the lowest, straightest,
   *  most level stretch of the return leg) */
  tubeU?: number;
}

export interface MagmaRunBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** FATAL pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
}

/**
 * The whole ride: flume circuit + basalt canyon + magma fissure network +
 * lava tube + spatter cone + station, and the hewn timber boat. `update` is
 * motion-gated (the boat parks in the station while guests board — RCT2
 * Vehicle.cpp status cycle), `seatWorld` seats real guests on the four
 * thwarts and `vehicle` is the boat for the RideViewer follow cam.
 */
export function buildMagmaRunScene(three: typeof THREE, opts: MagmaRunOpts = {}): MagmaRunBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; invalid?: boolean } = {};
  const seatAnchors: THREE.Object3D[] = [];
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const groundAt = opts.groundAt ?? (() => 0);

        // ---- 1. LAYOUT: the shared spline machinery ------------------------
        const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, { profile: 'flume', start: START, heading: HEADING });
        g.userData.trackReport = compiled.report; // harness/agent introspection
        if (compiled.report.fatal) extras.invalid = true; // never registers as a working ride
        const ride = buildRideSpline(t, compiled.points, {
          profile: 'flume',
          colours: TRACK_COLOURS,
          groundAt,
          wood: true,
        });
        g.add(ride.group);
        const total = ride.curve.getLength();
        const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);
        /** horizontal unit lateral direction of a frame */
        const sideH = (f: { side: THREE.Vector3 }, out: THREE.Vector3) => out.set(f.side.x, 0, f.side.z).normalize();

        // frame scan: height above ground, and the loop centroid (every
        // "inside / outside" decision below is taken against it, so the
        // dressing follows ANY layout)
        const M = 176;
        const railH: number[] = [];
        const cen = new t.Vector3();
        for (let i = 0; i < M; i += 1) {
          const f = ride.frameAt(i / M);
          railH.push(f.p.y - groundAt(f.p.x, f.p.z));
          cen.add(f.p);
        }
        cen.multiplyScalar(1 / M).setY(0);
        /** +1 when frame.side points AWAY from the loop centre at u */
        const outSign = (u: number) => {
          const f = ride.frameAt(u);
          const s = sideH(f, new t.Vector3());
          return s.x * (f.p.x - cen.x) + s.z * (f.p.z - cen.z) >= 0 ? 1 : -1;
        };

        // ---- 2. THE LAVA TUBE's position (before the canyon, which parts
        // around it): lowest, straightest, most level stretch of the return
        // leg — the |u − 0.75| term keeps it off the splash run-out ---------
        const tubeU = (() => {
          if (opts.tubeU !== undefined) return opts.tubeU;
          let best = 0.78;
          let bestScore = Infinity;
          const d = 1.8 / total;
          for (let i = 0; i < 260; i += 1) {
            const u = i / 260;
            if (u < 0.5 || u > 0.95) continue;
            const f = ride.frameAt(u);
            const a = ride.frameAt(u - d).fwd;
            const b = ride.frameAt(u + d).fwd;
            const bend = 1 - (a.x * b.x + a.z * b.z) / ((Math.hypot(a.x, a.z) || 1) * (Math.hypot(b.x, b.z) || 1));
            const score = (f.p.y - groundAt(f.p.x, f.p.z)) * 0.7 + bend * 30 + Math.abs(f.fwd.y) * 9 + Math.abs(u - 0.75) * 4;
            if (score < bestScore) {
              bestScore = score;
              best = u;
            }
          }
          return best;
        })();
        const TUBE_HALF = 2.4; // arc half-length of the bore
        const tubeSpan = TUBE_HALF / total;
        const inTube = (u: number) => Math.abs(((u - tubeU + 1.5) % 1) - 0.5) < tubeSpan * 1.15;
        /** the station straight + brake tail — kept clear of canyon and magma
         *  so the boarding deck, queue lane and huts have somewhere to be */
        const atStation = (u: number) => u < 2.9 / total || u > 1 - 1.9 / total;

        // the CHUTE: steepest descending frame, then the first frame after it
        // that has levelled back out (deterministic — no hard-coded u)
        let uSteep = 0;
        let steep = 0;
        for (let i = 0; i < 420; i += 1) {
          const f = ride.frameAt(i / 420);
          if (f.fwd.y < steep) {
            steep = f.fwd.y;
            uSteep = i / 420;
          }
        }
        let uRun = uSteep;
        for (let i = Math.ceil(uSteep * 420); i < 420; i += 1)
          if (ride.frameAt(i / 420).fwd.y > -0.14) {
            uRun = i / 420;
            break;
          }
        const runF = ride.frameAt(uRun + 0.014);
        const SPLASH_AT = runF.p.clone();
        const splashY = runF.p.y + 0.035;

        // ---- 3. THE MAGMA FISSURE NETWORK ---------------------------------
        // Contiguous runs of the loop are classified by trough height: where
        // the trough is HIGH the channel runs directly BENEATH it (between the
        // trestle bents); where it is LOW the channel FLANKS it on the inboard
        // side. Branch fissures then drain outward through gaps blasted in the
        // canyon wall (the wall blocks near a branch are dropped in §4).
        const pair = crustCanvases();
        const crawlTex: THREE.Texture[] = [];
        const texes: THREE.Texture[] = [];
        const flowSegs: RibbonSeg[] = [];
        // CRUST TEXTURE SCALE. The canvas holds a 6 x 6 grid of plates, so one
        // UV tile of 1/scale world units contains NINE plates: plate size is
        // 1/(9·scale). Scale therefore has to be chosen PER SURFACE — running
        // the caldera floor at a narrow fissure's scale gave 0.13-u plates
        // across seven units of lake and it read as a yellow honeycomb.
        const TS_FLOOR = 0.2; // the caldera floor: ~0.56-u plates, tile 5.0 u
        const TS_POOL = 0.42; // pools ~2 u across: ~0.26-u plates
        const TS_N = 0.7; // narrow channels: ~0.16-u plates, 3-4 across a fissure
        /** circles where the canyon wall is BLASTED OPEN so magma drains out /
         *  a set piece can be seen — §4 drops any wall block inside one */
        const gaps: { x: number; z: number; r: number }[] = [];
        const newLavaTex = () => {
          const c = texFrom(t, pair.crust);
          const k = texFrom(t, pair.crack);
          texes.push(c, k);
          crawlTex.push(c, k);
          return [c, k] as const;
        };
        const addChannel = (pts: RibbonPt[], segs: number, h0: number, h1: number, scale = TS) => {
          if (pts.length < 3) return;
          const [c, k] = newLavaTex();
          const rib = magmaChannel(t, pts, segs, h0, h1, c, k, scale);
          g.add(rib.group);
          rib.segs.forEach((s) => flowSegs.push(s));
        };

        interface Run { i0: number; i1: number; under: boolean }
        const runs: Run[] = [];
        {
          let cur: Run | null = null;
          for (let i = 0; i < M; i += 1) {
            const u = i / M;
            const under = railH[i] > 1.3;
            const flank = railH[i] < 0.95;
            if ((!under && !flank) || inTube(u) || atStation(u)) {
              cur = null;
              continue;
            }
            if (!cur || cur.under !== under) {
              cur = { i0: i, i1: i, under };
              runs.push(cur);
            } else cur.i1 = i;
          }
        }
        const side = new t.Vector3();
        runs.forEach((r, ri) => {
          if (r.i1 - r.i0 < 7) return;
          const pts: RibbonPt[] = [];
          const s = r.under ? 0 : -outSign((r.i0 + r.i1) / 2 / M); // flank runs hug the INBOARD side
          const off = r.under ? 0 : 1.0;
          const w = r.under ? 0.92 : 0.62;
          for (let i = r.i0; i <= r.i1; i += 1) {
            const f = ride.frameAt(i / M);
            sideH(f, side);
            const x = f.p.x + side.x * s * off;
            const z = f.p.z + side.z * s * off;
            // the channel MEANDERS a little so it never reads as a painted stripe
            const wob = 0.055 * Math.sin(i * 0.41 + ri * 2.3);
            pts.push({
              x: x + side.x * wob,
              y: groundAt(x, z) + 0.022,
              z: z + side.z * wob,
              dx: side.x,
              dz: side.z,
              w: w * (0.85 + 0.3 * hash01(i * 3.1 + ri)),
              lift: 0.028,
            });
          }
          // hotter under the trough (fresh, fed from the caldera) than out on
          // the flanks, and every channel cools along its length
          addChannel(pts, Math.max(3, Math.round(pts.length / 5)), r.under ? 0.18 : 0.34, r.under ? 0.6 : 0.82, r.under ? TS_N * 0.7 : TS_N);
          // ONE branch per long run, from the channel outward through the wall
          if (r.i1 - r.i0 >= 11) {
            const mid = Math.round((r.i0 + r.i1) / 2);
            const f = ride.frameAt(mid / M);
            sideH(f, side);
            const o = outSign(mid / M);
            const bp: RibbonPt[] = [];
            const fwdH = new t.Vector3(f.fwd.x, 0, f.fwd.z).normalize();
            for (let k = 0; k <= 8; k += 1) {
              const d = 1.05 + (k / 8) * 1.75;
              const drift = 0.34 * Math.sin((k / 8) * 2.2 + ri);
              const x = f.p.x + side.x * o * d + fwdH.x * drift;
              const z = f.p.z + side.z * o * d + fwdH.z * drift;
              bp.push({
                x,
                y: groundAt(x, z) + 0.02,
                z,
                dx: fwdH.x,
                dz: fwdH.z,
                w: 0.32 - 0.16 * (k / 8),
                lift: 0.022,
              });
            }
            addChannel(bp, 4, 0.4, 0.95, TS_N * 1.2);
            // blast the wall open along the branch so the fissure drains out
            for (let k = 1; k <= 3; k += 1) {
              const d = 1.1 + k * 0.6;
              gaps.push({ x: f.p.x + side.x * o * d, z: f.p.z + side.z * o * d, r: 0.78 });
            }
          }
        });

        // ---- 3b. THE CALDERA FLOOR the circuit rings -----------------------
        // The ground INSIDE the loop is the caldera floor, so it is MOLTEN —
        // the single biggest piece of magma on the ride, and what makes the
        // whole circuit read as "a flume around a lava lake". It is not a disc:
        // a disc sized to the nearest track leg came out tiny in a rectangular
        // interior. Instead the interior is FILLED cell by cell — an even-odd
        // ray test says whether a cell is inside the loop, the distance to the
        // track says how far in it is — in three temperature bands (cooled
        // crust at the shore, orange, and a white-hot heart), each band one
        // mesh with WORLD-SPACE UVs so the crust never tiles per cell.
        const poly: [number, number][] = [];
        for (let i = 0; i < M; i += 1) {
          const f = ride.frameAt(i / M);
          poly.push([f.p.x, f.p.z]);
        }
        const insideLoop = (x: number, z: number) => {
          let inside = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi, zi] = poly[i];
            const [xj, zj] = poly[j];
            if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
          }
          return inside;
        };
        const distToTrack = (x: number, z: number) => {
          let d = Infinity;
          for (const [px, pz] of poly) d = Math.min(d, Math.hypot(px - x, pz - z));
          return d;
        };
        const poolMats: THREE.MeshStandardMaterial[] = [];
        /** every LAVA-palette liquid sheet on the ride (lake heart, chute pool,
         *  cone vent) — driven off the same absolute clock as the trough */
        const lavaLakes: { update: (time: number) => void }[] = [];
        const lakeLight = new t.PointLight(0xff6a1e, 0, 13, 2);
        let lakeCells = 0;
        const lakeMid = new t.Vector3();
        {
          let x0 = Infinity;
          let x1 = -Infinity;
          let z0 = Infinity;
          let z1 = -Infinity;
          for (const [px, pz] of poly) {
            x0 = Math.min(x0, px);
            x1 = Math.max(x1, px);
            z0 = Math.min(z0, pz);
            z1 = Math.max(z1, pz);
          }
          const STEP = 0.92;
          /** one flat quad per kept cell, overlapping its neighbours by 0.3 and
           *  sitting at its own hashed height so overlaps never z-fight */
          const bandMesh = (minD: number, maxD: number, heat: number, lift: number, tscale: number) => {
            const pos: number[] = [];
            const uv: number[] = [];
            const idx: number[] = [];
            let n = 0;
            for (let x = x0; x <= x1; x += STEP)
              for (let z = z0; z <= z1; z += STEP) {
                const d = distToTrack(x, z);
                if (d < minD || d >= maxD || !insideLoop(x, z)) continue;
                const h = hash01(x * 1.9 + z * 4.3);
                const y = groundAt(x, z) + lift + h * 0.02;
                const r = STEP * 0.61;
                const jx = (hash01(x * 3.1 + z * 1.7) - 0.5) * 0.18;
                const jz = (hash01(x * 5.7 + z * 2.3) - 0.5) * 0.18;
                ([
                  [-r + jx, -r + jz],
                  [r + jx, -r + jz],
                  [-r + jx, r + jz],
                  [r + jx, r + jz],
                ] as [number, number][]).forEach(([dx, dz]) => {
                  pos.push(x + dx, y, z + dz);
                  uv.push((x + dx) * tscale, (z + dz) * tscale);
                });
                idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
                n += 4;
                lakeMid.add(new t.Vector3(x, y, z));
                lakeCells += 1;
              }
            if (!n) return null;
            const geo = new t.BufferGeometry();
            geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
            geo.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            const [c, k] = newLavaTex();
            const m = lavaMat(t, heat, c, k);
            const mesh = new t.Mesh(geo, m);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            g.add(mesh);
            return m;
          };
          // shore crust (dull red deep in the cracks) → orange → white-hot heart
          const crust = bandMesh(2.45, 3.9, 0.78, 0.03, TS_FLOOR);
          if (crust) flowSegs.push({ mat: crust, u: 0.8, heat: heatAt(t, 0.78).intensity });
          const mid = bandMesh(3.9, 5.6, 0.42, 0.045, TS_FLOOR);
          if (mid) flowSegs.push({ mat: mid, u: 0.45, heat: heatAt(t, 0.42).intensity });
          const heart = bandMesh(5.6, Infinity, 0.26, 0.06, TS_FLOOR);
          if (heart) flowSegs.push({ mat: heart, u: 0.1, heat: heatAt(t, 0.26).intensity });
          if (lakeCells) {
            lakeMid.multiplyScalar(1 / lakeCells);
            lakeLight.position.set(lakeMid.x, lakeMid.y + 1.2, lakeMid.z);
            g.add(lakeLight);
            // ---- the LIVE HEART of the lake ---------------------------------
            // The three crust bands above are STILL geometry: a lava lake read
            // as a patterned floor from the park camera because nothing in it
            // moved. This is a real `buildWater` sheet on the **LAVA** palette,
            // radius-clipped to a pool and dropped in the middle of the melt,
            // so the hottest part of the lake is a slowly churning liquid whose
            // wave troughs are chilled crust and whose crests tear open.
            // Sized off the measured melt (the heart band starts 5.6 u from the
            // track), amp/waviness cut right down — viscous, not choppy. The
            // segment counts on all three of this ride's LAVA sheets are as
            // COARSE as the swell allows (56/44/32, not the 96 the first pass
            // used): total displacement here is amp x waviness = 0.042 u, so a
            // fine grid bought 30 k triangles of nothing at park distance.
            {
              const rad = Math.min(3.4, Math.max(1.6, Math.hypot(x1 - x0, z1 - z0) * 0.16));
              const lake = buildWater(t, rad * 2.15, 56, rad, 0.22, 0.16, 0.26, LAVA);
              lake.mesh.position.set(lakeMid.x, lakeMid.y + 0.055, lakeMid.z);
              lake.mesh.castShadow = false;
              lake.mesh.receiveShadow = false;
              g.add(lake.mesh);
              lavaLakes.push(lake);
            }
            // broken basalt SHORE hiding the fill's stair-stepped edge
            const shore: MergedBoxSpec[] = [];
            for (let x = x0; x <= x1; x += STEP)
              for (let z = z0; z <= z1; z += STEP) {
                const d = distToTrack(x, z);
                if (!insideLoop(x, z) || d < 1.95 || d > 2.75) continue;
                const h1 = hash01(x * 4.7 + z * 3.3);
                const h2 = hash01(x * 6.1 + z * 9.7);
                const sh = 0.24 + h2 * 0.42;
                shore.push({
                  dims: [0.42 + h1 * 0.36, sh, 0.38 + h2 * 0.3],
                  pos: [x, groundAt(x, z) + sh / 2 - 0.08, z],
                  rotY: h1 * 3.1,
                  rotZ: (h2 - 0.5) * 0.34,
                  repeat: [1, 1],
                });
              }
            if (shore.length) g.add(mergedBoxes(t, shore, BASALT, { tex: 'concrete', rough: 1, bump: 0.06, flat: true }));
            // CRUSTAL RAFTS. A real lava lake is not a sheet of glow: it is a
            // jigsaw of near-black crust plates DRIFTING on the melt, with the
            // incandescence only showing in the lanes between them. Flat dark
            // slabs scattered over the molten bands are what turns an orange
            // patterned floor into that — and they break up the crust texture's
            // own repeat.
            //
            // MEASURED COVERAGE: at the original `h1 > 0.7` the rafts took 70 %
            // of the melt and the park-camera shot (--elev=50) read as a boulder
            // quarry with one orange patch in it — **0.10 % of that frame was
            // incandescent** (pixels with R > 110, R > 1.45·G, R > 1.8·B). Cut
            // to 0.44 (44 % rafted), plus the molten trough and the live lake
            // heart, the same shot measures **2.51 %**. The open lanes are now
            // the majority, which is both what a real lake looks like and what
            // makes the ride read as volcanic from above.
            const rafts: MergedBoxSpec[] = [];
            for (let x = x0; x <= x1; x += STEP)
              for (let z = z0; z <= z1; z += STEP) {
                const d = distToTrack(x, z);
                if (!insideLoop(x, z) || d < 2.9) continue;
                const h1 = hash01(x * 7.1 + z * 2.9);
                if (h1 > 0.44) continue; // lanes of open melt between the rafts
                const h2 = hash01(x * 2.3 + z * 8.7);
                const h3 = hash01(x * 9.7 + z * 1.3);
                rafts.push({
                  dims: [0.62 + h2 * 0.75, 0.09 + h3 * 0.07, 0.58 + h3 * 0.7],
                  pos: [x + (h2 - 0.5) * 0.4, groundAt(x, z) + 0.085 + h1 * 0.03, z + (h3 - 0.5) * 0.4],
                  rotY: h2 * 3.1,
                  rotZ: (h3 - 0.5) * 0.1,
                  rotX: (h2 - 0.5) * 0.1,
                  repeat: [1, 1],
                });
              }
            if (rafts.length) g.add(mergedBoxes(t, rafts, 0x241f1c, { tex: 'asphalt', rough: 1, bump: 0.05, flat: true }));
          }
        }

        // ---- 3c. the MAGMA POOL in a blasted alcove at the chute's foot ----
        const magmaLight = new t.PointLight(0xff6a1e, 0, 8, 2);
        const poolC = new t.Vector3();
        {
          const f = ride.frameAt(uRun + 0.03);
          sideH(f, side);
          const o = outSign(uRun + 0.03);
          const px = f.p.x + side.x * o * 3.1;
          const pz = f.p.z + side.z * o * 3.1;
          const pgy = groundAt(px, pz);
          poolC.set(px, pgy, pz);
          const [c, k] = newLavaTex();
          const m = lavaMat(t, 0.3, c, k);
          const pool = new t.Mesh(blobDisc(t, 1.15, 0.18, 0.06, 5.7, TS_POOL, 30, 4), m);
          pool.position.set(px, pgy + 0.05, pz);
          g.add(pool);
          flowSegs.push({ mat: m, u: 0.2, heat: heatAt(t, 0.3).intensity });
          // …and a LIVE liquid surface inside it. The blob disc stays as the
          // pool's crusted rim and irregular outline (a round `buildWater`
          // clip would read as a manhole); the LAVA sheet sits just inside it,
          // 25 mm proud, so the middle of the pool churns. This is the pool the
          // boat's splash lands beside, so it is the one a rider sees closest.
          {
            const live = buildWater(t, 1.86, 44, 0.86, 0.2, 0.14, 0.24, LAVA);
            live.mesh.position.set(px, pgy + 0.075, pz);
            live.mesh.castShadow = false;
            live.mesh.receiveShadow = false;
            g.add(live.mesh);
            lavaLakes.push(live);
          }
          // a short feeder channel from the flume line out to the pool, and
          // the alcove blasted in the canyon wall that lets it through
          {
            const fwdH = new t.Vector3(f.fwd.x, 0, f.fwd.z).normalize();
            const feed: RibbonPt[] = [];
            for (let kk = 0; kk <= 7; kk += 1) {
              const d = 0.95 + (kk / 7) * 1.4;
              const x = f.p.x + side.x * o * d + fwdH.x * 0.2 * Math.sin(kk * 0.7);
              const z = f.p.z + side.z * o * d + fwdH.z * 0.2 * Math.sin(kk * 0.7);
              feed.push({ x, y: groundAt(x, z) + 0.022, z, dx: fwdH.x, dz: fwdH.z, w: 0.5, lift: 0.03 });
            }
            addChannel(feed, 3, 0.16, 0.4, TS_N * 0.8);
          }
          for (let kk = 0; kk <= 4; kk += 1) {
            const d = 1.0 + kk * 0.55;
            gaps.push({ x: f.p.x + side.x * o * d, z: f.p.z + side.z * o * d, r: 1.0 });
          }
          gaps.push({ x: px, z: pz, r: 1.9 });
          // broken basalt lips shoved up round the pool
          const lips: MergedBoxSpec[] = [];
          for (let i = 0; i < 16; i += 1) {
            const az = (i / 16) * Math.PI * 2;
            const rr = 1.26 + hash01(i * 4.7 + 3) * 0.3;
            const lx = px + Math.cos(az) * rr;
            const lz = pz + Math.sin(az) * rr;
            const lh = 0.22 + hash01(i * 6.1 + 9) * 0.34;
            lips.push({
              dims: [0.4 + hash01(i * 2.3) * 0.3, lh, 0.34],
              pos: [lx, groundAt(lx, lz) + lh / 2 - 0.06, lz],
              rotY: az + 1.57,
              rotZ: -0.22,
              repeat: [2, 1],
            });
          }
          g.add(mergedBoxes(t, lips, BASALT, { tex: 'concrete', rough: 1, bump: 0.05, flat: true }));
          magmaLight.position.set(px, pgy + 0.7, pz);
          g.add(magmaLight);
        }

        // ---- 3d. THE SPATTER CONE beside the summit crest ------------------
        // the ride's high point gets the land's set piece: a rock cone piled on
        // the canyon rim with a magma spill running down its flank, back under
        // the crest of the conveyor
        {
          let uTop = 0;
          let top = -Infinity;
          for (let i = 0; i < 200; i += 1) {
            const f = ride.frameAt(i / 200);
            if (f.p.y > top) {
              top = f.p.y;
              uTop = i / 200;
            }
          }
          const f = ride.frameAt(uTop);
          sideH(f, side);
          const o = outSign(uTop);
          const cx = f.p.x + side.x * o * 3.4;
          const cz = f.p.z + side.z * o * 3.4;
          const cgy = groundAt(cx, cz);
          const cone = new t.Group();
          cone.position.set(cx, cgy, cz);
          g.add(cone);
          g.userData.spatterAt = [cx, cgy, cz]; // harness/agent introspection
          // five tiers of piled rock, narrowing with height — a spatter cone,
          // not a cairn: the tiers overlap so the silhouette closes up
          for (let tier = 0; tier < 5; tier += 1) {
            const n = 12 - tier * 2;
            const rr = 1.78 - tier * 0.3;
            const yy = tier * 0.44;
            for (let i = 0; i < n; i += 1) {
              const az = (i / n) * Math.PI * 2 + tier * 0.7;
              const sc = 0.72 - tier * 0.06 + hash01(i * 3.3 + tier * 9) * 0.26;
              const rock = buildRock(t, { scale: sc, seed: 140 + tier * 11 + i * 3, tint: tier > 2 ? 0x3b352e : tier % 2 ? 0x4c443b : 0x5a5148 });
              rock.position.set(Math.cos(az) * rr, yy, Math.sin(az) * rr);
              cone.add(rock);
            }
          }
          // the vent pool at the summit — crusted blob rim with a LIVE molten
          // surface in the throat, so the spatter cone visibly boils
          {
            const [c, k] = newLavaTex();
            const m = lavaMat(t, 0.03, c, k);
            const vent = new t.Mesh(blobDisc(t, 0.86, 0.16, 0.07, 3.1, TS_POOL * 1.5), m);
            vent.position.set(0, 2.28, 0);
            cone.add(vent);
            poolMats.push(m);
            const live = buildWater(t, 1.24, 32, 0.58, 0.16, 0.13, 0.22, LAVA);
            live.mesh.position.set(0, 2.305, 0);
            live.mesh.castShadow = false;
            live.mesh.receiveShadow = false;
            cone.add(live.mesh);
            lavaLakes.push(live);
          }
          // …and the spill down the flank, back toward the flume
          {
            const spill: RibbonPt[] = [];
            const az0 = Math.atan2(-side.z * o, -side.x * o);
            for (let k = 0; k <= 18; k += 1) {
              const f2 = k / 18;
              const rr = 0.62 + f2 * 2.9;
              const a = az0 + 0.32 * Math.sin(f2 * 2.4);
              spill.push({
                x: Math.cos(a) * rr,
                z: Math.sin(a) * rr,
                y: Math.max(0.03, 2.26 - f2 ** 0.72 * 2.3) + 0.03,
                dx: -Math.sin(a),
                dz: Math.cos(a),
                w: 0.42 + f2 * 0.5,
                lift: 0.05,
              });
            }
            const [c, k] = newLavaTex();
            const rib = magmaChannel(t, spill, 7, 0.03, 0.64, c, k, TS_N * 0.8);
            cone.add(rib.group);
            rib.segs.forEach((s) => flowSegs.push(s));
            // the spill needs the canyon wall open where it reaches the flume
            for (let k = 0; k < 4; k += 1) {
              const rr = 2.1 + k * 0.7;
              gaps.push({ x: cx + Math.cos(az0) * rr, z: cz + Math.sin(az0) * rr, r: 1.0 });
            }
          }
        }

        // ---- 4. THE BASALT CANYON -----------------------------------------
        // A STEPPED cutting, not a wall of crates: a low continuous KERB right
        // beside the trough, a taller CUTTING WALL set back behind it (only
        // where the trough runs low enough to need walling in) and a low OUTER
        // ridge behind that. Stepping the profile up AWAY from the track is
        // what keeps the trough, the boat and the magma visible from the DS's
        // high 3/4 camera — a single tall row buried the whole ride. Blocks are
        // deliberately SMALL (0.6-1.1 u) so they read as broken basalt, they are
        // split across two tones, and any block inside a blasted `gaps` circle
        // is dropped so the fissures and set pieces show through.
        const WALL_IN = 1.42; // kerb inner face standoff from the trough centreline
        const kerbA: MergedBoxSpec[] = [];
        const kerbB: MergedBoxSpec[] = [];
        const cutting: MergedBoxSpec[] = [];
        const cuttingB: MergedBoxSpec[] = [];
        const outer: MergedBoxSpec[] = [];
        const scree: MergedBoxSpec[] = [];
        const open = (x: number, z: number) => gaps.some((q) => Math.hypot(x - q.x, z - q.z) < q.r);
        const CANYON_N = 176;
        for (let i = 0; i < CANYON_N; i += 1) {
          const u = i / CANYON_N;
          if (inTube(u)) continue; // the bore has its own rock mound
          const f = ride.frameAt(u);
          sideH(f, side);
          const yaw = yawOf(f);
          const rh = f.p.y - groundAt(f.p.x, f.p.z);
          const o = outSign(u);
          for (const s of [-1, 1] as const) {
            if (atStation(u) && s === o) continue; // never wall in the boarding face
            const h1 = hash01(i * 3.7 + (s > 0 ? 11 : 29));
            const h2 = hash01(i * 8.1 + (s > 0 ? 5 : 41));
            // (a) the kerb — low, continuous, hugging the trough
            const hx = 0.29 + h1 * 0.26;
            const hz = 0.3 + h2 * 0.26;
            const kh = 0.42 + h2 * 0.5;
            const d = WALL_IN + hx + 0.07;
            const cx = f.p.x + side.x * s * d;
            const cz = f.p.z + side.z * s * d;
            if (!open(cx, cz))
              (h1 > 0.5 ? kerbA : kerbB).push({
                dims: [hx * 2, kh, hz * 2],
                pos: [cx, groundAt(cx, cz) + kh / 2 - 0.08, cz],
                rotY: yaw + (h2 - 0.5) * 0.5,
                rotZ: (h1 - 0.5) * 0.34,
                rotX: (h2 - 0.5) * 0.26,
                repeat: [2, 2],
              });
            // (b) the cutting wall, set back — only OUTBOARD (the inboard side
            // opens straight onto the molten caldera floor) and only where the
            // trough runs low enough to need walling in
            if (rh < 1.35 && i % 2 === 0 && s === o) {
              const wh = Math.min(2.3, rh + 0.45 + h1 * 0.95);
              const wx2 = 0.26 + h2 * 0.24;
              const wd = d + hx + wx2 + 0.24;
              const wx = f.p.x + side.x * s * wd;
              const wz = f.p.z + side.z * s * wd;
              if (!open(wx, wz))
                (h2 > 0.5 ? cutting : cuttingB).push({
                  dims: [wx2 * 2, wh, 0.5 + h1 * 0.42],
                  pos: [wx, groundAt(wx, wz) + wh / 2 - 0.1, wz],
                  rotY: yaw + (h1 - 0.5) * 0.42,
                  rotZ: (h2 - 0.5) * 0.2,
                  rotX: (h1 - 0.5) * 0.14,
                  repeat: [2, 3],
                });
            }
            // (c) a low outer ridge for depth — OUTBOARD only, so the caldera
            // floor inside the circuit stays open for the lava lake
            if (i % 3 === 0 && s === o) {
              const oh = 0.4 + h1 * 0.7;
              const od = d + 1.4 + h2 * 1.0;
              const ox = f.p.x + side.x * s * od;
              const oz = f.p.z + side.z * s * od;
              if (!open(ox, oz))
                outer.push({
                  dims: [0.46 + h2 * 0.5, oh, 0.44 + h1 * 0.5],
                  pos: [ox, groundAt(ox, oz) + oh / 2 - 0.12, oz],
                  rotY: yaw + (h1 - 0.5) * 1.2,
                  rotZ: (h2 - 0.5) * 0.3,
                  rotX: (h1 - 0.5) * 0.22,
                  repeat: [2, 2],
                });
            }
            // (d) cinder scree between the kerb and the trough
            if (i % 3 === 1) {
              const sh = 0.11 + h1 * 0.13;
              const sd = WALL_IN - 0.2 - h2 * 0.2;
              const sx = f.p.x + side.x * s * sd;
              const szz = f.p.z + side.z * s * sd;
              if (!open(sx, szz))
                scree.push({
                  dims: [0.24 + h2 * 0.26, sh, 0.2 + h1 * 0.24],
                  pos: [sx, groundAt(sx, szz) + sh / 2 - 0.04, szz],
                  rotY: yaw + h1 * 2.4,
                  rotZ: (h2 - 0.5) * 0.3,
                });
            }
          }
        }
        g.add(mergedBoxes(t, kerbA, BASALT, { tex: 'concrete', rough: 1, bump: 0.07, flat: true }));
        g.add(mergedBoxes(t, kerbB, BASALT_D, { tex: 'asphalt', rough: 1, bump: 0.06, flat: true }));
        g.add(mergedBoxes(t, cutting, BASALT_L, { tex: 'concrete', rough: 1, bump: 0.07, flat: true }));
        g.add(mergedBoxes(t, cuttingB, BASALT, { tex: 'asphalt', rough: 1, bump: 0.07, flat: true }));
        g.add(mergedBoxes(t, outer, BASALT, { tex: 'concrete', rough: 1, bump: 0.06, flat: true }));
        const screeMesh = mergedBoxes(t, scree, BASALT_D, { tex: 'asphalt', rough: 1, bump: 0.04, flat: true });
        screeMesh.userData.lodDetail = true; // cinder litter: close-up only
        g.add(screeMesh);

        // boulder scatter: real faceted rock among the hewn blocks — they catch
        // the sun quite differently from the boxes, which is what stops the
        // canyon reading as masonry
        for (let i = 0; i < 62; i += 1) {
          const u = (i + 0.5) / 62;
          if (inTube(u) || atStation(u)) continue;
          const f = ride.frameAt(u);
          sideH(f, side);
          const h1 = hash01(i * 5.9 + 17);
          const h2 = hash01(i * 2.7 + 31);
          const s = i % 2 ? 1 : -1;
          const sc = 0.3 + h1 * 0.62;
          const d = WALL_IN + 0.35 + h2 * 2.9;
          const bx = f.p.x + side.x * s * d;
          const bz = f.p.z + side.z * s * d;
          if (open(bx, bz)) continue;
          const rock = buildRock(t, { scale: sc, seed: 30 + i * 7, tint: i % 3 === 0 ? 0x5a5148 : 0x453e36 });
          rock.position.set(bx, groundAt(bx, bz) - sc * 0.14, bz);
          if (sc < 0.5) rock.userData.lodDetail = true;
          g.add(rock);
        }

        // ---- 5. the scorched ASH APRON under the whole footprint ----------
        // The ride stands on the caldera floor, so it brings its own ground: a
        // lattice of broken ash plates covering the WHOLE footprint (the loop
        // interior included — that is the caldera, and a green hole in the
        // middle of it was the single worst thing in the first render). Each
        // plate is seated on `groundAt` so the apron follows real terrain, they
        // overlap by 0.3 u so no grass shows through the joints, and each sits
        // at its own hashed height so overlapping plates never z-fight.
        {
          let x0 = Infinity;
          let x1 = -Infinity;
          let z0 = Infinity;
          let z1 = -Infinity;
          for (let i = 0; i < M; i += 1) {
            const f = ride.frameAt(i / M);
            x0 = Math.min(x0, f.p.x);
            x1 = Math.max(x1, f.p.x);
            z0 = Math.min(z0, f.p.z);
            z1 = Math.max(z1, f.p.z);
          }
          const PAD = 5.2;
          const STEP = 1.35;
          const plates: MergedBoxSpec[] = [];
          // …and the apron's OUTER 2.4 u is dithered away in CLUMPS, so the ash
          // does not end on a drawn rectangle. The audit's park-camera shot
          // (--elev=50) caught the hard edge as a straight seam against the
          // grass; a per-cell hash would only have turned it into a
          // checkerboard (rules/component-audit.md §6), so the threshold is two
          // low-frequency sines of position — the field breaks off in patches,
          // like ash blown thin, and the land's own `calderaFloor` runs its
          // dither out over the same rim.
          const FADE = 2.4;
          const inner = { x0: x0 - PAD + FADE, x1: x1 + PAD - FADE, z0: z0 - PAD + FADE, z1: z1 + PAD - FADE };
          for (let x = x0 - PAD; x <= x1 + PAD; x += STEP)
            for (let z = z0 - PAD; z <= z1 + PAD; z += STEP) {
              const h = hash01(x * 1.7 + z * 3.1);
              const h2 = hash01(x * 5.3 + z * 0.9);
              // 0 well inside the field, 1 at its outermost ring
              const out = Math.max(
                0,
                Math.max(inner.x0 - x, x - inner.x1, inner.z0 - z, z - inner.z1) / FADE,
              );
              if (out > 0) {
                const clump = 0.5 + 0.34 * Math.sin(x * 0.41 + z * 0.29) + 0.2 * Math.sin(z * 0.73 - x * 0.19);
                if (out > clump) continue;
              }
              plates.push({
                dims: [STEP + 0.3, 0.06, STEP + 0.3],
                pos: [x, groundAt(x, z) + 0.004 + h2 * 0.014, z],
                rotY: (h - 0.5) * 0.3,
                repeat: [2, 2],
              });
            }
          const apron = mergedBoxes(t, plates, ASH, { tex: 'asphalt', rough: 1, bump: 0.05, flat: true });
          apron.castShadow = false;
          g.add(apron);
        }

        // ---- 6. THE LIQUID: one continuous animated ribbon through the trough
        // Same machinery as LogFlume/RiverRapids (`buildWaterRibbon`) but on
        // WaterTile's **LAVA** palette: this is the Emberfall Caldera, and the
        // channel the boats ride is molten rock, not water. The palette is
        // arranged inversely to water's — the wave TROUGHS are chilled basalt
        // crust and only the crests tear open incandescent — and it carries
        // `glow: 1`, so the trough is a light source that brightens after dark
        // instead of dimming (the house rule for anything hot here).
        //
        // `amp`/`waviness` are dropped to 0.09/0.30: lava is orders of
        // magnitude more viscous than water, so the same swell that reads as
        // river chop reads as boiling soup on a flow. The profile's own flat
        // blue-grey strip (−0.02) is left beneath as the backing body, exactly
        // as in the water build — the LAVA sheet is opaque, so it never shows.
        const RIBBON_N = 260;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        for (let k = 0; k < RIBBON_N; k += 1) {
          const f = ride.frameAt(k / RIBBON_N);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, 0.035), side: f.side.clone(), up: f.up.clone() });
        }
        ribbonPts.push({ ...ribbonPts[0] }); // close the loop watertight
        // width 0.80, not the water build's 0.72: the flume profile lays its own
        // opaque blue-grey backing strip 0.72 wide at −0.02 and I cannot edit
        // SplineRideKit, so the molten sheet has to be WIDER than it to hide it.
        // At 0.72 the backing showed as a cyan sliver either side of the lava
        // through the chute and the run-out (visible in the pv2 close-up).
        // 0.80 still clears the trough walls at ±0.45.
        const flumeWater = buildWaterRibbon(t, ribbonPts, 0.8, { amp: 0.09, waviness: 0.3, palette: LAVA });
        g.add(flumeWater.mesh);

        // ---- 7. THE CONVEYOR: cleated belts up both climbs -----------------
        // twin rows of rubber cleats riding the kit's chain lines at ±0.30
        // (top +0.045 — the hull is up at +0.148 out there, so it never
        // touches), on EVERY climbing frame: the kit only draws its chain up
        // the tallest flight, and this circuit climbs in two.
        {
          const cleats: MergedBoxSpec[] = [];
          const beadMats: THREE.MeshStandardMaterial[] = [];
          const CN = 260;
          for (let i = 0; i < CN; i += 1) {
            const f = ride.frameAt(i / CN);
            if (f.fwd.y <= 0.13) continue;
            const basis = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
            for (const s of [-1, 1] as const) {
              const m = basis.clone();
              m.setPosition(f.p.clone().addScaledVector(f.side, s * 0.3).addScaledVector(f.up, -0.02));
              cleats.push({ dims: [0.1, 0.05, 0.075], matrix: m });
            }
            // ember beads on the rim rails every 12th sample (emissive only)
            if (i % 12 === 0)
              for (const s of [-1, 1] as const) {
                const bead = ball(t, 0.03, 0xffcf8a, [0, 0, 0], { emissive: 0xff7a22, rough: 0.35 });
                bead.position.copy(f.p).addScaledVector(f.side, s * 0.46).addScaledVector(f.up, 0.26);
                (bead.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.16;
                g.add(bead);
                beadMats.push(bead.material as THREE.MeshStandardMaterial);
              }
          }
          if (cleats.length) g.add(mergedBoxes(t, cleats, 0x1d1b1a, { tex: 'plastic', rough: 0.8 }));
          (g.userData as { beadMats?: THREE.MeshStandardMaterial[] }).beadMats = beadMats;
        }

        // ---- 8. THE CHUTE + its steaming splash run-out --------------------
        {
          // flared splash boards riding both rim rails through the valley
          const fUp = new t.Vector3();
          const fSide = new t.Vector3();
          const fDir = new t.Vector3();
          for (let i = 0; i < 6; i += 1) {
            const f0 = ride.frameAt(uRun - 0.004 + i * 0.011);
            const f1 = ride.frameAt(uRun - 0.004 + (i + 1) * 0.011);
            for (const s of [-1, 1] as const) {
              const a = f0.p.clone().addScaledVector(f0.side, s * 0.5).addScaledVector(f0.up, 0.17);
              const b = f1.p.clone().addScaledVector(f1.side, s * 0.5).addScaledVector(f1.up, 0.17);
              fDir.subVectors(b, a);
              const len = fDir.length();
              fDir.normalize();
              fUp.addVectors(f0.up, f1.up).normalize().multiplyScalar(Math.cos(0.6)).addScaledVector(f0.side, s * Math.sin(0.6)).normalize();
              fUp.addScaledVector(fDir, -fUp.dot(fDir)).normalize();
              fSide.crossVectors(fUp, fDir).normalize();
              const board = box(t, [0.024, 0.17, len * 1.12], 0x59401f, [0, 0, 0], { tex: 'wood', repeat: [1, 2], rough: 0.9 });
              board.position.addVectors(a, b).multiplyScalar(0.5).addScaledVector(fUp, 0.065);
              board.setRotationFromMatrix(new t.Matrix4().makeBasis(fSide, fUp, fDir));
              g.add(board);
            }
          }
          // churned patches where the hull ploughs the flow open. These were
          // WHITE WATER FOAM (0xe4f4f9) — correct for a water flume and wrong
          // the moment the trough became molten: a hull ploughing lava tears
          // the chilled skin and exposes the incandescent interior, so the
          // patches are hot torn crust, lit, not white.
          for (let i = 0; i < 5; i += 1) {
            const f = ride.frameAt(uRun + i * 0.014);
            // 0xffb257 at emissive 0.9 washed out to pale CREAM against the
            // molten trough and read as the white foam it replaced; a deeper
            // base and half the emissive make it a hot spot in the flow instead
            const patch = box(t, [0.6 + 0.14 * ((i * 3) % 2), 0.014, 0.42], 0xff8a2c, [0, 0, 0], { rough: 0.6, opacity: 0.9, emissive: 0xff5a12 });
            (patch.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
            poolMats.push(patch.material as THREE.MeshStandardMaterial);
            patch.castShadow = false;
            patch.position.copy(f.p).addScaledVector(f.up, 0.04).addScaledVector(f.side, Math.sin(i * 5.1) * 0.06);
            patch.setRotationFromMatrix(new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up)));
            patch.rotateY(Math.sin(i * 9.2) * 0.2);
            g.add(patch);
          }
        }
        // the burst itself — staggered balls that erupt as the boat lands. On a
        // molten channel this is a SPATTER dome (hot, thrown rock) with steam
        // above it, not a white water crown: pale ember yellow, self-lit.
        const spray = new t.Group();
        spray.position.set(SPLASH_AT.x, splashY + 0.05, SPLASH_AT.z);
        spray.rotation.y = yawOf(runF);
        const foam: THREE.Mesh[] = [];
        for (let i = 0; i < 7; i += 1) {
          const a = i * 2.39;
          const rr = 0.16 + 0.5 * Math.abs(Math.sin(i * 12.9898));
          const fb = ball(t, 0.15 + 0.045 * ((i * 7) % 3), 0xffcf8a, [Math.cos(a) * rr * 0.4, 0.08 + 0.09 * Math.abs(Math.sin(i * 4.7)), Math.sin(a) * rr * 1.1 + 0.06 * i], { rough: 0.5, opacity: 0.9, emissive: 0xff6a1e });
          (fb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.75;
          fb.scale.y = 0.7;
          spray.add(fb);
          foam.push(fb);
        }
        g.add(spray);

        // ---- 9. THE LAVA TUBE ---------------------------------------------
        // a rock bore over the return leg, lit from WITHIN by a magma seam in
        // its floor: a rock roof and side walls (structural, ROCK-coloured —
        // they are the cut faces of the outcrop), thin DARK panels just inside
        // so the bore itself reads unlit, glowing crack panels along the lower
        // walls, the floor seam, and a boulder mound over the top so the mouth
        // reads as a hole in the hill.
        const tubeLavaMats: THREE.MeshStandardMaterial[] = [];
        const tubeLight = new t.PointLight(0xff7a22, 0, 6.5, 2);
        {
          const fMid = ride.frameAt(tubeU);
          const bore = new t.Group();
          bore.position.copy(fMid.p);
          bore.rotation.y = yawOf(fMid);
          g.add(bore);
          // local frame: +z along the track, +x the track's side, y measured
          // from the RAIL CENTRELINE (so the ground sits at gy)
          const gy = groundAt(fMid.p.x, fMid.p.z) - fMid.p.y;
          const CLEAR = 1.15; // head height above the rails (prow tops out at 0.83)
          bore.add(box(t, [2.66, 0.4, TUBE_HALF * 2], BASALT, [0, CLEAR + 0.18, 0], { tex: 'concrete', repeat: [4, 6], rough: 1, bump: 0.06, flat: true }));
          bore.add(box(t, [2.1, 0.06, TUBE_HALF * 2 - 0.1], 0x1a1512, [0, CLEAR - 0.02, 0], { tex: 'concrete', repeat: [3, 6], rough: 1 })); // unlit bore ceiling
          [-1.3, 1.3].forEach((x) =>
            bore.add(box(t, [0.44, CLEAR - gy, TUBE_HALF * 2], BASALT, [x, gy + (CLEAR - gy) / 2, 0], { tex: 'concrete', repeat: [2, 6], rough: 1, bump: 0.06, flat: true })),
          );
          [-1.05, 1.05].forEach((x) =>
            bore.add(box(t, [0.05, CLEAR - gy - 0.06, TUBE_HALF * 2 - 0.1], 0x1a1512, [x, gy + (CLEAR - gy) / 2, 0], { tex: 'concrete', repeat: [1, 6], rough: 1 })),
          );
          // GLOWING CRACK PANELS on the lower bore walls — the light source
          [-1, 1].forEach((s) => {
            const [c, k] = newLavaTex();
            c.repeat.set(TUBE_HALF * 0.8, 0.6);
            k.repeat.set(TUBE_HALF * 0.8, 0.6);
            const m = lavaMat(t, s > 0 ? 0.4 : 0.52, c, k);
            const panel = new t.Mesh(new t.PlaneGeometry(TUBE_HALF * 2 - 0.14, 0.8), m);
            panel.position.set(s * 1.015, gy + 0.42, 0);
            panel.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
            g.userData.tubePanel = true;
            bore.add(panel);
            tubeLavaMats.push(m);
          });
          // the floor seam: a magma channel down one side of the bore floor
          {
            const seam: RibbonPt[] = [];
            for (let k = 0; k <= 10; k += 1) {
              const zz = -TUBE_HALF + (k / 10) * TUBE_HALF * 2;
              seam.push({ x: -0.78 + 0.07 * Math.sin(k * 0.9), y: gy + 0.03, z: zz, dx: 1, dz: 0, w: 0.4, lift: 0.03 });
            }
            const [c, k2] = newLavaTex();
            const rib = magmaChannel(t, seam, 4, 0.06, 0.34, c, k2, TS_N);
            bore.add(rib.group);
            rib.segs.forEach((s) => flowSegs.push(s));
          }
          // basalt lips shoved up either side of the seam
          const lip: MergedBoxSpec[] = [];
          for (let k = 0; k < 6; k += 1) {
            const zz = -TUBE_HALF + 0.35 + k * ((TUBE_HALF * 2 - 0.7) / 5);
            lip.push({ dims: [0.2, 0.11, 0.3], pos: [-0.5, gy + 0.05, zz], rotZ: -0.24 });
            lip.push({ dims: [0.18, 0.1, 0.28], pos: [-1.0, gy + 0.05, zz], rotZ: 0.2 });
          }
          bore.add(mergedBoxes(t, lip, 0x241f1c, { tex: 'asphalt', rough: 1, bump: 0.05, flat: true }));
          // timber portal ribs at both mouths — the flume's own construction
          const ribs: MergedBoxSpec[] = [];
          [-1, 1].forEach((s) => {
            const z = s * TUBE_HALF;
            [-1.12, 1.12].forEach((x) => ribs.push({ dims: [0.22, CLEAR - gy, 0.26], pos: [x, gy + (CLEAR - gy) / 2, z], repeat: [1, 4] }));
            ribs.push({ dims: [2.7, 0.26, 0.3], pos: [0, CLEAR + 0.13, z], repeat: [5, 1] });
            [-1, 1].forEach((sx) => ribs.push({ dims: [0.46, 0.16, 0.18], pos: [sx * 0.88, CLEAR - 0.2, z], rotZ: sx * 0.7, repeat: [2, 1] }));
          });
          bore.add(mergedBoxes(t, ribs, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          // ROCK MOUND: the outcrop the bore is driven through
          for (let i = 0; i < 34; i += 1) {
            const h1 = hash01(i * 5.3 + 2);
            const h2 = hash01(i * 9.7 + 7);
            const sgn = hash01(i * 3.1 + 29) < 0.5 ? -1 : 1;
            const tier = i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : 2; // crest gets a THIRD of the pile: a flat slab of exposed roof liner was the only thing reading as a shed
            const sc = tier === 0 ? 0.44 + h1 * 0.34 : tier === 1 ? 0.6 + h1 * 0.34 : 0.78 + h1 * 0.42;
            const rock = buildRock(t, { scale: sc, seed: 90 + i * 3, tint: i % 4 === 0 ? 0x5a5148 : 0x453e36 });
            const x = tier === 0 ? (h2 - 0.5) * 2.4 : sgn * (0.68 + 1.05 * sc + h2 * (tier === 1 ? 0.12 : 0.24));
            const y = tier === 0 ? CLEAR + 0.3 : tier === 1 ? gy + 0.95 : gy - 0.1;
            rock.position.set(x, y, (h1 - 0.5) * (TUBE_HALF * 2.1));
            bore.add(rock);
          }
          tubeLight.position.set(0, gy + 0.5, 0);
          bore.add(tubeLight);
        }

        // ---- 12. EFFECTS: 220 particles over 3 emitters --------------------
        const splashFx = buildEmitter(t, {
          max: 90,
          rate: 0,
          life: 0.65,
          lifeVar: 0.25,
          velocity: [0, 1.7, 0],
          spread: 1.15,
          gravity: 5.5,
          size: 0.075,
          sizeEnd: 0.14,
          // thrown lava, cooling in flight: white-hot at the lip, deep red as
          // it falls back (was 0xeaf6fb → 0xbfe0ee water droplets)
          color: 0xffe6b0,
          colorEnd: 0xc4361a,
          opacity: 0.9,
        });
        splashFx.setOrigin(SPLASH_AT.x, splashY + 0.1, SPLASH_AT.z);
        g.add(splashFx.points);
        // steam where the splash water meets hot rock — thin, slow, pale
        const steamFx = buildEmitter(t, {
          max: 70,
          rate: 11,
          life: 2.6,
          lifeVar: 0.7,
          velocity: [0.06, 0.78, 0.02],
          spread: 0.42,
          gravity: -0.05,
          size: 0.24,
          sizeEnd: 1.05,
          color: 0xb9b2ab,
          colorEnd: 0xdcd7d2,
          opacity: 0.2,
        });
        steamFx.setOrigin((SPLASH_AT.x + poolC.x) / 2, poolC.y + 0.2, (SPLASH_AT.z + poolC.z) / 2);
        g.add(steamFx.points);
        // embers off the pool: launched white-hot, cooling to deep red
        const emberFx = buildEmitter(t, {
          max: 60,
          rate: 8,
          life: 2.3,
          lifeVar: 0.8,
          velocity: [0, 1.65, 0],
          spread: 0.75,
          gravity: 1.5,
          size: 0.085,
          sizeEnd: 0.022,
          color: 0xffe2a0,
          colorEnd: 0xc42604,
          opacity: 1,
          additive: true,
        });
        emberFx.setOrigin(poolC.x, poolC.y + 0.16, poolC.z);
        g.add(emberFx.points);

        // ---- 13. STATION: plank boarding deck under a scorched canopy ------
        const lampMats: THREE.MeshStandardMaterial[] = [];
        const stLight = new t.PointLight(0xffb45e, 0, 5.5, 2);
        {
          const st = ride.frameAt(0);
          const yard = new t.Group();
          yard.position.set(st.p.x, 0, st.p.z);
          yard.rotation.y = yawOf(st);
          g.add(yard);
          // local frame: +z along the station straight (the local −x of the
          // ride), +x the BOARDING side (the free face the queue arrives on)
          const deckTop = st.p.y + 0.03;
          const DX = 1.02; // deck centre: inner edge 0.52 clears the 0.505 rim
          const DZ = 1.15; // pushed along the straight, clear of the entrance hut
          yard.add(box(t, [1.0, 0.09, 2.1], TIMBER, [DX, deckTop - 0.045, DZ], { tex: 'wood', repeat: [3, 6], rough: 0.9, bump: 0.03 }));
          const deck: MergedBoxSpec[] = [];
          [0.62, 1.42].forEach((x) => deck.push({ dims: [0.12, 0.12, 2.1], pos: [x, deckTop - 0.15, DZ], repeat: [1, 5] }));
          [0.25, 1.15, 2.05].forEach((z) =>
            [0.62, 1.42].forEach((x) => {
              deck.push({ dims: [0.14, Math.max(0.1, deckTop - 0.21), 0.14], pos: [x, Math.max(0.05, deckTop - 0.21) / 2, z], repeat: [1, 3] });
              deck.push({ dims: [0.3, 0.06, 0.3], pos: [x, 0.03, z] });
            }),
          );
          [0.34, 0.7].forEach((y) => deck.push({ dims: [0.08, 0.07, 2.1], pos: [1.54, deckTop + y, DZ], repeat: [1, 5] })); // edge rails
          [0.25, 1.15, 2.05].forEach((z) => deck.push({ dims: [0.09, 0.76, 0.09], pos: [1.54, deckTop + 0.38, z], repeat: [1, 2] }));
          [0, 1, 2].forEach((k) => deck.push({ dims: [0.72, 0.06, 0.26], pos: [1.12, 0.13 + k * 0.14, 2.42 + k * 0.13], repeat: [2, 1] })); // steps from the queue
          yard.add(mergedBoxes(t, deck, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          // canopy on four posts, only over the DECK (inner post face 0.57)
          const can: MergedBoxSpec[] = [];
          [0.64, 1.4].forEach((x) => [0.3, 2.0].forEach((z) => can.push({ dims: [0.11, 1.1, 0.11], pos: [x, deckTop + 0.55, z], repeat: [1, 3] })));
          can.push({ dims: [1.0, 0.1, 2.2], pos: [DX, deckTop + 1.13, DZ], repeat: [3, 6] });
          [0.64, 1.4].forEach((x) => can.push({ dims: [0.1, 0.1, 2.2], pos: [x, deckTop + 1.15, DZ], repeat: [1, 6] }));
          yard.add(mergedBoxes(t, can, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
          const roof: MergedBoxSpec[] = [];
          [-1, 1].forEach((s) => roof.push({ dims: [0.78, 0.08, 2.4], pos: [DX + s * 0.3, deckTop + 1.3, DZ], rotZ: s * 0.42, repeat: [3, 7] }));
          roof.push({ dims: [0.16, 0.1, 2.44], pos: [DX, deckTop + 1.42, DZ], repeat: [1, 7] });
          yard.add(mergedBoxes(t, roof, TIMBER_D, { tex: 'wood', rough: 0.95, bump: 0.04 }));
          // a carved basalt marker stone beside the steps + a timber stack
          const marker = new t.Group();
          marker.position.set(2.1, 0, 2.5);
          yard.add(marker);
          marker.add(box(t, [0.62, 0.16, 0.62], BASALT, [0, 0.08, 0], { tex: 'concrete', rough: 1, bump: 0.05, flat: true }));
          marker.add(box(t, [0.4, 1.05, 0.3], BASALT, [0, 0.66, 0], { tex: 'concrete', repeat: [2, 3], rough: 1, bump: 0.06, flat: true }));
          const glyph = ball(t, 0.09, 0xffcf8a, [0, 0.92, 0.17], { emissive: 0xff7a22, rough: 0.35 });
          (glyph.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
          marker.add(glyph);
          poolMats.push(glyph.material as THREE.MeshStandardMaterial); // glows day AND night: it is lava-filled
          const stack: MergedBoxSpec[] = [];
          for (let k = 0; k < 6; k += 1)
            stack.push({ dims: [0.86, 0.15, 0.16], pos: [2.15, 0.08 + Math.floor(k / 2) * 0.16, 0.6 + (k % 2) * 0.19], rotY: (hash01(k * 4.7) - 0.5) * 0.14, repeat: [3, 1] });
          yard.add(mergedBoxes(t, stack, TIMBER, { tex: 'wood', rough: 0.95, bump: 0.03 }));
          // lanterns on the canopy tie beam (emissive glass) + the component's
          // ONE night-gated real light
          const lampY = deckTop + 1.02;
          [0.5, 1.8].forEach((z) => {
            yard.add(box(t, [0.12, 0.14, 0.12], IRON, [DX, lampY, z], { tex: 'metal', metal: 0.6, rough: 0.5 }));
            const glass = ball(t, 0.08, 0xffe6b0, [DX, lampY - 0.15, z], { emissive: 0xffb45e, rough: 0.35 });
            (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.14;
            yard.add(glass);
            lampMats.push(glass.material as THREE.MeshStandardMaterial);
          });
          stLight.position.set(DX, lampY - 0.32, DZ);
          yard.add(stLight);
        }

        // ---- 14. THE BOAT --------------------------------------------------
        const boat = buildTimberBoat(t, BOAT_LIVERY, { riders: opts.riders ?? true, seats: seatAnchors });
        extras.vehicle = boat; // RideViewer onboard/follow cam
        seatWorld = makeSeatWorld(t, seatAnchors);
        const emberEyes = (boat.userData.emberEyes ?? []) as THREE.MeshStandardMaterial[];
        const beadMats = ((g.userData as { beadMats?: THREE.MeshStandardMaterial[] }).beadMats ?? []);
        // wheelOffset 0.25: keel 0.05 above the trough floor amidships, and the
        // 0.135 rocker keeps the ends clear through the chute's pull-out
        const run = ride.run([boat], { wheelOffset: 0.25 });

        // ---- 15. the updater ----------------------------------------------
        // RCT2 station behaviour: the boat WAITS while guests board and brakes
        // to a stop on arrival — createMotionGate freezes the runner's clock
        // while parked. Ungated until the first onStateChange, so previews run
        // identically. LAVA IS NOT GATED: its glow only lerps day → night.
        const GLOW_DAY = 1.0;
        const GLOW_NIGHT = 1.9;
        const gate = createMotionGate((clock) => {
          run(clock);
          flumeWater.update(clock);
          // the LAVA sheets (lake heart, chute pool, cone vent) run on the same
          // clock as the trough, at a THIRD of its rate: a lake convects far
          // slower than a channel flows, and the shader's speed is baked in, so
          // the only dial left is the clock handed to it
          for (const lake of lavaLakes) lake.update(clock * 0.34);
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          const glow = GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nk;
          // one slow breath of the whole crack network (~15 s), plus a surge
          // travelling DOWN each channel, phase-offset by position
          const breathe = 1 + 0.11 * Math.sin(clock * 0.42 + 0.7);
          for (const s of flowSegs) s.mat.emissiveIntensity = s.heat * glow * breathe * (1 + 0.26 * Math.sin(clock * 0.31 - s.u * 3.4));
          for (const m of poolMats) m.emissiveIntensity = 1.15 * glow * (1 + 0.14 * Math.sin(clock * 0.37));
          for (const m of tubeLavaMats) m.emissiveIntensity = 1.1 * glow * breathe;
          // the crust pattern crawls downhill at ~0.02 u/s (v is arc length)
          const crawl = -clock * 0.02;
          for (const tx of crawlTex) tx.offset.y = crawl;
          // real lights: the lava pair burn day AND night (floor 0.9/0.7),
          // the station lantern is night-only
          const flick = 1 + 0.09 * Math.sin(clock * 9.7) + 0.05 * Math.sin(clock * 17.3 + 1.9);
          magmaLight.intensity = (0.9 + 1.7 * nk) * breathe * flick;
          lakeLight.intensity = lakeCells ? (1.15 + 2.2 * nk) * breathe * flick : 0;
          tubeLight.intensity = (1.3 + 1.7 * nk) * flick;
          stLight.intensity = 0.85 * ease;
          for (const m of lampMats) m.emissiveIntensity = 0.14 + 1.16 * ease;
          for (const m of beadMats) m.emissiveIntensity = 0.16 + 1.0 * ease;
          for (const m of emberEyes) m.emissiveIntensity = 0.5 + 0.9 * ease;
          // the splash: foam + droplets erupt by proximity as the boat lands
          const d = Math.hypot(boat.position.x - SPLASH_AT.x, boat.position.z - SPLASH_AT.z);
          const k = Math.max(0, 1 - d / 1.35);
          splashFx.setRate(k * 130);
          splashFx.update(clock);
          steamFx.setRate(11 + 26 * k); // the landing throws a curtain of steam
          steamFx.update(clock);
          emberFx.update(clock);
          foam.forEach((fb, i) => {
            const ki = Math.max(0, k - 0.14 * ((i * 5) % 4));
            const pulse = 0.75 + 0.25 * Math.sin(clock * 9 + i * 2.1);
            fb.scale.setScalar(Math.max(0.02, ki * pulse));
            fb.scale.y = Math.max(0.02, ki * pulse * 0.7);
          });
        }, { spinDown: 1.6 });
        onStateChange = gate.onStateChange;
        return gate.update;
      })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const MagmaRunBase = composableRide<MagmaRunOpts & { register?: boolean }>(
  'MagmaRun',
  (t, props) =>
    buildMagmaRunScene(t, {
      pieces: props.pieces,
      groundAt: props.groundAt,
      tubeU: props.tubeU,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the four thwarts (capacity 4 = 4 seats)
      riders: props.riders ?? !props.register,
    }),
  {
    // the station straight runs along the local −x, so the local +z face is
    // free: queue HEAD 2.1 out the front (entrance hut at ~1.48, clear of the
    // boarding deck), exit hut at [1.9, 2.1] beside it, boarding on the deck
    front: 2.1,
    exit: [1.9, 2.1],
    board: [-1.3, 0.6, 0],
    defaults: { name: 'Magma Run', capacity: 4, rideDuration: 20, intensity: 6, price: 5 },
  },
);

/** <MagmaRun> — the Emberfall Caldera's flagship water ride as a composable
 *  ride (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.1 out the local +z front (the face the circuit deliberately
 *  keeps clear), exit hut at local [1.9, 2.1], boarding on the plank deck.
 *  Override with top-level props / `queue`.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Lift/><TurnR/><Drop/>…` — children win) are compiled
 *  by `compileTrackPieces` on the 'flume' profile and swept by
 *  `buildRideSpline`; no pieces = the stock "Caldera Circuit" (two conveyor
 *  flights to a 4.6-unit summit, ONE 32° chute, a lava-tube return leg). A
 *  FATAL compile marks the build `invalid` so a broken circuit never
 *  registers. The hewn timber boat is the ride `vehicle` (onboard cam) and its
 *  four thwarts are live `seatWorld` anchors, so REAL guests ride it. */
export const MagmaRun: React.FC<ComposableRideProps & MagmaRunOpts & { children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <MagmaRunBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
