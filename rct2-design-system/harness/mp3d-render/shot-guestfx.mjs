#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-guestfx.mjs — fixed ORTHOGRAPHIC views of the GUEST FX mesh recipes
// (litter / poop / vomit / burger / drink / container / balloon), which nothing
// else in the harness could see: they live inside `createGuestFx`'s pools and
// on a guest's hand, so shot-views.mjs (SceneryPack pieces + `--comp` builders)
// cannot reach them and <ScenePreview> auto-rotates. Every recipe is now an
// exported builder in components/GameManager/guestFx.ts, so this imports them
// directly — no sim, no waiting for a guest to buy something.
//
// The `held` sheet also shows each item ON A REAL PEEP HAND at GameManager's
// hold transform, posed MID-CYCLE (the eat/drink lift, k = 1) as well as at the
// carry bend — grading the rest pose hides everything the bite does. Each cell
// is labelled with the mesh count of the row, which is the number that matters:
// these objects are instantiated per guest / per pool slot, so one extra mesh
// here is hundreds of extra draw calls in a full park.
//
//   node shot-guestfx.mjs world     # litter variants, poop, vomit
//   node shot-guestfx.mjs held      # burger, drink, container, balloon, on-peep
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const which = process.argv[2] ?? 'world';
const CELL = 340;

const rowsWorld = `[
  ['litter A', () => FX.buildLitterMesh(THREE, 3.1)],
  ['litter B', () => FX.buildLitterMesh(THREE, 11.7)],
  ['litter C', () => FX.buildLitterMesh(THREE, 27.4)],
  ['litter D', () => FX.buildLitterMesh(THREE, 42.9)],
  ['poop', () => FX.buildPoopMesh(THREE)],
  ['vomit', () => FX.buildVomitMesh(THREE)],
]`;
const rowsHeld = `[
  ['burger', () => FX.buildHeldFood(THREE)],
  ['drink', () => FX.buildHeldDrink(THREE)],
  ['container', () => FX.buildHeldContainer(THREE)],
  ['balloon rig', () => balloonRig()],
  ['peep + burger @bite', () => peepWith('food', 1)],
  ['peep + drink @bite', () => peepWith('drink', 1)],
  ['peep + burger @carry', () => peepWith('food', 0)],
  ['peep + balloon', () => peepWith('balloon', 0)],
]`;

const entrySrc = `
import * as THREE from 'three';
import * as FX from ${JSON.stringify(path.join(REPO, 'components/GameManager/guestFx.ts'))};
import { buildPeep } from ${JSON.stringify(path.join(REPO, 'components/Guest'))};
import { mat } from ${JSON.stringify(path.join(REPO, 'components/Stage'))};

const GUEST_SCALE = 0.5;
function balloonRig() {
  const g = new THREE.Group();
  const pivot = new THREE.Group();
  const col = 0xd8342a;
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6), mat(THREE, 0xd8d8d0, { rough: 0.9 }));
  str.position.set(0, 0.275, 0);
  pivot.add(str);
  const b = FX.buildBalloonBody(THREE, 0.17, mat(THREE, col, { rough: 0.25 }));
  b.position.set(0, 0.55 + 0.17 * 1.265, 0);
  pivot.add(b);
  g.add(pivot);
  return g;
}
// a real peep with the item on the armR hand pivot at GameManager's hold
// transform, posed at the eat/drink lift (k=1) or the carry bend (k=0)
function peepWith(kind, k) {
  const p = buildPeep(THREE, { expression: 'happy' });
  p.pose.setState('idle');
  p.pose.update(2.4, 0.016);
  if (kind === 'balloon') {
    const pivot = new THREE.Group();
    pivot.position.set(0, -0.32, 0);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6), mat(THREE, 0xd8d8d0, { rough: 0.9 }));
    str.position.set(0, 0.275, 0);
    pivot.add(str);
    const b = FX.buildBalloonBody(THREE, 0.17, mat(THREE, 0x2f6fd0, { rough: 0.25 }));
    b.position.set(0, 0.55 + 0.17 * 1.265, 0);
    pivot.add(b);
    p.armR.add(pivot);
    p.armR.rotation.x = -0.2;
    pivot.rotation.x = -p.armR.rotation.x;
  } else {
    const item = kind === 'food' ? FX.buildHeldFood(THREE) : FX.buildHeldDrink(THREE);
    item.position.set(0.03, -0.37, kind === 'food' ? 0.15 : 0.115);
    p.armR.add(item);
    const lift = kind === 'drink' ? -2.0 : -1.85;
    const a = p.armR.rotation.x;
    p.armR.rotation.x = k ? a + (lift - a) * k : Math.min(a, -0.45);
    p.armR.rotation.z += -0.4 * k;
    p.head.rotation.x += (kind === 'drink' ? -0.12 : 0.2) * k;
  }
  const g = new THREE.Group();
  p.group.scale.setScalar(GUEST_SCALE);
  g.add(p.group);
  return g;
}

const ROWS = ${which === 'held' ? rowsHeld : rowsWorld};
const CELL = ${CELL};
const VIEWS = [
  { tag: 'FRONT (-z)', dir: [0, 0, -1], up: [0, 1, 0] },
  { tag: 'SIDE (+x)', dir: [1, 0, 0], up: [0, 1, 0] },
  { tag: 'TOP (-y)', dir: [0, 1, 0], up: [0, 0, 1] },
  { tag: 'BACK (+z)', dir: [0, 0, 1], up: [0, 1, 0] },
  { tag: '3/4', dir: [0.62, 0.5, 0.62], up: [0, 1, 0] },
];
const root = document.getElementById('root');
for (const [name, make] of ROWS) {
  const grp = make();
  const row = document.createElement('div');
  row.style.cssText = 'display:flex';
  root.appendChild(row);
  const bb = new THREE.Box3();
  grp.updateMatrixWorld(true);
  grp.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); bb.expandByObject(o); } });
  const ctr = bb.getCenter(new THREE.Vector3());
  const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * 1.15;
  let meshes = 0;
  grp.traverse((o) => { if (o.isMesh) meshes += 1; });
  for (const v of VIEWS) {
    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;width:' + CELL + 'px;height:' + CELL + 'px';
    const tag = document.createElement('div');
    tag.textContent = name + '  ' + v.tag + '  [' + meshes + ' mesh]';
    tag.style.cssText = 'position:absolute;left:6px;top:4px;z-index:2;font:11px monospace;color:#fff;text-shadow:0 1px 2px #000';
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
    const obj = grp.clone(true);
    obj.position.sub(ctr);
    scene.add(obj);
    const grid = new THREE.GridHelper(span * 2, 20, 0x8fa07f, 0x64705a);
    grid.position.y = -ctr.y + bb.min.y;
    scene.add(grid);
    const h = span / 2;
    if (v.tag === '3/4') {
      const p = new THREE.PerspectiveCamera(34, 1, 0.01, span * 20);
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
  r.dispose();
}
window.__ready = true;
`;

const entryPath = path.join(HARNESS, 'out', `_guestfx-${which}.tsx`);
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
const nRows = which === 'held' ? 8 : 6;
const W = CELL * 5;
const H = CELL * nRows;
const htmlPath = path.join(HARNESS, 'out', `_guestfx-${which}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#22262a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);
const outPng = path.join(HARNESS, 'shots', `guestfx-${which}.png`);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[page:error] ${m.text()}`); });
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }).catch(() => console.log('[harness] never ready'));
await page.waitForTimeout(1200);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(`[harness] wrote ${outPng}`);
