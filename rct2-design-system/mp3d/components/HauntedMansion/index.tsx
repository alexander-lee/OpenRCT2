import React from 'react';
import * as THREE from 'three';
import { box, mat, mergedBoxes, mergedParts, mtx, alongDir, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ===========================================================================
// LOCAL PROCEDURAL CANVASES — Stage's texture set has no masonry, no slate and
// no cobweb (wood / metal / asphalt / leaf / fabric / concrete / grass /
// plastic / sand) and Stage is not ours to extend, so the mansion draws its
// own the exact same way Stage's `drawTexture` does: one small canvas each,
// cached module-level, reused as map + bumpMap.
//
// THE RULE THESE OBEY: a LOCAL canvas MULTIPLIES with the material colour, so
// each one paints the FINAL tone onto its own ground and every material that
// uses one keeps `color: 0xffffff`. (A tinted material over a dark local
// canvas is how a lichen pass once turned every megalith near-black.)
//
// DETERMINISTIC — hashed sine only, never Math.random (unlike Stage's
// speckles), so every mount and every screenshot is byte-identical.
// ===========================================================================
const bhash = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const rgbOf = (h: number, d = 0) =>
  `rgb(${Math.max(0, Math.min(255, ((h >> 16) & 255) + d))},${Math.max(0, Math.min(255, ((h >> 8) & 255) + d))},${Math.max(
    0,
    Math.min(255, (h & 255) + d),
  )})`;

// ---- masonry: running-bond brick -------------------------------------------
const _brickCache = new Map<string, THREE.CanvasTexture>();
function brickCanvas(color: number, mortar: number, S = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = rgbOf(mortar); // mortar bed
  x.fillRect(0, 0, S, S);
  const ROWS = 8; // 8 courses of 4 stretchers -> reads as brick at repeat [6,3]
  const COLS = 4;
  const bh = S / ROWS;
  const bw = S / COLS;
  for (let r = 0; r < ROWS; r++) {
    const off = r % 2 ? bw / 2 : 0; // running bond: alternate courses half-lapped
    for (let cix = -1; cix <= COLS; cix++) {
      const bx = cix * bw + off;
      const seed = r * 31 + ((cix + 8) % COLS) * 7;
      const d = Math.round(bhash(seed) * 40 - 20); // per-brick tonal variation
      x.fillStyle = rgbOf(color, d);
      x.fillRect(bx + 1.2, r * bh + 1.2, bw - 2.4, bh - 2.4);
      for (let k = 0; k < 2; k++) {
        // weathering flecks, hashed placement
        x.fillStyle = rgbOf(color, d - 26);
        const fx = bx + 2.5 + bhash(seed * 3 + k) * (bw - 7);
        const fy = r * bh + 2.5 + bhash(seed * 5 + k) * (bh - 7);
        x.fillRect(fx, fy, 2.2, 1.6);
      }
      x.fillStyle = rgbOf(color, d + 22); // top-edge highlight for the bump map
      x.fillRect(bx + 1.2, r * bh + 1.2, bw - 2.4, 1);
      x.fillStyle = rgbOf(color, d - 34); // struck perp joint down the left arris
      x.fillRect(bx + 1.2, r * bh + 1.2, 0.9, bh - 2.4);
    }
  }
  return c;
}
/** the shared brick canvas as a texture. `rx`/`ry` is the MATERIAL repeat —
 *  pass [1, 1] for a merged batch, whose per-part repeats live in baked UVs. */
function brickTex(t: typeof THREE, color: number, mortar: number, rx: number, ry: number): THREE.CanvasTexture {
  const key = `${color}:${mortar}:${rx}:${ry}`;
  const hit = _brickCache.get(key);
  if (hit) return hit;
  const tex = new t.CanvasTexture(brickCanvas(color, mortar));
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _brickCache.set(key, tex);
  return tex;
}
/** a `box()`-shaped brick wall: Stage's box() signature minus the tex opts,
 *  with the local masonry canvas wired in as map + bumpMap. Kept for one-off
 *  members (chimney stacks, gate piers); the wall SHELL is merged. */
function brickBox(
  t: typeof THREE,
  dims: [number, number, number],
  color: number,
  mortar: number,
  pos: [number, number, number],
  repeat: [number, number],
  o: { rotY?: number; rotZ?: number; bump?: number } = {},
): THREE.Mesh {
  const tex = brickTex(t, color, mortar, repeat[0], repeat[1]);
  const m = new t.Mesh(
    new t.BoxGeometry(...dims),
    new t.MeshStandardMaterial({ color: 0xffffff, map: tex, bumpMap: tex, bumpScale: o.bump ?? 0.06, roughness: 0.95 }),
  );
  m.position.set(...pos);
  if (o.rotY) m.rotation.y = o.rotY;
  if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---- slate: butt joints WITHIN one course ----------------------------------
// The courses themselves are MODELLED (every slope is stepped shingle strips),
// so this canvas supplies only the vertical joints, the per-slate tone, rain
// streaking and lichen — no horizontal lines to fight the geometry.
const _slateCache = new Map<string, THREE.CanvasTexture>();
function slateCanvas(color: number, S = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = rgbOf(color);
  x.fillRect(0, 0, S, S);
  const N = 4; // 4 slates across one tile
  const w = S / N;
  for (let i = 0; i < N; i++) {
    const d = Math.round(bhash(i * 17.3 + 4) * 34 - 17);
    x.fillStyle = rgbOf(color, d);
    x.fillRect(i * w + 1, 0, w - 2, S);
    for (let k = 0; k < 3; k++) {
      const sx = i * w + 3 + bhash(i * 9 + k) * (w - 8);
      x.fillStyle = rgbOf(color, d - 16);
      x.fillRect(sx, bhash(i * 5 + k) * S * 0.6, 1.4, S * 0.5);
    }
    if (bhash(i * 3.7 + 1) > 0.5) {
      x.fillStyle = rgbOf(0x6f7d58, d);
      x.globalAlpha = 0.4;
      x.beginPath();
      x.ellipse(i * w + w * 0.5, S * (0.2 + bhash(i) * 0.6), w * 0.3, S * 0.13, 0, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
    }
    x.fillStyle = rgbOf(color, -40); // the dark butt joint
    x.fillRect(i * w, 0, 1.4, S);
  }
  return c;
}
function slateTex(t: typeof THREE, color: number): THREE.CanvasTexture {
  const key = `s:${color}`;
  const hit = _slateCache.get(key);
  if (hit) return hit;
  const tex = new t.CanvasTexture(slateCanvas(color));
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _slateCache.set(key, tex);
  return tex;
}

// ---- cobweb: a radial web used as an ALPHA map -----------------------------
const _webCache = new Map<string, THREE.CanvasTexture>();
function webCanvas(S = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000'; // alpha map: black = fully transparent
  x.fillRect(0, 0, S, S);
  x.strokeStyle = '#fff';
  x.lineCap = 'round';
  const ox = 3;
  const oy = 3; // the web hangs off one corner of its quad
  const RAYS = 9;
  const a0 = 0.05;
  const a1 = Math.PI / 2 - 0.05;
  for (let i = 0; i < RAYS; i++) {
    const a = a0 + ((a1 - a0) * i) / (RAYS - 1);
    x.lineWidth = 1.15;
    x.beginPath();
    x.moveTo(ox, oy);
    x.lineTo(ox + Math.cos(a) * S * 1.4, oy + Math.sin(a) * S * 1.4);
    x.stroke();
  }
  for (let r = 1; r <= 7; r++) {
    const rad = (r / 7) * S * 0.95;
    x.lineWidth = 0.85;
    x.beginPath();
    for (let i = 0; i < RAYS; i++) {
      const a = a0 + ((a1 - a0) * i) / (RAYS - 1);
      const sag = 1 + 0.06 * Math.sin(((i + 0.5) / RAYS) * Math.PI);
      const px = ox + Math.cos(a) * rad * sag;
      const py = oy + Math.sin(a) * rad * sag;
      if (i === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
  }
  return c;
}
function webTex(t: typeof THREE): THREE.CanvasTexture {
  const hit = _webCache.get('w');
  if (hit) return hit;
  const tex = new t.CanvasTexture(webCanvas());
  tex.wrapS = tex.wrapT = t.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  _webCache.set('w', tex);
  return tex;
}

// ===========================================================================
// HAUNTED MANSION — a crooked, decaying THREE-TIER brick mansion. The massing
// is the RCT2 HHBUILD sprite's (wide ground floor under a wraparound hipped
// roof, a set-back middle storey, a square clock tower with a steep cap); the
// DETAIL is real architecture: a stone plinth and water table, quoined
// corners, a moulded three-member cornice, modelled shingle COURSES with
// sagging ridgelines on every slope, a front cross-gable carrying a rose
// window, three gabled dormers, a canted bay window, a turned-post porch with
// brackets / balustrade / portico, mullioned windows (two boarded, one
// smashed), hanging shutters, three chimneys with pots, a weathervane, a
// widow's walk, ivy, gravestones, dead trees and a leaning rusted railing.
//
// BATCHING: every repeated element (shingle courses, quoins, muntins,
// balusters, pickets, deck boards, cresting, ivy, graves) merges through
// `mergedBoxes` / `mergedParts`, so ~1 300 modelled parts cost a few dozen
// draws. Fine detail carries `userData.lodDetail`.
//
// BUDGETS: 4 real PointLights (all night-gated), 2 emitters / 110 particles.
// Metals stay at 0.28 — this Stage has NO env map and metalness ≥ 0.6 renders
// near-black.
// ===========================================================================
export function buildHauntedMansionScene(three: typeof THREE): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
} {
  const t = three;
  const group = new t.Group();

  // ---- massing constants — every position below derives from these ---------
  const HW = 1.65; // main block half-width
  const HD = 1.25; // main block half-depth
  const PLY = 0.18; // plinth top == ground-floor INTERIOR FLOOR
  const GTY = 1.55; // ground-floor wall top
  const WT = 0.16; // shell wall thickness (the room inside is REAL)
  const EAVE1 = 1.68;
  const EX1 = 1.93;
  const EZ1 = 1.53; // tier-1 eave line
  const RIM1 = 2.48;
  const RX1 = 1.02;
  const RZ1 = 0.78;
  const RCZ1 = -0.15; // tier-1 rim (hugs the tier-2 wall)
  const T2Y0 = 1.92;
  const T2Y1 = 3.45;
  const T2HX = 1.05;
  const T2HZ = 0.8;
  const T2CZ = -0.15; // tier-2 walls
  const EAVE2 = 3.56;
  const EX2 = 1.23;
  const EZ2 = 0.98; // tier-2 eave line
  const RIM2 = 4.1;
  const RX2 = 0.5;
  const RZ2 = 0.5; // tier-2 rim (hugs the tower)
  const TWY0 = 3.8;
  const TWY1 = 5.15;
  const TWH = 0.47;
  const TWZ = -0.15; // clock tower
  const CAPY = 6.2; // tower cap apex

  // ---- palette: muted brick red, limestone, forest green, iron grey --------
  const BRICK = 0x8b6a5b;
  const BRICK_D = 0x6d5044;
  const MORTAR = 0xa89b8c;
  const STONE = 0xa9a294;
  const STONE_D = 0x8a8474;
  const TIMBER = 0x584a37;
  const SLATE = 0x59636b;
  const SLATE_D = 0x46505a;
  const IRON = 0x33363a;
  const RUST = 0x6b4b35;
  const MOSS = 0x4a6330;
  const IVY = 0x3f5a2c;
  const DEAD = 0x4c4338;
  const SHUT = 0x36492a;

  // =========================================================================
  // BATCHES — one accumulator per material. `flush()` collapses each into a
  // single mesh. Two SETS exist because the upper stack lives in its own
  // tilted group (the mansion is CROOKED: the storeys lean).
  // =========================================================================
  interface Batches {
    stone: MergedBoxSpec[]; // limestone dressings: quoins, sills, cornices
    stoneD: MergedBoxSpec[]; // older/dirtier stone: plinth, steps, graves
    join: MergedBoxSpec[]; // window joinery: sash frames, muntins, boards
    shut: MergedBoxSpec[]; // shutters + their louvres
    timber: MergedBoxSpec[]; // structural carpentry: deck, rails, bargeboards
    ivy: MergedBoxSpec[]; // creeper leaves
    dead: MergedBoxSpec[]; // dead branches / broken planks
    brick: PartSpec[]; // local masonry canvas
    brickD: PartSpec[];
    slate: PartSpec[]; // local slate canvas
    slateD: PartSpec[];
    iron: PartSpec[]; // railings, cresting, weathervane, gate
    rust: PartSpec[];
    lead: MergedBoxSpec[]; // flashings, gutters, hip rolls
  }
  const newBatches = (): Batches => ({
    stone: [], stoneD: [], join: [], shut: [], timber: [], ivy: [], dead: [],
    brick: [], brickD: [], slate: [], slateD: [], iron: [], rust: [], lead: [],
  });
  const LO = newBatches(); // ground floor + roof + grounds
  const UP = newBatches(); // the leaning upper stack
  const TW = newBatches(); // the tower, which kinks back the other way
  // HARNESS PROBE (no visual cost): how many parts each batch swallowed, so an
  // audit can report MODELLED PART COUNT honestly instead of inferring it from
  // the draw count. A merged mansion draws ~110 times; it is not 110 parts.
  const partCounts: Record<string, number> = {};

  const brickMat = (color: number) => {
    const tex = brickTex(t, color, MORTAR, 1, 1);
    return new t.MeshStandardMaterial({ color: 0xffffff, map: tex, bumpMap: tex, bumpScale: 0.055, roughness: 0.95 });
  };
  const slateMats: THREE.MeshStandardMaterial[] = [];
  const slateMat = (color: number) => {
    const tex = slateTex(t, color);
    const m = new t.MeshStandardMaterial({ color: 0xffffff, map: tex, bumpMap: tex, bumpScale: 0.05, roughness: 0.88 });
    slateMats.push(m);
    return m;
  };
  /** every material that takes the cold MOONLIGHT RIM after dark, with its own
   *  strength: the pale limestone dressings already sit two stops above the
   *  brick, so they take roughly half the lift or the cornices blow out. */
  const moonlit: { m: THREE.MeshStandardMaterial; k: number }[] = [];
  const rimUp = (m: THREE.Material | THREE.Material[], k = 1) => {
    moonlit.push({ m: m as THREE.MeshStandardMaterial, k });
  };

  function flush(B: Batches, host: THREE.Group) {
    const add = (m: THREE.Mesh | null, lod = false) => {
      if (!m) return;
      if (lod) m.userData.lodDetail = true;
      host.add(m);
    };
    for (const k of Object.keys(B) as (keyof Batches)[]) partCounts[k] = (partCounts[k] ?? 0) + B[k].length;
    if (B.stone.length) {
      const m = mergedBoxes(t, B.stone, STONE, { tex: 'concrete', rough: 0.9, bump: 0.035 });
      rimUp(m.material, 0.5); // the dressings are what catch the moon first
      add(m);
    }
    if (B.stoneD.length) {
      const m = mergedBoxes(t, B.stoneD, STONE_D, { tex: 'concrete', rough: 0.95, bump: 0.04 });
      rimUp(m.material, 0.55);
      add(m);
    }
    if (B.join.length) add(mergedBoxes(t, B.join, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.02 }));
    if (B.shut.length) add(mergedBoxes(t, B.shut, SHUT, { tex: 'wood', rough: 0.92, bump: 0.02 }));
    if (B.timber.length) add(mergedBoxes(t, B.timber, 0x7b6a4d, { tex: 'wood', rough: 0.92, bump: 0.025 }));
    if (B.dead.length) add(mergedBoxes(t, B.dead, DEAD, { tex: 'wood', rough: 0.96, bump: 0.03 }));
    if (B.ivy.length) add(mergedBoxes(t, B.ivy, IVY, { tex: 'leaf', rough: 0.95, flat: true }), true);
    // lead: within a shade of the slate it caps. At 0x757b7e the hip rolls
    // read as bright white piping down every arris; at 0x4e565c they read as
    // black piping. Flashings should be *found*, not announced.
    if (B.lead.length) add(mergedBoxes(t, B.lead, 0x606a70, { tex: 'metal', metal: 0.28, rough: 0.72 }));
    if (B.brick.length) {
      const m = mergedParts(t, B.brick, brickMat(BRICK));
      rimUp(m.material);
      add(m);
    }
    if (B.brickD.length) add(mergedParts(t, B.brickD, brickMat(BRICK_D)));
    if (B.slate.length) {
      const m = mergedParts(t, B.slate, slateMat(SLATE));
      rimUp(m.material, 1.15);
      add(m);
    }
    if (B.slateD.length) {
      const m = mergedParts(t, B.slateD, slateMat(SLATE_D));
      rimUp(m.material, 1.15);
      add(m);
    }
    if (B.iron.length) {
      const m = mergedParts(t, B.iron, mat(t, IRON, { tex: 'metal', metal: 0.28, rough: 0.5, repeat: [1, 1] }));
      rimUp(m.material, 1.4); // near-black ironwork needs the most to read at all
      add(m);
    }
    if (B.rust.length) add(mergedParts(t, B.rust, mat(t, RUST, { tex: 'metal', metal: 0.22, rough: 0.85, repeat: [1, 1] })));
  }

  // ---- small geometry helpers ----------------------------------------------
  type V3 = [number, number, number];
  const bpart = (out: PartSpec[], dims: V3, pos: V3, rot: V3 = [0, 0, 0], uv?: [number, number]) => {
    out.push({ geo: new t.BoxGeometry(dims[0], dims[1], dims[2]), matrix: mtx(t, pos, rot), uv });
  };
  const bpartM = (out: PartSpec[], dims: V3, m: THREE.Matrix4, uv?: [number, number]) => {
    out.push({ geo: new t.BoxGeometry(dims[0], dims[1], dims[2]), matrix: m, uv });
  };
  const cpart = (out: PartSpec[], rTop: number, rBot: number, h: number, pos: V3, rot: V3 = [0, 0, 0], seg = 8) => {
    out.push({ geo: new t.CylinderGeometry(rTop, rBot, h, seg), matrix: mtx(t, pos, rot) });
  };
  const cpartM = (out: PartSpec[], rTop: number, rBot: number, h: number, m: THREE.Matrix4, seg = 8) => {
    out.push({ geo: new t.CylinderGeometry(rTop, rBot, h, seg), matrix: m });
  };
  /** a brick wall panel: dims + position, UV'd so the courses stay ~0.11 tall */
  const wall = (out: PartSpec[], dims: V3, pos: V3, rot: V3 = [0, 0, 0]) => {
    bpart(out, dims, pos, rot, [Math.max(1, Math.round(dims[0] / 0.42)), Math.max(1, Math.round(dims[1] / 0.9))]);
  };

  // =========================================================================
  // SHINGLE SLOPES — every roof in this building is laid as overlapping
  // COURSES, not as a plane. `shingleSlope` takes the four corners of a
  // trapezoid (A, B = eave edge left→right; D, C = ridge edge left→right; that
  // winding makes (B−A)×(D−A) point OUT of the roof) and emits `courses` ×
  // `segs` slabs, each lapped down over the one below and SAGGED toward
  // mid-span, so the ridgelines are warped instead of laser straight.
  // =========================================================================
  const _v = () => new t.Vector3();
  const lerpV = (a: THREE.Vector3, b: THREE.Vector3, k: number) => a.clone().lerp(b, k);
  interface SlopeOpts {
    courses?: number;
    segs?: number;
    sag?: number;
    thick?: number;
    lap?: number;
    proud?: number;
    slate?: number; // slate width for the UV pitch
    seed?: number;
  }
  function shingleSlope(out: PartSpec[], A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3, D: THREE.Vector3, o: SlopeOpts = {}) {
    const N = o.courses ?? 8;
    const S = o.segs ?? 3;
    const sag = o.sag ?? 0.018;
    const th = o.thick ?? 0.042;
    const lap = o.lap ?? 0.38;
    const proud = o.proud ?? 0.021;
    const sw = o.slate ?? 0.5;
    const seed = o.seed ?? 0;
    for (let k = 0; k < N; k++) {
      const t0 = k / N;
      const t1 = (k + 1) / N;
      const eL = lerpV(A, D, t0);
      const eR = lerpV(B, C, t0);
      const rL = lerpV(A, D, t1);
      const rR = lerpV(B, C, t1);
      for (let s = 0; s < S; s++) {
        const u0 = s / S;
        const u1 = (s + 1) / S;
        const p00 = lerpV(eL, eR, u0);
        const p01 = lerpV(eL, eR, u1);
        const p10 = lerpV(rL, rR, u0);
        const p11 = lerpV(rL, rR, u1);
        const ctr = p00.clone().add(p01).add(p10).add(p11).multiplyScalar(0.25);
        const u = p01.clone().sub(p00).add(p11).sub(p10).normalize();
        const vRaw = p10.clone().sub(p00).add(p11).sub(p01).multiplyScalar(0.5);
        const n = u.clone().cross(vRaw).normalize();
        const v2 = n.clone().cross(u).normalize();
        const len = (p01.distanceTo(p00) + p11.distanceTo(p10)) * 0.5 + 0.008;
        const runUp = vRaw.length();
        const wid = runUp * (1 + lap);
        // sag: deepest at mid-span of the whole edge, and a hashed ripple
        const um = (u0 + u1) * 0.5;
        const dip = sag * Math.sin(Math.PI * um) + (bhash(seed + k * 7.1 + s * 3.3) - 0.5) * 0.012;
        // lap DOWNSLOPE so each course hangs over the head of the one below
        const pos = ctr
          .clone()
          .addScaledVector(v2, -(wid - runUp) * 0.5)
          .addScaledVector(n, proud + (bhash(seed + k * 2.7 + s) - 0.5) * 0.008);
        pos.y -= dip;
        const m4 = new t.Matrix4().makeBasis(v2, n, u).setPosition(pos.x, pos.y, pos.z);
        out.push({
          geo: new t.BoxGeometry(wid, th, len),
          matrix: m4,
          uv: [Math.max(1, Math.round(wid / sw)), Math.max(1, Math.round(len / sw))],
        });
      }
    }
  }
  /** a full hipped roof: four trapezoidal slopes from an eave rect to a rim
   *  rect, plus lead HIP ROLLS over the four arrises where they meet. */
  function hipRoof(
    out: PartSpec[],
    lead: MergedBoxSpec[],
    e: { hx: number; hz: number; cx: number; cz: number; y: number },
    r: { hx: number; hz: number; cx: number; cz: number; y: number },
    o: SlopeOpts = {},
  ) {
    const V = (x: number, y: number, z: number) => new t.Vector3(x, y, z);
    const eL = e.cx - e.hx;
    const eR = e.cx + e.hx;
    const eF = e.cz + e.hz;
    const eB = e.cz - e.hz;
    const rL = r.cx - r.hx;
    const rR = r.cx + r.hx;
    const rF = r.cz + r.hz;
    const rB = r.cz - r.hz;
    // +z (front), -z (back), +x, -x  — winding chosen so the normal points out
    shingleSlope(out, V(eL, e.y, eF), V(eR, e.y, eF), V(rR, r.y, rF), V(rL, r.y, rF), { ...o, seed: (o.seed ?? 0) + 1 });
    shingleSlope(out, V(eR, e.y, eB), V(eL, e.y, eB), V(rL, r.y, rB), V(rR, r.y, rB), { ...o, seed: (o.seed ?? 0) + 2 });
    shingleSlope(out, V(eR, e.y, eF), V(eR, e.y, eB), V(rR, r.y, rB), V(rR, r.y, rF), { ...o, seed: (o.seed ?? 0) + 3 });
    shingleSlope(out, V(eL, e.y, eB), V(eL, e.y, eF), V(rL, r.y, rF), V(rL, r.y, rB), { ...o, seed: (o.seed ?? 0) + 4 });
    // hip rolls: a lead capping laid along each of the four arrises
    const arris: [THREE.Vector3, THREE.Vector3][] = [
      [V(eR, e.y, eF), V(rR, r.y, rF)],
      [V(eL, e.y, eF), V(rL, r.y, rF)],
      [V(eR, e.y, eB), V(rR, r.y, rB)],
      [V(eL, e.y, eB), V(rL, r.y, rB)],
    ];
    // HIP ROLLS ARE A CAPPING, NOT A HANDRAIL — and they have to clear the
    // COURSES they cap. Two failure modes both got shipped and measured:
    //   0.085 × 0.05 lifted 0.035  -> one continuous bright stripe straight
    //      down the middle of every 45° view (the tier-1 and tier-2 hips
    //      project almost collinearly) and the roof read as seamed;
    //   0.062 × 0.03  lifted 0.019 -> BELOW the course surface (proud 0.021 +
    //      half-thickness 0.021 + hashed jitter), so it winked in and out
    //      between courses and read as a dotted line.
    // The lift is now derived from the slope's own pitch: enough normal
    // clearance (0.05) to sit ON the slates, no more.
    const rise = Math.max(0.01, r.y - e.y);
    const runMin = Math.max(0.01, Math.min(e.hx - r.hx, e.hz - r.hz));
    const cosP = Math.max(0.34, runMin / Math.hypot(runMin, rise));
    const lift = Math.min(0.11, 0.05 / cosP);
    for (const [a, b] of arris) {
      const d = b.clone().sub(a);
      const L = d.length();
      if (L < 0.02) continue;
      const mid = a.clone().addScaledVector(d, 0.5);
      mid.y += lift;
      const yaw = Math.atan2(d.x, d.z);
      const pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
      lead.push({ dims: [0.068, 0.034, L + 0.05], matrix: mtx(t, [mid.x, mid.y, mid.z], [pitch, yaw, 0]) });
    }
  }
  /** a gable roof: two slopes off a ridge running along +z */
  function gableRoofZ(
    out: PartSpec[],
    lead: MergedBoxSpec[],
    o: { cx: number; z0: number; z1: number; halfSpan: number; eaveY: number; ridgeY: number } & SlopeOpts,
  ) {
    const V = (x: number, y: number, z: number) => new t.Vector3(x, y, z);
    const { cx, z0, z1, halfSpan: hs, eaveY: ey, ridgeY: ry } = o;
    // +x slope (eave on the right, ridge on the axis) — eave edge runs z1→z0
    shingleSlope(out, V(cx + hs, ey, z1), V(cx + hs, ey, z0), V(cx, ry, z0), V(cx, ry, z1), { ...o, seed: (o.seed ?? 0) + 5 });
    shingleSlope(out, V(cx - hs, ey, z0), V(cx - hs, ey, z1), V(cx, ry, z1), V(cx, ry, z0), { ...o, seed: (o.seed ?? 0) + 6 });
    lead.push({ dims: [0.09, 0.05, z1 - z0 + 0.05], matrix: mtx(t, [cx, ry + 0.04, (z0 + z1) / 2], [0, 0, 0]) });
  }
  /** a gable roof whose ridge runs along +x (used by the dormers on the side
   *  slopes, whose ridges point out of the building) */
  function gableRoofX(
    out: PartSpec[],
    lead: MergedBoxSpec[],
    o: { cz: number; x0: number; x1: number; halfSpan: number; eaveY: number; ridgeY: number } & SlopeOpts,
  ) {
    const V = (x: number, y: number, z: number) => new t.Vector3(x, y, z);
    const { cz, x0, x1, halfSpan: hs, eaveY: ey, ridgeY: ry } = o;
    shingleSlope(out, V(x0, ey, cz + hs), V(x1, ey, cz + hs), V(x1, ry, cz), V(x0, ry, cz), { ...o, seed: (o.seed ?? 0) + 7 });
    shingleSlope(out, V(x1, ey, cz - hs), V(x0, ey, cz - hs), V(x0, ry, cz), V(x1, ry, cz), { ...o, seed: (o.seed ?? 0) + 8 });
    lead.push({ dims: [x1 - x0 + 0.05, 0.05, 0.09], matrix: mtx(t, [(x0 + x1) / 2, ry + 0.04, cz], [0, 0, 0]) });
  }

  // =========================================================================
  // WINDOWS — a real opening: stone sill, jambs and lintel (or a voussoir
  // arch), a sash frame with MULLIONS AND MUNTINS, the glazing itself, and
  // shutters. The pane is the only part that is NOT batched: its material is
  // mutated every frame by the flicker, and merged parts share one material
  // forever.
  // =========================================================================
  interface WinLamp {
    m: THREE.MeshStandardMaterial;
    day: number;
    night: number;
    sp: number;
    ph: number;
  }
  const lamps: WinLamp[] = [];
  type WinKind = 'lit' | 'dark' | 'boarded' | 'smashed';
  interface WinSpec {
    w: number;
    h: number;
    cols?: number;
    rows?: number;
    kind?: WinKind;
    arch?: boolean;
    shutter?: 'pair' | 'askew' | 'one' | 'none';
    tint?: number;
    glow?: number;
    seed?: number;
  }
  function addWindow(B: Batches, host: THREE.Group, base: THREE.Matrix4, s: WinSpec) {
    const w = s.w;
    const h = s.h;
    const cols = s.cols ?? 2;
    const rows = s.rows ?? 3;
    const kind = s.kind ?? 'lit';
    const seed = s.seed ?? 0;
    const at = (pos: V3, rot: V3 = [0, 0, 0]) => base.clone().multiply(mtx(t, pos, rot));
    // --- stone dressings: sill (proud, weathered), jambs, lintel or arch
    B.stone.push({ dims: [w + 0.2, 0.055, 0.14], matrix: at([0, -h / 2 - 0.045, 0.055]) });
    B.stoneD.push({ dims: [w + 0.24, 0.03, 0.17], matrix: at([0, -h / 2 - 0.08, 0.062]) }); // the drip below it
    B.stone.push({ dims: [0.07, h + 0.03, 0.1], matrix: at([-(w / 2 + 0.035), 0, 0.038]) });
    B.stone.push({ dims: [0.07, h + 0.03, 0.1], matrix: at([w / 2 + 0.035, 0, 0.038]) });
    if (s.arch) {
      // seven voussoirs turning a segmental head over the opening
      const R = w * 0.62;
      for (let i = 0; i < 7; i++) {
        const a = (-Math.PI / 2) * 0.86 + ((Math.PI * 0.86) / 6) * i;
        B.stone.push({
          dims: [0.085, 0.13, 0.11],
          matrix: at([Math.sin(a) * R, h / 2 - 0.02 + Math.cos(a) * R * 0.52, 0.042], [0, 0, -a * 0.7]),
        });
      }
    } else {
      B.stone.push({ dims: [w + 0.26, 0.08, 0.12], matrix: at([0, h / 2 + 0.055, 0.048]) }); // lintel
      B.stone.push({ dims: [w + 0.34, 0.045, 0.16], matrix: at([0, h / 2 + 0.115, 0.058]) }); // label mould
      B.stone.push({ dims: [0.09, 0.06, 0.16], matrix: at([-(w / 2 + 0.125), h / 2 + 0.075, 0.058]) }); // label stops
      B.stone.push({ dims: [0.09, 0.06, 0.16], matrix: at([w / 2 + 0.125, h / 2 + 0.075, 0.058]) });
    }
    // --- the sash frame + muntins (the mullioned grid)
    B.join.push({ dims: [w + 0.03, 0.035, 0.035], matrix: at([0, h / 2 - 0.015, 0.03]) });
    B.join.push({ dims: [w + 0.03, 0.035, 0.035], matrix: at([0, -h / 2 + 0.015, 0.03]) });
    B.join.push({ dims: [0.035, h, 0.035], matrix: at([-(w / 2 - 0.015), 0, 0.03]) });
    B.join.push({ dims: [0.035, h, 0.035], matrix: at([w / 2 - 0.015, 0, 0.03]) });
    const missing = kind === 'smashed' ? 1 + Math.floor(bhash(seed * 5.1) * 2) : -1;
    for (let c = 1; c < cols; c++) {
      if (c === missing) continue;
      B.join.push({ dims: [0.022, h - 0.03, 0.03], matrix: at([-w / 2 + (w * c) / cols, 0, 0.029]) });
    }
    for (let r = 1; r < rows; r++) {
      if (kind === 'smashed' && r === 2) continue;
      B.join.push({ dims: [w - 0.03, 0.022, 0.03], matrix: at([0, -h / 2 + (h * r) / rows, 0.029]) });
    }
    // --- the glazing. Emissive, mutated per frame; never merged.
    const tint = s.tint ?? 0xdf9a30;
    const glow = s.glow ?? 1;
    const dark = kind === 'boarded' || kind === 'dark';
    const gm = new t.MeshStandardMaterial({
      color: kind === 'smashed' ? 0x14161a : 0x2a2013,
      emissive: tint,
      emissiveIntensity: 0.1,
      roughness: kind === 'smashed' ? 0.9 : 0.35,
      metalness: 0.0,
    });
    const pane = new t.Mesh(new t.BoxGeometry(w - 0.02, h - 0.02, 0.03), gm);
    pane.applyMatrix4(at([0, 0, 0.012]));
    pane.castShadow = false;
    pane.receiveShadow = true;
    host.add(pane);
    lamps.push({
      m: gm,
      day: dark ? 0.03 : 0.1,
      night: dark ? 0.05 : (kind === 'smashed' ? 0.22 : 1) * glow,
      sp: 1.7 + bhash(seed * 1.7) * 2.6,
      ph: bhash(seed * 3.1) * 6.28,
    });
    // --- decay: boards nailed over, or a shard of broken glass
    if (kind === 'boarded') {
      for (let i = 0; i < 3; i++) {
        const a = (bhash(seed * 2.3 + i) - 0.5) * 0.34;
        B.dead.push({ dims: [w + 0.26, 0.1, 0.028], matrix: at([(bhash(seed + i) - 0.5) * 0.06, -h / 2 + (h * (i + 0.6)) / 3.2, 0.055], [0, 0, a]) });
      }
    }
    if (kind === 'smashed') {
      for (let i = 0; i < 4; i++) {
        const a = bhash(seed * 4.7 + i);
        B.join.push({
          dims: [0.014, 0.03 + a * 0.14, 0.02],
          matrix: at([(bhash(seed + i * 2) - 0.5) * (w - 0.1), (bhash(seed + i * 3) - 0.5) * (h - 0.1), 0.026], [0, 0, (a - 0.5) * 2]),
        });
      }
    }
    // --- shutters, hung on strap hinges, one pair sagging off its top pintle
    const sh = s.shutter ?? 'none';
    if (sh !== 'none') {
      const sw = w * 0.56;
      // A SAGGING SHUTTER IS STILL BOLTED ON AT ONE HINGE. The first pass just
      // rotated the leaf about its own centre and nudged it, so a 0.6 rad tilt
      // swung the whole panel a clear 0.3 off the wall: the side elevations
      // rendered two green slabs floating in mid-air, which reads as broken
      // geometry, not as decay. The leaf now pivots about its TOP OUTER
      // corner, which is exactly where the surviving pintle is — solve for the
      // centre that keeps that corner where it was.
      const leaf = (side: number, tilt: number) => {
        const hx = side * (w / 2 + sw / 2 + 0.055);
        const ax = side * (sw / 2); // hinge, in the leaf's own frame
        const ay = h / 2;
        const c = Math.cos(tilt);
        const sn = Math.sin(tilt);
        const m = at([hx + ax - (ax * c - ay * sn), ay - (ax * sn + ay * c), 0.085], [0, 0, tilt]);
        B.shut.push({ dims: [sw, h, 0.028], matrix: m });
        for (let i = 0; i < 5; i++) {
          // louvre slats
          B.shut.push({
            dims: [sw - 0.03, 0.028, 0.022],
            matrix: m.clone().multiply(mtx(t, [0, -h / 2 + (h * (i + 0.5)) / 5, 0.02], [0.35, 0, 0])),
          });
        }
        B.rust.push({ geo: new t.BoxGeometry(sw * 0.7, 0.022, 0.014), matrix: m.clone().multiply(mtx(t, [-side * sw * 0.12, h * 0.34, 0.026])) });
        B.rust.push({ geo: new t.BoxGeometry(sw * 0.7, 0.022, 0.014), matrix: m.clone().multiply(mtx(t, [-side * sw * 0.12, -h * 0.34, 0.026])) });
      };
      if (sh === 'pair') {
        leaf(-1, 0);
        leaf(1, 0);
      } else if (sh === 'one') {
        leaf(-1, 0);
      } else {
        // the sagging leaf hangs on the −x (outer) side. It used to hang on
        // +x, which on the two windows flanking the front door put both
        // derelict shutters right beside the doorway and turned the porch
        // into a green thicket.
        // NEGATIVE tilt on the −x leaf swings its foot OUTWARD, away from the
        // glass. Positive swung it across the window it is meant to flank.
        leaf(1, 0);
        leaf(-1, -(0.24 + bhash(seed * 6.3) * 0.13));
      }
    }
  }

  // =========================================================================
  // TIER 1 — the ground floor. A REAL HOLLOW SHELL (four walls, a floor and a
  // ceiling), because the six walkthrough tour anchors put actual guests
  // INSIDE it: they stand in a room, not embedded in a solid block.
  // =========================================================================
  // plinth + water table
  LO.stoneD.push({ dims: [2 * HW + 0.12, PLY, 2 * HD + 0.12], pos: [0, PLY / 2, 0], repeat: [8, 1] });
  LO.stone.push({ dims: [2 * HW + 0.2, 0.06, 2 * HD + 0.2], pos: [0, PLY + 0.02, 0], repeat: [9, 1] }); // drip course
  // the shell: interior x ±1.49, z ±1.09, y 0.18 → 1.51
  const WMH = GTY - PLY; // wall height
  wall(LO.brick, [2 * HW, WMH, WT], [0, PLY + WMH / 2, HD - WT / 2]); // front
  wall(LO.brick, [2 * HW, WMH, WT], [0, PLY + WMH / 2, -(HD - WT / 2)]); // back
  wall(LO.brick, [WT, WMH, 2 * HD - 2 * WT], [-(HW - WT / 2), PLY + WMH / 2, 0]); // left
  wall(LO.brick, [WT, WMH, 2 * HD - 2 * WT], [HW - WT / 2, PLY + WMH / 2, 0]); // right
  LO.timber.push({ dims: [2 * HW - 2 * WT, 0.05, 2 * HD - 2 * WT], pos: [0, PLY + 0.02, 0], repeat: [10, 8] }); // floorboards
  LO.timber.push({ dims: [2 * HW - 2 * WT, 0.06, 2 * HD - 2 * WT], pos: [0, GTY - 0.07, 0], repeat: [10, 8] }); // ceiling

  // QUOINS — alternating long/short dressed stones up all four corners
  const quoinRun = (cx: number, cz: number, sx: number, sz: number, y0: number, y1: number, seed: number) => {
    const H = 0.155;
    const n = Math.floor((y1 - y0) / H);
    for (let i = 0; i < n; i++) {
      const y = y0 + H * (i + 0.5);
      const long = i % 2 === 0;
      const jog = (bhash(seed + i) - 0.5) * 0.012;
      if (long)
        LO.stone.push({ dims: [0.3, H - 0.018, 0.15], pos: [cx - sx * (0.15 - 0.075) + jog, y, cz - sz * 0.075 + jog] });
      else LO.stone.push({ dims: [0.15, H - 0.018, 0.3], pos: [cx - sx * 0.075 + jog, y, cz - sz * (0.15 - 0.075) + jog] });
    }
  };
  quoinRun(HW + 0.03, HD + 0.03, 1, 1, PLY + 0.06, GTY, 11);
  quoinRun(-HW - 0.03, HD + 0.03, -1, 1, PLY + 0.06, GTY, 23);
  quoinRun(HW + 0.03, -HD - 0.03, 1, -1, PLY + 0.06, GTY, 31);
  quoinRun(-HW - 0.03, -HD - 0.03, -1, -1, PLY + 0.06, GTY, 43);

  // STRING COURSE at first-floor level, and the moulded three-member CORNICE
  LO.stone.push({ dims: [2 * HW + 0.14, 0.05, 2 * HD + 0.14], pos: [0, 0.95, 0], repeat: [12, 1] });
  LO.stone.push({ dims: [2 * HW + 0.08, 0.06, 2 * HD + 0.08], pos: [0, GTY - 0.02, 0], repeat: [12, 1] }); // bed mould
  LO.stone.push({ dims: [2 * HW + 0.22, 0.07, 2 * HD + 0.22], pos: [0, GTY + 0.045, 0], repeat: [12, 1] }); // corona
  LO.stone.push({ dims: [2 * HW + 0.3, 0.05, 2 * HD + 0.3], pos: [0, GTY + 0.105, 0], repeat: [13, 1] }); // cyma
  // MODILLIONS under the corona — little brackets every 0.24, all four faces
  for (let x = -HW + 0.06; x <= HW - 0.05; x += 0.24) {
    LO.stone.push({ dims: [0.07, 0.075, 0.13], pos: [x, GTY - 0.015, HD + 0.1] });
    LO.stone.push({ dims: [0.07, 0.075, 0.13], pos: [x, GTY - 0.015, -HD - 0.1] });
  }
  for (let z = -HD + 0.06; z <= HD - 0.05; z += 0.24) {
    LO.stone.push({ dims: [0.13, 0.075, 0.07], pos: [HW + 0.1, GTY - 0.015, z] });
    LO.stone.push({ dims: [0.13, 0.075, 0.07], pos: [-HW - 0.1, GTY - 0.015, z] });
  }

  // ---- the front door: a panelled double door in a moulded stone case ------
  const DX = -0.7; // door centre x, under the porch
  LO.stone.push({ dims: [0.86, 0.09, 0.16], pos: [DX, 1.17, HD + 0.05] }); // entablature over the door
  LO.stone.push({ dims: [0.1, 0.98, 0.13], pos: [DX - 0.38, 0.68, HD + 0.04] });
  LO.stone.push({ dims: [0.1, 0.98, 0.13], pos: [DX + 0.38, 0.68, HD + 0.04] });
  LO.stone.push({ dims: [0.98, 0.05, 0.2], pos: [DX, 1.235, HD + 0.07] }); // cornice hood
  for (const s of [-1, 1]) {
    const dm = box(t, [0.29, 0.86, 0.05], 0x3d2c1b, [DX + s * 0.155, 0.63, HD + 0.035], { tex: 'wood', repeat: [1, 4], rough: 0.85 });
    group.add(dm);
    // raised panels + a hint of a lock plate
    LO.join.push({ dims: [0.2, 0.3, 0.016], pos: [DX + s * 0.155, 0.82, HD + 0.066] });
    LO.join.push({ dims: [0.2, 0.3, 0.016], pos: [DX + s * 0.155, 0.44, HD + 0.066] });
  }
  LO.rust.push({ geo: new t.SphereGeometry(0.032, 8, 6), matrix: mtx(t, [DX + 0.29, 0.66, HD + 0.075]) }); // knob
  LO.rust.push({ geo: new t.BoxGeometry(0.26, 0.03, 0.02), matrix: mtx(t, [DX - 0.13, 0.86, HD + 0.07]) }); // strap hinges
  LO.rust.push({ geo: new t.BoxGeometry(0.26, 0.03, 0.02), matrix: mtx(t, [DX - 0.13, 0.4, HD + 0.07]) });
  // the fanlight over the door — a half-round of radiating bars, LIT
  {
    const fanM = new t.MeshStandardMaterial({ color: 0x2a2013, emissive: 0xe8a840, emissiveIntensity: 0.1, roughness: 0.4 });
    const fan = new t.Mesh(new t.CylinderGeometry(0.33, 0.33, 0.04, 16, 1, false, 0, Math.PI), fanM);
    fan.position.set(DX, 1.235, HD + 0.05);
    fan.rotation.x = Math.PI / 2;
    group.add(fan);
    lamps.push({ m: fanM, day: 0.12, night: 1.25, sp: 1.3, ph: 0.8 });
    for (let i = 1; i < 6; i++) {
      const a = (Math.PI * i) / 6;
      LO.join.push({ dims: [0.022, 0.33, 0.02], pos: [DX + Math.cos(a) * 0.16, 1.235 + Math.sin(a) * 0.16, HD + 0.075], rotZ: a - Math.PI / 2 });
    }
    LO.stone.push({ dims: [0.76, 0.05, 0.14], pos: [DX, 1.245 + 0.32, HD + 0.06] });
  }

  // =========================================================================
  // THE CANTED BAY WINDOW — front right, one storey, under the main eave
  // =========================================================================
  const BAYZ = 1.78; // bay front face
  const BAYY = 1.42; // bay parapet top
  {
    const cxs = 0.95;
    wall(LO.brick, [0.68, BAYY - PLY, BAYZ - HD + 0.02], [cxs, PLY + (BAYY - PLY) / 2, (HD + BAYZ) / 2 - 0.01]); // centre pane wall
    // splayed cheeks
    for (const s of [-1, 1]) {
      const m = mtx(t, [cxs + s * 0.5, PLY + (BAYY - PLY) / 2, (HD + BAYZ) / 2 - 0.03], [0, s * 0.72, 0]);
      bpartM(LO.brick, [0.36, BAYY - PLY, 0.52], m, [1, 3]);
    }
    LO.stoneD.push({ dims: [1.44, 0.1, BAYZ - HD + 0.16], pos: [cxs, PLY - 0.02, (HD + BAYZ) / 2] }); // bay plinth
    // a little lead-capped hipped roof, and a balustrade parapet on it
    LO.lead.push({ dims: [1.5, 0.06, BAYZ - HD + 0.2], matrix: mtx(t, [cxs, BAYY + 0.03, (HD + BAYZ) / 2 - 0.02]) });
    LO.stone.push({ dims: [1.56, 0.05, BAYZ - HD + 0.26], pos: [cxs, BAYY + 0.085, (HD + BAYZ) / 2 - 0.02] });
    for (let i = 0; i < 9; i++) {
      const bx = cxs - 0.66 + (1.32 * i) / 8;
      LO.stone.push({ dims: [0.05, 0.16, 0.05], pos: [bx, BAYY + 0.19, BAYZ - 0.05] });
    }
    LO.stone.push({ dims: [1.5, 0.05, 0.08], pos: [cxs, BAYY + 0.29, BAYZ - 0.05] });
    // the three lights of the bay
    addWindow(LO, group, mtx(t, [cxs, 0.8, BAYZ + 0.01]), { w: 0.5, h: 0.86, cols: 2, rows: 4, kind: 'lit', glow: 1.15, seed: 3 });
    for (const s of [-1, 1])
      addWindow(LO, group, mtx(t, [cxs + s * 0.53, 0.8, BAYZ - 0.18], [0, s * 0.72, 0]), {
        w: 0.3,
        h: 0.86,
        cols: 1,
        rows: 4,
        kind: s < 0 ? 'lit' : 'dark',
        glow: 0.8,
        seed: 4 + s,
      });
  }

  // ---- ground-floor windows on the other elevations ------------------------
  addWindow(LO, group, mtx(t, [-1.4, 0.82, HD + 0.01]), { w: 0.38, h: 0.86, cols: 2, rows: 4, kind: 'lit', shutter: 'askew', glow: 1.0, seed: 7 });
  addWindow(LO, group, mtx(t, [-0.05, 0.82, HD + 0.01]), { w: 0.38, h: 0.86, cols: 2, rows: 4, kind: 'boarded', shutter: 'none', seed: 8 });
  for (const [z, kind, sh] of [
    [-0.66, 'lit', 'pair'],
    [0.42, 'dark', 'askew'],
  ] as [number, WinKind, 'pair' | 'askew'][]) {
    addWindow(LO, group, mtx(t, [HW + 0.01, 0.82, z], [0, Math.PI / 2, 0]), { w: 0.38, h: 0.86, cols: 2, rows: 4, kind, shutter: sh, glow: 0.9, seed: 11 + z });
    addWindow(LO, group, mtx(t, [-HW - 0.01, 0.82, z], [0, -Math.PI / 2, 0]), {
      w: 0.38,
      h: 0.86,
      cols: 2,
      rows: 4,
      kind: kind === 'lit' ? 'smashed' : 'lit',
      shutter: 'pair',
      glow: 0.85,
      seed: 17 + z,
    });
  }
  addWindow(LO, group, mtx(t, [-0.72, 0.82, -HD - 0.01], [0, Math.PI, 0]), { w: 0.38, h: 0.86, cols: 2, rows: 4, kind: 'boarded', seed: 21 });
  addWindow(LO, group, mtx(t, [0.72, 0.82, -HD - 0.01], [0, Math.PI, 0]), { w: 0.38, h: 0.86, cols: 2, rows: 4, kind: 'lit', glow: 0.7, seed: 22 });

  // =========================================================================
  // THE PORCH — deck, four TURNED posts, brackets, balustrade, portico,
  // steps. Everything sits under the tier-1 eave with 0.2 to spare.
  // =========================================================================
  const PZ0 = 1.28;
  const PZ1 = 2.08; // porch depth
  const PX0 = -1.68;
  const PX1 = 0.2; // porch width
  const PDY = 0.2; // deck top
  const PBY = 1.3; // porch beam underside at the eave end
  {
    const pcx = (PX0 + PX1) / 2;
    const pw = PX1 - PX0;
    const pd = PZ1 - PZ0;
    LO.stoneD.push({ dims: [pw + 0.08, 0.14, pd + 0.06], pos: [pcx, 0.09, (PZ0 + PZ1) / 2] }); // the porch's own footing
    LO.timber.push({ dims: [pw, 0.06, pd], pos: [pcx, PDY - 0.03, (PZ0 + PZ1) / 2], repeat: [8, 4] }); // deck bearer
    for (let i = 0; i < 22; i++) {
      // deck BOARDS running front-to-back, hashed gaps, two of them sprung
      const bx = PX0 + 0.045 + (pw - 0.09) * (i / 21);
      const warp = (bhash(i * 4.3) - 0.5) * 0.02;
      LO.timber.push({ dims: [0.072, 0.022, pd - 0.02], pos: [bx, PDY + 0.011 + Math.abs(warp) * 0.4, (PZ0 + PZ1) / 2], rotZ: warp, repeat: [1, 4] });
    }
    // four turned posts (a real profile: base block, torus, shaft, neck, cap)
    const postXs = [PX0 + 0.12, -1.06, -0.42, PX1 - 0.12];
    for (const px of postXs) {
      const lean = (bhash(px * 9.1) - 0.5) * 0.035;
      const pz = PZ1 - 0.13;
      // NB the collar under the shaft used to be IRON, and at close range a
      // near-black disc round the foot of every post read as a rubber washer.
      // It is a turned timber torus, like the rest of the post.
      LO.timber.push({ dims: [0.15, 0.09, 0.15], pos: [px, PDY + 0.045, pz] }); // plinth block
      LO.timber.push({ dims: [0.125, 0.045, 0.125], pos: [px, PDY + 0.112, pz], rotZ: lean }); // torus
      const shaftH = PBY - PDY - 0.24;
      LO.timber.push({ dims: [0.098, shaftH, 0.098], pos: [px + lean * shaftH * 0.5, PDY + 0.14 + shaftH / 2, pz], rotZ: lean, repeat: [1, 5] });
      LO.timber.push({ dims: [0.115, 0.05, 0.115], pos: [px + lean * shaftH, PDY + 0.16 + shaftH, pz], rotZ: lean }); // neck
      LO.timber.push({ dims: [0.15, 0.06, 0.15], pos: [px + lean * shaftH, PDY + 0.2 + shaftH, pz], rotZ: lean }); // capital
      // scroll BRACKETS both sides of every post
      for (const s of [-1, 1]) {
        LO.timber.push({ dims: [0.2, 0.032, 0.055], pos: [px + s * 0.13, PBY - 0.09, pz], rotZ: s * 0.62 });
        LO.timber.push({ dims: [0.11, 0.026, 0.05], pos: [px + s * 0.15, PBY - 0.16, pz], rotZ: s * 0.95 });
      }
    }
    // beam + frieze
    LO.timber.push({ dims: [pw + 0.1, 0.09, 0.11], pos: [pcx, PBY + 0.045, PZ1 - 0.13], repeat: [10, 1] });
    LO.timber.push({ dims: [pw + 0.14, 0.11, 0.05], pos: [pcx, PBY + 0.155, PZ1 - 0.06], repeat: [11, 1] });
    // porch BALUSTRADE, with the gap at the steps
    const railZ = PZ1 - 0.13;
    const gap0 = -1.13;
    const gap1 = -0.27;
    for (const [x0, x1] of [
      [PX0 + 0.16, gap0],
      [gap1, PX1 - 0.16],
    ]) {
      LO.timber.push({ dims: [x1 - x0, 0.045, 0.06], pos: [(x0 + x1) / 2, 0.79, railZ] });
      LO.timber.push({ dims: [x1 - x0, 0.035, 0.05], pos: [(x0 + x1) / 2, 0.34, railZ] });
      const n = Math.max(2, Math.round((x1 - x0) / 0.11));
      for (let i = 1; i < n; i++) {
        const bx = x0 + ((x1 - x0) * i) / n;
        // a TURNED baluster: four stacked members
        LO.join.push({ dims: [0.038, 0.06, 0.038], pos: [bx, 0.39, railZ] });
        LO.join.push({ dims: [0.052, 0.05, 0.052], pos: [bx, 0.45, railZ] });
        LO.join.push({ dims: [0.03, 0.22, 0.03], pos: [bx, 0.59, railZ] });
        LO.join.push({ dims: [0.046, 0.05, 0.046], pos: [bx, 0.72, railZ] });
      }
    }
    // a boarded SOFFIT: without it you look up at the backs of the shingle
    // slabs and the porch reads as a jumble of floating bars
    LO.timber.push({ dims: [pw + 0.06, 0.03, 0.64], pos: [pcx, 1.295, 1.6], repeat: [9, 3] });
    // porch ROOF: a shed slope, shingled, plus a fascia and a sagging gutter
    const V = (x: number, y: number, z: number) => new t.Vector3(x, y, z);
    shingleSlope(LO.slate, V(PX0 - 0.08, 1.3, PZ1 + 0.06), V(PX1 + 0.08, 1.3, PZ1 + 0.06), V(PX1 + 0.08, 1.52, PZ0 - 0.02), V(PX0 - 0.08, 1.52, PZ0 - 0.02), {
      courses: 5,
      segs: 6,
      sag: 0.026,
      seed: 40,
    });
    LO.timber.push({ dims: [pw + 0.2, 0.1, 0.05], pos: [pcx, 1.26, PZ1 + 0.085], repeat: [12, 1] }); // fascia
    LO.lead.push({ dims: [pw + 0.16, 0.055, 0.075], matrix: mtx(t, [pcx, 1.21, PZ1 + 0.115], [0, 0, 0.012]) }); // gutter, out of true
    LO.rust.push({ geo: new t.CylinderGeometry(0.022, 0.022, 1.02, 8), matrix: mtx(t, [PX0 + 0.02, 0.71, PZ1 + 0.1]) }); // downpipe
    // PORTICO: a small pediment over the steps
    {
      const px = -0.7;
      const hs = 0.44;
      shingleSlope(LO.slate, V(px, 1.62, PZ1 + 0.14), V(px + hs, 1.4, PZ1 + 0.14), V(px + hs, 1.4, 1.7), V(px, 1.62, 1.7), { courses: 3, segs: 2, sag: 0.01, seed: 44 });
      shingleSlope(LO.slate, V(px - hs, 1.4, PZ1 + 0.14), V(px, 1.62, PZ1 + 0.14), V(px, 1.62, 1.7), V(px - hs, 1.4, 1.7), { courses: 3, segs: 2, sag: 0.01, seed: 45 });
      // tympanum + raking bargeboards with a carved edge
      const tym = new t.Mesh(
        new t.ExtrudeGeometry(new t.Shape([new t.Vector2(-hs, 0), new t.Vector2(hs, 0), new t.Vector2(0, 0.22)]), { depth: 0.06, bevelEnabled: false }),
        mat(t, 0x6a5940, { tex: 'wood', repeat: [3, 1], rough: 0.92 }),
      );
      tym.position.set(px, 1.4, PZ1 + 0.08);
      tym.castShadow = true;
      group.add(tym);
      for (const s of [-1, 1]) {
        LO.timber.push({ dims: [hs * 1.06, 0.075, 0.035], pos: [px + s * hs * 0.5, 1.515, PZ1 + 0.155], rotZ: -s * 0.463 });
        for (let i = 0; i < 5; i++) {
          const k = (i + 0.5) / 5;
          LO.timber.push({ dims: [0.05, 0.05, 0.03], pos: [px + s * hs * k, 1.62 - 0.22 * k - 0.06, PZ1 + 0.16] });
        }
      }
      // apex finial. It was STONE at 0.09 and, being the palest thing in the
      // frame against a dark roof, read as a white cube floating over the
      // porch. Timber, and small enough to be a finial.
      LO.timber.push({ dims: [0.045, 0.14, 0.045], pos: [px, 1.665, PZ1 + 0.12] });
      LO.timber.push({ dims: [0.062, 0.062, 0.062], pos: [px, 1.755, PZ1 + 0.12], rotY: 0.7 });
    }
    // STEPS down from the porch — cracked, one corner broken away
    for (let i = 0; i < 3; i++) {
      const sy = PDY - 0.055 * (i + 1);
      const sz = PZ1 + 0.055 + i * 0.11;
      LO.stoneD.push({ dims: [0.92 - i * 0.02, 0.055, 0.12], pos: [-0.7 + (bhash(i * 3.9) - 0.5) * 0.02, sy + 0.028, sz] });
    }
    LO.stoneD.push({ dims: [0.2, 0.04, 0.18], pos: [-0.22, 0.03, PZ1 + 0.3], rotY: 0.42 }); // a slab that has slid loose
    LO.stoneD.push({ dims: [0.26, 0.035, 0.2], pos: [-1.16, 0.025, PZ1 + 0.26], rotY: -0.3 });
  }

  // ---- the tier-1 hipped roof, its fascia, gutters and cobwebbed eaves -----
  hipRoof(
    LO.slate,
    LO.lead,
    { hx: EX1, hz: EZ1, cx: 0, cz: 0, y: EAVE1 },
    { hx: RX1, hz: RZ1, cx: 0, cz: RCZ1, y: RIM1 },
    { courses: 9, segs: 7, sag: 0.03, seed: 100 },
  );
  // eave fascia + a gutter that has come away at one corner
  LO.timber.push({ dims: [2 * EX1 + 0.06, 0.1, 0.05], pos: [0, EAVE1 - 0.05, EZ1 + 0.02], repeat: [16, 1] });
  LO.timber.push({ dims: [2 * EX1 + 0.06, 0.1, 0.05], pos: [0, EAVE1 - 0.05, -EZ1 - 0.02], repeat: [16, 1] });
  LO.timber.push({ dims: [0.05, 0.1, 2 * EZ1 + 0.06], pos: [EX1 + 0.02, EAVE1 - 0.05, 0], repeat: [1, 1] });
  LO.timber.push({ dims: [0.05, 0.1, 2 * EZ1 + 0.06], pos: [-EX1 - 0.02, EAVE1 - 0.05, 0], repeat: [1, 1] });
  LO.lead.push({ dims: [2 * EX1 * 0.62, 0.06, 0.08], matrix: mtx(t, [-0.28, EAVE1 - 0.115, EZ1 + 0.055], [0, 0, 0.02]) });
  LO.lead.push({ dims: [2 * EX1 * 0.3, 0.06, 0.08], matrix: mtx(t, [1.38, EAVE1 - 0.2, EZ1 + 0.055], [0, 0, -0.13]) }); // sagging length
  LO.rust.push({ geo: new t.CylinderGeometry(0.026, 0.026, 1.5, 8), matrix: mtx(t, [EX1 - 0.02, 0.9, EZ1 - 0.02]) });

  // =========================================================================
  // DORMERS — one on each side slope and one at the back. Each cheek is
  // buried deep enough into the slope that no daylight shows under it.
  // =========================================================================
  const sideDormer = (side: number, cz: number, seed: number) => {
    const xFace = side * 1.74;
    const xBack = side * 1.11;
    const hz = 0.3;
    const eaveY = 2.2;
    const ridgeY = 2.4;
    // front wall + cheeks (they run down INTO the slope; the slope surface at
    // the face is y 1.85, at the back x it is 2.40)
    wall(LO.brick, [0.12, 0.95, 2 * hz], [xFace - side * 0.06, 1.78, cz]);
    for (const s of [-1, 1]) {
      wall(LO.brick, [Math.abs(xFace - xBack), 0.95, 0.06], [(xFace + xBack) / 2, 1.78, cz + s * hz]);
    }
    gableRoofX(LO.slate, LO.lead, {
      cz,
      x0: Math.min(xFace + side * 0.08, xBack),
      x1: Math.max(xFace + side * 0.08, xBack),
      halfSpan: hz + 0.1,
      eaveY,
      ridgeY,
      courses: 4,
      segs: 3,
      sag: 0.012,
      seed,
    });
    // bargeboard on the dormer face + a pendant
    LO.timber.push({ dims: [0.05, 0.075, hz * 1.2], pos: [xFace + side * 0.09, (eaveY + ridgeY) / 2 + 0.04, cz + hz * 0.55], rotX: -0.32 });
    LO.timber.push({ dims: [0.05, 0.075, hz * 1.2], pos: [xFace + side * 0.09, (eaveY + ridgeY) / 2 + 0.04, cz - hz * 0.55], rotX: 0.32 });
    LO.timber.push({ dims: [0.045, 0.14, 0.045], pos: [xFace + side * 0.09, ridgeY + 0.05, cz] });
    LO.lead.push({ dims: [0.1, 0.03, 2 * hz + 0.2], matrix: mtx(t, [xBack + side * 0.03, 2.28, cz]) }); // back flashing
    addWindow(LO, group, mtx(t, [xFace + side * 0.005, 2.02, cz], [0, (side * Math.PI) / 2, 0]), {
      w: 0.28,
      h: 0.4,
      cols: 2,
      rows: 2,
      kind: side > 0 ? 'lit' : 'dark',
      glow: 1.3,
      seed,
    });
  };
  sideDormer(1, -0.15, 51);
  sideDormer(-1, -0.15, 57);
  {
    // back dormer, ridge running in z
    const zFace = -1.42;
    const zBack = -0.99;
    wall(LO.brick, [0.6, 0.95, 0.12], [0.35, 1.78, zFace + 0.06]);
    for (const s of [-1, 1]) wall(LO.brick, [0.06, 0.95, Math.abs(zFace - zBack)], [0.35 + s * 0.3, 1.78, (zFace + zBack) / 2]);
    gableRoofZ(LO.slate, LO.lead, { cx: 0.35, z0: zFace - 0.08, z1: zBack, halfSpan: 0.4, eaveY: 2.2, ridgeY: 2.4, courses: 4, segs: 3, sag: 0.012, seed: 63 });
    addWindow(LO, group, mtx(t, [0.35, 2.02, zFace - 0.005], [0, Math.PI, 0]), { w: 0.28, h: 0.4, cols: 2, rows: 2, kind: 'boarded', seed: 63 });
  }

  // =========================================================================
  // CHIMNEYS — three, all in the local masonry, corbelled caps and clay pots.
  // Each base is buried in the slope it rises through.
  // =========================================================================
  /** the tier-1 hip roof's surface height at (x, z) — the four slopes meet at
   *  the hips, so the surface is the eave plus the rise at whichever slope
   *  parameter is SMALLEST (i.e. whichever eave the point is nearest). Used to
   *  seat the chimney flashings: at a hand-picked fixed y all three were buried
   *  inside the slates and the flashing did nothing at all. */
  const roofYAt = (x: number, z: number) => {
    const tF = (EZ1 - z) / (EZ1 - (RCZ1 + RZ1));
    const tB = (z + EZ1) / (EZ1 + RCZ1 - RZ1);
    const tR = (EX1 - x) / (EX1 - RX1);
    const tL = (x + EX1) / (EX1 - RX1);
    const k = Math.max(0, Math.min(1, Math.min(tF, tB, tR, tL)));
    return EAVE1 + (RIM1 - EAVE1) * k;
  };
  const chimney = (x: number, z: number, top: number, w: number, d: number, lean: number, pots: number, seed: number) => {
    const stack = brickBox(t, [w, top - 1.2, d], BRICK_D, MORTAR, [x, (1.2 + top) / 2, z], [Math.round(w / 0.4) || 1, Math.round((top - 1.2) / 0.9) || 2], {
      rotZ: lean,
    });
    group.add(stack);
    rimUp(stack.material);
    const tx = x + lean * (top - 1.2) * 0.5;
    // corbelled cap: three oversailing courses
    LO.brickD.push({ geo: new t.BoxGeometry(w + 0.05, 0.06, d + 0.05), matrix: mtx(t, [tx, top + 0.02, z], [0, 0, lean]), uv: [2, 1] });
    LO.brickD.push({ geo: new t.BoxGeometry(w + 0.1, 0.06, d + 0.1), matrix: mtx(t, [tx, top + 0.08, z], [0, 0, lean]), uv: [2, 1] });
    LO.stoneD.push({ dims: [w + 0.14, 0.05, d + 0.14], matrix: mtx(t, [tx, top + 0.135, z], [0, 0, lean]) });
    for (let i = 0; i < pots; i++) {
      const px = tx + (pots === 1 ? 0 : -w * 0.26 + (w * 0.52 * i) / (pots - 1));
      cpart(LO.rust, 0.055, 0.062, 0.17, [px, top + 0.245, z], [0, 0, lean], 10);
      cpart(LO.rust, 0.062, 0.05, 0.04, [px, top + 0.35, z], [0, 0, lean], 10);
    }
    // lead flashing + soaker apron where the stack passes through the slates,
    // seated on the MEASURED slope height at this chimney's own footprint
    const fy = roofYAt(x, z);
    LO.lead.push({ dims: [w + 0.17, 0.035, d + 0.17], matrix: mtx(t, [x + lean * 0.1, fy + 0.05, z], [0, 0, lean]) });
    LO.lead.push({ dims: [w + 0.1, 0.09, d + 0.1], matrix: mtx(t, [x + lean * 0.1, fy + 0.11, z], [0, 0, lean]) });
    void seed;
    return stack;
  };
  chimney(1.42, -0.55, 3.35, 0.34, 0.3, 0.055, 2, 1);
  chimney(-1.5, 0.35, 2.95, 0.28, 0.26, -0.04, 1, 2);
  chimney(0.05, -1.2, 3.15, 0.3, 0.26, 0.02, 2, 3);

  // =========================================================================
  // THE UPPER STACK — tier 2 + its roof, in a group that LEANS. The mansion
  // is crooked and this is where you read it: the base of this group is
  // buried 0.56 inside the tier-1 roof, so the lean opens no gap.
  // =========================================================================
  const upper = new t.Group();
  upper.rotation.z = -0.021;
  upper.rotation.x = 0.009;
  group.add(upper);
  {
    const H2 = T2Y1 - T2Y0;
    wall(UP.brick, [2 * T2HX, H2, 2 * T2HZ], [0, T2Y0 + H2 / 2, T2CZ]);
    // quoins, string course, cornice — the same vocabulary, one size down
    const q2 = (cx: number, cz: number, sx: number, sz: number, seed: number) => {
      const Hq = 0.14;
      const n = Math.floor((T2Y1 - 2.5) / Hq);
      for (let i = 0; i < n; i++) {
        const y = 2.5 + Hq * (i + 0.5);
        const long = i % 2 === 0;
        if (long) UP.stone.push({ dims: [0.26, Hq - 0.016, 0.13], pos: [cx + sx * 0.075, y, cz + sz * 0.065] });
        else UP.stone.push({ dims: [0.13, Hq - 0.016, 0.26], pos: [cx + sx * 0.065, y, cz + sz * 0.075] });
      }
    };
    q2(T2HX - 0.06, T2CZ + T2HZ - 0.06, 1, 1, 1);
    q2(-T2HX + 0.06, T2CZ + T2HZ - 0.06, -1, 1, 2);
    q2(T2HX - 0.06, T2CZ - T2HZ + 0.06, 1, -1, 3);
    q2(-T2HX + 0.06, T2CZ - T2HZ + 0.06, -1, -1, 4);
    UP.stone.push({ dims: [2 * T2HX + 0.1, 0.045, 2 * T2HZ + 0.1], pos: [0, 2.95, T2CZ], repeat: [10, 1] });
    UP.stone.push({ dims: [2 * T2HX + 0.06, 0.055, 2 * T2HZ + 0.06], pos: [0, T2Y1 - 0.02, T2CZ], repeat: [10, 1] });
    UP.stone.push({ dims: [2 * T2HX + 0.18, 0.06, 2 * T2HZ + 0.18], pos: [0, T2Y1 + 0.04, T2CZ], repeat: [10, 1] });
    UP.stone.push({ dims: [2 * T2HX + 0.24, 0.04, 2 * T2HZ + 0.24], pos: [0, T2Y1 + 0.09, T2CZ], repeat: [11, 1] });
    for (let x = -T2HX + 0.08; x <= T2HX - 0.07; x += 0.22) {
      UP.stone.push({ dims: [0.06, 0.065, 0.11], pos: [x, T2Y1 - 0.015, T2CZ + T2HZ + 0.08] });
      UP.stone.push({ dims: [0.06, 0.065, 0.11], pos: [x, T2Y1 - 0.015, T2CZ - T2HZ - 0.08] });
    }

    // tier-2 windows
    for (const s of [-1, 1]) {
      addWindow(UP, upper, mtx(t, [s * 0.8, 2.95, T2CZ + T2HZ + 0.01]), {
        w: 0.34,
        h: 0.66,
        cols: 2,
        rows: 3,
        kind: s > 0 ? 'lit' : 'dark',
        shutter: s > 0 ? 'askew' : 'pair',
        glow: 1.2,
        seed: 70 + s,
      });
      for (const z of [-0.5, 0.28]) {
        addWindow(UP, upper, mtx(t, [s * (T2HX + 0.01), 2.95, z], [0, (s * Math.PI) / 2, 0]), {
          w: 0.34,
          h: 0.66,
          cols: 2,
          rows: 3,
          kind: bhash(s * 13 + z * 7) > 0.6 ? 'boarded' : 'lit',
          shutter: 'pair',
          glow: 0.95,
          seed: 74 + s * 3 + z,
        });
      }
    }
    addWindow(UP, upper, mtx(t, [0, 2.95, T2CZ - T2HZ - 0.01], [0, Math.PI, 0]), { w: 0.34, h: 0.66, cols: 2, rows: 3, kind: 'smashed', seed: 79 });

    // ---- THE FRONT CROSS-GABLE: the hero of the front elevation -----------
    const GZ = 1.1; // gable front face
    const GHX = 0.58;
    const GAP = 4.3; // apex
    wall(UP.brick, [2 * GHX, GAP - 0.35 - T2Y0, GZ - 0.55], [0, T2Y0 + (GAP - 0.35 - T2Y0) / 2, (0.55 + GZ) / 2]);
    // the gable triangle, in one extruded piece so the rake is clean
    {
      const tri = new t.Shape([new t.Vector2(-GHX, 0), new t.Vector2(GHX, 0), new t.Vector2(0, GAP - 3.55)]);
      const bt = brickTex(t, BRICK, MORTAR, 3, 3);
      const gm = new t.Mesh(new t.ExtrudeGeometry(tri, { depth: GZ - 0.55, bevelEnabled: false }), new t.MeshStandardMaterial({ color: 0xffffff, map: bt, bumpMap: bt, bumpScale: 0.05, roughness: 0.95 }));
      gm.position.set(0, 3.55, 0.55);
      gm.castShadow = true;
      gm.receiveShadow = true;
      upper.add(gm);
      rimUp(gm.material);
    }
    gableRoofZ(UP.slate, UP.lead, { cx: 0, z0: 0.15, z1: GZ + 0.14, halfSpan: GHX + 0.14, eaveY: 3.56, ridgeY: GAP, courses: 6, segs: 4, sag: 0.02, seed: 110 });
    // BARGEBOARDS with a scalloped edge and a pendant drop at the apex
    for (const s of [-1, 1]) {
      const L = Math.hypot(GHX + 0.14, GAP - 3.56);
      UP.timber.push({ dims: [L, 0.1, 0.04], pos: [(s * (GHX + 0.14)) / 2, (3.56 + GAP) / 2 + 0.05, GZ + 0.17], rotZ: -s * Math.atan2(GAP - 3.56, GHX + 0.14) });
      for (let i = 0; i < 6; i++) {
        const k = (i + 0.5) / 6;
        UP.timber.push({ dims: [0.055, 0.055, 0.032], pos: [s * (GHX + 0.14) * k, GAP - (GAP - 3.56) * k - 0.085, GZ + 0.175] });
      }
      UP.stone.push({ dims: [0.1, 0.07, 0.15], pos: [s * (GHX + 0.06), 3.56, GZ + 0.1] }); // cornice returns
    }
    UP.timber.push({ dims: [0.05, 0.2, 0.05], pos: [0, GAP + 0.06, GZ + 0.16] });
    UP.iron.push({ geo: new t.SphereGeometry(0.055, 10, 8), matrix: mtx(t, [0, GAP + 0.19, GZ + 0.16]) });
    UP.timber.push({ dims: [0.045, 0.17, 0.045], pos: [0, 3.42, GZ + 0.16] }); // the drop pendant
    UP.timber.push({ dims: [0.07, 0.06, 0.055], pos: [0, 3.32, GZ + 0.16] });

    // ROSE WINDOW in the gable — the arched/round light the brief wants
    {
      const ry = 3.86;
      const ring = new t.Mesh(new t.TorusGeometry(0.23, 0.045, 8, 20), mat(t, STONE, { tex: 'concrete', repeat: [6, 1], rough: 0.9 }));
      ring.position.set(0, ry, GZ + 0.03);
      ring.castShadow = true;
      upper.add(ring);
      const rm = new t.MeshStandardMaterial({ color: 0x241a10, emissive: 0xe0b64a, emissiveIntensity: 0.1, roughness: 0.35 });
      const rose = new t.Mesh(new t.CylinderGeometry(0.215, 0.215, 0.04, 18), rm);
      rose.position.set(0, ry, GZ + 0.015);
      rose.rotation.x = Math.PI / 2;
      upper.add(rose);
      lamps.push({ m: rm, day: 0.12, night: 1.5, sp: 0.9, ph: 2.2 });
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * i) / 6;
        UP.stone.push({ dims: [0.03, 0.42, 0.035], pos: [0, ry, GZ + 0.045], rotZ: a });
      }
      UP.stone.push({ dims: [0.09, 0.09, 0.09], pos: [0, ry + 0.3, GZ + 0.03], rotY: 0.78 }); // keystone
    }
    // the tall gable window below the rose
    addWindow(UP, upper, mtx(t, [0, 3.02, GZ + 0.01]), { w: 0.42, h: 0.78, cols: 2, rows: 4, kind: 'lit', arch: true, glow: 1.45, seed: 81 });
    // a BALCONY on the gable's projecting nose, with a rusted rail
    UP.stone.push({ dims: [1.3, 0.07, 0.3], pos: [0, 2.52, GZ + 0.1] });
    for (const s of [-1, 1]) UP.stone.push({ dims: [0.13, 0.17, 0.22], pos: [s * 0.5, 2.42, GZ + 0.06], rotZ: s * 0.2 }); // corbels
    for (let i = 0; i <= 10; i++) cpart(UP.rust, 0.016, 0.016, 0.3, [-0.6 + i * 0.12, 2.7, GZ + 0.22], [0, 0, (bhash(i * 5.5) - 0.5) * 0.12], 6);
    UP.rust.push({ geo: new t.BoxGeometry(1.26, 0.03, 0.03), matrix: mtx(t, [0, 2.85, GZ + 0.22], [0, 0, 0.01]) });
    for (const s of [-1, 1]) UP.rust.push({ geo: new t.BoxGeometry(0.03, 0.3, 0.3), matrix: mtx(t, [s * 0.63, 2.7, GZ + 0.08]) });

    // tier-2 hipped roof + cresting round its rim
    hipRoof(
      UP.slate,
      UP.lead,
      { hx: EX2, hz: EZ2, cx: 0, cz: T2CZ, y: EAVE2 },
      { hx: RX2, hz: RZ2, cx: 0, cz: TWZ, y: RIM2 },
      { courses: 7, segs: 5, sag: 0.022, seed: 130 },
    );
    UP.timber.push({ dims: [2 * EX2 + 0.05, 0.09, 0.045], pos: [0, EAVE2 - 0.045, T2CZ + EZ2 + 0.02], repeat: [12, 1] });
    UP.timber.push({ dims: [2 * EX2 + 0.05, 0.09, 0.045], pos: [0, EAVE2 - 0.045, T2CZ - EZ2 - 0.02], repeat: [12, 1] });
    UP.timber.push({ dims: [0.045, 0.09, 2 * EZ2 + 0.05], pos: [EX2 + 0.02, EAVE2 - 0.045, T2CZ] });
    UP.timber.push({ dims: [0.045, 0.09, 2 * EZ2 + 0.05], pos: [-EX2 - 0.02, EAVE2 - 0.045, T2CZ] });

    // =======================================================================
    // THE CLOCK TOWER — kinks BACK against the lean of the storey below it.
    // =======================================================================
    const tower = new t.Group();
    tower.position.set(0, TWY0, TWZ);
    tower.rotation.z = 0.036;
    tower.rotation.x = -0.013;
    upper.add(tower);
    const TH = TWY1 - TWY0;
    const clockHands = new t.Group(); // filled in by the clock block below
    const vane = new t.Group(); // ...and the weathervane block after it
    wall(TW.brick, [2 * TWH, TH, 2 * TWH], [0, TH / 2, 0]);
    // quoins on all four tower corners
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        for (let i = 0; i < 9; i++) {
          const y = 0.12 + 0.135 * i;
          const long = i % 2 === 0;
          if (long) TW.stone.push({ dims: [0.24, 0.118, 0.12], pos: [sx * (TWH - 0.055), y, sz * (TWH - 0.05)] });
          else TW.stone.push({ dims: [0.12, 0.118, 0.24], pos: [sx * (TWH - 0.05), y, sz * (TWH - 0.055)] });
        }
      }
    TW.stone.push({ dims: [2 * TWH + 0.08, 0.04, 2 * TWH + 0.08], pos: [0, 0.62, 0], repeat: [8, 1] });
    // the tower cornice + WIDOW'S WALK
    TW.stone.push({ dims: [2 * TWH + 0.06, 0.05, 2 * TWH + 0.06], pos: [0, TH - 0.02, 0], repeat: [8, 1] });
    TW.stone.push({ dims: [2 * TWH + 0.2, 0.06, 2 * TWH + 0.2], pos: [0, TH + 0.04, 0], repeat: [9, 1] });
    TW.stone.push({ dims: [2 * TWH + 0.26, 0.04, 2 * TWH + 0.26], pos: [0, TH + 0.09, 0], repeat: [9, 1] });
    {
      const R = TWH + 0.11;
      for (const s of [-1, 1]) {
        for (let i = 0; i <= 9; i++) {
          const u = -R + (2 * R * i) / 9;
          cpart(TW.iron, 0.014, 0.014, 0.22, [u, TH + 0.22, s * R], [0, 0, (bhash(i * 2.3 + s) - 0.5) * 0.1], 6);
          cpart(TW.iron, 0.014, 0.014, 0.22, [s * R, TH + 0.22, u], [0, 0, (bhash(i * 3.1 - s) - 0.5) * 0.1], 6);
        }
        TW.iron.push({ geo: new t.BoxGeometry(2 * R + 0.03, 0.025, 0.025), matrix: mtx(t, [0, TH + 0.33, s * R]) });
        TW.iron.push({ geo: new t.BoxGeometry(0.025, 0.025, 2 * R + 0.03), matrix: mtx(t, [s * R, TH + 0.33, 0]) });
        // fleur cresting along the top rail
        for (let i = 0; i < 7; i++) {
          const u = -R + 0.09 + ((2 * R - 0.18) * i) / 6;
          TW.iron.push({ geo: new t.BoxGeometry(0.02, 0.07, 0.014), matrix: mtx(t, [u, TH + 0.38, s * R]) });
          TW.iron.push({ geo: new t.BoxGeometry(0.014, 0.07, 0.02), matrix: mtx(t, [s * R, TH + 0.38, u]) });
        }
      }
    }
    // the CLOCK: a dished stone roundel, a cream face, ticks and hands
    const clockY = TH - 0.5;
    {
      const surr = new t.Mesh(new t.TorusGeometry(0.24, 0.05, 8, 22), mat(t, STONE, { tex: 'concrete', repeat: [7, 1], rough: 0.9 }));
      surr.position.set(0, clockY, TWH + 0.02);
      surr.castShadow = true;
      tower.add(surr);
      const faceM = new t.MeshStandardMaterial({ color: 0xd9d2bb, emissive: 0xb8ad86, emissiveIntensity: 0.06, roughness: 0.62 });
      const face = new t.Mesh(new t.CylinderGeometry(0.225, 0.225, 0.05, 22), faceM);
      face.position.set(0, clockY, TWH + 0.005);
      face.rotation.x = Math.PI / 2;
      tower.add(face);
      lamps.push({ m: faceM, day: 0.06, night: 0.62, sp: 0.4, ph: 4.1 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        TW.iron.push({
          geo: new t.BoxGeometry(0.016, i % 3 === 0 ? 0.055 : 0.032, 0.014),
          matrix: mtx(t, [Math.sin(a) * 0.185, clockY + Math.cos(a) * 0.185, TWH + 0.035], [0, 0, -a]),
        });
      }
      clockHands.position.set(0, clockY, TWH + 0.045);
      tower.add(clockHands);
      const hM = mat(t, 0x1d1a16, { rough: 0.5 });
      const hourH = new t.Mesh(new t.BoxGeometry(0.022, 0.12, 0.014), hM);
      hourH.position.y = 0.05;
      const hourG = new t.Group();
      hourG.add(hourH);
      const minH = new t.Mesh(new t.BoxGeometry(0.018, 0.18, 0.012), hM);
      minH.position.y = 0.08;
      const minG = new t.Group();
      minG.add(minH);
      clockHands.add(hourG, minG);
      clockHands.userData.hourG = hourG;
      clockHands.userData.minG = minG;
      TW.iron.push({ geo: new t.SphereGeometry(0.028, 8, 6), matrix: mtx(t, [0, clockY, TWH + 0.05]) });
    }
    // tower belfry lights on the two sides, an arched one at the back
    for (const s of [-1, 1])
      addWindow(TW, tower, mtx(t, [s * (TWH + 0.01), TH - 0.42, 0], [0, (s * Math.PI) / 2, 0]), {
        w: 0.28,
        h: 0.5,
        cols: 2,
        rows: 3,
        kind: 'lit',
        arch: true,
        glow: 1.35,
        seed: 90 + s,
      });
    addWindow(TW, tower, mtx(t, [0, TH - 0.42, -TWH - 0.01], [0, Math.PI, 0]), { w: 0.26, h: 0.46, cols: 2, rows: 3, kind: 'dark', arch: true, seed: 93 });

    // the steep pyramidal CAP, laid as four shingled slopes to a finial
    const capBase = TH + 0.11;
    const capApex = CAPY - TWY0;
    hipRoof(
      TW.slateD,
      TW.lead,
      { hx: TWH + 0.13, hz: TWH + 0.13, cx: 0, cz: 0, y: capBase },
      { hx: 0.035, hz: 0.035, cx: 0, cz: 0, y: capApex },
      { courses: 9, segs: 3, sag: 0.012, lap: 0.42, seed: 150 },
    );
    // finial: a moulded spike carrying the WEATHERVANE
    cpart(TW.iron, 0.035, 0.06, 0.1, [0, capApex + 0.03, 0], [0, 0, 0], 10);
    TW.iron.push({ geo: new t.SphereGeometry(0.062, 10, 8), matrix: mtx(t, [0, capApex + 0.12, 0]) });
    cpart(TW.iron, 0.012, 0.02, 0.34, [0, capApex + 0.31, 0], [0, 0, 0], 8);
    for (const [dx, dz, lbl] of [
      [1, 0, 'E'],
      [-1, 0, 'W'],
      [0, 1, 'S'],
      [0, -1, 'N'],
    ] as [number, number, string][]) {
      TW.iron.push({ geo: new t.BoxGeometry(dx ? 0.2 : 0.016, 0.016, dz ? 0.2 : 0.016), matrix: mtx(t, [dx * 0.1, capApex + 0.4, dz * 0.1]) });
      TW.iron.push({ geo: new t.BoxGeometry(0.05, 0.05, 0.014), matrix: mtx(t, [dx * 0.21, capApex + 0.4, dz * 0.21], [0, dz ? Math.PI / 2 : 0, 0]) });
    }
    vane.position.set(0, capApex + 0.52, 0);
    tower.add(vane);
    {
      const vm = mat(t, IRON, { tex: 'metal', metal: 0.28, rough: 0.5, repeat: [1, 1] });
      const arrow = new t.Mesh(new t.BoxGeometry(0.34, 0.014, 0.014), vm);
      vane.add(arrow);
      const head = new t.Mesh(new t.ConeGeometry(0.045, 0.11, 4), vm);
      head.position.set(0.2, 0, 0);
      head.rotation.z = -Math.PI / 2;
      vane.add(head);
      // a BAT for a vane silhouette, because of course it is
      const bat = new t.Mesh(new t.BoxGeometry(0.03, 0.05, 0.012), vm);
      bat.position.set(-0.13, 0.04, 0);
      vane.add(bat);
      for (const s of [-1, 1]) {
        const wgeo = new t.BoxGeometry(0.11, 0.055, 0.01);
        const wing = new t.Mesh(wgeo, vm);
        wing.position.set(-0.13 + s * 0.07, 0.055 + s * 0.012, 0);
        wing.rotation.z = s * 0.42;
        vane.add(wing);
      }
      rimUp(vm, 1.4);
    }
    flush(TW, tower);
    tower.userData.clockHands = clockHands;
    tower.userData.vane = vane;
  }
  flush(UP, upper);

  // =========================================================================
  // DECAY — ivy on the masonry, missing bricks, cracks, cobwebs in the eaves
  // =========================================================================
  {
    // ivy: CLUMPS (scatter reads as confetti; clumps read as a creeper).
    // FOOT is the lowest an ivy part may reach — the top of the plinth. The
    // first pass let the leaf spread and, worse, the woody stem run straight
    // through it: the `ground` probe caught the merged batches bottoming out
    // at −0.222 and −0.090, i.e. a fifth of a unit UNDERGROUND.
    const FOOT = PLY + 0.04;
    const clump = (x: number, y: number, z: number, nx: number, nz: number, n: number, seed: number, r = 0.34) => {
      for (let i = 0; i < n; i++) {
        const a = bhash(seed + i * 1.7) * 6.28;
        const rr = Math.sqrt(bhash(seed + i * 2.9)) * r;
        const lx = Math.cos(a) * rr;
        const ly = Math.sin(a) * rr * 1.5;
        LO.ivy.push({
          dims: [0.1 + bhash(seed + i) * 0.09, 0.09 + bhash(seed + i * 3) * 0.08, 0.02],
          pos: [x + lx * (nz ? 1 : 0) + (nx ? 0.02 * nx : 0), Math.max(FOOT, y + ly), z + lx * (nx ? 1 : 0) + (nz ? 0.02 * nz : 0)],
          rotY: nx ? Math.PI / 2 : 0,
          rotZ: (bhash(seed + i * 5) - 0.5) * 1.4,
        });
      }
      // the woody stem that feeds the clump: rooted at FOOT, running up into it
      const top = y + r * 0.55;
      const h = Math.max(0.12, top - FOOT);
      LO.dead.push({
        dims: [0.028, h, 0.02],
        pos: [x + (nx ? 0.018 * nx : 0), FOOT + h / 2, z + (nz ? 0.018 * nz : 0)],
        rotY: nx ? Math.PI / 2 : 0,
        rotZ: 0.03,
      });
    };
    clump(-1.62, 0.75, 0.5, -1, 0, 26, 3, 0.46);
    clump(-1.62, 1.28, 0.05, -1, 0, 18, 9, 0.34);
    clump(1.66, 0.62, -0.95, 1, 0, 22, 15, 0.4);
    clump(0.9, 0.5, -1.28, 0, -1, 20, 21, 0.38);
    clump(0.3, 1.06, 1.27, 0, 1, 13, 27, 0.24); // on the blank wall between porch and bay, NOT crowding the doorway
    // missing bricks + spalled patches: dark recesses cut into the wall face
    for (let i = 0; i < 16; i++) {
      const s = bhash(i * 7.3);
      const face = i % 4;
      const u = (bhash(i * 2.1) - 0.5) * 2.6;
      const y = 0.3 + bhash(i * 4.4) * 1.05;
      const p: V3 = face === 0 ? [u, y, HD - 0.005] : face === 1 ? [u, y, -HD + 0.005] : face === 2 ? [HW - 0.005, y, u * 0.75] : [-HW + 0.005, y, u * 0.75];
      LO.brickD.push({
        geo: new t.BoxGeometry(0.11 + s * 0.06, 0.055, 0.06),
        matrix: mtx(t, p, [0, face >= 2 ? Math.PI / 2 : 0, 0]),
        uv: [1, 1],
      });
    }
    // hairline cracks stepping down from two window heads
    for (const [x0, y0, dir] of [
      [-1.19, 1.28, 1],
      [0.16, 1.3, -1],
    ] as [number, number, number][]) {
      for (let i = 0; i < 7; i++) {
        LO.stoneD.push({ dims: [0.035, 0.1, 0.014], pos: [x0 + dir * i * 0.032, y0 + i * 0.035, HD + 0.012], rotZ: dir * (0.4 + bhash(i * 6.1) * 0.5) });
      }
    }
  }
  // cobwebs — under the porch beam, in the eaves and across a broken window
  {
    const wtex = webTex(t);
    const wmat = new t.MeshStandardMaterial({
      color: 0xdad6c8,
      alphaMap: wtex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      roughness: 1,
      side: t.DoubleSide,
    });
    const web = (x: number, y: number, z: number, s: number, rotY: number, rotZ: number) => {
      const m = new t.Mesh(new t.PlaneGeometry(s, s), wmat);
      m.position.set(x, y, z);
      m.rotation.set(0, rotY, rotZ);
      m.userData.lodDetail = true;
      group.add(m);
    };
    // A WEB HAS TO BE SLUNG IN A CORNER. Hung out at the eave TIP it is a
    // 0.3-unit grey plane against the sky and reads as a rendering smudge —
    // measured on the facade shot. Every one of these is now tucked INSIDE the
    // porch or under the overhang, so it is always seen against timber.
    web(-1.6, 1.235, 1.92, 0.28, -0.78, 0); // porch, left corner
    web(0.12, 1.235, 1.92, 0.26, 0.78, Math.PI / 2); // porch, right corner
    web(-1.02, 1.25, 1.9, 0.22, 0, Math.PI); // under the portico
    web(-0.42, 1.25, 1.9, 0.2, 0, Math.PI / 2);
    web(1.55, EAVE1 - 0.2, 1.24, 0.26, 0.78, 0); // under the eave, over the bay
    web(-HW - 0.015, 0.9, 0.34, 0.24, -Math.PI / 2, 0.45); // in a window reveal
  }

  // =========================================================================
  // THE GROUNDS — leaning rusted railing with piers and a gate hanging open,
  // gravestones, two dead trees, a cracked path and a low ground fog.
  // =========================================================================
  const FZ = 2.62; // railing line
  {
    // Gate piers. The first pass gave them a three-tier wedding-cake cap in
    // BRIGHT stone; standing 0.5 in front of the porch steps they read as two
    // sarcophagi and stole the whole close-up. Slimmer, one chamfered cap and
    // a pyramidal top, all in the weathered stone the graves use.
    const pier = (x: number, z: number, seed: number) => {
      const p = brickBox(t, [0.21, 0.64, 0.21], BRICK_D, MORTAR, [x, 0.32, z], [1, 3], { rotZ: (bhash(seed) - 0.5) * 0.05 });
      group.add(p);
      LO.stoneD.push({ dims: [0.27, 0.05, 0.27], pos: [x, 0.665, z] });
      LO.stoneD.push({ dims: [0.185, 0.09, 0.185], pos: [x, 0.735, z], rotY: 0.78 });
    };
    pier(-1.13, FZ, 1);
    pier(-0.27, FZ, 2);
    pier(-2.28, FZ, 3);
    pier(2.28, FZ, 4);
    // picket runs (front left, front right, and two short returns)
    const run = (x0: number, z0: number, x1: number, z1: number, seed: number) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(2, Math.round(L / 0.15));
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 1; i < n; i++) {
        const k = i / n;
        if (bhash(seed + i * 3.7) > 0.93) continue; // a few pickets are simply gone
        const h = 0.5 + (bhash(seed + i) - 0.5) * 0.05;
        const lean = (bhash(seed + i * 2.3) - 0.5) * 0.16;
        cpart(LO.rust, 0.013, 0.016, h, [x0 + (x1 - x0) * k, h / 2 + 0.01, z0 + (z1 - z0) * k], [0, yaw, lean], 6);
        LO.rust.push({ geo: new t.ConeGeometry(0.024, 0.06, 4), matrix: mtx(t, [x0 + (x1 - x0) * k + lean * h, h + 0.03, z0 + (z1 - z0) * k], [0, yaw, lean]) });
      }
      for (const ry of [0.12, 0.42]) {
        LO.rust.push({ geo: new t.BoxGeometry(0.024, 0.024, L), matrix: mtx(t, [(x0 + x1) / 2, ry, (z0 + z1) / 2], [0, yaw, 0.006]) });
      }
    };
    run(-2.24, FZ, -1.17, FZ, 11);
    run(-0.23, FZ, 2.24, FZ, 23);
    run(-2.28, FZ - 0.05, -2.28, 1.1, 31);
    run(2.28, FZ - 0.05, 2.28, 1.1, 37);
    // the GATE: two leaves, the right one hanging off its bottom hinge
    const leafBars = (cx: number, swing: number) => {
      for (let i = 0; i <= 5; i++) cpart(LO.rust, 0.012, 0.012, 0.62, [cx + i * 0.078 * Math.cos(swing), 0.32, FZ - i * 0.078 * Math.sin(swing)], [0, swing, 0], 6);
      for (const ry of [0.1, 0.35, 0.6])
        LO.rust.push({ geo: new t.BoxGeometry(0.4, 0.02, 0.02), matrix: mtx(t, [cx + 0.195 * Math.cos(swing), ry, FZ - 0.195 * Math.sin(swing)], [0, swing, 0]) });
    };
    leafBars(-1.05, 0.0);
    leafBars(-0.24, -0.95); // swung open into the grounds
    // GRAVESTONES — clumped in the side yards, several leaning
    const grave = (x: number, z: number, seed: number) => {
      const lean = (bhash(seed) - 0.5) * 0.34;
      const yaw = (bhash(seed * 2.1) - 0.5) * 1.4;
      const h = 0.3 + bhash(seed * 3.3) * 0.22;
      const w = 0.19 + bhash(seed * 5) * 0.09;
      const m = mtx(t, [x, h / 2 - 0.02, z], [0, yaw, lean]);
      LO.stoneD.push({ dims: [w, h, 0.055], matrix: m });
      LO.stoneD.push({ dims: [w * 0.62, w * 0.62, 0.05], matrix: m.clone().multiply(mtx(t, [0, h / 2, 0], [0, 0, Math.PI / 4])) }); // rounded head
      LO.stoneD.push({ dims: [w + 0.09, 0.045, 0.11], matrix: mtx(t, [x, 0.008, z], [0, yaw, 0]) }); // the base slab
      for (let i = 0; i < 3; i++)
        LO.stoneD.push({ dims: [w * 0.6, 0.014, 0.012], matrix: m.clone().multiply(mtx(t, [0, h * 0.2 - i * 0.06, 0.032])) }); // lettering
    };
    grave(-1.95, 1.55, 1);
    grave(-2.06, 1.06, 2);
    grave(-1.62, 1.28, 3);
    grave(2.02, 1.72, 4);
    grave(1.86, 1.24, 5);
    grave(2.14, -0.45, 6);
    grave(-2.05, -0.6, 7);
    // a leaning stone cross
    LO.stoneD.push({ dims: [0.09, 0.5, 0.09], pos: [1.9, 0.24, 2.06], rotZ: 0.22 });
    LO.stoneD.push({ dims: [0.3, 0.09, 0.08], pos: [1.83, 0.42, 2.06], rotZ: 0.22 });
    // DEAD TREES — bare, hashed branching
    const deadTree = (x: number, z: number, h: number, seed: number) => {
      const trunkParts: PartSpec[] = [];
      cpart(trunkParts, 0.045, 0.1, h, [x, h / 2, z], [0, 0, (bhash(seed) - 0.5) * 0.1], 7);
      const branch = (bx: number, by: number, bz: number, len: number, yaw: number, pitch: number, depth: number, s2: number) => {
        const ex = bx + Math.sin(yaw) * Math.cos(pitch) * len;
        const ey = by + Math.sin(pitch) * len;
        const ez = bz + Math.cos(yaw) * Math.cos(pitch) * len;
        const r = 0.03 * depth;
        // alongDir, NOT a hand-rolled Euler: a +Y cylinder laid from the fork
        // to the tip. (The hand-rolled version had the pitch term's sign
        // inverted, which threw every branch out BACKWARDS off its fork and
        // rendered the trees as a cloud of loose sticks.)
        cpartM(
          trunkParts,
          r * 0.6,
          r,
          len,
          alongDir(t, new t.Vector3(bx, by, bz), new t.Vector3(ex - bx, ey - by, ez - bz), len),
          6,
        );
        if (depth > 1)
          for (let i = 0; i < 2; i++)
            branch(ex, ey, ez, len * 0.62, yaw + (bhash(s2 + i * 3.1) - 0.5) * 2.2, pitch * 0.55 + bhash(s2 + i) * 0.5, depth - 1, s2 * 1.7 + i);
      };
      for (let i = 0; i < 4; i++)
        branch(x, h * 0.72, z, h * 0.42, (i / 4) * 6.28 + bhash(seed + i) * 1.1, 0.5 + bhash(seed + i * 2) * 0.5, 3, seed * 3 + i);
      const dm = mergedParts(t, trunkParts, mat(t, DEAD, { tex: 'wood', repeat: [1, 3], rough: 0.96 }));
      rimUp(dm.material);
      group.add(dm);
    };
    deadTree(-2.02, 0.42, 1.85, 5);
    deadTree(2.12, 0.55, 1.55, 11);
    // cracked path slabs from the gate to the steps
    for (let i = 0; i < 5; i++) {
      const z = FZ - 0.18 - i * 0.11;
      LO.stoneD.push({ dims: [0.7 - bhash(i) * 0.1, 0.03, 0.1], pos: [-0.7 + (bhash(i * 3) - 0.5) * 0.05, 0.015, z], rotY: (bhash(i * 5) - 0.5) * 0.1 });
    }
  }

  flush(LO, group);

  // ---- low ground fog (a disc, deliberately small so the ride footprint and
  // the derived queue front stay tight) ------------------------------------
  const fogDisc = new t.Mesh(new t.CircleGeometry(2.45, 36), new t.MeshStandardMaterial({ color: 0xaebacf, transparent: true, opacity: 0.15, roughness: 1 }));
  fogDisc.rotation.x = -Math.PI / 2;
  fogDisc.position.y = 0.1;
  group.add(fogDisc);

  // =========================================================================
  // WALKTHROUGH SEATING — six interior tour stops. Deliberately NO motion
  // gate: the mansion has no vehicle to park, so bats, smoke and the window
  // flicker keep their own life through the whole FSM cycle. Capacity 6 ==
  // these six anchors, all INSIDE the ground-floor room (x ±1.49, z ±1.09,
  // floor 0.18, ceiling 1.51 — a 1.1-tall guest has 0.27 of headroom), so a
  // boarded guest is genuinely indoors between the entrance and exit huts.
  // =========================================================================
  const seats: THREE.Group[] = [];
  const SPOTS: [number, number, number][] = [
    [-1.02, 0.62, 0.9],
    [-0.34, 0.72, -0.4],
    [0.36, 0.58, 0.4],
    [1.02, -0.62, 2.3],
    [0.34, -0.78, 3.1],
    [-0.9, -0.5, 4.0],
  ];
  for (const [sx, sz, yaw] of SPOTS) {
    const seat = new t.Group();
    seat.position.set(sx, PLY, sz);
    seat.rotation.y = yaw;
    group.add(seat);
    seats.push(seat);
  }

  // =========================================================================
  // NIGHT — FOUR real PointLights, all night-gated, everything else emissive.
  // =========================================================================
  const lanternGlass = new t.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffab34, emissiveIntensity: 0.14, roughness: 0.35 });
  {
    // the porch lantern: an iron cage on a scrolled bracket by the door
    const bx = DX + 0.6;
    LO.iron.push({ geo: new t.BoxGeometry(0.22, 0.02, 0.02), matrix: mtx(t, [bx - 0.08, 1.22, HD + 0.09]) });
    const cage = new t.Group();
    cage.position.set(bx, 1.06, HD + 0.16);
    group.add(cage);
    const im = mat(t, IRON, { tex: 'metal', metal: 0.28, rough: 0.5, repeat: [1, 1] });
    const cageParts: PartSpec[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) cpartM(cageParts, 0.008, 0.008, 0.18, mtx(t, [sx * 0.05, 0, sz * 0.05]), 5);
    cageParts.push({ geo: new t.BoxGeometry(0.14, 0.02, 0.14), matrix: mtx(t, [0, -0.09, 0]) });
    cageParts.push({ geo: new t.ConeGeometry(0.115, 0.07, 4), matrix: mtx(t, [0, 0.13, 0], [0, Math.PI / 4, 0]) });
    cageParts.push({ geo: new t.CylinderGeometry(0.008, 0.008, 0.09, 5), matrix: mtx(t, [0, 0.19, 0]) });
    const cm = mergedParts(t, cageParts, im);
    cage.add(cm);
    const flame = new t.Mesh(new t.BoxGeometry(0.075, 0.11, 0.075), lanternGlass);
    cage.add(flame);
    rimUp(im, 1.4);
  }
  const lanternLight = new t.PointLight(0xffab44, 0, 3.4, 2);
  lanternLight.position.set(DX + 0.6, 1.06, HD + 0.3);
  group.add(lanternLight);
  const greenUp = new t.PointLight(0x63ffa6, 0, 5.2, 2);
  greenUp.position.set(-0.2, 0.24, 2.0);
  group.add(greenUp);
  const spillLight = new t.PointLight(0xffc272, 0, 3.0, 2);
  spillLight.position.set(0.95, 0.92, BAYZ + 0.55);
  group.add(spillLight);
  const moonWash = new t.PointLight(0x93b6ff, 0, 8.5, 2);
  moonWash.position.set(-2.4, 6.1, 2.2);
  group.add(moonWash);

  // ---- particles: chimney smoke (lit from below at night) + ground mist ----
  const wisp = buildEmitter(t, {
    max: 44,
    rate: 4.5,
    life: 4.8,
    lifeVar: 1.2,
    velocity: [0.05, 0.32, 0.02],
    spread: 0.06,
    gravity: -0.016,
    size: 0.11,
    sizeEnd: 0.5,
    color: 0x9aa0a6,
    colorEnd: 0x6d7873,
    opacity: 0.3,
  });
  wisp.setOrigin(1.5, 3.62, -0.55); // the tall chimney's pot mouth
  group.add(wisp.points);
  const wispDay = new t.Color(0xffffff);
  const wispNight = new t.Color(0x9ce9a6);
  const wispMat = wisp.points.material as THREE.PointsMaterial;
  const mist = buildEmitter(t, {
    max: 66,
    rate: 9,
    life: 7,
    lifeVar: 2,
    velocity: [0.02, 0.035, 0.01],
    spread: 0.9,
    gravity: 0.004,
    size: 0.34,
    sizeEnd: 0.95,
    color: 0xb6c0cf,
    colorEnd: 0x93a2b4,
    opacity: 0.16,
  });
  mist.setOrigin(0, 0.1, 0.9);
  group.add(mist.points);
  const mistMat = mist.points.material as THREE.PointsMaterial;
  const mistDay = new t.Color(0xffffff);
  const mistNight = new t.Color(0xa8ffd0);

  // ---- circling bats (the follow cam's "vehicle" for this walkthrough) -----
  const bats: THREE.Group[] = [];
  const batMat = mat(t, 0x15151b, { rough: 0.9 });
  for (let b = 0; b < 4; b++) {
    const bat = new t.Group();
    const body = new t.Mesh(new t.BoxGeometry(0.055, 0.032, 0.032), batMat);
    bat.add(body);
    const wl = new t.Group();
    const wr = new t.Group();
    for (const [grp, s] of [
      [wl, -1],
      [wr, 1],
    ] as [THREE.Group, number][]) {
      const w1 = new t.Mesh(new t.BoxGeometry(0.07, 0.012, 0.05), batMat);
      w1.position.set(s * 0.05, 0, 0);
      grp.add(w1);
      const w2 = new t.Mesh(new t.BoxGeometry(0.06, 0.01, 0.038), batMat);
      w2.position.set(s * 0.115, 0.004, -0.004);
      w2.rotation.z = -s * 0.3;
      grp.add(w2);
      bat.add(grp);
    }
    bat.userData.wl = wl;
    bat.userData.wr = wr;
    bat.userData.bat = true; // harness tag: the animation sweep needs to find these
    group.add(bat);
    bats.push(bat);
  }
  const vehicle: THREE.Object3D = bats[0];

  // =========================================================================
  // THE UPDATER — everything runs off the absolute clock; night behaviour is
  // gated on nightKOf so the whole piece is DAY-CORRECT with no lights on.
  // =========================================================================
  const towerObj = upper.children.find((c) => (c as THREE.Group).userData.clockHands) as THREE.Group | undefined;
  const hands = towerObj?.userData.clockHands as THREE.Group | undefined;
  const vaneObj = towerObj?.userData.vane as THREE.Group | undefined;
  const moonEmissive = new t.Color(0x16233a);
  for (const e of moonlit) e.m.emissive = moonEmissive.clone();

  const update = (time: number) => {
    const nk = nightKOf(group);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep

    // window flicker: candles guttering behind old glass. Each light has its
    // own speed/phase, plus a slow shared "draught" so the whole house
    // breathes together instead of strobing at random.
    const draught = 0.86 + 0.14 * Math.sin(time * 0.63);
    for (let i = 0; i < lamps.length; i++) {
      const L = lamps[i];
      const f = 0.62 + Math.abs(Math.sin(time * L.sp + L.ph)) * 0.5 + Math.sin(time * L.sp * 3.1 + L.ph * 2) * 0.08;
      L.m.emissiveIntensity = L.day + (L.night * f * draught - L.day) * ease;
    }
    lanternGlass.emissiveIntensity = 0.14 + (1.75 + 0.28 * Math.sin(time * 9.3)) * ease;

    // the cold MOONLIGHT RIM: slate, brick, iron and dead wood pick up a faint
    // blue self-lift after dark, so the silhouette stays readable instead of
    // collapsing into the background.
    const rim = 0.7 * ease;
    for (const e of moonlit) e.m.emissiveIntensity = rim * e.k;

    lanternLight.intensity = ease * (0.85 + 0.16 * Math.sin(time * 11.2));
    greenUp.intensity = ease * (1.05 + 0.12 * Math.sin(time * 1.7));
    spillLight.intensity = ease * (0.72 + 0.1 * Math.abs(Math.sin(time * 2.3)));
    moonWash.intensity = ease * 1.15;

    wisp.update(time);
    mist.update(time);
    wispMat.color.lerpColors(wispDay, wispNight, ease); // lit sickly green from below
    mistMat.color.lerpColors(mistDay, mistNight, ease);

    // the clock: hands crawl, and the minute hand JERKS as it catches
    if (hands) {
      const mg = hands.userData.minG as THREE.Group;
      const hg = hands.userData.hourG as THREE.Group;
      const step = Math.floor(time * 0.5);
      mg.rotation.z = -(step % 60) * 0.10472 - Math.max(0, 0.1 - (time * 0.5 - step)) * 0.6;
      hg.rotation.z = -(time * 0.0417) % 6.283;
    }
    if (vaneObj) vaneObj.rotation.y = Math.sin(time * 0.31) * 0.9 + Math.sin(time * 1.9) * 0.06;

    bats.forEach((bat, b) => {
      const a = time * (0.85 + b * 0.22) + b * 1.9;
      const r = 1.7 + b * 0.28 + Math.sin(time * 0.5 + b) * 0.16;
      bat.position.set(Math.cos(a) * r, 5.15 + Math.sin(time * 2.6 + b * 1.3) * 0.34 + b * 0.12, Math.sin(a) * r * 0.85 - 0.15);
      bat.rotation.y = -a + Math.PI / 2;
      bat.rotation.z = Math.sin(time * 3 + b) * 0.35;
      const flap = Math.sin(time * (13 + b * 1.7) + b) * 0.85;
      (bat.userData.wl as THREE.Group).rotation.z = -flap;
      (bat.userData.wr as THREE.Group).rotation.z = flap;
    });
  };

  group.userData.partCounts = partCounts;
  group.userData.lampCount = lamps.length; // night-gated emissive glazings
  group.userData.pointLights = 4;
  group.userData.modelledParts = Object.values(partCounts).reduce((a, b) => a + b, 0);
  return { group, update, vehicle, seatWorld: makeSeatWorld(t, seats) };
}

/** <HauntedMansion> — composable ride (components/Park/Context.md): mounts the
 *  ride at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — the queue HEAD is derived out the
 *  local +z front (the chassis clears it past the railing), the exit hut sits
 *  one tile beside the entrance hut on the same face, boarding at the base.
 *  WALKTHROUGH exception: no motion gate (there is no vehicle to park — bats,
 *  smoke and window flicker keep animating); capacity 6 = the six interior
 *  tour spots (seatWorld anchors standing INSIDE the ground-floor room).
 *  Override with top-level props / `queue`. */
export const HauntedMansion = composableRide(
  'HauntedMansion',
  (t) => buildHauntedMansionScene(t),
  { defaults: { name: 'Haunted Mansion', capacity: 6, rideDuration: 12, intensity: 4, price: 4 } },
);
