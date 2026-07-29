#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-world-ground.mjs — photograph the six theme FLOORS.
//
// WHY. `<WorldGround>` shipped with `repeat: [2, 2]` passed to `mergedBoxes`,
// which deliberately overrides the material repeat to [1, 1] ("per-part repeats
// live in the baked UVs"). So the request was silently dropped and every 2.4 u
// tile stretched ONE copy of a 128 px canvas across itself — the floor read as
// flat coloured squares. Nothing could see it, because the build body lived
// inside `useComposable` where no harness can reach it.
//
// Renders each theme at the OLD texel density beside the NEW one, from a low
// 3/4 angle (how a floor is actually seen) and from directly overhead (where
// grid repetition shows up). `--tone` instead shows the four-way tone split as
// flat colour, with the texture off, so the tonal step can be judged on its own.
//
//   node shot-world-ground.mjs [--themes=fire,neon] [--cell=420] [--tone]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { HERE, MP3D } from './lib.mjs';
const REPO = MP3D;                       // the design-system source root
const HARNESS = path.resolve(HERE, '..'); // harness/, so out/ is shared

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split('=').slice(1).join('=') : d;
};
const CELL = Number(arg('cell', '420'));
const TONE = process.argv.includes('--tone');
const PATHS = process.argv.includes('--paths');
const STEEP = process.argv.includes('--steep');
const THEMES = arg('themes', 'fire,pirateBeach,steampunk,enchantedForest,neon,default').split(',');

const entrySrc = `
import * as THREE from 'three';
import { buildWorldGroundScene } from ${JSON.stringify(path.join(REPO, 'components/WorldGround'))};
import { WORLD_THEMES } from ${JSON.stringify(path.join(REPO, 'components/SetPieceKit'))};

const THEMES = ${JSON.stringify(THEMES)};
const CELL = ${CELL};
const TONE = ${TONE};
const PATHS = ${PATHS};
const STEEP = ${STEEP};

// a gently rolling floor, so the tiles settle onto relief the way they do in a
// real park — a dead-flat test bed hides the height jitter entirely
const park = { floorAt: (x, z) => STEEP
  ? Math.sin(x * 0.42) * 1.15 + Math.cos(z * 0.33) * 0.95
  : Math.sin(x * 0.11) * 0.28 + Math.cos(z * 0.09) * 0.22 };

const HX = 13, HZ = 13;
const planFor = (tid) => ({
  key: 'pv-' + tid,
  theme: tid === 'default'
    ? { id: 'default', seedOffset: 0, ground: { soil: 0x6f9e54, patch: 0x7fae61, tex: 'grass', patchiness: 0.30 } }
    : WORLD_THEMES[tid],
  region: { cx: 0, cz: 0, hx: HX, hz: HZ },
});

// OLD = one canvas copy per 2.4 u tile, which is what detail = tile reproduces
// BEFORE reproduces the shipped look: coarse 2.4 u tiles, one texture copy per
// tile. AFTER is the default the component now ships.
const VARIANTS = PATHS
  ? [{ tag: 'OLD sink (top AT floorAt)', tile: 1.2, detail: 1.2, sink: 0.0 },
     { tag: 'NEW sink (top 32-48mm under)', tile: 1.2, detail: 1.2, sink: null }]
  : [{ tag: 'BEFORE 2.4u tile', tile: 2.4, detail: 2.4 },
     { tag: 'AFTER  1.2u + smooth tone field', tile: 1.2, detail: 1.2 }];
const VIEWS = PATHS
  ? [{ tag: 'GRAZING along the path', dir: [0.16, 0.05, 0.99], ortho: false },
     { tag: 'TOP — speckle = z-fight', dir: [0, 1, 0], up: [0, 0, 1], ortho: true }]
  : [{ tag: 'low 3/4', dir: [0.55, 0.30, 0.55], ortho: false },
     { tag: 'TOP', dir: [0, 1, 0], up: [0, 0, 1], ortho: true }];

const root = document.getElementById('root');
for (const tid of THEMES) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex';
  root.appendChild(row);
  for (const v of VARIANTS) for (const view of VIEWS) {
    const built = buildWorldGroundScene(THREE, planFor(tid), park, { tile: v.tile, detail: v.detail });
    if (PATHS) {
      // reproduce the OLD sink by lifting the whole floor back up to it
      if (v.sink === 0.0) built.group.position.y += 0.04 + 0.025;
      // a PATH SLAB where a real one sits: its underside AT floorAt. This is
      // the surface the ground used to be exactly coplanar with.
      const pg = new THREE.Group();
      for (let z = -12; z <= 12; z += 0.6) {
        const w = 3.0, th = 0.09;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, th, 0.6),
          new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.95 }));
        m.position.set(0, park.floorAt(0, z) + th / 2, z);
        pg.add(m);
      }
      built.group.add(pg);
    }
    let meshes = 0, tris = 0;
    built.group.traverse((o) => {
      if (o.isMesh) { meshes += 1; tris += (o.geometry.getIndex()?.count ?? 0) / 3; }
    });
    if (TONE) built.group.traverse((o) => { if (o.isMesh) o.material.map = null; });

    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;width:' + CELL + 'px;height:' + CELL + 'px';
    const tag = document.createElement('div');
    tag.textContent = tid + ' · ' + v.tag + ' · ' + view.tag + ' · ' + meshes + ' draws / ' + tris + ' tris';
    tag.style.cssText = 'position:absolute;left:6px;top:4px;z-index:2;font:12px monospace;color:#fff;text-shadow:0 1px 3px #000';
    cell.appendChild(tag);
    row.appendChild(cell);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d232a);
    scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x4a4030, 1.35));
    const key = new THREE.DirectionalLight(0xfff2dc, 2.0);
    key.position.set(5, 6, 4);
    scene.add(key);
    scene.add(built.group);

    const span = HX * 2;
    let cam;
    if (view.ortho) {
      const h = span * 0.54;
      cam = new THREE.OrthographicCamera(-h, h, h, -h, -span * 4, span * 4);
      cam.position.set(0, span, 0);
      cam.up.set(0, 0, 1);
    } else {
      cam = new THREE.PerspectiveCamera(30, 1, 0.1, span * 20);
      cam.position.set(view.dir[0] * span * 1.5, view.dir[1] * span * 1.5, view.dir[2] * span * 1.5);
    }
    cam.lookAt(0, 0, 0);

    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setSize(CELL, CELL);
    r.render(scene, cam);
    const img = new Image();
    img.src = r.domElement.toDataURL();
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    cell.appendChild(img);
    r.dispose(); // four live contexts per row would blow the browser's limit
    scene.remove(built.group);
  }
}
window.__ready = true;
`;

const entryPath = path.join(HARNESS, 'out', '_world-ground.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);
const res = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, nodePaths: [path.join(HARNESS, 'park-eval', 'node_modules')],
  target: 'es2020', logLevel: 'silent',
});

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: CELL * 4 + 40, height: CELL * THEMES.length + 40 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text().slice(0, 160)); });
await page.setContent('<body style="margin:0;background:#111"><div id="root"></div></body>');
await page.addScriptTag({ content: res.outputFiles[0].text, type: 'module' }).catch(async () => {
  await page.evaluate(res.outputFiles[0].text);
});
await page.waitForFunction('window.__ready === true', { timeout: 90_000 });
const out = path.join(HARNESS, 'out', TONE ? 'world-ground-tone.png' : PATHS ? (STEEP ? 'world-ground-paths-steep.png' : 'world-ground-paths.png') : 'world-ground.png');
await page.locator('#root').screenshot({ path: out });
await browser.close();
console.log('wrote', out);
