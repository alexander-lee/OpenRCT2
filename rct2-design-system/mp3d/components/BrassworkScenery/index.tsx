import * as THREE from 'three';
import { alongDir, ball, box, cyl, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { composable } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// BrassworkScenery — the five scenery pieces of the BRASSWORK FOUNDRY world, a
// steampunk industrial quarter. Per-world scenery (not an extension of the
// shared SceneryPack): one component folder exporting five imperative builders
// plus five composable components, so the whole foundry dressing set arrives
// (and versions) together — the same shape as components/EmberfallScenery and
// components/TidewaterScenery.
//
//   1. <GiantGear>    an oversized cast-iron gear wheel on a bearing pedestal,
//                     teeth worn and one broken clean off, driving a small
//                     pinion — both turn, geared exactly 24 : 10
//   2. <SteamPipes>   a tangle of riveted plumbing: flanged risers, elbows over
//                     the top, valve bodies with handwheels, live gauges and two
//                     relief vents that PUFF steam
//   3. <ClockTower>   a slender riveted tower with four working clock faces
//                     (hands on the absolute-time clock), a copper spire and a
//                     bell that swings on the hour
//   4. <BoilerTank>   a horizontal riveted boiler set in brick, firebox door
//                     glowing, gauge glass, safety valve and a smoking chimney
//   5. <CoalCart>     a narrow-gauge tipper wagon heaped with coal on a short
//                     length of spiked track with sleepers and ballast
//
// THE METALNESS RULE, AND IT IS THE WHOLE PALETTE (the lesson GoggleWorks left
// behind): a MeshStandardMaterial at metalness ≥ 0.6 with no environment map
// renders NEAR-BLACK — metals are lit only by reflections, and this Stage has a
// sun and nothing to reflect. Every metal in this file sits in the 0.18–0.34
// band and gets its "brass" from COLOUR plus TEXTURE (the tarnish canvas below),
// never from metalness. There is no shiny gold anywhere: brass is a dull
// yellow-brown, copper is a warm brown weeping verdigris, and everything in an
// industrial yard is under a film of soot.
//
// Budgets: THREE real PointLights across all five pieces (the clock tower's dial
// gaslight and its bracket lantern, the boiler's firebox — all night-gated; the
// firebox keeps a 0.06 ember floor by day, because a lit fire is lit), 74
// particles for a full set (steam 28 + 20 at the pipe vents, chimney smoke 26),
// static repeats batched through Stage's `mergedBoxes` (every rivet in the world)
// or the local `mergedParts`, fine detail — rivet heads, dial ticks, track
// spikes, verdigris streaks, cinder litter — tagged `userData.lodDetail`.
// Deterministic: hashed sines only, never Math.random / Date.now; every `update`
// takes ABSOLUTE time.
//
// TEXTURE SCALE ON SMALL PIECES — the warning both sibling packs left behind. A
// 128² tile stretched over a 0.03 u pipe puts its grain below one pixel at park
// zoom and the surface averages out to a flat dark smear. Every `repeat` here is
// chosen against the part's real world size (roughly one tile per 0.25–0.5 u),
// and anything thinner than ~0.02 u (gauge needles, spokes, clock hands, chain
// links) carries NO map at all.
// ---------------------------------------------------------------------------

// ---- deterministic hashes --------------------------------------------------
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const hash2 = (a: number, b: number) => hash01(a * 37.19 + b * 91.73 + 3.11);

// ---------------------------------------------------------------------------
// THE BRASSWORK PALETTE — an industrial yard under a film of soot. Aged brass,
// oxidised copper weeping verdigris, soot-grey iron, coal black, rust. Nothing
// here is saturated and nothing here is gold. Tuned to sit with SetPieceKit's
// BRASSWORK_FOUNDRY theme and with components/GoggleWorks (the world's stall),
// which uses exactly these brass/copper/iron values.
// ---------------------------------------------------------------------------
export const BRASSWORK = {
  /** muted brass — a dull yellow-brown, never gold */
  brass: 0xb2913f,
  /** shadowed brass / heavy castings, and the colour of every rivet head (a
   *  BRIGHT rivet at 0.014 u reads as a bead of gold — ask the first pass) */
  brassDark: 0x86682f,
  /** the brightest brass in the world: bezels, bell, gauge rims */
  brassLight: 0xd0b26a,
  /** oxidised copper sheet (warm brown, not terracotta) */
  copper: 0x96603a,
  /** the patina staining the copper (a muted green, NOT a teal stripe — the
   *  first pass at 0x3a5340 read as scattered turquoise dashes on the spire) */
  verdigris: 0x36483a,
  /** THE WORLD'S DEFAULT METAL: soot-grey iron. Deliberately a NEUTRAL warm
   *  grey and not the theme's 0x554533 — that value is right on a stall's small
   *  parts, but on a 1 u boiler barrel under this Stage's sun a brown-olive iron
   *  multiplied by the grime map collapses the whole yard into one brown mass */
  iron: 0x615c53,
  /** deep soot in the shadows and the crevices */
  ironDark: 0x38342e,
  /** cast iron catching sky: pedestals, gear rims, cradles, barrels */
  ironPale: 0x8a8378,
  /** the true black of an industrial yard: soot wash, oil, grease */
  soot: 0x241f1b,
  /** anthracite — pitched UP off pure black on purpose (a 3%-albedo lump reads
   *  as a hole in the frame, exactly like Emberfall's obsidian) with a cold
   *  blue-grey cast, so the facets carry the read */
  coal: 0x302e36,
  /** the brighter cleaved face on a fresh lump of coal — barely brighter, on
   *  purpose: at 0x413f4a the facets read as chips of ICE in the wagon */
  coalFace: 0x393742,
  /** iron gone to orange-brown rust */
  rust: 0x8a5230,
  /** the darker, wetter rust down in the pits */
  rustDark: 0x593723,
  /** cinder ballast and clinker grit */
  cinder: 0x433d35,
  /** creosoted sleeper timber */
  timber: 0x5b4a35,
  /** the greyer, sun-scoured timber on a lever or a shovel handle */
  timberPale: 0x7a6a52,
  /** sooted firebrick */
  firebrick: 0x7a5b48,
  /** enamel dial face, gauges and clock faces alike */
  dial: 0xe8e0cc,
  /** gauge glass / clock glazing: pale grey-blue */
  glass: 0x86aab4,
  /** the one red in the world: gauge needles and the danger line */
  needle: 0x8c2318,
  /** gaslight glass and the warm flame inside it */
  lampGlass: 0xfff0cc,
  lampGlow: 0xffb050,
  /** firebox incandescence — the hot end of the same ramp Volcano uses */
  fireHot: 0xffb060,
  fireDeep: 0xc9440e,
} as const;

const {
  brass: BRASS,
  brassDark: BRASS_D,
  brassLight: BRASS_L,
  copper: COPPER,
  verdigris: VERDIGRIS,
  iron: IRON,
  ironDark: IRON_D,
  ironPale: IRON_P,
  soot: SOOT,
  coal: COAL,
  rust: RUST,
  cinder: CINDER,
  timber: TIMBER,
  timberPale: TIMBER_P,
  firebrick: FIREBRICK,
  dial: DIAL,
  glass: GLASS,
  needle: NEEDLE,
} = BRASSWORK;

// ---------------------------------------------------------------------------
// LOCAL PROCEDURAL CANVASES — two surfaces Stage's texture library cannot do,
// both built the way Stage's own `drawTexture` builds its textures (2D canvas,
// per-stroke variation) but with `hash01` instead of Math.random, so a park
// screenshot is byte-identical run to run. Module-cached: one canvas serves every
// gear, tank and tower in the park.
//
// BOTH ARE LUMINANCE MAPS CENTRED NEAR WHITE (~0.80), not coloured textures.
// `map` multiplies the material colour, so a near-white mottle lets ONE canvas
// serve brass, copper, iron and soot — the palette entry sets the hue and the
// canvas only supplies grime, wear and relief. A coloured canvas would fight
// every colour it was tinted to (Tidewater's rust canvas can afford to be
// coloured because rust is only ever one colour).
// ---------------------------------------------------------------------------

/**
 * GRIME — a machined-iron surface that has been in a foundry for fifty years:
 * fine horizontal tooling streaks (Stage's 'metal' idea, kept), broad soot
 * blotches, a grit speckle, vertical rust weeps and a few pale wear scuffs where
 * a hand or a chain has polished the metal back. Doubles as the bump map, so the
 * pitting reads as pitting.
 */
let _grimeCanvas: HTMLCanvasElement | null = null;
function grimeCanvas(): HTMLCanvasElement {
  if (_grimeCanvas) return _grimeCanvas;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  // CENTRED NEAR WHITE (0.88). The first pass sat at 0.80 with heavy soot, and
  // multiplied into the palette it dragged every surface in the yard down into
  // one brown mass — a grime map darkens, so it has to start bright.
  x.fillStyle = 'rgb(226,226,226)';
  x.fillRect(0, 0, S, S);
  // fine tooling streaks along the rolling direction
  for (let i = 0; i < 190; i += 1) {
    const d = Math.round(192 + hash01(i * 1.37) * 60);
    x.strokeStyle = `rgb(${d},${d},${d})`;
    x.lineWidth = 0.4 + hash01(i * 2.71) * 0.7;
    const y = hash01(i * 3.19) * S;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(S, y + (hash01(i * 5.31) - 0.5) * 1.6);
    x.stroke();
  }
  // SOOT BLOTCHES — the bulk of the darkening, and what says "industry". FEWER
  // and FAINTER than the first pass: 22 blotches at 0.44 alpha over a 128² tile
  // made every big surface (the boiler barrel above all) read as LEOPARD SKIN.
  for (let i = 0; i < 14; i += 1) {
    const cx = hash01(i * 1.71 + 0.3) * S;
    const cy = hash01(i * 2.93 + 5.1) * S;
    const r = 7 + hash01(i * 3.77) * 22;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(64,60,55,${0.1 + hash01(i * 7.13) * 0.17})`);
    g.addColorStop(1, 'rgba(64,60,55,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // vertical rust weeps — slightly warm, so a grey iron colour still runs orange
  for (let i = 0; i < 12; i += 1) {
    const px = hash01(i * 9.31 + 1.9) * S;
    const h = 12 + hash01(i * 11.7) * 46;
    const g = x.createLinearGradient(px, hash01(i * 13.3) * S, px, hash01(i * 13.3) * S + h);
    g.addColorStop(0, 'rgba(168,116,72,0.3)');
    g.addColorStop(1, 'rgba(168,116,72,0)');
    x.strokeStyle = g;
    x.lineWidth = 1 + hash01(i * 15.1) * 2.6;
    x.beginPath();
    x.moveTo(px, hash01(i * 13.3) * S);
    x.lineTo(px + (hash01(i * 17.9) - 0.5) * 4, hash01(i * 13.3) * S + h);
    x.stroke();
  }
  // grit + pitting speckle
  for (let i = 0; i < 900; i += 1) {
    const d = hash01(i * 1.31);
    const v = d > 0.78 ? 120 + d * 46 : 206 + d * 50;
    x.fillStyle = `rgba(${v | 0},${(v * 0.98) | 0},${(v * 0.95) | 0},0.7)`;
    const s = 0.7 + hash01(i * 3.71) * 1.5;
    x.fillRect(hash01(i * 5.17) * S, hash01(i * 7.19) * S, s, s);
  }
  // pale wear scuffs: where hands, chains and shovels polish the metal back
  for (let i = 0; i < 9; i += 1) {
    const cx = hash01(i * 21.3 + 2.2) * S;
    const cy = hash01(i * 23.9 + 6.6) * S;
    const r = 4 + hash01(i * 25.1) * 11;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,252,244,0.5)');
    g.addColorStop(1, 'rgba(255,252,244,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  _grimeCanvas = c;
  return c;
}

/**
 * TARNISH — what makes brass read as brass without any metalness: a mottle of
 * darker tarnish blooms (shifted a touch GREEN, so the same canvas puts real
 * verdigris into copper), faint circumferential polish streaks, a scatter of
 * dark pits, and a few bright rubbed highlights. Doubles as the bump map.
 */
let _tarnishCanvas: HTMLCanvasElement | null = null;
function tarnishCanvas(): HTMLCanvasElement {
  if (_tarnishCanvas) return _tarnishCanvas;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgb(234,232,226)';
  x.fillRect(0, 0, S, S);
  // TARNISH BLOOMS, green-shifted: on copper these ARE the verdigris
  for (let i = 0; i < 20; i += 1) {
    const cx = hash01(i * 2.11 + 0.7) * S;
    const cy = hash01(i * 3.37 + 4.3) * S;
    const r = 6 + hash01(i * 4.79) * 22;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(96,118,92,${0.26 + hash01(i * 6.13) * 0.3})`);
    g.addColorStop(1, 'rgba(96,118,92,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // soot film in the low corners — brass in a foundry is never clean
  for (let i = 0; i < 10; i += 1) {
    const cx = hash01(i * 8.11 + 3.3) * S;
    const cy = hash01(i * 9.37 + 1.1) * S;
    const r = 8 + hash01(i * 10.9) * 20;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(64,58,52,0.3)');
    g.addColorStop(1, 'rgba(64,58,52,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // faint polish streaks (a turned brass surface is circumferentially scored)
  for (let i = 0; i < 90; i += 1) {
    const d = Math.round(196 + hash01(i * 1.91) * 58);
    x.strokeStyle = `rgba(${d},${d},${(d * 0.94) | 0},0.5)`;
    x.lineWidth = 0.4 + hash01(i * 3.11) * 0.6;
    const y = hash01(i * 4.53) * S;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(S, y + (hash01(i * 6.71) - 0.5) * 1.2);
    x.stroke();
  }
  // pits and a few rubbed highlights
  for (let i = 0; i < 420; i += 1) {
    const d = hash01(i * 1.51);
    const v = d > 0.8 ? 118 + d * 40 : 208 + d * 52;
    x.fillStyle = `rgba(${v | 0},${(v * 0.99) | 0},${(v * 0.92) | 0},0.62)`;
    x.fillRect(hash01(i * 5.37) * S, hash01(i * 7.59) * S, 0.8 + hash01(i * 9.7) * 1.4, 0.8 + hash01(i * 11.3) * 1.4);
  }
  for (let i = 0; i < 7; i += 1) {
    const cx = hash01(i * 27.1 + 1.4) * S;
    const cy = hash01(i * 29.3 + 5.9) * S;
    const r = 4 + hash01(i * 31.7) * 9;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,250,232,0.55)');
    g.addColorStop(1, 'rgba(255,250,232,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  _tarnishCanvas = c;
  return c;
}

// ---- texture + material plumbing ------------------------------------------

/** the per-piece disposal arena. Park's `disposeDeep` already walks the mounted
 *  group's geometries and materials, so this exists for the CanvasTextures (one
 *  set per piece, because each carries its own `repeat`) and for anything the
 *  traversal cannot see. */
interface Bag {
  texes: THREE.Texture[];
  mats: THREE.Material[];
  geos: THREE.BufferGeometry[];
}
const newBag = (): Bag => ({ texes: [], mats: [], geos: [] });

function texFrom(t: typeof THREE, canvas: HTMLCanvasElement, rx: number, ry: number): THREE.CanvasTexture {
  const tex = new t.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  return tex;
}

interface SurfaceOpts {
  rough?: number;
  metal?: number;
  bump?: number;
  flat?: boolean;
  emissive?: number;
}

/** a metal surface: palette colour × one of the two local grime canvases. The
 *  METALNESS CEILING lives here — 0.34, and the default 0.26. */
function surface(
  t: typeof THREE,
  bag: Bag,
  color: number,
  kind: 'grime' | 'tarnish',
  repeat: [number, number],
  o: SurfaceOpts = {},
): THREE.MeshStandardMaterial {
  const tex = texFrom(t, kind === 'grime' ? grimeCanvas() : tarnishCanvas(), repeat[0], repeat[1]);
  bag.texes.push(tex);
  const m = new t.MeshStandardMaterial({
    color,
    map: tex,
    bumpMap: tex,
    bumpScale: o.bump ?? 0.03,
    roughness: o.rough ?? 0.72,
    metalness: Math.min(0.34, o.metal ?? 0.26),
    flatShading: o.flat ?? false,
    emissive: o.emissive ?? 0x000000,
  });
  bag.mats.push(m);
  return m;
}

/** a plain (unmapped) material — for anything thinner than ~0.02 u, where a
 *  tiled map is strictly worse than none */
function plain(t: typeof THREE, bag: Bag, color: number, o: SurfaceOpts = {}): THREE.MeshStandardMaterial {
  const m = new t.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.7,
    metalness: Math.min(0.34, o.metal ?? 0.24),
    flatShading: o.flat ?? false,
    emissive: o.emissive ?? 0x000000,
  });
  bag.mats.push(m);
  return m;
}

// ---------------------------------------------------------------------------
// GEOMETRY HELPERS — `mergedParts` / `mtx` / `alongDir` (imported from Stage)
// are the non-box counterparts of Stage's `mergedBoxes` (which only takes
// boxes). This world is built out of cylinders (pipes, shells, wheels), tori
// (elbows, handwheel rims, bell lips, coupling hooks) and squashed icosahedra
// (coal, cinder), so it needs them.
// ---------------------------------------------------------------------------

/** a pipe run between two points, as a PartSpec (radius `r`) */
function pipeRun(t: typeof THREE, a: [number, number, number], b: [number, number, number], r: number, seg = 10): PartSpec {
  const p0 = new t.Vector3(...a);
  const d = new t.Vector3(...b).sub(p0);
  const len = d.length();
  return {
    geo: new t.CylinderGeometry(r, r, len, seg, 1),
    matrix: alongDir(t, p0, d, len),
    uv: [Math.max(1, Math.round(r * 24)), Math.max(1, Math.round(len * 3))],
  };
}

// ---- RIVETS: the classic mergedBoxes case ---------------------------------
// A rivet head is 0.014–0.022 u across. Individually they are 24 draw calls of
// nothing; batched they are a dotted seam line that reads as "riveted plate" at
// park zoom and as ironmongery close up. Every ring below returns MergedBoxSpec
// so a whole piece's rivets collapse into ONE mesh.

/** rivets round a circle in the XY plane (a gear face, a clock bezel), z = zc */
const rivetsXY = (n: number, r: number, zc: number, s: number, phase = 0): MergedBoxSpec[] =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return {
      dims: [s, s, s * 0.75] as [number, number, number],
      pos: [Math.cos(a) * r, Math.sin(a) * r, zc] as [number, number, number],
      rotZ: a,
    };
  });

/** rivets round a cylinder whose axis is X, at x = xc (radius r). A box with
 *  rotX = a maps its local +z onto the outward radial (0, sin a, cos a). */
const rivetsAxisX = (n: number, r: number, xc: number, s: number, phase = 0): MergedBoxSpec[] =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return {
      dims: [s * 0.75, s, s] as [number, number, number],
      pos: [xc, Math.sin(a) * r, Math.cos(a) * r] as [number, number, number],
      rotX: a,
    };
  });

/** rivets round a cylinder whose axis is Y, at height y (radius r) */
const rivetsAxisY = (n: number, r: number, y: number, s: number, phase = 0): MergedBoxSpec[] =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return {
      dims: [s, s * 0.75, s] as [number, number, number],
      pos: [Math.sin(a) * r, y, Math.cos(a) * r] as [number, number, number],
      rotY: a,
    };
  });

/** translate a batch of rivet specs (the ring helpers build about the origin) */
const shift = (specs: MergedBoxSpec[], dx: number, dy: number, dz: number): MergedBoxSpec[] =>
  specs.map((s) => ({ ...s, pos: [(s.pos?.[0] ?? 0) + dx, (s.pos?.[1] ?? 0) + dy, (s.pos?.[2] ?? 0) + dz] as [number, number, number] }));

/** a straight row of rivets from `a` to `b` (n heads, size s) */
const rivetRow = (
  n: number,
  a: [number, number, number],
  b: [number, number, number],
  s: number,
  rot: [number, number, number] = [0, 0, 0],
): MergedBoxSpec[] =>
  Array.from({ length: n }, (_, i) => {
    const f = n === 1 ? 0.5 : i / (n - 1);
    return {
      dims: [s, s, s] as [number, number, number],
      pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] as [number, number, number],
      rotX: rot[0],
      rotY: rot[1],
      rotZ: rot[2],
    };
  });

// ---- small shared assemblies ----------------------------------------------

/** a soot/cinder apron: the patch of clinker-strewn ground the piece stands in.
 *  Elliptical, because a perfect circle of ash reads as a dinner plate. */
function sootApron(t: typeof THREE, rx: number, rz: number, color = CINDER): THREE.Mesh {
  const m = cyl(t, 1, 1.05, 0.045, color, [0, -0.006, 0], {
    tex: 'concrete',
    repeat: [Math.max(2, Math.round(rx * 6)), Math.max(2, Math.round(rz * 6))],
    rough: 0.98,
    bump: 0.05,
    seg: 26,
  });
  m.scale.set(rx, 1, rz);
  return m;
}

/**
 * CINDER / COAL LITTER — small ROUNDED DARK lumps, half-buried. Flat pale boxes
 * on the ground read unmistakably as scraps of paper (the mistake both sibling
 * packs made, twice each): debris has to be rounded, darker than you think, and
 * smaller than you think.
 */
function litterLumps(
  t: typeof THREE,
  seed: number,
  n: number,
  rMin: number,
  rMax: number,
  size: number,
  centre: [number, number, number] = [0, 0, 0],
): PartSpec[] {
  const out: PartSpec[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = hash01(i * 2.31 + seed * 4.1) * Math.PI * 2;
    const rr = rMin + hash01(i * 4.17 + seed) * (rMax - rMin);
    const s = size * (0.55 + hash01(i * 6.29 + seed) * 0.85);
    out.push({
      geo: new t.IcosahedronGeometry(1, 0),
      matrix: mtx(
        t,
        [centre[0] + Math.cos(a) * rr, centre[1] + s * 0.42, centre[2] + Math.sin(a) * rr],
        [(hash01(i * 12.41) - 0.5) * 0.8, hash01(i * 10.37 + seed) * Math.PI, (hash01(i * 14.7) - 0.5) * 0.8],
        [s, s * 0.62, s * (0.75 + hash01(i * 8.31) * 0.5)],
      ),
      uv: [1, 1],
    });
  }
  return out;
}

/** a handwheel (valve wheel) in the local XY plane — axis +Z. Rim torus, four
 *  spokes, a hub boss and a small rim grip. Rods are ~0.012 u so: no maps. */
function handWheel(t: typeof THREE, bag: Bag, r: number, colour = BRASS_L): THREE.Group {
  const g = new t.Group();
  const m = plain(t, bag, colour, { rough: 0.5, metal: 0.3 });
  const parts: PartSpec[] = [];
  // FAT on purpose: at r·0.16 the rim went to 0.013 u and vanished at park zoom
  const tube = r * 0.23;
  parts.push({ geo: new t.TorusGeometry(r, tube, 5, 16), matrix: mtx(t, [0, 0, 0]) });
  // two crossing bars = the four spokes a valve wheel actually has
  for (let i = 0; i < 2; i += 1) {
    const a = (i / 2) * Math.PI;
    parts.push({
      geo: new t.CylinderGeometry(tube * 0.62, tube * 0.62, r * 2, 5, 1),
      matrix: mtx(t, [0, 0, 0], [0, 0, 0]).multiply(new t.Matrix4().makeRotationZ(a)),
    });
  }
  parts.push({ geo: new t.CylinderGeometry(r * 0.3, r * 0.3, tube * 2.6, 8, 1), matrix: mtx(t, [0, 0, 0], [Math.PI / 2, 0, 0]) });
  // the grip knob on the rim: what a hand actually turns
  parts.push({ geo: new t.CylinderGeometry(tube * 0.9, tube * 0.9, tube * 2.4, 6, 1), matrix: mtx(t, [r * 0.86, r * 0.5, 0], [Math.PI / 2, 0, 0]) });
  const mesh = mergedParts(t, parts, m);
  g.add(mesh);
  return g;
}

/** a pressure gauge facing local +Z, radius `r`. Returns the group and its live
 *  needle (pivot already moved to the dial centre). */
function gaugeFace(t: typeof THREE, r: number): { group: THREE.Group; needle: THREE.Mesh } {
  const g = new t.Group();
  g.add(cyl(t, r, r, 0.03, BRASS, [0, 0, 0], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.42, seg: 14, rotX: Math.PI / 2 })); // case
  g.add(cyl(t, r * 0.86, r * 0.86, 0.008, DIAL, [0, 0, 0.019], { rough: 0.76, seg: 14, rotX: Math.PI / 2 })); // dial
  g.add(cyl(t, r, r * 0.98, 0.008, BRASS_L, [0, 0, 0.023], { tex: 'metal', repeat: [4, 1], metal: 0.32, rough: 0.3, seg: 14, rotX: Math.PI / 2 })); // bezel
  const ticks: MergedBoxSpec[] = [];
  for (let k = 0; k < 9; k += 1) {
    const a = -2.2 + (k / 8) * 4.4;
    ticks.push({ dims: [0.005, r * 0.22, 0.005], pos: [Math.sin(a) * r * 0.66, Math.cos(a) * r * 0.66, 0.027], rotZ: -a });
  }
  const tickMesh = mergedBoxes(t, ticks, IRON_D, { rough: 0.82 });
  tickMesh.userData.lodDetail = true; // dial ticks: close-up only
  g.add(tickMesh);
  // the red danger arc at the top of the scale
  const danger = box(t, [0.006, r * 0.2, 0.004], NEEDLE, [Math.sin(1.95) * r * 0.66, Math.cos(1.95) * r * 0.66, 0.028], { rough: 0.7, rotZ: -1.95 });
  danger.userData.lodDetail = true;
  g.add(danger);
  const needle = box(t, [0.006, r * 0.78, 0.005], NEEDLE, [0, 0, 0.031], { rough: 0.62 });
  needle.geometry = needle.geometry.clone();
  needle.geometry.translate(0, r * 0.32, 0); // pivot at the dial centre
  g.add(needle);
  g.add(cyl(t, 0.008, 0.008, 0.012, BRASS_L, [0, 0, 0.034], { metal: 0.32, rough: 0.32, seg: 8, rotX: Math.PI / 2 })); // boss
  return { group: g, needle };
}

// ===========================================================================
// 1. <GiantGear> — an oversized cast-iron gear on a bearing pedestal
// ===========================================================================
//
// A gear reads by its TEETH, so the teeth are the piece: 24 of them, tangential
// width exactly half the circular pitch, standing 0.15 R proud of the rim, with
// three hashed teeth WORN round and one BROKEN CLEAN OFF (that missing tooth,
// and the chipped stump left in its place, does more for "old machinery" than any
// amount of rust). The rim is a real ring of 24 bolted segments with the SPOKES
// visible through it — a solid disc is a wheel, not a gear.
//
// And it drives a PINION: a 10-tooth cast gear on a bracket off the same
// pedestal. Two meshed gears say "gearing" in a way one gear never can, and the
// mesh is exact rather than eyeballed — the pinion carries the same circular
// pitch (so 24 : 10) and its phase is set half a tooth off the line of centres,
// which means every 2π/24 the big gear turns, the pinion turns exactly one of
// its own teeth and the interleave is preserved forever.

export interface GiantGearOpts {
  /** outer radius over the teeth (default 0.5) */
  radius?: number;
  seed?: number;
  /** the small meshing pinion on its bracket (default true) */
  pinion?: boolean;
  /** slow rotation (default true) */
  spin?: boolean;
  /** the cinder ballast mound and clinker litter (default true) */
  ballast?: boolean;
}

export interface GiantGearBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** blocker radius over the mound */
  radius: number;
  height: number;
}

/** the giant gear. Group origin on the ground under the axle; the gear FACE
 *  looks along local +Z and the pinion sits to local +X. */
export function buildGiantGear(t: typeof THREE, opts: GiantGearOpts = {}): GiantGearBuilt {
  const R = opts.radius ?? 0.5;
  const seed = opts.seed ?? 1;
  const bag = newBag();
  const group = new t.Group();
  group.name = 'giant-gear';

  // ---- the tooth geometry, and therefore everything else -----------------
  const N = 24;
  const TH = 0.15 * R; // tooth radial height
  const RIM_O = R - TH; // rim outer radius
  const RIM_T = 0.17 * R; // rim radial thickness
  const RIM_C = RIM_O - RIM_T / 2; // rim centre radius
  const RP = RIM_O + TH * 0.5; // pitch circle
  const P = (2 * Math.PI * RP) / N; // circular pitch
  const TW = P * 0.46; // tooth tangential width (the rest is backlash)
  // HEAVY on purpose: a gear is a disc, and at 0.23 R it went to a paper sliver
  // when the camera orbited round to its edge. 0.3 R reads as a casting.
  const W = 0.3 * R; // gear thickness (along Z)
  const CY = 1.2 * R; // axle height — the gear's bottom sits just clear of the mound
  const NP = 10; // pinion teeth
  const RP_P = (NP * P) / (2 * Math.PI); // pinion pitch radius (same pitch = it meshes)
  const THETA = -0.22; // the line of centres, down-right off the big gear

  const ironMat = surface(t, bag, IRON_P, 'grime', [3, 3], { rough: 0.78, metal: 0.24, bump: 0.045 });
  const brassMat = surface(t, bag, BRASS, 'tarnish', [2, 2], { rough: 0.5, metal: 0.32, bump: 0.025 });

  // =========================================================================
  // the BALLAST — a low cinder mound the gear stands in, with clinker litter
  // =========================================================================
  if (opts.ballast ?? true) {
    group.add(sootApron(t, R * 1.04, R * 0.74));
    const mound = ball(t, 1, CINDER, [0, 0, 0], { tex: 'concrete', repeat: [4, 3], rough: 1, bump: 0.06, flat: true });
    mound.scale.set(R * 0.9, 0.085, R * 0.56);
    group.add(mound);
    const grit = mergedParts(t, litterLumps(t, seed + 3, 16, R * 0.42, R * 1.0, 0.05), plain(t, bag, CINDER, { rough: 1, metal: 0.1, flat: true }));
    grit.userData.lodDetail = true; // clinker grit: close-up only
    group.add(grit);
    bag.geos.push(grit.geometry);
  }

  // =========================================================================
  // the PEDESTAL — a cast-iron standard BEHIND the gear plane (z < 0), so it
  // never hides the spokes, carrying a split bearing at the axle line
  // =========================================================================
  const ped: PartSpec[] = [];
  const PZ = -0.24 * R; // the pedestal's own z
  ped.push({ geo: new t.BoxGeometry(R * 1.0, 0.055, R * 0.7), matrix: mtx(t, [R * 0.1, 0.055, PZ]), uv: [3, 2] }); // base plate
  ped.push({ geo: new t.BoxGeometry(R * 0.62, R * 0.5, R * 0.36), matrix: mtx(t, [0, R * 0.32, PZ]), uv: [2, 2] }); // lower casting
  ped.push({ geo: new t.BoxGeometry(R * 0.4, R * 0.55, R * 0.3), matrix: mtx(t, [0, R * 0.85, PZ]), uv: [2, 2] }); // upper casting
  // a diagonal web brace on each side — cast iron is always webbed
  for (const sgn of [1, -1]) {
    ped.push({
      geo: new t.BoxGeometry(R * 0.5, 0.03, R * 0.1),
      matrix: mtx(t, [sgn * R * 0.25, R * 0.28, PZ + sgn * R * 0.13], [0, 0, sgn * 0.55]),
      uv: [2, 1],
    });
  }
  ped.push({ geo: new t.BoxGeometry(R * 0.46, R * 0.3, R * 0.4), matrix: mtx(t, [0, CY, PZ + R * 0.04]), uv: [2, 1] }); // bearing housing
  ped.push({ geo: new t.BoxGeometry(R * 0.5, 0.05, R * 0.42), matrix: mtx(t, [0, CY + R * 0.16, PZ + R * 0.04]), uv: [2, 1] }); // bearing cap
  ped.push({ geo: new t.CylinderGeometry(0.096 * R, 0.096 * R, R * 0.6, 12, 1), matrix: mtx(t, [0, CY, PZ + R * 0.16], [Math.PI / 2, 0, 0]), uv: [2, 2] }); // the axle
  if (opts.pinion ?? true) {
    // the bracket arm out to the pinion bearing, along the line of centres
    const px = Math.cos(THETA) * (RP + RP_P);
    const py = CY + Math.sin(THETA) * (RP + RP_P);
    ped.push({ geo: new t.BoxGeometry(px + R * 0.2, R * 0.16, R * 0.16), matrix: mtx(t, [px / 2, (CY + py) / 2, PZ], [0, 0, (py - CY) / px]), uv: [3, 1] });
    ped.push({ geo: new t.BoxGeometry(R * 0.28, R * 0.24, R * 0.3), matrix: mtx(t, [px, py, PZ + R * 0.04]), uv: [1, 1] });
    ped.push({ geo: new t.CylinderGeometry(0.06 * R, 0.06 * R, R * 0.42, 10, 1), matrix: mtx(t, [px, py, PZ + R * 0.14], [Math.PI / 2, 0, 0]), uv: [1, 1] });
    // THE DRIVE SHAFT the pinion turns, running back out of the plane on a
    // plummer block. The whole gear train is coplanar by definition, so without
    // one thing standing OUT of that plane the piece collapses to a sliver when
    // the park camera orbits round to its edge.
    ped.push({ geo: new t.CylinderGeometry(0.055 * R, 0.055 * R, R * 0.95, 10, 1), matrix: mtx(t, [px, py, PZ - R * 0.62], [Math.PI / 2, 0, 0]), uv: [1, 3] });
    ped.push({ geo: new t.CylinderGeometry(0.1 * R, 0.1 * R, R * 0.12, 10, 1), matrix: mtx(t, [px, py, PZ - R * 0.42], [Math.PI / 2, 0, 0]), uv: [2, 1] }); // coupling
    ped.push({ geo: new t.BoxGeometry(R * 0.34, R * 0.2, R * 0.22), matrix: mtx(t, [px, py - R * 0.02, PZ - R * 0.95]), uv: [1, 1] }); // plummer block
    ped.push({ geo: new t.BoxGeometry(R * 0.32, py - R * 0.1, R * 0.3), matrix: mtx(t, [px, (py - R * 0.1) / 2, PZ - R * 0.95]), uv: [1, 2] }); // its column
    ped.push({ geo: new t.BoxGeometry(R * 0.44, 0.05, R * 0.42), matrix: mtx(t, [px, 0.045, PZ - R * 0.95]), uv: [2, 1] }); // and its pad
  }
  const pedMesh = mergedParts(t, ped, ironMat);
  group.add(pedMesh);
  bag.geos.push(pedMesh.geometry);

  // hold-down bolts, the bearing-cap bolts and a brass grease cup
  const pedBolts: MergedBoxSpec[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pedBolts.push({ dims: [0.03 * R * 2, 0.024, 0.03 * R * 2], pos: [R * 0.1 + sx * R * 0.4, 0.09, PZ + sz * R * 0.26] });
  for (const sx of [-1, 1]) pedBolts.push({ dims: [0.05 * R, 0.04, 0.05 * R], pos: [sx * R * 0.19, CY + R * 0.19, PZ + R * 0.04] });
  const pedBoltMesh = mergedBoxes(t, pedBolts, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.45 });
  pedBoltMesh.userData.lodDetail = true;
  group.add(pedBoltMesh);
  group.add(cyl(t, 0.026 * R * 2, 0.03 * R * 2, R * 0.1, BRASS_L, [R * 0.16, CY + R * 0.23, PZ + R * 0.04], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.36, seg: 8 }));

  // =========================================================================
  // the GEAR itself — one merged mesh (rim segments + teeth + spokes + hub) in
  // the gear's own frame, so the whole thing is a single draw call that still
  // rotates
  // =========================================================================
  const gear = new t.Group();
  gear.position.set(0, CY, 0);
  group.add(gear);
  const gearParts: PartSpec[] = [];
  let brokenAt = -1;
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    // rim segment: local +x is radial (rotZ = a), so dims are [radial, tangential, axial]
    const chord = 2 * RIM_C * Math.tan(Math.PI / N) * 1.04; // a hair of overlap keeps the ring closed
    gearParts.push({ geo: new t.BoxGeometry(RIM_T, chord, W), matrix: mtx(t, [Math.cos(a) * RIM_C, Math.sin(a) * RIM_C, 0], [0, 0, a]), uv: [1, 1] });
    // the tooth, with hashed wear
    const wear = hash01(i * 3.7 + seed * 1.9);
    if (wear > 0.955 && brokenAt < 0) {
      brokenAt = i;
      // BROKEN CLEAN OFF: a chipped stump and a bright fracture face
      gearParts.push({
        geo: new t.BoxGeometry(TH * 0.32, TW * 0.86, W * 0.9),
        matrix: mtx(t, [Math.cos(a) * (RIM_O + TH * 0.16), Math.sin(a) * (RIM_O + TH * 0.16), 0], [0, 0, a + 0.07]),
        uv: [1, 1],
      });
      continue;
    }
    const worn = wear > 0.86; // ~3 teeth in 24 — a quarter of them worn read as a ragged rim
    const th = worn ? TH * 0.66 : TH;
    const tw = worn ? TW * 0.86 : TW;
    gearParts.push({
      geo: new t.BoxGeometry(th, tw, W * 0.94),
      matrix: mtx(t, [Math.cos(a) * (RIM_O + th * 0.5), Math.sin(a) * (RIM_O + th * 0.5), 0], [0, 0, a]),
      uv: [1, 1],
    });
  }
  // SIX SPOKES, tapering out of the hub (a cast gear's spokes are heaviest at
  // the boss). Thinner than the rim in z, so the rim reads as a rim.
  const HUB_R = 0.26 * R;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.13;
    const inner = HUB_R * 0.85;
    const len = RIM_O - RIM_T - inner + 0.02;
    gearParts.push({
      geo: new t.CylinderGeometry(0.055 * R, 0.085 * R, len, 5, 1),
      matrix: alongDir(t, new t.Vector3(Math.cos(a) * inner, Math.sin(a) * inner, 0), new t.Vector3(Math.cos(a), Math.sin(a), 0), len),
      uv: [1, 2],
    });
  }
  // the HUB: a heavy boss, a raised bearing collar on the front and the bore
  gearParts.push({ geo: new t.CylinderGeometry(HUB_R, HUB_R, W * 1.5, 14, 1), matrix: mtx(t, [0, 0, 0], [Math.PI / 2, 0, 0]), uv: [3, 1] });
  gearParts.push({ geo: new t.CylinderGeometry(HUB_R * 0.72, HUB_R * 0.72, W * 1.9, 14, 1), matrix: mtx(t, [0, 0, 0], [Math.PI / 2, 0, 0]), uv: [3, 1] });
  const gearMesh = mergedParts(t, gearParts, ironMat);
  gear.add(gearMesh);
  bag.geos.push(gearMesh.geometry);

  // hub bolt circle, rim bolts at every spoke joint, and the keyway plate —
  // ONE merged brass mesh, LOD-shed at distance
  const gearBolts: MergedBoxSpec[] = [];
  gearBolts.push(...rivetsXY(6, HUB_R * 0.5, W * 0.96, 0.042 * R, 0.4));
  gearBolts.push(...rivetsXY(6, HUB_R * 0.5, -W * 0.96, 0.042 * R, 0.4));
  gearBolts.push(...rivetsXY(N, RIM_C, W * 0.52, 0.032 * R));
  gearBolts.push(...rivetsXY(N, RIM_C, -W * 0.52, 0.032 * R));
  const gearBoltMesh = mergedBoxes(t, gearBolts, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.44 });
  gearBoltMesh.userData.lodDetail = true; // rivet/bolt heads: close-up only
  gear.add(gearBoltMesh);
  // a brass bearing collar and grease nipple on the hub front
  gear.add(cyl(t, HUB_R * 0.5, HUB_R * 0.52, W * 2.1, BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.32, rough: 0.44, seg: 12, rotX: Math.PI / 2 }));
  // rust blooms on the rim face — small, and never on the teeth (they are worn
  // BRIGHT by contact, which is exactly why a working gear reads as working)
  const rustSpots: MergedBoxSpec[] = [];
  for (let i = 0; i < 9; i += 1) {
    const a = hash01(i * 5.7 + seed) * Math.PI * 2;
    const rr = RIM_C + (hash01(i * 7.1) - 0.5) * RIM_T * 0.7;
    const s = (0.05 + hash01(i * 9.3) * 0.07) * R;
    rustSpots.push({ dims: [s, s * 1.5, 0.004], pos: [Math.cos(a) * rr, Math.sin(a) * rr, W * 0.5 + 0.003], rotZ: a });
  }
  const rustMesh = mergedBoxes(t, rustSpots, RUST, { tex: 'concrete', repeat: [1, 1], rough: 0.95, bump: 0.03 });
  rustMesh.userData.lodDetail = true;
  gear.add(rustMesh);

  // =========================================================================
  // the PINION — 10 teeth on the same circular pitch, on the bracket bearing.
  // Its phase puts a GAP on the line of centres where the big gear has a TOOTH.
  // =========================================================================
  const pinion = new t.Group();
  const PIN_RIM_O = RP_P - TH * 0.5;
  if (opts.pinion ?? true) {
    pinion.position.set(Math.cos(THETA) * (RP + RP_P), CY + Math.sin(THETA) * (RP + RP_P), 0);
    group.add(pinion);
    const pp: PartSpec[] = [];
    for (let i = 0; i < NP; i += 1) {
      const a = (i / NP) * Math.PI * 2;
      pp.push({
        geo: new t.BoxGeometry(TH, TW, W * 0.8),
        matrix: mtx(t, [Math.cos(a) * (PIN_RIM_O + TH * 0.5), Math.sin(a) * (PIN_RIM_O + TH * 0.5), 0], [0, 0, a]),
        uv: [1, 1],
      });
    }
    // a cast WEB rather than spokes — a 10-tooth pinion is a solid little disc
    pp.push({ geo: new t.CylinderGeometry(PIN_RIM_O, PIN_RIM_O, W * 0.8, 16, 1), matrix: mtx(t, [0, 0, 0], [Math.PI / 2, 0, 0]), uv: [3, 1] });
    pp.push({ geo: new t.CylinderGeometry(PIN_RIM_O * 0.42, PIN_RIM_O * 0.42, W * 1.5, 12, 1), matrix: mtx(t, [0, 0, 0], [Math.PI / 2, 0, 0]), uv: [2, 1] }); // boss
    const pinMesh = mergedParts(t, pp, ironMat);
    pinion.add(pinMesh);
    bag.geos.push(pinMesh.geometry);
    const pinBolts = mergedBoxes(t, rivetsXY(5, PIN_RIM_O * 0.62, W * 0.44, 0.045 * R, 0.3), BRASS_L, { tex: 'metal', repeat: [1, 1], metal: 0.32, rough: 0.36 });
    pinBolts.userData.lodDetail = true;
    pinion.add(pinBolts);
  }

  // the phase that makes the mesh exact: a big-gear tooth sits ON the line of
  // centres at t = 0 (tooth 0 is at angle 0, so φB = 0 means the line of centres
  // must be angle 0 — instead we spin the PINION to suit), and the pinion is set
  // half a tooth off so its gap receives it
  const phaseB = THETA; // big gear turned so a tooth points at the pinion
  const phaseP = THETA + Math.PI + Math.PI / NP; // pinion turned so a gap faces back
  const RATIO = N / NP; // 2.4 exactly
  const OMEGA = (opts.spin ?? true) ? 0.135 : 0; // ~46 s per revolution

  const update = (time: number) => {
    gear.rotation.z = phaseB + OMEGA * time;
    pinion.rotation.z = phaseP - RATIO * OMEGA * time;
  };
  update(0);

  return {
    group,
    update,
    radius: R * 1.28,
    height: CY + R,
    dispose() {
      bag.texes.forEach((x) => x.dispose());
      bag.mats.forEach((m) => m.dispose());
      bag.geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
    },
  };
}

// ===========================================================================
// 2. <SteamPipes> — a tangle of riveted plumbing
// ===========================================================================
//
// "Tangle" is the whole brief, and a tangle needs THREE things a neat pipe stack
// does not: pipes at DIFFERENT DEPTHS (there is a run at ankle height crossing
// toward the viewer, which is what stops the cluster reading as a flat facade),
// real ELBOWS over the top rather than mitred butt joints (quarter tori — a pipe
// that turns a corner by intersecting another pipe reads as scaffolding), and
// FLANGED joints with rivet rings, because that is where the eye looks for
// plumbing. Then the ironmongery that says pressure: two valve bodies with
// handwheels, a drain cock, two live gauges on a bracket, and two relief vents
// that PUFF (a steady stream reads as a smoke machine; real relief valves lift,
// blow and reseat).

export interface SteamPipesOpts {
  seed?: number;
  /** the two relief-vent steam puffs (default true) */
  steam?: boolean;
  /** the gauge bracket (default true) */
  gauges?: boolean;
}

export interface SteamPipesBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  radius: number;
  height: number;
}

/** the steam-pipe cluster. Group origin on the ground; the gauges and the valve
 *  wheels face local +Z, so `rotation` aims the readable side at the path. */
export function buildSteamPipes(t: typeof THREE, opts: SteamPipesOpts = {}): SteamPipesBuilt {
  const seed = opts.seed ?? 1;
  const bag = newBag();
  const group = new t.Group();
  group.name = 'steam-pipes';

  // the PALE cast iron: pipes are round and catch the sky, and at IRON they
  // rendered as near-black tubes against the copper
  const ironMat = surface(t, bag, IRON_P, 'grime', [3, 4], { rough: 0.76, metal: 0.24, bump: 0.035 });
  const brassMat = surface(t, bag, BRASS, 'tarnish', [2, 3], { rough: 0.5, metal: 0.32, bump: 0.022 });
  const copperMat = surface(t, bag, COPPER, 'tarnish', [2, 4], { rough: 0.58, metal: 0.28, bump: 0.026 });

  // =========================================================================
  // the PLINTH: a soot-stained concrete pad with an iron kerb, on a clinker apron
  // =========================================================================
  const apron = sootApron(t, 0.5, 0.4);
  apron.position.set(0.09, 0, 0.02);
  group.add(apron);
  // GREY concrete, not brown: the first pass used IRON_D + 'concrete' at [5, 3]
  // and the pad read unmistakably as a WOODEN DECK
  group.add(box(t, [0.74, 0.06, 0.48], 0x6d675e, [0.09, 0.03, 0.02], { tex: 'concrete', repeat: [8, 5], rough: 0.96, metal: 0.08, bump: 0.05 }));
  // 'asphalt' grit, not 'metal': the metal texture's fine parallel streaks
  // stretched over a 0.78 u slab read unmistakably as DECK PLANKING
  group.add(box(t, [0.78, 0.03, 0.52], IRON, [0.09, 0.055, 0.02], { tex: 'asphalt', repeat: [4, 3], rough: 0.86, metal: 0.16 }));
  // the oil stain every pump plinth carries, and rust weeping off the kerb
  const stain = cyl(t, 1, 1, 0.006, 0x4e453c, [0.2, 0.073, 0.06], { tex: 'concrete', repeat: [3, 3], rough: 0.7, seg: 16 });
  stain.scale.set(0.11, 1, 0.08);
  stain.userData.lodDetail = true;
  group.add(stain);

  // =========================================================================
  // PIPE 1 — the MAIN iron riser: up the left, over the top on two elbows, down
  // the right into a stop valve. r 0.072, elbow bend radius 0.11.
  // =========================================================================
  const R1 = 0.072;
  const BEND = 0.11;
  const iron: PartSpec[] = [];
  iron.push(pipeRun(t, [-0.16, 0.04, -0.08], [-0.16, 0.74, -0.08], R1, 12));
  // the over-the-top elbow. An unrotated torus connects a vertical leg on its
  // RIGHT to a horizontal leg running −X; rotY π mirrors it, so the vertical leg
  // is on the left at x = C.x − BEND and the top run leaves in +X.
  iron.push({ geo: new t.TorusGeometry(BEND, R1, 7, 10, Math.PI / 2), matrix: mtx(t, [-0.05, 0.74, -0.08], [0, Math.PI, 0]), uv: [3, 2] });
  iron.push(pipeRun(t, [-0.05, 0.85, -0.08], [0.24, 0.85, -0.08], R1, 12));
  // and the elbow back down: unrotated, so the horizontal leg arrives from −X
  // and the vertical leg drops on the right at x = C.x + BEND
  iron.push({ geo: new t.TorusGeometry(BEND, R1, 7, 10, Math.PI / 2), matrix: mtx(t, [0.24, 0.74, -0.08]), uv: [3, 2] });
  iron.push(pipeRun(t, [0.35, 0.3, -0.08], [0.35, 0.74, -0.08], R1, 12));
  iron.push(pipeRun(t, [0.35, 0.04, -0.08], [0.35, 0.17, -0.08], R1, 12));
  // flanges on the riser and at the valve joints (r 0.098, 0.028 thick)
  const FLANGES: [number, number, number][] = [
    [-0.16, 0.2, -0.08],
    [-0.16, 0.6, -0.08],
    [0.35, 0.33, -0.08],
    [0.35, 0.17, -0.08],
  ];
  for (const f of FLANGES) iron.push({ geo: new t.CylinderGeometry(0.098, 0.098, 0.028, 14, 1), matrix: mtx(t, f), uv: [4, 1] });
  // the STOP VALVE body at the foot of the down-leg: an octagonal casting, a
  // bonnet and a stem up to the handwheel
  iron.push({ geo: new t.CylinderGeometry(0.095, 0.095, 0.14, 8, 1), matrix: mtx(t, [0.35, 0.24, -0.08]), uv: [3, 1] });
  iron.push({ geo: new t.CylinderGeometry(0.052, 0.062, 0.07, 8, 1), matrix: mtx(t, [0.35, 0.35, -0.08]), uv: [2, 1] });
  // the SECOND VALVE sits on the LOW CROSS RUN, in the clear foreground: a
  // standpipe off the ankle-height pipe with an octagonal body and an almost-flat
  // wheel. On the back riser (two passes) it was occluded first by the gauge
  // bracket and then by the copper line, from the default camera azimuth.
  iron.push(pipeRun(t, [0.0, 0.14, 0.19], [0.0, 0.28, 0.19], 0.034, 8));
  iron.push({ geo: new t.CylinderGeometry(0.072, 0.072, 0.1, 8, 1), matrix: mtx(t, [0.0, 0.33, 0.19]), uv: [3, 1] });
  iron.push({ geo: new t.CylinderGeometry(0.04, 0.048, 0.05, 8, 1), matrix: mtx(t, [0.0, 0.4, 0.19]), uv: [2, 1] });
  // the relief tee + stub off the top run (vent 2)
  iron.push({ geo: new t.CylinderGeometry(0.036, 0.036, 0.16, 10, 1), matrix: mtx(t, [0.1, 0.93, -0.08]), uv: [1, 2] });
  iron.push({ geo: new t.CylinderGeometry(0.06, 0.06, 0.03, 10, 1), matrix: mtx(t, [0.1, 0.86, -0.08]), uv: [2, 1] });
  // a pipe hanger strapping the riser to the plinth kerb
  iron.push({ geo: new t.BoxGeometry(0.03, 0.1, 0.2), matrix: mtx(t, [-0.16, 0.11, 0.02]), uv: [1, 1] });

  // =========================================================================
  // PIPE 3 — the LOW CROSS-CONNECTION, and the reason the cluster has depth: it
  // runs toward the viewer at ankle height, turns on a flat-plane elbow and ties
  // into the copper line's foot. r 0.038.
  // =========================================================================
  const R3 = 0.038;
  iron.push(pipeRun(t, [-0.16, 0.14, -0.08], [-0.16, 0.14, 0.12], R3, 8));
  // a HORIZONTAL-plane elbow: rotX(−π/2) drops the arc into the XZ plane, rotY π
  // then aims it so a run arriving in +Z leaves in +X (Euler order 'YXZ' applies
  // the X term first, which is what makes that composition work)
  iron.push({ geo: new t.TorusGeometry(0.07, R3, 6, 9, Math.PI / 2), matrix: mtx(t, [-0.09, 0.14, 0.12], [-Math.PI / 2, Math.PI, 0]), uv: [2, 1] });
  iron.push(pipeRun(t, [-0.09, 0.14, 0.19], [0.11, 0.14, 0.19], R3, 8));
  iron.push({ geo: new t.BoxGeometry(0.06, 0.07, 0.07), matrix: mtx(t, [0.11, 0.145, 0.18]), uv: [1, 1] }); // the tee block
  const ironMesh = mergedParts(t, iron, ironMat);
  group.add(ironMesh);
  bag.geos.push(ironMesh.geometry);

  // =========================================================================
  // PIPE 2 — the COPPER line: up the front right, over on a tight elbow, back
  // along a run carrying the first RELIEF VENT. r 0.05, weeping verdigris.
  // =========================================================================
  const R2 = 0.05;
  const copper: PartSpec[] = [];
  copper.push(pipeRun(t, [0.1, 0.04, 0.16], [0.1, 0.56, 0.16], R2, 12));
  copper.push({ geo: new t.TorusGeometry(0.08, R2, 7, 10, Math.PI / 2), matrix: mtx(t, [0.02, 0.56, 0.16]), uv: [3, 2] });
  copper.push(pipeRun(t, [0.02, 0.64, 0.16], [-0.16, 0.64, 0.16], R2, 12));
  copper.push({ geo: new t.CylinderGeometry(0.072, 0.072, 0.024, 12, 1), matrix: mtx(t, [0.1, 0.3, 0.16]), uv: [3, 1] }); // flange
  copper.push({ geo: new t.CylinderGeometry(0.072, 0.072, 0.024, 12, 1), matrix: mtx(t, [-0.16, 0.64, 0.16], [0, 0, Math.PI / 2]), uv: [3, 1] }); // blank end
  copper.push({ geo: new t.CylinderGeometry(0.034, 0.034, 0.2, 10, 1), matrix: mtx(t, [-0.04, 0.72, 0.16]), uv: [1, 2] }); // the vent riser
  const copperMesh = mergedParts(t, copper, copperMat);
  group.add(copperMesh);
  bag.geos.push(copperMesh.geometry);
  // VERDIGRIS weeping down the copper — the patina is the point of using copper
  const patina: MergedBoxSpec[] = [];
  for (let i = 0; i < 9; i += 1) {
    const a = hash01(i * 2.3 + seed) * Math.PI * 2;
    const h = 0.04 + hash01(i * 6.7 + seed) * 0.09;
    patina.push({
      dims: [0.016 + hash01(i * 3.1) * 0.012, h, 0.008],
      pos: [0.1 + Math.sin(a) * (R2 + 0.004), 0.12 + hash01(i * 4.1 + seed) * 0.38, 0.16 + Math.cos(a) * (R2 + 0.004)],
      rotY: a,
    });
  }
  for (let i = 0; i < 4; i += 1) {
    const x = -0.13 + i * 0.05;
    patina.push({ dims: [0.02, 0.03 + hash01(i * 8.3) * 0.04, 0.01], pos: [x, 0.62, 0.16 + R2 + 0.002] });
  }
  const patinaMesh = mergedBoxes(t, patina, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.88, bump: 0.025 });
  patinaMesh.userData.lodDetail = true; // patina staining: close-up only
  group.add(patinaMesh);

  // =========================================================================
  // BRASS: the relief caps, the drain cock and the bonnet gland nuts
  // =========================================================================
  const brass: PartSpec[] = [];
  brass.push({ geo: new t.CylinderGeometry(0.042, 0.054, 0.04, 10, 1), matrix: mtx(t, [-0.04, 0.845, 0.16]), uv: [2, 1] }); // vent 1 cap
  brass.push({ geo: new t.CylinderGeometry(0.028, 0.028, 0.03, 8, 1), matrix: mtx(t, [-0.04, 0.878, 0.16]), uv: [1, 1] });
  brass.push({ geo: new t.CylinderGeometry(0.014, 0.014, 0.09, 6, 1), matrix: mtx(t, [0.0, 0.855, 0.16], [0, 0, -1.1]), uv: [1, 1] }); // the easing lever
  brass.push({ geo: new t.CylinderGeometry(0.04, 0.05, 0.038, 10, 1), matrix: mtx(t, [0.1, 1.02, -0.08]), uv: [2, 1] }); // vent 2 cap
  brass.push({ geo: new t.CylinderGeometry(0.026, 0.026, 0.028, 8, 1), matrix: mtx(t, [0.1, 1.05, -0.08]), uv: [1, 1] });
  brass.push({ geo: new t.CylinderGeometry(0.014, 0.014, 0.08, 8, 1), matrix: mtx(t, [0.0, 0.43, 0.19]), uv: [1, 1] }); // the second valve's stem
  brass.push({ geo: new t.CylinderGeometry(0.03, 0.03, 0.05, 8, 1), matrix: mtx(t, [0.1, 0.115, 0.19], [0, 0, 0]), uv: [1, 1] }); // drain cock body
  brass.push({ geo: new t.CylinderGeometry(0.009, 0.009, 0.07, 6, 1), matrix: mtx(t, [0.1, 0.115, 0.23], [Math.PI / 2, 0, 0]), uv: [1, 1] }); // its lever
  brass.push({ geo: new t.CylinderGeometry(0.016, 0.016, 0.1, 8, 1), matrix: mtx(t, [0.35, 0.4, -0.08]), uv: [1, 1] }); // valve stem
  const brassMesh = mergedParts(t, brass, brassMat);
  group.add(brassMesh);
  bag.geos.push(brassMesh.geometry);

  // =========================================================================
  // RIVETS — every flange gets a ring, the plinth kerb gets two rows. ONE mesh.
  // =========================================================================
  const rivets: MergedBoxSpec[] = [];
  for (const f of FLANGES) rivets.push(...shift(rivetsAxisY(8, 0.084, 0, 0.013), f[0], f[1], f[2]));
  rivets.push(...shift(rivetsAxisY(8, 0.06, 0, 0.011), 0.1, 0.3, 0.16));
  rivets.push(...rivetRow(9, [-0.28, 0.055, 0.29], [0.46, 0.055, 0.29], 0.012));
  rivets.push(...rivetRow(9, [-0.28, 0.055, -0.25], [0.46, 0.055, -0.25], 0.012));
  const rivetMesh = mergedBoxes(t, rivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.44 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  group.add(rivetMesh);

  // =========================================================================
  // the HANDWHEELS — one on top of the stop valve (axis vertical), one on the
  // riser's side valve (axis along Z, facing the viewer)
  // =========================================================================
  const wheelTop = handWheel(t, bag, 0.092);
  wheelTop.position.set(0.35, 0.46, -0.08);
  wheelTop.rotation.x = Math.PI / 2;
  group.add(wheelTop);
  const wheelSide = handWheel(t, bag, 0.078, BRASS);
  wheelSide.position.set(0.0, 0.465, 0.19);
  // very nearly FLAT: a wheel standing dead vertical is edge-on to a ~50 degree
  // isometric view and reads as a thin brass sliver
  wheelSide.rotation.x = Math.PI / 2 - 0.25;
  group.add(wheelSide);

  // =========================================================================
  // the GAUGES — on a bolted bracket plate, facing local +Z
  // =========================================================================
  const needles: THREE.Mesh[] = [];
  if (opts.gauges ?? true) {
    group.add(box(t, [0.23, 0.15, 0.02], BRASS_D, [0.0, 0.55, -0.03], { tex: 'metal', repeat: [3, 2], metal: 0.3, rough: 0.5 }));
    const g1 = gaugeFace(t, 0.056);
    g1.group.position.set(-0.055, 0.58, 0.0);
    group.add(g1.group);
    needles.push(g1.needle);
    const g2 = gaugeFace(t, 0.042);
    g2.group.position.set(0.06, 0.52, 0.0);
    group.add(g2.group);
    needles.push(g2.needle);
    // the little copper impulse lines feeding them
    group.add(cyl(t, 0.012, 0.012, 0.12, COPPER, [-0.1, 0.5, -0.05], { tex: 'metal', repeat: [1, 2], metal: 0.26, rough: 0.6, seg: 6, rotZ: 0.5 }));
  }

  // clinker litter round the pad
  const grit = mergedParts(t, litterLumps(t, seed + 7, 12, 0.42, 0.6, 0.045, [0.09, 0, 0.02]), plain(t, bag, CINDER, { rough: 1, metal: 0.1, flat: true }));
  grit.userData.lodDetail = true;
  group.add(grit);
  bag.geos.push(grit.geometry);

  // =========================================================================
  // the STEAM — 48 particles across two vents, and they PUFF. A relief valve
  // lifts, blows and reseats; a constant plume reads as a smoke machine.
  // =========================================================================
  let vent1: ReturnType<typeof buildEmitter> | null = null;
  let vent2: ReturnType<typeof buildEmitter> | null = null;
  if (opts.steam ?? true) {
    vent1 = buildEmitter(t, {
      max: 28,
      rate: 9,
      life: 1.7,
      lifeVar: 0.45,
      velocity: [0.02, 0.52, 0.06],
      spread: 0.13,
      gravity: -0.07,
      size: 0.05,
      sizeEnd: 0.22,
      color: 0xf0ece4,
      colorEnd: 0xc4bfb7,
      opacity: 0.42,
    });
    vent1.setOrigin(-0.04, 0.9, 0.16);
    group.add(vent1.points);
    vent2 = buildEmitter(t, {
      max: 20,
      rate: 0,
      life: 1.4,
      lifeVar: 0.35,
      velocity: [0.09, 0.46, -0.04],
      spread: 0.11,
      gravity: -0.06,
      size: 0.042,
      sizeEnd: 0.17,
      color: 0xf0ece4,
      colorEnd: 0xc8c2ba,
      opacity: 0.38,
    });
    vent2.setOrigin(0.1, 1.08, -0.08);
    group.add(vent2.points);
  }

  const update = (time: number) => {
    // 1. THE VENTS. The copper line's relief valve always bleeds a little (rate
    //    9) and SURGES on its lift cycle; the top vent is the intermittent pop.
    //    The first pass gated BOTH to zero between lifts and there were frames —
    //    including the screenshot frame — with no steam anywhere on the piece,
    //    which fails the brief. Something is always blowing now.
    if (vent1) {
      const lift = Math.sin(time * 0.62 + 0.4) + 0.55 * Math.sin(time * 1.43 + 1.9);
      vent1.setRate(lift > 0.35 ? 24 : 12);
    }
    if (vent2) {
      const lift = Math.sin(time * 0.91 + 2.3) + 0.5 * Math.sin(time * 2.11);
      vent2.setRate(lift > 0.1 ? 17 : 0);
    }
    vent1?.update(time);
    vent2?.update(time);
    // 2. gauge needles: two pressures drifting at their own rates, jumping when
    //    a vent lifts (they share the same clock, so it reads as cause and effect)
    needles.forEach((n, i) => {
      n.rotation.z = -(-1.4 + 1.15 * Math.sin(time * (0.41 + i * 0.23) + i * 1.7) + 0.14 * Math.sin(time * 2.6 + i));
    });
    // 3. the handwheels: a hair of hunting on the stem, as if the valve is
    //    creeping under pressure. Nobody is turning them.
    wheelTop.rotation.z = 0.4 + 0.05 * Math.sin(time * 0.37);
    wheelSide.rotation.z = -0.2 + 0.035 * Math.sin(time * 0.29 + 1.4);
  };
  update(0);

  return {
    group,
    update,
    radius: 0.46,
    height: 1.08,
    dispose() {
      vent1?.dispose();
      vent2?.dispose();
      bag.texes.forEach((x) => x.dispose());
      bag.mats.forEach((m) => m.dispose());
      bag.geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
    },
  };
}

// ===========================================================================
// 3. <ClockTower> — a riveted brass-and-iron tower with four working faces
// ===========================================================================
//
// A clock tower lives or dies on whether you can READ THE TIME at park zoom, and
// that is a contrast problem, not a detail problem: a pale enamel dial with
// NEAR-BLACK hands and dark brass numerals reads from across a tile, while brass
// hands on a brass dial are invisible at any resolution. So the dial is the
// palest surface in the world (0xe8e0cc), the hands are soot, and the numerals
// are brassDark — and after dark the dial goes EMISSIVE (gas-lit dials are
// historically right) so the hands silhouette against it.
//
// All four faces show the same time off ONE absolute-time clock. The minute hand
// takes 150 s to go round and the hour hand 12× that, starting at 10:10 — the
// classic display time, which keeps the hands apart and off the numerals.
//
// The tower is SLENDER on purpose (an octagonal shaft 0.29 across under a 2.42 u
// total height): a park needs a vertical marker, and a fat tower at this height
// reads as a chimney. The 96-rivet seam grid up the eight corners is what makes
// it plate iron rather than a painted post.

export interface ClockTowerOpts {
  seed?: number;
  /** the belfry bell and its hourly swing (default true) */
  bell?: boolean;
  /** the night-gated dial gaslight + bracket lantern (default true) */
  light?: boolean;
  /** seconds per revolution of the MINUTE hand (default 150) */
  minutePeriod?: number;
}

export interface ClockTowerBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  radius: number;
  height: number;
}

/** the brass clock tower. Group origin on the ground at the shaft centre; a clock
 *  face looks down each of the four local axes. */
export function buildClockTower(t: typeof THREE, opts: ClockTowerOpts = {}): ClockTowerBuilt {
  const seed = opts.seed ?? 1;
  const MINP = opts.minutePeriod ?? 150;
  const bag = newBag();
  const group = new t.Group();
  group.name = 'clock-tower';

  const ironMat = surface(t, bag, IRON, 'grime', [4, 8], { rough: 0.78, metal: 0.22, bump: 0.04 });
  const brassMat = surface(t, bag, BRASS, 'tarnish', [3, 2], { rough: 0.48, metal: 0.32, bump: 0.022 });
  // the spire's copper is AGED a shade browner-greener than the world's copper:
  // at full COPPER the cap read as a terracotta tile roof
  const copperMat = surface(t, bag, 0x7e5a3e, 'tarnish', [3, 3], { rough: 0.62, metal: 0.24, bump: 0.03 });
  const dialMat = plain(t, bag, DIAL, { rough: 0.76, metal: 0.04 });
  const handMat = plain(t, bag, 0x231e1a, { rough: 0.64, metal: 0.18 });

  // =========================================================================
  // PLINTH + SHAFT — an octagonal tapered column, r 0.145 → 0.105 over 1.19
  // =========================================================================
  const SH_Y0 = 0.13;
  const SH_H = 1.19;
  const SH_R0 = 0.132;
  const SH_R1 = 0.096;
  const rAt = (y: number) => SH_R0 + ((SH_R1 - SH_R0) * (y - SH_Y0)) / SH_H;

  group.add(sootApron(t, 0.36, 0.36));
  const iron: PartSpec[] = [];
  iron.push({ geo: new t.BoxGeometry(0.46, 0.07, 0.46), matrix: mtx(t, [0, 0.035, 0]), uv: [3, 1] });
  iron.push({ geo: new t.BoxGeometry(0.38, 0.06, 0.38), matrix: mtx(t, [0, 0.1, 0]), uv: [3, 1] });
  iron.push({ geo: new t.CylinderGeometry(SH_R1, SH_R0, SH_H, 8, 1), matrix: mtx(t, [0, SH_Y0 + SH_H / 2, 0]), uv: [4, 9] });
  // cornice: a chamfer ring and a square cap slab on four corbels
  iron.push({ geo: new t.CylinderGeometry(0.2, 0.13, 0.05, 8, 1), matrix: mtx(t, [0, 1.3, 0]), uv: [4, 1] });
  iron.push({ geo: new t.BoxGeometry(0.47, 0.045, 0.47), matrix: mtx(t, [0, 1.348, 0]), uv: [3, 1] });
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    iron.push({ geo: new t.BoxGeometry(0.055, 0.1, 0.11), matrix: mtx(t, [Math.sin(a) * 0.155, 1.27, Math.cos(a) * 0.155], [0, a, 0]), uv: [1, 1] });
  }
  // the CLOCK STAGE and its floor
  iron.push({ geo: new t.BoxGeometry(0.4, 0.36, 0.4), matrix: mtx(t, [0, 1.55, 0]), uv: [3, 3] });
  iron.push({ geo: new t.BoxGeometry(0.42, 0.04, 0.42), matrix: mtx(t, [0, 1.75, 0]), uv: [3, 1] });
  iron.push({ geo: new t.BoxGeometry(0.33, 0.03, 0.33), matrix: mtx(t, [0, 1.785, 0]), uv: [2, 1] });
  const ironMesh = mergedParts(t, iron, ironMat);
  group.add(ironMesh);
  bag.geos.push(ironMesh.geometry);

  // =========================================================================
  // BRASS: strapping bands, the belfry posts, the conduit, the finial
  // =========================================================================
  const brass: PartSpec[] = [];
  const iron2: PartSpec[] = []; // the belfry louvres — dark, so the bell reads
  for (const y of [0.36, 0.74, 1.12]) {
    brass.push({ geo: new t.CylinderGeometry(rAt(y) + 0.014, rAt(y) + 0.014, 0.038, 8, 1), matrix: mtx(t, [0, y, 0]), uv: [4, 1] });
  }
  // the conduit running up the front face (a park clock needs a gas line), clipped
  brass.push({ geo: new t.CylinderGeometry(0.016, 0.016, 1.16, 6, 1), matrix: mtx(t, [0, 0.72, 0.154]), uv: [1, 6] });
  for (const y of [0.28, 0.62, 0.98, 1.24]) brass.push({ geo: new t.BoxGeometry(0.05, 0.022, 0.03), matrix: mtx(t, [0, y, 0.15]), uv: [1, 1] });
  // belfry corner posts + headstock beam
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      brass.push({ geo: new t.CylinderGeometry(0.024, 0.026, 0.31, 8, 1), matrix: mtx(t, [sx * 0.135, 1.955, sz * 0.135]), uv: [1, 2] });
    }
  }
  for (let k = 0; k < 3; k += 1) {
    const y = 1.87 + k * 0.075;
    iron2.push({ geo: new t.BoxGeometry(0.25, 0.022, 0.016), matrix: mtx(t, [0, y, -0.126], [0.3, 0, 0]), uv: [2, 1] });
    iron2.push({ geo: new t.BoxGeometry(0.016, 0.022, 0.25), matrix: mtx(t, [-0.126, y, 0], [0, 0, 0.3]), uv: [2, 1] });
  }
  brass.push({ geo: new t.BoxGeometry(0.32, 0.04, 0.055), matrix: mtx(t, [0, 2.09, 0]), uv: [3, 1] });
  brass.push({ geo: new t.BoxGeometry(0.055, 0.04, 0.32), matrix: mtx(t, [0, 2.09, 0]), uv: [3, 1] });
  // the finial: a ball, a spike and a weather vane
  brass.push({ geo: new t.IcosahedronGeometry(0.04, 2), matrix: mtx(t, [0, 2.5, 0]), uv: [1, 1] });
  brass.push({ geo: new t.CylinderGeometry(0.009, 0.009, 0.1, 6, 1), matrix: mtx(t, [0, 2.57, 0]), uv: [1, 1] });
  brass.push({ geo: new t.BoxGeometry(0.13, 0.014, 0.018), matrix: mtx(t, [0.02, 2.61, 0]), uv: [1, 1] });
  brass.push({ geo: new t.BoxGeometry(0.035, 0.05, 0.012), matrix: mtx(t, [-0.055, 2.61, 0]), uv: [1, 1] });
  const brassMesh = mergedParts(t, brass, brassMat);
  group.add(brassMesh);
  bag.geos.push(brassMesh.geometry);
  const louvreMesh = mergedParts(t, iron2, surface(t, bag, IRON_D, 'grime', [2, 1], { rough: 0.86, metal: 0.2, bump: 0.02 }));
  group.add(louvreMesh);
  bag.geos.push(louvreMesh.geometry);

  // =========================================================================
  // the COPPER SPIRE — an octagonal cap over the belfry, weeping verdigris
  // =========================================================================
  const copper: PartSpec[] = [];
  // NARROW eaves and a STEEP spire. The first pass ran 0.38 eaves over a 0.13
  // shaft: it read as a mushroom cap and its overhang hid the belfry bell
  // completely at the isometric camera elevation.
  // the eaves overhang the belfry posts by only 0.075: at a ~50 degree camera
  // elevation an overhang hides everything within 1.2x itself BELOW it, and the
  // first pass (0.38 eaves over posts at 0.135) hid the entire bell
  copper.push({ geo: new t.CylinderGeometry(0.21, 0.23, 0.03, 8, 1), matrix: mtx(t, [0, 2.13, 0]), uv: [5, 1] }); // eaves
  copper.push({ geo: new t.CylinderGeometry(0.018, 0.2, 0.34, 8, 1), matrix: mtx(t, [0, 2.31, 0]), uv: [5, 4] }); // the spire
  const copperMesh = mergedParts(t, copper, copperMat);
  group.add(copperMesh);
  bag.geos.push(copperMesh.geometry);
  // verdigris streaking DOWN the spire's slope: the box's +z is laid onto the
  // slope normal by rotX(−0.75), then spun round the cap by rotY
  // KEPT SMALL, DARK and ON the surface: at radius r the OCTAGON's flat faces
  // are inset by cos(22.5°) = 0.924, so streaks placed at the circumscribed
  // radius float clear of the metal — which is exactly how the first pass read,
  // as scattered turquoise dashes hovering over the cap.
  const patina: MergedBoxSpec[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = hash01(i * 3.3 + seed) * Math.PI * 2;
    const f = 0.12 + hash01(i * 5.9 + seed) * 0.62;
    const r = (0.2 - 0.182 * f) * 0.93;
    patina.push({
      dims: [0.014 + hash01(i * 7.1) * 0.012, 0.04 + hash01(i * 9.3) * 0.06, 0.006],
      pos: [Math.sin(a) * r, 2.15 + 0.34 * f, Math.cos(a) * r],
      rotX: -0.62,
      rotY: a,
    });
  }
  const patinaMesh = mergedBoxes(t, patina, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.88, bump: 0.025 });
  patinaMesh.userData.lodDetail = true; // patina wash: close-up only
  group.add(patinaMesh);

  // =========================================================================
  // THE FOUR CLOCK FACES — dials, bezels and numerals go into ONE merged mesh
  // EACH (four faces, one draw call apiece) by composing the face transform with
  // the local one; only the eight HANDS need to be separate meshes.
  // =========================================================================
  const dialParts: PartSpec[] = [];
  const bezelParts: PartSpec[] = [];
  const numerals: MergedBoxSpec[] = [];
  const hands: { hour: THREE.Mesh; minute: THREE.Mesh }[] = [];
  const DIAL_R = 0.145;
  for (let f = 0; f < 4; f += 1) {
    const yaw = (f / 4) * Math.PI * 2;
    const faceM = mtx(t, [Math.sin(yaw) * 0.201, 1.55, Math.cos(yaw) * 0.201], [0, yaw, 0]);
    dialParts.push({ geo: new t.CylinderGeometry(DIAL_R, DIAL_R, 0.018, 20, 1), matrix: faceM.clone().multiply(mtx(t, [0, 0, 0.008], [Math.PI / 2, 0, 0])), uv: [1, 1] });
    bezelParts.push({ geo: new t.TorusGeometry(DIAL_R + 0.012, 0.016, 6, 22), matrix: faceM.clone().multiply(mtx(t, [0, 0, 0.014])), uv: [6, 1] });
    // 12 numerals: a long bar at each quarter, a short one between
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      const quarter = k % 3 === 0;
      const len = quarter ? 0.05 : 0.028;
      const wid = quarter ? 0.019 : 0.012;
      numerals.push({
        dims: [wid, len, 0.008],
        matrix: faceM
          .clone()
          .multiply(mtx(t, [Math.sin(a) * (DIAL_R - 0.036), Math.cos(a) * (DIAL_R - 0.036), 0.019], [0, 0, -a])),
      });
    }
    // the two hands, in the face's own frame (local +y is 12 o'clock, so a
    // clockwise reading is a NEGATIVE rotation.z on every face alike)
    const faceG = new t.Group();
    faceG.position.set(Math.sin(yaw) * 0.201, 1.55, Math.cos(yaw) * 0.201);
    faceG.rotation.y = yaw;
    group.add(faceG);
    const hourGeo = new t.BoxGeometry(0.021, 0.082, 0.009);
    hourGeo.translate(0, 0.03, 0);
    const hour = new t.Mesh(hourGeo, handMat);
    hour.position.set(0, 0, 0.026);
    hour.castShadow = true;
    faceG.add(hour);
    bag.geos.push(hourGeo);
    const minGeo = new t.BoxGeometry(0.014, 0.124, 0.009);
    minGeo.translate(0, 0.048, 0);
    const minute = new t.Mesh(minGeo, handMat);
    minute.position.set(0, 0, 0.033);
    minute.castShadow = true;
    faceG.add(minute);
    bag.geos.push(minGeo);
    hands.push({ hour, minute });
    // centre boss + a keystone plate over the dial
    faceG.add(cyl(t, 0.017, 0.017, 0.014, BRASS_L, [0, 0, 0.038], { metal: 0.32, rough: 0.34, seg: 10, rotX: Math.PI / 2 }));
    faceG.add(box(t, [0.07, 0.045, 0.014], BRASS_D, [0, 0.178, 0.006], { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.48 }));
  }
  const dialMesh = mergedParts(t, dialParts, dialMat);
  group.add(dialMesh);
  bag.geos.push(dialMesh.geometry);
  const bezelMesh = mergedParts(t, bezelParts, brassMat);
  group.add(bezelMesh);
  bag.geos.push(bezelMesh.geometry);
  const numeralMesh = mergedBoxes(t, numerals, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.46 });
  group.add(numeralMesh); // NOT lodDetail: the numerals ARE the read at park zoom

  // =========================================================================
  // RIVETS — 8 seam columns up the shaft (12 rows), the plinth edges and the
  // clock-stage corners. ONE mesh, ~120 heads.
  // =========================================================================
  const rivets: MergedBoxSpec[] = [];
  for (let r = 0; r < 12; r += 1) {
    const y = 0.2 + r * 0.095;
    rivets.push(...rivetsAxisY(8, rAt(y) + 0.005, y, 0.012));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rivets.push({ dims: [0.026, 0.018, 0.026], pos: [sx * 0.15, 0.075, sz * 0.15] });
  for (let f = 0; f < 4; f += 1) {
    const yaw = (f / 4) * Math.PI * 2;
    const nx = Math.sin(yaw);
    const nz = Math.cos(yaw);
    rivets.push(...rivetRow(4, [nx * 0.201 - nz * 0.15, 1.4, nz * 0.201 + nx * 0.15], [nx * 0.201 + nz * 0.15, 1.4, nz * 0.201 - nx * 0.15], 0.012, [0, yaw, 0]));
  }
  const rivetMesh = mergedBoxes(t, rivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.46 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  group.add(rivetMesh);

  // a soot wash creeping up the shaft off the yard, and an engraved maker's plate
  const soot: MergedBoxSpec[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = hash01(i * 4.7 + seed) * Math.PI * 2;
    const h = 0.08 + hash01(i * 6.1) * 0.16;
    soot.push({ dims: [0.05, h, 0.008], pos: [Math.sin(a) * (SH_R0 + 0.004), 0.16 + h * 0.4, Math.cos(a) * (SH_R0 + 0.004)], rotY: a });
  }
  const sootMesh = mergedBoxes(t, soot, SOOT, { tex: 'concrete', repeat: [1, 1], rough: 0.95, bump: 0.02 });
  sootMesh.userData.lodDetail = true;
  group.add(sootMesh);
  const plate = new t.Group();
  plate.position.set(0, 0.56, 0.15);
  plate.add(box(t, [0.14, 0.07, 0.014], BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.3, rough: 0.48 }));
  const engrave = mergedBoxes(
    t,
    [
      { dims: [0.1, 0.012, 0.006], pos: [0, 0.016, 0.009] },
      { dims: [0.07, 0.009, 0.006], pos: [-0.012, -0.004, 0.009] },
      { dims: [0.05, 0.008, 0.006], pos: [-0.022, -0.02, 0.009] },
    ],
    BRASS_L,
    { tex: 'metal', repeat: [1, 1], metal: 0.32, rough: 0.34 },
  );
  engrave.userData.lodDetail = true; // engraved lettering: close-up only
  plate.add(engrave);
  group.add(plate);

  // =========================================================================
  // the BELL — hung from the headstock, swinging on the hour
  // =========================================================================
  const bell = new t.Group();
  bell.position.set(0, 2.07, 0);
  if (opts.bell ?? true) {
    group.add(bell);
    const bellMat = surface(t, bag, BRASS_L, 'tarnish', [3, 2], { rough: 0.42, metal: 0.33, bump: 0.02 });
    const bp: PartSpec[] = [];
    bp.push({ geo: new t.CylinderGeometry(0.042, 0.086, 0.105, 14, 1), matrix: mtx(t, [0, -0.092, 0]), uv: [3, 1] }); // the waist
    bp.push({ geo: new t.TorusGeometry(0.086, 0.012, 5, 16), matrix: mtx(t, [0, -0.142, 0], [Math.PI / 2, 0, 0]), uv: [5, 1] }); // the lip
    const crown = new t.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    bp.push({ geo: crown, matrix: mtx(t, [0, -0.038, 0], [0, 0, 0], [1, 0.7, 1]), uv: [2, 1] });
    bp.push({ geo: new t.TorusGeometry(0.016, 0.006, 4, 10), matrix: mtx(t, [0, -0.008, 0], [0, Math.PI / 2, 0]), uv: [1, 1] }); // the crown loop
    const bellMesh = mergedParts(t, bp, bellMat);
    bell.add(bellMesh);
    bag.geos.push(bellMesh.geometry);
    // the clapper, on its own short stalk
    bell.add(cyl(t, 0.005, 0.005, 0.065, IRON_D, [0, -0.065, 0], { metal: 0.24, rough: 0.7, seg: 6 }));
    bell.add(ball(t, 0.018, IRON_D, [0, -0.108, 0], { metal: 0.26, rough: 0.6 }));
  }

  // =========================================================================
  // LIGHTS — two, both night-gated: the dial gaslight washing the cornice from
  // under the clock stage, and a bracket lantern on the shaft. (No light lives
  // INSIDE the clock stage: a PointLight in a closed box lights nothing.)
  // =========================================================================
  const lampMat = new t.MeshStandardMaterial({ color: BRASSWORK.lampGlass, emissive: BRASSWORK.lampGlow, emissiveIntensity: 0.12, roughness: 0.3 });
  bag.mats.push(lampMat);
  const lantern = new t.Group();
  lantern.position.set(0, 0.92, 0.14);
  group.add(lantern);
  lantern.add(cyl(t, 0.011, 0.013, 0.13, BRASS, [0.0, 0.05, 0.05], { metal: 0.3, rough: 0.44, seg: 8, rotX: -0.8 })); // the bracket arm
  lantern.add(cyl(t, 0.034, 0.042, 0.022, BRASS_D, [0, 0.1, 0.13], { tex: 'metal', repeat: [2, 1], metal: 0.28, rough: 0.48, seg: 10 })); // cap
  const flame = new t.Mesh(new t.SphereGeometry(0.028, 10, 8), lampMat);
  flame.position.set(0, 0.055, 0.13);
  lantern.add(flame);
  bag.geos.push(flame.geometry);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      lantern.add(cyl(t, 0.005, 0.005, 0.096, BRASS, [sx * 0.026, 0.055, 0.13 + sz * 0.026], { metal: 0.3, rough: 0.4, seg: 6 }));
    }
  }
  lantern.add(cyl(t, 0.038, 0.03, 0.016, BRASS_D, [0, 0.005, 0.13], { tex: 'metal', repeat: [2, 1], metal: 0.28, rough: 0.48, seg: 10 }));
  const wantLight = opts.light ?? true;
  const dialLight = new t.PointLight(0xffc98a, 0, 2.4, 2);
  dialLight.position.set(0, 1.31, 0);
  const lampLight = new t.PointLight(BRASSWORK.lampGlow, 0, 2.2, 2);
  lampLight.position.set(0, 0.98, 0.2);
  if (wantLight) {
    group.add(dialLight);
    group.add(lampLight);
  }

  const update = (time: number) => {
    const nk = nightKOf(group);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    // 1. THE CLOCK. One absolute-time reading feeds all four faces; 10:10 at t 0.
    const minTurns = 10 / 60 + time / MINP;
    const hourTurns = 10.16667 / 12 + time / (MINP * 12);
    const minA = -minTurns * Math.PI * 2;
    const hourA = -hourTurns * Math.PI * 2;
    hands.forEach((h) => {
      h.minute.rotation.z = minA;
      h.hour.rotation.z = hourA;
    });
    // 2. the dial goes gas-lit after dark; the hands stay soot, so they read as
    //    silhouettes against it (day: a plain enamel face, no glow at all)
    dialMat.emissive.setHex(0xffd9a0);
    dialMat.emissiveIntensity = 0.55 * ease;
    lampMat.emissiveIntensity = 0.2 + (1.25 + 0.08 * Math.sin(time * 2.9) - 0.2) * ease;
    dialLight.intensity = ease * 0.38;
    lampLight.intensity = ease * 0.62;
    // 3. THE BELL rings on the hour: a 48 s cycle with a 6 s strike, then it
    //    hangs almost still (an always-swinging bell reads as a toy)
    const cyc = time / 48 - Math.floor(time / 48);
    const strike = cyc < 0.125 ? Math.exp(-cyc * 26) : 0;
    bell.rotation.x = 0.012 * Math.sin(time * 0.7) + strike * 0.34 * Math.sin(time * 7.4);
  };
  update(0);

  return {
    group,
    update,
    radius: 0.32,
    height: 2.63,
    dispose() {
      dialLight.dispose();
      lampLight.dispose();
      bag.texes.forEach((x) => x.dispose());
      bag.mats.forEach((m) => m.dispose());
      bag.geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
    },
  };
}

// ===========================================================================
// 4. <BoilerTank> — a horizontal riveted boiler set in brick
// ===========================================================================
//
// The read is RIVETED PRESSURE VESSEL, and it comes from four things in this
// order: the CIRCUMFERENTIAL SEAMS with their rivet rings (a smooth cylinder is a
// water tank; the seams are what make it a boiler), the FIREBOX under the barrel
// with a glowing door — a boiler needs a fire or it is a barrel on legs — the
// CHIMNEY, and the ironmongery on top (safety valve with its weight lever,
// manhole cover, gauge glass, pressure gauge).
//
// It is SET IN BRICK rather than standing on two cradles, which is what a
// stationary boiler actually did: the brick setting carries the firebox half and a
// single iron cradle carries the smokebox end. 108 rivets in one merged mesh.

export interface BoilerTankOpts {
  /** barrel length (default 1.0) */
  length?: number;
  /** barrel radius (default 0.26) */
  radius?: number;
  seed?: number;
  /** the chimney smoke (default true) */
  smoke?: boolean;
  /** the night-gated firebox PointLight (default true — the emissive glow is
   *  always there, this is only the light it casts) */
  light?: boolean;
}

export interface BoilerTankBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** overall barrel length, for the blocker rect */
  length: number;
  halfWidth: number;
  height: number;
}

/** the boiler. Group origin on the ground at the barrel's centre; the barrel runs
 *  along local X, the gauge glass and pressure gauge face local +Z, and the
 *  FIREBOX DOOR is on the −X end. */
export function buildBoilerTank(t: typeof THREE, opts: BoilerTankOpts = {}): BoilerTankBuilt {
  const L = opts.length ?? 1.0;
  const R = opts.radius ?? 0.26;
  const seed = opts.seed ?? 1;
  const bag = newBag();
  const group = new t.Group();
  group.name = 'boiler-tank';

  const CY = 0.44; // barrel centre height
  // repeat [4, 2] over a 1.0 × 0.52 barrel ≈ one tile per 0.25 u. The first pass
  // ran [8, 3] and the high-frequency blotching read as PINECONE SCALES.
  const ironMat = surface(t, bag, IRON_P, 'grime', [4, 2], { rough: 0.8, metal: 0.24, bump: 0.035 });
  const brickMat = surface(t, bag, FIREBRICK, 'grime', [4, 2], { rough: 0.98, metal: 0.06, bump: 0.06 });
  const brassMat = surface(t, bag, BRASS, 'tarnish', [3, 2], { rough: 0.48, metal: 0.32, bump: 0.022 });
  const copperMat = surface(t, bag, COPPER, 'tarnish', [2, 3], { rough: 0.58, metal: 0.28, bump: 0.026 });
  const fireMat = new t.MeshStandardMaterial({ color: 0x3a1a0c, emissive: BRASSWORK.fireDeep, emissiveIntensity: 0.45, roughness: 0.85 });
  bag.mats.push(fireMat);

  group.add(sootApron(t, L * 0.72, R * 1.85));

  // =========================================================================
  // the BRICK SETTING — the firebox half of the boiler sits IN brickwork
  // =========================================================================
  const brick: PartSpec[] = [];
  brick.push({ geo: new t.BoxGeometry(L * 0.62, 0.24, R * 1.78), matrix: mtx(t, [-L * 0.19, 0.12, 0]), uv: [4, 2] });
  brick.push({ geo: new t.BoxGeometry(L * 0.66, 0.04, R * 1.9), matrix: mtx(t, [-L * 0.19, 0.25, 0]), uv: [4, 1] }); // the sooted top course
  brick.push({ geo: new t.BoxGeometry(L * 0.1, 0.08, R * 1.5), matrix: mtx(t, [-L * 0.5 - 0.02, 0.06, 0]), uv: [1, 1] }); // the ash-pit lip
  const brickMesh = mergedParts(t, brick, brickMat);
  group.add(brickMesh);
  bag.geos.push(brickMesh.geometry);

  // =========================================================================
  // the BARREL, the end plates, the seam bands, the cradle and the chimney —
  // ONE merged iron mesh
  // =========================================================================
  const iron: PartSpec[] = [];
  iron.push({ geo: new t.CylinderGeometry(R, R, L, 20, 1), matrix: mtx(t, [0, CY, 0], [0, 0, Math.PI / 2]), uv: [3, 7] });
  // the END PLATES and the three CIRCUMFERENTIAL SEAM BANDS live in their OWN
  // DARKER material (the chimney comes through at +0.28, so the bands dodge it).
  // Merged into the barrel's own pale iron they were invisible, and the seams are
  // the first thing that makes a cylinder read as a boiler.
  const strap: PartSpec[] = [];
  for (const sx of [-1, 1]) {
    strap.push({ geo: new t.CylinderGeometry(R * 1.03, R * 1.03, 0.034, 20, 1), matrix: mtx(t, [(sx * L) / 2, CY, 0], [0, 0, Math.PI / 2]), uv: [5, 1] });
  }
  const BANDS = [-L * 0.36, -L * 0.06, L * 0.16];
  for (const x of BANDS) strap.push({ geo: new t.CylinderGeometry(R * 1.055, R * 1.055, 0.04, 20, 1), matrix: mtx(t, [x, CY, 0], [0, 0, Math.PI / 2]), uv: [5, 1] });
  // the LONGITUDINAL LAP SEAM, laid on the barrel at φ = 40° on the +z side. A
  // box rotated about X by −(π/2 − φ) puts its local +y on the radial.
  const PHI = 0.7;
  const lapTilt = -(Math.PI / 2 - PHI);
  iron.push({
    geo: new t.BoxGeometry(L * 0.98, 0.014, 0.055),
    matrix: mtx(t, [0, CY + R * Math.sin(PHI), R * Math.cos(PHI)], [lapTilt, 0, 0]),
    uv: [8, 1],
  });
  // the CRADLE under the smokebox end: pad, stool and three saddle blocks
  iron.push({ geo: new t.BoxGeometry(0.2, 0.05, R * 2.0), matrix: mtx(t, [L * 0.34, 0.025, 0]), uv: [2, 2] });
  iron.push({ geo: new t.BoxGeometry(0.15, 0.16, R * 1.5), matrix: mtx(t, [L * 0.34, 0.12, 0]), uv: [2, 2] });
  for (const a of [-1.05, 0, 1.05]) {
    iron.push({
      geo: new t.BoxGeometry(0.14, 0.05, 0.13),
      matrix: mtx(t, [L * 0.34, CY - Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02)], [a, 0, 0]),
      uv: [1, 1],
    });
  }
  // the CHIMNEY
  iron.push({ geo: new t.CylinderGeometry(0.055, 0.064, 0.52, 12, 1), matrix: mtx(t, [L * 0.28, 0.88, 0]), uv: [2, 5] });
  iron.push({ geo: new t.CylinderGeometry(0.078, 0.072, 0.035, 12, 1), matrix: mtx(t, [L * 0.28, 1.15, 0]), uv: [3, 1] }); // the soot lip
  // the FIREBOX DOOR on the −X end: a round cast door, hinge and dog latch
  iron.push({ geo: new t.CylinderGeometry(0.108, 0.108, 0.03, 14, 1), matrix: mtx(t, [-L * 0.5 - 0.03, 0.13, 0], [0, 0, Math.PI / 2]), uv: [3, 1] });
  iron.push({ geo: new t.BoxGeometry(0.03, 0.06, 0.03), matrix: mtx(t, [-L * 0.5 - 0.03, 0.13, -0.1]), uv: [1, 1] }); // hinge
  const ironMesh = mergedParts(t, iron, ironMat);
  group.add(ironMesh);
  bag.geos.push(ironMesh.geometry);
  const strapMesh = mergedParts(t, strap, surface(t, bag, IRON, 'grime', [5, 1], { rough: 0.82, metal: 0.22, bump: 0.03 }));
  group.add(strapMesh);
  bag.geos.push(strapMesh.geometry);

  // =========================================================================
  // the FIRE — an emissive gap round the door and a glowing ash slot below it.
  // The door glow is NOT gated to zero by day (a lit fire is lit — Emberfall's
  // rule); only its PointLight is night-weighted.
  // =========================================================================
  const fireParts: PartSpec[] = [];
  fireParts.push({ geo: new t.TorusGeometry(0.112, 0.012, 5, 16), matrix: mtx(t, [-L * 0.5 - 0.022, 0.13, 0], [0, Math.PI / 2, 0]) });
  fireParts.push({ geo: new t.BoxGeometry(0.02, 0.035, 0.18), matrix: mtx(t, [-L * 0.5 - 0.03, 0.055, 0]) });
  const fireMesh = mergedParts(t, fireParts, fireMat);
  group.add(fireMesh);
  bag.geos.push(fireMesh.geometry);
  const fireLight = new t.PointLight(BRASSWORK.fireHot, 0, 1.9, 2);
  fireLight.position.set(-L * 0.5 - 0.16, 0.16, 0);
  if (opts.light ?? true) group.add(fireLight);

  // =========================================================================
  // BRASS: safety valve + weight lever, manhole cover, gauge-glass fittings,
  // the door's dog handle
  // =========================================================================
  const brass: PartSpec[] = [];
  brass.push({ geo: new t.CylinderGeometry(0.042, 0.05, 0.07, 10, 1), matrix: mtx(t, [-L * 0.1, CY + R + 0.03, 0]), uv: [2, 1] }); // safety-valve body
  brass.push({ geo: new t.BoxGeometry(0.24, 0.018, 0.026), matrix: mtx(t, [-L * 0.1 + 0.09, CY + R + 0.08, 0], [0, 0, 0.1]), uv: [3, 1] }); // the lever
  brass.push({ geo: new t.CylinderGeometry(0.034, 0.034, 0.048, 10, 1), matrix: mtx(t, [-L * 0.1 + 0.2, CY + R + 0.07, 0]), uv: [2, 1] }); // the weight
  brass.push({ geo: new t.CylinderGeometry(0.086, 0.086, 0.024, 14, 1), matrix: mtx(t, [L * 0.06, CY + R + 0.008, 0], [0, 0, 0], [1, 1, 0.72]), uv: [3, 1] }); // manhole
  brass.push({ geo: new t.CylinderGeometry(0.09, 0.078, 0.036, 12, 1), matrix: mtx(t, [L * 0.28, CY + R + 0.02, 0]), uv: [3, 1] }); // chimney collar
  brass.push({ geo: new t.CylinderGeometry(0.016, 0.016, 0.09, 6, 1), matrix: mtx(t, [-L * 0.5 - 0.06, 0.13, 0.05], [0, 0, Math.PI / 2]), uv: [1, 1] }); // dog handle
  brass.push({ geo: new t.BoxGeometry(0.022, 0.075, 0.022), matrix: mtx(t, [-L * 0.5 - 0.06, 0.13, 0], [0, 0, 0.5]), uv: [1, 1] }); // its dog
  // the GAUGE GLASS: two brass cocks on a stand-off bracket, on the +Z flank
  const GX = -L * 0.28;
  brass.push({ geo: new t.BoxGeometry(0.05, 0.19, 0.028), matrix: mtx(t, [GX, 0.56, R * 0.86], [0.3, 0, 0]), uv: [1, 2] }); // the bracket
  for (const y of [0.49, 0.63]) {
    brass.push({ geo: new t.CylinderGeometry(0.019, 0.019, 0.05, 8, 1), matrix: mtx(t, [GX, y, R * 0.98], [Math.PI / 2, 0, 0]), uv: [1, 1] });
    brass.push({ geo: new t.CylinderGeometry(0.008, 0.008, 0.05, 6, 1), matrix: mtx(t, [GX + 0.035, y, R * 0.98], [0, 0, Math.PI / 2]), uv: [1, 1] }); // the cock handle
  }
  const brassMesh = mergedParts(t, brass, brassMat);
  group.add(brassMesh);
  bag.geos.push(brassMesh.geometry);
  // the glass tube itself, with the water level showing dark in the bottom half
  group.add(cyl(t, 0.011, 0.011, 0.1, GLASS, [GX, 0.56, R * 0.98 + 0.012], { rough: 0.14, metal: 0.1, seg: 8 }));
  group.add(cyl(t, 0.0125, 0.0125, 0.042, 0x2c4a50, [GX, 0.535, R * 0.98 + 0.012], { rough: 0.2, metal: 0.1, seg: 8 }));
  // the pressure gauge on its brass elbow
  const g1 = gaugeFace(t, 0.056);
  g1.group.position.set(-L * 0.1, 0.62, R * 0.86);
  group.add(g1.group);
  group.add(cyl(t, 0.013, 0.013, 0.1, COPPER, [-L * 0.1, 0.56, R * 0.72], { tex: 'metal', repeat: [1, 2], metal: 0.26, rough: 0.6, seg: 6, rotX: 0.6 }));

  // the COPPER FEED PIPE climbing into the smokebox end
  const copper: PartSpec[] = [];
  copper.push(pipeRun(t, [L * 0.46, 0.02, R * 0.8], [L * 0.46, 0.42, R * 0.8], 0.026, 8));
  copper.push({ geo: new t.TorusGeometry(0.07, 0.026, 6, 9, Math.PI / 2), matrix: mtx(t, [L * 0.46, 0.42, R * 0.8 - 0.07], [-Math.PI / 2, Math.PI / 2, 0]), uv: [2, 1] });
  copper.push(pipeRun(t, [L * 0.46, 0.49, R * 0.73], [L * 0.46, 0.49, R * 0.4], 0.026, 8));
  copper.push({ geo: new t.CylinderGeometry(0.042, 0.042, 0.022, 10, 1), matrix: mtx(t, [L * 0.46, 0.49, R * 0.42], [Math.PI / 2, 0, 0]), uv: [2, 1] });
  const copperMesh = mergedParts(t, copper, copperMat);
  group.add(copperMesh);
  bag.geos.push(copperMesh.geometry);

  // =========================================================================
  // RIVETS — a ring on each end plate, a ring on each seam band, a row down the
  // longitudinal lap, and the manhole bolts. ONE mesh, 130 heads.
  // =========================================================================
  const rivets: MergedBoxSpec[] = [];
  for (const sx of [-1, 1]) rivets.push(...rivetsAxisX(22, R * 0.86, (sx * L) / 2 + sx * 0.022, 0.016));
  for (const x of BANDS) rivets.push(...rivetsAxisX(20, R * 1.072, x, 0.016));
  for (let i = 0; i < 15; i += 1) {
    const x = -L * 0.46 + (i / 14) * L * 0.92;
    rivets.push({ dims: [0.013, 0.013, 0.013], pos: [x, CY + (R + 0.01) * Math.sin(PHI), (R + 0.01) * Math.cos(PHI)], rotX: PHI });
  }
  rivets.push(...shift(rivetsAxisY(6, 0.062, 0, 0.013), L * 0.06, CY + R + 0.022, 0));
  // BRASS, not brassDark: on a pale iron barrel the dark heads disappeared, and a
  // warm bronze dot on grey iron is what makes the seam read at park zoom
  const rivetMesh = mergedBoxes(t, rivets, BRASS, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.44 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  group.add(rivetMesh);

  // =========================================================================
  // WEATHERING — rust weeping down the barrel's underside, a soot fan above the
  // firebox door and a soot wash round the chimney base
  // =========================================================================
  // LYING ON the barrel, which needs the right rotation: with `pos` written as
  // (x, CY + R·cos a, R·sin a) the outward radial is (0, cos a, sin a), and a box
  // rotated about X by θ sends its local +y to (0, cos θ, −sin θ) — so θ = −a.
  // The first pass used a + π/2, which is the TANGENT, and every rust patch stood
  // off the barrel as a red plate sticking out sideways.
  const rustSpots: MergedBoxSpec[] = [];
  for (let i = 0; i < 12; i += 1) {
    const a = -2.6 + hash01(i * 3.7 + seed) * 1.6; // the lower flank only
    const x = -L * 0.44 + hash01(i * 5.1 + seed) * L * 0.88;
    const h = 0.05 + hash01(i * 7.3) * 0.09;
    rustSpots.push({
      dims: [0.028 + hash01(i * 9.1) * 0.026, 0.008, h],
      pos: [x, CY + (R + 0.005) * Math.cos(a), (R + 0.005) * Math.sin(a)],
      rotX: -a,
    });
  }
  const rustMesh = mergedBoxes(t, rustSpots, BRASSWORK.rustDark, { tex: 'concrete', repeat: [1, 1], rough: 0.96, bump: 0.03 });
  rustMesh.userData.lodDetail = true;
  group.add(rustMesh);
  const soot: MergedBoxSpec[] = [];
  for (let i = 0; i < 9; i += 1) {
    const a = -0.5 + hash01(i * 4.3 + seed) * 1.0;
    soot.push({
      dims: [0.05 + hash01(i * 6.7) * 0.04, 0.006, 0.08 + hash01(i * 8.9) * 0.1],
      pos: [L * 0.28 + (hash01(i * 11.3) - 0.5) * 0.22, CY + (R + 0.004) * Math.cos(a), (R + 0.004) * Math.sin(a)],
      rotX: -a,
    });
  }
  for (let i = 0; i < 5; i += 1) {
    soot.push({ dims: [0.01, 0.07 + hash01(i * 2.9) * 0.06, 0.05], pos: [-L * 0.5 - 0.055, 0.22 + hash01(i * 5.3) * 0.05, -0.08 + i * 0.04] });
  }
  // 0x3a332c, not the palette's true SOOT: a 14%-albedo patch lying on a pale
  // barrel reads as a torn HOLE in the plate rather than as a smoke stain
  const sootMesh = mergedBoxes(t, soot, 0x3a332c, { tex: 'concrete', repeat: [1, 1], rough: 0.96, bump: 0.02 });
  sootMesh.userData.lodDetail = true;
  group.add(sootMesh);

  // the coal heap and the shovel by the firebox door
  const coalMat = plain(t, bag, COAL, { rough: 0.52, metal: 0.2, flat: true });
  const heapBase = ball(t, 1, COAL, [-L * 0.66, 0.03, R * 0.55], { rough: 0.55, metal: 0.2, flat: true });
  heapBase.scale.set(0.17, 0.055, 0.14);
  group.add(heapBase);
  const heap = mergedParts(t, litterLumps(t, seed + 11, 14, 0.02, 0.17, 0.062, [-L * 0.66, 0.02, R * 0.55]), coalMat);
  group.add(heap);
  bag.geos.push(heap.geometry);
  group.add(cyl(t, 0.011, 0.013, 0.36, TIMBER_P, [-L * 0.5 - 0.14, 0.24, -R * 0.5], { tex: 'wood', repeat: [1, 3], rough: 0.9, rotZ: 0.42, rotX: -0.2 }));
  group.add(box(t, [0.075, 0.014, 0.1], IRON, [-L * 0.5 - 0.21, 0.045, -R * 0.62], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.7, rotZ: 0.42, rotX: -0.2 }));
  const grit = mergedParts(t, litterLumps(t, seed + 5, 14, R * 1.5, L * 0.78, 0.05), plain(t, bag, CINDER, { rough: 1, metal: 0.1, flat: true }));
  grit.userData.lodDetail = true;
  group.add(grit);
  bag.geos.push(grit.geometry);

  // =========================================================================
  // the CHIMNEY SMOKE — 26 particles, dark and slow
  // =========================================================================
  let smoke: ReturnType<typeof buildEmitter> | null = null;
  if (opts.smoke ?? true) {
    smoke = buildEmitter(t, {
      max: 26,
      rate: 9,
      life: 2.4,
      lifeVar: 0.6,
      velocity: [0.05, 0.36, 0.02],
      spread: 0.11,
      gravity: -0.05,
      size: 0.06,
      sizeEnd: 0.3,
      color: 0x8f8a82,
      colorEnd: 0xb0aaa2,
      opacity: 0.42,
    });
    smoke.setOrigin(L * 0.28, 1.2, 0);
    group.add(smoke.points);
  }

  const update = (time: number) => {
    const nk = nightKOf(group);
    const ease = nk * nk * (3 - 2 * nk);
    // the fire breathes: two hashed sines plus a slow draw cycle. It NEVER goes
    // out by day — only the light it throws is night-weighted.
    const breath = 0.5 + 0.32 * Math.sin(time * 1.7) + 0.18 * Math.sin(time * 4.3 + 1.1);
    fireMat.emissiveIntensity = 0.34 + 0.5 * breath + 0.55 * ease * breath;
    fireLight.intensity = (0.07 + 0.42 * ease) * (0.7 + 0.5 * breath);
    g1.needle.rotation.z = -(-1.35 + 1.05 * Math.sin(time * 0.33) + 0.12 * Math.sin(time * 2.1));
    smoke?.update(time);
  };
  update(0);

  return {
    group,
    update,
    length: L + 0.16,
    halfWidth: R * 1.35,
    height: 1.2,
    dispose() {
      smoke?.dispose();
      fireLight.dispose();
      bag.texes.forEach((x) => x.dispose());
      bag.mats.forEach((m) => m.dispose());
      bag.geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
    },
  };
}

// ===========================================================================
// 5. <CoalCart> — a narrow-gauge tipper wagon on a short length of track
// ===========================================================================
//
// TWO reads have to land, and they are independent: TRACK and WAGON.
//
// Track reads from the layer cake — ballast shoulders, sleepers with hashed
// skews and sinks (a row of identical square sleepers reads as a ladder), a real
// rail SECTION (foot, web, head — a single box is a plank), spikes at every
// chair and a fishplate at the joint. It is flat and it does NOT block: the piece
// is meant to run past paths and lawns.
//
// The wagon reads from the FLARE and the LOAD. A tipper body is wider at the top
// than the bottom, and building it as four separately tilted plates (rather than
// one tapered prism) gives real corner seams to strap and rivet. The coal is
// heaped ABOVE the rim in rounded flat-shaded lumps — pitched up off pure black,
// because a 3%-albedo heap reads as a hole in the frame, and rough 0.52 because
// anthracite has a genuine sheen. Flanged wheels sit ON the rail head.

export interface CoalCartOpts {
  /** track length (default 1.5) */
  length?: number;
  seed?: number;
  /** the heaped coal load (default true) */
  load?: boolean;
  /** where the wagon stands along the track, local z (default 0.12) */
  cartAt?: number;
}

export interface CoalCartBuilt extends ComposableBuilt {
  group: THREE.Group;
  dispose: () => void;
  /** track length (the track is NOT a blocker) */
  length: number;
  /** the WAGON's blocker footprint: half-extents and its local z offset */
  cartHalfX: number;
  cartHalfZ: number;
  cartAt: number;
  height: number;
}

/** the coal cart and its track. Group origin on the ground at the middle of the
 *  track; the rails run along local Z. */
export function buildCoalCart(t: typeof THREE, opts: CoalCartOpts = {}): CoalCartBuilt {
  const L = opts.length ?? 1.5;
  const seed = opts.seed ?? 1;
  const CZ = opts.cartAt ?? 0.12;
  const bag = newBag();
  const group = new t.Group();
  group.name = 'coal-cart';

  const GAUGE = 0.13; // rail centres at ±0.13 — narrow gauge
  const RAIL_TOP = 0.139;
  const ironMat = surface(t, bag, IRON, 'grime', [3, 8], { rough: 0.82, metal: 0.24, bump: 0.045 });
  const railMat = surface(t, bag, RUST, 'grime', [2, 10], { rough: 0.9, metal: 0.2, bump: 0.04 });
  const bodyMat = surface(t, bag, 0x6b6459, 'grime', [3, 3], { rough: 0.86, metal: 0.22, bump: 0.05 });
  const coalMat = plain(t, bag, COAL, { rough: 0.52, metal: 0.22, flat: true });

  // =========================================================================
  // BALLAST — a cinder bed with sloped shoulders (a flat slab reads as a kerb)
  // =========================================================================
  group.add(box(t, [0.5, 0.05, L], 0x4d463c, [0, 0.025, 0], { tex: 'concrete', repeat: [3, Math.round(L * 6)], rough: 1, metal: 0.08, bump: 0.07 }));
  for (const sx of [-1, 1]) {
    group.add(
      box(t, [0.12, 0.05, L], CINDER, [sx * 0.28, 0.014, 0], {
        tex: 'concrete',
        repeat: [1, Math.round(L * 6)],
        rough: 1,
        metal: 0.08,
        bump: 0.07,
        rotZ: sx * 0.45,
      }),
    );
  }

  // =========================================================================
  // SLEEPERS — 10 creosoted timbers, each hashed off square. ONE merged mesh.
  // =========================================================================
  const NS = Math.max(4, Math.round(L / 0.15));
  const sleepers: MergedBoxSpec[] = [];
  for (let i = 0; i < NS; i += 1) {
    const z = -L / 2 + 0.075 + (i / (NS - 1)) * (L - 0.15);
    const sink = hash01(i * 3.1 + seed) * 0.014;
    sleepers.push({
      dims: [0.46 - hash01(i * 5.7) * 0.03, 0.04, 0.075],
      pos: [(hash01(i * 7.3 + seed) - 0.5) * 0.02, 0.07 - sink, z],
      rotY: (hash01(i * 9.1 + seed) - 0.5) * 0.09,
      rotZ: (hash01(i * 11.7 + seed) - 0.5) * 0.05,
      repeat: [3, 1],
    });
  }
  const sleeperMesh = mergedBoxes(t, sleepers, TIMBER, { tex: 'wood', repeat: [1, 1], rough: 0.94, metal: 0.02, bump: 0.05 });
  group.add(sleeperMesh);

  // =========================================================================
  // RAILS — a real section: foot, web and head, twice. Plus the fishplate.
  // =========================================================================
  const rails: PartSpec[] = [];
  for (const sx of [-1, 1]) {
    rails.push({ geo: new t.BoxGeometry(0.05, 0.012, L), matrix: mtx(t, [sx * GAUGE, 0.096, 0]), uv: [1, 14] });
    rails.push({ geo: new t.BoxGeometry(0.016, 0.026, L), matrix: mtx(t, [sx * GAUGE, 0.115, 0]), uv: [1, 14] });
    rails.push({ geo: new t.BoxGeometry(0.032, 0.014, L), matrix: mtx(t, [sx * GAUGE, 0.132, 0]), uv: [1, 14] });
    // the fishplate at the joint, bolted through the web
    rails.push({ geo: new t.BoxGeometry(0.012, 0.03, 0.14), matrix: mtx(t, [sx * (GAUGE + 0.014), 0.115, 0.02]), uv: [1, 1] });
  }
  const railMesh = mergedParts(t, rails, railMat);
  group.add(railMesh);
  bag.geos.push(railMesh.geometry);
  // SPIKES: two per rail per sleeper — 40 heads in one LOD-shed mesh
  const spikes: MergedBoxSpec[] = [];
  for (let i = 0; i < NS; i += 1) {
    const z = -L / 2 + 0.075 + (i / (NS - 1)) * (L - 0.15);
    for (const sx of [-1, 1]) {
      for (const so of [-1, 1]) {
        spikes.push({ dims: [0.012, 0.022, 0.014], pos: [sx * GAUGE + so * 0.034, 0.098, z] });
      }
    }
  }
  const spikeMesh = mergedBoxes(t, spikes, IRON_D, { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.72 });
  spikeMesh.userData.lodDetail = true; // track spikes: close-up only
  group.add(spikeMesh);

  // =========================================================================
  // the WAGON — chassis, flanged wheels, the flared tipper body
  // =========================================================================
  const cart = new t.Group();
  cart.position.set(0, 0, CZ);
  group.add(cart);
  const AXLE_Y = RAIL_TOP + 0.048;
  const chassis: PartSpec[] = [];
  for (const sx of [-1, 1]) chassis.push({ geo: new t.BoxGeometry(0.028, 0.05, 0.42), matrix: mtx(t, [sx * 0.16, 0.225, 0]), uv: [1, 3] });
  for (const sz of [-1, 1]) chassis.push({ geo: new t.BoxGeometry(0.35, 0.045, 0.03), matrix: mtx(t, [0, 0.225, sz * 0.2]), uv: [3, 1] });
  for (const sz of [-1, 1]) {
    chassis.push({ geo: new t.CylinderGeometry(0.012, 0.012, 0.3, 8, 1), matrix: mtx(t, [0, AXLE_Y, sz * 0.13], [0, 0, Math.PI / 2]), uv: [1, 2] }); // axle
    for (const sx of [-1, 1]) {
      chassis.push({ geo: new t.BoxGeometry(0.05, 0.055, 0.05), matrix: mtx(t, [sx * 0.16, AXLE_Y + 0.012, sz * 0.13]), uv: [1, 1] }); // axlebox
      // the WHEEL: a tread on the rail head plus a flange inboard of it
      chassis.push({ geo: new t.CylinderGeometry(0.048, 0.048, 0.03, 14, 1), matrix: mtx(t, [sx * GAUGE, AXLE_Y, sz * 0.13], [0, 0, Math.PI / 2]), uv: [3, 1] });
      chassis.push({ geo: new t.CylinderGeometry(0.058, 0.058, 0.008, 14, 1), matrix: mtx(t, [sx * (GAUGE - 0.019), AXLE_Y, sz * 0.13], [0, 0, Math.PI / 2]), uv: [3, 1] });
      chassis.push({ geo: new t.CylinderGeometry(0.016, 0.016, 0.036, 8, 1), matrix: mtx(t, [sx * (GAUGE + 0.012), AXLE_Y, sz * 0.13], [0, 0, Math.PI / 2]), uv: [1, 1] }); // hub cap
    }
  }
  // COUPLINGS: a drawbar stub, a hook and a hanging link at each end
  for (const sz of [-1, 1]) {
    chassis.push({ geo: new t.CylinderGeometry(0.014, 0.014, 0.06, 8, 1), matrix: mtx(t, [0, 0.2, sz * 0.235], [Math.PI / 2, 0, 0]), uv: [1, 1] });
    chassis.push({ geo: new t.TorusGeometry(0.026, 0.009, 5, 9, 3.5), matrix: mtx(t, [0, 0.185, sz * 0.28], [0, Math.PI / 2, sz > 0 ? 1.2 : 2.0]), uv: [2, 1] });
  }
  chassis.push({ geo: new t.TorusGeometry(0.028, 0.008, 5, 10), matrix: mtx(t, [0, 0.145, -0.3], [0.4, 0, 0]), uv: [2, 1] }); // a loose link hanging
  const chassisMesh = mergedParts(t, chassis, ironMat);
  cart.add(chassisMesh);
  bag.geos.push(chassisMesh.geometry);

  // THE BODY: four plates tilted out ~9.5°, a floor, a rim band and corner straps
  const TILT = 0.166;
  const body: PartSpec[] = [];
  body.push({ geo: new t.BoxGeometry(0.3, 0.275, 0.022), matrix: mtx(t, [0, 0.385, 0.2], [TILT, 0, 0]), uv: [3, 3] });
  body.push({ geo: new t.BoxGeometry(0.3, 0.275, 0.022), matrix: mtx(t, [0, 0.385, -0.2], [-TILT, 0, 0]), uv: [3, 3] });
  body.push({ geo: new t.BoxGeometry(0.022, 0.275, 0.4), matrix: mtx(t, [0.15, 0.385, 0], [0, 0, -TILT]), uv: [4, 3] });
  body.push({ geo: new t.BoxGeometry(0.022, 0.275, 0.4), matrix: mtx(t, [-0.15, 0.385, 0], [0, 0, TILT]), uv: [4, 3] });
  body.push({ geo: new t.BoxGeometry(0.27, 0.024, 0.37), matrix: mtx(t, [0, 0.26, 0], [0, 0, 0]), uv: [3, 3] });
  // THE RIM BAND AND CORNER STRAPS ARE PALE IRON IN THEIR OWN MESH. Merged into
  // the body's sooty plate the wagon was one dark value on a dark track and the
  // flare could not be read at all; a bright band round the mouth outlines the
  // whole shape and is what says TIPPER.
  const trim: PartSpec[] = [];
  trim.push({ geo: new t.BoxGeometry(0.34, 0.032, 0.032), matrix: mtx(t, [0, 0.525, 0.222]), uv: [3, 1] });
  trim.push({ geo: new t.BoxGeometry(0.34, 0.032, 0.032), matrix: mtx(t, [0, 0.525, -0.222]), uv: [3, 1] });
  trim.push({ geo: new t.BoxGeometry(0.032, 0.032, 0.44), matrix: mtx(t, [0.172, 0.525, 0]), uv: [4, 1] });
  trim.push({ geo: new t.BoxGeometry(0.032, 0.032, 0.44), matrix: mtx(t, [-0.172, 0.525, 0]), uv: [4, 1] });
  // corner straps, following the flare
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      trim.push({
        geo: new t.BoxGeometry(0.03, 0.285, 0.03),
        matrix: mtx(t, [sx * 0.158, 0.385, sz * 0.208], [sz * TILT, 0, -sx * TILT]),
        uv: [1, 2],
      });
    }
  }
  // the brake lever on the near side
  body.push({ geo: new t.BoxGeometry(0.022, 0.022, 0.22), matrix: mtx(t, [-0.19, 0.32, -0.04], [0.5, 0, 0.2]), uv: [1, 2] });
  const bodyMesh = mergedParts(t, body, bodyMat);
  cart.add(bodyMesh);
  bag.geos.push(bodyMesh.geometry);
  const trimMesh = mergedParts(t, trim, surface(t, bag, IRON_P, 'grime', [2, 1], { rough: 0.8, metal: 0.24, bump: 0.035 }));
  cart.add(trimMesh);
  bag.geos.push(trimMesh.geometry);

  // rivets along the rim and up every corner strap
  const rivets: MergedBoxSpec[] = [];
  for (const sz of [-1, 1]) rivets.push(...rivetRow(8, [-0.14, 0.542, sz * 0.222], [0.14, 0.542, sz * 0.222], 0.012));
  for (const sx of [-1, 1]) rivets.push(...rivetRow(9, [sx * 0.172, 0.542, -0.19], [sx * 0.172, 0.542, 0.19], 0.012));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      rivets.push(...rivetRow(3, [sx * 0.166, 0.3, sz * 0.216], [sx * 0.176, 0.48, sz * 0.226], 0.012));
    }
  }
  const rivetMesh = mergedBoxes(t, rivets, BRASS_D, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.48 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  cart.add(rivetMesh);
  // rust bloom on the plates
  const rustSpots: MergedBoxSpec[] = [];
  for (let i = 0; i < 10; i += 1) {
    const side = i % 4;
    const u = (hash01(i * 4.1 + seed) - 0.5) * 0.44;
    const y = 0.29 + hash01(i * 6.3 + seed) * 0.2;
    const s = 0.03 + hash01(i * 8.7) * 0.04;
    if (side < 2) rustSpots.push({ dims: [s, s * 1.4, 0.006], pos: [u * 0.6, y, (side === 0 ? 1 : -1) * 0.213], rotX: side === 0 ? TILT : -TILT });
    else rustSpots.push({ dims: [0.006, s * 1.4, s], pos: [(side === 2 ? 1 : -1) * 0.162, y, u * 0.8], rotZ: side === 2 ? -TILT : TILT });
  }
  const rustMesh = mergedBoxes(t, rustSpots, RUST, { tex: 'concrete', repeat: [1, 1], rough: 0.96, bump: 0.03 });
  rustMesh.userData.lodDetail = true;
  cart.add(rustMesh);

  // =========================================================================
  // the LOAD — a heap standing proud of the rim, and spilled lumps by the track
  // =========================================================================
  let topY = 0.555;
  if (opts.load ?? true) {
    // a filled base so daylight never shows between the lumps. KEPT LOW: the
    // first pass gave it a 0.055 half-height and the smooth ellipsoid read
    // straight through the lumps as a dark DISC — a manhole cover, not coal.
    const base = ball(t, 1, COAL, [0, 0.47, 0], { rough: 0.55, metal: 0.22, flat: true });
    base.scale.set(0.105, 0.028, 0.142);
    cart.add(base);
    // TWO tones, split by hash: coal is a heap of cleaved faces, and a single
    // near-black material gives no facet contrast to read the heap by
    const lumpsA: PartSpec[] = [];
    const lumpsB: PartSpec[] = [];
    for (let i = 0; i < 30; i += 1) {
      const u = hash01(i * 2.7 + seed) * 2 - 1;
      const v = hash2(i * 1.3, seed) * 2 - 1;
      const rr = Math.hypot(u, v);
      if (rr > 1.06) continue;
      const s = 0.026 + hash01(i * 5.9 + seed) * 0.03;
      const spec: PartSpec = {
        geo: new t.IcosahedronGeometry(1, 0),
        matrix: mtx(
          t,
          [u * 0.132, 0.495 + (1 - rr * rr * 0.8) * 0.085, v * 0.185],
          [hash01(i * 7.1) * Math.PI, hash01(i * 9.3) * Math.PI, hash01(i * 11.7) * Math.PI],
          [s, s * 0.78, s * (0.8 + hash01(i * 13.1) * 0.5)],
        ),
        uv: [1, 1],
      };
      if (hash01(i * 17.3 + seed) > 0.62) lumpsB.push(spec);
      else lumpsA.push(spec);
    }
    const heap = mergedParts(t, lumpsA, coalMat);
    cart.add(heap);
    bag.geos.push(heap.geometry);
    const heapB = mergedParts(t, lumpsB, plain(t, bag, BRASSWORK.coalFace, { rough: 0.44, metal: 0.24, flat: true }));
    cart.add(heapB);
    bag.geos.push(heapB.geometry);
    topY = 0.63;
  }
  // spilled coal along the track — small, ROUNDED and dark (flat pale boxes on
  // the ground read as scraps of paper; both sibling packs learned it the hard way)
  const spill: PartSpec[] = [];
  for (let i = 0; i < 12; i += 1) {
    const z = (hash01(i * 3.3 + seed) - 0.5) * L * 0.92;
    const x = (hash01(i * 5.1 + seed) > 0.5 ? 1 : -1) * (0.2 + hash01(i * 7.9 + seed) * 0.14);
    const s = 0.022 + hash01(i * 9.7 + seed) * 0.026;
    spill.push({
      geo: new t.IcosahedronGeometry(1, 0),
      matrix: mtx(t, [x, 0.045 + s * 0.3, z], [hash01(i * 11.1) * Math.PI, hash01(i * 13.7) * Math.PI, hash01(i * 15.3) * Math.PI], [s, s * 0.6, s * 0.9]),
      uv: [1, 1],
    });
  }
  const spillMesh = mergedParts(t, spill, coalMat, false);
  spillMesh.userData.lodDetail = true; // spilled lumps: close-up only
  group.add(spillMesh);
  bag.geos.push(spillMesh.geometry);

  return {
    group,
    length: L,
    cartHalfX: 0.21,
    cartHalfZ: 0.26,
    cartAt: CZ,
    height: topY,
    dispose() {
      bag.texes.forEach((x) => x.dispose());
      bag.mats.forEach((m) => m.dispose());
      bag.geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
    },
  };
}

// ===========================================================================
// THE COMPOSABLE COMPONENTS (components/Park/Context.md convention)
//
// Each mounts into the surrounding <Park> / <ScenePreview> at
// `position` / `rotation` / `scale` (y settles onto the plaza/terrain) and renders
// null — components never render a <Stage> themselves; the preview staging lives
// in BrassworkScenery.previews.tsx.
//
// BLOCKERS (GameManager/Context.md "Blockers"): ALL FIVE pieces are solid objects
// and all five register, so guests path AROUND them. Two of them are long and
// thin, so they take a rotated RECT rather than a circle (a circle over a 1.2 u
// boiler would fence off half a tile of clear yard) — and the coal cart's blocker
// covers the WAGON ONLY: its track is flat, is meant to run past paths and lawns,
// and a blocker over the rails would carve a hole in the walk network. The wagon
// stands `cartAt` along the local +Z of the track, so the rect centre is that
// offset rotated into world space (local +z = [sin yaw, cos yaw]).
// ===========================================================================

export interface GiantGearProps extends GiantGearOpts {
  /** keep guests off the gear (default true — it is a turning machine) */
  blocking?: boolean;
}

/** `<GiantGear>` — an oversized cast-iron gear wheel turning on a bearing
 *  pedestal, driving a small pinion. The gear face looks along local +Z. */
export const GiantGear = composable<GiantGearProps, GiantGearBuilt>(
  'GiantGear',
  (t, props) => buildGiantGear(t, { radius: props.radius, seed: props.seed, pinion: props.pinion, spin: props.spin, ballast: props.ballast }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<GiantGear> gear and pedestal',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface SteamPipesProps extends SteamPipesOpts {
  /** keep guests out of the pipework (default true — it is venting live steam) */
  blocking?: boolean;
}

/** `<SteamPipes>` — a tangle of riveted plumbing with valve wheels, live gauges
 *  and two relief vents that puff steam. The gauges face local +Z. */
export const SteamPipes = composable<SteamPipesProps, SteamPipesBuilt>(
  'SteamPipes',
  (t, props) => buildSteamPipes(t, { seed: props.seed, steam: props.steam, gauges: props.gauges }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<SteamPipes> pipe cluster',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface ClockTowerProps extends ClockTowerOpts {
  /** keep guests off the tower plinth (default true) */
  blocking?: boolean;
}

/** `<ClockTower>` — a slender riveted tower with four working clock faces, a
 *  verdigris copper spire and a bell that rings on the hour. */
export const ClockTower = composable<ClockTowerProps, ClockTowerBuilt>(
  'ClockTower',
  (t, props) => buildClockTower(t, { seed: props.seed, bell: props.bell, light: props.light, minutePeriod: props.minutePeriod }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<ClockTower> plinth',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface BoilerTankProps extends BoilerTankOpts {
  /** keep guests off the boiler (default true — hot iron) */
  blocking?: boolean;
}

/** `<BoilerTank>` — a horizontal riveted boiler set in brick, firebox glowing,
 *  chimney smoking. The barrel runs along local X; `rotation` aims it. */
export const BoilerTank = composable<BoilerTankProps, BoilerTankBuilt>(
  'BoilerTank',
  (t, props) => buildBoilerTank(t, { length: props.length, radius: props.radius, seed: props.seed, smoke: props.smoke, light: props.light }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        // long and thin: a rotated RECT, not a circle
        rect: { cx: wx, cz: wz, hx: (built.length / 2) * scale, hz: built.halfWidth * scale, yaw: rotation },
        label: '<BoilerTank> barrel and setting',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface CoalCartProps extends CoalCartOpts {
  /** keep guests out of the WAGON (default true). The track is never a blocker:
   *  it is flat, and fencing off the rails would carve holes in the walk network. */
  blocking?: boolean;
}

/** `<CoalCart>` — a narrow-gauge tipper wagon heaped with coal on a short length
 *  of spiked track. The rails run along local Z, so `rotation` aims the track. */
export const CoalCart = composable<CoalCartProps, CoalCartBuilt>(
  'CoalCart',
  (t, props) => buildCoalCart(t, { length: props.length, seed: props.seed, load: props.load, cartAt: props.cartAt }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      // the wagon stands `cartAt` along the track's local +Z
      const off = built.cartAt * scale;
      return park.registerBlocker({
        rect: {
          cx: wx + Math.sin(rotation) * off,
          cz: wz + Math.cos(rotation) * off,
          hx: built.cartHalfX * scale,
          hz: built.cartHalfZ * scale,
          yaw: rotation,
        },
        label: '<CoalCart> wagon',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);
