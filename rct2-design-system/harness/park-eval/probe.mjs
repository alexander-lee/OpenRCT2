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
//   worlds   the design system's OWN settle-time world audit, lifted off the
//            store as `_worldAudit` (ParkBuilder/worlds.ts): which preset
//            WORLDS the park declared, each one's ride/stall/scenery build-out,
//            and every CROSS-THEME placement with its coordinates (axis 16).
//            The gate's `crossTheme` warnings come from the same function, so
//            the rubric and validatePark can never disagree.
// Everything is best-effort: missing pieces come back null, never throw.

import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage, parseArgs, defaultName, sleep, auditAnchors } from './evaltags.mjs';
import { preflightCheck, reportPreflight } from './preflight.mjs';
import { layoutMetrics, districtSeparationFloor } from './layout.mjs';
import { scoreWorlds } from './score-worlds.mjs';
import {
  rideCatalog, stallCatalog, kindsInSource, parkSourceFiles, CATEGORIES,
  CIRCUIT_FAMILIES, PIECES_MODE, circuitFamilyOf,
} from './catalog.mjs';
import {
  corpusSnapshot, corpusStampOf, saveSignature, layoutNovelty, rosterNovelty, kindFrequency, underusedPresets,
  signatureConflict, signatureConflictMessage, shotsConflict, shotsConflictMessage,
} from './corpus.mjs';

const { file, opt } = parseArgs(process.argv);
if (!file) {
  console.error('usage: node probe.mjs <parkFile.tsx> [--name=X] [--wait=ms] [--corpus=<stamp.json>] [--signature]');
  console.error('  --signature   PUBLISH this park into signatures/ (the novelty corpus). NOT the default since 2026-07-26:');
  console.error('                corpus membership is an explicit act, because a silent write changes every other park\'s score.');
  console.error('  --reassign-signature / --reassign-shots / --reassign');
  console.error('                deliberate opt-outs from the NAME-OWNERSHIP guard below. Without one of these, a --name=X');
  console.error('                that would overwrite another park\'s signature or shots/ measurement REFUSES to run.');
  process.exit(1);
}

// PRE-FLIGHT LINT (wave-10) — same gate as eval.mjs: probe.mjs bundles
// independently (its own `bundleParkPage` call), so a park importing a
// deleted/misspelled component dies here too if this isn't checked first.
const preflightProblems = preflightCheck(file);
if (!reportPreflight(file, preflightProblems)) process.exit(1);

// ---------------------------------------------------------------------------
// EVAL-TAG ANCHOR GATE (2026-07-26)
// ---------------------------------------------------------------------------
// Every measurement in this report comes from an injection anchored on an exact
// design-system source string. When the design system moves, `evalTagPlugin`
// logs "anchor missing … probe will degrade" and CARRIES ON — so the axis that
// injection feeds comes back as a plausible ZERO instead of an error. That has
// already cost this harness twice: `rateCoaster` moving to ratings.ts made every
// park read `thrill.ratedCount 0`, and on 2026-07-26 <Terrain> moved from
// wrappers.tsx to wrappersLand.tsx, which silently unhooks the terrain/water tag.
// A degraded axis is a missing measurement, so it is checked BEFORE the browser
// starts and it is fatal. `--allow-anchor-drift` exists for deliberate DS surgery.
{
  const broken = auditAnchors().filter((r) => !r.ok);
  if (broken.length && !process.argv.includes('--allow-anchor-drift')) {
    console.error(`[probe] ANCHOR DRIFT — ${broken.length} eval-tag anchor(s) no longer match the design system:`);
    for (const b of broken) console.error(`  ✗ ${b.file}  ${b.anchor}`);
    console.error('  The axes these feed would silently degrade to zero. Fix INJECTIONS in evaltags.mjs');
    console.error('  (`node evaltags.mjs --audit-anchors`), or pass --allow-anchor-drift to probe anyway.');
    process.exit(1);
  }
}

const name = opt('name') || defaultName(file);
const waitMs = Number(opt('wait') || 6000);
const parkPath = path.resolve(file);

// `--signature` is resolved HERE, not at the write site, because the name-ownership
// gate below has to know whether this run intends to touch signatures/ before it
// spends two minutes in SwiftShader. See the long note at the publish site.
const wantSignature = process.argv.includes('--signature') && !process.argv.includes('--no-signature');

// ---------------------------------------------------------------------------
// NAME OWNERSHIP GATE (2026-07-27) — `--name` MAY NOT SPEAK FOR ANOTHER PARK
// ---------------------------------------------------------------------------
// `--name` decides TWO output locations — `shots/<name>/` and (with --signature)
// `signatures/<name>.json` — while the park's IDENTITY is its source path. When
// the two disagree, the name wins and a scratch park inherits a corpus entry.
// That is not hypothetical: on 2026-07-26 `node probe.mjs samples/zzbase-a.tsx
// --name=skeleton-a` (a throwaway baseline copy, run while another agent was
// scoring) rewrote BOTH `shots/skeleton-a/probe.json` and
// `signatures/skeleton-a.json` — the signature's own `park` field now pointing at
// the scratch file — and the real skeleton-a measurement was gone. It was noticed
// only because a third agent happened to diff signatures/.
//
// Both checks run BEFORE bundling: a refusal after the render is a refusal that
// cost two minutes, and there is nothing in either check that needs a measurement.
// The shots check runs on EVERY probe (that write is unconditional); the signature
// check only on a `--signature` run (nothing else touches signatures/).
const reassignAll = process.argv.includes('--reassign');
const reassignShots = reassignAll || process.argv.includes('--reassign-shots');
const reassignSignature = reassignAll || process.argv.includes('--reassign-signature');
/** set when a CONCURRENT publication stole `${name}.json` mid-run — see the write site */
let signaturePublishRefused = null;
{
  const shotsClash = shotsConflict({ name, park: parkPath });
  if (shotsClash) {
    if (!reassignShots) {
      console.error(shotsConflictMessage(shotsClash));
      process.exit(1);
    }
    console.error(`[probe] --reassign-shots: shots/${name}/ REASSIGNED from ${shotsClash.storedPark} to ${parkPath}`);
  }
  if (wantSignature) {
    const sigClash = signatureConflict({ name, park: parkPath });
    if (sigClash) {
      if (!reassignSignature) {
        console.error(signatureConflictMessage(sigClash));
        process.exit(1);
      }
      console.error(`[probe] --reassign-signature: signatures/${sigClash.file} will be REASSIGNED from ${sigClash.storedPark} to ${parkPath}`);
    }
  }
}

console.error(`[probe] bundling ${file} as "${name}"`);
const htmlPath = await bundleParkPage(file, name);
const { browser, page, lines, settle } = await openParkPage(htmlPath, { waitMs, echo: false });
await sleep(1500); // let fps/drawcall stats accumulate

// ---------------------------------------------------------------------------
// UNMEASURED-IS-FATAL (2026-07-26)
// ---------------------------------------------------------------------------
// Every entry pushed here is a measurement the RUBRIC scores that this run could
// not obtain. The probe exits NON-ZERO and writes NO probe.json when the list is
// non-empty, because the alternative — which is what this file did until today —
// is emitting a report whose `validation` is `null` and whose thrill/layout/
// accessibility axes are `null`, with exit code 0, for downstream scoring to read
// as "nothing wrong here". Absence of a measurement is not absence of a problem.
const unmeasured = [];
const fatal = (axis, detail) => unmeasured.push({ axis, detail });

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
  // `bbox` is the WORLD-space bounding box of the piece's own mounted group —
  // its dressing (lamps/trees/benches/props for a Boulevard/Bazaar aisle, the
  // ring furniture for a FountainPlaza) is added as children at absolute
  // world coordinates (Boulevard/index.tsx, Bazaar/index.tsx), so this box is
  // a reasonable PROXY for the piece's footprint even though the carriageway
  // slab itself is drawn by the shared <Paths> component, not nested here.
  // layout.mjs uses it to tell the piece's own INTERNAL chain/ring edges (a
  // boulevard's 1.2 u carriageway nodes, a bazaar's aisle, a plaza's ring)
  // apart from the agent's AUTHORED spine (axis 15's "edge-length variety").
  out.setPieces = setPieces.map((s) => {
    let bbox = null;
    try { bbox = bboxOf(s.obj); } catch { /* ignore */ }
    return { kind: s.kind, id: s.id, at: wpos(s.obj), bbox };
  });
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

    // ---- WHICH §4.0 ARCHETYPE IS THIS? (added 2026-07-26) ----------------
    // The rubric's axis-14 ROSTER term wants a second coaster from a DIFFERENT
    // archetype, so the probe has to name the archetype rather than leave a
    // scorer to eyeball an excitement figure. The three published shelves are
    // separable on (inversions, dropCount, length) alone — measured on the
    // shelf itself (`rules/park-generation-rides.md` §4.0):
    //   A  0 inversions ·  9 drops · length 158.63 · E 6.12 (6.06 mounted)
    //   B  0 inversions ·  6 drops · length 120.87 · E 5.27
    //   C  2 inversions ·  7 drops · length 152.17 · E 6.31
    // Anything else reads 'custom' — NOT a defect, just "not off the shelf".
    const ARCHETYPE_FP = [
      { id: '4.0-A', inversions: 0, dropCount: 9, length: 158.63 },
      { id: '4.0-B', inversions: 0, dropCount: 6, length: 120.87 },
      { id: '4.0-C', inversions: 2, dropCount: 7, length: 152.17 },
    ];
    const archetypeOf = (c) => {
      for (const a of ARCHETYPE_FP)
        if (c.inversions === a.inversions && c.dropCount === a.dropCount && Math.abs(c.length - a.length) <= 8)
          return a.id;
      return 'custom';
    };
    out.coasters.forEach((c) => { c.archetype = typeof c.excitement === 'number' ? archetypeOf(c) : null; });
    const ratedRanked = [...rated].sort((a, b) => b.excitement - a.excitement);
    const second = ratedRanked[1] || null;
    const bandOf = (iv) => (typeof iv !== 'number' ? 'unknown' : iv <= 3 ? 'gentle' : iv <= 6 ? 'moderate' : 'intense');
    const archetypes = [...new Set(ratedRanked.map((c) => c.archetype).filter(Boolean))];
    const intensities = rated.map((c) => c.intensity).filter((v) => typeof v === 'number');

    out.thrill = {
      coasterCount: out.coasters.length,
      ratedCount: rated.length,
      fatalCoasters: out.coasters.filter((c) => c.fatal).length,
      flagshipExcitement: flagship ? flagship.excitement : null,
      // ---- THE COASTER ROSTER (axis 14's roster term) ---------------------
      // `flagshipExcitement` alone made a park with ONE excellent coaster score
      // exactly the same as a park with three. Measured across the 24-park
      // corpus: 16 of 20 probed parks registered exactly one coaster, 3 none,
      // one two — and NOTHING in the rules or the rubric had ever asked for a
      // second. These fields are what axis 14 scores the ROSTER off.
      ratedCoasters: ratedRanked.map((c) => ({
        name: c.name, archetype: c.archetype, type: c.type,
        excitement: c.excitement, intensity: c.intensity, nausea: c.nausea,
        intensityBand: bandOf(c.intensity), ratingBand: c.ratingBand,
        inversions: c.inversions, dropCount: c.dropCount, length: c.length,
      })),
      archetypes,
      distinctArchetypes: archetypes.filter((a) => a !== 'custom').length + (archetypes.includes('custom') ? 1 : 0),
      secondCoaster: second
        ? {
            name: second.name, archetype: second.archetype,
            excitement: second.excitement, intensity: second.intensity,
            intensityBand: bandOf(second.intensity), ratingBand: second.ratingBand,
          }
        : null,
      /** true when a SECOND rated coaster exists and is a different archetype */
      secondDistinctArchetype: !!(second && flagship && second.archetype !== flagship.archetype),
      /** …AND is a real ride rather than a kiddie filler. The published shelves
       *  do not overlap: the LOW-THRILL legacy shapes top out at E 1.11 and the
       *  §4.0 shelf floors at E 5.27, so 4.0 sits in the empty gap between them
       *  and is not an invented number. Without this, `hollowmere2` — the ONLY
       *  corpus park with two coasters — would collect the second-coaster credit
       *  for a legacy filler rating **E 1.1**, which is exactly the padding the
       *  roster term exists to refuse. */
      secondCoasterFloor: 4.0,
      secondCoasterQualifies: !!(second && second.excitement >= 4.0),
      /** true when the second coaster also sits in a different intensity BAND */
      secondDistinctBand: !!(second && flagship && bandOf(second.intensity) !== bandOf(flagship.intensity)),
      /** max − min intensity over the RATED coasters (0 with a single coaster) */
      intensitySpread: intensities.length ? +(Math.max(...intensities) - Math.min(...intensities)).toFixed(2) : null,
      coasterIntensityBands: [...new Set(rated.map((c) => bandOf(c.intensity)))].sort(),
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
    // ---- wave-11 P3: THE PROBE AND THE GATE MUST NOT DISAGREE --------------
    // Round 10 shipped a park where `probe.accessibility.perRideReachable` said
    // Skyspire Lookout's queue was reachable while the gate's blocker-aware
    // sweep said every route to it passed through a solid. Two mechanisms, two
    // answers, same ride — and the report the score is read off was the one
    // that was wrong. The probe now walks the SAME graph the GameManager
    // routes on (`mgr.edgeWalkable`, which refuses a span through a registered
    // blocker); the unfiltered walk is kept alongside it purely so a
    // "reachable on paper, blocked in fact" ride can be told apart from one
    // that has no path at all.
    let walkable = null;
    try { walkable = mgr && typeof mgr.edgeWalkable === 'function' ? mgr.edgeWalkable : null; } catch { /* ignore */ }
    const bfs = (gate) => {
      const seen = new Uint8Array(net.nodes.length);
      if (!(access.entranceNode >= 0 && access.entranceNode < net.nodes.length)) return seen;
      const q = [access.entranceNode]; seen[access.entranceNode] = 1;
      while (q.length) {
        const c = q.pop();
        for (const n of adj[c]) {
          if (seen[n]) continue;
          if (gate && !gate(c, n)) continue;
          seen[n] = 1; q.push(n);
        }
      }
      return seen;
    };
    const reachOpen = bfs(null);
    // AUTHORITATIVE: blockers respected, exactly like validatePark's check d3
    const reach = walkable ? bfs((a, b) => { try { return !!walkable(a, b); } catch { return true; } }) : reachOpen;
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
    const perRide = (access.rides || []).map((r) => {
      const qOpen = r.queueNode >= 0 ? !!reachOpen[r.queueNode] : false;
      const xOpen = r.exitNode >= 0 ? !!reachOpen[r.exitNode] : false;
      const q = r.queueNode >= 0 ? !!reach[r.queueNode] : false;
      const x = r.exitNode >= 0 ? !!reach[r.exitNode] : false;
      return {
        name: r.name, queueNode: r.queueNode, exitNode: r.exitNode,
        // blocker-aware (the gate's answer)
        queueReachable: q,
        exitReachable: x,
        // path-graph only — a TRUE here with a FALSE above means every route
        // to this ride runs through something solid (the gate FAILs 'blockers')
        queueReachableIgnoringBlockers: qOpen,
        exitReachableIgnoringBlockers: xOpen,
        blockedBySolid: (qOpen && !q) || (xOpen && !x),
      };
    });
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
      blockerAware: !!walkable,
      perRideReachable: perRide,
      allRidesReachable: perRide.length > 0 && perRide.every((r) => r.queueReachable && r.exitReachable),
      ridesBlockedBySolid: perRide.filter((r) => r.blockedBySolid).map((r) => r.name),
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
    // CELL LISTS, not just sizes (2026-07): the composition composes TWO water
    // bodies on any plot >= 64, so RUBRIC axis 8 now scores the secondary body's
    // SIZE RATIO and the GAP between the two waterlines, and neither is
    // derivable from a list of areas.
    const bodies = [];
    for (let s = 0; s < N * N; s++) {
      if (!wet[s] || seen[s]) continue;
      const cells = []; const stack = [s]; seen[s] = 1;
      while (stack.length) {
        const c = stack.pop(); cells.push(c);
        const cx = c % N, cz = (c / N) | 0;
        for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]]) {
          if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
          const k = nz * N + nx;
          if (wet[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
        }
      }
      bodies.push(cells);
    }
    bodies.sort((x, y) => y.length - x.length);
    const a = cell * cell;
    /** shortest distance between the two biggest bodies' wet cells, in units.
     *  Brute force (a few 10 000s of pairs) on the probe's own 96² grid, so it
     *  is quantised to ~`cell` u — plenty against a 7-u rule. */
    let gap = null;
    if (bodies.length >= 2) {
      let best = Infinity;
      const xz = (c) => [-half + ((c % N) + 0.5) * cell, -half + (((c / N) | 0) + 0.5) * cell];
      for (const c of bodies[0]) {
        const [ax, az] = xz(c);
        for (const d of bodies[1]) {
          const [bx, bz] = xz(d);
          const dd = Math.hypot(ax - bx, az - bz);
          if (dd < best) best = dd;
        }
      }
      gap = r2(best);
    }
    // MINIMUM BODY AREA IS SIZE-RELATIVE (fixed 2026-07-25). It used to be a
    // flat 0.5 u², which was fitted when the plot default was 16 and this 96²
    // grid's cell was 0.028 u². At the 128 default one cell is (128/96)² =
    // 1.78 u² and at 192 it is 4 u², so a SINGLE-CELL speck cleared the 0.5
    // floor and reported as a whole extra water body — `worlds-ref` measured
    // `bodyCount: 3` with areas [261.3, 112.0, 1.78] while `validatePark`'s own
    // flood fill (a `waterGridStep(S)` = 1.0-u grid at 128) said 2 and passed.
    // Axis 8 reads "3+ = scatter, cap 2 pts", so a probe artefact was costing a
    // clean park 4 points. A body must now be at least TWO grid cells, i.e. big
    // enough for this grid to actually resolve. THE GATE IS AUTHORITATIVE on
    // the count; `bodyCountRaw` keeps the unfiltered number visible.
    const minBodyArea = Math.max(0.5, 2 * a);
    out.water.terrainWater = {
      waterLevel: wl, areaUnits2: r2(wetCells * a), fractionOfPark: r2((wetCells * a) / (S * S)),
      bodyCount: bodies.filter((b) => b.length * a >= minBodyArea).length,
      bodyCountRaw: bodies.length,
      gridCellArea: r2(a),
      minBodyArea: r2(minBodyArea),
      bodyAreas: bodies.slice(0, 8).map((b) => r2(b.length * a)),
      // two-body rule (RUBRIC axis 8): the secondary must be >= 16% of the
      // dominant body and >= max(5, 0.055 * size) u clear of its waterline
      secondFrac: bodies.length >= 2 ? r2(bodies[1].length / bodies[0].length) : null,
      bodyGap: gap,
      bodiesWanted: S >= 64 ? 2 : 1,
      gapRequired: r2(Math.max(5, 0.055 * S)),
    };
  } else out.notes.push('no ground sampler — terrain water area not estimated');

  // ---- terrain normality ----
  if (store && store.ground) {
    const S = store.ground.size, half = S / 2, N = 64, cell = S / N;
    let mn = Infinity, mx = -Infinity, sum = 0, sum2 = 0, maxSlopeCoarse = 0;
    const h = (x, z) => store.ground.heightAt(x, z);
    for (let iz = 0; iz <= N; iz++)
      for (let ix = 0; ix <= N; ix++) {
        const x = -half + ix * cell, z = -half + iz * cell;
        const v = h(x, z);
        mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; sum2 += v * v;
        maxSlopeCoarse = Math.max(maxSlopeCoarse, Math.abs(h(x + cell, z) - v) / cell, Math.abs(h(x, z + cell) - v) / cell);
      }
    // maxSlope ON A FIXED WORLD PITCH (fixed 2026-07-25). The field statistics
    // above converge on a 64² grid whatever the plot is, but a GRADIENT does
    // not: the old maxSlope used the same 64² stencil, so its finite difference
    // spanned S/64 u — 0.25 u at size 16, 0.75 at 48, 2.0 at 128, 3.0 at 192.
    // A big plot therefore averaged its own mountain flanks flat and a small
    // one resolved every step: `demo-ref` (16) read 3.10 while
    // `seedcheck-s1-192` (192) read 0.95 over MUCH stronger relief. RUBRIC axis
    // 7's "maxSlope under ~3" was fitted on the size-16 stencil and meant
    // nothing at the current default. Both are now published: `maxSlope` is
    // measured on a FIXED 0.6-u pitch (the half lattice cell — what a pad or a
    // path slab actually stands on) and is comparable across sizes;
    // `maxSlopeCoarse` is the old size-relative number, kept so older
    // probe.json readings stay interpretable.
    const SLOPE_PITCH = 0.6;
    const M = Math.min(512, Math.max(16, Math.round(S / SLOPE_PITCH)));
    const sCell = S / M;
    let maxSlope = 0;
    for (let iz = 0; iz <= M; iz++)
      for (let ix = 0; ix <= M; ix++) {
        const x = -half + ix * sCell, z = -half + iz * sCell;
        const v = h(x, z);
        maxSlope = Math.max(maxSlope, Math.abs(h(x + sCell, z) - v) / sCell, Math.abs(h(x, z + sCell) - v) / sCell);
      }
    const n = (N + 1) * (N + 1), mean = sum / n;
    out.terrain = {
      // the composed climate — axis 8's water bands are PER-CLIMATE and the
      // probe used not to say which one to score against (2026-07-25)
      climate: (store.ground.comp && store.ground.comp.climate) || null,
      size: S,
      minH: r2(mn), maxH: r2(mx), meanH: r2(mean),
      stdH: r2(Math.sqrt(Math.max(0, sum2 / n - mean * mean))),
      maxSlope: r2(maxSlope),
      slopePitch: r2(sCell),
      maxSlopeCoarse: r2(maxSlopeCoarse),
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

  // ---- WORLDS: world variety + theme coherence (axis 16) ------------------
  // Read STRAIGHT off the design system's own settle-time audit
  // (`ParkBuilder/worlds.ts: auditWorldThemes`, published on the store by
  // <Park> as `_worldAudit`). The probe deliberately does NOT re-derive theme
  // membership: `validatePark`'s `crossTheme` warnings and this object come
  // from ONE function, so the gate and the rubric can never disagree about
  // which piece is in the wrong world.
  //
  // A park that declares no <World> yields `declared: 0` and empty lists —
  // which is exactly what every park predating the world layer reports, and
  // what the Worlds axis scores 0 on (RUBRIC.md axis 16).
  {
    const wa = (store && store._worldAudit) || null;
    const declaredRegions = (store && store._worlds) || [];
    if (!wa) {
      if (declaredRegions.length)
        out.notes.push(`${declaredRegions.length} <World> region(s) declared but no _worldAudit — <Park> never reached its settle effect`);
      out.worlds = {
        declared: declaredRegions.length,
        presets: [], presetCount: 0, unusedPresets: null,
        worlds: [], themedPieces: [], taggedCount: 0,
        crossTheme: [], crossThemeCount: 0, unplacedThemed: [], neutralCount: 0,
        separation: { pairs: [], maxCentre: null, minCentre: null, minGap: null },
        audited: false,
      };
    } else {
      const themed = wa.pieces.filter((p) => p.themeId);
      out.worlds = {
        declared: wa.declared,
        presets: wa.presets,
        presetCount: wa.presetCount,
        unusedPresets: wa.unusedPresets,
        // per-world BUILD-OUT: is each declared region a real district?
        worlds: wa.worlds,
        builtCount: wa.worlds.filter((w) => w.built).length,
        // every themed piece with the world it stands in (neutral pieces are
        // counted, not listed — they are legal everywhere by design)
        themedPieces: themed.slice(0, 250),
        themedCount: themed.length,
        taggedCount: wa.pieces.length,
        // pieces the audit found WITHOUT a `dsComponent` tag and had to identify
        // by their registered ride name (`<Coaster>`/`<FlatRide>`, which set
        // `userData.rideRef` and nothing else). Published so a TAGGING HOLE is
        // visible in the artefact: until wave 16B such a group was DROPPED by
        // the sweep, and a world holding a real ride reported `rideCount: 0`
        // (r16b's thornwick — `worldNotBuiltOut` on a district that was built).
        untaggedCount: wa.untaggedCount ?? null,
        untagged: (wa.untagged || []).slice(0, 60),
        neutralCount: wa.neutralCount,
        // THE COHERENCE DEFECT, with coordinates
        crossTheme: wa.crossTheme,
        crossThemeCount: wa.crossThemeCount,
        unplacedThemed: wa.unplacedThemed,
        separation: wa.separation,
        audited: true,
      };
    }
  }

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
          // ADDITIVE: guests carried from one monorail platform to a DIFFERENT
          // one — the behavioural proof a transport ride TRANSPORTS
          transfers: s.transfers ?? 0,
        }
      : null;
    // `sim: null` is what axis 1 (cleanliness: litter/poop/vomit/happiness)
    // reads, and `null` there used to be indistinguishable from a spotless park.
    if (!out.sim) out.notes.push('no manager stats — sim/cleanliness counters not measured');
  } catch (e) {
    out.sim = null;
    out.notes.push(`manager.stats() threw — sim/cleanliness counters not measured: ${String((e && e.message) || e)}`);
  }

  // ---- THE PARK-SPANNING MONORAIL (required — rules §0 check / §3, §4.2) ----
  //
  // WHY THIS IS A PROBE FIELD AND NOT A LOOK AT THE RENDER. A monorail whose
  // `compileTrackPieces` report is FATAL renders translucent red and SKIPS the
  // GameManager registration entirely: no station, no queue, no boarding, and
  // the park's TRANSPORT category reads EMPTY with nothing in the report. That
  // shipped twice. Everything needed to catch it is measured here:
  //
  //   present / registered / circuitClosed / synthesized / worstClearance
  //   stations[]      — per PLATFORM: its queue node, its exit node, its exit
  //                     footpath length. RCT2 gives a ride an ARRAY of stations
  //                     (ride/Ride.h:404) and EVERY one of them needs its own
  //                     connected queue and exit, exactly like a one-station
  //                     ride (`STR_EXIT_NOT_CONNECTED`, Ride.cpp:2076).
  //   worldsTouched   — how many DECLARED <World> regions the beam corridor
  //                     passes through. "Connects the worlds" is the user
  //                     requirement; this is the number that measures it.
  //   transfers       — sim-measured A→B rides (see out.sim.transfers)
  {
    const mono = { present: false, registered: false, kind: null };
    // the scene group: <Monorail> tags itself via composable's tagComponent
    let monoGroup = null;
    scene.traverse((o) => {
      if (monoGroup || !o.userData) return;
      if (o.userData.trackReport && o.userData.dsComponent === 'Monorail') monoGroup = o;
      else if (o.userData.dsComponent === 'Monorail') monoGroup = o;
      else if (o.userData.evalRideKind === 'Monorail') monoGroup = o;
    });
    const rep = monoGroup && monoGroup.userData ? monoGroup.userData.trackReport : null;
    const monoRide = (mgrRides || []).find((r) => (r.stationCount ?? 1) > 1 || /monorail/i.test(r.name || ''));
    const monoAccess = access && access.rides ? access.rides.find((r) => /monorail/i.test(r.name || '')) : null;
    mono.present = !!(monoGroup || monoRide || monoAccess);
    mono.registered = !!monoRide;
    mono.name = (monoRide && monoRide.name) || (monoAccess && monoAccess.name) || null;
    if (rep) {
      mono.circuitClosed = !!(rep.closure && rep.closure.closed);
      mono.closureGap = rep.closure ? r2(rep.closure.gap) : null;
      mono.synthesized = rep.closure ? rep.closure.synthesized : null;
      mono.synthesizedCount = rep.closure ? rep.closure.synthesized.length : null;
      mono.worstClearance = rep.valid ? r2(rep.valid.worst) : null;
      mono.validateSplineOk = rep.valid ? !!rep.valid.ok : null;
      mono.fatal = !!rep.fatal;
      mono.fatalReason = rep.fatalReason ?? null;
      mono.compilerWarnings = rep.warnings ? rep.warnings.length : null;
      mono.deckCount = rep.stations ? rep.stations.length : null;
      // ---- DECK CENTRES ARE PUBLISHED IN WORLD SPACE (fixed 2026-07-26) ----
      // THE DEFECT. `rep.stations[].center` is produced by `compileTrackPieces`,
      // which <Monorail> calls with `start: [0, beamY, 0]` — the component's OWN
      // local frame (Monorail/index.tsx:220) — and `useComposable` mounts
      // `built.group` (the object carrying `userData.trackReport`) as a CHILD of
      // a wrapper group that holds the `position`/`rotation`/`scale` props
      // (composable.tsx:122-127). So the raw centres are the ring TEMPLATE, not
      // where the decks stand. At §0-P.4's mandated mount
      // `position={[-42.6, 0, -9.7]}` every published centre was off by exactly
      // that vector — six probed parks all reported the IDENTICAL
      // `[0,2.6,1.3] · [42.6,2.6,43.9] · [85.2,2.6,1.3] · [42.6,2.6,-41.3]`
      // while their `stations[].boardPoint` (from the manager's accessPoints(),
      // already world space) read `[-42.6,2.6,-8.4] · [0,2.6,34.2] ·
      // [42.6,2.6,-8.4] · [0,2.6,-51]`: a uniform (−42.6, 0, −9.7) offset.
      // rules §0-P.1 asks authors to walk the 16 ring cells against the
      // waterline, so a local-frame `deckCenters` sends them to the WRONG 16
      // cells — and half the ring template lands at x=85.2, off a ±64 plot.
      // `localToWorld` walks the whole ancestor chain, so it is correct however
      // deep the mount wrapper nests.
      monoGroup.updateWorldMatrix(true, false);
      const deckToWorld = (c) => {
        const v = new T.Vector3(c[0], c[1], c[2]);
        monoGroup.localToWorld(v);
        return [r2(v.x), r2(v.y), r2(v.z)];
      };
      mono.deckCenters = rep.stations ? rep.stations.map((st) => deckToWorld(st.center)) : null;
      mono.deckCenterFrame = 'world';
      /** the raw compiler output, kept so the ring TEMPLATE is still inspectable
       *  (and so a frame regression is visible as the two agreeing) */
      mono.deckCentersLocal = rep.stations ? rep.stations.map((st) => [r2(st.center[0]), r2(st.center[1]), r2(st.center[2])]) : null;
      mono.mountOffset = (() => {
        const o = new T.Vector3();
        monoGroup.localToWorld(o);
        return [r2(o.x), r2(o.y), r2(o.z)];
      })();
      mono.beamY = mono.deckCenters && mono.deckCenters.length ? mono.deckCenters[0][1] : null;
    } else {
      mono.circuitClosed = null;
      mono.fatal = null;
      mono.note = mono.present ? 'no userData.trackReport — the monorail is running its DEFAULT shuttle, not a `pieces` circuit' : 'no <Monorail> in the scene';
    }
    // PER-PLATFORM connectivity, off the manager's own accessPoints()
    const stRows = (monoAccess && monoAccess.stations) || null;
    mono.stationCount = stRows ? stRows.length : (monoRide && monoRide.stationCount) || null;
    mono.stations = stRows
      ? stRows.map((st) => ({
          idx: st.idx,
          label: st.label,
          boardPoint: st.boardPoint ? st.boardPoint.map(r2) : null,
          queueNode: st.queueNode,
          queueAttached: st.queueNode >= 0,
          exitNode: st.exitNode,
          exitLaneLen: r2(st.exitLaneLen),
          // RCT2's STR_EXIT_NOT_CONNECTED (Ride.cpp:2076) is exactly len === 0
          exitConnected: st.exitLaneLen > 0,
          exitAt: st.exitAt ? st.exitAt.map(r2) : null,
        }))
      : null;
    mono.everyStationQueued = mono.stations ? mono.stations.every((st) => st.queueAttached) : null;
    mono.everyStationExitConnected = mono.stations ? mono.stations.every((st) => st.exitConnected) : null;
    // HOW MANY DECLARED WORLDS THE CIRCUIT PASSES THROUGH. A <World> region is
    // a rect; the beam's polyline is sampled and tested against each.
    const regions = (store && store._worlds) || [];
    if (regions.length && monoGroup) {
      // the DECK centres plus a dense walk of the beam's own world-space
      // bounding ring: what "the circuit passes through this world" means is
      // that some part of the beam corridor lies inside the region rect
      // WORLD space — `mono.deckCenters`, not the raw `st.center` local frame.
      // Same defect as the deckCenters one above: the deck-centre probes into
      // each <World> rect were being made in the ring's untranslated template
      // frame (the bbox walk below was always world space, which is why
      // `worldsTouched` was only PARTLY wrong rather than obviously wrong).
      const pts = (mono.deckCenters || []).map((c) => [c[0], c[2]]);
      try {
        const bb = new T.Box3().setFromObject(monoGroup);
        const STEP = 1.2;
        for (let x = bb.min.x; x <= bb.max.x; x += STEP) {
          pts.push([x, bb.min.z], [x, bb.max.z]);
        }
        for (let z = bb.min.z; z <= bb.max.z; z += STEP) {
          pts.push([bb.min.x, z], [bb.max.x, z]);
        }
      } catch { /* no bbox — deck centres alone */ }
      // a <World> region is `WorldRegionRec { cx, cz, hx, hz }`
      // (ParkBuilder/worlds.ts:185) — grown by the 1.6-u track corridor half
      const inRegion = (w, x, z) =>
        Math.abs(x - w.cx) <= (w.hx ?? 0) + 1.6 && Math.abs(z - w.cz) <= (w.hz ?? 0) + 1.6;
      const touched = regions.filter((w) => pts.some(([x, z]) => inRegion(w, x, z)));
      mono.worldsDeclared = regions.length;
      mono.worldsTouched = touched.length;
      mono.worldsTouchedIds = touched.map((w) => w.id ?? null);
      mono.everyWorldTouched = touched.length === regions.length;
    } else {
      mono.worldsDeclared = regions.length;
      mono.worldsTouched = null;
      mono.everyWorldTouched = null;
    }
    out.monorail = mono;
  }
  // `__parkReport` is now published by an eval-tag injection on parkRoot.tsx
  // (evaltags.mjs), NOT only by a park that hand-wires `<Park onReady>` to set
  // it. `__parkSettled` separates "the settle effect never ran" from "it ran and
  // the gate produced no report" — see the injection comment.
  out.validation = window.__parkReport ?? null;
  out.parkSettled = !!window.__parkSettled;

  return out;
});

// ---- PROVENANCE, recorded FIRST -------------------------------------------
// `parkSource` is the park's IDENTITY (corpus.mjs: `park` is identity, `name` is
// only a filename) and `probeName` is the `--name` that chose the output
// locations. Both are stamped here, before any gate can bail out, so even a
// `probe.UNMEASURED.json` says which park it came from — that is what makes a
// clobbered `shots/<name>/` detectable after the fact (`node corpus.mjs --audit`)
// instead of a report that could have come from anywhere.
report.parkSource = parkPath;
report.probeName = name;
report.probedAt = new Date().toISOString();

// ---- the SETTLE / VERDICT gate (was: silence, exit 0, validation: null) -----
report.settle = settle;
if (!settle.validated)
  fatal(
    'ALL (no validatePark verdict)',
    `${settle.reason} [settle: ${settle.ms} ms, flushed: ${settle.flushed}, buildsFlushed: ${settle.buildsFlushed}, buildsLeft: ${settle.buildsLeft}, parkSettled: ${settle.parkSettled}]`,
  );
else if (!report.validation && !report.parkSettled)
  fatal('ALL (verdict logged but not captured)', 'the console carries a validatePark line but window.__parkReport was never published — the parkRoot.tsx eval-tag anchor has drifted (run `node evaltags.mjs --audit-anchors`)');

// ---- every page-side `notes` entry that means A MEASUREMENT IS MISSING -------
// These were pushed onto `report.notes` and otherwise ignored: the axis they
// feed came back `null`, the report shipped with exit 0, and a scorer reading
// `thrill.ratedCount: 0` / `layout: null` / `accessibility: null` had no way to
// tell "the park has none" from "the harness could not look". Each one names the
// RUBRIC axis it silently zeroed.
const NOTE_IS_FATAL = [
  [/no __stageApi/, 'ALL — no Stage scene on the page, nothing was measured'],
  [/no __THREE on window/, 'ALL — three.js not exposed, every geometry axis is unmeasured'],
  [/no __evalPark store/, 'ALL — the ParkStore was never exposed, so paths/terrain/manager axes are unmeasured'],
  [/no __evalRateCoaster/, 'axis 4 THRILL — rateCoaster was not reachable, so ratedCount/flagshipExcitement/archetypes are unmeasured, not zero'],
  [/rateCoaster threw/, 'axis 4 THRILL — a coaster rating threw, so its excitement/intensity are unmeasured'],
  [/accessibility not computed/, 'axis 2 ACCESSIBILITY — unmeasured'],
  [/no ground sampler/, 'axis 8 WATER / terrain — wet area unmeasured'],
  [/no <Paths> record/, 'axes 1/15 PATHS + LAYOUT — unmeasured'],
  [/but no _worldAudit/, 'axis 16 WORLDS — the world/theme audit never ran, so crossTheme and per-world build-out are unmeasured'],
  [/sim\/cleanliness counters not measured/, 'axis 1 CLEANLINESS — litter/poop/vomit/happiness unmeasured, NOT zero'],
];
for (const note of report.notes ?? [])
  for (const [re, axis] of NOTE_IS_FATAL) if (re.test(note)) fatal(axis, note);

// BUILD LINTS + GATE WARNINGS (added 2026-07-25). `probe.validation` is only
// populated for a park whose component sets `window.__parkReport` — which in
// practice is `DemoPark` and nothing else — so for every other park the probe
// carried the verdict but NOT the lint KINDS behind it, and a scorer had to run
// `w7-check.mjs` a second time to learn whether "ok: true" hid a `laneTrim` or
// a `deadStreetNode`. Both are parsed off the console here, with the same two
// regexes `w7-check.mjs` uses: `[Park] lint [kind]` / `[Park] FATAL LINT [kind]`
// for build-time auto-fixes, and the `[Park] validatePark warnings (…)` JSON
// dump for the findings validatePark raises ITSELF (deadStreetNode,
// waterRePicked, waterShrunk, crossTheme …), which never go through reportLint.
const lintKinds = {};
for (const l of lines.filter((l) => /\[Park\] (FATAL LINT|lint) \[/.test(l))) {
  const m = l.match(/(?:FATAL LINT|lint) \[([\w:]+)\]/);
  if (m) lintKinds[m[1]] = (lintKinds[m[1]] ?? 0) + 1;
}
const gateKinds = {};
for (const m of lines.filter((l) => /validatePark warnings/.test(l)).join('\n').matchAll(/"kind":\s*"([\w:]+)"/g))
  gateKinds[m[1]] = (gateKinds[m[1]] ?? 0) + 1;

// ---------------------------------------------------------------------------
// RENDER/PAGE FAILURES vs COMPONENT-REPORTED DEFECTS (split 2026-07-26, P0)
// ---------------------------------------------------------------------------
// `errors` was `lines.filter(l => /^\[(pageerror|error)\]/.test(l))` — i.e. ANY
// `console.error` — and RUBRIC.md:1084 ("`[pageerror]`/render errors cap the
// total at 40") was applied straight off it. Those are NOT the same set, and the
// conflation cost `r16a` 16.55 points twice over.
//
// MEASURED, r16a: TEN "errors", ZERO page errors. Eight `[error] [plan] FATAL …`
// lines from `buildParkNet`'s by-design degrade path — SETUP.md §0-P.5 says the
// plan builders "DEGRADE and record a plan lint by design" precisely so a bad
// plan does not take the page — plus two `[error] [Coaster] … FATAL track`
// lines. The park rendered completely, `validatePark` spoke, and all ten were
// ALREADY charged on their own axes (latticeInWater → 2, padOnStreet → 3, the
// fatal coasters → 14). The cap charged them a SECOND time: 56.55 → 40.
//
// THE THREE SHAPES THAT ACTUALLY OCCUR — enumerated over every stored
// probe.json under shots/ (2026-07-26), not assumed:
//
//   `[pageerror] Uncaught …`   page.on('pageerror'), evaltags.mjs:482. An
//                              exception reached the page. GENUINE FAILURE.
//   `[error] JSHandle@error`   a BARE `console.error(<Error object>)`, which
//                              puppeteer cannot serialise. In THIS harness that
//                              is React's own uncaught-render logger:
//                              react-dom 18.3.1's production bundle ships
//                              `function Li(a,b){try{console.error(b.value)}…}`
//                              (logCapturedError — verified by reading
//                              node_modules/react-dom/cjs/react-dom.production.min.js),
//                              and the page shell mounts a plain
//                              `createRoot().render()` with NO error boundary
//                              (evaltags.mjs:349), so a throwing render lands
//                              here. GENUINE FAILURE — and on the two parks that
//                              rendered NOTHING it is the only marker present
//                              (`w11d-hm2`: 17 of them, `validatorLine: null`).
//   `[error] [Prefix] …`       a COMPONENT-prefixed console.error: `[plan]`,
//                              `[Coaster]`, `[TrackRide:coaster]`, `[<ParkName>]`.
//                              The design system REPORTING a defect it survived.
//                              Not a render failure; charged on its own axis.
//
// Anything else is UNCLASSIFIED and says so, rather than being quietly folded
// into either bucket. That class is empty across the current corpus.
const errorLines = lines.filter((l) => /^\[(pageerror|error)\]/.test(l));
const isPageError = (l) => /^\[pageerror\]/.test(l);
const isUncaughtConsole = (l) => /^\[error\]\s*JSHandle@error\s*$/.test(l) || /^\[error\]\s*(Uncaught|Unhandled)\b/.test(l);
const componentPrefixOf = (l) => (/^\[error\]\s*\[([^\]]+)\]/.exec(l) || [])[1] ?? null;
const pageErrorLines = errorLines.filter((l) => isPageError(l) || isUncaughtConsole(l));
const componentErrorLines = errorLines.filter((l) => !isPageError(l) && !isUncaughtConsole(l) && componentPrefixOf(l));
const unclassifiedErrorLines = errorLines.filter((l) => !pageErrorLines.includes(l) && !componentErrorLines.includes(l));
const componentErrorPrefixes = {};
for (const l of componentErrorLines) {
  const p = componentPrefixOf(l);
  componentErrorPrefixes[p] = (componentErrorPrefixes[p] ?? 0) + 1;
}

report.consoleSummary = {
  totalLines: lines.length,
  validatorLine: lines.find((l) => /validatePark →/.test(l)) || null,
  validatorFails: lines.filter((l) => /validatePark FAIL/.test(l)),
  lintKinds,
  lintCount: Object.values(lintKinds).reduce((a, b) => a + b, 0),
  // only the kinds the gate raised that were NOT already reported as a build
  // lint — the same split w7-check.mjs prints as "gate warnings"
  gateWarningKinds: Object.fromEntries(Object.entries(gateKinds).filter(([k]) => !(k in lintKinds))),
  lintLines: lines.filter((l) => /\[Park\] (FATAL LINT|lint) \[/.test(l)).slice(0, 20),
  // ---- PLAN-TIME lints, straight off the bus (added 2026-07-27) -----------
  // `lintKinds`/`lintLines` above only see `[Park] lint […]` — the lines <Park>
  // emits AFTER MOUNT by reading the plan-lint bus. `reportPlanLint` also
  // console.warns `[plan] <kind>: …` the instant a plan builder records a
  // defect, at MODULE SCOPE, and nothing captured those.
  //
  // That gap hid the diagnosis on wave 25B. The park authored an off-lattice
  // bazaar position, `makeSetPiecePlan` snapped it 0.6 u and linted the move —
  // then the park's own STRUCTURAL `nodeInSolid` assertion threw at module
  // scope, so <Park> never mounted, the bus was never read, and the ONE line
  // naming the root cause was dropped by this summary. A module-scope throw is
  // precisely when plan lints matter most, because they are the only evidence
  // that survives it.
  planLintLines: lines.filter((l) => /\[plan\] /.test(l)).slice(0, 20),
  planLintKinds: Object.fromEntries(
    Object.entries(
      lines
        .filter((l) => /\[plan\] /.test(l))
        .reduce((acc, l) => {
          const m = l.match(/\[plan\] (?:FATAL )?([\w:]+):/);
          if (m) acc[m[1]] = (acc[m[1]] ?? 0) + 1;
          return acc;
        }, {}),
    ),
  ),
  // KEPT, and still the union of all three classes, so nothing downstream that
  // reads `errors` breaks silently — but it is NO LONGER what the 40-cap reads.
  errors: errorLines.slice(0, 20),
  /** GENUINE render/page failures — the ONLY input to RUBRIC.md's 40-point cap */
  pageErrors: pageErrorLines.slice(0, 20),
  /** a component reporting a defect it SURVIVED — charged on its own axis, never capped */
  componentErrors: componentErrorLines.slice(0, 20),
  /** `[error]` lines matching neither shape — reported, never silently bucketed */
  unclassifiedErrors: unclassifiedErrorLines.slice(0, 20),
  /** TRUE counts (the arrays above are sliced for size) */
  errorCounts: {
    total: errorLines.length,
    pageErrors: pageErrorLines.length,
    componentErrors: componentErrorLines.length,
    unclassified: unclassifiedErrorLines.length,
    byComponentPrefix: componentErrorPrefixes,
  },
  // the harness's OWN settle/flush trail, so `console.log` and `probe.json`
  // agree about how the verdict was obtained
  harnessLines: lines.filter((l) => /^\[harness\]/.test(l)),
  perfLine: lines.find((l) => /\[Park\] perf:/.test(l)) || null,
  // RAMPING (axis 12). THIS REGEX WAS BLIND UNTIL 2026-07-26. RUBRIC.md axis 12
  // names `rampObservations.causewayEdges`/`.steepEdges` and
  // `consoleSummary.rampSignals` as the authority for ramping, and round 15A
  // measured all three EMPTY on `r15a` while its own console.log carried **13**
  // `ramp lint: elevated node NN (+0.50) has no walkable-grade connection to the
  // ground network — deck unreachable` lines (nodes 91-94, 101-102, 105-108,
  // 120-122, from PathNetwork/build.ts). The old pattern matched
  // causeway/berm/scaffold/nodeY-ramp/float only, so the design system's ACTUAL
  // ramp lint — the one that says a deck is unreachable — never reached the
  // field the rubric reads, and the axis passed because nothing was looking.
  // ...AND IT OVER-MATCHED FROM THEN UNTIL 2026-07-27, in two ways, both
  // measured on w26b (a park with NO ramp defect at all, charged −1 on axis 12):
  //
  //   1. The AGGREGATE dump. `[Park] validatePark warnings (0 fatal / 7) → [ … ]`
  //      is a JSON container that RESTATES every other warning, so any park
  //      holding one berm-mentioning warning scored it twice — once as the lint
  //      line, once inside the dump. A container is never itself a signal.
  //   2. PROSE, not defects. The loose tokens (`berm`, `causeway`, `scaffold`,
  //      `floats`) also appear in EXPLANATORY text. `pathLevelMedian`'s own
  //      advice reads "…they get earth berms below 0.35 u and wooden supports
  //      above it", which is the design system telling the author how the ground
  //      is handled — not a report that anything is wrong.
  //
  // The specific tokens (`ramp lint`, `elevated node`, `deck unreachable`,
  // `walkable-grade`) are what actually caught the round-15A blindness and are
  // untouched; only the two false-positive shapes above are excluded. The axis
  // charges on this field, so a phantom entry is a real point.
  rampSignals: lines
    .filter((l) => /causeway|berm|scaffold|nodeY ramp|floats|floating|ramp lint|elevated node|deck unreachable|walkable-grade/i.test(l))
    .filter((l) => !/validatePark warnings \(/.test(l))
    .filter((l) => !/\[Park\] lint \[pathLevelMedian\]/.test(l))
    .slice(0, 40),
  // RIDE SPACING axis: the validator's own OBB footprint sweep — AUTHORITATIVE
  // over probe.rideSpacing's AABB gaps (see RUBRIC.md axis 3)
  footprintFails: lines.filter((l) => /validatePark FAIL \[footprints\]/.test(l)).slice(0, 10),
  coasterFails: lines.filter((l) => /validatePark FAIL \[coaster\]/.test(l)).slice(0, 10),
  corridorFails: lines.filter((l) => /validatePark FAIL \[corridor\]/.test(l)).slice(0, 10),
};

if (report.thrill) {
  const ran = !!report.consoleSummary.validatorLine;
  report.thrill.coasterGateOk = ran ? report.consoleSummary.coasterFails.length === 0 : null;
  // `coasterGateOk: null` used to be the ONLY trace that the coaster gate never
  // ran, and `null` is not `false` — axis 4 read it as "not applicable".
  if (!ran) fatal('axis 4 THRILL (coasterGateOk)', 'no validatePark line, so the coaster gate verdict is unknown — NOT "no coaster failures"');
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
    return {
      name: r.name, kind,
      category: c ? c.category : null,
      tracked: c ? c.tracked : null,
      circuitFamily: kind ? circuitFamilyOf(kind) : null,
      piecesMode: kind ? PIECES_MODE[kind] || null : null,
      at: r.at,
    };
  });
  const rideKinds = [...new Set([...perRide.map((r) => r.kind).filter(Boolean), ...Object.keys(srcRideHits)])].sort();
  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c] = []; });
  byCategory.unclassified = [];
  rideKinds.forEach((k) => { const c = catOf[k]; (byCategory[c ? c.category : 'unclassified'] || byCategory.unclassified).push(k); });
  const trackedKinds = rideKinds.filter((k) => catOf[k] && catOf[k].tracked);
  const coasterKinds = rideKinds.filter((k) => ['Coaster', 'TrackRide', 'SplineCoaster'].includes(k));
  const specialityKinds = trackedKinds.filter((k) => !coasterKinds.includes(k));

  // ---- THE CIRCUIT ROSTER (added 2026-07-26) ------------------------------
  // `tracked` is a SPECIALITY flag (it excludes the generic chassis on purpose);
  // `circuitFamily` is the PHYSICAL one — does a vehicle run along a track. The
  // rules now require a roster of CIRCUITS, not one flagship plus a field of
  // flat spinners, so these are the fields axes 13/14 score it on.
  const circuitRides = perRide.filter((r) => r.circuitFamily);
  const circuitKinds = rideKinds.filter((k) => circuitFamilyOf(k));
  const circuitFamilies = [...new Set(circuitKinds.map((k) => circuitFamilyOf(k)))].sort();
  const byCircuitFamily = {};
  CIRCUIT_FAMILIES.forEach((f) => { byCircuitFamily[f] = circuitKinds.filter((k) => circuitFamilyOf(k) === f); });

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
  // THE DENOMINATOR IS SNAPSHOTTED AND RECORDED (wave-16 P0). `signatures/` is a
  // shared mutable directory that every probe run WRITES INTO at the end, so a
  // wave whose parks probe CONCURRENTLY scores them against different corpora:
  // 16A and 16B overlapped, 16B measured `corpusSize 29`, and whether 16A's park
  // was inside that 29 depended on which run reached `saveSignature` first.
  // Re-running a wave then cannot reproduce its own novelty figures, and two
  // parks of one wave are not comparable.
  //
  // The corpus is now resolved ONCE, into an object that NAMES its members and
  // carries a content hash, and that stamp is written into probe.json. The three
  // corpus-derived figures (layout novelty, roster novelty, world-preset usage)
  // all read that ONE snapshot, so probe.json can no longer carry three
  // different denominators. `--corpus=<file>` pins an earlier stamp so a whole
  // wave can be scored against an identical corpus; `--no-signature` runs a
  // diagnostic park WITHOUT publishing it (an accidental scratch park has
  // polluted the corpus before — see corpus.mjs's de-duplication note).
  const pinArg = opt('corpus');
  let pinNames = null;
  if (pinArg) {
    const pinned = JSON.parse(fs.readFileSync(path.resolve(pinArg), 'utf8'));
    pinNames = Array.isArray(pinned) ? pinned : pinned.names;
    if (!Array.isArray(pinNames)) throw new Error(`--corpus=${pinArg} must be a JSON array of names, or an object with a \`names\` array`);
  }
  // `report.parkSource` (stamped right after the page evaluate) is the park's
  // IDENTITY (corpus.mjs: `park` is identity, `name` is only a filename). It is
  // what lets a LATER score-park.mjs run exclude this park from its own novelty
  // denominator by PATH — `samples/skeleton-b.tsx` is stored as `w18-skeleton-b`,
  // and a name-based exclusion left it scoring against a zero-distance copy of
  // itself.
  const corpusSnap = corpusSnapshot({ exclude: { name, park: report.parkSource }, pin: pinNames });
  const corpus = corpusSnap.records;
  report.corpusSnapshot = {
    ...corpusStampOf(corpusSnap),
    pinnedFrom: pinArg ? path.resolve(pinArg) : null,
    note:
      'THE EXACT novelty denominator this probe used. `sha256` covers each member\'s name + layoutSignature + ' +
      'rideKinds + stallKinds + worlds, so a re-probe that only refreshes `when` does not invalidate it. Pass this ' +
      'list back as `--corpus=<file>` to score another park of the same wave against an IDENTICAL corpus.',
  };
  if (corpusSnap.pinnedButMissing.length)
    report.notes.push(
      `--corpus pinned ${pinNames.length} signature(s) and ${corpusSnap.pinnedButMissing.length} are no longer on disk ` +
        `(${corpusSnap.pinnedButMissing.join(', ')}) — the novelty denominator is SMALLER than the pin asked for`,
    );
  if (layout) {
    layout.novelty = layoutNovelty(layout.signature, corpus);
    layout.noveltyThresholds = { distinct: 0.08, derivative: 0.04 };
  }
  const rideNov = rosterNovelty(rideKinds, corpus, 'rideKinds');
  const stallNov = rosterNovelty(stallKinds, corpus, 'stallKinds');
  const rideFreq = kindFrequency(corpus, 'rideKinds');
  const stallFreq = kindFrequency(corpus, 'stallKinds');

  // ---- WORLDS: the size-derived separation floor (axis 16) ----------------
  // The floor is the SAME published number the district test uses
  // (`districtSeparationFloor` in layout.mjs, shared with rules §0.3 check 4:
  // 20 u @48, 32.66 u @128, 40 u @192) — worlds ARE the districts now, so the
  // two must not drift apart.
  if (report.worlds) {
    const S = report.parkSize ?? (report.layoutRaw && report.layoutRaw.size) ?? 48;
    const floor = districtSeparationFloor(S);
    const sep = report.worlds.separation;
    report.worlds.separation = {
      ...sep,
      size: S,
      floor,
      // scored on the CLOSEST pair: every adjacent pair of worlds owes the
      // floor, so one well-separated pair must not excuse two worlds fused
      // into a single continuous fairground
      ok: sep.minCentre !== null ? sep.minCentre >= floor : null,
      source: 'districtSeparationFloor(size) — layout.mjs, shared with rules §0.3 check 4',
    };
    // WORLD CHOICE (axis 16, 2026-07-26): which presets does the CORPUS
    // under-use? Recomputed here from the same corpus the novelty axes use, so
    // the rubric never has to name a favourite preset in prose.
    report.worlds.presetUsage = underusedPresets(corpus);
    report.worlds.builtPresets = [...new Set((report.worlds.worlds || []).filter((x) => x.built).map((x) => x.themeId))]
      .filter((t) => t && t !== 'default');
    report.worlds.score = scoreWorlds(report.worlds);
  }

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
    // ---- CIRCUITS: the tracked-ride ROSTER (2026-07-26) -----------------
    // Registered circuits are the authority (`circuitRides`); `circuitKinds`
    // adds what the park FILE names, like the other kind lists here.
    circuitRides,
    circuitCount: circuitRides.length,
    circuitKinds,
    circuitFamilies,
    circuitFamilyCount: circuitFamilies.length,
    byCircuitFamily,
    flatRideCount: perRide.length - circuitRides.length,
    /** circuits BESIDES the highest-rated coaster — the roster test's input */
    circuitsBesidesFlagship: Math.max(0, circuitRides.length - 1),
    /** circuits whose `pieces` prop may be OMITTED with zero closure risk */
    noCompileCircuits: circuitKinds.filter((k) => PIECES_MODE[k] === 'conditional' || PIECES_MODE[k] === 'none'),
    unclassifiedKinds: byCategory.unclassified,
    sourceHits: srcRideHits, // kind -> JSX occurrences in the park's own source
    novelty: rideNov,
    noveltyThresholds: { distinct: 0.4, derivative: 0.25 },
    catalogSize: rideKindsCat.length,
    corpusKindFrequency: rideFreq,
    catalogNeverUsed: rideKindsCat.filter((k) => !(rideFreq[k] > 0) && !rideKinds.includes(k)),
    /** kinds THIS park ships that NO PRIOR corpus park ever has — the credit
     *  side of the never-used shelf (`catalogNeverUsed` is the debt side, and
     *  excludes this park's own picks, so a scorer needs both). Measured
     *  2026-07-26: 14 of the 27 CIRCUITS in the catalog were never-used. */
    firstUseKinds: rideKinds.filter((k) => !(rideFreq[k] > 0)),
    firstUseCircuits: circuitKinds.filter((k) => !(rideFreq[k] > 0)),
    // ---- THE HEADER'S ROSTER CLAIM (wave-10 P3) --------------------------
    // rules/park-generation.md §0.16 makes every park header publish a roster
    // line, and until wave 10 nothing compared it with reality: round 9's park
    // A claimed "9 registered rides, 5 categories" and shipped 8 rides in 3
    // categories, with `/* Monorail dropped from the roster … */` still in the
    // file. `<Park roster={…}>` lets the GATE check it, but that needs the
    // author to opt in — this reads the CLAIM straight out of the park's own
    // §0 header comment, so a park that never declares `roster` is still
    // audited. Purely a report field: the numbers below are what the axes are
    // scored on, and `overstated` is the header lying about them.
    headerClaim: (() => {
      let src = '';
      try { src = fs.readFileSync(file, 'utf8'); } catch { return null; }
      // ONLY the §0 header block comment, and only an explicit claim: "N
      // registered rides" (§0.16's wording) or a digit on a ROSTER line. A
      // bare "N rides" anywhere in the file is not a claim — `cinder-peak`
      // has `{/* Food (>=1 per 2 rides) */}` down in its JSX.
      const end = src.indexOf('*/');
      const header = end > 0 ? src.slice(0, end) : src.slice(0, 4000);
      const rosterLine = header.split('\n').find((l) => /\bROSTER\b/.test(l)) || '';
      const nRide = header.match(/(\d+)\s+registered\s+rides?\b/i) || rosterLine.match(/(\d+)\s+rides?\b/i);
      // ---- wave-11 P4: the "CATEGORIES: …" LINE, not just an "N categories"
      // count. Round 10's header wrote `CATEGORIES: thrill, water, gentle,
      // transport = 4+` — a NAMED LIST with the count spelled as `= 4+`, which
      // neither of the old patterns matched, so a park that claimed 4
      // categories and shipped 3 (an <ObservationTower> classifies GENTLE, not
      // transport) went unaudited. Parse the names, compare them by name.
      const catLine = header.split('\n').find((l) => /\bCATEGORIES\s*:/i.test(l)) || '';
      const catTail = catLine.replace(/^[^:]*:/, '');
      const namedCats = [...new Set(CATEGORIES.filter((c) => new RegExp(`\\b${c}\\b`, 'i').test(catTail)))];
      const nCat =
        header.match(/(\d+)\s+categor(?:y|ies)\b/i) ||
        rosterLine.match(/(\d+)\s+categor/i) ||
        catTail.match(/=\s*(\d+)/);
      if (!nRide && !nCat && !namedCats.length) return null;
      const claimRides = nRide ? Number(nRide[1]) : null;
      const claimCats = nCat ? Number(nCat[1]) : namedCats.length ? namedCats.length : null;
      const present = CATEGORIES.filter((c) => byCategory[c].length > 0);
      const actualCats = present.length;
      const missingNamed = namedCats.filter((c) => !present.includes(c));
      const over = [];
      if (claimRides !== null && registered.length < claimRides) over.push(`rides: claims ${claimRides}, registered ${registered.length}`);
      if (claimCats !== null && actualCats < claimCats) over.push(`categories: claims ${claimCats}, represented ${actualCats} (${present.join(', ') || 'none'})`);
      if (missingNamed.length)
        over.push(
          `categories NAMED but absent: ${missingNamed.join(', ')} — the header lists them, no registered ride classifies as one (represented: ${present.join(', ') || 'none'})`,
        );
      return {
        line: (nRide || nCat || [catLine.trim()])[0],
        categoriesLine: catLine.trim() || null,
        claimedRides: claimRides,
        claimedCategories: claimCats,
        claimedCategoryNames: namedCats,
        registeredRides: registered.length,
        representedCategories: actualCats,
        representedCategoryNames: present,
        missingClaimedCategories: missingNamed,
        overstated: over.length > 0,
        detail: over,
      };
    })(),
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
  // NOT when a measurement is missing: a signature built from a run that could
  // not obtain its verdict pollutes the novelty corpus for every LATER park with
  // an entry nobody can vouch for.
  //
  // ---- CORPUS MEMBERSHIP IS AN EXPLICIT ACT, NOT A SIDE EFFECT OF MEASURING --
  // (default INVERTED 2026-07-26, on the coordinator's call.)
  //
  // Publishing used to be the DEFAULT, so every probe run silently mutated the
  // shared novelty denominator of every other park. Three consequences, all
  // measured rather than hypothesised:
  //
  //   * TWO CONCURRENT WAVE AGENTS CHANGED EACH OTHER'S DENOMINATOR MID-RUN.
  //     Waves 16A and 16B overlapped; whether 16A's park was inside 16B's
  //     "29-park corpus" came down to which run reached this line first.
  //   * `signatures/` MOVED THREE TIMES DURING ONE SCORING SESSION (r16b,
  //     skeleton-a, w18-skeleton-b were rewritten by another process while the
  //     scorer was being fixed), and the corpus hash went 60e0cabe -> 4cd4c268.
  //   * THE SAME PARK SCORED 97.68 AND 96.18 ON IDENTICAL CODE, 1.5 points
  //     apart, purely from that drift. A yardstick that moves under the thing it
  //     is measuring is worse than the defects it is there to find.
  //
  // So: `--signature` (or an explicit corpus step) is now REQUIRED to publish.
  // The probe's own measurements are completely unaffected either way — the
  // corpus snapshot is resolved BEFORE this write and this park is never in its
  // own denominator — so the flag costs a legitimate corpus run nothing and
  // costs a diagnostic run nothing to omit.
  //
  // `--no-signature` is still accepted, so any caller that already passes it
  // keeps working and means exactly what it says. (`wantSignature` itself is
  // resolved at the TOP of this file — the name-ownership gate needs it before
  // the browser starts.)
  if (layout && !unmeasured.length && !wantSignature)
    console.error(
      `[probe] NO SIGNATURE PUBLISHED for "${name}" — corpus membership is opt-in since 2026-07-26. ` +
        `signatures/ is unchanged (${corpusSnap.size} parks, sha ${corpusSnap.sha256}). ` +
        `Pass --signature if this park is meant to JOIN the novelty corpus.`,
    );
  // The write is wrapped because the gate at the top of this file checked the
  // corpus BEFORE a ~2-minute render, and `signatures/` is shared and mutable:
  // another agent can publish `${name}.json` for a different park while this run
  // is in SwiftShader. `saveSignature` re-checks and throws
  // SIGNATURE_NAME_CONFLICT; the MEASUREMENT is still good, so probe.json is
  // still written — but the run exits non-zero, because a `--signature` run that
  // published nothing must not look like one that did.
  if (layout && !unmeasured.length && wantSignature) {
    try {
      const saved = saveSignature(
        {
          name,
          // provenance: the park's identity, the --name that owned the output
          // locations, and WHERE the measurement this signature summarises lives
          // (resign.mjs re-derives the layout vector from that probe.json, so an
          // entry that cannot name it silently drops out of every re-signing)
          park: parkPath,
          probeName: name,
          shots: name,
          when: new Date().toISOString(),
          size: report.layoutRaw.size,
          layoutSignature: layout.signature,
          gridRegularity: layout.gridRegularity,
          rideKinds,
          stallKinds,
          rideNames: (report.rideNames || []).slice(),
          stallNames: perStall.map((s) => s.name),
          // axis 16, so `calibrate.mjs` can print the WORLDS column without a
          // browser run (a park with no <World> is 0 by construction)
          worlds: report.worlds
            ? {
                declared: report.worlds.declared,
                presets: report.worlds.presets,
                builtPresets: report.worlds.score ? report.worlds.score.builtPresets : [],
                crossThemeCount: report.worlds.crossThemeCount,
                minCentreSeparation: report.worlds.separation ? report.worlds.separation.minCentre : null,
                separationFloor: report.worlds.separation ? report.worlds.separation.floor : null,
                score: report.worlds.score ? report.worlds.score.total : null,
                parts: report.worlds.score ? report.worlds.score.parts : null,
              }
            : null,
        },
        { reassign: reassignSignature },
      );
      report.signaturePublished = saved;
      console.error(`[probe] signature ${saved.action}: signatures/${saved.file} (name "${saved.name}", park ${saved.park})`);
    } catch (e) {
      if (e.code !== 'SIGNATURE_NAME_CONFLICT') throw e;
      console.error(e.message);
      console.error(`[probe] the MEASUREMENT is unaffected and probe.json is still written; only the corpus publication was refused.`);
      signaturePublishRefused = e.conflict;
    }
  }
}

await browser.close();

// ---------------------------------------------------------------------------
// THE GATE: a report without its measurements is NOT a park report
// ---------------------------------------------------------------------------
// Until 2026-07-26 this file always wrote `shots/<name>/probe.json` and always
// exited 0, so a run in which `validatePark` never spoke produced a complete-
// looking artefact with `validation: null` — and scoring consumed it. Now the
// probe refuses: it writes `probe.UNMEASURED.json` for diagnosis, leaves
// `probe.json` alone (a stale one is NAMED, never silently overwritten and
// never silently trusted), publishes NO signature into the corpus, and exits 1.
report.unmeasured = unmeasured;
const outDir = path.join(HERE, 'shots', name);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'probe.json');

if (unmeasured.length) {
  const failPath = path.join(outDir, 'probe.UNMEASURED.json');
  fs.writeFileSync(failPath, JSON.stringify(report, null, 2));
  console.error('');
  console.error(`[probe] FAILED — ${unmeasured.length} measurement(s) could not be obtained for "${name}". This is NOT a scoreable park report.`);
  for (const u of unmeasured) console.error(`  ✗ ${u.axis}\n      ${u.detail}`);
  if (!settle.validated) {
    console.error('');
    console.error('  The SETTLE TIMEOUT is the one to look at first:');
    const flushDesc = !settle.flushed
      ? 'did NOT run'
      : settle.flushError
        ? `THREW: ${settle.flushError}`
        : `ran (${settle.buildsFlushed} builds / ${settle.flushMs} ms)`;
    console.error(`    PARK_SETTLE_MS = ${settle.settleMs} ms · elapsed ${settle.ms} ms · flushBuilds ${flushDesc} · ${settle.buildsLeft} build(s) still queued`);
    console.error('    <Park> validates through ctx.whenBuilt(), which fires only when the store build queue drains.');
    console.error('    Raise PARK_SETTLE_MS, or find out why store.flushBuilds() did not finish the assembly.');
  }
  console.error('');
  console.error(`[probe] wrote the partial report to ${failPath} (for diagnosis only — do not score it)`);
  console.error(`[probe] no signature was published to signatures/ for "${name}"`);
  if (fs.existsSync(outPath))
    console.error(
      `[probe] WARNING: a PREVIOUS ${outPath} is still on disk and was NOT overwritten. It was produced by an earlier run; if that run also lacked a verdict its "validation" is meaningless. Verify or delete it deliberately.`,
    );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// LAST-MOMENT OWNERSHIP RE-CHECK (2026-07-27)
// ---------------------------------------------------------------------------
// The gate at the top of this file ran BEFORE the render, which is where it
// belongs (a refusal should not cost two minutes). But `shots/` is shared and
// mutable, so another probe can take `shots/<name>/` in the meantime. Here the
// measurement already exists and destroying it would be as bad as destroying the
// one on disk, so this case does NOT refuse: the report is written BESIDE the
// incumbent as `probe.CONFLICT.json`, nothing is overwritten, and the run exits
// non-zero so the artefact is never mistaken for `probe.json`.
{
  const late = reassignShots ? null : shotsConflict({ name, park: parkPath });
  if (late) {
    const sidePath = path.join(outDir, 'probe.CONFLICT.json');
    fs.writeFileSync(sidePath, JSON.stringify(report, null, 2));
    console.error(shotsConflictMessage(late));
    console.error('');
    console.error(`[probe] the conflict appeared DURING this run (the pre-flight gate was clear), so this park's complete report`);
    console.error(`[probe] was written to ${sidePath} and ${outPath} was left untouched. Nothing was lost; pick a name.`);
    process.exit(1);
  }
}

fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.error(`[probe] wrote ${outPath}  (parkSource ${report.parkSource})`);
console.log(JSON.stringify(report, null, 2));

// A `--signature` run whose publication was REFUSED mid-flight measured fine but
// did not do what it was asked to do, and must not exit 0.
if (signaturePublishRefused) {
  console.error(`[probe] EXIT 1: --signature was passed but signatures/${signaturePublishRefused.file} belongs to ${signaturePublishRefused.storedPark} — nothing was published.`);
  process.exit(1);
}
