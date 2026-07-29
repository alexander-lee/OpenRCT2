import * as THREE from 'three';
import { mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { buildWaterRibbon, LAVA } from '../WaterTile';
import { composable } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// EmberfallScenery — the five scenery pieces of the EMBERFALL CALDERA world.
// Per-world scenery (not an extension of the shared SceneryPack): one component
// folder exporting five imperative builders plus five composable components.
//
//   1. <Fumarole>        a cracked rock vent hissing a steam/gas plume out of a
//                        faintly glowing throat
//   2. <ObsidianShards>  a cluster of angular volcanic-glass blades — the ONE
//                        glossy surface in the world
//   3. <BasaltColumns>   a Giant's-Causeway colonnade of hexagonal columns at
//                        varying heights, cross-jointed and weathered
//   4. <LavaFissure>     a flat ground crack with magma glowing inside, for
//                        scattering across paths and lawns
//   5. <CharredSnag>     a dead burnt tree: blackened trunk, broken limbs,
//                        no foliage
//
// THE LAVA LANGUAGE IS VOLCANO'S (components/Volcano/index.tsx, and its
// Context.md "The temperature ramp"). Anything incandescent here is a
// NEAR-BLACK BASALT CRUST with an emissive CRACK NETWORK — never a uniformly
// glowing orange blob — over the same white-yellow → orange → deep-red → black
// temperature ramp, and it glows BY DAY AS WELL AS AT NIGHT: `nightKOf` only
// lerps the emissive multiplier between a daylight value and a stronger night
// one (GLOW_DAY → GLOW_NIGHT), it NEVER gates the glow to zero. Volcano keeps
// its crust field and ramp module-private, so this file carries its own copy of
// both — deliberately identical numbers, so a fissure scattered at the foot of
// a <Volcano> is the same temperature of lava.
//
// Everything else is a realistic MUTED volcanic palette: basalt greys and
// blacks, ash, scorched browns, a bloom of pale sulfur crust. The only
// saturated colour in the world is the lava itself.
//
// Budgets: TWO real PointLights across all five pieces (the fissure's ground
// bounce and the fumarole's optional throat light — both default-off-ish and
// day-floored; everything else is emissive), ≤ 208 particles for a full set
// (steam 118 + vent gas 24 in the fumarole, haze 40 + embers 26 in the
// fissure), static repeats batched into one merged mesh per material, fine
// litter tagged `userData.lodDetail`. Deterministic — hashed sines only, never
// Math.random / Date.now; every `update` takes ABSOLUTE time.
// ---------------------------------------------------------------------------

// ---- deterministic hashes --------------------------------------------------
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const hash2 = (a: number, b: number) => hash01(a * 37.19 + b * 91.73 + 3.11);

// ---------------------------------------------------------------------------
// THE EMBERFALL PALETTE — muted volcanic rock. Nothing here is saturated; the
// lava ramp below is the world's only colour.
// ---------------------------------------------------------------------------
export const EMBERFALL = {
  /** fresh basalt, the world's default rock (a neutral grey — basalt is not brown) */
  basalt: 0x35322e,
  /** older, dust-weathered basalt (column faces, boulders) */
  basaltPale: 0x565149,
  /** near-black cooled crust / cinder litter */
  cinder: 0x1f1c1a,
  /** wind-blown ash and lapilli grit */
  ash: 0x6d675e,
  /** scorched, sterilised ground around anything hot */
  scorch: 0x272220,
  /** charcoal — the burnt snag's litter */
  char: 0x1a1614,
  /** the pale grey-brown heartwood a spalled bark plate exposes */
  charWood: 0x685c4c,
  /** sulfur crust blooming around a fumarole (muted ochre, NOT a yellow) */
  sulfur: 0x8a7846,
  /** volcanic glass. NOT pitch black: obsidian photographs as a very dark grey
   *  with a silver-grey sheen, and a 3%-albedo material just reads as a hole in
   *  the frame — the glass look comes from FACET CONTRAST, not from darkness */
  obsidian: 0x16161c,
  /** the faint plum cast some obsidian shards carry */
  obsidianTint: 0x1d1926,
} as const;

// ---------------------------------------------------------------------------
// PROCEDURAL CRUST FIELD — the crack network, and the whole illusion. A
// jittered-grid Voronoi over a 192² torus (5×5 = 25 sites, toroidally wrapped
// so it tiles seamlessly): `d2 - d1` is 0 exactly on a plate boundary and grows
// inward, so `exp(-(d2-d1)/w)` is a soft-shouldered crack — a narrow hot core
// plus a short glow shoulder, which is how a real cooling crust looks. Baked to
// TWO canvases: a dark plate/groove ALBEDO (doubling as the bump map, so cracks
// are recessed) and a black-with-bright-cracks EMISSIVE map.
//
// Cached module-level as CANVASES rather than textures, because each piece owns
// its own CanvasTextures (it animates their `offset` for the slow crust crawl).
// ---------------------------------------------------------------------------
const CRUST_S = 192;
let _crustPair: { crust: HTMLCanvasElement; crack: HTMLCanvasElement } | null = null;

export function crustCanvases(): { crust: HTMLCanvasElement; crack: HTMLCanvasElement } {
  if (_crustPair) return _crustPair;
  const S = CRUST_S;
  const G = 5; // 5x5 jittered grid = 25 plates
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
  const BASE = [30, 25, 22]; // basalt plate albedo: dark grey-brown
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
      // DELIBERATELY NARROW: the plates are the bulk of the surface and they
      // are black. Widen these and every lava surface collapses into the fake
      // uniform-orange look this whole approach exists to avoid.
      let g = (0.95 * Math.exp(-e / 1.7) + 0.22 * Math.exp(-e / 4.2)) * edgeHeat;
      // a few plates keep a hot centre — an incipient breakout through the crust
      if (hash01(i1 * 4.3 + 0.7) > 0.86) g += 0.34 * Math.exp(-Math.sqrt(d1) / (cell * 0.36));
      g = Math.min(1, g);
      const o = (py * S + px) * 4;
      B[o] = B[o + 1] = B[o + 2] = Math.round(255 * g ** 0.85);
      B[o + 3] = 255;
      // albedo: plate tone + grain, with the crack groove darkened toward black
      // so the SAME canvas works as a bump map (cracks read as recessed)
      const tone = (hash01(i1 * 7.7 + 1.9) - 0.5) * 26;
      const grain = (hash2(px * 0.61, py * 0.83) - 0.5) * 16;
      const groove = 1 - 0.72 * Math.exp(-e / 2.1);
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
// CHARRED-BARK texture — the "alligator" char pattern a burnt trunk carries:
// near-black charcoal blocks separated by a network of paler ash-grey checking
// cracks, with a little sooty grain. Also the bump map, so the checks are
// grooves. Module-cached (one canvas for every snag in the park).
// ---------------------------------------------------------------------------
let _charCanvas: HTMLCanvasElement | null = null;
function charCanvas(): HTMLCanvasElement {
  if (_charCanvas) return _charCanvas;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#211d19';
  x.fillRect(0, 0, S, S);
  // sooty grain first, so the checking cracks sit on top of it. Charcoal's real
  // albedo is ~5%, but a 5% map under this Stage's lighting is a black
  // silhouette with no surface at all — pitched up to a very dark grey so the
  // checking actually reads, which is what says "burnt" rather than "painted".
  for (let i = 0; i < 1500; i += 1) {
    const d = Math.round(hash01(i * 1.31) * 30);
    x.fillStyle = `rgb(${28 + d},${24 + d},${21 + d})`;
    x.fillRect(hash01(i * 3.77) * S, hash01(i * 5.19) * S, 1, 1);
  }
  // the CHECKING: near-horizontal cross-grain cracks (periodic in x so the
  // texture tiles around the trunk) plus short vertical grain splits between
  // them — that grid of little charcoal blocks is what says "burnt", not
  // "painted black"
  const ROWS = 9;
  for (let r = 0; r < ROWS; r += 1) {
    const y = ((r + 0.5) / ROWS) * S;
    const k = 2 + Math.floor(hash01(r * 1.9) * 3);
    x.strokeStyle = `rgba(${118 + hash01(r * 2.7) * 44},${104},${88},0.62)`;
    x.lineWidth = 0.9 + hash01(r * 4.1) * 1.5;
    x.beginPath();
    x.moveTo(0, y);
    for (let px = 0; px <= S; px += 4) x.lineTo(px, y + Math.sin((px / S) * Math.PI * 2 * k + r) * 2.2);
    x.stroke();
    // vertical splits inside this band
    for (let i = 0; i < 5; i += 1) {
      const gx = hash01(r * 7.3 + i * 2.9) * S;
      x.strokeStyle = `rgba(${100},${90},${78},0.5)`;
      x.lineWidth = 0.7 + hash01(r * 5.7 + i) * 0.9;
      x.beginPath();
      x.moveTo(gx, y);
      x.lineTo(gx + (hash01(r * 9.1 + i * 3.3) - 0.5) * 3, y + S / ROWS);
      x.stroke();
    }
  }
  _charCanvas = c;
  return c;
}

// ---------------------------------------------------------------------------
// THE CALDERA ENVIRONMENT MAP — a 256×128 procedural equirectangular canvas:
// pale ash-hazed sky above, a warm glow band low over the caldera rim, dark ash
// ground below, and one small hot sun blob.
//
// It exists for exactly ONE material: the obsidian. Volcanic glass is a mirror,
// and a mirror with nothing to reflect renders as a black hole in the frame —
// with a single directional sun, a clearcoat surface only ever catches a
// pinprick highlight. Reflecting a bright sky on up-facing facets and dark
// ground on down-facing ones is what makes the facet contrast (and therefore the
// glassiness) read at all. `material.envMap` with `EquirectangularReflectionMapping`
// is PMREM-filtered by the renderer transparently, so this stays a plain canvas
// with no addons and no external assets. NOTE it is set on the MATERIAL, never
// on `scene.environment` — nothing else in the park is glossy, and this
// component must not relight anybody else's rock.
// ---------------------------------------------------------------------------
let _envTex: THREE.Texture | null = null;
function calderaEnv(t: typeof THREE): THREE.Texture {
  if (_envTex) return _envTex;
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  // sky → horizon → ground
  const grad = x.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#cfdae2');
  grad.addColorStop(0.34, '#a9b2b6');
  grad.addColorStop(0.49, '#8a8078');
  grad.addColorStop(0.52, '#3d3630'); // the horizon line: ash plain
  grad.addColorStop(1, '#1b1815');
  x.fillStyle = grad;
  x.fillRect(0, 0, W, H);
  // the caldera's own glow, low over one stretch of the horizon. KEPT FAINT:
  // wound up to where it reads as a glow in its own right, it washes the glass
  // rusty red and the shards stop being black at all.
  const glow = x.createRadialGradient(W * 0.62, H * 0.55, 0, W * 0.62, H * 0.55, W * 0.26);
  glow.addColorStop(0, 'rgba(206,92,26,0.3)');
  glow.addColorStop(0.5, 'rgba(150,54,12,0.12)');
  glow.addColorStop(1, 'rgba(120,40,10,0)');
  x.fillStyle = glow;
  x.fillRect(0, H * 0.42, W, H * 0.26);
  // the sun: a small hot blob well up in the sky — the hard glint source
  const sun = x.createRadialGradient(W * 0.2, H * 0.2, 0, W * 0.2, H * 0.2, W * 0.075);
  sun.addColorStop(0, '#ffffff');
  sun.addColorStop(0.35, 'rgba(255,246,224,0.8)');
  sun.addColorStop(1, 'rgba(255,240,210,0)');
  x.fillStyle = sun;
  x.fillRect(0, 0, W, H * 0.5);
  const tex = new t.CanvasTexture(c);
  tex.mapping = t.EquirectangularReflectionMapping;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _envTex = tex;
  return tex;
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
// THE TEMPERATURE RAMP — Volcano's, stop for stop. `u = 0` is fresh lava at the
// vent (~1100 °C), `u = 1` is cold black basalt. Emissive colour AND intensity
// fall off together, which is what makes the gradient read: there is no tone
// mapping in the Stage renderer, so intensity > 1 clips the hot channels toward
// white — physically the right direction (hotter = whiter).
// ---------------------------------------------------------------------------
const HEAT: [number, number, number][] = [
  [0.0, 0xfff0c0, 1.85], // white-yellow, ~1100 °C (crack cores clip to white)
  [0.12, 0xffd166, 1.45], // yellow
  [0.28, 0xff9422, 1.08], // orange, ~950 °C
  [0.45, 0xf05a12, 0.78], // orange-red
  [0.62, 0xcb2807, 0.46], // deep red, ~800 °C
  [0.8, 0x8a1403, 0.22], // dull red, ~700 °C
  [1.0, 0x280502, 0.035], // black crust, cooled out
];

/** sample the ramp: `{ emissive, intensity, crust }` at temperature key `u` */
export function emberfallHeatAt(
  t: typeof THREE,
  u: number,
): { emissive: THREE.Color; intensity: number; crust: THREE.Color } {
  const k = Math.max(0, Math.min(1, u));
  let i = 0;
  while (i < HEAT.length - 2 && k > HEAT[i + 1][0]) i += 1;
  const [t0, c0, e0] = HEAT[i];
  const [t1, c1, e1] = HEAT[i + 1];
  const f = t1 > t0 ? (k - t0) / (t1 - t0) : 0;
  const emissive = new t.Color(c0).lerp(new t.Color(c1), f);
  // fresh crust is a warm dark grey, cooled pahoehoe a dark basalt with a faint
  // silvery skin — NEVER a void, or the cold end reads as a hole in the ground
  const crust = new t.Color(0x2e2622).lerp(new t.Color(0x211c19), k);
  return { emissive, intensity: e0 + (e1 - e0) * f, crust };
}

/**
 * The lava material: near-black crust albedo, glow ONLY through the crack map.
 * `u` is the temperature key (0 = white-hot, 1 = cold basalt). Every
 * incandescent surface in Emberfall is built with this — pass the world's
 * shared crust/crack textures from `crustCanvases()`.
 */
export function emberfallLavaMat(
  t: typeof THREE,
  u: number,
  crustTex: THREE.Texture,
  crackTex: THREE.Texture,
): THREE.MeshStandardMaterial {
  const h = emberfallHeatAt(t, u);
  return new t.MeshStandardMaterial({
    color: h.crust,
    map: crustTex,
    bumpMap: crustTex,
    bumpScale: 0.05,
    emissive: h.emissive,
    emissiveMap: crackTex,
    emissiveIntensity: h.intensity,
    // a faint silvery sheen picks out the plate surfaces so they read as SOLID
    // crust rather than as black holes punched in the rock
    roughness: 0.78,
    metalness: 0.1,
  });
}

/** DAY-AND-NIGHT GLOW: lava is not a lamp. `nightKOf` lerps between these two
 *  multipliers and never reaches zero — the house rule for anything hot. */
const GLOW_DAY = 1.0;
const GLOW_NIGHT = 1.85;
const glowK = (obj: THREE.Object3D) => GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nightKOf(obj);

/**
 * The obsidian's env-map strength, day → night. Unlike the lava glow, this one
 * DOES have to fall most of the way off: an env map is a constant irradiance,
 * and the Stage's night mode dims the sun and the hemisphere light but cannot
 * touch it — left alone, the glass would go on reflecting a noon sky at
 * midnight. Never all the way to zero, so the blades keep an edge after dark.
 */
const ENV_DAY = 1.15;
const ENV_NIGHT = 0.18;

// ---------------------------------------------------------------------------
// GEOMETRY HELPERS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// STRIP RIBBONS — the shared builder for the ground fissure (its rampart, its
// scorched apron and the incandescent crack itself). A strip is a path of
// `StripPt`s swept through `cols` lateral columns, so a fissure gets a real
// CROSS-SECTION (feathered apron edge / spatter rampart crest / groove floor)
// instead of reading as a flat decal. UVs are ARC-LENGTH along the path, so the
// crust pattern is continuous down the whole crack and a v-offset drift crawls
// along it. Cut into `segs` separately-materialled pieces for the temperature
// gradient.
// ---------------------------------------------------------------------------
interface StripPt {
  x: number;
  z: number;
  /** extra height at this point (spatter lumps) — added to every column */
  y: number;
  /** unit LATERAL direction (perpendicular to the path) */
  dx: number;
  dz: number;
  /** half-width at this point */
  w: number;
}
/** one lateral column of a strip: `[fraction of the half-width, height]` */
type StripCol = [number, number];

interface StripPart {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  /** normalized arc position of the segment's midpoint (0 = head) */
  u: number;
}

function buildStrip(
  t: typeof THREE,
  pts: StripPt[],
  cols: StripCol[],
  segs: number,
  matFor: (u: number) => THREE.MeshStandardMaterial,
  tscale: number,
): { group: THREE.Group; parts: StripPart[] } {
  const N = pts.length;
  const arc: number[] = [0];
  for (let k = 1; k < N; k += 1) {
    const a = pts[k - 1];
    const b = pts[k];
    arc.push(arc[k - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const total = arc[N - 1] || 1;
  const C = cols.length;
  const vert = (k: number, c: number): [number, number, number, number, number] => {
    const p = pts[k];
    const [lat, h] = cols[c];
    const off = lat * p.w;
    return [p.x + p.dx * off, p.y + h, p.z + p.dz * off, off * tscale, arc[k] * tscale];
  };
  const group = new t.Group();
  const parts: StripPart[] = [];
  for (let j = 0; j < segs; j += 1) {
    const k0 = Math.round((j * (N - 1)) / segs);
    const k1 = Math.round(((j + 1) * (N - 1)) / segs);
    if (k1 <= k0) continue;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let k = k0; k <= k1; k += 1) {
      for (let c = 0; c < C; c += 1) {
        const [x, y, z, u, v] = vert(k, c);
        pos.push(x, y, z);
        uv.push(u, v);
      }
    }
    for (let k = 0; k < k1 - k0; k += 1) {
      for (let c = 0; c < C - 1; c += 1) {
        const a = k * C + c;
        idx.push(a, a + C, a + 1, a + 1, a + C, a + C + 1);
      }
    }
    const g = new t.BufferGeometry();
    g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    faceUp(g);
    const uMid = arc[Math.round((k0 + k1) / 2)] / total;
    const m = matFor(uMid);
    m.side = t.DoubleSide; // a ground strip is thin and gets seen edge-on
    const mesh = new t.Mesh(g, m);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    parts.push({ mesh, mat: m, u: uMid });
  }
  return { group, parts };
}

// ===========================================================================
// 1. FUMAROLE — a cracked rock vent hissing steam and gas
// ===========================================================================
// A low basalt mound built out of angular slabs shoved up around a throat, with
// GAPS between the slabs (those gaps are the cracks — the vent is a fracture,
// not a chimney). Down the throat is a short glowing shaft: a dull-red crust
// wall and floor at the cold end of the ramp, so the vent reads as a HOT HOLE
// by day too without ever becoming a bonfire. Hairline cracks radiate out of
// the throat over the mound. A pale sulfur crust blooms on the downwind side.
//
// The plume is the point: a fat, fairly opaque pale steam column (PointsMaterial
// is unlit, so a thin dark wisp simply vanishes against grass in daylight) with
// a small additive amber gas flicker right at the lip.
// ===========================================================================

export interface FumaroleOpts {
  /** mound radius in world units / tiles (default 0.4 → ~0.8 across) */
  radius?: number;
  /** deterministic variation seed (default 1) */
  seed?: number;
  /** 1 = venting hard (default), ~0.35 = a lazy wisp, 0 = cold and dead:
   *  no plume, no throat glow */
  activity?: number;
  /** the steam plume (default true) */
  plume?: boolean;
  /** add ONE small warm PointLight over the throat (default false — the throat
   *  glow is emissive; the light is for a hero shot) */
  light?: boolean;
}

export interface FumaroleBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** mound radius, for blocker registration / layout */
  radius: number;
  /** throat height above the group origin */
  throatY: number;
}

/** the fumarole rig. Group origin sits at ground level under the throat. */
export function buildFumarole(t: typeof THREE, opts: FumaroleOpts = {}): FumaroleBuilt {
  const R = opts.radius ?? 0.4;
  const seed = opts.seed ?? 1;
  const act = Math.max(0, opts.activity ?? 1);
  const wantPlume = (opts.plume ?? true) && act > 0.02;
  const S = R / 0.4; // authored at R = 0.4 and scaled
  const group = new t.Group();
  group.name = 'fumarole';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texes: THREE.Texture[] = [];

  // ---- the mound: a squat basalt plug with a REAL BORE through it -----------
  // Top surface at y = moundH, buried 0.05 below the origin. An OPEN-ENDED
  // frustum wall plus a RING top cap, not a solid cylinder: a solid mound has no
  // hole in it, and the glowing throat built inside one is simply buried in the
  // rock (which is exactly how the first pass of this piece rendered — a dark
  // mound with two stray sparks over it). The whole plug lives in a slightly
  // squashed, yawed sub-group, so the 11-gon never reads as a tidy drum and the
  // bore comes out pleasingly elliptical.
  const moundH = 0.13 * S;
  const BORE = 0.165 * S;
  const plug = new t.Group();
  plug.scale.set(1.07, 1, 0.93);
  plug.rotation.y = hash01(seed * 2.9) * 1.2;
  group.add(plug);
  const rockMat = mat(t, EMBERFALL.basalt, { tex: 'asphalt', repeat: [4, 1], rough: 1, bump: 0.055, flat: true });
  mats.push(rockMat);
  const wallGeo = new t.CylinderGeometry(0.335 * S, R, moundH + 0.05, 11, 1, true);
  const moundWall = new t.Mesh(wallGeo, rockMat);
  moundWall.position.y = moundH / 2 - 0.025;
  moundWall.castShadow = true;
  moundWall.receiveShadow = true;
  plug.add(moundWall);
  geos.push(wallGeo);
  const capGeo = new t.RingGeometry(BORE, 0.335 * S, 11, 1);
  const moundCap = new t.Mesh(capGeo, rockMat);
  moundCap.rotation.x = -Math.PI / 2;
  moundCap.position.y = moundH;
  moundCap.receiveShadow = true;
  plug.add(moundCap);
  geos.push(capGeo);

  // ---- the slab collar: plates heaved up around the throat -----------------
  // Nine slabs, some broken down to stumps, each with a hashed gap to its
  // neighbour — the gaps ARE the cracks. Kept LOW (≤ 0.14·S) and set back to
  // rr = 0.235·S: taller slabs leaned over a 0.16·S bore simply roof the throat
  // over, and the glowing throat is the whole point of the piece.
  const collar: MergedBoxSpec[] = [];
  const NSLAB = 9;
  for (let i = 0; i < NSLAB; i += 1) {
    const broken = hash01(i * 3.7 + seed) > 0.68;
    const az = ((i + 0.5) / NSLAB) * Math.PI * 2 + (hash01(i * 5.3 + seed) - 0.5) * 0.24;
    const h = (broken ? 0.045 : 0.085 + hash01(i * 7.1 + seed) * 0.06) * S;
    const rr = 0.235 * S;
    collar.push({
      dims: [(0.15 + hash01(i * 9.7 + seed) * 0.07) * S, h, 0.07 * S],
      pos: [Math.cos(az) * rr, moundH - 0.02 * S + h / 2, Math.sin(az) * rr],
      rotY: -az + Math.PI / 2,
      // tipped OUTWARD, the way a plate levered up by gas pressure sits
      rotZ: -(0.08 + hash01(i * 11.3 + seed) * 0.16),
      repeat: [2, 1],
    });
  }
  // rubble skirt: small broken plates scattered around the mound's foot
  const skirt: MergedBoxSpec[] = [];
  for (let i = 0; i < 14; i += 1) {
    const az = hash01(i * 2.11 + seed * 1.7) * Math.PI * 2;
    const rr = (1.0 + hash01(i * 3.31 + seed) * 0.75) * R;
    const sz = (0.04 + hash01(i * 5.71 + seed) * 0.05) * S;
    skirt.push({
      dims: [sz, sz * 0.28, sz * (0.7 + hash01(i * 7.13) * 0.6)],
      pos: [Math.cos(az) * rr, sz * 0.1, Math.sin(az) * rr],
      rotX: (hash01(i * 9.17 + seed) - 0.5) * 0.5,
      rotY: hash01(i * 11.7 + seed) * Math.PI,
      rotZ: (hash01(i * 13.9 + seed) - 0.5) * 0.5,
      repeat: [1, 1],
    });
  }
  const collarMesh = mergedBoxes(t, collar, EMBERFALL.basalt, {
    tex: 'asphalt',
    rough: 1,
    bump: 0.05,
    flat: true,
  });
  group.add(collarMesh);
  geos.push(collarMesh.geometry);
  mats.push(collarMesh.material as THREE.Material);
  const skirtMesh = mergedBoxes(t, skirt, EMBERFALL.cinder, { tex: 'asphalt', rough: 1, bump: 0.04, flat: true });
  skirtMesh.userData.lodDetail = true; // loose plate litter: close-up only
  group.add(skirtMesh);
  geos.push(skirtMesh.geometry);
  mats.push(skirtMesh.material as THREE.Material);

  // ---- sulfur crust: a pale ochre bloom on one side of the vent ------------
  // Thin 5-sided prisms, NOT boxes: a mineral bloom seen from the park camera is
  // an irregular patch, and flat rectangles read as cardboard tiles dropped on
  // the rock. Half crust the mound top, half stain the ground downwind.
  const sulfurParts: PartSpec[] = [];
  const sAz = hash01(seed * 4.4) * Math.PI * 2; // the "downwind" side
  for (let i = 0; i < 10; i += 1) {
    const az = sAz + (hash01(i * 3.9 + seed) - 0.5) * 1.7;
    const onMound = i % 2 === 0;
    const rr = onMound ? (0.52 + hash01(i * 6.1 + seed) * 0.26) * R : (0.95 + hash01(i * 6.1 + seed) * 0.5) * R;
    const sz = (0.035 + hash01(i * 8.3 + seed) * 0.042) * S;
    sulfurParts.push({
      geo: new t.CylinderGeometry(sz, sz * 0.86, 0.008 * S, 5, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * rr, (onMound ? moundH : 0.002 * S) + 0.003 * S, Math.sin(az) * rr],
        [0, hash01(i * 10.7 + seed) * Math.PI, 0],
        [1, 1, 0.55 + hash01(i * 12.9) * 0.5],
      ),
    });
  }
  const sulfurMat = mat(t, EMBERFALL.sulfur, { tex: 'concrete', repeat: [1, 1], rough: 0.95, bump: 0.02, flat: true });
  const sulfurMesh = mergedParts(t, sulfurParts, sulfurMat);
  sulfurMesh.userData.lodDetail = true; // mineral staining: close-up only
  group.add(sulfurMesh);
  geos.push(sulfurMesh.geometry);
  mats.push(sulfurMat);

  // ---- the throat: a short glowing shaft down into the rock ----------------
  const pair = crustCanvases();
  // TEXTURE SCALE IS THE WHOLE GAME ON A PIECE THIS SMALL: the crust field is 25
  // plates per tile, so a tile has to cover ~0.25 u for the plates to land near
  // 0.05 u and the crack cores near 3 px at preview distance. Tile it 3× around
  // the bore's ~1 u circumference and 0.45× over its 0.12 u depth and the plates
  // come out roughly square; leave it at the [1.6, 1.6] a bigger mesh wants and
  // every crack is sub-pixel and the throat renders black.
  const throatCrust = texFrom(t, pair.crust, 3, 0.45);
  const throatCrack = texFrom(t, pair.crack, 3, 0.45);
  texes.push(throatCrust, throatCrack);
  // A WIDE, SHALLOW bore (r 0.165·S, floor only 0.1·S down) — from the DS's
  // high-3/4 camera (~50° elevation) a deep narrow shaft is just a black dot;
  // at this depth half the floor stays in view from any orbit angle.
  const throatY = moundH;
  // shaft wall — cooler crust (u 0.42): the rock is HOT, not molten
  const shaftGeo = new t.CylinderGeometry(BORE, 0.125 * S, 0.105 * S, 11, 1, true);
  const shaftMat = emberfallLavaMat(t, 0.42, throatCrust, throatCrack);
  shaftMat.side = t.DoubleSide;
  const shaft = new t.Mesh(shaftGeo, shaftMat);
  shaft.position.y = throatY - 0.0525 * S;
  plug.add(shaft);
  geos.push(shaftGeo);
  mats.push(shaftMat);
  // the floor of the shaft — the hottest thing on the piece (u 0.16)
  const floorCrust = texFrom(t, pair.crust, 1.6, 1.6);
  const floorCrack = texFrom(t, pair.crack, 1.6, 1.6);
  texes.push(floorCrust, floorCrack);
  const floorGeo = new t.CircleGeometry(0.13 * S, 12);
  const floorMat = emberfallLavaMat(t, 0.16, floorCrust, floorCrack);
  const throatFloor = new t.Mesh(floorGeo, floorMat);
  throatFloor.rotation.x = -Math.PI / 2;
  throatFloor.position.y = throatY - 0.1 * S;
  plug.add(throatFloor);
  geos.push(floorGeo);
  mats.push(floorMat);

  // ---- hairline cracks radiating out of the throat over the mound ----------
  // r0 + len stays inside the mound's 0.33·S top radius, or they cantilever out
  // over the flank and read as red sticks glued to the rock.
  const crackParts: PartSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    const az = hash01(i * 4.7 + seed * 2.3) * Math.PI * 2;
    const r0 = 0.18 * S;
    const len = (0.055 + hash01(i * 6.9 + seed) * 0.075) * S;
    crackParts.push({
      geo: new t.BoxGeometry((0.014 + hash01(i * 8.1) * 0.012) * S, 0.012 * S, len),
      matrix: mtx(
        t,
        [Math.cos(az) * (r0 + len / 2), moundH - 0.004 * S, Math.sin(az) * (r0 + len / 2)],
        [0, -az + Math.PI / 2, 0],
      ),
      uv: [1, 1], // one tile per face: any more and the cracks go sub-pixel
    });
  }
  const crackTexA = texFrom(t, pair.crust, 1, 1);
  const crackTexB = texFrom(t, pair.crack, 1, 1);
  texes.push(crackTexA, crackTexB);
  const crackMat = emberfallLavaMat(t, 0.62, crackTexA, crackTexB);
  const cracks = mergedParts(t, crackParts, crackMat);
  cracks.userData.lodDetail = true; // hairlines: close-up only
  group.add(cracks);
  geos.push(cracks.geometry);
  mats.push(crackMat);

  // ---- the plume: 118 steam + 24 gas = 142 particles -----------------------
  const emitters: ReturnType<typeof buildEmitter>[] = [];
  let steam: ReturnType<typeof buildEmitter> | null = null;
  let gas: ReturnType<typeof buildEmitter> | null = null;
  const STEAM_RATE = 27 * act;
  if (wantPlume) {
    steam = buildEmitter(t, {
      max: 118,
      rate: STEAM_RATE,
      life: 3.0,
      lifeVar: 0.8,
      velocity: [0.07 * S, 1.0 * S, 0.03 * S], // a light drift off the vent
      spread: 0.11 * S,
      gravity: -0.06, // buoyant: hot wet gas keeps climbing
      // FAT and fairly opaque, because PointsMaterial is unlit: a thin, faint
      // puff is invisible over daylit grass. Pale white-grey steam is what
      // actually reads against both the sky and the ground.
      size: 0.17 * S,
      sizeEnd: 0.7 * S,
      color: 0xcfcdc8,
      colorEnd: 0xf1f0ec,
      opacity: 0.58,
    });
    steam.setOrigin(0, throatY + 0.02 * S, 0);
    // the gas flicker right at the lip: additive, tiny, amber — the shimmer of
    // superheated gas leaving the crack
    gas = buildEmitter(t, {
      max: 24,
      rate: 8 * act,
      life: 0.85,
      lifeVar: 0.3,
      velocity: [0, 0.75 * S, 0],
      spread: 0.09 * S,
      gravity: -0.1,
      size: 0.07 * S,
      sizeEnd: 0.018 * S,
      color: 0xffb066,
      colorEnd: 0x8a2a06,
      opacity: 0.85,
      additive: true,
    });
    gas.setOrigin(0, throatY - 0.02 * S, 0);
    emitters.push(steam, gas);
    emitters.forEach((e) => group.add(e.points));
  }

  // ---- the optional throat light (one PointLight, day-floored) -------------
  let lamp: THREE.PointLight | null = null;
  if ((opts.light ?? false) && act > 0.02) {
    lamp = new t.PointLight(0xff6a26, 0, R * 3.2, 2);
    lamp.position.set(0, throatY + 0.04 * S, 0);
    group.add(lamp);
  }

  const baseGlowFloor = emberfallHeatAt(t, 0.16).intensity;
  const baseGlowWall = emberfallHeatAt(t, 0.42).intensity;
  const baseGlowCrack = emberfallHeatAt(t, 0.62).intensity;
  const update = (time: number) => {
    const glow = glowK(group) * act;
    // one slow breath of the whole vent (~14 s) plus a faster gas surge — a
    // fumarole PUFFS, it does not strobe
    const breathe = 1 + 0.13 * Math.sin(time * 0.45 + seed);
    const surge = 1 + 0.22 * Math.sin(time * 1.17 + seed * 2.1) * Math.sin(time * 0.31);
    floorMat.emissiveIntensity = baseGlowFloor * glow * breathe * (1 + 0.3 * surge * 0.5);
    shaftMat.emissiveIntensity = baseGlowWall * glow * breathe;
    crackMat.emissiveIntensity = baseGlowCrack * glow * (1 + 0.09 * Math.sin(time * 0.37 + 1.3));
    // the crust pattern creeps, very slowly — the rock is barely moving
    throatCrust.offset.y = -time * 0.006;
    throatCrack.offset.y = -time * 0.006;
    if (steam) steam.setRate(STEAM_RATE * (0.75 + 0.5 * surge));
    if (lamp) lamp.intensity = act * (0.35 + 1.3 * nightKOf(group)) * breathe;
    for (const e of emitters) e.update(time);
  };

  return {
    group,
    update,
    radius: R,
    throatY,
    dispose() {
      emitters.forEach((e) => e.dispose());
      texes.forEach((x) => x.dispose());
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
      lamp?.dispose();
    },
  };
}

// ===========================================================================
// 2. OBSIDIAN SHARDS — the one place gloss is right
// ===========================================================================
// Volcanic glass, and glass is GENUINELY REFLECTIVE — this is the only surface
// in Emberfall that is not matte. Each shard is a 4- or 5-sided tapered blade
// (non-uniformly scaled, so it is a blade and not a spike) with flat shading, a
// near-black albedo and a MeshPhysicalMaterial clearcoat at obsidian's real
// index of refraction (1.48). What makes it read as glass is the CONTRAST
// between a facet catching the sun (clipping to near-white) and its neighbour
// facing away (pure black) — not a uniform shine, which reads as plastic.
//
// Around the blades: conchoidal flakes lying flat where the mass shattered, and
// a scoria grit apron. Two materials (plain black glass and a faintly plum-cast
// variant) so the cluster is not one flat tone; everything merges into two
// draw calls.
// ===========================================================================

export interface ObsidianShardsOpts {
  /** cluster radius in world units / tiles (default 0.34) */
  radius?: number;
  /** tallest blade height (default 0.8) */
  height?: number;
  /** number of standing blades (default 7, clamped 3…12) */
  count?: number;
  /** deterministic variation seed (default 1) */
  seed?: number;
}

export interface ObsidianShardsBuilt extends ComposableBuilt {
  group: THREE.Group;
  /** the only animated thing on the piece: the env-map dim after dark */
  update: (time: number) => void;
  dispose: () => void;
  /** cluster radius, for blocker registration */
  radius: number;
  /** tallest blade height */
  height: number;
}

/** the obsidian formation. Group origin at ground level, centre of the cluster. */
export function buildObsidianShards(t: typeof THREE, opts: ObsidianShardsOpts = {}): ObsidianShardsBuilt {
  const R = opts.radius ?? 0.34;
  const H = opts.height ?? 0.8;
  const N = Math.max(3, Math.min(12, Math.round(opts.count ?? 7)));
  const seed = opts.seed ?? 1;
  const group = new t.Group();
  group.name = 'obsidian-shards';

  // GLASS. A full clearcoat at ior 1.48 (obsidian's real value) over a very dark
  // albedo, flat-shaded so every facet holds a distinct tone.
  // ROUGHNESS IS DELIBERATELY NOT MIRROR-SHARP: at 0.05 the specular lobe is so
  // tight that with one directional sun almost no facet is ever aligned with the
  // half-vector, and the cluster renders as a black hole in the frame. ~0.2
  // spreads the highlight over whole facets, which is what actually reads as
  // polished glass from the park camera.
  const env = calderaEnv(t);
  const glass = new t.MeshPhysicalMaterial({
    color: EMBERFALL.obsidian,
    roughness: 0.17,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
    ior: 1.48,
    reflectivity: 0.68,
    specularIntensity: 1,
    envMap: env,
    envMapIntensity: ENV_DAY,
    flatShading: true,
  });
  const glassTint = new t.MeshPhysicalMaterial({
    color: EMBERFALL.obsidianTint,
    roughness: 0.27,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    ior: 1.48,
    reflectivity: 0.6,
    specularIntensity: 1,
    envMap: env,
    envMapIntensity: ENV_DAY * 0.85,
    flatShading: true,
  });

  const mainParts: PartSpec[] = [];
  const tintParts: PartSpec[] = [];
  const flakeParts: PartSpec[] = [];
  let tallest = 0;
  for (let i = 0; i < N; i += 1) {
    // blades crowd the centre and shrink outward — a shattered mass, not a ring
    const az = (i / N) * Math.PI * 2 + (hash01(i * 3.1 + seed) - 0.5) * 0.9;
    const rr = (i === 0 ? 0.05 : 0.3 + hash01(i * 5.7 + seed) * 0.78) * R;
    const drop = i === 0 ? 1 : 0.38 + hash01(i * 7.3 + seed) * 0.52;
    const h = H * drop;
    tallest = Math.max(tallest, h);
    const sides = hash01(i * 9.1 + seed) > 0.45 ? 4 : 5;
    const rBot = (0.13 + hash01(i * 11.3 + seed) * 0.08) * (0.6 + drop * 0.6);
    // tilt AWAY from the cluster centre — shards splay out of the fracture
    const lean = 0.1 + hash01(i * 13.7 + seed) * 0.34;
    const geo = new t.CylinderGeometry(rBot * 0.11, rBot, h, sides, 1);
    const bladeW = 0.5 + hash01(i * 17.9 + seed) * 0.5; // squash: blade, not spike
    const m = mtx(
      t,
      [Math.cos(az) * rr, h * 0.46 - 0.02, Math.sin(az) * rr],
      [Math.cos(az) * lean, hash01(i * 19.3 + seed) * Math.PI, -Math.sin(az) * lean],
      [bladeW, 1, 1],
    );
    (hash01(i * 23.1 + seed) > 0.72 ? tintParts : mainParts).push({ geo, matrix: m, uv: [1, 1] });
    // a chip snapped off the base of most blades, wedged against it
    if (hash01(i * 29.7 + seed) > 0.35) {
      const cs = rBot * (0.8 + hash01(i * 31.1) * 0.7);
      flakeParts.push({
        geo: new t.CylinderGeometry(cs * 0.15, cs, h * 0.26, 4, 1),
        matrix: mtx(
          t,
          [Math.cos(az) * (rr + rBot * 1.5), h * 0.1, Math.sin(az) * (rr + rBot * 1.5)],
          [0.7 + hash01(i * 37.3) * 0.5, hash01(i * 41.9) * Math.PI, 0.2],
          [0.7, 1, 1],
        ),
      });
    }
  }
  // conchoidal FLAKES lying flat where the mass shattered — thin curved-fracture
  // plates, which is exactly how obsidian breaks
  for (let i = 0; i < 8; i += 1) {
    const az = hash01(i * 2.7 + seed * 1.9) * Math.PI * 2;
    const rr = (0.6 + hash01(i * 4.3 + seed) * 1.0) * R;
    const sz = 0.035 + hash01(i * 6.1 + seed) * 0.055;
    flakeParts.push({
      geo: new t.CylinderGeometry(sz * 0.5, sz, 0.016, 5, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * rr, 0.01, Math.sin(az) * rr],
        [(hash01(i * 8.9 + seed) - 0.5) * 0.5, hash01(i * 10.3 + seed) * Math.PI, (hash01(i * 12.7) - 0.5) * 0.5],
        [1, 1, 0.6],
      ),
    });
  }

  const blades = mergedParts(t, mainParts, glass);
  group.add(blades);
  const tinted = tintParts.length ? mergedParts(t, tintParts, glassTint) : null;
  if (tinted) group.add(tinted);
  const flakes = mergedParts(t, flakeParts, glass, false);
  flakes.userData.lodDetail = true; // fracture debris: close-up only
  group.add(flakes);
  // the flake batch shares `glass`, so dispose its sources by hand
  flakeParts.forEach((p) => p.geo.dispose());

  // ---- a scoria grit apron, so the glass sits IN the ground ----------------
  const grit: MergedBoxSpec[] = [];
  for (let i = 0; i < 13; i += 1) {
    const az = hash01(i * 3.13 + seed * 2.7) * Math.PI * 2;
    const rr = (0.5 + hash01(i * 5.17 + seed) * 1.05) * R;
    const sz = 0.025 + hash01(i * 7.19 + seed) * 0.045;
    grit.push({
      dims: [sz, sz * 0.4, sz * 0.9],
      pos: [Math.cos(az) * rr, sz * 0.13, Math.sin(az) * rr],
      rotX: (hash01(i * 9.23 + seed) - 0.5) * 0.6,
      rotY: hash01(i * 11.29 + seed) * Math.PI,
      rotZ: (hash01(i * 13.31 + seed) - 0.5) * 0.6,
      repeat: [1, 1],
    });
  }
  const gritMesh = mergedBoxes(t, grit, EMBERFALL.cinder, { tex: 'asphalt', rough: 1, bump: 0.04, flat: true });
  gritMesh.userData.lodDetail = true;
  group.add(gritMesh);

  return {
    group,
    radius: R,
    height: tallest,
    update() {
      const k = ENV_DAY + (ENV_NIGHT - ENV_DAY) * nightKOf(group);
      glass.envMapIntensity = k;
      glassTint.envMapIntensity = k * 0.85;
    },
    dispose() {
      blades.geometry.dispose();
      tinted?.geometry.dispose();
      flakes.geometry.dispose();
      gritMesh.geometry.dispose();
      (gritMesh.material as THREE.Material).dispose();
      glass.dispose();
      glassTint.dispose();
    },
  };
}

// ===========================================================================
// 3. BASALT COLUMNS — a Giant's-Causeway colonnade
// ===========================================================================
// Cooling basalt contracts into a HEXAGONAL crack pattern, so the columns
// tessellate: they are laid out on a real triangular lattice at pitch
// r·√3 (the flat-to-flat width of a hexagonal prism of circumradius r), which
// is why a causeway looks packed rather than scattered. Height varies wildly
// (the erosion surface cuts the colonnade at a random level), the odd cell is
// missing, and every column is stacked out of 2…4 DRUMS with a hairline gap and
// a degree or two of yaw between them — real columns carry horizontal cross
// joints, and that detail is most of what makes the cluster read as rock rather
// than as a bundle of pipes.
//
// Two materials (fresh dark basalt and dust-weathered pale) plus pale ash caps
// on the exposed tops, all merged: three draw calls for a dozen columns.
// ===========================================================================

export interface BasaltColumnsOpts {
  /** cluster radius in world units / tiles (default 0.62) */
  spread?: number;
  /** column circumradius — the lattice pitch is `radius·√3` (default 0.17) */
  radius?: number;
  /** tallest column (default 1.35) */
  height?: number;
  /** shortest column as a fraction of `height` (default 0.26 — worn stumps) */
  minHeight?: number;
  /** deterministic variation seed (default 1) */
  seed?: number;
  /** toppled column drums lying at the foot of the colonnade (default true) */
  fallen?: boolean;
}

export interface BasaltColumnsBuilt extends ComposableBuilt {
  group: THREE.Group;
  dispose: () => void;
  /** cluster radius including the outermost column, for blocker registration */
  radius: number;
  /** the tallest column's height */
  height: number;
  /** number of standing columns */
  count: number;
}

/** the colonnade. Group origin at ground level, centre of the cluster. */
export function buildBasaltColumns(t: typeof THREE, opts: BasaltColumnsOpts = {}): BasaltColumnsBuilt {
  const spread = opts.spread ?? 0.62;
  const r = opts.radius ?? 0.17;
  const H = opts.height ?? 1.35;
  const minK = Math.max(0.05, Math.min(0.9, opts.minHeight ?? 0.26));
  const seed = opts.seed ?? 1;
  const group = new t.Group();
  group.name = 'basalt-columns';

  const darkParts: PartSpec[] = [];
  const paleParts: PartSpec[] = [];
  const capParts: PartSpec[] = [];
  const rubble: MergedBoxSpec[] = [];
  const pitch = r * Math.sqrt(3); // flat-to-flat: the columns TESSELLATE
  let tallest = 0;
  let count = 0;
  let outer = r;

  // triangular lattice in axial coordinates — the hexagonal packing
  const RING = Math.ceil(spread / pitch);
  for (let q = -RING; q <= RING; q += 1) {
    for (let s = -RING; s <= RING; s += 1) {
      const cx = pitch * (q + s / 2);
      const cz = pitch * s * 0.866;
      const d = Math.hypot(cx, cz);
      if (d > spread) continue;
      const key = q * 17.7 + s * 31.3 + seed * 5.1;
      if (hash01(key) > 0.86) continue; // a missing cell: eroded clean away
      count += 1;
      outer = Math.max(outer, d + r);
      // the erosion surface cuts the colonnade at a wildly varying level, with
      // the tallest columns favoured near the middle of the cluster. The 0.8
      // exponent biases the spread TALL — square it and almost every column
      // comes out a stump, and the cluster reads as a pile of hexagonal pavers
      // instead of a colonnade.
      const centreBias = 1 - (d / (spread + 1e-6)) * 0.4;
      const hK = (minK + hash01(key * 1.31 + 0.7) ** 0.8 * (1 - minK)) * centreBias;
      const colH = Math.max(0.1, H * hK);
      tallest = Math.max(tallest, colH);
      const rr = r * (0.955 + hash01(key * 2.17) * 0.05); // a hair of variation
      const baseYaw = hash01(key * 3.71) * Math.PI * 2;
      const pale = hash01(key * 4.93) > 0.55;
      const into = pale ? paleParts : darkParts;
      // ---- DRUMS: the horizontal cross joints ----
      const drums = 2 + Math.floor(hash01(key * 5.37) * 3); // 2…4
      let y = -0.04; // buried a touch, so the column never floats
      for (let dI = 0; dI < drums; dI += 1) {
        const frac = (1 + (hash01(key * 7.11 + dI * 2.3) - 0.5) * 0.55) / drums;
        const dh = (colH + 0.04) * frac;
        into.push({
          geo: new t.CylinderGeometry(rr * (dI === drums - 1 ? 0.985 : 1), rr, dh - 0.006, 6, 1),
          matrix: mtx(
            t,
            [cx + (hash01(key * 9.13 + dI) - 0.5) * 0.008, y + dh / 2, cz + (hash01(key * 11.7 + dI) - 0.5) * 0.008],
            [0, baseYaw + (hash01(key * 13.3 + dI) - 0.5) * 0.07, 0],
          ),
          uv: [2, Math.max(1, Math.round(dh * 3))],
        });
        y += dh;
      }
      // ---- the weathered top: a pale ash-dusted cap on most columns --------
      if (hash01(key * 17.1) > 0.3) {
        capParts.push({
          geo: new t.CylinderGeometry(rr * 1.02, rr * 1.0, 0.014, 6, 1),
          matrix: mtx(t, [cx, y + 0.004, cz], [0, baseYaw, 0]),
          uv: [1, 1],
        });
      }
      // ---- spalled chips at the column's foot ------------------------------
      if (hash01(key * 19.9) > 0.55) {
        const sz = r * (0.3 + hash01(key * 23.3) * 0.35);
        const az = hash01(key * 29.1) * Math.PI * 2;
        rubble.push({
          dims: [sz, sz * 0.4, sz * 0.8],
          pos: [cx + Math.cos(az) * r * 1.15, sz * 0.14, cz + Math.sin(az) * r * 1.15],
          rotX: (hash01(key * 31.7) - 0.5) * 0.5,
          rotY: hash01(key * 37.1) * Math.PI,
          rotZ: (hash01(key * 41.3) - 0.5) * 0.5,
          repeat: [1, 1],
        });
      }
    }
  }

  // ---- toppled drums lying at the foot of the colonnade --------------------
  // Half-BURIED (centre at 0.62·r, not r), and short — a long clean prism lying
  // on the grass reads as a dropped plank, a stubby half-sunk one reads as a
  // snapped-off drum.
  if (opts.fallen ?? true) {
    for (let i = 0; i < 2; i += 1) {
      const az = hash01(i * 5.9 + seed * 3.3) * Math.PI * 2;
      const rr = spread + r * (0.8 + hash01(i * 7.7 + seed) * 0.7);
      const len = r * (1.3 + hash01(i * 9.3 + seed) * 1.3);
      outer = Math.max(outer, rr + len * 0.5);
      darkParts.push({
        geo: new t.CylinderGeometry(r * 0.94, r * 0.94, len, 6, 1),
        matrix: mtx(
          t,
          [Math.cos(az) * rr, r * 0.62, Math.sin(az) * rr],
          [Math.PI / 2 + (hash01(i * 11.1 + seed) - 0.5) * 0.3, hash01(i * 13.9 + seed) * Math.PI, 0.12],
          [1, 1, 1],
        ),
        uv: [2, Math.max(1, Math.round(len * 3))],
      });
    }
  }

  const dark = mergedParts(t, darkParts, mat(t, EMBERFALL.basalt, { tex: 'asphalt', repeat: [1, 1], rough: 1, bump: 0.055, flat: true }));
  group.add(dark);
  const pale = paleParts.length
    ? mergedParts(t, paleParts, mat(t, EMBERFALL.basaltPale, { tex: 'asphalt', repeat: [1, 1], rough: 1, bump: 0.055, flat: true }))
    : null;
  if (pale) group.add(pale);
  const caps = capParts.length
    ? mergedParts(t, capParts, mat(t, EMBERFALL.ash, { tex: 'concrete', repeat: [1, 1], rough: 1, bump: 0.03, flat: true }))
    : null;
  if (caps) {
    caps.userData.lodDetail = true; // dust caps: close-up only
    group.add(caps);
  }
  const chips = rubble.length
    ? mergedBoxes(t, rubble, EMBERFALL.cinder, { tex: 'asphalt', rough: 1, bump: 0.04, flat: true })
    : null;
  if (chips) {
    chips.userData.lodDetail = true;
    group.add(chips);
  }

  return {
    group,
    radius: outer,
    height: tallest,
    count,
    dispose() {
      for (const m of [dark, pale, caps, chips]) {
        if (!m) continue;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
  };
}

// ===========================================================================
// 4. LAVA FISSURE — a flat ground crack with magma inside
// ===========================================================================
// The piece that has to work HARDEST in daylight, and the easy one to get
// wrong. Four layers, bottom to top:
//
//   1. a SCORCHED APRON — a wide, irregular sheet of sterilised dark ash on the
//      ground. This is what makes the glow read at noon: an incandescent crack
//      laid straight onto bright green grass has nothing to be bright AGAINST,
//      and the eye reads it as a decal. Give it a black surround and it reads
//      as heat.
//   2. a low SPATTER RAMPART either side, built by the fissure's own eruptions:
//      near-black crust with dull-red hairlines still deep in it (u = 0.88), so
//      even the cold rock is part of the temperature story.
//   3. the CRACK itself: a narrow strip cut into 7 segments, temperature ramped
//      as a V — white-yellow (u ≈ 0.06, ~1100 °C) at mid-length where the crack
//      is widest and deepest, cooling to deep red at each pinched tip. Its
//      half-width pinches and swells along the length, so it reads as a
//      fracture rather than a painted line, and two BRANCH cracks spur off it.
//   4. broken basalt LIPS shoved up along both edges (batched boxes).
//
// It glows BY DAY: the emissive multiplier lerps GLOW_DAY → GLOW_NIGHT on
// `nightKOf` and never reaches zero. The whole rig is ~0.09 tall, sits flat, and
// does NOT register a blocker by default — scatter it freely across paths and
// lawns. Effects: 40 heat-haze + 26 ember particles and ONE PointLight, floored
// low by day so it is a warm bounce on the lips rather than a lamp.
// ===========================================================================

export interface LavaFissureOpts {
  /** crack length along the piece's local +Z (default 1.8) */
  length?: number;
  /** rampart half-width (default 0.19 — the mound is ~0.38 across) */
  width?: number;
  /** lateral meander amplitude (default 0.16; 0 = dead straight) */
  meander?: number;
  /** deterministic variation seed (default 1) */
  seed?: number;
  /** 1 = fresh and white-hot (default), ~0.4 = crusting over, 0 = extinct:
   *  cold black basalt, no glow, no effects, no light */
  activity?: number;
  /** heat haze + rising embers (default true) */
  effects?: boolean;
  /** the single warm ground PointLight (default true) */
  light?: boolean;
}

export interface LavaFissureBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** crack length */
  length: number;
  /** full rampart half-width (the apron is wider) */
  width: number;
}

/**
 * The ground-fissure rig. Runs along the group's local +Z, centred on the group
 * origin at ground level, so `rotation` aims it. `update(time)` takes ABSOLUTE
 * time.
 */
export function buildLavaFissure(t: typeof THREE, opts: LavaFissureOpts = {}): LavaFissureBuilt {
  const L = opts.length ?? 1.8;
  const W = opts.width ?? 0.19;
  const mea = opts.meander ?? 0.16;
  const seed = opts.seed ?? 1;
  const act = Math.max(0, Math.min(1, opts.activity ?? 1));
  const wantFx = (opts.effects ?? true) && act > 0.02;
  const group = new t.Group();
  group.name = 'lava-fissure';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texes: THREE.Texture[] = [];

  const pair = crustCanvases();
  const TS = 2.4; // crust plates ≈ 0.08 u across at ground level
  const newTex = (rx = 1, ry = 1) => {
    const a = texFrom(t, pair.crust, rx, ry);
    const b = texFrom(t, pair.crack, rx, ry);
    texes.push(a, b);
    return [a, b] as const;
  };

  // ---- the path: a meandering crack, tapering to nothing at both ends ------
  const N = 22;
  const at = (s: number) => {
    const wob = Math.sin(s * 4.1 + seed) * 0.6 + Math.sin(s * 8.7 - seed * 1.7) * 0.28 + Math.sin(s * 13.3 + 2.1) * 0.12;
    return { x: mea * wob, z: (s - 0.5) * L };
  };
  const pts: StripPt[] = [];
  for (let k = 0; k < N; k += 1) {
    const s = k / (N - 1);
    const p = at(s);
    const q = at(Math.min(1, s + 0.02));
    const tx = q.x - p.x;
    const tz = q.z - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    // taper: a fissure closes to a hairline at both tips
    const taper = Math.sin(Math.PI * Math.max(0.02, Math.min(0.98, s))) ** 0.55;
    pts.push({
      x: p.x,
      z: p.z,
      y: 0.008 * Math.sin(s * 19 + seed * 3.1), // spatter lumps along the rampart
      dx: tz / tl, // lateral = tangent rotated 90°
      dz: -tx / tl,
      w: W * taper,
    });
  }

  // ---- 1. the scorched apron ----------------------------------------------
  // Wide, irregular, near-black sterile ground. The contrast surface that makes
  // the glow read in daylight — without it the crack looks like a sticker.
  // LOW-FREQUENCY width wobble only: at ~1.7 rad per point the outline zigzags
  // into a paper snowflake, which reads as a decal and undoes the whole point of
  // the apron.
  const apronPts: StripPt[] = pts.map((p, k) => ({
    ...p,
    y: 0,
    w: p.w * (1.5 + 0.3 * Math.sin(k * 0.5 + seed) + 0.14 * Math.sin(k * 1.1 + 1.7)),
  }));
  const apronMat = mat(t, EMBERFALL.scorch, { tex: 'asphalt', repeat: [1, 1], rough: 1, bump: 0.03 });
  const apron = buildStrip(
    t,
    apronPts,
    [
      [-1, 0.0025],
      [-0.45, 0.006],
      [0, 0.008],
      [0.45, 0.006],
      [1, 0.0025],
    ],
    1,
    () => apronMat,
    1.6,
  );
  group.add(apron.group);
  apron.parts.forEach((p) => geos.push(p.mesh.geometry));
  mats.push(apronMat);

  // ---- 2. the spatter rampart (cold crust, dull-red hairlines) ------------
  const [rCrust, rCrack] = newTex(1, 1);
  const rampMat = emberfallLavaMat(t, 0.88, rCrust, rCrack);
  const ramp = buildStrip(
    t,
    pts,
    // the crest sits CLOSE to the crack (0.48 of the half-width) and only 0.055
    // up: a wide, tall rampart turns the whole piece into a burnt loaf with a
    // stripe on top instead of a crack in the ground
    [
      [-1.0, 0.003],
      [-0.48, 0.055],
      [-0.24, 0.042],
      [0, 0.024],
      [0.24, 0.042],
      [0.48, 0.055],
      [1.0, 0.003],
    ],
    1,
    () => rampMat,
    TS,
  );
  group.add(ramp.group);
  ramp.parts.forEach((p) => geos.push(p.mesh.geometry));
  mats.push(rampMat);

  // ---- 3. the crack: a V temperature ramp, hottest mid-length -------------
  // u = 0.06 (white-yellow, ~1100 °C) in the middle, deep red at the tips.
  const heatOf = (u: number) => 0.06 + 0.66 * Math.abs(2 * u - 1) ** 1.35;
  const crackPts: StripPt[] = pts.map((p, k) => ({
    ...p,
    y: p.y + 0.03,
    // pinch and swell: a fracture, not a painted line
    w: p.w * 0.44 * (0.62 + 0.45 * Math.abs(Math.sin(k * 1.6 + seed * 1.9)) + 0.18 * Math.sin(k * 3.3)),
  }));
  const crackSegs: { mat: THREE.MeshStandardMaterial; u: number; heat: number }[] = [];
  const crawl: THREE.Texture[] = [];
  const [cCrust, cCrack] = newTex(1, 1);
  crawl.push(cCrust, cCrack);
  const crack = buildStrip(
    t,
    crackPts,
    [
      [-1, 0],
      [0, 0.004],
      [1, 0],
    ],
    7,
    (u) => emberfallLavaMat(t, heatOf(u), cCrust, cCrack),
    TS * 1.7,
  );
  group.add(crack.group);
  crack.parts.forEach((p) => {
    geos.push(p.mesh.geometry);
    mats.push(p.mat);
    crackSegs.push({ mat: p.mat, u: p.u, heat: emberfallHeatAt(t, heatOf(p.u)).intensity });
  });

  // ---- 3b. two BRANCH cracks spurring off the main fracture ---------------
  const [bCrust, bCrack] = newTex(1, 1);
  crawl.push(bCrust, bCrack);
  for (const [s0, side] of [
    [0.33, 1],
    [0.68, -1],
  ] as [number, number][]) {
    const root = at(s0);
    const az = side * (0.85 + hash01(s0 * 7.7 + seed) * 0.5);
    const bl = L * (0.16 + hash01(s0 * 11.3 + seed) * 0.12);
    const bPts: StripPt[] = [];
    const BN = 8;
    for (let k = 0; k < BN; k += 1) {
      const s = k / (BN - 1);
      const a = az + 0.4 * Math.sin(s * 2.6 + seed);
      const d = s * bl;
      const tx = Math.cos(a);
      const tz = Math.sin(a);
      bPts.push({
        x: root.x + tx * d,
        z: root.z + tz * d,
        // a branch climbs OVER the rampart crest and runs out onto the flat
        // scorched apron, so its height has to ramp down from just above the
        // crest (0.058) to apron level — held flat at the crack's own height it
        // is simply buried inside the rampart and never shows at all
        y: 0.058 - 0.046 * s,
        dx: tz,
        dz: -tx,
        w: W * 0.34 * (1 - s * 0.8) * (0.7 + 0.4 * Math.abs(Math.sin(k * 2.9 + seed))),
      });
    }
    const br = buildStrip(
      t,
      bPts,
      [
        [-1, 0],
        [0, 0.003],
        [1, 0],
      ],
      2,
      // a branch is cooler than the trunk it left and cools out fast
      (u) => emberfallLavaMat(t, 0.24 + 0.55 * u, bCrust, bCrack),
      TS * 1.7,
    );
    group.add(br.group);
    br.parts.forEach((p) => {
      geos.push(p.mesh.geometry);
      mats.push(p.mat);
      crackSegs.push({ mat: p.mat, u: 0.5 + 0.5 * p.u, heat: emberfallHeatAt(t, 0.24 + 0.55 * p.u).intensity });
    });
  }

  // ---- 3c. THE MOLTEN LIQUID IN THE CRACK ---------------------------------
  // Everything above is crust: emissive plate/crack materials on static strips.
  // What was missing is that the lava inside a fissure MOVES. This is one
  // continuous WaterTile ribbon on the LAVA palette laid down the crack's own
  // centreline, at 62 % of the crack's local width so it never reaches the
  // basalt lips, 8 mm over the crack crest (0.038 total — under the 0.055
  // rampart crest, so it cannot show over the rim from a low camera).
  //
  // The per-point width comes from scaling the `side` vector rather than the
  // `width` argument: `buildWaterRibbon` offsets each column by `side * x`, so a
  // side of length `w_local` with `width: 1` gives a ribbon that pinches and
  // swells exactly like the fracture it sits in. A constant width would have
  // spilled over the lips at every pinch.
  const liquids: { update: (time: number) => void }[] = [];
  if (act > 0.02) {
    const molten = buildWaterRibbon(
      t,
      crackPts.map((p) => ({
        p: new t.Vector3(p.x, p.y + 0.008, p.z),
        side: new t.Vector3(p.dx, 0, p.dz).normalize().multiplyScalar(Math.max(0.04, p.w * 0.62)),
        up: new t.Vector3(0, 1, 0),
      })),
      1,
      { amp: 0.05, waviness: 0.22, palette: LAVA },
    );
    group.add(molten.mesh);
    geos.push(molten.mesh.geometry);
    liquids.push(molten);
  }

  // ---- 4. broken basalt lips along both edges ------------------------------
  // STAGGERED, never paired: a block on both sides of every other point reads as
  // a row of railway sleepers, not as rock heaved out of a crack.
  const lips: MergedBoxSpec[] = [];
  for (let k = 1; k < N - 1; k += 1) {
    const p = pts[k];
    const pick = hash01(k * 2.7 + seed * 1.3);
    if (pick < 0.42) continue;
    const sides = pick > 0.88 ? [-1, 1] : [pick > 0.65 ? -1 : 1];
    for (const sgn of sides) {
      const off = sgn * (p.w * (0.55 + hash01(k * 3.1 + seed) * 0.25));
      const sz = 0.05 + hash01(k * 5.9 + seed) * 0.05;
      lips.push({
        dims: [sz * 1.5, sz * 0.6, sz],
        pos: [p.x + p.dx * off, p.y + 0.04, p.z + p.dz * off],
        rotY: Math.atan2(p.dz, p.dx) + (hash01(k * 7.3 + seed) - 0.5) * 0.5,
        rotZ: sgn * (0.15 + hash01(k * 9.7) * 0.2),
        repeat: [1, 1],
      });
    }
  }
  const lipMesh = mergedBoxes(t, lips, EMBERFALL.cinder, { tex: 'asphalt', rough: 1, bump: 0.05, flat: true });
  group.add(lipMesh);
  geos.push(lipMesh.geometry);
  mats.push(lipMesh.material as THREE.Material);

  // ---- effects: 40 haze + 26 embers = 66 particles ------------------------
  const emitters: ReturnType<typeof buildEmitter>[] = [];
  let haze: ReturnType<typeof buildEmitter> | null = null;
  let embers: ReturnType<typeof buildEmitter> | null = null;
  if (wantFx) {
    // shimmering hot air and dust off the crack — not smoke
    haze = buildEmitter(t, {
      max: 40,
      rate: 11 * act,
      life: 2.4,
      lifeVar: 0.6,
      velocity: [0.02, 0.52, 0],
      spread: 0.13,
      gravity: -0.03,
      size: 0.13,
      sizeEnd: 0.5,
      color: 0x6d5b50,
      colorEnd: 0x9a938d,
      opacity: 0.14,
    });
    // sparks lifting off the hot rock: additive, tiny, cooling as they fall
    embers = buildEmitter(t, {
      max: 26,
      rate: 4.5 * act,
      life: 1.7,
      lifeVar: 0.6,
      velocity: [0, 0.95, 0],
      spread: 0.2,
      gravity: 1.1,
      size: 0.05,
      sizeEnd: 0.012,
      color: 0xffdc9e,
      colorEnd: 0xc4380a,
      opacity: 1,
      additive: true,
    });
    emitters.push(haze, embers);
    emitters.forEach((e) => group.add(e.points));
  }

  // ---- ONE PointLight, day-floored low ------------------------------------
  // Emissive does the work; this only puts a warm bounce on the lips and the
  // apron (and on anything standing nearby after dark).
  let lamp: THREE.PointLight | null = null;
  if ((opts.light ?? true) && act > 0.02) {
    lamp = new t.PointLight(0xff6a1e, 0, Math.max(1.6, L * 1.5), 2);
    lamp.position.set(0, 0.16, 0);
    group.add(lamp);
  }

  const update = (time: number) => {
    const nk = nightKOf(group);
    const glow = (GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nk) * act;
    // one slow breath of the whole crack network (~15 s) — lava creeps
    const breathe = 1 + 0.12 * Math.sin(time * 0.41 + seed);
    for (const sg of crackSegs) {
      // a slow surge travelling along the crack, phase-offset by position
      const wave = 1 + 0.24 * Math.sin(time * 0.33 - sg.u * 4.2);
      sg.mat.emissiveIntensity = sg.heat * glow * breathe * wave;
    }
    rampMat.emissiveIntensity = emberfallHeatAt(t, 0.88).intensity * glow * breathe;
    // the crust pattern creeps along the crack at ~0.012 u/s
    for (const tx of crawl) tx.offset.y = -time * 0.012;
    // the liquid in the crack runs at a third of channel rate — viscous
    for (const q of liquids) q.update(time * 0.34);
    if (lamp) {
      const flick = 1 + 0.07 * Math.sin(time * 8.9 + seed) + 0.04 * Math.sin(time * 15.7 + 1.9);
      lamp.intensity = act * (0.4 + 1.55 * nk) * breathe * flick;
    }
    if (emitters.length) {
      // walk the emitter origins ALONG the crack (~3 hops/s) so the effects
      // come off the whole fracture instead of one hot spot
      const s = hash01(Math.floor(time * 3.1) * 1.73 + seed);
      const p = at(0.12 + s * 0.76);
      haze?.setOrigin(p.x, 0.06, p.z);
      const s2 = hash01(Math.floor(time * 3.1) * 5.11 + seed * 2.3);
      const p2 = at(0.12 + s2 * 0.76);
      embers?.setOrigin(p2.x, 0.05, p2.z);
      for (const e of emitters) e.update(time);
    }
  };

  return {
    group,
    update,
    length: L,
    width: W,
    dispose() {
      emitters.forEach((e) => e.dispose());
      texes.forEach((x) => x.dispose());
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
      lamp?.dispose();
    },
  };
}

// ===========================================================================
// 5. CHARRED SNAG — a dead, burnt tree
// ===========================================================================
// A standing dead trunk that a pyroclastic surge went through: blackened, no
// foliage, no bark left except a few spalled plates, the top SNAPPED OFF into
// splinters rather than tapering to a tip (that broken crown is what says
// "killed", not "pruned"). Four broken limb stubs, one forked. The charcoal
// carries the "alligator" checking pattern of real burnt wood (`charCanvas`) as
// both map and bump. Utterly matte (roughness 1) and utterly unlit — no glow, no
// emissive, no light. The only colour is the pale grey-brown heartwood a
// spalled bark plate exposes.
// ===========================================================================

export interface CharredSnagOpts {
  /** trunk height to the break (default 1.35) */
  height?: number;
  /** trunk radius at the base, above the root flare (default 0.15 — a snag at
   *  1:9 reads as a tree, at 1:13 it reads as a fence post) */
  radius?: number;
  /** deterministic variation seed (default 1) */
  seed?: number;
  /** broken limb stubs (default 3, clamped 0…6) */
  limbs?: number;
  /** ash and charcoal litter around the base (default true) */
  litter?: boolean;
}

export interface CharredSnagBuilt extends ComposableBuilt {
  group: THREE.Group;
  dispose: () => void;
  /** trunk height to the break */
  height: number;
  /** blocker radius: the root flare, not the limb reach */
  radius: number;
}

/** the burnt snag. Group origin at ground level under the trunk axis. */
export function buildCharredSnag(t: typeof THREE, opts: CharredSnagOpts = {}): CharredSnagBuilt {
  const H = opts.height ?? 1.35;
  const R = opts.radius ?? 0.15;
  const seed = opts.seed ?? 1;
  const NL = Math.max(0, Math.min(6, Math.round(opts.limbs ?? 3)));
  /** trunk radius at height fraction `f` — the shared taper, so limbs, bark
   *  plates and splinters all sit on the real trunk surface */
  const trunkR = (f: number) => R * (1 - 0.3 * f);
  const group = new t.Group();
  group.name = 'charred-snag';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texes: THREE.Texture[] = [];

  // charcoal: the checked char canvas as map AND bump, dead matte
  const charTex = texFrom(t, charCanvas(), 2, Math.max(2, Math.round(H * 2.5)));
  texes.push(charTex);
  const charMat = new t.MeshStandardMaterial({
    color: 0xffffff, // the canvas carries the colour
    map: charTex,
    bumpMap: charTex,
    bumpScale: 0.055,
    roughness: 1,
    metalness: 0,
  });
  mats.push(charMat);

  // ---- the trunk: three drums, leaning a little further with height -------
  const parts: PartSpec[] = [];
  const lean = (hash01(seed * 3.7) - 0.5) * 0.14;
  const leanAz = hash01(seed * 5.1) * Math.PI * 2;
  const DRUMS = 3;
  let y = -0.05;
  let axX = 0;
  let axZ = 0;
  const drumTop: { x: number; y: number; z: number; r: number }[] = [];
  for (let i = 0; i < DRUMS; i += 1) {
    const f0 = i / DRUMS;
    const f1 = (i + 1) / DRUMS;
    const dh = (H + 0.05) * (f1 - f0);
    const r0 = trunkR(f0);
    const r1 = trunkR(f1);
    const tilt = lean * (0.4 + f0);
    // walk the axis so the drums stay joined as the lean increases
    const cx = axX + Math.cos(leanAz) * Math.sin(tilt) * dh * 0.5;
    const cz = axZ + Math.sin(leanAz) * Math.sin(tilt) * dh * 0.5;
    parts.push({
      geo: new t.CylinderGeometry(r1, r0, dh, 9, 1),
      matrix: mtx(t, [cx, y + dh / 2, cz], [Math.sin(leanAz) * tilt, hash01(seed + i) * 2, -Math.cos(leanAz) * tilt]),
      uv: [2, Math.max(2, Math.round(dh * 3))],
    });
    axX = cx + Math.cos(leanAz) * Math.sin(tilt) * dh * 0.5;
    axZ = cz + Math.sin(leanAz) * Math.sin(tilt) * dh * 0.5;
    y += dh;
    drumTop.push({ x: axX, y, z: axZ, r: r1 });
  }
  const top = drumTop[DRUMS - 1];

  // ---- the root flare: the trunk swelling into its buttresses -------------
  parts.push({
    geo: new t.CylinderGeometry(R * 1.06, R * 1.62, 0.14, 9, 1),
    matrix: mtx(t, [0, 0.02, 0]),
    uv: [2, 1],
  });
  for (let i = 0; i < 5; i += 1) {
    const az = (i / 5) * Math.PI * 2 + hash01(seed * 7.3) * 1.4;
    const l = R * (1.5 + hash01(i * 3.3 + seed) * 1.1);
    parts.push({
      geo: new t.CylinderGeometry(R * 0.13, R * 0.42, l, 6, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * (R * 0.9 + l * 0.34), 0.035, Math.sin(az) * (R * 0.9 + l * 0.34)],
        [Math.sin(az) * -1.28, 0, Math.cos(az) * 1.28],
      ),
      uv: [1, 2],
    });
  }

  // ---- the SNAPPED crown: splinters, not a taper --------------------------
  const NSP = 5;
  for (let i = 0; i < NSP; i += 1) {
    const az = (i / NSP) * Math.PI * 2 + hash01(seed * 9.1) * 2;
    const sl = H * (0.045 + hash01(i * 4.7 + seed) ** 1.6 * 0.14);
    const off = top.r * (0.25 + hash01(i * 6.1 + seed) * 0.55);
    parts.push({
      geo: new t.CylinderGeometry(top.r * 0.05, top.r * (0.3 + hash01(i * 8.3) * 0.25), sl, 4, 1),
      matrix: mtx(
        t,
        [top.x + Math.cos(az) * off, top.y + sl * 0.42, top.z + Math.sin(az) * off],
        [Math.sin(az) * 0.24, hash01(i * 10.9) * Math.PI, -Math.cos(az) * 0.24],
      ),
      uv: [1, 2],
    });
  }

  // ---- broken limb stubs -------------------------------------------------
  let reach = R * 2.2;
  for (let i = 0; i < NL; i += 1) {
    const f = 0.36 + (i / Math.max(1, NL)) * 0.5 + hash01(i * 3.9 + seed) * 0.08;
    const az = hash01(i * 5.3 + seed * 1.7) * Math.PI * 2;
    const up = 0.32 + hash01(i * 7.1 + seed) * 0.5; // radians above horizontal
    const l = (0.18 + hash01(i * 9.7 + seed) * 0.22) * H * 0.62;
    // a real limb is a THIRD to a HALF of the trunk it leaves — thinner than
    // that and the stubs read as twigs stuck to a post
    const r0 = trunkR(f) * (0.55 + hash01(i * 11.3) * 0.2);
    const ax = axX * f;
    const az0 = axZ * f;
    const cy = -0.05 + (H + 0.05) * f;
    const dirY = Math.sin(up);
    const dirH = Math.cos(up);
    const mid: [number, number, number] = [
      ax + Math.cos(az) * dirH * l * 0.5,
      cy + dirY * l * 0.5,
      az0 + Math.sin(az) * dirH * l * 0.5,
    ];
    reach = Math.max(reach, Math.hypot(mid[0], mid[2]) + l * 0.5);
    // a stub ends in a blunt SNAP (end radius ~40% of its root), never a tip
    parts.push({
      geo: new t.CylinderGeometry(r0 * 0.4, r0, l, 7, 1),
      matrix: mtx(t, mid, [Math.sin(az) * (Math.PI / 2 - up), 0, -Math.cos(az) * (Math.PI / 2 - up)]),
      uv: [1, Math.max(2, Math.round(l * 4))],
    });
    // one limb forks before it broke
    if (i === 0 && NL > 0) {
      const fl = l * 0.55;
      const faz = az + 0.9;
      parts.push({
        geo: new t.CylinderGeometry(r0 * 0.3, r0 * 0.55, fl, 6, 1),
        matrix: mtx(
          t,
          [
            mid[0] + Math.cos(az) * dirH * l * 0.4 + Math.cos(faz) * fl * 0.4,
            mid[1] + dirY * l * 0.4 + fl * 0.3,
            mid[2] + Math.sin(az) * dirH * l * 0.4 + Math.sin(faz) * fl * 0.4,
          ],
          [Math.sin(faz) * 0.9, 0, -Math.cos(faz) * 0.9],
        ),
        uv: [1, 2],
      });
    }
  }

  const trunk = mergedParts(t, parts, charMat);
  group.add(trunk);
  geos.push(trunk.geometry);

  // ---- spalled bark plates: the pale heartwood showing through -----------
  // Partial cylinder shells hugging the trunk, so a couple of patches of the
  // char have flaked off — the only non-black colour on the piece.
  const woodMat = mat(t, EMBERFALL.charWood, { tex: 'wood', repeat: [1, 3], rough: 1, bump: 0.03 });
  woodMat.side = t.DoubleSide;
  mats.push(woodMat);
  const barkParts: PartSpec[] = [];
  for (let i = 0; i < 3; i += 1) {
    const f = 0.12 + hash01(i * 4.1 + seed * 2.9) * 0.62;
    const h = H * (0.08 + hash01(i * 6.7 + seed) * 0.12);
    // 1.5% PROUD of the trunk, not inside it: a plate flush with the surface is
    // z-fought away, and one tucked under it is simply invisible
    const rr = trunkR(f) * 1.015;
    const th0 = hash01(i * 8.9 + seed) * Math.PI * 2;
    const thL = 0.7 + hash01(i * 12.1 + seed) * 0.9;
    barkParts.push({
      geo: new t.CylinderGeometry(rr * 0.94, rr, h, 8, 1, true, th0, thL),
      matrix: mtx(t, [axX * f, -0.05 + (H + 0.05) * f + h / 2, axZ * f]),
      uv: [1, 2],
    });
  }
  const bark = mergedParts(t, barkParts, woodMat);
  bark.userData.lodDetail = true; // spalled plates: close-up only
  group.add(bark);
  geos.push(bark.geometry);

  // ---- ash and charcoal litter at the foot -------------------------------
  let litterMesh: THREE.Mesh | null = null;
  if (opts.litter ?? true) {
    const litter: MergedBoxSpec[] = [];
    for (let i = 0; i < 16; i += 1) {
      const az = hash01(i * 2.31 + seed * 3.7) * Math.PI * 2;
      const rr = R * (1.5 + hash01(i * 4.17 + seed) * 2.3);
      const sz = R * (0.12 + hash01(i * 6.29 + seed) * 0.26);
      litter.push({
        dims: [sz, sz * 0.34, sz * (0.6 + hash01(i * 8.31) * 0.9)],
        pos: [Math.cos(az) * rr, sz * 0.12, Math.sin(az) * rr],
        rotX: (hash01(i * 10.37 + seed) - 0.5) * 0.5,
        rotY: hash01(i * 12.41 + seed) * Math.PI,
        rotZ: (hash01(i * 14.43 + seed) - 0.5) * 0.5,
        repeat: [1, 1],
      });
    }
    litterMesh = mergedBoxes(t, litter, EMBERFALL.char, { tex: 'asphalt', rough: 1, bump: 0.04, flat: true });
    litterMesh.userData.lodDetail = true;
    group.add(litterMesh);
    geos.push(litterMesh.geometry);
    mats.push(litterMesh.material as THREE.Material);
  }

  return {
    group,
    height: H,
    radius: R * 1.7,
    dispose() {
      texes.forEach((x) => x.dispose());
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}

// ===========================================================================
// THE COMPOSABLE COMPONENTS (components/Park/Context.md convention)
//
// Each mounts into the surrounding <Park> / <ScenePreview> at
// `position` / `rotation` / `scale` (y settles onto the plaza/terrain) and
// renders null — components never render a <Stage> themselves; the preview
// staging lives in EmberfallScenery.previews.tsx.
//
// BLOCKERS (GameManager/Context.md "Blockers"): the three solid pieces — the
// colonnade, the obsidian cluster and the snag — plus the fumarole's rock mound
// register a circular blocker, so guests path AROUND them. The ground fissure is
// FLAT by design and does not: it is meant to be scattered across paths and
// lawns, and a blocker there would carve holes in the walk network.
// ===========================================================================

export interface FumaroleProps extends FumaroleOpts {
  /** keep guests off the vent mound (default true — it is solid rock and it
   *  is venting scalding steam) */
  blocking?: boolean;
}

/** `<Fumarole>` — a cracked rock steam/gas vent with a glowing throat. */
export const Fumarole = composable<FumaroleProps, FumaroleBuilt>(
  'Fumarole',
  (t, props) =>
    buildFumarole(t, {
      radius: props.radius,
      seed: props.seed,
      activity: props.activity,
      plume: props.plume,
      light: props.light,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale * 1.05 },
        label: '<Fumarole> vent mound',
        height: (built.throatY + 0.2) * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface ObsidianShardsProps extends ObsidianShardsOpts {
  /** keep guests out of the shard cluster (default true — these are blades) */
  blocking?: boolean;
}

/** `<ObsidianShards>` — a cluster of glossy black volcanic-glass blades. */
export const ObsidianShards = composable<ObsidianShardsProps, ObsidianShardsBuilt>(
  'ObsidianShards',
  (t, props) =>
    buildObsidianShards(t, {
      radius: props.radius,
      height: props.height,
      count: props.count,
      seed: props.seed,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: (built.radius + 0.08) * scale },
        label: '<ObsidianShards> cluster',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface BasaltColumnsProps extends BasaltColumnsOpts {
  /** keep guests out of the colonnade (default true) */
  blocking?: boolean;
}

/** `<BasaltColumns>` — a colonnade of hexagonal basalt columns. */
export const BasaltColumns = composable<BasaltColumnsProps, BasaltColumnsBuilt>(
  'BasaltColumns',
  (t, props) =>
    buildBasaltColumns(t, {
      spread: props.spread,
      radius: props.radius,
      height: props.height,
      minHeight: props.minHeight,
      seed: props.seed,
      fallen: props.fallen,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<BasaltColumns> colonnade',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface LavaFissureProps extends LavaFissureOpts {
  /** register a blocker over the crack (default FALSE — the piece is flat so it
   *  can be scattered across paths and lawns; set true for a big hero fissure
   *  you want guests to keep clear of) */
  blocking?: boolean;
}

/** `<LavaFissure>` — a flat ground crack with magma glowing inside, day and
 *  night. Runs along its local +Z, so `rotation` aims it. */
export const LavaFissure = composable<LavaFissureProps, LavaFissureBuilt>(
  'LavaFissure',
  (t, props) =>
    buildLavaFissure(t, {
      length: props.length,
      width: props.width,
      meander: props.meander,
      seed: props.seed,
      activity: props.activity,
      effects: props.effects,
      light: props.light,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (!props.blocking) return; // flat by design: no blocker unless asked
      const [wx, , wz] = position;
      return park.registerBlocker({
        rect: {
          cx: wx,
          cz: wz,
          hx: built.width * 2.6 * scale,
          hz: (built.length / 2 + built.width) * scale,
          yaw: rotation,
        },
        label: '<LavaFissure> crack',
        height: 0.2,
        kind: 'scenery',
      });
    },
  },
);

export interface CharredSnagProps extends CharredSnagOpts {
  /** keep guests out of the trunk (default true) */
  blocking?: boolean;
}

/** `<CharredSnag>` — a dead, burnt tree: blackened trunk, broken limbs. */
export const CharredSnag = composable<CharredSnagProps, CharredSnagBuilt>(
  'CharredSnag',
  (t, props) =>
    buildCharredSnag(t, {
      height: props.height,
      radius: props.radius,
      seed: props.seed,
      limbs: props.limbs,
      litter: props.litter,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<CharredSnag> trunk',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);
