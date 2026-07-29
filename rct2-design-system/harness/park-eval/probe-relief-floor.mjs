#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-relief-floor.mjs — "is this park flattening its OWN terrain?"
//
// A park's `keepDry` / `coasterPts` guard list caps every hill peak its layout
// stands on (`capPeakForCells` / `capPeakForCoaster`, ParkBuilder/composition.ts).
// A large or badly-placed guard list therefore ERASES the ranges the seed drew
// and the park composes itself below every published §1 row — a flat green
// field, with nothing else failing. `validatePark`'s `terrainFlattened` check
// reports it at build time; this probe answers the same question BEFORE you
// commit to a layout, and shows the UNGUARDED composition beside the guarded one.
//
//   # a composed park sample: mount it, read the BUILT ground + the composition's
//   # own landform-character floor, and compare with its §1 row
//   node probe-relief-floor.mjs samples/hollowmere2.tsx
//
//   # a seed on its own, guarded vs unguarded — no park file needed
//   node probe-relief-floor.mjs --seed=7 --climate=coastal --size=128 \
//        --keepDry='[[0,63.6],[0,55.2]]' --coasterPts='[[24,0.55,39.6]]'
//
// Reads `relief` / `stdH` through the design system's OWN `measurePlotRelief`,
// so this probe, the §1 seed table and the gate can never disagree.
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';
import { bundleParkPage, openParkPage, defaultName, sleep } from './evaltags.mjs';

const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const parkFile = process.argv.slice(2).find((a) => !a.startsWith('--'));

// minimal DOM stub — buildTerrain paints canvas textures for its materials
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'canvas' ? { width: 8, height: 8 }
    : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
      : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4 * 64) }) : () => {}),
});
globalThis.document = {
  createElement: () => ({ width: 8, height: 8, getContext: () => ctx2d, toDataURL: () => '' }),
  createElementNS: () => ({ width: 8, height: 8, getContext: () => ctx2d }),
};
globalThis.window = globalThis;
globalThis.self = globalThis;

const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_relief-floor.ts');
fs.writeFileSync(ep, `
import { parkComposition, measurePlotRelief, seedTableRow, SEED_TABLE_128_BAND, SEED_TABLE_SIZE, WATER_LEVEL } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
import { buildTerrain } from ${JSON.stringify(path.join(REPO, 'components/TerrainKit'))};
export { parkComposition, measurePlotRelief, seedTableRow, SEED_TABLE_128_BAND, SEED_TABLE_SIZE, WATER_LEVEL, buildTerrain };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_relief-floor.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const mp = await import(bundlePath);

const segOf = (sz) => Math.min(Math.round(sz * 6.9), Math.max(220, Math.round(sz / 0.45)));
function buildFrom(comp, S) {
  const lf = comp.landform;
  return mp.buildTerrain(THREE, {
    size: S, seg: segOf(S), seed: comp.terrainSeed,
    amplitude: lf.amplitude, scale: lf.scale, octaves: lf.octaves, roughness: lf.roughness,
    reliefBias: lf.reliefBias, flatSpots: lf.flatSpots, waterLevel: mp.WATER_LEVEL,
    peaks: [...comp.peaks, ...comp.clampPeaks], basins: [...comp.basins, ...comp.clampBasins],
    firmShore: true, edgeSkirt: false,
  });
}
const f2 = (v) => (v === null || v === undefined ? '—' : (+v).toFixed(2));

/** the published §1 verdict for a measured (relief, stdH) at this size */
function bandVerdict(m, S) {
  if (S !== mp.SEED_TABLE_SIZE) return `  (no published band at size ${S} — the §1 table is generated at ${mp.SEED_TABLE_SIZE})`;
  const B = mp.SEED_TABLE_128_BAND;
  const lowR = m.relief < B.relief[0];
  const lowS = m.stdH < B.stdH[0];
  return `  §1 band @${S}: relief ${B.relief[0]}-${B.relief[1]}, stdH ${B.stdH[0]}-${B.stdH[1]} → ${
    lowR || lowS ? `BELOW THE BAND${lowR ? ' (relief)' : ''}${lowS ? ' (stdH)' : ''} — the horizon reads FLAT` : 'inside the band'
  }`;
}

function printFloor(fl, indent = '  ') {
  if (!fl) {
    console.log(`${indent}landform-character floor: n/a (unguarded composition, or a plot ≤ 48 — neither composes differently)`);
    return;
  }
  console.log(
    `${indent}landform-character floor: kept ${(100 * fl.kept).toFixed(0)}% (relief ${(100 * fl.keptRelief).toFixed(0)}%, stdH ${(
      100 * fl.keptStdH
    ).toFixed(0)}%) of the seed's UNCAPPED ${f2(fl.authoredRelief)} / ${f2(fl.authoredStdH)} — floor ${(100 * fl.floor).toFixed(0)}% → ${
      fl.ok ? 'OK' : 'MISSED (the guards flattened this park)'
    }`,
  );
  console.log(`${indent}${fl.guardedRanges} range(s) had to be placed on guarded ground`);
  if (fl.cappedPeaks.length) {
    console.log(`${indent}ranges the guards cost (worst first):`);
    for (const p of fl.cappedPeaks.slice(0, 8))
      console.log(
        `${indent}  (${p.at[0]}, ${p.at[1]}) h ${p.authoredH} → ${p.keptH}${
          p.culprits.length ? `   guard cells: ${p.culprits.slice(0, 4).map((c) => `[${(+c[0]).toFixed(1)}, ${(+c[1]).toFixed(1)}]`).join(' ')}` : ''
        }`,
      );
  }
}

if (parkFile) {
  // ---- a composed park: mount it and read the ground it actually BUILT -------
  const name = defaultName(parkFile);
  const htmlPath = await bundleParkPage(parkFile, name);
  const { browser, page } = await openParkPage(htmlPath, { waitMs: Number(arg('wait', '12000')), echo: false });
  await sleep(1200);
  const got = await page.evaluate(() => {
    const s = window.__evalPark;
    if (!s || !s.ground) return { error: 'no ParkStore ground — is this a <Park>?' };
    const g = s.ground;
    return {
      size: g.size,
      climate: g.comp?.climate ?? null,
      seed: g.comp?.seed ?? null,
      peaks: (g.comp?.peaks ?? []).length,
      maxPeakH: Math.max(0, ...(g.comp?.peaks ?? []).map((p) => p.height)),
      keepDry: (g.keepDry ?? []).length,
      coasterXZ: (g.comp?.coasterXZ ?? []).length,
      reliefFloor: g.comp?.report?.reliefFloor ?? null,
      // sample the BUILT heightfield on the design system's own grid
      grid: (() => {
        const S = g.size, half = S / 2, N = 48, hs = [];
        for (let i = 0; i < N; i += 1) for (let j = 0; j < N; j += 1) hs.push(g.heightAt(-half + ((i + 0.5) * S) / N, -half + ((j + 0.5) * S) / N));
        return hs;
      })(),
    };
  });
  await browser.close();
  if (got.error) { console.error(got.error); process.exit(1); }
  const so = [...got.grid].sort((a, b) => a - b);
  const mean = got.grid.reduce((a, b) => a + b, 0) / got.grid.length;
  const m = { relief: so[so.length - 1] - so[0], stdH: Math.sqrt(got.grid.reduce((a, b) => a + (b - mean) ** 2, 0) / got.grid.length) };
  console.log(`\n=== ${parkFile}  (size ${got.size}, ${got.climate}, ${got.keepDry} keepDry cells, ${got.coasterXZ} coaster points)`);
  console.log(`  BUILT terrain: relief ${f2(m.relief)}  stdH ${f2(m.stdH)}  ·  ${got.peaks} peaks, max h ${f2(got.maxPeakH)}`);
  console.log(bandVerdict(m, got.size));
  printFloor(got.reliefFloor);
} else {
  // ---- a seed on its own: guarded vs unguarded -------------------------------
  const seed = Number(arg('seed', '7'));
  const climate = arg('climate', 'coastal');
  const S = Number(arg('size', '128'));
  const keepDry = JSON.parse(arg('keepDry', 'null'));
  const coasterPts = JSON.parse(arg('coasterPts', 'null'));
  const guards = keepDry || coasterPts ? { ...(keepDry ? { keepDry } : {}), ...(coasterPts ? { coasterPts } : {}) } : null;
  const show = (label, comp) => {
    const terrain = buildFrom(comp, S);
    const m = mp.measurePlotRelief(terrain.heightAt, S);
    terrain.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    console.log(`\n${label}: relief ${f2(m.relief)}  stdH ${f2(m.stdH)}  ·  ${comp.peaks.length} peaks, max h ${f2(Math.max(0, ...comp.peaks.map((p) => p.height)))}`);
    console.log(bandVerdict(m, S));
    printFloor(comp.report.reliefFloor);
    return m;
  };
  const row = mp.seedTableRow(seed, climate, S);
  console.log(`\n=== seed ${seed} ${climate} @ ${S}${row ? `  ·  §1 row publishes relief ${row.relief} / stdH ${row.stdH}` : '  (not a published §1 row)'}`);
  const mu = show('UNGUARDED', mp.parkComposition(THREE, seed, S, climate));
  if (guards) {
    const mg = show(`GUARDED (${keepDry ? keepDry.length : 0} keepDry, ${coasterPts ? coasterPts.length : 0} coasterPts)`, mp.parkComposition(THREE, seed, S, climate, guards));
    console.log(`\n  guards cost: relief ×${(mg.relief / mu.relief).toFixed(2)}  stdH ×${(mg.stdH / mu.stdH).toFixed(2)}`);
  } else console.log('\n  (pass --keepDry / --coasterPts to see what YOUR layout costs this seed)');
}
