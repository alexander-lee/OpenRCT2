#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-kit.mjs — DETERMINISTIC ORTHOGRAPHIC VIEWS of several Kit assets at once.
//
// Same fixed-pose ortho rig as shot-views.mjs (which exists because
// <ScenePreview> AUTO-ROTATES and exposes no camera prop, so render.mjs cannot
// be used to judge geometry — that is how a wishing well shipped with an
// upside-down roof). shot-views.mjs takes ONE `--comp=Module:export`, and Kit
// has 17 asset/variant builders that all need before-and-after elevations, so
// this takes a LIST of kit-views exports and lays them out one asset per row.
//
//   node shot-kit.mjs treeRound treePine --views=kit-views      [--tag=after]
//   node shot-kit.mjs treeRound treePine --views=kit-views-before --tag=before
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith('--'));
if (!names.length) {
  console.error('usage: node shot-kit.mjs <kitViewName> [more…] [--views=kit-views] [--tag=after]');
  process.exit(1);
}
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const VIEWS = opt('views', 'kit-views');
const TAG = opt('tag', VIEWS.endsWith('-before') ? 'before' : 'after');
const pad = Number(opt('pad', 1.12));
const CELL = 420;
const W = CELL * 5;
const H = CELL * names.length;
const outPng = path.resolve(opt('out', path.join(HARNESS, 'shots', 'kit', `${TAG}-${names.join('-')}.png`)));

const entrySrc = `
import * as THREE from 'three';
import * as KV from ${JSON.stringify(path.join(HARNESS, `${VIEWS}.ts`))};
const NAMES = ${JSON.stringify(names)};
const CELL = ${CELL};
const PAD = ${pad};
const TAG = ${JSON.stringify(TAG)};
// five fixed poses. dir = where the camera SITS relative to the target. BOTH z
// elevations are shot: assets with a FRONT and a BACK (foodStall's counter and
// awning face +z, bench's backrest faces −z) had half their dressing off-sheet
// on a single-elevation sheet.
const VIEWS = [
  { tag: 'FRONT (-z)', dir: [0, 0, -1], up: [0, 1, 0] },
  { tag: 'BACK (+z)', dir: [0, 0, 1], up: [0, 1, 0] },
  { tag: 'SIDE (+x)', dir: [1, 0, 0], up: [0, 1, 0] },
  { tag: 'TOP (-y)', dir: [0, 1, 0], up: [0, 0, 1] },
  { tag: '3/4', dir: [0.62, 0.5, 0.62], up: [0, 1, 0] },
];
const root = document.getElementById('root');
for (const name of NAMES) {
  const built = KV[name](THREE);
  built.update?.(3.7); // settle animation to a mid-cycle pose, never the rest pose
  const row = document.createElement('div');
  row.style.cssText = 'display:flex';
  root.appendChild(row);
  const bb = new THREE.Box3();
  built.group.updateMatrixWorld(true);
  built.group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingBox(); // cached boxes go stale on rebuilt geometry
      bb.expandByObject(o);
    }
  });
  const ctr = bb.getCenter(new THREE.Vector3());
  const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * PAD;
  for (const v of VIEWS) {
    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;width:' + CELL + 'px;height:' + CELL + 'px';
    const tag = document.createElement('div');
    tag.textContent = TAG + '  ' + name + '  ' + v.tag;
    tag.style.cssText =
      'position:absolute;left:6px;top:4px;z-index:2;font:12px monospace;color:#fff;text-shadow:0 1px 2px #000';
    cell.appendChild(tag);
    row.appendChild(cell);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2f3a2c);
    scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x4a4030, 1.5));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.9);
    key.position.set(4, 7, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbcd0ff, 0.7);
    fill.position.set(-5, 3, -4);
    scene.add(fill);
    const obj = built.group.clone(true); // a mesh lives in one scene at a time
    obj.position.sub(ctr);
    scene.add(obj);
    // a ground line at the asset's own y=0 plane, so "floating" and "buried" show
    const grid = new THREE.GridHelper(span * 2, 20, 0x8fa07f, 0x64705a);
    grid.position.y = -ctr.y;
    scene.add(grid);

    const h = span / 2;
    if (v.tag === '3/4') {
      const p = new THREE.PerspectiveCamera(34, 1, 0.1, span * 20);
      p.position.set(v.dir[0] * span * 2.6, v.dir[1] * span * 2.6, v.dir[2] * span * 2.6);
      p.lookAt(0, 0, 0);
      renderTo(cell, scene, p);
      continue;
    }
    const cam = new THREE.OrthographicCamera(-h, h, h, -h, -span * 4, span * 4);
    cam.position.set(v.dir[0] * span * 2, v.dir[1] * span * 2, v.dir[2] * span * 2);
    cam.up.set(...v.up);
    cam.lookAt(0, 0, 0);
    renderTo(cell, scene, cam);
  }
}
function renderTo(cell, scene, cam) {
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setSize(CELL, CELL);
  r.render(scene, cam);
  const img = new Image();
  img.src = r.domElement.toDataURL();
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  cell.appendChild(img);
  r.dispose(); // live WebGL contexts per row would blow the browser's limit
}
window.__ready = true;
`;
const entryPath = path.join(HARNESS, 'out', `_kitviews-${TAG}-${names.join('-')}.tsx`);
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

const htmlPath = path.join(HARNESS, 'out', `kitviews-${TAG}-${names.join('-')}.html`);
fs.writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#22262a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') console.log(`[page:error] ${m.text()}`);
});
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }).catch(() => console.log('[harness] page never signalled ready'));
await page.waitForTimeout(1200);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(`[harness] wrote ${outPng}`);
