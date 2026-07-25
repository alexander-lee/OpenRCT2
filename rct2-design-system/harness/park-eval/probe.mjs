#!/usr/bin/env node
// park-eval numeric probe — mounts the park headlessly and walks the live
// scene graph + the exposed ParkStore, printing a JSON report to stdout
// (and shots/<name>/probe.json).
//
//   node probe.mjs <parkFile.tsx> [--name=X] [--wait=ms]
//
// HEURISTICS / TAGS (all injected in-memory at bundle time by evaltags.mjs —
// repo untouched):
//   rides    groups with userData.rideRef (registered) or evalRide
//            (unregistered visuals); `evalRideKind` / `evalRideDefaultName`
//            carry the catalog COMPONENT kind
//   stalls   userData.evalStall (+ evalStallKind / evalStallDefaultName /
//            evalStallItem)
//   setPiece userData.evalSetPiece — FountainPlaza / Bazaar / Boulevard
//   trees    userData.evalKind==='tree'
//   scenery  userData.evalKind==='scenery' + a tally of every composable()
//   water    userData.evalKind==='water' meshes + the terrain sheet's REAL wet
//            area flood-filled from ground.heightAt vs waterLevel
//   paths    the ParkStore's <Paths> record (net nodes/edges, plazas, bins)
//   gate     userData.evalKind==='gate' + manager accessPoints().entranceNode
//   spacing  OBB SAT over the manager's footprints()/blockers() registries
//            (authoritative) + the legacy AABB gaps (advisory)
//   layout   layoutRaw -> layout.mjs (axis 15) + the signatures/ corpus
// Everything is best-effort: missing pieces come back null, never throw.

import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage, parseArgs, defaultName, sleep } from './evaltags.mjs';
import { layoutMetrics } from './layout.mjs';
import { rideCatalog, stallCatalog, kindsInSource, parkSourceFiles, CATEGORIES } from './catalog.mjs';
import { loadCorpus, saveSignature, layoutNovelty, rosterNovelty, kindFrequency } from './corpus.mjs';

const { file, opt } = parseArgs(process.argv);
if (!file) {
  console.error('usage: node probe.mjs <parkFile.tsx> [--name=X] [--wait=ms]');
  process.exit(1);
}
const name = opt('name') || defaultName(file);
const waitMs = Number(opt('wait') || 6000);

console.error(`[probe] bundling ${file} as "${name}"`);
const htmlPath = await bundleParkPage(file, name);
const { browser, page, lines } = await openParkPage(htmlPath, { waitMs, echo: false });
await sleep(1500); // let fps/drawcall stats accumulate

const report = await page.evaluate(() => {
  const out = { notes: [] };
  const T = window.__THREE;
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  const store = window.__evalPark || null;
  if (!api) { out.notes.push('no __stageApi — not a Stage scene'); return out; }
  if (!T) out.notes.push('no __THREE on window');
  if (!store) out.notes.push('no __evalPark store (park not composed via <Park>?)');
  const scene = api.scene;
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---- raw scene stats ----
  let meshes = 0, groups = 0, lights = 0;
  const materials = new Set();
  scene.traverse((o) => {
    if (o.isMesh) { meshes += 1; if (o.material) materials.add(o.material.uuid || o.material); }
    if (o.isGroup) groups += 1;
    if (o.isPointLight || o.isSpotLight || o.isDirectionalLight) lights += 1;
  });
  const stats = api.stats ? api.stats() : null;
  out.scene = {
    meshCount: meshes, groupCount: groups, lightCount: lights, materialCount: materials.size,
    drawCalls: stats ? stats.drawCalls : null, triangles: stats ? stats.triangles : null, fps: stats ? stats.fps : null,
  };

  // ---- bounding boxes ----
  const bboxOf = (obj) => {
    const b = new T.Box3().setFromObject(obj);
    return { min: [r2(b.min.x), r2(b.min.y), r2(b.min.z)], max: [r2(b.max.x), r2(b.max.y), r2(b.max.z)] };
  };
  try { out.sceneBBox = T ? bboxOf(scene) : null; } catch { out.sceneBBox = null; }
  out.parkSize = store ? store.size : null;

  // ---- tagged object census ----
  const rides = [], stalls = [], trees = [], scenery = [], waters = [], gates = [], restrooms = [], setPieces = [];
  const composables = {};
  const root = store ? store.root : scene;
  root.traverse((o) => {
    const ud = o.userData || {};
    if (ud.rideRef || ud.evalRide) {
      rides.push({
        obj: o,
        name: (ud.rideRef && ud.rideRef.name) || ud.evalComposable || o.name || 'ride',
        registered: !!ud.rideRef,
        kind: ud.evalRideKind || null,             // catalog component kind (RIDE ROSTER axis)
        defaultName: ud.evalRideDefaultName || null, // chassis layout defaults.name -> kind fallback
      });
    }
    if (ud.evalStall) stalls.push({ obj: o, name: ud.evalStall, kind: ud.evalStallKind || null, defaultName: ud.evalStallDefaultName || null, item: ud.evalStallItem || null });
    if (ud.evalSetPiece) setPieces.push({ obj: o, kind: ud.evalSetPiece, id: ud.evalSetPieceId || null });
    if (ud.evalKind === 'tree') trees.push({ obj: o, shape: ud.evalTreeShape });
    if (ud.evalKind === 'scenery') scenery.push({ obj: o, name: ud.evalScenery });
    if (ud.evalKind === 'water') waters.push({ obj: o, info: ud.evalWater || {} });
    if (ud.evalKind === 'gate') gates.push(o);
    if (ud.evalKind === 'restroom') restrooms.push(o);
    if (ud.evalComposable) composables[ud.evalComposable] = (composables[ud.evalComposable] || 0) + 1;
  });
  const wpos = (o) => { const v = new T.Vector3(); o.getWorldPosition(v); return [r2(v.x), r2(v.z)]; };

  // dedupe nested ride tags: keep the outermost per subtree
  function isAncestor(a, b) { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; }
  const rideSet = rides.filter((r) => !rides.some((other) => other !== r && isAncestor(other.obj, r.obj)));
  const mgrEarly = store && store._managerInst; // same instance as `mgr` below

  // ---- rides ----
  out.rides = rideSet.map((r) => {
    let bb = null;
    try { bb = bboxOf(r.obj); } catch { /* ignore */ }
    return { name: r.name, kind: r.kind, defaultName: r.defaultName, registered: r.registered, at: wpos(r.obj), bbox: bb };
  });

  // ---- RIDE SPACING (axis 3) ---------------------------------------------
  // The RAW pass is the old axis-aligned-bounding-box gap. It is WRONG for a
  // ring-shaped coaster with rides inside the ring: the coaster's AABB
  // encloses its own infield, so an enclosed flat ride reads as "touching"
  // even though nothing overlaps. The corrected pass exempts CONTAINMENT (one
  // AABB wholly inside the other = ring-with-infield, not a collision), and
  // the OBB pass below is AUTHORITATIVE — it runs the same oriented-box SAT
  // the validator's footprint sweep uses, over the manager's own
  // footprints()/blockers() rect registries.
  const gaps = [];
  const contained = [];
  const insideXZ = (P, Q) => P.min[0] >= Q.min[0] && P.max[0] <= Q.max[0] && P.min[2] >= Q.min[2] && P.max[2] <= Q.max[2];
  for (let i = 0; i < out.rides.length; i++)
    for (let j = i + 1; j < out.rides.length; j++) {
      const A = out.rides[i].bbox, B = out.rides[j].bbox;
      if (!A || !B) continue;
      const dx = Math.max(0, A.min[0] - B.max[0], B.min[0] - A.max[0]);
      const dz = Math.max(0, A.min[2] - B.max[2], B.min[2] - A.max[2]);
      const encl = insideXZ(A, B) || insideXZ(B, A);
      const row = { a: out.rides[i].name, b: out.rides[j].name, gapXZ: r2(Math.hypot(dx, dz)), aabbContainment: encl };
      gaps.push(row);
      if (encl) contained.push(`${row.a} <> ${row.b}`);
    }
  gaps.sort((a, b) => a.gapXZ - b.gapXZ);
  const scored = gaps.filter((g) => !g.aabbContainment);

  const obb = (() => {
    let fps = [], blks = [];
    try { fps = (mgrEarly && mgrEarly.footprints && mgrEarly.footprints()) || []; } catch { /* ignore */ }
    try { blks = (mgrEarly && mgrEarly.blockers && mgrEarly.blockers()) || []; } catch { /* ignore */ }
    const rects = [];
    fps.forEach((r) => rects.push({ cx: r.cx, cz: r.cz, hx: r.hx, hz: r.hz, yaw: r.yaw, label: r.label }));
    blks.forEach((b) => { if (b.rect) rects.push({ ...b.rect, label: b.label, owner: b.owner || null }); });
    if (!rects.length) return null;
    const names = out.rides.filter((r) => r.registered).map((r) => r.name);
    const ownerOf = (rect) => {
      if (rect.owner && names.includes(rect.owner)) return rect.owner;
      let best = null;
      for (const n of names) if (rect.label && rect.label.indexOf(n) === 0 && (!best || n.length > best.length)) best = n;
      return best;
    };
    const byRide = {};
    rects.forEach((r) => { const o = ownerOf(r); if (o) (byRide[o] = byRide[o] || []).push(r); });
    const corners = (r) => {
      const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
      return [[r.hx, r.hz], [-r.hx, r.hz], [-r.hx, -r.hz], [r.hx, -r.hz]].map(([x, z]) => [r.cx + x * c - z * s, r.cz + x * s + z * c]);
    };
    const overlap = (a, b) => {
      const axes = [[Math.cos(a.yaw), Math.sin(a.yaw)], [-Math.sin(a.yaw), Math.cos(a.yaw)],
        [Math.cos(b.yaw), Math.sin(b.yaw)], [-Math.sin(b.yaw), Math.cos(b.yaw)]];
      const A = corners(a), B = corners(b);
      for (const [ux, uz] of axes) {
        const pa = A.map((p) => p[0] * ux + p[1] * uz), pb = B.map((p) => p[0] * ux + p[1] * uz);
        if (Math.min(...pa) > Math.max(...pb) || Math.min(...pb) > Math.max(...pa)) return false;
      }
      return true;
    };
    const segDist = (p, q, r, s) => {
      const d = (ax, az, bx, bz, px, pz) => {
        const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
        const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
        return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
      };
      return Math.min(d(p[0], p[1], q[0], q[1], r[0], r[1]), d(p[0], p[1], q[0], q[1], s[0], s[1]),
        d(r[0], r[1], s[0], s[1], p[0], p[1]), d(r[0], r[1], s[0], s[1], q[0], q[1]));
    };
    const gapOf = (a, b) => {
      if (overlap(a, b)) return 0;
      const A = corners(a), B = corners(b);
      let m = Infinity;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) m = Math.min(m, segDist(A[i], A[(i + 1) % 4], B[j], B[(j + 1) % 4]));
      return m;
    };
    const rideNames = Object.keys(byRide);
    const pairs = [];
    for (let i = 0; i < rideNames.length; i++)
      for (let j = i + 1; j < rideNames.length; j++) {
        let m = Infinity;
        for (const ra of byRide[rideNames[i]]) for (const rb of byRide[rideNames[j]]) m = Math.min(m, gapOf(ra, rb));
        if (Number.isFinite(m)) pairs.push({ a: rideNames[i], b: rideNames[j], gapXZ: r2(m) });
      }
    pairs.sort((a, b) => a.gapXZ - b.gapXZ);
    return {
      rectCount: rects.length,
      ridesWithRects: rideNames.length,
      pairs,
      minGap: pairs.length ? pairs[0].gapXZ : null,
      overlappingPairs: pairs.filter((p) => p.gapXZ === 0).map((p) => `${p.a} <> ${p.b}`),
    };
  })();

  out.rideSpacing = {
    minGap: scored.length ? scored[0].gapXZ : null,
    touchingPairs: scored.filter((g) => g.gapXZ === 0).map((g) => `${g.a} <> ${g.b}`),
    rawMinGap: gaps.length ? gaps[0].gapXZ : null,
    rawTouchingPairs: gaps.filter((g) => g.gapXZ === 0).map((g) => `${g.a} <> ${g.b}`),
    aabbContainedPairs: contained, // ring-with-infield, NOT overlap
    pairs: gaps,
    obb,
    authoritative: 'obb.overlappingPairs + consoleSummary.footprintFails/corridorFails',
  };

  // ---- stalls / set pieces / trees / scenery ----
  out.stalls = stalls.map((s) => ({ name: s.name, kind: s.kind, defaultName: s.defaultName, item: s.item, at: wpos(s.obj) }));
  out.setPieces = setPieces.map((s) => ({ kind: s.kind, id: s.id, at: wpos(s.obj) }));
  out.trees = {
    count: trees.length,
    byShape: trees.reduce((m, t) => ((m[t.shape] = (m[t.shape] || 0) + 1), m), {}),
    positions: trees.map((t) => wpos(t.obj)),
  };
  out.scenery = { count: scenery.length, byName: scenery.reduce((m, s) => ((m[s.name] = (m[s.name] || 0) + 1), m), {}) };
  out.composables = composables;
  out.restrooms = restrooms.map((o) => wpos(o));

  // ---- park entrance ----
  const mgr = store && store._managerInst;
  let access = null;
  try { access = mgr ? mgr.accessPoints() : null; } catch { /* ignore */ }
  out.entrance = {
    gateMeshes: gates.length,
    gateAt: gates.length ? wpos(gates[0]) : null,
    attachedToPathNode: access ? access.entranceNode >= 0 : null,
    rideAccessNodes: access ? access.rides : null,
  };

  // ---- ride names + count ----
  let mgrRides = null;
  try { mgrRides = mgr ? mgr.rides() : null; } catch { /* ignore */ }
  const mgrNames = (access && access.rides && access.rides.map((r) => r.name)) || (mgrRides && mgrRides.map((r) => r.name)) || null;
  out.rideNames = mgrNames || out.rides.filter((r) => r.registered).map((r) => r.name);
  out.rideCount = {
    registered: mgrNames ? mgrNames.length : out.rides.filter((r) => r.registered).length,
    sceneRideGroups: out.rides.length,
    unregisteredVisualOnly: out.rides.filter((r) => !r.registered).length,
  };
  let mgrStalls = null;
  try { mgrStalls = mgr && mgr.stallList ? mgr.stallList() : null; } catch { /* ignore */ }

  // ---- coasters: RCT2 ride ratings per registered circuit (THRILL axis) ----
  out.coasters = [];
  {
    const rate = window.__evalRateCoaster;
    const circuits = (store && store._coasters) || [];
    if (!rate && circuits.length) out.notes.push('no __evalRateCoaster on the page — coaster ratings skipped');
    circuits.forEach((c, i) => {
      const row = { name: c.name || `coaster ${i}`, type: c.type || 'wooden', bank: c.bank ?? null, fatal: c.fatal || null, points: (c.points || []).length };
      if (c.fatal || !rate) { out.coasters.push({ ...row, ratings: null }); return; }
      try {
        const m = rate(c.points, { type: c.type, bank: c.bank });
        out.coasters.push({
          ...row,
          excitement: m.excitement, intensity: m.intensity, nausea: m.nausea,
          ratingBand: m.ratingBand, nauseaBand: m.nauseaBand, nauseaExtreme: m.nauseaExtreme,
          maxSpeed: m.maxSpeed, avgSpeed: m.avgSpeed,
          maxPosVertG: m.maxPosVertG, maxNegVertG: m.maxNegVertG, maxLatG: m.maxLatG,
          highestDrop: m.highestDrop, totalDrop: m.totalDrop, dropCount: m.dropCount,
          airtimeSeconds: m.airtimeSeconds, inversions: m.inversions,
          length: m.length, duration: m.duration, turns: m.turns,
        });
      } catch (e) {
        out.coasters.push({ ...row, ratings: null, error: String(e && e.message ? e.message : e) });
        out.notes.push(`rateCoaster threw on ${row.name}: ${String(e && e.message ? e.message : e)}`);
      }
    });
  }

  // ---- park-level THRILL summary ----
  {
    const BANDS = ['gentle', 'moderate', 'thrilling', 'intense', 'extreme'];
    const rated = out.coasters.filter((c) => typeof c.excitement === 'number');
    let flagship = null;
    for (const c of rated) if (!flagship || c.excitement > flagship.excitement) flagship = c;
    let bestBand = null;
    for (const c of rated) {
      const k = BANDS.indexOf(c.ratingBand);
      if (k >= 0 && (bestBand === null || k > BANDS.indexOf(bestBand))) bestBand = c.ratingBand;
    }
    const mix = { gentle: 0, moderate: 0, intense: 0, unknown: 0 };
    const byRide = [];
    (mgrRides || []).forEach((r) => {
      const iv = r.intensity;
      const band = typeof iv !== 'number' ? 'unknown' : iv <= 3 ? 'gentle' : iv <= 6 ? 'moderate' : 'intense';
      mix[band] += 1;
      byRide.push({ name: r.name, intensity: typeof iv === 'number' ? iv : null, band });
    });
    out.thrill = {
      coasterCount: out.coasters.length,
      ratedCount: rated.length,
      fatalCoasters: out.coasters.filter((c) => c.fatal).length,
      flagshipExcitement: flagship ? flagship.excitement : null,
      flagship: flagship
        ? {
            name: flagship.name, type: flagship.type,
            excitement: flagship.excitement, intensity: flagship.intensity, nausea: flagship.nausea,
            ratingBand: flagship.ratingBand,
            maxPosVertG: flagship.maxPosVertG, maxNegVertG: flagship.maxNegVertG, maxLatG: flagship.maxLatG,
            highestDrop: flagship.highestDrop, dropCount: flagship.dropCount,
            maxSpeed: flagship.maxSpeed, airtimeSeconds: flagship.airtimeSeconds,
            inversions: flagship.inversions, length: flagship.length, duration: flagship.duration,
          }
        : null,
      bestRatingBand: bestBand,
      lateralMargin: 1.27,
      lateralSafe: rated.length > 0 && rated.every((c) => c.maxLatG <= 1.275),
      worstLateralG: rated.length ? Math.max(...rated.map((c) => c.maxLatG)) : null,
      peakPosVertG: rated.length ? Math.max(...rated.map((c) => c.maxPosVertG)) : null,
      bestNegVertG: rated.length ? Math.min(...rated.map((c) => c.maxNegVertG)) : null,
      bestHighestDrop: rated.length ? Math.max(...rated.map((c) => c.highestDrop)) : null,
      bestAirtimeSeconds: rated.length ? Math.max(...rated.map((c) => c.airtimeSeconds)) : null,
      maxNausea: rated.length ? Math.max(...rated.map((c) => c.nausea)) : null,
      nauseaExtreme: rated.some((c) => c.nauseaExtreme),
      intensityMix: mix,
      mixComplete: mix.gentle > 0 && mix.moderate > 0 && mix.intense > 0,
      ridesByIntensity: byRide,
      coasterGateOk: null, // filled in node-side from the validator console lines
    };
  }

  // ---- accessibility: BFS over the path net from the gate node ----
  out.accessibility = null;
  if (store && store.paths && access) {
    const net = store.paths.net;
    const adj = net.nodes.map(() => []);
    net.edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    const reach = new Uint8Array(net.nodes.length);
    if (access.entranceNode >= 0 && access.entranceNode < net.nodes.length) {
      const q = [access.entranceNode]; reach[access.entranceNode] = 1;
      while (q.length) { const c = q.pop(); for (const n of adj[c]) if (!reach[n]) { reach[n] = 1; q.push(n); } }
    }
    const comp = new Int32Array(net.nodes.length).fill(-1);
    let nComp = 0;
    for (let s = 0; s < net.nodes.length; s++) {
      if (comp[s] !== -1) continue;
      const q = [s]; comp[s] = nComp;
      while (q.length) { const c = q.pop(); for (const n of adj[c]) if (comp[n] === -1) { comp[n] = nComp; q.push(n); } }
      nComp += 1;
    }
    const nearestNode = (x, z, maxD) => {
      let best = -1, bd = maxD;
      net.nodes.forEach(([nx, nz], i) => { const d = Math.hypot(nx - x, nz - z); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const perRide = (access.rides || []).map((r) => ({
      name: r.name, queueNode: r.queueNode, exitNode: r.exitNode,
      queueReachable: r.queueNode >= 0 ? !!reach[r.queueNode] : false,
      exitReachable: r.exitNode >= 0 ? !!reach[r.exitNode] : false,
    }));
    const perStall = (mgrStalls || out.stalls.map((s) => ({ name: s.name, anchor: [s.at[0], 0, s.at[1]] }))).map((s) => {
      const n = nearestNode(s.anchor[0], s.anchor[2], 2.5);
      return { name: s.name, nearestNode: n, reachable: n >= 0 ? !!reach[n] : false };
    });
    out.accessibility = {
      gateNode: access.entranceNode,
      pathComponents: nComp,
      orphanIslands: Math.max(0, nComp - 1),
      nodesReachableFromGate: Array.from(reach).filter(Boolean).length,
      nodesTotal: net.nodes.length,
      perRideReachable: perRide,
      allRidesReachable: perRide.length > 0 && perRide.every((r) => r.queueReachable && r.exitReachable),
      perStallReachable: perStall,
      allStallsReachable: perStall.every((s) => s.reachable),
    };
  } else out.notes.push('accessibility not computed (need store.paths + manager accessPoints)');

  // ---- ramp observations ----
  out.rampObservations = null;
  if (store && store.paths && store.ground) {
    const P = store.paths, net = P.net, gAt = store.ground.heightAt;
    const surf = P.walkYAt ? P.walkYAt : () => P.pathY;
    let maxLift = 0, liftSum = 0, liftN = 0, maxGrade = 0;
    const causewayEdges = [], steepEdges = [];
    net.edges.forEach(([a, b], ei) => {
      const [ax, az] = net.nodes[a], [bx, bz] = net.nodes[b];
      const len = Math.hypot(bx - ax, bz - az) || 1e-6;
      let edgeMaxLift = 0;
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        const x = ax + (bx - ax) * f, z = az + (bz - az) * f;
        const lift = surf(x, z) - gAt(x, z);
        edgeMaxLift = Math.max(edgeMaxLift, lift);
        liftSum += Math.max(0, lift); liftN += 1;
      }
      const grade = Math.abs(surf(bx, bz) - surf(ax, az)) / len;
      maxLift = Math.max(maxLift, edgeMaxLift);
      maxGrade = Math.max(maxGrade, grade);
      if (edgeMaxLift > 0.8) causewayEdges.push({ edge: ei, a, b, maxLift: r2(edgeMaxLift) });
      if (grade > 0.6) steepEdges.push({ edge: ei, a, b, grade: r2(grade) });
    });
    out.rampObservations = {
      pathLevel: r2(P.pathY),
      rampNodes: (P.nodeY || []).filter((y) => Math.abs(y || 0) > 0.01).length,
      maxLift: r2(maxLift), avgLift: r2(liftN ? liftSum / liftN : 0), maxGrade: r2(maxGrade),
      causewayEdges: causewayEdges.slice(0, 10),
      steepEdges: steepEdges.slice(0, 10),
    };
  }

  // ---- scenery variety (Creativity axis) ----
  {
    const sceneryKinds = Object.keys(out.scenery.byName || {});
    const composableKinds = Object.keys(composables);
    const flavour = {};
    for (const k of [...sceneryKinds, ...composableKinds])
      if (/torch|neon|string|lantern|lamp|light|dance|firework|fountain|banner|sign/i.test(k))
        flavour[k] = (out.scenery.byName && out.scenery.byName[k]) || composables[k] || 1;
    out.sceneryVariety = {
      distinctSceneryKinds: sceneryKinds.length,
      distinctComposableKinds: composableKinds.length,
      varietyIndex: new Set([...sceneryKinds, ...composableKinds]).size,
      flavourItems: flavour,
      totalSceneryPieces: out.scenery.count,
    };
  }

  // ---- water ----
  out.water = { meshes: waters.map((w) => ({ ...w.info, worldY: r2(new T.Box3().setFromObject(w.obj).max.y) })), terrainWater: null };
  if (store && store.ground) {
    const S = store.ground.size, wl = store.ground.waterLevel, N = 96;
    const cell = S / N, half = S / 2, wet = new Uint8Array(N * N);
    let wetCells = 0;
    for (let iz = 0; iz < N; iz++)
      for (let ix = 0; ix < N; ix++) {
        const h = store.ground.heightAt(-half + (ix + 0.5) * cell, -half + (iz + 0.5) * cell);
        if (h < wl) { wet[iz * N + ix] = 1; wetCells += 1; }
      }
    const seen = new Uint8Array(N * N);
    const bodies = [];
    for (let s = 0; s < N * N; s++) {
      if (!wet[s] || seen[s]) continue;
      let sz = 0; const stack = [s]; seen[s] = 1;
      while (stack.length) {
        const c = stack.pop(); sz += 1;
        const cx = c % N, cz = (c / N) | 0;
        for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]]) {
          if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
          const k = nz * N + nx;
          if (wet[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
        }
      }
      bodies.push(sz);
    }
    bodies.sort((a, b) => b - a);
    const a = cell * cell;
    out.water.terrainWater = {
      waterLevel: wl, areaUnits2: r2(wetCells * a), fractionOfPark: r2((wetCells * a) / (S * S)),
      bodyCount: bodies.filter((b) => b * a >= 0.5).length,
      bodyAreas: bodies.slice(0, 8).map((b) => r2(b * a)),
    };
  } else out.notes.push('no ground sampler — terrain water area not estimated');

  // ---- terrain normality ----
  if (store && store.ground) {
    const S = store.ground.size, half = S / 2, N = 64, cell = S / N;
    let mn = Infinity, mx = -Infinity, sum = 0, sum2 = 0, maxSlope = 0;
    const h = (x, z) => store.ground.heightAt(x, z);
    for (let iz = 0; iz <= N; iz++)
      for (let ix = 0; ix <= N; ix++) {
        const x = -half + ix * cell, z = -half + iz * cell;
        const v = h(x, z);
        mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; sum2 += v * v;
        maxSlope = Math.max(maxSlope, Math.abs(h(x + cell, z) - v) / cell, Math.abs(h(x, z + cell) - v) / cell);
      }
    const n = (N + 1) * (N + 1), mean = sum / n;
    out.terrain = {
      minH: r2(mn), maxH: r2(mx), meanH: r2(mean),
      stdH: r2(Math.sqrt(Math.max(0, sum2 / n - mean * mean))),
      maxSlope: r2(maxSlope),
      peaks: (store.ground.comp && store.ground.comp.peaks && store.ground.comp.peaks.length) || 0,
      lint: store.ground.lint ?? null,
    };
  } else out.terrain = null;

  // ---- paths ----
  if (store && store.paths) {
    const nodes = store.paths.net.nodes;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, len = 0;
    nodes.forEach(([x, z]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); });
    store.paths.net.edges.forEach(([a, b]) => { len += Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]); });
    out.paths = {
      nodes: nodes.length,
      edges: store.paths.net.edges.length,
      totalLength: r2(len),
      extent: { min: [r2(minX), r2(minZ)], max: [r2(maxX), r2(maxZ)] },
      extentFractionOfPark: store ? r2(((maxX - minX) * (maxZ - minZ)) / (store.size * store.size)) : null,
      plazas: store.paths.plazas.length,
      bins: store.paths.bins.length,
    };
  } else { out.paths = null; out.notes.push('no <Paths> record on the store'); }

  // ---- LAYOUT UNIQUENESS raw input (axis 15) ------------------------------
  // Everything the layout metrics are computed from, lifted verbatim off the
  // live store so the whole axis can be recomputed/recalibrated offline
  // (node side: layout.mjs -> out.layout).
  if (store && store.paths) {
    out.layoutRaw = {
      size: store.size,
      // <Paths> records how many of the net's nodes are AUTHORED STREET nodes;
      // everything past that index is a queue/exit access spur the manager
      // appended. validatePark makes the same distinction (`gridNodeCount`
      // exempts spur attaches from the N/S/E/W rule), and the grid metrics MUST
      // measure the street net only — spur stubs are short, odd-length and
      // sometimes oblique, which flatters a monotonous lattice.
      streetNodes: store.paths.streetNodes ?? null,
      nodes: store.paths.net.nodes.map(([x, z]) => [r2(x), r2(z)]),
      edges: store.paths.net.edges.map(([a, b]) => [a, b]),
      plazas: (store.paths.plazas || []).map((p) => p.map(r2)),
      bins: (store.paths.bins || []).map((b) => [r2(b[0]), r2(b[1])]),
      // districts cluster on the ride's FOOTPRINT CENTRE: a <Coaster> group's
      // origin is [0, 0] (the mount transform), not where the ride stands
      rides: out.rides.map((r) => ({
        name: r.name, kind: r.kind, registered: r.registered, at: r.at,
        centre: r.bbox ? [r2((r.bbox.min[0] + r.bbox.max[0]) / 2), r2((r.bbox.min[2] + r.bbox.max[2]) / 2)] : r.at,
      })),
      stalls: out.stalls.map((s) => ({ name: s.name, kind: s.kind, at: s.at })),
      setPieces: out.setPieces,
      sceneryByName: out.scenery.byName,
      trees: out.trees.count,
    };
  } else { out.layoutRaw = null; out.notes.push('no <Paths> record — layout metrics skipped'); }

  // ---- sim / cleanliness ----
  try {
    const s = mgr ? mgr.stats() : null;
    out.sim = s
      ? {
          activeGuests: s.activeGuests, avgHappiness: r2(s.avgHappiness),
          litterCount: s.litterCount, poopCount: s.poopCount, vomitCount: s.vomitCount,
          queued: s.queued, riding: s.riding, restroomUses: s.restroomUses, rides: s.rides,
        }
      : null;
  } catch { out.sim = null; }
  out.validation = window.__parkReport ?? null;

  return out;
});

report.consoleSummary = {
  totalLines: lines.length,
  validatorLine: lines.find((l) => /validatePark →/.test(l)) || null,
  validatorFails: lines.filter((l) => /validatePark FAIL/.test(l)),
  errors: lines.filter((l) => /^\[(pageerror|error)\]/.test(l)).slice(0, 20),
  perfLine: lines.find((l) => /\[Park\] perf:/.test(l)) || null,
  rampSignals: lines.filter((l) => /causeway|berm|scaffold|nodeY ramp|floats|floating/i.test(l)).slice(0, 20),
  // RIDE SPACING axis: the validator's own OBB footprint sweep — AUTHORITATIVE
  // over probe.rideSpacing's AABB gaps (see RUBRIC.md axis 3)
  footprintFails: lines.filter((l) => /validatePark FAIL \[footprints\]/.test(l)).slice(0, 10),
  coasterFails: lines.filter((l) => /validatePark FAIL \[coaster\]/.test(l)).slice(0, 10),
  corridorFails: lines.filter((l) => /validatePark FAIL \[corridor\]/.test(l)).slice(0, 10),
};

if (report.thrill) {
  const ran = !!report.consoleSummary.validatorLine;
  report.thrill.coasterGateOk = ran ? report.consoleSummary.coasterFails.length === 0 : null;
}

// ---------------------------------------------------------------------------
// LAYOUT UNIQUENESS (axis 15) + RIDE / STALL ROSTER (axes 13, 5)
// ---------------------------------------------------------------------------
// Computed node-side from `layoutRaw` + the LIVE design-system catalog, then
// cross-compared against every prior park's signature under signatures/.
{
  const RIDES = rideCatalog();
  const STALLS = stallCatalog();
  const rideKindsCat = RIDES.map((r) => r.kind);
  const stallKindsCat = STALLS.map((s) => s.kind);
  const catOf = {};
  RIDES.forEach((r) => { catOf[r.kind] = r; });

  // ---- ride roster -------------------------------------------------------
  const srcFiles = parkSourceFiles(file);
  const srcRideHits = kindsInSource(srcFiles, rideKindsCat);
  const srcStallHits = kindsInSource(srcFiles, stallKindsCat);
  const coasterNames = new Set((report.coasters || []).map((c) => c.name));
  const registered = (report.rides || []).filter((r) => r.registered);
  // catalog defaults.name -> kind (resolves the hand-rolled chassis rides)
  const byDefaultName = {};
  RIDES.forEach((r) => { if (r.defaultName && r.source !== 'Park/pieces') byDefaultName[r.defaultName] = r.kind; });
  const perRide = registered.map((r) => {
    // scene kind tag first, then the chassis defaults.name, then: a registered
    // circuit with no tag at all is a <Coaster>/<TrackRide>
    const kind = r.kind || byDefaultName[r.defaultName] || (coasterNames.has(r.name) ? (srcRideHits.TrackRide ? 'TrackRide' : 'Coaster') : null);
    const c = kind ? catOf[kind] : null;
    return { name: r.name, kind, category: c ? c.category : null, tracked: c ? c.tracked : null, at: r.at };
  });
  const rideKinds = [...new Set([...perRide.map((r) => r.kind).filter(Boolean), ...Object.keys(srcRideHits)])].sort();
  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c] = []; });
  byCategory.unclassified = [];
  rideKinds.forEach((k) => { const c = catOf[k]; (byCategory[c ? c.category : 'unclassified'] || byCategory.unclassified).push(k); });
  const trackedKinds = rideKinds.filter((k) => catOf[k] && catOf[k].tracked);
  const coasterKinds = rideKinds.filter((k) => ['Coaster', 'TrackRide', 'SplineCoaster'].includes(k));
  const specialityKinds = trackedKinds.filter((k) => !coasterKinds.includes(k));

  // ---- stall roster ------------------------------------------------------
  const perStall = (report.stalls || []).map((s) => ({
    name: s.name, kind: s.kind, item: s.item, defaultName: s.defaultName,
    themedName: !!(s.name && s.defaultName && s.name !== s.defaultName),
    at: s.at,
  }));
  const stallKinds = [...new Set([...perStall.map((s) => s.kind).filter(Boolean), ...Object.keys(srcStallHits)])].sort();
  const themedCount = perStall.filter((s) => s.themedName).length;
  const items = [...new Set(perStall.map((s) => s.item).filter(Boolean))].sort();

  // ---- layout metrics ----------------------------------------------------
  const layout = report.layoutRaw ? layoutMetrics(report.layoutRaw) : null;

  // ---- cross-park novelty ------------------------------------------------
  const corpus = loadCorpus({ exclude: name });
  if (layout) {
    layout.novelty = layoutNovelty(layout.signature, corpus);
    layout.noveltyThresholds = { distinct: 0.08, derivative: 0.04 };
  }
  const rideNov = rosterNovelty(rideKinds, corpus, 'rideKinds');
  const stallNov = rosterNovelty(stallKinds, corpus, 'stallKinds');
  const rideFreq = kindFrequency(corpus, 'rideKinds');
  const stallFreq = kindFrequency(corpus, 'stallKinds');

  report.layout = layout;
  report.rideRoster = {
    registeredCount: registered.length,
    rides: perRide,
    kinds: rideKinds,
    distinctKinds: rideKinds.length,
    byCategory,
    categoriesRepresented: CATEGORIES.filter((c) => byCategory[c].length > 0),
    categoryCount: CATEGORIES.filter((c) => byCategory[c].length > 0).length,
    coasterKinds,
    trackedKinds,
    specialityKinds, // tracked/water/transport/dark BESIDES the coaster
    hasSpeciality: specialityKinds.length > 0,
    unclassifiedKinds: byCategory.unclassified,
    sourceHits: srcRideHits, // kind -> JSX occurrences in the park's own source
    novelty: rideNov,
    noveltyThresholds: { distinct: 0.4, derivative: 0.25 },
    catalogSize: rideKindsCat.length,
    corpusKindFrequency: rideFreq,
    catalogNeverUsed: rideKindsCat.filter((k) => !(rideFreq[k] > 0) && !rideKinds.includes(k)),
  };
  report.stallRoster = {
    registeredCount: perStall.length,
    stalls: perStall,
    kinds: stallKinds,
    distinctKinds: stallKinds.length,
    items,
    coversFoodAndDrink: items.includes('food') && items.includes('drink'),
    themedNameCount: themedCount,
    allThemed: perStall.length > 0 && themedCount === perStall.length,
    defaultNamed: perStall.filter((s) => !s.themedName).map((s) => s.name),
    bins: report.paths ? report.paths.bins : null,
    restrooms: (report.restrooms || []).length,
    sourceHits: srcStallHits,
    novelty: stallNov,
    catalogSize: stallKindsCat.length,
    corpusKindFrequency: stallFreq,
    catalogNeverUsed: stallKindsCat.filter((k) => !(stallFreq[k] > 0) && !stallKinds.includes(k)),
  };

  // ---- publish this park's signature into the corpus ---------------------
  if (layout)
    saveSignature({
      name,
      park: path.resolve(file),
      when: new Date().toISOString(),
      size: report.layoutRaw.size,
      layoutSignature: layout.signature,
      gridRegularity: layout.gridRegularity,
      rideKinds,
      stallKinds,
      rideNames: (report.rideNames || []).slice(),
      stallNames: perStall.map((s) => s.name),
    });
}

const outPath = path.join(HERE, 'shots', name, 'probe.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.error(`[probe] wrote ${outPath}`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
