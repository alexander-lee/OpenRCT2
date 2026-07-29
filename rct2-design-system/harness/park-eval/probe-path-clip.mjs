#!/usr/bin/env node
// PATH-vs-TERRAIN CLIP PROBE.
//
// "paths keep clipping with the land" is a VISUAL complaint with a purely
// numeric cause: the rendered path SURFACE at a point vs `heightAt` of the
// terrain underneath it. This probe mounts a park with the eval-tag store
// installed, then densely samples every span of the built network — along its
// length AND across its width (a ribbon 1.1 u wide sinks its uphill EDGE into
// a side-slope long before its centreline touches) — and reports the
// distribution of `surface - ground`:
//
//   sink  = ground ABOVE the path surface   (the path is buried: CLIPPING)
//   float = path surface above ground       (needs a berm/scaffold under it)
//
// It reads the walking surface the same way a guest does (`paths.walkYAt`,
// the sampler <Paths> stashes on the store), so what it measures is exactly
// what is drawn, not a re-derivation that could disagree with the renderer.
//
//   node probe-path-clip.mjs samples/worlds-ref.tsx [...]
//   PPC_JSON=1  dump the full per-park record as JSON
//   PPC_TOP=n   how many worst offenders to list (default 8)
import fs from 'node:fs';
import path from 'node:path';
import { bundleParkPage, openParkPage } from './evaltags.mjs';
import { HERE } from './paths.mjs';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node probe-path-clip.mjs <park.tsx> [...]');
  process.exit(1);
}
const TOP = Number(process.env.PPC_TOP || 8);

// The sampler runs INSIDE the page (it needs the live heightAt + walkYAt
// closures). Kept as a string so it is obvious nothing here touches node APIs.
const SAMPLE = `(() => {
  const s = window.__evalPark;
  if (!s) return { error: 'no __evalPark store' };
  if (!s.ground) return { error: 'no ground' };
  if (!s.paths) return { error: 'no paths' };
  const g = s.ground.heightAt;
  const P = s.paths;
  const walkYAt = P.walkYAt;
  if (!walkYAt) return { error: 'no walkYAt on paths info' };
  const nodes = P.net.nodes, edges = P.net.edges;
  const halfW = (P.width ?? 1.1) / 2;
  const inPlaza = (x, z) => (P.plazas || []).some(([cx, cz, w, d]) => Math.abs(x - cx) <= w / 2 + 0.05 && Math.abs(z - cz) <= d / 2 + 0.05);
  // Longitudinal step ~0.15 u, 3 lateral lanes (centre + both kerbs, pulled in
  // 0.02 so we sample the SLAB not the air beside it).
  const STEP = 0.15;
  const samples = [];
  for (let ei = 0; ei < edges.length; ei++) {
    const [a, b] = edges[ei];
    const A = nodes[a], B = nodes[b];
    if (!A || !B) continue;
    const dx = B[0] - A[0], dz = B[1] - A[1];
    const L = Math.hypot(dx, dz);
    if (!(L > 1e-6)) continue;
    const nx = -dz / L, nz = dx / L;
    const n = Math.max(2, Math.ceil(L / STEP));
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const cx = A[0] + dx * u, cz = A[1] + dz * u;
      for (const lat of [-(halfW - 0.02), 0, halfW - 0.02]) {
        const x = cx + nx * lat, z = cz + nz * lat;
        const surf = walkYAt(x, z);
        const gh = g(x, z);
        samples.push({ x: +x.toFixed(2), z: +z.toFixed(2), e: ei, u: +u.toFixed(3), lat: +lat.toFixed(2), d: +(surf - gh).toFixed(4), plaza: inPlaza(x, z) });
      }
    }
  }
  // plaza slabs: sample the rectangle interior on a 0.6 grid
  for (const [cx, cz, w, d] of (P.plazas || [])) {
    for (let x = cx - w / 2; x <= cx + w / 2 + 1e-6; x += 0.6)
      for (let z = cz - d / 2; z <= cz + d / 2 + 1e-6; z += 0.6)
        samples.push({ x: +x.toFixed(2), z: +z.toFixed(2), e: -1, u: 0, lat: 0, d: +(walkYAt(x, z) - g(x, z)).toFixed(4), plaza: true });
  }
  return {
    pathY: P.pathY, plazaY: P.plazaY, width: P.width,
    nodes: nodes.length, edges: edges.length, plazas: (P.plazas || []).length,
    waterLevel: s.ground.waterLevel,
    nodeY: (P.nodeY || []).filter((v) => Math.abs(v || 0) > 1e-6).length,
    samples,
  };
})()`;

function stats(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
  return { n: s.length, min: +s[0].toFixed(3), p05: +q(0.05).toFixed(3), p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), max: +s[s.length - 1].toFixed(3) };
}

const out = {};
let worstAll = 0;
for (const f of files) {
  const nm = path.basename(f).replace(/\.tsx$/, '');
  const name = `ppc-${nm}`;
  let rec;
  try {
    const html = await bundleParkPage(f, name);
    const r = await openParkPage(html, { waitMs: Number(process.env.PPC_WAIT || 9000) });
    rec = await r.page.evaluate(SAMPLE);
    // did <Park>'s settle pass move the ground out from under the paths?
    if (rec && !rec.error) rec.reclamped = r.lines.some((l) => /AUTO-keepDry/.test(l));
    await r.browser.close();
  } catch (e) {
    console.log(`\n=== ${nm}\n  RUN ERROR ${e.message}`);
    continue;
  }
  if (rec.error) {
    console.log(`\n=== ${nm}\n  ${rec.error}`);
    continue;
  }
  const ss = rec.samples;
  const d = ss.map((p) => p.d);
  const sinks = ss.filter((p) => p.d < 0);
  const maxSink = sinks.length ? -Math.min(...sinks.map((p) => p.d)) : 0;
  const floats = ss.filter((p) => p.d > 0.35);
  const worst = [...ss].sort((a, b) => a.d - b.d).slice(0, TOP);
  // one worst point per edge, so the list is not 8 samples of the same span
  const byEdge = new Map();
  for (const p of ss) {
    const cur = byEdge.get(p.e);
    if (!cur || p.d < cur.d) byEdge.set(p.e, p);
  }
  const worstEdges = [...byEdge.values()].sort((a, b) => a.d - b.d).slice(0, TOP);
  const byEdge2 = new Map();
  for (const p of ss) {
    const cur = byEdge2.get(p.e);
    if (!cur || p.d > cur.d) byEdge2.set(p.e, p);
  }
  const clipEdges = [...byEdge.values()].filter((p) => p.d < -0.02).length;
  worstAll = Math.max(worstAll, maxSink);
  // WHERE does it sink? A ribbon level ACROSS its width buries its uphill
  // KERB on a side-slope long before its centreline touches, so the lat=0 vs
  // lat=±half split says whether the defect is longitudinal (the path level
  // does not follow the run) or lateral (it does not follow the cross-slope).
  const centre = ss.filter((p) => p.e >= 0 && Math.abs(p.lat) < 1e-6);
  const kerb = ss.filter((p) => p.e >= 0 && Math.abs(p.lat) > 1e-6);
  const plazaS = ss.filter((p) => p.plaza);
  const r = {
    park: nm, pathY: +(rec.pathY ?? 0).toFixed(3), nodes: rec.nodes, edges: rec.edges, plazas: rec.plazas, rampNodes: rec.nodeY,
    samples: ss.length,
    maxSink: +maxSink.toFixed(3),
    sinkPct: +((100 * sinks.filter((p) => p.d < -0.02).length) / ss.length).toFixed(1),
    maxFloat: +Math.max(0, ...d).toFixed(3),
    floatPct: +((100 * floats.length) / ss.length).toFixed(1),
    clipEdges, ofEdges: rec.edges,
    dist: stats(d),
    centreSink: centre.length ? +Math.max(0, -Math.min(...centre.map((p) => p.d))).toFixed(3) : 0,
    centreFloat: centre.length ? +Math.max(...centre.map((p) => p.d)).toFixed(3) : 0,
    centreFloatPct: centre.length ? +((100 * centre.filter((p) => p.d > 0.35).length) / centre.length).toFixed(1) : 0,
    kerbFloatPct: kerb.length ? +((100 * kerb.filter((p) => p.d > 0.35).length) / kerb.length).toFixed(1) : 0,
    kerbSink: kerb.length ? +Math.max(0, -Math.min(...kerb.map((p) => p.d))).toFixed(3) : 0,
    plazaSink: plazaS.length ? +Math.max(0, -Math.min(...plazaS.map((p) => p.d))).toFixed(3) : 0,
    reclamped: rec.reclamped ?? null,
    worst: worstEdges.map((p) => ({ e: p.e, at: [p.x, p.z], lat: p.lat, d: p.d, plaza: p.plaza })),
  };
  out[nm] = r;
  console.log(`\n=== ${nm}   pathY ${r.pathY}  nodes ${r.nodes} edges ${r.edges} plazas ${r.plazas} rampNodes ${r.rampNodes}  reclamped:${r.reclamped}`);
  console.log(`  samples ${r.samples}   surface-ground  min ${r.dist.min}  p05 ${r.dist.p05}  p50 ${r.dist.p50}  p95 ${r.dist.p95}  max ${r.dist.max}`);
  console.log(`  MAX SINK (clipping) ${r.maxSink} u   over ${r.sinkPct}% of samples   on ${r.clipEdges}/${r.ofEdges} spans`);
  console.log(`    by place: centreline ${r.centreSink}   kerb (lat +-half) ${r.kerbSink}   plaza ${r.plazaSink}`);
  console.log(`  max float ${r.maxFloat} u   ${r.floatPct}% of samples float > 0.35 u`);
  console.log(`    centreline float max ${r.centreFloat} u, ${r.centreFloatPct}% > 0.35 (SCAFFOLD test) - kerb ${r.kerbFloatPct}% > 0.35 (berm test)`);
  for (const w of r.worst) console.log(`    edge ${String(w.e).padStart(3)} [${w.at[0]}, ${w.at[1]}] lat ${w.lat}  d ${w.d}${w.plaza ? ' (plaza)' : ''}`);
  const hi = [...byEdge2.values()].sort((a, b) => b.d - a.d).slice(0, 4);
  if (hi.length && hi[0].d > 0.35) {
    console.log('  worst FLOAT (needs a berm/scaffold under it):');
    for (const w of hi) console.log(`    edge ${String(w.e).padStart(3)} [${w.x}, ${w.z}] lat ${w.lat}  d ${w.d}${w.plaza ? ' (plaza)' : ''}`);
  }
  void worst;
}
const jsonPath = path.join(HERE, 'out', 'path-clip.json');
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
console.log(`\nworst sink across all parks: ${worstAll.toFixed(3)} u   -> ${jsonPath}`);
if (process.env.PPC_JSON) console.log(JSON.stringify(out, null, 2));
