#!/usr/bin/env node
// OceanTunnelSlide RIDER CLEARANCE probe.
//
// The question is not "is the bore clear of the tube axis" (the component
// already builds that by construction) — it is "does anything touch a RIDER
// anywhere on the lap". So this measures the real thing: it advances the ride's
// own update() over a whole lap, takes the four live seat transforms at every
// step, raises a column of sample points through each rider, and measures
// point-to-TRIANGLE distance against every other mesh in the scene (memory
// lesson: an axial ray through a bent tunnel reads clean while a triangle test
// finds rock). Meshes the rider is SUPPOSED to be inside — the raft it sits in,
// the transparent tube shell, the water — are excluded by name/tag.
//
//   node probe-ots-bore.mjs [--steps=240] [--top=12]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? Number(hit.slice(k.length + 3)) : d;
};
const STEPS = arg('steps', 240);
const TOP = arg('top', 12);

const entry = path.join(OUT, '_ots-entry.ts');
fs.writeFileSync(
  entry,
  `export { buildOceanTunnelSlideScene } from ${JSON.stringify(path.join(REPO, 'components/OceanTunnelSlide/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_ots-bundle.mjs');
await build({
  entryPoints: [entry], bundle: true, outfile: bundlePath, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], external: ['react', 'react-dom', 'react/jsx-runtime'],
  platform: 'node', target: 'node20', logLevel: 'error',
});
// Stage bakes its procedural textures on a 2-D canvas at material-build time,
// so the component cannot be constructed in bare node. The probe never renders
// — it only measures geometry — so a no-op 2-D context is enough, and it keeps
// this probe a 2-second CLI run instead of a browser round trip.
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy(
  { measureText: () => ({ width: 0 }), getImageData: () => ({ data: new Uint8ClampedArray(4) }) },
  { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}), set: () => true },
);
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }),
};

const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

const built = K.buildOceanTunnelSlideScene(T, { riders: true });
const root = built.group;
root.updateMatrixWorld(true);
const LAP = root.userData.lapTime ?? 24;

// ---- who counts as an obstruction ------------------------------------------
// Walk once; for every mesh decide whether a rider touching it is a defect.
const raftSet = new Set();
if (built.vehicle) built.vehicle.traverse((o) => raftSet.add(o));
const meshes = [];
let seq = 0;
root.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  if (raftSet.has(o)) return; // the raft IS the rider's seat
  const m = o.material;
  const transparent = !!(m && m.transparent) || (m && m.type === 'ShaderMaterial');
  // a label you can actually act on: what it is, what colour, where it lives
  const col = m && m.color ? `#${m.color.getHexString()}` : '??????';
  const chain = [];
  for (let p = o; p && p !== root; p = p.parent) if (p.name) chain.push(p.name);
  const kind = o.userData.reefRock ? 'ROCK' : o.name || chain[0] || (o.geometry.type || 'mesh').replace('Geometry', '');
  meshes.push({
    o,
    id: seq++,
    label: `${kind} ${col}`,
    transparent,
    rock: !!o.userData.reefRock,
    verts: o.geometry.getAttribute('position').count,
  });
});

// world-space triangle soup, per mesh, built lazily for candidates only
const triCache = new Map();
const tris = (rec) => {
  let t = triCache.get(rec.o);
  if (t) return t;
  const g = rec.o.geometry;
  const pos = g.getAttribute('position');
  const idx = g.getIndex();
  const n = idx ? idx.count : pos.count;
  t = new Float64Array(n * 3);
  const v = new T.Vector3();
  rec.o.updateWorldMatrix(true, false);
  for (let i = 0; i < n; i += 1) {
    const j = idx ? idx.getX(i) : i;
    v.fromBufferAttribute(pos, j).applyMatrix4(rec.o.matrixWorld);
    t[i * 3] = v.x; t[i * 3 + 1] = v.y; t[i * 3 + 2] = v.z;
  }
  triCache.set(rec.o, t);
  return t;
};
for (const rec of meshes) {
  rec.o.updateWorldMatrix(true, false);
  const bb = new T.Box3().setFromObject(rec.o);
  rec.bb = bb;
}

// ---- point-to-triangle distance (Ericson, Real-Time Collision Detection) ----
const _ab = new T.Vector3(), _ac = new T.Vector3(), _ap = new T.Vector3(), _bp = new T.Vector3(), _cp = new T.Vector3(), _q = new T.Vector3();
function ptTri(p, a, b, c) {
  _ab.subVectors(b, a); _ac.subVectors(c, a); _ap.subVectors(p, a);
  const d1 = _ab.dot(_ap), d2 = _ac.dot(_ap);
  if (d1 <= 0 && d2 <= 0) return p.distanceTo(a);
  _bp.subVectors(p, b);
  const d3 = _ab.dot(_bp), d4 = _ac.dot(_bp);
  if (d3 >= 0 && d4 <= d3) return p.distanceTo(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return p.distanceTo(_q.copy(a).addScaledVector(_ab, d1 / (d1 - d3)));
  _cp.subVectors(p, c);
  const d5 = _ab.dot(_cp), d6 = _ac.dot(_cp);
  if (d6 >= 0 && d5 <= d6) return p.distanceTo(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return p.distanceTo(_q.copy(a).addScaledVector(_ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return p.distanceTo(_q.copy(b).addScaledVector(_cp.subVectors(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
  const den = 1 / (va + vb + vc);
  return p.distanceTo(_q.copy(a).addScaledVector(_ab, vb * den).addScaledVector(_ac, vc * den));
}

// ---- sweep the lap ----------------------------------------------------------
const RIDER_H = [0.1, 0.3, 0.5, 0.7, 0.85]; // above the seat anchor: hips → head
const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), P = new T.Vector3();
const worst = new Map(); // label -> {d, at, seat, y, pos}
let globalWorst = { d: Infinity };
const samples = [];
for (let s = 0; s < STEPS; s += 1) {
  const time = (LAP * s) / STEPS;
  built.update?.(time);
  root.updateMatrixWorld(true);
  for (let seat = 0; seat < 4; seat += 1) {
    const [x, y, z] = built.seatWorld(seat);
    for (const h of RIDER_H) samples.push({ time, seat, h, x, y: y + h, z });
  }
}
console.log(`lap ${LAP.toFixed(2)} s · ${STEPS} steps · ${samples.length} rider points · ${meshes.length} candidate meshes`);

for (const rec of meshes) {
  // broad phase: does any rider point come within 1.2 of this mesh's box?
  let near = false;
  for (const sp of samples) {
    P.set(sp.x, sp.y, sp.z);
    if (rec.bb.distanceToPoint(P) < 1.2) { near = true; break; }
  }
  if (!near) continue;
  const tri = tris(rec);
  for (const sp of samples) {
    P.set(sp.x, sp.y, sp.z);
    if (rec.bb.distanceToPoint(P) > 1.2) continue;
    let best = Infinity;
    for (let i = 0; i < tri.length; i += 9) {
      A.set(tri[i], tri[i + 1], tri[i + 2]);
      B.set(tri[i + 3], tri[i + 4], tri[i + 5]);
      C.set(tri[i + 6], tri[i + 7], tri[i + 8]);
      const d = ptTri(P, A, B, C);
      if (d < best) best = d;
    }
    const cur = worst.get(rec.label);
    if (!cur || best < cur.d) worst.set(rec.label, { d: best, at: sp.time, seat: sp.seat, h: sp.h, p: [sp.x, sp.y, sp.z], transparent: rec.transparent, rock: rec.rock, bb: rec.bb });
    if (!rec.transparent && best < globalWorst.d) globalWorst = { d: best, label: rec.label, at: sp.time, seat: sp.seat, h: sp.h, p: [sp.x, sp.y, sp.z] };
  }
}

// ---- THE TUBE BORE: does anything intrude on the swept riding volume? -------
// The rider points are a thin line; the thing that reads as "blocked" is rock
// poking into the TUBE. So sweep the raft's own centre line (which is the tube
// axis, give or take the trough) and flag any opaque mesh inside the shell.
const TUBE_R = 0.95;
const axis = [];
for (let s = 0; s < STEPS; s += 1) {
  built.update?.((LAP * s) / STEPS);
  root.updateMatrixWorld(true);
  if (built.vehicle) {
    const v = new T.Vector3();
    built.vehicle.getWorldPosition(v);
    axis.push(v.clone());
  }
}
const intrusions = [];
for (const rec of meshes) {
  if (rec.transparent) continue; // the shell and the water are meant to be there
  let best = Infinity;
  let bestAt = null;
  const tri = tris(rec);
  for (const c of axis) {
    if (rec.bb.distanceToPoint(c) > TUBE_R) continue;
    for (let i = 0; i < tri.length; i += 9) {
      A.set(tri[i], tri[i + 1], tri[i + 2]);
      B.set(tri[i + 3], tri[i + 4], tri[i + 5]);
      C.set(tri[i + 6], tri[i + 7], tri[i + 8]);
      const d = ptTri(c, A, B, C);
      if (d < best) { best = d; bestAt = c; }
    }
  }
  if (best < TUBE_R) intrusions.push({ rec, d: best, at: bestAt });
}
intrusions.sort((a, b) => a.d - b.d);
console.log(`\nOPAQUE GEOMETRY INSIDE THE TUBE (shell radius ${TUBE_R}) — ${intrusions.length} mesh(es):`);
for (const it of intrusions.slice(0, 20))
  console.log(
    `  ${it.d.toFixed(3)} from the axis  ${it.rec.label.padEnd(28)} verts ${String(it.rec.verts).padStart(5)}  near [${it.at.toArray().map((v) => v.toFixed(2)).join(', ')}]  box ${it.rec.bb.min.toArray().map((v) => v.toFixed(1)).join('/')} → ${it.rec.bb.max.toArray().map((v) => v.toFixed(1)).join('/')}`,
  );

const rows = [...worst.entries()].sort((a, b) => a[1].d - b[1].d).slice(0, TOP);
console.log('\nclosest approach of any RIDER point to each mesh (opaque = a real defect under ~0.25):');
for (const [label, w] of rows)
  console.log(
    `  ${w.d.toFixed(3)}  ${label.padEnd(22)}${w.transparent ? ' (transparent)' : ''}${w.rock ? ' [reef rock]' : ''}  t=${w.at.toFixed(1)}s seat${w.seat} h=${w.h}  at [${w.p.map((v) => v.toFixed(2)).join(', ')}]`,
  );
console.log(`\nWORST OPAQUE: ${globalWorst.d === Infinity ? 'nothing within range' : `${globalWorst.d.toFixed(3)} to ${globalWorst.label} at t=${globalWorst.at.toFixed(1)}s, rider point [${globalWorst.p.map((v) => v.toFixed(2)).join(', ')}]`}`);
