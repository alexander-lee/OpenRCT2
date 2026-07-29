#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-scenery.mjs — CLOSE-UP of one or more SceneryPack pieces.
//
// `render.mjs SceneryPack` shoots the 20-piece museum grid from 16 u away,
// which is far too far to judge a single dressing's mesh — a planter is ~40 px
// across in that frame. This mounts only the pieces you name, one per row, on
// its own tight ScenePreview, so a mesh change can actually be looked at.
//
//   node shot-scenery.mjs planterBox gazebo [--dist=4] [--night] [--out=path]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith('--'));
if (!names.length) {
  console.error('usage: node shot-scenery.mjs <pieceName> [more…] [--dist=4] [--night]');
  process.exit(1);
}
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const night = args.includes('--night');
const dist = Number(opt('dist', 4));
const ty = Number(opt('ty', 0.5));
const W = 880;
const H = 460 * names.length;
const outPng = path.resolve(opt('out', path.join(HARNESS, 'shots', `piece-${names.join('-')}${night ? '-night' : ''}.png`)));

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScenePreview } from ${JSON.stringify(path.join(REPO, 'components/Park'))};
import { buildSceneryAnimated } from ${JSON.stringify(path.join(REPO, 'components/SceneryPack'))};
import { composable } from ${JSON.stringify(path.join(REPO, 'components/Park'))};
const NAMES = ${JSON.stringify(names)};
const D = ${dist};
const TY = ${ty};
const rows = NAMES.map((n) => {
  const C = composable('piece-' + n, (t) => buildSceneryAnimated(t, n, { seed: 3 }));
  return React.createElement(
    'div',
    { key: n },
    React.createElement(
      ScenePreview,
      { distance: D, targetY: TY },
      React.createElement(C, null),
    ),
  );
});
createRoot(document.getElementById('root')).render(
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, rows),
);
`;
const entryPath = path.join(HARNESS, 'out', `_piece-${names.join('-')}.tsx`);
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

const bundle = await build({
  entryPoints: [entryPath],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  target: 'chrome120',
  logLevel: 'silent',
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});

const htmlPath = path.join(HARNESS, 'out', `piece-${names.join('-')}.html`);
fs.writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#38343a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') console.log(`[page:error] ${m.text()}`);
});
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3500);
if (night) {
  for (const h of await page.locator('button[aria-label="Switch to night"]').elementHandles()) {
    try {
      await h.click({ timeout: 3000 });
    } catch {
      /* heavy page — the dispatch usually lands anyway */
    }
  }
  await page.waitForTimeout(2400);
}
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(`[harness] wrote ${outPng}`);
