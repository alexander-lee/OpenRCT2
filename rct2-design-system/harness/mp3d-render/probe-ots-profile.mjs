#!/usr/bin/env node
// OceanTunnelSlide BORE PROFILE — the clear radius around the tube, station by
// station, measured with point-to-triangle distance against the reef.
//
// The component's own invariant is BORE_R = TUBE_R + 0.75 = 1.70: no rock may
// come within 1.70 of the TUBE AXIS. This walks the axis and reports the
// closest rock at every station, so a dip below it is located, not just
// detected.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
const entry = path.join(OUT, '_ots-entry.ts');
fs.mkdirSync(OUT, { recursive: true });
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
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy({ measureText: () => ({ width: 0 }) }, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}), set: () => true });
globalThis.document = { createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }) };

const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;
const built = K.buildOceanTunnelSlideScene(T, { riders: false });
const root = built.group;
root.updateMatrixWorld(true);
const LAP = root.userData.lapTime ?? 24;
const basin = root.userData.basinAt;

// ---- the axis, RECOVERED FROM THE SHELL ITSELF -----------------------------
// Not the raft's path: the raft floats in the trough, ~0.2 below the tube axis,
// so measuring rock against it silently shifts every clearance. `buildTubeShell`
// emits n rings of (seg+1) vertices, each ring a circle of radius TUBE_R about
// the axis — so the ring centroids ARE the axis, exactly, and the component
// cannot drift away from what the probe measures. The shell is fingerprinted by
// that property (every vertex of a ring equidistant from its centroid), not by
// name or material.
const SEG1 = 19; // seg 18 + the seam vertex
const TUBE_R_EXPECT = 0.95;
const raftSet = new Set();
if (built.vehicle) built.vehicle.traverse((o) => raftSet.add(o));
let shell = null;
root.traverse((o) => {
  if (shell || !o.isMesh || !o.geometry) return;
  const pos = o.geometry.getAttribute('position');
  if (!pos || pos.count < 200 || pos.count % SEG1 !== 0) return;
  const c = new T.Vector3();
  const v = new T.Vector3();
  for (let j = 0; j < SEG1 - 1; j += 1) c.add(v.fromBufferAttribute(pos, j));
  c.divideScalar(SEG1 - 1);
  let ok = true;
  for (let j = 0; j < SEG1 - 1; j += 1) if (Math.abs(v.fromBufferAttribute(pos, j).distanceTo(c) - TUBE_R_EXPECT) > 0.02) ok = false;
  if (ok) shell = o;
});
if (!shell) throw new Error('tube shell not found — the ring fingerprint no longer matches buildTubeShell');
shell.updateWorldMatrix(true, false);
const axis = [];
{
  const pos = shell.geometry.getAttribute('position');
  const rings = pos.count / SEG1;
  const v = new T.Vector3();
  for (let i = 0; i < rings; i += 1) {
    const c = new T.Vector3();
    for (let j = 0; j < SEG1 - 1; j += 1) c.add(v.fromBufferAttribute(pos, i * SEG1 + j));
    axis.push(c.divideScalar(SEG1 - 1).applyMatrix4(shell.matrixWorld));
  }
}
const STEPS = axis.length - 1;
console.log(`shell recovered: ${axis.length} rings, from [${axis[0].toArray().map((x) => x.toFixed(2)).join(', ')}] to [${axis[axis.length - 1].toArray().map((x) => x.toFixed(2)).join(', ')}]`);

// ---- rock + other opaque geometry ------------------------------------------
const groups = { ROCK: [], OTHER: [] };
root.traverse((o) => {
  if (!o.isMesh || !o.geometry || raftSet.has(o)) return;
  const m = o.material;
  if (m && (m.type === 'ShaderMaterial' || (m.transparent && (m.opacity ?? 1) < 0.75))) return; // shell, water
  o.updateWorldMatrix(true, false);
  const bb = new T.Box3().setFromObject(o);
  const rec = { o, bb, label: o.userData.reefRock ? 'ROCK' : `${(o.geometry.type || 'mesh').replace('Geometry', '')} #${m && m.color ? m.color.getHexString() : '??'}` };
  (o.userData.reefRock ? groups.ROCK : groups.OTHER).push(rec);
});

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
const triCache = new Map();
const tris = (rec) => {
  let t = triCache.get(rec.o);
  if (t) return t;
  const g = rec.o.geometry, pos = g.getAttribute('position'), idx = g.getIndex();
  const n = idx ? idx.count : pos.count;
  t = new Float64Array(n * 3);
  const v = new T.Vector3();
  for (let i = 0; i < n; i += 1) {
    v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(rec.o.matrixWorld);
    t[i * 3] = v.x; t[i * 3 + 1] = v.y; t[i * 3 + 2] = v.z;
  }
  triCache.set(rec.o, t);
  return t;
};
const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
const nearest = (p, recs, cut) => {
  let best = { d: Infinity, label: null };
  for (const rec of recs) {
    if (rec.bb.distanceToPoint(p) > Math.min(cut, best.d)) continue;
    const tri = tris(rec);
    for (let i = 0; i < tri.length; i += 9) {
      A.set(tri[i], tri[i + 1], tri[i + 2]);
      B.set(tri[i + 3], tri[i + 4], tri[i + 5]);
      C.set(tri[i + 6], tri[i + 7], tri[i + 8]);
      const d = ptTri(p, A, B, C);
      if (d < best.d) best = { d, label: rec.label };
    }
  }
  return best;
};

const BORE_R = 0.95 + 0.75; // keep in step with the component
console.log(`basin at [${basin.map((v) => v.toFixed(2)).join(', ')}] · lap ${LAP.toFixed(1)}s · ${groups.ROCK.length} rock meshes, ${groups.OTHER.length} other opaque`);
console.log('\nstation profile through the reef (only where rock is within 3.0 of the axis):');
console.log('  ring   axis position            nearest ROCK   nearest OTHER opaque');
let worstRock = { d: Infinity };
for (let s = 0; s <= STEPS; s += 1) {
  const p = axis[s];
  if (Math.hypot(p.x - basin[0], p.z - basin[2]) > 7) continue;
  const r = nearest(p, groups.ROCK, 3.0);
  if (r.d > 3.0) continue;
  const o = nearest(p, groups.OTHER, 3.0);
  if (r.d < worstRock.d) worstRock = { ...r, t: s, p: p.clone() };
  const flag = r.d < BORE_R ? '  <<< INSIDE THE BORE' : '';
  console.log(
    `  ring ${String(s).padStart(3)}  [${p.toArray().map((v) => v.toFixed(2).padStart(6)).join(', ')}]   ${r.d.toFixed(3)}        ${o.d < 3 ? `${o.d.toFixed(3)} ${o.label}` : '—'}${flag}`,
  );
}
console.log(`\nWORST rock-to-axis over the crossing: ${worstRock.d.toFixed(3)} at ring ${worstRock.t} [${worstRock.p?.toArray().map((v) => v.toFixed(2)).join(', ')}] — bore invariant is ${BORE_R}`);
