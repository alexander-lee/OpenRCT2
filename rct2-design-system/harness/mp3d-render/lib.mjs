// ---------------------------------------------------------------------------
// park-eval/lib.mjs — REBUILT 2026-07 (wave 7). The original harness lived
// only in /tmp and was wiped when the machine rebooted mid-wave; this is a
// functional replacement of the two pieces the wave-7 verification needs:
//
//   bundleParkPage(parkFile, name) -> an .html that mounts the park component
//   openParkPage(html, { waitMs }) -> { browser, page, lines } with EVERY
//                                     console line captured (the validatePark
//                                     report + all [Park] lints live there)
//
// Park files import from './components/<Name>' — an esbuild resolve plugin
// maps that prefix onto the LOCAL design system (mp3d/components), so a park
// TSX runs against the working tree with no copying.
//
// MOVED IN-REPO 2026-07-24: this harness now lives at
// rct2-design-system/harness/mp3d-render, versioned alongside the design
// system it evaluates. HERE (this file's copy points at the sibling
// park-eval/out for its bundle output, same as before the move) / MP3D /
// HARNESS below are all derived from this file's own location so nothing
// breaks when the repo is moved or cloned elsewhere.
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const HERE = path.resolve(THIS_DIR, '..', 'park-eval');
export const MP3D = path.resolve(THIS_DIR, '..', '..', 'mp3d');
const HARNESS = THIS_DIR;
const CHROME_DIR = path.join(process.env.HOME ?? '', '.cache/puppeteer/chrome');

// ---------------------------------------------------------------------------
// ONE COPY OF REACT (and of three) PER BUNDLE — fixed 2026-07.
//
// THE BUG: this bundler writes its generated entry file into `HERE/out`, i.e.
// `harness/park-eval/out`, while its `nodePaths` pointed at
// `harness/mp3d-render/node_modules`. esbuild resolves a bare import by walking
// up from the IMPORTER first and only then consulting `nodePaths`, and BOTH
// harness directories have their own `react` + `react-dom` installs. So:
//
//   the generated entry (in park-eval/out) → park-eval/node_modules/react
//   mp3d/components/*'s own `import React`  → mp3d-render/node_modules/react
//
// Two React instances in one bundle. Every hook in the design system then threw
// "Invalid hook call. Hooks can only be called inside the body of a function
// component", React unmounted the tree, and the page rendered a BLANK CANVAS —
// which is easy to misread as "the component is broken" or, worse during a
// visual change, as "my change had no effect".
//
// THE FIX: alias the shared singletons to ABSOLUTE paths in one tree, so the
// importer's location cannot matter. esbuild applies a package alias to subpaths
// too, so `react-dom/client` and `react/jsx-runtime` follow automatically.
// `three` is here for the same reason — two Three copies break every
// `instanceof` check in the kit and the harness's own `window.__THREE` probe.
const ONE_TREE = path.join(HARNESS, 'node_modules');
const SINGLETONS = ['react', 'react-dom', 'three'];
const singletonAlias = Object.fromEntries(
  SINGLETONS.filter((p) => fs.existsSync(path.join(ONE_TREE, p))).map((p) => [p, path.join(ONE_TREE, p)]),
);

function chromePath() {
  const builds = fs.existsSync(CHROME_DIR) ? fs.readdirSync(CHROME_DIR).sort() : [];
  for (const b of builds.reverse()) {
    const p = path.join(CHROME_DIR, b, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** './components/X' (from anywhere) -> mp3d/components/X */
const componentAlias = {
  name: 'mp3d-components',
  setup(b) {
    b.onResolve({ filter: /(^|\/)components\// }, (args) => {
      if (args.path.startsWith('/')) return null;
      const rel = args.path.slice(args.path.indexOf('components/'));
      const base = path.join(MP3D, rel);
      for (const cand of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')])
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return { path: cand };
      return null;
    });
  },
};

export async function bundleParkPage(parkFile, name) {
  const abs = path.resolve(parkFile);
  if (!fs.existsSync(abs)) throw new Error(`no such park file: ${abs}`);
  const outDir = path.join(HERE, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import * as M from ${JSON.stringify(abs)};
window.__THREE = THREE;
const named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));
const C = (typeof M.default === 'function' ? M.default : null) || ((named.find(([k]) => /park/i.test(k)) || named[0] || [])[1]);
if (!C) console.error('[park-eval] no component export found in park file');
else {
  console.log('[park-eval] mounting component:', C.displayName || C.name || 'default');
  createRoot(document.getElementById('root')).render(React.createElement(C));
}
`;
  const entryPath = path.join(outDir, `_${name}.entry.tsx`);
  fs.writeFileSync(entryPath, entrySrc);
  const res = await build({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    define: { 'process.env.NODE_ENV': '"development"' },
    nodePaths: [ONE_TREE, path.join(HERE, 'node_modules')],
    // react / react-dom / three pinned to ONE tree whatever the importer is —
    // see the SINGLETONS note above (dual React = blank canvas)
    alias: singletonAlias,
    plugins: [componentAlias],
    target: 'chrome120',
    logLevel: 'silent',
  });
  const js = res.outputFiles[0].text;
  const jsPath = path.join(outDir, `_${name}.bundle.js`);
  fs.writeFileSync(jsPath, js);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%}</style></head>
<body><div id="root"></div><script src="${path.basename(jsPath)}"></script></body></html>`;
  const htmlPath = path.join(outDir, `_${name}.html`);
  fs.writeFileSync(htmlPath, html);
  return htmlPath;
}

/**
 * Open a bundled page and capture every console line.
 *
 * TIMEOUTS (2026-07): puppeteer's 30 s NAVIGATION default is far too short for a
 * composed park — the default plot mounts a 284² heightfield under SwiftShader —
 * so `page.goto` threw "Navigation timeout of 30000 ms exceeded" and the caller
 * reported a perfectly good park as broken. `park-eval/lib.mjs` already allowed
 * 240 s via `PARK_NAV_MS`; this bundler now honours the same two environment
 * overrides, with the same defaults, so the two harnesses behave identically:
 *   PARK_NAV_MS      navigation budget (default 240 000)
 *   PARK_SETTLE_MS   how long to wait for the validate verdict (default 180 000,
 *                    or the explicit `waitMs` argument when one is passed)
 */
export async function openParkPage(htmlPath, { waitMs, navMs = Number(process.env.PARK_NAV_MS ?? 240000) } = {}) {
  const settleMs = waitMs ?? Number(process.env.PARK_SETTLE_MS ?? 180000);
  let browser, page;
  try {
    // PARK_BROWSER=playwright forces the playwright path below — the same
    // escape hatch park-eval/evaltags.mjs has. Chrome for Testing under
    // puppeteer-core is the higher-fidelity renderer and stays the default, but
    // it is much the hungrier of the two on RAM, and on a loaded machine it is
    // the thing that pushes the box into swap.
    if ((process.env.PARK_BROWSER ?? '').toLowerCase() === 'playwright') throw new Error('PARK_BROWSER=playwright');
    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = chromePath();
    if (!executablePath) throw new Error('no Chrome for Testing found under ~/.cache/puppeteer');
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800'],
      defaultViewport: { width: 1280, height: 800 },
    });
    page = await browser.newPage();
  } catch {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  }
  const lines = [];
  page.on('console', (m) => lines.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => lines.push(`[requestfailed] ${r.url()}`));
  page.setDefaultNavigationTimeout?.(navMs);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: navMs });
  // wait for the validate verdict (or the timeout)
  const deadline = Date.now() + settleMs;
  while (Date.now() < deadline) {
    if (lines.some((l) => /validatePark →|validatePark skipped|no component export/.test(l))) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 1200)); // let the FAIL/warning lines flush
  return { browser, page, lines };
}
