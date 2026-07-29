// ---------------------------------------------------------------------------
// Kit/shared.ts — types, palette, hashed scatter, the frame helpers
//
// SPLIT out of index.tsx (2026-07), the same way SceneryPack was split into
// shared/piecesA/piecesB: `write_design_system_files` replaces WHOLE files with
// no patch API, so a module has to fit in one tool call's output, and the
// detailed Kit was 74 KB in one file. Four modules of ~5/29/36/4 KB each push
// independently. Behaviour-neutral — the builders moved verbatim.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mat } from '../Stage';

// re-exported so a Kit module needs ONE import line, not two
export { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx } from '../Stage';
export type { MergedBoxSpec } from '../Stage';

export type T = typeof THREE;
export type V3 = [number, number, number];
export type Part = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 };

export const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// palette
export const BARK = 0x5a3d22;
export const BARK_LIT = 0x6f4d2c;
export const STONE = 0xb9b09a;
export const STONE_LIT = 0xc9c1ac;
export const MARBLE = 0xdad6cc;
export const IRON = 0x2b2b30;
export const WOOD = 0x8a5a2a;
export const WOOD_DARK = 0x5f3f1e;
export const LEAF = 0x3c6b2e;
export const BRASS = 0xd8b54a;

/**
 * A merge PART laid from `from` to `to`, for a unit-height (+Y, origin-centred)
 * geometry — the ONLY safe way to place anything radial or angled. three.js
 * composes Euler 'XYZ' as Rx·Ry, so a `rotX` tilt written alongside a `rotY`
 * azimuth is applied about WORLD X, not about the part's own tangent: correct
 * only at azimuth ±π/2 and wildly wrong elsewhere (it is what sent
 * picnicTable's parasol ribs horizontally out past the hem). A part defined by
 * the two points it joins cannot have that bug.
 */
export function span(t: T, geo: THREE.BufferGeometry, from: V3, to: V3, thick = 1): Part {
  const d = new t.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const L = d.length() || 1e-6;
  const n = d.clone().divideScalar(L);
  return {
    geo,
    matrix: new t.Matrix4().compose(
      new t.Vector3(...from).addScaledVector(n, L / 2),
      new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), n),
      new t.Vector3(thick, L, thick),
    ),
  };
}

/**
 * A merge matrix in an EXPLICIT frame: `xAxis` is the part's local +X and
 * `upHint` its rough local +Y. `Matrix4.makeBasis(x, y, z)` needs a
 * RIGHT-handed triple — hand it a left-handed one and the part mirrors and
 * renders near-black — so `up` is orthogonalised against `x` and local +Z is
 * DERIVED as x × y, which is right-handed by construction whatever the caller
 * passes. Used for every part that rides on a sloping surface (frond leaflets,
 * awning stripes, roof hip caps).
 */
export function basis(t: T, at: V3, xAxis: THREE.Vector3, upHint: THREE.Vector3, scl: V3 = [1, 1, 1]): THREE.Matrix4 {
  const x = xAxis.clone().normalize();
  const y = upHint.clone().addScaledVector(x, -upHint.dot(x)).normalize();
  const z = new t.Vector3().crossVectors(x, y); // right-handed by construction
  const m = new t.Matrix4().makeBasis(x.multiplyScalar(scl[0]), y.multiplyScalar(scl[1]), z.multiplyScalar(scl[2]));
  m.setPosition(at[0], at[1], at[2]);
  return m;
}

/** standalone cylinder rod from `from` to `to` (for one-off meshes) */
export function rod(t: T, from: V3, to: V3, r: number, color: number, o: Parameters<typeof mat>[2] = {}, seg = 8) {
  const dir = new t.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const L = dir.length();
  const geo = new t.CylinderGeometry(r, r, L, seg);
  geo.translate(0, L / 2, 0); // pivot at the near end
  const m = new t.Mesh(geo, mat(t, color, o));
  m.position.set(...from);
  m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
