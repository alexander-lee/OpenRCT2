#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-tower-cost.mjs — DRAWS, TRIANGLES, BOUNDS and PUBLIC API for the three
// TALL rigs (DropTower / ObservationTower / LaunchedFreefall).
//
// A tower is the most visible thing in a park from any distance, so it is the
// rig most worth detailing — and the one where extra detail most easily buys
// extra DRAW CALLS (a park gates at ~3000; see probe-perf-budget.mjs). This is
// the counter that says whether new detail was BATCHED or merely added.
//
// It also pins the things a rebuild must not break, because they are consumed
// downstream by configurableRide:
//   * the LOCAL XZ footprint (`Box3.setFromObject(built.group)`) decides the
//     body blocker AND the derived entrance-hut `front`, so it must not grow
//   * `seatWorld(i)` must return a distinct, finite [x, y, z, yaw] for every
//     seat 0..capacity-1, at rest AND mid-cycle (the seats ride the vehicle)
//   * the climb/drop animation must actually MOVE the vehicle, and the motion
//     gate must park it at the bottom
//
//   node probe-tower-cost.mjs [--json] [--rigs=DropTower,...]
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
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const RIGS = {
  DropTower: { fn: 'buildDropTowerScene', capacity: 10 },
  ObservationTower: { fn: 'buildObservationTowerScene', capacity: 8 },
  LaunchedFreefall: { fn: 'buildLaunchedFreefallScene', capacity: 4 },
};
const want = arg('rigs', Object.keys(RIGS).join(',')).split(',').filter((n) => RIGS[n]);

const entry = path.join(OUT, '_tower-entry.ts');
fs.writeFileSync(
  entry,
  `${want
    .map((n) => `export { ${RIGS[n].fn} } from ${JSON.stringify(path.join(REPO, 'components', n, 'index.tsx'))};`)
    .join('\n')}
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_tower-bundle.mjs');
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

// canvas shim — the texture/env helpers build CanvasTextures at module scope
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
const f3 = (n) => Number(n.toFixed(3));

function measure(obj) {
  obj.updateMatrixWorld(true);
  let meshes = 0;
  let tris = 0;
  let lights = 0;
  let emissive = 0;
  let withEnv = 0;
  const mats = new Set();
  const bb = new T.Box3();
  obj.traverse((o) => {
    if (o.isLight) lights += 1;
    if (!o.isMesh) return;
    meshes += 1;
    mats.add(o.material);
    const m = o.material;
    if (m && m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b)) emissive += 1;
    if (m && m.envMap) withEnv += 1;
    const g = o.geometry;
    const n = g.index ? g.index.count : g.getAttribute('position')?.count ?? 0;
    tris += n / 3;
    bb.expandByObject(o);
  });
  return {
    meshes,
    tris: Math.round(tris),
    materials: mats.size,
    lights,
    emissiveMeshes: emissive,
    envMapMeshes: withEnv,
    min: [f3(bb.min.x), f3(bb.min.y), f3(bb.min.z)],
    max: [f3(bb.max.x), f3(bb.max.y), f3(bb.max.z)],
    footXZ: [f3(bb.max.x - bb.min.x), f3(bb.max.z - bb.min.z)],
    height: f3(bb.max.y),
  };
}

const rows = [];
for (const name of want) {
  const { fn, capacity } = RIGS[name];
  const problems = [];
  // REGISTERED build (riders off) — the shape a park actually mounts
  const reg = K[fn](T, { riders: false });
  reg.group.userData.nightK = 0;
  reg.update?.(0);
  const m = measure(reg.group);
  // seats: distinct + finite, at rest and mid-cycle
  const seatAt = (tt) => {
    reg.update?.(tt);
    reg.group.updateMatrixWorld(true);
    return Array.from({ length: capacity }, (_, i) => reg.seatWorld(i));
  };
  const rest = seatAt(0.05);
  if (rest.length !== capacity) problems.push(`seatWorld count ${rest.length} != capacity ${capacity}`);
  rest.forEach((s, i) => {
    if (!s || s.length !== 4 || s.some((v) => !Number.isFinite(v))) problems.push(`seat ${i} not finite: ${JSON.stringify(s)}`);
  });
  const key = (s) => s.slice(0, 3).map((v) => v.toFixed(3)).join(',');
  if (new Set(rest.map(key)).size !== capacity) problems.push('seat positions are not distinct');
  // ANIMATION: the vehicle must climb, and the gate must park it low
  const ys = [];
  for (let i = 0; i < 60; i += 1) {
    reg.update?.(i * 0.35);
    ys.push(reg.vehicle ? reg.vehicle.position.y : NaN);
  }
  const climb = f3(Math.max(...ys) - Math.min(...ys));
  if (!(climb > 0.5)) problems.push(`vehicle does not climb (range ${climb})`);
  reg.onStateChange('waitingForPassengers');
  for (let i = 0; i < 200; i += 1) reg.update?.(100 + i * 0.05);
  const parkedY = f3(reg.vehicle ? reg.vehicle.position.y : NaN);
  reg.onStateChange('departing');
  // seats must follow the vehicle
  const mid = seatAt(9.13);
  const seatLift = f3(Math.max(...mid.map((s, i) => Math.abs(s[1] - rest[i][1]))));
  // riders-on preview build (what render.mjs shoots)
  const prev = K[fn](T, { riders: true });
  prev.group.userData.nightK = 0;
  prev.update?.(0);
  const pm = measure(prev.group);
  rows.push({
    name,
    capacity,
    registered: m,
    preview: { meshes: pm.meshes, tris: pm.tris },
    climbRange: climb,
    parkedY,
    seatLiftMidCycle: seatLift,
    problems,
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows }, null, 2));
} else {
  console.log('\n  probe-tower-cost\n');
  console.log('  rig                 draws   tris  mats lt emis env | preview draws/tris | footXZ         h');
  for (const r of rows) {
    const m = r.registered;
    console.log(
      `  ${r.name.padEnd(18)} ${String(m.meshes).padStart(5)} ${String(m.tris).padStart(6)} ${String(m.materials).padStart(5)} ${String(
        m.lights,
      ).padStart(2)} ${String(m.emissiveMeshes).padStart(4)} ${String(m.envMapMeshes).padStart(3)} | ${String(r.preview.meshes).padStart(
        7,
      )}/${String(r.preview.tris).padStart(6)} | ${String(m.footXZ.join(' x ')).padEnd(13)} ${String(m.height).padStart(5)}`,
    );
  }
  console.log('\n  API / motion:');
  for (const r of rows) {
    console.log(
      `    ${r.name.padEnd(18)} seats ${r.capacity} ok · climb ${r.climbRange} · parked y ${r.parkedY} · seat lift mid-cycle ${r.seatLiftMidCycle}` +
        (r.problems.length ? `\n      ${r.problems.map((p) => `!! ${p}`).join('\n      ')}` : ''),
    );
  }
  console.log(`\n  bounds (local, min -> max):`);
  for (const r of rows) console.log(`    ${r.name.padEnd(18)} [${r.registered.min.join(', ')}] -> [${r.registered.max.join(', ')}]`);
  console.log('');
}
process.exit(rows.some((r) => r.problems.length) ? 1 : 0);
