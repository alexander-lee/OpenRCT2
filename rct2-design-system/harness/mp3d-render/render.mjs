#!/usr/bin/env node
// mp3d render harness — bundles a design-system component preview with esbuild,
// opens it in headless chromium and screenshots it.
//
//   node render.mjs <ComponentName> [--night] [--angle=deg] [--elev=deg]
//                   [--out=path] [--wait=ms] [--nightwait=ms] [--preview=N]
//
//   --night        click the Stage day/night switcher(s) before the shot
//   --angle=deg    drag-orbit the FIRST canvas by this many degrees
//   --elev=deg     drag vertically to this approximate elevation
//   --out=path     PNG destination (default shots/<Name>[-night].png)
//   --wait=ms      settle time before the shot (default 3500)
//   --nightwait=ms extra settle after the night toggle (default 2200)
//   --preview=N    mount only preview index N (default: all previews stacked)
//
// Page console output + errors are echoed to stdout.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const W = 900;
const H = 700;

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
if (!name) {
  console.error('usage: node render.mjs <ComponentName> [--night] [--angle=deg] [--out=path]');
  process.exit(1);
}
const flag = (k) => args.includes(`--${k}`);
const opt = (k) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : undefined;
};
const night = flag('night');
const angle = Number(opt('angle') || 0);
const elev = opt('elev');
const waitMs = Number(opt('wait') || 3500);
const nightWait = Number(opt('nightwait') || 2200);
const only = opt('preview');
const compDir = path.join(REPO, 'components', name);
if (!fs.existsSync(compDir)) {
  console.error(`no such component: ${compDir}`);
  process.exit(1);
}
const outPng = path.resolve(opt('out') || path.join(HARNESS, 'shots', `${name}${night ? '-night' : ''}.png`));

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import previews from ${JSON.stringify(path.join(compDir, `${name}.previews.tsx`))};
const list = previews.previews ?? [];
const pick = ${only === undefined ? 'null' : JSON.stringify(String(only))};
const shown = pick === null ? list : [list[Number(pick)]].filter(Boolean);
createRoot(document.getElementById('root')).render(
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    shown.map((p, i) => React.createElement('div', { key: i }, p.render())))
);
`;
const entryPath = path.join(HARNESS, 'out', `_entry-${name}.tsx`);
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

const htmlPath = path.join(HARNESS, 'out', `${name}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#38343a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning' || m.type() === 'info' || m.type() === 'log') console.log(`[page:${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(waitMs);

if (night) {
  // snapshot handles first: a clicked switcher relabels to "Switch to day"
  const handles = await page.locator('button[aria-label="Switch to night"]').elementHandles();
  for (const h of handles) {
    try {
      await h.click({ timeout: 3000 });
    } catch {
      // heavy pages starve playwright's actionability rAF checks — but the
      // click may still have DISPATCHED before the timeout. Only fall back to
      // a DOM click if the switcher did NOT flip (else we'd toggle it back).
      try {
        const flipped = await h.evaluate((el) => el.getAttribute('aria-label') === 'Switch to day');
        if (!flipped) await h.evaluate((el) => el.click());
      } catch { /* ignore */ }
    }
  }
  if (handles.length === 0) console.log('[harness] no day/night switcher found');
  await page.waitForTimeout(nightWait);
}

if (angle || elev !== undefined) {
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Stage maps 0.01 rad per px horizontally and vertically
    const dx = angle ? -(angle * Math.PI / 180) / 0.01 : 0;
    const dy = elev !== undefined ? ((Number(elev) - 50.4) * Math.PI / 180) / 0.01 : 0;
    const steps = 12;
    for (let i = 1; i <= steps; i++) await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
    await page.mouse.up();
    await page.waitForTimeout(1200);
  }
}

fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng });
await browser.close();
console.log(`[harness] wrote ${outPng}`);
