#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-skeleton.mjs — THE OFFLINE LAYOUT LOOP. No browser, no screenshots,
// sub-second per iteration instead of the ~2 minutes probe.mjs costs.
//
//   node probe-skeleton.mjs samples/skeleton-b.tsx
//   node probe-skeleton.mjs samples/skeleton-b.tsx --exclude=skeleton-b --terse
//
// WHY IT EXISTS. Designing a park SKELETON is an iterative numeric search:
// move a node, re-read `layout.novelty.distance`, re-read whether the guard
// list moved the water, re-read whether a 30-u span now needs a causeway. Each
// of those answers is a PURE FUNCTION of the park's own module-scope data — the
// street net, the guard list, the compiled coaster points — and none of them
// needs a WebGL context, a React mount, a GameManager or a settle pass. Run
// through `probe.mjs` the loop costs ~2 min per look; run here it costs ~1 s,
// which is the difference between 3 iterations and 30. skeleton-b.tsx was
// designed in 8 iterations of this tool and then passed `probe.mjs` first try.
//
// HOW A PARK OPTS IN. Export a `__netdump()` from the park file that returns
// its own module-scope facts (see samples/skeleton-b.tsx for a worked copy):
//
//   export function __netdump() {
//     return {
//       seed, size, climate,                 // the pinned §1 row
//       keepDry,                             // EXACTLY what <Terrain keepDry> gets
//       coasterPts,                          // EXACTLY what <Terrain coasterPts> gets
//       hardCells: XZ[],                     // every cell you PAVE or STAND on
//       layoutRaw: {                         // the shape probe.json publishes
//         size, streetNodes, nodes, edges, plazas, bins,
//         rides: [{ name, at, registered, centre? }],
//         stalls: [{ at }], setPieces: [{ kind, id, bbox }],
//         sceneryByName, trees,
//       },
//       regions?: [{ id, cx, cz, hx, hz, centre, half }],   // <World> rects
//     };
//   }
//
// THE LAX PASS. Every module-scope `throw new Error(...)` in the park is
// rewritten to a collected lint before bundling, so ONE failing assertion does
// not hide the twenty numbers that would tell you how to fix it. The rewrite
// happens on a temp copy beside the park; the park file is never modified.
//
// ===========================================================================
// WHAT THIS TOOL CAN AND CANNOT VERIFY. IT IS NOT THE GATE.
// ===========================================================================
// It CAN measure, exactly as the real pipeline does (same modules, same
// constants, so the two cannot disagree):
//   * `layoutMetrics` + `signatureOf` + `sigDistance` vs the signatures/ corpus,
//     and `scoreLayout` — axis 15, from the authored net (layout.mjs)
//   * `parkComposition` unguarded vs guarded: `terrainSeed`, `probesTried`,
//     both water centroids and how far your guard list MOVED them (§5c), the
//     composed basins, the composed peaks and `report.reliefFloor`
//   * the BUILT heightfield through the real `buildTerrain`, hence ground
//     height, the composed dryness predicate and the peak-bump contribution
//     (> 0.75 = a `terrain` FAIL) at every cell you listed in `hardCells`
//   * `solvePathHeights` + <Paths>' own span audit: `pathY`, per-node ramps,
//     the worst span lift (> 1.0 = `causeway`, > 2.0 = refused) and any span
//     whose ground dips under the waterline (`latticeInWater`)
//   * `worldsTouched` — probe.mjs's own region test, against an ESTIMATED ring
//     bounding box (see the caveat below)
//
// It CANNOT see anything that only exists once the park MOUNTS, and those are
// most of the ways a park fails. It does NOT run:
//   * `validatePark` — so NO `footprints`, `blockers`, `corridor`,
//     `accessibility`, `padOnStreet`, `padNearStreet`, `rosterOverstated`,
//     `plantedInWater`, `crossTheme`, `queueDirFlip`, `causewayRefused`,
//     `rampRefused` or `terrainFlattened` verdict. skeleton-b's first probe run
//     returned 8 failures that this tool reported as 0 (a Discotron pad 0.20 u
//     short of the audited floor, and a coaster queue LANE laid across a street
//     that severed the routing graph behind it). Neither is visible here,
//     because neither exists until the GameManager plans the access lanes.
//   * the GameManager: no queue/exit lane geometry, no logical access spurs, no
//     sim, no `worldAudit`, no registration — so ride/stall REGISTRATION is
//     unchecked and `rideCount` is whatever `__netdump` claims
//   * `compileTrackPieces` legality (`checkCoasterDesign` / `validateSpline` /
//     closure), the dressing pass, the settle-time corridor resolver or
//     `_reclamp`/`_resettlePaths`
//   * the RENDER — nothing is drawn, so a fatal-red translucent ride, a
//     floating prop or a black page all read as clean here
//   * the ~30 manager-appended access-spur nodes probe.json carries past
//     `streetNodes`. They enter the PLOT metrics (`occupancyFraction`,
//     `quadrantSpread`, `centroidOffset`), so those three are approximations —
//     measured drift on skeleton-b: occupancy 0.406 → 0.406, quadrantSpread
//     0.833 → 0.859, centroidOffset 0.281 → 0.262, novelty 0.094 → 0.092
//   * the real set-piece bboxes. `layoutRaw.setPieces[].bbox` here is the
//     PLAN's `footprint`, which is smaller than the mounted dressing group, so
//     FEWER edges are classified as set-piece members and `lengthUniformity`
//     reads HIGH — i.e. `gridRegularity` is over-estimated, which is the safe
//     direction (measured on skeleton-b: 0.518 here, 0.512 real)
//   * the ring's real bounding box. `worldsTouched` walks an ESTIMATE
//     (`x ±44.4, z −52.8…36` for the §4.2-A ring at its published start pose);
//     it agreed with probe.mjs on skeleton-b, but move or resize the ring and
//     the estimate is wrong. Re-check the real number in `probe.monorail`.
//
// SO: iterate here, then ALWAYS finish with
//   node preflight.mjs <park> && node typecheck.mjs <park> && node probe.mjs <park>
// and read `consoleSummary.validatorFails`. A clean run here means "the shape
// arithmetic holds"; only probe.mjs can say `ok: true`.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';
import { preprocessParkSource } from './evaltags.mjs';
import { layoutMetrics, sigDistance } from './layout.mjs';
import { loadCorpus } from './corpus.mjs';
import { scoreLayout } from './score-layout.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const arg = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const parkArg = argv.find((a) => !a.startsWith('--'));
if (!parkArg) {
  console.error('usage: node probe-skeleton.mjs <parkFile.tsx> [--exclude=name] [--terse] [--json]');
  process.exit(1);
}
const orig = path.resolve(parkArg);
if (!fs.existsSync(orig)) {
  console.error(`probe-skeleton: no such file ${orig}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 0. the DOM shim. `buildTerrain` paints canvas textures for its materials, so
// three.js needs a `document.createElement('canvas')` that answers a 2D
// context. Nothing here is drawn or read back — `heightAt` is pure arithmetic
// and is independent of the mesh — so a Proxy that swallows every 2D call is
// enough. (probe-relief-floor.mjs carries a smaller version of the same stub.)
// ---------------------------------------------------------------------------
{
  const noop = () => {};
  const ctx2d = () =>
    new Proxy(
      {},
      {
        get(_t, k) {
          if (k === 'canvas') return { width: 8, height: 8 };
          if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern')
            return () => ({ addColorStop: noop });
          if (k === 'getImageData')
            return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h });
          if (k === 'measureText') return () => ({ width: 10 });
          return noop;
        },
        set: () => true,
      },
    );
  const canvas = () => ({
    width: 8, height: 8, style: {},
    getContext: () => ctx2d(),
    toDataURL: () => 'data:,',
    addEventListener: noop, removeEventListener: noop,
  });
  globalThis.document = {
    createElement: (tag) => (tag === 'canvas' ? canvas() : { style: {}, appendChild: noop, setAttribute: noop }),
    createElementNS: () => canvas(),
    body: { appendChild: noop },
    addEventListener: noop, removeEventListener: noop,
  };
  globalThis.window = globalThis.window ?? { devicePixelRatio: 1, innerWidth: 1, innerHeight: 1, addEventListener: noop, removeEventListener: noop };
  globalThis.self = globalThis.self ?? globalThis.window;
  globalThis.HTMLCanvasElement = function HTMLCanvasElement() {};
  globalThis.ImageData = function ImageData(w, h) {
    this.data = new Uint8ClampedArray(w * h * 4);
    this.width = w;
    this.height = h;
  };
}

const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const { build } = await import('esbuild');
const NODE_PATHS = [path.join(HERE, 'node_modules'), path.resolve(HERE, '..', 'mp3d-render', 'node_modules')];

// ---------------------------------------------------------------------------
// 1. the DESIGN-SYSTEM side, bundled once per run: the composition, the real
// terrain builder and the real path-height solver, so this tool and <Terrain>
// / <Paths> can never disagree about ground height or a walkable grade.
// ---------------------------------------------------------------------------
const terraEntry = path.join(outDir, '_skeleton-terra.ts');
fs.writeFileSync(
  terraEntry,
  `import * as THREE from 'three';
import { parkComposition } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
import { buildTerrain } from ${JSON.stringify(path.join(REPO, 'components/TerrainKit'))};
export { solvePathHeights } from ${JSON.stringify(path.join(REPO, 'components/PathNetwork'))};
export const WATER_LEVEL = -0.26;
/** <Terrain>'s own composition + mesh recipe (Park/wrappers.tsx), verbatim */
export function groundFor(seed: number, size: number, climate: any, keepDry?: any, coasterPts?: any) {
  const comp = parkComposition(THREE as any, seed, size, climate, { keepDry, coasterPts });
  const lf: any = comp.landform;
  const segOf = (sz: number) => Math.min(Math.round(sz * 6.9), Math.max(220, Math.round(sz / 0.45)));
  const terrain = buildTerrain(THREE as any, {
    size, seg: segOf(size), seed: comp.terrainSeed,
    amplitude: lf.amplitude, scale: lf.scale, octaves: lf.octaves, roughness: lf.roughness,
    reliefBias: lf.reliefBias, flatSpots: lf.flatSpots,
    waterLevel: WATER_LEVEL,
    peaks: [...comp.peaks, ...(comp.clampPeaks ?? [])],
    basins: [...comp.basins, ...(comp.clampBasins ?? [])],
    firmShore: true, edgeSkirt: false,
  } as any);
  return { comp, heightAt: terrain.heightAt };
}
`,
);
const terraOut = path.join(outDir, '_skeleton-terra.cjs');
await build({
  entryPoints: [terraEntry], bundle: true, outfile: terraOut, format: 'cjs', platform: 'node',
  jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: NODE_PATHS, target: 'node20', logLevel: 'warning',
}).catch((e) => {
  console.error('probe-skeleton: could not bundle the design-system side:');
  for (const err of e.errors ?? []) console.error(`  ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});
const T = await import(`file://${terraOut}`);

// ---------------------------------------------------------------------------
// 2. the PARK side. Rewrite every module-scope `throw new Error(` into a
// collected lint on a temp copy BESIDE the park (so its relative
// `./components/...` specifiers still resolve), bundle, call `__netdump()`.
// ---------------------------------------------------------------------------
const parkDir = path.dirname(orig);
const laxFile = path.join(parkDir, `.probe-skeleton-lax-${path.basename(orig)}`);
fs.writeFileSync(
  laxFile,
  'const __lint = (m: any) => { ((globalThis as any).__SKELETON_LINTS ??= []).push(String(m)); };\n' +
    fs.readFileSync(orig, 'utf8').replace(/throw new Error\(/g, '__lint('),
);
const cleanup = () => { for (const f of [laxFile, parkOut]) { try { fs.unlinkSync(f); } catch { /* gone */ } } };
process.on('exit', cleanup);

const parkOut = path.join(outDir, `_skeleton-${path.basename(orig, path.extname(orig))}.cjs`);
const loaders = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js' };
const parkLocal = (() => {
  let real = path.resolve(parkDir);
  try { real = fs.realpathSync(real); } catch { /* keep resolved */ }
  const prefix = real + path.sep;
  return {
    name: 'skeleton-park-local',
    setup(b) {
      b.onLoad({ filter: /\.(m?js|jsx|ts|tsx)$/ }, (a) => {
        let p = path.resolve(a.path);
        try { p = fs.realpathSync(p); } catch { /* keep resolved */ }
        if (!p.startsWith(prefix)) return null;
        return {
          contents: preprocessParkSource(fs.readFileSync(p, 'utf8'), path.dirname(p)),
          loader: loaders[path.extname(p)] || 'tsx',
          resolveDir: path.dirname(p),
        };
      });
    },
  };
})();
await build({
  entryPoints: [laxFile], bundle: true, outfile: parkOut, format: 'cjs', platform: 'node',
  jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: NODE_PATHS, plugins: [parkLocal], target: 'node20', logLevel: 'warning',
}).catch((e) => {
  console.error(`probe-skeleton: esbuild refused ${path.relative(process.cwd(), orig)}:`);
  for (const err of e.errors ?? []) console.error(`  ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});
const mod = await import(`file://${parkOut}`);
const dump = mod.__netdump ?? mod.default?.__netdump;
if (typeof dump !== 'function') {
  console.error(
    `probe-skeleton: ${path.basename(orig)} exports no \`__netdump()\` — add one (see the header of this file, ` +
      'or samples/skeleton-b.tsx for a worked copy). Without it there is nothing to measure offline.',
  );
  process.exit(1);
}
const D = dump();
const LINTS = globalThis.__SKELETON_LINTS ?? [];

// ---------------------------------------------------------------------------
// 3. axis 15 — the same modules probe.mjs uses
// ---------------------------------------------------------------------------
const m = layoutMetrics(D.layoutRaw);
const exclude = arg('exclude', path.basename(orig).replace(/\.tsx?$/, ''));
const corpus = loadCorpus({ exclude }).filter((c) => Array.isArray(c.layoutSignature));
const ranked = corpus
  .map((c) => ({ park: c.name, distance: sigDistance(m.signature, c.layoutSignature) }))
  .sort((a, b) => a.distance - b.distance);
m.novelty = ranked.length
  ? { distance: ranked[0].distance, nearest: ranked[0].park, nearestThree: ranked.slice(0, 3), corpusSize: corpus.length }
  : { distance: null, nearest: null, nearestThree: [], corpusSize: 0 };
const score = scoreLayout(m);

// ---------------------------------------------------------------------------
// 4. §5c — compose the water TWICE and report how far the guard list moved it.
//    This is the AUTHORITY the §1-W box sieve only pre-filters for: the
//    published basin boxes are the basin CHAIN's bounding box and are both
//    wider than the wet area in places and NARROWER than the real bowls in
//    others, so a cell can clear `assertKeepDryOffRow` and still re-pick the
//    body (and, on some rows, sit inside a published box and be measurably dry).
// ---------------------------------------------------------------------------
const { seed, size, climate, keepDry, coasterPts } = D;
const bare = T.groundFor(seed, size, climate);
const guarded = T.groundFor(seed, size, climate, keepDry, coasterPts);
const moved = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
const pair = (g) => ({
  terrainSeed: g.comp.terrainSeed,
  probesTried: g.comp.report.probesTried,
  violations: g.comp.report.violations.length,
  // the LIST, not only the count: `probeViolations` is handed straight to
  // validatePark ("an unsatisfied composition probe is a FAIL, not a
  // console-only warning" — parkRoot.tsx), so which cell is unsatisfied is the
  // only thing that tells you what to move.
  violationList: g.comp.report.violations.slice(0, 12),
  dominant: g.comp.waterCentre.map(r2),
  secondary: g.comp.waterCentreSecond ? g.comp.waterCentreSecond.map(r2) : null,
});
const C = guarded.comp;
const rf = C.report.reliefFloor;
const water = {
  bare: pair(bare),
  guarded: pair(guarded),
  movedDominant: r2(moved(bare.comp.waterCentre, guarded.comp.waterCentre)),
  movedSecondary: r2(moved(bare.comp.waterCentreSecond, guarded.comp.waterCentreSecond)),
  waterPercent: r2((100 * C.report.waterAreaU2) / (size * size)),
  bodies: C.report.waterBodies,
  clampPeaks: (C.clampPeaks ?? []).length,
  clampBasins: (C.clampBasins ?? []).length,
  reliefFloor: rf
    ? { relief: r2(rf.relief), stdH: r2(rf.stdH), authoredRelief: r2(rf.authoredRelief), authoredStdH: r2(rf.authoredStdH),
        kept: r2(rf.kept), floor: rf.floor, ok: rf.ok, guardedRanges: rf.guardedRanges }
    : null,
  // FATAL only on the CONJUNCTION (ParkBuilder/validate.ts): kept < floor AND
  // the built terrain below the published size-128 band (relief 8.15 / stdH 0.76)
  terrainFlattenedWouldBeFatal: !!(rf && !rf.ok && size === 128 && (rf.relief < 8.15 || rf.stdH < 0.76)),
};

// ---------------------------------------------------------------------------
// 5. the composed ground under every cell the park PAVES or STANDS on:
//    dryness (the 0.74·radius waterline `ParkBuilder/dressing.ts` sieves with)
//    and the peak-bump contribution validatePark fails a footprint on at > 0.75
// ---------------------------------------------------------------------------
// ---- THE DRYNESS PREDICATE IS THE BUILT GROUND, NOT THE BASIN DISCS --------
// (wave-18) This block used to answer `dry` from `[...C.basins,
// ...C.basinsSecond]` alone and printed things like
// `{"at":[-59.4,60.6],"h":-3.91,"dry":true}` — a cell 3.9 u UNDER the waterline
// reported dry, in the same object as the height that contradicts it. Two
// separate errors, in opposite directions:
//
//   * `comp.clampBasins` — the shave discs the guard clamp digs to bring a
//     bulged keepDry cell back inside the composition's window — are NOT in
//     `comp.basins`, and `<Terrain>` builds the real ground from
//     `[...comp.basins, ...comp.clampBasins]` (see `groundFor` above, and
//     composition.ts's own note at `clampBasins`). A disc sieve is therefore
//     sieving against a landform the park does not stand on.
//   * and the asymmetry: a GUARDED cell is RAISED by that same pass, so a
//     guarded cell sitting in a clamp disc is dry BY CONSTRUCTION. Adding the
//     clamp discs to the sieve would call it wet — a false positive in the
//     other direction.
//
// So `dry` is now the test `validatePark`'s own `scenery` gate makes — the
// BUILT heightfield against the waterline — and the disc sieve is kept only as
// the advisory SHORELINE margin (`dryDiscs`, `nearShore` below). GENERAL RULE
// for parks: `park.isDryCell()` / `terrainLint(...).isDry` read the built
// ground; a hand-rolled predicate over `comp.basins` does not.
const basins = [...C.basins, ...C.basinsSecond, ...(C.clampBasins ?? [])];
const dryBuilt = (x, z) => guarded.heightAt(x, z) > T.WATER_LEVEL + 0.05;
const isDry = (x, z, margin = 1.2) => basins.every((b) => Math.hypot(x - b.x, z - b.z) > 0.74 * b.radius + margin);
const bumpAt = (x, z) =>
  Math.max(0, ...C.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
const paved = (D.paved ?? []).map((c) => ({ at: c.map(r2), dry: dryBuilt(c[0], c[1]), dryDiscs: isDry(c[0], c[1]) }));
const hard = (D.hardCells ?? []).map((c) => ({
  at: c.map(r2),
  h: r2(guarded.heightAt(c[0], c[1])),
  bump: r2(bumpAt(c[0], c[1])),
  dry: dryBuilt(c[0], c[1]),
  dryDiscs: isDry(c[0], c[1]),
}));
// EVERY GUARDED CELL's own ground, against the composition's OWN predicate
// (composition.ts `evaluate`): a `keepDry` cell must compose with
// `WATER_LEVEL + 0.18 <= h <= 0.8`, else the probe records a `built cell
// wet/marshy` / `built cell on a bulge` violation — and `probeViolations` is a
// HARD `terrain` FAIL in validatePark, not a warning. The guard clamps fix most
// of them; these are the ones no clamp could reach, so they name exactly what
// has to move.
const GUARD_LO = T.WATER_LEVEL + 0.18, GUARD_HI = 0.8;
const guardGround = (keepDry ?? []).map((c) => ({ at: c.map(r2), h: r2(guarded.heightAt(c[0], c[1])) }));
const cells = {
  count: hard.length,
  guardedChecked: guardGround.length,
  guardTooWet: guardGround.filter((c) => c.h < GUARD_LO).sort((a, b) => a.h - b.h).slice(0, 12),
  guardOnBulge: guardGround.filter((c) => c.h > GUARD_HI).sort((a, b) => b.h - a.h).slice(0, 12),
  // `wet` and `belowWaterline` are now the SAME test — the built ground against
  // the waterline, which is what `validatePark`'s `scenery` gate measures. They
  // used to disagree, because `wet` came from the basin DISCS: see the wave-18
  // note at the predicate.
  wet: hard.filter((c) => !c.dry),
  // ADVISORY shoreline margin: outside the water but inside `0.74·radius + 1.2`
  // of a basin disc (the `dressing.ts` sieve). A GUARDED cell reads here
  // routinely and legitimately — the clamp pass raised it — so this is a hint,
  // never a verdict.
  nearShore: hard.filter((c) => c.dry && !c.dryDiscs).slice(0, 16),
  // the SCENERY gate's own test (`ParkBuilder/validate.ts`): an unguarded piece
  // whose composed ground is under `waterLevel + 0.05` is REFUSED. Feed a
  // set-piece's DRESSING ring through `hardCells` and this names the offenders.
  belowWaterline: hard.filter((c) => c.h < T.WATER_LEVEL + 0.05).sort((a, b) => a.h - b.h).slice(0, 16),
  onHillFlank: hard.filter((c) => c.bump > 0.75).sort((a, b) => b.bump - a.bump),
  nearHillFlank: hard.filter((c) => c.bump > 0.55 && c.bump <= 0.75).sort((a, b) => b.bump - a.bump),
  outOfBounds: hard.filter((c) => Math.max(Math.abs(c.at[0]), Math.abs(c.at[1])) > size / 2 - 0.7),
  pavedButUnguardedAndWet: paved.filter((c) => !c.dry),
  guardedOfPaved: `${(keepDry ?? []).length} guarded of ${paved.length} paved`,
};

// ---------------------------------------------------------------------------
// 6. <Paths>' own height solve + span audit (Park/wrappers.tsx `build()`),
//    replayed on the guarded ground: pathY, per-node ramps, the worst span
//    lift and any span crossing water.
// ---------------------------------------------------------------------------
const CLEAR = 0.03, CAUSEWAY_LIFT = 1.0, CAUSEWAY_HARD = 2.0, WL = T.WATER_LEVEL;
const sn = Number.isFinite(D.layoutRaw.streetNodes) ? D.layoutRaw.streetNodes : D.layoutRaw.nodes.length;
const nodes = D.layoutRaw.nodes.slice(0, sn);
const edges = D.layoutRaw.edges.filter(([a, b]) => a < sn && b < sn && a !== b);
const groundAt = guarded.heightAt;
const nodeGrounds = nodes.map(([x, z]) => groundAt(x, z));
const sorted = [...nodeGrounds].sort((a, b) => a - b);
const medianGround = sorted[Math.floor(sorted.length / 2)] ?? 0;
const legacyY = Math.max(...nodeGrounds) + CLEAR;
const solved = T.solvePathHeights(nodes, edges, groundAt, { clearance: CLEAR, width: 1.1 });
const legacyOk = legacyY >= Math.max(...solved.h) - 1e-9;
let pathY, nodeY;
if (legacyOk) { pathY = legacyY; nodeY = nodes.map(() => 0); }
else {
  const sh = [...solved.h].sort((a, b) => a - b);
  pathY = +(sh[Math.floor(sh.length / 2)]).toFixed(4);
  nodeY = solved.h.map((v) => (Math.abs(v - pathY) < 0.0015 ? 0 : +(v - pathY).toFixed(4)));
}
const surfaceAt = (a, b, u) => (pathY + nodeY[a]) + ((pathY + nodeY[b]) - (pathY + nodeY[a])) * u;
const spans = edges.map(([a, b], ei) => {
  const [ax, az] = nodes[a], [bx, bz] = nodes[b];
  let lift = 0, at = [ax, az], wettest = Infinity, wetAt = [ax, az];
  for (let k = 0; k <= 12; k += 1) {
    const u = k / 12, px = ax + (bx - ax) * u, pz = az + (bz - az) * u, gh = groundAt(px, pz);
    const l = surfaceAt(a, b, u) - gh;
    if (l > lift) { lift = l; at = [px, pz]; }
    if (gh < wettest) { wettest = gh; wetAt = [px, pz]; }
  }
  return { edge: ei, a, b, lift: r2(lift), at: at.map(r2), wettest: r2(wettest), wetAt: wetAt.map(r2) };
});
const paths = {
  pathY: r2(pathY), medianGround: r2(medianGround), hiGround: r2(Math.max(...nodeGrounds)), legacyOk,
  causewayLevel: r2(pathY - medianGround),                 // > 0.8 = §0-FATAL `causeway`
  rampedNodes: nodeY.filter((v) => v !== 0).length,
  worstRamp: r2(Math.max(...nodeY.map(Math.abs))),
  heldAboveGround: solved.h
    .map((v, i) => ({ node: i, at: nodes[i].map(r2), lift: r2(v - (nodeGrounds[i] + CLEAR)) }))
    .filter((r) => r.lift > 0.35).sort((a, b) => b.lift - a.lift).slice(0, 8),
  worstSpanLift: r2(spans.reduce((a, s) => Math.max(a, s.lift), 0)),
  spansOverCauseway: spans.filter((s) => s.lift > CAUSEWAY_LIFT).sort((a, b) => b.lift - a.lift).slice(0, 10),
  spansRefused: spans.filter((s) => s.lift > CAUSEWAY_HARD).length,
  spansInWater: spans.filter((s) => s.wettest < WL + 0.05).slice(0, 10),
};

// ---------------------------------------------------------------------------
// 7. worldsTouched — probe.mjs's own test, on an ESTIMATED ring bbox. The
//    points it walks are the four deck centres plus the beam bbox PERIMETER
//    (not its interior), which is why a world entirely outside the ring reads
//    `worldsTouched: 1` however grand it is.
// ---------------------------------------------------------------------------
const RING_BB = { minx: -44.4, maxx: 44.4, minz: -52.8, maxz: 36.0 }; // §4.2-A at [-42.6, 0, -9.7]
const ringPts = [[-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0]];
for (let x = RING_BB.minx; x <= RING_BB.maxx; x += 1.2) ringPts.push([x, RING_BB.minz], [x, RING_BB.maxz]);
for (let z = RING_BB.minz; z <= RING_BB.maxz; z += 1.2) ringPts.push([RING_BB.minx, z], [RING_BB.maxx, z]);
const inRegion = (w, x, z) => Math.abs(x - w.cx) <= (w.hx ?? 0) + 1.6 && Math.abs(z - w.cz) <= (w.hz ?? 0) + 1.6;
const regions = D.regions ?? [];
const overlaps = [];
regions.forEach((a, i) => regions.slice(i + 1).forEach((b) => {
  if (Math.abs(a.cx - b.cx) < a.hx + b.hx && Math.abs(a.cz - b.cz) < a.hz + b.hz) overlaps.push(`${a.id}/${b.id}`);
}));
const seps = [];
regions.forEach((a, i) => regions.slice(i + 1).forEach((b) =>
  seps.push({ pair: `${a.id}/${b.id}`, centre: r2(Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1])) })));
const worlds = {
  declared: regions.length,
  rects: regions.map((w) => ({ id: w.id, x: [r2(w.cx - w.hx), r2(w.cx + w.hx)], z: [r2(w.cz - w.hz), r2(w.cz + w.hz)] })),
  touchedIds: regions.filter((w) => ringPts.some(([x, z]) => inRegion(w, x, z))).map((w) => w.id),
  overlaps,
  separations: seps.sort((a, b) => a.centre - b.centre),
  note: 'ESTIMATED ring bbox — confirm against probe.monorail.worldsTouched',
};
worlds.everyWorldTouched = worlds.declared > 0 && worlds.touchedIds.length === worlds.declared;

// ---------------------------------------------------------------------------
// 8. report
// ---------------------------------------------------------------------------
const report = {
  park: path.relative(process.cwd(), orig),
  lints: LINTS,
  netWarnings: D.netWarnings ?? null,
  pruned: D.pruned ?? null,
  layout: {
    net: m.net, gridRegularity: m.gridRegularity, gridTerms: m.gridTerms,
    effectiveLengthClasses: m.edgeLengths.effectiveClasses, byClass: m.edgeLengths.byClass,
    bearingHist6: m.edgeBearings.hist6,
    lattice: { latticeNodeShare: m.lattice.latticeNodeShare, pitchUniformity: m.lattice.pitchUniformity,
               xPitchClasses: m.lattice.xPitchClasses, zPitchClasses: m.lattice.zPitchClasses,
               degreeShare: m.lattice.degreeShare },
    districts: { count: m.districts.count, maxSeparation: m.districts.maxSeparation,
                 minSeparation: m.districts.minSeparation, separationTarget: m.districts.separationTarget },
    plot: m.plot,
    openSpace: { count: m.openSpace.count, largestArea: m.openSpace.largestArea,
                 areaSpread: m.openSpace.areaSpread, totalArea: m.openSpace.totalArea },
    novelty: m.novelty, signature: m.signature,
  },
  axis15: score,
  water, cells, paths, worlds,
};
if (flag('json')) { console.log(JSON.stringify(report, null, 1)); process.exit(0); }

const L = report.layout;
const say = (k, v) => console.log(`  ${String(k).padEnd(22)} ${v}`);
console.log(`\n=== probe-skeleton ${report.park} — OFFLINE, NOT THE GATE (finish with probe.mjs) ===`);
if (LINTS.length) { console.log(`\nMODULE-SCOPE ASSERTIONS THAT WOULD THROW (${LINTS.length}):`); LINTS.forEach((l) => console.log(`  ! ${l}`)); }
else console.log('\nmodule-scope assertions: all pass');
console.log('\nAXIS 15');
say('total', `${report.axis15.total} / 7  ${JSON.stringify(report.axis15.parts)}`);
say('novelty', `${L.novelty.distance} (nearest ${L.novelty.nearest}, corpus ${L.novelty.corpusSize}) — floors 0.08 distinct / 0.04 derivative`);
say('nearestThree', L.novelty.nearestThree.map((n) => `${n.park} ${n.distance}`).join(' · '));
say('gridRegularity', `${L.gridRegularity} (floor 0.55) ${JSON.stringify(L.gridTerms)}`);
say('street net', `${L.net.streetNodes} nodes / ${L.net.streetEdges} edges / ${L.net.totalLength} u / mean ${L.net.meanEdgeLen}`);
say('lengthClasses', `${L.effectiveLengthClasses} effective (>= 3 for full credit)`);
say('plot', JSON.stringify(L.plot));
say('openSpace', JSON.stringify(L.openSpace));
say('districts', `${L.districts.count} · max ${L.districts.maxSeparation} · min ${L.districts.minSeparation} · floor ${L.districts.separationTarget}`);
console.log('\nWATER (§5c: the AUTHORITY — the §1-W box sieve is only a pre-filter)');
say('unguarded', JSON.stringify(water.bare));
say('guarded', JSON.stringify(water.guarded));
say('centroid MOVED', `dominant ${water.movedDominant} u · secondary ${water.movedSecondary} u  (> 6 = §0-FATAL waterRePicked)`);
say('water %', `${water.waterPercent} in ${water.bodies} bodies · clampPeaks ${water.clampPeaks} / clampBasins ${water.clampBasins}`);
if (water.reliefFloor) say('reliefFloor', `${JSON.stringify(water.reliefFloor)}${water.terrainFlattenedWouldBeFatal ? '  <-- terrainFlattened would be FATAL' : ''}`);
console.log('\nCELLS YOU PAVE OR STAND ON');
say('checked', cells.count);
say('guard h range', `${cells.guardedChecked} guarded cells must compose ${r2(GUARD_LO)} <= h <= ${GUARD_HI} — ${cells.guardTooWet.length} too wet, ${cells.guardOnBulge.length} on a bulge (each one is a composition violation = a HARD terrain FAIL)`);
if (cells.guardTooWet.length) say('  too wet', JSON.stringify(cells.guardTooWet));
if (cells.guardOnBulge.length) say('  on a bulge', JSON.stringify(cells.guardOnBulge));
say('in composed water', cells.wet.length ? JSON.stringify(cells.wet) : 'none');
say('under the waterline', cells.belowWaterline.length ? JSON.stringify(cells.belowWaterline) : `none (h < ${r2(T.WATER_LEVEL + 0.05)} = a REFUSED scenery piece)`);
if (paved.length) say('paved cells', `${cells.guardedOfPaved} — ${cells.pavedButUnguardedAndWet.length} paved cell(s) wet`);
say('on a hill flank', cells.onHillFlank.length ? JSON.stringify(cells.onHillFlank) : 'none (bump > 0.75 = terrain FAIL)');
if (!flag('terse') && cells.nearHillFlank.length) say('close to one', JSON.stringify(cells.nearHillFlank.slice(0, 5)));
say('out of bounds', cells.outOfBounds.length
  ? `${JSON.stringify(cells.outOfBounds)}   (outside +-${r2(size / 2 - 0.7)}; a <Gate> RIM cell is expected here)`
  : 'none');
console.log('\nSTREET SURFACE (<Paths> solve replayed on the guarded ground)');
say('pathY / median', `${paths.pathY} / ${paths.medianGround} — causewayLevel ${paths.causewayLevel} (> 0.8 FATAL)`);
say('ramps', `${paths.rampedNodes} of ${nodes.length} nodes, worst ${paths.worstRamp}`);
say('worst span lift', `${paths.worstSpanLift} (> 1.0 causeway, > 2.0 REFUSED)`);
say('spans over 1.0', paths.spansOverCauseway.length ? JSON.stringify(paths.spansOverCauseway) : 'none');
say('spans in water', paths.spansInWater.length ? JSON.stringify(paths.spansInWater) : 'none');
if (paths.heldAboveGround.length) say('held above ground', JSON.stringify(paths.heldAboveGround));
// ---------------------------------------------------------------------------
// 8b. --map: a coarse ASCII picture of the COMPOSED ground, so a set-piece or a
// pad can be placed on ground the composition actually leaves dry instead of on
// a cell that reads dry against the basin DISCS and composes 4 u under water
// (the disc sieve does not see `clampBasins`, and a 128-u `ridges` archetype has
// real troughs). '~' = under the waterline (a REFUSED scenery piece), '.' = flat
// and dry, ':' 0.8-2, '^' 2-4, '#' over 4.
// ---------------------------------------------------------------------------
if (flag('map')) {
  const STEP = Number(arg('mapStep', '2.4'));
  const half = size / 2;
  const glyph = (h) => (h < WL + 0.05 ? '~' : h <= 0.8 ? '.' : h <= 2 ? ':' : h <= 4 ? '^' : '#');
  console.log(`\nCOMPOSED GROUND (step ${STEP} u; rows are z DESCENDING, columns x ascending from ${-half + STEP / 2})`);
  for (let z = half - STEP / 2; z > -half; z -= STEP) {
    let row = '';
    for (let x = -half + STEP / 2; x < half; x += STEP) row += glyph(guarded.heightAt(x, z));
    console.log(`  ${String(Math.round(z)).padStart(4)} ${row}`);
  }
  let hdr = '       ';
  for (let x = -half + STEP / 2; x < half; x += STEP) hdr += Math.abs(Math.round(x)) % 12 === 0 ? '|' : ' ';
  console.log(hdr + '   (| = |x| a multiple of 12)');
}
if (worlds.declared) {
  console.log('\nWORLDS');
  say('rects', JSON.stringify(worlds.rects));
  say('ring touches', `${worlds.touchedIds.length} / ${worlds.declared} (${worlds.touchedIds.join(', ')}) — ${worlds.note}`);
  say('overlaps', worlds.overlaps.length ? worlds.overlaps.join(', ') : 'none');
  say('separations', worlds.separations.map((s) => `${s.pair} ${s.centre}`).join(' · '));
}
console.log('');
