// ---------------------------------------------------------------------------
// PathNetwork / scaffold.ts — RCT2 wooden path SUPPORTS: the post/rung bay and
// the four-post tower an elevated path (or a deck beside it) stands on.
// Split out of ./index.tsx for FILE SIZE ONLY — Magic Patterns writes WHOLE
// files and this network no longer fits a single write. index.tsx re-exports
// every public name, so `from '../PathNetwork'` is unchanged.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import type { MergedBoxSpec } from '../Stage';
import { hash01 } from './core';

// ---------------------------------------------------------------------------
// SCAFFOLDING — RCT2 wooden path supports. OpenRCT2 draws support columns
// under every path element whose base sits above the map surface
// (Paint.Path.cpp ShouldDrawSupports: `surface->getBaseZ() < height` ⇒
// supports), and the wooden support painter stacks repeated post segments
// with a horizontal member every 16 z-units plus special slope-transition
// pieces (WoodenSupports.cpp PathBoxSupportsPaintSetup). The 3D translation:
// square timber posts dropped to the REAL ground, a horizontal rung every
// ~0.55 of drop (our 16-unit segment) and one alternating diagonal brace per
// bay panel. Everything is emitted as MergedBoxSpecs so an entire network's
// scaffolding merges into ONE mesh / one draw call.

/** lift threshold: a span/pad more than this above the terrain gets a wooden
 *  scaffold to the ground (below it: earth berms / low concrete piers) */
export const SCAFFOLD_LIFT = 0.35;
/** weathered support timber (shared by ParkBuilder's grounding helpers) */
export const SCAFFOLD_WOOD = 0x8a6b4a;

export const SC_POST = 0.075; // square post section
export const SC_RUNG = 0.05; // horizontal member section
export const SC_STEP = 0.55; // vertical rung spacing — RCT2's 16-unit support segment

// one diagonal brace across a bay panel (local z = across the bay, tilted in
// the vertical plane); sgn flips the tilt so stacked panels alternate
export const diagSpec = (
  t: typeof THREE,
  specs: MergedBoxSpec[],
  cx: number,
  cy: number,
  cz: number,
  yaw: number,
  span: number,
  gap: number,
  sgn: number,
) => {
  const m = new t.Matrix4().makeRotationFromEuler(new t.Euler(-Math.atan2(gap, span) * sgn, yaw, 0, 'YXZ'));
  m.setPosition(cx, cy, cz);
  specs.push({ dims: [0.042, 0.042, Math.hypot(gap, span)], matrix: m });
};

/**
 * One scaffold BAY under a span: a pair of square posts astride the span
 * centreline (`ux/uz` = lateral unit, post centres at ±`halfSpread`), posts
 * from `groundY − 0.06` up to `topY` (pick topY INSIDE the deck/slab above),
 * a rung between them every SC_STEP of drop and an alternating diagonal per
 * panel (hashed on `seed`). Appends MergedBoxSpecs — merge the collected
 * array with `mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood' })`.
 */
export function scaffoldBay(
  t: typeof THREE,
  specs: MergedBoxSpec[],
  cx: number,
  cz: number,
  ux: number,
  uz: number,
  halfSpread: number,
  topY: number,
  groundY: number,
  seed: number,
) {
  const yaw = Math.atan2(ux, uz);
  const postH = topY - (groundY - 0.06);
  if (postH <= 0.05) return;
  [-1, 1].forEach((s) => {
    specs.push({
      dims: [SC_POST, postH, SC_POST],
      pos: [cx + ux * s * halfSpread, topY - postH / 2, cz + uz * s * halfSpread],
      rotY: yaw,
      repeat: [1, Math.max(1, Math.round(postH * 2))],
    });
  });
  const span = halfSpread * 2;
  const levels: number[] = [];
  for (let ry = topY - 0.09; ry > groundY + 0.14; ry -= SC_STEP) levels.push(ry);
  levels.forEach((ry) => specs.push({ dims: [SC_RUNG, SC_RUNG, span + SC_POST], pos: [cx, ry, cz], rotY: yaw, repeat: [1, 2] }));
  const panels = [...levels, groundY + 0.02];
  for (let i = 0; i + 1 < panels.length; i++) {
    const hi = panels[i] - SC_RUNG / 2;
    const lo = panels[i + 1] + SC_RUNG / 2;
    if (hi - lo < 0.22) continue;
    const sgn = hash01(seed * 13 + i * 7 + 1) < 0.5 ? 1 : -1;
    diagSpec(t, specs, cx, (hi + lo) / 2, cz, yaw, span, hi - lo, sgn);
  }
}

/**
 * A four-post scaffold TOWER under a rectangular footprint (junction pads,
 * stall/hut decks): posts inset 0.08 from each corner, perimeter rungs every
 * SC_STEP, alternating diagonals on the two long faces, and (with `deck`) a
 * plank deck whose TOP lands at `topY + 0.01` — the same finished level the
 * ParkBuilder earth plinth used, so bases sit flush on it.
 */
export function scaffoldTower(
  t: typeof THREE,
  specs: MergedBoxSpec[],
  x: number,
  z: number,
  w: number,
  d: number,
  topY: number,
  groundY: number,
  opts: { rotY?: number; deck?: boolean; seed?: number } = {},
) {
  const yaw = opts.rotY ?? 0;
  const seed = opts.seed ?? 1;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const world = (lx: number, lz: number): [number, number] => [x + lx * cosY + lz * sinY, z - lx * sinY + lz * cosY];
  const hx = Math.max(0.08, w / 2 - 0.08);
  const hz = Math.max(0.08, d / 2 - 0.08);
  const postTop = opts.deck ? topY - 0.04 : topY;
  const postH = postTop - (groundY - 0.06);
  if (postH <= 0.05) return;
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const [wx, wz] = world(sx * hx, sz * hz);
      specs.push({
        dims: [SC_POST, postH, SC_POST],
        pos: [wx, postTop - postH / 2, wz],
        rotY: yaw,
        repeat: [1, Math.max(1, Math.round(postH * 2))],
      });
    }),
  );
  const levels: number[] = [];
  for (let ry = postTop - 0.07; ry > groundY + 0.14; ry -= SC_STEP) levels.push(ry);
  levels.forEach((ry) => {
    [-1, 1].forEach((s) => {
      const [ax, az] = world(s * hx, 0);
      specs.push({ dims: [SC_RUNG, SC_RUNG, hz * 2 + SC_POST], pos: [ax, ry, az], rotY: yaw, repeat: [1, 2] });
      const [bx, bz] = world(0, s * hz);
      specs.push({ dims: [hx * 2 + SC_POST, SC_RUNG, SC_RUNG], pos: [bx, ry, bz], rotY: yaw, repeat: [2, 1] });
    });
  });
  // diagonals on the two x-facing sides (they read from every camera angle)
  const panels = [...levels, groundY + 0.02];
  for (let i = 0; i + 1 < panels.length; i++) {
    const hi = panels[i] - SC_RUNG / 2;
    const lo = panels[i + 1] + SC_RUNG / 2;
    if (hi - lo < 0.22) continue;
    [-1, 1].forEach((s) => {
      const [ax, az] = world(s * hx, 0);
      const sgn = (hash01(seed * 13 + i * 7 + s) < 0.5 ? 1 : -1) * s;
      diagSpec(t, specs, ax, (hi + lo) / 2, az, yaw, hz * 2, hi - lo, sgn);
    });
  }
  if (opts.deck) specs.push({ dims: [w, 0.08, d], pos: [x, topY - 0.03, z], rotY: yaw, repeat: [3, 3] });
}

