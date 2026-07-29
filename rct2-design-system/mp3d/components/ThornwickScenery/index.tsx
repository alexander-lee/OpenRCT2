import * as THREE from 'three';
import { alongDir, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { THORNWICK, buildIvyStrand } from '../WyrmsHollow';
import { composable } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// ThornwickScenery — the five scenery pieces of THORNWICK GLADE, an enchanted
// forest. Per-world scenery (not an extension of the shared SceneryPack): one
// component folder exporting five imperative builders plus five composable
// components, so the whole glade dressing set arrives (and versions) together
// — the same shape as components/TidewaterScenery and
// components/BrassworkScenery.
//
//   1. <GiantToadstools>  THE WORLD'S SIGNATURE — a clump of house-high
//                         toadstools with real domed caps, gills, warty
//                         crowns, one cap that glows, and glow-worms crusted
//                         up the stipes
//   2. <StandingStones>   a mossy megalith ring with one stone fallen, carved
//                         spiral runes that light after dark, lichen crusts
//   3. <LanternTree>      a twisted tree hung with wrought-iron lanterns:
//                         root flares, bracket fungi, ivy, a mossy north side
//   4. <RuinedArch>       a free-standing broken arch over a path — a real
//                         voussoir ring with one stone missing, its keystone
//                         proud, ivy down both haunches, a bracket lantern
//   5. <FlowerPodBed>     a bed of glowing flower pods on nodding stalks,
//                         some open with a lit core, some still tight buds
//
// THE PALETTE IS THE GLADE'S OWN. `THORNWICK` is imported from
// components/WyrmsHollow (the world's first component owns it) — lichen-grey
// masonry, three greens of moss and ivy, woody vine, root brown, the enchanted
// gloom violet and the warm lantern amber. The glade's *living* colours (cap
// red and dusk violet, cream stipe, glow-worm green, the pod glow) are added
// here as `GLADE`, exported as data so the world's stall can weather to match.
// The hanging ivy is `buildIvyStrand`, shared from WyrmsHollow — never a second
// copy.
//
// NIGHT IS HALF THIS WORLD, so unlike Tidewater's sunlit cove these pieces DO
// glow — but they glow the way EmberfallScenery's lava does, by LERPING
// `nightKOf` between a day and a night value and never gating to zero
// (`glowK`). A glow-worm is alive at noon; it is just outshone. Only the
// LANTERNS — actual lamps with a flame in them — gate hard to dark by day.
// Every glowing surface is emissive; real PointLights are rationed (0-2 per
// piece, all opt-out) because a scenery piece gets placed a dozen times.
//
// GLOW-WORM DIFFUSE IS NOT THE GLOW COLOUR. MoonlitBarge learned this the hard
// way: a grain whose base colour is the lit green reads as a speck of white
// litter across the whole bank in daylight. Every grain here is a dull
// grey-green (`GLADE.wormDull`) that happens to be emissive.
//
// Static repeats are batched into one merged mesh per material, fine detail
// (warts, gills, lichen flecks, glow-worm grains, rubble, ferns) is tagged
// `userData.lodDetail`, and every updater takes ABSOLUTE time. Deterministic:
// hashed sines only, never Math.random / Date.now.
//
// TEXTURE SCALE ON SMALL PIECES — Tidewater's standing warning, heeded. Every
// `repeat` is chosen against the part's real world size (~one tile per
// 0.25-0.5 u of surface), and anything thinner than ~0.02 u (gill blades, ivy
// stems, stalks, lantern cage bars, rune grooves) carries NO map at all.
// ---------------------------------------------------------------------------

// ---- deterministic hashes --------------------------------------------------
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// THE GLADE'S LIVING PALETTE — what grows in Thornwick, as opposed to what was
// built there (that is `THORNWICK`, imported from WyrmsHollow). Exported as
// data: the world's stall (`components/Honeywitch`) dresses out of this so its
// candied apples and its thatch are the same forest.
// ---------------------------------------------------------------------------
export const GLADE = {
  /** toadstool cap: a deep muted red — the same red the barge's hollow uses */
  capRed: 0x8e4038,
  /** the shaded underside tone of that red */
  capRedDeep: 0x6d2f28,
  /** toadstool cap: dusk violet, the coldest cap in the glade */
  capViolet: 0x63496f,
  /** the pale bone cap that GLOWS — muted in daylight on purpose */
  capPale: 0x93a892,
  /** cream stipe (mushroom stem) */
  stipe: 0xd6cdb2,
  stipeShade: 0xb0a68a,
  /** the pale disc of gills under a cap */
  gill: 0xc9bfa4,
  /** the warts on an amanita crown */
  wart: 0xe8e2cf,
  /** GLOW-WORM GREEN — pale, low saturation: living light, not a neon tube */
  worm: 0x9fe8b4,
  /** …and the grain's real DAYLIGHT colour: a dull damp grey-green. Never use
   *  the glow colour as a diffuse (MoonlitBarge's litter-speck lesson). */
  wormDull: 0x6f8a72,
  /** flower pods: a sappy green skin over a hot pale core */
  podSkin: 0x7f9a5e,
  podSkinPale: 0x9ab074,
  podGlow: 0xc8f2a0,
  podCore: 0xeaffcf,
  /** pod petals: pale violet, the glade's one flower colour */
  petal: 0xc0b0d2,
  petalDeep: 0x94809f,
  /** fern and grass-blade green (lighter than the ivy, it catches the sun) */
  fern: 0x5b7a3e,
  /** bark: dry twisted forest hardwood */
  bark: 0x4e4336,
  barkDark: 0x3f362b,
  /** bracket fungus growing off a trunk */
  bracket: 0xa8916a,
  /** wrought iron — lantern cages, hooks, brackets. metalness capped at 0.28:
   *  0.6+ renders near-black on this Stage (no env map). */
  iron: 0x4a4b46,
  ironDark: 0x35362f,
  /** lantern glass */
  lampGlass: 0xfff2d0,
  /** the forest floor: wet loam under a year of leaf litter. Kept LIGHT on
   *  purpose — the first pass at 0x3f3428 read as a scorch mark on the lawn. */
  loam: 0x4b4030,
  /** the pale grey-green crust on old stone */
  lichen: 0x9aa688,
  /** the cold light in a carved rune — the gloom violet's living cousin */
  rune: 0x8fd8c0,
} as const;

// ---------------------------------------------------------------------------
// DAY↔NIGHT GLOW — the EmberfallScenery house rule, applied to living light.
// A glow-worm, a lit toadstool cap, a rune and a flower pod are ALIVE at noon;
// they are just outshone. So `nightKOf` LERPS the emissive multiplier and never
// gates it to zero. Only `lanternK` (a real flame) gates hard.
// ---------------------------------------------------------------------------
const GLOW_DAY = 0.14;
const GLOW_NIGHT = 1.35;
const glowK = (obj: THREE.Object3D) => GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nightKOf(obj);
/** a lamp with a flame in it: dark by day, smoothstepped up after dusk */
const lanternK = (obj: THREE.Object3D) => {
  const nk = nightKOf(obj);
  return nk * nk * (3 - 2 * nk);
};

// ---------------------------------------------------------------------------
// LOCAL PROCEDURAL CANVAS — one surface Stage's library cannot do. Built the
// way Stage's own `drawTexture` builds its textures (2D canvas, per-stroke
// variation) but with hashed sines instead of Math.random, so a park screenshot
// is byte-identical run to run. Module-cached: one canvas serves every megalith
// and every arch voussoir in the park.
// ---------------------------------------------------------------------------

/**
 * LICHENED STONE — Stage's 'concrete' is an even aggregate speckle, which is
 * exactly wrong for a thousand-year-old megalith standing in a wet wood: old
 * stone is BLOTCHY, with pale lichen rosettes, dark damp runs down the shaded
 * faces and a few real cracks. Doubles as the bump map so the rosettes read as
 * crust and the cracks as cracks.
 *
 * ⚠️ THE GROUND IS NEAR-WHITE ON PURPOSE. Stage's `mat({ tex })` bakes the
 * palette tone INTO its canvas and leaves the material colour at 0xffffff;
 * a LOCAL canvas is used the other way round (material colour × map), so the
 * canvas has to be a light MODULATION and not a grey. The first pass painted
 * this on a #8b8d80 stone ground and every megalith and voussoir in the glade
 * rendered near-black — `0x7c7f72 × 0x8b8d80 ≈ 0x44463d`, half the value the
 * palette asked for. Keep the base bright; put the colour in the palette.
 */
let _lichenCanvas: HTMLCanvasElement | null = null;
function lichenCanvas(): HTMLCanvasElement {
  if (_lichenCanvas) return _lichenCanvas;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const x = c.getContext('2d')!;
  // a near-white modulation ground (see the warning above), then a coarse
  // mottle so no two patches of one stone match
  x.fillStyle = '#e6e4da';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i += 1) {
    const h1 = hash01(i * 1.7 + 0.3);
    const h2 = hash01(i * 3.1 + 1.9);
    const h3 = hash01(i * 5.3 + 4.1);
    const r = 5 + h3 * 22;
    const g = x.createRadialGradient(h1 * S, h2 * S, 0, h1 * S, h2 * S, r);
    const dark = h3 > 0.5;
    g.addColorStop(0, dark ? 'rgba(120,124,112,0.34)' : 'rgba(255,255,252,0.34)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(h1 * S, h2 * S, r, 0, Math.PI * 2);
    x.fill();
  }
  // DAMP RUNS: vertical streaks of dark, the water that has run down the face
  for (let i = 0; i < 16; i += 1) {
    const h1 = hash01(i * 7.7 + 2.3);
    const w = 2 + hash01(i * 9.1) * 6;
    x.fillStyle = `rgba(112,118,104,${0.08 + hash01(i * 11.3) * 0.12})`;
    x.fillRect(h1 * S, hash01(i * 13.7) * S * 0.5, w, S * (0.4 + hash01(i * 2.9) * 0.6));
  }
  // LICHEN ROSETTES: a ring of little lobes with a paler centre — the one shape
  // that says "this stone has been outdoors for a thousand years". Pale ones
  // BRIGHTEN the stone, the green ones tint it.
  for (let i = 0; i < 34; i += 1) {
    const cx = hash01(i * 2.11 + 6.1) * S;
    const cy = hash01(i * 4.23 + 7.3) * S;
    const rr = 3 + hash01(i * 6.37) * 7;
    const lobes = 6 + Math.floor(hash01(i * 8.41) * 5);
    const pale = hash01(i * 10.53) > 0.4;
    x.fillStyle = pale ? 'rgba(255,255,246,0.6)' : 'rgba(196,214,164,0.5)';
    for (let k = 0; k < lobes; k += 1) {
      const a = (k / lobes) * Math.PI * 2 + hash01(i + k * 1.3) * 0.7;
      const lr = rr * (0.55 + hash01(i * 3.7 + k) * 0.5);
      x.beginPath();
      x.arc(cx + Math.cos(a) * rr * 0.6, cy + Math.sin(a) * rr * 0.6, lr * 0.42, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = pale ? 'rgba(255,255,250,0.5)' : 'rgba(214,228,184,0.44)';
    x.beginPath();
    x.arc(cx, cy, rr * 0.42, 0, Math.PI * 2);
    x.fill();
  }
  // CRACKS: a few short dark polylines
  for (let i = 0; i < 11; i += 1) {
    let px = hash01(i * 12.7 + 3.3) * S;
    let py = hash01(i * 14.9 + 5.7) * S;
    const steps = 4 + Math.floor(hash01(i * 16.1) * 5);
    x.lineWidth = 1.2;
    x.strokeStyle = 'rgba(94,98,88,0.7)';
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < steps; k += 1) {
      px += (hash01(i * 18.3 + k * 2.1) - 0.5) * 22;
      py += (hash01(i * 20.7 + k * 3.7) - 0.35) * 20;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  // fine grain over everything so the surface is never flat
  for (let i = 0; i < 900; i += 1) {
    const h1 = hash01(i * 1.13 + 9.7);
    const h2 = hash01(i * 2.29 + 11.9);
    x.fillStyle = hash01(i * 3.41) > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    x.fillRect(h1 * S, h2 * S, 1, 1);
  }
  _lichenCanvas = c;
  return c;
}

// ---- material bookkeeping (the Brasswork `Bag` pattern) --------------------
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

interface SurfOpts {
  rough?: number;
  metal?: number;
  bump?: number;
  flat?: boolean;
  emissive?: number;
}

/** lichened stone: a palette tone × the local lichen canvas, as map AND bump */
function stoneMat(t: typeof THREE, bag: Bag, color: number, repeat: [number, number], o: SurfOpts = {}): THREE.MeshStandardMaterial {
  const tex = texFrom(t, lichenCanvas(), repeat[0], repeat[1]);
  bag.texes.push(tex);
  const m = new t.MeshStandardMaterial({
    color,
    map: tex,
    bumpMap: tex,
    bumpScale: o.bump ?? 0.07,
    roughness: o.rough ?? 0.95,
    metalness: 0,
    flatShading: o.flat ?? false,
  });
  bag.mats.push(m);
  return m;
}

/** a plain (unmapped) material — for anything thinner than ~0.02 u, where a
 *  tiled map is strictly worse than none, and for the emissive surfaces */
function plain(t: typeof THREE, bag: Bag, color: number, o: SurfOpts = {}): THREE.MeshStandardMaterial {
  const m = new t.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.86,
    metalness: Math.min(0.3, o.metal ?? 0),
    flatShading: o.flat ?? false,
    emissive: o.emissive ?? 0x000000,
  });
  bag.mats.push(m);
  return m;
}

/** one of Stage's CACHED procedural textures on a palette tone (map + bump).
 *  `mat()` bakes the tone into the canvas and caches per name:color:repeat, so
 *  every megalith in the park shares one texture — never hand-roll a second. */
function texMat(
  t: typeof THREE,
  bag: Bag,
  color: number,
  tex: 'wood' | 'leaf' | 'grass' | 'fabric' | 'concrete' | 'metal',
  repeat: [number, number],
  o: SurfOpts = {},
): THREE.MeshStandardMaterial {
  const m = mat(t, color, { tex, repeat, rough: o.rough, metal: o.metal, bump: o.bump, flat: o.flat, emissive: o.emissive });
  bag.mats.push(m);
  return m;
}

// ---------------------------------------------------------------------------
// GEOMETRY HELPERS — the non-box counterparts of Stage's `mergedBoxes`. This
// world is trunks, stalks, domes and rings, so it needs bars, blades, tapered
// limbs and box PARTS (a box that can join a `mergedParts` batch under a
// custom material, which `mergedBoxes` cannot do — it builds its own).
// ---------------------------------------------------------------------------

/** a box as a `PartSpec`, so masonry can share ONE lichen material */
function boxPart(
  t: typeof THREE,
  dims: [number, number, number],
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  uv: [number, number] = [1, 1],
): PartSpec {
  return { geo: new t.BoxGeometry(...dims), matrix: mtx(t, pos, rot), uv };
}

/** a box as a `PartSpec` at an arbitrary precomposed matrix */
function boxAtMatrix(t: typeof THREE, dims: [number, number, number], matrix: THREE.Matrix4, uv: [number, number] = [1, 1]): PartSpec {
  return { geo: new t.BoxGeometry(...dims), matrix, uv };
}

/** one merged box spanning A → B (its local Y axis runs along the bar) */
function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat?: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.01, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, ...(repeat ? { repeat } : {}) };
}

/**
 * A FLAT blade spanning A → B with its WIDTH axis kept horizontal — fern
 * fronds, grass tufts, gill plates, pod leaves and sepals. A frond has to read
 * as a leaf, not as a green joist.
 *
 * ⚠️ `up2 = side × dir`, NOT `dir × side`. The basis handed to `makeBasis` must
 * be RIGHT-handed: with `up2 = dir × side` the determinant is −1, the matrix is
 * a MIRROR, and `mergedBoxes`/`mergedParts` — which correctly transform normals
 * through the normal matrix — hand every blade an INWARD normal. The whole
 * surface is then lit from behind and renders near-black. The first render of
 * this pack had exactly that: the flower bed's broad leaves and open sepals were
 * black rectangles, the ferns were black arrowheads, and it looked like a
 * texture problem rather than a sign error. One cross-product, every blade in
 * the glade.
 */
function bladeSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, w: number, thick: number, repeat: [number, number] = [1, 2]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.01, dir.length());
  dir.normalize();
  const side = new t.Vector3().crossVectors(new t.Vector3(0, 1, 0), dir);
  if (side.lengthSq() < 1e-5) side.set(1, 0, 0);
  side.normalize();
  const up2 = new t.Vector3().crossVectors(side, dir).normalize();
  const m = new t.Matrix4().makeBasis(side, dir, up2);
  m.setPosition(a.clone().addScaledVector(dir, len * 0.5));
  return { dims: [w, len, thick], matrix: m, repeat };
}

/**
 * A ROUNDED PETAL / SEPAL — a flattened ellipsoid whose long axis runs from
 * `from` along `dir` for `len` (full length), `wide`/`thick` being its full
 * width and thickness.
 *
 * At flower scale a `bladeSpec` box is a RECTANGLE: the first pod render put
 * four box petals at 90° round each core and every open flower in the bed read
 * as a little lilac WINDMILL. A petal has a rounded outline, and an ellipsoid
 * is the cheapest shape that has one.
 */
function petalPart(t: typeof THREE, from: THREE.Vector3, dir: THREE.Vector3, len: number, wide: number, thick: number, detail = 1): PartSpec {
  const d = dir.clone().normalize();
  const yaw = Math.atan2(d.x, d.z);
  const pitch = -Math.asin(Math.max(-1, Math.min(1, d.y)));
  const half = len * 0.5;
  const c = from.clone().addScaledVector(d, half * 0.86);
  // mtx composes T·R·S with a YXZ Euler, so the ellipsoid's local +z (scaled to
  // `half`) is what gets aimed at `d`
  return {
    geo: new t.IcosahedronGeometry(1, detail),
    matrix: mtx(t, [c.x, c.y, c.z], [pitch, yaw, 0], [wide * 0.5, thick * 0.5, half]),
    uv: [1, 1],
  };
}

/**
 * A TAPERED, BENDING LIMB — a trunk, a branch, a mushroom stipe, a flower
 * stalk: `segs` tapering cylinder sections walking from `from` along `dir0`,
 * the direction easing toward `bend` as it climbs. Consecutive radii match, so
 * the joints are seamless and no joint balls are needed. Returns the tip and
 * the tip direction so the caller can hang a cap / a canopy / a pod on it.
 */
function limb(
  t: typeof THREE,
  parts: PartSpec[],
  from: THREE.Vector3,
  dir0: THREE.Vector3,
  len: number,
  r0: number,
  r1: number,
  segs: number,
  bend: THREE.Vector3,
  uv: [number, number] = [1, 2],
): { tip: THREE.Vector3; dir: THREE.Vector3 } {
  let p = from.clone();
  let d = dir0.clone().normalize();
  const n = Math.max(1, Math.round(segs));
  for (let i = 0; i < n; i += 1) {
    const l = len / n;
    const ra = r0 + (r1 - r0) * (i / n);
    const rb = r0 + (r1 - r0) * ((i + 1) / n);
    // 1.04 overlap: a hair of interpenetration is invisible, a hair of gap is not
    parts.push({ geo: new t.CylinderGeometry(rb, ra, l * 1.04, 8, 1), matrix: alongDir(t, p, d, l), uv });
    p = p.clone().addScaledVector(d, l);
    d = d.clone().addScaledVector(bend, 1 / n).normalize();
  }
  return { tip: p, dir: d };
}

/**
 * A low mound of overlapping flattened lumps — the loam/moss ground a piece
 * stands in, so nothing reads as dropped on a lawn. `rx`/`rz` are the mound's
 * TOTAL half-extents: the lumps are placed inside 0.5 R and sized under
 * 0.44 R so the outer edge lands at ~0.94 R. (The first pass placed them at
 * 0.88 R and sized them at 0.64 R, which spread every piece's loam to 1.5× its
 * own footprint — five pieces in one clearing rendered as five big brown
 * scorch marks on the lawn with the scenery lost on top of them.)
 */
function groundMound(t: typeof THREE, parts: PartSpec[], rx: number, rz: number, h: number, seed: number, n = 14): void {
  for (let i = 0; i < n; i += 1) {
    const az = hash01(i * 2.71 + seed * 1.9) * Math.PI * 2;
    const rr = i === 0 ? 0 : 0.18 + hash01(i * 4.31 + seed) * 0.42;
    // MANY SMALL LUMPS, not three big ones: the first pass's 0.5 R centre lump
    // rendered as a smooth brown PILLOW with the scenery standing off it. Litter
    // on a forest floor is uneven, so the mound is 14 flat facets that overlap.
    const s = i === 0 ? 0.3 : 0.15 + hash01(i * 6.53 + seed) * 0.2;
    parts.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * rr * rx, h * (0.1 + hash01(i * 8.71 + seed) * 0.3) - h * 0.55, Math.sin(az) * rr * rz],
        [(hash01(i * 14.9 + seed) - 0.5) * 0.3, hash01(i * 10.3 + seed) * Math.PI, (hash01(i * 16.1 + seed) - 0.5) * 0.3],
        [rx * s, h * (0.6 + hash01(i * 12.7 + seed) * 0.5), rz * s],
      ),
      uv: [2, 2],
    });
  }
}

/**
 * GROUND MOSS — flattened, faceted LUMPS scattered over the loam.
 *
 * ⚠️ Not boxes. Tidewater learned this twice (its tide-pool "slabs" read as
 * kerbstones and its salt bloom as dropped paper) and this pack repeated it on
 * its first render: flat green BOXES lying on brown loam read unmistakably as
 * green floor TILES. Moss is a cushion; it has to be a squashed blob.
 */
function mossLumps(t: typeof THREE, parts: PartSpec[], o: { n: number; seed: number; r0: number; r1: number; y: number; size: number }): void {
  for (let i = 0; i < o.n; i += 1) {
    const az = hash01(i * 3.11 + o.seed * 2.3) * Math.PI * 2;
    const rr = o.r0 + hash01(i * 5.17 + o.seed) * (o.r1 - o.r0);
    const s = o.size * (0.55 + hash01(i * 7.23 + o.seed) * 0.9);
    parts.push({
      // detail 0 (20 faces): there are 24-34 of these per piece and they are
      // squashed cushions — at detail 1 the ground dressing alone was a third
      // of the whole piece's triangle count
      geo: new t.IcosahedronGeometry(1, 0),
      matrix: mtx(
        t,
        [Math.cos(az) * rr, o.y, Math.sin(az) * rr],
        [(hash01(i * 15.3 + o.seed) - 0.5) * 0.4, hash01(i * 13.7 + o.seed) * Math.PI, (hash01(i * 17.9 + o.seed) - 0.5) * 0.4],
        [s, s * (0.22 + hash01(i * 9.31 + o.seed) * 0.16), s * (0.7 + hash01(i * 11.4 + o.seed) * 0.6)],
      ),
      uv: [1, 1],
    });
  }
}

/** hashed moss patches on a VERTICAL face (a stone flank, a trunk) — here a
 *  flat plate is right, because that is what a patch of moss on a wall is.
 *  Returns MergedBoxSpecs for one merged, shadow-free mesh. */
function mossPlates(
  o: { n: number; seed: number; r0: number; r1: number; y: number; size: number; yJitter?: number },
): MergedBoxSpec[] {
  const out: MergedBoxSpec[] = [];
  for (let i = 0; i < o.n; i += 1) {
    const az = hash01(i * 3.11 + o.seed * 2.3) * Math.PI * 2;
    const rr = o.r0 + hash01(i * 5.17 + o.seed) * (o.r1 - o.r0);
    const s = o.size * (0.6 + hash01(i * 7.23 + o.seed) * 0.8);
    out.push({
      dims: [s, o.size * 0.28, s * (0.7 + hash01(i * 9.31) * 0.6)],
      pos: [Math.cos(az) * rr, o.y + (o.yJitter ?? 0) * (hash01(i * 11.4) - 0.5), Math.sin(az) * rr],
      rotY: hash01(i * 13.7 + o.seed) * 3.14,
    });
  }
  return out;
}

/**
 * GLOW-WORM CRUST — the glade's ground-level night light and its cheapest
 * atmosphere: little emissive grains scattered over whatever they landed on.
 * Exported (deliberately WITHOUT a `build` prefix, so the seed sweep does not
 * mistake it for a piece builder) so a set-piece can crust its own banks the
 * same way the barge crusts its hollow.
 *
 * `at(i, h)` places grain `i` — return null to skip it. The returned material
 * must be handed a `glowK` lerp every frame; its DIFFUSE is a dull grey-green,
 * never the glow colour.
 */
export function glowWormCrust(
  t: typeof THREE,
  o: { count: number; seed: number; size?: number; at: (i: number, h: (k: number) => number) => [number, number, number] | null },
): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } {
  const specs: MergedBoxSpec[] = [];
  const sz = o.size ?? 0.017;
  for (let i = 0; i < Math.max(0, Math.round(o.count)); i += 1) {
    const h = (k: number) => hash01(o.seed * 1.61 + i * 2.77 + k * 5.13);
    const p = o.at(i, h);
    if (!p) continue;
    const s = sz * (0.6 + h(21) * 0.9);
    specs.push({ dims: [s, s * 0.7, s * (0.8 + h(22) * 0.7)], pos: p, rotY: h(23) * 3.1 });
  }
  const mesh = mergedBoxes(t, specs, GLADE.wormDull, { rough: 0.6, emissive: GLADE.worm });
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.emissiveIntensity = GLOW_DAY;
  mesh.castShadow = false;
  mesh.userData.lodDetail = true;
  return { mesh, material };
}

/**
 * THE GLADE LANTERN — the world's signature light fitting, hung off trees and
 * bracketed off ruins: a wrought-iron cage of four uprights leaning IN toward a
 * peaked cap (a straight cage reads as a crate), a base tray, a finial, a
 * hanging hoop and a warm glass globe. The glass material is returned so the
 * caller night-gates it; the fitting never owns a PointLight — the caller
 * places the rationed real ones.
 */
function gladeLantern(t: typeof THREE, bag: Bag, scale = 1): { group: THREE.Group; glass: THREE.MeshStandardMaterial } {
  const grp = new t.Group();
  const s = scale;
  const cage: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + 0.38;
    cage.push(
      barSpec(
        t,
        new t.Vector3(Math.cos(a) * 0.062 * s, -0.13 * s, Math.sin(a) * 0.062 * s),
        new t.Vector3(Math.cos(a) * 0.036 * s, 0.14 * s, Math.sin(a) * 0.036 * s),
        0.013 * s,
      ),
    );
    // a horizontal glazing bar halfway up each pane edge
    cage.push({ dims: [0.115 * s, 0.009 * s, 0.012 * s], pos: [0, 0.0, 0], rotY: a });
  }
  cage.push({ dims: [0.15 * s, 0.022 * s, 0.15 * s], pos: [0, -0.14 * s, 0], rotY: 0.38 }); // base tray
  cage.push({ dims: [0.132 * s, 0.026 * s, 0.132 * s], pos: [0, 0.15 * s, 0], rotY: 0.38 }); // cap plate
  cage.push({ dims: [0.078 * s, 0.05 * s, 0.078 * s], pos: [0, 0.185 * s, 0], rotY: 0.78 }); // peak
  cage.push({ dims: [0.016 * s, 0.09 * s, 0.016 * s], pos: [0, 0.25 * s, 0] }); // hanger stem
  const cageMesh = mergedBoxes(t, cage, GLADE.iron, { tex: 'metal', metal: 0.28, rough: 0.62, bump: 0.04 });
  bag.geos.push(cageMesh.geometry);
  bag.mats.push(cageMesh.material as THREE.Material);
  grp.add(cageMesh);
  const hoopGeo = new t.TorusGeometry(0.032 * s, 0.008 * s, 5, 10);
  const hoopMat = plain(t, bag, GLADE.iron, { rough: 0.6, metal: 0.28 });
  const hoop = new t.Mesh(hoopGeo, hoopMat);
  hoop.rotation.y = 0.4;
  hoop.position.set(0, 0.3 * s, 0);
  hoop.userData.lodDetail = true;
  bag.geos.push(hoopGeo);
  grp.add(hoop);
  const glass = plain(t, bag, GLADE.lampGlass, { rough: 0.3, emissive: THORNWICK.lantern });
  glass.emissiveIntensity = 0.05;
  const globeGeo = new t.SphereGeometry(0.058 * s, 12, 9);
  const globe = new t.Mesh(globeGeo, glass);
  globe.castShadow = false;
  bag.geos.push(globeGeo);
  grp.add(globe);
  return { group: grp, glass };
}

/** disposal, uniform across all five pieces */
const disposeBag = (bag: Bag) => () => {
  bag.texes.forEach((x) => x.dispose());
  bag.mats.forEach((m) => m.dispose());
  bag.geos.forEach((g) => {
    if (!g.userData.shared) g.dispose();
  });
};

// ===========================================================================
// 1. <GiantToadstools> — THE WORLD'S SIGNATURE
// ===========================================================================
//
// MoonlitBarge's toadstool hollow is ground cover (caps ~0.1 across); this is
// the same species grown to HOUSE HEIGHT, so it has to answer the questions a
// small one never does: what does the underside look like, and what is holding
// it up. Hence, per stool:
//
//   * a BULBOUS FOOT and a curved, tapering STIPE built as a bending limb, with
//     an ANNULUS (the torn skirt of the veil) on the big ones — the single
//     feature that says "mushroom" rather than "umbrella";
//   * a real DOME cap (a sphere cut a little past its equator, then squashed —
//     never a cone; a cone reads as a traffic bollard) with a rolled RIM torus
//     so the cap has thickness, because a bare hemisphere reads as a bowl;
//   * radial GILL blades under it. At this scale the underside is the first
//     thing a park camera sees when it looks up, and a blank disc there is the
//     whole illusion gone;
//   * hashed WARTS on the crown (amanita), in cream.
//
// One cap per clump is the PALE GLOWING one — a muted bone diffuse that happens
// to be emissive, so the clump lights up after dark without any of the caps
// reading as a white blob at noon. Glow-worms crust the hero stipe and the
// loam ring. Budget: 1 opt-out PointLight.
// ===========================================================================

export interface GiantToadstoolsOpts {
  /** clump footprint radius (default 0.72) */
  radius?: number;
  /** the TALLEST cap's crown height (default 1.5 — this piece is hero-sized) */
  height?: number;
  seed?: number;
  /** number of full-sized stools, clamped 1…9 (default 5) */
  count?: number;
  /** the pale glowing cap + the glow-worm crust (default true) */
  glow?: boolean;
  /** ONE warm-green PointLight under the glowing cap (default true) */
  light?: boolean;
}

export interface GiantToadstoolsBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** footprint radius (blocker + clearance) */
  radius: number;
  /** the tallest crown actually reached */
  height: number;
}

/** the giant toadstool clump. Group origin on the ground at the clump centre. */
export function buildGiantToadstools(t: typeof THREE, opts: GiantToadstoolsOpts = {}): GiantToadstoolsBuilt {
  const R = Math.max(0.2, opts.radius ?? 0.72);
  const H = Math.max(0.4, opts.height ?? 1.5);
  const seed = opts.seed ?? 1;
  const N = Math.max(1, Math.min(9, Math.round(opts.count ?? 5)));
  const wantGlow = opts.glow ?? true;
  const group = new t.Group();
  group.name = 'giant-toadstools';
  const bag = newBag();
  const h = (n: number) => hash01(seed * 1.77 + n * 3.19);

  const stipes: PartSpec[] = [];
  const rings: PartSpec[] = [];
  const capsRed: PartSpec[] = [];
  const capsViolet: PartSpec[] = [];
  const capsGlow: PartSpec[] = [];
  const rimsRed: PartSpec[] = [];
  const rimsViolet: PartSpec[] = [];
  const gills: MergedBoxSpec[] = [];
  const warts: PartSpec[] = [];
  /** where the glowing cap ended up, for the PointLight */
  let glowAt: [number, number, number] | null = null;
  let tallest = 0;
  /** every cap's centre + radius, so the babies and the loam can dodge them */
  const capAt: { x: number; y: number; z: number; r: number }[] = [];

  const glowIdx = wantGlow ? Math.floor(h(2) * N) % N : -1;

  for (let i = 0; i < N; i += 1) {
    // the FIRST stool is the hero and stands near the middle; the rest ring it
    const sf = i === 0 ? 1 : 0.34 + h(i * 7 + 3) * 0.44;
    const az = (i / N) * Math.PI * 2 + h(i * 11 + 4) * 1.1;
    const rr = i === 0 ? R * 0.1 : R * (0.36 + h(i * 13 + 5) * 0.5);
    const fx = Math.cos(az) * rr;
    const fz = Math.sin(az) * rr;
    const capR = R * 0.5 * sf;
    const crown = H * (i === 0 ? 1 : 0.34 + sf * 0.6);
    const stipeLen = Math.max(0.12, crown - 0.72 * capR);
    const stipeR0 = capR * 0.36;
    const stipeR1 = capR * 0.21;

    // the stipe leans OUT of the clump and then straightens — a real stipe
    // curves toward the light and no two in a clump are parallel
    const outward = new t.Vector3(Math.cos(az), 0, Math.sin(az));
    const lean = 0.1 + h(i * 17 + 6) * 0.26;
    const dir0 = new t.Vector3(0, 1, 0).addScaledVector(outward, lean).normalize();
    const bend = outward.clone().multiplyScalar(-lean * 1.25);
    const foot = new t.Vector3(fx, 0, fz);
    const { tip } = limb(t, stipes, foot, dir0, stipeLen * 1.03, stipeR0, stipeR1, 5, bend, [1, 3]);

    // the BULBOUS FOOT — a real amanita swells into a bulb at the ground
    stipes.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(t, [fx, stipeR0 * 0.55, fz], [0, h(i * 19) * 3, 0], [stipeR0 * 1.7, stipeR0 * 1.5, stipeR0 * 1.7]),
      uv: [2, 2],
    });

    // THE ANNULUS — the torn skirt of the veil, on anything over half size
    if (sf > 0.5) {
      const ay = stipeLen * 0.66;
      const along = tip.clone().sub(foot).normalize();
      const ap = foot.clone().addScaledVector(along, ay);
      const ringGeo = new t.TorusGeometry(capR * 0.4, capR * 0.055, 6, 14);
      rings.push({ geo: ringGeo, matrix: mtx(t, [ap.x, ap.y, ap.z], [Math.PI / 2 + (h(i * 23) - 0.5) * 0.3, h(i * 29) * 3, 0], [1, 1, 0.55]) });
    }

    // ---- THE CAP: a dome, a rolled rim, gills, warts --------------------
    const capY = tip.y;
    const sy = 0.68 + h(i * 31) * 0.14;
    const capYaw = h(i * 37) * Math.PI;
    const domeGeo = new t.SphereGeometry(capR, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const domeM = mtx(t, [tip.x, capY, tip.z], [0, capYaw, 0], [1, sy, 1]);
    const isGlow = i === glowIdx;
    const violet = !isGlow && h(i * 41) > 0.55;
    (isGlow ? capsGlow : violet ? capsViolet : capsRed).push({ geo: domeGeo, matrix: domeM, uv: [3, 2] });
    // the ROLLED RIM: without it the dome edge is a paper-thin shell
    const rimGeo = new t.TorusGeometry(capR * 0.955, capR * 0.062, 5, 14);
    const rimY = capY - capR * sy * 0.15;
    const rimM = mtx(t, [tip.x, rimY, tip.z], [Math.PI / 2, 0, 0], [1, 1, 1]);
    (violet && !isGlow ? rimsViolet : rimsRed).push({ geo: rimGeo, matrix: rimM });

    // GILLS: radial blades under the dome, sloping down to the rim
    const NG = 10 + Math.round(sf * 12);
    for (let k = 0; k < NG; k += 1) {
      const ga = (k / NG) * Math.PI * 2 + capYaw;
      const inner = new t.Vector3(tip.x + Math.cos(ga) * capR * 0.2, capY - capR * sy * 0.02, tip.z + Math.sin(ga) * capR * 0.2);
      const outer = new t.Vector3(tip.x + Math.cos(ga) * capR * 0.9, rimY + capR * 0.02, tip.z + Math.sin(ga) * capR * 0.9);
      gills.push(bladeSpec(t, inner, outer, capR * 0.075, capR * 0.012, [1, 1]));
    }

    // WARTS on the crown — hashed cream flecks, an amanita's whole read
    if (!isGlow) {
      for (let k = 0; k < 7; k += 1) {
        const wa = h(i * 43 + k * 1.7) * Math.PI * 2;
        const wr = capR * 0.86 * Math.sqrt(h(i * 47 + k * 2.3));
        const wy = capY + Math.sqrt(Math.max(0, 1 - (wr / capR) ** 2)) * capR * sy;
        const ws = capR * (0.07 + h(i * 53 + k) * 0.06);
        warts.push({
          geo: new t.IcosahedronGeometry(1, 0),
          matrix: mtx(t, [tip.x + Math.cos(wa) * wr, wy - ws * 0.3, tip.z + Math.sin(wa) * wr], [0, wa, 0], [ws, ws * 0.5, ws]),
        });
      }
    }

    capAt.push({ x: tip.x, y: capY, z: tip.z, r: capR });
    tallest = Math.max(tallest, capY + capR * sy);
    if (isGlow) glowAt = [tip.x, capY - capR * 0.3, tip.z];
  }

  // ---- BABY STOOLS: two or three little ones at the feet, which is what
  // makes the giants read as giants (nothing says scale like the same thing
  // small beside it)
  for (let i = 0; i < 3; i += 1) {
    const az = h(i * 59 + 7) * Math.PI * 2;
    const rr = R * (0.72 + h(i * 61) * 0.4);
    const bx = Math.cos(az) * rr;
    const bz = Math.sin(az) * rr;
    const br = R * (0.05 + h(i * 67) * 0.045);
    const bh = br * (1.6 + h(i * 71) * 1.4);
    const foot = new t.Vector3(bx, 0, bz);
    const lean = new t.Vector3((h(i * 73) - 0.5) * 0.5, 1, (h(i * 79) - 0.5) * 0.5).normalize();
    const { tip } = limb(t, stipes, foot, lean, bh, br * 0.4, br * 0.3, 2, new t.Vector3(0, 0, 0), [1, 2]);
    const domeGeo = new t.SphereGeometry(br, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.56);
    (h(i * 83) > 0.5 ? capsViolet : capsRed).push({
      geo: domeGeo,
      matrix: mtx(t, [tip.x, tip.y, tip.z], [0, h(i * 89) * 3, 0], [1, 0.72, 1]),
      uv: [1, 1],
    });
  }

  // ---- the loam and moss ring, and a FALLEN CAP going soft on the ground
  const groundParts: PartSpec[] = [];
  groundMound(t, groundParts, R * 1.05, R * 1.05, 0.085, seed + 4, 10);
  const loamMat = texMat(t, bag, GLADE.loam, 'concrete', [4, 4], { rough: 1, bump: 0.06, flat: true });
  const loam = mergedParts(t, groundParts, loamMat);
  loam.receiveShadow = true;
  bag.geos.push(loam.geometry);
  group.add(loam);

  const mossParts: PartSpec[] = [];
  mossLumps(t, mossParts, { n: 34, seed: seed + 9, r0: R * 0.18, r1: R * 1.06, y: 0.02, size: R * 0.17 });
  const mossMesh = mergedParts(t, mossParts, texMat(t, bag, THORNWICK.moss, 'grass', [1, 1], { rough: 0.96, bump: 0.06, flat: true }));
  mossMesh.castShadow = false;
  bag.geos.push(mossMesh.geometry);
  group.add(mossMesh);

  // A FALLEN CAP going soft in the moss, with the broken stipe beside it. It
  // lies CONVEX-UP and tilted: an upside-down open hemisphere shows the camera
  // its backfaces, and the first pass at rotX 0.86π rendered as a red ribbon.
  {
    const fa = h(97) * Math.PI * 2;
    const fr = R * 0.92;
    const fcR = R * 0.21;
    const fx = Math.cos(fa) * fr;
    const fz = Math.sin(fa) * fr;
    const tilt = 0.34;
    capsRed.push({
      geo: new t.SphereGeometry(fcR, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56),
      matrix: mtx(t, [fx, fcR * 0.13, fz], [tilt, h(101) * 3, 0.2], [1.12, 0.4, 1.12]),
      uv: [2, 2],
    });
    rimsRed.push({
      geo: new t.TorusGeometry(fcR * 1.0, fcR * 0.07, 6, 16),
      matrix: mtx(t, [fx, fcR * 0.08, fz], [Math.PI / 2 + tilt, 0, 0.2]),
    });
    // the snapped stipe, lying alongside — a cap with nothing under it reads as
    // a dropped bowl
    const sa = fa + 0.9 + h(103) * 0.8;
    stipes.push({
      geo: new t.CylinderGeometry(fcR * 0.3, fcR * 0.34, fcR * 1.5, 7, 1),
      matrix: mtx(t, [fx + Math.cos(sa) * fcR * 1.3, fcR * 0.3, fz + Math.sin(sa) * fcR * 1.3], [0, -sa, Math.PI / 2 + 0.12], [1, 1, 1]),
      uv: [1, 2],
    });
  }

  // ---- FERNS at the feet: three tufts of five blades. Scattered singles read
  // as confetti (Tidewater's weed lesson); a tuft reads as undergrowth.
  const fronds: MergedBoxSpec[] = [];
  for (let c = 0; c < 3; c += 1) {
    const ca = h(c * 103 + 11) * Math.PI * 2;
    const cr = R * (0.6 + h(c * 107) * 0.55);
    const base = new t.Vector3(Math.cos(ca) * cr, 0.02, Math.sin(ca) * cr);
    for (let k = 0; k < 5; k += 1) {
      const fa = (k / 5) * Math.PI * 2 + h(c * 109 + k) * 0.9;
      const len = R * (0.2 + h(c * 113 + k) * 0.22);
      fronds.push(
        bladeSpec(
          t,
          base,
          base.clone().add(new t.Vector3(Math.cos(fa) * len * 0.55, len, Math.sin(fa) * len * 0.55)),
          R * 0.085,
          0.012,
        ),
      );
    }
  }
  const fernMesh = mergedBoxes(t, fronds, GLADE.fern, { tex: 'leaf', repeat: [1, 1], rough: 0.9, bump: 0.04 });
  fernMesh.userData.lodDetail = true;
  bag.geos.push(fernMesh.geometry);
  bag.mats.push(fernMesh.material as THREE.Material);
  group.add(fernMesh);

  // ---- the merged meshes, one per material -------------------------------
  const add = (parts: PartSpec[], m: THREE.Material, lod = false, shadow = true) => {
    if (!parts.length) return null;
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = shadow;
    if (lod) mesh.userData.lodDetail = true;
    bag.geos.push(mesh.geometry);
    group.add(mesh);
    return mesh;
  };
  add(stipes, texMat(t, bag, GLADE.stipe, 'fabric', [1, 1], { rough: 0.94, bump: 0.035 }));
  add(rings, plain(t, bag, GLADE.stipeShade, { rough: 0.9 }), true);
  add(capsRed, texMat(t, bag, GLADE.capRed, 'leaf', [1, 1], { rough: 0.72, bump: 0.045 }));
  add(rimsRed, plain(t, bag, GLADE.capRedDeep, { rough: 0.78 }));
  add(capsViolet, texMat(t, bag, GLADE.capViolet, 'leaf', [1, 1], { rough: 0.74, bump: 0.045 }));
  add(rimsViolet, plain(t, bag, 0x4c3856, { rough: 0.8 }));
  add(warts, plain(t, bag, GLADE.wart, { rough: 0.85, flat: true }), true);
  const gillMesh = mergedBoxes(t, gills, GLADE.gill, { rough: 0.9 });
  gillMesh.userData.lodDetail = true;
  gillMesh.castShadow = false;
  bag.geos.push(gillMesh.geometry);
  bag.mats.push(gillMesh.material as THREE.Material);
  group.add(gillMesh);

  // ---- THE GLOWING CAP: a muted bone diffuse that happens to be emissive --
  /** [material, its share of `glowK`] — the CAP takes half, because a cap is a
   *  broad flat surface and a full-strength emissive on it renders as a solid
   *  white-green DISC with no form in it at all (the first night shot). The
   *  glow-worm grains are tiny and take the full value. */
  const glowMats: [THREE.MeshStandardMaterial, number][] = [];
  if (capsGlow.length) {
    const gm = plain(t, bag, GLADE.capPale, { rough: 0.55, emissive: GLADE.worm });
    gm.emissiveIntensity = GLOW_DAY * 0.5;
    glowMats.push([gm, 0.5]);
    const mesh = mergedParts(t, capsGlow, gm);
    mesh.castShadow = false;
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }

  // ---- GLOW-WORMS: up the hero stipe and round the loam ring -------------
  if (wantGlow) {
    const hero = capAt.length ? capAt[0] : { x: 0, y: H * 0.6, z: 0, r: R * 0.5 };
    const worms = glowWormCrust(t, {
      count: 54,
      seed: seed + 21,
      size: R * 0.026,
      at: (i, hh) => {
        if (i < 22) {
          // spiralling up the hero's stipe
          const u = i / 22;
          const a = u * 7.2 + hh(1) * 0.7;
          const rr = (hero.r * 0.36) * (1 - u * 0.36) + 0.006;
          return [hero.x * u + Math.cos(a) * rr, 0.06 + u * (hero.y - 0.12), hero.z * u + Math.sin(a) * rr];
        }
        const a = hh(2) * Math.PI * 2;
        const rr = R * (0.28 + hh(3) * 1.0);
        return [Math.cos(a) * rr, 0.045 + hh(4) * 0.05, Math.sin(a) * rr];
      },
    });
    bag.geos.push(worms.mesh.geometry);
    bag.mats.push(worms.material);
    glowMats.push([worms.material, 1]);
    group.add(worms.mesh);
  }

  // ---- ONE PointLight under the glowing cap ------------------------------
  let lamp: THREE.PointLight | null = null;
  if ((opts.light ?? true) && glowAt) {
    lamp = new t.PointLight(GLADE.worm, 0, Math.max(1.6, R * 4.2), 2);
    lamp.position.set(glowAt[0], glowAt[1], glowAt[2]);
    group.add(lamp);
  }

  const update = (time: number) => {
    const k = glowK(group);
    // a slow living breath, phase-offset per material so the clump is not one bulb
    for (let i = 0; i < glowMats.length; i += 1) {
      const breathe = 1 + 0.13 * Math.sin(time * 0.62 + i * 2.1) + 0.07 * Math.sin(time * 1.17 + i * 0.7);
      glowMats[i][0].emissiveIntensity = k * glowMats[i][1] * breathe;
    }
    if (lamp) lamp.intensity = (0.04 + 0.42 * nightKOf(group)) * (1 + 0.1 * Math.sin(time * 0.62));
  };

  return {
    group,
    radius: R * 1.3,
    height: tallest,
    update,
    dispose() {
      lamp?.dispose();
      disposeBag(bag)();
    },
  };
}

// ===========================================================================
// 2. <StandingStones> — the mossy megalith ring
// ===========================================================================
//
// A megalith is not a box. Each stone here is a STACK of three to five hashed
// blocks under one lean, so its silhouette steps and bulges the way split rock
// does, and none of them is plumb. One stone in the ring is FALLEN — flat on
// the ground and half sunk, moss growing over its upper face — because a
// complete ring reads as a fence, and one gap is the whole difference between
// "ruin" and "boundary marker". Another has its top SNAPPED OFF, with the
// broken piece lying beside its foot.
//
// The night payoff costs no PointLight: a SPIRAL of carved runes down the
// tallest stone's inward face, in a material whose emissive is lerped by
// `nightKOf`. By day it is a shadowed carving; after dark it is the only cold
// light in a warm-lantern world. (The rune mesh is deliberately NOT tagged
// `lodDetail` — that is the piece's night read, and MID-tier LOD would shed it
// at exactly park distance.)
// ===========================================================================

export interface StandingStonesOpts {
  /** ring radius (default 0.85) */
  radius?: number;
  /** the tallest stone (default 1.35) */
  height?: number;
  seed?: number;
  /** stones in the ring, clamped 2…9 (default 5) — ONE of them is the fallen */
  count?: number;
  /** the carved runes on the tallest stone, and their night glow (default true) */
  runes?: boolean;
}

export interface StandingStonesBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  radius: number;
  height: number;
}

/** the standing-stone ring. Group origin on the ground at the ring centre. */
export function buildStandingStones(t: typeof THREE, opts: StandingStonesOpts = {}): StandingStonesBuilt {
  const R = Math.max(0.22, opts.radius ?? 0.85);
  const H = Math.max(0.3, opts.height ?? 1.35);
  const seed = opts.seed ?? 2;
  const N = Math.max(2, Math.min(9, Math.round(opts.count ?? 5)));
  const group = new t.Group();
  group.name = 'standing-stones';
  const bag = newBag();
  const h = (n: number) => hash01(seed * 2.13 + n * 3.71);

  const stone: PartSpec[] = [];
  const stoneDark: PartSpec[] = [];
  /** moss on VERTICAL faces: flat plates, which is what a patch on a wall is */
  const moss: MergedBoxSpec[] = [];
  /** moss on HORIZONTALS (crowns, the fallen stone, the clearing floor):
   *  squashed LUMPS. A flat plate on a stone top reads as a green floor tile —
   *  the first render of this pack put one big plate on every crown and the
   *  ring read as five chimneys with astroturf hats. */
  const mossBlob: PartSpec[] = [];
  const lichen: PartSpec[] = [];
  const runes: PartSpec[] = [];
  /** the tallest STANDING stone: [x, z, yaw, top] — the runes go on it */
  let tallest = { x: 0, z: 0, yaw: 0, top: 0, w: 0.3 };

  const fallenIdx = N >= 3 ? Math.floor(h(3) * N) % N : -1;
  const snappedIdx = N >= 2 ? (fallenIdx + 1 + Math.floor(h(5) * Math.max(1, N - 1))) % N : -1;

  for (let i = 0; i < N; i += 1) {
    const az = (i / N) * Math.PI * 2 + (h(i * 7 + 11) - 0.5) * 0.34;
    const rr = R * (0.9 + h(i * 11 + 13) * 0.2);
    const sx = Math.cos(az) * rr;
    const sz = Math.sin(az) * rr;
    // every stone's broad face turns toward the ring centre, then jitters
    const yaw = -az + Math.PI / 2 + (h(i * 13 + 17) - 0.5) * 0.5;
    // SLABS, not columns. The first pass at 0.3-0.5 R wide and half as deep
    // gave a 3.5:1 height-to-width stone, which renders as a chimney; a real
    // megalith is a broad thin SLAB, wider than it is deep and only ~2.5:1 tall.
    const w = R * (0.44 + h(i * 17 + 19) * 0.3);
    const d = w * (0.34 + h(i * 19 + 23) * 0.2);
    const snapped = i === snappedIdx;
    const total = H * (0.6 + h(i * 23 + 29) * 0.46) * (snapped ? 0.66 : 1);

    if (i === fallenIdx) {
      // ---- THE FALLEN STONE: on its side, half sunk, pointing out of the ring
      const flat = total * 0.9;
      const lieYaw = -az + (h(i * 29) - 0.5) * 0.7;
      const base = new t.Matrix4()
        .makeRotationFromEuler(new t.Euler(0, lieYaw, Math.PI / 2 + (h(i * 31) - 0.5) * 0.14, 'YXZ'))
        .setPosition(sx, d * 0.34, sz);
      let along = -flat * 0.5;
      let k = 0;
      while (along < flat * 0.5 - 0.02) {
        const bh = flat * (0.24 + h(i * 37 + k * 3.1) * 0.18);
        const seg = Math.min(bh, flat * 0.5 - along);
        const m = base.clone().multiply(mtx(t, [(h(i + k * 5.3) - 0.5) * 0.03, along + seg / 2, (h(i + k * 7.1) - 0.5) * 0.03], [0, (h(i + k * 9) - 0.5) * 0.12, 0]));
        (h(i * 41 + k) > 0.6 ? stoneDark : stone).push(boxAtMatrix(t, [w * (0.86 + h(i + k) * 0.2), seg * 1.02, d], m, [1, 1]));
        along += seg;
        k += 1;
      }
      // moss over its upper face, which is where moss actually grows
      for (let mi = 0; mi < 10; mi += 1) {
        const u = (h(i * 149 + mi * 2.1) - 0.5) * flat * 0.9;
        const v = (h(i * 151 + mi * 3.3) - 0.5) * d * 0.7;
        const ms = w * (0.1 + h(i * 157 + mi) * 0.14);
        mossBlob.push({
          geo: new t.IcosahedronGeometry(1, 1),
          matrix: mtx(
            t,
            [sx + Math.cos(lieYaw) * u - Math.sin(lieYaw) * v, d * 0.34 + w * 0.48, sz - Math.sin(lieYaw) * u - Math.cos(lieYaw) * v],
            [0, h(i * 163 + mi) * Math.PI, 0],
            [ms, ms * 0.3, ms * 0.8],
          ),
          uv: [1, 1],
        });
      }
      continue;
    }

    // ---- A STANDING STONE: a stack of hashed blocks under one lean --------
    const tilt = (h(i * 43 + 31) - 0.5) * 0.17;
    const tiltX = (h(i * 47 + 37) - 0.5) * 0.11;
    const base = new t.Matrix4().makeRotationFromEuler(new t.Euler(tiltX, yaw, tilt, 'YXZ')).setPosition(sx, -0.1, sz);
    let y = 0;
    let k = 0;
    while (y < total) {
      const bh = Math.min(total - y, total * (0.2 + h(i * 53 + k * 2.7) * 0.2) + 0.06);
      // the stone TAPERS as it rises, the way a split slab does
      const taper = 1 - (y / total) * (0.16 + h(i * 59) * 0.16);
      const m = base.clone().multiply(
        mtx(t, [(h(i * 61 + k * 3.3) - 0.5) * w * 0.09, y + bh / 2, (h(i * 67 + k * 4.1) - 0.5) * d * 0.12], [0, (h(i * 71 + k) - 0.5) * 0.13, 0]),
      );
      // uv [1, 1] — ONE tile of the lichen canvas per block. The first pass
      // tiled it 2 x (5·height) and the crack lines lined up into COURSES: five
      // brick chimneys instead of five split megaliths. A megalith is one rock.
      (h(i * 73 + k * 5.9) > 0.62 ? stoneDark : stone).push(boxAtMatrix(t, [w * taper, bh * 1.03, d * taper], m, [1, 1]));
      y += bh;
      k += 1;
    }
    if (snapped) {
      // the broken piece, lying at the foot — a snapped top with nothing under
      // it just reads as a short stone
      const ba = az + 0.5 + h(i * 79) * 0.8;
      stoneDark.push(
        boxPart(
          t,
          [w * 0.8, total * 0.26, d * 0.9],
          [sx + Math.cos(ba) * (w * 0.9 + 0.1), total * 0.1, sz + Math.sin(ba) * (w * 0.9 + 0.1)],
          [0.4 + h(i * 83) * 0.5, ba, 0.25],
          [2, 1],
        ),
      );
    }

    if (total > tallest.top) tallest = { x: sx, z: sz, yaw, top: total, w };

    // MOSS: the shaded face and the crown. Moss goes on the north side and on
    // horizontals — a stone furred evenly all round reads as a topiary.
    const mossN = 6 + Math.floor(h(i * 89) * 4);
    for (let mi = 0; mi < mossN; mi += 1) {
      const my = total * (0.05 + h(i * 97 + mi * 2.3) * 0.85);
      const face = h(i * 101 + mi) > 0.35 ? -1 : 1; // biased to one side
      const m = base.clone().multiply(
        mtx(
          t,
          [(h(i * 103 + mi) - 0.5) * w * 0.8, my, face * (d * 0.5 + 0.008)],
          [0, 0, 0],
        ),
      );
      moss.push({ dims: [w * (0.2 + h(i * 107 + mi) * 0.3), total * (0.06 + h(i * 109 + mi) * 0.1), 0.022], matrix: m });
    }
    // moss on the crown: THREE small lumps, never one plate
    for (let ci = 0; ci < 3; ci += 1) {
      const ms = w * (0.12 + h(i * 113 + ci * 2.7) * 0.14);
      mossBlob.push({
        geo: new t.IcosahedronGeometry(1, 1),
        matrix: base.clone().multiply(
          mtx(
            t,
            [(h(i * 117 + ci) - 0.5) * w * 0.55, total + ms * 0.1, (h(i * 119 + ci) - 0.5) * d * 0.5],
            [0, h(i * 121 + ci) * Math.PI, 0],
            [ms, ms * 0.32, ms * 0.72],
          ),
        ),
        uv: [1, 1],
      });
    }
    // LICHEN: little raised CRUSTS, close-up only. Not plates — the first pass
    // put pale flat boxes on the faces and they read as sticky labels stuck on
    // the stone. The rosette pattern already lives in `lichenCanvas`; these are
    // just the few crusts that stand proud enough to catch a highlight.
    for (let li = 0; li < 8; li += 1) {
      const ly = total * h(i * 127 + li * 1.9);
      const side = li % 4;
      const off: [number, number, number] =
        side === 0
          ? [w * 0.5, ly, (h(i * 131 + li) - 0.5) * d * 0.8]
          : side === 1
            ? [-w * 0.5, ly, (h(i * 137 + li) - 0.5) * d * 0.8]
            : side === 2
              ? [(h(i * 139 + li) - 0.5) * w * 0.8, ly, d * 0.5]
              : [(h(i * 149 + li) - 0.5) * w * 0.8, ly, -d * 0.5];
      // SMALL, DULL and SUNK. At 0.06-0.15 w and proud of the face these read
      // as white pebbles stuck to the rock (or worse, as bird droppings); the
      // rosette pattern is already in `lichenCanvas` and this is only the few
      // crusts thick enough to catch a rim highlight.
      const ls = w * (0.045 + h(i * 151 + li) * 0.055);
      const sink = 0.55; // fraction of the crust left inside the stone
      const off2: [number, number, number] = [
        off[0] - Math.sign(off[0]) * (Math.abs(off[0]) > w * 0.4 ? ls * sink * 0.34 : 0),
        off[1],
        off[2] - Math.sign(off[2]) * (Math.abs(off[2]) > d * 0.4 ? ls * sink * 0.34 : 0),
      ];
      lichen.push({
        geo: new t.IcosahedronGeometry(1, 1),
        matrix: base.clone().multiply(mtx(t, off2, [0, h(i * 163 + li) * 3, 0], [ls, ls * (0.7 + h(i * 157 + li) * 0.5), ls * 0.3])),
        uv: [1, 1],
      });
    }
    // a little KERB of packed earth stones at the foot, so it is planted
    for (let ki = 0; ki < 5; ki += 1) {
      const ka = h(i * 167 + ki * 2.1) * Math.PI * 2;
      const kr = w * (0.55 + h(i * 173 + ki) * 0.45);
      const ks = w * (0.12 + h(i * 179 + ki) * 0.12);
      stoneDark.push({
        geo: new t.IcosahedronGeometry(1, 0),
        matrix: mtx(t, [sx + Math.cos(ka) * kr, ks * 0.32, sz + Math.sin(ka) * kr], [0, ka, 0], [ks, ks * 0.6, ks * 0.9]),
        uv: [1, 1],
      });
    }
  }

  // ---- THE RUNES: an archimedean spiral of little carved grooves down the
  // tallest stone's inward face, plus three chevrons under it
  if ((opts.runes ?? true) && tallest.top > 0) {
    const fx = tallest.x;
    const fz = tallest.z;
    const inward = Math.atan2(-fz, -fx);
    const nx = Math.cos(inward);
    const nz = Math.sin(inward);
    // the face plane, pushed a hair out of the stone
    const push = tallest.w * 0.34;
    const centreY = tallest.top * 0.62;
    const spiralR = Math.min(tallest.w * 0.36, tallest.top * 0.16);
    for (let k = 0; k < 22; k += 1) {
      const u = k / 21;
      const a = u * Math.PI * 3.1;
      const rr = spiralR * (0.14 + u * 0.86);
      const su = Math.cos(a) * rr;
      const sv = Math.sin(a) * rr;
      const m = new t.Matrix4().makeRotationFromEuler(new t.Euler(0, inward + Math.PI / 2, a, 'YXZ'));
      m.setPosition(fx + nx * push - nz * su, centreY + sv, fz + nz * push + nx * su);
      runes.push(boxAtMatrix(t, [0.02, spiralR * 0.3, 0.012], m));
    }
    for (let k = 0; k < 3; k += 1) {
      const cy = centreY - spiralR * (1.5 + k * 0.42);
      for (const sgn of [-1, 1] as const) {
        const m = new t.Matrix4().makeRotationFromEuler(new t.Euler(0, inward + Math.PI / 2, sgn * 0.7, 'YXZ'));
        m.setPosition(fx + nx * push - nz * sgn * spiralR * 0.3, cy, fz + nz * push + nx * sgn * spiralR * 0.3);
        runes.push(boxAtMatrix(t, [0.02, spiralR * 0.8, 0.012], m));
      }
    }
  }

  // ---- the loam ring the circle stands in --------------------------------
  const groundParts: PartSpec[] = [];
  groundMound(t, groundParts, R * 0.95, R * 0.95, 0.05, seed + 5, 18);
  const loamMat = texMat(t, bag, GLADE.loam, 'concrete', [4, 4], { rough: 1, bump: 0.06, flat: true });
  const loam = mergedParts(t, groundParts, loamMat);
  bag.geos.push(loam.geometry);
  group.add(loam);
  mossLumps(t, mossBlob, { n: 26, seed: seed + 13, r0: R * 0.1, r1: R * 1.0, y: 0.018, size: R * 0.115 });

  // ---- GRASS TUFTS between the stones: the ring is in a clearing --------
  const blades: MergedBoxSpec[] = [];
  for (let c = 0; c < 6; c += 1) {
    const ca = h(c * 181 + 41) * Math.PI * 2;
    const cr = R * (0.5 + h(c * 191) * 0.75);
    const base = new t.Vector3(Math.cos(ca) * cr, 0.015, Math.sin(ca) * cr);
    for (let k = 0; k < 5; k += 1) {
      const ba = (k / 5) * Math.PI * 2 + h(c * 193 + k) * 1.1;
      const len = R * (0.13 + h(c * 197 + k) * 0.14);
      blades.push(bladeSpec(t, base, base.clone().add(new t.Vector3(Math.cos(ba) * len * 0.42, len, Math.sin(ba) * len * 0.42)), R * 0.05, 0.009));
    }
  }
  const grassMesh = mergedBoxes(t, blades, GLADE.fern, { tex: 'grass', repeat: [1, 1], rough: 0.94, bump: 0.03 });
  grassMesh.userData.lodDetail = true;
  bag.geos.push(grassMesh.geometry);
  bag.mats.push(grassMesh.material as THREE.Material);
  group.add(grassMesh);

  // ---- merged meshes -----------------------------------------------------
  if (stone.length) {
    const mesh = mergedParts(t, stone, stoneMat(t, bag, THORNWICK.stone, [2, 2], { rough: 0.95, bump: 0.08 }));
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }
  if (stoneDark.length) {
    const mesh = mergedParts(t, stoneDark, stoneMat(t, bag, THORNWICK.stoneDark, [2, 2], { rough: 0.96, bump: 0.08 }));
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }
  const mossMesh = mergedBoxes(t, moss, THORNWICK.mossDeep, { tex: 'grass', repeat: [1, 1], rough: 0.96, bump: 0.06, flat: true });
  mossMesh.castShadow = false;
  bag.geos.push(mossMesh.geometry);
  bag.mats.push(mossMesh.material as THREE.Material);
  group.add(mossMesh);
  if (mossBlob.length) {
    const blobMesh = mergedParts(t, mossBlob, texMat(t, bag, THORNWICK.moss, 'grass', [1, 1], { rough: 0.96, bump: 0.06, flat: true }));
    blobMesh.castShadow = false;
    bag.geos.push(blobMesh.geometry);
    group.add(blobMesh);
  }
  if (lichen.length) {
    const lichenMesh = mergedParts(t, lichen, plain(t, bag, 0x87907a, { rough: 0.95, flat: true }));
    lichenMesh.castShadow = false;
    lichenMesh.userData.lodDetail = true;
    bag.geos.push(lichenMesh.geometry);
    group.add(lichenMesh);
  }

  const runeMat = plain(t, bag, 0x4a5a52, { rough: 0.6, emissive: GLADE.rune });
  runeMat.emissiveIntensity = GLOW_DAY;
  if (runes.length) {
    const mesh = mergedParts(t, runes, runeMat);
    mesh.castShadow = false;
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }

  const update = (time: number) => {
    // the runes wake slowly and unevenly, like something remembering
    const k = glowK(group);
    runeMat.emissiveIntensity = k * (1 + 0.18 * Math.sin(time * 0.44) + 0.09 * Math.sin(time * 0.97 + 1.2));
  };

  return {
    group,
    radius: R * 1.34,
    height: Math.max(tallest.top, H * 0.6),
    update,
    dispose: disposeBag(bag),
  };
}

// ===========================================================================
// 3. <LanternTree> — the twisted tree hung with lanterns
// ===========================================================================
//
// The tree the glade's paths run under. The trunk is a bending, TWISTING limb
// (its lean rotates as it climbs, so the silhouette is never a pole), standing
// on six root FLARES with five surface roots crawling out across the loam.
// Five branches all reach up and OUT, and each carries THREE small flattened
// canopy lumps rather than one big sphere — few large spheres read as a
// lollipop whatever you rotate them to (MoonlitBarge's willow lesson).
//
// The lanterns are the point: wrought-iron cages on hooks, hung off the
// branches at four different heights, their glass gated hard to dark by day
// (a lamp with no flame in it is just a glass ball) — only the first two carry
// a real PointLight, the rest are emissive glass alone. Bracket fungi step up
// the trunk, moss furs its shaded side, and ivy (`buildIvyStrand`, shared from
// WyrmsHollow) hangs off three branches.
// ===========================================================================

export interface LanternTreeOpts {
  /** crown height (default 2.6) */
  height?: number;
  /** canopy spread radius (default 1.15) */
  spread?: number;
  seed?: number;
  /** hanging lanterns, clamped 1…8 (default 4) */
  count?: number;
  /** up to TWO real night-gated PointLights on the lowest lanterns (default true) */
  lights?: boolean;
  /** hanging ivy strands (default true) */
  ivy?: boolean;
}

export interface LanternTreeBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** the TRUNK+ROOT footprint — what a blocker should fence, not the canopy */
  radius: number;
  /** canopy spread, for a layout sizing overhead clearance */
  spread: number;
  height: number;
}

/** the lantern-hung twisted tree. Group origin on the ground at the trunk. */
export function buildLanternTree(t: typeof THREE, opts: LanternTreeOpts = {}): LanternTreeBuilt {
  const H = Math.max(0.6, opts.height ?? 2.6);
  const SP = Math.max(0.25, opts.spread ?? 1.15);
  const seed = opts.seed ?? 3;
  const NL = Math.max(1, Math.min(8, Math.round(opts.count ?? 4)));
  const group = new t.Group();
  group.name = 'lantern-tree';
  const bag = newBag();
  const h = (n: number) => hash01(seed * 2.57 + n * 4.11);

  const wood: PartSpec[] = [];
  const woodDark: PartSpec[] = [];
  const canopyA: PartSpec[] = [];
  const canopyB: PartSpec[] = [];
  const canopyC: PartSpec[] = [];
  const brackets: PartSpec[] = [];
  const moss: MergedBoxSpec[] = [];

  // ---- THE TRUNK: a limb whose lean ROTATES as it climbs ------------------
  const trunkH = H * 0.62;
  const rBase = Math.min(0.2, SP * 0.16);
  const lean0 = 0.16 + h(1) * 0.14;
  const twist = 1.5 + h(2) * 1.6; // radians of lean-direction rotation over the climb
  let p = new t.Vector3(0, 0, 0);
  let d = new t.Vector3(Math.cos(h(3) * 6.28) * lean0, 1, Math.sin(h(3) * 6.28) * lean0).normalize();
  const SEG = 7;
  const trunkNodes: { p: THREE.Vector3; d: THREE.Vector3; r: number }[] = [{ p: p.clone(), d: d.clone(), r: rBase }];
  for (let i = 0; i < SEG; i += 1) {
    const l = trunkH / SEG;
    const ra = rBase * (1 - (i / SEG) * 0.62);
    const rb = rBase * (1 - ((i + 1) / SEG) * 0.62);
    wood.push({ geo: new t.CylinderGeometry(rb, ra, l * 1.05, 9, 1), matrix: alongDir(t, p, d, l), uv: [3, 2] });
    p = p.clone().addScaledVector(d, l);
    // rotate the lean about Y and ease it toward vertical: a real twisted tree
    const a = (i + 1) / SEG;
    const la = h(3) * 6.28 + twist * a;
    const lean = lean0 * (1 - a * 0.45);
    d = new t.Vector3(Math.cos(la) * lean, 1, Math.sin(la) * lean).normalize();
    trunkNodes.push({ p: p.clone(), d: d.clone(), r: rb });
  }
  const crotch = trunkNodes[trunkNodes.length - 1];

  // ---- ROOT FLARES: six tapered buttresses at the foot -------------------
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + h(i * 5 + 7) * 0.5;
    const out = new t.Vector3(Math.cos(a), 0, Math.sin(a));
    const from = new t.Vector3(0, rBase * (1.4 + h(i * 7) * 0.9), 0).addScaledVector(out, rBase * 0.5);
    const to = out.clone().multiplyScalar(rBase * (1.5 + h(i * 11) * 1.4));
    to.y = 0.01;
    const dd = to.clone().sub(from);
    wood.push({
      geo: new t.CylinderGeometry(rBase * 0.14, rBase * 0.46, dd.length(), 7, 1),
      matrix: alongDir(t, from, dd, dd.length()),
      uv: [1, 2],
    });
  }
  // ---- SURFACE ROOTS crawling out over the loam --------------------------
  let rootReach = rBase * 2;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + h(i * 13 + 17) * 0.9;
    const out = new t.Vector3(Math.cos(a), 0, Math.sin(a));
    const len = rBase * (2.6 + h(i * 17) * 2.6);
    rootReach = Math.max(rootReach, len);
    limb(
      t,
      woodDark,
      new t.Vector3(out.x * rBase * 0.9, rBase * 0.34, out.z * rBase * 0.9),
      out.clone().setY(0.32).normalize(),
      len,
      rBase * 0.3,
      rBase * 0.08,
      4,
      new t.Vector3((h(i * 19) - 0.5) * 0.9, -0.5, (h(i * 23) - 0.5) * 0.9),
      [1, 3],
    );
  }

  // ---- FIVE BRANCHES, all reaching up and OUT ----------------------------
  /** [pos, alongDir] of the points a lantern may hang from */
  const hangs: { p: THREE.Vector3; r: number }[] = [];
  const NB = 5;
  for (let i = 0; i < NB; i += 1) {
    const u = 0.42 + (i / NB) * 0.58;
    const ni = Math.min(trunkNodes.length - 1, Math.max(0, Math.round(u * (trunkNodes.length - 1))));
    const node = trunkNodes[ni];
    const a = (i / NB) * Math.PI * 2 + h(i * 29 + 31) * 1.0;
    const out = new t.Vector3(Math.cos(a), 0, Math.sin(a));
    const rise = 0.5 + h(i * 31) * 0.5;
    const len = SP * (0.68 + h(i * 37) * 0.42);
    const from = node.p.clone().addScaledVector(out, node.r * 0.6);
    const { tip, dir } = limb(
      t,
      wood,
      from,
      out.clone().setY(rise).normalize(),
      len,
      node.r * 0.5,
      node.r * 0.17,
      4,
      new t.Vector3(out.x * 0.25, 0.55, out.z * 0.25),
      [2, 3],
    );
    // two twigs off the last third
    for (let k = 0; k < 2; k += 1) {
      const twigFrom = from.clone().lerp(tip, 0.62 + k * 0.2);
      const ta = a + (k ? 0.9 : -0.9) + h(i * 41 + k) * 0.5;
      limb(
        t,
        woodDark,
        twigFrom,
        new t.Vector3(Math.cos(ta) * 0.8, 0.6 + h(i * 43 + k) * 0.5, Math.sin(ta) * 0.8).normalize(),
        len * (0.3 + h(i * 47 + k) * 0.22),
        node.r * 0.16,
        node.r * 0.06,
        3,
        new t.Vector3(0, 0.4, 0),
        [1, 3],
      );
    }
    // CANOPY: FOUR small flattened lumps at the tip, never one big sphere.
    // Sized DOWN from the first pass (0.24-0.38 SP): four lumps that big per
    // branch tip merged into one solid dome that swallowed the trunk, the
    // branches, the roots and every lantern — from the park camera the whole
    // piece rendered as a heap of green balls.
    for (let k = 0; k < 4; k += 1) {
      const lr = SP * (0.15 + h(i * 53 + k * 2.1) * 0.11);
      const off = new t.Vector3(
        (h(i * 59 + k) - 0.5) * SP * 0.44,
        (h(i * 61 + k) - 0.5) * SP * 0.26 + lr * 0.3,
        (h(i * 67 + k) - 0.5) * SP * 0.44,
      );
      const c = tip.clone().add(off).addScaledVector(dir, lr * 0.3);
      const bucket = k === 0 ? canopyA : k === 1 ? canopyB : canopyC;
      bucket.push({
        geo: new t.IcosahedronGeometry(1, 1),
        matrix: mtx(
          t,
          [c.x, c.y, c.z],
          [(h(i * 71 + k) - 0.5) * 0.7, h(i * 73 + k) * Math.PI, (h(i * 79 + k) - 0.5) * 0.7],
          [lr, lr * (0.6 + h(i * 83 + k) * 0.22), lr * (0.85 + h(i * 89 + k) * 0.3)],
        ),
        uv: [2, 2],
      });
    }
    // this branch's lantern hang point. INBOARD (0.32-0.52 along), because a
    // lantern hung two-thirds out sits INSIDE the canopy and is never seen —
    // and its light belongs down where guests walk, not up in the leaves.
    const hp = from.clone().lerp(tip, 0.44 + h(i * 97) * 0.22);
    hangs.push({ p: hp, r: node.r * 0.3 });
  }
  // two more canopy lumps over the crotch, so the crown is not a hole
  for (let k = 0; k < 2; k += 1) {
    const lr = SP * (0.2 + h(k * 101) * 0.1);
    canopyB.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [crotch.p.x + (h(k * 103) - 0.5) * SP * 0.3, crotch.p.y + lr * 0.5, crotch.p.z + (h(k * 107) - 0.5) * SP * 0.3],
        [0, h(k * 109) * 3, 0],
        [lr, lr * 0.62, lr * 0.9],
      ),
      uv: [2, 2],
    });
  }

  // ---- BRACKET FUNGI stepping up the trunk -------------------------------
  for (let i = 0; i < 4; i += 1) {
    const u = 0.1 + h(i * 113 + 43) * 0.55;
    const ni = Math.min(trunkNodes.length - 1, Math.max(0, Math.round(u * (trunkNodes.length - 1))));
    const node = trunkNodes[ni];
    const a = h(i * 127) * Math.PI * 2;
    const br = node.r * (1.3 + h(i * 131) * 0.9);
    brackets.push({
      geo: new t.SphereGeometry(br, 10, 6, 0, Math.PI, 0, Math.PI * 0.5),
      matrix: mtx(t, [node.p.x + Math.cos(a) * node.r * 0.6, node.p.y, node.p.z + Math.sin(a) * node.r * 0.6], [0, -a + Math.PI / 2, 0], [1, 0.3, 1]),
      uv: [2, 1],
    });
  }
  // a dark KNOT HOLE on the trunk
  {
    const node = trunkNodes[Math.min(trunkNodes.length - 1, 2)];
    const a = h(137) * Math.PI * 2;
    woodDark.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [node.p.x + Math.cos(a) * node.r * 0.82, node.p.y + node.r * 0.4, node.p.z + Math.sin(a) * node.r * 0.82],
        [0, -a, 0],
        [node.r * 0.46, node.r * 0.7, node.r * 0.3],
      ),
      uv: [1, 1],
    });
  }

  // ---- MOSS up the trunk's shaded side, and on the roots -----------------
  for (let i = 0; i < 14; i += 1) {
    const u = h(i * 139 + 47) * 0.8;
    const ni = Math.min(trunkNodes.length - 1, Math.max(0, Math.round(u * (trunkNodes.length - 1))));
    const node = trunkNodes[ni];
    const a = -1.9 + h(i * 149) * 1.5; // biased to ONE side: moss grows north
    const mr = node.r * 1.02;
    moss.push({
      dims: [node.r * (0.5 + h(i * 151) * 0.5), trunkH * (0.05 + h(i * 157) * 0.07), 0.02],
      matrix: mtx(t, [node.p.x + Math.cos(a) * mr, node.p.y + (h(i * 163) - 0.5) * 0.08, node.p.z + Math.sin(a) * mr], [0, -a + Math.PI / 2, 0]),
    });
  }
  // ---- the loam ring, with moss LUMPS over it ----------------------------
  const groundParts: PartSpec[] = [];
  groundMound(t, groundParts, rootReach * 1.05, rootReach * 1.05, 0.08, seed + 3, 12);
  const loam = mergedParts(t, groundParts, texMat(t, bag, GLADE.loam, 'concrete', [4, 4], { rough: 1, bump: 0.06, flat: true }));
  bag.geos.push(loam.geometry);
  group.add(loam);
  const mossGround: PartSpec[] = [];
  mossLumps(t, mossGround, { n: 26, seed: seed + 7, r0: rBase * 0.9, r1: rootReach * 0.98, y: 0.022, size: rBase * 0.7 });
  const mossGroundMesh = mergedParts(t, mossGround, texMat(t, bag, THORNWICK.moss, 'grass', [1, 1], { rough: 0.96, bump: 0.06, flat: true }));
  mossGroundMesh.castShadow = false;
  bag.geos.push(mossGroundMesh.geometry);
  group.add(mossGroundMesh);

  // ---- THE LANTERNS ------------------------------------------------------
  const lampGlass: THREE.MeshStandardMaterial[] = [];
  const lamps: THREE.PointLight[] = [];
  const hookSpecs: MergedBoxSpec[] = [];
  // hang them off the LOWEST branches first, so the light lands where guests
  // walk instead of up in the canopy
  const order = hangs.map((x, i) => ({ i, y: x.p.y })).sort((a, b) => a.y - b.y);
  for (let k = 0; k < NL; k += 1) {
    const slot = order.length ? order[k % order.length] : null;
    if (!slot) break;
    const base = hangs[slot.i].p.clone();
    // stagger repeats so two lanterns off one branch do not overlap
    const dup = Math.floor(k / Math.max(1, order.length));
    const scale = 0.85 + h(k * 167) * 0.4;
    const drop = 0.3 + h(k * 173) * 0.2 + dup * 0.12;
    const off = new t.Vector3((h(k * 179) - 0.5) * 0.16 + dup * 0.14, 0, (h(k * 181) - 0.5) * 0.16);
    const anchor = base.clone().add(off);
    const lan = gladeLantern(t, bag, scale);
    lan.group.position.set(anchor.x, anchor.y - drop - 0.3 * scale, anchor.z);
    group.add(lan.group);
    lampGlass.push(lan.glass);
    // the hook + the hanging link: iron, thin, unmapped
    hookSpecs.push(barSpec(t, anchor.clone(), new t.Vector3(anchor.x, anchor.y - drop, anchor.z), 0.012));
    hookSpecs.push({ dims: [0.05, 0.014, 0.014], pos: [anchor.x, anchor.y + 0.01, anchor.z], rotY: h(k * 191) * 3 });
    if ((opts.lights ?? true) && lamps.length < 2) {
      const L = new t.PointLight(THORNWICK.lantern, 0, 4.2, 2);
      L.position.set(0, 0, 0);
      lan.group.add(L); // a CHILD of the fitting: it follows any placement
      lamps.push(L);
    }
  }
  const hookMesh = mergedBoxes(t, hookSpecs, GLADE.ironDark, { rough: 0.62, metal: 0.28 });
  bag.geos.push(hookMesh.geometry);
  bag.mats.push(hookMesh.material as THREE.Material);
  group.add(hookMesh);

  // ---- IVY off three branches (shared from WyrmsHollow) ------------------
  if ((opts.ivy ?? true)) {
    for (let k = 0; k < 3; k += 1) {
      const slot = hangs[(k * 2 + 1) % Math.max(1, hangs.length)];
      if (!slot) break;
      const strand = buildIvyStrand(t, 0.4 + h(k * 193) * 0.6, seed * 17 + k);
      strand.position.set(slot.p.x + (h(k * 197) - 0.5) * 0.24, slot.p.y - 0.03, slot.p.z + (h(k * 199) - 0.5) * 0.24);
      strand.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.isMesh) {
          bag.geos.push(mesh.geometry);
          bag.mats.push(mesh.material as THREE.Material);
        }
      });
      group.add(strand);
    }
  }

  // ---- GLOW-WORMS in the moss at the foot --------------------------------
  const worms = glowWormCrust(t, {
    count: 26,
    seed: seed + 31,
    size: 0.016,
    at: (i, hh) => {
      const a = hh(1) * Math.PI * 2;
      const rr = rootReach * (0.3 + hh(2) * 0.95);
      return [Math.cos(a) * rr, 0.05 + hh(3) * 0.06, Math.sin(a) * rr];
    },
  });
  bag.geos.push(worms.mesh.geometry);
  bag.mats.push(worms.material);
  group.add(worms.mesh);

  // ---- merged meshes -----------------------------------------------------
  const addP = (parts: PartSpec[], m: THREE.Material, lod = false, shadow = true) => {
    if (!parts.length) return;
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = shadow;
    if (lod) mesh.userData.lodDetail = true;
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  };
  addP(wood, texMat(t, bag, GLADE.bark, 'wood', [1, 1], { rough: 0.95, bump: 0.08 }));
  addP(woodDark, texMat(t, bag, GLADE.barkDark, 'wood', [1, 1], { rough: 0.96, bump: 0.07 }));
  addP(canopyA, texMat(t, bag, THORNWICK.ivy, 'leaf', [1, 1], { rough: 0.86, bump: 0.06, flat: true }));
  addP(canopyB, texMat(t, bag, THORNWICK.ivyLight, 'leaf', [1, 1], { rough: 0.86, bump: 0.06, flat: true }));
  addP(canopyC, texMat(t, bag, THORNWICK.mossDeep, 'leaf', [1, 1], { rough: 0.88, bump: 0.06, flat: true }));
  addP(brackets, plain(t, bag, GLADE.bracket, { rough: 0.9, flat: true }), true);
  const mossMesh = mergedBoxes(t, moss, THORNWICK.moss, { tex: 'grass', repeat: [1, 1], rough: 0.96, bump: 0.06, flat: true });
  mossMesh.castShadow = false;
  bag.geos.push(mossMesh.geometry);
  bag.mats.push(mossMesh.material as THREE.Material);
  group.add(mossMesh);

  const update = (time: number) => {
    // the lanterns are LAMPS: dark by day, then a slow flame flicker
    const lk = lanternK(group);
    for (let i = 0; i < lampGlass.length; i += 1) {
      const flick = 1 + 0.07 * Math.sin(time * 4.7 + i * 1.9) + 0.05 * Math.sin(time * 7.9 + i * 0.6);
      lampGlass[i].emissiveIntensity = 0.05 + (1.25 * flick - 0.05) * lk;
    }
    for (let i = 0; i < lamps.length; i += 1) lamps[i].intensity = lk * 0.9 * (1 + 0.08 * Math.sin(time * 4.7 + i * 1.9));
    // the glow-worms are ALIVE: lerped, never gated
    worms.material.emissiveIntensity = glowK(group) * (1 + 0.14 * Math.sin(time * 0.71));
  };

  return {
    group,
    radius: Math.max(rootReach * 1.1, rBase * 2.4),
    spread: SP * 1.45,
    height: crotch.p.y + SP * 0.75,
    update,
    dispose() {
      lamps.forEach((L) => L.dispose());
      disposeBag(bag)();
    },
  };
}

// ===========================================================================
// 4. <RuinedArch> — the broken stone arch over a path
// ===========================================================================
//
// ⚠️ THE ONE NUMBER THAT MATTERS: `makeRotationZ(-a)`, NOT `a - π/2`.
//
// MoonlitBarge built this world's first arch and its Context.md records the
// failure: a voussoir's long axis has to lie along the ring's TANGENT — that is
// what makes its joints radial. The tangent at ring angle `a` is `(sin a,
// cos a)`, and a Z rotation by θ sends a box's own +Y to `(−sin θ, cos θ)`, so
// **θ = −a**. The first pass used `a − π/2`, which is 90° out: every stone
// pointed along its own RADIUS and the "arch" rendered as a scatter of slabs
// standing on end with no ring in it at all. It took a render to see and one
// line to fix. This build was written with `−a` from the first keystroke and
// the ring was checked in the first render.
//
// This is NOT the barge's arch. That one straddles a water channel and its
// local y = 0 is the CHANNEL RAIL; this one straddles a footpath and its
// **y = 0 is the GROUND**, so a park drops it straight onto `floorAt`. Local
// +x is ACROSS the opening (so `rotation` aims the arch along the path), +z is
// the arch's thickness.
//
// An intact arch in a ruin is a GATE, so: one voussoir MISSING with a fern in
// the gap it left and the stone itself lying on the ground beside the pier, the
// extrados course snapped off down one haunch, ivy down both, moss on every
// horizontal, and an iron bracket lantern reaching out over the path.
//
// BLOCKERS: the two PIERS, not the arch. The whole point of an arch is that
// guests walk THROUGH it — one rect over the span would fence off the path it
// is decorating.
// ===========================================================================

export interface RuinedArchOpts {
  /** clear width of the opening at the springing (default 1.24) */
  opening?: number;
  /** springing height above the ground (default 0.9 — inner crown lands at
   *  springing + opening/2) */
  springing?: number;
  /** arch thickness along local +z (default 0.62) */
  depth?: number;
  seed?: number;
  /** voussoirs in the ring, clamped 7…19 (default 13) */
  count?: number;
  /** the iron bracket lantern (default true) */
  lamp?: boolean;
  /** ONE night-gated PointLight in that lantern (default true) */
  light?: boolean;
}

export interface RuinedArchBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  /** inner crown height */
  crownY: number;
  /** overall height including the keystone */
  height: number;
  /** each pier's centre |x| and its half-extents — what a blocker fences */
  pierAt: number;
  pierHx: number;
  pierHz: number;
  /** total width across both piers */
  width: number;
}

/** the ruined arch. Group origin ON THE GROUND at the middle of the opening;
 *  +x across the opening, +z the arch's thickness. */
export function buildRuinedArch(t: typeof THREE, opts: RuinedArchOpts = {}): RuinedArchBuilt {
  const AR = Math.max(0.25, (opts.opening ?? 1.24) / 2); // inner ring radius
  const SPRING = Math.max(0.3, opts.springing ?? 0.9);
  const D = Math.max(0.2, opts.depth ?? 0.62);
  const seed = opts.seed ?? 4;
  const N = Math.max(7, Math.min(19, Math.round(opts.count ?? 13)));
  const group = new t.Group();
  group.name = 'ruined-arch';
  const bag = newBag();
  const h = (n: number) => hash01(seed * 1.93 + n * 3.37);

  const stone: PartSpec[] = [];
  const stoneDark: PartSpec[] = [];
  /** moss on the pier FACES: flat plates */
  const moss: MergedBoxSpec[] = [];
  /** moss on the RING and the crowns: squashed lumps */
  const mossBlob: PartSpec[] = [];
  const PIER_W = Math.max(0.3, AR * 0.7);
  const PIER_X = AR + PIER_W / 2;

  // ---- the two PIERS: stacked hashed blocks on a buried footing ----------
  for (const sx of [-1, 1] as const) {
    let y = -0.26; // the footing, buried, so the pier is planted not placed
    let k = 0;
    while (y < SPRING - 0.08) {
      const bh = Math.min(0.16 + h(k * 3 + (sx > 0 ? 7 : 2)) * 0.09, SPRING - 0.08 - y + 0.02);
      const bw = PIER_W * (0.92 + h(k * 5 + (sx > 0 ? 11 : 4)) * 0.18);
      const spec = boxPart(
        t,
        [bw, bh * 1.02, D * (0.94 + h(k * 7) * 0.14)],
        [sx * PIER_X + (h(k * 11) - 0.5) * 0.05, y + bh / 2, (h(k * 13) - 0.5) * 0.05],
        [0, (h(k * 17) - 0.5) * 0.1, 0],
        [2, Math.max(1, Math.round(bh * 6))],
      );
      (h(k * 19) > 0.62 ? stoneDark : stone).push(spec);
      y += bh;
      k += 1;
    }
    // the IMPOST course the ring springs from — the one horizontal that reads
    // as built masonry rather than a dry-stacked heap
    stone.push(boxPart(t, [PIER_W * 1.22, 0.1, D + 0.16], [sx * PIER_X, SPRING - 0.05, 0], [0, 0, 0], [2, 1]));
  }

  // ---- THE RING: voussoirs on a real circle, ONE OF THEM MISSING ---------
  const gone = 2 + Math.floor(h(41) * Math.max(1, N - 4));
  const rMid = AR + 0.13;
  for (let k = 0; k < N; k += 1) {
    // `a` runs from the springing (0) to the far springing (π)
    const a = (k + 0.5) * (Math.PI / N);
    if (k === gone) continue; // the fallen stone
    const x = -Math.cos(a) * rMid;
    const y = SPRING + Math.sin(a) * rMid;
    // ── θ = −a. See the block comment above; this is the arch's whole read. ──
    const m = new t.Matrix4().makeRotationZ(-a);
    m.setPosition(x, y, 0);
    stone.push(boxAtMatrix(t, [0.26, (Math.PI * rMid) / N + 0.03, D], m, [1, 1]));
    // the EXTRADOS course over it, SNAPPED OFF down the far haunch
    if (k < N * 0.66 || h(k + 51) > 0.55) {
      const rOut = AR + 0.32;
      const m2 = new t.Matrix4().makeRotationZ(-a);
      m2.setPosition(-Math.cos(a) * rOut, SPRING + Math.sin(a) * rOut, (h(k + 61) - 0.5) * 0.06);
      stoneDark.push(boxAtMatrix(t, [0.16, (Math.PI * rOut) / N + 0.02, D - 0.06], m2, [1, 1]));
    }
  }
  // the KEYSTONE, wedged PROUD of the ring
  const keyY = SPRING + AR + 0.16;
  stone.push(boxPart(t, [0.3, 0.36, D + 0.09], [0, keyY, 0], [0, 0, 0], [1, 2]));

  // ---- THE FALLEN VOUSSOIR, on the ground beside a pier ------------------
  {
    const ga = (gone + 0.5) * (Math.PI / N);
    const side = Math.cos(ga) > 0 ? -1 : 1;
    const fx = side * (PIER_X + PIER_W * 0.55 + 0.1);
    stoneDark.push(
      boxPart(
        t,
        [0.26, (Math.PI * rMid) / N + 0.03, D * 0.9],
        [fx, 0.1, (h(71) - 0.5) * D * 0.5],
        [0.2 + h(73) * 0.5, h(79) * 3, Math.PI / 2 + (h(83) - 0.5) * 0.4],
        [1, 1],
      ),
    );
    // and the RUBBLE it broke into
    for (let i = 0; i < 9; i += 1) {
      const ra = h(i * 89 + 3) * Math.PI * 2;
      const rr = PIER_W * (0.7 + h(i * 97) * 1.1);
      const rs = 0.045 + h(i * 101) * 0.055;
      stoneDark.push({
        geo: new t.IcosahedronGeometry(1, 0),
        matrix: mtx(
          t,
          [side * PIER_X + Math.cos(ra) * rr, rs * 0.45, Math.sin(ra) * rr],
          [(h(i * 103) - 0.5) * 0.7, h(i * 107) * Math.PI, (h(i * 109) - 0.5) * 0.7],
          [rs, rs * 0.66, rs * (0.8 + h(i * 113) * 0.5)],
        ),
        uv: [1, 1],
      });
    }
  }

  // ---- MOSS, and a FERN in the gap the stone left ------------------------
  // On the RING and the KEYSTONE: squashed lumps (a flat box on a curved
  // extrados sticks out as a little green flag — the first render was full of
  // them). On the PIER FACES: thin plates pressed onto the real face plane,
  // which is what a patch of moss on a wall is.
  for (let k = 0; k < 24; k += 1) {
    const a = h(k * 2.3 + 71) * Math.PI;
    const rOut = AR + 0.3 + h(k * 3.1 + 72) * 0.06;
    const ms = 0.09 + h(k + 73) * 0.08;
    mossBlob.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [-Math.cos(a) * rOut, SPRING + Math.sin(a) * rOut, (h(k + 75) - 0.5) * (D - 0.12)],
        [0, h(k + 76) * Math.PI, -a],
        [ms, ms * 0.3, ms * (0.8 + h(k + 77) * 0.6)],
      ),
      uv: [1, 1],
    });
  }
  for (const sx of [-1, 1] as const) {
    for (let k = 0; k < 8; k += 1) {
      // the two outward faces (x) and the two through faces (z), in turn
      const onX = k % 2 === 0;
      const my = -0.05 + h(k + 81) * (SPRING + 0.1);
      const mw = PIER_W * (0.26 + h(k + 84) * 0.3);
      moss.push(
        onX
          ? { dims: [0.02, mw * 0.7, mw], pos: [sx * (PIER_X + PIER_W / 2 * (h(k + 85) > 0.5 ? 1 : -1)), my, (h(k + 82) - 0.5) * (D - 0.1)] }
          : { dims: [mw, mw * 0.7, 0.02], pos: [sx * PIER_X + (h(k + 82) - 0.5) * PIER_W * 0.6, my, (h(k + 86) > 0.5 ? 1 : -1) * D * 0.5] },
      );
    }
    // a cushion of moss where the pier meets the ground
    mossLumps(t, mossBlob, { n: 5, seed: seed + (sx > 0 ? 61 : 67), r0: 0, r1: PIER_W * 0.7, y: 0.02, size: PIER_W * 0.3 });
    for (let mi = mossBlob.length - 5; mi < mossBlob.length; mi += 1) {
      const m = mossBlob[mi];
      m.matrix = new t.Matrix4().makeTranslation(sx * PIER_X, 0, 0).multiply(m.matrix);
    }
  }
  {
    // a cap of moss on the keystone
    const ks = 0.1;
    mossBlob.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(t, [0, keyY + 0.18, (h(88) - 0.5) * D * 0.4], [0, h(89) * 3, 0], [ks * 1.4, ks * 0.34, ks * 1.6]),
      uv: [1, 1],
    });
  }
  {
    const ga = (gone + 0.5) * (Math.PI / N);
    const gx = -Math.cos(ga) * rMid;
    const gy = SPRING + Math.sin(ga) * rMid;
    const fronds: MergedBoxSpec[] = [];
    for (let k = 0; k < 6; k += 1) {
      const fa = -0.6 + k * 0.28;
      const len = 0.18 + h(k + 91) * 0.16;
      const from = new t.Vector3(gx, gy, (h(k + 92) - 0.5) * D * 0.5);
      fronds.push(bladeSpec(t, from, from.clone().add(new t.Vector3(Math.cos(fa) * len * 0.45, len, Math.sin(fa) * len * 0.5)), 0.07, 0.014));
    }
    const fm = mergedBoxes(t, fronds, GLADE.fern, { tex: 'leaf', repeat: [1, 1], rough: 0.93, bump: 0.04 });
    fm.userData.lodDetail = true;
    bag.geos.push(fm.geometry);
    bag.mats.push(fm.material as THREE.Material);
    group.add(fm);
  }

  // ---- IVY down both haunches (shared strand from WyrmsHollow) -----------
  // ⚠️ ON THE RING, not beside it. The first pass hung the strands at
  // x = ±(AR + 0.34) — which for a 0.94 extrados radius is OUTSIDE the ring
  // entirely — so four ivy strands dangled in mid-air a hand's width off the
  // stone and read as dead twigs stuck in the grass. Solve the ring for the
  // haunch angle and hang each strand off the EXTRADOS there.
  for (let k = 0; k < 4; k += 1) {
    const sx = k % 2 ? 1 : -1;
    const ha = 0.3 + h(k + 111) * 0.5; // radians up from the springing
    const rOut = AR + 0.3;
    const hx = sx * Math.cos(ha) * rOut;
    const hy = SPRING + Math.sin(ha) * rOut;
    const strand = buildIvyStrand(t, 0.35 + h(k + 101) * 0.45, seed * 13 + k);
    strand.position.set(hx, hy, (h(k + 103) - 0.5) * (D - 0.14));
    strand.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (mesh.isMesh) {
        bag.geos.push(mesh.geometry);
        bag.mats.push(mesh.material as THREE.Material);
      }
    });
    group.add(strand);
  }

  // ---- an IRON BRACKET LANTERN reaching out over the path ----------------
  const lampGlass: THREE.MeshStandardMaterial[] = [];
  let lamp: THREE.PointLight | null = null;
  if (opts.lamp ?? true) {
    const bx = -(AR + 0.1);
    const by = SPRING + 0.36;
    const bracket: MergedBoxSpec[] = [
      barSpec(t, new t.Vector3(bx, by, 0), new t.Vector3(bx + 0.3, by + 0.16, 0), 0.03),
      barSpec(t, new t.Vector3(bx, by + 0.22, 0), new t.Vector3(bx + 0.28, by + 0.16, 0), 0.024),
      { dims: [0.06, 0.09, 0.05], pos: [bx - 0.01, by + 0.11, 0] }, // the wall plate
    ];
    const bm = mergedBoxes(t, bracket, GLADE.iron, { tex: 'metal', metal: 0.28, rough: 0.62, bump: 0.04 });
    bag.geos.push(bm.geometry);
    bag.mats.push(bm.material as THREE.Material);
    group.add(bm);
    const lan = gladeLantern(t, bag, 1.05);
    lan.group.position.set(bx + 0.3, by - 0.14, 0);
    group.add(lan.group);
    lampGlass.push(lan.glass);
    group.userData.lampAt = [bx + 0.3, by - 0.14, 0];
    if (opts.light ?? true) {
      lamp = new t.PointLight(THORNWICK.lantern, 0, 5.2, 2);
      lan.group.add(lamp);
    }
  }

  // ---- GLOW-WORMS in the moss at the pier feet --------------------------
  const worms = glowWormCrust(t, {
    count: 24,
    seed: seed + 41,
    size: 0.015,
    at: (i, hh) => {
      const side = i % 2 ? 1 : -1;
      return [side * PIER_X + (hh(1) - 0.5) * PIER_W * 1.5, 0.02 + hh(2) * 0.16, (hh(3) - 0.5) * (D + 0.3)];
    },
  });
  bag.geos.push(worms.mesh.geometry);
  bag.mats.push(worms.material);
  group.add(worms.mesh);

  // ---- merged meshes -----------------------------------------------------
  if (stone.length) {
    const mesh = mergedParts(t, stone, stoneMat(t, bag, THORNWICK.stone, [2, 2], { rough: 0.94, bump: 0.08 }));
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }
  if (stoneDark.length) {
    // stoneDARK, not stoneShade: 0x4b4e45 under a mossy canopy renders as a
    // silhouette and the second stone tone stops reading as masonry at all
    const mesh = mergedParts(t, stoneDark, stoneMat(t, bag, THORNWICK.stoneDark, [2, 2], { rough: 0.95, bump: 0.08 }));
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }
  const mossMesh = mergedBoxes(t, moss, THORNWICK.mossDeep, { tex: 'grass', repeat: [1, 1], rough: 0.96, bump: 0.06, flat: true });
  mossMesh.castShadow = false;
  bag.geos.push(mossMesh.geometry);
  bag.mats.push(mossMesh.material as THREE.Material);
  group.add(mossMesh);
  if (mossBlob.length) {
    const blobMesh = mergedParts(t, mossBlob, texMat(t, bag, THORNWICK.moss, 'grass', [1, 1], { rough: 0.96, bump: 0.06, flat: true }));
    blobMesh.castShadow = false;
    bag.geos.push(blobMesh.geometry);
    group.add(blobMesh);
  }

  group.userData.crownY = SPRING + AR;

  const update = (time: number) => {
    const lk = lanternK(group);
    const flick = 1 + 0.07 * Math.sin(time * 4.3) + 0.05 * Math.sin(time * 7.1 + 0.8);
    for (const g of lampGlass) g.emissiveIntensity = 0.05 + (1.25 * flick - 0.05) * lk;
    if (lamp) lamp.intensity = lk * 1.0 * flick;
    worms.material.emissiveIntensity = glowK(group) * (1 + 0.15 * Math.sin(time * 0.66));
  };

  return {
    group,
    crownY: SPRING + AR,
    height: keyY + 0.2,
    pierAt: PIER_X,
    pierHx: PIER_W * 0.62,
    pierHz: D * 0.62,
    width: 2 * (PIER_X + PIER_W / 2),
    update,
    dispose() {
      lamp?.dispose();
      disposeBag(bag)();
    },
  };
}

// ===========================================================================
// 5. <FlowerPodBed> — the glowing flower pods
// ===========================================================================
//
// The glade's ground-level light source, and the piece that gets scattered
// most: a low bed of broad leaves out of which nod a dozen pods on thin
// stalks. What makes it read as a bed of LIVING things rather than a row of
// bulbs is that they are at different stages:
//
//   * OPEN pods — five sepals folded right back off a bright core ball, four
//     pale violet petals splayed under them. These are the bright ones.
//   * HALF pods — sepals still closed over the core, so the glow only leaks
//     out of the seams. Dimmer, and the shape reads as a bud.
//   * SPENT buds — no glow at all, just a tight green ovoid. Two or three of
//     these are what stop the bed reading as a light fixture.
//
// The glow is EMISSIVE, lerped by `nightKOf` and never gated to zero (a pod is
// alive at noon), plus ONE opt-out PointLight low over the bed. NO particles:
// pollen motes would be lovely, but this piece is meant to be scattered a
// dozen times and the global particle budget is 4000 across the park — the
// same call Tidewater made for spray.
//
// FLAT AND ANKLE-HIGH, so it registers NO blocker unless asked: it is for
// scattering along paths and lawns, where a blocker carves holes in the walk
// network (the call <TidePool> and <LavaFissure> both make).
// ===========================================================================

export interface FlowerPodBedOpts {
  /** bed radius (default 0.62) */
  radius?: number;
  seed?: number;
  /** pods in the bed, clamped 2…14 (default 8) */
  count?: number;
  /** ONE low PointLight over the bed (default true) */
  light?: boolean;
}

export interface FlowerPodBedBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  radius: number;
  height: number;
}

/** the glowing flower-pod bed. Group origin on the ground at the bed centre. */
export function buildFlowerPodBed(t: typeof THREE, opts: FlowerPodBedOpts = {}): FlowerPodBedBuilt {
  const R = Math.max(0.15, opts.radius ?? 0.62);
  const seed = opts.seed ?? 5;
  const N = Math.max(2, Math.min(14, Math.round(opts.count ?? 8)));
  const group = new t.Group();
  group.name = 'flower-pod-bed';
  const bag = newBag();
  const h = (n: number) => hash01(seed * 3.07 + n * 4.43);

  const stalks: PartSpec[] = [];
  /** seam RIDGES on a closed bud: boxes are right here, a ridge is a ridge */
  const sepals: MergedBoxSpec[] = [];
  /** the sepals of an OPEN flower, folded back: rounded, so `petalPart` */
  const sepalParts: PartSpec[] = [];
  const petalParts: PartSpec[] = [];
  const skins: PartSpec[] = [];
  const coresBright: PartSpec[] = [];
  const coresDim: PartSpec[] = [];
  const leaves: MergedBoxSpec[] = [];
  let tallest = 0;

  for (let i = 0; i < N; i += 1) {
    const az = (i / N) * Math.PI * 2 + h(i * 7 + 3) * 1.4;
    const rr = R * (0.1 + h(i * 11 + 5) * 0.78);
    const fx = Math.cos(az) * rr;
    const fz = Math.sin(az) * rr;
    const podR = R * (0.085 + h(i * 13 + 7) * 0.055);
    const stalkLen = R * (0.28 + h(i * 17 + 9) * 0.55);
    // the stalk NODS: it leaves the ground upright and bends over at the top,
    // which is what makes a pod look heavy and alive
    const out = new t.Vector3(Math.cos(az + h(i * 19) * 1.4), 0, Math.sin(az + h(i * 19) * 1.4));
    const { tip, dir } = limb(
      t,
      stalks,
      new t.Vector3(fx, 0.01, fz),
      new t.Vector3(0, 1, 0).addScaledVector(out, 0.12 + h(i * 23) * 0.16).normalize(),
      stalkLen,
      podR * 0.19,
      podR * 0.12,
      4,
      out.clone().multiplyScalar(0.9 + h(i * 29) * 0.9),
      [1, 3],
    );
    tallest = Math.max(tallest, tip.y + podR * 1.1);

    // three stages, hashed: OPEN (bright, sepals back), HALF (dim, closed
    // sepals), SPENT (no glow)
    const roll = h(i * 31 + 11);
    const stage = roll > 0.5 ? 'open' : roll > 0.2 ? 'half' : 'spent';
    const podYaw = h(i * 37) * Math.PI * 2;
    const nodPitch = Math.atan2(Math.hypot(dir.x, dir.z), Math.max(0.05, dir.y));

    // the pod BODY: an ovoid on the stalk tip, aligned with the nod
    const bodyGeo = new t.SphereGeometry(podR, 9, 6);
    const bodyRot: [number, number, number] = [nodPitch * Math.cos(podYaw) * 0.6, podYaw, nodPitch * Math.sin(podYaw) * 0.6];
    if (stage === 'spent') {
      skins.push({ geo: bodyGeo, matrix: mtx(t, [tip.x, tip.y + podR * 0.5, tip.z], bodyRot, [0.72, 1.3, 0.72]), uv: [2, 2] });
      // four seam ridges down a tight bud
      for (let k = 0; k < 4; k += 1) {
        const sa = podYaw + (k / 4) * Math.PI * 2;
        sepals.push({
          dims: [podR * 0.09, podR * 2.1, podR * 0.16],
          pos: [tip.x + Math.cos(sa) * podR * 0.6, tip.y + podR * 0.5, tip.z + Math.sin(sa) * podR * 0.6],
          rotY: -sa,
        });
      }
      continue;
    }

    const coreY = tip.y + podR * 0.62;
    if (stage === 'half') {
      // the calyx still CLOSED over the core: five sepals meeting at a point,
      // and the glow only leaking out of the seams
      skins.push({ geo: bodyGeo, matrix: mtx(t, [tip.x, coreY, tip.z], bodyRot, [0.8, 1.15, 0.8]), uv: [2, 2] });
      for (let k = 0; k < 5; k += 1) {
        const sa = podYaw + (k / 5) * Math.PI * 2;
        sepals.push({
          dims: [podR * 0.1, podR * 2.0, podR * 0.5],
          pos: [tip.x + Math.cos(sa) * podR * 0.66, coreY + podR * 0.05, tip.z + Math.sin(sa) * podR * 0.66],
          rotY: -sa,
          rotZ: 0.1,
        });
      }
      coresDim.push({ geo: new t.IcosahedronGeometry(podR * 0.66, 1), matrix: mtx(t, [tip.x, coreY, tip.z]) });
      continue;
    }

    // ---- OPEN: five sepals folded right BACK, six petals splayed into a
    // bowl round a bare core, and a crown of glowing stamen filaments --------
    const core = new t.Vector3(tip.x, coreY, tip.z);
    for (let k = 0; k < 5; k += 1) {
      const sa = podYaw + (k / 5) * Math.PI * 2 + h(i * 41 + k) * 0.2;
      // back and DOWN: an opened calyx HANGS off the flower, it does not stand up
      const d = new t.Vector3(Math.cos(sa), -(0.7 + h(i * 43 + k) * 0.5), Math.sin(sa)).normalize();
      sepalParts.push(petalPart(t, core.clone().addScaledVector(d, podR * 0.34), d, podR * 1.5, podR * 0.6, podR * 0.13));
    }
    for (let k = 0; k < 6; k += 1) {
      const pa = podYaw + 0.5 + (k / 6) * Math.PI * 2 + h(i * 47 + k) * 0.15;
      const rise = 0.42 + h(i * 53 + k) * 0.4;
      const d = new t.Vector3(Math.cos(pa), rise, Math.sin(pa)).normalize();
      petalParts.push(petalPart(t, core.clone().addScaledVector(d, podR * 0.3), d, podR * 2.0, podR * 1.15, podR * 0.17));
    }
    coresBright.push({ geo: new t.IcosahedronGeometry(podR * 0.62, 1), matrix: mtx(t, [core.x, core.y, core.z], [0, podYaw, 0], [1, 1.2, 1]) });
    // STAMENS: five short filaments with a hot little tip each. A bare ball in
    // a ring of petals reads as a ping-pong ball; the filaments are what make
    // the middle of the flower read as the middle of a flower.
    for (let k = 0; k < 5; k += 1) {
      const fa = podYaw + 0.3 + (k / 5) * Math.PI * 2;
      const d = new t.Vector3(Math.cos(fa) * 0.45, 1, Math.sin(fa) * 0.45).normalize();
      const flen = podR * (0.5 + h(i * 59 + k) * 0.3);
      stalks.push({ geo: new t.CylinderGeometry(podR * 0.035, podR * 0.05, flen, 5, 1), matrix: alongDir(t, core, d, flen), uv: [1, 1] });
      const tp = core.clone().addScaledVector(d, flen);
      coresBright.push({ geo: new t.IcosahedronGeometry(podR * 0.11, 0), matrix: mtx(t, [tp.x, tp.y, tp.z]) });
    }
    // a little cup of skin under the core, so it is not a floating ball
    skins.push({
      geo: new t.SphereGeometry(podR * 0.58, 9, 6, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      matrix: mtx(t, [tip.x, coreY, tip.z], [0, podYaw, 0], [1, 0.8, 1]),
      uv: [1, 1],
    });
  }

  // ---- BROAD LEAVES at the bottom: a real bed, in two tones -------------
  for (let c = 0; c < 7; c += 1) {
    const ca = h(c * 53 + 17) * Math.PI * 2;
    const cr = R * (0.1 + h(c * 59) * 0.6);
    const base = new t.Vector3(Math.cos(ca) * cr, 0.015, Math.sin(ca) * cr);
    const nb = 3 + Math.floor(h(c * 61) * 3);
    for (let k = 0; k < nb; k += 1) {
      const ba = (k / nb) * Math.PI * 2 + h(c * 67 + k) * 1.0;
      const len = R * (0.2 + h(c * 71 + k) * 0.28);
      // broad and LOW: a pod bed's leaves lie almost flat on the loam
      leaves.push(
        bladeSpec(
          t,
          base,
          base.clone().add(new t.Vector3(Math.cos(ba) * len, len * (0.22 + h(c * 73 + k) * 0.24), Math.sin(ba) * len)),
          R * (0.16 + h(c * 79 + k) * 0.1),
          0.014,
          [1, 1],
        ),
      );
    }
  }

  // ---- the loam bed, moss and pebbles -----------------------------------
  const groundParts: PartSpec[] = [];
  groundMound(t, groundParts, R * 0.98, R * 0.98, 0.07, seed + 6, 9);
  const loam = mergedParts(t, groundParts, texMat(t, bag, GLADE.loam, 'concrete', [3, 3], { rough: 1, bump: 0.06, flat: true }));
  bag.geos.push(loam.geometry);
  group.add(loam);
  const pebbles: PartSpec[] = [];
  for (let i = 0; i < 12; i += 1) {
    const pa = h(i * 83 + 19) * Math.PI * 2;
    const pr = R * (0.5 + h(i * 89) * 0.6);
    const ps = R * (0.03 + h(i * 97) * 0.035);
    pebbles.push({
      geo: new t.IcosahedronGeometry(1, 0),
      matrix: mtx(
        t,
        [Math.cos(pa) * pr, ps * 0.4, Math.sin(pa) * pr],
        [(h(i * 101) - 0.5) * 0.7, h(i * 103) * Math.PI, (h(i * 107) - 0.5) * 0.7],
        [ps, ps * 0.6, ps * (0.8 + h(i * 109) * 0.5)],
      ),
      uv: [1, 1],
    });
  }
  const pebMesh = mergedParts(t, pebbles, stoneMat(t, bag, THORNWICK.stoneDark, [1, 1], { rough: 1, flat: true }));
  pebMesh.userData.lodDetail = true;
  bag.geos.push(pebMesh.geometry);
  group.add(pebMesh);
  const mossParts: PartSpec[] = [];
  mossLumps(t, mossParts, { n: 24, seed: seed + 11, r0: R * 0.14, r1: R * 0.96, y: 0.018, size: R * 0.16 });
  const mossMesh = mergedParts(t, mossParts, texMat(t, bag, THORNWICK.moss, 'grass', [1, 1], { rough: 0.96, bump: 0.06, flat: true }));
  mossMesh.castShadow = false;
  bag.geos.push(mossMesh.geometry);
  group.add(mossMesh);

  // ---- merged meshes -----------------------------------------------------
  const addP = (parts: PartSpec[], m: THREE.Material, lod = false, shadow = true) => {
    if (!parts.length) return;
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = shadow;
    if (lod) mesh.userData.lodDetail = true;
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  };
  const addB = (specs: MergedBoxSpec[], color: number, o: Parameters<typeof mergedBoxes>[3], lod = false, shadow = true) => {
    if (!specs.length) return null;
    const mesh = mergedBoxes(t, specs, color, o);
    mesh.castShadow = shadow;
    if (lod) mesh.userData.lodDetail = true;
    bag.geos.push(mesh.geometry);
    bag.mats.push(mesh.material as THREE.Material);
    group.add(mesh);
    return mesh;
  };
  addP(stalks, plain(t, bag, GLADE.podSkin, { rough: 0.9 }));
  addP(skins, texMat(t, bag, GLADE.podSkinPale, 'leaf', [1, 1], { rough: 0.72, bump: 0.04 }));
  // the OPEN calyx takes the PALE skin: in `podSkin` it read as a black collar
  // under every flower, because it hangs downward and is therefore always in shade
  addP(sepalParts, texMat(t, bag, GLADE.podSkinPale, 'leaf', [1, 1], { rough: 0.8, bump: 0.04, flat: true }));
  addP(petalParts, texMat(t, bag, GLADE.petal, 'fabric', [1, 1], { rough: 0.68, bump: 0.03 }));
  addB(sepals, GLADE.podSkin, { tex: 'leaf', repeat: [1, 1], rough: 0.8, bump: 0.04 }, true);
  addB(leaves, THORNWICK.ivyLight, { tex: 'leaf', repeat: [1, 1], rough: 0.86, bump: 0.05 });

  // ---- THE GLOW: two materials, bright cores and leaking buds ------------
  const glowMats: THREE.MeshStandardMaterial[] = [];
  if (coresBright.length) {
    const m = plain(t, bag, GLADE.podCore, { rough: 0.4, emissive: GLADE.podGlow });
    m.emissiveIntensity = GLOW_DAY;
    glowMats.push(m);
    const mesh = mergedParts(t, coresBright, m);
    mesh.castShadow = false;
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }
  if (coresDim.length) {
    // the CLOSED buds glow at a third: the light is leaking through a calyx
    const m = plain(t, bag, GLADE.podSkinPale, { rough: 0.55, emissive: GLADE.podGlow });
    m.emissiveIntensity = GLOW_DAY * 0.4;
    glowMats.push(m);
    const mesh = mergedParts(t, coresDim, m);
    mesh.castShadow = false;
    bag.geos.push(mesh.geometry);
    group.add(mesh);
  }
  const worms = glowWormCrust(t, {
    count: 20,
    seed: seed + 17,
    size: 0.013,
    at: (i, hh) => {
      const a = hh(1) * Math.PI * 2;
      const rr = R * (0.55 + hh(2) * 0.6);
      return [Math.cos(a) * rr, 0.03 + hh(3) * 0.04, Math.sin(a) * rr];
    },
  });
  bag.geos.push(worms.mesh.geometry);
  bag.mats.push(worms.material);
  group.add(worms.mesh);

  let lamp: THREE.PointLight | null = null;
  if (opts.light ?? true) {
    lamp = new t.PointLight(GLADE.podGlow, 0, Math.max(1.4, R * 4), 2);
    lamp.position.set(0, Math.max(0.12, tallest * 0.55), 0);
    group.add(lamp);
  }

  const update = (time: number) => {
    const k = glowK(group);
    for (let i = 0; i < glowMats.length; i += 1) {
      // each stage breathes at its own rate — a bed of pods is not one bulb
      const breathe = 1 + 0.17 * Math.sin(time * (0.52 + i * 0.23) + i * 2.4) + 0.08 * Math.sin(time * 1.31 + i);
      glowMats[i].emissiveIntensity = k * (i === 1 ? 0.4 : 1) * breathe;
    }
    worms.material.emissiveIntensity = k * 0.8 * (1 + 0.15 * Math.sin(time * 0.83));
    if (lamp) lamp.intensity = (0.04 + 0.44 * nightKOf(group)) * (1 + 0.12 * Math.sin(time * 0.52));
  };

  return {
    group,
    radius: R * 1.14,
    height: Math.max(0.12, tallest),
    update,
    dispose() {
      lamp?.dispose();
      disposeBag(bag)();
    },
  };
}

// ===========================================================================
// THE PIECE NAMES — the pack's own vocabulary, so a set-piece plan can hold a
// LIST of scenery instead of five imports and a switch.
//
// `thornwickPiece` deliberately does NOT start with `build`: `tools/
// seed-sweep.mjs` calls every `build*` export as `(THREE, opts)`, and a
// dispatcher whose second argument is a NAME would fail every seed for a
// harness reason rather than a component one.
// ===========================================================================

export type ThornwickPieceName = 'giantToadstools' | 'standingStones' | 'lanternTree' | 'ruinedArch' | 'flowerPodBed';

export const THORNWICK_PIECES: ThornwickPieceName[] = ['giantToadstools', 'standingStones', 'lanternTree', 'ruinedArch', 'flowerPodBed'];

export interface ThornwickPieceOpts extends GiantToadstoolsOpts, StandingStonesOpts, LanternTreeOpts, RuinedArchOpts, FlowerPodBedOpts {}

/** build any glade piece by name — the imperative dispatcher a hand-rolled
 *  set-piece uses to walk a plan array. */
export function thornwickPiece(t: typeof THREE, name: ThornwickPieceName, opts: ThornwickPieceOpts = {}): ComposableBuilt & { height: number } {
  switch (name) {
    case 'standingStones':
      return buildStandingStones(t, opts);
    case 'lanternTree':
      return buildLanternTree(t, opts);
    case 'ruinedArch':
      return buildRuinedArch(t, opts);
    case 'flowerPodBed':
      return buildFlowerPodBed(t, opts);
    case 'giantToadstools':
    default:
      return buildGiantToadstools(t, opts);
  }
}

// ===========================================================================
// THE COMPOSABLE COMPONENTS
//
// Every piece takes `position` / `rotation` / `scale` and settles onto the
// terrain through `park.floorAt`. BLOCKERS: the three pieces that are solid at
// guest height register one by default (`blocking={false}` opts out); the ARCH
// registers its two PIERS and leaves the opening walkable, because that is the
// entire point of an arch; and the FLOWER POD BED — flat and ankle-high, meant
// to be scattered along paths and lawns — registers NOTHING unless asked (the
// same call <TidePool> and <LavaFissure> make; a blocker there carves holes in
// the walk network).
// ===========================================================================

export interface GiantToadstoolsProps extends GiantToadstoolsOpts {
  /** keep guests out of the clump (default true — these are tree-sized) */
  blocking?: boolean;
}

/** `<GiantToadstools>` — THORNWICK GLADE's signature: a clump of house-high
 *  toadstools with domed caps, gills, warty crowns and one cap that glows. */
export const GiantToadstools = composable<GiantToadstoolsProps, GiantToadstoolsBuilt>(
  'GiantToadstools',
  (t, props) =>
    buildGiantToadstools(t, {
      radius: props.radius,
      height: props.height,
      seed: props.seed,
      count: props.count,
      glow: props.glow,
      light: props.light,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        // the STIPES, not the cap spread: the caps are overhead and a guest
        // walks under them (the same reason the lantern tree fences its trunk)
        circle: { cx: wx, cz: wz, r: built.radius * 0.72 * scale },
        label: '<GiantToadstools> clump',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface StandingStonesProps extends StandingStonesOpts {
  /** keep guests out of the ring (default true — they are megaliths) */
  blocking?: boolean;
}

/** `<StandingStones>` — a mossy megalith ring with one stone fallen and carved
 *  runes that wake after dark. */
export const StandingStones = composable<StandingStonesProps, StandingStonesBuilt>(
  'StandingStones',
  (t, props) =>
    buildStandingStones(t, {
      radius: props.radius,
      height: props.height,
      seed: props.seed,
      count: props.count,
      runes: props.runes,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<StandingStones> megalith ring',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface LanternTreeProps extends LanternTreeOpts {
  /** keep guests off the trunk (default true) */
  blocking?: boolean;
}

/** `<LanternTree>` — a twisted tree hung with wrought-iron lanterns. The
 *  blocker fences the TRUNK, not the canopy: guests walk under the branches. */
export const LanternTree = composable<LanternTreeProps, LanternTreeBuilt>(
  'LanternTree',
  (t, props) =>
    buildLanternTree(t, {
      height: props.height,
      spread: props.spread,
      seed: props.seed,
      count: props.count,
      lights: props.lights,
      ivy: props.ivy,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<LanternTree> trunk',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface RuinedArchProps extends RuinedArchOpts {
  /** register the two PIERS as blockers (default true). The OPENING is always
   *  left walkable — an arch you cannot walk through is a wall. */
  blocking?: boolean;
}

/** `<RuinedArch>` — a free-standing broken arch to straddle a path. Local +x is
 *  ACROSS the opening, so `rotation` aims it along the path; y = 0 is the
 *  GROUND (unlike MoonlitBarge's channel arch, whose y = 0 is the rail). */
export const RuinedArch = composable<RuinedArchProps, RuinedArchBuilt>(
  'RuinedArch',
  (t, props) =>
    buildRuinedArch(t, {
      opening: props.opening,
      springing: props.springing,
      depth: props.depth,
      seed: props.seed,
      count: props.count,
      lamp: props.lamp,
      light: props.light,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      // TWO blockers, one per pier — the span between them stays walkable.
      // Ry(yaw) sends a local (x, 0) to world (x·cos, −x·sin).
      const removers = ([-1, 1] as const).map((sgn) => {
        const px = sgn * built.pierAt * scale;
        return park.registerBlocker({
          rect: {
            cx: wx + px * Math.cos(rotation),
            cz: wz - px * Math.sin(rotation),
            hx: built.pierHx * scale,
            hz: built.pierHz * scale,
            yaw: rotation,
          },
          label: `<RuinedArch> pier ${sgn > 0 ? '+x' : '-x'}`,
          height: built.crownY * scale,
          kind: 'scenery',
        });
      });
      return () => removers.forEach((r) => r());
    },
  },
);

export interface FlowerPodBedProps extends FlowerPodBedOpts {
  /** register a blocker over the bed (default FALSE — the piece is ankle-high
   *  and meant to be scattered across paths and lawns; set true for a big hero
   *  bed you want guests to keep out of) */
  blocking?: boolean;
}

/** `<FlowerPodBed>` — a bed of glowing flower pods on nodding stalks. Flat by
 *  design: no blocker unless asked. */
export const FlowerPodBed = composable<FlowerPodBedProps, FlowerPodBedBuilt>(
  'FlowerPodBed',
  (t, props) => buildFlowerPodBed(t, { radius: props.radius, seed: props.seed, count: props.count, light: props.light }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (!props.blocking) return; // ankle-high by design
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<FlowerPodBed> bed',
        height: Math.max(0.2, built.height) * scale,
        kind: 'scenery',
      });
    },
  },
);
