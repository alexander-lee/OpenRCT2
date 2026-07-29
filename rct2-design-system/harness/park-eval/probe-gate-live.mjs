#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-gate-live.mjs — the BROWSER half of the guest-population measurement.
// Mounts a park file for real (three.js on SwiftShader), then reports:
//
//   * the `[Park] validatePark →` verdict + every FAIL/warning line,
//   * the `[Park] perf:` probe (draws / tris / fps / CPU ms / lights),
//   * the LIVE population + average happiness, read off the ParkInfo window's
//     own DOM row ("N guests … M happiness") once a second, so the gate
//     stream's growth is measured from what the park actually renders.
//
//   node probe-gate-live.mjs <park.tsx> [--secs=40] [--shot=out.png]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { HERE, REPO } from './paths.mjs';
// own page opener too: lib.mjs's `goto` uses puppeteer's default 30 s
// navigation timeout, and a 192-plot park does not finish `load` inside it
// under SwiftShader.
async function openParkPage(htmlPath, { waitMs = 90000 } = {}) {
  let browser, page;
  const CHROME_DIR = path.join(process.env.HOME ?? '', '.cache/puppeteer/chrome');
  const chromePath = () => {
    const builds = fs.existsSync(CHROME_DIR) ? fs.readdirSync(CHROME_DIR).sort().reverse() : [];
    for (const b of builds) {
      const p2 = path.join(CHROME_DIR, b, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
      if (fs.existsSync(p2)) return p2;
    }
    return null;
  };
  try {
    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = chromePath();
    if (!executablePath) throw new Error('no Chrome for Testing');
    browser = await puppeteer.launch({
      executablePath, headless: true,
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
  await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (lines.some((l) => /validatePark →|no component export/.test(l))) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  await new Promise((r) => setTimeout(r, 1500));
  return { browser, page, lines };
}

// OWN BUNDLER (not lib.mjs's): the harness has react installed in BOTH
// harness/node_modules trees, and lib.mjs resolves `react` out of one and
// `react-dom/client` out of the other, which gives every park page a dual-React
// "Invalid hook call" and a blank canvas. Pinning all three specifiers to ONE
// copy with esbuild `alias` fixes it for this probe.
const NM = path.join(HERE, 'node_modules');
const REACT_ALIAS = {
  react: path.join(NM, 'react'),
  'react-dom': path.join(NM, 'react-dom'),
  'react-dom/client': path.join(NM, 'react-dom/client.js'),
  'react/jsx-runtime': path.join(NM, 'react/jsx-runtime.js'),
  three: path.join(NM, 'three'),
};
const componentAlias = {
  name: 'mp3d-components',
  setup(b) {
    b.onResolve({ filter: /(^|\/)components\// }, (a) => {
      if (a.path.startsWith('/')) return null;
      const rel = a.path.slice(a.path.indexOf('components/'));
      const base = path.join(REPO, rel);
      for (const c of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')])
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return { path: c };
      return null;
    });
  },
};
async function bundleParkPage(parkFile, name) {
  const abs = path.resolve(parkFile);
  const outDir = path.join(HERE, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const entry = path.join(outDir, `_${name}.entry.tsx`);
  fs.writeFileSync(
    entry,
    `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport * as THREE from 'three';\nimport * as M from ${JSON.stringify(abs)};\nwindow.__THREE = THREE;\nconst named = Object.entries(M).filter(([k, v]) => typeof v === 'function' && /^[A-Z]/.test(k));\nconst C = (typeof M.default === 'function' ? M.default : null) || ((named.find(([k]) => /park/i.test(k)) || named[0] || [])[1]);\nif (!C) console.error('[probe] no component export found');\nelse createRoot(document.getElementById('root')).render(React.createElement(C));\n`,
  );
  const r = await build({
    entryPoints: [entry], bundle: true, write: false, format: 'iife', jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
    alias: REACT_ALIAS, plugins: [componentAlias], nodePaths: [NM], target: 'chrome120', logLevel: 'silent',
  });
  const js = path.join(outDir, `_${name}.bundle.js`);
  fs.writeFileSync(js, r.outputFiles[0].text);
  const html = path.join(outDir, `_${name}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%}</style></head><body><div id="root"></div><script src="${path.basename(js)}"></script></body></html>`);
  return html;
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const arg = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
if (!file) {
  console.error('usage: node probe-gate-live.mjs <park.tsx> [--secs=40] [--shot=out.png]');
  process.exit(1);
}
const secs = Number(arg('secs', '40'));
const shot = arg('shot');
const name = path.basename(file).replace(/\.tsx$/, '');

const html = await bundleParkPage(file, `gl-${name}`);
const { browser, page, lines } = await openParkPage(html, { waitMs: 60000 });

// the ParkInfo row: "<icon> N guests <icon> M happiness"
const readStats = () =>
  page.evaluate(() => {
    const txt = document.body.innerText || '';
    const m = /(\d+)\s*guests[\s\S]{0,40}?(\d+)\s*happiness/.exec(txt);
    return m ? { pop: Number(m[1]), happy: Number(m[2]) } : null;
  });

const series = [];
for (let i = 0; i <= secs; i += 1) {
  const s = await readStats();
  if (s) series.push({ t: i, ...s });
  await new Promise((r) => setTimeout(r, 1000));
}
if (shot) await page.screenshot({ path: path.resolve(shot) });
await browser.close();

const verdict = lines.filter((l) => /validatePark →/.test(l));
const fails = lines.filter((l) => /validatePark FAIL/.test(l));
const warns = lines.filter((l) => /validatePark warnings/.test(l));
const perf = lines.filter((l) => /\[Park\] perf:/.test(l));
const errs = lines.filter((l) => /pageerror|\[error\]/.test(l));

console.log(`\n=== ${name}`);
verdict.forEach((l) => console.log(`  ${l.slice(0, 400)}`));
fails.forEach((l) => console.log(`  ${l.slice(0, 300)}`));
warns.forEach((l) => console.log(`  ${l.slice(0, 300)}`));
perf.forEach((l) => console.log(`  ${l}`));
errs.slice(0, 6).forEach((l) => console.log(`  ${l.slice(0, 240)}`));
if (series.length) {
  console.log(`  population (wall-clock s → guests / happiness):`);
  console.log(`    ${series.map((s) => `${s.t}s:${s.pop}/${s.happy}`).join('  ')}`);
  const first = series[0];
  const last = series[series.length - 1];
  console.log(`  grew ${first.pop} → ${last.pop} guests over ${last.t - first.t}s (happiness ${first.happy} → ${last.happy})`);
} else console.log('  (no ParkInfo stats row found — no GameManager/rides?)');
if (shot) console.log(`  shot: ${path.resolve(shot)}`);
