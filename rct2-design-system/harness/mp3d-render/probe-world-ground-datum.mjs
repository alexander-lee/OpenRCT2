#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-world-ground-datum.mjs — WHERE DOES <WorldGround> ACTUALLY LAND?
//
// `shot-world-ground.mjs` photographs `buildWorldGroundScene` DIRECTLY: it
// does `scene.add(built.group)`, so the builder's group sits at the scene
// origin. Inside a real <Park> the group is mounted by `useComposable`, which
// does
//
//     const y = yOf(pos) ?? park.floorAt(x, z);
//     g.position.set(x, y, z);
//
// so a 2-tuple `position` SETTLES the group onto the terrain. The builder
// meanwhile emits vertex y in ABSOLUTE world height (`floorAt(x, z) - 0.04`)
// while emitting x/z RELATIVE to the rect centre — a mixed frame. In the
// harness the settle is 0 and the mix is invisible; in a park the whole floor
// is lifted by `floorAt(centre)`.
//
// This probe measures that, in a REAL park, through the REAL mount path:
// mounts a sample, finds every group tagged `dsComponent === 'WorldGround'`,
// and reports its mount y (= the lift) against the rendered path pavement top.
//
//   node probe-world-ground-datum.mjs [../park-eval/samples/w33a.tsx]
// ---------------------------------------------------------------------------
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleParkPage, openParkPage } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(HERE, process.argv[2] ?? '../park-eval/samples/w33a.tsx');
const NAME = `wgdatum-${path.basename(SAMPLE, '.tsx')}`;

const html = await bundleParkPage(SAMPLE, NAME);
const { browser, page, lines } = await openParkPage(html, { waitMs: 240000 });

const out = await page.evaluate(() => {
  const api = document.querySelector('canvas')?.__stageApi;
  if (!api) return { error: 'no __stageApi — the park never mounted' };
  const THREE = window.__THREE;
  const box = new THREE.Box3();
  const v = new THREE.Vector3();

  const grounds = [];
  api.scene.traverse((o) => {
    if (o.userData?.dsComponent === 'WorldGround') grounds.push(o);
  });

  const rows = grounds.map((g) => {
    // the wrapper useComposable put around the builder's group
    const wrap = g.parent;
    // local vertex y range inside the builder's own frame
    let lo = Infinity;
    let hi = -Infinity;
    g.traverse((o) => {
      const p = o.geometry?.getAttribute?.('position');
      if (!p) return;
      for (let i = 0; i < p.count; i += 1) {
        const y = p.getY(i);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    });
    box.setFromObject(g);
    g.getWorldPosition(v);
    return {
      key: g.userData.dsWorldKey,
      // what useComposable settled the group to: this IS park.floorAt(cx, cz)
      mountY: +(wrap?.position?.y ?? 0).toFixed(4),
      mountXZ: [+(wrap?.position?.x ?? 0).toFixed(2), +(wrap?.position?.z ?? 0).toFixed(2)],
      // the builder's own y output = floorAt(x, z) - TOP_CLEARANCE + jitter
      localY: [+lo.toFixed(4), +hi.toFixed(4)],
      // where the floor ACTUALLY ends up in the world
      worldY: [+box.min.y.toFixed(4), +box.max.y.toFixed(4)],
    };
  });

  // ---- IS THE FLOOR EVEN VISIBLE? ----------------------------------------
  //
  // A floor draped UNDER the terrain SURFACE is occluded by the terrain and the
  // whole component does nothing — the failure mode on the other side of the one
  // that buries paths. So measure the drape against the terrain MESH, not against
  // `groundAt`: the mesh is a 0.45 u chord approximation of the heightfield and
  // the drape is a 1.2 u one, so the two disagree by the difference of their sags
  // even though both interpolate the same `heightAt`. That disagreement is what
  // sizes the clearance constant, and it can only be measured, not derived.
  const isWG = (o) => {
    for (let p = o; p; p = p.parent) if (p.userData?.dsComponent === 'WorldGround') return true;
    return false;
  };
  // The terrain: the non-WorldGround mesh with the MOST vertices. Not the widest
  // — that is `buildSurround`'s distant-ridge apron (span 469 u at size 128), a
  // ring with no geometry over the plot at all, so every ray missed it and the
  // first version of this probe reported 0 samples. The plot heightfield is
  // seg = min(size*6.9, max(220, size/0.45)) per side, so 285² = 81 225 vertices
  // at size 128 and nothing else in the park comes close.
  let terrain = null;
  let bestVerts = 0;
  api.scene.traverse((o) => {
    if (!o.isMesh || isWG(o)) return;
    const n = o.geometry?.getAttribute?.('position')?.count ?? 0;
    if (n > bestVerts) {
      bestVerts = n;
      terrain = o;
    }
  });
  box.setFromObject(terrain);
  const bestArea = (box.max.x - box.min.x) * (box.max.z - box.min.z);

  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const vis = rows.map((r, k) => {
    const g = grounds[k];
    const wrap = g.parent;
    box.setFromObject(g);
    const cx = wrap.position.x;
    const cz = wrap.position.z;
    const ex = (box.max.x - box.min.x) / 2;
    const ez = (box.max.z - box.min.z) / 2;
    const deltas = [];
    const N = 19; // 361 samples per rect — enough to see the tail, not the mean
    for (let i = 0; i < N; i += 1)
      for (let j = 0; j < N; j += 1) {
        const x = cx + ((i / (N - 1)) * 2 - 1) * ex * 0.98;
        const z = cz + ((j / (N - 1)) * 2 - 1) * ez * 0.98;
        const from = new THREE.Vector3(x, 200, z);
        ray.set(from, down);
        const wgHit = ray.intersectObject(g, true)[0];
        ray.set(from, down);
        const tHit = terrain ? ray.intersectObject(terrain, true)[0] : null;
        if (!wgHit || !tHit) continue;
        deltas.push(wgHit.point.y - tHit.point.y);
      }
    deltas.sort((a, b) => a - b);
    const at = (q) => (deltas.length ? +deltas[Math.min(deltas.length - 1, Math.round(q * (deltas.length - 1)))].toFixed(4) : null);
    return {
      key: r.key.slice(2, 24),
      samples: deltas.length,
      // floor MINUS terrain, so positive = the floor shows, negative = buried
      dMin: at(0),
      dP05: at(0.05),
      dMedian: at(0.5),
      dP95: at(0.95),
      dMax: at(1),
      buried: deltas.filter((d) => d <= 0).length,
    };
  });

  const rep = window.__parkReport ?? null;
  return {
    rows,
    vis,
    terrain: { verts: bestVerts, span: +Math.sqrt(bestArea).toFixed(1) },
    pathY: rep?.pathY ?? null,
  };
});

console.log('[wg-datum]', JSON.stringify(out, null, 2));
for (const l of lines.filter((l) => /WorldGround|validatePark →/.test(l))) console.log(l);
await browser.close();
