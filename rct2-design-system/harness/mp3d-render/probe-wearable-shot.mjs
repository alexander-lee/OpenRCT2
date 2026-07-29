#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-wearable-shot.mjs — VISUAL proof that a sim-driven guest is WEARING a
// bought wearable, not merely flagged as owning one.
//
// Mounts the GoggleWorks live-sim preview (its `dress` hook runs a real
// deterministic GameManager: guests walk the loop, hit the counter and buy),
// then reaches into the Stage's scene graph, finds a group named 'wornItem',
// verifies it is parented under a peep `headSlot`, walks UP to that guest's
// root group and parks the camera right in front of their head — so the shot
// shows the goggles ON A GUEST rather than a distant crowd of 12-px peeps.
//
// Prints the head-slot parentage chain it found, then writes the PNG.
//
//   node probe-wearable-shot.mjs [--out=shots/x.png] [--wait=ms] [--dist=u]
// ---------------------------------------------------------------------------
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
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const outPng = path.resolve(opt('out', path.join(HARNESS, 'shots', 'wearable-worn-closeup.png')));
const waitMs = Number(opt('wait', 9000));
const DIST = Number(opt('dist', 1.15));

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import previews from ${JSON.stringify(path.join(REPO, 'components/GoggleWorks/GoggleWorks.previews.tsx'))};
window.__THREE = THREE;
const list = previews.previews ?? [];
createRoot(document.getElementById('root')).render(React.createElement('div', null, list[0].render()));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-wearable-shot.tsx');
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

const htmlPath = path.join(HARNESS, 'out', 'wearable-shot.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#38343a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(waitMs);

const info = await page.evaluate((dist) => {
  const c = document.querySelector('canvas');
  const api = c && c.__stageApi;
  if (!api) return { err: 'no __stageApi on the canvas' };
  const THREE = window.__THREE;
  const scene = api.scene;
  const worn = [];
  const slots = [];
  scene.traverse((o) => {
    if (o.name === 'wornItem') worn.push(o);
    if (o.name === 'headSlot') slots.push(o);
  });
  if (!worn.length) return { err: 'no wornItem in the scene graph', slots: slots.length };
  // pick the wearer nearest the camera so the close-up is unobstructed
  const camPos = api.camera.getWorldPosition(new THREE.Vector3());
  const scored = worn.map((w) => {
    const p = w.getWorldPosition(new THREE.Vector3());
    return { w, p, d: p.distanceTo(camPos) };
  }).sort((a, b) => a.d - b.d);
  const pick = scored[0];
  // parentage chain up to the guest root (proves headSlot parentage visually too)
  const chain = [];
  let guestRoot = null;
  for (let p = pick.w; p; p = p.parent) {
    chain.push(p.name || p.type);
    if (/^guest-\d+$/.test(p.name || '')) { guestRoot = p; break; }
  }
  const underHeadSlot = chain.includes('headSlot');
  let meshes = 0;
  pick.w.traverse((o) => { if (o.isMesh) meshes += 1; });
  // face the guest: stand off along the direction they are looking
  const hp = pick.p;
  const yaw = guestRoot ? guestRoot.rotation.y : 0;
  const cam = [hp.x + Math.sin(yaw) * dist, hp.y + 0.16, hp.z + Math.cos(yaw) * dist];
  api.setCameraPose(cam, [hp.x, hp.y, hp.z]);
  return {
    wornCount: worn.length,
    headSlots: slots.length,
    chain,
    underHeadSlot,
    meshes,
    guest: guestRoot ? guestRoot.name : null,
    headWorld: [+hp.x.toFixed(3), +hp.y.toFixed(3), +hp.z.toFixed(3)],
  };
}, DIST);

console.log(JSON.stringify(info, null, 1));
if (info.err) { await browser.close(); process.exit(1); }
await page.waitForTimeout(2500);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng });
await browser.close();
console.log(`[harness] wrote ${outPng}`);
