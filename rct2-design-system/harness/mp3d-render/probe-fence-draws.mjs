#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-fence-draws.mjs — WHAT DOES FENCING COST A REAL PARK?
//
// Fence is placed MANY times per park in LONG RUNS, so its cost is measured in
// DRAW CALLS on a composed <Park>, not in the previews. This mounts a real park
// (Terrain + Paths + GameManager + Gate + a registered ride, so the queue lanes
// build their own 'metal' railings) dressed with a realistic fencing load —
// a wood boundary with gateways, hedge loops round two beds, a picket run, a
// brick run — and reads the LIVE renderer counters off the Stage api
// (`canvas.__stageApi.stats()`), which are whole-frame totals including the
// shadow pass. The park runs long enough for the LOD scheduler to settle, so
// the number reported is what the park camera actually pays.
//
// Run it before and after a Fence change; the delta is the answer.
//
// `--styles=wood,hedge,metal` mounts only those runs — which is how the BEFORE
// number is taken, since the pre-change builder has no 'picket'/'brick' style
// and would throw on one. Same authored runs on both sides, or it is not a delta.
//
//   node probe-fence-draws.mjs [--styles=a,b] [--wait=ms] [--json]
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
const waitMs = Number(arg('wait', 12000));
const P = (rel) => JSON.stringify(path.join(REPO, rel));

// A 48-plot park with ~230 u of fencing in all five styles. Runs are authored in
// pairs with a GAP where a street crosses, which is how a boundary is fenced.
//
// guests = 0 / walkers = 0 DELIBERATELY: with 8 guests the scene mesh count moved
// 910 -> 988 between two runs of the SAME code (guests and path walkers mount and
// despawn on their own clock), and a draw count that drifts 78 meshes between runs
// cannot measure a 14-mesh change. Everything left in this park is static.
const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Park, Terrain, Paths, GameManager, Gate } from ${P('components/Park')};
import { Fence } from ${P('components/Fence')};
import { FerrisWheel } from ${P('components/FerrisWheel')};

const NODES = [[-12, 21.6], [-12, 12], [-12, 2.4], [0, 2.4], [12, 2.4], [12, -9.6], [0, -9.6], [-12, -9.6]];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2]];

// the park BOUNDARY: four sides, each split either side of the gate street
const B = 25.2;
const BOUNDARY = [
  { from: [-B, B], to: [-14.4, B] }, { from: [-9.6, B], to: [B, B] },
  { from: [B, B], to: [B, -B] },
  { from: [B, -B], to: [-B, -B] },
  { from: [-B, -B], to: [-B, B] },
];
const HEDGE_A = [[-6, 9.6], [-1.2, 9.6], [-1.2, 14.4], [-6, 14.4]];
const HEDGE_B = [[4.8, -4.8], [10.8, -4.8], [10.8, -0.6], [4.8, -0.6]];
const RUNS = [
  ...BOUNDARY.map((r) => ({ ...r, style: 'wood' })),
  { points: HEDGE_A, style: 'hedge' },
  { points: HEDGE_B, style: 'hedge' },
  { from: [-21.6, 4.8], to: [-14.4, 4.8], style: 'picket' },
  { from: [-21.6, 0], to: [-14.4, 0], style: 'picket' },
  { from: [14.4, 9.6], to: [21.6, 9.6], style: 'brick' },
  { from: [-21.6, -14.4], to: [-9.6, -14.4], style: 'metal' },
];
const USE = ${JSON.stringify(arg('styles', 'wood,hedge,metal,picket,brick').split(','))};

function FenceLoadPark() {
  return (
    <Park seed={7} climate="temperate" size={48} guests={0} fullscreen
      onReady={(r) => { window.__parkReport = r ?? { skipped: true }; }}>
      <Terrain />
      <Paths nodes={NODES} edges={EDGES} walkers={0} />
      <GameManager />
      <Gate position={[-12, 21.6]} />
      <FerrisWheel position={[6.69, -15.6]} rotation={-Math.PI / 2}
        register={{ name: 'Grand Wheel', capacity: 4, rideDuration: 8, price: 3, intensity: 3 }} />
      {RUNS.filter((r) => USE.indexOf(r.style) >= 0).map((r, i) =>
        r.points ? <Fence key={'f' + i} points={r.points} style={r.style} /> : <Fence key={'f' + i} from={r.from} to={r.to} style={r.style} />,
      )}
    </Park>
  );
}
createRoot(document.getElementById('root')).render(React.createElement(FenceLoadPark));
`;
const entryPath = path.join(HARNESS, 'out', '_fence-draws.tsx');
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
const htmlPath = path.join(HARNESS, 'out', 'fence-draws.html');
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
// WAIT FOR onReady, don't sample on a stopwatch. A fixed 26 s timeout sampled
// the FIRST attempt mid-build (554 meshes of a 910-mesh park) and the "before"
// number came out 250 draws lower than reality — a park that has not finished
// mounting is not a measurement.
const t0 = Date.now();
await page
  .waitForFunction('window.__parkReport !== undefined', null, { timeout: 240000 })
  .catch(() => console.log('[harness] onReady never fired — numbers below are NOT settled'));
const readyMs = Date.now() - t0;
await page.waitForTimeout(waitMs); // then let the LOD scheduler classify + settle

const r = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  if (!api) return { error: 'no __stageApi' };
  const scene = api.scene;
  let meshes = 0;
  let tris = 0;
  let hidden = 0;
  let detail = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    if (o.userData && o.userData.lodDetail) detail += 1;
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
    lodDetailMeshes: detail,
    hiddenMeshes: hidden,
    parkOk: rep ? rep.ok : null,
    failures: rep && rep.failures ? rep.failures.length : null,
    failureText: rep && rep.failures ? rep.failures.slice(0, 12).map((f) => (typeof f === 'string' ? f : f.label || f.reason || JSON.stringify(f)).slice(0, 120)) : null,
  };
});
r.readyMs = readyMs;
if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
else {
  console.log('\n  fence-load park (48 plot, ~230 u of fencing in 5 styles)\n');
  for (const [k, v] of Object.entries(r)) console.log(`    ${k.padEnd(18)} ${v}`);
  const bad = lines.filter((l) => /pageerror|\[error\]/.test(l)).slice(0, 6);
  if (bad.length) console.log(`\n  page errors:\n${bad.map((b) => '    ' + b).join('\n')}`);
  console.log('');
}
await browser.close();
