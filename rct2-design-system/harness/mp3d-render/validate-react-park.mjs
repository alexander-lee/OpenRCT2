#!/usr/bin/env node
// Headless harness for the React <Park> demo: mounts DemoPark, waits for the
// onReady report (window.__parkReport) and prints it.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');

// which park to validate — `node validate-react-park.mjs DistrictPark` runs the
// canonical size-48 composition instead of the compact demo. Default unchanged.
const PARK = process.argv[2] || 'DemoPark';
const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${PARK} } from ${JSON.stringify(path.join(REPO, 'components/Park/Park.previews.tsx'))};
createRoot(document.getElementById('root')).render(React.createElement(${PARK}));
`;
const entryPath = path.join(HARNESS, 'out', `_entry-react-park-${PARK}.tsx`);
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

const htmlPath = path.join(HARNESS, 'out', `react-park-${PARK}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('console', (m) => console.log(`[page:${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`);
let report = null;
for (let i = 0; i < 120 && !report; i += 1) {
  await page.waitForTimeout(500);
  report = await page.evaluate(() => window.__parkReport ?? null);
}
console.log('[RESULT]', JSON.stringify(report));
const stats = await page.evaluate(() => document.querySelector('canvas')?.__stageApi?.stats?.() ?? null);
console.log('[STATS]', JSON.stringify(stats));
await browser.close();
