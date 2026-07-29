import React from 'react';
import * as THREE from 'three';
import { mergedParts, mat, mtx } from '../Stage';
import type { PartSpec, MatOpts, TexName } from '../Stage';
import { composable } from '../Park';
import type { ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// Fence — RCT2-style park fencing as RUNS between world xz points. FIVE styles,
// every one of them BATCHED into at most three merged meshes per rig (fences
// are static dressing, never per-frame animated) with the close-up-only mesh
// tagged `userData.lodDetail`, so a fence costs TWO draw calls at park zoom
// however much joinery it carries:
//
//   'wood'   classic post-and-rail: square weathered posts on a spread FOOTING
//            with a collar + 4-sided weather CHAMFER cap, THREE rails per bay
//            (each bay pitched to the ground under it), a MORTISE plate where
//            every rail enters its post and a moulding BEAD down both faces of
//            every rail — the picketFence trick, because a bare flat board
//            reads as a barcode at close range
//   'metal'  the RCT2 queue railing: HEX-prism uprights (round at park zoom
//            where a box reads square) on bolted FOOT PLATES, a tubular mid
//            rail threaded through them and a flat CAPPING BAR the uprights die
//            into, with thicker BALL-FINIAL end posts terminating the run —
//            the style GameManager rails every ride queue with
//   'hedge'  a clipped privet: a spread SKIRT at the ground, a leaf-textured
//            body in short overlapping segments with hashed crown height, a
//            narrower CROWN course (the clipped batter that breaks the slab
//            silhouette) and close-up leaf clumps
//   'picket' white pointed pickets on two rails between capped end posts, each
//            picket pointed with a 4-sided pyramid and beaded down its face
//            (SceneryPack's `picketFence` vocabulary, as a RUN)
//   'brick'  a low garden wall: coursed brick with a proud PLINTH at the foot,
//            a soldier course under a stone COPING, and stone-based, stone-
//            capped, ball-finialled PIERS at the pier pitch (SceneryPack's
//            `brickWall` vocabulary, as a RUN)
//
// Every run FOLLOWS THE TERRAIN through the `groundAt` sampler (posts, pickets
// and hedge segments each stand on the real ground under them, rails/walls
// follow the grade bay by bay) and reports its world-space OBB spans as
// `blockers` — the shape `<Fence>` hands to the GameManager blocker registry so
// guests walk AROUND the fence instead of through it. Night-safe: no lights, no
// updater, no emissive. Deterministic — hashed sines only.
//
// FRAMES: every part that spans two points is built from THOSE TWO POINTS via
// an explicit right-handed basis (`seg` below), never from an azimuth plus a
// tilt — three.js composes Euler 'XYZ' as Rx·Ry, so a pitch applied alongside a
// yaw lands about WORLD x and the part leaves its own tangent.
// ---------------------------------------------------------------------------

export type XZ = [number, number];

export type FenceStyle = 'wood' | 'metal' | 'hedge' | 'picket' | 'brick';

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

interface StyleSpec {
  /** default fence height above the ground */
  height: number;
  /** post pitch (hedge: segment length; brick: pier pitch) along the run */
  spacing: number;
  /** post cross-section (hedge: body width; brick: pier section) */
  sec: number;
  /** rail thickness across the run / rail height (brick: wall thickness) */
  railT: number;
  railH: number;
  /** rail heights as fractions of the fence height */
  rails: number[];
  /** post / body colour and rail colour */
  post: number;
  rail: number;
  tex: TexName;
  metal: number;
  rough: number;
  /** little post caps (wood / picket / brick) */
  cap: boolean;
  /** blocker half-thickness across the run */
  halfWidth: number;
  /** OPTIONAL third course — the stone of a brick wall's coping/base/finials */
  stone?: number;
  stoneTex?: TexName;
  /** colour of the close-up-only (`lodDetail`) mesh: beads, clumps, courses */
  fine?: number;
}

/** the five RCT2 fence styles — muted, realistic park palette */
export const FENCE_STYLES: Record<FenceStyle, StyleSpec> = {
  wood: {
    height: 0.85,
    spacing: 1.2,
    sec: 0.09,
    railT: 0.045,
    railH: 0.115,
    // THREE courses, the top one just under the post cap. Two rails at
    // 0.42/0.78 left a fifth of the post bare above the top rail, which reads
    // as a row of stakes rather than a ranch fence.
    rails: [0.32, 0.6, 0.86],
    post: 0x8b6a44,
    rail: 0xa07d52,
    tex: 'wood',
    metal: 0,
    rough: 0.9,
    cap: true,
    halfWidth: 0.1,
  },
  metal: {
    height: 0.52,
    spacing: 0.42,
    sec: 0.042,
    railT: 0.034,
    railH: 0.03,
    // 1.0 = the CAPPING BAR: its top face is the railing's top, and the
    // uprights die into it instead of stopping in mid-air just below it
    rails: [0.46, 1],
    post: 0x8f959e,
    rail: 0xaab1b9,
    tex: 'metal',
    metal: 0.5,
    rough: 0.42,
    cap: false,
    halfWidth: 0.07,
  },
  hedge: {
    height: 0.72,
    spacing: 0.3,
    sec: 0.38,
    railT: 0,
    railH: 0,
    rails: [],
    post: 0x46662f,
    rail: 0x3b5726,
    tex: 'leaf',
    metal: 0,
    rough: 1,
    cap: false,
    halfWidth: 0.21,
    fine: 0x3b5726, // the darker leaf clumps riding the crown
  },
  picket: {
    height: 0.8,
    spacing: 1.44,
    sec: 0.1,
    railT: 0.04,
    railH: 0.07,
    rails: [0.3, 0.72],
    post: 0xe8e6df,
    rail: 0xe8e6df,
    tex: 'wood',
    metal: 0,
    rough: 0.8,
    cap: true,
    halfWidth: 0.1,
    fine: 0xd6d3c8,
  },
  brick: {
    height: 0.8,
    spacing: 2.4, // PIER pitch
    sec: 0.3, // pier section
    railT: 0.22, // wall thickness
    railH: 0,
    rails: [],
    post: 0x9a4a32,
    rail: 0x8a4029, // the darker courses (plinth / soldier bricks)
    // the fabric texture's woven grid reads as mortar courses over the brick
    // tint — exactly what SceneryPack's brickWall uses
    tex: 'fabric',
    metal: 0,
    rough: 0.95,
    cap: true,
    // 0.2, not the wall's 0.145: the PIERS are the widest thing in the run
    // (0.3 section + a 0.1 stone base/cap = 0.4 across), and a blocker narrower
    // than the geometry lets a guest clip the pier caps
    halfWidth: 0.2,
    stone: 0xb9b09a,
    stoneTex: 'concrete',
    fine: 0xa8543a,
  },
};

/** one straight leg of fencing, in the builder's own xz frame */
export interface FenceRun {
  from: XZ;
  to: XZ;
}

/** clamp-safe per-channel scale of a packed 0xRRGGBB colour */
const lighten = (c: number, k: number): number => {
  const ch = (sh: number) => Math.min(255, Math.round(((c >> sh) & 0xff) * k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export interface FenceOpts {
  /** 'wood' (default) | 'metal' (queue railing) | 'hedge' | 'picket' | 'brick' */
  style?: FenceStyle;
  /** ADDITIVE: override the style's TONE, keeping its geometry, texture and
   *  metalness. For themed consumers (a world's queue railing); the rail
   *  course is derived a step lighter, as the stock styles are. */
  color?: number;
  /** fence height above the ground (default: the style's) */
  height?: number;
  /** post pitch / hedge segment length / brick pier pitch (default: the style's) */
  spacing?: number;
  /** terrain sampler the posts stand on (default: flat y = 0) */
  groundAt?: (x: number, z: number) => number;
  /** trim this much off BOTH ends of every run — leaves a gateway/doorway
   *  clear (the blocker spans shrink with the geometry) */
  inset?: number;
  /** hashed-variation salt (hedge) */
  seed?: number;
}

/** a fenced span as a world-space rotated rect — the blocker-registry shape */
export interface FenceBlocker {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  yaw: number;
}

export interface BuiltFence {
  group: THREE.Group;
  style: FenceStyle;
  height: number;
  /** total fenced length in units (after `inset` trimming) */
  length: number;
  /** post positions in the builder's frame (loop corners included) */
  posts: XZ[];
  /** ONE rotated-rect OBB per fenced span — feed straight to
   *  `registerBlocker({ rect })` (world space when from/to were world xz) */
  blockers: FenceBlocker[];
}

/**
 * Build ANY number of straight fence legs as ONE batched rig (at most three
 * merged meshes: body, trim, and a `lodDetail` close-up mesh). `runs` are
 * straight legs in world xz; posts stand on the ground under them and rails
 * follow the grade bay by bay through `groundAt`.
 */
export function buildFenceRuns(t: typeof THREE, runs: FenceRun[], opts: FenceOpts = {}): BuiltFence {
  const style = opts.style ?? 'wood';
  const base = FENCE_STYLES[style];
  // ADDITIVE: an optional colour override, so a THEMED consumer can keep the
  // style's geometry/texture/metalness and restate only its tone. Added for
  // themed queue lanes — a lane that repaves itself but keeps a stock metal
  // railing leaves the brightest lines in the frame untouched. `post` takes the
  // override; `rail` is lightened from it the same 1.19x the stock styles use,
  // so a one-number override still reads as posts-and-rails.
  const st: StyleSpec = opts.color === undefined ? base : { ...base, post: opts.color, rail: lighten(opts.color, 1.19) };
  const H = Math.max(0.18, opts.height ?? st.height);
  const gAt = opts.groundAt ?? (() => 0);
  const spacing = Math.max(0.12, opts.spacing ?? st.spacing);
  const inset = Math.max(0, opts.inset ?? 0);
  const salt = opts.seed ?? 0;

  // ---- ONE geometry per SHAPE, reused at every matrix ---------------------
  // Every solid in the rig is one of these four under a matrix, so a 300-post
  // boundary allocates four geometries instead of three hundred. `mergedParts`
  // reads them (dispose = false) and they are dropped once at the end.
  const G = {
    box: new t.BoxGeometry(1, 1, 1),
    pyr: new t.CylinderGeometry(0, 0.5, 1, 4), // 4-sided point / weather cap
    hex: new t.CylinderGeometry(0.5, 0.5, 1, 6), // "tube": round enough at park zoom
    ball: new t.SphereGeometry(0.5, 6, 4), // finial / leaf clump
  };
  const body: PartSpec[] = []; // st.post — posts, hedge body, brickwork
  const trim: PartSpec[] = []; // st.rail — rails, caps, plates, finial balls
  const stone: PartSpec[] = []; // st.stone — brick coping / pier base + cap
  const fine: PartSpec[] = []; // lodDetail — beads, leaf clumps, soldier course
  const posts: XZ[] = [];
  const blockers: FenceBlocker[] = [];
  let total = 0;

  const V = (x: number, y: number, z: number) => new t.Vector3(x, y, z);
  /**
   * BRICK-COURSE texture scale. The 'fabric' weave is a 3 px grid on a 128 px
   * canvas — 42 cells per tile — so the repeat that reads as brickwork is the one
   * that puts ONE cell on ONE brick: u = length / (42 · 0.06), v = height /
   * (42 · 0.07). The first pass used brickWall's [10, 5]-per-2-u scale and the
   * wall rendered FLAT RED, because 400 mortar lines across 2.4 u average out to
   * the base colour at any zoom a park is ever seen from.
   */
  const brickUV = (l: number, h: number): [number, number] => [Math.max(0.15, +(l * 0.4).toFixed(3)), Math.max(0.1, +(h * 0.34).toFixed(3))];
  /** an axis-aligned solid in the run's yaw frame; dims = [across, up, along] */
  const put = (
    into: PartSpec[],
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    dims: [number, number, number],
    yaw: number,
    uv?: [number, number],
  ) => {
    into.push({ geo, matrix: mtx(t, pos, [0, yaw, 0], dims), uv });
  };
  /**
   * a solid laid between the TWO POINTS IT JOINS — the only way a pitched rail
   * or a raked wall course lands on its own tangent. `axis` says which local
   * axis of the geometry is its length ('z' for the unit box, 'y' for the
   * cylinders). Both bases below are RIGHT-HANDED (X × Y = Z holds because
   * L · d = 0), so nothing is mirrored and nothing renders inside-out.
   */
  const seg = (
    into: PartSpec[],
    geo: THREE.BufferGeometry,
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    w: number,
    h: number,
    axis: 'z' | 'y',
    uv?: [number, number],
    grow = 0,
  ) => {
    const d = p1.clone().sub(p0);
    const len = d.length();
    if (len < 1e-6) return;
    d.multiplyScalar(1 / len);
    const L = V(0, 1, 0).cross(d);
    if (L.lengthSq() < 1e-9) L.set(1, 0, 0);
    L.normalize();
    const m = new t.Matrix4();
    if (axis === 'z') m.makeBasis(L, d.clone().cross(L), d); // X=lateral, Y=up-ish, Z=length
    else m.makeBasis(L, d, L.clone().cross(d)); // X=lateral, Y=length, Z=up-ish
    m.scale(axis === 'z' ? V(w, h, len + grow) : V(w, len + grow, w));
    m.setPosition(p0.clone().add(p1).multiplyScalar(0.5));
    into.push({ geo, matrix: m, uv });
  };

  runs.forEach((run, ri) => {
    const len0 = Math.hypot(run.to[0] - run.from[0], run.to[1] - run.from[1]);
    if (len0 < 1e-4) return;
    const ux = (run.to[0] - run.from[0]) / len0;
    const uz = (run.to[1] - run.from[1]) / len0;
    const len = len0 - inset * 2;
    if (len < 0.14) return; // trimmed away entirely
    const ax = run.from[0] + ux * inset;
    const az = run.from[1] + uz * inset;
    const yaw = Math.atan2(ux, uz); // local +z runs from → to
    const nx = uz; // unit lateral (run's local +x)
    const nz = -ux;
    total += len;
    blockers.push({
      cx: ax + ux * (len / 2),
      cz: az + uz * (len / 2),
      hx: st.halfWidth,
      hz: len / 2 + st.halfWidth,
      yaw,
    });
    /** xz at `u` along the run, `lat` across it */
    const at = (u: number, lat = 0): XZ => [ax + ux * u + nx * lat, az + uz * u + nz * lat];

    // ---- HEDGE: one clipped body, no posts ------------------------------
    if (style === 'hedge') {
      const n = Math.max(1, Math.round(len / spacing));
      const step = len / n;
      const uvLen = Math.max(2, Math.round((step + 0.04) * 6));
      for (let k = 0; k < n; k += 1) {
        const u = (k + 0.5) * step;
        const [x, z] = at(u);
        const g = gAt(x, z);
        // CLIPPED: the width stays constant and the yaw barely moves (a hedge
        // is trimmed, not wild) — only the crown height wobbles a little
        const hh = H * (0.965 + hash01(ri * 7.3 + k * 3.7 + salt) * 0.07);
        const jy = yaw + (hash01(ri * 4.7 + k * 1.9 + salt) - 0.5) * 0.02;
        // SKIRT: a privet spreads where it meets the ground. Without it the
        // hedge ends in a knife edge floating on the grass line.
        put(body, G.box, [x, g + 0.02, z], [st.sec + 0.04, 0.12, step + 0.04], jy, [uvLen, 1]);
        // BODY (0.05 into the ground, so a grade step never opens a gap)
        put(body, G.box, [x, g + hh / 2 - 0.05, z], [st.sec, hh, step + 0.04], jy, [uvLen, 2]);
        // CROWN: the narrower clipped course. A hedge is BATTERED — wider at
        // the foot than the top — and that step is what stops a leaf-textured
        // box reading as a leaf-textured box.
        put(body, G.box, [x, g + hh - 0.05, z], [st.sec * 0.84, 0.12, step + 0.04], jy, [uvLen, 1]);
        // close-up detail: darker leaf clumps riding the crown, one per segment
        // and alternating sides, so the crown line is broken everywhere along
        // the run instead of every other 0.3 u
        const cu = u + (hash01(ri * 8.1 + k * 2.3 + salt) - 0.5) * step * 0.5;
        const lat = (k % 2 ? 0.22 : -0.22 + (hash01(ri * 6.7 + k * 9.1 + salt) - 0.5) * 0.2) * st.sec;
        const [cx, cz] = at(cu, lat);
        const cr = 0.1 + hash01(ri * 2.9 + k * 5.3 + salt) * 0.05;
        put(fine, G.ball, [cx, gAt(cx, cz) + hh - 0.055, cz], [cr * 2, cr * 1.3, cr * 2], jy + hash01(ri * 3.3 + k * 7.7 + salt) * 0.8);
      }
      posts.push([ax, az], [ax + ux * len, az + uz * len]);
      return;
    }

    // ---- POST-AND-RAIL FAMILY: stations at an even pitch, one at each end --
    const n = Math.max(1, Math.round(len / spacing));
    const step = len / n;
    const topR = st.rails.length ? st.rails[st.rails.length - 1] : 1;

    for (let i = 0; i <= n; i += 1) {
      const [x, z] = at(i * step);
      posts.push([x, z]);
      const g = gAt(x, z);
      const end = i === 0 || i === n;

      if (style === 'metal') {
        // an END post is the railing's terminus: thicker, taller, ball-capped
        const dia = st.sec * (end ? 1.5 : 1);
        // FOOT PLATE — a queue railing is bolted to the pavement, and without
        // a plate the upright just intersects the slab
        put(trim, G.box, [x, g + 0.014, z], [dia + 0.03, 0.028, dia + 0.03], yaw, [1, 1]);
        // upright: a HEX prism reads round at park zoom where a box reads square
        const y1 = end ? g + H + 0.05 : g + H * topR - 0.016; // dies INTO the cap bar
        put(body, G.hex, [x, (g - 0.05 + y1) / 2, z], [dia, y1 - (g - 0.05), dia], yaw, [2, 1]);
        // weld flange where the upright meets its plate. It rides in `trim`
        // rather than the close-up batch on purpose: `trim` already exists for
        // this style, so the flange costs triangles but NOT a draw call — and
        // metal is the style GameManager places on every queue lane in the park.
        put(trim, G.hex, [x, g + 0.04, z], [dia + 0.018, 0.016, dia + 0.018], yaw, [1, 1]);
        if (end) {
          const r = dia * 0.72;
          put(trim, G.ball, [x, y1 + r * 0.62, z], [r * 2, r * 2, r * 2], yaw);
        }
        continue;
      }

      if (style === 'brick') {
        // PIER: brickwork on a stone base, stone-capped, ball-finialled
        put(stone, G.box, [x, g + 0.028, z], [st.sec + 0.09, 0.075, st.sec + 0.09], yaw, [2, 1]);
        put(body, G.box, [x, g + (H + 0.09) / 2 + 0.02, z], [st.sec, H + 0.09, st.sec], yaw, brickUV(st.sec, H + 0.09));
        const capY = g + H + 0.11;
        put(stone, G.box, [x, capY - 0.028, z], [st.sec + 0.1, 0.055, st.sec + 0.1], yaw, [2, 1]);
        put(stone, G.hex, [x, capY + 0.025, z], [0.13, 0.05, 0.13], yaw, [1, 1]);
        put(stone, G.ball, [x, capY + 0.115, z], [0.17, 0.17, 0.17], yaw);
        continue;
      }

      // wood / picket post: FOOTING + shaft + collar + 4-sided weather cap
      put(body, G.box, [x, g + 0.024, z], [st.sec + 0.05, 0.06, st.sec + 0.05], yaw, [1, 1]);
      put(body, G.box, [x, g + H / 2 - 0.03, z], [st.sec, H + 0.06, st.sec], yaw, [1, Math.max(2, Math.round(H * 4))]);
      if (st.cap) {
        // a picket fence is ONE colour throughout, so its caps ride in the body
        // batch — a second same-coloured mesh would be a draw call for nothing
        const capInto = style === 'picket' ? body : trim;
        put(capInto, G.box, [x, g + H + 0.014, z], [st.sec + 0.04, 0.028, st.sec + 0.04], yaw, [1, 1]);
        const w = (st.sec + 0.04) * Math.SQRT2; // pyramid base corner-to-corner
        put(capInto, G.pyr, [x, g + H + 0.054, z], [w, 0.052, w], yaw + Math.PI / 4);
      }
      if (style === 'wood')
        // MORTISE PLATE per course: proud of the post face on both sides, so a
        // rail visibly ENTERS its post instead of vanishing at a flush edge
        for (const r of st.rails)
          put(trim, G.box, [x, g + H * r, z], [st.sec + 0.026, st.railH + 0.03, st.sec * 0.62], yaw, [1, 1]);
    }

    // ---- bays: rails / wall courses, PITCHED to the ground under each bay --
    for (let i = 0; i < n; i += 1) {
      const [x0, z0] = at(i * step);
      const [x1, z1] = at((i + 1) * step);
      const g0 = gAt(x0, z0);
      const g1 = gAt(x1, z1);
      const bayLen = Math.hypot(step, g1 - g0);
      const uvLen = Math.max(2, Math.round(bayLen * 2.6));

      if (style === 'brick') {
        // the wall between the piers, raked to the grade, in FOUR courses: a
        // proud plinth at the foot, the field, a soldier course of bricks ON END
        // under the coping, and a stone coping overhanging both faces. All three
        // throw a horizontal shadow line across what was one flat face.
        const wall = (fr: number, thick: number, hgt: number, into: PartSpec[], uv: [number, number]) =>
          seg(into, G.box, V(x0, g0 + fr, z0), V(x1, g1 + fr, z1), thick, hgt, 'z', uv, st.sec * 0.9);
        wall(0.055, st.railT + 0.05, 0.15, body, brickUV(bayLen, 0.15)); // plinth, proud 0.025, 0.02 into the ground
        wall(H * 0.5 - 0.02, st.railT, H - 0.12, body, brickUV(bayLen, H - 0.12)); // field: g+0.04 → g+H−0.08
        wall(H - 0.0125, st.railT + 0.07, 0.055, stone, [Math.max(2, Math.round(bayLen * 4)), 1]); // coping, top on H
        // SOLDIER COURSE: individual bricks on end with mortar gaps, not one
        // proud band — the vertical joints are the whole point of the course
        const mb = Math.max(2, Math.round(bayLen / 0.15));
        const lerp = (k: number) => V(x0 + (x1 - x0) * k, g0 + (g1 - g0) * k + H - 0.0725, z0 + (z1 - z0) * k);
        for (let j = 0; j < mb; j += 1)
          // one brick = one flat face, so its uv samples a sub-cell of the weave
          seg(fine, G.box, lerp((j + 0.11) / mb), lerp((j + 0.89) / mb), st.railT + 0.014, 0.075, 'z', [0.06, 0.03]);
        continue;
      }

      if (style === 'metal') {
        // the CAPPING BAR (flat, wider than the uprights: its top IS the
        // railing's top line) and the tubular mid rail threaded through them
        seg(trim, G.box, V(x0, g0 + H * topR - 0.011, z0), V(x1, g1 + H * topR - 0.011, z1), st.sec * 1.55, 0.022, 'z', [uvLen, 1], st.sec);
        for (const r of st.rails.slice(0, -1))
          seg(trim, G.hex, V(x0, g0 + H * r, z0), V(x1, g1 + H * r, z1), st.railT, 0, 'y', [2, uvLen], st.sec);
        continue;
      }

      for (const r of st.rails) {
        const p0 = V(x0, g0 + H * r, z0);
        const p1 = V(x1, g1 + H * r, z1);
        const lat = style === 'picket' ? -(st.railT / 2 + 0.006) : 0;
        const q0 = V(p0.x + nx * lat, p0.y, p0.z + nz * lat);
        const q1 = V(p1.x + nx * lat, p1.y, p1.z + nz * lat);
        // the rail runs post CENTRE to post CENTRE and `grow`s half a section
        // past each, so both ends are mortised inside the post they join
        seg(style === 'picket' ? body : trim, G.box, q0, q1, st.railT, st.railH, 'z', [uvLen, 1], st.sec);
        if (style === 'wood')
          // BEAD down both faces of every rail — a turned rail carries a
          // moulding, and it is what stops a run of flat boards reading as a
          // barcode (SceneryPack's picketFence, same reason)
          for (const s of [-1, 1]) {
            const o = st.railT / 2 + 0.005;
            seg(
              fine,
              G.box,
              V(q0.x + nx * s * o, q0.y, q0.z + nz * s * o),
              V(q1.x + nx * s * o, q1.y, q1.z + nz * s * o),
              0.014,
              st.railH * 0.42,
              'z',
              [uvLen, 1],
              st.sec,
            );
          }
      }

      if (style === 'picket') {
        // PICKETS across the bay, each standing on its own ground sample, each
        // pointed with a 4-sided pyramid and beaded down its face
        const m = Math.max(2, Math.round(step / 0.145));
        const ps = step / m;
        const pt = 0.028; // picket thickness
        const pw = Math.min(0.085, ps * 0.62); // picket width
        for (let k = 0; k < m; k += 1) {
          const u = i * step + (k + 0.5) * ps;
          const [px, pz] = at(u, pt / 2 - 0.012); // overlapping the rails' front face by 0.006
          const pg = gAt(px, pz);
          const ph = H * 0.9;
          put(body, G.box, [px, pg + ph / 2 - 0.03, pz], [pt, ph + 0.06, pw], yaw, [1, 3]);
          const w = pw * Math.SQRT2;
          put(body, G.pyr, [px, pg + ph + 0.036, pz], [w, 0.075, w], yaw + Math.PI / 4);
          // BEAD down the picket face, proud on both sides — the moulding that
          // stops a row of identical flat boards reading as a barcode
          put(fine, G.box, [px, pg + ph * 0.5, pz], [pt + 0.012, ph * 0.8, pw * 0.34], yaw, [1, 3]);
        }
      }
    }
  });

  const group = new t.Group();
  const M: MatOpts = { tex: st.tex, metal: st.metal, rough: st.rough };
  const emit = (parts: PartSpec[], color: number, o: MatOpts, detail = false) => {
    if (!parts.length) return;
    const mesh = mergedParts(t, parts, mat(t, color, { ...o, repeat: [1, 1] }), false);
    if (detail) mesh.userData.lodDetail = true; // beads / clumps / courses: close-up only
    group.add(mesh);
  };
  emit(body, st.post, { ...M, bump: style === 'hedge' ? 0.05 : 0.02 });
  emit(trim, st.rail, M);
  emit(stone, st.stone ?? st.rail, { tex: st.stoneTex ?? st.tex, rough: 0.9, bump: 0.02 });
  emit(fine, st.fine ?? st.post, M, true);
  Object.values(G).forEach((g) => g.dispose()); // merged copies keep the data
  return { group, style, height: H, length: total, posts, blockers };
}

/** ONE straight fence run between two xz points (the common case) */
export function buildFence(t: typeof THREE, opts: FenceOpts & { from: XZ; to: XZ }): BuiltFence {
  return buildFenceRuns(t, [{ from: opts.from, to: opts.to }], opts);
}

/**
 * Fence a POLYGON / polyline: consecutive `points` are joined leg by leg
 * (`closed` — the default — also joins the last point back to the first), and
 * the whole loop is ONE batched rig. Corner posts land exactly on the
 * vertices because every leg plants a post at both of its ends.
 */
export function buildFenceLoop(t: typeof THREE, points: XZ[], opts: FenceOpts & { closed?: boolean } = {}): BuiltFence {
  const closed = opts.closed ?? true;
  const runs: FenceRun[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) runs.push({ from: points[i], to: points[i + 1] });
  if (closed && points.length > 2) runs.push({ from: points[points.length - 1], to: points[0] });
  return buildFenceRuns(t, runs, opts);
}

// ---------------------------------------------------------------------------
// <Fence> — the COMPOSABLE component (components/Park/Context.md convention).
//
// `from`/`to` (or `points`) are WORLD xz — a fence run IS its own position, so
// <Fence> takes no `position` prop: the rig mounts at the world origin and
// every post settles onto the terrain under it via the park's floor sampler.
// Inside a real <Park> each fenced span also REGISTERS as a blocker, so guests
// path around the fence (GameManager.registerBlocker — GameManager/Context.md
// "Blockers"; leave a GATEWAY where a street crosses a boundary or
// validatePark's `blockers` gate fails the layout).
// ---------------------------------------------------------------------------

export interface FenceProps {
  /** run start in world xz (with `to`) */
  from?: XZ;
  /** run end in world xz (with `from`) */
  to?: XZ;
  /** polygon/polyline corners in world xz — an alternative to from/to */
  points?: XZ[];
  /** close a `points` polygon back to its first corner (default true) */
  closed?: boolean;
  /** 'wood' (default) | 'metal' (queue railing) | 'hedge' | 'picket' | 'brick' */
  style?: FenceStyle;
  /** fence height above the ground (default: the style's) */
  height?: number;
  /** post pitch / hedge segment length / brick pier pitch (default: the style's) */
  spacing?: number;
  /** trim both ends of every leg — leaves a gateway clear */
  inset?: number;
  seed?: number;
  /** register the fenced spans with the GameManager so guests walk AROUND
   *  them (default true; `false` = pure dressing guests may walk through) */
  blocking?: boolean;
  /** blocker label prefix in reports/lints (default 'fence') */
  label?: string;
}

type FenceBuilt = { group: THREE.Group; blockers: FenceBlocker[]; style: FenceStyle; height: number; length: number; posts: XZ[] };

const runsOf = (p: FenceProps): FenceRun[] => {
  if (p.points && p.points.length >= 2) {
    const runs: FenceRun[] = [];
    for (let i = 0; i + 1 < p.points.length; i += 1) runs.push({ from: p.points[i], to: p.points[i + 1] });
    if ((p.closed ?? true) && p.points.length > 2) runs.push({ from: p.points[p.points.length - 1], to: p.points[0] });
    return runs;
  }
  if (p.from && p.to) return [{ from: p.from, to: p.to }];
  console.warn('<Fence> needs either from + to or points (world xz) — nothing mounted');
  return [];
};

const FenceBase = composable<FenceProps, FenceBuilt>(
  'Fence',
  (t, props, park) =>
    buildFenceRuns(t, runsOf(props), {
      style: props.style,
      height: props.height,
      spacing: props.spacing,
      inset: props.inset,
      seed: props.seed,
      groundAt: (x, z) => park.floorAt(x, z),
    }),
  {
    compose: (park: ParkContextValue, { built, props }) => {
      if (props.blocking === false) return;
      const label = props.label ?? `<Fence ${built.style}>`;
      const hs = built.blockers.map((b) =>
        park.registerBlocker({
          rect: b,
          label: `${label} span @[${b.cx.toFixed(1)}, ${b.cz.toFixed(1)}]`,
          height: built.height,
          kind: 'fence',
        }),
      );
      return () => hs.forEach((h) => h());
    },
  },
);

/** RCT2 park fencing: `<Fence from to style height/>` or `<Fence points/>` */
export const Fence: React.FC<FenceProps> = (props) => <FenceBase {...props} position={[0, 0, 0]} />;
Fence.displayName = 'Fence';
