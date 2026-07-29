// ---------------------------------------------------------------------------
// SceneryPack/shared.ts — palette, hashed scatter, the rod primitive
//
// SPLIT out of index.tsx (2026-07). `write_design_system_files` replaces WHOLE
// files with no patch API, so a module has to fit in one tool call's output;
// at 94 KB the single file was past the point where that is safe. Three
// modules of ~2/44/44 KB each push independently. Behaviour-neutral: the
// builders are moved verbatim, only `export` is added.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mat } from '../Stage';

// re-exported so a pieces module needs ONE import line, not two
export { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
export type { MergedBoxSpec } from '../Stage';

export type T = typeof THREE;

export const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// palette
export const STONE = 0xb9b09a;
export const MARBLE = 0xdad6cc;
export const IRON = 0x2b2e33;
export const WOOD = 0x8a5a2a;
export const WOOD_DARK = 0x5f3f1e;
export const LEAF = 0x3c6b2e;

/** cylinder rod from `from` to `to` (origin at `from`) — ropes, braces, stays */
export function rod(t: T, from: [number, number, number], to: [number, number, number], r: number, color: number, o: Parameters<typeof mat>[2] = {}) {
  const dir = new t.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const L = dir.length();
  const geo = new t.CylinderGeometry(r, r, L, 6);
  geo.translate(0, L / 2, 0); // pivot at the near end
  const m = new t.Mesh(geo, mat(t, color, o));
  m.position.set(...from);
  m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export type Built = { group: THREE.Group; update?: (time: number) => void };
export type Builder = (t: T, seed: number) => Built;

