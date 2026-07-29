#!/usr/bin/env node
// ---------------------------------------------------------------------------
// seed-table.mjs — regenerate the §1 SEED TABLE of mp3d/rules/park-generation.md
//
// For each (seed, climate) it runs the REAL `parkComposition(THREE, seed,
// size, climate)` UNGUARDED, builds the REAL terrain from `comp.landform` +
// the composed peaks/basins (exactly as <Terrain> does), then MEASURES the
// wet region off the built heightfield rather than trusting basin discs.
//
// Usage:
//   node seed-table.mjs                       # the pinned table set at 128
//   node seed-table.mjs --size=128 --json     # machine-readable
//   node seed-table.mjs --md                  # the §1 table rows, ready to paste
//   node seed-table.mjs --sweep               # wide candidate sweep
//   node seed-table.mjs --seeds=1,7,31 --climates=temperate
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub: buildTerrain paints canvas textures for its materials
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

const SIZE = Number(arg('size', '128'));

// ---- bundle the design system's composition + terrain entry points ---------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_seed-table.ts');
fs.writeFileSync(ep, `
import { parkComposition, terrainLint, WATER_LEVEL, climateOf, TERRAIN_STYLES, waterGridStep, waterBodyTarget, waterBodyGapMin, SECOND_WATER_MIN_FRAC, measurePlotRelief, RELIEF_GRID } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
import { buildTerrain } from ${JSON.stringify(path.join(REPO, 'components/TerrainKit'))};
export { parkComposition, buildTerrain, terrainLint, WATER_LEVEL, climateOf, TERRAIN_STYLES, waterGridStep, waterBodyTarget, waterBodyGapMin, SECOND_WATER_MIN_FRAC, measurePlotRelief, RELIEF_GRID };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_seed-table.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const mp = await import(bundlePath);
const WL = mp.WATER_LEVEL;

// mirror <Terrain>'s own segment rule so the sampled ground IS the built ground
const segOf = (sz) => Math.min(Math.round(sz * 6.9), Math.max(220, Math.round(sz / 0.45)));

const f1 = (v) => (v >= 0 ? '' : '-') + Math.abs(v).toFixed(1);
const fmtPt = ([x, z]) => `(${f1(x)}, ${f1(z)})`;

/** measure the ACTUAL wet region off the built heightfield: connected
 *  components, then centroid + bbox + area of EVERY body, biggest first.
 *
 *  TWO BODIES since 2026-07: the composition composes a dominant body plus a
 *  secondary one on every plot ≥ `TWO_WATER_MIN_SIZE`, so "the water" is no
 *  longer one row of numbers. `bodies[]` carries them all (the old top-level
 *  `centroid`/`areaU2`/`extent`/`bbox` keys still describe the DOMINANT body,
 *  so every existing reader keeps working), plus the measured GAP between the
 *  two biggest — the anti-adjacency number. `strayBodies` is now "bodies past
 *  the target count", i.e. the scatter the rule still forbids. */
function measureWater(heightAt, S, nWant = 1) {
  const step = Math.max(0.6, mp.waterGridStep(S));
  const n = Math.max(8, Math.round(S / step));
  const half = S / 2;
  const xs = [], zs = [];
  for (let i = 0; i < n; i += 1) xs.push(-half + (i + 0.5) * (S / n));
  for (let j = 0; j < n; j += 1) zs.push(-half + (j + 0.5) * (S / n));
  const wet = new Uint8Array(n * n);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (heightAt(xs[i], zs[j]) < WL) wet[i * n + j] = 1;
  // 4-connected components
  const lab = new Int32Array(n * n).fill(-1);
  const comps = [];
  for (let s = 0; s < n * n; s += 1) {
    if (!wet[s] || lab[s] >= 0) continue;
    const id = comps.length;
    const stack = [s];
    lab[s] = id;
    const cells = [];
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const ci = Math.floor(c / n), cj = c % n;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const s2 = ni * n + nj;
        if (wet[s2] && lab[s2] < 0) { lab[s2] = id; stack.push(s2); }
      }
    }
    comps.push(cells);
  }
  comps.sort((a, b) => b.length - a.length);
  const cellA = (S / n) * (S / n);
  const pitch = S / n;
  const describe = (cells) => {
    if (!cells || !cells.length) return null;
    let sx = 0, sz = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of cells) {
      const x = xs[Math.floor(c / n)], z = zs[c % n];
      sx += x; sz += z;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    return {
      centroid: [+(sx / cells.length).toFixed(1), +(sz / cells.length).toFixed(1)],
      bbox: [+x0.toFixed(1), +z0.toFixed(1), +x1.toFixed(1), +z1.toFixed(1)],
      extent: [+(x1 - x0).toFixed(1), +(z1 - z0).toFixed(1)],
      areaU2: +(cells.length * cellA).toFixed(0),
      areaPct: +((cells.length * cellA * 100) / (S * S)).toFixed(1),
      frac: +((cells.length * cellA) / (S * S)).toFixed(4),
    };
  };
  /** shortest distance between two bodies' wet cells. BRUTE FORCE on purpose:
   *  the design system's own `bodyGap` short-circuits past a cap (all it needs
   *  is "≥ gapMin?"), which returns Infinity for bodies on opposite sides of
   *  the plot — useless for a PUBLISHED number. A few hundred thousand
   *  distances is nothing here. */
  const gapOf = (a, b) => {
    if (!a || !b || !a.length || !b.length) return null;
    let best = Infinity;
    for (const c of a) {
      const ax = xs[Math.floor(c / n)], az = zs[c % n];
      for (const d of b) {
        const dd = Math.hypot(ax - xs[Math.floor(d / n)], az - zs[d % n]);
        if (dd < best) best = dd;
      }
    }
    return +best.toFixed(1);
  };
  const main = comps[0] ?? [];
  const totalCells = comps.reduce((a, b) => a + b.length, 0);
  const kept = comps.slice(0, nWant);
  const keptCells = kept.reduce((a, b) => a + b.length, 0);
  const dom = describe(main);
  return {
    bodies: comps.length,
    /** bodies PAST the target count — the scatter the composition still forbids */
    strayBodies: Math.max(0, comps.length - nWant),
    strayArea: +((totalCells - keptCells) * cellA).toFixed(1),
    /** every body, biggest first */
    all: comps.map(describe),
    /** gap between the two biggest bodies (null with fewer than two) */
    gap: comps.length >= 2 ? gapOf(comps[0], comps[1]) : null,
    /** secondary/dominant area ratio — the anti-pond number */
    secondFrac: comps.length >= 2 ? +(comps[1].length / comps[0].length).toFixed(2) : null,
    /** TOTAL water over the target bodies (the per-climate band is measured on this) */
    totalU2: +(keptCells * cellA).toFixed(0),
    totalPct: +((keptCells * cellA * 100) / (S * S)).toFixed(1),
    // the DOMINANT body, under the historical key names
    centroid: dom ? dom.centroid : null,
    bbox: dom ? dom.bbox : null,
    extent: dom ? dom.extent : null,
    areaU2: dom ? dom.areaU2 : 0,
    areaPct: dom ? dom.areaPct : 0,
    grid: +pitch.toFixed(2),
  };
}

/** the gate cell <Gate/> defaults to, and the apron flatness around it */
function measureApron(heightAt, S) {
  const gz = 1.2 * Math.round((S / 2 - 0.8) / 1.2);
  let mx = 0;
  const pts = [];
  for (let ix = -2; ix <= 2; ix += 1) {
    for (let iz = 0; iz < 3; iz += 1) {
      const x = ix * 1.2, z = gz - iz * 1.2;
      const h = heightAt(x, z);
      pts.push(h);
      if (Math.abs(h) > mx) mx = Math.abs(h);
    }
  }
  const lo = Math.min(...pts), hi = Math.max(...pts);
  return { gateZ: +gz.toFixed(1), gateGround: +heightAt(0, gz).toFixed(2), maxAbs: +mx.toFixed(2), spread: +(hi - lo).toFixed(2) };
}

function probe(seed, climate, S) {
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
  const nWant = mp.waterBodyTarget(S);
  const water = measureWater(h, S, nWant);
  const apron = measureApron(h, S);
  const lint = mp.terrainLint(h, S, WL);
  // relief of the plot as built (landform + the authored ranges + the basins).
  // MEASURED BY THE DESIGN SYSTEM'S OWN `measurePlotRelief` (2026-07-25): the
  // §1 rows, the composition's landform-character floor and validatePark's
  // `terrainFlattened` gate must all mean the SAME thing by "flat", so this
  // script no longer keeps its own copy of the arithmetic.
  const character = mp.measurePlotRelief(h, S);
  const N = mp.RELIEF_GRID, half = S / 2;
  let flatN = 0;
  for (let i = 0; i < N; i += 1) for (let j = 0; j < N; j += 1) {
    const x = -half + (i + 0.5) * S / N, z = -half + (j + 0.5) * S / N;
    if (lint.flatEnough(x, z)) flatN += 1;
  }
  /** relief over a disc — how buildable a listed meadow actually is */
  const discRelief = (x, z, r) => {
    let lo = Infinity, hi = -Infinity;
    for (let a = 0; a < 12; a += 1) {
      for (const k of [0, 0.5, 1]) {
        const px = x + Math.cos((a / 12) * Math.PI * 2) * r * k;
        const pz = z + Math.sin((a / 12) * Math.PI * 2) * r * k;
        if (Math.abs(px) > half || Math.abs(pz) > half) continue;
        const v = h(px, pz);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return +(hi - lo).toFixed(2);
  };
  const meadows = comp.landZones.filter((z) => z.kind === 'meadow')
    .map((z) => {
      const [mx, mz] = z.center;
      // usable radius: clipped to the plot edge (a listed radius can overhang)
      const usable = Math.max(0, Math.min(z.radius, half - 1.2 - Math.max(Math.abs(mx), Math.abs(mz))));
      return {
        c: [+mx.toFixed(1), +mz.toFixed(1)],
        r: +z.radius.toFixed(1),
        usable: +usable.toFixed(1),
        relief6: discRelief(mx, mz, 6),
      };
    })
    .sort((a, b) => b.usable - a.usable);
  const sand = comp.landZones.find((z) => z.kind === 'sand');
  terrain.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return {
    seed, climate: comp.climate, size: S,
    terrainSeed: comp.terrainSeed,
    landform: {
      style: lf.style,
      amplitude: +lf.amplitude.toFixed(2),
      scale: +lf.scale.toFixed(1),
      octaves: lf.octaves,
      roughness: +lf.roughness.toFixed(2),
    },
    relief: +character.relief.toFixed(2),
    stdH: +character.stdH.toFixed(2),
    mountainStyle: comp.mountainStyle,
    ranges: comp.hillClusters.map((c) => ({ c: [+c.x.toFixed(1), +c.z.toFixed(1)], r: +c.radius.toFixed(1), n: c.peaks?.length ?? 0 })),
    peaks: comp.peaks.map((p) => ({ c: [+p.x.toFixed(1), +p.z.toFixed(1)], h: +p.height.toFixed(1), r: +p.radius.toFixed(1) })),
    maxPeakH: +Math.max(0, ...comp.peaks.map((p) => p.height)).toFixed(1),
    treeline: +comp.treeline.toFixed(2),
    waterStyle: comp.waterStyle,
    waterStyleSecond: comp.waterStyleSecond ?? null,
    waterKind: comp.waterKind,
    waterBodiesWanted: nWant,
    compWaterCentre: [+comp.waterCentre[0].toFixed(1), +comp.waterCentre[1].toFixed(1)],
    compWaterCentreSecond: comp.waterCentreSecond
      ? [+comp.waterCentreSecond[0].toFixed(1), +comp.waterCentreSecond[1].toFixed(1)]
      : null,
    basins: comp.basins.map((b) => ({ c: [+b.x.toFixed(1), +b.z.toFixed(1)], r: +b.radius.toFixed(1), wl: +(0.74 * b.radius).toFixed(1) })),
    basinsSecond: (comp.basinsSecond ?? []).length,
    water,
    sand: sand ? { c: [+sand.center[0].toFixed(1), +sand.center[1].toFixed(1)], r: +sand.radius.toFixed(1) } : null,
    beachDir: [+comp.beachDir[0].toFixed(2), +comp.beachDir[1].toFixed(2)],
    sandBand: +comp.sandBand.toFixed(2),
    meadows,
    forests: comp.landZones.filter((z) => z.kind === 'forest').length,
    apron,
    report: {
      probesTried: comp.report.probesTried,
      violations: comp.report.violations,
      clampedCells: comp.report.clampedCells,
      waterBodies: comp.report.waterBodies,
      waterAreaU2: +comp.report.waterAreaU2.toFixed(0),
      waterAreas: (comp.report.waterAreas ?? []).map((a) => +a.toFixed(0)),
      waterGap: Number.isFinite(comp.report.waterGap) ? +comp.report.waterGap.toFixed(1) : null,
      apronMaxAbs: +comp.report.apronMaxAbs.toFixed(2),
    },
    flatFrac: +(flatN / (N * N)).toFixed(2),
    clean:
      comp.report.violations.length === 0 &&
      comp.report.clampedCells === 0 &&
      water.bodies === nWant &&
      (nWant < 2 || (water.secondFrac >= mp.SECOND_WATER_MIN_FRAC && water.gap >= mp.waterBodyGapMin(S))) &&
      comp.report.apronMaxAbs <= 0.45,
  };
}

// ---- which (seed, climate) pairs -------------------------------------------
// THE PUBLISHED §1 SEED TABLE (16 rows): 4 climates × 4 seeds, chosen from the
// --sweep so all SIX landform archetypes and all FOUR water styles appear, no
// seed number repeats, every row composes clean at 192 and none exceeds the
// §0.10 ~12% water budget.
const PINNED = [
  [1, 'temperate'], [31, 'temperate'], [83, 'temperate'], [71, 'temperate'],
  [3, 'desert'], [19, 'desert'], [37, 'desert'], [91, 'desert'],
  [5, 'alpine'], [8, 'alpine'], [17, 'alpine'], [42, 'alpine'],
  [7, 'coastal'], [23, 'coastal'], [73, 'coastal'], [53, 'coastal'],
];
let pairs = PINNED;
if (flag('sweep')) {
  const seeds = (arg('seeds', '') || Array.from({ length: 24 }, (_, i) => [1, 2, 3, 5, 7, 8, 11, 13, 17, 19, 23, 29, 31, 37, 41, 42, 53, 59, 67, 71, 73, 79, 83, 91][i]).join(','))
    .split(',').map(Number);
  const clims = (arg('climates', 'temperate,desert,alpine,coastal')).split(',');
  pairs = seeds.flatMap((s) => clims.map((c) => [s, c]));
} else if (arg('seeds', null)) {
  const seeds = arg('seeds', '').split(',').map(Number);
  const clims = (arg('climates', 'temperate,desert,alpine,coastal')).split(',');
  pairs = seeds.flatMap((s) => clims.map((c) => [s, c]));
}

const rows = [];
for (const [s, c] of pairs) {
  try {
    rows.push(probe(s, c, SIZE));
  } catch (e) {
    rows.push({ seed: s, climate: c, size: SIZE, error: String(e && e.message || e), clean: false });
  }
}

if (flag('md')) {
  // ---- THE §1 TABLE, EMITTED — so the `probes` column cannot rot ------------
  // `probesTried` is how many landform candidates the composition REJECTED
  // before one satisfied its rules, measured UNGUARDED at THIS size.
  //
  // IT IS NOT A GUARD-STABILITY RATING, in either direction — measured:
  //   * a `probes 1` row gives no guard immunity: arch-ref (seed 7 temperate,
  //     size 48) goes unguarded `probes 1` -> GUARDED `probes 64`, water moved
  //     from the seed's river (18.1, -5.9) to a lake (13.8, 11.3);
  //   * a high `probes` is not fragility: seedcheck-s1-192 is `probes 17`
  //     guarded AND unguarded, same landform (plains, terrainSeed 16), 0 clamps,
  //     0 of 12 one-cell keepDry edits move it.
  // It is also SIZE-DEPENDENT: seed 7 temperate is `probes 18` at 128 and
  // `probes 1` at 48 and 16, so a row here does not describe a smaller park.
  //
  // For the question authors actually have — "will a guard edit move my
  // terrain?" — use `probe-guard-stability.mjs <park.tsx>`, which re-composes
  // with the park's OWN guards at its OWN size and reports `moved N/12`.
  // See rules/park-generation-composition.md §1.
  const pt = (c) => `(${Math.round(c[0])}, ${Math.round(c[1])})`;
  console.log('| seed × climate | probes | landform archetype | DOMINANT water body | SECONDARY water body | mountain ranges (biggest 3) | flat build fields (`use` = radius clipped at the plot rim) | sand flank |');
  console.log('|---|---:|---|---|---|---|---|---|');
  for (const r of rows) {
    if (r.error) continue;
    const w = r.water;
    const b2 = w.all[1];
    const dom = `${r.waterStyle} ${r.waterKind} ctr ${pt(w.centroid)}, **${w.areaPct}%**`;
    const sec = b2
      ? `${r.waterStyleSecond ?? '—'} ctr ${pt(b2.centroid)}, **${b2.areaPct}%** · gap ${w.gap} u · total **${w.totalPct}%**`
      : '—';
    const rng = `${r.mountainStyle} ×${r.ranges.length} ${r.ranges.slice(0, 3).map((g) => `${pt(g.c)} r${Math.round(g.r)}`).join(' ')} · ${r.peaks.length} peaks, max h ${r.maxPeakH} · relief ${r.relief}`;
    const fields = r.meadows.slice(0, 3).map((m) => `${pt(m.c)} use ${m.usable}`).join(' + ');
    console.log(
      `| **${r.seed}** ${r.climate} | **${r.report.probesTried}** | \`${r.landform.style}\` amp ${r.landform.amplitude} λ ${r.landform.scale} | ${dom} | ${sec} | ${rng} | ${fields} | ${
        r.sand ? `sand ${pt(r.sand.c)} r ${Math.round(r.sand.r)}` : 'none'
      } |`,
    );
  }
  // The summary reports the DISTRIBUTION only. It deliberately does NOT label
  // rows "stable" or "fragile" by probe count — that inference was measured and
  // is false both ways (see the note above). Guard stability is a per-park
  // measurement: probe-guard-stability.mjs.
  const byN = {};
  for (const r of rows) if (!r.error) byN[r.report.probesTried] = (byN[r.report.probesTried] ?? 0) + 1;
  const ones = rows.filter((r) => !r.error && r.report.probesTried === 1);
  console.log(
    `\n<!-- probes distribution (UNGUARDED, size ${rows.find((r) => !r.error)?.size ?? '?'}): ` +
      Object.entries(byN).sort((x, y) => +x[0] - +y[0]).map(([n, c]) => `${n}:${c} row(s)`).join(', ') + '.\n' +
      `     ${ones.length}/${rows.length} rows compose on their FIRST candidate: ` +
      `${ones.map((r) => `${r.seed} ${r.climate}`).join(', ')}.\n` +
      `     This is NOT a guard-stability ranking — a probes-1 row can still be moved by guards\n` +
      `     (arch-ref: unguarded 1 -> guarded 64) and a probes-17 row can be immovable\n` +
      `     (seedcheck-s1-192: 0/12 perturbations move it). Measure per park with\n` +
      `     node probe-guard-stability.mjs <park.tsx>. -->`,
  );
} else if (flag('json')) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  for (const r of rows) {
    if (r.error) { console.log(`seed ${r.seed} ${r.climate}: ERROR ${r.error}`); continue; }
    console.log(`\n=== seed ${r.seed} ${r.climate} @ ${r.size} ${r.clean ? 'CLEAN' : '*** NOT CLEAN ***'}`);
    console.log(`  landform   ${r.landform.style} (amp ${r.landform.amplitude}, wavelength ${r.landform.scale}, oct ${r.landform.octaves}, rough ${r.landform.roughness}) → relief ${r.relief} σ ${r.stdH}`);
    console.log(`  water      ${r.water.bodies} bod${r.water.bodies === 1 ? 'y' : 'ies'} (want ${r.waterBodiesWanted}), total ${r.water.totalU2} u² (${r.water.totalPct}% of the plot)${
      r.water.gap === null ? '' : `, gap ${r.water.gap} u, second/dominant ${r.water.secondFrac}`
    }`);
    console.log(`   dominant  ${r.waterStyle} ${r.waterKind}: centroid ${fmtPt(r.water.centroid)} extent ${r.water.extent?.join(' × ')} area ${r.water.areaU2} u² (${r.water.areaPct}%)`);
    if (r.water.all[1])
      console.log(`   secondary ${r.waterStyleSecond ?? '—'}: centroid ${fmtPt(r.water.all[1].centroid)} extent ${r.water.all[1].extent.join(' × ')} area ${r.water.all[1].areaU2} u² (${r.water.all[1].areaPct}%)`);
    if (r.water.strayBodies > 0) console.log(`   *** ${r.water.strayBodies} STRAY pond(s), ${r.water.strayArea} u² — scatter, not a body`);
    console.log(`             comp.waterCentre ${fmtPt(r.compWaterCentre)}${r.compWaterCentreSecond ? ` / second ${fmtPt(r.compWaterCentreSecond)}` : ''}  basins ${r.basins.map((b) => `${fmtPt(b.c)} r${b.r}/wl${b.wl}`).join(' ')}`);
    console.log(`  mountains  ${r.mountainStyle} ×${r.ranges.length}: ${r.ranges.map((g) => `${fmtPt(g.c)} r${g.r}`).join(' + ')}  (${r.peaks.length} peaks, max h ${r.maxPeakH}, treeline ${r.treeline})`);
    console.log(`  sand       ${r.sand ? `${fmtPt(r.sand.c)} r${r.sand.r}` : 'none'}  beachDir [${r.beachDir}] band ${r.sandBand}`);
    console.log(`  meadows    ${r.meadows.map((m) => `${fmtPt(m.c)} r${m.r}/use${m.usable}/rel${m.relief6}`).join(' + ')}`);
    console.log(`             (+${r.forests} forest discs; ${Math.round(r.flatFrac * 100)}% of the plot is slope-flat)`);
    console.log(`  apron      gate z ${r.apron.gateZ}, ground ${r.apron.gateGround}, |h|max ${r.apron.maxAbs}, spread ${r.apron.spread} (comp ${r.report.apronMaxAbs} / 0.45)`);
    console.log(`  report     probes ${r.report.probesTried}, violations ${JSON.stringify(r.report.violations)}, clampDiscs ${r.report.clampedCells}, terrainSeed ${r.terrainSeed}`);
  }
  const styles = {};
  for (const r of rows) if (!r.error) styles[r.landform.style] = (styles[r.landform.style] ?? 0) + 1;
  console.log(`\nlandform distribution: ${JSON.stringify(styles)}`);
  console.log(`clean: ${rows.filter((r) => r.clean).length}/${rows.length}`);
  const bad = rows.filter((r) => !r.clean).map((r) => `${r.seed} ${r.climate}`);
  if (bad.length) console.log(`NOT clean: ${bad.join(', ')}`);
}
