#!/usr/bin/env node
// parkComposition MEMO-CACHE probe.
//
// The cache exists because parkComposition is 601 ms — the largest single cost
// in a park's initial load — and <Terrain> re-runs it on every prop change,
// StrictMode double-invoke and editor remount. It is only SAFE if a cache hit
// cannot be contaminated by a previous caller, and the composition IS mutated
// after creation (`reclampTerrain` pushes into clampPeaks/clampBasins). So:
//
//   1. identical inputs give a DEEP-EQUAL composition (determinism preserved)
//   2. mutating the first result does NOT leak into the second (isolation)
//   3. the second call is much faster than the first (the cache actually hits)
//   4. different inputs still compose differently (the key discriminates)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, '_comp-entry.ts');
fs.writeFileSync(
  entry,
  `export { parkComposition } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_comp-bundle.mjs');
await build({
  entryPoints: [entry], bundle: true, outfile: bundlePath, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], external: ['react', 'react-dom', 'react/jsx-runtime'],
  platform: 'node', target: 'node20', logLevel: 'error',
});
const grad = () => ({ addColorStop() {} });
const px = (n) => ({ data: new Uint8ClampedArray(Math.max(4, n)), width: 128, height: 128 });
const ctx2d = new Proxy(
  { measureText: () => ({ width: 0 }), getImageData: () => px(128 * 128 * 4), createImageData: () => px(128 * 128 * 4) },
  { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}), set: () => true },
);
globalThis.document = { createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }) };

const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;
const SEED = 7;
const SIZE = 96;

const quiet = console.warn;
console.warn = () => {};
const t1 = performance.now();
const a = K.parkComposition(T, SEED, SIZE);
const firstMs = performance.now() - t1;
const t2 = performance.now();
const b = K.parkComposition(T, SEED, SIZE);
const secondMs = performance.now() - t2;
console.warn = quiet;

const fp = (c) => JSON.stringify([c.terrainSeed, c.climate, c.waterCentre, c.basins, c.peaks, c.landform, c.clampPeaks ?? [], c.clampBasins ?? []]);
const fpA = fp(a);
console.log(`first call  ${firstMs.toFixed(0)} ms`);
console.log(`second call ${secondMs.toFixed(0)} ms   (${(firstMs / Math.max(secondMs, 0.01)).toFixed(0)}× faster)`);
console.log(`\n1. DETERMINISM  identical inputs → deep-equal composition: ${fpA === fp(b) ? 'PASS' : 'FAIL'}`);
console.log(`   distinct objects (not the same instance):                ${a !== b ? 'PASS' : 'FAIL'}`);

// 2. ISOLATION — mutate the first the way reclampTerrain does, then ask again
a.clampPeaks.push({ x: 1, z: 2, height: 9, radius: 3 });
a.basins.push({ x: 5, z: 5, radius: 2, depth: 1 });
const c = K.parkComposition(T, SEED, SIZE);
const leaked = fp(c) !== fpA;
console.log(`2. ISOLATION    a third call is unaffected by mutating the first: ${leaked ? 'FAIL — the mutation leaked' : 'PASS'}`);

// 4. the key discriminates
const d = K.parkComposition(T, SEED + 1, SIZE);
const e = K.parkComposition(T, SEED, SIZE + 32);
console.log(`4. KEYING       a different seed composes differently: ${fp(d) !== fpA ? 'PASS' : 'FAIL'}`);
console.log(`                a different size composes differently: ${fp(e) !== fpA ? 'PASS' : 'FAIL'}`);
// A hit is NOT free: isolation requires handing out a deep clone, and cloning a
// composition costs real time (measured ~117 ms against a ~480 ms compose). The
// gate is therefore "meaningfully faster", not "instant" — if a future change
// makes cloning as expensive as composing, the cache has stopped earning its
// keep and this should fail.
const speedup = firstMs / Math.max(secondMs, 0.01);
console.log(`3. CACHE HITS   hit is >=2.5x faster than a compose: ${speedup >= 2.5 ? `PASS (${speedup.toFixed(1)}x, ${secondMs.toFixed(0)} ms of clone)` : `FAIL (${speedup.toFixed(1)}x)`}`);
