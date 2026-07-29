#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-kit-draws.mjs — WHAT DOES THE KIT COST A REAL PARK?
//
// Kit's `tree` is the most-placed asset in the system, so its cost is measured
// in DRAW CALLS on a composed <Park>, not in a previews sheet. Detailing all 20
// SceneryPack pieces with loose primitives once took a measured park from 1148
// to 3374 draws, past the Stage's ~3000 budget; batching the two scattered
// offenders brought it back to 1477. Same lesson, same measurement.
//
// This mounts a 48-plot park (Terrain + Paths + GameManager + Gate + a
// registered ride so the queue lanes build) dressed with a REALISTIC Kit load —
// 160 trees across all four shapes at ParkBuilder's scale range, plus the
// street furniture — and reads the LIVE renderer counters off the Stage api
// (`canvas.__stageApi.stats()`), which are whole-frame totals including the
// shadow pass. Waits for onReady (a park that has not finished mounting is not
// a measurement) then lets the LOD scheduler settle.
//
//   node probe-kit-draws.mjs [--kit=after|before] [--wait=ms] [--json]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const waitMs = Number(arg('wait', 26000));
const WHICH = arg('kit', 'after');
const P = (rel) => JSON.stringify(path.join(REPO, rel));
// the BEFORE side reads the pre-pass snapshot, so both sides plant the same
// authored spots with the same seed and only the builders differ
const KIT = WHICH === 'before' ? JSON.stringify(path.join(HARNESS, 'kit-before-src')) : P('components/Kit');

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Park, Terrain, Paths, GameManager, Gate, Placed } from ${P('components/Park')};
import { FerrisWheel } from ${P('components/FerrisWheel')};
import { tree, bench, bin, hedge, fence, lamp, flowerBed, rock, statue, foodStall, fountain } from ${KIT};

const hash01 = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

const NODES = [[-12, 21.6], [-12, 12], [-12, 2.4], [0, 2.4], [12, 2.4], [12, -9.6], [0, -9.6], [-12, -9.6]];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2]];

// 160 TREES in four shapes over ParkBuilder/dressing's scale range (0.55–0.95),
// on a hashed scatter with the path corridors and the gate forecourt kept clear.
const SHAPES = ['round', 'pine', 'palm', 'willow'];
const TREES = [];
for (let i = 0; TREES.length < 160 && i < 4000; i += 1) {
  const x = (hash01(i * 3 + 11) - 0.5) * 46;
  const z = (hash01(i * 3 + 12) - 0.5) * 46;
  // keep off the street skeleton (its edges are axis-aligned at ±12 / 2.4 / −9.6)
  const nearRow = Math.min(Math.abs(z - 2.4), Math.abs(z + 9.6), Math.abs(z - 21.6));
  const nearCol = Math.min(Math.abs(x + 12), Math.abs(x - 12), Math.abs(x));
  if (nearRow < 2.4 && Math.abs(x) < 24) continue;
  if (nearCol < 2.4 && Math.abs(z) < 24) continue;
  if (z > 17 && Math.abs(x) < 6) continue; // gate forecourt
  if (Math.abs(x - 6.69) < 6 && Math.abs(z + 15.6) < 6) continue; // the ride plot
  if (TREES.some((o) => Math.hypot(o[0] - x, o[1] - z) < 1.5)) continue;
  TREES.push([x, z, SHAPES[Math.floor(hash01(i * 3 + 13) * 4) % 4], 0.55 + hash01(i * 3 + 14) * 0.4]);
}
// the street furniture, along the two main streets
const FURN = [];
for (let i = 0; i < 12; i += 1) {
  const z = -8 + i * 2.6;
  FURN.push({ k: 'bench', at: [-14.4, z] });
  FURN.push({ k: 'bin', at: [-9.6, z] });
  if (i % 2 === 0) FURN.push({ k: 'lamp', at: [-14.4, z + 1.3] });
  if (i % 3 === 0) FURN.push({ k: 'hedge', at: [14.4, z] });
  if (i % 4 === 0) FURN.push({ k: 'fence', at: [19.2, z] });
}
[['flowerBed', [4.8, 7.2]], ['flowerBed', [-4.8, 7.2]], ['rock', [16.8, 16.8]], ['rock', [-18, -16.8]],
 ['statue', [0, 9.6]], ['foodStall', [4.8, -4.8]], ['fountain', [-4.8, -4.8]]].forEach(([k, at]) => FURN.push({ k, at }));
const MAKE = { bench, bin, lamp, hedge: (t) => hedge(t, 2), fence: (t) => fence(t, 2), flowerBed, rock,
  statue: (t) => statue(t, 'knight'), foodStall, fountain };

function KitLoadPark() {
  return (
    <Park seed={7} climate="temperate" size={48} guests={8} fullscreen
      onReady={(r) => { window.__parkReport = r ?? { skipped: true }; }}>
      <Terrain />
      <Paths nodes={NODES} edges={EDGES} walkers={4} />
      <GameManager />
      <Gate position={[-12, 21.6]} />
      <FerrisWheel position={[6.69, -15.6]} rotation={-Math.PI / 2}
        register={{ name: 'Grand Wheel', capacity: 4, rideDuration: 8, price: 3, intensity: 3 }} />
      {TREES.map(([x, z, shape, scale], i) => (
        <Placed key={'t' + i} build={(t) => tree(t, { shape, scale })} position={[x, z]} rotation={hash01(i * 7 + 3) * 6.28} />
      ))}
      {FURN.map((f, i) => (
        <Placed key={'f' + i} build={MAKE[f.k]} position={f.at} rotation={hash01(i * 5 + 9) * 6.28} />
      ))}
    </Park>
  );
}
createRoot(document.getElementById('root')).render(React.createElement(KitLoadPark));
`;
const entryPath = path.join(HARNESS, 'out', `_kit-draws-${WHICH}.tsx`);
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

const bundle = await build({
  entryPoints: [entryPath],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  target: 'chrome120',
  logLevel: 'silent',
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});
const htmlPath = path.join(HARNESS, 'out', `kit-draws-${WHICH}.html`);
fs.writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const lines = [];
page.on('console', (m) => lines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
const t0 = Date.now();
await page
  .waitForFunction('window.__parkReport !== undefined', null, { timeout: 300000 })
  .catch(() => console.log('[harness] onReady never fired — numbers below are NOT settled'));
const readyMs = Date.now() - t0;
await page.waitForTimeout(waitMs); // let the LOD scheduler classify + settle

const r = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  if (!api) return { error: 'no __stageApi' };
  let meshes = 0;
  let tris = 0;
  let hidden = 0;
  api.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    if (!o.visible) hidden += 1;
    const g = o.geometry;
    const n = g.index ? g.index.count : (g.getAttribute('position') || { count: 0 }).count;
    tris += n / 3;
  });
  const s = api.stats ? api.stats() : null;
  const rep = window.__parkReport;
  return {
    drawCalls: s && s.drawCalls,
    frameTris: s && s.triangles,
    fps: s && s.fps,
    sceneMeshes: meshes,
    sceneTris: Math.round(tris),
    hiddenMeshes: hidden,
    parkOk: rep ? rep.ok : null,
    failures: rep && rep.failures ? rep.failures.length : null,
  };
});
if (process.argv.includes('--json')) console.log(JSON.stringify({ kit: WHICH, readyMs, ...r }, null, 2));
else {
  console.log(`\n  kit-load park (48 plot, 160 trees + street furniture) · kit=${WHICH} · ready in ${(readyMs / 1000).toFixed(1)}s\n`);
  for (const [k, v] of Object.entries(r)) console.log(`    ${k.padEnd(18)} ${v}`);
  const bad = lines.filter((l) => /pageerror|\[error\]/.test(l)).slice(0, 6);
  if (bad.length) console.log(`\n  page errors:\n${bad.map((b) => '    ' + b).join('\n')}`);
  console.log('');
}
await browser.close();
