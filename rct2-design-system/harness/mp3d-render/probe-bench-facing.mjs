#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-bench-facing.mjs — do the verge benches FACE the path they line?
//
// The complaint was "benches are always faced away from the paths". A bench is
// authored looking down its own local −z (`putBench` in PathNetwork/build.ts:
// the backrest is at +z, the open seat side at −z), so the test is purely
// geometric: take each published seat's `yaw` (which IS the direction a guest
// sitting on it looks), and check it points back at the nearest path
// centreline rather than away from it.
//
// It CAN fail: flip the sign back in build.ts's `put(...)` call and every
// bench reports FACING AWAY.
//
//   node probe-bench-facing.mjs
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, '_bench-entry.ts');
fs.writeFileSync(
  entry,
  `export { buildPathNetwork } from ${JSON.stringify(path.join(REPO, 'components/PathNetwork/build.ts'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_bench-bundle.mjs');
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
// the same headless canvas shim probe-monorail-motion.mjs uses — Stage bakes
// its textures on a 2D canvas at module scope
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy({ measureText: () => ({ width: 0 }) }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}),
  set: () => true,
});
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }),
};
const { buildPathNetwork, THREE } = await import(pathToFileURL(bundlePath).href);

// a plain plus-shaped lattice on the 1.2 grid — one street per cardinal, so
// every bench orientation (both verges of a N/S street and of an E/W one) is
// exercised
const NODES = [
  [0, 0],
  [12, 0],
  [-12, 0],
  [0, 12],
  [0, -12],
];
const EDGES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
];
const net = buildPathNetwork(THREE, { nodes: NODES, edges: EDGES }, { grid: true, groundAt: () => 0 });
const benches = net.benches ?? [];

/** distance from (x, z) to the nearest street CENTRELINE, and the unit vector
 *  pointing from the bench back at it */
const toPath = (x, z) => {
  let best = Infinity;
  let bx = 0;
  let bz = 0;
  for (const [ai, bi] of EDGES) {
    const [ax, az] = NODES[ai];
    const [ex, ez] = NODES[bi];
    const vx = ex - ax;
    const vz = ez - az;
    const L2 = vx * vx + vz * vz;
    const u = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
    const px = ax + vx * u;
    const pz = az + vz * u;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      bx = px - x;
      bz = pz - z;
    }
  }
  const m = Math.hypot(bx, bz) || 1;
  return { d: best, ux: bx / m, uz: bz / m };
};

let facing = 0;
let away = 0;
let worstDot = 1;
const samples = [];
for (const b of benches) {
  const t = toPath(b.x, b.z);
  // the seat yaw is a heading: direction = (sin yaw, cos yaw)
  const fx = Math.sin(b.yaw);
  const fz = Math.cos(b.yaw);
  const dot = fx * t.ux + fz * t.uz; // +1 = looking straight at the path
  if (dot > 0.5) facing += 1;
  else away += 1;
  if (dot < worstDot) worstDot = dot;
  if (samples.length < 6) samples.push({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(3), dot: +dot.toFixed(3), off: +t.d.toFixed(2) });
}

console.log(`\n${benches.length} bench SEATS published by buildPathNetwork (2 per bench)\n`);
console.log('sample seats (dot = how squarely the seat looks at the path; +1 at it, −1 away):');
samples.forEach((s) => console.log(`   [${s.x}, ${s.z}] seat y ${s.y}  off-centreline ${s.off}  dot ${s.dot}`));
console.log(`\nfacing the path: ${facing}   facing AWAY: ${away}   worst dot ${worstDot.toFixed(3)}`);
// seats sit ~0.94 off the centreline on a 1.2-wide street: clear of the slab,
// on the verge, not out in the field
const offs = benches.map((b) => toPath(b.x, b.z).d);
if (offs.length) console.log(`off-centreline: min ${Math.min(...offs).toFixed(2)}  max ${Math.max(...offs).toFixed(2)}`);
const ok = benches.length > 0 && away === 0 && worstDot > 0.9;
console.log(`\nVERDICT  ${ok ? 'PASS' : 'FAIL'} — ${away} of ${benches.length} seats face away from the path (want 0)\n`);
process.exit(ok ? 0 : 1);
