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

  // the rendered pavement, for the comparison that matters. Every path slab in
  // the network is a merged box under a mesh whose material name/geometry we
  // cannot name, so bound the whole park's non-ground geometry that lies near
  // y ~ 0 instead: use the report's own path datum when present.
  const rep = window.__parkReport ?? null;
  return { rows, pathY: rep?.pathY ?? null, report: rep ? Object.keys(rep).length : 0 };
});

console.log('[wg-datum]', JSON.stringify(out, null, 2));
for (const l of lines.filter((l) => /WorldGround|validatePark →/.test(l))) console.log(l);
await browser.close();
