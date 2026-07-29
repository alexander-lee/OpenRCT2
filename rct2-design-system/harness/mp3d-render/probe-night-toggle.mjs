#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-night-toggle.mjs — WHAT DOES THE DAY/NIGHT BUTTON COST?
//
// The user's report: "when i turn off lighting there's always a super lag with
// large park". `probe-assembly.mjs` proved the LOAD stall is three.js
// recompiling every shader once per distinct VISIBLE LIGHT COUNT (the light
// count is part of a program's cache key). The same mechanism can fire on a
// day/night TOGGLE, because `Stage/darkLights.ts` sheds/restores lights by
// intensity threshold and a transition moves 100+ intensities through that
// threshold at DIFFERENT frames — one recompile of the whole park per step.
//
// So this probe times the button, in both directions, and prices the two
// candidate causes separately:
//
//   * rAF GAP SERIES around the click (the freeze the user feels), with the
//     visible light count and the shader-program cache size on every frame, so
//     a spike is attributable rather than inferred.
//   * A DIRECT COMPILE COUNTER: the WebGL2 context's `createProgram` /
//     `linkProgram` / `getProgramParameter` are wrapped in the init script, so
//     "how many programs were built and how much main-thread time went into
//     them" is measured, not deduced from `renderer.info.programs.length` —
//     that is a CACHE SIZE, and a light-count change frees as many programs as
//     it creates, so the cache can churn 200 programs while its length never
//     moves.
//
//   node probe-night-toggle.mjs [--sample=parkA-99] [--gpu=metal|swift]
//        [--throttle=1] [--shot=out/x.png] [--json] [--settle=45]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const REPO = path.resolve(arg('repo', path.resolve(HARNESS, '..', '..', 'mp3d')));
const SAMPLES = path.resolve(HARNESS, '..', 'park-eval', 'samples');
const SAMPLE = arg('sample', null);
const parkFile = SAMPLE
  ? (fs.existsSync(path.join(SAMPLES, SAMPLE)) ? path.join(SAMPLES, SAMPLE) : path.join(SAMPLES, `${SAMPLE}.tsx`))
  : arg('park', path.join(REPO, 'components/Park/Park.previews.tsx'));
if (!fs.existsSync(parkFile)) { console.error(`probe-night-toggle: no such park file ${parkFile}`); process.exit(1); }
const exportName = arg('export', SAMPLE ? '__default__' : 'DemoPark');
const GPU = arg('gpu', 'metal');
const DPR = Number(arg('dpr', 2));
const THROTTLE = Number(arg('throttle', 1));
const SETTLE_S = Number(arg('settle', 45));
const HOLD_S = Number(arg('hold', 10));
const SHOT = arg('shot', null);
const JSON_OUT = process.argv.includes('--json');
const W = Number(arg('w', 1440));
const H = Number(arg('h', 900));
const say = (s) => { if (!JSON_OUT) console.log(s); };

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import * as M from ${JSON.stringify(parkFile)};
const named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));
const C = M[${JSON.stringify(exportName)}] || M.default || (named[0] || [])[1];
window.__THREE = THREE;
if (!C) console.error('[probe-night-toggle] no component export found');
else createRoot(document.getElementById('root')).render(React.createElement(C));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-night-toggle.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

// import resolution: identical to probe-assembly.mjs (both sample dialects, one
// copy of three)
const tryFiles = (base) => {
  for (const cand of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')])
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  return null;
};
const componentAlias = {
  name: 'mp3d-components',
  setup(b) {
    b.onResolve({ filter: /^\.{1,2}\// }, (args) => {
      if (args.path.startsWith('/')) return null;
      if (args.path.includes('components/')) {
        const hit = tryFiles(path.join(REPO, args.path.slice(args.path.indexOf('components/'))));
        if (hit) return { path: hit };
      }
      const bare = args.path.replace(/^\.{1,2}\//, '');
      if (!bare.includes('/')) {
        const hit = tryFiles(path.join(REPO, 'components', bare));
        if (hit) return { path: hit };
      }
      return null;
    });
    const THREE_MAIN = tryFiles(path.join(HARNESS, 'node_modules', 'three', 'build', 'three.module.js'))
      ?? tryFiles(path.join(HARNESS, 'node_modules', 'three'));
    if (THREE_MAIN) b.onResolve({ filter: /^three$/ }, () => ({ path: THREE_MAIN }));
  },
};

say('[toggle] bundling…');
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

const htmlPath = path.join(HARNESS, 'out', `night-toggle-${GPU}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const GPU_ARGS = {
  metal: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-frame-rate-limit'],
  swift: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'],
};
const browser = await chromium.launch({ args: GPU_ARGS[GPU] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const lines = [];
page.on('console', (m) => { const t = m.text(); if (!/GL Driver|ReadPixels/.test(t)) lines.push(t); });
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

await page.addInitScript(() => {
  const w = window;
  const t0 = performance.now();
  w.__nt = { t0, gaps: [], phase: 'load', marks: {} };
  // ---- THE COMPILE COUNTER ---------------------------------------------------
  // `renderer.info.programs.length` is a CACHE SIZE. three.js refcounts programs
  // per material, so a light-count change releases the old program as it takes
  // the new one and the length can be flat across hundreds of compiles. Wrap the
  // GL entry points instead: `createProgram`/`linkProgram` count the work and
  // `getProgramParameter` is where the driver blocks waiting for the link.
  w.__gl = { create: 0, link: 0, del: 0, linkMs: 0, paramMs: 0, uniMs: 0 };
  const wrap = (proto) => {
    if (!proto) return;
    const c = proto.createProgram; const l = proto.linkProgram;
    const p = proto.getProgramParameter; const d = proto.deleteProgram;
    const u = proto.getUniformLocation;
    proto.createProgram = function (...a) { w.__gl.create += 1; return c.apply(this, a); };
    proto.deleteProgram = function (...a) { w.__gl.del += 1; return d.apply(this, a); };
    proto.linkProgram = function (...a) { const t = performance.now(); const r = l.apply(this, a); w.__gl.linkMs += performance.now() - t; w.__gl.link += 1; return r; };
    proto.getProgramParameter = function (...a) { const t = performance.now(); const r = p.apply(this, a); w.__gl.paramMs += performance.now() - t; return r; };
    proto.getUniformLocation = function (...a) { const t = performance.now(); const r = u.apply(this, a); w.__gl.uniMs += performance.now() - t; return r; };
  };
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);

  // ---- SPLIT THE FRAME: renderer.render vs EVERYTHING ELSE -------------------
  // The first two runs of this probe found rAF frames of 1500-26000 ms on a park
  // whose explicit `renderer.render` measured 33-58 ms. A gap series cannot say
  // which half of the Stage loop that is, so `render` is wrapped the moment the
  // Stage publishes its api and the per-frame total is carried in the series.
  w.__rt = { ms: 0, calls: 0 };
  let apiRef = null;
  const hook = (api) => {
    if (!api || api.__renderHooked) return;
    api.__renderHooked = true;
    const r = api.renderer; const real = r.render.bind(r);
    r.render = (...a) => { const t = performance.now(); const out = real(...a); w.__rt.ms += performance.now() - t; w.__rt.calls += 1; return out; };
  };
  const snap = () => {
    if (!apiRef) { apiRef = document.querySelector('canvas')?.__stageApi ?? null; hook(apiRef); }
    if (!apiRef) return [0, 0, 0];
    let lights = 0;
    apiRef.scene.traverse((o) => { if ((o.isPointLight || o.isSpotLight || o.isDirectionalLight) && o.visible) lights += 1; });
    const nk = (() => { let k = null; apiRef.scene.traverse((o) => { if (o.userData && typeof o.userData.nightK === 'number') k = o.userData.nightK; }); return k; })();
    return [lights, apiRef.renderer?.info?.programs?.length ?? 0, nk];
  };
  let prev = performance.now();
  const tick = () => {
    const now = performance.now();
    const [lights, progs, nk] = snap();
    // [t, gapMs, visibleLights, programCacheSize, programsCreatedSoFar, nightK,
    //  phase, ms inside renderer.render during that gap, render calls]
    w.__nt.gaps.push([+(now - t0).toFixed(1), +(now - prev).toFixed(1), lights, progs, w.__gl.create, nk === null ? null : +nk.toFixed(4), w.__nt.phase, +w.__rt.ms.toFixed(1), w.__rt.calls]);
    w.__rt.ms = 0; w.__rt.calls = 0;
    prev = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const cdp = await page.context().newCDPSession(page);
if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
const env = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown', dpr: window.devicePixelRatio };
});
say(`[toggle] ${env.renderer} · dpr ${env.dpr} · throttle ${THROTTLE}x · ${path.basename(parkFile)}`);

// ---- wait for the park to STOP GROWING -------------------------------------
// Same detector as probe-assembly.mjs: a flat draw count is not a settled park
// (streamed content mounts invisible), so the node census has to be flat too.
let stable = 0; let lastKey = ''; let settledAt = null;
for (let i = 0; i < Math.ceil((SETTLE_S * 1000) / 500); i += 1) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const api = document.querySelector('canvas')?.__stageApi;
    if (!api?.stats) return null;
    let nodes = 0; let meshes = 0;
    api.scene.traverse((o) => { nodes += 1; if (o.isMesh || o.isInstancedMesh) meshes += 1; });
    const st = api.stats();
    return { t: performance.now() - window.__nt.t0, nodes, meshes, draws: st.drawCalls, lights: st.lights, culled: st.lightsCulled };
  });
  if (!s) continue;
  const key = `${s.nodes}/${s.meshes}/${s.draws}`;
  stable = key === lastKey ? stable + 1 : 0;
  lastKey = key;
  if (stable === 4 && settledAt === null) { settledAt = s; break; }
}
say(`[toggle] settled: ${settledAt ? `${(settledAt.t / 1000).toFixed(1)} s · ${settledAt.nodes} nodes · ${settledAt.draws} draws · ${settledAt.lights} visible lights · ${settledAt.culled} culled` : 'NEVER (still growing)'}`);

// EXPLICIT frame timing, the probe-frame-cost.mjs way: three warm renders, then
// N timed ones with a gl.finish either side. Needed because the rAF gap series
// mixes React, the sim and the recorder in with the draw.
const frameCost = (n = 8) => page.evaluate((k) => {
  const api = document.querySelector('canvas').__stageApi;
  const { scene, camera, renderer } = api;
  const gl = renderer.getContext();
  for (let i = 0; i < 3; i += 1) renderer.render(scene, camera);
  gl.finish();
  const t = performance.now();
  for (let i = 0; i < k; i += 1) renderer.render(scene, camera);
  gl.finish();
  return +((performance.now() - t) / k).toFixed(2);
}, n);

// ---- WAIT FOR THE TRANSITION TO FINISH, not for a fixed timeout -------------
// `Stage`'s nightK lerp is PER FRAME (`nightK += (target - nightK) * 0.06`), so
// the wall clock a transition takes is frames × frame time — and the frame time
// during a night transition is itself the thing under test. A fixed wait cannot
// measure a transition whose duration depends on how slow it is.
const awaitTransition = async (want, capS) => {
  const t0 = Date.now();
  for (;;) {
    const s = await page.evaluate(() => {
      const api = document.querySelector('canvas')?.__stageApi;
      let nk = null; let lights = 0;
      api.scene.traverse((o) => {
        if (o.userData && typeof o.userData.nightK === 'number') nk = o.userData.nightK;
        if ((o.isPointLight || o.isSpotLight) && o.visible) lights += 1;
      });
      return { nk, lights, frameMs: api.stats().frameMs };
    });
    const done = want === 1 ? s.nk > 0.99 : s.nk < 0.01;
    if (done || Date.now() - t0 > capS * 1000) return { settleMs: Date.now() - t0, timedOut: !done, ...s };
    await page.waitForTimeout(250);
  }
};

const clickToggle = async (phase, want) => {
  await page.evaluate((p) => {
    window.__nt.phase = p;
    window.__nt.marks[p] = performance.now() - window.__nt.t0;
    window.__nt[`gl_${p}`] = { ...window.__gl };
    const b = [...document.querySelectorAll('button')].find((x) => /Switch to (day|night)/.test(x.getAttribute('aria-label') || ''));
    if (!b) throw new Error('no UIDayNight button found');
    b.click();
  }, phase);
  const tr = await awaitTransition(want, HOLD_S);
  const gl = await page.evaluate((p) => {
    const g = window.__gl; const before = window.__nt[`gl_${p}`];
    return { create: g.create - before.create, del: g.del - before.del, link: g.link - before.link, linkMs: +(g.linkMs - before.linkMs).toFixed(1), paramMs: +(g.paramMs - before.paramMs).toFixed(1), uniMs: +(g.uniMs - before.uniMs).toFixed(1) };
  }, phase);
  say(`[toggle] ${phase}: nightK reached ${tr.nk?.toFixed?.(3)} after ${tr.settleMs} ms${tr.timedOut ? ' (TIMED OUT — still transitioning)' : ''} · ${tr.lights} visible lights · frameMs(EMA) ${tr.frameMs}`);
  return { gl, tr };
};

// ---- WHERE THE FRAME ACTUALLY GOES -----------------------------------------
// The first run of this probe found a park whose rAF frames were 1600 ms while
// an explicit `renderer.render` measured 28 ms — so the freeze was NOT the draw,
// and no counter in this harness could say what it was. A sampling CPU profile
// is the only thing that can, so it is part of the tool.
const profile = async (label, secs) => {
  if (!process.argv.includes('--profile')) return null;
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(secs * 1000);
  const { profile: p } = await cdp.send('Profiler.stop');
  const self = new Map();
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const total = p.samples.length;
  for (const id of p.samples) {
    const n = byId.get(id);
    if (!n) continue;
    const f = n.callFrame;
    const key = `${f.functionName || '(anonymous)'} @${(f.url || '').split('/').pop()}:${f.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + 1);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
    .map(([k, v]) => ({ fn: k, pct: +((100 * v) / total).toFixed(1) }));
  say(`\n[profile ${label}] ${total} samples`);
  for (const t of top) say(`   ${String(t.pct).padStart(5)}%  ${t.fn}`);
  return top;
};

// ---- THE DECISIVE A/B: WHAT DOES ONE LIGHT-COUNT CHANGE COST? ---------------
// three.js puts the number of visible lights in a material's program cache key,
// AND (WebGLRenderer.setProgram) marks every material needing lights for a
// program re-resolve when `lights.state.version` moves. So a single light
// flipping `visible` re-resolves EVERY material in the park and re-uploads the
// whole point-light uniform array on every program bind. This prices it:
//   A  plain renders                       — the settled frame
//   B  flip one lamp's `visible` per render — one light-count change per frame
//   C  change one lamp's `intensity`       — a uniform change, no count change
const abLightCost = (n = 6) => page.evaluate((k) => {
  const api = document.querySelector('canvas').__stageApi;
  const { scene, camera, renderer } = api;
  const gl = renderer.getContext();
  const lamps = [];
  scene.traverse((o) => { if (o.isPointLight) lamps.push(o); });
  const lamp = lamps[0];
  if (!lamp) return null;
  const was = lamp.visible; const wasI = lamp.intensity;
  const time = (fn) => {
    for (let i = 0; i < 2; i += 1) { fn(i); renderer.render(scene, camera); }
    gl.finish();
    const t = performance.now();
    for (let i = 0; i < k; i += 1) { fn(i); renderer.render(scene, camera); }
    gl.finish();
    return +((performance.now() - t) / k).toFixed(1);
  };
  const A = time(() => {});
  const B = time((i) => { lamp.visible = i % 2 === 0; });
  lamp.visible = was;
  const C = time((i) => { lamp.intensity = wasI * (i % 2 === 0 ? 1 : 0.5); });
  lamp.intensity = wasI;
  return { lamps: lamps.length, plainMs: A, flipVisibleMs: B, changeIntensityMs: C };
}, n);

const dayFrame = await frameCost();
say(`[toggle] settled DAY frame: ${dayFrame} ms`);
const profDay = await profile('day', 5);
const on = await clickToggle('night-on', 1);
const nightFrame = await frameCost();
say(`[toggle] settled NIGHT frame: ${nightFrame} ms`);
const abNight = await abLightCost();
if (abNight) say(`[toggle] NIGHT A/B (${abNight.lamps} point lights): plain ${abNight.plainMs} ms · flip one light's visible ${abNight.flipVisibleMs} ms · change one intensity ${abNight.changeIntensityMs} ms`);
const profNight = await profile('night', 12);
const off = await clickToggle('night-off', 0);
const backFrame = await frameCost();
say(`[toggle] settled DAY-AGAIN frame: ${backFrame} ms`);
const glOn = on.gl; const glOff = off.gl;
await page.evaluate(() => { window.__nt.phase = 'after'; });
await page.waitForTimeout(2000);

const rec = await page.evaluate(() => ({ gaps: window.__nt.gaps, marks: window.__nt.marks, gl: window.__gl }));

if (SHOT) {
  const p = path.isAbsolute(SHOT) ? SHOT : path.join(HARNESS, SHOT);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  await page.screenshot({ path: p });
  say(`[toggle] shot -> ${p}`);
}

const report = (phase, gl) => {
  const g = rec.gaps.filter((x) => x[6] === phase);
  if (!g.length) return { phase, frames: 0 };
  const gapsMs = g.map((x) => x[1]);
  const over50 = gapsMs.filter((x) => x > 50);
  const over100 = gapsMs.filter((x) => x > 100);
  const lights = [...new Set(g.map((x) => x[2]))];
  // the light-count STEPS: how many times the visible count changed inside the
  // phase. Each step is a full re-compile of every material in the park.
  let steps = 0;
  for (let i = 1; i < g.length; i += 1) if (g[i][2] !== g[i - 1][2]) steps += 1;
  // FREEZE = time in gaps beyond a 16.7 ms frame, i.e. the wall clock the user
  // spends looking at a stuck picture. Counted over gaps > 50 ms so ordinary
  // frame-rate variation is not billed as a freeze.
  const freeze = over50.reduce((a, b) => a + b - 16.7, 0);
  const t0 = g[0][0]; const tEnd = g[g.length - 1][0];
  const renderMs = g.reduce((a, x) => a + (x[7] ?? 0), 0);
  const totalMs = gapsMs.reduce((a, b) => a + b, 0);
  return {
    phase, frames: g.length, spanS: +((tEnd - t0) / 1000).toFixed(1),
    freezeMs: +freeze.toFixed(0), worstGapMs: +Math.max(...gapsMs).toFixed(0),
    gapsOver50: over50.length, gapsOver100: over100.length,
    lightCounts: lights.length <= 12 ? lights : `${lights.length} distinct (${Math.min(...lights)}..${Math.max(...lights)})`,
    lightSteps: steps,
    inRenderMs: +renderMs.toFixed(0), outsideRenderMs: +(totalMs - renderMs).toFixed(0),
    renderCalls: g.reduce((a, x) => a + (x[8] ?? 0), 0),
    programsCreated: gl?.create ?? null, programsDeleted: gl?.del ?? null,
    linkMs: gl?.linkMs ?? null, linkQueryMs: gl?.paramMs ?? null, uniformQueryMs: gl?.uniMs ?? null,
    cacheSizeStart: g[0][3], cacheSizeEnd: g[g.length - 1][3],
  };
};

const out = {
  park: path.basename(parkFile), gpu: GPU, throttle: THROTTLE, renderer: env.renderer,
  settled: settledAt, phases: [report('load'), report('night-on', glOn), report('night-off', glOff), report('after')],
  frameMs: { day: dayFrame, night: nightFrame, dayAgain: backFrame },
  transition: { nightOn: on.tr, nightOff: off.tr },
  totalPrograms: rec.gl.create,
  profile: { day: profDay, night: profNight },
  ab: { night: abNight },
  warnings: lines.filter((l) => /warn|error|Stage:/i.test(l)).slice(0, 8),
  gaps: rec.gaps,
};
if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
else {
  for (const p of out.phases) {
    if (!p.frames) continue;
    console.log(`\n── ${p.phase} ──  ${p.frames} frames over ${p.spanS}s`);
    console.log(`   FREEZE ${p.freezeMs} ms   worst gap ${p.worstGapMs} ms   gaps>50ms ${p.gapsOver50}   gaps>100ms ${p.gapsOver100}`);
    console.log(`   inside renderer.render ${p.inRenderMs} ms (${p.renderCalls} calls)   OUTSIDE it ${p.outsideRenderMs} ms`);
    console.log(`   visible lights: ${Array.isArray(p.lightCounts) ? p.lightCounts.join(' → ') : p.lightCounts}   (${p.lightSteps} count changes)`);
    if (p.programsCreated !== null) console.log(`   programs created ${p.programsCreated}, deleted ${p.programsDeleted}   linkProgram ${p.linkMs} ms   LINK_STATUS query ${p.linkQueryMs} ms   getUniformLocation ${p.uniformQueryMs} ms`);
    console.log(`   program cache ${p.cacheSizeStart} → ${p.cacheSizeEnd}`);
  }
  const save = arg('save', null);
  if (save) { fs.writeFileSync(path.isAbsolute(save) ? save : path.join(HARNESS, save), JSON.stringify(out, null, 2)); console.log(`\n[toggle] saved ${save}`); }
}
await browser.close();
