#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-scenery-cost.mjs — MESHES AND TRIANGLES PER SCENERY PIECE.
//
// A scenery piece's cost is multiplied by however many a park places, and the
// heavily-placed ones (planterBox / topiarySpiral as set-piece "planters",
// picnicTable and brickWall as dressing) are scattered dozens of times. One
// mesh = one draw call, so a piece that grows by 40 loose primitives can add
// hundreds of draws to a park. This lists every piece by mesh count so the
// detailing work can be spent where it does not multiply.
//
// The Stage's whole-scene budget is ~3000 draws / 2.5M triangles (SETUP.md §13).
//
//   node probe-scenery-cost.mjs [--json]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, '_scost-entry.ts');
fs.writeFileSync(
  entry,
  `export { buildSceneryAnimated, SCENERY_NAMES } from ${JSON.stringify(path.join(REPO, 'components/SceneryPack/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_scost-bundle.mjs');
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

const rows = [];
for (const name of K.SCENERY_NAMES) {
  const quiet = console.warn;
  console.warn = () => {};
  const built = K.buildSceneryAnimated(T, name, { seed: 3 });
  console.warn = quiet;
  let meshes = 0;
  let tris = 0;
  let lights = 0;
  built.group.traverse((o) => {
    if (o.isMesh) {
      meshes += 1;
      const g = o.geometry;
      const idx = g.index ? g.index.count : g.getAttribute('position')?.count ?? 0;
      tris += idx / 3;
    }
    if (o.isPointLight || o.isSpotLight) lights += 1;
  });
  rows.push({ name, meshes, tris: Math.round(tris), lights });
}
rows.sort((a, b) => b.meshes - a.meshes);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('\n  piece                 meshes    tris  lights');
  rows.forEach((r) =>
    console.log(`  ${r.name.padEnd(20)} ${String(r.meshes).padStart(6)} ${String(r.tris).padStart(7)} ${String(r.lights).padStart(7)}`),
  );
  const tot = rows.reduce((s, r) => s + r.meshes, 0);
  console.log(`\n  ${rows.length} pieces · ${tot} meshes total · ${Math.round(rows.reduce((s, r) => s + r.tris, 0))} triangles`);
  console.log('  Stage whole-scene budget: ~3000 draws / 2.5M tris — a piece placed 20x at 40 meshes is 800 draws on its own.\n');
}
