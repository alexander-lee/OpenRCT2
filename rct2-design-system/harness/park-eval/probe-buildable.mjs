#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-buildable.mjs — HOW MUCH of a plot can a park actually be BUILT on,
// and WHERE is it?
//
// WHY. `rules/park-generation.md` §0.3 tells the composing agent to check
// "at least 3 of the 4 quadrants hold something built". That check was written
// for a 48 plot, where a quadrant is 24 × 24 and one district fills it. At the
// wave-8 default of 192 a quadrant is 96 × 96 and the composition itself
// (12-19% water, 4-9 mountain ranges, the peak keep-out rule, the treeline)
// takes whole quadrants off the table — so the check can be simultaneously
// PASSED by three token benches and IMPOSSIBLE for a real layout. It has to be
// re-derived from what the composition actually leaves open.
//
// WHAT IT MEASURES, per (seed, climate), off the REAL built heightfield (same
// construction as seed-table.mjs, so the numbers agree with §1's table):
//   BUILDABLE  = dry (h > waterLevel + 0.05, the validatePark wet-pad guard)
//              AND flat enough (`terrainLint.flatEnough` — the hill-flank FAIL)
//              AND outside every peak's keep-out (peak contribution ≤ 0.75,
//                  the `footprint on a hill flank` FAIL)
//   then, of that, the part inside the gate-reachable band (see below).
//
// GATE REACH. `probe-sim-reach.mjs` measures the sim bound: the FIRST ride's
// queue tail must be within ~20 u of the gate to complete a cycle in the 60
// sim-s window, and past ~75 u guests give up and leave before riding at all.
// So this probe also reports the buildable area within 20 / 48 / 75 u of the
// gate cell, and the quadrant occupancy the old rule asks about.
//
// Usage:
//   node probe-buildable.mjs                     # the 16 published §1 rows at 192
//   node probe-buildable.mjs --size=48           # the same rows at the old default
//   node probe-buildable.mjs --seeds=1 --climates=temperate --json
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (buildTerrain paints canvas textures) ----------------
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

const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const flag = (n) => process.argv.includes(`--${n}`);
const SIZE = Number(arg('size', '192'));

// the 16 PUBLISHED §1 rows (seed-table.mjs's pinned set)
const PUBLISHED = [
  [1, 'temperate'], [31, 'temperate'], [83, 'temperate'], [71, 'temperate'],
  [3, 'desert'], [19, 'desert'], [37, 'desert'], [91, 'desert'],
  [5, 'alpine'], [8, 'alpine'], [17, 'alpine'], [42, 'alpine'],
  [7, 'coastal'], [23, 'coastal'], [73, 'coastal'], [53, 'coastal'],
];
const seedsArg = arg('seeds', '');
const climArg = arg('climates', '');
const ROWS = PUBLISHED.filter(
  ([s, c]) => (!seedsArg || seedsArg.split(',').map(Number).includes(s)) && (!climArg || climArg.split(',').includes(c)),
);

// ---- bundle composition + terrain ------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_buildable.ts');
fs.writeFileSync(
  ep,
  `
import { parkComposition, terrainLint, WATER_LEVEL } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
import { buildTerrain } from ${JSON.stringify(path.join(REPO, 'components/TerrainKit'))};
export { parkComposition, buildTerrain, terrainLint, WATER_LEVEL };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_buildable.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const mp = await import(bundlePath);
const WL = mp.WATER_LEVEL;

// mirror <Terrain>'s segment rule so the sampled ground IS the built ground
const segOf = (sz) => Math.min(Math.round(sz * 6.9), Math.max(220, Math.round(sz / 0.45)));

/** validatePark's hill-flank rule: a peak's smoothstep contribution > 0.75 fails */
const peakBump = (peaks, x, z) => {
  let m = 0;
  for (const p of peaks) {
    const d = Math.hypot(x - p.c[0], z - p.c[1]);
    if (d >= p.r) continue;
    const k = 1 - d / p.r;
    m = Math.max(m, p.h * k * k * (3 - 2 * k));
  }
  return m;
};

function probe(seed, climate) {
  const S = SIZE;
  const half = S / 2;
  const comp = mp.parkComposition(THREE, seed, S, climate);
  const lf = comp.landform;
  const terrain = mp.buildTerrain(THREE, {
    size: S, seg: segOf(S), seed: comp.terrainSeed,
    amplitude: lf.amplitude, scale: lf.scale, octaves: lf.octaves, roughness: lf.roughness,
    reliefBias: lf.reliefBias, flatSpots: lf.flatSpots,
    waterLevel: WL,
    peaks: [...comp.peaks, ...(comp.clampPeaks ?? [])],
    basins: [...comp.basins, ...(comp.clampBasins ?? [])],
    firmShore: true, edgeSkirt: false,
  });
  const h = terrain.heightAt;
  const lint = mp.terrainLint(h, S, WL);
  const peaks = [...comp.peaks, ...(comp.clampPeaks ?? [])].map((p) => ({ c: p.c ?? [p.x, p.z], h: p.h ?? p.height, r: p.r ?? p.radius }));
  const gateZ = 1.2 * Math.round((half - 0.8) / 1.2);

  // sample on the 1.2 path lattice — a park can only be built on lattice cells
  const g = 1.2;
  const n = Math.floor((S - 2.4) / g);
  let total = 0;
  const buildable = [];
  const quad = [0, 0, 0, 0]; // ++, -+, --, +-
  const reach = { r20: 0, r48: 0, r75: 0, deepest: null };
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (let i = 0; i <= n; i += 1) {
    const x = -half + 1.2 + i * g;
    for (let j = 0; j <= n; j += 1) {
      const z = -half + 1.2 + j * g;
      total += 1;
      if (h(x, z) <= WL + 0.05) continue;            // wet-pad guard
      if (!lint.flatEnough(x, z)) continue;          // hill-flank FAIL
      if (peakBump(peaks, x, z) > 0.75) continue;    // peak keep-out
      buildable.push([x, z]);
      quad[x >= 0 ? (z >= 0 ? 0 : 3) : (z >= 0 ? 1 : 2)] += 1;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (z < bz0) bz0 = z; if (z > bz1) bz1 = z;
      const d = Math.hypot(x - 0, z - gateZ);
      if (d <= 20) reach.r20 += 1;
      if (d <= 48) reach.r48 += 1;
      if (d <= 75) reach.r75 += 1;
      if (reach.deepest === null || z < reach.deepest) reach.deepest = z;
    }
  }
  terrain.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  const cell = g * g;
  const qTotal = total / 4;
  return {
    seed, climate, size: S, gateZ,
    plotU2: Math.round(S * S),
    buildableU2: Math.round(buildable.length * cell),
    buildablePct: +((buildable.length / total) * 100).toFixed(1),
    bbox: buildable.length ? [+bx0.toFixed(1), +bz0.toFixed(1), +bx1.toFixed(1), +bz1.toFixed(1)] : null,
    // per-quadrant buildable FRACTION OF THAT QUADRANT — the old rule's basis
    quadPct: quad.map((q) => +((q / qTotal) * 100).toFixed(1)),
    quadsOver5pct: quad.filter((q) => q / qTotal > 0.05).length,
    withinU2: {
      r20: Math.round(reach.r20 * cell),
      r48: Math.round(reach.r48 * cell),
      r75: Math.round(reach.r75 * cell),
    },
    deepestBuildableZ: reach.deepest === null ? null : +reach.deepest.toFixed(1),
    reachDepth: reach.deepest === null ? null : +(gateZ - reach.deepest).toFixed(1),
  };
}

const rows = ROWS.map(([s, c]) => probe(s, c));
if (flag('json')) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  const half = SIZE / 2;
  console.log(
    `buildable-land probe — size ${SIZE} (plot ${SIZE * SIZE} u², quadrant ${half}×${half}, gate cell z ${rows[0]?.gateZ})\n` +
      `BUILDABLE = dry (h > WL+0.05) AND flatEnough AND peak bump ≤ 0.75, sampled on the 1.2 lattice\n`,
  );
  console.log('  seed climate    | buildable | quadrant buildable %        | q>5% | ≤20u gate | ≤48u  | ≤75u   | depth');
  console.log('  ---------------+-----------+-----------------------------+------+-----------+-------+--------+------');
  for (const r of rows)
    console.log(
      `  ${String(r.seed).padStart(4)} ${r.climate.padEnd(10)} | ${String(r.buildablePct + '%').padStart(6)} ${String(r.buildableU2).padStart(6)} | ` +
        `${r.quadPct.map((p) => String(p).padStart(5)).join(' ')} | ${String(r.quadsOver5pct).padStart(4)} | ` +
        `${String(r.withinU2.r20).padStart(9)} | ${String(r.withinU2.r48).padStart(5)} | ${String(r.withinU2.r75).padStart(6)} | ${String(r.reachDepth).padStart(5)}`,
    );
  const q = (a, p) => { a = [...a].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
  const pcts = rows.map((r) => r.buildablePct);
  console.log(
    `\n  buildable fraction of the plot: min ${Math.min(...pcts)}%  p50 ${q(pcts, 0.5)}%  max ${Math.max(...pcts)}%`,
  );
  const q5 = rows.map((r) => r.quadsOver5pct);
  console.log(`  quadrants with >5% of themselves buildable: ${q5.join(', ')} (rows with all 4: ${q5.filter((v) => v === 4).length}/${rows.length}, with ≤2: ${q5.filter((v) => v <= 2).length}/${rows.length})`);
  const r20 = rows.map((r) => r.withinU2.r20);
  const r48 = rows.map((r) => r.withinU2.r48);
  const r75 = rows.map((r) => r.withinU2.r75);
  console.log(`  buildable u² within  20 u of the gate: min ${Math.min(...r20)}  p50 ${q(r20, 0.5)}  max ${Math.max(...r20)}   (a full 20-u disc is ${Math.round(Math.PI * 400)} u²)`);
  console.log(`  buildable u² within  48 u of the gate: min ${Math.min(...r48)}  p50 ${q(r48, 0.5)}  max ${Math.max(...r48)}`);
  console.log(`  buildable u² within  75 u of the gate: min ${Math.min(...r75)}  p50 ${q(r75, 0.5)}  max ${Math.max(...r75)}`);
  const dep = rows.map((r) => r.reachDepth);
  console.log(`  deepest buildable cell, measured from the gate: min ${Math.min(...dep)} u  p50 ${q(dep, 0.5)} u  max ${Math.max(...dep)} u`);
}
