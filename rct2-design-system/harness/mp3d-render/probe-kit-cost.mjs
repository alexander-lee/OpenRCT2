#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-kit-cost.mjs — MESHES, TRIANGLES and BOUNDS per Kit asset.
//
// Kit's `tree` is the most-placed asset in the system (ParkBuilder/dressing
// scatters it by the hundred, Boulevard lines every street with it,
// CoasterBuilder wraps every layout in it), so one extra loose primitive there
// is one extra DRAW CALL per instance. Detailing all 20 SceneryPack pieces with
// loose primitives once took a measured park from 1148 to 3374 draws, past the
// Stage's ~3000 budget. This is the counter that says whether the detail was
// batched or just added.
//
// It also reports the exact world-space BOUNDS of every asset. `tree`, `bench`
// and `bin` are positioned by downstream layout code (dressing.ts sinks trees
// 0.07 into the grade and reserves a 0.62 radius; SetPieceKit seats kitBench /
// kitBin on paving), so their footprint, height and ground anchor MUST NOT
// MOVE. `--json` + `diff` on two runs is the proof.
//
//   node probe-kit-cost.mjs [--views=kit-views] [--json]
//   node probe-kit-cost.mjs --views=kit-views-before --json > out/kit-cost-before.json
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
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, `_kcost-entry-${VIEWS}.ts`);
fs.writeFileSync(
  entry,
  `export * from ${JSON.stringify(path.join(HARNESS, `${VIEWS}.ts`))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, `_kcost-bundle-${VIEWS}.mjs`);
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
  createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }),
};
const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

const f3 = (n) => Number(n.toFixed(3));
function measure(obj) {
  obj.updateMatrixWorld(true);
  let meshes = 0;
  let tris = 0;
  let mats = new Set();
  const bb = new T.Box3();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    mats.add(o.material);
    const g = o.geometry;
    const n = g.index ? g.index.count : g.getAttribute('position')?.count ?? 0;
    tris += n / 3;
    g.computeBoundingBox();
    bb.expandByObject(o);
  });
  return {
    meshes,
    tris: Math.round(tris),
    materials: mats.size,
    min: [f3(bb.min.x), f3(bb.min.y), f3(bb.min.z)],
    max: [f3(bb.max.x), f3(bb.max.y), f3(bb.max.z)],
  };
}

const rows = [];
for (const name of K.KIT_VIEWS) {
  const built = K[name](T);
  built.update?.(3.7); // never grade the rest pose
  rows.push({ name, ...measure(built.group) });
}
const bounds = K.BOUNDS_CASES.map(({ name, build: b }) => {
  const o = b(T);
  const m = measure(o);
  return { name, min: m.min, max: m.max, meshes: m.meshes, tris: m.tris };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ views: VIEWS, rows, bounds }, null, 2));
} else {
  console.log(`\n  probe-kit-cost · ${VIEWS}\n`);
  console.log('  asset               meshes    tris  mats   bounds (min → max)');
  rows.forEach((r) =>
    console.log(
      `  ${r.name.padEnd(18)} ${String(r.meshes).padStart(6)} ${String(r.tris).padStart(7)} ${String(r.materials).padStart(5)}   [${r.min.join(', ')}] → [${r.max.join(', ')}]`,
    ),
  );
  console.log(`\n  ${rows.length} assets · ${rows.reduce((s, r) => s + r.meshes, 0)} meshes · ${rows.reduce((s, r) => s + r.tris, 0)} triangles`);
  console.log('\n  DOWNSTREAM-CONSUMED bounds (must be byte-identical across a change):');
  bounds.forEach((b) => console.log(`    ${b.name.padEnd(18)} [${b.min.join(', ')}] → [${b.max.join(', ')}]  ${b.meshes}m ${b.tris}t`));
  console.log('');
}
