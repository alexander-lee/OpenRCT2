#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ride-probe — the THREE checks every ride agent kept rewriting from scratch.
//
//   node tools/ride-probe.mjs <Component> [--cycles=9] [--dt=1/60,1/30,1/20,1/10]
//
//   1. SEATS      distinct anchors == capacity, parked drift, travel on departing
//   2. CYCLE      distance from `board` each dispatch, at SEVERAL frame times
//   3. CENSUS     meshes / triangles / materials / lights / particles / casters
//
// WHY THIS EXISTS: one session produced **177 one-off probe scripts** in /tmp
// and persisted exactly one tool. Every ride agent re-derived the same three
// checks, spent thousands of tokens doing it, and the work evaporated. These
// three found, between them: a ride registered at 22 s against a 57 s lap that
// boarded guests at the top of a chain lift; a train drifting 21.5 u from its
// station over 8 cycles; and creep that only appears at low frame rates.
//
// THE FRAME-RATE AXIS IS THE POINT. The motion gate keeps integrating through
// `departing` (whose length is `loadTime`, default **1.6**, not 1.0) and through
// `arriving`, so advance per dispatch is `rideDuration + ~1.9`. The error is
// dt-DEPENDENT: a value tuned at 1/30 still creeps at 1/20, and at 1/10 — what
// SwiftShader actually runs — a coaster can cover only ~60% of its lap. A
// single-dt probe will pass and ship a broken ride.
// ---------------------------------------------------------------------------
import Module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const HARNESS = process.env.MP3D_HARNESS ?? '/tmp/mp3d-render';
const REPO = [
  path.resolve(new URL('..', import.meta.url).pathname, 'components'),
  '/Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/mp3d/components',
].find((p) => fs.existsSync(p));
const NM = path.join(HARNESS, 'node_modules');
if (!REPO || !fs.existsSync(NM)) {
  console.log(`need mp3d/components and ${NM} (set MP3D_HARNESS)`);
  process.exit(2);
}
const { build } = await import(path.join(NM, 'esbuild', 'lib', 'main.js'));
const { chromium } = await import(path.join(NM, 'playwright', 'index.js'));

const argv = process.argv.slice(2);
const name = argv.find((a) => !a.startsWith('--'));
if (!name) {
  console.log('usage: node tools/ride-probe.mjs <Component> [--cycles=9] [--dt=1/60,1/30,1/10]');
  process.exit(2);
}
const cycles = Number((argv.find((a) => a.startsWith('--cycles=')) ?? '--cycles=9').slice(9));
const dts = (argv.find((a) => a.startsWith('--dt=')) ?? '--dt=1/60,1/30,1/20,1/10')
  .slice(5)
  .split(',')
  .map((s) => {
    const [a, b] = s.split('/');
    return b ? Number(a) / Number(b) : Number(a);
  });

const src = `
import * as THREE from 'three';
import * as M from ${JSON.stringify(path.join(REPO, name))};

const build = Object.keys(M).find((k) => /^build.*Scene$/.test(k)) || Object.keys(M).find((k) => /^build[A-Z]/.test(k));

window.__probe = async () => {
  const out = { component: ${JSON.stringify(name)}, builder: build };
  if (!build) return { ...out, error: 'no build* export found' };
  const scene = M[build](THREE, {});
  const g = scene.group;

  // ---- 3. CENSUS (cheap, always useful) ---------------------------------
  let meshes = 0, tris = 0, casters = 0, particles = 0;
  const mats = new Set(), texs = new Set(), lights = [];
  g.traverse((o) => {
    if (o.isMesh) {
      meshes += 1;
      if (o.castShadow) casters += 1;
      const geo = o.geometry;
      if (geo) tris += geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3;
      const mm = Array.isArray(o.material) ? o.material : [o.material];
      mm.forEach((m) => { if (m) { mats.add(m.uuid); if (m.map) texs.add(m.map.uuid); } });
    }
    if (o.isPoints) particles += o.geometry?.attributes?.position?.count ?? 0;
    if (o.isPointLight) lights.push(+(o.intensity ?? 0).toFixed(2));
  });
  out.census = { meshes, triangles: Math.round(tris), materials: mats.size, textures: texs.size,
                 pointLights: lights.length, particles, shadowCasters: casters };
  out.budget = { lightsOk: lights.length <= 4, particlesOk: particles <= 300 };

  // ---- 1. SEATS ----------------------------------------------------------
  if (scene.seatWorld) {
    const n = 24;
    const seen = new Map();
    for (let i = 0; i < n; i += 1) {
      const s = scene.seatWorld(i);
      if (!s) continue;
      seen.set([s[0], s[1], s[2]].map((v) => v.toFixed(3)).join(','), i);
    }
    out.seats = { distinctAnchors: seen.size };
    // parked drift: seat 0 must not move while the gate says parked
    if (scene.update && scene.onStateChange) {
      scene.onStateChange('waitingForPassengers');
      const p0 = scene.seatWorld(0);
      for (let i = 0; i < 60; i += 1) scene.update(i / 30, 1 / 30);
      const p1 = scene.seatWorld(0);
      out.seats.parkedDrift = +Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).toFixed(4);
      scene.onStateChange('departing');
      const q0 = scene.seatWorld(0);
      for (let i = 60; i < 360; i += 1) scene.update(i / 30, 1 / 30);
      const q1 = scene.seatWorld(0);
      out.seats.travelOnDeparting = +Math.hypot(q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]).toFixed(2);
    }
  } else out.seats = { note: 'no seatWorld export' };

  // ---- 2. CYCLE CREEP, at several frame times ----------------------------
  // Drive the real FSM sequence and read where the vehicle parks each time.
  const board = scene.board ?? scene.boardPoint ?? null;
  const veh = scene.vehicle ?? null;
  if (veh && scene.update && scene.onStateChange) {
    out.cycle = {};
    for (const dt of ${JSON.stringify(dts)}) {
      const s2 = M[build](THREE, {});
      const v2 = s2.vehicle;
      const b2 = s2.board ?? s2.boardPoint ?? null;
      if (!v2) break;
      const dur = (M.RIDE_DEFAULTS && M.RIDE_DEFAULTS.rideDuration) || 12;
      const seq = [['waitingForPassengers', 3], ['departing', 1.6], ['travelling', dur],
                   ['arriving', 1.0], ['unloadingPassengers', 1.2], ['movingToEndOfStation', 1.0]];
      let t = 0;
      const dist = [];
      for (let c = 0; c < ${cycles}; c += 1) {
        for (const [st, secs] of seq) {
          s2.onStateChange?.(st);
          for (let e = 0; e < secs; e += dt) { t += dt; s2.update?.(t, dt); }
        }
        v2.updateMatrixWorld?.(true);
        const p = new THREE.Vector3().setFromMatrixPosition(v2.matrixWorld);
        dist.push(b2 ? +Math.hypot(p.x - b2[0], p.z - b2[2]).toFixed(2) : +p.length().toFixed(2));
      }
      const spread = Math.max(...dist) - Math.min(...dist);
      out.cycle['dt=' + dt.toFixed(4)] = { perCycle: dist, worst: Math.max(...dist), spread: +spread.toFixed(3) };
    }
    // creep is dt-dependent: compare the worst across frame times
    const worsts = Object.values(out.cycle).map((r) => r.worst);
    out.cycleVerdict = worsts.length && Math.max(...worsts) < 1.0
      ? 'STABLE at every dt'
      : 'CREEPS — worst ' + Math.max(...worsts) + ' u from board (see per-dt rows)';
  } else out.cycle = { note: 'no vehicle/board export — cycle check skipped' };

  return out;
};
`;

fs.mkdirSync(path.join(HARNESS, 'out'), { recursive: true });
const ep = path.join(HARNESS, 'out', `_rideprobe-${name}.tsx`);
fs.writeFileSync(ep, src);
const r = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [NM], target: 'chrome120', logLevel: 'silent',
}).catch((e) => {
  console.log('BUILD FAIL');
  for (const x of (e.errors ?? []).slice(0, 6)) console.log('  ', `${x.location?.file}:${x.location?.line}`, x.text);
  process.exit(1);
});
const html = path.join(HARNESS, 'out', `_rideprobe-${name}.html`);
fs.writeFileSync(html, `<!doctype html><html><body><script>${r.outputFiles[0].text}</script></body></html>`);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message.split('\n')[0]));
await page.goto('file://' + html);
const res = await page.evaluate(() => window.__probe());
console.log(JSON.stringify(res, null, 1));
await browser.close();
