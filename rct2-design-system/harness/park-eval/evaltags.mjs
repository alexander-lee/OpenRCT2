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
      find: 'const built = toBuilt(build(t, park));',
      rep: 'const built = toBuilt(build(t, park));\n      try { (built as any).group.userData.evalStall = name ?? stall.name; (built as any).group.userData.evalStallDefaultName = stall.name; (built as any).group.userData.evalStallItem = stall.item; } catch {}',
    },
    { // ConfigurableRide: the chassis layout's defaults.name identifies the
      // catalog kind even for the hand-rolled ride components that skip the
      // composableRide factory (FerrisWheel, Teacups, …) — probe.mjs maps it
      // back through catalog.mjs's defaultName table
      find: 'const built = toBuilt(build(t, park)) as ComposableRideBuilt;',
      rep: 'const built = toBuilt(build(t, park)) as ComposableRideBuilt;\n      try { built.group.userData.evalRide = true; built.group.userData.evalRideDefaultName = ((layout as any) && (layout as any).defaults && (layout as any).defaults.name) || null; } catch {}',
    },
    { // composableRide() factory -> the ride component KIND
      find: '      <ConfigurableRide\n        build={(t, park) => build(t, props, park)}\n        layout={layout}',
      rep: '      <ConfigurableRide\n        build={(t, park) => { const __b: any = build(t, props, park); try { const __g = __b && __b.isObject3D ? __b : __b.group; if (__g && __g.userData) __g.userData.evalRideKind = displayName; } catch {} return __b; }}\n        layout={layout}',
    },
    { // composableStall() factory -> the stall component KIND
      find: '      <ConfigurableStall\n        build={(t, park) => build(t, props, park)}\n        stall={stall}',
      rep: '      <ConfigurableStall\n        build={(t, park) => { const __b: any = build(t, props, park); try { const __g = __b && __b.isObject3D ? __b : __b.group; if (__g && __g.userData) __g.userData.evalStallKind = displayName; } catch {} return __b; }}\n        stall={stall}',
    },
  ],
  [path.join(REPO, 'components/Park/wrappers.tsx')]: [
    { // <Terrain> mesh + its park-wide water sheet
      find: 'g.add(terrain.mesh, water.mesh);',
      rep: "terrain.mesh.userData.evalKind = 'terrain';\n    water.mesh.userData.evalKind = 'water';\n    water.mesh.userData.evalWater = Object.assign({}, water.mesh.userData.evalWater, { sheet: 'terrain', size: S * 0.995 });\n    g.add(terrain.mesh, water.mesh);",
    },
    { // the park <Gate>
      find: 'park.manager().registerParkEntrance(gate);',
      rep: "gate.group.userData.evalKind = 'gate';\n    park.manager().registerParkEntrance(gate);",
    },
    { // <Restroom> (cleanliness axis)
      find: 'const r = buildRestroom(t);',
      rep: "const r = buildRestroom(t);\n    r.group.userData.evalKind = 'restroom';",
    },
    { // <FlatRide> — ride KIND for the roster axis
      find: 'built.group.userData.rideRef = handle;\n    const cleanup0 = park.addObject(g, built.update);',
      rep: "built.group.userData.evalRideKind = built.group.userData.evalRideKind || 'FlatRide';\n    built.group.userData.rideRef = handle;\n    const cleanup0 = park.addObject(g, built.update);",
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
  [path.join(REPO, 'components/SplineRideKit/index.tsx')]: [
    { // expose rateCoaster (THRILL axis) — pure function, no side effects
      find: 'export function rateCoaster(',
      rep: 'export function rateCoaster(',
      append: '\ntry { (globalThis as any).__evalRateCoaster = rateCoaster; } catch {}\n',
    },
  ],
  [path.join(REPO, 'components/Kit/index.tsx')]: [
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
 *  need a browser (`node -e "import('./evaltags.mjs').then(m=>m.auditAnchors())"`) */
export function auditAnchors() {
  const rows = [];
  for (const [file, inj] of Object.entries(INJECTIONS)) {
    const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    for (const { find } of inj)
      rows.push({ file: file.replace(REPO + '/', ''), anchor: find.slice(0, 46).replace(/\n/g, '\\n'), ok: !!src && src.includes(find) });
  }
  return rows;
}

function evalTagPlugin() {
  return {
    name: 'eval-tags',
    setup(b) {
      b.onLoad(
        { filter: /components\/(Park\/(index|parkRoot|composable|configurableRide|wrappers|pieces)|(Kit|SceneryPack|WaterTile|SplineRideKit|SetPieceKit)\/index)\.tsx$/ },
        (args) => {
          const inj = INJECTIONS[args.path];
          if (!inj) return null;
          let src = fs.readFileSync(args.path, 'utf8');
          for (const { find, rep, append } of inj) {
            if (!src.includes(find)) {
              console.warn(`[eval-tags] anchor missing in ${args.path}: ${JSON.stringify(find.slice(0, 60))} — probe will degrade`);
              continue;
            }
            src = src.replace(find, rep);
            if (append) src += append;
          }
          return { contents: src, loader: 'tsx', resolveDir: path.dirname(args.path) };
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

/** Launch headless Chrome on the page, capture EVERY console line (+ page
 *  errors), wait for settle AND for the validatePark verdict. Uses
 *  puppeteer-core against the installed Chrome-for-Testing; falls back to
 *  playwright's chromium when puppeteer-core is not installed. */
export async function openParkPage(htmlPath, { waitMs = 6000, echo = false } = {}) {
  const lines = [];
  let browser, page;
  try {
    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = chromePath();
    if (!executablePath) throw new Error('no Chrome for Testing found under ~/.cache/puppeteer');
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`],
      defaultViewport: { width: W, height: H },
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
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await sleep(waitMs);
  const validated = () => lines.some((l) => /validatePark|no GameManager created/.test(l));
  for (let i = 0; i < 50 && !validated(); i++) await sleep(500);
  if (!validated()) lines.push('[harness] WARNING: no validatePark output within settle window');
  return { browser, page, lines };
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
