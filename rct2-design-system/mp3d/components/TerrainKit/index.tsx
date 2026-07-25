import React from 'react';
import * as THREE from 'three';
import { box, mat } from '../Stage';
import { buildWater } from '../WaterTile';
import { buildRock } from '../Rock';
import { composable } from '../Park';

// Sculpted terrain heightfield ported from the reference park kit: a displaced
// PlaneGeometry driven by deterministic FBM value-noise (hashed sines — no
// Math.random), plus authored peaks (hills) and basins (lake bowls carved
// below the water level). `heightAt` is the single source of ground truth so
// rocks, trees and rides can conform to the same surface the mesh renders.
// Colouring follows the reference shoreline gradient — mud under water, a
// foam-lapped waterline, dry sand easing into grass over the first rise, and
// grey rock strata on steep slopes — realised as smoothed vertex colours over
// our procedural grass bump texture.

// ---- deterministic noise (ported from the reference heightfield) -----------

function vnoise(x: number, z: number, seed: number): number {
  const a = Math.sin(x * 0.42 + seed * 1.73) * Math.cos(z * 0.37 - seed * 0.91);
  const b = Math.sin((x + z) * 0.83 + seed * 2.11) * 0.45;
  const c = Math.cos(x * 1.47 - z * 1.13 + seed) * 0.18;
  return (a + b + c) / 1.63;
}

function fbm(x: number, z: number, seed: number, octaves: number, roughness: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(x * freq + o * 13.7, z * freq - o * 7.3, seed + o * 17) * amp;
    norm += amp;
    amp *= roughness;
    freq *= 2.13;
  }
  return norm > 0 ? sum / norm : 0;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoother = (v: number) => {
  const c = clamp01(v);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

type RGB = [number, number, number];
const col = (hex: number): RGB => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

// realistic temperate palette (no orange/pink)
const GRASS = col(0x5f7a3e);
const DRY = col(0x87975a);
const LUSH = col(0x4e7f3a);
const SAND = col(0xcfb98a);
const MUD = col(0x6d5c43);
// submerged ground (2026-07 water rework): the old slate MUD basin read as
// grey dead patches through the transparent water — the lake floor now runs
// aqua-teal at depth into bright sand at the waterline (tropical shallows)
const BASIN = col(0x4fb0c2);
const FOAM: RGB = [0.93, 0.96, 0.93];
const ROCK1 = col(0x7b786f);
const ROCK2 = col(0x6b675c);
const MUD_HEX = 0x6d5c43;

export interface PeakZone {
  x: number;
  z: number;
  height: number;
  radius: number;
}

export interface BasinZone {
  x: number;
  z: number;
  radius: number;
  depth: number;
}

export interface TerrainOpts {
  /** square tile size, world units (default 12) */
  size?: number;
  /** mesh segments per side (default 96) */
  seg?: number;
  seed?: number;
  /** rolling-hill amplitude (default 1.1) */
  amplitude?: number;
  /** noise wavelength — bigger = broader hills (default 4.5) */
  scale?: number;
  /** FBM octaves 1-6 (default 4) */
  octaves?: number;
  /** per-octave falloff (default 0.5) */
  roughness?: number;
  /** water table height; null = dry tile (default -0.32) */
  waterLevel?: number | null;
  /** hills added to the landform */
  peaks?: PeakZone[];
  /** lake bowls carved below the landform */
  basins?: BasinZone[];
  /** firm shore: softly FLOOR the ground just above the waterline everywhere
   *  OUTSIDE the authored basins' influence, so raw noise can never pool
   *  stray puddles on the lawns — the ONE authored water body stays the only
   *  water. Composed parks turn this on (ParkBuilder/<Terrain>); default off
   *  keeps standalone tiles bit-identical. */
  firmShore?: boolean;
  /** RELIEF BIAS — modulate the fbm landform (never the authored peaks or
   *  basins) by Chebyshev radius `max(|x|,|z|)`: scaled by `inner` inside
   *  `r0`, easing to full amplitude by `r1`. Keeps the park core gentle and
   *  buildable while the flanks carry the archetype's real drama. */
  reliefBias?: { r0: number; r1: number; inner: number };
  /** perimeter MUD SKIRT (default true): four thin walls around the plot so
   *  carved ground never reads see-through from a low camera. Pass `false`
   *  when a `buildSurround` ring continues the land past the plot — the walls
   *  then only draw a dark OUTLINE around the map, which is exactly the "the
   *  world ends here" read the surround exists to remove. */
  edgeSkirt?: boolean;
  /** FLAT POCKETS — rectangles where the fbm landform is scaled by `k`
   *  (easing out over `blend`), for ground that must stay level whatever the
   *  landform archetype: the entrance forecourt/apron above all. */
  flatSpots?: { x: number; z: number; rx: number; rz: number; k: number; blend: number }[];
}

/** firm-shore RIDGING factor. The firm shore used to lerp sub-floor ground to
 *  the CONSTANT `waterLevel + 0.34`, which turned every cell below that
 *  (>50% of a park's area once the landform has any amplitude at all) into one
 *  dead-flat plane at exactly that height — a major cause of "every park's
 *  lawn looks the same". The floor now MIRRORS the dip upward instead, so dry
 *  ground keeps its variation. Strictly ≥ the old constant floor, so every
 *  dryness guarantee the old behaviour gave still holds. */
const FIRM_SHORE_RIDGE = 0.3;
/** cap on that mirrored rise so a deep noise trough can never become a bulge
 *  past the composition probe's 0.8 gate */
const FIRM_SHORE_RIDGE_MAX = 0.5;

/**
 * Build the sculpted terrain. Returns the mesh group (heightfield + mud skirt),
 * a `heightAt(x, z)` sampler that matches the mesh exactly, and the tile size.
 * Place water yourself (see TerrainKit preview) at `waterLevel`.
 */
export function buildTerrain(t: typeof THREE, opts: TerrainOpts = {}) {
  const size = opts.size ?? 12;
  const seg = opts.seg ?? 96;
  const seed = opts.seed ?? 3;
  const amplitude = opts.amplitude ?? 1.1;
  const scale = opts.scale ?? 4.5;
  const octaves = Math.max(1, Math.min(6, Math.round(opts.octaves ?? 4)));
  const roughness = Math.max(0.2, Math.min(0.8, opts.roughness ?? 0.5));
  const wl = opts.waterLevel === undefined ? -0.32 : opts.waterLevel;
  const peaks = opts.peaks ?? [{ x: size * 0.2, z: -size * 0.18, height: 1.5, radius: size * 0.28 }];
  const basins = opts.basins ?? [{ x: -size * 0.18, z: size * 0.14, radius: size * 0.26, depth: 1.5 }];

  const rb = opts.reliefBias;
  const flats = opts.flatSpots ?? [];

  /** the fbm LANDFORM term alone, with the relief bias + flat pockets applied
   *  (authored peaks/basins ride on top of it, unmodulated) */
  const landformAt = (x: number, z: number): number => {
    let n = fbm(x / scale, z / scale, seed, octaves, roughness);
    if (rb) {
      const rad = Math.max(Math.abs(x), Math.abs(z));
      n *= rb.inner + (1 - rb.inner) * smoother((rad - rb.r0) / Math.max(1e-3, rb.r1 - rb.r0));
    }
    for (const f of flats) {
      const dx = Math.max(0, Math.abs(x - f.x) - f.rx);
      const dz = Math.max(0, Math.abs(z - f.z) - f.rz);
      const k = 1 - smoother(Math.hypot(dx, dz) / Math.max(1e-3, f.blend)); // 1 inside -> 0 past blend
      if (k > 0) n *= 1 - k * (1 - f.k);
    }
    return n * amplitude;
  };

  // single source of ground height: landform + peaks - basins, edges taper to 0
  const heightAt = (x: number, z: number): number => {
    let h = landformAt(x, z);
    for (const p of peaks) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.radius) {
        const k = 1 - d / p.radius;
        h += p.height * k * k * (3 - 2 * k) * (0.82 + 0.18 * Math.abs(vnoise(x * 0.35, z * 0.35, seed + 91)));
      }
    }
    for (const b of basins) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.radius) h -= b.depth * (1 - smoother(d / b.radius));
    }
    if (opts.firmShore && wl !== null && h < wl + 0.34) {
      // firm shore: outside the basins' influence the ground never dips
      // toward the water table (no stray noise puddles); inside a basin the
      // authored bowl keeps its full depth, blending over ~0.35·radius.
      // Sub-floor ground is MIRRORED up (never flattened to the floor) so a
      // landform archetype's low ground stays varied instead of collapsing
      // into one identical plane — see FIRM_SHORE_RIDGE.
      let inf = 0;
      for (const b of basins) {
        const d = Math.hypot(x - b.x, z - b.z);
        const k = 1 - clamp01((d - b.radius) / Math.max(0.6, b.radius * 0.35));
        if (k > inf) inf = k;
      }
      const floor = wl + 0.34;
      const dry = floor + Math.min(FIRM_SHORE_RIDGE_MAX, (floor - h) * FIRM_SHORE_RIDGE);
      h = h * inf + dry * (1 - inf);
    }
    const edge = clamp01(Math.min(size / 2 - Math.abs(x), size / 2 - Math.abs(z)) / 1.5);
    return h * smoother(edge);
  };

  const geo = new t.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const maxH = Math.max(0.001, amplitude + peaks.reduce((m, p) => Math.max(m, p.height), 0));
  const d = 0.35;
  let minH = Infinity;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    if (h < minH) minH = h;
    const slope =
      Math.max(Math.abs(heightAt(x + d, z) - h), Math.abs(heightAt(x, z + d) - h)) / d;

    // grass tone: drier with altitude, lusher near the waterline
    let grass = mix(GRASS, DRY, clamp01(h / maxH) * 0.45);
    if (wl !== null && h < wl + 2 && slope < 0.6) {
      grass = mix(grass, LUSH, 0.45 * clamp01(1 - (h - wl) / 2));
    }
    let c: RGB;
    if (wl !== null && h < wl + 0.02) {
      // underwater: aqua basin deepening toward the lake floor, sandy at the
      // waterline — reads as bright shallows through the water, never slate
      c = mix(BASIN, SAND, clamp01((h - (wl - 1.2)) / 1.2));
    } else if (wl !== null && h < wl + 0.08) {
      // foam-lapped waterline band
      c = mix(FOAM, SAND, 0.45);
    } else if (wl !== null && h < wl + 0.18) {
      c = SAND;
    } else if (wl !== null && h < wl + 0.9 && slope <= 0.9) {
      // shoreline gradient: dry sand eases into grass, never a hard line
      c = mix(SAND, grass, smoother((h - (wl + 0.18)) / 0.72));
    } else if (slope > 0.9) {
      // steep slopes read as grey rock strata (alternating tone bands)
      c = Math.floor(h / 0.8) % 2 === 0 ? ROCK1 : ROCK2;
    } else if (h > maxH * 0.72) {
      // high ground blends toward rock
      c = mix(grass, ROCK1, clamp01((h - maxH * 0.72) / (maxH * 0.28)));
    } else {
      c = grass;
    }
    // deterministic per-vertex dither so flats never look airbrushed
    const dk = 1 + ((((i * 2654435761) >>> 16) % 7) - 3) * (slope < 0.12 ? 0.02 : 0.012);
    colors[i * 3] = Math.min(1, c[0] * dk);
    colors[i * 3 + 1] = Math.min(1, c[1] * dk);
    colors[i * 3 + 2] = Math.min(1, c[2] * dk);
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new t.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals(); // smoothed normals

  // vertex colours over our procedural grass bump relief (colour map removed
  // so sand/rock vertex tints are not stained green by the grass map)
  const groundMat = mat(t, 0x6f9e54, { tex: 'grass', repeat: [size * 1.4, size * 1.4], rough: 1, bump: 0.04 });
  groundMat.map = null; // keep the grass bump relief, colour comes from vertices
  groundMat.vertexColors = true;
  groundMat.needsUpdate = true;

  const ground = new t.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  ground.castShadow = true;

  const mesh = new t.Group();
  mesh.add(ground);

  // mud skirt around the perimeter so carved ground never reads see-through
  const skirtTop = 0.02;
  const skirtBot = Math.min(minH, wl ?? 0) - 0.4;
  const sh = skirtTop - skirtBot;
  const sy = skirtBot + sh / 2;
  if (opts.edgeSkirt !== false) {
  mesh.add(box(t, [size + 0.08, sh, 0.08], MUD_HEX, [0, sy, size / 2], { tex: 'concrete', repeat: [8, 1], rough: 1 }));
  mesh.add(box(t, [size + 0.08, sh, 0.08], MUD_HEX, [0, sy, -size / 2], { tex: 'concrete', repeat: [8, 1], rough: 1 }));
  mesh.add(box(t, [0.08, sh, size + 0.08], MUD_HEX, [size / 2, sy, 0], { tex: 'concrete', repeat: [1, 8], rough: 1 }));
  mesh.add(box(t, [0.08, sh, size + 0.08], MUD_HEX, [-size / 2, sy, 0], { tex: 'concrete', repeat: [1, 8], rough: 1 }));
  }

  return { mesh, heightAt, size };
}

// ---------------------------------------------------------------------------
// buildSurround — the INFINITE-PLANE SKIRT. A composed park's plot edge used
// to read as a cliff into the void: the heightfield tapers to 0 at ±size/2 and
// simply stops. The surround continues the land WELL past the playable bounds
// as a low-resolution square annulus — same palette, distant ridge silhouettes
// on its far bands, aerial-perspective vertex colours hazing toward the sky —
// so from any camera the world has no end.
//
// COST: ONE merged non-indexed mesh = ONE draw call, ~3-4 k triangles, no
// texture, no shadows (cast + receive off), MeshLambertMaterial. It is pure
// backdrop: no collision, no ground sampler, no footprint, no blocker, never
// registered with the manager. Every validator bound is expressed in ±size/2
// (footprints, track points, access nodes, water flood-fill, terrainLint's
// inBounds) so nothing can be placed on it and no check sees it — it is
// tagged `userData.evalKind = 'surround'` for probes.
//
// The inner rim sits flush at y = 0 (where the heightfield's edge taper lands)
// and rises outward, so there is no seam and no gap over the terrain's mud
// skirt. Height is >= waterLevel + 0.2 everywhere, so the park's ONE water
// sheet (which spans only the plot) can never appear to leak past the rim.
// ---------------------------------------------------------------------------

export interface SurroundOpts {
  /** the plot edge length the skirt wraps — its square hole */
  size: number;
  /** outer reach from the centre, world units (>> size/2). Tune it to the
   *  scene's fog wall so the far rim is fully fog-coloured: then the skirt
   *  fades into the sky instead of ending. */
  reach: number;
  seed?: number;
  /** samples along each side of the ring (default 44) */
  along?: number;
  /** outward bands (default 9) — LOD is by construction: the whole skirt is
   *  ~4 k coarse triangles no matter how far it reaches */
  bands?: number;
  /** distant-ridge height at the far rim, world units (default 16) */
  ridge?: number;
  /** near ground colour (match the climate lawn) */
  ground?: number;
  /** far/haze colour (match the sky/background) */
  haze?: number;
  /** ridge-top rock/snow colour */
  crest?: number;
  /** the park's water table — the skirt always stays above it */
  waterLevel?: number;
}

export function buildSurround(t: typeof THREE, opts: SurroundOpts): { mesh: THREE.Mesh; heightAt: (x: number, z: number) => number; reach: number } {
  // start a hair inside the plot boundary so the ring tucks OVER the terrain's
  // own perimeter (where the heightfield's edge taper has already reached 0) —
  // no seam, no sliver of sky between plot and surround
  const half = opts.size / 2 - 0.06;
  const reach = Math.max(half * 1.35, opts.reach);
  const seed = opts.seed ?? 5;
  const along = Math.max(8, Math.round(opts.along ?? 44));
  const bands = Math.max(3, Math.round(opts.bands ?? 9));
  const ridge = opts.ridge ?? 16;
  const wl = opts.waterLevel ?? -0.26;
  const cGround = col(opts.ground ?? 0x5f7a3e);
  const cHaze = col(opts.haze ?? 0xa8cdd9);
  const cCrest = col(opts.crest ?? 0x7b786f);

  // ring r=0 hugs the plot edge, r=1 is the far rim; eased so the bands get
  // wider (coarser) with distance — cheap where it cannot be inspected
  const radAt = (f: number) => half + (reach - half) * (f * f * (3 - 2 * f)) ** 0.85;
  /** walk the square perimeter at Chebyshev radius `rad`, s in [0,1) */
  const ptAt = (rad: number, s: number): [number, number] => {
    const q = s * 4;
    const side = Math.min(3, Math.floor(q));
    const u = q - side; // 0..1 along this side
    const a = -rad + 2 * rad * u;
    return side === 0 ? [a, -rad] : side === 1 ? [rad, a] : side === 2 ? [-a, rad] : [-rad, -a];
  };
  const heightOf = (x: number, z: number, f: number): number => {
    if (f <= 0) return 0;
    // two-octave ridged noise at a distance-appropriate wavelength: broad
    // ranges near the plot, bigger massifs far out
    const w = 26 + 34 * f;
    const n = Math.abs(fbm(x / w, z / w, seed, 3, 0.5));
    const n2 = Math.abs(vnoise(x / (w * 3.1), z / (w * 3.1), seed + 13));
    // Relief holds FLAT for the first ~15% (an apron ring level with the plot,
    // so a camera dollied just past the boundary is never inside a hillside)
    // and reaches FULL height by ~45% of the way out — NOT at the far rim,
    // which sits ON the fog wall where a ridge would be 100% fog-coloured and
    // the horizon would read as a flat dark line. Real ridge silhouettes
    // therefore land in the partly-hazed middle distance, where they read.
    const shape = smoother((f - 0.15) / 0.3) ** 1.15;
    if (shape <= 0) return 0;
    return Math.max(wl + 0.2, shape * ridge * (0.16 + 0.62 * n + 0.42 * n2));
  };

  const nS = along * 4;
  const verts: number[] = [];
  const cols: number[] = [];
  const push = (x: number, y: number, z: number, f: number) => {
    verts.push(x, y, z);
    // aerial perspective: land colour receding into the haze, ridge tops rocky
    const crest = clamp01((y / Math.max(0.001, ridge)) * 1.9);
    let c = mix(cGround, cCrest, crest * 0.75);
    c = mix(c, cHaze, clamp01(f * 1.12) ** 1.25 * 0.82);
    const dk = 1 + ((((Math.round(x * 7 + z * 13) * 2654435761) >>> 16) % 5) - 2) * 0.014;
    cols.push(Math.min(1, c[0] * dk), Math.min(1, c[1] * dk), Math.min(1, c[2] * dk));
  };
  for (let b = 0; b < bands; b += 1) {
    const f0 = b / bands;
    const f1 = (b + 1) / bands;
    const r0 = radAt(f0);
    const r1 = radAt(f1);
    for (let i = 0; i < nS; i += 1) {
      const s0 = i / nS;
      const s1 = (i + 1) / nS;
      const [ax, az] = ptAt(r0, s0);
      const [bx, bz] = ptAt(r0, s1);
      const [cx, cz] = ptAt(r1, s1);
      const [dx, dz] = ptAt(r1, s0);
      const ay = heightOf(ax, az, f0);
      const by = heightOf(bx, bz, f0);
      const cy = heightOf(cx, cz, f1);
      const dy = heightOf(dx, dz, f1);
      // two triangles per quad, wound COUNTER-CLOCKWISE seen from above so the
      // computed normals point UP on all four sides (A,D,B would invert them
      // and the whole ring would render black and see-through)
      push(ax, ay, az, f0); push(bx, by, bz, f0); push(dx, dy, dz, f1);
      push(bx, by, bz, f0); push(cx, cy, cz, f1); push(dx, dy, dz, f1);
    }
  }
  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new t.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  // DoubleSide is the cheap insurance policy: whatever angle the camera finds,
  // the surround is never a hole in the world
  const m = new t.MeshLambertMaterial({ vertexColors: true, side: t.DoubleSide });
  const mesh = new t.Mesh(geo, m);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.name = 'surround';
  mesh.userData.evalKind = 'surround';
  mesh.userData.surroundReach = reach;
  // analytic height of the ring at any XZ (0 inside the plot) — feed it to the
  // Stage's ground sampler so the camera walks OVER the distant ridges instead
  // of through them when the user dollies out at a low elevation
  const heightAt = (x: number, z: number): number => {
    const rad = Math.max(Math.abs(x), Math.abs(z));
    if (rad <= half || rad >= reach) return 0;
    // invert radAt numerically (monotonic, 12 bisection steps is exact enough)
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 12; k += 1) {
      const mid = (lo + hi) / 2;
      if (radAt(mid) < rad) lo = mid;
      else hi = mid;
    }
    return heightOf(x, z, (lo + hi) / 2);
  };
  return { mesh, heightAt, reach };
}

export function buildTerrainKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const terrain = buildTerrain(t);
        g.add(terrain.mesh);

        // lake: square water sheet at the water table — visible in the basin
        const wl = -0.32;
        const water = buildWater(t, terrain.size * 0.995, 120);
        water.mesh.position.y = wl;
        g.add(water.mesh);

        // a few boulders conformed to the heightfield, partially buried
        (
          [
            [2.9, 0.9, 0.4, 7],
            [-0.8, -2.9, 0.3, 2],
            [1.7, 3.4, 0.24, 12],
            [-3.6, -1.6, 0.34, 5],
          ] as const
        ).forEach(([x, z, s, seed]) => {
          const rock = buildRock(t, { scale: s, seed });
          rock.position.set(x, terrain.heightAt(x, z) - s * 0.12, z);
          g.add(rock);
        });

        return (time) => water.update(time);
      })(three, group) || undefined;
  return { group, update };
}

/** <TerrainKit> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const TerrainKit = composable('TerrainKit', (t) => buildTerrainKitScene(t));
