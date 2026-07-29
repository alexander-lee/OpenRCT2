#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-setpiece-theme.mjs — WHAT DOES A THEME ACTUALLY CHANGE, AND WHAT DOES
// IT COST?
//
// A set-piece's theme layer started life as DATA ONLY (palette + species +
// seed offset), so two themed avenues differed in hue and shrub and nothing
// else. This probe is what makes the structural claim checkable, and it is the
// same instrument that guards the two hard invariants:
//
//   1. THE DEFAULT PATH IS UNCHANGED. Park layouts and seed tables depend on
//      the un-themed piece byte-for-byte, so every number below is recorded for
//      `default` and compared against a baseline file (`--baseline=…`). A plan
//      fingerprint covers the PURE planner (ports, sub-net, every dressing
//      anchor); a geometry fingerprint covers the MOUNT (every world-space
//      vertex, rounded to 0.1 mm, order-independent).
//   2. DRAW-CALL DISCIPLINE. These pieces scatter dressing many times per park,
//      so per-theme mesh counts are reported as a DELTA against `default` —
//      "themed" must not mean "three times the draws".
//
// Determinism is asserted directly: every piece is planned and built TWICE in
// the same process and the two fingerprints must match.
//
//   node probe-setpiece-theme.mjs                     # table
//   node probe-setpiece-theme.mjs --json > base.json  # record a baseline
//   node probe-setpiece-theme.mjs --baseline=base.json
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const BASELINE = arg('baseline', null);
// `--pre` probes the RECONSTRUCTED PRE-THEME components that `mutate-setpiece.mjs`
// writes, so the default-path baseline is recorded from code that provably does
// not contain the theme layer — not from the same tree it is meant to pin.
const PRE = process.argv.includes('--pre');
const BOULEVARD = PRE ? '_BoulevardPre' : 'Boulevard';
const PLAZA = PRE ? '_FountainPlazaPre' : 'FountainPlaza';
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, `_sptheme-entry${PRE ? '-pre' : ''}.ts`);
fs.writeFileSync(
  entry,
  `export { boulevardPlan, buildBoulevardScene } from ${JSON.stringify(path.join(REPO, `components/${BOULEVARD}/index.tsx`))};
export { fountainPlazaPlan, buildFountainPlazaScene } from ${JSON.stringify(path.join(REPO, `components/${PLAZA}/index.tsx`))};
export { WORLD_THEMES, THEME_IDS, DEFAULT_THEME } from ${JSON.stringify(path.join(REPO, 'components/SetPieceKit/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, `_sptheme-bundle${PRE ? '-pre' : ''}.mjs`);
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});

// ---- headless canvas + a stub <Park> --------------------------------------
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy({ measureText: () => ({ width: 0 }) }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}),
  set: () => true,
});
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }),
};
const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

/** the registrations a set-piece makes, captured instead of simulated — a
 *  themed piece must speak the SAME channels as the default one */
function stubPark() {
  const planted = [];
  const blockers = [];
  const footprints = [];
  return {
    rec: { planted, blockers, footprints },
    // flat ground: the whole point is that nothing may float, and a flat datum
    // makes "meets grade" a hard number instead of a sampled surface
    floorAt: () => 0,
    registerPlanted: (p) => {
      planted.push([p.label, +p.x.toFixed(3), +p.z.toFixed(3), +p.r.toFixed(3)]);
      return () => {};
    },
    registerBlocker: (b) => {
      blockers.push([b.label, b.kind, JSON.stringify(b.circle ?? b.rect), b.height]);
      return () => {};
    },
    registerFootprint: (f) => {
      footprints.push(JSON.stringify(f));
      return () => {};
    },
    registerWorld: () => () => {},
    _previewHost: true,
  };
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

/** the PURE planner's whole output, canonically ordered */
function planPrint(plan) {
  const round = (v) => (typeof v === 'number' ? +v.toFixed(4) : v);
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v).sort()) {
        if (k === 'toWorld' || k === 'toWorldYaw' || k === 'port' || k === 'portDir' || k === 'contains') continue;
        if (typeof v[k] === 'function') continue;
        o[k] = walk(v[k]);
      }
      return o;
    }
    return round(v);
  };
  return sha(JSON.stringify(walk(plan)));
}

/**
 * Every world-space vertex, rounded to 0.1 mm, ORDER-INDEPENDENT — a merge that
 * reorders parts is not a visual change, a moved vertex is.
 *
 * THE COMBINER MUST BE NONLINEAR, and the first version of this function was
 * not: it summed `round(x*1e4)*73856093 + …` per mesh, and a SUM cancels any
 * SYMMETRIC displacement. Widening the default plaza's border course from 0.28
 * to 0.30 moves each box face by ∓0.01 about its own centre, the two shifts
 * cancelled exactly, and the print came back byte-identical (a7edf3aa9a) on
 * geometry that had genuinely changed — a green light on the one invariant this
 * whole probe exists to hold. Found by mutating the default path on purpose,
 * which is the only reason it was found at all. Each vertex is now mixed
 * (xorshift-multiply, `Math.imul` to stay in 32 bits) BEFORE being summed, so
 * order-independence survives and cancellation does not.
 */
function geomPrint(group) {
  group.updateMatrixWorld(true);
  const rows = [];
  const v = new T.Vector3();
  const mix = (x, y, z) => {
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) | 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pa = o.geometry.getAttribute('position');
    if (!pa) return;
    let acc = 0;
    for (let i = 0; i < pa.count; i += 1) {
      v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
      acc = (acc + mix(Math.round(v.x * 1e4), Math.round(v.y * 1e4), Math.round(v.z * 1e4))) % 4294967296;
    }
    rows.push(`${pa.count}:${acc}`);
  });
  rows.sort();
  return sha(rows.join('|'));
}

function census(group) {
  group.updateMatrixWorld(true);
  let meshes = 0;
  let tris = 0;
  let lights = 0;
  let points = 0;
  const bb = new T.Box3();
  group.traverse((o) => {
    if (o.isMesh) {
      meshes += 1;
      const g = o.geometry;
      const idx = g.index ? g.index.count : g.getAttribute('position')?.count ?? 0;
      tris += idx / 3;
      g.computeBoundingBox();
      bb.expandByObject(o);
    }
    if (o.isPoints) points += 1;
    if (o.isPointLight || o.isSpotLight) lights += 1;
  });
  return {
    meshes,
    tris: Math.round(tris),
    lights,
    points,
    bbox: [bb.min, bb.max].map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]),
  };
}

// The two CASES are the shipped previews' own geometry, so the numbers below are
// the numbers a park pays: a 16.8 u avenue between two ports and a 7-tile plaza
// with all four ports open.
const CASES = [
  {
    piece: 'Boulevard',
    plan: (theme) => K.boulevardPlan({ id: 'ave', from: [0, -8.4], to: [0, 8.4], seed: 4, theme }),
    build: K.buildBoulevardScene,
  },
  {
    piece: 'FountainPlaza',
    plan: (theme) => K.fountainPlazaPlan({ id: 'hub', position: [0, 0], tiles: 7, seed: 1, theme }),
    build: K.buildFountainPlazaScene,
  },
];
const THEMES = [['default', undefined], ...K.THEME_IDS.map((id) => [id, K.WORLD_THEMES[id]])];

const quiet = console.warn;
const rows = [];
for (const c of CASES) {
  for (const [tid, theme] of THEMES) {
    console.warn = () => {};
    const p1 = c.plan(theme);
    const park1 = stubPark();
    const b1 = c.build(T, p1, park1);
    b1.update?.(3.7); // never grade the rest pose
    // build a SECOND time from a fresh plan: hashed-sine scatter must be
    // reproducible in-process, or nothing downstream of it can be
    const p2 = c.plan(theme);
    const park2 = stubPark();
    const b2 = c.build(T, p2, park2);
    b2.update?.(3.7);
    console.warn = quiet;
    const cen = census(b1.group);
    rows.push({
      piece: c.piece,
      theme: tid,
      ...cen,
      planKey: p1.key,
      plan: planPrint(p1),
      geom: geomPrint(b1.group),
      planRepeat: planPrint(p2),
      geomRepeat: geomPrint(b2.group),
      planted: sha(JSON.stringify(park1.rec.planted)),
      plantedN: park1.rec.planted.length,
      blockers: sha(JSON.stringify(park1.rec.blockers)),
      blockersN: park1.rec.blockers.length,
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

let fail = 0;
const note = (s) => console.log(s);
note('\n  probe-setpiece-theme — Boulevard 16.8 u (2 ports) · FountainPlaza 7 tiles (4 ports)\n');
for (const piece of ['Boulevard', 'FountainPlaza']) {
  const set = rows.filter((r) => r.piece === piece);
  const base = set.find((r) => r.theme === 'default');
  note(`  ${piece}`);
  note('    theme            meshes    Δ     tris      Δ  lgt  plan-print  geom-print  planted');
  for (const r of set) {
    const dm = r.meshes - base.meshes;
    const dt = r.tris - base.tris;
    const d = (n) => (n === 0 ? '   0' : (n > 0 ? '+' : '') + n);
    note(
      `    ${r.theme.padEnd(16)}${String(r.meshes).padStart(6)} ${d(dm).padStart(5)} ${String(r.tris).padStart(7)} ${d(dt).padStart(6)} ${String(
        r.lights,
      ).padStart(4)}  ${r.plan.slice(0, 10)}  ${r.geom.slice(0, 10)}  ${String(r.plantedN).padStart(3)}`,
    );
  }
  // DISTINCTNESS: two themes sharing a geometry print are the same piece in
  // different paint, which is exactly the defect this work exists to remove.
  const seen = new Map();
  for (const r of set) {
    if (seen.has(r.geom)) {
      note(`    FAIL  ${r.theme} and ${seen.get(r.geom)} have IDENTICAL geometry (${r.geom})`);
      fail += 1;
    } else seen.set(r.geom, r.theme);
  }
  note('');
}

// determinism
for (const r of rows) {
  if (r.plan !== r.planRepeat || r.geom !== r.geomRepeat) {
    note(`  FAIL  ${r.piece}/${r.theme} is NOT deterministic across two builds in one process`);
    fail += 1;
  }
}
note(`  determinism: ${rows.length} piece×theme builds, plan+geometry prints reproduced`);

if (BASELINE) {
  const old = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const keyOf = (r) => `${r.piece}/${r.theme}`;
  const map = new Map(old.map((r) => [keyOf(r), r]));
  let checked = 0;
  let planChecked = 0;
  for (const r of rows) {
    const o = map.get(keyOf(r));
    if (!o) {
      note(`  FAIL  baseline has no row for ${keyOf(r)}`);
      fail += 1;
      continue;
    }
    // THE PLAN IS PINNED FOR EVERY THEME, not just the default one. The
    // structural dress is derived at MOUNT time and adds no plan fields, so a
    // themed plan's ports, sub-net, footprint, keepDry cells, solids and `key`
    // must still hash to exactly what they hashed to before — that is what park
    // layouts and seed tables read.
    for (const f of ['planKey', 'plan']) {
      if (JSON.stringify(r[f]) !== JSON.stringify(o[f])) {
        note(`  FAIL  ${keyOf(r)} ${f}: ${JSON.stringify(o[f])} -> ${JSON.stringify(r[f])}`);
        fail += 1;
      }
    }
    planChecked += 1;
    if (r.theme !== 'default') continue; // geometry may only move OFF the default
    checked += 1;
    for (const f of ['meshes', 'tris', 'lights', 'geom', 'planted', 'blockers']) {
      if (JSON.stringify(r[f]) !== JSON.stringify(o[f])) {
        note(`  FAIL  ${keyOf(r)} ${f}: ${JSON.stringify(o[f])} -> ${JSON.stringify(r[f])}`);
        fail += 1;
      }
    }
  }
  note(`  plan pinned for all ${planChecked} piece x theme rows; default-path geometry pinned for ${checked} piece(s) (${path.basename(BASELINE)})`);
}

note(fail ? `\n  ${fail} FAILURE(S)\n` : '\n  all checks passed\n');
process.exit(fail ? 1 : 0);
