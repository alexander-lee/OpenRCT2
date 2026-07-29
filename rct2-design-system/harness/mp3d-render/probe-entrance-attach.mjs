#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-entrance-attach.mjs — ParkEntrance: IS EVERY PART ATTACHED, AND IS THE
// ARCH STILL WALKABLE?
//
// Adapted from probe-scenery-attach.mjs (same three geometric kernels, and for
// the same three reasons):
//   * exact POINT-TO-TRIANGLE distance, not AABB overlap. marbleStatue's
//     detached hand had a bounding box that overlapped its arm's, so a box test
//     called it attached. Boxes are used ONLY to prune pairs that provably
//     cannot be within tolerance.
//   * a ray-PARITY containment test. A part buried entirely INSIDE another is
//     attached, not floating (a lantern glass ball inside its drop cap, a quoin
//     inside a shaft).
//   * BARYCENTRIC SUBDIVISION of every triangle. ParkEntrance is built almost
//     entirely from long thin slabs that interpenetrate away from their end
//     caps — the beam passes clean THROUGH both towers, so vertices+centroids
//     alone put no sample near the contact and a solid gate reports as rubble.
//
// ParkEntrance-specific additions, because this component has a CONTRACT the
// scenery pack does not:
//   * a MIRRORED-PAIR-AWARE grade rule. The gate stands on grade, so almost
//     everything is joined through the ground; that would make the attachment
//     test vacuous. So grade attachment is DISABLED by default (--grade=off):
//     every part must reach its actual masonry support.
//   * a GUEST CORRIDOR clearance sweep. `archway` must stay walkable and
//     `spawnPoint` must stay clear: no geometry may enter the box
//     x ±W/2, y 0.06…CH, z −0.45…spawn+0.25, nor the spawn cylinder.
//   * runs at SEVERAL WIDTHS (1.6 default, 2.4) — the whole point of `width` is
//     that the arch widens correctly, and detail pinned to a hard-coded x slides
//     off the tower when W changes.
//
//   node probe-entrance-attach.mjs [--tol=0.01] [--widths=1.6,2.4]
//                                  [--grade=off|on] [--ch=1.0]
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
const TOL = Number(arg('tol', 0.01));
const WIDTHS = arg('widths', '1.6,2.4').split(',').map(Number);
const GRADE_ON = arg('grade', 'off') === 'on';
const GROUND = 0.06;
const CH = Number(arg('ch', 1.0)); // guest corridor headroom (peep top at GUEST_SCALE ≈ 0.85)
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, '_entrance-attach-entry.ts');
fs.writeFileSync(
  entry,
  `export { buildParkEntrance } from ${JSON.stringify(path.join(REPO, 'components/ParkEntrance/index.tsx'))};
export { buildPeep } from ${JSON.stringify(path.join(REPO, 'components/Guest/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_entrance-attach-bundle.mjs');
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
const ctx2d = new Proxy(
  { measureText: () => ({ width: 0 }) },
  { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}), set: () => true },
);
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
  const v = vb * denom;
  const w = vc * denom;
  return ap.clone().sub(ab.multiplyScalar(v)).sub(ac.multiplyScalar(w)).length();
}

/** Möller–Trumbore; used for ray PARITY, so back faces count too */
function rayHits(ox, oy, oz, dx, dy, dz, tris) {
  let hits = 0;
  for (const t of tris) {
    const [a, b, c] = t;
    const e1x = b.x - a.x;
    const e1y = b.y - a.y;
    const e1z = b.z - a.z;
    const e2x = c.x - a.x;
    const e2y = c.y - a.y;
    const e2z = c.z - a.z;
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const tx = ox - a.x;
    const ty = oy - a.y;
    const tz = oz - a.z;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    if ((e2x * qx + e2y * qy + e2z * qz) * inv > 1e-9) hits += 1;
  }
  return hits;
}
const inside = (p, tris) => rayHits(p.x, p.y, p.z, 0.5773, 0.5566, 0.5972, tris) % 2 === 1;

/** subdivided sample points + AABB + name for a list of world-space triangles */
function pack(tris, label) {
  const pts = [];
  for (const [a, b, c] of tris) {
    const e = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const k = Math.min(12, Math.max(1, Math.ceil(e / 0.03)));
    for (let s = 0; s <= k; s++) {
      for (let t2 = 0; t2 + s <= k; t2++) {
        const w0 = 1 - (s + t2) / k;
        const w1 = s / k;
        const w2 = t2 / k;
        pts.push(
          new T.Vector3(a.x * w0 + b.x * w1 + c.x * w2, a.y * w0 + b.y * w1 + c.y * w2, a.z * w0 + b.z * w1 + c.z * w2),
        );
      }
    }
  }
  const box = new T.Box3().setFromPoints(pts);
  const c = box.getCenter(new T.Vector3());
  return { tris, pts, box, name: `${label}@(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)})`, tricount: tris.length };
}

/**
 * world-space triangles of one mesh, SPLIT INTO ITS ORIGINAL PARTS.
 *
 * WHY THIS EXISTS: ParkEntrance's detail is batched through `mergedBoxes` /
 * `mergedParts`, which collapse dozens of boxes into ONE mesh. A per-MESH
 * attachment test would then be blind to exactly the defect it is for — a hip
 * cap or a spear finial floating INSIDE a merged batch is, to a mesh-level
 * test, part of a mesh that is obviously attached. So each geometry is
 * decomposed into connected components by SHARED VERTEX POSITION (quantised):
 * every box, cylinder and sphere contributes its own vertices, and two boxes
 * that merely interpenetrate share none, so this recovers the parts exactly as
 * they were authored. Adjacent faces of one box DO share corner positions, so a
 * box stays a single part rather than six.
 */
function splitMesh(mesh, i, split) {
  const g = mesh.geometry;
  const pa = g.getAttribute('position');
  const idx = g.index;
  const n = idx ? idx.count : pa.count;
  const v = new T.Vector3();
  const world = [];
  for (let k = 0; k < pa.count; k++) world.push(v.fromBufferAttribute(pa, k).clone().applyMatrix4(mesh.matrixWorld));
  const label = `#${i}${mesh.name ? ':' + mesh.name : ''}`;
  const triIdx = [];
  for (let k = 0; k + 2 < n; k += 3) triIdx.push(idx ? [idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)] : [k, k + 1, k + 2]);
  if (!split) return [pack(triIdx.map((t3) => t3.map((j) => world[j])), label)];

  // union-find over VERTEX slots, joined when two slots hold the same position
  const key = (p) => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`;
  const up = world.map((_, k) => k);
  const find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) up[ra] = rb;
  };
  const seen = new Map();
  world.forEach((p, k) => {
    const kk = key(p);
    if (seen.has(kk)) join(k, seen.get(kk));
    else seen.set(kk, k);
  });
  for (const [a, b, c] of triIdx) {
    join(a, b);
    join(b, c);
  }
  const groups = new Map();
  for (const t3 of triIdx) {
    const r = find(t3[0]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(t3.map((j) => world[j]));
  }
  const out = [];
  let sub = 0;
  for (const tris of groups.values()) out.push(pack(tris, groups.size > 1 ? `${label}.${sub++}` : label));
  return out;
}

function minDist(A, B, tol) {
  let best = Infinity;
  for (const p of A.pts) {
    for (const t of B.tris) {
      const d = ptTri(p, t[0], t[1], t[2]);
      if (d < best) best = d;
      if (best <= tol) return best;
    }
  }
  return best;
}
function engulfed(A, B) {
  const step = Math.max(1, Math.floor(A.pts.length / 24));
  for (let i = 0; i < A.pts.length; i += step) if (inside(A.pts[i], B.tris)) return true;
  return false;
}

let bad = 0;
console.log(`\n  probe-entrance-attach · ParkEntrance\n  tol ${TOL}, grade ${GRADE_ON ? `on (${GROUND})` : 'OFF — every part must reach masonry'}, corridor headroom ${CH}\n`);

for (const W of WIDTHS) {
  const built = K.buildParkEntrance(T, { width: W });
  const g = built.group;
  g.updateMatrixWorld(true);
  const meshes = [];
  g.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const SPLIT = arg('split', 'on') !== 'off';
  const parts = meshes.flatMap((m, i) => splitMesh(m, i, SPLIT));
  const N = parts.length;
  const tris = parts.reduce((s, p) => s + p.tricount, 0);

  // ---- attachment: union-find over surface contact ------------------------
  const up = Array.from({ length: N + 1 }, (_, i) => i);
  const find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) up[ra] = rb;
  };
  // node N is the ROOT BODY. With grade off, seed it from the two tower
  // plinths + the threshold slab (the parts that genuinely stand on the
  // ground) rather than from "anything low", so a detail that happens to hang
  // down to grade is not excused.
  if (GRADE_ON) {
    for (let i = 0; i < N; i++) if (parts[i].box.min.y <= GROUND) join(i, N);
  } else {
    let seeded = 0;
    for (let i = 0; i < N; i++) {
      const b = parts[i].box;
      if (b.min.y <= 0.001 && b.max.y <= 0.2 && b.max.x - b.min.x > 0.3) {
        join(i, N);
        seeded += 1;
      }
    }
    if (!seeded) throw new Error('no grade-seated slab found to seed the root body');
  }
  const eb = new T.Box3();
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (find(i) === find(j)) continue;
      eb.copy(parts[i].box).expandByScalar(TOL);
      if (!eb.intersectsBox(parts[j].box)) continue;
      if (
        minDist(parts[i], parts[j], TOL) <= TOL ||
        minDist(parts[j], parts[i], TOL) <= TOL ||
        engulfed(parts[i], parts[j]) ||
        engulfed(parts[j], parts[i])
      )
        join(i, j);
    }
  }
  // grade-off leaves the two towers as separate bodies only if the beam does
  // not bridge them; it does, so one root is expected. Re-run the join loop
  // until stable (transitive contact discovered late can merge bodies).
  for (let pass = 0; pass < 3; pass++) {
    let merged = false;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (find(i) === find(j)) continue;
        eb.copy(parts[i].box).expandByScalar(TOL);
        if (!eb.intersectsBox(parts[j].box)) continue;
        if (
          minDist(parts[i], parts[j], TOL) <= TOL ||
          minDist(parts[j], parts[i], TOL) <= TOL ||
          engulfed(parts[i], parts[j]) ||
          engulfed(parts[j], parts[i])
        ) {
          join(i, j);
          merged = true;
        }
      }
    }
    if (!merged) break;
  }
  const roots = new Map();
  for (let i = 0; i < N; i++) {
    const r = find(i);
    if (!roots.has(r)) roots.set(r, []);
    roots.get(r).push(i);
  }
  const mainRoot = find(N);
  const loose = [];
  for (const [r, members] of roots) {
    if (r === mainRoot) continue;
    const b = new T.Box3();
    members.forEach((m) => b.union(parts[m].box));
    const c = b.getCenter(new T.Vector3());
    let sep = Infinity;
    for (const m of members) {
      for (let o = 0; o < N; o++) {
        if (find(o) !== mainRoot) continue;
        eb.copy(parts[m].box).expandByScalar(0.5);
        if (!eb.intersectsBox(parts[o].box)) continue;
        sep = Math.min(sep, minDist(parts[m], parts[o], 0), minDist(parts[o], parts[m], 0));
      }
    }
    loose.push({
      n: members.length,
      names: members.map((m) => parts[m].name).filter(Boolean),
      at: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)],
      sep,
    });
  }

  // ---- guest corridor + spawn clearance -----------------------------------
  const spawn = built.spawnPoint;
  const arch = built.archway;
  // The HARD corridor is inset by JAMB from the nominal opening, because the
  // baseline gate already lets its tower PLINTHS (0.86 plan on a 0.72 shaft,
  // so 0.07 proud) and its corner QUOINS (0.045 proud) stand inside x ±W/2.
  // Those are the tower, not obstructions — measured at baseline: plinth 0.070,
  // quoin 0.045. JAMB 0.12 clears both with margin and still guards the band a
  // guest actually walks in. The PINCH number below is the unfudged one.
  const JAMB = Number(arg('jamb', 0.12));
  const clearHalf = W / 2 - JAMB;
  const zLo = -0.45;
  const zHi = spawn[2] + 0.25;
  const corridor = new T.Box3(new T.Vector3(-clearHalf, GROUND, zLo), new T.Vector3(clearHalf, CH, zHi));
  const SPAWN_R = 0.22; // peep shoulder half-width at GUEST_SCALE, with margin
  const intruders = [];
  let worstMargin = Infinity; // smallest distance from a mesh to the corridor
  for (let i = 0; i < N; i++) {
    const p = parts[i];
    if (!p.box.intersectsBox(corridor)) {
      // record how close the nearest miss is, for a real clearance number
      const d = p.box.distanceToPoint(corridor.getCenter(new T.Vector3()));
      if (d < worstMargin) worstMargin = Math.min(worstMargin, d);
      continue;
    }
    // exact: any SAMPLE POINT of this mesh strictly inside the corridor?
    let deepest = 0;
    let where = null;
    for (const q of p.pts) {
      if (
        q.x > corridor.min.x + 1e-6 &&
        q.x < corridor.max.x - 1e-6 &&
        q.y > corridor.min.y + 1e-6 &&
        q.y < corridor.max.y - 1e-6 &&
        q.z > corridor.min.z + 1e-6 &&
        q.z < corridor.max.z - 1e-6
      ) {
        // depth = how far past the nearest corridor wall it reaches
        const d = Math.min(
          q.x - corridor.min.x,
          corridor.max.x - q.x,
          q.y - corridor.min.y,
          corridor.max.y - q.y,
          q.z - corridor.min.z,
          corridor.max.z - q.z,
        );
        if (d > deepest) {
          deepest = d;
          where = q;
        }
      }
    }
    if (deepest > 1e-4)
      intruders.push({
        name: p.name,
        depth: deepest,
        at: [+where.x.toFixed(3), +where.y.toFixed(3), +where.z.toFixed(3)],
      });
  }
  // HEADROOM — the lowest surface hanging over the clear footprint, and the
  // PINCH — the narrowest clear half-width across the opening at guest height.
  // Pinch is the metric that cannot be tuned by choosing a corridor: it is
  // simply min |x| over every sample inside the arch throat at 0.06 < y < CH,
  // so any new part that leans into the opening drives it down.
  let headroom = Infinity;
  let pinch = Infinity;
  let pinchAt = null;
  for (let i = 0; i < N; i++) {
    const p = parts[i];
    for (const q of p.pts) {
      if (q.z < zLo || q.z > zHi) continue;
      if (q.y > CH) {
        // `<=` with a 0.1 mm slack, not `<`: the arch haunches are authored to
        // land EXACTLY on the jamb line, and their vertices come back through a
        // Float32BufferAttribute, so the boundary face lands at 0.68000007
        // rather than 0.68. A strict test silently excused the lowest haunch
        // step and reported the step ABOVE it (1.185 instead of 1.120) — a
        // headroom number that flatters itself is worse than none.
        if (Math.abs(q.x) <= clearHalf + 1e-4) headroom = Math.min(headroom, q.y);
        continue;
      }
      if (q.y <= GROUND) continue; // the threshold slab is the floor, not an obstruction
      if (Math.abs(q.x) < pinch) {
        pinch = Math.abs(q.x);
        pinchAt = q;
      }
    }
  }
  // spawn cylinder
  let spawnClear = Infinity;
  let spawnHit = null;
  for (let i = 0; i < N; i++) {
    const p = parts[i];
    if (p.box.min.y > CH) continue;
    for (const q of p.pts) {
      if (q.y < GROUND || q.y > CH) continue;
      const d = Math.hypot(q.x - spawn[0], q.z - spawn[2]);
      if (d < spawnClear) {
        spawnClear = d;
        spawnHit = q;
      }
    }
  }

  const ok = !loose.length && !intruders.length && spawnClear >= SPAWN_R;
  if (!ok) bad += 1;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  width ${W.toFixed(2)}  ${meshes.length} meshes → ${N} parts (split ${SPLIT ? 'on' : 'off'}), ${tris} tris`,
  );
  if (loose.length) {
    console.log(`          ${loose.length} DETACHED group(s):`);
    loose.forEach((l) =>
      console.log(
        `            ${l.n} mesh(es)${l.names.length ? ` [${l.names.join(', ')}]` : ''} adrift, centred (${l.at.join(', ')}), nearest surface ${Number.isFinite(l.sep) ? l.sep.toFixed(4) : '>0.5'} away`,
      ),
    );
  } else {
    console.log(`          attachment: all ${N} parts reach the masonry body (no grade excuse)`);
  }
  if (intruders.length) {
    console.log(`          ${intruders.length} mesh(es) INTRUDE the guest corridor:`);
    intruders
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 8)
      .forEach((c) => console.log(`            ${c.name || 'mesh'} reaches ${c.depth.toFixed(3)} inside, at (${c.at.join(', ')})`));
  } else {
    console.log(
      `          corridor x ±${clearHalf.toFixed(3)} (opening ±${(W / 2).toFixed(2)} less jamb ${JAMB}), y ${GROUND}…${CH}, z ${zLo}…${zHi.toFixed(2)}: CLEAR`,
    );
  }
  console.log(
    `          headroom over the clear footprint: ${Number.isFinite(headroom) ? headroom.toFixed(3) : 'open sky'}  (need > ${CH})`,
  );
  console.log(
    `          PINCH — narrowest clear half-width at guest height: ${Number.isFinite(pinch) ? pinch.toFixed(3) : '∞'}${pinchAt ? ` at (${pinchAt.x.toFixed(3)}, ${pinchAt.y.toFixed(2)}, ${pinchAt.z.toFixed(2)})` : ''}  (nominal ${(W / 2).toFixed(2)})`,
  );
  console.log(
    `          spawnPoint (${spawn.join(', ')}) nearest geometry ${Number.isFinite(spawnClear) ? spawnClear.toFixed(3) : '∞'} away${spawnHit ? ` at (${spawnHit.x.toFixed(2)}, ${spawnHit.y.toFixed(2)}, ${spawnHit.z.toFixed(2)})` : ''}  (need ≥ ${SPAWN_R})`,
  );
  console.log(`          archway (${arch.join(', ')})`);
}
console.log('');
process.exit(bad ? 1 : 0);
