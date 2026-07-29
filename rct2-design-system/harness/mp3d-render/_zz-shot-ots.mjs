#!/usr/bin/env node
// THROWAWAY (delete after the run) — shoot the OceanTunnelSlide access fixture
// from fixed camera poses. Playwright only: puppeteer eats too much RAM here.
//
//   node _zz-shot-ots.mjs --export=AccessPark --tag=mask
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const exportName = arg('export', 'AccessPark');
const tag = arg('tag', exportName);
const OUTDIR = path.join(HARNESS, 'shots', 'ots-water');
fs.mkdirSync(OUTDIR, { recursive: true });

const POSES = [
  // the park camera — the same kind of wide 3/4 the lead shots are taken from
  ['park', [10, 24, 34], [0, 0.6, 0]],
  // the access: the two huts and the lane, with the cove behind them
  ['access', [8, 11, 21], [4.4, 0.4, 4.2]],
  // the tower's foot, the stair and the stack of spare rafts
  ['towerfoot', [16, 8, 11], [3.0, 1.2, -1.6]],
];

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as M from ${JSON.stringify(path.join(HARNESS, '_zz-ots-park.tsx'))};
createRoot(document.getElementById('root')).render(React.createElement(M[${JSON.stringify(exportName)}]));
`;
const entryPath = path.join(HARNESS, 'out', '_zz-entry-ots-park.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);
const bundle = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent',
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});
const htmlPath = path.join(HARNESS, 'out', `_zz-ots-park-${tag}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#111}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const lines = [];
page.on('console', (m) => lines.push(m.text()));
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
let ready = false;
for (let i = 0; i < 300 && !ready; i += 1) {
  await page.waitForTimeout(500);
  ready = await page.evaluate(() => !!window.__parkReport);
}
if (!ready) {
  console.log('[shot] park never reported; console lines:');
  for (const l of lines.slice(0, 60)) console.log(` | ${l}`);
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(4000);
for (const [name, pos, tgt] of POSES) {
  await page.evaluate(
    ([p, t]) => document.querySelector('canvas').__stageApi.setCameraPose(p, t),
    [pos, tgt],
  );
  await page.waitForTimeout(1800);
  const out = path.join(OUTDIR, `${tag}-${name}.png`);
  await page.locator('canvas').first().screenshot({ path: out });
  console.log(`[shot] wrote ${out}`);
}
for (const l of lines) if (/FAIL|WARN|warn|lint|\[Park\]|validatePark|perf:/.test(l)) console.log(` | ${l}`);
await browser.close();
