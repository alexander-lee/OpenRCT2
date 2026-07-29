#!/usr/bin/env node
// ---------------------------------------------------------------------------
// sweep-ring-pose.mjs — the §4.2-A ring TRANSLATES rigidly, so a row that is
// not ring-clean at the published start pose [-42.6, 0, -9.7] may be ring-clean
// somewhere else in the legal start range (x ∈ [-63.6, -21.6], z ∈ [-22.8,
// 20.4] at 128, lattice multiples of 1.2 — rules/park-generation-rides.md
// §4.2-A "IF A BASIN COLLIDES, TRANSLATE THE RING").
//
// For ONE (seed, climate) this walks every legal pose on the 1.2-u lattice,
// PAPER-filters it against the unguarded composition's basins (cheap), then
// MECHANICALLY re-composes the survivors with only that pose's 16 ring cells
// and reports the authority: how far each water centroid moved, composition
// violations, every ring cell's composed height / dryness / peak bump, and —
// with a synthetic ~560-cell dense net added — whether the row still clears the
// size-128 band floor.
//
//   node sweep-ring-pose.mjs --seed=31 --climate=alpine
//   node sweep-ring-pose.mjs --seed=31 --climate=alpine --top=60 --json
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';

const ctx2d = new Proxy({}, {
  get: (_t, k) =>
    k === 'canvas' ? { width: 8, height: 8 }
      : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
        : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4 * 64) }) : () => {},
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

const SEED = Number(arg('seed', '31'));
const CLIMATE = arg('climate', 'alpine');
const SIZE = Number(arg('size', '128'));
const SEG = Number(arg('seg', '8'));
const TOP = Number(arg('top', '40'));

const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_ring-pose.ts');
fs.writeFileSync(ep, `
import { parkComposition, measurePlotRelief, SEED_TABLE_128_BAND, WATER_LEVEL, waterBodyTarget, waterBodyGapMin, SECOND_WATER_MIN_FRAC, waterGridStep } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
import { buildTerrain } from ${JSON.stringify(path.join(REPO, 'components/TerrainKit'))};
export { parkComposition, measurePlotRelief, SEED_TABLE_128_BAND, WATER_LEVEL, waterBodyTarget, waterBodyGapMin, SECOND_WATER_MIN_FRAC, waterGridStep, buildTerrain };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_ring-pose.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const mp = await import(bundlePath);
const WL = mp.WATER_LEVEL;
const BAND = mp.SEED_TABLE_128_BAND;

// ---- the 16 ring cells as OFFSETS from the start pose [-42.6, -9.7] --------
const START0 = [-42.6, -9.7];
const RING0 = [
  ['deckW', [-42.6, -8.4]], ['deckN', [0, 34.2]], ['deckE', [42.6, -8.4]], ['deckS', [0, -51.0]],
  ['start', [-42.6, -9.7]],
  ['tailW', [-36.0, -8.4]], ['tailN', [0, 27.6]], ['tailE', [36.0, -8.4]], ['tailS', [0, -44.4]],
  ['anchW', [-40.81, -8.4]], ['anchN', [0, 32.41]], ['anchE', [40.81, -8.4]], ['anchS', [0, -49.21]],
  ['exitN', [-1.2, 33.03]], ['exitE', [41.43, -7.2]], ['exitS', [1.2, -49.83]],
];
const OFF = RING0.map(([n, c]) => [n, [c[0] - START0[0], c[1] - START0[1]]]);
const poseCells = (sx, sz) => OFF.map(([n, o]) => [n, [+(sx + o[0]).toFixed(2), +(sz + o[1]).toFixed(2)]]);

// legal start range at 128 on the 1.2 lattice
const XS = [], ZS = [];
for (let x = -63.6; x <= -21.6 + 1e-6; x += 1.2) XS.push(+x.toFixed(1));
for (let z = -22.9; z <= 20.4 + 1e-6; z += 1.2) ZS.push(+(START0[1] + Math.round((z - START0[1]) / 1.2) * 1.2).toFixed(1));
const ZUNIQ = [...new Set(ZS)].filter((z) => z >= -23.0 && z <= 20.4);
const XUNIQ = [...new Set(XS.map((x) => +(START0[0] + Math.round((x - START0[0]) / 1.2) * 1.2).toFixed(1)))].filter((x) => x >= -64.3 && x <= -20.9);

const DENSE_CELLS = (() => {
  const seen = new Set(); const out = [];
  const add = (x, z) => { const k = `${x.toFixed(1)},${z.toFixed(1)}`; if (!seen.has(k)) { seen.add(k); out.push([x, z]); } };
  for (const z of [-30, -10, 10, 30]) for (let x = -48; x <= 48 + 1e-6; x += 1.2) add(+x.toFixed(1), z);
  for (const x of [-30, 0, 30]) for (let z = -48; z <= 48 + 1e-6; z += 1.2) add(x, +z.toFixed(1));
  return out;
})();

function buildFrom(comp, S, seg = SEG) {
  const lf = comp.landform;
  return mp.buildTerrain(THREE, {
    size: S, seg, seed: comp.terrainSeed,
    amplitude: lf.amplitude, scale: lf.scale, octaves: lf.octaves, roughness: lf.roughness,
    reliefBias: lf.reliefBias, flatSpots: lf.flatSpots, waterLevel: WL,
    peaks: [...comp.peaks, ...(comp.clampPeaks ?? [])],
    basins: [...comp.basins, ...(comp.clampBasins ?? [])],
    firmShore: true, edgeSkirt: false,
  });
}
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
const moved = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity);

// ---- the unguarded row -----------------------------------------------------
const bare = mp.parkComposition(THREE, SEED, SIZE, CLIMATE);
const bareT = buildFrom(bare, SIZE);
const bm = mp.measurePlotRelief(bareT.heightAt, SIZE);
const bareBasins = [...bare.basins, ...(bare.basinsSecond ?? [])];
const barePeaks = bare.peaks;
const bareDry = (x, z, m = 1.2) => bareBasins.every((b) => Math.hypot(x - b.x, z - b.z) > 0.74 * b.radius + m);
const bareBump = (x, z) => Math.max(0, ...barePeaks.map((p) => {
  const k = Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / p.radius);
  return k * k * (3 - 2 * k) * p.height;
}));
console.log(`\n=== seed ${SEED} ${CLIMATE} @ ${SIZE}: UNGUARDED relief ${r2(bm.relief)} / stdH ${r2(bm.stdH)} · ${bare.landform.style} amp ${r2(bare.landform.amplitude)} · terrainSeed ${bare.terrainSeed} · probes ${bare.report.probesTried}`);
console.log(`  basins: ${bareBasins.map((b) => `(${r2(b.x)}, ${r2(b.z)}) r${r2(b.radius)} wl${r2(0.74 * b.radius)}`).join(' ')}`);
console.log(`  peaks:  ${barePeaks.slice().sort((a, b) => b.height - a.height).slice(0, 6).map((p) => `(${r2(p.x)}, ${r2(p.z)}) h${r2(p.height)} r${r2(p.radius)}`).join(' ')}`);
console.log(`  legal poses: ${XUNIQ.length} x × ${ZUNIQ.length} z = ${XUNIQ.length * ZUNIQ.length}`);

// ---- PAPER pass over every legal pose --------------------------------------
const lim = SIZE / 2 - 0.7;
const paper = [];
for (const sx of XUNIQ) for (const sz of ZUNIQ) {
  const cells = poseCells(sx, sz);
  if (cells.some(([, c]) => Math.max(Math.abs(c[0]), Math.abs(c[1])) > lim)) continue;
  const wet = cells.filter(([, c]) => !bareDry(c[0], c[1]));
  const bumps = cells.map(([n, c]) => ({ n, b: bareBump(c[0], c[1]) }));
  const worstBump = Math.max(...bumps.map((b) => b.b));
  paper.push({
    sx, sz, wet: wet.length, wetNames: wet.map(([n]) => n),
    worstBump: r2(worstBump),
    // how far the 16 cells sit from the nearest basin waterline (bigger = safer)
    slack: r2(Math.min(...cells.map(([, c]) => Math.min(...bareBasins.map((b) => Math.hypot(c[0] - b.x, c[1] - b.z) - 0.74 * b.radius))))),
  });
}
paper.sort((a, b) => a.wet - b.wet || b.slack - a.slack || a.worstBump - b.worstBump);
console.log(`  in bounds: ${paper.length} poses · ${paper.filter((p) => p.wet === 0).length} with 0 paper-wet cells`);

// ---- MECHANICAL pass on the best `TOP` -------------------------------------
const rows = [];
for (const p of paper.slice(0, TOP)) {
  const cells = poseCells(p.sx, p.sz);
  const keep = cells.map(([, c]) => c);
  const g = mp.parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: keep });
  const gT = buildFrom(g, SIZE);
  const gm = mp.measurePlotRelief(gT.heightAt, SIZE);
  const basins = [...g.basins, ...(g.basinsSecond ?? [])];
  const isDry = (x, z, m = 1.2) => basins.every((b) => Math.hypot(x - b.x, z - b.z) > 0.74 * b.radius + m);
  const bumpAt = (x, z) => Math.max(0, ...g.peaks.map((q) => {
    const k = Math.max(0, 1 - Math.hypot(x - q.x, z - q.z) / q.radius);
    return k * k * (3 - 2 * k) * q.height;
  }));
  const info = cells.map(([n, c]) => ({ n, at: c, h: r2(gT.heightAt(c[0], c[1])), bump: r2(bumpAt(c[0], c[1])), dry: isDry(c[0], c[1]) }));
  gT.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  const decks = info.filter((c) => c.n.startsWith('deck'));
  const rf = g.report.reliefFloor;
  const row = {
    sx: p.sx, sz: p.sz,
    movedDominant: r2(moved(bare.waterCentre, g.waterCentre)),
    movedSecondary: r2(moved(bare.waterCentreSecond, g.waterCentreSecond)),
    terrainSeed: `${bare.terrainSeed}→${g.terrainSeed}`,
    probes: `${bare.report.probesTried}→${g.report.probesTried}`,
    violations: g.report.violations.length,
    clamps: `${(g.clampPeaks ?? []).length}+${(g.clampBasins ?? []).length}`,
    ringRelief: r2(gm.relief), ringStdH: r2(gm.stdH),
    kept: rf ? r2(rf.kept) : null, keptOk: rf ? rf.ok : null,
    decksDry: decks.every((d) => d.dry && d.h > 0),
    minDeckH: r2(Math.min(...decks.map((d) => d.h))),
    worstBump: r2(Math.max(...info.map((c) => c.bump))),
    wet: info.filter((c) => !c.dry).map((c) => c.n),
    apron: r2(g.report.apronMaxAbs),
  };
  row.ringClean = row.movedDominant <= 1 && row.movedSecondary <= 1 && row.violations === 0;
  row.ok = row.ringClean && row.decksDry && row.worstBump <= 0.75 && row.apron <= 0.45;
  if (row.ok && !flag('noDense')) {
    const d = mp.parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: [...keep, ...DENSE_CELLS] });
    const dT = buildFrom(d, SIZE);
    const dm = mp.measurePlotRelief(dT.heightAt, SIZE);
    dT.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    const dfl = d.report.reliefFloor;
    row.dense = {
      relief: r2(dm.relief), stdH: r2(dm.stdH), kept: dfl ? r2(dfl.kept) : null, keptOk: dfl ? dfl.ok : null,
      belowBand: dm.relief < BAND.relief[0] || dm.stdH < BAND.stdH[0],
      movedDominant: r2(moved(bare.waterCentre, d.waterCentre)),
      movedSecondary: r2(moved(bare.waterCentreSecond, d.waterCentreSecond)),
      violations: d.report.violations.length,
    };
    row.dense.fatal = !!(dfl && !dfl.ok) && row.dense.belowBand;
  }
  rows.push(row);
}
bareT.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });

if (flag('json')) { console.log(JSON.stringify({ seed: SEED, climate: CLIMATE, authoredRelief: r2(bm.relief), authoredStdH: r2(bm.stdH), paper, rows }, null, 1)); process.exit(0); }
rows.sort((a, b) => (b.ok - a.ok) || (a.movedDominant + a.movedSecondary) - (b.movedDominant + b.movedSecondary));
console.log('\n  start(x,z)   movD  movS viol terrainSeed  probes clamps | ringRel ringStd kept | decksDry minDeckH worstBump wet | dense(rel/std/kept/FATAL) | OK');
for (const r of rows) {
  const d = r.dense;
  console.log(
    `  ${String(r.sx).padStart(6)},${String(r.sz).padStart(6)} ${String(r.movedDominant).padStart(6)} ${String(r.movedSecondary).padStart(5)} ${String(r.violations).padStart(4)} ` +
    `${r.terrainSeed.padEnd(11)} ${r.probes.padEnd(6)} ${r.clamps.padEnd(6)} | ${String(r.ringRelief).padStart(7)} ${String(r.ringStdH).padStart(7)} ${String(r.kept).padStart(4)} | ` +
    `${String(r.decksDry).padStart(8)} ${String(r.minDeckH).padStart(8)} ${String(r.worstBump).padStart(9)} ${(r.wet.join(',') || '—').padEnd(12)} | ` +
    `${(d ? `${d.relief}/${d.stdH}/${d.kept}/${d.fatal ? 'FATAL' : 'ok'}` : '—').padEnd(25)} | ${r.ok ? 'OK' : ''}`,
  );
}
const good = rows.filter((r) => r.ok && (!r.dense || !r.dense.fatal));
console.log(`\n  ${good.length} pose(s) ring-clean + dry decks + flat + dense-survivable: ${good.map((r) => `[${r.sx}, ${r.sz}]`).join(' ') || 'none'}`);
