#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-scenery-attach.mjs — IS EVERY PART OF EVERY PIECE ACTUALLY ATTACHED?
//
// The recurring SceneryPack defect is a part placed in the wrong frame, and its
// visible symptom is almost always the same: something floats. A statue's hand
// 0.14 off the wrist, a step on the grass, ribs leaving a sphere. Those were all
// found by eye, one piece at a time, which does not scale to 20 pieces and did
// not catch the statue until the fourth screenshot sheet.
//
// This sweeps all 20 pieces and reports any mesh not connected to the rest of
// its piece, by SURFACE-TO-SURFACE distance.
//
// Two things it deliberately does NOT do:
//   * AABB overlap. marbleStatue's detached hand has a bounding box that
//     overlaps its arm's — a box test calls it attached. Boxes are used only to
//     PRUNE pairs that provably cannot be within tolerance.
//   * treat "sits on the ground" as floating. Scattered pieces (mushroomCluster,
//     cactusCluster, fallenLog's toadstools) are legitimately separate objects,
//     so grade meets the ground counts as an attachment.
//
//   node probe-scenery-attach.mjs [--tol=0.01] [--piece=name] [--src=DIR]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const SRC = path.resolve(arg('src', path.join(REPO, 'components/SceneryPack')));
const TOL = Number(arg('tol', 0.01));
const ONLY = arg('piece', null);
const GROUND = 0.06; // a part whose lowest point is this close to grade is planted
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const tag = path.basename(SRC);
const entry = path.join(OUT, `_attach-entry-${tag}.ts`);
fs.writeFileSync(
  entry,
  `export { buildSceneryAnimated, SCENERY_NAMES } from ${JSON.stringify(path.join(SRC, 'index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, `_attach-bundle-${tag}.mjs`);
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy({ measureText: () => ({ width: 0 }) }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}),
  set: () => true,
});
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }),
};
const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

// ---- exact point-to-triangle distance (Ericson, Real-Time Collision Detection)
function ptTri(p, a, b, c) {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const ap = p.clone().sub(a);
  const d1 = ab.dot(ap);
  const d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return ap.length();
  const bp = p.clone().sub(b);
  const d3 = ab.dot(bp);
  const d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return bp.length();
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return ap.clone().sub(ab.clone().multiplyScalar(d1 / (d1 - d3))).length();
  const cp = p.clone().sub(c);
  const d5 = ab.dot(cp);
  const d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return cp.length();
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return ap.clone().sub(ac.clone().multiplyScalar(d2 / (d2 - d6))).length();
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return bp.clone().sub(c.clone().sub(b).multiplyScalar(w)).length();
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return ap.clone().sub(ab.multiplyScalar(v)).sub(ac.multiplyScalar(w)).length();
}

/** Möller–Trumbore; used for ray PARITY, so back faces count too */
function rayHits(ox, oy, oz, dx, dy, dz, tris) {
  let hits = 0;
  for (const t of tris) {
    const [a, b, c] = t;
    const e1x = b.x - a.x;
    const e1y = b.y - a.y;
    const e1z = b.z - a.z;
    const e2x = c.x - a.x;
    const e2y = c.y - a.y;
    const e2z = c.z - a.z;
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const tx = ox - a.x;
    const ty = oy - a.y;
    const tz = oz - a.z;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    if ((e2x * qx + e2y * qy + e2z * qz) * inv > 1e-9) hits += 1;
  }
  return hits;
}
/** is p strictly inside the closed surface `tris`? odd crossing count = yes */
const inside = (p, tris) => rayHits(p.x, p.y, p.z, 0.5773, 0.5566, 0.5972, tris) % 2 === 1;

/** world-space triangles + sample points for one mesh */
function harvest(mesh) {
  const g = mesh.geometry;
  const pa = g.getAttribute('position');
  const idx = g.index;
  const n = idx ? idx.count : pa.count;
  const tris = [];
  const pts = [];
  const v = new T.Vector3();
  const get = (i) => {
    const j = idx ? idx.getX(i) : i;
    return v.fromBufferAttribute(pa, j).clone().applyMatrix4(mesh.matrixWorld);
  };
  for (let i = 0; i + 2 < n; i += 3) {
    const a = get(i);
    const b = get(i + 1);
    const c = get(i + 2);
    tris.push([a, b, c]);
    // SUBDIVIDE. Vertices + one centroid is far too sparse for the long thin
    // solids this pack is built from: the wishing well's axle passes clean
    // THROUGH both posts, but the axle's only samples sit at its end caps
    // (x ±0.54, outboard of the posts) and at its side-triangle centroids
    // (x 0), so nothing lands near the post at x 0.48 and a solidly joined
    // assembly reported as two floating groups. Sample on a barycentric grid
    // sized to the triangle, so contact anywhere on a face is seen.
    const e = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const k = Math.min(12, Math.max(1, Math.ceil(e / 0.03)));
    for (let s = 0; s <= k; s++) {
      for (let t2 = 0; t2 + s <= k; t2++) {
        const w0 = 1 - (s + t2) / k;
        const w1 = s / k;
        const w2 = t2 / k;
        pts.push(new T.Vector3(a.x * w0 + b.x * w1 + c.x * w2, a.y * w0 + b.y * w1 + c.y * w2, a.z * w0 + b.z * w1 + c.z * w2));
      }
    }
  }
  const box = new T.Box3().setFromPoints(pts);
  return { tris, pts, box };
}

function minDist(A, B, tol) {
  let best = Infinity;
  for (const p of A.pts) {
    for (const t of B.tris) {
      const d = ptTri(p, t[0], t[1], t[2]);
      if (d < best) best = d;
      if (best <= tol) return best;
    }
  }
  return best;
}
/** A part buried INSIDE another is attached, not floating. The well's rope top
 *  sits within the 0.035 axle it hangs from and the balloon's load ropes end
 *  inside the envelope, so a pure surface-distance test calls both detached. */
function engulfed(A, B) {
  const step = Math.max(1, Math.floor(A.pts.length / 24));
  for (let i = 0; i < A.pts.length; i += step) if (inside(A.pts[i], B.tris)) return true;
  return false;
}

const quiet = console.warn;
const names = ONLY ? [ONLY] : K.SCENERY_NAMES;
const rows = [];
for (const name of names) {
  console.warn = () => {};
  const built = K.buildSceneryAnimated(T, name, { seed: 3 });
  console.warn = quiet;
  built.update?.(3.7); // never grade the rest pose
  built.group.updateMatrixWorld(true);
  const meshes = [];
  built.group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const parts = meshes.map(harvest);
  const N = parts.length;
  // union-find; node N is GRADE
  const up = Array.from({ length: N + 1 }, (_, i) => i);
  const find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) up[ra] = rb;
  };
  for (let i = 0; i < N; i++) if (parts[i].box.min.y <= GROUND) join(i, N);
  const eb = new T.Box3();
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (find(i) === find(j)) continue;
      eb.copy(parts[i].box).expandByScalar(TOL);
      if (!eb.intersectsBox(parts[j].box)) continue; // provably further than TOL
      if (
        minDist(parts[i], parts[j], TOL) <= TOL ||
        minDist(parts[j], parts[i], TOL) <= TOL ||
        engulfed(parts[i], parts[j]) ||
        engulfed(parts[j], parts[i])
      )
        join(i, j);
    }
  }
  const roots = new Map();
  for (let i = 0; i < N; i++) {
    const r = find(i);
    if (!roots.has(r)) roots.set(r, []);
    roots.get(r).push(i);
  }
  const mainRoot = find(N);
  const loose = [];
  for (const [r, members] of roots) {
    if (r === mainRoot) continue;
    // report the group's extent so a real defect is identifiable in a render
    const b = new T.Box3();
    members.forEach((m) => b.union(parts[m].box));
    const c = b.getCenter(new T.Vector3());
    // HOW FAR is it adrift? A binary verdict is not actionable — 0.058 is a
    // statue's hand off its wrist, 0.002 is a tolerance argument. Report the
    // actual worst-case shortest surface distance to the attached body.
    let sep = Infinity;
    for (const m of members) {
      for (let o = 0; o < N; o++) {
        if (find(o) !== mainRoot) continue;
        eb.copy(parts[m].box).expandByScalar(0.5);
        if (!eb.intersectsBox(parts[o].box)) continue;
        sep = Math.min(sep, minDist(parts[m], parts[o], 0), minDist(parts[o], parts[m], 0));
      }
    }
    loose.push({ n: members.length, at: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], sep });
  }
  rows.push({ name, meshes: N, loose });
}

let bad = 0;
console.log(`\n  probe-scenery-attach · ${SRC}\n  tol ${TOL}, grade ${GROUND}\n`);
for (const r of rows) {
  if (r.loose.length) {
    bad += 1;
    console.log(`  FAIL  ${r.name.padEnd(18)} ${r.meshes} meshes — ${r.loose.length} detached group(s)`);
    r.loose.forEach((l) =>
      console.log(`          ${l.n} mesh(es) adrift, centred (${l.at.join(', ')}), nearest surface ${Number.isFinite(l.sep) ? l.sep.toFixed(3) : '>0.5'} away`),
    );
  } else {
    console.log(`  ok    ${r.name.padEnd(18)} ${r.meshes} meshes, all connected`);
  }
}
console.log(`\n  ${rows.length - bad}/${rows.length} pieces fully connected\n`);
process.exit(bad ? 1 : 0);
