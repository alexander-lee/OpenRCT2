import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { box, cyl } from '../Stage';
import {
  parkComposition,
  tintTerrainForClimate,
  dressTerrain,
  terrainLint,
  planRideAccess,
  laneLenOf,
  bermNetToGround,
  plinthUnder,
  groundRideAccess,
  reclampTerrain,
  surroundPalette,
  WATER_LEVEL,
  TILE,
} from '../ParkBuilder';
import type { ParkClimate, ParkFootRect } from '../ParkBuilder';
import { buildTerrain, buildSurround } from '../TerrainKit';
import { buildWater } from '../WaterTile';
import { buildPathNetwork, snapNetToGrid } from '../PathNetwork';
import { attachWalkers } from '../PathWalkers';
import { buildParkEntrance } from '../ParkEntrance';
import { buildRestroom } from '../Restroom';
import { buildBalloonStand } from '../BalloonStand';
import { buildFountain } from '../Fountain';
import { buildTorch } from '../Torch';
import { buildNeonSign } from '../NeonSign';
import { buildDanceFloor } from '../DanceFloor';
import { buildSceneryAnimated } from '../SceneryPack';
import { buildStringLights, buildLightPole } from '../StringLights';
import { rideColourPreset } from '../ColorKit';
import type { RideColourScheme } from '../ColorKit';
import type { StallItemKind } from '../GameManager';
import { usePark, xzOf, yOf, isXZ, disposeDeep } from './parkContext';
import type { MovableRec, ParkContextValue, ParkPathsInfo, ParkPosition, ParkStore, V3, XZ } from './parkContext';
import { ConfigurableStall } from './configurableRide';

// ---- <Terrain> ----------------------------------------------------------------

export interface TerrainProps {
  seed?: number;
  climate?: ParkClimate;
  size?: number;
  /** world cells YOUR layout builds on — the composition probe keeps them dry */
  keepDry?: XZ[];
  /** planned coaster control points `[x, yAboveRef, z]` (peaks pre-capped) */
  coasterPts?: V3[];
  seg?: number;
}

/** `parkComposition` + `buildTerrain` + climate tint + ONE `buildWater` sheet
 *  at the waterline; registers `heightAt` as the Stage's ground sampler.
 *  ALWAYS the first child of a `<Park>`. */
export function Terrain(props: TerrainProps) {
  const park = usePark('Terrain');
  const key = JSON.stringify(props);
  useEffect(() => {
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
    tintTerrainForClimate(t, terrain.mesh, comp.climate, comp.basins, comp); // climate bias + terrain-SECTION zone paint
    const water = buildWater(t, S * 0.995, 120);
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
      ridge: Math.max(7, Math.min(30, S * 0.11)), // distant ranges, sub-pixel-safe at range
      ground: pal.ground,
      crest: pal.crest,
      haze: sceneFog ? sceneFog.color.getHex() : 0xa8cdd9,
      waterLevel: WATER_LEVEL,
    });
    g.add(surround.mesh);
    park.ground = {
      heightAt: terrain.heightAt,
      waterLevel: WATER_LEVEL,
      size: S,
      comp,
      lint: terrainLint(terrain.heightAt, S, WATER_LEVEL),
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
    // dunes/palms — deterministic, keeps clear of keepDry cells + the planned
    // coaster; default 'auto' LOD so dense clusters throttle at distance
    const dress = dressTerrain(t, comp, terrain.heightAt);
    // mount the dressing as PER-ZONE chunks, not one park-spanning group: LOD
    // tiers are per runtime ENTRY, so a single group covering the whole plot is
    // always classified NEAR and never sheds its `lodDetail` filler. One entry
    // per wood / mountain cluster / meadow / sand flank means distant zones
    // really do drop to MID/FAR and halve their tree count.
    const dressCleanups = dress.chunks.map((c) => park.addObject(c));
    const cleanupDress = () => dressCleanups.forEach((fn) => fn());
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
      // children — the chunks themselves sit at the origin)
      dress.chunks.forEach((chunk) =>
        chunk.children.forEach((c) => {
          c.position.y += rebuilt.heightAt(c.position.x, c.position.z) - heightPrev(c.position.x, c.position.z);
        }),
      );
      heightPrev = rebuilt.heightAt;
      console.info(
        `[Park] AUTO-keepDry: terrain re-clamped under the registered footprints — raised ${rep.raised} wet sample(s), shaved ${rep.shaved} bulge(s), filled ${rep.filled} severed lobe cell(s), grew the water back with ${rep.expanded} basin(s); mesh/colours/heightAt rebuilt in place`,
      );
    };
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
}

/** the street skeleton: ONE path level (the MEDIAN ground under the nodes +
 *  0.03, with auto `nodeY` ramps for outliers — round-7; a tight net keeps the
 *  legacy max-based level), `buildPathNetwork` with grid lint + plazas, earth
 *  berms under every span (`bermNetToGround`) and the bin meshes. Spans that
 *  would cross WATER or stand over 2 u in the air are REFUSED, not built.
 *  Mount AFTER <Terrain>. */
export function Paths({ nodes, edges, plazas = [], grid = true, nodeY, width = 1.1, walkers = 0, bins = [] }: PathsProps) {
  const park = usePark('Paths');
  const key = JSON.stringify({ nodes, edges, plazas, grid, nodeY, width, walkers, bins });
  useEffect(() => {
    if (!park.ground) throw new Error('<Paths> needs <Terrain> mounted first (declare it above)');
    const t = park.three;
    const groundAt = park.ground.heightAt;
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
    let hiGround = -Infinity;
    let hiNode = 0;
    const nodeGrounds = parkNet.nodes.map(([x, z]) => groundAt(x, z));
    nodeGrounds.forEach((gh, i) => {
      if (gh > hiGround) {
        hiGround = gh;
        hiNode = i;
      }
    });
    const sortedGrounds = [...nodeGrounds].sort((a, b) => a - b);
    const medianGround = sortedGrounds[Math.floor(sortedGrounds.length / 2)] ?? 0;
    // ---- ONE PATH LEVEL, from the MEDIAN ground (round-7 safeguard) --------
    // §0.6 has always said "the path level hugs the MEDIAN ground under your
    // nodes, never the max" — but the component derived it from the SINGLE
    // HIGHEST node, so one node on a rise hoisted the whole street. Round-7's
    // park levelled at 0.68 while the ground fell away to −2.66: maxLift
    // 3.34 u, rampNodes 0 — a scaffolded viaduct over a lake.
    //
    // The level is now the MEDIAN (+0.03) whenever the spread says the max
    // would lie: nodes that then sit ABOVE the slab get an automatic `nodeY`
    // RAMP so they still ride their own ground instead of being buried, and
    // nodes in a hollow ramp DOWN to theirs instead of flying. A tight net
    // (spread ≤ 0.35 — every well-planned park) keeps the exact old
    // max-based level, bit-identical, and an author-supplied nodeY/triple
    // list is never second-guessed.
    const LEVEL_SPREAD = 0.35;
    const spread = hiGround - medianGround;
    let pathY: number;
    let autoRamped: number[] = [];
    let nodeYuse = nodeYres;
    if (nodeYres || spread <= LEVEL_SPREAD) {
      pathY = hiGround + 0.03;
    } else {
      pathY = medianGround + 0.03;
      const auto = parkNet.nodes.map(() => 0);
      nodeGrounds.forEach((gh, i) => {
        const delta = gh + 0.03 - pathY;
        if (Math.abs(delta) > LEVEL_SPREAD) {
          auto[i] = +delta.toFixed(3);
          autoRamped.push(i);
        }
      });
      if (autoRamped.length) {
        nodeYuse = auto;
        park.reportLint(
          'pathLevelMedian',
          `<Paths> node grounds span ${spread.toFixed(2)} u, so the level was taken from the MEDIAN (${pathY.toFixed(
            2,
          )}, not max ${(hiGround + 0.03).toFixed(2)} — §0.6) and ${autoRamped.length} outlier node(s) got an AUTO nodeY ramp: ${autoRamped
            .slice(0, 6)
            .map((i) => `${i}[${parkNet.nodes[i][0].toFixed(1)}, ${parkNet.nodes[i][1].toFixed(1)}] ${auto[i] > 0 ? '+' : ''}${auto[i].toFixed(2)}`)
            .join(', ')}${autoRamped.length > 6 ? ', …' : ''}. Auto-ramps are NOT audited against the ramp-grade rules (max 0.5 per 1.2 tile, straight runs) — author the ramp nodes as [x, z, elevation] TRIPLES, or move the outlier nodes onto buildable ground (§2.3)`,
          false,
        );
      } else {
        autoRamped = [];
      }
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
    {
      const CAUSEWAY_LIFT = 1.0; // one RCT2 "level" of clear air under a slab
      const CAUSEWAY_HARD = 2.0; // above this the span is refused, not built
      const wl = waterLevel;
      if (pathY - medianGround > 0.8) {
        const [hx, hz] = parkNet.nodes[hiNode];
        park.reportLint(
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
      parkNet.edges.forEach(([a, b], ei) => {
        const [ax, az] = parkNet.nodes[a];
        const [bx, bz] = parkNet.nodes[b];
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
          park.reportLint(
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
          park.reportLint(
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
        parkNet.edges = parkNet.edges.filter((_, ei) => !drop.has(ei));
        console.warn(
          `[Park] <Paths> REFUSED ${refused.length} span(s) (over water / over the ${CAUSEWAY_HARD.toFixed(
            1,
          )} u viaduct limit) — the street graph is now missing those links, so expect accessibility failures until the layout is re-planned`,
        );
      }
      if (worstLift > CAUSEWAY_LIFT && worstLift <= CAUSEWAY_HARD)
        park.reportLint(
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
    const plazaY = pathY + 0.096; // PathNetwork's one-level plaza surface
    const g = new t.Group();
    const net = buildPathNetwork(t, parkNet, { width, y: pathY, groundAt, grid, plazas, nodeY: nodeYuse });
    g.add(net.group);
    const upds: ((time: number) => void)[] = [net.update];
    if (walkers > 0) upds.push(attachWalkers(t, g, net, { count: walkers })); // BEFORE the manager exists
    // ONE grounding pass: bermNetToGround berms LOW spans only (grounded
    // ramps get an inclined earth embankment UNDER the ribbon) — spans/pads
    // lifted > 0.35 above the terrain (nodeY ramps, deep dips) are skipped
    // because buildPathNetwork (given groundAt) plants RCT2 wooden scaffolds
    // under them instead
    bermNetToGround(t, g, parkNet, pathY, groundAt, nodeYuse);
    const inPlaza = (x: number, z: number) => plazas.some(([cx, cz, w, d]) => Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= d / 2);
    bins.forEach(([bx, bz]) => {
      const by = inPlaza(bx, bz) ? plazaY : pathY;
      g.add(cyl(t, 0.09, 0.08, 0.26, 0x24282c, [bx, by + 0.13, bz], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.6, seg: 12 }));
      g.add(cyl(t, 0.02, 0.095, 0.06, 0x24282c, [bx, by + 0.29, bz], { metal: 0.3, rough: 0.6, seg: 12 }));
    });
    park.paths = { net: parkNet, pathY, plazaY, plazas, bins, width, streetNodes: parkNet.nodes.length };
    // stash the RESOLVED ramp offsets (triples or nodeY) so <Stall>/<Restroom>
    // can deck-match a nearby ELEVATED node (they stand at its level on a
    // scaffold, never floating), plus the walking-surface sampler so the
    // GameManager can drape guests over ramps (walkYAt(x, z) = path surface
    // height anywhere on the network, base level off-network)
    (park.paths as ParkPathsInfo & { nodeY?: number[]; walkYAt?: (x: number, z: number) => number }).nodeY = nodeYuse;
    (park.paths as ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }).walkYAt = net.walkYAt;
    const cleanup = park.addObject(g, (tt) => upds.forEach((u) => u(tt)), { lod: 'full' }); // spans the park
    return () => {
      cleanup();
      park.paths = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

// ---- <Gate> ---------------------------------------------------------------------

export interface GateProps {
  /** gate cell — default: centred on the FRONT TERRAIN EDGE of the flat
   *  apron (lattice cell nearest size/2 − 0.8, e.g. z 7.2 on a size-16 park),
   *  facing out. Round-3 safeguard: the old default sat a full 2 u inside. */
  position?: XZ;
  /** yaw — default 0 = +z (outside) toward the park edge */
  rotation?: number;
}

/** the park entrance arch on the flat apron — registered as the manager's
 *  SOLE guest spawn/despawn point. Mount after <Paths>. */
export function Gate({ position, rotation = 0 }: GateProps) {
  const park = usePark('Gate');
  const key = JSON.stringify({ position, rotation });
  useEffect(() => {
    if (!park.ground || !park.paths) throw new Error('<Gate> needs <Terrain> and <Paths> mounted first');
    const t = park.three;
    // default: snap to the lattice cell hugging the front (+z) terrain edge —
    // within ~1 u of it, arch facing OUT (rotation 0 = +z = outward)
    const zEdge = Math.min(TILE * Math.round((park.size / 2 - 0.8) / TILE), park.size / 2 - 0.7);
    const [x, z] = position ?? [0, zEdge];
    const y = park.paths.pathY + 0.03;
    const gate = buildParkEntrance(t);
    gate.group.position.set(x, y, z);
    gate.group.rotation.y = rotation;
    const g = new t.Group();
    g.add(gate.group);
    plinthUnder(t, g, park.ground.heightAt, x, z, 3.2, 1.2, y);
    park.manager().registerParkEntrance(gate); // guests appear at the gate and walk in
    return park.addObject(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

// ---- <FlatRide> ---------------------------------------------------------------------

export interface FlatRideBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  /** per-seat transforms so boarded guests ride the live vehicle */
  seatWorld?: (seat: number) => [number, number, number, number];
  /** boarding anchor (default: pad centre at padTop + 0.1) */
  boardPoint?: V3;
}

export interface FlatRideProps {
  /** deterministic builder: podium + rotor + updater. `info.padTop` is the
   *  settled platform height; keep the builder stable (it is NOT a remount key). */
  build(t: typeof THREE, info: { position: XZ; padTop: number; groundAt: (x: number, z: number) => number; scheme: RideColourScheme }): FlatRideBuilt;
  position: XZ;
  name?: string;
  capacity?: number;
  rideDuration?: number;
  loadTime?: number;
  intensity?: number;
  price?: number;
  colours?: RideColourScheme;
  queueTailNode: number;
  queueDir: XZ;
  /** exit hut cell — OPTIONAL (round-2): omitted, it is auto-derived the way
   *  the register wrappers derive theirs — the local [-1.5, 1.35] cell in the
   *  queue frame (+z = queueDir), i.e. beside the queue face on the opposite
   *  side of the lane */
  exit?: XZ;
  /** exit doorway facing — OPTIONAL: defaults to the queue frame's −x */
  exitDir?: XZ;
  /** opt OUT of the settle-time corridor auto-resolver (round-5): a pinned
   *  ride is never auto-shifted out of a coaster track corridor */
  pinned?: boolean;
}

/** generic flat ride: your builder makes the visual (podium + vehicle), the
 *  wrapper wires the queue/hut assembly and the GameManager registration. */
export function FlatRide(props: FlatRideProps) {
  const park = usePark('FlatRide');
  const buildRef = useRef(props.build);
  buildRef.current = props.build;
  const key = JSON.stringify({ ...props, build: 0, colours: props.colours ? 1 : 0 });
  useEffect(() => {
    if (!park.ground || !park.paths) throw new Error('<FlatRide> needs <Terrain> and <Paths> mounted first');
    const t = park.three;
    // ---- required-prop validation (round-2 safeguard): a missing/misshapen
    // prop throws a NAMED error instead of `undefined[0]` crashing the page --
    {
      const label = `<FlatRide> '${props.name ?? 'Flat Ride'}'`;
      const nNodes = park.paths.net.nodes.length;
      if (typeof buildRef.current !== 'function') throw new Error(`${label}: build must be a function (t, info) => { group, … }`);
      if (!isXZ(props.position)) throw new Error(`${label}: position must be [x, z]`);
      if (!Number.isInteger(props.queueTailNode) || props.queueTailNode < 0 || props.queueTailNode >= nNodes)
        throw new Error(`${label}: queueTailNode must be a street-node index 0..${nNodes - 1} (got ${String(props.queueTailNode)})`);
      if (!isXZ(props.queueDir) || (props.queueDir[0] === 0 && props.queueDir[1] === 0))
        throw new Error(`${label}: queueDir must be a non-zero [x, z] lane direction (hut → tail)`);
      if (props.exit !== undefined && !isXZ(props.exit))
        throw new Error(`${label}: exit must be [x, z] — the exit hut cell (omit it to auto-derive)`);
      if (props.exitDir !== undefined && !isXZ(props.exitDir))
        throw new Error(`${label}: exitDir must be [x, z] — the exit doorway facing (omit it to auto-derive)`);
    }
    const groundAt = park.ground.heightAt;
    const [x, z] = props.position;
    const padTop = groundAt(x, z) + 0.22;
    const scheme = props.colours ?? rideColourPreset(park.seed + 3, 'steel');
    const built = buildRef.current(t, { position: props.position, padTop, groundAt, scheme });
    // ---- stranded-at-origin defect guard (round-1 fix) ----
    // The builder owns the transform (`info.position`/`padTop`), but a builder
    // that ignores it used to leave the VISUAL at the world origin while the
    // sim pads registered at the right cell. Repair: when neither the built
    // group nor its geometry sits at the cell, move the group there.
    {
      const groupOff = Math.hypot(built.group.position.x - x, built.group.position.z - z);
      if (groupOff > 0.5) {
        const bb = new t.Box3().setFromObject(built.group);
        const bc = bb.isEmpty() ? null : bb.getCenter(new t.Vector3());
        if (!bc || Math.hypot(bc.x - x, bc.z - z) > 0.5) {
          console.warn(
            `[Park] <FlatRide> "${props.name ?? 'Flat Ride'}": the builder ignored info.position — visual moved from [${built.group.position.x.toFixed(1)}, ${built.group.position.z.toFixed(1)}] to its cell [${x}, ${z}] (builders should group.position.set(position[0], padTop…, position[1]))`,
          );
          built.group.position.set(x, padTop - 0.22, z);
        }
      }
    }
    const g = new t.Group();
    g.add(built.group);
    const mgr = park.manager();
    // exit/exitDir auto-derivation (round-2 safeguard): same geometry the
    // register wrappers use — the exit hut takes the local [-1.5, 1.35] cell
    // in the queue frame (+z = normalized queueDir), doorway facing local −x,
    // landing it beside the queue face on the opposite side of the lane.
    const qm = Math.hypot(props.queueDir[0], props.queueDir[1]) || 1;
    const qd: XZ = [props.queueDir[0] / qm, props.queueDir[1] / qm];
    const exit: XZ = props.exit ?? [x - qd[1] * 1.5 + qd[0] * 1.35, z + qd[0] * 1.5 + qd[1] * 1.35];
    const exitDir: XZ = props.exitDir ?? [-qd[1], qd[0]];
    if (!props.exit)
      console.info(
        `[Park] <FlatRide> "${props.name ?? 'Flat Ride'}": no exit given — auto-derived the exit hut at [${exit[0].toFixed(2)}, ${exit[1].toFixed(2)}] beside the queue face (pass exit/exitDir to place it yourself)`,
      );
    const acc = planRideAccess(park.paths.net.nodes, props.queueTailNode, qd, props.capacity ?? 3, exit, exitDir);
    // elevated queue tail: lift the hut/lane assembly onto the deck level
    // (groundRideAccess scaffolds it; +0.19 keeps the hut's ground-level proudness)
    const frTailLift = (park.paths as ParkPathsInfo & { nodeY?: number[] }).nodeY?.[props.queueTailNode] ?? 0;
    const frAccY = frTailLift > 0 ? Math.max(padTop, park.paths.pathY + frTailLift + 0.19) : padTop;
    const handle = mgr.registerRide({
      name: props.name ?? 'Flat Ride',
      capacity: props.capacity ?? 3,
      rideDuration: props.rideDuration ?? 6,
      loadTime: props.loadTime ?? 1.6,
      intensity: props.intensity ?? 5,
      price: props.price ?? 4,
      seatWorld: built.seatWorld,
      queueAnchor: [acc.anchor[0], frAccY, acc.anchor[1]],
      queueDir: acc.dir,
      boardPoint: built.boardPoint ?? [x, padTop + 0.1, z],
      exitPoint: [acc.exit[0], frAccY, acc.exit[1]],
    });
    groundRideAccess(t, g, groundAt, acc, frAccY, [handle.exitPoint()[0], handle.exitPoint()[2]]);
    built.group.userData.rideRef = handle;
    const cleanup0 = park.addObject(g, built.update);
    const rideName = props.name ?? 'Flat Ride';
    // the ride BODY as a blocker (round-6): the manager already blocks the
    // 0.9-u boardPoint pad, but a ride is as wide as its visual — measure the
    // built group's world footprint so guests walk AROUND the machine
    const bodyBlocker = (() => {
      const bb = new t.Box3().setFromObject(built.group);
      if (bb.isEmpty() || Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) > 10) return null;
      return mgr.registerBlocker({
        rect: {
          cx: (bb.min.x + bb.max.x) / 2,
          cz: (bb.min.z + bb.max.z) / 2,
          hx: Math.max(0.12, (bb.max.x - bb.min.x) / 2 - 0.08),
          hz: Math.max(0.12, (bb.max.z - bb.min.z) / 2 - 0.08),
          yaw: 0,
        },
        label: `${rideName} body`,
        kind: 'ride',
        owner: rideName,
        height: bb.max.y - bb.min.y,
      });
    })();
    // corridor auto-resolution registration (round-5): the whole rig (visual
    // + grounding + registration) is MOVABLE unless pinned
    const store = park as ParkStore;
    const mv: MovableRec = {
      label: `${rideName} (flat-ride rig)`,
      kind: 'ride',
      pinned: !!props.pinned,
      rects: () => (mgr.footprints?.() ?? []).filter((f) => f.label.startsWith(`${rideName} `)),
      exitLabel: `${rideName} exit hut`,
      shiftExit: (sdx, sdz) => mgr.moveRideExit?.(rideName, sdx, sdz),
      resizeLane: (len) => mgr.resizeRideLane?.(rideName, len),
      shift: (sdx, sdz) => {
        mgr.moveRide(rideName, sdx, sdz);
        g.position.x += sdx; // visual + grounding meshes live in this wrapper group
        g.position.z += sdz;
        bodyBlocker?.move(sdx, sdz);
      },
    };
    store._movables.push(mv);
    const cleanup = () => {
      const i = store._movables.indexOf(mv);
      if (i >= 0) store._movables.splice(i, 1);
      bodyBlocker?.remove();
      cleanup0();
    };
    // post-mount audit: the mounted visual must sit on its cell (both the
    // group's world position AND its geometry centre off by >0.5 = stranded)
    {
      const wp = new t.Vector3();
      built.group.getWorldPosition(wp);
      if (Math.hypot(wp.x - x, wp.z - z) > 0.5) {
        const bb = new t.Box3().setFromObject(built.group);
        const bc = bb.isEmpty() ? null : bb.getCenter(new t.Vector3());
        if (!bc || Math.hypot(bc.x - x, bc.z - z) > 0.5)
          console.warn(
            `[Park] <FlatRide> "${props.name ?? 'Flat Ride'}" AUDIT: mounted visual sits at [${(bc ?? wp).x.toFixed(1)}, ${(bc ?? wp).z.toFixed(1)}], >0.5 u from its position [${x}, ${z}] — guests will queue at an empty pad`,
          );
      }
    }
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

// ---- <Placed> — the escape hatch -----------------------------------------------------

export interface PlacedProps {
  /** any deterministic builder: `(t, park) => Group | { group, update? }`.
   *  How preview-only rides (FerrisWheel-style) and the four food shops get
   *  into a composed park until their builders are extracted. */
  build(t: typeof THREE, park: ParkContextValue): THREE.Group | { group: THREE.Group; update?: (time: number) => void };
  position?: ParkPosition;
  rotation?: number;
  scale?: number;
}

/**
 * The GROUND-CONTACT footprint radius of a built prop (round-6 safeguard):
 * the XZ half-extent of everything within 0.45 u of its base. A tree's canopy
 * may legally overhang a path — its trunk may not; a statue plinth may not.
 * <Scenery>/<Placed> register this with `park.registerPlanted` so
 * `validatePark` can audit planted pieces for DRYNESS and for standing in a
 * walked path slab. Measured in the built group's own frame, BEFORE the
 * placement transform.
 */
function groundFootprintRadius(t: typeof THREE, obj: THREE.Object3D): number {
  const full = new t.Box3().setFromObject(obj);
  if (full.isEmpty()) return 0.2;
  const baseY = full.min.y;
  const b = new t.Box3();
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    b.setFromObject(m);
    if (b.min.y > baseY + 0.45) return; // canopy / roof / sign board overhead
    minX = Math.min(minX, b.min.x);
    maxX = Math.max(maxX, b.max.x);
    minZ = Math.min(minZ, b.min.z);
    maxZ = Math.max(maxZ, b.max.z);
  });
  if (!Number.isFinite(minX)) return 0.2;
  return Math.max(0.12, Math.max(maxX - minX, maxZ - minZ) / 2);
}

/**
 * REFUSE to plant in the water (round-7 safeguard). `validatePark` has always
 * FAILED a planted piece whose footprint dips under `waterLevel + 0.05` — but
 * it failed it AFTER the tree was standing in the lake in every screenshot.
 * The composed water body moves when the guards re-pick it (§1: the seed
 * table's coords are pre-guard), so this is not an author typo class that
 * static arithmetic catches. `<Placed>`/`<Scenery>` now sample the ground
 * BEFORE mounting: a wet spot is NOT built and the §0-FATAL lint names the
 * dry-cell query that would have prevented it. Returns true when the caller
 * must skip the mount.
 */
function refuseIfWet(park: ParkContextValue, label: string, x: number, z: number, r: number): boolean {
  if (!park.ground || (park as ParkStore)._previewHost) return false;
  const wl = park.ground.waterLevel;
  let minH = park.groundAt(x, z);
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    minH = Math.min(minH, park.groundAt(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  if (minH >= wl + 0.05) return false;
  // SHALLOW (a shoreline dip within 0.4 u of the waterline): let the settle
  // pass's AUTO-keepDry reclamp raise a dry bank under it instead — planted
  // footprints now join that sweep, so the piece STAYS and stands on land.
  // The lint is still recorded (a park that needed the self-heal was
  // mis-planned — §0's FATAL-WARNINGS POLICY), just not fatal.
  if (minH >= wl - 0.4) {
    park.reportLint(
      'plantedWetCell',
      `${label} was planted on a WET cell (ground ${minH.toFixed(2)} vs waterline ${wl.toFixed(
        2,
      )}) — the terrain guard clamp will raise a dry bank under it (AUTO-keepDry). Plant on dry ground instead: query the composed water body AFTER composition (\`park.isDryCell([x, z])\` / \`usePark().terrain.water\`), because the §1 seed table's coords are pre-guard`,
      false,
    );
    return false;
  }
  park.reportLint(
    'plantedInWater',
    `${label} stands in OPEN WATER: ground ${minH.toFixed(2)} under its ${r.toFixed(2)} u footprint is ${(wl - minH).toFixed(
      2,
    )} u below the waterline ${wl.toFixed(2)} — too deep to bank, so the piece was REFUSED (not planted). The composed water body is not where the §1 seed table lists it once your keepDry re-picks it: query the REAL one after composition (\`park.isDryCell([x, z])\` / \`usePark().terrain.water\`) and plant on dry ground, or keepDry that cell`,
    true,
  );
  return true;
}

/** mounts ANY built group on the shared canvas at a settled position */
export function Placed({ build, position = [0, 0], rotation = 0, scale = 1 }: PlacedProps) {
  const park = usePark('Placed');
  const buildRef = useRef(build);
  buildRef.current = build;
  const key = JSON.stringify({ position, rotation, scale });
  useEffect(() => {
    const t = park.three;
    // build*Scene misuse guard (best-effort name check — round-1 fix #5):
    // preview scene builders mounted inside a real park read as broken parks
    if (!(park as ParkStore)._previewHost && /Scene$/.test(buildRef.current.name || ''))
      console.warn(
        `[Park] <Placed build={${buildRef.current.name}}> looks like a preview SCENE builder (build<Name>Scene) — those are staging for previews; inside a <Park> use the component or its build<Name>() builder instead`,
      );
    const res = buildRef.current(t, park);
    const built = (res as THREE.Object3D).isObject3D
      ? { group: res as THREE.Group, update: undefined as ((time: number) => void) | undefined }
      : (res as { group: THREE.Group; update?: (time: number) => void });
    const [x, z] = xzOf(position);
    // round-7: never plant in the water (the piece is refused + lint-failed)
    const placedR = groundFootprintRadius(t, built.group) * scale;
    if (refuseIfWet(park, `<Placed ${buildRef.current.name || 'prop'}> at [${x.toFixed(1)}, ${z.toFixed(1)}]`, x, z, placedR)) {
      disposeDeep(built.group);
      return undefined;
    }
    const y = yOf(position) ?? park.floorAt(x, z);
    const g = new t.Group();
    g.add(built.group);
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    g.scale.setScalar(scale);
    // stranded/double-transform audit (round-1 fix #3): <Placed position>
    // owns the transform — a builder output that already carries one mounts
    // shifted (its offset is ADDED on top of the prop transform)
    if (Math.hypot(built.group.position.x, built.group.position.z) > 0.5)
      console.warn(
        `[Park] <Placed> AUDIT: the built group carries its own position [${built.group.position.x.toFixed(1)}, ${built.group.position.z.toFixed(1)}] — <Placed position> is added ON TOP; build at the local origin or expect a shifted visual`,
      );
    // planted-footprint audit (round-6): validatePark checks dryness + path
    // slabs — an author-planted willow used to be able to stand in the river
    const unplant = park.registerPlanted({
      label: `<Placed ${buildRef.current.name || 'prop'}> at [${x.toFixed(1)}, ${z.toFixed(1)}]`,
      x,
      z,
      r: placedR,
    });
    const cleanupPlaced = park.addObject(g, built.update);
    return () => {
      cleanupPlaced();
      unplant();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

// ---- amenities -------------------------------------------------------------------------

/** per-kind sale defaults for the generic <Stall> wrapper (RCT2 pricing) */
const STALL_KIND_DEFAULTS: Record<'balloon', { name: string; item: StallItemKind; price: number; value: number }> = {
  balloon: { name: 'Balloon Stand', item: 'balloon', price: 2, value: 3 },
};

export interface StallProps {
  /** only kinds with exported builders — 'balloon' today. The four food
   *  shops (Burger/HotDog/Soda/CottonCandy) are catalog composableStall
   *  components — mount those directly with `register`. */
  kind?: 'balloon';
  position: XZ;
  rotation?: number;
  /** explicit height offset above the street level (the elevation API) —
   *  default: auto deck-match against the nearest elevated path node within
   *  1.75 u (its `[x, z, elevation]` / nodeY value). Either way the stall
   *  stands on an RCT2 wooden scaffold + plank deck when lifted > 0.35. */
  elevation?: number;
  /** make it SELL: `true` registers with the kind's defaults (balloon: item
   *  'balloon', price 2, value 3); or override any of them. Omit for an
   *  ambience-only stand. */
  sell?: boolean | { name?: string; item?: StallItemKind; price?: number; value?: number };
}

/** a stall from the builder catalog, plinthed to the street level. Routed
 *  through <ConfigurableStall> (round-3 safeguard) so it REGISTERS with the
 *  GameManager and carries the same userData tagging as every catalog stall —
 *  a generic `<Stall kind>` used to be invisible to the manager and to any
 *  scene introspection that keys off ConfigurableStall. */
export function Stall({ kind = 'balloon', position, rotation = 0, elevation, sell }: StallProps) {
  const def = STALL_KIND_DEFAULTS[kind] ?? STALL_KIND_DEFAULTS.balloon;
  const over = typeof sell === 'object' && sell !== null ? sell : undefined;
  return (
    <ConfigurableStall
      build={(t, park) => {
        const stand = buildBalloonStand(t); // kind === 'balloon'
        const g = new t.Group();
        g.add(stand.group);
        let dispose: (() => void) | undefined;
        if (park.ground) {
          // street-level placement + plinth, exactly like the old imperative
          // mount: the composable host sets the group at floorAt — compensate
          // to the street level and plinth the cell down to the ground.
          // Deck-match (the elevation API): beside an ELEVATED path node
          // ([x, z, elevation] triple / nodeY ramp) the stall stands at THAT
          // deck level — an explicit `elevation` prop overrides the match —
          // and plinthUnder then plants an RCT2 wooden scaffold + deck
          // (lift > 0.35), never a floating base
          const [x, z] = position;
          const pinfo = park.paths as (ParkPathsInfo & { nodeY?: number[] }) | null;
          let deckLift = elevation ?? 0;
          if (elevation === undefined && pinfo?.nodeY) {
            for (let ni = 0; ni < pinfo.streetNodes; ni++) {
              const [nx, nz] = pinfo.net.nodes[ni];
              if (Math.hypot(nx - x, nz - z) < 1.75) deckLift = Math.max(deckLift, pinfo.nodeY[ni] ?? 0);
            }
          }
          const y = pinfo ? Math.max(pinfo.pathY + deckLift, park.groundAt(x, z) + 0.02) : park.groundAt(x, z) + 0.02;
          g.position.y = y - park.floorAt(x, z);
          const pg = new t.Group();
          plinthUnder(t, pg, park.ground.heightAt, x, z, 1.4, 1.2, y);
          dispose = park.addObject(pg);
        }
        return { group: g, dispose };
      }}
      stall={{
        name: over?.name ?? def.name,
        item: over?.item ?? def.item,
        price: over?.price ?? def.price,
        value: over?.value ?? def.value,
      }}
      register={!!sell}
      position={position}
      rotation={rotation}
      deps={[kind, !!sell, elevation, over?.name, over?.item, over?.price, over?.value]}
    />
  );
}

export interface RestroomProps {
  position: XZ;
  /** yaw — doorway faces local +z rotated by this */
  rotation?: number;
  /** explicit height offset above the street level (the elevation API) —
   *  default: auto deck-match against the nearest elevated path node within
   *  1.75 u; lifted > 0.35 it stands on an RCT2 wooden scaffold + deck */
  elevation?: number;
}

/** a working restroom: mesh + plinth + `registerRestroom` */
export function Restroom({ position, rotation = 0, elevation }: RestroomProps) {
  const park = usePark('Restroom');
  const key = JSON.stringify({ position, rotation, elevation });
  useEffect(() => {
    if (!park.ground || !park.paths) throw new Error('<Restroom> needs <Terrain> and <Paths> mounted first');
    const t = park.three;
    const [x, z] = position;
    // deck-match a nearby ELEVATED path node ([x, z, elevation] triple /
    // nodeY ramp): the restroom stands at that deck level — an explicit
    // `elevation` prop overrides the match — and plinthUnder plants an RCT2
    // wooden scaffold + deck under it (lift > 0.35) instead of an earth plinth
    const pinfo = park.paths as ParkPathsInfo & { nodeY?: number[] };
    let deckLift = elevation ?? 0;
    if (elevation === undefined && pinfo.nodeY) {
      for (let ni = 0; ni < pinfo.streetNodes; ni++) {
        const [nx, nz] = pinfo.net.nodes[ni];
        if (Math.hypot(nx - x, nz - z) < 1.75) deckLift = Math.max(deckLift, pinfo.nodeY[ni] ?? 0);
      }
    }
    const y = Math.max(pinfo.pathY + deckLift, park.groundAt(x, z) + 0.02);
    const r = buildRestroom(t);
    r.group.position.set(x, y, z);
    r.group.rotation.y = rotation;
    const g = new t.Group();
    g.add(r.group);
    plinthUnder(t, g, park.ground.heightAt, x, z, 1.5, 1.3, y);
    // the hut is SOLID: guests may only enter through its doorway (local +z,
    // 0.72 out — the blocker's front face stops at 0.49, so the apron and the
    // walk-in point stay free). `owner` is shared with the registration so a
    // guest using THIS restroom can never be blocked by it.
    const owner = `restroom@${x.toFixed(2)},${z.toFixed(2)}`;
    park.manager().registerRestroom({ anchor: [x, y, z], yaw: rotation, owner });
    const unblock = park.registerBlocker({
      rect: { cx: x - Math.sin(rotation) * 0.06, cz: z - Math.cos(rotation) * 0.06, hx: 0.72, hz: 0.55, yaw: rotation },
      label: `<Restroom> at [${x.toFixed(1)}, ${z.toFixed(1)}]`,
      kind: 'building',
      owner,
      height: 1.4,
    });
    const cleanup = park.addObject(g);
    return () => {
      unblock();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

export interface FountainProps {
  /** default: the first plaza's centre tile */
  position?: XZ;
  scale?: number;
}

/** the plaza fountain (animated water) */
export function Fountain({ position, scale = 0.45 }: FountainProps) {
  const park = usePark('Fountain');
  const key = JSON.stringify({ position, scale });
  useEffect(() => {
    const t = park.three;
    const p0 = park.paths?.plazas[0];
    const [x, z] = position ?? (p0 ? [p0[0], p0[1]] : [0, 0]);
    const f = buildFountain(t);
    f.group.scale.setScalar(scale);
    f.group.position.set(x, park.floorAt(x, z), z);
    // the basin is SOLID — guests used to stroll straight through the water.
    // buildFountain's basin radius is 1.6 with a 0.18 coping lip, scaled here.
    const unblock = park.registerBlocker({
      circle: { cx: x, cz: z, r: 1.78 * scale },
      label: `<Fountain> at [${x.toFixed(1)}, ${z.toFixed(1)}]`,
      kind: 'water',
      height: 1.4 * scale,
    });
    const cleanup = park.addObject(f.group, f.update);
    return () => {
      unblock();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

export interface TorchProps {
  position: XZ;
  height?: number;
}

/** a flickering tiki torch (flame is night-gated by the Torch component) */
export function Torch({ position, height = 1.5 }: TorchProps) {
  const park = usePark('Torch');
  const key = JSON.stringify({ position, height });
  useEffect(() => {
    const t = park.three;
    const [x, z] = position;
    const torch = buildTorch(t, { height });
    torch.group.position.set(x, park.floorAt(x, z), z);
    return park.addObject(torch.group, torch.update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

export interface NeonProps {
  text?: string;
  /** SVG path string alternative to `text` */
  path?: string;
  color?: number;
  secondary?: number;
  /** default: auto — capped so the sign never exceeds ~2.5 u of width (a
   *  long marquee otherwise dwarfs the street); explicit values are honoured */
  scale?: number;
  /** dark backboard behind the tubes — inside a <Park> the DEFAULT is OFF
   *  (round-2: a marquee backboard reads as a monolithic black wall in
   *  ground-level shots); pass `backboard` to opt back in (buildNeonSign then
   *  hugs the text and area-caps it) */
  backboard?: boolean;
  /** `[x, z]` (sign centre 1.7 above the floor) or `[x, y, z]` */
  position: ParkPosition;
  rotation?: number;
  /** iron posts down to the ground under the sign ends (default true) */
  posts?: boolean;
}

/** a night-gated neon marquee on iron posts */
export function Neon({ text, path, color, secondary, scale, backboard, position, rotation = 0, posts = true }: NeonProps) {
  const park = usePark('Neon');
  const key = JSON.stringify({ text, path, color, secondary, scale, backboard, position, rotation, posts });
  useEffect(() => {
    const t = park.three;
    const [x, z] = xzOf(position);
    const y = yOf(position) ?? park.floorAt(x, z) + 1.7;
    // round-2 safeguard: park signs default to OPEN-RAIL mounting (no
    // backboard) — pass `backboard` explicitly to opt back in
    const sign = buildNeonSign(t, { text, path, color, secondary, scale, backboard: backboard ?? false });
    const g = new t.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    g.add(sign.group);
    if (posts) {
      const IRON = 0x33383d;
      [-1, 1].forEach((s) => {
        const ox = s * (sign.width / 2 + 0.18);
        const wx = x + Math.cos(rotation) * ox;
        const wz = z - Math.sin(rotation) * ox;
        const top = y + 1.7 * sign.scale; // resolved scale (auto-capped default)
        const h = Math.max(0.4, top - park.groundAt(wx, wz));
        g.add(cyl(t, 0.035, 0.05, h, IRON, [ox, top - y - h / 2, -0.06], { tex: 'metal', repeat: [1, 4], metal: 0.5, rough: 0.55, seg: 10 }));
      });
    }
    return park.addObject(g, sign.update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

export interface DanceFloorRProps {
  position: XZ;
  size?: number;
  tile?: number;
  rotation?: number;
}

/** the beat-synced disco terrace (night-gated) — at most one per park */
export function DanceFloorR({ position, size = 4, tile = 0.6, rotation = 0 }: DanceFloorRProps) {
  const park = usePark('DanceFloorR');
  const key = JSON.stringify({ position, size, tile, rotation });
  useEffect(() => {
    const t = park.three;
    const [x, z] = position;
    const df = buildDanceFloor(t, { size, tile });
    df.group.position.set(x, park.groundAt(x, z), z);
    df.group.rotation.y = rotation;
    return park.addObject(df.group, df.update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

export interface SceneryProps {
  /** a SceneryPack piece name (SCENERY_NAMES) */
  name: string;
  position: ParkPosition;
  scale?: number;
  seed?: number;
  rotation?: number;
}

/** one SceneryPack piece, settled on the plaza/terrain under it */
export function Scenery({ name, position, scale, seed = 0, rotation = 0 }: SceneryProps) {
  const park = usePark('Scenery');
  const key = JSON.stringify({ name, position, scale, seed, rotation });
  useEffect(() => {
    const t = park.three;
    const built = buildSceneryAnimated(t, name, { scale, seed });
    const [x, z] = xzOf(position);
    const r = groundFootprintRadius(t, built.group);
    // round-7: never plant in the water (the piece is refused + lint-failed)
    if (refuseIfWet(park, `<Scenery ${name}> at [${x.toFixed(1)}, ${z.toFixed(1)}]`, x, z, r)) {
      disposeDeep(built.group);
      return undefined;
    }
    const y = yOf(position) ?? park.floorAt(x, z);
    built.group.position.set(x, y, z);
    built.group.rotation.y = rotation;
    // planted-footprint audit (round-6): a marbleStatue planted in the middle
    // of a 1.1-u main street, or a picnic table inside the waterline, used to
    // sail through the gate — validatePark now audits both
    const unplant = park.registerPlanted({ label: `<Scenery ${name}> at [${x.toFixed(1)}, ${z.toFixed(1)}]`, x, z, r });
    const cleanupScenery = park.addObject(built.group, built.update);
    return () => {
      cleanupScenery();
      unplant();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

export interface LightsProps {
  /** pole spots `[x, z]` — poles stand on the ground, the span hangs hook-to-hook */
  from: XZ;
  to: XZ;
  poleHeight?: number;
  bulbs?: number;
  colors?: number[];
  sag?: number;
}

/** two light poles + a night-gated string-light span between their hooks */
export function Lights({ from, to, poleHeight = 2.6, bulbs, colors, sag }: LightsProps) {
  const park = usePark('Lights');
  const key = JSON.stringify({ from, to, poleHeight, bulbs, colors, sag });
  useEffect(() => {
    const t = park.three;
    const g = new t.Group();
    const mk = ([x, z]: XZ) => buildLightPole(t, [x, park.floorAt(x, z), z], { height: poleHeight });
    const a = mk(from);
    const b = mk(to);
    const span = buildStringLights(t, a.hook, b.hook, { bulbs, colors, sag });
    g.add(a.group, b.group, span.group);
    return park.addObject(g, span.update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}
