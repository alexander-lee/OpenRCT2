#!/usr/bin/env node
// ---------------------------------------------------------------------------
// sweep-dense-row.mjs — find a §1-style seed row that can carry a DENSE park.
//
// A dense street net guards ~580 cells, and `keepDry` CAPS every authored range
// whose footprint contains a guarded cell, so a dense park loses ~40% of its
// seed's relief and lands under the size-128 band floor (relief 8.15 / stdH
// 0.76) → `terrainFlattened`, FATAL. The way out is a row whose AUTHORED relief
// is high enough (>= ~14) that even a heavy guard list keeps it inside the band,
// AND whose §4.2-A ring cells are dry + flat so the ring can stand there with a
// 16-cell guard list that does not move the water.
//
// For each (seed, climate) at `--size` this measures:
//   1. UNGUARDED relief / stdH through the design system's own measurePlotRelief
//   2. RING-ONLY guarded re-compose (the 16 §4.2-A ring cells at the published
//      start pose): how far each water centroid MOVED, composition violations,
//      and the composition's own reliefFloor report
//   3. every ring cell's composed ground height, dryness and peak-bump
//   4. the water shape: bodies, secondary fraction, gap, area %
//   5. how much of the plot is DRY and FLAT enough (bump <= 0.55) to route a
//      dense net across, plus the composed peaks so a net can be authored
//      around them
//
// Usage:
//   node sweep-dense-row.mjs --seeds=1,2,3 --climates=temperate,alpine
//   node sweep-dense-row.mjs --range=1-200 --climates=alpine --jsonl=out/x.jsonl
//   node sweep-dense-row.mjs --range=1-200 --minRelief=14 --terse
//
// heightAt is INDEPENDENT of the mesh resolution (buildTerrain closes over the
// landform params, not the geometry), so this sweep builds at `--seg=8`: same
// ground, ~100x faster than the <Terrain> segment rule. `--fullseg` verifies.
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
const SEG = flag('fullseg') ? Math.min(Math.round(SIZE * 6.9), Math.max(220, Math.round(SIZE / 0.45))) : Number(arg('seg', '8'));
const MIN_RELIEF = Number(arg('minRelief', '0'));

const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_dense-sweep.ts');
fs.writeFileSync(ep, `
import { parkComposition, measurePlotRelief, seedTableRow, SEED_TABLE_128_BAND, SEED_TABLE_SIZE, WATER_LEVEL, waterBodyTarget, waterBodyGapMin, SECOND_WATER_MIN_FRAC, waterGridStep } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
import { buildTerrain } from ${JSON.stringify(path.join(REPO, 'components/TerrainKit'))};
export { solvePathHeights } from ${JSON.stringify(path.join(REPO, 'components/PathNetwork'))};
export { parkComposition, measurePlotRelief, seedTableRow, SEED_TABLE_128_BAND, SEED_TABLE_SIZE, WATER_LEVEL, waterBodyTarget, waterBodyGapMin, SECOND_WATER_MIN_FRAC, waterGridStep, buildTerrain };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_dense-sweep.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const mp = await import(bundlePath);
const WL = mp.WATER_LEVEL;
const BAND = mp.SEED_TABLE_128_BAND;

// ---- the §4.2-A ring at the published start pose [-42.6, 0, -9.7] ----------
const RING_DECKS = [[-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0]];
const RING_TAILS = [[-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -44.4]];
const RING_CELLS = [
  ...RING_DECKS,
  [-42.6, -9.7],
  ...RING_TAILS,
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -49.21],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -49.83],
];

// ---- a SYNTHETIC DENSE net, as the worst-case guard list -------------------
// ~560 paved cells on a 4×3 arterial grid across the plot interior — the shape
// of the density class the parent measured (140 nodes / 500+ u of street). This
// is what a dense park's `NET.keepDry` looks like, so composing against it
// answers the question that actually decides legality: does the seed still
// clear the size-128 band floor once the whole net is guarded?
const gridCells = (zs, xs, x0 = -48, x1 = 48, z0 = -48, z1 = 48) => {
  const seen = new Set(); const out = [];
  const add = (x, z) => { const k = `${x.toFixed(1)},${z.toFixed(1)}`; if (!seen.has(k)) { seen.add(k); out.push([x, z]); } };
  for (const z of zs) for (let x = x0; x <= x1 + 1e-6; x += 1.2) add(+x.toFixed(1), z);
  for (const x of xs) for (let z = z0; z <= z1 + 1e-6; z += 1.2) add(x, +z.toFixed(1));
  return out;
};
const DENSE_CELLS = gridCells([-30, -10, 10, 30], [-30, 0, 30]);
// THREE MORE dense patterns of the same weight, offset and re-proportioned, so a
// row's headroom is measured against the SHAPE of a dense net rather than one
// arbitrary grid — the real park's `NET.keepDry` will be neither.
const DENSE_VARIANTS = [
  ['gridA', DENSE_CELLS],
  ['gridB', gridCells([-36, -18, 0, 18, 36], [-18, 18], -54, 54, -54, 54)],
  ['gridC', gridCells([-42, -14, 14, 42], [-42, -14, 14, 42], -45, 45, -45, 45)],
  ['gridD', gridCells([-24, 0, 24, 48], [-48, -24, 0], -50, 50, -50, 50)],
];

function buildFrom(comp, S) {
  const lf = comp.landform;
  return mp.buildTerrain(THREE, {
    size: S, seg: SEG, seed: comp.terrainSeed,
    amplitude: lf.amplitude, scale: lf.scale, octaves: lf.octaves, roughness: lf.roughness,
    reliefBias: lf.reliefBias, flatSpots: lf.flatSpots, waterLevel: WL,
    peaks: [...comp.peaks, ...(comp.clampPeaks ?? [])],
    basins: [...comp.basins, ...(comp.clampBasins ?? [])],
    firmShore: true, edgeSkirt: false,
  });
}
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
const moved = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity);

/** connected wet bodies off the BUILT heightfield (seed-table.mjs's method) */
function measureWater(heightAt, S, nWant) {
  const step = Math.max(0.6, mp.waterGridStep(S));
  const n = Math.max(8, Math.round(S / step));
  const half = S / 2;
  const xs = [], zs = [];
  for (let i = 0; i < n; i += 1) xs.push(-half + (i + 0.5) * (S / n));
  for (let j = 0; j < n; j += 1) zs.push(-half + (j + 0.5) * (S / n));
  const wet = new Uint8Array(n * n);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (heightAt(xs[i], zs[j]) < WL) wet[i * n + j] = 1;
  const lab = new Int32Array(n * n).fill(-1);
  const comps = [];
  for (let s = 0; s < n * n; s += 1) {
    if (!wet[s] || lab[s] >= 0) continue;
    const id = comps.length; const stack = [s]; lab[s] = id; const cells = [];
    while (stack.length) {
      const c = stack.pop(); cells.push(c);
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
  const gapOf = (a, b) => {
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
  const keptCells = comps.slice(0, nWant).reduce((a, b) => a + b.length, 0);
  return {
    bodies: comps.length,
    secondFrac: comps.length >= 2 ? +(comps[1].length / comps[0].length).toFixed(2) : null,
    gap: comps.length >= 2 ? gapOf(comps[0], comps[1]) : null,
    totalPct: +((keptCells * cellA * 100) / (S * S)).toFixed(1),
  };
}

function probeRow(seed, climate, S) {
  // ---- 1. UNGUARDED (authored) -------------------------------------------
  const bare = mp.parkComposition(THREE, seed, S, climate);
  const bareT = buildFrom(bare, S);
  const bm = mp.measurePlotRelief(bareT.heightAt, S);
  bareT.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  const row = {
    seed, climate, size: S,
    landform: bare.landform.style,
    amp: r2(bare.landform.amplitude),
    authoredRelief: r2(bm.relief),
    authoredStdH: r2(bm.stdH),
    terrainSeedBare: bare.terrainSeed,
    probesBare: bare.report.probesTried,
    violationsBare: bare.report.violations.length,
    peaks: bare.peaks.map((p) => ({ at: [r2(p.x), r2(p.z)], h: r2(p.height), r: r2(p.radius) })),
    maxPeakH: r2(Math.max(0, ...bare.peaks.map((p) => p.height))),
  };
  if (row.authoredRelief < MIN_RELIEF) { row.skipped = 'relief'; return row; }

  // ---- 2. RING-ONLY guarded re-compose -----------------------------------
  const g = mp.parkComposition(THREE, seed, S, climate, { keepDry: RING_CELLS });
  const gT = buildFrom(g, S);
  const gm = mp.measurePlotRelief(gT.heightAt, S);
  row.terrainSeedRing = g.terrainSeed;
  row.probesRing = g.report.probesTried;
  row.violationsRing = g.report.violations.length;
  row.movedDominant = r2(moved(bare.waterCentre, g.waterCentre));
  row.movedSecondary = r2(moved(bare.waterCentreSecond, g.waterCentreSecond));
  row.ringRelief = r2(gm.relief);
  row.ringStdH = r2(gm.stdH);
  const rf = g.report.reliefFloor;
  row.ringFloor = rf ? { kept: r2(rf.kept), floor: rf.floor, ok: rf.ok, guardedRanges: rf.guardedRanges } : null;

  // ---- 3. the ring cells' composed ground --------------------------------
  const basins = [...g.basins, ...(g.basinsSecond ?? [])];
  const isDry = (x, z, margin = 1.2) => basins.every((b) => Math.hypot(x - b.x, z - b.z) > 0.74 * b.radius + margin);
  const bumpAt = (x, z) => Math.max(0, ...g.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
  const cellOf = (c) => ({ at: [r2(c[0]), r2(c[1])], h: r2(gT.heightAt(c[0], c[1])), bump: r2(bumpAt(c[0], c[1])), dry: isDry(c[0], c[1]) });
  const decks = RING_DECKS.map(cellOf);
  const tails = RING_TAILS.map(cellOf);
  const all16 = RING_CELLS.map(cellOf);
  row.decks = decks;
  row.tails = tails;
  row.decksDry = decks.every((d) => d.dry && d.h > 0);
  row.deckWorstBump = r2(Math.max(...decks.map((d) => d.bump)));
  row.ringWorstBump = r2(Math.max(...all16.map((d) => d.bump)));
  row.ringWet = all16.filter((d) => !d.dry).length;
  row.ringNonPositive = all16.filter((d) => d.h <= 0).length;

  // ---- 4. water shape ----------------------------------------------------
  const nWant = mp.waterBodyTarget(S);
  row.water = measureWater(gT.heightAt, S, nWant);
  row.waterOk = row.water.bodies === nWant
    && (nWant < 2 || (row.water.secondFrac >= mp.SECOND_WATER_MIN_FRAC && row.water.gap >= mp.waterBodyGapMin(S)));
  row.apronMaxAbs = r2(g.report.apronMaxAbs);

  // ---- 5. routable ground: dry AND bump <= 0.55, on a 1.2-u lattice ------
  {
    const half = S / 2, lim = half - 2.4;
    let n = 0, okN = 0, dryN = 0;
    for (let x = -lim; x <= lim; x += 2.4) for (let z = -lim; z <= lim; z += 2.4) {
      n += 1;
      const d = isDry(x, z);
      if (d) dryN += 1;
      if (d && bumpAt(x, z) <= 0.55 && gT.heightAt(x, z) > 0) okN += 1;
    }
    row.routableFrac = r2(okN / n);
    row.dryFrac = r2(dryN / n);
  }
  gT.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });

  // ---- 6. the DENSE worst case: ring + a ~560-cell arterial grid ----------
  if (!flag('noDense')) {
    const d = mp.parkComposition(THREE, seed, S, climate, { keepDry: [...RING_CELLS, ...DENSE_CELLS] });
    const dT = buildFrom(d, S);
    const dm = mp.measurePlotRelief(dT.heightAt, S);
    dT.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    const dfl = d.report.reliefFloor;
    row.dense = {
      relief: r2(dm.relief), stdH: r2(dm.stdH),
      kept: dfl ? r2(dfl.kept) : null, ok: dfl ? dfl.ok : null,
      guardedRanges: dfl ? dfl.guardedRanges : null,
      movedDominant: r2(moved(bare.waterCentre, d.waterCentre)),
      movedSecondary: r2(moved(bare.waterCentreSecond, d.waterCentreSecond)),
      violations: d.report.violations.length,
      cells: RING_CELLS.length + DENSE_CELLS.length,
    };
    row.dense.belowBand = dm.relief < BAND.relief[0] || dm.stdH < BAND.stdH[0];
    row.dense.fatal = !!(dfl && !dfl.ok) && row.dense.belowBand;

    // ---- the GRADE audit: can a street net even be WALKED on this ground? --
    // <Paths>' own solve over the SAME arterial grid, node every 6 u. A dense
    // net's real mean edge is ~3.4 u, so this is the conservative reading.
    {
      const key = new Map(); const nodes = []; const edges = [];
      const nid = (x, z) => {
        const k = `${x.toFixed(1)},${z.toFixed(1)}`;
        if (!key.has(k)) { key.set(k, nodes.length); nodes.push([x, z]); }
        return key.get(k);
      };
      const line = (pts) => { for (let i = 1; i < pts.length; i += 1) edges.push([nid(...pts[i - 1]), nid(...pts[i])]); };
      for (const z of [-30, -10, 10, 30]) { const pts = []; for (let x = -48; x <= 48 + 1e-6; x += 6) pts.push([+x.toFixed(1), z]); line(pts); }
      for (const x of [-30, 0, 30]) { const pts = []; for (let z = -48; z <= 48 + 1e-6; z += 6) pts.push([x, +z.toFixed(1)]); line(pts); }
      const gh = dT.heightAt;
      const grounds = nodes.map(([x, z]) => gh(x, z));
      const sortedG = [...grounds].sort((a, b) => a - b);
      const medianG = sortedG[Math.floor(sortedG.length / 2)];
      const sol = mp.solvePathHeights(nodes, edges, gh, { clearance: 0.03, width: 1.1 });
      const sh = [...sol.h].sort((a, b) => a - b);
      const pathY = sh[Math.floor(sh.length / 2)];
      const nodeY = sol.h.map((v) => (Math.abs(v - pathY) < 0.0015 ? 0 : v - pathY));
      let worst = 0, refused = 0, over1 = 0, inWater = 0;
      for (const [a, b] of edges) {
        const [ax, az] = nodes[a], [bx, bz] = nodes[b];
        let lift = 0, wettest = Infinity;
        for (let k = 0; k <= 12; k += 1) {
          const u = k / 12, px = ax + (bx - ax) * u, pz = az + (bz - az) * u, g0 = gh(px, pz);
          const surf = (pathY + nodeY[a]) + ((pathY + nodeY[b]) - (pathY + nodeY[a])) * u;
          if (surf - g0 > lift) lift = surf - g0;
          if (g0 < wettest) wettest = g0;
        }
        if (lift > worst) worst = lift;
        if (lift > 2.0) refused += 1; else if (lift > 1.0) over1 += 1;
        if (wettest < WL + 0.05) inWater += 1;
      }
      row.dense.paths = {
        nodes: nodes.length, edges: edges.length,
        causewayLevel: r2(pathY - medianG),
        worstSpanLift: r2(worst), spansRefused: refused, spansOver1: over1, spansInWater: inWater,
        worstRamp: r2(Math.max(...nodeY.map(Math.abs))),
      };
      row.dense.pathsOk = refused === 0 && Math.abs(row.dense.paths.causewayLevel) <= 0.8;
    }
  }

  // ---- 6b. ROBUSTNESS: the same question against four dense net shapes ----
  if (flag('variants')) {
    row.variants = DENSE_VARIANTS.map(([name, cells]) => {
      const v = mp.parkComposition(THREE, seed, S, climate, { keepDry: [...RING_CELLS, ...cells] });
      const vT = buildFrom(v, S);
      const vm = mp.measurePlotRelief(vT.heightAt, S);
      vT.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      const vfl = v.report.reliefFloor;
      const below = vm.relief < BAND.relief[0] || vm.stdH < BAND.stdH[0];
      return {
        name, cells: cells.length, relief: r2(vm.relief), stdH: r2(vm.stdH),
        kept: vfl ? r2(vfl.kept) : null, keptOk: vfl ? vfl.ok : null, belowBand: below,
        fatal: !!(vfl && !vfl.ok) && below,
        movedDominant: r2(moved(bare.waterCentre, v.waterCentre)),
        movedSecondary: r2(moved(bare.waterCentreSecond, v.waterCentreSecond)),
        violations: v.report.violations.length,
      };
    });
    row.variantsAllSurvive = row.variants.every((v) => !v.fatal);
    row.variantWorstRelief = r2(Math.min(...row.variants.map((v) => v.relief)));
    row.variantWorstStdH = r2(Math.min(...row.variants.map((v) => v.stdH)));
    row.variantWorstKept = r2(Math.min(...row.variants.map((v) => v.kept)));
  }

  // ---- the five criteria -------------------------------------------------
  row.c1_relief = row.authoredRelief >= 14 && row.authoredStdH >= 0.95;
  row.c2_ringClean = row.movedDominant <= 1 && row.movedSecondary <= 1 && row.violationsRing === 0;
  row.c3_decksDry = row.decksDry;
  row.c4_flat = row.ringWorstBump <= 0.75;
  row.c5_water = row.waterOk && row.violationsBare === 0 && row.apronMaxAbs <= 0.45;
  row.c6_denseSurvives = row.dense ? !row.dense.fatal : null;
  row.pass = row.c1_relief && row.c2_ringClean && row.c3_decksDry && row.c4_flat && row.c5_water;
  return row;
}

// ---- which pairs -----------------------------------------------------------
let seeds;
if (arg('range', null)) {
  const [a, b] = arg('range', '1-100').split('-').map(Number);
  seeds = Array.from({ length: b - a + 1 }, (_, i) => a + i);
} else seeds = (arg('seeds', '1,31,83,71,3,19,37,91,5,8,17,42,7,23,73,53')).split(',').map(Number);
const clims = arg('climates', 'temperate,desert,alpine,coastal').split(',');

const rows = [];
for (const s of seeds) for (const c of clims) {
  try { rows.push(probeRow(s, c, SIZE)); }
  catch (e) { rows.push({ seed: s, climate: c, size: SIZE, error: String((e && e.message) || e) }); }
}

const jsonl = arg('jsonl', null);
if (jsonl) fs.writeFileSync(path.resolve(jsonl), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
if (flag('json')) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

const hi = rows.filter((r) => !r.error && !r.skipped);
hi.sort((a, b) => (b.pass - a.pass) || (b.authoredRelief - a.authoredRelief));
console.log(`\n=== sweep @ ${SIZE} (seg ${SEG}) — ${rows.length} rows, ${hi.length} past relief >= ${MIN_RELIEF}`);
console.log(`band @128: relief ${BAND.relief[0]}-${BAND.relief[1]}, stdH ${BAND.stdH[0]}-${BAND.stdH[1]}`);
console.log('\nseed clim      landform  amp  |  authRel authStd | ringRel ringStd kept movD movS | dnsRel dnsStd dnsKept FATAL | decksDry ringBump wet | water(bod/sec/gap/%) | rout | 123456 PASS');
for (const r of hi) {
  const c = `${r.c1_relief ? 1 : '·'}${r.c2_ringClean ? 2 : '·'}${r.c3_decksDry ? 3 : '·'}${r.c4_flat ? 4 : '·'}${r.c5_water ? 5 : '·'}${r.c6_denseSurvives ? 6 : '·'}`;
  const d = r.dense ?? {};
  console.log(
    `${String(r.seed).padStart(4)} ${r.climate.padEnd(9)} ${String(r.landform).padEnd(9)} ${String(r.amp).padStart(5)} | ` +
    `${String(r.authoredRelief).padStart(7)} ${String(r.authoredStdH).padStart(7)} | ` +
    `${String(r.ringRelief).padStart(7)} ${String(r.ringStdH).padStart(7)} ${String(r.ringFloor ? r.ringFloor.kept : '—').padStart(4)} ${String(r.movedDominant).padStart(5)} ${String(r.movedSecondary).padStart(5)} | ` +
    `${String(d.relief).padStart(6)} ${String(d.stdH).padStart(6)} ${String(d.kept).padStart(7)} ${String(d.fatal ? 'FATAL' : '·').padStart(5)} | ` +
    `${String(r.decksDry).padStart(8)} ${String(r.ringWorstBump).padStart(8)} ${String(r.ringWet).padStart(3)} | ` +
    `${String(r.water.bodies)}/${r.water.secondFrac}/${r.water.gap}/${r.water.totalPct}`.padEnd(22) + ' | ' +
    `${String(r.routableFrac).padStart(4)} | ${c} ${r.pass ? 'PASS' : ''}` +
    (d.paths ? `  grade[cw ${d.paths.causewayLevel} lift ${d.paths.worstSpanLift} refused ${d.paths.spansRefused} wet ${d.paths.spansInWater}]` : ''),
  );
  if (r.variants) console.log(`      variants: ${r.variants.map((v) => `${v.name} ${v.relief}/${v.stdH}/kept ${v.kept}${v.fatal ? ' FATAL' : ''}${v.movedDominant > 6 || v.movedSecondary > 6 ? ` moved ${v.movedDominant}/${v.movedSecondary}` : ''}`).join(' · ')}  → ${r.variantsAllSurvive ? 'ALL SURVIVE' : 'A VARIANT IS FATAL'}`);
}
const passing = hi.filter((r) => r.pass);
console.log(`\nPASS: ${passing.length ? passing.map((r) => `${r.seed} ${r.climate}`).join(', ') : 'none'}`);
const errs = rows.filter((r) => r.error);
if (errs.length) console.log(`errors: ${errs.map((r) => `${r.seed} ${r.climate}: ${r.error}`).join(' | ')}`);
