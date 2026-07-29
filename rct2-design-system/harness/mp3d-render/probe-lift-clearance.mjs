#!/usr/bin/env node
// LIFT-CHAIN CLEARANCE SWEEP — buildLiftChain vs every profile's own vehicle.
// `OLD=1 node probe-lift-clearance.mjs` measures the pre-mechanisation smooth
// tube instead, for the before/after table in SplineCoaster/Context.md.
// PER-PROFILE LIFT CLEARANCE SWEEP.
// Builds the real buildLiftChain assembly on a synthetic straight climb and
// the real vehicle at its runner's own wheelOffset, then measures, in the
// frame cross-section (x = side, y = up), (a) the vertical gap in every x band
// where both exist and (b) the 2D min distance between the two surfaces.
import { build } from 'esbuild';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const ep = path.join(HARNESS, 'out', '_clr-entry.ts');
fs.writeFileSync(ep, `
export { buildLiftChain } from ${JSON.stringify(path.join(REPO, 'components/SplineCoaster/index.tsx'))};
export { buildCoasterCar } from ${JSON.stringify(path.join(REPO, 'components/CoasterCar/index.tsx'))};
export { buildMiniLog, buildMiniSled } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/index.tsx'))};
export * as THREE from 'three';
`);
const out = path.join(HARNESS, 'out', '_clr-bundle.mjs');
await build({ entryPoints: [ep], bundle: true, outfile: out, format: 'esm', jsx: 'automatic', platform: 'node',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], external: ['react', 'react-dom', 'react/jsx-runtime'], target: 'node20', logLevel: 'error' });
const noop = () => {};
const ctx2d = new Proxy({}, { get: (_, k) => {
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
  if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
  if (k === 'measureText') return () => ({ width: 10 });
  return typeof k === 'string' ? noop : undefined; }, set: () => true });
globalThis.document = { createElement: () => ({ width: 64, height: 64, getContext: () => ctx2d, style: {}, toDataURL: () => '' }) };
globalThis.window = globalThis; globalThis.self = globalThis;
const M = await import(pathToFileURL(out).href);
const T = M.THREE;

// synthetic straight climb: 40 frames, 0.35 u apart, rising 25°
const frames = [];
const ang = 25 * Math.PI / 180;
for (let i = 0; i < 40; i++) {
  const s = i * 0.35;
  frames.push({ p: new T.Vector3(0, s * Math.sin(ang), s * Math.cos(ang)),
    fwd: new T.Vector3(0, Math.sin(ang), Math.cos(ang)), up: new T.Vector3(0, Math.cos(ang), -Math.sin(ang)), side: new T.Vector3(1, 0, 0) });
}
// FRAME coords: x = side, y = up, z = along. Convert a world point on this
// synthetic ramp back to (x, y).
const toFrame = (v) => [v.x, v.y * Math.cos(ang) - v.z * Math.sin(ang)];
function cloud(g, conv, yOff = 0) {
  const pts = []; const v = new T.Vector3();
  g.updateWorldMatrix(true, true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    const pa = o.geometry.getAttribute('position');
    const ia = o.geometry.getIndex();
    const push = (a) => { v.fromBufferAttribute(pa, a).applyMatrix4(o.matrixWorld); const [x, y] = conv(v); pts.push([x, y + yOff]); };
    // vertices + triangle edge midpoints (denser surface sampling)
    for (let i = 0; i < pa.count; i++) push(i);
    if (ia) for (let i = 0; i < ia.count; i += 3) {
      const a = ia.getX(i), b = ia.getX(i + 1), c = ia.getX(i + 2);
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const va = new T.Vector3().fromBufferAttribute(pa, p).applyMatrix4(o.matrixWorld);
        const vb = new T.Vector3().fromBufferAttribute(pa, q).applyMatrix4(o.matrixWorld);
        for (let f = 0.25; f < 1; f += 0.25) { const m2 = va.clone().lerp(vb, f); const [x, y] = conv(m2); pts.push([x, y + yOff]); }
      }
    }
  });
  return pts;
}
const CFG = {
  coaster: { lift: { sides: [0], h: 0.02, r: 0.035, rackX: 0.155, sprocketR: 0.075, motorX: 0.62, catwalkX: 0.7 }, veh: () => M.buildCoasterCar(T, 'front'), yOff: 0.195, name: 'CoasterCar' },
  flume:   { lift: { sides: [-0.3, 0.3], h: -0.02, r: 0.02, sprocketR: 0.055, motorX: 0.66, catwalkX: 0.72 }, veh: () => M.buildMiniLog(T), yOff: 0.16, name: 'MiniLog' },
  bobsled: { lift: { sides: [-0.3, 0.3], h: -0.03, r: 0.02, rackX: 0.15, sprocketR: 0.055, motorX: 0.95, catwalkX: 0.98 }, veh: () => M.buildMiniSled(T), yOff: 0.2, name: 'MiniSled' },
  rapids:  { lift: { sides: [0], h: -0.075, r: 0.033, troughH: 0.05, sprocketR: 0.032, motorX: 1.06, catwalkX: 1.1 }, veh: null, yOff: -0.075, name: 'Raft (torus 0.37/0.085 + deck)' },
};
// the OLD lift: one smooth TubeGeometry per strand, exactly as it was
function oldLift(cfg) {
  const g = new T.Group();
  for (const x of cfg.sides) {
    const pts = frames.map((f) => f.p.clone().addScaledVector(f.side, x).addScaledVector(f.up, cfg.h));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, false), 78, cfg.r, 6, false), new T.MeshStandardMaterial()));
  }
  return g;
}
for (const [prof, c] of Object.entries(CFG)) {
  const g = process.env.OLD ? oldLift(c.lift) : M.buildLiftChain(T, frames, { liftStart: 0, liftLen: 39, ...c.lift });
  let draws = 0, tris = 0;
  g.traverse((o) => { if (o.isMesh) { draws++; const ia = o.geometry.getIndex(); tris += (ia ? ia.count : o.geometry.getAttribute('position').count) / 3; } });
  const L = cloud(g, toFrame);
  let V;
  if (c.veh) V = cloud(c.veh(), (v) => [v.x, v.y], c.yOff);
  else {
    // the rapids raft, rebuilt from RiverRapids' own construction
    V = [];
    for (let a = 0; a < 64; a++) for (let b = 0; b < 24; b++) {
      const th = (b / 24) * Math.PI * 2;
      const rr = 0.37 + 0.085 * Math.cos(th);
      const yy = 0.085 + 0.085 * Math.sin(th);
      V.push([rr * Math.cos((a / 64) * Math.PI * 2), yy + c.yOff]);
    }
    for (let a = 0; a < 64; a++) { const x = -0.37 + (a / 63) * 0.74; V.push([x, 0.11 + c.yOff]); V.push([x, 0.20 + c.yOff]); }
  }
  // vertical gap per 0.01 x-band + 2D min surface distance
  const bin = (x) => Math.round(x / 0.01);
  const liftMax = new Map();
  for (const [x, y] of L) { const b = bin(x); if (!liftMax.has(b) || y > liftMax.get(b)) liftMax.set(b, y); }
  const vehMin = new Map();
  for (const [x, y] of V) { const b = bin(x); if (!vehMin.has(b) || y < vehMin.get(b)) vehMin.set(b, y); }
  let vGap = Infinity, vAt = 0;
  for (const [b, ymin] of vehMin) if (liftMax.has(b)) { const d = ymin - liftMax.get(b); if (d < vGap) { vGap = d; vAt = b * 0.01; } }
  // dedupe both clouds onto a 4 mm grid, then a grid-bucket nearest search
  const dedupe = (pts) => { const m = new Map(); for (const [x, y] of pts) m.set(`${Math.round(x / 0.004)},${Math.round(y / 0.004)}`, [x, y]); return [...m.values()]; };
  const Ld = dedupe(L), Vd = dedupe(V);
  const CELL = 0.05; const grid = new Map();
  for (const p of Ld) { const k = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(p); }
  let d2 = Infinity, at2 = ['-', '-', '-', '-'];
  for (const [x, y] of Vd) {
    for (let R = 1; R <= 40; R++) {
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      let found = false;
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== R) continue;
        const c = grid.get(`${gx + i},${gy + j}`); if (!c) continue;
        for (const [lx, ly] of c) { const d = Math.hypot(x - lx, y - ly); found = true; if (d < d2) { d2 = d; at2 = [lx.toFixed(3), ly.toFixed(3), x.toFixed(3), y.toFixed(3)]; } }
      }
      if (found && (R - 1) * CELL > d2) break;
      if (R * CELL > d2 + CELL * 2 && d2 < Infinity) break;
    }
  }
  console.log(`${prof.padEnd(8)} ${c.name.padEnd(34)} vertical gap ${vGap === Infinity ? '  n/a (no x overlap)' : vGap.toFixed(3) + ' at x=' + vAt.toFixed(2)}   2D surface gap ${d2.toFixed(3)} (lift ${at2[0]},${at2[1]} / vehicle ${at2[2]},${at2[3]})   ${draws} draws, ${Math.round(tris)} tris`);
}
