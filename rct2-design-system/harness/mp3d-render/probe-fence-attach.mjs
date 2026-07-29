#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-fence-attach.mjs — IS EVERY SOLID OF EVERY FENCE STYLE PLANTED?
//
// probe-scenery-attach.mjs answers this for SceneryPack by treating each MESH as
// a part. That is useless for <Fence>: a whole fence run is 2-3 MERGED meshes, so
// a picket floating 0.1 above its rail lives in the same mesh as the rail and the
// mesh-level test can never see it. This probe recovers the individual SOLIDS out
// of the merged geometry first — weld vertices by position, take connected
// components of the triangle graph, and every box/prism/ball that was merged
// comes back as its own component (two solids that share exact vertices weld
// into one, which is fine: they are attached by construction).
//
// Then it runs the same three tests probe-scenery-attach.mjs does, for the same
// two false-positive reasons:
//   * EXACT point-to-triangle surface distance (Ericson), never AABB overlap —
//     boxes only PRUNE pairs that provably cannot be within tolerance;
//   * barycentric SUBDIVISION of every triangle, because a post and a rail that
//     interpenetrate share no vertices and their end-cap samples sit outboard of
//     each other (the wishing-well axle trap);
//   * a ray-PARITY containment test, because a solid fully INSIDE another (a
//     rail tenon buried in a post, a bead sunk in a picket) is attached, not
//     adrift.
//
// GRADE here is the run's OWN `groundAt` sampler, not y = 0: a fence follows the
// terrain, so "planted" means within GROUND of the ground UNDER that solid. The
// same sampler gives the burial report — a post buried to its cap is as wrong as
// a post hovering.
//
//   node probe-fence-attach.mjs [--tol=0.01] [--style=wood] [--grade=0.18] [--len=3]
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
const TOL = Number(arg('tol', 0.01));
const GROUND = 0.06; // lowest point this close to the ground under it = planted
const MAX_BURY = 0.14; // deeper than this is a solid sunk into the terrain
const ONLY = arg('style', null);
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, '_fence-attach-entry.ts');
fs.writeFileSync(
  entry,
  `export { buildFence, buildFenceLoop, FENCE_STYLES } from ${JSON.stringify(path.join(REPO, 'components/Fence/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_fence-attach-bundle.mjs');
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
    const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
    const e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const tx = ox - a.x, ty = oy - a.y, tz = oz - a.z;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    if ((e2x * qx + e2y * qy + e2z * qz) * inv > 1e-9) hits += 1;
  }
  return hits;
}
const inside = (p, tris) => rayHits(p.x, p.y, p.z, 0.5773, 0.5566, 0.5972, tris) % 2 === 1;

/** split ONE merged mesh into its welded connected components, in world space */
function components(mesh) {
  const g = mesh.geometry;
  const pa = g.getAttribute('position');
  const idx = g.index;
  const n = idx ? idx.count : pa.count;
  // weld by quantized position so a BoxGeometry (24 verts, 6 vertex-disjoint
  // faces in index space) comes back as ONE solid instead of six
  const weld = new Map();
  const wid = new Int32Array(pa.count);
  const v = new T.Vector3();
  const world = [];
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld);
    world.push(v.clone());
    const key = `${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)},${Math.round(v.z * 1e4)}`;
    let id = weld.get(key);
    if (id === undefined) {
      id = weld.size;
      weld.set(key, id);
    }
    wid[i] = id;
  }
  const up = Array.from({ length: weld.size }, (_, i) => i);
  const find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
  const join = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) up[ra] = rb;
  };
  const tri = [];
  for (let i = 0; i + 2 < n; i += 3) {
    const a = idx ? idx.getX(i) : i;
    const b = idx ? idx.getX(i + 1) : i + 1;
    const c = idx ? idx.getX(i + 2) : i + 2;
    join(wid[a], wid[b]);
    join(wid[b], wid[c]);
    tri.push([a, b, c]);
  }
  const groups = new Map();
  for (const t of tri) {
    const r = find(wid[t[0]]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(t);
  }
  return [...groups.values()].map((tris) => harvest(tris, world));
}

/** world triangles + a barycentric SAMPLE GRID for one solid */
function harvest(triList, world) {
  const tris = [];
  const pts = [];
  for (const [ia, ib, ic] of triList) {
    const a = world[ia], b = world[ib], c = world[ic];
    tris.push([a, b, c]);
    const e = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const k = Math.min(12, Math.max(1, Math.ceil(e / 0.03)));
    for (let s = 0; s <= k; s++)
      for (let t2 = 0; t2 + s <= k; t2++) {
        const w0 = 1 - (s + t2) / k, w1 = s / k, w2 = t2 / k;
        pts.push(new T.Vector3(a.x * w0 + b.x * w1 + c.x * w2, a.y * w0 + b.y * w1 + c.y * w2, a.z * w0 + b.z * w1 + c.z * w2));
      }
  }
  return { tris, pts, box: new T.Box3().setFromPoints(pts) };
}

function minDist(A, B, tol) {
  let best = Infinity;
  for (const p of A.pts)
    for (const t of B.tris) {
      const d = ptTri(p, t[0], t[1], t[2]);
      if (d < best) best = d;
      if (best <= tol) return best;
    }
  return best;
}
function engulfed(A, B) {
  const step = Math.max(1, Math.floor(A.pts.length / 24));
  for (let i = 0; i < A.pts.length; i += step) if (inside(A.pts[i], B.tris)) return true;
  return false;
}

// ---------------------------------------------------------------------------
const CASES = [];
for (const style of ONLY ? [ONLY] : Object.keys(K.FENCE_STYLES)) {
  const L = Number(arg('len', 3.0));
  CASES.push({ style, tag: `${style} flat`, len: L, grade: 0 });
  CASES.push({ style, tag: `${style} slope`, len: L, grade: Number(arg('grade', 0.18)) });
  CASES.push({ style, tag: `${style} loop`, loop: true });
}

let bad = 0;
console.log(`\n  probe-fence-attach · tol ${TOL}, grade contact ${GROUND}, max burial ${MAX_BURY}\n`);
for (const c of CASES) {
  const gAt = c.loop ? (x, z) => 0.05 * x + 0.03 * z : (_x, z) => c.grade * (z + c.len / 2);
  const built = c.loop
    ? K.buildFenceLoop(T, [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]], { style: c.style, seed: 3, groundAt: gAt })
    : K.buildFence(T, { from: [0, -c.len / 2], to: [0, c.len / 2], style: c.style, seed: 3, groundAt: gAt });
  built.group.updateMatrixWorld(true);
  const meshes = [];
  built.group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  let tris = 0;
  const parts = [];
  for (const m of meshes) {
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    parts.push(...components(m));
  }
  const N = parts.length;
  // GRADE is node N. A solid is planted when its lowest sample sits within
  // GROUND of the ground under THAT sample (a fence follows the terrain).
  const up = Array.from({ length: N + 1 }, (_, i) => i);
  const find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
  const join = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) up[ra] = rb;
  };
  let worstBury = 0;
  let sunk = 0;
  for (let i = 0; i < N; i++) {
    let clear = Infinity;
    let bury = -Infinity;
    for (const p of parts[i].pts) {
      const d = p.y - gAt(p.x, p.z);
      if (d < clear) clear = d;
      if (-d > bury) bury = -d;
    }
    parts[i].clear = clear;
    if (clear <= GROUND) join(i, N);
    if (bury > worstBury) worstBury = bury;
    // fully under the terrain = invisible geometry, and a lint the eye cannot catch
    let top = -Infinity;
    for (const p of parts[i].pts) top = Math.max(top, p.y - gAt(p.x, p.z));
    if (top < 0 || bury > MAX_BURY) sunk += 1;
  }
  const eb = new T.Box3();
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      if (find(i) === find(j)) continue;
      eb.copy(parts[i].box).expandByScalar(TOL);
      if (!eb.intersectsBox(parts[j].box)) continue;
      if (minDist(parts[i], parts[j], TOL) <= TOL || minDist(parts[j], parts[i], TOL) <= TOL || engulfed(parts[i], parts[j]) || engulfed(parts[j], parts[i]))
        join(i, j);
    }
  const mainRoot = find(N);
  const roots = new Map();
  for (let i = 0; i < N; i++) {
    const r = find(i);
    if (!roots.has(r)) roots.set(r, []);
    roots.get(r).push(i);
  }
  const loose = [];
  for (const [r, members] of roots) {
    if (r === mainRoot) continue;
    const b = new T.Box3();
    members.forEach((m) => b.union(parts[m].box));
    const ctr = b.getCenter(new T.Vector3());
    let sep = Infinity;
    for (const m of members)
      for (let o = 0; o < N; o++) {
        if (find(o) !== mainRoot) continue;
        eb.copy(parts[m].box).expandByScalar(0.6);
        if (!eb.intersectsBox(parts[o].box)) continue;
        sep = Math.min(sep, minDist(parts[m], parts[o], 0), minDist(parts[o], parts[m], 0));
      }
    loose.push({ n: members.length, at: [+ctr.x.toFixed(2), +ctr.y.toFixed(2), +ctr.z.toFixed(2)], sep, clear: parts[members[0]].clear });
  }
  const okLine = `${String(meshes.length).padStart(2)} mesh ${String(N).padStart(4)} solids ${String(Math.round(tris)).padStart(6)} tris  worst burial ${worstBury.toFixed(3)}`;
  if (loose.length || sunk) {
    bad += 1;
    console.log(`  FAIL  ${c.tag.padEnd(14)} ${okLine}`);
    loose.forEach((l) =>
      console.log(
        `          ${l.n} solid(s) ADRIFT centred (${l.at.join(', ')}), nearest surface ${Number.isFinite(l.sep) ? l.sep.toFixed(3) : '>0.6'} away, ${l.clear.toFixed(3)} over the ground`,
      ),
    );
    if (sunk) console.log(`          ${sunk} solid(s) SUNK (fully under the terrain, or buried > ${MAX_BURY})`);
  } else {
    console.log(`  ok    ${c.tag.padEnd(14)} ${okLine}`);
  }
}
console.log(`\n  ${CASES.length - bad}/${CASES.length} cases fully planted\n`);
process.exit(bad ? 1 : 0);
