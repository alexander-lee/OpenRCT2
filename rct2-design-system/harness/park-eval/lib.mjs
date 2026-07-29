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
// rct2-design-system/harness/park-eval, versioned alongside the design
// system it evaluates. HERE/MP3D/NODE_PATHS below are all derived from this
// file's own location so nothing breaks when the repo is moved or cloned
// elsewhere. Chrome-for-Testing lookup is dynamic (newest installed build
// under ~/.cache/puppeteer) instead of a pinned version string that goes
// stale on every puppeteer update, and falls back to playwright's chromium
// if puppeteer-core isn't installed.
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MP3D = path.resolve(HERE, '..', '..', 'mp3d');
// package resolution roots, THIS DIRECTORY FIRST. Getting the order wrong is
// not a cosmetic detail: the entry file is written to `park-eval/out/`, so node
// resolution finds `park-eval/node_modules/react`, while a `react-dom` resolved
// out of `mp3d-render/node_modules` `require`s the react NEXT TO ITSELF. That
// puts TWO copies of React in one bundle, `ReactCurrentDispatcher.current`
// stays null, and every park died on "Cannot read properties of null (reading
// 'useState')" with `validatePark` never running — w7-check.mjs reported
// `ok:false failures:0` for every sample, which looks like a park defect and
// is really a bundler defect. `evaltags.mjs` always listed both paths in this
// order; this file listed only the sibling after the 2026-07-24 in-repo move.
const NODE_PATHS = [path.join(HERE, 'node_modules'), path.resolve(HERE, '..', 'mp3d-render', 'node_modules')];
const CHROME_DIR = path.join(process.env.HOME ?? '', '.cache/puppeteer/chrome');

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
    nodePaths: NODE_PATHS,
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

/**
 * SIZE-192 NOTE (wave 8). A default-size park mounts a 427² terrain mesh under
 * swiftshader and takes MINUTES, so the browser's 30 s navigation default fails
 * outright — `samples/seedcheck-s1-192.tsx` died on
 * "Navigation timeout of 30000 ms exceeded" and w7-check reported it as a park
 * defect. `evaltags.mjs` already allowed 240 s via PARK_NAV_MS; this bundler
 * now honours the SAME two env vars so both paths behave alike.
 */
export async function openParkPage(
  htmlPath,
  {
    waitMs = 7000,
    navMs = Number(process.env.PARK_NAV_MS ?? 240000),
  } = {},
) {
  let browser, page;
  try {
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
  await installFrameShim(page);
  page.setDefaultNavigationTimeout?.(navMs);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: navMs });
  // wait for the validate verdict (or the timeout)
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (lines.some((l) => /validatePark →|validatePark skipped|no component export/.test(l))) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 1200)); // let the FAIL/warning lines flush
  return { browser, page, lines };
}
