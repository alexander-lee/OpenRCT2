#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ASSEMBLY-WINDOW probe — what the park costs BEFORE it is settled, and how it
// behaves on a WEAK machine.
//
// ---- WHY THIS EXISTS ALONGSIDE probe-frame-cost.mjs -----------------------
//
// `probe-frame-cost.mjs` deliberately waits for the park to stop growing before
// it times anything, because a sample of a half-built park is not a frame time.
// That is the right call for grading a frame — and it means EVERY perf number
// this project has describes the SETTLED park only.
//
// The user's complaint is "super laggy", against a harness reading of 2.87 ms /
// ~350 fps on a real Apple M4 Pro. A settled-frame number cannot explain that
// gap, and there are exactly two places the gap can hide:
//
//   1. THE ASSEMBLY WINDOW. A park keeps assembling for ~15 s past `onReady`:
//      the time-sliced build queue drains, <Terrain> rebuilds, and the gate
//      keeps admitting guests (DemoPark asks for 10 and settles at 22). Fifteen
//      seconds of jank on load IS what "super laggy" feels like, and no probe
//      here has ever looked at it.
//   2. THE USER'S MACHINE. An MP preview is an iframe in their browser. It can
//      land on a low-power adapter or fall back to software, and their CPU is
//      not this M4 Pro. Since the settled frame is CPU-BOUND (cpuMs ≈ gpuMs;
//      dropping dpr 2→1 costs +2%), a slower CPU scales the frame ~linearly.
//
// So this probe measures TIME, not counters, across the whole life of the page,
// under an explicit CPU throttle:
//
//   * rAF gap SERIES from the very first frame (installed via addInitScript, so
//     it is running before React mounts) with a wall-clock stamp on every gap.
//     Reported as phase buckets, worst gap, and total time spent in gaps over
//     50 ms / 100 ms / 250 ms — the "stall budget".
//   * LONG TASKS via PerformanceObserver. A long task is main-thread time in
//     which the page cannot answer a click or a drag. This is the number that
//     corresponds to "laggy" for a user who is trying to orbit the camera.
//   * MILESTONES: first frame, canvas present, `__parkReport` (onReady),
//     build-queue drain, counter steady state.
//   * `window.__buildMarks` (the store's own per-build profile, enabled here
//     with `__PARK_PROFILE`), so an expensive phase is attributable to a named
//     build rather than to "load".
//
// ---- CPU THROTTLING -------------------------------------------------------
// `Emulation.setCPUThrottlingRate` over CDP. 1 = this machine, 4 = a mid
// laptop / a busy tab, 6 = a genuinely weak one. THE THROTTLE IS NAMED IN EVERY
// LINE OF OUTPUT, for the same reason probe-frame-cost.mjs prints the renderer:
// a millisecond whose machine is unknown is how this project spent a day
// optimising SwiftShader.
//
// The throttle is applied BEFORE navigation so it covers assembly, and it is
// (optionally) lifted for a settled-frame reading, so one run gives both
// "how bad is the load" and "how bad is the steady frame" at the same rate.
//
// ---- WHAT IT DOES NOT DO --------------------------------------------------
// It never calls `gl.finish()` and never grades a variant. Timing a variant
// belongs in probe-frame-cost.mjs, which does apply/time/revert in ONE
// synchronous evaluate because two live per-frame owners (the dark-light cull's
// 0.25 s cadence, GameManager's per-frame guest visibility pass) will otherwise
// restore a variant before its own timing loop ends.
//
// USAGE
//   node probe-assembly.mjs [--park=<abs .tsx>] [--export=DemoPark]
//        [--gpu=metal|swift] [--dpr=2] [--throttle=1] [--settled]
//        [--repo=<tree>] [--window=45] [--json] [--save=out/x.json]
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
// ---- --sample: PROFILE A REAL GENERATED PARK, NOT THE TOY -------------------
// `Park.previews.tsx :: DemoPark` is a size-16 demo with 29 runtime entries. The
// generator emits size 128–192 parks with several times that, and those are what
// the user looks at. `harness/park-eval/samples/*.tsx` holds real generated
// output (parkA-99/parkB-99 at size 128 are the two reference parks that hold
// the 99.00 score; briarwood is size 192). `--sample=parkA-99` profiles one.
const SAMPLES = path.resolve(HARNESS, '..', 'park-eval', 'samples');
const SAMPLE = arg('sample', null);
const parkFile = SAMPLE
  ? (fs.existsSync(path.join(SAMPLES, SAMPLE)) ? path.join(SAMPLES, SAMPLE) : path.join(SAMPLES, `${SAMPLE}.tsx`))
  : arg('park', path.join(REPO, 'components/Park/Park.previews.tsx'));
if (!fs.existsSync(parkFile)) { console.error(`probe-assembly: no such park file ${parkFile}`); process.exit(1); }
const exportName = arg('export', SAMPLE ? '__default__' : 'DemoPark');
const GPU = arg('gpu', 'metal');
const DPR = Number(arg('dpr', 2));
const THROTTLE = Number(arg('throttle', 1));
const WINDOW_S = Number(arg('window', 45));
const W = Number(arg('w', 1440));
const H = Number(arg('h', 900));
const JSON_OUT = process.argv.includes('--json');
const SAVE = arg('save', null);
const WANT_SETTLED = process.argv.includes('--settled');
// ---- REPRODUCING THE MAGIC PATTERNS PREVIEW, NOT JUST A FAST HARNESS --------
// Every probe here has bundled with `NODE_ENV=production` and mounted the park
// bare. An MP preview is neither: it is a dev build inside `<React.StrictMode>`.
// Both of those change the frame, and one of them can change it by 2x:
//   --strict  wraps the park in StrictMode, which DOUBLE-INVOKES every effect.
//             `Stage`'s effect creates the WebGLRenderer, the scene and the rAF
//             loop; if its cleanup does not fully undo that, StrictMode leaves
//             TWO renderers driving TWO loops over TWO scenes on one page, which
//             halves the frame rate for free and is invisible to a production
//             probe.
//   --dev     NODE_ENV=development: React's dev reconciler, and three.js
//             keeping its dev-only assertions.
// Both default OFF so existing numbers stay comparable; turn them on to ask
// "is the user's environment the difference".
const STRICT = process.argv.includes('--strict');
const DEV = process.argv.includes('--dev');
// ---- SOAK: DOES THE PARK STAY THE SIZE IT SETTLED AT? -----------------------
// Every probe in this directory stops the moment the counters hold still, and
// `probe-frame-cost.mjs` stops after 6 identical samples ≈ 12 s. A user leaves
// the preview open for minutes. `--soak=N` ignores the settle detector, runs the
// full N seconds, and re-times the frame at intervals, so an unbounded grower
// (a guest stream that never caps, a rebuild that re-adds instead of replacing)
// is visible as a RISING frame cost rather than as a settled number.
const SOAK = Number(arg('soak', 0));

const say = (s) => { if (!JSON_OUT) console.log(s); };

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import * as M from ${JSON.stringify(parkFile)};
const named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));
const C = M[${JSON.stringify(exportName)}] || M.default || (named[0] || [])[1];
window.__THREE = THREE;
if (!C) console.error('[probe-assembly] no component export found');
else createRoot(document.getElementById('root')).render(${STRICT ? 'React.createElement(React.StrictMode, null, React.createElement(C))' : 'React.createElement(C)'});
`;
const entryPath = path.join(HARNESS, 'out', '_entry-assembly.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

// ---- IMPORT RESOLUTION FOR BOTH SAMPLE DIALECTS ------------------------------
// A generated park writes its imports the way the Magic Patterns editor lays a
// project out, and there are TWO dialects on disk:
//   `./components/Park`  (parkA-99, r16b, monorail-ref)
//   `./Park`             (briarwood, cinder-peak — flat, no components/ segment)
// Both must land on `mp3d/components/<Name>`. Resolving only the first dialect
// makes half the corpus fail to bundle with a confusing "could not resolve
// ./Park", which reads like a broken sample rather than a probe limitation.
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
      // dialect 1: anything containing components/
      if (args.path.includes('components/')) {
        const hit = tryFiles(path.join(REPO, args.path.slice(args.path.indexOf('components/'))));
        if (hit) return { path: hit };
      }
      // dialect 2: a bare relative name that IS a component directory. Checked
      // against REPO/components only, so a sample's own sibling files (if any)
      // still resolve normally by falling through to esbuild.
      const bare = args.path.replace(/^\.{1,2}\//, '');
      if (!bare.includes('/')) {
        const hit = tryFiles(path.join(REPO, 'components', bare));
        if (hit) return { path: hit };
      }
      return null;
    });
    // ONE COPY OF THREE. A sample lives in `harness/park-eval/samples`, so node
    // resolution finds `harness/park-eval/node_modules/three` for it while the
    // components (resolved into `mp3d/`) get `harness/mp3d-render/node_modules/
    // three`. Two copies means "WARNING: Multiple instances of Three.js being
    // imported", two separate program caches, and an `instanceof` that fails
    // across the boundary — which would make the probe's own Frustum/Sphere
    // unusable against the components' objects. Pin every `three` specifier to
    // this probe's copy.
    const THREE_MAIN = tryFiles(path.join(HARNESS, 'node_modules', 'three', 'build', 'three.module.js'))
      ?? tryFiles(path.join(HARNESS, 'node_modules', 'three'));
    if (THREE_MAIN) b.onResolve({ filter: /^three$/ }, () => ({ path: THREE_MAIN }));
  },
};

say('[assembly] bundling…');
const bundle = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': DEV ? '"development"' : '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent',
  plugins: [componentAlias],
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});

const htmlPath = path.join(HARNESS, 'out', `assembly-${GPU}-t${THROTTLE}${STRICT ? '-strict' : ''}${DEV ? '-dev' : ''}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const GPU_ARGS = {
  metal: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-frame-rate-limit'],
  swift: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'],
};
if (!GPU_ARGS[GPU]) { console.error(`--gpu must be one of ${Object.keys(GPU_ARGS).join('|')}`); process.exit(1); }

const browser = await chromium.launch({ args: GPU_ARGS[GPU] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const lines = [];
page.on('console', (m) => { const t = m.text(); if (!/GL Driver|ReadPixels/.test(t)) lines.push(t); });
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

// ---- the recorder, installed BEFORE any page script -------------------------
// addInitScript runs before the bundle, so the very first rAF gap and the very
// first long task are both captured. `__PARK_PROFILE` is set here too, which is
// the flag parkContext's `runOneBuild` checks to fill `window.__buildMarks`.
await page.addInitScript(() => {
  const w = window;
  w.__PARK_PROFILE = true;
  const t0 = performance.now();
  w.__asm = { t0, gaps: [], longTasks: [], marks: {}, mark: (k) => { if (w.__asm.marks[k] === undefined) w.__asm.marks[k] = performance.now() - t0; } };

  // ---- LEAK COUNTERS --------------------------------------------------------
  // A StrictMode double-mount is only a perf bug if the cleanup does not fully
  // undo the mount, so the counters have to distinguish "created twice, one
  // survives" from "created twice, both survive":
  //   glContexts  — every successful webgl/webgl2 getContext, i.e. every
  //                 WebGLRenderer ever constructed on this page. Chrome caps a
  //                 renderer process at ~16 live contexts and kills the oldest
  //                 past that, so this number also predicts a hard failure in
  //                 an editor session that remounts repeatedly.
  //   rafPerFrame — rAF callbacks registered per animation frame. THE Stage loop
  //                 re-registers itself once per frame; a LEAKED loop shows up
  //                 here as a permanently higher count, which is the only
  //                 signal that survives the canvas being removed from the DOM.
  //   canvases    — canvases still attached to the document.
  w.__asm.glContexts = 0;
  const realGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = realGetContext.call(this, type, ...rest);
    if (ctx && /webgl/i.test(String(type))) w.__asm.glContexts += 1;
    return ctx;
  };
  const realRaf = w.requestAnimationFrame.bind(w);
  let rafThisFrame = 0;
  w.__asm.rafPerFrame = [];
  w.requestAnimationFrame = (cb) => { rafThisFrame += 1; return realRaf(cb); };

  // ---- SHADER-PROGRAM TIMELINE ----------------------------------------------
  // three.js compiles a program the first time it renders a material with a new
  // feature signature, and the compile+link is SYNCHRONOUS inside
  // `renderer.render`. During assembly each newly built component can introduce
  // a signature nobody has drawn yet, so a load spike may be a compile rather
  // than a build. Recorded on the SAME rAF as the gap so a spike and a program
  // count jump share an index and the correlation is a join, not an eyeball.
  //
  // AND THE VISIBLE LIGHT COUNT, on the same tick. three.js bakes the number of
  // lights into a material's program cache key, so EVERY time the count changes
  // every material in the scene needs a NEW program. `Stage/darkLights.ts` sheds
  // zero-intensity lights on a 0.25 s cadence, and during assembly new lamps keep
  // arriving — so the count can move repeatedly while the park builds, and each
  // move can invalidate the whole program cache. parkContext already documents
  // this for the opt-in light budget ("keeping the ACTIVE set the same size
  // avoids three.js re-compiling the forward shaders"); this records whether it
  // is happening during load.
  let apiRef = null;
  let lastProgs = 0;
  const progs = () => {
    if (!apiRef) apiRef = document.querySelector('canvas')?.__stageApi ?? null;
    const p = apiRef?.renderer?.info?.programs?.length;
    return typeof p === 'number' ? p : lastProgs;
  };
  const lightCount = () => {
    if (!apiRef) return 0;
    let n = 0;
    apiRef.scene.traverse((o) => { if ((o.isPointLight || o.isSpotLight || o.isDirectionalLight) && o.visible) n += 1; });
    return n;
  };

  let prev = performance.now();
  const tick = () => {
    const now = performance.now();
    const p = progs();
    // [wall time since recorder start, gap ms, program count, programs compiled
    //  during this gap, visible lights] — the 4th makes a compile spike
    //  identifiable and the 5th says whether a light-count change caused it
    w.__asm.gaps.push([now - t0, now - prev, p, p - lastProgs, lightCount()]);
    lastProgs = p;
    // rAF registrations during the frame just ended. This recorder's own two
    // self-rescheduling loops (tick + watch) are subtracted at report time.
    w.__asm.rafPerFrame.push(rafThisFrame);
    rafThisFrame = 0;
    prev = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__asm.longTasks.push([e.startTime - t0, e.duration]);
    }).observe({ entryTypes: ['longtask'] });
  } catch { /* longtask unsupported: gaps still tell the story */ }
  // milestone watcher, on the same rAF the recorder already owns
  const watch = () => {
    if (document.querySelector('canvas')) w.__asm.mark('canvas');
    if (document.querySelector('canvas')?.__stageApi) w.__asm.mark('stageApi');
    if (w.__parkReport) w.__asm.mark('parkReport');
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
});

const cdp = await page.context().newCDPSession(page);
if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

const navStart = Date.now();
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });

const env = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown', dpr: window.devicePixelRatio, hw: navigator.hardwareConcurrency };
});
say(`[assembly] ${env.renderer} · dpr ${env.dpr} · CPU throttle ${THROTTLE}x · ${exportName}`);

// ---- watch the whole window ------------------------------------------------
// Sampled from OUTSIDE at 500 ms, but every number reported comes from the
// in-page recorder's own timestamps, so the sampling cadence never shows up in
// a result. The counter series is what identifies "settled".
const counters = [];
const soakFrames = [];
let settledAt = null;
let stableRun = 0;
let lastKey = '';
let lastNodeKey = '';
const TOTAL_S = SOAK || WINDOW_S;
for (let i = 0; i < Math.ceil((TOTAL_S * 1000) / 500); i += 1) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const api = document.querySelector('canvas')?.__stageApi;
    const st = api?.stats?.();
    const w = window;
    if (!st) return null;
    // GRAPH CENSUS, not just the renderer's counters: a grower that adds nodes
    // the frustum happens to reject would leave `drawCalls` flat while still
    // costing the per-object walk that this frame is bound by.
    let meshes = 0; let all = 0; let guests = 0;
    api.scene.traverse((o) => {
      all += 1;
      if (o.isMesh || o.isInstancedMesh) meshes += 1;
      if (o.userData && o.userData.guestRef) guests += 1;
    });
    return {
      t: performance.now() - w.__asm.t0, draws: st.drawCalls, tris: st.triangles,
      frameMs: st.frameMs ?? null, nodes: all, meshes, guests,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null,
    };
  });
  if (!s) continue;
  counters.push(s);
  const key = `${s.draws}/${s.tris}`;
  stableRun = key === lastKey ? stableRun + 1 : 0;
  lastKey = key;
  // A FLAT COUNTER IS NOT ALWAYS A SETTLED PARK. Since the streamed content
  // mounts invisible and is revealed in one step (parkContext `addObject`),
  // `drawCalls` sits at the terrain's handful for the WHOLE assembly — four
  // identical samples of that plateau used to be read as "settled 7.5 s",
  // which is a load time for a park that had not appeared yet. The graph
  // census is the honest witness: it keeps climbing the entire time (253 →
  // 7085 nodes on parkA-99 while draws never left 4), so a sample only counts
  // toward the stable run once the node count has stopped moving too.
  const nodeKey = `${s.nodes}/${s.meshes}`;
  if (nodeKey !== lastNodeKey) stableRun = 0;
  lastNodeKey = nodeKey;
  if (stableRun === 4 && settledAt === null) settledAt = s.t; // 2 s of no change
  if (!SOAK && settledAt !== null && s.t > settledAt + 3000) break;
  // SOAK: re-time the frame every 20 s so a rise is a measurement, not an
  // inference from the counters.
  if (SOAK && i > 0 && i % 40 === 0) {
    const f = await page.evaluate((n) => {
      const api = document.querySelector('canvas').__stageApi;
      const { scene, camera, renderer } = api;
      const gl = renderer.getContext();
      for (let k = 0; k < 3; k += 1) renderer.render(scene, camera);
      gl.finish();
      const t = performance.now();
      for (let k = 0; k < n; k += 1) renderer.render(scene, camera);
      gl.finish();
      return (performance.now() - t) / n;
    }, 20);
    soakFrames.push({ atS: +(s.t / 1000).toFixed(0), gpuMs: +f.toFixed(2), draws: s.draws, meshes: s.meshes, guests: s.guests });
    say(`[soak] ${(s.t / 1000).toFixed(0)}s  ${f.toFixed(2)} ms  ${s.draws} draws  ${s.meshes} meshes  ${s.guests} guests  ${s.heapMB} MB`);
  }
}
say(`[assembly] window closed; settled ${settledAt === null ? 'NEVER (still growing)' : `${(settledAt / 1000).toFixed(1)} s`}`);

// ---- optional settled-frame reading AT THE SAME THROTTLE --------------------
// The point of doing it here rather than in probe-frame-cost.mjs is the
// throttle: this answers "is the steady frame itself unusable on a weak CPU",
// which is the other half of the user's complaint. One synchronous evaluate,
// for the reason documented in probe-frame-cost.mjs.
let settledFrame = null;
if (WANT_SETTLED) {
  settledFrame = await page.evaluate((n) => {
    const api = document.querySelector('canvas').__stageApi;
    const { scene, camera, renderer } = api;
    const gl = renderer.getContext();
    const gpu = []; const cpu = [];
    for (let r = 0; r < 3; r += 1) {
      for (let i = 0; i < 3; i += 1) renderer.render(scene, camera);
      gl.finish();
      let t = performance.now();
      for (let i = 0; i < n; i += 1) renderer.render(scene, camera);
      gl.finish();
      gpu.push((performance.now() - t) / n);
      t = performance.now();
      for (let i = 0; i < n; i += 1) renderer.render(scene, camera);
      cpu.push((performance.now() - t) / n);
      gl.finish();
    }
    const info = renderer.info;
    info.reset();
    renderer.render(scene, camera);
    let meshes = 0;
    scene.traverseVisible((o) => { if (o.isMesh || o.isInstancedMesh) meshes += 1; });
    return { gpuMs: Math.min(...gpu), cpuMs: Math.min(...cpu), calls: info.render.calls, triangles: info.render.triangles, meshes };
  }, 20);
  say(`[assembly] settled frame @${THROTTLE}x: ${settledFrame.gpuMs.toFixed(2)} ms gpu / ${settledFrame.cpuMs.toFixed(2)} ms cpu`);
}

const rec = await page.evaluate(() => {
  const w = window;
  const marks = { ...w.__asm.marks };
  const rpf = w.__asm.rafPerFrame;
  return {
    gaps: w.__asm.gaps, longTasks: w.__asm.longTasks, marks, buildMarks: w.__buildMarks ?? [],
    // PROGRAM CENSUS. 171 programs for one park is only a problem if they are
    // near-duplicates. three.js's WebGLProgram carries the material `name` (i.e.
    // its type) and the full `cacheKey` it was interned under, so grouping by
    // name says how many variants of the SAME material class exist — which is
    // the signature of a feature/light-count explosion rather than of a park
    // that genuinely uses 171 different shaders.
    programCensus: (() => {
      const api = document.querySelector('canvas')?.__stageApi;
      const ps = api?.renderer?.info?.programs ?? [];
      const byName = {};
      for (const p of ps) byName[p.name || '?'] = (byName[p.name || '?'] ?? 0) + 1;
      // WHICH FIELD IS DOING THE VARYING. `cacheKey` is a comma-joined dump of
      // every parameter three.js bakes into the shader, so splitting on commas
      // and counting distinct values per POSITION names the exact axis along
      // which a park is exploding its program count — which is the difference
      // between "this park needs 184 shaders" and "one boolean is off by
      // material and could be normalised".
      const keys = ps.map((p) => String(p.cacheKey ?? ''));
      const fields = {};
      for (const k of keys) k.split(',').forEach((v, i) => { (fields[i] ??= new Set()).add(v); });
      const varying = Object.entries(fields)
        .filter(([, s]) => s.size > 1)
        .map(([i, s]) => ({ pos: +i, distinct: s.size, values: [...s].slice(0, 8) }))
        .sort((a, b) => b.distinct - a.distinct);
      return { total: ps.length, byName, varying, keys };
    })(),
    leaks: {
      glContexts: w.__asm.glContexts,
      canvases: document.querySelectorAll('canvas').length,
      // steady-state rAF registrations per frame, minus this recorder's own 2
      rafLoops: Math.max(0, Math.round(rpf.slice(-60).reduce((a, b) => a + b, 0) / Math.max(1, rpf.slice(-60).length)) - 2),
      stageApis: (() => { let n = 0; document.querySelectorAll('canvas').forEach((c) => { if (c.__stageApi) n += 1; }); return n; })(),
    },
  };
});
await browser.close();

// ---- analysis ---------------------------------------------------------------
const gaps = rec.gaps.slice(1); // the first gap includes recorder install
const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

const ready = rec.marks.parkReport ?? null;
const phase = (name, from, to) => {
  const g = gaps.filter(([t]) => t >= from && (to === null || t < to)).map(([, d]) => d);
  return {
    name, from: from / 1000, to: to === null ? null : to / 1000, frames: g.length,
    median: med(g), p95: pct(g, 0.95), worst: g.length ? Math.max(...g) : 0,
    over50: g.filter((d) => d > 50).length, over100: g.filter((d) => d > 100).length,
    // STALL: time the page was NOT answering. A 300 ms gap is 283 ms of a user's
    // drag going nowhere; sum the excess over a 16.7 ms frame.
    stallMs: g.reduce((a, d) => a + Math.max(0, d - 16.7), 0),
  };
};
const phases = ready
  ? [phase('pre-ready (mount + build queue)', 0, ready), phase('post-ready assembly', ready, ready + 15000), phase('settled', ready + 15000, null)]
  : [phase('whole window (never reported ready)', 0, null)];

// 1 s buckets, so a spike's position in the load is visible rather than averaged
const lastT = gaps.length ? gaps[gaps.length - 1][0] : 0;
const buckets = [];
for (let s = 0; s < Math.ceil(lastT / 1000); s += 1) {
  const rows = gaps.filter(([t]) => t >= s * 1000 && t < (s + 1) * 1000);
  const g = rows.map(([, d]) => d);
  buckets.push({
    s, frames: g.length, worst: g.length ? +Math.max(...g).toFixed(0) : 0, median: +med(g).toFixed(1),
    programs: rows.length ? rows[rows.length - 1][2] : null,
    compiled: rows.reduce((a, r) => a + Math.max(0, r[3] || 0), 0),
  });
}

// ---- THE SPIKE TABLE: WHAT WAS THE PAGE DOING IN EACH BIG GAP? -------------
// The user feels spikes, not averages, so the report leads with the individual
// gaps over 100 ms and attributes each one. Attribution is by coincidence in
// time with the two things that can own a long synchronous block:
//   `compiled` — programs that appeared during this very gap (shader compile)
//   `builds`   — queued builds whose cumulative cost lands in this gap's window
// A spike with neither is unattributed and says so, rather than being silently
// assigned to whichever hypothesis is fashionable.
let bmClock = rec.marks.canvas ?? 0;
const bmTimeline = rec.buildMarks.map((b) => { const at = bmClock; bmClock += b.ms; return { name: b.name, ms: b.ms, from: at, to: bmClock }; });
// Walked by index over the FULL series, so "the light count before this gap" is
// literally the previous sample rather than a lookup that has to re-find it.
const spikes = [];
for (let i = 0; i < gaps.length; i += 1) {
  const [t, d, p, dp, lt] = gaps[i];
  if (d <= 100) continue;
  const from = t - d;
  const inWin = bmTimeline.filter((b) => b.to > from && b.from < t);
  const prevLights = i > 0 ? gaps[i - 1][4] : lt;
  spikes.push({
    atS: +(from / 1000).toFixed(2), gapMs: +d.toFixed(0), programs: p, compiled: dp,
    lights: lt, lightsDelta: lt - prevLights,
    builds: inWin.slice(0, 4).map((b) => `${b.name} ${b.ms.toFixed(0)}ms`),
    buildMsInWindow: +inWin.reduce((a, b) => a + b.ms, 0).toFixed(0),
  });
}
spikes.sort((a, b) => b.gapMs - a.gapMs);

const lt = rec.longTasks;
const ltTotal = lt.reduce((a, [, d]) => a + d, 0);
const ltPreReady = ready ? lt.filter(([t]) => t < ready) : lt;
const bm = rec.buildMarks.slice().sort((a, b) => b.ms - a.ms);
const bmTotal = rec.buildMarks.reduce((a, b) => a + b.ms, 0);

const out = {
  park: path.relative(REPO, parkFile), export: exportName, tree: REPO,
  gpu: GPU, renderer: env.renderer, dpr: env.dpr, throttle: THROTTLE, strict: STRICT, dev: DEV, hardwareConcurrency: env.hw,
  leaks: rec.leaks, programCensus: rec.programCensus,
  viewport: [W, H], marks: rec.marks, settledAt, counters, soakFrames, phases, buckets, spikes,
  longTasks: { count: lt.length, totalMs: ltTotal, worstMs: lt.length ? Math.max(...lt.map(([, d]) => d)) : 0, preReadyCount: ltPreReady.length, preReadyMs: ltPreReady.reduce((a, [, d]) => a + d, 0), top: lt.slice().sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, d]) => ({ atS: +(t / 1000).toFixed(2), ms: +d.toFixed(0) })) },
  buildMarks: { count: rec.buildMarks.length, totalMs: +bmTotal.toFixed(1), top: bm.slice(0, 15).map((b) => ({ name: b.name, ms: +b.ms.toFixed(1) })) },
  settledFrame,
  perfLine: lines.find((l) => l.includes('[Park] perf:')) ?? null,
  errors: lines.filter((l) => /pageerror|FAIL|Error|warn/i.test(l)).slice(0, 20),
  console: lines,
};

if (SAVE) { fs.mkdirSync(path.dirname(path.resolve(SAVE)), { recursive: true }); fs.writeFileSync(path.resolve(SAVE), JSON.stringify(out, null, 2)); }
if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`\nASSEMBLY — ${out.park} :: ${exportName}`);
console.log(`  ENVIRONMENT  ${env.renderer}`);
console.log(`               dpr ${env.dpr} · viewport ${W}x${H} · CPU THROTTLE ${THROTTLE}x · ${env.hw} cores · --gpu=${GPU} · ${STRICT ? 'StrictMode' : 'no StrictMode'} · NODE_ENV=${DEV ? 'development' : 'production'}`);
console.log(`  LEAKS        ${rec.leaks.glContexts} WebGL contexts created · ${rec.leaks.canvases} canvas in DOM · ${rec.leaks.stageApis} live StageApi · ${rec.leaks.rafLoops} rAF loop(s) per frame${rec.leaks.rafLoops > 1 || rec.leaks.stageApis > 1 ? '   <-- MORE THAN ONE STAGE IS RUNNING' : ''}`);
console.log(`  milestones   ${Object.entries(rec.marks).map(([k, v]) => `${k} ${(v / 1000).toFixed(2)}s`).join(' · ')}`);
console.log(`  settled      ${settledAt === null ? 'NEVER inside the window' : `${(settledAt / 1000).toFixed(1)} s`}`);
console.log(`\n  rAF GAPS by phase (ms) — 'stall' = Σ max(0, gap - 16.7), i.e. time the page could not answer`);
console.log(`  ${'phase'.padEnd(32)} ${'frames'.padStart(6)} ${'median'.padStart(7)} ${'p95'.padStart(7)} ${'worst'.padStart(7)} ${'>50'.padStart(5)} ${'>100'.padStart(5)} ${'stall'.padStart(9)}`);
for (const p of phases) console.log(`  ${p.name.padEnd(32)} ${String(p.frames).padStart(6)} ${p.median.toFixed(1).padStart(7)} ${p.p95.toFixed(1).padStart(7)} ${p.worst.toFixed(0).padStart(7)} ${String(p.over50).padStart(5)} ${String(p.over100).padStart(5)} ${`${(p.stallMs / 1000).toFixed(2)}s`.padStart(9)}`);
console.log(`\n  per-second  worst gap ms / shader programs (+compiled this second):`);
console.log(`  ${buckets.map((b) => `${b.s}s:${b.worst}/${b.programs ?? '-'}${b.compiled ? `+${b.compiled}` : ''}`).join(' ')}`);
console.log(`\n  SPIKES > 100 ms — ${spikes.length} of them, ${(spikes.reduce((a, s) => a + s.gapMs, 0) / 1000).toFixed(2)}s in total`);
console.log(`  ${'at'.padStart(7)} ${'gap'.padStart(7)} ${'progs'.padStart(6)} ${'+compiled'.padStart(9)} ${'lights'.padStart(7)} ${'Δlights'.padStart(8)}  builds landing in the gap`);
for (const s of spikes.slice(0, 16))
  console.log(`  ${`${s.atS}s`.padStart(7)} ${`${s.gapMs}ms`.padStart(7)} ${String(s.programs).padStart(6)} ${String(s.compiled).padStart(9)} ${String(s.lights).padStart(7)} ${String(s.lightsDelta).padStart(8)}  ${s.builds.join(', ') || '(no build in window)'}`);
console.log(`\n  PROGRAM CENSUS ${rec.programCensus.total} programs: ${Object.entries(rec.programCensus.byName).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')}`);
console.log(`\n  LONG TASKS   ${lt.length} totalling ${(ltTotal / 1000).toFixed(2)}s, worst ${out.longTasks.worstMs.toFixed(0)} ms; ${ltPreReady.length} (${(out.longTasks.preReadyMs / 1000).toFixed(2)}s) before onReady`);
console.log(`               top: ${out.longTasks.top.map((x) => `${x.atS}s/${x.ms}ms`).join(' ')}`);
console.log(`\n  BUILD MARKS  ${rec.buildMarks.length} queued builds totalling ${bmTotal.toFixed(0)} ms`);
for (const b of out.buildMarks.top) console.log(`    ${b.ms.toFixed(1).padStart(8)} ms  ${b.name}`);
if (out.settledFrame) console.log(`\n  SETTLED FRAME @${THROTTLE}x  gpu ${out.settledFrame.gpuMs.toFixed(2)} ms · cpu ${out.settledFrame.cpuMs.toFixed(2)} ms · ${out.settledFrame.calls} draws · ${out.settledFrame.meshes} meshes`);
console.log(`  counters     ${counters.map((c) => `${(c.t / 1000).toFixed(0)}s:${c.draws}`).join(' ')}`);
if (out.perfLine) console.log(`\n  the DS's own line: ${out.perfLine}`);
if (out.errors.length) console.log(`\n  console: ${out.errors.join('\n           ')}`);
