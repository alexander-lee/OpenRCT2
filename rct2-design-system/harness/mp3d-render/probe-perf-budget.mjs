#!/usr/bin/env node
// ---------------------------------------------------------------------------
// PERF-BUDGET CHECK — a pass/fail gate over a composed park's render cost.
//
//   node probe-perf-budget.mjs [--park=<abs .tsx>] [--export=DemoPark]
//                             [--budget=<name>] [--json]
//   exit 0 = every assertion holds, 1 = at least one FAILED
//
// WHY A SEPARATE TOOL FROM `probe-render-cost.mjs`. That one EXPLAINS a park's
// cost (per-entry attribution, in-page A/B of candidate optimisations) and takes
// minutes. This one ASSERTS the properties a regression would break, so it can
// be run in a check list. It reuses nothing but the readiness protocol, on
// purpose: the two disagreeing is itself information.
//
// THE ASSERTIONS, and the defect each one is here to catch:
//
//  1. `darkLightsCulled` — every Point/SpotLight at intensity 0 is
//     `visible === false`. THE DEFECT: three.js only drops a light from a
//     material's forward light loop when it is invisible, so the fleet's
//     night-gated lamps (all of which sit at intensity 0 by day) were each
//     costing a full per-fragment PBR iteration for a zero contribution.
//     Measured cost of losing this: +44% frame on DemoPark (size 16, 21 of 24
//     lights dark) and +73% on monorail-ref (size 128, 41 of 41 dark).
//     Owner: `mp3d/components/Stage/darkLights.ts`.
//
//  2. `statsMatchesRenderer` — `api.stats()`'s draw/triangle counts equal an
//     independent `renderer.info` reading of an explicit render. THE DEFECT: a
//     stats line nobody can cross-check is how a 6x under-report survived.
//
//  3. `fpsIsHonest` — `stats().fps` is within 3x of the rate `stats().frameMs`
//     implies. THE DEFECT, twice over: `fps` was a rolling average of `1/dt`
//     over the loop's CLAMPED dt (max 0.1 s), so it could not report below 10
//     at all; and E[1/dt] is biased high regardless (half 50 ms + half 500 ms
//     frames average to "11 fps" at a real 3.6). A park at 1.4 real fps read
//     "13.6 fps", and every perf number in this project was read off it.
//
//  4. `perfLineIsSettled` — the park's own `[Park] perf:` line reports the same
//     draw count as this probe sees, within `perfLineTol`. THE DEFECT: the line
//     was armed on a fixed 3 s timer BEFORE the build queue drained and
//     reported 293 draws / 9 runtime entries for a park that has 1874 / 29.
//
//  5. `drawBudget` / `triBudget` — SETUP.md §13's park reference points
//     (≲3000 draws, ≲2.5M triangles per frame, all passes).
//
//  6. `meshBudget` — the number of VISIBLE Mesh/InstancedMesh nodes in the
//     scene graph. THE DEFECT: the two budgets above are both counters of what
//     the GPU is asked to do, and on a real GPU that is not where a park's frame
//     goes. Measured with `probe-frame-cost.mjs --gpu=metal` (real Apple M4 Pro,
//     not SwiftShader) on a size-128 park:
//
//       cutting the backing store 2.25x (pixelRatio 1.5 -> 1)   +2%   (nothing)
//       pulling the camera far plane in to 35%                  -1%   (nothing)
//       hiding 75 guests: 2807 -> 1869 draws                   -31%
//       restoring 117 dark lights                             +131%
//
//     and `cpuMs` (submit only, no gl.finish) came out EQUAL to `gpuMs`
//     (9.53 vs 9.19). The frame is CPU-bound in three.js's per-object
//     `projectObject` walk + frustum test + draw submission, so its real driver
//     is HOW MANY NODES the renderer must walk, and triangles are nearly free:
//     the 2026-07-27 detailing pass added +32% triangles and the same park got
//     22% FASTER (3.59 -> 2.81 ms) because it removed draws and lights.
//     `triBudget` therefore cannot catch the regression that actually hurts;
//     this one can. Owner: whatever component stopped batching.
//
// ---- WHICH RENDERER PRODUCED A NUMBER ALWAYS MATTERS ----------------------
// This probe still launches SwiftShader, because its job is to assert COUNTS
// (draws, triangles, meshes, lights), which are renderer-independent. It
// deliberately asserts nothing about milliseconds: a software rasteriser's frame
// time is dominated by per-fragment work and is not the user's frame time. The
// same build read 31.6 fps here while the in-page line said 7.6. For a TIME,
// use `probe-frame-cost.mjs --gpu=metal`, which prints the unmasked GL renderer
// string with every result.
//
// EVERY ASSERTION IS A REPORT, NEVER A THROW. This is a harness tool, but the
// same rule the design system's own lints follow applies: a structural throw
// hides the numbers that would fix the problem.
//
// ---- HOW THIS CHECK WAS PROVED TO FAIL ------------------------------------
// Assertion 1 was verified against a DELIBERATE regression: with
// `darkCull.tick(dt)` commented out of the Stage loop, the run printed
//   FAIL darkLightsCulled  21 of 24 point/spot lights sit at intensity 0 but
//                          are still visible …
// and exited 1. Restored, it prints `pass` and exits 0. See the harness report.
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
const parkFile = arg('park', path.join(REPO, 'components/Park/Park.previews.tsx'));
const exportName = arg('export', 'DemoPark');
const JSON_OUT = process.argv.includes('--json');

// SETUP.md §13 park reference points. `perfLineTol` is a FRACTION, not an
// absolute: the gate stream keeps admitting guests for seconds after the park
// validates, so the perf line and a later reading legitimately differ a little.
const BUDGET = { drawCalls: 3000, triangles: 2_500_000, meshes: 8000, perfLineTol: 0.12 };

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as M from ${JSON.stringify(parkFile)};
const named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));
const C = M[${JSON.stringify(exportName)}] || M.default || (named[0] || [])[1];
if (!C) console.error('[probe-perf-budget] no component export found');
else createRoot(document.getElementById('root')).render(React.createElement(C));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-perf-budget.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

const componentAlias = {
  name: 'mp3d-components',
  setup(b) {
    b.onResolve({ filter: /(^|\/)components\// }, (args) => {
      if (args.path.startsWith('/')) return null;
      const rel = args.path.slice(args.path.indexOf('components/'));
      const base = path.join(REPO, rel);
      for (const cand of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')])
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return { path: cand };
      return null;
    });
  },
};

const bundle = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent',
  plugins: [componentAlias],
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});

const htmlPath = path.join(HARNESS, 'out', 'perf-budget.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const lines = [];
page.on('console', (m) => { const t = m.text(); if (!/GL Driver|ReadPixels/.test(t)) lines.push(t); });
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });

// readiness: the report if the park wires onReady, else the verdict line
let ready = false;
for (let i = 0; i < 240 && !ready; i += 1) {
  await page.waitForTimeout(500);
  ready = (await page.evaluate(() => !!window.__parkReport)) || lines.some((l) => /validatePark →/.test(l));
}
if (!ready) {
  // PRINT WHAT THE PAGE SAID. "park never reported" on its own cannot be acted
  // on: it is the same message for a park that threw at module scope, a park
  // whose export is not a component, and a park that simply needed a longer
  // settle window under SwiftShader — and the collected console/pageerror lines
  // say which. They were being thrown away.
  console.error('probe-perf-budget: park never reported after 120 s of polling.');
  console.error(`  console/pageerror lines captured: ${lines.length}`);
  for (const l of lines.slice(0, 40)) console.error(`  | ${l}`);
  await browser.close();
  process.exit(1);
}

// then wait for the scene to stop growing (the guest stream), AND for the park's
// own perf line — assertion 4 has nothing to compare against without it
let last = -1;
let stable = 0;
for (let i = 0; i < 90; i += 1) {
  const s = await page.evaluate(() => document.querySelector('canvas')?.__stageApi?.stats?.() ?? null);
  if (!s) break;
  stable = s.drawCalls === last ? stable + 1 : 0;
  last = s.drawCalls;
  if (stable >= 5 && lines.some((l) => l.includes('[Park] perf:'))) break;
  await page.waitForTimeout(400);
}

const m = await page.evaluate(() => {
  const api = document.querySelector('canvas').__stageApi;
  const { scene, camera, renderer } = api;
  const stats = api.stats();
  const info = renderer.info;
  info.reset();
  renderer.render(scene, camera);
  const direct = { calls: info.render.calls, triangles: info.render.triangles };
  let meshes = 0;
  scene.traverseVisible((o) => { if (o.isMesh || o.isInstancedMesh) meshes += 1; });
  const lights = { total: 0, visible: 0, lit: 0, darkVisible: 0, names: [] };
  scene.traverse((o) => {
    if (!o.isPointLight && !o.isSpotLight) return;
    lights.total += 1;
    if (!o.visible) return;
    lights.visible += 1;
    if (o.intensity > 0.001) lights.lit += 1;
    else { lights.darkVisible += 1; if (lights.names.length < 12) lights.names.push(o.name || o.parent?.name || o.type); }
  });
  return { stats, direct, lights, meshes };
});
await browser.close();

const perfLine = lines.find((l) => l.includes('[Park] perf:')) ?? null;
const perfDraws = perfLine ? Number((perfLine.match(/perf: (\d+) draws/) ?? [])[1]) : null;

const checks = [];
const chk = (name, ok, detail) => checks.push({ name, ok, detail });

chk('darkLightsCulled', m.lights.darkVisible === 0,
  m.lights.darkVisible === 0
    ? `all ${m.lights.total} point/spot lights accounted for: ${m.lights.lit} lit, ${m.lights.total - m.lights.visible} culled`
    : `${m.lights.darkVisible} of ${m.lights.total} point/spot lights sit at intensity 0 but are still visible, so three.js still books each one a slot in every forward shader's light loop for a zero contribution (${m.lights.names.join(', ')}). Owner: mp3d/components/Stage/darkLights.ts — is darkCull.tick(dt) still called in the Stage loop?`);

const dCalls = Math.abs(m.stats.drawCalls - m.direct.calls);
chk('statsMatchesRenderer', dCalls <= Math.max(4, m.direct.calls * 0.05),
  `api.stats() ${m.stats.drawCalls} draws / ${m.stats.triangles} tris vs an independent renderer.info read ${m.direct.calls} / ${m.direct.triangles} (delta ${dCalls} draws)`);

// `frameMs` is the CPU work inside the loop and `fps` is the whole rAF gap, so
// fps <= 1000/frameMs always and the two are close under SwiftShader (rendering
// IS the CPU work). A ratio over 3 means fps is measuring something else — which
// is what both historical bugs looked like: the 10 fps floor from the clamped
// dt, and the high bias of averaging 1/dt instead of dt.
const impliedFps = m.stats.frameMs > 0 ? 1000 / m.stats.frameMs : null;
const ratio = impliedFps ? m.stats.fps / impliedFps : 1;
chk('fpsIsHonest', ratio <= 3,
  `stats().fps ${m.stats.fps} vs ${impliedFps === null ? 'n/a' : impliedFps.toFixed(1)} implied by frameMs ${m.stats.frameMs} (ratio ${ratio.toFixed(2)}, limit 3)${ratio > 3 ? ' — fps is not the real frame rate: it must be 1/mean(UNCLAMPED dt), not mean(1/dt) and not 1/mean(clamped dt). Stage/index.tsx statDt' : ''}`);

if (perfDraws === null) {
  chk('perfLineIsSettled', false, 'the park never printed a [Park] perf: line inside the poll window');
} else {
  const rel = Math.abs(perfDraws - m.direct.calls) / m.direct.calls;
  chk('perfLineIsSettled', rel <= BUDGET.perfLineTol,
    `[Park] perf: reported ${perfDraws} draws, the settled park renders ${m.direct.calls} (${(rel * 100).toFixed(1)}% off, tolerance ${(BUDGET.perfLineTol * 100).toFixed(0)}%)${rel > BUDGET.perfLineTol ? ' — is the perf line armed before ctx.whenBuilt() drains again?' : ''}`);
}

chk('drawBudget', m.direct.calls <= BUDGET.drawCalls, `${m.direct.calls} draws against SETUP.md §13's ~${BUDGET.drawCalls} park reference point`);
chk('triBudget', m.direct.triangles <= BUDGET.triangles, `${(m.direct.triangles / 1e6).toFixed(2)}M triangles against ~${(BUDGET.triangles / 1e6).toFixed(1)}M`);
chk('meshBudget', m.meshes <= BUDGET.meshes,
  `${m.meshes} visible Mesh/InstancedMesh nodes against a ${BUDGET.meshes} ceiling — this is the CPU-bound driver of the frame on a REAL GPU (see header assertion 6), where triangles are nearly free${m.meshes > BUDGET.meshes ? '. Batch with mergedBoxes/InstancedMesh: the fix is fewer NODES, not fewer triangles' : ''}`);

const failed = checks.filter((c) => !c.ok);
const out = { park: path.relative(REPO, parkFile), export: exportName, ok: failed.length === 0, checks, lights: m.lights, meshes: m.meshes, stats: m.stats, direct: m.direct, perfLine };
if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nPERF BUDGET — ${out.park} :: ${exportName}`);
  for (const c of checks) console.log(`  ${c.ok ? 'pass' : 'FAIL'} ${c.name.padEnd(20)} ${c.detail}`);
  console.log(`\n${failed.length ? `${failed.length} FAILED: ${failed.map((c) => c.name).join(', ')}` : 'all perf assertions hold'}`);
}
process.exit(failed.length ? 1 : 0);
