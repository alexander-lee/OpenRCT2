// park-eval EVAL-TAG HARNESS — bundling + page for arbitrary mp3d park TSX.
//
// Read-only over the design system: every instrumentation ("eval tag") is
// injected IN MEMORY by an esbuild onLoad plugin at bundle time; nothing under
// rct2-design-system/mp3d is ever written.
//
// This file is deliberately SEPARATE from lib.mjs: the wave-7 rebuild of
// lib.mjs is a plain screenshot harness with no injections, and a probe run on
// an uninstrumented bundle reports "no __evalPark store" (the ParkStore is
// never exposed) — so probe.mjs imports the bundler from HERE.
//
// Each injection is anchored on an exact source string; if the design system
// moves and an anchor goes missing we warn and continue, and the page-side
// probes degrade gracefully (documented in RUBRIC.md).

import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

export const W = 1280;
export const H = 800;
const CHROME_DIR = path.join(process.env.HOME ?? '', '.cache/puppeteer/chrome');

/** newest installed Chrome-for-Testing binary (puppeteer-core needs a path) */
export function chromePath() {
  const builds = fs.existsSync(CHROME_DIR) ? fs.readdirSync(CHROME_DIR).sort() : [];
  for (const b of builds.reverse()) {
    const p = path.join(CHROME_DIR, b, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// import preprocessor
// ---------------------------------------------------------------------------

/** Rewrite design-system import specifiers to absolute paths into
 *  REPO/components: anything containing `components/<Name>`, plus bare-relative
 *  `./<Name>` / `../<Name>` whose basename is a component folder. Everything
 *  else (react, three, files next to the park) is left alone.
 *
 *  FIXED 2026-07-24: the original regex only matched `components/<Name>`
 *  when the specifier ENDED there (optionally + `/index`), so a deep import
 *  like `./components/Park/Park.previews` (a previews-derived reference
 *  park mounting a DS previews file directly, e.g. samples/demo-ref.tsx)
 *  fell through to the parkDir-relative branch and resolved to a path INSIDE
 *  samples/, not the design system. Now captures and preserves everything
 *  after `components/<Name>/`. */
export function preprocessParkSource(src, parkDir) {
  const compDir = path.join(REPO, 'components');
  const isComponent = (n) => /^[A-Za-z0-9_]+$/.test(n) && fs.existsSync(path.join(compDir, n));
  return src.replace(/(\bfrom\s*|\bimport\s+)(['"])([^'"\n]+)\2/g, (whole, lead, q, spec) => {
    const m = spec.match(/(?:^|\/)components\/([A-Za-z0-9_]+)(\/[^'"\n]*)?$/);
    if (m && isComponent(m[1])) {
      const rest = (m[2] || '').replace(/^\/index(\.tsx?)?$/, '');
      return `${lead}${q}${path.join(compDir, m[1] + rest)}${q}`;
    }
    if (spec.startsWith('.')) {
      const base = spec.replace(/\/(index(\.tsx?)?)?$/, '').split('/').pop();
      if (base && isComponent(base)) return `${lead}${q}${path.join(compDir, base)}${q}`;
      if (parkDir) return `${lead}${q}${path.resolve(parkDir, spec)}${q}`;
    }
    return whole; // bare packages: react, three, ...
  });
}

/** apply preprocessParkSource to every source file inside the park's own dir */
function parkLocalPreprocessPlugin(parkDir) {
  let real = path.resolve(parkDir);
  try { real = fs.realpathSync(real); } catch { /* keep resolved */ }
  const prefix = real + path.sep;
  const loaders = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js' };
  return {
    name: 'park-local-preprocess',
    setup(b) {
      b.onLoad({ filter: /\.(m?js|jsx|ts|tsx)$/ }, (args) => {
        let p = path.resolve(args.path);
        try { p = fs.realpathSync(p); } catch { /* keep resolved */ }
        if (!p.startsWith(prefix)) return null;
        const src = preprocessParkSource(fs.readFileSync(p, 'utf8'), path.dirname(p));
        return { contents: src, loader: loaders[path.extname(p)] || 'tsx', resolveDir: path.dirname(p) };
      });
    },
  };
}

// ---------------------------------------------------------------------------
// the injections
// ---------------------------------------------------------------------------

const INJECTIONS = {
  [path.join(REPO, 'components/Park/parkRoot.tsx')]: [
    { // expose the ParkStore (ground sampler, paths net, manager, size)
      find: 'setCtx(store);',
      rep: 'setCtx(store);\n          try { (window as any).__evalPark = store; } catch {}',
    },
    // PUBLISH THE VERDICT + THE SETTLE FLAG (2026-07-26).
    //
    // `probe.validation` reads `window.__parkReport`, and until now the ONLY
    // thing that ever set it was a park author wiring `<Park onReady>` to do so
    // by hand — which in the whole samples/ tree is `DemoPark` and nothing else.
    // Every other park (both skeletons included) logs its own
    // `[Skeleton A] validatePark …` line and leaves `window.__parkReport`
    // undefined, so `probe.validation` came back `null` EVEN ON A PARK WHOSE
    // GATE RAN AND PASSED — a missing measurement that read as no-verdict.
    // The report is a plain object <Park> already hands to `onReady`; taking a
    // reference to it here is read-only and changes no behaviour.
    //
    // `__parkSettled` is the separate, load-bearing bit: it distinguishes
    //   "the settle effect never ran"  (never set)
    // from
    //   "it ran and validatePark produced no report" (set, __parkReport null —
    //   no GameManager, or <Terrain>/<Paths> missing, i.e. a FAILED park)
    // which `validation: null` alone could never tell apart.
    {
      find: 'onReadyRef.current?.(report, { manager: mgr ?? null, api: ctx.api });',
      rep:
        'try { const __w: any = window; __w.__parkReport = report; __w.__parkSettled = true; __w.__parkSettleMs = Math.round(performance.now()); } catch {}\n'
        + '      onReadyRef.current?.(report, { manager: mgr ?? null, api: ctx.api });',
    },
  ],
  [path.join(REPO, 'components/Park/composable.tsx')]: [
    { // tag every composable() catalog component with its displayName
      find: 'const built = toBuilt(build(t, props, park)) as B;',
      rep: 'const built = toBuilt(build(t, props, park)) as B;\n        try { built.group.userData.evalComposable = displayName; } catch {}',
    },
  ],
  [path.join(REPO, 'components/Park/configurableRide.tsx')]: [
    { // ConfigurableStall: the shipped name, its catalog DEFAULT name and item
      // (FOOD STALLS axis: a stall still called "Burger Bar" is not themed)
      //
      // FIXED 2026-07-24 (wave-9 P3): this tag read `name ?? stall.name` and so
      // MISSED the object form `register={{ name: 'Lakeside Soda' }}`, which
      // ConfigurableStall itself honours (`name ?? register.name ?? stall.name`,
      // configurableRide.tsx). The harness therefore reported a correctly-themed
      // stall as `defaultNamed: ["Soda Stand"]` — the DESIGN SYSTEM was right and
      // the PROBE was lying. Mirror the component's own precedence exactly.
      find: 'const built = toBuilt(build(t, park));',
      rep: 'const built = toBuilt(build(t, park));\n      try { const __ro: any = register && register !== true ? register : {}; (built as any).group.userData.evalStall = name ?? __ro.name ?? stall.name; (built as any).group.userData.evalStallDefaultName = stall.name; (built as any).group.userData.evalStallItem = __ro.item ?? stall.item; } catch {}',
    },
    { // ConfigurableRide: the chassis layout's defaults.name identifies the
      // catalog kind even for the hand-rolled ride components that skip the
      // composableRide factory (FerrisWheel, Teacups, …) — probe.mjs maps it
      // back through catalog.mjs's defaultName table
      find: 'const built = toBuilt(build(t, park)) as ComposableRideBuilt;',
      rep: 'const built = toBuilt(build(t, park)) as ComposableRideBuilt;\n      try { built.group.userData.evalRide = true; built.group.userData.evalRideDefaultName = ((layout as any) && (layout as any).defaults && (layout as any).defaults.name) || null; } catch {}',
    },
    // The two factory anchors now hook the DESIGN SYSTEM'S OWN component tag
    // (`Park/composable.tsx: tagComponent`, added with the world layer) instead
    // of the bare `build={(t, park) => build(t, props, park)}` arrow those
    // factories used to pass. `dsComponent`/`dsClass` are the real tags and the
    // world audit uses them; `evalRideKind`/`evalStallKind` are kept as ALIASES
    // so probe.mjs's roster axes keep reading the field name they always have.
    { // composableRide() factory -> the ride component KIND
      find: "          tagComponent(toBuilt(res), displayName, 'ride');",
      rep: "          tagComponent(toBuilt(res), displayName, 'ride');\n          try { const __g: any = (res as any).isObject3D ? res : (res as any).group; if (__g && __g.userData) __g.userData.evalRideKind = displayName; } catch {}",
    },
    { // composableStall() factory -> the stall component KIND
      find: "          tagComponent(toBuilt(res), displayName, 'stall');",
      rep: "          tagComponent(toBuilt(res), displayName, 'stall');\n          try { const __g: any = (res as any).isObject3D ? res : (res as any).group; if (__g && __g.userData) __g.userData.evalStallKind = displayName; } catch {}",
    },
  ],
  // <Terrain>/<Paths> WERE IN wrappers.tsx UNTIL THE 2026-07-26 SPLIT. The file
  // outgrew one design-system write call, so the two SYNCHRONOUS land wrappers
  // moved to `wrappersLand.tsx` and the queued ones stayed behind. The terrain
  // anchor therefore has to be keyed on the NEW path — and `evalTagPlugin`'s
  // onLoad `filter` has to admit it, or the injection never runs and the whole
  // terrain/water axis degrades silently (exactly the failure mode the
  // <FlatRide> regex note below describes).
  [path.join(REPO, 'components/Park/wrappersLand.tsx')]: [
    { // <Terrain> mesh + its park-wide water sheet
      find: 'g.add(terrain.mesh, water.mesh);',
      rep: "terrain.mesh.userData.evalKind = 'terrain';\n    water.mesh.userData.evalKind = 'water';\n    water.mesh.userData.evalWater = Object.assign({}, water.mesh.userData.evalWater, { sheet: 'terrain', size: S * 0.995 });\n    g.add(terrain.mesh, water.mesh);",
    },
  ],
  [path.join(REPO, 'components/Park/wrappers.tsx')]: [
    { // the park <Gate>
      find: 'park.manager().registerParkEntrance(gate);',
      rep: "gate.group.userData.evalKind = 'gate';\n    park.manager().registerParkEntrance(gate);",
    },
    { // <Restroom> (cleanliness axis)
      find: 'const r = buildRestroom(t);',
      rep: "const r = buildRestroom(t);\n    r.group.userData.evalKind = 'restroom';",
    },
    { // <FlatRide> — ride KIND for the roster axis
      // INDENTATION-AGNOSTIC. This used to pin the exact 4-space indent of the
      // <FlatRide> body; time-slicing the wrapper mounts reindented it by two
      // and the anchor silently stopped matching, which degrades the ride-kind
      // axis rather than failing loudly. Match the statement, not its column.
      find: /built\.group\.userData\.rideRef = handle;(\s*)const cleanup0 = park\.addObject\(g, built\.update\);/,
      rep: (m, ws) =>
        `built.group.userData.evalRideKind = built.group.userData.evalRideKind || 'FlatRide';${ws}built.group.userData.rideRef = handle;${ws}const cleanup0 = park.addObject(g, built.update);`,
    },
  ],
  [path.join(REPO, 'components/Park/pieces.tsx')]: [
    { // <Coaster> — ride KIND for the roster axis
      find: 'coaster.group.userData.rideRef = handle; // clickability (rules/ui.md)',
      rep: "coaster.group.userData.evalRideKind = 'Coaster';\n    coaster.group.userData.rideRef = handle; // clickability (rules/ui.md)",
    },
  ],
  [path.join(REPO, 'components/SetPieceKit/index.tsx')]: [
    { // every setPiece() macro piece by plan KIND (LAYOUT UNIQUENESS axis)
      find: '          : (res as ComposableBuilt);',
      rep: '          : (res as ComposableBuilt);\n        try { (built as any).group.userData.evalSetPiece = (plan as any).kind || displayName; (built as any).group.userData.evalSetPieceId = (plan as any).id; } catch {}',
    },
  ],
  // `rateCoaster` LIVES IN `ratings.ts`, NOT in `index.tsx` — index only re-exports
  // it (`export { replayCoasterForces, rateCoaster } from './ratings'`). The anchor
  // used to point at index.tsx; when the function moved, `auditAnchors()` reported
  // the miss but the probe only degraded, so EVERY park silently measured
  // `thrill.ratedCount 0` / `flagshipExcitement null` / `archetypes []` and read as
  // failing §4.0-E's "each rateCoaster-measured" clause on coasters that were fine.
  [path.join(REPO, 'components/SplineRideKit/ratings.ts')]: [
    { // expose rateCoaster (THRILL axis) — pure function, no side effects
      find: 'export function rateCoaster(',
      rep: 'export function rateCoaster(',
      append: '\ntry { (globalThis as any).__evalRateCoaster = rateCoaster; } catch {}\n',
    },
  ],
  // MOVED 2026-07-27: `tree` was refactored OUT of Kit/index.tsx into
  // Kit/plants.ts (index.tsx now only re-exports it: `export { tree, hedge,
  // flowerBed, rock } from './plants';`). The anchor still read
  // `components/Kit/index.tsx`, so it went MISS and `probe.mjs` refused to run
  // at all — every park measurement was blocked, not silently degraded, which
  // is the anchor guard doing its job. Repointed at the builder's real home.
  [path.join(REPO, 'components/Kit/plants.ts')]: [
    {
      find: 'export function tree(',
      rep: 'function __evalTreeBuild(',
      append:
        "\nexport function tree(t: any, opts: any = {}) {\n  const g = __evalTreeBuild(t, opts);\n  g.userData.evalKind = 'tree';\n  g.userData.evalTreeShape = (opts && opts.shape) || 'round';\n  return g;\n}\n",
    },
  ],
  [path.join(REPO, 'components/SceneryPack/index.tsx')]: [
    {
      find: 'export function buildSceneryAnimated(',
      rep: 'function __evalBuildSceneryAnimated(',
      append:
        "\nexport function buildSceneryAnimated(t: any, name: any, opts: any = {}) {\n  const r = __evalBuildSceneryAnimated(t, name, opts);\n  r.group.userData.evalKind = 'scenery';\n  r.group.userData.evalScenery = name;\n  return r;\n}\n",
    },
  ],
  [path.join(REPO, 'components/WaterTile/index.tsx')]: [
    { // buildWater sheets/pools
      find: "  const depth = typeof skirt === 'number' ? skirt : skirt === false ? 0 : radius < 1000 ? 0.16 : 0;",
      rep: "  const depth = typeof skirt === 'number' ? skirt : skirt === false ? 0 : radius < 1000 ? 0.16 : 0;\n  mesh.userData.evalKind = 'water';\n  mesh.userData.evalWater = { size, radius: radius < 1000 ? radius : null };",
    },
    { // buildWaterRibbon channels
      find: '  mesh.renderOrder = 1;\n  return {\n    mesh,',
      rep: "  mesh.userData.evalKind = 'water';\n  mesh.userData.evalWater = { ribbon: true, length: total, width };\n  mesh.renderOrder = 1;\n  return {\n    mesh,",
    },
  ],
};

/** which anchors are currently resolvable — a cheap self-check that does not
 *  need a browser. Run it directly:
 *
 *      node evaltags.mjs --audit-anchors        # exit 0 = all resolvable, 1 = drift
 *
 *  A broken anchor does NOT stop a run: the injection is skipped and the axis it
 *  feeds silently degrades (that is how `rateCoaster` moving to ratings.ts made
 *  every park read `thrill.ratedCount 0`). So this is the check to run after any
 *  design-system change, and probe.mjs points at it when the verdict anchor
 *  specifically has drifted. */
/**
 * The `onLoad` filter, hoisted to module scope so `auditAnchors` can check
 * against the SAME regex the plugin uses. Keeping a second copy in the audit
 * would defeat the point.
 */
export const ONLOAD_FILTER =
  /components\/(Park\/(index|parkRoot|composable|configurableRide|wrappersLand|wrappers|pieces)|(Kit|SceneryPack|WaterTile|SplineRideKit|SetPieceKit)\/index)\.tsx$|components\/SplineRideKit\/ratings\.ts$|components\/Kit\/plants\.ts$/;

export function auditAnchors() {
  const rows = [];
  for (const [file, inj] of Object.entries(INJECTIONS)) {
    const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    // TWO independent ways an injection can be dead, and the second one used to
    // be invisible:
    //   1. the ANCHOR no longer appears in the file (a refactor renamed it);
    //   2. the file is not admitted by the onLoad FILTER, so esbuild never hands
    //      it to the injector and the anchor is never even looked for.
    //
    // MEASURED 2026-07-27: `tree` moved to `Kit/plants.ts`, the anchor was
    // repointed there, and this audit reported `anchors: 18  broken: 0` — while
    // the filter still admitted only `Kit/index.tsx`, so nothing was injected.
    // `trees.count` read 0 on a park planting 379 trees and axis 10 went 4/4 ->
    // 1/4: a silent −3 on every park, behind a green audit. A guard that can be
    // green while the thing it guards is dead is not a guard.
    const loaded = ONLOAD_FILTER.test(file);
    for (const { find } of inj) {
      const label = (typeof find === 'string' ? find : String(find)).slice(0, 46).replace(/\n/g, '\\n');
      const found = !!src && (typeof find === 'string' ? src.includes(find) : find.test(src));
      rows.push({
        file: file.replace(REPO + '/', ''),
        anchor: label,
        ok: found && loaded,
        why: !found ? 'anchor not in file' : !loaded ? 'file NOT admitted by the onLoad filter — the injection never runs' : '',
      });
    }
  }
  return rows;
}

function evalTagPlugin() {
  return {
    name: 'eval-tags',
    setup(b) {
      b.onLoad(
        // `wrappersLand` MUST come before `wrappers` in spirit and be listed at
        // all: `wrappers` alone cannot match `wrappersLand.tsx` (the group is
        // followed by `\.tsx$`), so omitting it drops the <Terrain> injection.
        // `Kit/plants.ts` is listed for the reason the comment at INJECTIONS
        // warns about: `tree` moved out of `Kit/index.tsx` into `Kit/plants.ts`
        // (2026-07-27 refactor, index.tsx now only re-exports it). Repointing
        // the ANCHOR was not enough — this filter still admitted only
        // `Kit/index.tsx`, so the injection never ran, `tree` was never tagged,
        // and axis 10 read `trees.count 0` on a park that plants 379 of them:
        // 4/4 -> 1/4, a silent −3 on EVERY park measured. The anchor audit
        // passed throughout, because the anchor existed — it was never loaded.
        { filter: ONLOAD_FILTER },
        (args) => {
          const inj = INJECTIONS[args.path];
          if (!inj) return null;
          let src = fs.readFileSync(args.path, 'utf8');
          for (const { find, rep, append } of inj) {
            // AN ANCHOR MAY BE A LITERAL *OR* A RegExp, exactly as auditAnchors
            // above already handles. This loop did not: `src.includes(regex)`
            // throws "First argument to String.prototype.includes must not be a
            // regular expression", which esbuild surfaces only as a bare
            // `esbuild failed:` line — so EVERY park stopped bundling, with an
            // error naming neither the plugin nor the anchor. `find.slice()` in
            // the warning below had the same defect. If you add an anchor, match
            // both kinds here or you take the whole probe down.
            const present = typeof find === 'string' ? src.includes(find) : find.test(src);
            if (!present) {
              const label = (typeof find === 'string' ? find : String(find)).slice(0, 60);
              console.warn(`[eval-tags] anchor missing in ${args.path}: ${JSON.stringify(label)} — probe will degrade`);
              continue;
            }
            src = src.replace(find, rep);
            if (append) src += append;
          }
          return {
            contents: src,
            loader: args.path.endsWith('.ts') ? 'ts' : 'tsx',
            resolveDir: path.dirname(args.path),
          };
        },
      );
    },
  };
}

// ---------------------------------------------------------------------------
// bundle + page
// ---------------------------------------------------------------------------

/** Preprocess, bundle WITH the eval tags, write a self-contained page. */
export async function bundleParkPage(parkFile, name) {
  const abs = path.resolve(parkFile);
  if (!fs.existsSync(abs)) throw new Error(`no such park file: ${abs}`);
  const outDir = path.join(HERE, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const pre = preprocessParkSource(fs.readFileSync(abs, 'utf8'), path.dirname(abs));
  const preprocessed = path.join(outDir, `_${name}.park.tsx`);
  fs.writeFileSync(preprocessed, pre);

  const entryPath = path.join(outDir, `_${name}.entry.tsx`);
  fs.writeFileSync(
    entryPath,
    `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import * as M from ${JSON.stringify(preprocessed)};
(window as any).__THREE = THREE;
const named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));
const C =
  (typeof (M as any).default === 'function' ? (M as any).default : null) ||
  ((named.find(([k]) => /park/i.test(k)) || named[0] || [])[1] as any);
if (!C) console.error('[park-eval] no component export found in park file');
else {
  console.log('[park-eval] mounting component:', C.displayName || C.name || 'default');
  createRoot(document.getElementById('root')!).render(React.createElement(C));
}
`,
  );

  const { build } = await import('esbuild'); // lazy: auditAnchors() needs no deps
  const bundle = await build({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    define: { 'process.env.NODE_ENV': '"production"' },
    nodePaths: [path.join(HERE, 'node_modules'), path.resolve(HERE, '..', 'mp3d-render', 'node_modules')],
    plugins: [parkLocalPreprocessPlugin(path.dirname(abs)), evalTagPlugin()],
    target: 'chrome120',
    logLevel: 'silent',
  }).catch((e) => {
    console.error('esbuild failed:');
    for (const err of e.errors ?? []) console.error(`  ${err.location?.file}:${err.location?.line} ${err.text}`);
    process.exit(1);
  });

  const jsPath = path.join(outDir, `_${name}.bundle.js`);
  fs.writeFileSync(jsPath, bundle.outputFiles[0].text);
  const htmlPath = path.join(outDir, `${name}.html`);
  fs.writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#0b0d10;overflow:hidden;}
#root{width:100vw;height:100vh;}
</style></head><body><div id="root"></div><script src="${path.basename(jsPath)}"></script></body></html>`,
  );
  return htmlPath;
}

/** requestAnimationFrame BACKSTOP (wave-9). Headless chromium's frame scheduler
 *  can stall completely — measured on this machine: `rafTicks: 0` over 2 s with a
 *  live, un-lost WebGL2 context, a visible document and a 1280x800 canvas. When
 *  that happens NOTHING in the design system runs: the Stage's render loop is
 *  rAF-driven and so is `<Park>`'s settle effect, so the park mounts, prints its
 *  build lints, and then simply never validates — the harness reports it as
 *  "no validatePark output within settle window" and the park looks broken when
 *  the BROWSER is. This init script keeps the native rAF (so vsync pacing is used
 *  whenever it works) and adds a ~24 ms setTimeout backstop per callback,
 *  whichever fires first, honouring cancelAnimationFrame. */
export const FRAME_SHIM = `(() => {
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const cancelled = new Set();
  let next = 1;
  window.requestAnimationFrame = (cb) => {
    const id = next++;
    let done = false;
    const run = () => {
      if (done || cancelled.has(id)) return;
      done = true;
      cancelled.delete(id);
      cb(performance.now());
    };
    nativeRaf(run);
    setTimeout(run, 24);
    return id;
  };
  window.cancelAnimationFrame = (id) => { cancelled.add(id); nativeCancel(id); };
})()`;

/** install FRAME_SHIM on a puppeteer OR playwright page (before any navigation) */
export async function installFrameShim(page) {
  try {
    if (typeof page.evaluateOnNewDocument === 'function') await page.evaluateOnNewDocument(FRAME_SHIM);
    else if (typeof page.addInitScript === 'function') await page.addInitScript({ content: FRAME_SHIM });
  } catch { /* a page that refuses the shim still runs on native vsync */ }
}

/** Launch headless Chrome on the page, capture EVERY console line (+ page
 *  errors), wait for settle AND for the validatePark verdict. Uses
 *  puppeteer-core against the installed Chrome-for-Testing; falls back to
 *  playwright's chromium when puppeteer-core is not installed.
 *
 *  Returns `{ browser, page, lines, settle }`. `settle` is the STRUCTURED
 *  outcome of the wait (see `settleParkPage`) — callers must check
 *  `settle.validated` and refuse to emit a park report when it is false. */
/*  `navMs` / `settleMs`: a size-192 park (the WAVE-8 <Park size> default; the
 *  default has been 128 since 2026-07) mounts a 427² terrain mesh under
 *  swiftshader and blew the 30 s puppeteer navigation default outright, so both
 *  budgets are generous and overridable (PARK_NAV_MS / PARK_SETTLE_MS). A 128
 *  park mounts a 284² mesh and settles in ~1-3 min under contention. Small
 *  parks are unaffected — the settle loop still returns the moment validatePark
 *  has spoken. */
export async function openParkPage(
  htmlPath,
  {
    waitMs = 6000,
    echo = false,
    navMs = Number(process.env.PARK_NAV_MS ?? 240000),
    settleMs = Number(process.env.PARK_SETTLE_MS ?? 180000),
  } = {},
) {
  const lines = [];
  let browser, page;
  try {
    // PARK_BROWSER=playwright forces the playwright path below. Chrome for
    // Testing under puppeteer-core is the higher-fidelity renderer and stays
    // the default, but it is also much the hungrier of the two on RAM — on a
    // machine already running a park bundle plus SwiftShader it is the thing
    // that pushes the box into swap. This is the escape hatch for that.
    if ((process.env.PARK_BROWSER ?? '').toLowerCase() === 'playwright') throw new Error('PARK_BROWSER=playwright');
    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = chromePath();
    if (!executablePath) throw new Error('no Chrome for Testing found under ~/.cache/puppeteer');
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`],
      defaultViewport: { width: W, height: H },
      // `protocolTimeout` is a LAUNCH option, and every CDP round trip inherits
      // it — including the ONE `page.evaluate` that runs `store.flushBuilds()`
      // (a whole park's remaining geometry in a single task) and eval.mjs's
      // screenshots on a <1 fps SwiftShader scene. The 180 s default is not
      // enough for either, and a ProtocolError here reads exactly like a broken
      // park. eval.mjs used to work around this with its own CDP session
      // because it could not reach this option; now it does not have to.
      protocolTimeout: Number(process.env.PARK_PROTOCOL_MS ?? 1800000),
    });
    page = await browser.newPage();
  } catch (e) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
    page = await browser.newPage({ viewport: { width: W, height: H } });
    void e;
  }
  page.on('console', (m) => {
    const line = `[${m.type()}] ${m.text()}`;
    lines.push(line);
    if (echo) console.log(`  ${line}`);
  });
  page.on('pageerror', (e) => {
    lines.push(`[pageerror] ${e.message}`);
    if (echo) console.log(`  [pageerror] ${e.message}`);
  });
  await installFrameShim(page);
  page.setDefaultNavigationTimeout?.(navMs);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: navMs });
  await sleep(waitMs);
  const settle = await settleParkPage(page, lines, { settleMs, echo });
  return { browser, page, lines, settle };
}

/** has the gate spoken on this page? `<Park>` ALWAYS logs `[Park] validatePark
 *  → …`, including the no-GameManager failure branch, so this one line is the
 *  whole test. */
export const validatorSpoke = (lines) => lines.some((l) => /validatePark|no GameManager created/.test(l));

/** THE SETTLE GATE — why this is not a fixed sleep any more (2026-07-26).
 *
 *  MEASURED, samples/skeleton-b.tsx, size 128, SwiftShader:
 *
 *      t=10.1s  buildQ 94   frameMs  369   entries 16
 *      t=17.5s  buildQ 91   frameMs  693   entries 22
 *      t=25.1s  buildQ 89   frameMs 1042   entries 25
 *      t=34.5s  buildQ 86   frameMs 1457   entries 28
 *      t=60.8s  buildQ 84   frameMs 2506   lights 52
 *      t=98.5s  buildQ 74   frameMs 3740   lights 70
 *
 *  `<Park>`'s settle effect runs through `ctx.whenBuilt(...)`, which fires only
 *  when the store's time-sliced build queue DRAINS (parkContext.ts:641). The
 *  queue advances about ONE build per rendered frame, and every build adds
 *  draw calls and lights, so the frame gets steadily more expensive: the drain
 *  rate DECAYS as the queue shortens. 94 builds at a frame interval heading
 *  past 3.7 s never finished inside the fixed 180 s window — so `whenBuilt`
 *  never fired, `_worldAudit` was never written, `validatePark` never ran, and
 *  the probe reported `validation: null` with exit code 0.
 *
 *  Note what this is NOT: rAF fires fine (FRAME_SHIM backstops it, and the
 *  scene renders throughout), the queue order is not inverted, and no clock is
 *  rewound. It is the classic FIXED-TIMEOUT DEFECT — a deadline in wall-clock
 *  milliseconds bounding a process that advances per FRAME, on a machine where
 *  a frame is seconds. The same defect the night-shot poll had before its
 *  budget was derived from the measured frame interval.
 *
 *  THE FIX, entirely harness-side: stop waiting for a frame-paced drain and
 *  finish the assembly in one task with the store's OWN documented probe API —
 *  `flushBuilds()`, "run every queued build NOW, synchronously — for probes,
 *  tests, and any caller that needs a complete park in the same task"
 *  (parkContext.ts:333). It is strictly FIFO, the same order the sliced drain
 *  would have used, so the resulting scene is identical; only the timing
 *  changes. MEASURED: the 93 builds that were going to take 200 s+ flush in
 *  1270 ms, and `[Park] validatePark → ok: true` follows immediately.
 *
 *  It is only safe to flush once `_buildDone.length > 0`, i.e. once <Park>'s
 *  own settle effect has registered its `whenBuilt` callback. React runs child
 *  effects BEFORE the parent's, so by then every child of that commit has
 *  already enqueued its build and flushing cannot validate a half-mounted park.
 *
 *  A page with no `__evalPark` store (a non-<Park> component) has nothing to
 *  flush, so there it falls back to a PROGRESS-based wait: keep going while the
 *  queue is still shrinking, give up only when progress stalls.
 */
export async function settleParkPage(page, lines, { settleMs = 180000, echo = false } = {}) {
  const t0 = Date.now();
  const out = {
    validated: false,
    reason: null,
    ms: 0,
    settleMs,
    flushed: false,
    buildsFlushed: null,
    flushMs: null,
    buildsLeft: null,
    parkSettled: false,
    store: false,
    polls: 0,
    stalledMs: 0,
    trace: [],
  };
  const peek = () =>
    page
      .evaluate(() => {
        const s = window.__evalPark || null;
        return {
          store: !!s,
          buildQ: s ? s._buildQ.length : null,
          buildDone: s ? s._buildDone.length : null,
          settled: !!window.__parkSettled,
        };
      })
      .catch(() => null);

  let lastQ = null;
  // THE DEADLINE IS WALL-CLOCK, NOT A POLL COUNT.
  //
  // The first version of this loop was `for (i = 0; i < ceil(settleMs / 500); i++)`
  // with a `sleep(500)` at the bottom — the same shape the original fixed-sleep
  // loop had. That is only a `settleMs` budget if an iteration really costs
  // ~500 ms, and this loop does a `page.evaluate` per iteration. MEASURED on
  // skeleton-b with PARK_SETTLE_MS=20000: the loop spent 225203 ms over 16 polls,
  // an 11x overrun, because one CDP round trip to a page rendering at ~0.3 fps
  // costs ~14 s, not 0.5 s. A poll-count deadline is the SAME fixed-timeout
  // defect this function exists to fix, so the budget is compared against the
  // clock it actually bounds. `stalledMs` is time-based for the same reason.
  const deadline = t0 + settleMs;
  const STALL_MS = 12000;
  let stalledSince = null;
  while (Date.now() < deadline) {
    out.polls += 1;
    if (validatorSpoke(lines)) break;
    const s = await peek();
    if (s) {
      out.store = s.store;
      out.parkSettled = s.settled;
      out.buildsLeft = s.buildQ;
      // ---- the flush: assembly is complete enough to finish in one task ----
      // `PARK_NO_FLUSH=1` disables it, which reproduces the pre-fix behaviour on
      // demand — that is how you check that the SETTLE FAILURE path still fires.
      if (!out.flushed && s.store && s.buildDone > 0 && s.buildQ > 0 && process.env.PARK_NO_FLUSH !== '1') {
        const note = `[harness] settle: flushing ${s.buildQ} queued build(s) via store.flushBuilds() — the sliced drain advances ~1 build per rendered frame and this park would not finish inside ${settleMs} ms`;
        lines.push(note);
        if (echo) console.log(`  ${note}`);
        const r = await page
          .evaluate(() => {
            const st = window.__evalPark;
            const n = st._buildQ.length;
            const t = performance.now();
            st.flushBuilds();
            return { queued: n, ms: Math.round(performance.now() - t), left: st._buildQ.length };
          })
          .catch((e) => ({ error: String((e && e.message) || e).slice(0, 240) }));
        out.flushed = true;
        if (r && r.error) {
          out.flushError = r.error;
          lines.push(`[harness] settle: flushBuilds() FAILED — ${r.error}`);
        } else {
          out.buildsFlushed = r.queued;
          out.flushMs = r.ms;
          out.buildsLeft = r.left;
          lines.push(`[harness] settle: flushBuilds() drained ${r.queued} build(s) in ${r.ms} ms (${r.left} left)`);
        }
        continue; // re-check for the verdict on the next tick
      }
      // ---- progress watchdog (no store to flush, or the flush did not help) --
      if (lastQ !== null && s.buildQ !== null && s.buildQ >= lastQ) stalledSince ??= Date.now();
      else stalledSince = null;
      out.stalledMs = stalledSince ? Date.now() - stalledSince : 0;
      lastQ = s.buildQ;
      if (out.trace.length < 24) out.trace.push({ t: Date.now() - t0, buildQ: s.buildQ, settled: s.settled });
      if (out.flushed && out.stalledMs >= STALL_MS) {
        out.reason =
          s.buildQ === 0
            ? `the build queue drained (flushBuilds() ${out.flushError ? `THREW: ${out.flushError}` : 'completed'}) but no validatePark line followed in ${Math.round(out.stalledMs / 1000)} s — the settle callback itself did not finish; check consoleSummary.errors for a page error thrown inside validatePark`
            : `build queue stalled at ${s.buildQ} for ${Math.round(out.stalledMs / 1000)} s after flushBuilds() — the park is not assembling and nothing further will change`;
        break;
      }
    }
    await sleep(500);
  }
  out.ms = Date.now() - t0;
  out.validated = validatorSpoke(lines);
  // re-read the page AFTER the loop, or `parkSettled`/`buildsLeft` report the
  // state as it was one poll BEFORE the flush finished — a diagnostic that lies
  // about the thing it is diagnosing is the same defect in miniature
  {
    const s = await peek();
    if (s) {
      out.parkSettled = s.settled;
      out.buildsLeft = s.buildQ;
    }
  }
  if (!out.validated && !out.reason)
    out.reason =
      `no "[Park] validatePark → …" line within the ${settleMs} ms SETTLE TIMEOUT (PARK_SETTLE_MS)` +
      (out.buildsLeft ? ` — ${out.buildsLeft} build(s) still queued` : out.parkSettled ? ' — the settle effect DID run, so the gate itself produced nothing' : '');
  if (!out.validated) {
    // kept for the console.log artefact; the CALLER is what must exit non-zero
    lines.push(`[harness] SETTLE FAILURE: ${out.reason}`);
  }
  return out;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const opt = (k) => {
    const hit = args.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : undefined;
  };
  return { file, opt };
}

export function defaultName(file) {
  return path.basename(file).replace(/\.[jt]sx?$/, '');
}

// ---------------------------------------------------------------------------
// CLI: node evaltags.mjs --audit-anchors
// ---------------------------------------------------------------------------
// A permanent entrypoint for the anchor self-check. It used to be reachable only
// as `node -e "import('./evaltags.mjs').then(m => m.auditAnchors())"`, which is
// awkward enough that nobody ran it — and a silently-missing anchor degrades an
// axis to a plausible-looking zero rather than failing.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  if (process.argv.includes('--audit-anchors')) {
    const rows = auditAnchors();
    const bad = rows.filter((r) => !r.ok);
    for (const r of rows) console.log(`${r.ok ? "ok  " : "MISS"}  ${r.file}  ${r.anchor}${r.why ? "   <- " + r.why : ""}`);
    console.log(`\nanchors: ${rows.length}  broken: ${bad.length}`);
    if (bad.length) console.error('[eval-tags] ANCHOR DRIFT — the injections above will be skipped and the axes they feed will silently degrade');
    process.exit(bad.length ? 1 : 0);
  }
  console.error('usage: node evaltags.mjs --audit-anchors');
  process.exit(2);
}
