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
    nodePaths: [path.join(HARNESS, 'node_modules')],
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

export async function openParkPage(htmlPath, { waitMs = 7000 } = {}) {
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
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  // wait for the validate verdict (or the timeout)
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (lines.some((l) => /validatePark →|validatePark skipped|no component export/.test(l))) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 1200)); // let the FAIL/warning lines flush
  return { browser, page, lines };
}
