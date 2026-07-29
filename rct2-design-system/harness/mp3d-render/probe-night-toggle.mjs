#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-night-toggle.mjs — WHAT DOES THE DAY/NIGHT BUTTON COST?
//
// The user's report: "when i turn off lighting there's always a super lag with
// large park". Every other perf tool here measures a SETTLED park; this one
// measures the two seconds after a click, which is where that complaint lives.
//
// WHAT IT MEASURES, and nothing else:
//
//   * the rAF GAP SERIES, with the visible light count, the program-cache size
//     and `nightK` stamped on every frame. The gap IS the user's experience: a
//     frame that takes 900 ms is 900 ms of a stuck picture, whatever the GPU
//     says it was doing.
//   * FREEZE per toggle = wall clock from the click until the frame time is
//     back inside 2x its pre-click value AND `nightK` has landed AND the light
//     count has stopped moving. That is "when is the park usable again".
//   * TWO CYCLES. three.js keys a program on the VISIBLE LIGHT COUNT, so the
//     first toggle to a never-seen count compiles the whole park and later
//     toggles to the SAME count are free. A one-cycle probe cannot tell a
//     one-time cost from a per-click one — and the user said "always".
//   * `--legacy` restores the pre-fix per-frame `nightK` lerp IN MEMORY at
//     bundle time (an esbuild `onLoad` rewrite that asserts its anchor —
//     nothing under `mp3d/` is written), so the before/after is one command.
//
// ---- WHY THERE ARE NO `renderer.render()` LOOPS IN HERE ---------------------
//
// The first three revisions of this probe timed variants the way
// `probe-frame-cost.mjs` does — N back-to-back renders bracketed by
// `gl.finish()`. On ANGLE Metal those numbers are FICTION and they also RUIN the
// measurement:
//
//   the A/B reported 30.8 ms per render; the wall clock of the same evaluate
//   was 20 605 ms for 25 renders = 824 ms each. `gl.finish()` returned without
//   waiting, so every "cheap" variant was really 25 queued frames of GPU work —
//   and the app's next rAF frame inherited the 18-20 s backlog, which the gap
//   series then reported as a spontaneous 18-second freeze.
//
// So: no synthetic renders, and the honest cost of a frame here is the rAF gap.
//
//   node probe-night-toggle.mjs [--sample=parkA-99] [--gpu=metal|swift]
//        [--legacy] [--cycles=2] [--throttle=1] [--shot=out/x.png] [--json]
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
const SETTLE_S = Number(arg('settle', 60));
const CAP_S = Number(arg('cap', 45)); // per-toggle ceiling before we give up
const CYCLES = Number(arg('cycles', 2));
const LEGACY = process.argv.includes('--legacy');
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

const tryFiles = (base) => {
  for (const cand of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')])
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  return null;
};
// ---- --legacy: THE PRE-FIX FADE, REWRITTEN IN MEMORY ------------------------
// Same technique as `park-eval/probe-board-quiet.mjs --legacy`: the anchor is
// asserted, so if `Stage/index.tsx` is edited in a way that moves it, the probe
// FAILS instead of quietly measuring the new code twice.
const LEGACY_ANCHOR = 'const nightWant = nightRef.current ? 1 : 0;';
const legacyRewrite = {
  name: 'legacy-night-fade',
  setup(b) {
    b.onLoad({ filter: /components\/Stage\/index\.tsx$/ }, async (args) => {
      let src = await fs.promises.readFile(args.path, 'utf8');
      if (!src.includes(LEGACY_ANCHOR)) {
        console.error(`--legacy: anchor not found in ${args.path} — the fade has been rewritten; update LEGACY_ANCHOR.`);
        process.exit(1);
      }
      const i = src.indexOf(LEGACY_ANCHOR);
      const end = src.indexOf('sun.intensity', i);
      src = `${src.slice(0, i)}nightK += ((nightRef.current ? 1 : 0) - nightK) * 0.06;\n      ${src.slice(end)}`;
      return { contents: src, loader: 'tsx' };
    });
  },
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

say(`[toggle] bundling${LEGACY ? ' (LEGACY per-frame fade)' : ''}…`);
const bundle = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent',
  plugins: LEGACY ? [componentAlias, legacyRewrite] : [componentAlias],
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});

const htmlPath = path.join(HARNESS, 'out', `night-toggle-${GPU}${LEGACY ? '-legacy' : ''}.html`);
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
  // Program counters. `renderer.info.programs.length` is a CACHE SIZE, so it
  // cannot distinguish "11 compiled" from "11 compiled, 11 freed"; count the GL
  // entry points instead. (`linkProgram` returns immediately on ANGLE Metal — the
  // real compile lands at first DRAW — so treat the ms fields as a floor.)
  w.__gl = { create: 0, link: 0, del: 0, linkMs: 0, paramMs: 0 };
  const wrap = (proto) => {
    if (!proto) return;
    const c = proto.createProgram; const l = proto.linkProgram;
    const p = proto.getProgramParameter; const d = proto.deleteProgram;
    proto.createProgram = function (...a) { w.__gl.create += 1; return c.apply(this, a); };
    proto.deleteProgram = function (...a) { w.__gl.del += 1; return d.apply(this, a); };
    proto.linkProgram = function (...a) { const t = performance.now(); const r = l.apply(this, a); w.__gl.linkMs += performance.now() - t; w.__gl.link += 1; return r; };
    proto.getProgramParameter = function (...a) { const t = performance.now(); const r = p.apply(this, a); w.__gl.paramMs += performance.now() - t; return r; };
  };
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);

  let apiRef = null;
  let prev = performance.now();
  const tick = () => {
    const now = performance.now();
    if (!apiRef) apiRef = document.querySelector('canvas')?.__stageApi ?? null;
    let lights = 0; let nk = null;
    if (apiRef) {
      apiRef.scene.traverse((o) => {
        if ((o.isPointLight || o.isSpotLight) && o.visible) lights += 1;
        if (o.userData && typeof o.userData.nightK === 'number') nk = o.userData.nightK;
      });
    }
    // [t, gapMs, visibleLights, programCache, programsCreated, nightK, phase]
    w.__nt.gaps.push([+(now - t0).toFixed(1), +(now - prev).toFixed(1), lights,
      apiRef?.renderer?.info?.programs?.length ?? 0, w.__gl.create, nk === null ? null : +nk.toFixed(4), w.__nt.phase]);
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
say(`[toggle] ${env.renderer} · dpr ${env.dpr} · throttle ${THROTTLE}x · ${path.basename(parkFile)}${LEGACY ? ' · LEGACY FADE' : ''}`);

// ---- wait for the park to STOP GROWING (same detector as probe-assembly) ----
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
say(`[toggle] settled: ${settledAt ? `${(settledAt.t / 1000).toFixed(1)} s · ${settledAt.nodes} nodes · ${settledAt.draws} draws · ${settledAt.lights} lights visible · ${settledAt.culled} culled` : 'NEVER (still growing)'}`);

/** median rAF gap over the last `n` recorded frames — the honest frame time */
const steadyMs = (n = 20) => page.evaluate((k) => {
  const g = window.__nt.gaps.slice(-k).map((x) => x[1]).sort((a, b) => a - b);
  return g.length ? g[Math.floor(g.length / 2)] : null;
}, n);

const clickToggle = async (phase, want, baselineMs) => {
  const t0 = Date.now();
  await page.evaluate((p) => {
    window.__nt.phase = p;
    window.__nt.marks[p] = performance.now() - window.__nt.t0;
    window.__nt[`gl_${p}`] = { ...window.__gl };
    const b = [...document.querySelectorAll('button')].find((x) => /Switch to (day|night)/.test(x.getAttribute('aria-label') || ''));
    if (!b) throw new Error('no UIDayNight button found');
    b.click();
  }, phase);
  // RECOVERED = nightK landed + the light count stopped moving for 3 polls, and
  // — going to DAY — the frame time is back inside 2x the pre-click baseline.
  //
  // The frame-time clause is deliberately NOT applied to the night direction: a
  // park with 168 visible point lights runs at ~1.3 s/frame no matter what, so
  // "is the frame fast again" is unsatisfiable at night and an earlier revision
  // of this probe declared night-on "recovered" at 850 ms while the lamps were
  // still shed — then billed their arrival to the NEXT phase. A minimum dwell
  // covers the cull's coalescing window instead.
  let quiet = 0; let last = -1; let landed = false; let recoveredMs = null;
  for (;;) {
    const s = await page.evaluate(() => {
      const api = document.querySelector('canvas')?.__stageApi;
      let nk = null; let lights = 0;
      api.scene.traverse((o) => {
        if (o.userData && typeof o.userData.nightK === 'number') nk = o.userData.nightK;
        if ((o.isPointLight || o.isSpotLight) && o.visible) lights += 1;
      });
      const g = window.__nt.gaps.slice(-6).map((x) => x[1]).sort((a, b) => a - b);
      return { nk, lights, frameMs: g.length ? g[Math.floor(g.length / 2)] : null };
    });
    landed = want === 1 ? s.nk >= 1 : s.nk <= 0;
    quiet = s.lights === last ? quiet + 1 : 0;
    last = s.lights;
    const fast = want === 1
      ? Date.now() - t0 > 2500 // minimum dwell: let the coalesced restore land
      : s.frameMs !== null && s.frameMs <= Math.max(2 * baselineMs, baselineMs + 8);
    if (landed && quiet >= 3 && fast) { recoveredMs = Date.now() - t0; break; }
    if (Date.now() - t0 > CAP_S * 1000) break;
    await page.waitForTimeout(120);
  }
  const gl = await page.evaluate((p) => {
    const g = window.__gl; const b = window.__nt[`gl_${p}`];
    return { create: g.create - b.create, del: g.del - b.del };
  }, phase);
  const steady = await steadyMs(12);
  const nk = await page.evaluate(() => { let k = null; document.querySelector('canvas').__stageApi.scene.traverse((o) => { if (o.userData && typeof o.userData.nightK === 'number') k = o.userData.nightK; }); return k; });
  const verdict = recoveredMs === null ? `NOT RECOVERED in ${CAP_S} s` : `recovered in ${recoveredMs} ms`;
  say(`[toggle] ${phase}: ${verdict} · nightK ${nk === null ? '?' : nk.toFixed(3)} · ${last} lights · frame now ${steady} ms · ${gl.create} programs compiled`);
  return { phase, recoveredMs, timedOut: recoveredMs === null, nightK: nk, lights: last, steadyMs: steady, programs: gl.create };
};

const results = [];
for (let c = 1; c <= CYCLES; c += 1) {
  const dayBase = await steadyMs(30);
  say(`\n[toggle] cycle ${c}: steady DAY frame ${dayBase} ms`);
  results.push({ cycle: c, ...await clickToggle(`c${c}-night-on`, 1, dayBase), dayBaselineMs: dayBase });
  const nightBase = await steadyMs(12);
  say(`[toggle] cycle ${c}: steady NIGHT frame ${nightBase} ms`);
  // the click the user complains about: turn the lighting back OFF
  results.push({ cycle: c, ...await clickToggle(`c${c}-night-off`, 0, dayBase), nightFrameMs: nightBase });
}
await page.evaluate(() => { window.__nt.phase = 'after'; });
await page.waitForTimeout(1500);

// ---- WHAT DOES ONE NOVEL LIGHT COUNT COST? ---------------------------------
// The toggle's residual cost is a single frame in which the visible light count
// lands somewhere the park has never drawn. This prices that directly, at
// settled day, WITHOUT a synthetic render loop: raise one shed lamp to a
// negligible-but-non-zero intensity (0.01 — the cull leaves it alone above ON,
// and it contributes nothing a screenshot can see), let the app render it, and
// read the rAF gap plus the program counter. Then put it back and do it AGAIN:
// the second time the count is no longer novel, so the difference is the price
// of the compile.
const countProbe = async () => {
  const pick = await page.evaluate(() => {
    const api = document.querySelector('canvas').__stageApi;
    const dark = [];
    api.scene.traverse((o) => { if (o.isPointLight && !o.visible) dark.push(o); });
    if (!dark.length) return false;
    window.__probeLamp = dark[0];
    window.__probeLampI = dark[0].intensity;
    return true;
  });
  if (!pick) return null;
  const step = async (label) => {
    const before = await page.evaluate(() => ({ create: window.__gl.create, n: window.__nt.gaps.length }));
    await page.evaluate(() => { window.__probeLamp.intensity = 0.01; window.__probeLamp.visible = true; });
    await page.waitForTimeout(700);
    const on = await page.evaluate((b) => {
      const g = window.__nt.gaps.slice(b.n);
      return { worstGap: Math.max(...g.map((x) => x[1])), programs: window.__gl.create - b.create, lights: g[g.length - 1][2] };
    }, before);
    await page.evaluate(() => { window.__probeLamp.intensity = 0; });
    await page.waitForTimeout(700); // let the cull shed it again
    return { label, ...on };
  };
  return [await step('novel count'), await step('same count again')];
};
const counts = await countProbe();
if (counts) for (const c of counts) say(`[toggle] +1 light (${c.label}): worst frame ${c.worstGap} ms · ${c.programs} programs compiled · ${c.lights} lights`);
const rec = await page.evaluate(() => ({ gaps: window.__nt.gaps, marks: window.__nt.marks, gl: window.__gl }));

if (SHOT) {
  const p = path.isAbsolute(SHOT) ? SHOT : path.join(HARNESS, SHOT);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  await page.screenshot({ path: p });
  say(`[toggle] shot -> ${p}`);
}

const report = (phase) => {
  const g = rec.gaps.filter((x) => x[6] === phase);
  if (!g.length) return { phase, frames: 0 };
  const gapsMs = g.map((x) => x[1]);
  const over50 = gapsMs.filter((x) => x > 50);
  let steps = 0;
  for (let i = 1; i < g.length; i += 1) if (g[i][2] !== g[i - 1][2]) steps += 1;
  return {
    phase, frames: g.length, spanS: +((g[g.length - 1][0] - g[0][0]) / 1000).toFixed(1),
    freezeMs: +over50.reduce((a, b) => a + b - 16.7, 0).toFixed(0),
    worstGapMs: Math.max(...gapsMs), gapsOver50: over50.length,
    lightCounts: [...new Set(g.map((x) => x[2]))], lightSteps: steps,
    cacheStart: g[0][3], cacheEnd: g[g.length - 1][3],
  };
};
const phases = [...new Set(rec.gaps.map((x) => x[6]))].map(report);
const out = {
  park: path.basename(parkFile), gpu: GPU, dpr: DPR, throttle: THROTTLE, renderer: env.renderer,
  legacyFade: LEGACY, settled: settledAt, toggles: results, phases,
  totalPrograms: rec.gl.create, programsDeleted: rec.gl.del, novelCountCost: counts,
  warnings: lines.filter((l) => /warn|error|Stage:/i.test(l)).slice(0, 6),
  gaps: rec.gaps,
};
if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\n${'phase'.padEnd(16)} frames  span   FREEZE   worst   >50ms  light counts (steps)  programs`);
  for (const p of phases) {
    if (!p.frames) continue;
    const lc = p.lightCounts.length <= 6 ? p.lightCounts.join('→') : `${p.lightCounts.length} distinct ${Math.min(...p.lightCounts)}..${Math.max(...p.lightCounts)}`;
    console.log(`${p.phase.padEnd(16)} ${String(p.frames).padStart(6)} ${`${p.spanS}s`.padStart(6)} ${`${p.freezeMs}ms`.padStart(8)} ${`${p.worstGapMs}ms`.padStart(8)} ${String(p.gapsOver50).padStart(6)}   ${lc} (${p.lightSteps})   ${p.cacheStart}→${p.cacheEnd}`);
  }
  const save = arg('save', null);
  if (save) { fs.writeFileSync(path.isAbsolute(save) ? save : path.join(HARNESS, save), JSON.stringify(out, null, 2)); console.log(`\n[toggle] saved ${save}`); }
}
await browser.close();
