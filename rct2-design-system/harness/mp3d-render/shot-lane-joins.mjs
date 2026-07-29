#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-lane-joins.mjs — FIXED-ANGLE views of the ride-access joins.
//
// <Stage> auto-rotates and takes no camera prop, so render.mjs cannot be used
// to judge whether one slab meets another. This mounts lane-park.tsx and shoots
// ORTHOGRAPHIC ELEVATIONS along each lane's own lateral axis (a step reads as a
// step, with no perspective to argue about) plus a guest's-eye and a rider's-eye
// perspective.
//
//   node shot-lane-joins.mjs ["R3 Twist"] [--out=path]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const ride = args.find((a) => !a.startsWith('--')) ?? 'R3 Twist';
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const outPng = path.resolve(opt('out', path.join(HARNESS, 'shots', `lane-joins-${ride.replace(/\W+/g, '')}.png`)));

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanePark } from ${JSON.stringify(path.join(HARNESS, 'lane-park.tsx'))};
createRoot(document.getElementById('root')).render(React.createElement(LanePark));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-lane-shots.tsx');
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
const htmlPath = path.join(HARNESS, 'out', 'lane-shots.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#111}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`);
let ready = null;
for (let i = 0; i < 140 && !ready; i += 1) {
  await page.waitForTimeout(500);
  ready = await page.evaluate(() => (window.__parkReport && window.__laneShots ? 1 : null));
}
if (!ready) { console.log('[shots] park never became ready'); await browser.close(); process.exit(1); }
console.log('[shots]', JSON.stringify(await page.evaluate((r) => window.__laneShots(r), ride)));
await page.waitForTimeout(1500);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.locator('#shots').screenshot({ path: outPng });
await browser.close();
console.log(`[shots] wrote ${outPng}`);
