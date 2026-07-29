#!/usr/bin/env node
// ---------------------------------------------------------------------------
// FRAME-COST probe — what a park frame costs ON A REAL GPU, and which candidate
// optimisation actually buys anything there.
//
// ---- WHY THIS EXISTS ALONGSIDE probe-render-cost.mjs ----------------------
//
// Every perf number this project had recorded before this probe was measured
// under `--use-angle=swiftshader`, i.e. a CPU software rasteriser. That is not a
// small distortion, it is a DIFFERENT MACHINE:
//
//   * SwiftShader's cost is ~all per-fragment shader work and overdraw. Adding a
//     light to a forward shader costs it a fortune; adding 500 draw calls costs
//     it almost nothing.
//   * A real GPU is the mirror image. Fragments are nearly free at 900x700, and
//     the frame is bounded by DRAW CALLS / state changes / CPU-side scene walk.
//
// Recorded evidence that the two disagree: the same build read "31.6 and 28.8
// fps" in a SwiftShader probe while the in-page perf line said 7.6 and 11.9.
//
// THE FIX IS NOT A BETTER ESTIMATE, IT IS A REAL GPU. Playwright's bundled
// chromium, launched HEADLESS with `--use-angle=metal --ignore-gpu-blocklist`,
// reports:
//   ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)
// i.e. hardware. `--gpu=metal` (the DEFAULT here) measures that; `--gpu=swift`
// reproduces the old software numbers for comparison. The probe PRINTS the
// unmasked renderer string every run, so no number in its output is ever
// environment-ambiguous again.
//
// ---- HOW A FRAME IS TIMED, AND WHY NOT BY rAF GAP -------------------------
//
// On a real GPU the rAF gap is VSYNC-CLAMPED: a park that costs 4 ms and one
// that costs 15 ms both read ~16.7 ms, so an rAF-gap probe cannot see any
// improvement until the frame is already over budget, and cannot see a
// REGRESSION at all until it crosses 16.7. Worse, `renderer.render()` only
// QUEUES work — returning from it means the driver accepted the commands, not
// that the GPU ran them, so timing the call alone measures CPU submit cost only.
//
// So two numbers are reported per variant:
//
//   `gpuMs`  — N explicit renders in a tight loop, then ONE `gl.finish()`, wall
//              time / N. The finish forces the pipeline to drain, so this is
//              real end-to-end cost (CPU walk + submit + GPU execution),
//              amortised over N so a single finish's fixed cost is divided away.
//              THIS IS THE NUMBER TO GRADE ON.
//   `cpuMs`  — the same loop with no finish: the CPU-side scene walk, frustum
//              cull and command submission alone. `gpuMs - cpuMs` tells you
//              whether a park is CPU-bound (the draw-call path) or GPU-bound
//              (fill/shader), which decides which optimisation can possibly
//              help. A park where cpuMs ≈ gpuMs will not be fixed by fog.
//
// rAF gap is reported too, but only as a reality check on the other two.
//
// ---- VARIANTS ARE INTERLEAVED ---------------------------------------------
// Copied from probe-render-cost.mjs, for the reason documented there: a first
// version of that probe ran variants as consecutive blocks and the RE-TIMED
// BASELINE came back 37% slower than the identical first baseline. Machine
// drift over a run is larger than most effects being measured. Rounds are
// A,B,C,…,A,B,C,… and each variant reports the median OF ITS ROUND MEDIANS plus
// the per-round series, so drift is visible instead of silent.
//
// ---- THE VARIANTS ---------------------------------------------------------
//   baseline           — untouched.
//   farPlane*          — camera.far pulled to a multiple of the orbit distance
//                        AND scene.fog moved to match, which is the only honest
//                        way to price "add fog": fog alone changes pixel colour,
//                        never what is submitted. Reports the draw/tri delta, so
//                        a variant that culled NOTHING is visible as such
//                        instead of being read as a null perf result.
//   guestsHidden       — every GameManager guest rig invisible. Prices the crowd.
//   shadowFrozen       — renderer.shadowMap.autoUpdate = false.
//   darkLightsRestored — un-does Stage/darkLights.ts (via a render wrapper; see
//                        probe-render-cost.mjs for why nothing simpler holds),
//                        so the shipped cull is priced in the direction that
//                        matters now that it has shipped.
//   pixelRatio1        — prices fill rate directly.
//
// ---- THE CPU-PATH VARIANTS (2026-07-28) -----------------------------------
// Everything above prices what the GPU is asked to do. Once `cpuMs ≈ gpuMs` was
// established, the interesting question moved to the three things three.js does
// on the CPU for every object in the scene, every frame, before a single draw is
// submitted. These variants price each one as an UPPER BOUND — they do the most
// aggressive possible version of the optimisation, so a null result here kills
// the idea outright and a large one says how much is worth chasing:
//
//   matrixFrozen   — `scene.matrixWorldAutoUpdate = false` after one manual
//                    `updateMatrixWorld(true)`. `WebGLRenderer.render` calls
//                    `scene.updateMatrixWorld()` first, which recurses the WHOLE
//                    graph recomposing matrices. This is the ceiling on
//                    "set matrixAutoUpdate = false on the static park".
//   offscreenCulled — every direct child of the park group whose world bounding
//                    sphere misses the frustum is set `visible = false`, which
//                    makes three.js skip the SUBTREE in `projectObject` instead
//                    of descending it and frustum-testing every mesh inside.
//                    This is the ceiling on fixing `parkContext.applyTier`,
//                    whose tier 3 hides only `lodDetail` + `points` and leaves
//                    the entry's meshes to be walked and tested individually.
//   sortDisabled   — `renderer.sortObjects = false`. Prices the per-frame sort
//                    of ~1900 render items.
//   shadowOff      — `renderer.shadowMap.enabled = false`. Prices the ENTIRE
//                    shadow pass (a second full scene walk + submission), which
//                    `shadowFrozen` only partly avoids because a frozen map
//                    still costs nothing to walk but a disabled one skips the
//                    material/uniform work too.
//
// `--nodeCensus` prints how many Object3D nodes exist per visible mesh: that
// ratio is the multiplier on every per-object walk, and a park with 6 nodes per
// mesh is paying 6x for its own scene-graph nesting.
//
// ---- --throttle: MEASURE ON THE MACHINE THAT COMPLAINED -------------------
// `Emulation.setCPUThrottlingRate` over CDP. This M4 Pro renders DemoPark's
// settled frame in 3.2 ms and the user calls the same park "super laggy", so the
// only honest place to grade a CPU-path optimisation is at a rate where the
// frame is actually over budget. Measured: 4.17 ms whole-loop at 1x, 18.26 at
// 4x, 32.53 at 6x — i.e. ~linear, and 4x is already 30 fps behind vsync.
// The throttle is NAMED in the output next to the renderer.
//
// USAGE
//   node probe-frame-cost.mjs [--park=<abs .tsx>] [--export=DemoPark]
//        [--gpu=metal|swift] [--rounds=5] [--renders=30] [--stable=6]
//        [--throttle=1] [--variants=a,b,c] [--nodeCensus]
//        [--guests=N] [--json] [--save=out/x.json]
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
// --repo lets this probe measure a DIFFERENT design-system tree with the same
// code path, which is the whole mechanism behind the before/after A/B: extract an
// older tree with `git archive <rev> -- .../mp3d | tar -x -C /tmp` (NEVER
// `git checkout` — almost everything here is uncommitted work) and point --repo
// at it. Each tree is measured with ITS OWN Park.previews.tsx, so the components
// and the park that composes them always match.
const REPO = path.resolve(arg('repo', path.resolve(HARNESS, '..', '..', 'mp3d')));
// `--sample=parkA-99` profiles a REAL GENERATED PARK from
// `harness/park-eval/samples` instead of the size-16 DemoPark. That matters more
// than it sounds: DemoPark is 979 meshes / 1874 draws and parkA-99 is 7164 /
// 3224, so a conclusion drawn on the demo is drawn at 1/7 the scene.
const SAMPLES = path.resolve(HARNESS, '..', 'park-eval', 'samples');
const SAMPLE = arg('sample', null);
const parkFile = SAMPLE
  ? (fs.existsSync(path.join(SAMPLES, SAMPLE)) ? path.join(SAMPLES, SAMPLE) : path.join(SAMPLES, `${SAMPLE}.tsx`))
  : arg('park', path.join(REPO, 'components/Park/Park.previews.tsx'));
const exportName = arg('export', SAMPLE ? '__default__' : 'DemoPark');
const GPU = arg('gpu', 'metal');
const ROUNDS = Number(arg('rounds', 5));
const RENDERS = Number(arg('renders', 30));
const STABLE = Number(arg('stable', 6));
const ONLY = (arg('variants', '') || '').split(',').filter(Boolean);
const JSON_OUT = process.argv.includes('--json');
const SAVE = arg('save', null);
const W = Number(arg('w', 1440));
const H = Number(arg('h', 900));
// DEVICE PIXEL RATIO. Headless chromium defaults to 1, and at dpr 1 the
// `pixelRatio1` variant is a NO-OP that reads as "fill rate is free": Stage sets
// `min(devicePixelRatio, quality.pixelRatio)`, which is 1 either way, so the
// variant re-sets the ratio it already had. The user is on a RETINA display,
// where `<Park quality='medium'>` resolves to 1.5 and the frame shades 2.25x the
// fragments. Default 2 so the measurement matches the machine the complaint came
// from; pass --dpr=1 to reproduce the earlier dpr-1 numbers.
const DPR = Number(arg('dpr', 2));
const THROTTLE = Number(arg('throttle', 1));
const CENSUS = process.argv.includes('--nodeCensus');

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
// THE PROBE NEEDS THREE'S MATH CLASSES (Frustum/Sphere/Box3) to reproduce
// parkContext's own visibility test in-page, and the bundle is an IIFE with no
// global. esbuild resolves this specifier to the SAME module instance the
// components get, so a Sphere built here is the one the components' Frustum
// accepts.
window.__THREE = THREE;
import * as M from ${JSON.stringify(parkFile)};
const named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));
const C = M[${JSON.stringify(exportName)}] || M.default || (named[0] || [])[1];
if (!C) console.error('[probe-frame-cost] no component export found');
else createRoot(document.getElementById('root')).render(React.createElement(C));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-frame-cost.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

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
      // FLAT DIALECT: `./Park` rather than `./components/Park`. Half the
      // park-eval samples are written that way (briarwood, cinder-peak).
      const bare = args.path.replace(/^\.{1,2}\//, '');
      if (!bare.includes('/')) {
        const hit = tryFiles(path.join(REPO, 'components', bare));
        if (hit) return { path: hit };
      }
      return null;
    });
    // ONE COPY OF THREE. A sample under `harness/park-eval/samples` resolves
    // `three` to park-eval's node_modules while the components resolve it to this
    // probe's — two program caches, two sets of classes, "WARNING: Multiple
    // instances of Three.js being imported", and an `instanceof` that fails
    // across the boundary so `window.__THREE`'s Frustum/Sphere are useless
    // against the components' objects. MEASURED COST OF NOT DOING THIS: the same
    // parkA-99 load read 184 shader programs and 14.5 s of stall with two copies
    // versus 169 and 4.5 s with one — an entirely fictitious result.
    const THREE_MAIN = tryFiles(path.join(HARNESS, 'node_modules', 'three', 'build', 'three.module.js'))
      ?? tryFiles(path.join(HARNESS, 'node_modules', 'three'));
    if (THREE_MAIN) b.onResolve({ filter: /^three$/ }, () => ({ path: THREE_MAIN }));
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

const htmlPath = path.join(HARNESS, 'out', `frame-cost-${GPU}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

// REAL GPU vs SOFTWARE. `metal` is headless-but-hardware on macOS (verified by
// the renderer string this probe prints). `swift` reproduces the historical
// software numbers so an old measurement can be compared like-for-like.
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
// THROTTLE BEFORE NAVIGATION so the park also ASSEMBLES at the target rate —
// a frame timed on a park that was built fast and then slowed down is not the
// same frame (shader programs, geometry uploads and the terrain rebuild all
// land differently).
if (THROTTLE > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
}
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });

// THE ENVIRONMENT RECEIPT. Printed with every result: a frame time whose
// renderer is unknown is the exact mistake this probe exists to stop.
const env = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown',
    dpr: window.devicePixelRatio,
    viewport: [window.innerWidth, window.innerHeight],
  };
});

let ready = false;
for (let i = 0; i < 240 && !ready; i += 1) {
  await page.waitForTimeout(500);
  ready = (await page.evaluate(() => !!window.__parkReport)) || lines.some((l) => /validatePark →/.test(l));
}
if (!ready) { console.error('probe-frame-cost: park never reported'); await browser.close(); process.exit(1); }

// SETTLE. A park keeps assembling for ~15 s past onReady (build queue drains,
// terrain rebuilds, the gate keeps admitting guests), so a sample taken at
// onReady is a sample of a half-built park.
const series = [];
let stableRun = 0;
for (let i = 0; i < 120; i += 1) {
  const s = await page.evaluate(() => document.querySelector('canvas')?.__stageApi?.stats?.() ?? null);
  if (!s) break;
  series.push(`${s.drawCalls}/${(s.triangles / 1000).toFixed(0)}k`);
  const prevSame = series.length > 1 && series[series.length - 2] === series[series.length - 1];
  stableRun = prevSame ? stableRun + 1 : 0;
  if (stableRun >= STABLE - 1) break;
  await page.waitForTimeout(400);
}

// ---- in-page instrumentation ------------------------------------------------
// Installed once. Everything below drives it, so the variant switch and the
// timer live in the SAME page context and no round-trip lands between them.
await page.evaluate(() => {
  const api = document.querySelector('canvas').__stageApi;
  const w = window;
  w.__fc = {
    api,
    gl: api.renderer.getContext(),
    // saved originals, restored by revert()
    orig: {
      far: api.camera.far,
      fogNear: api.scene.fog ? api.scene.fog.near : null,
      fogFar: api.scene.fog ? api.scene.fog.far : null,
      pixelRatio: api.renderer.getPixelRatio(),
      shadowAuto: api.renderer.shadowMap.autoUpdate,
      shadowEnabled: api.renderer.shadowMap.enabled,
      render: api.renderer.render.bind(api.renderer),
    },
    hidden: [],
    lightWrap: null,
    extraCam: null,
  };
  // GUEST RIGS. `GameManager/spawn.ts` puts `userData.guestRef` (the GuestInfo
  // accessor, used for clickability) on every peep group — that is the only
  // stable per-guest tag in the scene. Count is reported per variant so a
  // variant that found ZERO guests shows up as such instead of reading as
  // "hiding the crowd bought nothing".
  w.__fc.guestRoots = () => {
    const out = [];
    api.scene.traverse((o) => { if (o.userData && o.userData.guestRef) out.push(o); });
    return out;
  };
  // THE PARK GROUP. `parkContext.addObject` adds every runtime entry as a DIRECT
  // CHILD of the group Stage handed to `build()`, so that group's children are
  // the entry roots — which is exactly the granularity `applyTier` works at.
  // Identified as the descendant of the scene with the most children (a park has
  // ~29 entries; Stage's own scene children are the lights, the player pill and
  // the ground). Reported so a misidentification is visible rather than silent.
  //
  // IDENTIFIED BY DESCENDANT MESH COUNT AMONG THE SCENE'S DIRECT CHILDREN, not
  // by "most children". The first version used the most-children node and picked
  // the TERRAIN DRESSING group — 38 single-mesh children totalling 90 draws of a
  // 1874-draw frame — which read as "no entry costs anything" and would have
  // killed the guest and shadow findings as null results.
  w.__fc.parkGroup = (() => {
    const meshCount = (o) => { let n = 0; o.traverse((x) => { if (x.isMesh || x.isInstancedMesh) n += 1; }); return n; };
    let best = null; let bestN = -1;
    for (const c of api.scene.children) { const n = meshCount(c); if (n > bestN) { bestN = n; best = c; } }
    return best ?? api.scene;
  })();
});

const camInfo = await page.evaluate(() => {
  const { api } = window.__fc;
  const c = api.camera;
  return { far: c.far, near: c.near, fov: c.fov, pos: c.position.toArray(), fog: api.scene.fog ? { near: api.scene.fog.near, far: api.scene.fog.far } : null };
});

// ---- apply + time + revert, IN ONE SYNCHRONOUS BLOCK ------------------------
// The first version of this probe did `apply()`, `time()`, `revert()` as three
// separate `page.evaluate` calls and the results were WRONG IN A WAY THAT LOOKED
// LIKE A FINDING. Two live per-frame owners overwrite exactly what the variants
// set, and both get to run in the rAF frames that land between round-trips:
//
//   * `Stage/darkLights.ts` re-sheds zero-intensity lights on a 0.25 s cadence.
//     `darkLightsRestored` therefore leaked its 24 visible lights forward into
//     the NEXT variant's window — so `baseline` was timed with 24 lights and
//     `farPlane35` with 3, and the far plane got credit for -17% that was
//     actually 21 lights leaving the forward shader. The reading looked exactly
//     like the culling win the task hypothesised.
//   * GameManager's guest pass rewrites each peep's `visible` every frame, so
//     `guestsHidden` had its guests back before its own timing loop began; it
//     still printed `{"guests":26}` because the COUNT was taken at apply time.
//
// Everything therefore happens inside one `page.evaluate`: no rAF can interleave,
// so nothing can restore what the variant changed. The receipt is the per-variant
// `lights`/`meshes`/`draws` columns, all read from a render INSIDE the block.
const measure = (spec, N) => page.evaluate(({ v, o, N: n }) => {
  const f = window.__fc;
  const { api, gl } = f;
  const { scene, camera, renderer } = api;
  const info = renderer.info;
  const note = {};
  const hidden = [];
  let forceLights = null;

  // ---- apply ---------------------------------------------------------------
  if (v === 'farPlane') {
    // FOG + FAR PLANE AS ONE CHANGE. Fog alone submits exactly the same
    // geometry; it only pays when the far plane comes in with it, because the
    // far plane is what makes three.js frustum-cull the far field.
    camera.far = o.far;
    camera.updateProjectionMatrix();
    if (scene.fog) { scene.fog.near = o.far * o.nearFrac; scene.fog.far = o.far * 0.97; }
    note.far = Math.round(o.far);
  } else if (v === 'guestsHidden') {
    // TWO POPULATIONS SINCE THE INSTANCED FAR CROWD (GameManager/crowd.ts):
    //   * the NEAR guests still on full `buildPeep` rigs — tagged `guestRef`,
    //     hidden the way this variant always did;
    //   * everyone else, drawn from eight `InstancedMesh` pools named `crowd:*`.
    // Hiding only the first found ZERO on a park whose camera sits at the orbit
    // distance (every guest is far), which read as "the crowd is free" when what
    // had actually happened is that the crowd moved. The click PROXIES also carry
    // `guestRef` now and are permanently invisible, so they are skipped by the
    // `g.visible` test and never counted.
    const gs = f.guestRoots();
    for (const g of gs) if (g.visible) { g.visible = false; hidden.push(g); }
    note.guestRigs = hidden.length;
    let pooled = 0;
    api.scene.traverse((o) => {
      if (o.isInstancedMesh && String(o.name).startsWith('crowd:') && o.visible) {
        o.visible = false;
        hidden.push(o);
        pooled += o.count;
      }
    });
    note.crowdPools = hidden.length - note.guestRigs;
    note.crowdInstances = pooled / Math.max(1, hidden.length - note.guestRigs);
    note.guestsHidden = note.guestRigs + note.crowdInstances;
  } else if (v === 'shadowFrozen') {
    renderer.shadowMap.autoUpdate = false;
  } else if (v === 'darkLightsRestored') {
    forceLights = [];
    scene.traverse((x) => { if ((x.isPointLight || x.isSpotLight) && !x.visible) forceLights.push(x); });
    for (const l of forceLights) l.visible = true;
    note.lightsRestored = forceLights.length;
  } else if (v === 'pixelRatio1') {
    renderer.setPixelRatio(1);
  } else if (v === 'matrixFrozen') {
    // UPPER BOUND on "matrixAutoUpdate = false on the static park". Do the walk
    // ONCE by hand, then forbid `render()` from doing it again. Reverted below,
    // so the live scene's animation is unaffected outside this block.
    scene.updateMatrixWorld(true);
    scene.matrixWorldAutoUpdate = false;
    note.matrixFrozen = true;
  } else if (v === 'offscreenCulled') {
    // UPPER BOUND on fixing applyTier tier 3. Hide the ENTRY SUBTREE, not the
    // leaves: three.js's `projectObject` returns immediately on an invisible
    // object and never descends it, so this is the difference between walking an
    // off-screen ride's 40 meshes and walking 1 node.
    const THREE_ = window.__THREE;
    const cam = camera;
    cam.updateMatrixWorld();
    const pm = new THREE_.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const frus = new THREE_.Frustum().setFromProjectionMatrix(pm);
    const sph = new THREE_.Sphere();
    const box = new THREE_.Box3();
    let tested = 0;
    for (const child of window.__fc.parkGroup.children) {
      if (!child.visible) continue;
      tested += 1;
      box.setFromObject(child);
      if (box.isEmpty()) continue;
      box.getBoundingSphere(sph);
      if (!frus.intersectsSphere(sph)) { child.visible = false; hidden.push(child); }
    }
    note.entriesTested = tested;
    note.entriesHidden = hidden.length;
  } else if (v === 'sortDisabled') {
    renderer.sortObjects = false;
  } else if (v === 'shadowOff') {
    renderer.shadowMap.enabled = false;
  } else if (v === 'shadowEvery') {
    f.shadowEvery = o.n;
    note.shadowEvery = o.n;
  } else if (v === 'insetOpen') {
    // ---- THE UI INSET, WHICH IS A SECOND FULL SCENE RENDER ------------------
    // §7 says a <Park> with a <GameManager/> wires RideViewer, GuestInfo and
    // attachPlayerCam for free, and all three call `api.addViewport`. Stage's
    // loop renders the WHOLE scene again per viewport (it reuses the shadow maps,
    // but the colour pass is full price). So the frame a user actually looks at
    // once they CLICK a ride or a guest — which is the entire point of the park —
    // is not the frame any probe here has ever timed.
    //
    // Reproduced as RideViewer builds it: a perspective camera orbiting a ride
    // at close range. `renderer.render` is called for it INSIDE the timing loop
    // (see `extraCam` below), so the variant's ms is main + inset, exactly as
    // the Stage loop pays it.
    const THREE_ = window.__THREE;
    let ride = null;
    scene.traverse((x) => { if (!ride && x.userData && x.userData.rideRef) ride = x; });
    const tgt = new THREE_.Vector3();
    if (ride) ride.getWorldPosition(tgt); else tgt.set(0, 0, 0);
    const cam = new THREE_.PerspectiveCamera(45, 1.6, 0.1, camera.far);
    cam.position.set(tgt.x + 6, tgt.y + 4, tgt.z + 6);
    cam.lookAt(tgt);
    cam.updateMatrixWorld();
    f.extraCam = cam;
    // the inset's OWN draw count: the honest question is whether a close camera
    // frustum-culls most of the park (cheap inset) or not (a doubled frame)
    info.reset();
    renderer.render(scene, cam);
    note.insetDraws = info.render.calls;
    note.insetOnRide = !!ride;
  }

  // ---- time ----------------------------------------------------------------
  // gpuMs: N renders then ONE gl.finish() — end to end (CPU walk + submit + GPU
  //        execution), amortised so the finish's own fixed cost divides away.
  // cpuMs: the same loop with no finish — scene walk, frustum cull and command
  //        submission only. gpuMs ≈ cpuMs means the park is CPU-BOUND, and no
  //        amount of fog or fill-rate work can fix it.
  // A FRAME, not a render: `extraCam` (the `insetOpen` variant) makes this the
  // main pass PLUS the inset pass, which is what Stage's loop actually submits.
  // The inset pass runs with the shadow map frozen, as Stage does.
  const extra = f.extraCam;
  let frameIdx = 0;
  const frame = () => {
    // SHADOW-MAP THROTTLE. `shadowOff` proved the shadow pass is 894 of 1874
    // draws (48%), but a park cannot ship without shadows and it cannot FREEZE
    // them either (guests and ride vehicles move, and `Stage`'s existing
    // `shadowFreezeAt` is deliberately armed only for a `staticScene`). The
    // middle option nobody has priced: keep the pass, run it every Nth frame.
    // `autoUpdate = false` + an explicit `needsUpdate` is three.js's supported
    // way to do that, and the visible consequence is that a moving object's
    // shadow lags by up to N-1 frames — on a guest whose shadow is a ~40-texel
    // PCF blob at park zoom, that is nothing.
    if (f.shadowEvery) {
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = frameIdx % f.shadowEvery === 0;
    }
    frameIdx += 1;
    renderer.render(scene, camera);
    if (extra) {
      const was = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      renderer.render(scene, extra);
      renderer.shadowMap.autoUpdate = was;
    }
  };
  const gpu = []; const cpu = [];
  for (let r = 0; r < 3; r += 1) {
    for (let i = 0; i < 3; i += 1) frame(); // warm a new shader permutation
    gl.finish();
    let t0 = performance.now();
    for (let i = 0; i < n; i += 1) frame();
    gl.finish();
    gpu.push((performance.now() - t0) / n);
    t0 = performance.now();
    for (let i = 0; i < n; i += 1) frame();
    cpu.push((performance.now() - t0) / n);
    gl.finish();
  }

  // ---- receipt: what was actually submitted, WITH the variant still applied --
  info.reset();
  renderer.render(scene, camera);
  let visLights = 0; let visMeshes = 0;
  scene.traverse((x) => {
    if ((x.isPointLight || x.isSpotLight) && x.visible) visLights += 1;
    if ((x.isMesh || x.isInstancedMesh) && x.visible) visMeshes += 1;
  });
  // NODE CENSUS. `projectObject` visits every Object3D, not every Mesh, so the
  // nodes-per-mesh ratio is the multiplier on the whole per-object walk.
  let nodes = 0;
  scene.traverseVisible(() => { nodes += 1; });
  const res = {
    gpuMs: Math.min(...gpu), cpuMs: Math.min(...cpu),
    calls: info.render.calls, triangles: info.render.triangles,
    programs: info.programs ? info.programs.length : null,
    lights: visLights, meshes: visMeshes, nodes, note,
  };

  // ---- revert --------------------------------------------------------------
  camera.far = f.orig.far;
  camera.updateProjectionMatrix();
  if (scene.fog && f.orig.fogNear !== null) { scene.fog.near = f.orig.fogNear; scene.fog.far = f.orig.fogFar; }
  renderer.setPixelRatio(f.orig.pixelRatio);
  renderer.shadowMap.autoUpdate = f.orig.shadowAuto;
  scene.matrixWorldAutoUpdate = true;
  renderer.sortObjects = true;
  f.extraCam = null;
  f.shadowEvery = 0;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.enabled = f.orig.shadowEnabled;
  for (const g of hidden) g.visible = true;
  if (forceLights) for (const l of forceLights) l.visible = false;
  return res;
}, { v: spec && spec[0], o: spec && spec[1], N });

const rafGap = () => page.evaluate(`((n) => new Promise((res) => {
  const gaps = []; let prev = performance.now(); let seen = 0;
  const tick = () => { const now = performance.now(); if (seen >= 4) gaps.push(now - prev); prev = now; seen += 1;
    if (gaps.length < n) requestAnimationFrame(tick);
    else { const s = gaps.sort((a,b)=>a-b); res({ median: s[Math.floor(s.length/2)], min: s[0] }); } };
  requestAnimationFrame(tick);
}))(20)`);

// ---- variant table ----------------------------------------------------------
// The farPlane candidates are expressed as a FRACTION OF THE CURRENT far plane,
// so the same table is meaningful on a 16-unit park and a 128-unit one.
const VARIANTS = [
  ['baseline', null, null],
  ['farPlane55', 'farPlane', { far: camInfo.far * 0.55, nearFrac: 0.45 }],
  ['farPlane35', 'farPlane', { far: camInfo.far * 0.35, nearFrac: 0.45 }],
  ['guestsHidden', 'guestsHidden', null],
  ['shadowFrozen', 'shadowFrozen', null],
  ['darkLightsRestored', 'darkLightsRestored', null],
  ['pixelRatio1', 'pixelRatio1', null],
  // the CPU-path upper bounds (see the header)
  ['matrixFrozen', 'matrixFrozen', null],
  ['offscreenCulled', 'offscreenCulled', null],
  ['sortDisabled', 'sortDisabled', null],
  ['shadowOff', 'shadowOff', null],
  ['shadowEvery3', 'shadowEvery', { n: 3 }],
  ['insetOpen', 'insetOpen', null],
].filter(([k]) => !ONLY.length || ONLY.includes(k) || k === 'baseline');

const pooled = Object.fromEntries(VARIANTS.map(([k]) => [k, []]));
const notes = {};
const lastInfo = {};
for (let r = 0; r < ROUNDS; r += 1) {
  for (const [k, v, opt] of VARIANTS) {
    const t = await measure(v ? [v, opt] : null, RENDERS);
    pooled[k].push(t);
    lastInfo[k] = t;
    notes[k] = t.note && Object.keys(t.note).length ? t.note : null;
    // let the live scene settle back: the dark-light cull's cadence is 0.25 s and
    // the guest pass runs per frame, so a short pause guarantees the NEXT
    // variant starts from the park's own steady state rather than this one's
    // leftovers. (Not a substitute for the single-block measure() above — the
    // revert is what makes it correct; this only removes the transient.)
    await page.waitForTimeout(350);
  }
}
// ---- DRAW ATTRIBUTION (--attribute) ----------------------------------------
// The variants above say WHICH KIND of work costs; this says WHICH OBJECT pays
// it. Measured by difference, not by counting meshes: hide one entry root, render,
// read `renderer.info.render.calls`, restore. That is exact (it includes the
// entry's shadow-pass draws and any material-sharing effects) where a static
// mesh count is a guess.
//
// The COLOUR/SHADOW SPLIT is the second column: the same delta re-measured with
// `shadowMap.enabled = false`. `shadow = withShadows - colourOnly` is the number
// of extra draws an entry costs purely for casting, which is the one figure that
// says whether `castShadow` hygiene is worth anything on that entry.
//
// ONE synchronous evaluate, for the reason documented above `measure`.
let attribution = null;
if (process.argv.includes('--attribute')) {
  attribution = await page.evaluate(() => {
    const { api, parkGroup } = window.__fc;
    const { scene, camera, renderer } = api;
    const info = renderer.info;
    const shadowWas = renderer.shadowMap.enabled;
    const count = () => { info.reset(); renderer.render(scene, camera); return info.render.calls; };
    // A LABEL FOR AN UNNAMED GROUP. Every runtime entry root is an anonymous
    // `THREE.Group`, so keying or reporting by `.name` collapses all 29 rows into
    // one bucket — the first version of this did exactly that and printed the
    // same `colour` figure on every line. Rows are keyed by INDEX, and labelled
    // from whatever identifying marks the subtree carries: the GameManager's
    // `rideRef`/`guestRef` tags, then the first named descendant.
    const label = (child, i) => {
      let ride = null; let guests = 0; let named = null;
      child.traverse((o) => {
        const ud = o.userData || {};
        if (ud.rideRef && !ride) ride = ud.rideRef.name || ud.rideRef.type || 'ride';
        if (ud.guestRef) guests += 1;
        if (!named && o.name) named = o.name;
      });
      if (guests) return `${guests} guest rig(s)`;
      if (ride) return `ride: ${ride}`;
      if (child.name) return child.name;
      if (named) return `~${named}`;
      return `entry#${i}`;
    };
    const pass = () => {
      const total = count();
      const rows = [];
      parkGroup.children.forEach((child, i) => {
        if (!child.visible) return;
        child.visible = false;
        const without = count();
        child.visible = true;
        let meshes = 0; let casters = 0;
        child.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { meshes += 1; if (o.castShadow) casters += 1; } });
        rows.push({ i, name: label(child, i), draws: total - without, meshes, casters });
      });
      return { total, rows };
    };
    // RECEIPT that the right group was found: if these do not roughly bracket
    // the frame's draw total, the attribution table is measuring a subtree.
    let groupMeshes = 0;
    parkGroup.traverse((o) => { if (o.isMesh || o.isInstancedMesh) groupMeshes += 1; });
    let sceneMeshes = 0;
    scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) sceneMeshes += 1; });
    const withShadow = pass();
    withShadow.groupMeshes = groupMeshes;
    withShadow.sceneMeshes = sceneMeshes;
    withShadow.children = parkGroup.children.length;
    renderer.shadowMap.enabled = false;
    const colourOnly = pass();
    renderer.shadowMap.enabled = shadowWas;
    const byName = new Map(colourOnly.rows.map((r) => [r.i, r.draws]));
    return {
      total: withShadow.total, colourTotal: colourOnly.total,
      groupMeshes: withShadow.groupMeshes, sceneMeshes: withShadow.sceneMeshes, children: withShadow.children,
      rows: withShadow.rows.map((r) => ({ ...r, colour: byName.get(r.i) ?? null, shadow: r.draws - (byName.get(r.i) ?? 0) }))
        .sort((a, b) => b.draws - a.draws),
    };
  });
}

const raf = await rafGap();
const perfLine = lines.find((l) => l.includes('[Park] perf:')) ?? null;
await browser.close();

const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const results = Object.fromEntries(VARIANTS.map(([k]) => {
  const rs = pooled[k];
  return [k, {
    gpuMs: { median: med(rs.map((x) => x.gpuMs)), min: Math.min(...rs.map((x) => x.gpuMs)), perRound: rs.map((x) => +x.gpuMs.toFixed(1)) },
    cpuMs: { median: med(rs.map((x) => x.cpuMs)), min: Math.min(...rs.map((x) => x.cpuMs)) },
    calls: lastInfo[k].calls, triangles: lastInfo[k].triangles,
    lights: lastInfo[k].lights, meshes: lastInfo[k].meshes, nodes: lastInfo[k].nodes, programs: lastInfo[k].programs,
    note: notes[k] ?? null,
  }];
}));

const out = {
  park: path.relative(REPO, parkFile), export: exportName,
  gpu: GPU, renderer: env.renderer, throttle: THROTTLE, viewport: [W, H], dpr: env.dpr,
  camera: camInfo, settleSeries: series, rafGap: raf, perfLine, results, attribution,
};
if (SAVE) { fs.mkdirSync(path.dirname(path.resolve(SAVE)), { recursive: true }); fs.writeFileSync(path.resolve(SAVE), JSON.stringify(out, null, 2)); }
if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`\nFRAME COST — ${out.park} :: ${exportName}`);
console.log(`  ENVIRONMENT  ${env.renderer}`);
console.log(`               viewport ${W}x${H} @ dpr ${env.dpr} (backing store ${Math.round(W * env.dpr)}x${Math.round(H * env.dpr)}), --gpu=${GPU}, CPU THROTTLE ${THROTTLE}x
  tree         ${REPO}`);
console.log(`  census       ${results.baseline.nodes} visible Object3D nodes for ${results.baseline.meshes} meshes (${(results.baseline.nodes / Math.max(1, results.baseline.meshes)).toFixed(2)} nodes/mesh — the multiplier on every per-object walk)`);
console.log(`  camera       far ${camInfo.far.toFixed(1)}  fog ${camInfo.fog ? `${camInfo.fog.near.toFixed(1)} → ${camInfo.fog.far.toFixed(1)}` : 'off'}`);
console.log(`  settle       ${series.join(' → ')}`);
console.log(`  rAF gap      median ${raf.median.toFixed(1)} ms / min ${raf.min.toFixed(1)} ms  ${raf.median < 18 && raf.median > 15 ? '(VSYNC-CLAMPED — do not grade on this)' : ''}`);
console.log(`\n  ${ROUNDS} interleaved rounds x ${RENDERS} renders; gpuMs = renders+gl.finish()/N, cpuMs = submit only`);
console.log(`  ${'variant'.padEnd(20)} ${'gpuMs'.padStart(8)} ${'Δ'.padStart(7)} ${'cpuMs'.padStart(8)} ${'draws'.padStart(6)} ${'tris'.padStart(9)} ${'lights'.padStart(6)} ${'meshes'.padStart(7)}  note`);
const base = results.baseline.gpuMs.median;
for (const [k, v] of Object.entries(results)) {
  const d = k === 'baseline' ? '' : `${(((v.gpuMs.median - base) / base) * 100).toFixed(0)}%`;
  console.log(`  ${k.padEnd(20)} ${v.gpuMs.median.toFixed(2).padStart(8)} ${d.padStart(7)} ${v.cpuMs.median.toFixed(2).padStart(8)} ${String(v.calls).padStart(6)} ${String(v.triangles).padStart(9)} ${String(v.lights).padStart(6)} ${String(v.meshes).padStart(7)}  ${v.note ? JSON.stringify(v.note) : ''}   [${v.gpuMs.perRound.join(',')}]`);
}
if (attribution) {
  console.log(`\n  DRAW ATTRIBUTION — ${attribution.total} draws with shadows, ${attribution.colourTotal} with the shadow pass off (so ${attribution.total - attribution.colourTotal} draws, ${(((attribution.total - attribution.colourTotal) / attribution.total) * 100).toFixed(0)}%, ARE the shadow pass)`);
  console.log(`  park group: ${attribution.children} entry roots holding ${attribution.groupMeshes} of the scene's ${attribution.sceneMeshes} meshes`);
  console.log(`  ${'entry'.padEnd(30)} ${'draws'.padStart(6)} ${'colour'.padStart(7)} ${'shadow'.padStart(7)} ${'meshes'.padStart(7)} ${'casters'.padStart(8)}`);
  for (const r of attribution.rows.slice(0, 24))
    console.log(`  ${r.name.slice(0, 30).padEnd(30)} ${String(r.draws).padStart(6)} ${String(r.colour).padStart(7)} ${String(r.shadow).padStart(7)} ${String(r.meshes).padStart(7)} ${String(r.casters).padStart(8)}`);
  const tail = attribution.rows.slice(24);
  if (tail.length) console.log(`  ${`… ${tail.length} more`.padEnd(30)} ${String(tail.reduce((a, r) => a + r.draws, 0)).padStart(6)}`);
}
if (perfLine) console.log(`\n  the DS's own line: ${perfLine}`);
