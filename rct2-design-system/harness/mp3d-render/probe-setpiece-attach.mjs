#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-setpiece-attach.mjs — DOES ANY PART OF A THEMED SET-PIECE FLOAT?
//
// The themed dress adds real structure to Boulevard and FountainPlaza: light
// standards with hanging lanterns, spans, kerb runs, plaza parapets and a
// four-legged armature straddling the fountain. Every one of those is a chance
// to repeat the class of defect `probe-scenery-attach.mjs` was written for — a
// part placed in the wrong frame, hanging a hand off a wrist. Writing the
// centrepieces turned up FIVE of them by measurement before any render:
//
//   * Tidewater's mast ran from y 0 straight down through the fountain basin
//   * Brasswork's gear ring (inner edge r 0.365) orbited a hub of r 0.2
//   * Brasswork's pressure gauge sat on a diagonal where no arch runs
//   * Thornwick scattered 8 foliage clumps on an even ring; the 4 on the
//     diagonals had no bough within reach
//   * Pulse hung its mirror ball off the middle of a frame with no member there
//
// METHOD — the same one probe-scenery-attach settled on, and for the same
// reasons: exact point-to-TRIANGLE distance (never AABB overlap, which calls a
// detached hand attached), a ray-PARITY inside test so a part buried within
// another counts as attached, and barycentric subdivision so contact anywhere
// on a face is seen rather than only at vertices.
//
// WHERE IT DIFFERS: a set-piece is a hundred-odd INDEPENDENT objects spread
// over 17 units, almost all of which legitimately stand on the ground. So this
// probe grounds every mesh that reaches grade first and then only pays for the
// exact test on the AIRBORNE ones, growing the attached set until it stops
// changing. That makes a 150-mesh piece tractable, and it asks the question the
// defects above actually answer: is this part held up by anything?
//
//   node probe-setpiece-attach.mjs [--tol=0.012] [--theme=fire] [--json]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const TOL = Number(arg('tol', 0.012));
const ONLY = arg('theme', null);
const SRC = path.resolve(arg('src', path.join(REPO, 'components')));
const GROUND = 0.06; // a part whose lowest point is this close to grade is planted
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, '_spattach-entry.ts');
fs.writeFileSync(
  entry,
  `export { boulevardPlan, buildBoulevardScene } from ${JSON.stringify(path.join(SRC, 'Boulevard/index.tsx'))};
export { fountainPlazaPlan, buildFountainPlazaScene } from ${JSON.stringify(path.join(SRC, 'FountainPlaza/index.tsx'))};
export { WORLD_THEMES, THEME_IDS } from ${JSON.stringify(path.join(SRC, 'SetPieceKit/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_spattach-bundle.mjs');
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

// ---- exact point-to-triangle distance (Ericson, Real-Time Collision Detection)
function ptTri(p, a, b, c) {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const ap = p.clone().sub(a);
  const d1 = ab.dot(ap);
  const d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return ap.length();
  const bp = p.clone().sub(b);
  const d3 = ab.dot(bp);
  const d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return bp.length();
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return ap.clone().sub(ab.clone().multiplyScalar(d1 / (d1 - d3))).length();
  const cp = p.clone().sub(c);
  const d5 = ab.dot(cp);
  const d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return cp.length();
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return ap.clone().sub(ac.clone().multiplyScalar(d2 / (d2 - d6))).length();
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return bp.clone().sub(c.clone().sub(b).multiplyScalar(w)).length();
  }
  const denom = 1 / (va + vb + vc);
  return ap.clone().sub(ab.multiplyScalar(vb * denom)).sub(ac.multiplyScalar(vc * denom)).length();
}

/** Möller–Trumbore, used for ray PARITY so back faces count too */
function rayHits(o, d, tris) {
  let hits = 0;
  for (const tri of tris) {
    const { a, b, c } = tri;
    const e1 = b.clone().sub(a);
    const e2 = c.clone().sub(a);
    const pv = d.clone().cross(e2);
    const det = e1.dot(pv);
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const tv = o.clone().sub(a);
    const u = tv.dot(pv) * inv;
    if (u < 0 || u > 1) continue;
    const qv = tv.clone().cross(e1);
    const v = d.dot(qv) * inv;
    if (v < 0 || u + v > 1) continue;
    if (e2.dot(qv) * inv > 1e-9) hits += 1;
  }
  return hits;
}
const RAY = new T.Vector3(0.5773, 0.5566, 0.5972);
const inside = (p, tris) => rayHits(p, RAY, tris) % 2 === 1;

/**
 * World triangles for one mesh, each with its own AABB, built ON DEMAND.
 *
 * WHY THE PER-TRIANGLE BOXES: a themed plaza's paving is ONE merged mesh of
 * ~3000 triangles, and the naive form of this probe (harvest every mesh's
 * subdivided point cloud, then compare every point against every triangle) is
 * ~1e8 distance evaluations per PAIR. The first version of this file did not
 * finish in four minutes. Filtering B's triangles by A's own box first drops
 * that to the handful of triangles actually near A, and the exactness of the
 * verdict is untouched — boxes prune, they never decide.
 */
function tris(mesh) {
  const g = mesh.geometry;
  const pa = g.getAttribute('position');
  const idx = g.index;
  const n = idx ? idx.count : pa.count;
  const out = [];
  const v = new T.Vector3();
  const get = (i) => {
    const j = idx ? idx.getX(i) : i;
    return v.fromBufferAttribute(pa, j).clone().applyMatrix4(mesh.matrixWorld);
  };
  for (let i = 0; i + 2 < n; i += 3) {
    const a = get(i);
    const b = get(i + 1);
    const c = get(i + 2);
    out.push({ a, b, c, box: new T.Box3().setFromPoints([a, b, c]) });
  }
  return out;
}

/**
 * SPLIT A MESH INTO ITS CONNECTED COMPONENTS — and this is the thing that makes
 * the probe worth running on THIS work at all.
 *
 * Every themed part here is batched through `mergedBoxes` / `mergedParts` for
 * draw-call reasons, which means a lamp's post, its cage and its base are ONE
 * mesh. A per-MESH attachment test is therefore blind to exactly the defect
 * being hunted: put one box of a 20-box batch in the wrong frame and the mesh
 * as a whole still reaches the ground, so it reads attached. Thornwick's four
 * floating foliage clumps lived inside a single merged mesh.
 *
 * Triangles are unioned when they share a vertex POSITION (quantized to 0.1 mm
 * — merged geometry does not share indices across parts, so index adjacency
 * would split every box into 12 loose triangles).
 */
function components(mesh) {
  const all = tris(mesh);
  const up = all.map((_, i) => i);
  const find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
  const join = (x, y) => {
    const a = find(x);
    const b = find(y);
    if (a !== b) up[a] = b;
  };
  const seen = new Map();
  const key = (p) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
  all.forEach((tr, i) => {
    for (const p of [tr.a, tr.b, tr.c]) {
      const k = key(p);
      if (seen.has(k)) join(i, seen.get(k));
      else seen.set(k, i);
    }
  });
  const groups = new Map();
  all.forEach((tr, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(tr);
  });
  return [...groups.values()].map((list) => {
    const box = new T.Box3();
    list.forEach((tr) => box.union(tr.box));
    // the MATERIAL COLOUR travels with the part: a bare separation number is
    // not actionable, and "#8cf0c0, 180 tris" names a witch-light globe in one
    // line where coordinates alone cost a round of guessing
    const col = mesh.material && mesh.material.color ? `#${mesh.material.color.getHexString()}` : '?';
    return { tris: list, box, col, emissive: !!(mesh.material && mesh.material.emissiveIntensity > 0.02) };
  });
}

/** subdivided sample points for one mesh — vertices plus a barycentric grid, so
 *  contact anywhere on a FACE is seen and not only at a corner (the sparse-
 *  sampling false positive that reported a wishing well's axle as detached) */
function samples(triList) {
  const pts = [];
  for (const { a, b, c } of triList) {
    const e = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const k = Math.min(8, Math.max(1, Math.ceil(e / 0.05)));
    for (let s = 0; s <= k; s += 1) {
      for (let t2 = 0; t2 + s <= k; t2 += 1) {
        const w0 = 1 - (s + t2) / k;
        pts.push(new T.Vector3(a.x * w0 + b.x * (s / k) + c.x * (t2 / k), a.y * w0 + b.y * (s / k) + c.y * (t2 / k), a.z * w0 + b.z * (s / k) + c.z * (t2 / k)));
      }
    }
  }
  return pts;
}

/** shortest exact surface distance from a point set to a triangle set */
function minDist(pts, triList, tol) {
  let best = Infinity;
  for (const p of pts) {
    for (const tr of triList) {
      // per-triangle box: the point cannot be nearer than its distance to the box
      if (tr.box.distanceToPoint(p) >= best) continue;
      const d = ptTri(p, tr.a, tr.b, tr.c);
      if (d < best) best = d;
      if (best <= tol) return best;
    }
  }
  return best;
}
/** a part buried wholly INSIDE another is attached, not floating (a lantern's
 *  chain end inside the yard, a span's wire end inside a lamp head) */
function engulfed(pts, triList) {
  const step = Math.max(1, Math.floor(pts.length / 12));
  for (let i = 0; i < pts.length; i += step) if (inside(pts[i], triList)) return true;
  return false;
}

const CASES = [
  { piece: 'Boulevard', plan: (th) => K.boulevardPlan({ id: 'ave', from: [0, -8.4], to: [0, 8.4], seed: 4, theme: th }), build: K.buildBoulevardScene },
  { piece: 'FountainPlaza', plan: (th) => K.fountainPlazaPlan({ id: 'hub', position: [0, 0], tiles: 7, seed: 1, theme: th }), build: K.buildFountainPlazaScene },
];
const themes = (ONLY ? [ONLY] : ['default', ...K.THEME_IDS]).map((id) => [id, id === 'default' ? undefined : K.WORLD_THEMES[id]]);

const stubPark = { floorAt: () => 0, registerPlanted: () => () => {}, registerBlocker: () => () => {}, registerFootprint: () => () => {}, registerWorld: () => () => {}, _previewHost: true };

const quiet = console.warn;
const rows = [];
for (const c of CASES) {
  for (const [tid, theme] of themes) {
    console.warn = () => {};
    const built = c.build(T, c.plan(theme), stubPark);
    built.update?.(3.7); // never grade the rest pose
    console.warn = quiet;
    built.group.updateMatrixWorld(true);
    let meshCount = 0;
    let rolled = 0;
    const parts = [];
    const one = (mesh) => {
      meshCount += 1;
      mesh.geometry.computeBoundingBox(); // cached boxes go stale on rebuilt geometry
      return components(mesh);
    };
    /**
     * AN IMPORTED CATALOG PIECE IS ONE OBJECT HERE. `giantToadstools` and
     * friends are separate components with their own attachment audit, and
     * their scattered spore litter legitimately sits 0.06-0.09 above grade —
     * grading their internals here would report another component's business as
     * this set-piece's failure, forty separations at a time. What IS still
     * graded is the piece as a whole: it must reach the ground.
     */
    const rollUp = (root, label) => {
      const box = new T.Box3();
      const tri = [];
      let n = 0;
      root.traverse((o) => {
        if (!o.isMesh) return;
        for (const cmp of one(o)) {
          box.union(cmp.box);
          tri.push(...cmp.tris);
          n += 1;
        }
      });
      rolled += n;
      if (tri.length) parts.push({ tris: tri, box, label, col: `imported` });
    };
    const walk = (o) => {
      if (o.userData && o.userData.importedPiece) {
        rollUp(o, o.userData.importedPiece);
        return; // its children are its own component's business
      }
      if (o.isMesh) parts.push(...one(o));
      o.children.forEach(walk);
    };
    walk(built.group);
    const meshes = parts;
    const boxes = parts.map((p) => p.box);
    const attached = meshes.map((_, i) => boxes[i].min.y <= GROUND);
    // HOW MUCH DID THIS RUN ACTUALLY TEST? Almost everything a set-piece mounts
    // stands on the ground, and a run in which NOTHING was airborne would pass
    // without evaluating one exact distance — a green light over an empty set,
    // which is the failure mode that let the guest-click bug survive twice. So
    // the airborne count is reported and an empty one is itself a FAILURE.
    const airborne = attached.filter((a) => !a).length;
    const ptCache = new Map();
    const triOf = (i) => parts[i].tris;
    const ptsOf = (i) => {
      if (!ptCache.has(i)) ptCache.set(i, samples(triOf(i)));
      return ptCache.get(i);
    };
    /** B's triangles that could possibly be within `pad` of A's box */
    const near = (j, box, pad) => {
      const eb = box.clone().expandByScalar(pad);
      return triOf(j).filter((tr) => eb.intersectsBox(tr.box));
    };
    const touching = (i, j, tol) => {
      const bi = near(j, boxes[i], tol);
      if (!bi.length) return false;
      if (minDist(ptsOf(i), bi, tol) <= tol) return true;
      // and the other way round: a thin plate's own samples may all miss a
      // narrow post that its faces nonetheless touch
      const bj = near(i, boxes[j], tol);
      if (bj.length && minDist(samples(bj), triOf(i), tol) <= tol) return true;
      return engulfed(ptsOf(i), triOf(j));
    };
    // grow the attached set until it stops changing
    const eb = new T.Box3();
    for (let pass = 0; pass < 8; pass += 1) {
      let grew = false;
      for (let i = 0; i < meshes.length; i += 1) {
        if (attached[i]) continue;
        for (let j = 0; j < meshes.length; j += 1) {
          if (i === j || !attached[j]) continue;
          eb.copy(boxes[i]).expandByScalar(TOL);
          if (!eb.intersectsBox(boxes[j])) continue; // provably further than TOL
          if (touching(i, j, TOL)) {
            attached[i] = true;
            grew = true;
            break;
          }
        }
      }
      if (!grew) break;
    }
    // report each survivor with its ACTUAL separation, not a bare verdict:
    // 0.058 is a hand off a wrist, 0.002 is a tolerance argument
    const loose = [];
    for (let i = 0; i < meshes.length; i += 1) {
      if (attached[i]) continue;
      let sep = Infinity;
      for (let j = 0; j < meshes.length; j += 1) {
        if (i === j) continue;
        eb.copy(boxes[i]).expandByScalar(0.6);
        if (!eb.intersectsBox(boxes[j])) continue;
        sep = Math.min(sep, minDist(ptsOf(i), near(j, boxes[i], 0.6), sep));
      }
      const b = boxes[i];
      const ctr = b.getCenter(new T.Vector3());
      loose.push({
        tris: triOf(i).length,
        col: parts[i].col ?? '?',
        label: parts[i].label ?? '',
        at: [+ctr.x.toFixed(2), +ctr.y.toFixed(2), +ctr.z.toFixed(2)],
        lowest: +b.min.y.toFixed(3),
        sep: Number.isFinite(sep) ? +sep.toFixed(3) : null,
      });
    }
    rows.push({ piece: c.piece, theme: tid, meshCount, parts: parts.length, rolled, airborne, loose });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(rows.some((r) => r.loose.length) ? 1 : 0);
}

console.log(`\n  probe-setpiece-attach · tol ${TOL}, grade ${GROUND}\n`);
const MIN_AIRBORNE = 6; // lanterns, span bulbs, hanging globes: every build has some
let bad = 0;
for (const r of rows) {
  const tag = `${r.piece}/${r.theme}`;
  if (r.loose.length) {
    bad += 1;
    console.log(`  FAIL  ${tag}`.padEnd(38) + `${r.meshCount} meshes / ${r.parts} parts, ${r.airborne} airborne — ${r.loose.length} UNSUPPORTED`);
    r.loose.forEach((l) =>
      console.log(
        `          ${String(l.tris).padStart(5)} tris ${l.col.padEnd(8)}${l.label ? `[${l.label}] ` : ''}centred (${l.at.join(', ')}), lowest y ${l.lowest}, nearest surface ${
          l.sep === null ? '>0.6' : l.sep
        } away`,
      ),
    );
  } else if (r.airborne < MIN_AIRBORNE) {
    bad += 1;
    console.log(`  FAIL  ${tag}`.padEnd(38) + `only ${r.airborne} of ${r.parts} parts left the ground — this run tested almost nothing`);
  } else
    console.log(
      `  ok    ${tag}`.padEnd(38) +
        `${String(r.meshCount).padStart(3)} meshes / ${String(r.parts).padStart(4)} parts, ${String(r.airborne).padStart(4)} airborne and every one supported` +
          (r.rolled ? ` (+${r.rolled} inside imported pieces, graded as one)` : ''),
    );
}
console.log(`\n  ${rows.length - bad}/${rows.length} piece x theme builds fully supported\n`);
process.exit(bad ? 1 : 0);
