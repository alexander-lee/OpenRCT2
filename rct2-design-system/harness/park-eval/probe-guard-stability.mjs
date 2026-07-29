#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-guard-stability.mjs — IS THIS PARK'S SEED GUARD-STABLE? (2026-07-25)
//
// `seed-table.mjs` measures `probes` UNGUARDED at ONE size, which answers a
// different question than the one an author actually has. This tool reads the
// park's OWN `<Terrain>` guards (it calls the default export as a function and
// walks the returned element tree — no browser, no DOM) and re-composes with
// them, so the numbers are the ones the park really ships.
//
// TWO THINGS THE §1 `probes` COLUMN DOES NOT TELL YOU, both measured here:
//   1. `probes` is SIZE-DEPENDENT. seed 7 temperate is `probes 18` at 128 and
//      `probes 1` at 48 — a size-48 park is NOT on the 128 row.
//   2. A high `probes` is NOT the same as guard fragility. The rejections may
//      all be the composition's own water/relief rules (seedcheck-s1-192:
//      guarded probes == unguarded probes == 17, same landform, 0 clamps).
//
// Per (seed, climate) it prints, at the park's own size:
//   unguarded probes  comp.report.probesTried with NO guards
//   GUARDED probes    …with the park's real keepDry/coasterPts (64 = every
//                     candidate x every terrain-noise seed was tried, so no
//                     candidate satisfies the guards outright and the guard
//                     CLAMP finishes the job — legal and deterministic)
//   viol              post-clamp violations (what validatePark receives)
//   clamps            clampPeaks + clampBasins (how hard guards fought land)
//   moved             of 12 REALISTIC one-cell keepDry edits (a prop 1.2 u off
//                     an already-guarded cell, 4 directions x 3 places in the
//                     list), how many change the landform identity
//                     (terrainSeed / archetype / water centroid). THIS is the
//                     "will a guard-list edit move my terrain" number, and it
//                     is what RUBRIC.md's baseline table reports as `mv`.
//
// usage:
//   node probe-guard-stability.mjs samples/arch-ref.tsx
//   node probe-guard-stability.mjs samples/arch-ref.tsx --seeds=7,31,83 --climates=temperate
//
// A park that passes NO `climate` composes `climateOf(seed)` — the tool prints
// the climate actually used, which is how `worlds-ref` was found to be DESERT.
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

import { HERE as PE, REPO as MP3D } from './paths.mjs';

// scratch entry/bundle files go to the gitignored out/
const HERE = path.join(PE, 'out');
fs.mkdirSync(HERE, { recursive: true });

const ctx2d = new Proxy({}, {
  get: (_t, k) =>
    k === 'canvas' ? { width: 8, height: 8 }
      : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
        : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4 * 64) })
          : () => {},
});
globalThis.document = {
  createElement: () => ({ width: 8, height: 8, getContext: () => ctx2d, toDataURL: () => '' }),
  createElementNS: () => ({ width: 8, height: 8, getContext: () => ctx2d }),
};
globalThis.window = globalThis;
globalThis.self = globalThis;

const componentAlias = {
  name: 'mp3d-components',
  setup(b) {
    b.onResolve({ filter: /(^|\/)components\// }, (args) => {
      if (args.path.startsWith('/')) return null;
      const rel = args.path.slice(args.path.indexOf('components/'));
      const base = path.join(MP3D, rel);
      for (const cand of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')])
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return { path: cand };
      return null;
    });
  },
};

const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const seedList = arg('seeds', '') ? arg('seeds', '').split(',').map(Number) : null;
const climList = arg('climates', '') ? arg('climates', '').split(',') : null;

// silence the design system's own composition console noise
const realWarn = console.warn, realInfo = console.info, realLog = console.log;
const quiet = (on) => {
  console.warn = on ? () => {} : realWarn;
  console.info = on ? () => {} : realInfo;
};
const say = (...a) => realLog(...a);

for (const f of files) {
  const abs = path.resolve(f);
  const name = path.basename(abs).replace(/\.tsx$/, '');
  const ep = path.join(HERE, `_stab-${name}.ts`);
  fs.writeFileSync(ep, `
export * as PARK from ${JSON.stringify(abs)};
export { parkComposition } from ${JSON.stringify(path.join(MP3D, 'components/ParkBuilder'))};
`);
  const res = await build({
    entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three', 'react', 'react-dom', 'react-dom/client'],
    nodePaths: [path.join(PE, 'node_modules')], target: 'node20', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [componentAlias],
  });
  const bp = path.join(HERE, `_stab-${name}.bundle.mjs`);
  fs.writeFileSync(bp, res.outputFiles[0].text);
  quiet(true);
  const mod = await import(bp);
  const C = mod.PARK.default;
  let tree;
  try { tree = C(); } catch (e) { quiet(false); say(`=== ${name}: cannot call component (${e.message})`); continue; }

  let park = null, terrain = null;
  const nameOf = (t) => (typeof t === 'function' ? (t.displayName || t.name) : typeof t === 'string' ? t : '');
  const walk = (el) => {
    if (!el || typeof el !== 'object') return;
    if (Array.isArray(el)) { el.forEach(walk); return; }
    if (!park && el.props && el.props.seed !== undefined && el.props.children) park = el.props;
    if (nameOf(el.type) === 'Terrain' && !terrain) terrain = el.props;
    if (el.props && el.props.children) walk(el.props.children);
    // a wrapper park (district-ref/demo-ref mount a previews component) — call
    // the child component to reach its own <Park>/<Terrain>
    if (!terrain && typeof el.type === 'function' && /Park$/.test(nameOf(el.type))) {
      try { walk(el.type(el.props ?? {})); } catch { /* needs hooks/DOM — skip */ }
    }
  };
  walk(tree);
  quiet(false);
  if (!terrain) { say(`=== ${name}: no <Terrain> found`); continue; }

  const ownSeed = terrain.seed ?? park?.seed;
  const size = terrain.size ?? park?.size ?? 128;
  const ownClim = terrain.climate ?? park?.climate;
  const keepDry = terrain.keepDry ?? [];
  const coasterPts = terrain.coasterPts;

  // REALISTIC perturbations: one more cell an author would plausibly add —
  // a tree/prop one cell (1.2 u) off an existing guarded cell, in each of the
  // four directions, taken from three different places in the list.
  const perts = [];
  for (const i of [0, Math.floor(keepDry.length / 2), keepDry.length - 1]) {
    const c = keepDry[i];
    if (!c) continue;
    for (const d of [[1.2, 0], [0, 1.2], [-1.2, 0], [0, -1.2]])
      perts.push([...keepDry, [c[0] + d[0], c[1] + d[1]]]);
  }

  const id = (c) => `${c.landform.style ?? '?'} ts ${c.terrainSeed} ${c.waterKind} (${c.waterCentre.map((v) => v.toFixed(1)).join(', ')})`;
  say(`\n=== ${name}  OWN: seed ${ownSeed} ${ownClim ?? '(auto)'} size ${size}  keepDry ${keepDry.length}${coasterPts ? ` + ${coasterPts.length} coasterPts` : ''}  perturbations ${perts.length}`);
  const seeds = seedList ?? [ownSeed];
  const clims = climList ?? [ownClim];
  for (const s of seeds) for (const cl of clims) {
    quiet(true);
    const un = mod.parkComposition(THREE, s, size, cl, {});
    const gu = mod.parkComposition(THREE, s, size, cl, { keepDry, coasterPts });
    let moved = 0;
    const base = id(gu);
    for (const p of perts) {
      const c = mod.parkComposition(THREE, s, size, cl, { keepDry: p, coasterPts });
      if (id(c) !== base) moved += 1;
    }
    quiet(false);
    say(`  seed ${String(s).padStart(3)} ${String(cl ?? un.climate).padEnd(9)} unguarded probes ${String(un.report.probesTried).padStart(2)} | GUARDED probes ${String(gu.report.probesTried).padStart(2)} viol ${gu.report.violations.length} clamps ${gu.clampPeaks.length}+${gu.clampBasins.length} | moved ${moved}/${perts.length} | ${base}`);
  }
}
