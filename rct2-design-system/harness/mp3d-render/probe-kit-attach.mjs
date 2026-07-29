#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-kit-attach.mjs — IS EVERY PART OF EVERY KIT ASSET ACTUALLY ATTACHED?
//
// Same test as probe-scenery-attach.mjs, pointed at Kit's builders through
// kit-views.ts (Kit's exports take option objects and half return a bare Group,
// so they need the adapter). Reproduced rather than parameterised because
// probe-scenery-attach is hard-wired to `buildSceneryAnimated(t, name, opts)`
// and other agents are editing it concurrently.
//
// What it measures, and the two false positives it exists to avoid:
//   * exact point-to-triangle SURFACE distance (Ericson), on a barycentric
//     subdivision of every triangle sized to that triangle — vertices and
//     centroids alone are far too sparse for long thin solids that
//     interpenetrate (a willow tendril crossing the canopy sphere, a lamp
//     bracket entering the post).
//   * a ray-PARITY containment test, because a part fully INSIDE another is
//     attached, not floating (the fountain's jet roots inside the bowl).
//   * AABBs are used ONLY to prune pairs that provably cannot be in tolerance.
// "Rests on the ground" counts as an attachment — rock's boulders and
// flowerBed's blooms are legitimately separate objects sharing a bed.
//
//   node probe-kit-attach.mjs [--tol=0.01] [--asset=treeWillow] [--views=kit-views]
//   node probe-kit-attach.mjs --nudge=treePalm:60:0,0.35,0  # fail-on-purpose
//     (sub-solid 60 is a frond leaflet; +0.35 lifts it off the blade and the
//      probe reports it 0.249 from the nearest surface. Verified to fail.)
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const VIEWS = arg('views', 'kit-views');
const TOL = Number(arg('tol', 0.01));
const ONLY = arg('asset', null);
// `--nudge=asset:solidIndex:dx,dy,dz` displaces ONE SUB-SOLID before grading,
// so the check can be made to fail on purpose. A check that has never failed is
// not evidence — and because Kit batches hard, the nudge has to bite at
// sub-solid granularity or it would only prove the old mesh-level test.
const NUDGE = arg('nudge', null);
const GROUND = 0.06; // a part whose lowest point is this close to grade is planted
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, `_kattach-entry-${VIEWS}.ts`);
fs.writeFileSync(
  entry,
  `export * from ${JSON.stringify(path.join(HARNESS, `${VIEWS}.ts`))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, `_kattach-bundle-${VIEWS}.mjs`);
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
const inside = (p, tris) => rayHits(p.x, p.y, p.z, 0.5773, 0.5566, 0.5972, tris) % 2 === 1;

/** world-space triangles + a barycentric sample grid for a triangle list */
function harvest(mesh, triIdx) {
  const g = mesh.geometry;
  const pa = g.getAttribute('position');
  const idx = g.index;
  const tris = [];
  const pts = [];
  const v = new T.Vector3();
  const get = (i) => {
    const j = idx ? idx.getX(i) : i;
    return v.fromBufferAttribute(pa, j).clone().applyMatrix4(mesh.matrixWorld);
  };
  for (const f of triIdx) {
    const i = f * 3;
    const a = get(i);
    const b = get(i + 1);
    const c = get(i + 2);
    tris.push([a, b, c]);
    // SUBDIVIDE. Vertices + one centroid is far too sparse for the long thin
    // solids this kit is built from: a palm frond's midrib passes clean THROUGH
    // the crown boot, but the rod's only samples sit at its end caps and its
    // side-triangle centroids, so nothing lands near the boot and a solidly
    // joined assembly reports as two floating groups. Sample on a barycentric
    // grid sized to the triangle, so contact anywhere on a face is seen.
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

/**
 * SPLIT one mesh into its connected SUB-SOLIDS, and grade those instead of the
 * meshes.
 *
 * This is the whole reason the probe is not a copy of probe-scenery-attach: Kit
 * batches hard (`tree` went 7/5/14/12 meshes → 4/3/4/4 so the per-instance draw
 * cost went DOWN while the detail went up), and a mesh-level union-find over 4
 * merged batches is close to vacuous — a leaflet floating 0.3 off its frond
 * lives INSIDE the same merged buffer as the frond and would never be reported.
 *
 * `mergedBoxes` / `mergedParts` concatenate each source primitive's own vertex
 * range and never weld across parts, so union-find over "triangles that share a
 * vertex POSITION" recovers the pre-merge primitives: tree's round shape grades
 * as 33 sub-solids instead of 4 meshes.
 *
 * Welding on POSITION rather than on vertex index matters twice over. three.js's
 * IcosahedronGeometry (every foliage clump, every ball) is NON-INDEXED, and
 * mergedParts gives such a source a sequential index buffer — so an index-based
 * split shatters one sphere into 80 separate "solids" (the round tree came out
 * as 777). Position welding keeps a sphere whole, and it also unions two
 * primitives that meet exactly face-to-face, which is correct: they ARE joined.
 */
function components(mesh) {
  const g = mesh.geometry;
  const idx = g.index;
  const pa = g.getAttribute('position');
  const nTri = (idx ? idx.count : pa.count) / 3;
  const vi = (i) => (idx ? idx.getX(i) : i);
  const up = [];
  const find = (x) => {
    while (up[x] !== x) x = up[x] = up[up[x]];
    return x;
  };
  const key = new Map(); // quantised position → representative node
  const node = (i) => {
    const j = vi(i);
    const k = `${Math.round(pa.getX(j) * 1e5)},${Math.round(pa.getY(j) * 1e5)},${Math.round(pa.getZ(j) * 1e5)}`;
    let r = key.get(k);
    if (r === undefined) {
      r = up.length;
      up.push(r);
      key.set(k, r);
    }
    return r;
  };
  const tri = [];
  for (let f = 0; f < nTri; f++) {
    const a = node(f * 3);
    const b = node(f * 3 + 1);
    const c = node(f * 3 + 2);
    tri.push(a);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) up[rb] = ra;
    const rc = find(c);
    if (find(a) !== rc) up[rc] = find(a);
  }
  const groups = new Map();
  for (let f = 0; f < nTri; f++) {
    const r = find(tri[f]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(f);
  }
  return [...groups.values()];
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
/** a part buried INSIDE another is attached, not floating */
function engulfed(A, B) {
  const step = Math.max(1, Math.floor(A.pts.length / 24));
  for (let i = 0; i < A.pts.length; i += step) if (inside(A.pts[i], B.tris)) return true;
  return false;
}

const nudge = NUDGE ? { asset: NUDGE.split(':')[0], idx: Number(NUDGE.split(':')[1]), d: NUDGE.split(':')[2].split(',').map(Number) } : null;
const names = ONLY ? [ONLY] : K.KIT_VIEWS;
const rows = [];
for (const name of names) {
  const built = K[name](T);
  built.update?.(3.7); // never grade the rest pose
  const meshes = [];
  built.group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  built.group.updateMatrixWorld(true);
  // grade SUB-SOLIDS, not meshes (see components() above)
  const parts = [];
  const owner = [];
  meshes.forEach((m, mi) =>
    components(m).forEach((triIdx) => {
      parts.push(harvest(m, triIdx));
      owner.push(mi);
    }),
  );
  const N = parts.length;
  if (nudge && nudge.asset === name && parts[nudge.idx]) {
    const p = parts[nudge.idx];
    const d = new T.Vector3(...nudge.d);
    p.pts.forEach((q) => q.add(d));
    p.tris.forEach((tr) => tr.forEach((q) => q.add(d)));
    p.box.setFromPoints(p.pts);
    console.log(`  [nudge] ${name} sub-solid #${nudge.idx} (mesh #${owner[nudge.idx]}) displaced by (${nudge.d.join(', ')})`);
  }
  const up = Array.from({ length: N + 1 }, (_, i) => i); // node N is GRADE
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
    const b = new T.Box3();
    members.forEach((m) => b.union(parts[m].box));
    const c = b.getCenter(new T.Vector3());
    let sep = Infinity;
    for (const m of members) {
      for (let o = 0; o < N; o++) {
        if (find(o) !== mainRoot) continue;
        eb.copy(parts[m].box).expandByScalar(0.5);
        if (!eb.intersectsBox(parts[o].box)) continue;
        sep = Math.min(sep, minDist(parts[m], parts[o], 0), minDist(parts[o], parts[m], 0));
      }
    }
    if (process.argv.includes('--verbose'))
      members.forEach((m) =>
        console.log(
          `      [dbg] solid ${m} (mesh #${owner[m]}) box [${parts[m].box.min.toArray().map((v) => v.toFixed(3))}] → [${parts[m].box.max
            .toArray()
            .map((v) => v.toFixed(3))}]`,
        ),
      );
    loose.push({
      n: members.length,
      mesh: [...new Set(members.map((m) => owner[m]))],
      at: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)],
      lowY: +b.min.y.toFixed(3),
      sep,
    });
  }
  rows.push({ name, meshes: meshes.length, solids: N, loose });
}

let bad = 0;
console.log(`\n  probe-kit-attach · ${VIEWS}\n  tol ${TOL}, grade ${GROUND}\n`);
for (const r of rows) {
  if (r.loose.length) {
    bad += 1;
    console.log(`  FAIL  ${r.name.padEnd(16)} ${r.meshes} meshes / ${r.solids} sub-solids — ${r.loose.length} detached group(s)`);
    r.loose.forEach((l) =>
      console.log(
        `          ${l.n} sub-solid(s) in mesh #${l.mesh.join(',')} adrift, centred (${l.at.join(', ')}), lowest y ${l.lowY}, nearest surface ${Number.isFinite(l.sep) ? l.sep.toFixed(3) : '>0.5'} away`,
      ),
    );
  } else {
    console.log(`  ok    ${r.name.padEnd(16)} ${String(r.meshes).padStart(2)} meshes / ${String(r.solids).padStart(3)} sub-solids, all connected`);
  }
}
console.log(`\n  ${rows.length - bad}/${rows.length} assets fully connected\n`);
process.exit(bad ? 1 : 0);
