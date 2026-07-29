// ---------------------------------------------------------------------------
// Park/wrappersLand — the two SYNCHRONOUS content wrappers: <Terrain> and
// <Paths>. Split out of wrappers.tsx purely for module size (one file per
// design-system write call); the code below is unchanged.
//
// THESE TWO DO NOT GO THROUGH THE BUILD QUEUE. Every other wrapper guards on
// `park.ground` / `park.paths` at effect time, so the land and the street
// network must exist the moment the first sibling effect runs — queueing them
// would invert the composition order the whole recipe book depends on.
// <Terrain> instead reports per-stage profile marks into window.__buildMarks.
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import * as THREE from 'three';
import { cyl } from '../Stage';
import {
  parkComposition,
  tintTerrainForClimate,
  dressTerrain,
  terrainLint,
  bermNetToGround,
  reclampTerrain,
  surroundPalette,
  WATER_LEVEL,
  TILE,
} from '../ParkBuilder';
import type { ParkClimate, ParkFootRect, NoDressRegion } from '../ParkBuilder';
import { buildTerrain, buildSurround } from '../TerrainKit';
import { buildWater } from '../WaterTile';
import { buildPathNetwork, snapNetToGrid, solvePathHeights } from '../PathNetwork';
import type { PathSurface, PathSurfaceZone } from '../PathNetwork/surfaces';
import { attachWalkers } from '../PathWalkers';
import { usePark, disposeDeep } from './parkContext';
import type { ParkPathsInfo, ParkStore, V3, XZ } from './parkContext';

// ---- <Terrain> ----------------------------------------------------------------

export interface TerrainProps {
  seed?: number;
  climate?: ParkClimate;
  size?: number;
  /** world cells YOUR layout builds on — the composition probe keeps them dry */
  keepDry?: XZ[];
  /** planned coaster control points `[x, yAboveRef, z]` (peaks pre-capped) */
  coasterPts?: V3[];
  /**
   * GROUND THAT MUST STAY BARE — regions the climate auto-dressing may not
   * plant in: discs `{ x, z, r }` and/or `ParkFootRect`-shaped rects
   * `{ cx, cz, hx, hz, yaw? }` in WORLD coords (a set-piece can hand over
   * `plan.footprint` / `plan.extent` / a ride's `trackBox` verbatim).
   *
   * NOT `keepDry`, on purpose. `keepDry` guarantees dry, walkable, flat-ish
   * ground, which MOVES the heightfield (the guard clamp's
   * `clampPeaks`/`clampBasins`) and only incidentally suppresses dressing —
   * so using it to stop planting reshapes the ground the guests walk and can
   * turn an aesthetic fix into a FATAL sim regression (this is exactly what
   * happened to the Emberfall ash field; see its Context.md → Audit).
   * `noDress` suppresses PLANTING/SCATTER ONLY: terrain mesh, `heightAt`,
   * clamp, zone paint and water are all identical with or without it.
   *
   * A land that paints its own floor — fresh lava, a salt pan, a ceremonial
   * court, an ash field — passes its own regions here:
   * `<Terrain keepDry={NET.keepDry} noDress={LAND.noDress} />`.
   */
  noDress?: NoDressRegion[];
  seg?: number;
}

/** `parkComposition` + `buildTerrain` + climate tint + ONE `buildWater` sheet
 *  at the waterline; registers `heightAt` as the Stage's ground sampler.
 *  ALWAYS the first child of a `<Park>`. */
export function Terrain(props: TerrainProps) {
  const park = usePark('Terrain');
  const key = JSON.stringify(props);
  useEffect(() => {
    const __t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const __mark = (name: string) => {
      const w = typeof window !== 'undefined' ? (window as unknown as { __PARK_PROFILE?: boolean; __buildMarks?: { name: string; ms: number }[] }) : null;
      if (!w?.__PARK_PROFILE) return;
      const marks = (w.__buildMarks ??= []);
      const prev = marks.reduce((a2, m) => (m.name.startsWith('  terrain:') ? a2 + m.ms : a2), 0);
      marks.push({ name: `  terrain: ${name}`, ms: performance.now() - __t0 - prev });
    };
    // NOT time-sliced, deliberately: <Terrain> and <Paths> are the ground
    // every other wrapper guards on ("needs <Terrain> and <Paths> mounted
    // first"), and those guards run at EFFECT time. They stay synchronous so
    // `park.ground`/`park.paths` exist the moment the children's effects run —
    // and they are also what the user should see first anyway. Everything
    // mounted ON them streams in through the build queue instead.
    const t = park.three;
    const S = props.size ?? park.size;
    const comp = parkComposition(t, props.seed ?? park.seed, S, props.climate ?? park.climate, {
      keepDry: props.keepDry,
      coasterPts: props.coasterPts,
    });
    // MESH RESOLUTION: vertex pitch holds at the classic ~0.145 u/vert up to a
    // 220² mesh (every plot ≤ 96 is bit-identical), then the CAP RISES so the
    // pitch never gets coarser than ~0.45 u — a 192 plot gets 427² instead of
    // 220². Segment count therefore grows with the plot EDGE, not its area:
    // 4× linear = 3.8× the triangles, not 16×.
    const segOf = (sz: number) => Math.min(Math.round(sz * 6.9), Math.max(220, Math.round(sz / 0.45)));
    // the landform archetype this seed drew (base heightfield + relief bias +
    // the flat forecourt pocket) — the probe, the mesh and heightAt must all
    // build from the SAME landform or the ground stops matching the sampler
    __mark('parkComposition');
    const lf = comp.landform;
    const terrainOf = () => ({
      size: S,
      seg: props.seg ?? segOf(S),
      seed: comp.terrainSeed,
      amplitude: lf.amplitude,
      scale: lf.scale,
      octaves: lf.octaves,
      roughness: lf.roughness,
      reliefBias: lf.reliefBias,
      flatSpots: lf.flatSpots,
      waterLevel: WATER_LEVEL,
      // guard POST-ENFORCEMENT discs ride along with the authored landform
      // (round-3 safeguard): wet guarded cells are raised dry and bulges
      // shaved flat, so the built ground matches comp.report's clean probe
      peaks: [...comp.peaks, ...(comp.clampPeaks ?? [])],
      basins: [...comp.basins, ...(comp.clampBasins ?? [])],
      firmShore: true, // matches the composition probe — no stray noise puddles
      // the surround ring below continues the land past the plot, so the
      // perimeter mud walls would only draw a dark OUTLINE around the map
      edgeSkirt: false,
    });
    const terrain = buildTerrain(t, terrainOf());
    __mark('buildTerrain (heightfield + mesh)');
    tintTerrainForClimate(t, terrain.mesh, comp.climate, comp.basins, comp); // climate bias + terrain-SECTION zone paint
    const water = buildWater(t, S * 0.995, 120);
    __mark('buildWater');
    water.mesh.position.y = WATER_LEVEL;
    const g = new t.Group();
    g.add(terrain.mesh, water.mesh);
    // ---- INFINITE-PLANE SURROUND -------------------------------------------
    // The plot edge used to read as a cliff into the void. One cheap merged
    // mesh (1 draw call, ~3-4 k coarse tris, no texture, no shadows) continues
    // the land past ±size/2 with distant ridge silhouettes, palette-matched to
    // the climate and vertex-hazed toward the sky. Sized so its far rim lands
    // exactly ON the scene's fog wall — there it is 100% fog-coloured, so the
    // world fades into the sky instead of ending. Pure backdrop: outside
    // ±size/2, so every validator bound (footprints, track points, access
    // nodes, water flood-fill, terrainLint.inBounds) already excludes it, and
    // it is never registered as a footprint, blocker or ground sampler.
    const sceneFog = park.api.scene.fog as THREE.Fog | null;
    const fogFar = sceneFog && Number.isFinite(sceneFog.far) ? sceneFog.far : S * 2.6;
    const pal = surroundPalette(comp.climate);
    const surround = buildSurround(t, {
      size: S,
      reach: fogFar * 0.99, // rim ON the fog wall = fully hazed = no visible end
      seed: comp.terrainSeed,
      // DISTANT RANGES on the horizon. 2026-07 raised this from `S * 0.11`
      // (14 u on the 128 default) to `S * 0.2`: the surround's far bands sit
      // 150-230 u out, so a 14-u ridge subtends almost nothing and the horizon
      // read as a flat dark line above the plot — exactly the "no silhouette"
      // complaint. 26 u on a 128 plot is comparable to the plot's own tallest
      // summits, which is what makes the two read as one continuous landscape.
      ridge: Math.max(10, Math.min(48, S * 0.26)),
      ground: pal.ground,
      crest: pal.crest,
      haze: sceneFog ? sceneFog.color.getHex() : 0xa8cdd9,
      waterLevel: WATER_LEVEL,
    });
    g.add(surround.mesh);
    __mark('buildSurround');
    park.ground = {
      heightAt: terrain.heightAt,
      waterLevel: WATER_LEVEL,
      size: S,
      comp,
      lint: terrainLint(terrain.heightAt, S, WATER_LEVEL),
      keepDry: props.keepDry,
    };
    // CAMERA ground clamp: inside the plot it is the terrain, OUTSIDE it is the
    // surround ring, so dollying out at a low elevation walks the camera OVER
    // the distant ridges instead of through them. Only the Stage's clamp uses
    // this — `park.ground.heightAt` stays the plot's own sampler, so guests,
    // rides, placement and every validator still see the plot and only the plot.
    const camGroundAt = (x: number, z: number) =>
      Math.max(Math.abs(x), Math.abs(z)) <= S / 2 ? terrain.heightAt(x, z) : surround.heightAt(x, z);
    park.api.setGroundSampler?.(camGroundAt); // camera never clips terrain
    const cleanup = park.addObject(g, water.update, { lod: 'full' }); // park-spanning backdrop — never throttled
    // auto-dressing: forest tree clusters, mountain outcrops + scree, beach
    // dunes/palms — deterministic, keeps clear of keepDry cells, the planned
    // coaster and every `noDress` region (ground a land keeps bare WITHOUT a
    // heightfield change); default 'auto' LOD so dense clusters throttle at
    // distance
    //
    // THE ONE PART OF <Terrain> THAT IS QUEUED. The heightfield, the sampler
    // and the water must exist synchronously — every sibling's effect guards
    // on `park.ground` (see the header) — but the DRESSING is pure scenery:
    // nothing reads `dress` until the settle pass re-seats it after an
    // AUTO-keepDry re-clamp, which runs long after the queue drains. It was
    // 383 ms of the 1634 ms synchronous block on parkA-99 (probe-assembly.mjs
    // build marks), and queueing it hands that back to the browser. Ordering
    // is unaffected: <Terrain> is the first child, so this is the FIRST item
    // in the FIFO and still builds before any content component's.
    let dress: ReturnType<typeof dressTerrain> | null = null;
    let dressCleanups: (() => void)[] = [];
    const cancelDress = park.enqueueBuild(() => {
      dress = dressTerrain(t, comp, terrain.heightAt, { noDress: props.noDress });
      __mark('dressTerrain');
      // mount the dressing as PER-ZONE chunks, not one park-spanning group: LOD
      // tiers are per runtime ENTRY, so a single group covering the whole plot is
      // always classified NEAR and never sheds its `lodDetail` filler. One entry
      // per wood / mountain cluster / meadow / sand flank means distant zones
      // really do drop to MID/FAR and halve their tree count.
      dressCleanups = dress.chunks.map((c) => park.addObject(c));
    }, 'terrain: dressTerrain');
    const cleanupDress = () => {
      cancelDress();
      dressCleanups.forEach((fn) => fn());
    };
    // ---- AUTO-keepDry hook (round-5 safeguard) -----------------------------
    // <Park>'s settle pass hands over EVERY registered footprint + the
    // as-built coaster polylines once all children have mounted; the guard
    // clamp re-runs over them (authors' keepDry is a hint, not a
    // requirement) and, when it touched anything, the terrain mesh, colours,
    // heightAt sampler and lint are REBUILT IN PLACE from the composition's
    // updated clamp discs. The dressing re-settles onto the new ground.
    let terrainMesh = terrain.mesh;
    let heightPrev = terrain.heightAt;
    (park as ParkStore)._reclamp = (rects, coasterPts) => {
      const rep = reclampTerrain(t, comp, rects, coasterPts);
      if (!rep.touched) return;
      const rebuilt = buildTerrain(t, terrainOf());
      tintTerrainForClimate(t, rebuilt.mesh, comp.climate, comp.basins, comp);
      g.remove(terrainMesh);
      disposeDeep(terrainMesh);
      g.add(rebuilt.mesh);
      terrainMesh = rebuilt.mesh;
      if (park.ground) {
        park.ground.heightAt = rebuilt.heightAt;
        park.ground.lint = terrainLint(rebuilt.heightAt, S, WATER_LEVEL);
      }
      park.api.setGroundSampler?.((x, z) =>
        Math.max(Math.abs(x), Math.abs(z)) <= S / 2 ? rebuilt.heightAt(x, z) : surround.heightAt(x, z),
      );
      // re-settle the auto-dressing onto the reshaped ground (the dressing is
      // chunked one group per zone, so the planted objects are the CHUNKS'
      // children — the chunks themselves sit at the origin). `dress` is queued
      // now, but the settle pass that calls this runs after the queue drains,
      // so it is always built by here — the guard is for a re-clamp forced
      // from a probe that flushed early.
      dress?.chunks.forEach((chunk) =>
        chunk.children.forEach((c) => {
          c.position.y += rebuilt.heightAt(c.position.x, c.position.z) - heightPrev(c.position.x, c.position.z);
        }),
      );
      heightPrev = rebuilt.heightAt;
      // RE-SETTLE THE STREET. The dressing was re-settled above; the paths were
      // not, so every clamp disc that raised the land under a footprint pushed
      // it up through the pavement beside it. <Paths> re-solves its heights
      // against the NEW `heightAt` and rebuilds its geometry (its `pathY`
      // reference level stays pinned, so nothing else has to move).
      (park as ParkStore)._resettlePaths?.();
      console.info(
        `[Park] AUTO-keepDry: terrain re-clamped under the registered footprints — raised ${rep.raised} wet sample(s), shaved ${rep.shaved} bulge(s), filled ${rep.filled} severed lobe cell(s), grew the water back with ${rep.expanded} basin(s); mesh/colours/heightAt rebuilt in place`,
      );
    };
    {
      // report the terrain's own cost into the same profile channel the build
      // queue uses, so probe-mount-cost.mjs can see it alongside the rest
      const w = typeof window !== 'undefined' ? (window as unknown as { __PARK_PROFILE?: boolean; __buildMarks?: { name: string; ms: number }[] }) : null;
      if (w?.__PARK_PROFILE) (w.__buildMarks ??= []).push({ name: 'Terrain (synchronous)', ms: performance.now() - __t0 });
    }
    return () => {
      (park as ParkStore)._reclamp = null;
      cleanupDress();
      cleanup();
      park.ground = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

// ---- <Paths> -------------------------------------------------------------------

export interface PathsProps {
  /** lattice nodes (multiples of 1.2; snapNetToGrid is applied as a safety
   *  pass) — `[x, z]`, or `[x, z, elevation]` TRIPLES for ramped/elevated
   *  spurs (the elevation travels WITH the node through grid snapping, no
   *  parallel array to manage; ramps, scaffolds, deck-matched stalls and
   *  guest walking heights all follow automatically) */
  nodes: (XZ | [number, number, number])[];
  edges: [number, number][];
  /** plaza rectangles `[cx, cz, w, d]` */
  plazas?: [number, number, number, number][];
  /** RCT2 grid lint (default true — a composed park must produce ZERO warnings) */
  grid?: boolean;
  /** per-node height offsets for ramped spurs (parallel to `nodes`) — prefer
   *  `[x, z, elevation]` node triples; when both are given the triples win */
  nodeY?: number[];
  width?: number;
  /** ambient strolling walkers on the network (visual only) */
  walkers?: number;
  /** litter-bin spots (meshes here + registered with the manager) */
  bins?: XZ[];
  /** what the street is MADE OF (default: municipal tarmac + concrete kerbs).
   *  Presets in `../PathNetwork`: `SURFACE_TARMAC` / `SURFACE_DIRT` /
   *  `SURFACE_BASALT` / `SURFACE_BOARDWALK` / `SURFACE_IRONPLATE` /
   *  `SURFACE_MOSSFLAG` / `SURFACE_NIGHTGLASS`, or any `PathSurface`.
   *  A themed land re-skins its own court, but the STREETS are these — leave
   *  it grey and a themed world is a costume over municipal infrastructure.
   *  Each world theme carries its own in `theme.pathSurface`. */
  surface?: PathSurface;
  /** REGIONAL surfaces — a park has ONE <Paths>, so a single `surface` cannot
   *  give five themed lands five different streets. Pass one zone per world
   *  (`{ ...plan.extent, surface: theme.pathSurface }`) and every path tile
   *  inside it paves itself; the hub and connecting avenues keep `surface`.
   *  Costs one merged mesh per DISTINCT surface, not per tile. */
  surfaceZones?: PathSurfaceZone[];
}

/** the street skeleton: ONE path level (the MEDIAN ground under the nodes +
 *  0.03, with auto `nodeY` ramps for outliers — round-7; a tight net keeps the
 *  legacy max-based level), `buildPathNetwork` with grid lint + plazas, earth
 *  berms under every span (`bermNetToGround`) and the bin meshes. Spans that
 *  would cross WATER or stand over 2 u in the air are REFUSED, not built.
 *  Mount AFTER <Terrain>. */
export function Paths({ nodes, edges, plazas = [], grid = true, nodeY, width = 1.1, walkers = 0, bins = [], surface, surfaceZones }: PathsProps) {
  const park = usePark('Paths');
  // the regions are part of the FINGERPRINT: swapping a world's theme has to
  // rebuild the network, since both its paving and its furniture come off it
  const regionKey = (park.themeRegions ? park.themeRegions() : []).map((r) => `${r.id}:${r.cx},${r.cz},${r.hx},${r.hz},${r.yaw}`).join('|');
  const key = JSON.stringify({ nodes, edges, plazas, grid, nodeY, width, walkers, bins, surface, surfaceZones, regionKey });
  useEffect(() => {
    if (!park.ground) throw new Error('<Paths> needs <Terrain> mounted first (declare it above)');
    const t = park.three;
    const waterLevel = park.ground.waterLevel;
    const snapped = snapNetToGrid(
      { nodes: nodes.map((n) => [...n] as XZ | [number, number, number]), edges: edges.map((e) => [...e] as [number, number]) },
      TILE,
    );
    // elevation API: [x, z, elevation] node triples win over a parallel nodeY
    // array (they survive snapNetToGrid's merging/re-indexing). The heights
    // are lifted into ONE resolved array and the stored net keeps plain
    // [x, z] pairs — routing, the GameManager and validatePark stay 2D.
    const hasElev = snapped.nodes.some((n) => n.length > 2);
    if (hasElev && nodeY)
      console.warn('[Park] <Paths> given BOTH [x, z, elevation] node triples and a nodeY array — using the triples');
    const nodeYres: number[] | undefined = hasElev ? snapped.nodes.map((n) => (n as number[])[2] ?? 0) : nodeY;
    snapped.nodes.forEach((n) => {
      if ((n as number[]).length > 2) (n as number[]).length = 2;
    });
    const parkNet = snapped as { nodes: XZ[]; edges: [number, number][] };
    // ---- ONE BUILD PASS, RE-RUNNABLE (2026-07) -----------------------------
    // <Park>'s settle pass runs AUTO-keepDry (`reclampTerrain`) after every
    // child has mounted, and <Terrain> then rebuilds mesh + `heightAt` IN
    // PLACE. Until now the auto-DRESSING was re-settled onto the new ground and
    // nothing else was: the street kept the heights it had solved against the
    // OLD terrain, so a raise disc under a ride pad pushed the land up through
    // the pavement beside it. Measured on worlds-ref, that was the entire
    // residual left after the height solve.
    //
    // The choice was "reserve the corridor before the clamp" vs "re-settle the
    // paths after it". RE-SETTLE, because the clamp exists to keep registered
    // footprints dry and un-buried: carving a protected corridor through it
    // would make the clamp fail at the job it is there for (a street crossing a
    // footprint's raise disc would veto the raise and the ride goes back into
    // the water). Re-solving is also the cheap direction — the expensive thing,
    // the terrain, has already been rebuilt.
    //
    // The re-settle keeps `pathY` PINNED to the first pass's value and only
    // re-solves the per-node offsets, so every consumer that keyed off the
    // reference level (the gate, deck-matched stalls, the queue lane Y, the
    // validator's grade-crossing datum) sees exactly the number it saw at
    // mount; only the street's own profile moves.
    let cleanupBuild: (() => void) | null = null;
    let pinnedPathY: number | null = null;
    let streetN: number | null = null;
    let streetE: number | null = null;
    const linted = new Set<string>();
    // one report per KIND per <Paths> instance — a re-settle must not double
    // every lint the first pass already raised
    const lint = (kind: string, msg: string, fatal: boolean) => {
      if (linted.has(kind)) return;
      linted.add(kind);
      park.reportLint(kind, msg, fatal);
    };
    const build = () => {
    const groundAt = park.ground!.heightAt; // RE-READ: the clamp rebuilds it
    // THE STREET TOPOLOGY, snapshotted on the FIRST pass. By the time a
    // re-settle runs, `routing.attach()` has PUSHED the manager's logical
    // access spurs (queue tails, stall fronts, doorways) onto the very same
    // `parkNet.nodes`/`edges` arrays — they are shared deliberately so
    // `walkYAt` samples them. Solving or RENDERING those as streets would pave
    // a diagonal stall stub and inflate `streetNodes`, which is exactly what
    // the validator's "paths run N/S/E/W only" gate then failed on. Everything
    // below therefore works on the street PREFIX; the spur entries stay
    // sample-only, as they were before the clamp.
    const nN = streetN ?? parkNet.nodes.length;
    const nE = streetE ?? parkNet.edges.length;
    const isResettle = streetN !== null;
    const bNodes = parkNet.nodes.slice(0, nN);
    let bEdges = parkNet.edges.slice(0, nE);
    let hiGround = -Infinity;
    let hiNode = 0;
    const nodeGrounds = bNodes.map(([x, z]) => groundAt(x, z));
    nodeGrounds.forEach((gh, i) => {
      if (gh > hiGround) {
        hiGround = gh;
        hiNode = i;
      }
    });
    const sortedGrounds = [...nodeGrounds].sort((a, b) => a - b);
    const medianGround = sortedGrounds[Math.floor(sortedGrounds.length / 2)] ?? 0;
    // ---- THE STREET FOLLOWS THE LAND (2026-07) -----------------------------
    // RCT2 never lays a street at ONE level over rolling ground. A footpath
    // element takes its base Z from the SURFACE element under its own tile —
    // `Footpath.cpp:109-115 kDefaultPathSlope[]` maps every land-slope
    // configuration to flat / sloped(dir) / RAISE — and
    // `Paint.Path.cpp:665-693 ShouldDrawSupports()` puts support columns under
    // any path whose base stands above that surface. The path is never buried.
    //
    // This component derived ONE level for the whole network (the max ground
    // under its nodes, or the median with capped per-node "auto ramps" once the
    // spread got large) and that CANNOT follow rolling ground. Measured on the
    // sample corpus before this change (`harness/park-eval/probe-path-clip.mjs`):
    //   * worlds-ref   0.43 u buried, 31 % of surface samples under the terrain,
    //                  72 of 181 spans clipping;
    //   * voltmoor     0.34 u buried, 19 % of samples, 25 of 109 spans;
    //   * district-ref 0.23 u buried AND 87 % of its samples floating > 0.35 u —
    //                  the same flat slab that sinks into the rises stands on a
    //                  berm wall everywhere else.
    // Most of it was LATERAL: a slab that is level across its 1.1 u width
    // buries its uphill kerb on any side-slope steeper than ~0.6 long before its
    // centreline touches. The old auto-ramp could not have fixed that at any
    // cap — it only moved whole NODES, and it capped them at 0.20 u.
    //
    // `solvePathHeights` (../PathNetwork) replaces the whole scheme: a per-node
    // surface that clears the CORRIDOR ground (sampled across the slab's width,
    // RCT2's "highest corner of the tile under the path"), ramps between nodes
    // inside the walkable grade (0.5 rise per 1.2 tile), and is the pointwise
    // LOWEST surface that does both — so a span between nodes of differing
    // height ramps along its LENGTH instead of stepping at a node, and nothing
    // floats higher than the grade rule forces. Whatever lift is left is carried
    // by `bermNetToGround`'s earth berms, or past SCAFFOLD_LIFT by the network's
    // own wooden supports.
    //
    // A tight, flat network is left EXACTLY as it was: when the legacy flat
    // level (max node ground + 0.03) already dominates the solution it is
    // feasible by construction (a constant above every solved node height
    // clears every corridor sample it interpolates over), so it is kept
    // bit-identical and `nodeY` stays undefined. Authored `[x, z, elevation]`
    // triples are a FLOOR, never lowered — they are only raised if the ground or
    // the grade rule demands it.
    //
    // PLAZAS are NOT pinned here. They used to be levelled as a block and the
    // nodes they swallow pinned to that level; on a rise that hoisted four
    // district-ref nodes 1.0 u and the grade rule spread the lift a dozen tiles
    // either way — a causeway over flat ground. A plaza is a block of RCT2
    // centre TILES, each sitting on its own tile's surface, so buildPathNetwork
    // levels them tile by tile against the same ground and nothing is pinned.
    const LEVEL_SPREAD = 0.35;
    const spread = hiGround - medianGround;
    const CLEARANCE = 0.03;
    const legacyY = hiGround + CLEARANCE;
    const authoredFloor = nodeYres ? bNodes.map((_, i) => legacyY + (nodeYres[i] ?? 0)) : undefined;
    const solved = solvePathHeights(bNodes, bEdges, groundAt, { clearance: CLEARANCE, width, floor: authoredFloor });
    const solvedH = solved.h;
    const hiSolved = solvedH.length ? Math.max(...solvedH) : legacyY;
    // does the legacy flat level already clear everything? (see above — a
    // constant >= every solved node height is feasible for the whole net)
    const legacyOk = !authoredFloor
      ? legacyY >= hiSolved - 1e-9
      : solvedH.every((v, i) => v <= (authoredFloor[i] ?? 0) + 1e-9);
    let pathY: number;
    let nodeYuse = nodeYres;
    if (legacyOk) {
      pathY = legacyY;
    } else {
      const sortedH = [...solvedH].sort((a, b) => a - b);
      pathY = pinnedPathY ?? +(sortedH[Math.floor(sortedH.length / 2)] ?? medianGround + CLEARANCE).toFixed(4);
      // sub-millimetre offsets are noise: zero them so a level run stays a FLAT
      // slab (buildPathNetwork only builds a ramp ribbon for |dy| > 1e-6)
      nodeYuse = solvedH.map((v) => {
        const off = v - pathY;
        return Math.abs(off) < 0.0015 ? 0 : +off.toFixed(4);
      });
      const sank = nodeGrounds.filter((gh, i) => pathY + (nodeYuse?.[i] ?? 0) < gh + CLEARANCE - 1e-6).length;
      const lifted = solvedH
        .map((v, i) => ({ i, lift: v - (nodeGrounds[i] + CLEARANCE) }))
        .filter((r) => r.lift > LEVEL_SPREAD)
        .sort((a, b) => b.lift - a.lift);
      lint(
        'pathLevelMedian',
        `<Paths> node grounds span ${spread.toFixed(2)} u, so a single flat level would ${
          hiSolved > legacyY ? 'BURY the street where the corridor rises' : 'stand it on a berm wall'
        }: the surface now FOLLOWS THE LAND (reference level ${pathY.toFixed(2)}, ${
          nodeYuse.filter((v) => v !== 0).length
        } of ${nodeYuse.length} nodes carry a ramp offset, worst ${Math.max(...nodeYuse.map((v) => Math.abs(v))).toFixed(
          2,
        )} u). Every span ramps along its LENGTH inside the walkable grade (0.5 rise per 1.2 tile) and no slab sits below the ground across its cleared width (${sank} node(s) still under ground).${
          lifted.length
            ? ` ${lifted.length} node(s) are held ABOVE their own ground by the grade rule — the land there falls faster than a path may: ${lifted
                .slice(0, 4)
                .map(({ i, lift }) => `${i}[${bNodes[i][0].toFixed(1)}, ${bNodes[i][1].toFixed(1)}] +${lift.toFixed(2)}`)
                .join(', ')}${lifted.length > 4 ? ', …' : ''} — they get earth berms below 0.35 u and wooden supports above it. Route those runs along the contour, or add intermediate nodes so the descent has room (rules/park-generation.md §0.6/§2.3)`
            : ''
        }`,
        false,
      );
    }
    // CAUSEWAY LINT (round-1 safeguard, re-armed in round 6): ONE path level =
    // max ground under the NODES — a single node on a rise lifts the whole
    // network onto tall berms.
    //
    // ROUND-6 FIX: the node-vs-median test alone MISSES the common case. A
    // street whose nodes all sit on high ground but whose SPAN crosses a river
    // bank dips nowhere at its nodes — the mid-span ground falls away and
    // buildPathNetwork quietly puts the whole edge on a wooden viaduct
    // (bermNetToGround skips anything over SCAFFOLD_LIFT). A round-6 park
    // hoisted an edge 2.21 u over a bank and this lint stayed silent. Sample
    // every RENDERED span against the resolved walking surface and report the
    // worst lift; over CAUSEWAY_LIFT it is a §0-FATAL lint (validatePark fails
    // the park), not a console whisper.
    //
    // ROUND-7: the lift check now runs BEFORE buildPathNetwork and can REFUSE.
    // Reporting a 3.34-u viaduct after building it still ships the screenshot
    // of a scaffold bridge over a lake, so a span over CAUSEWAY_HARD (2.0 u)
    // — or one whose ground is UNDER WATER — is NOT BUILT at all: the edge is
    // dropped from the rendered/routed net and the §0-FATAL lint says so. Node
    // INDICES are never touched (authors index them for queue tails), only
    // edges are pruned.
    // ON A RE-SETTLE this whole audit is SKIPPED. It can REFUSE spans, and the
    // refusal decision was taken at mount — the routing graph, the queue tails
    // and the manager are all built on it. Re-running it against the clamped
    // ground would drop an edge out from under a live route (the clamp GROWS
    // the water back, so a span that was dry at mount can read as a pier), and
    // the mount-time verdict is the one the park was assembled around.
    if (!isResettle) {
      const CAUSEWAY_LIFT = 1.0; // one RCT2 "level" of clear air under a slab
      const CAUSEWAY_HARD = 2.0; // above this the span is refused, not built
      const wl = waterLevel;
      if (pathY - medianGround > 0.8) {
        const [hx, hz] = bNodes[hiNode];
        lint(
          'causeway',
          `<Paths> level ${pathY.toFixed(2)} sits ${(pathY - medianGround).toFixed(
            2,
          )} u above the median ground under its nodes — node ${hiNode} at [${hx.toFixed(1)}, ${hz.toFixed(
            1,
          )}] forces a causeway; reroute that node or use nodeY ramps (rules/park-generation.md §0.6/§2.3)`,
          true,
        );
      }
      // per-SPAN audit against the ground beneath it (the bank-crossing case)
      const surfaceAt = (a: number, b: number, u: number) => {
        const sA = pathY + (nodeYuse?.[a] ?? 0);
        const sB = pathY + (nodeYuse?.[b] ?? 0);
        return sA + (sB - sA) * u;
      };
      let worstLift = 0;
      let worstEdge = -1;
      let worstAt: XZ = [0, 0];
      const refused: number[] = [];
      bEdges.forEach(([a, b], ei) => {
        const [ax, az] = bNodes[a];
        const [bx, bz] = bNodes[b];
        let lift = 0;
        let at: XZ = [ax, az];
        let wettest = Infinity;
        let wetAt: XZ = [ax, az];
        for (let k = 0; k <= 12; k += 1) {
          const u = k / 12;
          const px = ax + (bx - ax) * u;
          const pz = az + (bz - az) * u;
          const gh = groundAt(px, pz);
          const l = surfaceAt(a, b, u) - gh;
          if (l > lift) {
            lift = l;
            at = [px, pz];
          }
          if (gh < wettest) {
            wettest = gh;
            wetAt = [px, pz];
          }
        }
        // (a) LATTICE OVER WATER (round-7): the composed water body can move
        // away from the seed table's listed disc — round-7's grid bridged the
        // re-picked lake on stilts. A span whose ground dips below the
        // waterline is not a street, it is a pier: refuse it.
        if (wettest < wl + 0.05) {
          refused.push(ei);
          lint(
            'latticeInWater',
            `<Paths> edge ${ei} (${a}→${b}) crosses WATER — ground ${wettest.toFixed(2)} near [${wetAt[0].toFixed(1)}, ${wetAt[1].toFixed(
              1,
            )}] is below waterline+0.05 = ${(wl + 0.05).toFixed(
              2,
            )}. The span was REFUSED (not built): the composed water body is NOT where the §1 seed table lists it once your keepDry re-picks it — re-read the real one with \`usePark().terrain.water\` / \`park.isDry(cell)\` AFTER composition and route the lattice around it (rules/park-generation.md §0.6/§1)`,
            true,
          );
          return;
        }
        if (lift > worstLift) {
          worstLift = lift;
          worstEdge = ei;
          worstAt = at;
        }
        // (b) a VIADUCT: refused outright above the hard limit
        if (lift > CAUSEWAY_HARD) {
          refused.push(ei);
          lint(
            'causewayRefused',
            `<Paths> edge ${ei} (${a}→${b}) would stand ${lift.toFixed(2)} u in the air near [${at[0].toFixed(1)}, ${at[1].toFixed(
              1,
            )}] — over the ${CAUSEWAY_HARD.toFixed(
              1,
            )} u HARD limit, so the span was REFUSED (not built): a scaffolded viaduct is not a street. Route the edge around the dip, add an intermediate node on buildable ground, or nodeY-ramp down to it (rules/park-generation.md §0.6/§2.3)`,
            true,
          );
        }
      });
      if (refused.length) {
        const drop = new Set(refused);
        bEdges = bEdges.filter((_, ei) => !drop.has(ei));
        if (!isResettle) parkNet.edges = bEdges;
        console.warn(
          `[Park] <Paths> REFUSED ${refused.length} span(s) (over water / over the ${CAUSEWAY_HARD.toFixed(
            1,
          )} u viaduct limit) — the street graph is now missing those links, so expect accessibility failures until the layout is re-planned`,
        );
      }
      if (worstLift > CAUSEWAY_LIFT && worstLift <= CAUSEWAY_HARD)
        lint(
          'causeway',
          `<Paths> edge ${worstEdge} is hoisted ${worstLift.toFixed(2)} u over the ground beneath it near [${worstAt[0].toFixed(
            1,
          )}, ${worstAt[1].toFixed(1)}] — that is a CAUSEWAY/viaduct, not a street (limit ${CAUSEWAY_LIFT.toFixed(
            1,
          )} u, hard stop ${CAUSEWAY_HARD.toFixed(
            1,
          )} u). The span crosses a dip or a bank: route the edge around it, add an intermediate node on buildable ground, or nodeY-ramp down to it (rules/park-generation.md §0.6/§2.3)`,
          true,
        );
    }
    // PathNetwork levels plazas TILE BY TILE against the same ground the
    // streets follow, so `plazaY` here is only a REFERENCE (bins / floorAt
    // fallback) — the truth is `net.plazaBase` per plaza, `net.walkYAt` per
    // point.
    const plazaY = pathY + 0.096;
    const g = new t.Group();
    // ---- SPUR HEIGHTS -------------------------------------------------------
    // Spur nodes ride the street node they hang off, so `walkYAt` puts a stall
    // front / queue tail / exit end at the pavement level beside it, not at the
    // network's flat reference.
    //
    // WALK THE CHAIN, don't just look one hop. `routing.attach` links a spur to
    // its NEAREST node — and that can be ANOTHER SPUR: a ride's queue tail and
    // its exit path routinely land in the SAME cell, and the exit end's
    // coordinates come out of `planExitLane`'s arithmetic a floating-point hair
    // off the lattice, so the queue-tail spur already sitting there wins
    // `nearestNode` by ~1e-16 over the street node at the exact cell centre.
    // The old one-hop lookup then found a non-street neighbour and fell back to
    // 0 — leaving that spur at the REFERENCE level, where `buildPathNetwork`
    // duly drew it a full 1.22 u junction PAD. MEASURED: a pad standing +0.0095
    // u proud of the graded street at three of six rides (and buried 0.08 u
    // under it at a fourth), which is exactly the step a ride's access run then
    // could not close. harness/mp3d-render/probe-lane-joins.mjs.
    const nodeYfull = nodeYuse
      ? parkNet.nodes.map((_, i) => {
          if (i < nN) return nodeYuse![i] ?? 0;
          const seen = new Set<number>([i]);
          let cur = i;
          for (let hop = 0; hop < 8; hop += 1) {
            const e = parkNet.edges.find(([a2, b2]) => (a2 === cur && !seen.has(b2)) || (b2 === cur && !seen.has(a2)));
            if (!e) break;
            const j = e[0] === cur ? e[1] : e[0];
            if (j < nN) return nodeYuse![j] ?? 0; // reached real pavement
            seen.add(j);
            cur = j;
          }
          return 0;
        })
      : undefined;
    // ---- THEME REGIONS pave their own roads ---------------------------------
    // An explicit `surfaceZones` still wins (an author who lists them keeps full
    // control), but with none given the zones are DERIVED from the park's
    // registered theme regions — which is the whole point of a region: declare
    // "this rectangle is Emberfall" once and the streets through it are basalt
    // without anyone restating it per <Paths>. `themeAt` additionally dresses the
    // FURNITURE on those streets (PathNetwork bucketS by theme id).
    const regions = park.themeRegions ? park.themeRegions() : [];
    const derivedZones: PathSurfaceZone[] =
      surfaceZones ??
      regions.map((r) => ({ cx: r.cx, cz: r.cz, hx: r.hx, hz: r.hz, yaw: r.yaw, surface: r.theme.pathSurface }));
    if (!surfaceZones && regions.length)
      console.info(
        `[Park] <Paths> paved ${regions.length} THEME REGION(s) from their own themes (${regions
          .map((r) => r.id)
          .join(', ')}) — no surfaceZones prop needed; pass one to override`,
      );
    const net = buildPathNetwork(t, parkNet, {
      width,
      y: pathY,
      groundAt,
      grid,
      plazas,
      nodeY: nodeYfull,
      renderEdges: bEdges.length,
      surface,
      surfaceZones: derivedZones,
      // verge benches / bins / lamps take the theme of the region they stand in
      themeAt: park.themeFurnitureAt ? (x, z) => park.themeFurnitureAt(x, z) : undefined,
    });
    g.add(net.group);
    const upds: ((time: number) => void)[] = [net.update];
    if (walkers > 0) upds.push(attachWalkers(t, g, net, { count: walkers })); // BEFORE the manager exists
    // ONE grounding pass: bermNetToGround berms LOW spans only (grounded
    // ramps get an inclined earth embankment UNDER the ribbon) — spans/pads
    // lifted > 0.35 above the terrain (nodeY ramps, deep dips) are skipped
    // because buildPathNetwork (given groundAt) plants RCT2 wooden scaffolds
    // under them instead
    bermNetToGround(t, g, { nodes: bNodes, edges: bEdges }, pathY, groundAt, nodeYuse);
    // ---- CLIP GATE: measure the AS-BUILT surface against the ground ---------
    // Everything above is a derivation; this is the measurement. Walk the
    // rendered walking surface (`net.walkYAt` — the exact sampler the slabs,
    // ramps, pads and plaza tiles were built from) along every span and ACROSS
    // its width, and compare it with the terrain underneath. A path that is
    // under the ground it crosses is the defect the user sees, so it is a
    // §0-FATAL lint, not a console whisper: the same measurement the harness
    // runs (`harness/park-eval/probe-path-clip.mjs`), inside the component, so
    // it cannot regress silently.
    //
    // TWO tolerances, because the height solve deliberately clears only the
    // inner 80 % of the slab (PathNetwork's CORRIDOR_REACH / CROSS_SLOPE_CAP):
    // the outermost sliver of kerb is allowed to tuck into a steep bank, which
    // is what a path CUT INTO a hillside looks like. So the cleared corridor
    // must be clean to 0.04 u, and the extreme kerb only has to stay out of
    // visible burial (0.25 u — measured on the corpus, the worst legitimate
    // tuck is 0.17 u on worlds-ref, where a street hugs a very steep bank and
    // the render still shows unbroken pavement; past ~0.25 the slab edge goes).
    {
      const CLIP_TOL = 0.05;
      const EDGE_TOL = 0.25;
      let worst = 0;
      let worstAt: XZ = [0, 0];
      let worstEdgeLat = 0;
      let clipped = 0;
      let total = 0;
      const half = width / 2 - 0.02;
      const inner = half * 0.7; // safely INSIDE PathNetwork's cleared 0.8 reach
      const probeAt = (x: number, z: number, outer = false) => {
        // the WALKED TOP of the slab against the ground — the same quantity
        // probe-path-clip.mjs reports, so the two can never disagree. Nominal
        // is +0.12 (a 0.03 base clearance under a 0.09 slab); negative means
        // the terrain is coming up THROUGH the pavement.
        const d = net.walkYAt(x, z) - groundAt(x, z);
        if (outer) {
          if (d < worstEdgeLat) worstEdgeLat = d;
          return;
        }
        total += 1;
        if (d < -CLIP_TOL) clipped += 1;
        if (d < worst) {
          worst = d;
          worstAt = [x, z];
        }
      };
      bEdges.forEach(([a, b]) => {
        const [ax, az] = bNodes[a];
        const [bx, bz] = bNodes[b];
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz);
        if (!(len > 1e-6)) return;
        const nx = -dz / len;
        const nz = dx / len;
        const n = Math.max(2, Math.ceil(len / 0.2));
        for (let k = 0; k <= n; k += 1) {
          const u = k / n;
          for (const lat of [-inner, 0, inner]) probeAt(ax + dx * u + nx * lat, az + dz * u + nz * lat);
          for (const lat of [-half, half]) probeAt(ax + dx * u + nx * lat, az + dz * u + nz * lat, true);
        }
      });
      plazas.forEach(([cx, cz, pw, pd]) => {
        for (let x = cx - pw / 2; x <= cx + pw / 2 + 1e-6; x += 0.5)
          for (let z = cz - pd / 2; z <= cz + pd / 2 + 1e-6; z += 0.5) probeAt(x, z);
      });
      // FATAL vs REPORTED. A path is VISIBLY buried when the ground stands more
      // than about twice the slab's own thickness above it (EDGE_TOL, 0.25 u), or when a
      // measurable share of the corridor is under the terrain at all — that is
      // the state this whole pass exists to prevent, and the before-state of
      // every sample park (worlds-ref 0.43 u over 31 % of samples, voltmoor
      // 0.34 over 12 %) trips both. A lone spike where the street runs along a
      // near-cliff (worlds-ref keeps one, 0.17-0.19 u on 0.5 % of samples: the
      // cross-fall there is ~1.5, steeper than any 1.1 u slab can sit on
      // without standing on a wall) is REPORTED, not failed — the author needs
      // to know the route hugs a cliff, but the pavement still reads as
      // pavement and refusing the park would be a false alarm.
      const clipFrac = total ? clipped / total : 0;
      const clipFatal = worst < -EDGE_TOL || clipFrac > 0.01 || worstEdgeLat < -EDGE_TOL;
      if (worst < -CLIP_TOL || worstEdgeLat < -EDGE_TOL)
        lint(
          'pathClipping',
          `<Paths> the street SINKS INTO THE LAND: the walked surface is ${(-worst).toFixed(
            2,
          )} u below the terrain near [${worstAt[0].toFixed(1)}, ${worstAt[1].toFixed(
            1,
          )}] (${clipped} of ${total} corridor samples buried past ${CLIP_TOL.toFixed(2)} u; the extreme kerb is ${(-worstEdgeLat).toFixed(
            2,
          )} u in against a ${EDGE_TOL.toFixed(2)} u allowance; ${(clipFrac * 100).toFixed(
            1,
          )} % of the corridor). A path is flat or a single-step slope ON the ground it crosses, never inside it (RCT2: Footpath.cpp kDefaultPathSlope, Paint.Path.cpp ShouldDrawSupports). The height solve clears the ground across the corridor, so a residual means something moved the terrain UNDER the finished network — an AUTO-keepDry re-clamp, or an authored [x, z, elevation] triple pinned below its own ground (rules/park-generation.md §0.6/§2.3)`,
          clipFatal,
        );
    }
    const plazaAt = (x: number, z: number) =>
      plazas.findIndex(([cx, cz, w, d]) => Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= d / 2);
    bins.forEach(([bx, bz]) => {
      // a bin stands on the surface it is ON, not on the network's reference
      // level — walkYAt already resolves plaza tiles, ramps and pads
      const pi = plazaAt(bx, bz);
      const by = pi >= 0 ? (net.plazaBase[pi] ?? pathY) + 0.096 : net.walkYAt(bx, bz) - 0.09;
      g.add(cyl(t, 0.09, 0.08, 0.26, 0x24282c, [bx, by + 0.13, bz], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.6, seg: 12 }));
      g.add(cyl(t, 0.02, 0.095, 0.06, 0x24282c, [bx, by + 0.29, bz], { metal: 0.3, rough: 0.6, seg: 12 }));
    });
    park.paths = { net: parkNet, pathY, plazaY, plazas, bins, width, streetNodes: nN };
    // stash the RESOLVED ramp offsets (triples or nodeY) so <Stall>/<Restroom>
    // can deck-match a nearby ELEVATED node (they stand at its level on a
    // scaffold, never floating), plus the walking-surface sampler so the
    // GameManager can drape guests over ramps (walkYAt(x, z) = path surface
    // height anywhere on the network, base level off-network)
    (park.paths as ParkPathsInfo & { nodeY?: number[]; walkYAt?: (x: number, z: number) => number }).nodeY = nodeYfull;
    (park.paths as ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }).walkYAt = net.walkYAt;
    // …and the RENDERED surface sampler beside it. `walkYAt` is the SIM datum
    // (`node + 0.09`); `surfaceYAt` is what is actually DRAWN there — the
    // per-edge slab top, a junction pad's finished level, a knuckle pad's bevel.
    // A ride's queue lane and exit footpath ramp to THIS so their slabs land
    // flush on the street instead of a few millimetres under it (see
    // PathNetwork/build.ts `surfaceYAt` and GameManager/access.ts).
    (park.paths as ParkPathsInfo & { surfaceYAt?: (x: number, z: number) => number }).surfaceYAt = net.surfaceYAt;
    (park.paths as ParkPathsInfo & { plazaLevels?: number[] }).plazaLevels = net.plazaBase;
    // the verge bench SEATS, for the manager's rest stop (parkContext `benches`)
    (park.paths as ParkPathsInfo).benches = net.benches;
    // …and if this is a RE-SETTLE the manager already read the old list, so
    // hand it the new seats rather than leave guests sitting on benches that
    // have just been rebuilt somewhere else
    (park as ParkStore)._managerInst?.setBenches(net.benches);
    pinnedPathY = pathY;
    if (streetN === null) {
      streetN = nN;
      streetE = bEdges.length;
    }
    cleanupBuild = park.addObject(g, (tt) => upds.forEach((u) => u(tt)), { lod: 'full' }); // spans the park
    };
    build();
    // <Terrain>'s AUTO-keepDry calls this once it has rebuilt `heightAt`
    (park as ParkStore)._resettlePaths = () => {
      if (!park.ground) return;
      cleanupBuild?.();
      cleanupBuild = null;
      build();
    };
    return () => {
      (park as ParkStore)._resettlePaths = null;
      cleanupBuild?.();
      park.paths = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

