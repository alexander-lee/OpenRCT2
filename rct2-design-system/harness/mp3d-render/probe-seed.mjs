#!/usr/bin/env node
// headless composition probe: water disc, peaks and the ground under a
// candidate street node list — the arithmetic rules/park-generation.md §1
// tells authors to do before placing anything.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));

// minimal DOM stub — buildTerrain builds canvas textures for its materials
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? { width: 8, height: 8 } : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4 * 64) }) : () => {}) });
globalThis.document = {
  createElement: () => ({ width: 8, height: 8, getContext: () => ctx2d, toDataURL: () => '' }),
  createElementNS: () => ({ width: 8, height: 8, getContext: () => ctx2d }),
};
globalThis.window = globalThis;
globalThis.self = globalThis;


const MP3D = path.resolve(HARNESS, '..', '..', 'mp3d');
const src = `
import { parkComposition, terrainLint, WATER_LEVEL } from ${JSON.stringify(path.join(MP3D, 'components/ParkBuilder'))};
import { buildTerrain } from ${JSON.stringify(path.join(MP3D, 'components/TerrainKit'))};
export { parkComposition, buildTerrain, terrainLint, WATER_LEVEL };
`;
const ep = path.join(HARNESS, 'out', '_probe-seed.ts');
fs.mkdirSync(path.dirname(ep), { recursive: true });
fs.writeFileSync(ep, src);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HARNESS, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(HARNESS, 'out', '_probe-seed.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const mod = await import(bundlePath);

const [, , seedArg, climate = 'temperate', sizeArg = '192'] = process.argv;
const seed = Number(seedArg);
const size = Number(sizeArg);
const keepDry = JSON.parse(process.env.KEEPDRY || 'null');
const coasterPts = JSON.parse(process.env.COASTERPTS || 'null');
const guards = keepDry || coasterPts ? { ...(keepDry ? { keepDry } : {}), ...(coasterPts ? { coasterPts } : {}) } : undefined;
const comp = mod.parkComposition(THREE, seed, size, climate, guards);
if (guards) console.log(`  (GUARDED probe: ${keepDry ? keepDry.length : 0} keepDry cells${coasterPts ? ', coasterPts' : ''})`);
// BUILD FROM comp.landform (wave 8): the base heightfield is a per-seed
// LANDFORM ARCHETYPE now, not the old TERRAIN_BASE constant — probing against
// amplitude 0.38 / scale 0.52·S reported ground heights the park never has.
// Segment rule mirrors <Terrain>'s own segOf so heightAt matches the mesh.
const lf = comp.landform;
const segOf = (sz) => Math.min(Math.round(sz * 6.9), Math.max(220, Math.round(sz / 0.45)));
const terrain = mod.buildTerrain(THREE, {
  size, seg: segOf(size), seed: comp.terrainSeed,
  amplitude: lf.amplitude, scale: lf.scale, octaves: lf.octaves, roughness: lf.roughness,
  reliefBias: lf.reliefBias, flatSpots: lf.flatSpots,
  waterLevel: mod.WATER_LEVEL,
  peaks: [...comp.peaks, ...comp.clampPeaks], basins: [...comp.basins, ...comp.clampBasins],
  firmShore: true, edgeSkirt: false,
});
const wl = mod.WATER_LEVEL;
console.log(`seed ${seed} ${climate} size ${size}: waterKind ${comp.waterKind} centre [${comp.waterCentre.map((v) => v.toFixed(1))}]`);
console.log(`  basins: ${comp.basins.map((b) => `(${b.x.toFixed(1)},${b.z.toFixed(1)}) r${b.radius.toFixed(1)} wl-r~${(0.74 * b.radius).toFixed(1)}`).join(' ')}`);
console.log(`  peaks: ${comp.peaks.map((p) => `(${p.x.toFixed(1)},${p.z.toFixed(1)}) r${(p.radius ?? 0).toFixed(1)} h${(p.height ?? 0).toFixed(1)}`).join(' ')}`);
console.log(`  waterLevel ${wl}`);
const cells = JSON.parse(process.env.CELLS || '[]');
if (cells.length) {
  const gs = cells.map(([x, z]) => terrain.heightAt(x, z));
  const sorted = [...gs].sort((a, b) => a - b);
  console.log(`  probe cells: min ${sorted[0].toFixed(2)} median ${sorted[Math.floor(sorted.length / 2)].toFixed(2)} max ${sorted[sorted.length - 1].toFixed(2)}`);
  cells.forEach(([x, z], i) => {
    const h = gs[i];
    const flag = h < wl + 0.12 ? ' WET' : '';
    console.log(`    [${String(x).padStart(6)}, ${String(z).padStart(6)}] ground ${h.toFixed(2)}${flag}`);
  });
}
