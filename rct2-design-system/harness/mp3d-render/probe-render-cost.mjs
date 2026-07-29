#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RENDER-COST probe — a STABLE per-frame render number for a composed park,
// plus per-entry attribution.
//
// WHY THIS EXISTS. `validate-react-park.mjs` prints a `[STATS]` line read off
// `canvas.__stageApi.stats()` at whatever instant the harness happened to poll,
// and `<Park>`'s own `[Park] perf:` line fires on a FIXED 3 s timer started at
// the settle effect. Neither is a measurement of a finished park:
//
//   * `[Park] perf:` is armed BEFORE `ctx.whenBuilt()` drains the time-sliced
//     build queue, so on a park that takes longer than 3 s to assemble it
//     reports a HALF-BUILT scene. Measured on DemoPark: the perf line said
//     `293 draws / 0.14M tris / 9 runtime entries` while the finished park is
//     ~1780 draws / 0.40M tris / 22 entries. It under-reports ~6x.
//   * `stats().fps` CANNOT go below 10. The Stage loop clamps
//     `dt = min(max(t - lastT, 0), 0.1)` before feeding `1/dt` into the rolling
//     average, so a park running at 0.7 real fps still reports 10-19 "fps".
//     Grade frames by `frameMs` (unclamped) or by this probe's own rAF timing.
//   * `drawCalls`/`triangles` are the LAST FRAME's `renderer.info`, so a sample
//     taken mid-assembly reads whatever existed then. That is the whole reason
//     the same deterministic park reported 1172 and 1854 draws on two runs.
//
// WHAT THIS DOES INSTEAD. It waits for `__parkReport`, then polls `stats()`
// until the draw/triangle counts are IDENTICAL across `--stable=N` consecutive
// samples (so the build queue, the AUTO-keepDry terrain rebuild and the guest
// spawn have all landed), and only then takes its measurements — every one of
// them from an explicit `renderer.render()` call with `renderer.info` reset
// immediately before, inside ONE synchronous `page.evaluate` so no rAF can
// interleave. The camera is never touched (`<Park>` sets `autoRotate={false}`,
// so the pose is deterministic).
//
// It reports:
//   * `frame` — colour+shadow draws/tris for one full render (the portable number)
//   * `colorOnly` / `shadowPass` — the same frame with `shadowMap.autoUpdate`
//     off, so the shadow depth pass is priced separately
//   * `lights` — point/spot lights split into LIT (intensity > 0.001) and DARK.
//     A DARK light is not free: three.js only drops a light from the forward
//     shader's uniform arrays when it is `visible === false`, so an
//     intensity-0 night lamp still costs a full per-fragment loop iteration.
//   * `entries` — per park-runtime-entry attribution by HIDE-AND-RENDER: hide
//     one entry, render, take the delta. Authoritative (it prices exactly what
//     the renderer skips), and cross-checked against a static traversal count
//     of that entry's visible geometry.
//   * `msPerFrame` — median wall time over `--frames=N` real rAF frames.
//
// USAGE
//   node probe-render-cost.mjs [--park=<file.tsx>] [--export=DemoPark]
//                             [--stable=6] [--frames=12] [--top=18]
//                             [--json] [--save=out/perf/x.json]
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
const STABLE = Number(arg('stable', 6));
const FRAMES = Number(arg('frames', 12));
const TOP = Number(arg('top', 18));
const ROUNDS = Number(arg('rounds', 5));
const DRILL = (arg('drill', '') || '').split(',').filter(Boolean).map(Number);
const NO_AB = process.argv.includes('--no-ab');
const JSON_OUT = process.argv.includes('--json');
const SAVE = arg('save', null);

// Any park file, not just `Park.previews.tsx`: take `--export` if the module has
// it, else the default export, else the first capitalised function. A
// `park-eval/samples/*.tsx` park imports `./components/<Name>`, so the same
// resolve plugin `lib.mjs` uses maps that prefix onto the local design system.
const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as M from ${JSON.stringify(parkFile)};
const named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));
const C = M[${JSON.stringify(exportName)}] || M.default || (named[0] || [])[1];
if (!C) console.error('[probe-render-cost] no component export found');
else createRoot(document.getElementById('root')).render(React.createElement(C));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-render-cost.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

/** './components/X' (from anywhere) -> mp3d/components/X — copied from lib.mjs */
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

const htmlPath = path.join(HARNESS, 'out', 'render-cost.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const lines = [];
page.on('console', (m) => { const t = m.text(); if (!/GL Driver|ReadPixels/.test(t)) lines.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });

// ---- 1. wait for the park to report -----------------------------------------
// `window.__parkReport` only exists when the park wires `onReady` (DemoPark
// does; most `park-eval/samples` do not), so the `[Park] validatePark →` console
// line — which `<Park>` ALWAYS emits once it reaches the settle effect — is the
// fallback. Waiting for neither would measure a park mid-assembly.
let report = null;
let sawVerdict = false;
for (let i = 0; i < 240 && !report && !sawVerdict; i += 1) {
  await page.waitForTimeout(500);
  report = await page.evaluate(() => window.__parkReport ?? null);
  sawVerdict = lines.some((l) => /validatePark →/.test(l));
}
if (!report && !sawVerdict) { console.error('probe-render-cost: park never reported (no window.__parkReport, no validatePark line)'); await browser.close(); process.exit(1); }
if (!report) report = { ok: /validatePark → ok: true/.test(lines.find((l) => /validatePark →/.test(l)) ?? ''), failures: [], warnings: [], fromConsole: true };

// ---- 2. wait for the STATS to stop moving -----------------------------------
const series = [];
let stableRun = 0;
let stableAtMs = null;
const t0 = Date.now();
for (let i = 0; i < 120; i += 1) {
  const s = await page.evaluate(() => document.querySelector('canvas')?.__stageApi?.stats?.() ?? null);
  if (!s) break;
  series.push({ atMs: Date.now() - t0, drawCalls: s.drawCalls, triangles: s.triangles, lights: s.lights });
  const prev = series[series.length - 2];
  stableRun = prev && prev.drawCalls === s.drawCalls && prev.triangles === s.triangles ? stableRun + 1 : 0;
  if (stableRun >= STABLE - 1) { stableAtMs = Date.now() - t0; break; }
  await page.waitForTimeout(400);
}

// ---- 3. the deterministic single-frame measurements -------------------------
const m = await page.evaluate(({ frames }) => {
  const canvas = document.querySelector('canvas');
  const api = canvas.__stageApi;
  const { scene, camera, renderer } = api;
  const info = renderer.info;
  const shot = () => ({ calls: info.render.calls, triangles: info.render.triangles, lines: info.render.lines, points: info.render.points });
  const renderOnce = () => { info.reset(); renderer.render(scene, camera); return shot(); };

  // the park ROOT group: Stage's `group` carries userData.nightK, and <Park>
  // mounts every runtime entry as a direct child of its own root under it.
  let stageGroup = null;
  scene.traverse((o) => { if (stageGroup === null && o.userData && o.userData.nightK !== undefined) stageGroup = o; });
  // the entry root is the deepest single-child chain under the stage group that
  // has >2 children (Park nests root inside the stage group)
  let root = stageGroup ?? scene;
  for (let guard = 0; guard < 4; guard += 1) {
    if (root.children.length === 1 && root.children[0].children.length > 1) root = root.children[0];
    else break;
  }

  const shadowWas = renderer.shadowMap.autoUpdate;

  // full frame (colour + shadow depth), then colour only
  renderer.shadowMap.autoUpdate = true;
  const frame = renderOnce();
  renderer.shadowMap.autoUpdate = false;
  const colorOnly = renderOnce();

  // ---- light census ---------------------------------------------------------
  const lights = { total: 0, visible: 0, lit: 0, dark: 0, darkNames: [] };
  scene.traverse((o) => {
    if (!(o.isPointLight || o.isSpotLight)) return;
    lights.total += 1;
    if (!o.visible) return;
    lights.visible += 1;
    if (o.intensity > 0.001) lights.lit += 1;
    else { lights.dark += 1; if (lights.darkNames.length < 40) lights.darkNames.push(o.name || o.parent?.name || o.type); }
  });

  // ---- static geometry census (cross-check for the hide-and-render deltas) --
  const triOf = (g) => {
    if (!g) return 0;
    if (g.index) return g.index.count / 3;
    return (g.attributes.position?.count ?? 0) / 3;
  };
  // `lodDetailShed` is the DIRECT answer to "is the park runtime's LOD actually
  // firing?": a tagged object is only invisible because `applyTier` put it past
  // NEAR. 0 shed out of N tagged means the mechanism is present but inert.
  const censusOf = (o) => {
    let meshes = 0; let tris = 0; let hidden = 0; let lodDetail = 0; let lodShed = 0;
    o.traverseVisible((c) => {
      if (c.isMesh || c.isInstancedMesh) {
        const n = c.isInstancedMesh ? c.count : 1;
        meshes += 1; tris += triOf(c.geometry) * n;
      }
    });
    o.traverse((c) => {
      if ((c.isMesh || c.isInstancedMesh) && !c.visible) hidden += 1;
      if (c.userData && c.userData.lodDetail) { lodDetail += 1; if (!c.visible) lodShed += 1; }
    });
    return { meshes, tris, hiddenMeshes: hidden, lodDetail, lodDetailShed: lodShed };
  };

  // ---- per-entry attribution: hide one child, render, take the delta -------
  // Park mounts every entry as an unnamed Group, so identify it by the first
  // named descendant (components name their own parts) + the child index.
  const labelOf = (o, i) => {
    if (o.name) return `#${i} ${o.name}`;
    const names = [];
    o.traverse((c) => { if (c.name && names.length < 3 && !names.includes(c.name)) names.push(c.name); });
    return `#${i} ${names.length ? names.join('/') : o.type} (${o.children.length}ch)`;
  };
  const entries = [];
  const kids = root.children.slice();
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i];
    if (!child.visible) { entries.push({ name: labelOf(child, i), invisible: true }); continue; }
    child.visible = false;
    const off = renderOnce();
    child.visible = true;
    const c = censusOf(child);
    entries.push({
      name: labelOf(child, i),
      drawCalls: colorOnly.calls - off.calls,
      triangles: colorOnly.triangles - off.triangles,
      staticMeshes: c.meshes,
      staticTris: c.tris,
      hiddenMeshes: c.hiddenMeshes,
      lodDetail: c.lodDetail,
    });
  }

  // whole-scene census
  const whole = censusOf(scene);
  const programs = renderer.info.programs ? renderer.info.programs.length : null;

  renderer.shadowMap.autoUpdate = shadowWas;
  const stats = api.stats ? api.stats() : null;
  return { frame, colorOnly, lights, entries, whole, programs, stats, rootChildren: root.children.length, frames };
}, { frames: FRAMES });

// ---- 4. real frame time (median over N rAF frames) --------------------------
// Every rAF gap contains exactly one Stage render, so the gap IS the frame cost.
// `warm` frames are discarded first: toggling a light's `visible` changes
// three.js's `numPointLights` program key and the next frame pays a shader
// recompile that is not part of the steady state.
const TIMER = `((n, warm) => new Promise((res) => {
  const gaps = []; let prev = performance.now(); let seen = 0;
  const tick = () => {
    const now = performance.now();
    if (seen >= warm) gaps.push(now - prev);
    prev = now; seen += 1;
    if (gaps.length < n) requestAnimationFrame(tick);
    else { const s = gaps.slice().sort((a, b) => a - b); res({ median: s[Math.floor(s.length / 2)], min: s[0], max: s[s.length - 1], n: s.length }); }
  };
  requestAnimationFrame(tick);
}))`;
const timeFrames = (n = FRAMES, warm = 4) => page.evaluate(`(${TIMER})(${n}, ${warm})`);
const msPerFrame = await timeFrames();

// ---- 5. IN-PAGE A/B EXPERIMENTS ---------------------------------------------
// Size a candidate optimisation BEFORE writing it into the design system, by
// making the same change the DS would make directly on the live scene. Each
// experiment is applied, timed, and reverted; the baseline is re-timed at the
// end so machine drift is visible rather than silent.
// Two OPPOSITE light experiments, so this probe is meaningful before AND after
// the dark-light cull ships in `Stage/darkLights.ts`:
//   setDark(false)  — hide every zero-intensity light. THE WIN, pre-fix; a
//                     no-op once the Stage already culls them.
//   setUnculled(1)  — put every light BACK in the forward shader, i.e. rebuild
//                     the PRE-FIX scene on a post-fix build, so the win can be
//                     A/B'd in the direction that matters after it has shipped.
//
// TWO FALSE STARTS, both of which quietly measured nothing (this is the
// documented failure mode of this project's probes — a confident wrong answer):
//
//   1. `light.visible = true` from node. The Stage's cull re-sheds within its
//      0.25 s cadence, so the variant held for a fraction of its own timing
//      window and reported ~baseline.
//   2. Raising `intensity` to 0.01, just over the cull's ON threshold. Every
//      night-gated lamp's OWN UPDATER rewrites `intensity = nightK * X` on the
//      very next frame, so it fell straight back to 0 and the cull re-shed it.
//      Measured: 210.1 ms/frame against a 234.6 ms baseline — a 10% "speed-up"
//      from restoring 21 lights, which is the tell that nothing was restored.
//
// What actually holds is a wrapper on `renderer.render`: it forces the cached
// light list visible in the instant BEFORE the draw, which is the only instant
// that decides the shader permutation. `lights` is reported per variant so a
// variant that did not take effect is visible in the output instead of being
// mistaken for a null result.
const setDark = (v) => page.evaluate((vis) => {
  const api = document.querySelector('canvas').__stageApi;
  let n = 0;
  api.scene.traverse((o) => { if ((o.isPointLight || o.isSpotLight) && o.intensity <= 0.001) { o.visible = vis; n += 1; } });
  return n;
}, v);
const setUnculled = (on) => page.evaluate((up) => {
  const api = document.querySelector('canvas').__stageApi;
  const r = api.renderer;
  const w = window;
  if (up) {
    if (w.__abOrig) return w.__abLights.length;
    const lights = [];
    api.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) lights.push(o); });
    w.__abLights = lights;
    w.__abOrig = r.render.bind(r);
    r.render = (s, c) => { for (let i = 0; i < lights.length; i += 1) lights[i].visible = true; w.__abOrig(s, c); };
    return lights.length;
  }
  if (!w.__abOrig) return 0;
  r.render = w.__abOrig;
  w.__abOrig = null;
  const n = (w.__abLights ?? []).length;
  w.__abLights = null;
  return n;
}, on);
const setShadow = (v) => page.evaluate((on) => { document.querySelector('canvas').__stageApi.renderer.shadowMap.autoUpdate = on; }, v);
// draws/tris AND the visible light count for the frame just drawn — the light
// count is the receipt that a light variant actually took effect.
const frameInfo = () => page.evaluate(() => {
  const api = document.querySelector('canvas').__stageApi;
  const i = api.renderer.info; i.reset(); api.renderer.render(api.scene, api.camera);
  let lights = 0;
  api.scene.traverse((o) => { if ((o.isPointLight || o.isSpotLight) && o.visible) lights += 1; });
  return { calls: i.render.calls, triangles: i.render.triangles, lights, programs: i.programs ? i.programs.length : null };
});

// INTERLEAVED, not sequential. A first pass ran the four variants as four
// consecutive blocks and re-timed the baseline last: it came back 37% SLOWER
// than the identical first baseline, i.e. the machine drifted more over the run
// than any variant moved the frame. Rounds are therefore interleaved
// A,B,C,D,A,B,C,D… and every variant's frames are pooled across rounds, so
// drift lands on all four equally instead of on whichever ran last.
//                   name                 hideDark  shadow  unculled
const VARIANTS = [
  ['baseline', false, true, false],
  ['darkLightsHidden', true, true, false],
  ['darkLightsRestored', false, true, true],
  ['shadowFrozen', false, false, false],
];
const pooled = Object.fromEntries(VARIANTS.map(([k]) => [k, []]));
const lastFrame = {};
let hiddenLights = 0;
let restoredLights = 0;
for (let r = 0; r < (NO_AB ? 0 : ROUNDS); r += 1) {
  for (const [k, dark, shadow, unculled] of VARIANTS) {
    const nres = await setUnculled(unculled);
    if (unculled) restoredLights = nres;
    if (!unculled) hiddenLights = await setDark(!dark);
    await setShadow(shadow);
    const t = await timeFrames(FRAMES, 4);
    pooled[k].push(t);
    lastFrame[k] = await frameInfo();
  }
}
await setUnculled(false); await setDark(true); await setShadow(true);
const experiments = Object.fromEntries(VARIANTS.filter(([k]) => pooled[k].length).map(([k]) => {
  const meds = pooled[k].map((t) => t.median).sort((a, b) => a - b);
  return [k, {
    ms: { median: meds[Math.floor(meds.length / 2)], min: meds[0], max: meds[meds.length - 1], rounds: meds.length, perRound: meds.map((v) => Math.round(v)) },
    frame: lastFrame[k],
  }];
}));
if (experiments.baseline) experiments.baseline.hiddenLights = 0;
if (experiments.darkLightsHidden) experiments.darkLightsHidden.hiddenLights = hiddenLights;
if (experiments.darkLightsRestored) experiments.darkLightsRestored.restoredLights = restoredLights;

// ---- 6. DRILL: attribute one entry's own children the same way --------------
const drills = {};
for (const idx of DRILL) {
  drills[idx] = await page.evaluate((i) => {
    const api = document.querySelector('canvas').__stageApi;
    const { scene, camera, renderer } = api;
    const info = renderer.info;
    let stageGroup = null;
    scene.traverse((o) => { if (stageGroup === null && o.userData && o.userData.nightK !== undefined) stageGroup = o; });
    let root = stageGroup ?? scene;
    for (let g = 0; g < 4; g += 1) {
      if (root.children.length === 1 && root.children[0].children.length > 1) root = root.children[0];
      else break;
    }
    const target = root.children[i];
    if (!target) return null;
    const was = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    const renderOnce = () => { info.reset(); renderer.render(scene, camera); return { calls: info.render.calls, triangles: info.render.triangles }; };
    const base = renderOnce();
    const triOf = (g2) => (!g2 ? 0 : g2.index ? g2.index.count / 3 : (g2.attributes.position?.count ?? 0) / 3);
    const rows = [];
    const kids = target.children.slice();
    for (let k = 0; k < kids.length; k += 1) {
      const c = kids[k];
      const vis = c.visible;
      let meshes = 0; let tris = 0;
      c.traverseVisible((d) => { if (d.isMesh || d.isInstancedMesh) { meshes += 1; tris += triOf(d.geometry) * (d.isInstancedMesh ? d.count : 1); } });
      if (!vis) { rows.push({ name: c.name || c.type, invisible: true, meshes, tris }); continue; }
      c.visible = false;
      const off = renderOnce();
      c.visible = true;
      rows.push({ name: c.name || `${c.type}(${c.children.length}ch)`, drawCalls: base.calls - off.calls, triangles: base.triangles - off.triangles, meshes, tris });
    }
    renderer.shadowMap.autoUpdate = was;
    return { label: target.name || target.type, children: kids.length, base, rows: rows.sort((a, b) => (b.drawCalls ?? 0) - (a.drawCalls ?? 0)) };
  }, idx);
}

await browser.close();

const out = {
  park: path.relative(REPO, parkFile), export: exportName,
  ok: report.ok, failures: (report.failures ?? []).length, warnings: (report.warnings ?? []).map((w) => w.kind),
  stableAtMs, stableSamples: STABLE, series,
  frame: m.frame,
  colorOnly: m.colorOnly,
  shadowPass: { drawCalls: m.frame.calls - m.colorOnly.calls, triangles: m.frame.triangles - m.colorOnly.triangles },
  lights: m.lights,
  whole: m.whole,
  programs: m.programs,
  statsLine: m.stats,
  msPerFrame,
  experiments,
  drills,
  entries: m.entries.slice().sort((a, b) => (b.drawCalls ?? 0) - (a.drawCalls ?? 0)),
  perfLine: lines.find((l) => l.includes('[Park] perf:')) ?? null,
};

if (SAVE) { fs.mkdirSync(path.dirname(path.resolve(SAVE)), { recursive: true }); fs.writeFileSync(path.resolve(SAVE), JSON.stringify(out, null, 2)); }
if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(out.ok ? 0 : 1); }

const n = (v) => String(v).padStart(7);
console.log(`\n${out.park} :: ${exportName}   validatePark ok=${out.ok} failures=${out.failures} warnings=[${out.warnings.join(', ')}]`);
console.log(`STABILISED after ${stableAtMs === null ? 'NEVER (counts still moving)' : `${stableAtMs} ms of polling / ${series.length} samples`}`);
console.log(`  stats series: ${series.map((s) => `${s.drawCalls}/${(s.triangles / 1000).toFixed(0)}k`).join(' → ')}`);
console.log(`\nONE FRAME (deterministic, explicit render, info reset immediately before):`);
console.log(`  full frame (colour + shadow depth) ${n(out.frame.calls)} draws ${n(out.frame.triangles)} tris`);
console.log(`  colour pass only                   ${n(out.colorOnly.calls)} draws ${n(out.colorOnly.triangles)} tris`);
console.log(`  SHADOW DEPTH PASS                  ${n(out.shadowPass.drawCalls)} draws ${n(out.shadowPass.triangles)} tris`);
console.log(`  scene geometry (visible)            ${n(out.whole.meshes)} meshes ${n(Math.round(out.whole.tris))} tris, ${out.whole.hiddenMeshes} hidden`);
console.log(`  park-runtime LOD                    ${n(out.whole.lodDetail)} lodDetail-tagged, ${out.whole.lodDetailShed} SHED (0 = the mechanism is inert here)`);
console.log(`  compiled shader programs            ${n(out.programs)}`);
console.log(`  real frame time (median of ${msPerFrame.n})     ${msPerFrame.median.toFixed(1)} ms  (${(1000 / msPerFrame.median).toFixed(2)} fps)  [min ${msPerFrame.min.toFixed(0)} max ${msPerFrame.max.toFixed(0)}]`);
console.log(`  stats() line for comparison        ${JSON.stringify(out.statsLine)}`);
console.log(`\nLIGHTS: ${out.lights.total} point/spot total, ${out.lights.visible} visible → ${out.lights.lit} LIT, ${out.lights.dark} DARK (intensity 0 but still in the forward shader)`);
if (out.lights.dark) console.log(`  dark: ${out.lights.darkNames.join(', ')}`);
console.log(`\nPER-ENTRY (hide-and-render delta, colour pass; ${m.rootChildren} runtime children):`);
console.log(`     draws       tris   meshes  staticTris  lodDetail  name`);
for (const e of out.entries.slice(0, TOP)) {
  if (e.invisible) { console.log(`  (invisible)                                        ${e.name}`); continue; }
  console.log(`  ${n(e.drawCalls)} ${n(e.triangles)} ${n(e.staticMeshes)} ${n(Math.round(e.staticTris))} ${n(e.lodDetail)}  ${e.name}`);
}
for (const [idx, d] of Object.entries(drills)) {
  if (!d) { console.log(`\nDRILL #${idx}: no such entry`); continue; }
  console.log(`\nDRILL #${idx} "${d.label}" — ${d.children} children, colour pass ${d.base.calls} draws / ${d.base.triangles} tris with it on:`);
  console.log(`     draws       tris   meshes  name`);
  for (const r of d.rows.slice(0, 24)) console.log(`  ${n(r.drawCalls ?? '(inv)')} ${n(r.triangles ?? '')} ${n(r.meshes)}  ${r.name}`);
}
if (Object.keys(experiments).length) {
  console.log(`\nIN-PAGE A/B (${ROUNDS} INTERLEAVED rounds x ${FRAMES} frames after 4 warm-up; per-variant median of round medians):`);
  for (const [k, v] of Object.entries(experiments)) {
    const base = experiments.baseline.ms.median;
    const d = k === 'baseline' ? '' : `  (${(((v.ms.median - base) / base) * 100).toFixed(0)}%)`;
    console.log(`  ${k.padEnd(18)} ${v.ms.median.toFixed(1).padStart(8)} ms/frame  ${(1000 / v.ms.median).toFixed(2).padStart(6)} fps  ${String(v.frame.calls).padStart(5)} draws ${String(v.frame.triangles).padStart(7)} tris  ${String(v.frame.lights).padStart(3)} lit  ${String(v.frame.programs).padStart(3)} prog${d}   rounds=[${v.ms.perRound.join(',')}]`);
  }
}
if (out.perfLine) console.log(`\nthe DS's own line: ${out.perfLine}`);
