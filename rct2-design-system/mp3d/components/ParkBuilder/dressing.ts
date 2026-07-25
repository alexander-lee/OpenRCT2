// ---------------------------------------------------------------------------
// ParkBuilder/dressing.ts — the terrain PAINT + PLANTING layer:
// tintTerrainForClimate (climate vertex-palette bias + the composition's
// terrain-SECTION zone paint: sand / meadow / rock / forest) and dressTerrain
// (deterministic auto-dressing of those sections — forest tree clusters,
// mountain rock outcrops + scree, beach dunes/palms, meadow loners).
//
// Everything here is re-exported by ../ParkBuilder — import from
// '../ParkBuilder', never from this file directly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { cyl } from '../Stage';
import type { BasinZone } from '../TerrainKit';
import { tree } from '../Kit';
import { buildRock } from '../Rock';
import { buildRockCluster } from '../RockCluster';
import { buildScenery } from '../SceneryPack';
import { hash01, clamp, segDist, WL, CLIMATE_SPECS } from './climate';
import type { ParkClimate, TreeSpecies } from './climate';
import type { ParkComposition } from './composition';
import { terrainLint } from './placement';

/** per-climate zone-paint palette (realistic, no plastic tones): cream/gold
 *  sand, saturated meadow green, darker forest floor, grey-brown rock bands
 *  above the treeline with an olive scree apron just below it */
const ZONE_PAINT: Record<
  ParkClimate,
  { sand: number; forest: number; meadow: number | null; rockA: number; rockB: number; scree: number }
> = {
  temperate: { sand: 0xdac48c, forest: 0x475f30, meadow: 0x5a8340, rockA: 0x7d766a, rockB: 0x6c6459, scree: 0x8b8266 },
  desert: { sand: 0xd8b97e, forest: 0xa8925f, meadow: null, rockA: 0x8a715a, rockB: 0x77604b, scree: 0x9b7f60 },
  alpine: { sand: 0x9a9284, forest: 0x3c522e, meadow: 0x4d6c3a, rockA: 0x7a7570, rockB: 0x686359, scree: 0x84806f },
  coastal: { sand: 0xe0cb92, forest: 0x486b34, meadow: 0x4f7f3c, rockA: 0x7b766b, rockB: 0x6b655a, scree: 0x8a8266 },
};

/** the INFINITE-PLANE SURROUND SKIRT's palette for a climate: the lawn colour
 *  its low bands continue from the plot, and the rock/snow tone its distant
 *  ridge crests take (feed both to TerrainKit's `buildSurround`, as
 *  `<Terrain>` does). Palette-matched so the plot edge is invisible. */
export function surroundPalette(climate: ParkClimate): { ground: number; crest: number } {
  const P = ZONE_PAINT[climate];
  return {
    ground: CLIMATE_SPECS[climate].tint?.grass?.color ?? P.meadow ?? 0x5f7a3e,
    crest: climate === 'alpine' ? 0xd6dde1 : P.rockA,
  };
}

/** climate palette bias painted over TerrainKit's stock vertex colours:
 *  desert tans the lawns, alpine darkens them and snow-caps the summits,
 *  temperate/coastal re-green the lawns. TerrainKit's stock shoreline
 *  gradient paints SAND up to ~WL+0.9 — on gentle lawns that is most of the
 *  park — so `fade` tints recolour the sand-blended band toward the climate
 *  grass everywhere EXCEPT a real beach ring around the composed water
 *  bodies (horizontal distance mask from `basins`) and the grey rock strata
 *  up high. Pass the composition as `comp` (as `<Terrain>` does) to ALSO
 *  paint its terrain SECTIONS — cream/gold sand around the water, saturated
 *  meadow green, a darker forest floor under the forest discs and grey-brown
 *  rock above the treeline on mountain flanks — as soft-weighted blends, so
 *  the lands read like painted RCT2 scenario ground, never hard masks.
 *  Deterministic, above-waterline verts only (the bright aqua shallows and
 *  foam waterline are never repainted). */
export function tintTerrainForClimate(
  t: typeof THREE,
  terrainMesh: THREE.Group,
  climate: ParkClimate,
  basins: BasinZone[],
  comp?: ParkComposition,
) {
  const C = CLIMATE_SPECS[climate];
  if (!C.tint && !comp) return;
  const ground = terrainMesh.children[0] as THREE.Mesh;
  const geo = ground.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  if (!pos || !col) return;
  const toRGB = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  const grass = C.tint?.grass ? toRGB(C.tint.grass.color) : null;
  const smooth = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    return c * c * (3 - 2 * c);
  };
  const beachW = C.beachRays.length > 0 ? 1.4 : 0.6; // beach ring width past the waterline
  // zone paint precomputation (comp given): section discs + palette
  const P = ZONE_PAINT[climate];
  const pSand = toRGB(P.sand);
  const pForest = toRGB(P.forest);
  const pMeadow = P.meadow === null ? null : toRGB(P.meadow);
  const pRockA = toRGB(P.rockA);
  const pRockB = toRGB(P.rockB);
  const pScree = toRGB(P.scree);
  const sandZ = comp?.landZones.find((zn) => zn.kind === 'sand') ?? null;
  const forestZs = comp?.landZones.filter((zn) => zn.kind === 'forest') ?? [];
  for (let i = 0; i < pos.count; i += 1) {
    const h = pos.getY(i);
    if (h <= WL + 0.15) continue; // never repaint water floor / foam / wet sand
    let r = col.getX(i);
    let gc = col.getY(i);
    let b = col.getZ(i);
    if (grass && C.tint?.grass) {
      let k = C.tint.grass.k;
      if (C.tint.grass.fade) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        let dW = Infinity; // distance past the ~waterline of the nearest basin
        for (const bz of basins) dW = Math.min(dW, Math.hypot(x - bz.x, z - bz.z) - bz.radius * 0.74);
        const sandFrac = 1 - smooth((h - (WL + 0.18)) / 0.72); // stock sand share
        const beach = smooth(dW / beachW); // 0 at the waterline -> 1 inland
        const high = 1 - smooth((h - 1.6) / 0.5); // rock strata keep their grey
        k = beach * high * (k + (1 - k) * sandFrac * 0.85);
      }
      r += (grass[0] - r) * k;
      gc += (grass[1] - gc) * k;
      b += (grass[2] - b) * k;
    }
    if (comp) {
      // ---- zone paint: soft weights so the sections blend like painted
      // scenario ground (mountain rock wins on top, sand hugs the water) -----
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let bump = 0;
      for (const p of comp.peaks) {
        const kk = Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / p.radius);
        if (kk > 0) bump += p.height * kk * kk * (3 - 2 * kk);
      }
      const wM = smooth((bump - 0.28) / 0.45);
      let dW = Infinity;
      for (const bz of comp.basins) dW = Math.min(dW, Math.hypot(x - bz.x, z - bz.z) - bz.radius * 0.74);
      const inSand = sandZ ? smooth(1 - Math.hypot(x - sandZ.center[0], z - sandZ.center[1]) / (sandZ.radius * 1.25)) : 0;
      const band = comp.sandBand * (1 + 0.8 * inSand);
      const hMask = 1 - smooth((h - (WL + 1.35)) / 0.7); // sand never climbs hills
      const kSand = (1 - smooth(dW / band)) * (1 - wM) * hMask * 0.85;
      let wF = 0;
      for (const f of forestZs) {
        const dd = Math.hypot(x - f.center[0], z - f.center[1]);
        wF = Math.max(wF, smooth((f.radius - dd) / (f.radius * 0.35)));
      }
      const kForest = wF * (1 - wM) * (1 - kSand) * 0.5;
      const kRock = wM * smooth((h - comp.treeline) / 0.5) * 0.9;
      const kScree = wM * smooth((h - (comp.treeline - 0.8)) / 0.8) * 0.4 * (1 - kRock);
      const kMeadow = pMeadow ? (1 - Math.max(wM, wF, kSand)) * 0.25 : 0;
      const apply = (c: [number, number, number], k: number) => {
        if (k <= 0) return;
        r += (c[0] - r) * k;
        gc += (c[1] - gc) * k;
        b += (c[2] - b) * k;
      };
      if (pMeadow) apply(pMeadow, kMeadow);
      apply(pForest, kForest);
      apply(pSand, kSand);
      apply(pScree, kScree);
      apply(Math.floor(h / 0.75) % 2 === 0 ? pRockA : pRockB, kRock); // banded strata
    }
    // snow rides ABOVE the rock band: with a composition the snowline tracks
    // the treeline so tall alpine ridges still show bare rock below the caps
    const snowLine = C.tint?.snowAbove === undefined ? undefined : comp ? Math.max(C.tint.snowAbove, comp.treeline + 0.55) : C.tint.snowAbove;
    if (snowLine !== undefined && h > snowLine) {
      const k = Math.min(1, (h - snowLine) / 0.7) * 0.85;
      r += (0.93 - r) * k;
      gc += (0.95 - gc) * k;
      b += (0.97 - b) * k;
    }
    col.setXYZ(i, Math.min(1, r), Math.min(1, gc), Math.min(1, b));
  }
  col.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// dressTerrain — deterministic AUTO-DRESSING of a composition's sections:
// tree clusters over the forest discs, rock outcrops + scree on the mountain
// flanks, dune mounds/palms/a flavour prop on the sand flank, lone trees on
// the meadow. `<Terrain>` runs it automatically for every composed park.
// ---------------------------------------------------------------------------

export interface DressCounts {
  trees: number;
  rocks: number;
  props: number;
  meshes: number;
}
export interface DressResult {
  group: THREE.Group;
  counts: DressCounts;
  /** obstacle discs the dressing occupied — feed them to YOUR scenery
   *  rejection sampler so later planting never overlaps the dressing */
  obstacles: { x: number; z: number; r: number }[];
  /** the dressing split into LOCAL chunks (one per forest disc, one per
   *  mountain cluster, one for the meadow, one for the sand flank). Mount
   *  THESE, not `group`, when the park is big: the ride runtime's LOD tiers
   *  are per-ENTRY, so one park-spanning group is always classified NEAR and
   *  never sheds its `lodDetail` filler. `group` still holds everything (it is
   *  the chunks' parent) for callers that only want one handle. */
  chunks: THREE.Group[];
}

/**
 * Plant the composition's terrain sections (budget-aware, deterministic —
 * hashed sines keyed off `comp.terrainSeed`): Kit trees clustered over the
 * FOREST discs (climate species mix; every 2nd tree is `lodDetail`-tagged
 * filler the runtime culls at distance), RockCluster outcrops + loose scree
 * on the MOUNTAIN flanks (nothing above the treeline but rock), dune mounds
 * + palms + one flavour prop on the SAND flank, and sparse lone trees across
 * the MEADOW. Everything settles to `heightAt`, keeps out of the water, off
 * steep rock, off the gate forecourt, clear of every `comp.guardCells` cell
 * (your keepDry layout), the planned coaster envelope and `opts.obstacles`.
 * Counts scale with park area and stay well under the ~2500-mesh budget at
 * size 48. Mount the group via `park.addObject(dress.group)` (default LOD).
 */
export function dressTerrain(
  t: typeof THREE,
  comp: ParkComposition,
  heightAt: (x: number, z: number) => number,
  opts: { obstacles?: { x: number; z: number; r: number }[]; density?: number } = {},
): DressResult {
  const S = comp.size;
  const half = S / 2;
  const u = S / 16;
  const C = CLIMATE_SPECS[comp.climate];
  const density = opts.density ?? 1;
  const lint = terrainLint(heightAt, S);
  let hi = 0;
  const h01 = () => hash01(comp.terrainSeed * 1.37 + comp.climate.length * 5.21 + (hi += 1) * 3.77);
  const g = new t.Group();
  const chunks: THREE.Group[] = [];
  /** start a fresh LOD chunk (added to `g` so `group` still holds everything) */
  const chunk = (): THREE.Group => {
    const c = new t.Group();
    g.add(c);
    chunks.push(c);
    return c;
  };
  let bin = chunk(); // the chunk `settle`/`g.add` currently plants into
  /** BIG-PLOT DENSITY: per-zone planting targets were absolute caps tuned for a
   *  16-48 u plot, so a 192 park (16× the area) got the SAME ~14 meadow trees
   *  and ~30 trees per wood — a desert. Targets now scale sub-linearly with
   *  area (√-ish) on top of the per-zone COUNT already scaling with area in the
   *  composition, which together keep total tree count roughly proportional to
   *  the ground while staying inside the draw-call budget. Exactly 1 at ≤48. */
  const areaK = (S * S) / (48 * 48);
  const bigK = clamp(Math.pow(Math.max(1, areaK), 0.6), 1, 5);
  const prior = opts.obstacles ?? [];
  const added: { x: number; z: number; r: number }[] = [];
  const counts: DressCounts = { trees: 0, rocks: 0, props: 0, meshes: 0 };
  const guardClear = (x: number, z: number, m = 1.35) => comp.guardCells.every(([gx, gz]) => Math.hypot(gx - x, gz - z) > m);
  const coasterClear = (x: number, z: number) => {
    const pl = comp.coasterXZ;
    for (let i = 0; i + 1 < pl.length; i += 1) {
      if (segDist(pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1], x, z) < 1.7) return false;
    }
    return true;
  };
  const clearAt = (x: number, z: number, r: number, slopeMax = 0.85) =>
    lint.inBounds(x, z, 1.15) &&
    lint.isDry(x, z, 0.1) &&
    lint.slopeAt(x, z) < slopeMax &&
    !(z > half - 4.8 && Math.abs(x) < 3.6) && // the gate forecourt stays open
    coasterClear(x, z) &&
    guardClear(x, z) &&
    prior.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r) &&
    added.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
  const settle = (obj: THREE.Object3D, x: number, z: number, sink: number, r: number) => {
    obj.position.set(x, heightAt(x, z) - sink, z);
    obj.rotation.y = h01() * Math.PI * 2;
    bin.add(obj);
    added.push({ x, z, r });
  };
  const plantOf = (species: TreeSpecies, scale: number): THREE.Object3D =>
    species === 'cactus'
      ? buildScenery(t, 'cactusCluster', { scale: 0.45 + scale * 0.35, seed: Math.floor(h01() * 997) })
      : tree(t, { shape: species, scale });

  // ---- FOREST discs: real tree coverage (clustered, density scales w/ area) --
  const forests = comp.landZones.filter((zn) => zn.kind === 'forest');
  const forestMix = C.mix.alpine; // the climate's hill/forest species mix
  forests.forEach((f) => {
    bin = chunk(); // one LOD chunk per wood — distant woods shed their filler
    const target = Math.round(clamp(f.radius * f.radius * 0.5, 6, 30 * bigK) * density);
    let n = 0;
    for (let i = 0; i < target * 7 && n < target; i += 1) {
      const a = h01() * Math.PI * 2;
      const rr = Math.sqrt(h01()) * f.radius * 0.95;
      const x = f.center[0] + Math.cos(a) * rr;
      const z = f.center[1] + Math.sin(a) * rr;
      if (!clearAt(x, z, 0.5) || heightAt(x, z) > comp.treeline) continue;
      const sp = forestMix[Math.floor(h01() * forestMix.length) % forestMix.length];
      const obj = plantOf(sp, 0.55 + h01() * 0.4);
      if (n % 2 === 1) obj.userData.lodDetail = true; // dense filler — far LOD culls it
      settle(obj, x, z, sp === 'cactus' ? 0.02 : 0.07, 0.62);
      counts.trees += 1;
      n += 1;
    }
  });

  // ---- MEADOW: sparse lone trees so the open lawns never read empty ----------
  {
    bin = chunk();
    const lonerMix = C.mix.fairground;
    const lonerTarget = Math.round(clamp(3 + S * 0.22, 4, 14 * bigK) * density);
    for (let i = 0, n = 0; i < lonerTarget * 10 && n < lonerTarget; i += 1) {
      const x = (h01() - 0.5) * (S - 3);
      const z = (h01() - 0.5) * (S - 3);
      if (comp.zoneAt(x, z) !== 'meadow' || !clearAt(x, z, 0.7, 0.7)) continue;
      const sp = lonerMix[Math.floor(h01() * lonerMix.length) % lonerMix.length];
      settle(plantOf(sp, 0.5 + h01() * 0.38), x, z, 0.07, 0.7);
      counts.trees += 1;
      n += 1;
    }
  }

  // ---- MOUNTAIN flanks: an outcrop each + scree stones + treeline pines ------
  comp.hillClusters.forEach((c, ci) => {
    bin = chunk(); // one LOD chunk per mountain cluster
    const dm = Math.hypot(c.x, c.z) || 1;
    const fx = c.x - (c.x / dm) * c.radius * 0.62; // park-facing flank
    const fz = c.z - (c.z / dm) * c.radius * 0.62;
    if (clearAt(fx, fz, 1.5, 1.3)) {
      const rc = buildRockCluster(t, {
        count: 6 + Math.floor(h01() * 4),
        seed: comp.terrainSeed * 3 + ci * 17 + 5,
        width: Math.min(2.4 * u, 6.4),
        length: Math.min(1.8 * u, 4.8),
        size: 0.34 + 0.09 * Math.min(u, 3),
        heightAt: (lx, lz) => heightAt(lx + fx, lz + fz),
      });
      for (let i2 = rc.children.length - 1; i2 >= 0; i2 -= 1) {
        const ch = rc.children[i2];
        const wx = fx + ch.position.x;
        const wz = fz + ch.position.z;
        if (!guardClear(wx, wz, 1.3) || !coasterClear(wx, wz) || !prior.every((o) => Math.hypot(o.x - wx, o.z - wz) > o.r + 0.4)) rc.remove(ch);
      }
      counts.rocks += rc.children.length;
      rc.position.set(fx, 0, fz);
      bin.add(rc);
      added.push({ x: fx, z: fz, r: Math.min(1.6 * u, 4) });
    }
    const nS = 3 + Math.floor(h01() * 3); // loose scree up the flank
    for (let i2 = 0, n2 = 0; i2 < nS * 6 && n2 < nS; i2 += 1) {
      const a = h01() * Math.PI * 2;
      const rr = (0.3 + h01() * 0.55) * c.radius;
      const x = c.x + Math.cos(a) * rr;
      const z = c.z + Math.sin(a) * rr;
      if (!lint.inBounds(x, z, 1.15) || !lint.isDry(x, z, 0.1) || !coasterClear(x, z) || !guardClear(x, z)) continue;
      const rk = buildRock(t, { scale: 0.16 + h01() * 0.2 * Math.min(u, 2.6), seed: ci * 29 + i2 * 3 + 1 });
      rk.userData.lodDetail = true;
      rk.position.set(x, heightAt(x, z) - 0.05, z);
      bin.add(rk);
      counts.rocks += 1;
      n2 += 1;
    }
    const nT = 2 + Math.floor(h01() * 3); // conifers at the mountain foot
    for (let i2 = 0, n2 = 0; i2 < nT * 8 && n2 < nT; i2 += 1) {
      const a = h01() * Math.PI * 2;
      const rr = (0.75 + h01() * 0.45) * c.radius;
      const x = c.x + Math.cos(a) * rr;
      const z = c.z + Math.sin(a) * rr;
      if (heightAt(x, z) > comp.treeline - 0.15 || !clearAt(x, z, 0.55, 0.95)) continue;
      const sp = forestMix[Math.floor(h01() * forestMix.length) % forestMix.length];
      settle(plantOf(sp, 0.5 + h01() * 0.35), x, z, 0.07, 0.55);
      counts.trees += 1;
      n2 += 1;
    }
  });

  // ---- SAND flank: dune mounds + palms + one shoreline flavour prop ----------
  bin = chunk();
  comp.sandSpots.forEach((sp) => {
    if (!lint.inBounds(sp.x, sp.z, 1.0) || !lint.isDry(sp.x, sp.z, 0.04)) return;
    if (!guardClear(sp.x, sp.z, 1.3) || !coasterClear(sp.x, sp.z)) return;
    if (!prior.every((o) => Math.hypot(o.x - sp.x, o.z - sp.z) > o.r + sp.r)) return;
    bin.add(cyl(t, sp.r, sp.r * 1.15, 0.5, 0xd3bd8d, [sp.x, heightAt(sp.x, sp.z) - 0.21, sp.z], { tex: 'sand', repeat: [3, 3], rough: 1, seg: 18 }));
    counts.props += 1;
  });
  comp.palmSpots.forEach(([px2, pz2]) => {
    if (!clearAt(px2, pz2, 0.55)) return;
    settle(tree(t, { shape: comp.climate === 'alpine' ? 'pine' : 'palm', scale: 0.55 + h01() * 0.3 }), px2, pz2, 0.06, 0.55);
    counts.trees += 1;
  });
  {
    const sandZ = comp.landZones.find((zn) => zn.kind === 'sand');
    for (let i = 0; sandZ && i < 10; i += 1) {
      const a = h01() * Math.PI * 2;
      const x = sandZ.center[0] + Math.cos(a) * sandZ.radius * 0.5;
      const z = sandZ.center[1] + Math.sin(a) * sandZ.radius * 0.5;
      if (!clearAt(x, z, 0.8)) continue;
      const obj =
        comp.climate === 'desert'
          ? buildScenery(t, 'cactusCluster', { scale: 0.7, seed: Math.floor(h01() * 997) })
          : comp.climate === 'alpine'
            ? buildRock(t, { scale: 0.34, seed: Math.floor(h01() * 97) })
            : buildScenery(t, 'fallenLog', { scale: 0.8, seed: Math.floor(h01() * 997) });
      obj.userData.lodDetail = true;
      settle(obj, x, z, 0.04, 0.8);
      counts.props += 1;
      break;
    }
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) counts.meshes += 1;
  });
  return { group: g, counts, obstacles: added, chunks: chunks.filter((c) => c.children.length > 0) };
}
