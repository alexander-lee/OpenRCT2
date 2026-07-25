import React from 'react';
import * as THREE from 'three';
import { mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { composable } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// Volcano — a park-scenery LANDMARK: a basalt/ash cone with a summit crater,
// a lava lake, two active flows down one flank, an older cooled flow, a lava
// pool at the base and a lava-filled ground fissure draining out of it.
//
// THE LAVA LOOK IS MODELLED ON THE REAL THING, and the real thing is mostly
// BLACK. Cooled pahoehoe crust is near-black basalt; all the light comes out
// of the CRACKS between the crust plates, where the incandescent interior
// shows through. So no mesh here is a uniformly glowing orange blob:
//
//   * one procedural Voronoi CRUST FIELD (36 jittered sites, toroidally
//     wrapped so it tiles) is baked into TWO canvases — a dark plate/groove
//     albedo (also the bump map, so the cracks are recessed) and a black-with-
//     bright-cracks EMISSIVE map. Every lava surface is `color: near-black` +
//     `emissiveMap: cracks`, so only the fissure network lights up.
//   * TEMPERATURE GRADIENT: each flow is cut into segments, each with its own
//     material sampling a colour+intensity ramp — white-yellow (~1100 °C) at
//     the vent, through yellow-orange, orange, deep red, to black basalt at
//     the cooled toe. The older flow starts at the cold end of the same ramp.
//   * SLOW MOTION: real lava creeps. The only animation is a ~15 s breathing
//     pulse of the crack glow, a slow travelling wave down each flow (phase
//     offset per segment) and a ~0.02 u/s crawl of the crust texture offset
//     downhill. Nothing strobes.
//   * DAY *AND* NIGHT: unlike every lamp in this design system, lava glows in
//     daylight too — `nightKOf` lerps the emissive multiplier between a
//     daylight value and a night value (never to zero).
//
// Effects are deterministic and budgeted: 3 ParticleKit emitters (196 particle
// capacity total — plume, embers, heat haze) and exactly ONE real PointLight,
// at the vent. Everything else is emissive material. All textures are
// procedural canvases built the way Stage's `drawTexture` does; hashed sines
// only, no Math.random / Date.now.
// ---------------------------------------------------------------------------

// ---- deterministic hashes --------------------------------------------------
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const hash2 = (a: number, b: number) => hash01(a * 37.19 + b * 91.73 + 3.11);

// ---------------------------------------------------------------------------
// PROCEDURAL CRUST FIELD (the crack network — the whole illusion)
//
// A jittered-grid Voronoi diagram over a 256² torus: plates of roughly even
// size (real crust plates are), with the crack running along each plate
// boundary. `d2 - d1` (second-nearest minus nearest site distance) is 0 exactly
// on a boundary and grows inward, so `exp(-(d2-d1)/w)` is a soft-shouldered
// crack line — a hot core with a glow falloff onto the plate, which is how a
// real cooling crust looks. Per-EDGE hashing makes some cracks hotter than
// others; a few plates get a hot centre (an incipient breakout).
// Cached module-level as CANVASES (not textures): each Volcano owns its own
// CanvasTextures because it animates their `offset` for the downhill crawl.
// ---------------------------------------------------------------------------
const CRUST_S = 256;
let _crustPair: { crust: HTMLCanvasElement; crack: HTMLCanvasElement } | null = null;

function crustCanvases(): { crust: HTMLCanvasElement; crack: HTMLCanvasElement } {
  if (_crustPair) return _crustPair;
  const S = CRUST_S;
  const G = 6; // 6x6 jittered grid = 36 sites
  const N = G * G;
  const cell = S / G;
  const sx = new Float32Array(N);
  const sy = new Float32Array(N);
  for (let gy = 0; gy < G; gy += 1) {
    for (let gx = 0; gx < G; gx += 1) {
      const i = gy * G + gx;
      sx[i] = (gx + 0.18 + hash01(i * 1.7 + 0.3) * 0.64) * cell;
      sy[i] = (gy + 0.18 + hash01(i * 2.9 + 5.1) * 0.64) * cell;
    }
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
  // basalt plate albedo: dark grey-brown, per-plate tone, fine ash speckle
  const BASE = [30, 25, 22];
  for (let py = 0; py < S; py += 1) {
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
      const e = Math.sqrt(d2) - Math.sqrt(d1); // 0 on a plate boundary
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      const edgeHeat = 0.34 + 0.66 * hash2(lo, hi); // some cracks run hotter
      // soft-shouldered crack: a thin hot CORE (w≈1.8 px) plus a short glow
      // shoulder (w≈5 px). Deliberately narrow — on real crust the plates are
      // the bulk of the surface and they are black; widen these and the whole
      // flow collapses into the fake uniform-orange look.
      let g = (0.95 * Math.exp(-e / 1.8) + 0.22 * Math.exp(-e / 4.5)) * edgeHeat;
      // a few plates keep a hot centre — an incipient breakout through the crust
      if (hash01(i1 * 4.3 + 0.7) > 0.88) g += 0.34 * Math.exp(-Math.sqrt(d1) / (cell * 0.36));
      g = Math.min(1, g);
      const o = (py * S + px) * 4;
      B[o] = B[o + 1] = B[o + 2] = Math.round(255 * g ** 0.85);
      B[o + 3] = 255;
      // albedo: plate tone + speckle, then the crack groove darkened toward
      // black so the SAME canvas works as a bump map (cracks = recessed)
      const tone = (hash01(i1 * 7.7 + 1.9) - 0.5) * 26;
      const grain = (hash2(px * 0.61, py * 0.83) - 0.5) * 16;
      const groove = 1 - 0.72 * Math.exp(-e / 2.2);
      for (let c = 0; c < 3; c += 1) {
        const v = (BASE[c] + tone + grain) * groove;
        A[o + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
      A[o + 3] = 255;
    }
  }
  cxA.putImageData(imA, 0, 0);
  cxB.putImageData(imB, 0, 0);
  _crustPair = { crust, crack };
  return _crustPair;
}

// ---------------------------------------------------------------------------
// PROCEDURAL ASH / TEPHRA texture for the cone body — horizontal STRATA beds
// (each eruption's ash fall + older cooled flows, tonally banded with wavy
// boundaries), fine lapilli speckle and faint radial erosion gullies. The band
// boundaries are periodic in x so the texture tiles around the cone; UVs put
// v = 0..1 over the whole flank so there is never a horizontal seam.
// ---------------------------------------------------------------------------
let _ashCanvas: HTMLCanvasElement | null = null;
function ashCanvas(): HTMLCanvasElement {
  if (_ashCanvas) return _ashCanvas;
  const S = 192;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const rgb = (r: number, g: number, b: number) =>
    `rgb(${Math.max(0, Math.min(255, r | 0))},${Math.max(0, Math.min(255, g | 0))},${Math.max(0, Math.min(255, b | 0))})`;
  const BASE = [96, 86, 76];
  x.fillStyle = rgb(BASE[0], BASE[1], BASE[2]);
  x.fillRect(0, 0, S, S);
  // STRATA BEDS. v = 0 is the cone BASE (three flips v, so the canvas bottom),
  // so the dusty apron down there is lighter and the fresh cinder up at the rim
  // is darker. Beds alternate between FINE ASH (lighter, smooth) and COARSE
  // LAPILLI/SCORIA (darker, chunky speckle) with a dark bedding plane between
  // them — the contrast between bed types is what makes layering read at all.
  // Kept DELIBERATELY SUBTLE: on a real cinder cone the beds are only a faint
  // tonal/grain change under the loose cinder mantle. Crank the contrast or the
  // boundary waviness up and the cone turns into a striped circus tent.
  const BEDS = 11;
  const bedTop = (b: number, px: number) => {
    const k = 2 + Math.floor(hash01(b * 1.3) * 3); // periodic → tiles in x
    const amp = 0.7 + hash01(b * 8.9) * 1.6;
    return (b / BEDS) * S + Math.sin((px / S) * Math.PI * 2 * k + b * 2.1) * amp;
  };
  for (let b = 0; b < BEDS; b += 1) {
    const t0 = b / BEDS;
    const coarse = hash01(b * 2.3 + 0.4) > 0.45;
    const tone = (coarse ? -7 : 5) + (hash01(b * 3.7 + 0.9) - 0.5) * 12 + 14 * t0 - 9;
    const warm = (hash01(b * 5.1 + 2.3) - 0.5) * 12;
    x.beginPath();
    x.moveTo(0, bedTop(b, 0));
    for (let px = 0; px <= S; px += 3) x.lineTo(px, bedTop(b, px));
    for (let px = S; px >= 0; px -= 3) x.lineTo(px, bedTop(b + 1, px) + 1);
    x.closePath();
    x.save();
    x.clip();
    x.fillStyle = rgb(BASE[0] + tone + warm, BASE[1] + tone, BASE[2] + tone - warm * 0.4);
    x.fillRect(0, 0, S, S);
    // per-bed grain: coarse scoria beds get big dark clasts, ash beds a fine dust
    const n = coarse ? 620 : 2000;
    for (let i = 0; i < n; i += 1) {
      const d = (hash01(i * 1.11 + b * 13.7) - (coarse ? 0.52 : 0.46)) * (coarse ? 48 : 28);
      x.fillStyle = rgb(BASE[0] + tone + d, BASE[1] + tone + d * 0.94, BASE[2] + tone + d * 0.88);
      const sz = coarse ? 1 + hash01(i * 3.31 + b) * 2.6 : 0.6 + hash01(i * 3.31 + b) * 1.2;
      x.fillRect(hash01(i * 5.77 + b * 2.1) * S, (t0 + hash01(i * 7.13 + b * 3.3) / BEDS) * S, sz, sz);
    }
    x.restore();
    // bedding plane: the faint shadow line every geologist photograph shows
    x.strokeStyle = rgb(BASE[0] - 40, BASE[1] - 36, BASE[2] - 32);
    x.globalAlpha = 0.3;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(0, bedTop(b, 0));
    for (let px = 0; px <= S; px += 3) x.lineTo(px, bedTop(b, px));
    x.stroke();
    x.globalAlpha = 1;
  }
  // erosion gullies running down the flank (vertical in UV space) — sparse, or
  // they tile into a pleated-lampshade pattern around the cone
  for (let i = 0; i < 7; i += 1) {
    x.strokeStyle = rgb(BASE[0] - 26, BASE[1] - 24, BASE[2] - 21);
    x.globalAlpha = 0.22 + hash01(i * 2.7) * 0.2;
    x.lineWidth = 1 + hash01(i * 4.9) * 2.4;
    const gx = hash01(i * 6.3 + 0.4) * S;
    x.beginPath();
    x.moveTo(gx, 0);
    for (let py = 0; py <= S; py += 8) x.lineTo(gx + Math.sin(py * 0.07 + i) * 3, py);
    x.stroke();
  }
  x.globalAlpha = 1;
  _ashCanvas = c;
  return c;
}

// ---- texture plumbing -----------------------------------------------------
function texFrom(t: typeof THREE, canvas: HTMLCanvasElement, rx: number, ry: number): THREE.CanvasTexture {
  const tex = new t.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// THE TEMPERATURE RAMP — `t = 0` is the vent (freshest, ~1100 °C), `t = 1` is
// cold basalt. Emissive colour AND emissive intensity fall off together, which
// is what makes the gradient read: the renderer has no tone mapping, so
// intensity > 1 clips the hot channels toward white — physically the right
// direction (hotter = whiter). The crust ALBEDO also cools, from a warm dark
// grey near the vent to near-black at the toe.
// ---------------------------------------------------------------------------
const HEAT: [number, number, number][] = [
  // [t, emissive colour, emissive intensity]
  [0.0, 0xfff0c0, 1.85], // white-yellow, ~1100 °C at the vent (crack cores clip to white)
  [0.12, 0xffd166, 1.45], // yellow
  [0.28, 0xff9422, 1.08], // orange, ~950 °C
  [0.45, 0xf05a12, 0.78], // orange-red
  [0.62, 0xcb2807, 0.46], // deep red, ~800 °C
  [0.8, 0x8a1403, 0.22], // dull red, ~700 °C
  [1.0, 0x280502, 0.035], // black crust, cooled out
];

function heatAt(t: typeof THREE, u: number): { emissive: THREE.Color; intensity: number; crust: THREE.Color } {
  const k = Math.max(0, Math.min(1, u));
  let i = 0;
  while (i < HEAT.length - 2 && k > HEAT[i + 1][0]) i += 1;
  const [t0, c0, e0] = HEAT[i];
  const [t1, c1, e1] = HEAT[i + 1];
  const f = t1 > t0 ? (k - t0) / (t1 - t0) : 0;
  const emissive = new t.Color(c0).lerp(new t.Color(c1), f);
  // fresh crust is a warm dark grey; cooled pahoehoe settles to a dark grey
  // basalt with a slight silvery skin — NOT a void, or the cold end of a flow
  // reads as a hole punched in the cone
  const crust = new t.Color(0x2e2622).lerp(new t.Color(0x211c19), k);
  return { emissive, intensity: e0 + (e1 - e0) * f, crust };
}

/** the lava material: near-black crust, glow ONLY through the crack map */
function lavaMat(
  t: typeof THREE,
  u: number,
  crustTex: THREE.Texture,
  crackTex: THREE.Texture,
): THREE.MeshStandardMaterial {
  const h = heatAt(t, u);
  const m = new t.MeshStandardMaterial({
    color: h.crust,
    map: crustTex,
    bumpMap: crustTex,
    bumpScale: 0.055,
    emissive: h.emissive,
    emissiveMap: crackTex,
    emissiveIntensity: h.intensity,
    // fresh basalt crust keeps a faint silvery sheen — a touch of gloss picks
    // out the plate surfaces so they read as SOLID crust, not as black holes
    roughness: 0.78,
    metalness: 0.1,
  });
  return m;
}

// ---- geometry helpers -----------------------------------------------------
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

/** an annular radial grid (r0..r1) whose height and UVs come from callbacks */
function radialGrid(
  t: typeof THREE,
  r0: number,
  r1: number,
  rings: number,
  seg: number,
  yFn: (r: number, az: number) => number,
  uvFn: (r: number, az: number) => [number, number],
  rEase = 1,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= rings; k += 1) {
    const r = r0 + (r1 - r0) * (k / rings) ** rEase;
    for (let i = 0; i <= seg; i += 1) {
      const az = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(az) * r, yFn(r, az), Math.sin(az) * r);
      const [u, v] = uvFn(r, az);
      uv.push(u, v);
    }
  }
  const W = seg + 1;
  for (let k = 0; k < rings; k += 1) {
    for (let i = 0; i < seg; i += 1) {
      const a = k * W + i;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  const g = new t.BufferGeometry();
  g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  faceUp(g);
  return g;
}

/** an irregular lobed disc (lava lake / pool): hashed outline, slight dome */
function blobDisc(
  t: typeof THREE,
  r0: number,
  wob: number,
  dome: number,
  seed: number,
  seg = 30,
  rings = 3,
  tscale = 1,
): THREE.BufferGeometry {
  const rAt = (az: number) =>
    r0 * (1 + wob * (Math.sin(az * 3 + seed) * 0.55 + Math.sin(az * 5 - seed * 1.7) * 0.3 + Math.sin(az * 7 + 2.1) * 0.15));
  const pos: number[] = [0, dome, 0];
  const uv: number[] = [0, 0]; // planar projection — the hub sits at uv origin
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

// ---------------------------------------------------------------------------
// RIBBON — the shared builder for lava flows and the ground fissure. Three
// columns wide (left levee / raised centre / right levee) so the flow has a
// rounded cross-section instead of reading as a decal, arc-length UVs so the
// crust pattern is continuous down the whole flow (and so a v-offset drift
// crawls DOWNHILL), and cut into `segs` separately-materialled pieces for the
// temperature gradient.
// ---------------------------------------------------------------------------
interface RibbonPt {
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  w: number;
  lift: number;
}
interface RibbonSeg {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  /** normalized position along the ribbon (0 = head) — the gradient key */
  u: number;
}

function buildRibbon(
  t: typeof THREE,
  pts: RibbonPt[],
  segs: number,
  heat0: number,
  heat1: number,
  crustTex: THREE.Texture,
  crackTex: THREE.Texture,
  tscale: number,
): { group: THREE.Group; segs: RibbonSeg[] } {
  const N = pts.length;
  const arc: number[] = [0];
  for (let k = 1; k < N; k += 1) {
    const a = pts[k - 1];
    const b = pts[k];
    arc.push(arc[k - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const total = arc[N - 1] || 1;
  const COLS = [-0.5, 0, 0.5];
  const vert = (k: number, c: number): [number, number, number, number, number] => {
    const p = pts[k];
    const off = COLS[c] * p.w;
    return [
      p.x + p.dx * off,
      p.y + p.lift * (c === 1 ? 1 : 0.38),
      p.z + p.dz * off,
      off * tscale,
      arc[k] * tscale,
    ];
  };
  const group = new t.Group();
  const out: RibbonSeg[] = [];
  for (let j = 0; j < segs; j += 1) {
    const k0 = Math.round((j * (N - 1)) / segs);
    const k1 = Math.round(((j + 1) * (N - 1)) / segs);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let k = k0; k <= k1; k += 1) {
      for (let c = 0; c < 3; c += 1) {
        const [x, y, z, u, v] = vert(k, c);
        pos.push(x, y, z);
        uv.push(u, v);
      }
    }
    const rows = k1 - k0;
    for (let k = 0; k < rows; k += 1) {
      for (let c = 0; c < 2; c += 1) {
        const a = k * 3 + c;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
      }
    }
    const g = new t.BufferGeometry();
    g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    faceUp(g);
    const uMid = arc[Math.round((k0 + k1) / 2)] / total;
    const m = lavaMat(t, heat0 + (heat1 - heat0) * uMid, crustTex, crackTex);
    m.side = t.DoubleSide; // thin ribbon seen edge-on from below the flank
    const mesh = new t.Mesh(g, m);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    out.push({ mesh, mat: m, u: uMid });
  }
  return { group, segs: out };
}

// ---------------------------------------------------------------------------
// the cone's shape — one height field, shared by the mesh, the flow paths and
// the scattered basalt blocks so nothing ever floats or sinks
// ---------------------------------------------------------------------------
interface Notch {
  az: number;
  depth: number;
  wid: number;
}
interface ConeShape {
  R: number;
  H: number;
  rRim: number;
  rLake: number;
  floorY: number;
  surfY(r: number, az: number): number;
}

function coneShape(R: number, H: number, rRim: number, craterDepth: number, rLake: number, seed: number, notches: Notch[]): ConeShape {
  const floorY = H - craterDepth;
  // AZIMUTHAL lumpiness = RADIAL rills and buttresses running down the slope,
  // which is what a real cinder cone's flank shows. (Radial waves would give
  // concentric terraces instead — those read as a stack of pancakes, so the
  // ash-bed layering is carried by the TEXTURE, not by the height field.)
  const lump = (az: number) =>
    0.1 * Math.sin(az * 5 + seed * 1.7) +
    0.07 * Math.sin(az * 9 - seed * 0.9 + 1.1) +
    0.04 * Math.sin(az * 15 + seed * 2.3) +
    0.022 * Math.sin(az * 23 - seed * 3.1);
  const surfY = (r: number, az: number) => {
    let y: number;
    let amp: number;
    if (r <= rLake) {
      y = floorY; // the lava lake plane — flat, it is a liquid
      amp = 0;
    } else if (r <= rRim) {
      const w = (r - rLake) / (rRim - rLake);
      y = floorY + (H - floorY) * w ** 1.7; // crater wall, steepest at the rim
      amp = 0.3 * w;
    } else {
      const u = (R - r) / (R - rRim);
      // near-STRAIGHT flanks at the angle of repose (~48°) with only a slight
      // concave flare into the basal apron — exponents much above ~1.15 turn
      // the silhouette into a dome instead of a cone. The SIGNED power carries
      // straight on past r = R into a buried skirt, so the base flares into the
      // ground smoothly instead of creasing at a hard rim.
      y = H * Math.sign(u) * Math.abs(u) ** 1.12;
      // lumps fade out at the very base so nothing pokes through the terrain
      amp = (0.5 + 0.9 * Math.sin(Math.PI * (1 - Math.max(0, u)))) * Math.max(0, Math.min(1, u / 0.14));
    }
    y += lump(az) * amp;
    // a whisper of radial terracing, phase-shifted around the cone so it never
    // closes into a clean ring
    if (r > rRim) y += 0.022 * Math.sin(r * 5.5 - 0.6 + 2.4 * Math.sin(az * 3 + seed)) * amp;
    for (const n of notches) {
      let d = az - n.az;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      y -= n.depth * Math.exp(-((d / n.wid) ** 2)) * Math.exp(-(((r - rRim) / 0.6) ** 2));
    }
    return y;
  };
  return { R, H, rRim, rLake, floorY, surfY };
}

// ---- flow paths -----------------------------------------------------------
interface FlowSpec {
  /** azimuth of the rim breach it spills from */
  az: number;
  rStart: number;
  rEnd: number;
  w0: number;
  w1: number;
  thick: number;
  /** ramp position at the head / at the toe (0 = white-hot, 1 = cold basalt) */
  heat0: number;
  heat1: number;
  segs: number;
  meander: number;
  seed: number;
}

function flowPath(shape: ConeShape, s: FlowSpec, N = 34): RibbonPt[] {
  const pts: RibbonPt[] = [];
  for (let k = 0; k < N; k += 1) {
    const tt = k / (N - 1);
    const r = s.rStart + (s.rEnd - s.rStart) * tt;
    const az =
      s.az + s.meander * tt * (Math.sin(tt * 3.4 + s.seed) * 0.7 + Math.sin(tt * 6.1 + s.seed * 2) * 0.3);
    // the flow FRONT bulges and thickens where it stalls and piles up
    const lobe = Math.exp(-(((tt - 0.94) / 0.08) ** 2));
    const w = (s.w0 + (s.w1 - s.w0) * tt ** 0.7) * (1 + 0.5 * lobe);
    const rope = 1 + 0.24 * Math.sin(tt * 27 + s.seed * 3); // ropey pahoehoe crust
    const th = s.thick * (0.85 + 0.5 * tt) * (1 + 0.7 * lobe) * rope;
    pts.push({
      x: Math.cos(az) * r,
      z: Math.sin(az) * r,
      y: Math.max(0, shape.surfY(r, az)) + 0.03,
      dx: -Math.sin(az),
      dz: Math.cos(az),
      w,
      lift: th,
    });
  }
  return pts;
}

// ---------------------------------------------------------------------------
export interface VolcanoOpts {
  /** cone base radius in world units / tiles (default 2.75 → 5.5 tiles across) */
  radius?: number;
  /** crater-rim height (default 2.55 — a ~53° cone at the default radius) */
  height?: number;
  /** deterministic variation seed (default 1) */
  seed?: number;
  /** 1 = erupting (default), ~0.3 = quietly glowing, 0 = extinct: no glow,
   *  no plume, no light — a plain black basalt cone */
  activity?: number;
  /** crater plume + ember sparks (default true) */
  plume?: boolean;
}

export interface VolcanoBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** cone base radius (for blocker registration / layout) */
  radius: number;
  /** local xz of the base lava pool (rotate by the mount rotation) */
  pool: [number, number];
  /** pool radius */
  poolR: number;
}

/**
 * The volcano rig. Group origin sits at ground level under the cone axis;
 * everything is local, so the composable transform places it. Deterministic —
 * hashed sines only. `update(time)` takes ABSOLUTE time.
 */
export function buildVolcano(t: typeof THREE, opts: VolcanoOpts = {}): VolcanoBuilt {
  const R = opts.radius ?? 2.75;
  const H = opts.height ?? 2.55;
  const seed = opts.seed ?? 1;
  const act = Math.max(0, opts.activity ?? 1);
  const wantPlume = (opts.plume ?? true) && act > 0.02;
  const S = R / 2.75; // everything below is authored at R = 2.75 and scaled
  const rRim = 0.8 * S;
  const craterDepth = 0.52 * S;
  const rLake = 0.46 * S;
  const TS = 1.15 / S; // crust texture scale — plates stay ~0.16 u across

  const group = new t.Group();
  group.name = 'volcano';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texes: THREE.Texture[] = [];

  // ---- the three flows (two active + one older, cooled) --------------------
  const FLOWS: FlowSpec[] = [
    // the main flow: spills the rim breach, runs all the way past the base
    { az: 0.62, rStart: 0.72 * S, rEnd: 3.05 * S, w0: 0.26 * S, w1: 0.58 * S, thick: 0.085 * S, heat0: 0.03, heat1: 0.66, segs: 8, meander: 0.22, seed: 1.3 + seed },
    // a shorter one that stalls on the lower flank as a cooled black toe
    { az: 2.45, rStart: 0.72 * S, rEnd: 2.3 * S, w0: 0.2 * S, w1: 0.44 * S, thick: 0.075 * S, heat0: 0.09, heat1: 0.86, segs: 6, meander: 0.3, seed: 2.7 + seed },
    // an OLD flow: same ramp, cold end only — black crust with a whisper of
    // dull red still deep in the cracks
    { az: -1.45, rStart: 0.74 * S, rEnd: 2.9 * S, w0: 0.3 * S, w1: 0.5 * S, thick: 0.06 * S, heat0: 0.86, heat1: 1.0, segs: 3, meander: 0.18, seed: 4.1 + seed },
  ];
  const notches: Notch[] = [
    { az: FLOWS[0].az, depth: 0.3 * S, wid: 0.3 },
    { az: FLOWS[1].az, depth: 0.26 * S, wid: 0.26 },
    { az: FLOWS[2].az, depth: 0.15 * S, wid: 0.32 },
  ];
  const shape = coneShape(R, H, rRim, craterDepth, rLake, seed, notches);

  // ---- the cone body: ash/tephra strata, no glow ---------------------------
  const ashTex = texFrom(t, ashCanvas(), 4, 1);
  texes.push(ashTex);
  const flankGeo = radialGrid(
    t,
    rRim,
    R + 0.22 * S,
    20,
    64,
    shape.surfY,
    (r, az) => [(az / (Math.PI * 2)) * 4, Math.max(0, (R - r) / (R - rRim))],
    0.8, // ring spacing biased toward the steep upper flank
  );
  const flankMat = mat(t, 0xffffff, { rough: 0.97 });
  flankMat.map = ashTex;
  flankMat.bumpMap = ashTex;
  flankMat.bumpScale = 0.07;
  const flanks = new t.Mesh(flankGeo, flankMat);
  flanks.castShadow = true;
  flanks.receiveShadow = true;
  group.add(flanks);
  geos.push(flankGeo);
  mats.push(flankMat);

  // ---- crater wall: dark crust with hot cracks (the caldera glow) ----------
  const pair = crustCanvases();
  const wallCrust = texFrom(t, pair.crust, 1, 1);
  const wallCrack = texFrom(t, pair.crack, 1, 1);
  texes.push(wallCrust, wallCrack);
  const wallGeo = radialGrid(
    t,
    rLake - 0.02 * S,
    rRim,
    8,
    64,
    shape.surfY,
    // ARC-LENGTH UVs (u = circumference, v = slope distance up the wall) so the
    // crust plates stay square instead of corrugating into rings. u is rounded
    // to a whole number of tiles so the wrap seam is invisible.
    (r, az) => [
      (az / (Math.PI * 2)) * Math.max(2, Math.round(Math.PI * (rLake + rRim) * TS)),
      Math.hypot(r - rLake, shape.surfY(r, az) - shape.floorY) * TS,
    ],
  );
  const wallMat = lavaMat(t, 0.66, wallCrust, wallCrack);
  const wall = new t.Mesh(wallGeo, wallMat);
  wall.receiveShadow = true;
  group.add(wall);
  geos.push(wallGeo);
  mats.push(wallMat);

  // ---- the lava lake on the crater floor — the hottest surface here --------
  const lakeCrust = texFrom(t, pair.crust, 1, 1);
  const lakeCrack = texFrom(t, pair.crack, 1, 1);
  lakeCrust.repeat.set(1, 1);
  texes.push(lakeCrust, lakeCrack);
  // radius overshoots the crater-wall grid so the lobed outline never opens a
  // sliver of sky between the lake and the wall
  const lakeGeo = blobDisc(t, rLake + 0.06 * S, 0.055, 0.012 * S, seed * 1.7, 30, 3, TS);
  const lakeMat = lavaMat(t, 0.05, lakeCrust, lakeCrack);
  const lake = new t.Mesh(lakeGeo, lakeMat);
  lake.position.y = shape.floorY + 0.012 * S;
  group.add(lake);
  geos.push(lakeGeo);
  mats.push(lakeMat);

  // ---- the flows -----------------------------------------------------------
  const flowSegs: { mat: THREE.MeshStandardMaterial; u: number; heat: number }[] = [];
  const crawlTex: THREE.Texture[] = [];
  const flowEnds: [number, number][] = [];
  FLOWS.forEach((spec, fi) => {
    const fCrust = texFrom(t, pair.crust, 1, 1);
    const fCrack = texFrom(t, pair.crack, 1, 1);
    texes.push(fCrust, fCrack);
    crawlTex.push(fCrust, fCrack);
    const pts = flowPath(shape, spec, fi === 2 ? 22 : 34);
    const rib = buildRibbon(t, pts, spec.segs, spec.heat0, spec.heat1, fCrust, fCrack, TS);
    group.add(rib.group);
    rib.segs.forEach((sg) => {
      geos.push(sg.mesh.geometry);
      mats.push(sg.mat);
      flowSegs.push({ mat: sg.mat, u: sg.u, heat: heatAt(t, spec.heat0 + (spec.heat1 - spec.heat0) * sg.u).intensity });
    });
    const last = pts[pts.length - 1];
    flowEnds.push([last.x, last.z]);
  });

  // ---- the base lava pool the main flow drains into ------------------------
  const [ex, ez] = flowEnds[0];
  const eAz = Math.atan2(ez, ex);
  const poolR = 0.5 * S;
  const poolC: [number, number] = [ex + Math.cos(eAz) * 0.34 * S, ez + Math.sin(eAz) * 0.34 * S];
  const poolCrust = texFrom(t, pair.crust, 1, 1);
  const poolCrack = texFrom(t, pair.crack, 1, 1);
  texes.push(poolCrust, poolCrack);
  crawlTex.push(poolCrust, poolCrack);
  const poolGeo = blobDisc(t, poolR, 0.16, 0.03 * S, seed * 3.1, 30, 3, TS);
  const poolMat = lavaMat(t, 0.42, poolCrust, poolCrack);
  const pool = new t.Mesh(poolGeo, poolMat);
  pool.position.set(poolC[0], 0.035 * S, poolC[1]);
  group.add(pool);
  geos.push(poolGeo);
  mats.push(poolMat);

  // ---- a lava-filled FISSURE draining out of the pool ---------------------
  // narrow, so its incandescent interior is what you see — the hottest thing
  // at ground level. Ribbon, sunk to ground level, with basalt lips beside it.
  const fisAz = eAz + 1.05;
  const fisPts: RibbonPt[] = [];
  const FN = 14;
  for (let k = 0; k < FN; k += 1) {
    const tt = k / (FN - 1);
    const a = fisAz + 0.34 * Math.sin(tt * 2.6 + seed);
    const d = tt * 1.15 * S;
    fisPts.push({
      x: poolC[0] + Math.cos(a) * d,
      z: poolC[1] + Math.sin(a) * d,
      y: 0.012 * S,
      dx: -Math.sin(a),
      dz: Math.cos(a),
      w: (0.15 - 0.09 * tt) * S,
      lift: 0.01 * S,
    });
  }
  const fisCrust = texFrom(t, pair.crust, 1, 1);
  const fisCrack = texFrom(t, pair.crack, 1, 1);
  texes.push(fisCrust, fisCrack);
  crawlTex.push(fisCrust, fisCrack);
  const fis = buildRibbon(t, fisPts, 4, 0.2, 0.72, fisCrust, fisCrack, TS * 1.6);
  group.add(fis.group);
  fis.segs.forEach((sg) => {
    geos.push(sg.mesh.geometry);
    mats.push(sg.mat);
    flowSegs.push({ mat: sg.mat, u: sg.u, heat: heatAt(t, 0.2 + 0.52 * sg.u).intensity });
  });

  // ---- scattered basalt blocks + volcanic bombs (batched) ------------------
  // static repeats → ONE merged mesh each: chunky blocks always visible, fine
  // rubble tagged lodDetail so the park runtime sheds it beyond NEAR.
  const blockParts: MergedBoxSpec[] = [];
  const rubbleParts: MergedBoxSpec[] = [];
  const onFlow = (az: number, r: number) =>
    FLOWS.some((f, i) => {
      let d = az - f.az;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return Math.abs(d) < 0.34 && r < FLOWS[i].rEnd + 0.4 * S;
    });
  const scatter = (n: number, kMin: number, kMax: number, into: MergedBoxSpec[], salt: number) => {
    for (let i = 0; i < n; i += 1) {
      const az = hash01(i * 2.13 + salt) * Math.PI * 2;
      const r = (0.95 + hash01(i * 3.71 + salt * 1.3) ** 0.7 * 2.25) * S;
      if (onFlow(az, r)) continue;
      const sz = (kMin + hash01(i * 5.17 + salt * 2.1) * (kMax - kMin)) * S;
      // bedded IN the flank (only the top ~60% shows) so they read as broken
      // basalt grown out of the slope, not as boxes dropped on it
      const y = shape.surfY(r, az) + sz * 0.06;
      into.push({
        dims: [sz * (0.8 + hash01(i * 7.3) * 0.5), sz * (0.5 + hash01(i * 9.1) * 0.4), sz * (0.8 + hash01(i * 11.7) * 0.5)],
        pos: [Math.cos(az) * r, Math.max(sz * 0.1, y), Math.sin(az) * r],
        rotX: (hash01(i * 13.3 + salt) - 0.5) * 0.9,
        rotY: hash01(i * 17.9 + salt) * Math.PI,
        rotZ: (hash01(i * 19.1 + salt) - 0.5) * 0.9,
      });
    }
  };
  scatter(18, 0.12, 0.25, blockParts, 0.7);
  scatter(46, 0.045, 0.11, rubbleParts, 4.3);
  // fissure lips: broken basalt shoved up either side of the ground crack
  for (let k = 1; k < FN; k += 2) {
    const p = fisPts[k];
    for (const sgn of [-1, 1]) {
      const off = sgn * (p.w * 0.5 + 0.05 * S);
      blockParts.push({
        dims: [0.2 * S, 0.07 * S, 0.13 * S],
        pos: [p.x + p.dx * off, 0.03 * S, p.z + p.dz * off],
        rotY: Math.atan2(p.dz, p.dx) + hash01(k * 3.3) * 0.4,
        rotZ: sgn * 0.2,
      });
    }
  }
  const blocks = mergedBoxes(t, blockParts, 0x272220, { tex: 'asphalt', repeat: [2, 2], rough: 1, bump: 0.05, flat: true });
  group.add(blocks);
  geos.push(blocks.geometry);
  mats.push(blocks.material as THREE.Material);
  const rubble = mergedBoxes(t, rubbleParts, 0x1e1a18, { tex: 'asphalt', repeat: [1, 1], rough: 1, bump: 0.04, flat: true });
  rubble.userData.lodDetail = true; // fine cinder litter: close-up only
  group.add(rubble);
  geos.push(rubble.geometry);
  mats.push(rubble.material as THREE.Material);

  // ---- ONE real light, at the vent ----------------------------------------
  const vent = new t.PointLight(0xff6a1e, 0, R * 2.3, 2);
  vent.position.set(0, shape.floorY + 0.3 * S, 0);
  group.add(vent);

  // ---- effects: plume, embers, heat haze (196 particles max) ---------------
  const emitters: ReturnType<typeof buildEmitter>[] = [];
  let plume: ReturnType<typeof buildEmitter> | null = null;
  let embers: ReturnType<typeof buildEmitter> | null = null;
  if (wantPlume) {
    plume = buildEmitter(t, {
      max: 150,
      rate: 28 * act,
      life: 5.0,
      lifeVar: 1.3,
      velocity: [0.12 * S, 0.6 * S, 0.05 * S], // a light drift off the summit
      spread: 0.13 * S,
      gravity: -0.04,
      // TIGHT and fairly OPAQUE: PointsMaterial is unlit, so a thin dark puff
      // simply vanishes in daylight. A dense pale grey-white ash column is what
      // actually reads against both grass and sky.
      size: 0.22 * S,
      sizeEnd: 0.95 * S,
      color: 0x6b6560,
      colorEnd: 0xada7a1,
      opacity: 0.7,
    });
    plume.setOrigin(0, shape.floorY + 0.16 * S, 0);
    embers = buildEmitter(t, {
      max: 44,
      rate: 7 * act,
      life: 2.4,
      lifeVar: 0.9,
      velocity: [0, 2.1 * S, 0],
      spread: 0.5 * S,
      gravity: 1.5,
      size: 0.09 * S,
      sizeEnd: 0.022 * S,
      color: 0xffe2a0, // launched white-hot…
      colorEnd: 0xc42604, // …and cooling to deep red as they arc back down
      opacity: 1,
      additive: true,
    });
    embers.setOrigin(0, shape.floorY + 0.22 * S, 0);
    emitters.push(plume, embers);
  }
  // heat haze off the base pool: not smoke, just shimmering hot air + dust
  const haze = buildEmitter(t, {
    max: 56,
    rate: 7 * Math.max(0.15, act),
    life: 2.8,
    lifeVar: 0.7,
    velocity: [0.02 * S, 0.62 * S, 0],
    spread: 0.19 * S,
    gravity: -0.02,
    size: 0.17 * S,
    sizeEnd: 0.7 * S,
    color: 0x6d5b50,
    colorEnd: 0x9a938d,
    opacity: 0.15,
  });
  haze.setOrigin(poolC[0], 0.1 * S, poolC[1]);
  emitters.push(haze);
  emitters.forEach((e) => group.add(e.points));

  // ---- the updater: slow. Lava creeps. ------------------------------------
  // DAY-AND-NIGHT GLOW: lava is not a lamp — it is incandescent by daylight
  // too. nightKOf only lerps between a daylight multiplier and a (stronger)
  // night one; it never gates the glow to zero.
  const GLOW_DAY = 1.0;
  const GLOW_NIGHT = 1.85;
  const update = (time: number) => {
    const nk = nightKOf(group);
    const glow = (GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nk) * act;
    // one slow breath of the whole crack network (~15 s period)
    const breathe = 1 + 0.11 * Math.sin(time * 0.42 + 0.7);
    for (const s of flowSegs) {
      // a slow surge travelling DOWN the flow — phase offset by position
      const wave = 1 + 0.26 * Math.sin(time * 0.31 - s.u * 3.4);
      s.mat.emissiveIntensity = s.heat * glow * breathe * wave;
    }
    lakeMat.emissiveIntensity = 1.25 * glow * (1 + 0.14 * Math.sin(time * 0.37));
    wallMat.emissiveIntensity = 0.42 * glow * breathe;
    // the crust pattern crawls downhill at ~0.02 u/s (v is arc length)
    const crawl = -time * 0.02;
    for (const tx of crawlTex) tx.offset.y = crawl;
    lakeCrust.offset.x = time * 0.008;
    lakeCrack.offset.x = time * 0.008;
    vent.intensity = act * (0.5 + 1.9 * nk) * breathe;
    for (const e of emitters) e.update(time);
  };

  return {
    group,
    update,
    radius: R,
    pool: poolC,
    poolR,
    dispose() {
      emitters.forEach((e) => e.dispose());
      texes.forEach((x) => x.dispose());
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
      vent.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
export interface VolcanoProps extends VolcanoOpts {
  /** keep guests out of the cone + the lava pool (default true) */
  blocking?: boolean;
}

/** `<Volcano>` — composable (components/Park/Context.md): a volcanic cone with
 *  real-lava flows. Mounts at `position`/`rotation`/`scale` inside a `<Park>`
 *  or `<ScenePreview>`; y settles onto the plaza/terrain. */
export const Volcano = composable<VolcanoProps, VolcanoBuilt>(
  'Volcano',
  (t, props) =>
    buildVolcano(t, {
      radius: props.radius,
      height: props.height,
      seed: props.seed,
      activity: props.activity,
      plume: props.plume,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      // the cone itself…
      const hs = [
        park.registerBlocker({
          circle: { cx: wx, cz: wz, r: built.radius * scale * 0.96 },
          label: '<Volcano> cone',
          height: (props.height ?? 2.4) * scale,
          kind: 'scenery',
        }),
      ];
      // …and the lava pool at its foot (rotated into world space)
      const [px, pz] = built.pool;
      const cs = Math.cos(rotation);
      const sn = Math.sin(rotation);
      hs.push(
        park.registerBlocker({
          circle: {
            cx: wx + (px * cs + pz * sn) * scale,
            cz: wz + (-px * sn + pz * cs) * scale,
            r: (built.poolR + 0.18) * scale,
          },
          label: '<Volcano> lava pool',
          height: 0.4,
          kind: 'scenery',
        }),
      );
      return () => hs.forEach((h) => h());
    },
  },
);
