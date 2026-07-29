#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-monorail-station.mjs — a CLOSE-UP of one monorail platform's access rig.
//
// WHY NOT probe-exit-shot.mjs: that frames the union of a ride's footprints, and
// a park-spanning four-platform monorail's union IS the park — you get the whole
// plot at 200 u and cannot see whether the lift is standing in the queue lane.
// This aims at ONE platform's deck centre at a chosen radius.
//
//   node shot-monorail-station.mjs <park.tsx> [--at=x,z] [--dist=14] [--az=45]
//                                  [--el=26] [--out=x.png] [--ride="Name"]
//
// With no --at it uses the PRIMARY station's entrance hut, which is the thing
// under discussion.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage, sleep } from './evaltags.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const arg = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
if (!file) {
  console.error('usage: node shot-monorail-station.mjs <park.tsx> [--at=x,z] [--dist=14] [--az=45] [--el=26] [--out=x.png]');
  process.exit(1);
}
const name = path.basename(file).replace(/\.tsx$/, '');
const outPng = path.resolve(arg('out', path.join(HERE, 'shots', `mono-station-${name}.png`)));
fs.mkdirSync(path.dirname(outPng), { recursive: true });

const html = await bundleParkPage(file, `ms-${name}`);
const { browser, page } = await openParkPage(html, { waitMs: 90000, echo: false });
await sleep(1500);

const at = arg('at');
const target = await page.evaluate(
  (o) => {
    const store = window.__evalPark;
    if (!store) return { error: 'no __evalPark store' };
    if (o.at) {
      const [x, z] = o.at.split(',').map(Number);
      return { x, z, y: store.groundAt(x, z), label: `authored ${x},${z}` };
    }
    const ap = store.manager().accessPoints();
    const r = (o.want ? ap.rides.find((x) => x.name === o.want) : null) ?? ap.rides[0];
    if (!r) return { error: 'no registered rides' };
    return { x: r.entranceAt[0], z: r.entranceAt[1], y: store.groundAt(r.entranceAt[0], r.entranceAt[1]), label: `${r.name} entrance` };
  },
  { at, want: arg('ride') },
);
if (target.error) {
  console.log(`ERROR ${target.error}`);
  await browser.close();
  process.exit(1);
}
console.log(`framing ${target.label} at [${target.x.toFixed(2)}, ${target.z.toFixed(2)}]`);

await page.evaluate(
  (o) => {
    const api = document.querySelector('canvas').__stageApi;
    const el = (o.elDeg * Math.PI) / 180;
    const az = (o.azDeg * Math.PI) / 180;
    api.setCameraPose(
      [o.x + Math.cos(el) * Math.sin(az) * o.dist, o.y + Math.sin(el) * o.dist, o.z + Math.cos(el) * Math.cos(az) * o.dist],
      [o.x, o.y + 1.1, o.z],
    );
  },
  { x: target.x, y: target.y, z: target.z, dist: Number(arg('dist', '14')), azDeg: Number(arg('az', '45')), elDeg: Number(arg('el', '26')) },
);
await sleep(1000);
await page.screenshot({ path: outPng });
console.log(`shot: ${outPng}`);
await browser.close();
