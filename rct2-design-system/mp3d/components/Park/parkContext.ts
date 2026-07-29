import { createContext, useContext } from 'react';
import * as THREE from 'three';
import type { StageApi } from '../Stage';
import { createGameManager } from '../GameManager';
import type { BlockerSpec } from '../GameManager';
import { terrainLint } from '../ParkBuilder';
import { furnitureOf, themeOf } from '../SetPieceKit';
import type { WorldTheme } from '../SetPieceKit';
import type { ParkClimate, ParkComposition, ParkFootRect, WorldAudit, WorldRegionRec } from '../ParkBuilder';
import type { CoasterType } from '../SplineRideKit';

// ---------------------------------------------------------------------------
// Park/parkContext — the hand-rolled ParkContext (NOT react-three-fiber):
// shared types, the ride-runtime LOD/culling scheduler, the ParkContextValue
// contract, usePark and the mutable ParkStore factory <Park>/<ScenePreview>
// build their scenes around. See ./index.tsx for the composition overview.
// ---------------------------------------------------------------------------

export type GameMgr = ReturnType<typeof createGameManager>;
export type RideHandle = ReturnType<GameMgr['registerRide']>;
export type XZ = [number, number];
export type V3 = [number, number, number];
/** `[x, z]` (y resolved from the ground/plaza under it) or `[x, y, z]` */
export type ParkPosition = XZ | V3;

export const xzOf = (p: ParkPosition): XZ => (p.length === 3 ? [p[0], p[2]] : p);
export const yOf = (p: ParkPosition): number | null => (p.length === 3 ? p[1] : null);

/** prop-shape guard (round-2 safeguard): the ride wrappers validate their
 *  required props up front and throw a NAMED, actionable error instead of
 *  crashing on `undefined[0]` deep inside the registration math (a missing
 *  `exit` used to take the whole page down before anything mounted) */
export const isXZ = (v: unknown): v is XZ =>
  Array.isArray(v) && v.length === 2 && Number.isFinite(v[0] as number) && Number.isFinite(v[1] as number);

export function disposeDeep(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    // geometries from the Stage's shared box/cyl/ball cache are NOT disposed
    // (other meshes keep using them — the cache stays warm across remounts)
    if (m.geometry && !m.geometry.userData?.shared) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
  });
}

// ---- the ride runtime: shared LOD/culling scheduler ---------------------------
//
// EVERY object mounted through `addObject` (all Park wrappers, every
// composable, <Placed>) becomes a runtime ENTRY — no ride is an always-on
// standalone scene. Each frame the runtime classifies entries by distance to
// the active cameras (main orbit cam + any RideViewer/PlayerCam inset) and by
// the main frustum, then applies one policy fleet-wide:
//
//   tier        when                          updates      sheds
//   NEAR        d < ~0.75·size (or any        every frame  nothing (full detail)
//               inset cam is close)
//   MID         d < ~1.4·size                 every 2nd    `userData.lodDetail`
//                                             frame        children (passengers,
//                                                          cockpit dressing)
//   FAR         beyond MID                    every 4th    + particles (Points)
//                                             frame        — the geometry stays
//                                                          as a static silhouette
//   OFFSCREEN   outside the main frustum      every 32nd   same as FAR
//               for > 0.4 s and not near      frame
//               any camera                    (keep-warm)
//
// Updaters take ABSOLUTE time (determinism rule §12), so skipped frames mean
// coarser motion, never slowed or drifted motion — a paused ride snaps to the
// exact right pose on its next tick. Tier boundaries carry ±5% hysteresis so
// rides never flap at a threshold, and update phases are staggered so MID/FAR
// rides don't all tick on the same frame. Backdrops that span the park
// (terrain, water, the path network) pass `{ lod: 'full' }` and are never
// throttled.
//
// ---- LIGHTS ARE NO LONGER THROTTLED (reverted 2026-07) ---------------------
//
// The runtime used to shed a FAR/OFFSCREEN entry's PointLights outright and then
// enforce a park-wide GLOBAL LIGHT BUDGET on top: every 0.3 s all entry lights
// were sorted by camera distance and only the nearest `budgets.lights`
// (defaulting to 16) kept `visible`. BOTH ARE GONE by default, because the
// trade was bad in both directions:
//
//   * It cost night mode the thing night mode is FOR. A park at night is lamp
//     posts, torches, neon and ride lighting spread over the whole plot; culling
//     to the nearest sixteen leaves everything past the camera's immediate
//     neighbourhood as unlit emissive glass, and pans/orbits pop lights in and
//     out at the 0.3 s cadence.
//   * It was not buying the frame back anyway.
//
// BOTH HALVES MEASURED, `monorail-ref`, size 128, SwiftShader
// (`harness/park-eval/probe-night-lights.mjs`, which counts lights that are LIT
// for the night but switched off by the runtime):
//
//                       lights          night frame
//   cap 16 (old)   41 total / 18 visible / 24 lit   1148 draws · 0.54M tris
//                  -> 11 LIT-BUT-HIDDEN
//   no cap (now)   41 total / 41 visible / 24 lit   1148 draws · 0.54M tris
//                  -> 0
//
// The cap was switching off ELEVEN of the park's twenty-four night lights, and
// the draw calls and triangle count are IDENTICAL either way — a PointLight adds
// per-fragment shader cost in forward rendering, not draws, and at 24 lights that
// cost did not surface above the noise. (fps/frameMs are NOT usable here: under
// SwiftShader the same build measured 31.6 and 28.8 fps in this probe while the
// in-page perf line reported 7.6 and 11.9 for the same two runs. Grade lights by
// the light counts and the draw/triangle totals, never by software-rendered fps.)
//
// Where the time actually goes is INITIAL LOAD, and it is terrain:
// `probe-mount-cost.mjs` on the same park reports **1012 ms of build work, 452 ms
// of it <Terrain> and 378 ms of THAT inside `parkComposition`** — against a
// steady frame carrying 4 active lights.
//
// `budgets.lights` is still honoured when a park passes it explicitly — a
// genuinely light-heavy scene can still opt in — but there is no default cap,
// and a FAR entry keeps its lights. Components own `intensity` (their night
// gates); nothing else touches it.
//
// ---- BUT A SWITCHED-OFF LIGHT IS NOT FREE (2026-07-27) ---------------------
//
// DO NOT READ THE NOTE ABOVE AS "LIGHTS ARE CHEAP". What it measured is that
// hiding LIT lights buys nothing — true, and it cost night mode dearly. The
// opposite case was never measured until now: three.js only leaves a light out
// of a material's forward light loop when `visible === false`, so a night-gated
// lamp sitting at `intensity 0` ALL DAY still books its slot and still runs a
// full per-fragment PBR iteration multiplied by zero.
//
// `Stage/darkLights.ts` now sheds exactly those, at a 0.25 s cadence with
// hysteresis, and it is worth (interleaved A/B, SwiftShader,
// `harness/mp3d-render/probe-render-cost.mjs`):
//
//   DemoPark      size 16, 21 of 24 lights dark   406 → 281 ms/frame  -31%
//   monorail-ref  size 128, 41 of 41 dark         342 → 197 ms/frame  -42%
//
// with ZERO change to draw calls or triangles. Note the shape of it: the two
// findings agree rather than conflict. Culling light you can SEE is a visual
// loss for no frame gain; culling light that is already off is a frame gain for
// no visual loss. If the opt-in `budgets.lights` cap is also active the two
// compose as an intersection (nearest-N AND lit), because the dark-light cull
// only ever restores lights IT shed.

type LodTier = 0 | 1 | 2 | 3; // NEAR, MID, FAR, OFFSCREEN
const TIER_INTERVAL = [1, 2, 4, 32] as const;

/** `addObject` options — the third, optional argument */
export interface AddObjectOpts {
  /** 'auto' (default): the runtime throttles updates and sheds
   *  lights/particles/lodDetail by distance + visibility. 'full': never
   *  throttled (park-spanning backdrops: terrain, water, paths). */
  lod?: 'auto' | 'full';
}

export interface RuntimeEntry {
  obj: THREE.Object3D;
  update?: (time: number) => void;
  lod: 'auto' | 'full';
  phase: number;
  ready?: boolean;
  center?: THREE.Vector3;
  radius?: number;
  lights?: THREE.Object3D[];
  points?: THREE.Object3D[];
  details?: THREE.Object3D[];
  /** the `lodDetail` objects THIS runtime hid (tier > NEAR). Only these are
   *  ever shown again — a component that mounted a detail hidden keeps it
   *  hidden — and `classify` needs the set to survive a re-classify: it
   *  collects details by `o.visible`, so without it every detail the LOD had
   *  already shed would be dropped from the list and stranded invisible for
   *  the rest of the session (see classify). */
  lodHidden?: Set<THREE.Object3D>;
  tier?: LodTier;
  offSince?: number;
}

export function createParkRuntime(
  three: typeof THREE,
  entries: Set<RuntimeEntry>,
  api: StageApi,
  /** `lights` is the OPT-IN park-wide cap on simultaneously visible PointLights.
   *  Leave it undefined (the default) and lights are never culled — see the
   *  LIGHTS ARE NO LONGER THROTTLED note above. */
  opts: { size: number; lights?: number },
) {
  // LOD tier radii. Purely size-relative radii break down on a vast plot: at
  // size 192 `size * 0.75` puts NEAR at 144 u and MID at 269 u, so EVERYTHING
  // is NEAR and no entry ever sheds anything. They are now clamped to absolute
  // ceilings ≈ the classic 48-park values ×1.7, which is where detail stops
  // being readable anyway (≤ 48 is unchanged: 36 / 67.2).
  const nearR = Math.min(Math.max(10, opts.size * 0.75), 62);
  const midR = Math.min(Math.max(18, opts.size * 1.4), 150);
  const frustum = new three.Frustum();
  const projM = new three.Matrix4();
  const invM = new three.Matrix4();
  const sphere = new three.Sphere();
  const tmp = new three.Vector3();
  const camPool: THREE.Vector3[] = [];
  let frameN = 0;
  let lightClock = 0;

  const classify = (e: RuntimeEntry) => {
    const bb = new three.Box3().setFromObject(e.obj);
    e.center = new three.Vector3();
    if (bb.isEmpty()) {
      e.obj.getWorldPosition(e.center);
      e.radius = 1;
    } else {
      bb.getCenter(e.center);
      e.radius = bb.getSize(tmp).length() / 2;
    }
    e.lights = [];
    e.points = [];
    e.details = [];
    const hid = (e.lodHidden ??= new Set());
    e.obj.traverse((o) => {
      const anyO = o as { isPointLight?: boolean; isSpotLight?: boolean; isPoints?: boolean };
      if (anyO.isPointLight || anyO.isSpotLight) e.lights!.push(o);
      else if (anyO.isPoints) e.points!.push(o);
      // `|| hid.has(o)` is what makes a RE-classify safe. The visibility test
      // is there so a detail the COMPONENT hid stays the component's business,
      // but a detail THIS runtime hid is still ours — and <Park> re-classifies
      // the whole set on the frame the build queue drains (parkRoot's LOD
      // note). Without the second term, every entry that sat at MID/FAR during
      // assembly came back with an EMPTY `details` list and tier reset to NEAR,
      // so its fine detail could never be shown again.
      if ((o.userData as { lodDetail?: boolean }).lodDetail && (o.visible || hid.has(o))) e.details!.push(o);
    });
    // normalise to the NEAR pose the tier below is about to be measured
    // against: anything we shed comes back, then this frame's tier re-sheds
    // exactly what distance says it should.
    e.details.forEach((o) => {
      if (!hid.has(o)) return;
      o.visible = true;
      hid.delete(o);
    });
    e.tier = 0;
    e.offSince = 0;
    e.ready = true;
  };

  const applyTier = (e: RuntimeEntry, t: LodTier) => {
    if (e.tier === t) return;
    e.tier = t;
    const hid = (e.lodHidden ??= new Set());
    e.details!.forEach((o) => {
      if (t !== 0) {
        if (!o.visible) return; // already hidden — by the component, not by us
        o.visible = false;
        hid.add(o);
      } else if (hid.delete(o)) {
        o.visible = true;
      }
    });
    e.points!.forEach((o) => (o.visible = t <= 1));
    // LIGHTS ARE NOT SHED (reverted — see the note above applyTier's section).
    // A FAR ride at night is exactly the ride whose lights you want to see
    // across the park, and killing them bought no measurable frame back.
  };

  const tick = (time: number, dt: number) => {
    frameN += 1;
    const cams: THREE.Camera[] = api.cameras ? api.cameras() : [api.camera];
    while (camPool.length < cams.length) camPool.push(new three.Vector3());
    for (let i = 0; i < cams.length; i++) cams[i].getWorldPosition(camPool[i]);
    const mainCam = api.camera;
    mainCam.updateMatrixWorld();
    invM.copy(mainCam.matrixWorld).invert();
    projM.multiplyMatrices((mainCam as THREE.PerspectiveCamera).projectionMatrix, invM);
    frustum.setFromProjectionMatrix(projM);

    entries.forEach((e) => {
      if (!e.ready) classify(e);
      if (e.lod === 'full') {
        e.update?.(time);
        return;
      }
      let d = Infinity;
      for (let ci = 0; ci < cams.length; ci++) {
        const dd = camPool[ci].distanceTo(e.center!) - e.radius!;
        if (dd < d) d = dd;
      }
      if (d < 0) d = 0;
      sphere.center.copy(e.center!);
      sphere.radius = e.radius! + 0.5;
      const off = !frustum.intersectsSphere(sphere) && d >= nearR * 0.6;
      let tier: LodTier;
      if (off) {
        e.offSince = (e.offSince ?? 0) + dt;
        tier = e.offSince > 0.4 ? 3 : e.tier!; // demotion grace — no flicker on a fast orbit
      } else {
        e.offSince = 0;
        const cur: LodTier = e.tier === 3 ? 2 : e.tier!; // back on screen: resume from FAR
        // ±5% hysteresis on both boundaries
        if (cur === 0) tier = d > midR * 1.05 ? 2 : d > nearR * 1.05 ? 1 : 0;
        else if (cur === 1) tier = d < nearR * 0.95 ? 0 : d > midR * 1.05 ? 2 : 1;
        else tier = d < nearR * 0.95 ? 0 : d < midR * 0.95 ? 1 : 2;
      }
      applyTier(e, tier);
      if (e.update) {
        const iv = TIER_INTERVAL[tier];
        if (iv === 1 || (frameN + e.phase) % iv === 0) e.update(time);
      }
    });

    // THE GLOBAL LIGHT BUDGET is OPT-IN now (it used to default to 16 and cull
    // every other light in the park — see the note above). A park that really is
    // light-heavy can still pass `budgets={{ lights: N }}`; with nothing passed,
    // `opts.lights` is undefined and every registered light simply stays on and
    // lets its component's night gate own the intensity.
    if (opts.lights !== undefined && opts.lights > 0) {
      // nearest-N admission, re-sorted at 0.3 s cadence. Keeping the ACTIVE set
      // the same size avoids three.js re-compiling the forward shaders (programs
      // are keyed on the visible-light count); the 0.9 stickiness bonus stops
      // equal-distance lights swapping every pass.
      lightClock += dt;
      if (lightClock >= 0.3) {
        lightClock = 0;
        const cand: { o: THREE.Object3D; d: number }[] = [];
        entries.forEach((e) => {
          if (!e.ready || !e.lights!.length) return;
          for (const o of e.lights!) {
            o.getWorldPosition(tmp);
            let d = Infinity;
            for (let ci = 0; ci < cams.length; ci++) d = Math.min(d, camPool[ci].distanceTo(tmp));
            if (o.visible) d *= 0.9;
            cand.push({ o, d });
          }
        });
        cand.sort((a, b) => a.d - b.d);
        for (let i = 0; i < cand.length; i++) cand[i].o.visible = i < opts.lights!;
      }
    }
  };

  return { tick };
}

// ---- the context ------------------------------------------------------------

/**
 * A THEME REGION — a rectangle of the plot that is dressed as one world.
 *
 * This is the spatial half of the theme abstraction. A theme object already
 * described what a world looks like (`SetPieceKit` WORLD_THEMES: paving,
 * planting, lamp character, path surface, furniture tones); what was missing was
 * a way to say WHERE it applies, so every call site had to restate it — a
 * `<Paths surfaceZones>` entry here, a `theme` prop on each set-piece there, and
 * nothing at all for the benches and bins the park plants down the street.
 *
 * Declare the region once with `<ThemeRegion>` and:
 *   * every ROAD whose tile centre lands inside it is paved with
 *     `theme.pathSurface` — `<Paths>` derives its `surfaceZones` from the
 *     registered regions, so authors no longer write them by hand;
 *   * every BENCH, BIN and LAMP POST planted on those roads takes
 *     `theme.furniture` (PathNetwork's `themeAt`);
 *   * `themeAt(x, z)` resolves the theme for anything else that asks — a
 *     `<Scenery>`, a `<Fountain>`, a set-piece plan.
 *
 * The AI still chooses WHICH scenery pieces belong in a world (a theme cannot
 * know that a caldera wants basalt rocks), but it no longer has to remember to
 * colour them: the region answers that.
 */
export interface ThemeRegionRec {
  /** the world's id — `theme.id` unless overridden; also the furniture merge key */
  id: string;
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  /** quarter-turn yaw of the rectangle (default 0) */
  yaw: number;
  theme: WorldTheme;
}

/** terrain facts, set by <Terrain> when it mounts */
export interface ParkGround {
  heightAt: (x: number, z: number) => number;
  waterLevel: number;
  size: number;
  comp: ParkComposition;
  lint: ReturnType<typeof terrainLint>;
  /** the `<Terrain keepDry>` list the composition was guarded with — the gate
   *  needs it to say WHICH cell forced a `waterRePicked` (wave-11 P2) */
  keepDry?: XZ[];
}

/** path-skeleton facts, set by <Paths> when it mounts */
export interface ParkPathsInfo {
  net: { nodes: XZ[]; edges: [number, number][] };
  pathY: number;
  plazaY: number;
  plazas: [number, number, number, number][];
  bins: XZ[];
  /** the RENDERED slab width (`<Paths width>`, default 1.1) — the placement
   *  lints measure "inside the street" against `width/2` (round-7) */
  width: number;
  /** node count of the RENDERED lattice, recorded BEFORE the manager's
   *  routing.attach pushes logical spur nodes — validatePark's grid check */
  streetNodes: number;
  /** every BENCH SEAT the network planted on its verges (buildPathNetwork's
   *  `benches`) — the manager sends worn-out guests to sit on them */
  benches?: { x: number; y: number; z: number; yaw: number }[];
}

/**
 * A build-time LINT / AUTO-FIX event (round-6 safeguard).
 *
 * rules/park-generation.md §0 has a FATAL-WARNINGS POLICY: any grid warning,
 * closure warning or `placeAccess` warning is fatal. Before round 6 those
 * events were console-only — an auto-fix (a flipped queueDir, a corridor
 * shift, a relocated exit hut) SILENTLY RESCUED a bad layout and
 * `validatePark` still returned `ok: true`. Every wrapper now records its
 * events here; `<Park>` hands them to `validatePark`, which reports all of
 * them in `report.warnings` and promotes `fatal: true` ones into real
 * `failures` (check `'autofix'`).
 */
export interface ParkLint {
  /** short machine kind — 'queueDirFlip' | 'causeway' | 'corridorShift' | … */
  kind: string;
  detail: string;
  /** §0-fatal: an auto-fix that rescued a design the author must re-plan */
  fatal: boolean;
}

/**
 * THE COMPOSED-TERRAIN QUERY API (round-7 safeguard).
 *
 * The seed table in rules/park-generation.md §1 lists PRE-GUARD water coords.
 * `parkComposition`'s guards RE-PICK the water body whenever the author's
 * `keepDry` list overlaps the listed disc — round-7's park planned around a
 * river at (18.1, −5.9) while the composition actually settled a lake at
 * ~(9, 12…15), then bridged it on stilts and planted a tree in it. Nothing
 * surfaced where the water LANDED. This does: read it AFTER composition
 * (inside a `<Placed build>`/`usePark()` child, i.e. after `<Terrain>`
 * mounted) and place the layout against the real thing.
 *
 * ```tsx
 * const park = usePark();
 * park.terrain?.water          // { x, z, r } — the ACTUAL body, post-guard
 * park.isDry([9, 12])          // false — that "meadow" is the lake now
 * park.isDryCell([9, 12], 0.6) // whole 1.2-u cell, not just its centre
 * ```
 */
export interface ParkTerrainApi {
  heightAt(x: number, z: number): number;
  waterLevel: number;
  size: number;
  /** ground above `waterLevel + clearance` at that exact spot */
  isDry(x: number, z: number, clearance?: number): boolean;
  /** the whole `2·half` square around the cell is dry (centre + ring) */
  isDryCell(cell: XZ, half?: number, clearance?: number): boolean;
  /** the ONE composed water body as a disc: centre + WATERLINE radius (the
   *  post-guard truth — NOT the seed table's listed coords) */
  water: { x: number; z: number; r: number } | null;
}

export interface ParkContextValue {
  /** the THREE namespace (same instance the Stage renders with) */
  three: typeof THREE;
  /** the park's scene group under the Stage */
  root: THREE.Group;
  /** the StageApi (viewports, camera pose, ground sampler, picking, stats) */
  api: StageApi;
  seed: number;
  size: number;
  climate: ParkClimate;
  /** add an object (+ optional per-frame updater) to the shared scene as a
   *  ride-runtime entry (LOD throttling + light budget — see the runtime
   *  header above; pass `{ lod: 'full' }` for park-spanning backdrops);
   *  returns the cleanup that removes, unregisters and disposes it */
  addObject(obj: THREE.Object3D, updater?: (time: number) => void, opts?: AddObjectOpts): () => void;
  /** ---- TIME-SLICED MOUNTING ------------------------------------------
   *  Queue a mount build instead of running it inline. React runs every
   *  effect of a commit in ONE task, so a whole park used to build in a
   *  single ~10-second block before the browser could paint (measured:
   *  harness/mp3d-render/probe-mount-cost.mjs, worst frame gap 9887 ms).
   *  The queue is strictly FIFO — the order is still the React effect
   *  order, so terrain → paths → manager → rides sequencing and every
   *  `floorAt`/registration dependency behave exactly as before; only the
   *  TIMING changes. Returns a cancel for a component that unmounts before
   *  its turn. */
  enqueueBuild(fn: () => void, name?: string): () => void;
  /** run every queued build NOW, synchronously — for probes, tests, and any
   *  caller that needs a complete park in the same task */
  flushBuilds(): void;
  /** run `cb` once the build queue has drained (immediately if it is already
   *  empty). Anything that reads a COMPLETE park — validatePark, onReady —
   *  must go through this rather than a single requestAnimationFrame.
   *
   *  `sync` is TRUE when the drain came from `flushBuilds()` (a probe or a
   *  test asked for a complete park in THIS task) and false when the sliced
   *  queue drained on its own. `<Park>` uses it to decide whether the
   *  acceptance gate may be deferred past a paint: a caller that flushed
   *  synchronously is entitled to a synchronous report. */
  whenBuilt(cb: (sync: boolean) => void): void;
  /** REVEAL THE STREAMED CONTENT. Everything a queued build added was mounted
   *  invisible (see `addObject`); this shows it in one step and returns how
   *  many objects it un-hid. `<Park>` calls it after the settle pass has moved
   *  everything to its final place, so the park appears complete rather than
   *  assembling — and, crucially, three.js never compiles a park material at
   *  an intermediate light count (see parkRoot's REVEAL note). */
  revealBuilt(): number;
  /** the ONE GameManager — created lazily on first access (needs <Terrain>
   *  and <Paths> mounted first; its group is added to the scene) */
  manager(): GameMgr;
  /** null until <Terrain> mounts */
  ground: ParkGround | null;
  /** null until <Paths> mounts */
  paths: ParkPathsInfo | null;
  /** the parkComposition <Terrain> ran (null before it mounts) */
  readonly composition: ParkComposition | null;
  /** terrain height (0 before <Terrain> mounts) */
  groundAt(x: number, z: number): number;
  /** the COMPOSED terrain query API (round-7) — null before <Terrain> mounts.
   *  The seed table's water coords are PRE-GUARD and can move: re-read the
   *  real body here after composition (see ParkTerrainApi). */
  readonly terrain: ParkTerrainApi | null;
  /** shorthand for `terrain.isDry` — true (permissive) before <Terrain> */
  isDry(cell: ParkPosition, clearance?: number): boolean;
  /** shorthand for `terrain.isDryCell` — the whole 1.2-u cell, not a point */
  isDryCell(cell: ParkPosition, half?: number, clearance?: number): boolean;
  /** plaza-aware surface height: plazaY inside a plaza rect, terrain else */
  floorAt(x: number, z: number): number;
  /** extra audited footprint rect for validatePark's OBB sweep (the manager
   *  already audits huts/lanes/pads) — returns the unregister */
  registerFootprint(rect: ParkFootRect): () => void;
  /** register a THEME REGION (see ThemeRegionRec) — returns its unregister */
  registerThemeRegion(rec: Omit<ThemeRegionRec, 'id'> & { id?: string }): () => void;
  /** the theme in force at a world position, or the DEFAULT theme outside every
   *  registered region. First match wins, so overlapping regions are resolved in
   *  declaration order. */
  themeAt(x: number, z: number): WorldTheme;
  /** the same resolution in the shape PathNetwork wants (`{ id, furniture }`),
   *  and `null` outside every region so the network keeps its default catalogue */
  themeFurnitureAt(x: number, z: number): { id: string; furniture: ReturnType<typeof furnitureOf> } | null;
  /** every registered region, in declaration order — `<Paths>` turns these into
   *  its `surfaceZones` so roads are themed without the author listing them */
  themeRegions(): ThemeRegionRec[];
  /** a coaster circuit for validatePark's legality/crash checks (as-built
   *  world points) — <Coaster>/<TrackRide> call this; `fatal` (from
   *  compileTrackPieces' fatal guard) turns into one hard coaster failure;
   *  returns the unregister */
  registerCoaster(c: { points: V3[]; type?: CoasterType; bank?: number; fatal?: string; name?: string }): () => void;
  /** record a build-time lint / auto-fix event (round-6 safeguard): it is
   *  console-logged AND handed to `validatePark`, which lists it in
   *  `report.warnings` and — when `fatal` — fails the park (§0's
   *  FATAL-WARNINGS POLICY). Auto-fixes must never silently rescue a design. */
  reportLint(kind: string, detail: string, fatal?: boolean): void;
  /** a PLANTED footprint (scenery piece / tree / prop) with its ground
   *  radius: `validatePark` audits it for DRYNESS (nothing stands in the
   *  water) and for standing in a walked PATH SLAB. Returns the unregister. */
  registerPlanted(p: { label: string; x: number; z: number; r: number }): () => void;
  /**
   * Declare a THEMED WORLD — a region of the plot dressed for exactly one
   * `WorldTheme` (`rules/park-generation-composition.md` §3). `<World plan={W}
   * />` calls this from `SetPieceKit.worldPlan`'s output; nothing needs to be
   * declared for an un-themed park.
   *
   * A declared world is what every POSITIONAL theme check measures against:
   * `validatePark` audits every tagged component's coordinates and warns
   * `crossTheme` when a themed piece stands inside a world of a DIFFERENT
   * theme, and the eval harness publishes the same audit as `probe.worlds`
   * (world variety + theme coherence). Returns the unregister.
   */
  registerWorld(region: WorldRegionRec): () => void;
  /** a SOLID obstacle guests must walk around (round-6 safeguard): a
   *  world-space rotated rect or circle handed to the GameManager's blocker
   *  registry — path edges through it are rejected by the routing layer,
   *  off-network waypoint walks slide along its edge, and `validatePark` fails
   *  a street that runs through it. Fountains/restrooms/`<Fence>` runs register
   *  their own; rides/stalls are auto-registered by the manager. Returns the
   *  unregister (a no-op before <Terrain>/<Paths> exist — no sim, no guests). */
  registerBlocker(spec: BlockerSpec): () => void;
}

/** a MOVABLE object the settle-time corridor auto-resolver may shift out of
 *  a coaster track corridor: flat-ride rigs + stalls register one (streets,
 *  coasters and `pinned` objects never do) */
export interface MovableRec {
  label: string;
  kind: 'ride' | 'stall';
  /** explicit `pinned` prop — the resolver reports but never moves it */
  pinned: boolean;
  /** LIVE audited footprint rects (re-read after every shift) */
  rects: () => ParkFootRect[];
  /** fixed base height for the clearance test (stalls: the anchor level, the
   *  validator's convention); omitted = terrain height under each rect */
  base?: () => number;
  /** translate the visual AND its manager registration by [dx, dz] */
  shift: (dx: number, dz: number) => void;
  /** rides only: relocate JUST the exit hut (mgr.moveRideExit) — the small
   *  fix when the exit hut alone landed inside a corridor */
  shiftExit?: (dx: number, dz: number) => void;
  /** rides only: the exit hut's footprint label */
  exitLabel?: string;
  /** rides only: SHORTEN the queue lane (mgr.resizeRideLane) — the
   *  last-resort tier for derived lanes too long to fit anywhere */
  resizeLane?: (len: number) => void;
}

export interface ParkStore extends ParkContextValue {
  _entries: Set<RuntimeEntry>;
  _entrySeq: number;
  _managerInst: GameMgr | null;
  _coasters: { points: V3[]; type?: CoasterType; bank?: number; fatal?: string; name?: string }[];
  _extraFootprints: ParkFootRect[];
  _themeRegions: ThemeRegionRec[];
  /** build-time lint / auto-fix events (round-6 safeguard) — fed to
   *  validatePark, which promotes the `fatal` ones to hard failures */
  _lints: ParkLint[];
  /** planted scenery/tree footprints (round-6 safeguard) — validatePark
   *  audits them for dryness + path-slab intrusion */
  _planted: { label: string; x: number; z: number; r: number }[];
  /** corridor auto-resolution candidates (round-5 safeguard) */
  _movables: MovableRec[];
  /** PADS FOUND STANDING IN THE STREET at mount (wave-11 P0). The mount-time
   *  `lintPadOffLattice` records the offender and the legal cell it already
   *  computed; `resolvePadOnStreet` applies the move at settle time instead of
   *  shipping the placement that severs the network behind it. */
  _padOnStreet: { name: string; at: XZ; to: XZ | null; clear: number; kind: 'ride' | 'stall' }[];
  /** the THEMED WORLDS `<World plan={…}>` declared, in declaration order */
  _worlds: WorldRegionRec[];
  /** the settle-time WORLD THEME COHERENCE audit (`auditWorldThemes`) — set by
   *  <Park> before it validates, and read by the eval probe as `probe.worlds` */
  _worldAudit: WorldAudit | null;
  /** set by <Terrain>: re-run the guard clamp over runtime-derived footprints
   *  + coaster footings and rebuild the terrain in place (round-5 safeguard) */
  _reclamp: ((rects: ParkFootRect[], coasterPts: V3[]) => void) | null;
  /** <Paths>'s re-settle hook: re-solve the street heights against the ground
   *  `heightAt` reports RIGHT NOW and rebuild the network geometry. <Terrain>
   *  calls it after an AUTO-keepDry re-clamp has moved the land out from under
   *  the finished pavement. `pathY` stays pinned — only the profile moves. */
  _resettlePaths: (() => void) | null;
  /** pending time-sliced builds (FIFO — see `enqueueBuild`) */
  _buildQ: QueuedBuild[];
  _buildDone: ((sync: boolean) => void)[];
  _buildRaf: number;
  /** true WHILE a queued build's own `fn` is running. `_buildQ` is already
   *  empty during the last build (the item was shifted off before it ran), and
   *  `addObject` needs to know that what it is being handed is still streamed
   *  content, not a post-drain mount. */
  _building: boolean;
  /** objects `addObject` hid because they arrived mid-build — `revealBuilt`
   *  shows exactly these and nothing else (a component that mounted its own
   *  group invisible stays invisible, the same rule `Stage/darkLights.ts`
   *  follows for the lights IT shed) */
  _hiddenWhileBuilding: THREE.Object3D[];
  /** set by `revealBuilt` — the park has opened, so nothing mounts hidden any
   *  more (a late rebuild would have no second reveal to bring it back) */
  _revealed: boolean;
  /** true from the moment the queue drains until <Park>'s settle pass and the
   *  acceptance gate have finished. The frame loop treats it exactly like a
   *  non-empty build queue: updaters run at the FROZEN clock, the sim does
   *  not advance. Without it, deferring the gate past a paint would let real
   *  frames carry the manager to t ≈ 2 s before validatePark's smoke run
   *  rewinds it to 0 — the FSM-timers-in-the-future failure parkRoot's HOLD
   *  THE SIM CLOCK note describes. */
  _settling: boolean;
  _tShift: number;
  /** true under <ScenePreview> — registration hooks are skipped there */
  _previewHost?: boolean;
  /** set by the <GameManager> child — declares the sim explicitly */
  _gm?: { guests?: number } | null;
}

/** the 9 samples `isDryCell` tests: centre + 4 corners + 4 edge midpoints */
const CELL_RING: XZ[] = [
  [0, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const ParkReactContext = createContext<ParkContextValue | null>(null);

/** the ParkContext for custom children — throws outside <Park> */
export function usePark(consumer = 'park child'): ParkContextValue {
  const ctx = useContext(ParkReactContext);
  if (!ctx) throw new Error(`<${consumer}> must be rendered inside <Park>`);
  return ctx;
}

/** DEFAULT OPENING POPULATION for a plot — `<Park guests>`'s default.
 *
 *  A park now opens with a CROWD, and the crowd scales with the plot: the old
 *  flat 12 left the (much larger) default plot reading as an empty diorama.
 *
 *  THE CURVE IS MEASURED, not chosen. The corpus's own authored counts are the
 *  only evidence of what reads as "populated" on a given plot, and the two
 *  points that were rendered and scored good are size 16 → 10 guests
 *  (Park.previews `DemoPark`) and size 48 → 18-26, mean 21 (`DistrictPark` 22,
 *  arch-ref 20, setpiece-ref 18, cinder-peak 26). Fitting a power law through
 *  (16, 10) and (48, 21) gives an exponent of ln(2.1)/ln(3) = 0.675 on the plot
 *  EDGE — i.e. the crowd grows with the CUBE ROOT OF PLOT AREA, which is how
 *  this corpus's street networks actually grow (a bigger plot spreads its
 *  districts out, it does not tile the whole area with paths). 2/3 is within a
 *  hair of the fit, so that is the exponent, re-anchored on ~50 guests at the
 *  128 default:
 *
 *      guests(size) = clamp(round(50 · (size / 128)^(2/3)), 6, 80)
 *
 *  | size | 16 | 24 | 32 | 48 | 64 | 96 | 128 | 160 | 192 | 256 |
 *  | ---- | -- | -- | -- | -- | -- | -- | --- | --- | --- | --- |
 *  | open | 13 | 17 | 20 | 26 | 32 | 41 |  50 |  58 |  66 |  79 |
 *
 *  Expressed against `size`, so it stays correct through the 192 → 128 default
 *  change: 50 on a 128 plot, 66 on a 192, and the pinned reference sizes get
 *  13 / 26 — at or below the counts their own authors already validated, so a
 *  compact park is never swamped. The 192-plot corpus counts (18-20) are
 *  DELIBERATELY excluded from the fit: those are the empty-looking parks this
 *  default exists to fix.
 *
 *  Cost: ~0.9 µs of sim per guest per frame (measured, `harness/park-eval/
 *  probe-gate-stream.mjs perf`) — 50 guests are 0.05 ms/frame, 0.3 % of a
 *  60 fps budget. The expensive half is DRAWING them; see `guestCapForSize`. */
export const guestsForSize = (size: number) => { void size; return 500; }; // MEASUREMENT PATCH — restore before shipping

/** HARD POPULATION CEILING for a plot — the gate stream (GameManager
 *  `arrivals.ts`) stops admitting while `activeGuests >= cap` and resumes the
 *  moment a `leavingPark` guest despawns, so a happy park BREATHES at the
 *  ceiling instead of growing without bound.
 *
 *  Twice the opening population, clamped to [24, 160]: enough headroom that a
 *  well-run park visibly fills up over a few minutes, low enough that the
 *  crowd stays affordable to draw.
 *
 *  | size | 16 | 32 | 48 | 64 | 96 | 128 | 160 | 192 | 256 |
 *  | ---- | -- | -- | -- | -- | -- | --- | --- | --- | --- |
 *  | cap  | 26 | 40 | 52 | 64 | 82 | 100 | 116 | 132 | 158 |
 *
 *  This is a PERFORMANCE guard, not an RCT2 mechanic. RCT2's own soft cap
 *  (`suggestedGuestMaximum`, Park.cpp:107-140 — Σ ride BonusValue, which
 *  quarters the generation probability once exceeded) is ported faithfully in
 *  `arrivals.ts` and still applies underneath; at this fleet's ride counts it
 *  sits in the hundreds, so on a small park it is the RIDES that throttle the
 *  stream and on a big one this ceiling. */
export const guestCapForSize = (size: number) => guestsForSize(size); // MEASUREMENT PATCH — restore before shipping

interface QueuedBuild {
  fn: () => void;
  name: string;
  cancelled?: boolean;
}

/** ms of build work allowed per animation frame. 8 keeps a 60 Hz frame inside
 *  its 16.7 ms budget with room for the render itself, so the park streams in
 *  while staying interactive instead of freezing. */
const BUILD_BUDGET_MS = 8;

export function makeStore(three: typeof THREE, root: THREE.Group, api: StageApi, cfg: { seed: number; size: number; climate: ParkClimate }): ParkStore {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  /** one queued build; profiled into window.__buildMarks when
   *  window.__PARK_PROFILE is set (probe-mount-cost.mjs reads it) */
  function runOneBuild() {
    const it = store._buildQ.shift();
    if (!it || it.cancelled) return;
    const t0 = now();
    store._building = true;
    try {
      it.fn();
    } catch (e) {
      // one component failing to build must not abandon the rest of the park
      console.error(`[Park] build failed (${it.name}):`, e);
    } finally {
      store._building = false;
    }
    const w = typeof window !== 'undefined' ? (window as unknown as { __PARK_PROFILE?: boolean; __buildMarks?: { name: string; ms: number }[] }) : null;
    if (w?.__PARK_PROFILE) (w.__buildMarks ??= []).push({ name: it.name, ms: now() - t0 });
  }
  function finishBuilds(sync: boolean) {
    const cbs = store._buildDone.splice(0);
    for (const cb of cbs) cb(sync);
  }
  function drainBuilds() {
    store._buildRaf = 0;
    const t0 = now();
    // always run at least one, so a single build longer than the budget still
    // makes progress instead of the queue stalling forever
    do {
      runOneBuild();
    } while (store._buildQ.length && now() - t0 < BUILD_BUDGET_MS);
    if (store._buildQ.length) scheduleBuilds();
    else finishBuilds(false);
  }
  /** YIELD TO THE BROWSER, DO NOT WAIT FOR A FRAME. The first version of this
   *  drained one chunk per `requestAnimationFrame`, which ties build progress
   *  to the frame rate — and on a slow GPU a frame is not 16 ms. Measured
   *  under SwiftShader (446 ms/frame) a 19-build park took ~8.5 s of wall time
   *  purely waiting for paints, i.e. chunking made time-to-ready far WORSE
   *  than building synchronously. A macrotask yield keeps total build time
   *  essentially the same as synchronous while still letting the browser
   *  paint and handle input between chunks. */
  function scheduleBuilds() {
    if (store._buildRaf || !store._buildQ.length) return;
    store._buildRaf = setTimeout(drainBuilds, 0) as unknown as number;
  }
  const store: ParkStore = {
    three,
    root,
    api,
    seed: cfg.seed,
    size: cfg.size,
    climate: cfg.climate,
    ground: null,
    paths: null,
    get composition() {
      return store.ground?.comp ?? null;
    },
    _entries: new Set(),
    _entrySeq: 0,
    _managerInst: null,
    _coasters: [],
    _extraFootprints: [],
    _themeRegions: [],
    _lints: [],
    _planted: [],
    _movables: [],
    _padOnStreet: [],
    _worlds: [],
    _worldAudit: null,
    _reclamp: null,
    _resettlePaths: null,
    _buildQ: [],
    _buildDone: [],
    _buildRaf: 0,
    _building: false,
    _hiddenWhileBuilding: [],
    _revealed: false,
    _settling: false,
    enqueueBuild(fn, name = 'build') {
      const item: QueuedBuild = { fn, name };
      store._buildQ.push(item);
      scheduleBuilds();
      return () => {
        item.cancelled = true;
      };
    },
    flushBuilds() {
      while (store._buildQ.length) runOneBuild();
      finishBuilds(true);
    },
    whenBuilt(cb) {
      if (!store._buildQ.length) cb(true);
      else store._buildDone.push(cb);
    },
    revealBuilt() {
      const n = store._hiddenWhileBuilding.length;
      for (const o of store._hiddenWhileBuilding) o.visible = true;
      store._hiddenWhileBuilding.length = 0;
      // ONE-WAY. A component that mounts (or rebuilds) after the park has
      // opened queues its build like any other, and there is no second reveal
      // to un-hide it — so once this has run, `addObject` stops hiding.
      store._revealed = true;
      return n;
    },
    _tShift: 0,
    _gm: null,
    addObject(obj, updater, opts) {
      // STREAMED CONTENT MOUNTS INVISIBLE. Everything a queued build adds is
      // hidden until `revealBuilt()`, and the reason is shader programs, not
      // aesthetics: three.js keys a material's program cache on the number of
      // VISIBLE lights, so a park that renders 100 intermediate states while
      // it assembles compiles the same 26 shaders at a dozen different light
      // counts. Measured on parkA-99 (size 128), M4 Pro at --throttle=4 with
      // harness/mp3d-render/probe-assembly.mjs: 44 live programs when the park
      // renders as it builds, 26 when it does not — and every one of those
      // extra compiles is a synchronous main-thread stall during load.
      //
      // <Terrain> and <Paths> are NOT affected: they are synchronous (see
      // wrappersLand's header), so they add before anything is queued and stay
      // visible — the land and the street are exactly what should be on screen
      // while the rest streams in behind the scenes.
      //
      // Only objects that were visible are recorded, so a component that
      // mounts its own group hidden is never force-shown by the reveal.
      //
      // NEVER UNDER <ScenePreview>. A preview host has no settle pass and so
      // calls neither `whenBuilt` nor `revealBuilt` — hiding there would mean
      // every previewed component, and every screenshot probe that reads one,
      // rendering an empty stage forever. A preview is one component on a
      // turntable; it has no light-count churn worth optimising away.
      if (!store._previewHost && !store._revealed && (store._buildQ.length || store._building) && obj.visible) {
        obj.visible = false;
        store._hiddenWhileBuilding.push(obj);
      }
      root.add(obj);
      const entry: RuntimeEntry = { obj, update: updater, lod: opts?.lod ?? 'auto', phase: store._entrySeq++ };
      store._entries.add(entry);
      let alive = true;
      return () => {
        if (!alive) return;
        alive = false;
        root.remove(obj);
        store._entries.delete(entry);
        // unmounted before the reveal — drop it from the pending list rather
        // than un-hiding (and pinning) a disposed object later
        const h = store._hiddenWhileBuilding.indexOf(obj);
        if (h >= 0) store._hiddenWhileBuilding.splice(h, 1);
        disposeDeep(obj);
      };
    },
    groundAt(x, z) {
      return store.ground ? store.ground.heightAt(x, z) : 0;
    },
    // ---- the composed-terrain query API (round-7 safeguard) ---------------
    get terrain() {
      const g = store.ground;
      if (!g) return null;
      const isDry = (x: number, z: number, clearance = 0.12) => g.heightAt(x, z) > g.waterLevel + clearance;
      // the ACTUAL water body: the composition's primary basin, post-guard
      // (waterline ≈ 0.74·radius — the same figure the seed table lists as
      // `wl-r`), widened to cover every overlapping basin of the one body
      let water: { x: number; z: number; r: number } | null = null;
      const basins = g.comp?.basins ?? [];
      if (basins.length) {
        const [cx, cz] = g.comp.waterCentre;
        let r = 0;
        for (const b of basins) r = Math.max(r, Math.hypot(b.x - cx, b.z - cz) + 0.74 * b.radius);
        water = { x: cx, z: cz, r };
      }
      return {
        heightAt: g.heightAt,
        waterLevel: g.waterLevel,
        size: g.size,
        isDry,
        isDryCell: (cell: XZ, half = 0.6, clearance = 0.12) => {
          for (const [dx, dz] of CELL_RING) if (!isDry(cell[0] + dx * half, cell[1] + dz * half, clearance)) return false;
          return true;
        },
        water,
      } satisfies ParkTerrainApi;
    },
    isDry(cell, clearance = 0.12) {
      if (!store.ground) return true; // no terrain yet — nothing to be wet in
      const [x, z] = xzOf(cell);
      return store.ground.heightAt(x, z) > store.ground.waterLevel + clearance;
    },
    isDryCell(cell, half = 0.6, clearance = 0.12) {
      if (!store.ground) return true;
      const [x, z] = xzOf(cell);
      for (const [dx, dz] of CELL_RING) if (!store.isDry([x + dx * half, z + dz * half], clearance)) return false;
      return true;
    },
    floorAt(x, z) {
      if (store.paths) {
        // each plaza is ONE level, but a LOCAL one once the street follows the
        // land — `plazaLevels` is <Paths>'s per-plaza truth, `plazaY` its
        // network-wide reference (kept as the fallback for older callers)
        const lv = (store.paths as ParkPathsInfo & { plazaLevels?: number[] }).plazaLevels;
        const ps = store.paths.plazas;
        for (let i = 0; i < ps.length; i += 1) {
          const [cx, cz, w, d] = ps[i];
          if (Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= d / 2)
            return lv?.[i] !== undefined ? lv[i] + 0.096 : store.paths.plazaY;
        }
      }
      return store.groundAt(x, z);
    },
    manager() {
      if (store._managerInst) return store._managerInst;
      if (!store.ground || !store.paths) {
        throw new Error('<Park>: mount <Terrain> and <Paths> BEFORE the gate/rides/stalls — children mount in JSX order');
      }
      const wl = store.ground.waterLevel;
      const mgr = createGameManager(three, {
        groundAt: (x, z) => Math.max(store.floorAt(x, z), wl + 0.06),
        net: store.paths.net, // the SAME object buildPathNetwork rendered
        laneY: store.paths.pathY + 0.09,
        // ramp-aware surface sampler — guests climb elevated paths (<Paths> nodeY/triples)
        // LATE-BOUND: <Paths> can rebuild its network after an AUTO-keepDry
        // re-clamp, which replaces this sampler — a captured reference would
        // leave every guest walking the pre-clamp profile
        walkYAt: (x: number, z: number) =>
          (store.paths as (ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }) | null)?.walkYAt?.(x, z) ??
          (store.paths ? store.paths.pathY + 0.09 : 0),
        // the RENDERED pavement surface (<Paths> publishes it alongside
        // walkYAt). Same late binding, same reason: the network can be rebuilt
        // by an AUTO-keepDry re-settle. Ride ACCESS RUNS grade to this so their
        // slabs meet the street flush; guests keep using walkYAt.
        surfaceYAt: (x: number, z: number) =>
          (store.paths as (ParkPathsInfo & { surfaceYAt?: (x: number, z: number) => number }) | null)?.surfaceYAt?.(x, z) ??
          (store.paths as (ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }) | null)?.walkYAt?.(x, z) ??
          (store.paths ? store.paths.pathY + 0.09 : 0),
        bins: store.paths.bins,
        // the verge BENCHES <Paths> planted — a worn-out guest walks to one and
        // sits on it (RCT2 PeepState::Sitting) instead of freezing mid-street.
        // Read ONCE here (each seat becomes a record with its own occupancy);
        // a post-clamp <Paths> re-settle re-plants the furniture and pushes the
        // new list back through `mgr.setBenches`.
        benches: (store.paths as ParkPathsInfo).benches ?? [],
        // live view over the registered circuits — powers mgr.corridorCells()
        circuits: () => store._coasters.map((c) => ({ name: c.name, points: c.points, fatal: c.fatal })),
        // THE GATE STREAM: guests keep arriving through the registered entrance
        // while the park is well run (GameManager/arrivals.ts), up to the
        // PLOT-SCALED hard ceiling
        arrivals: { cap: guestCapForSize(store.size) },
      });
      // a runtime entry (never cleaned up — the sim lives for the park's
      // lifetime) so its hut lamps count against the global light budget;
      // it spans the park, so it always classifies NEAR and never throttles
      store.addObject(mgr.group);
      store._managerInst = mgr;
      return mgr;
    },
    registerThemeRegion(rec) {
      const full: ThemeRegionRec = { ...rec, id: rec.id ?? rec.theme.id, yaw: rec.yaw ?? 0 };
      store._themeRegions.push(full);
      return () => {
        const i = store._themeRegions.indexOf(full);
        if (i >= 0) store._themeRegions.splice(i, 1);
      };
    },
    themeRegions() {
      return store._themeRegions.slice();
    },
    themeAt(x, z) {
      for (const r of store._themeRegions) {
        // world -> region-local (undo the yaw), the same transform the
        // GameManager's attention zones use
        const dx = x - r.cx;
        const dz = z - r.cz;
        const c = Math.cos(r.yaw);
        const sn = Math.sin(r.yaw);
        if (Math.abs(dx * c - dz * sn) <= r.hx && Math.abs(dx * sn + dz * c) <= r.hz) return r.theme;
      }
      return themeOf(undefined);
    },
    themeFurnitureAt(x, z) {
      for (const r of store._themeRegions) {
        const dx = x - r.cx;
        const dz = z - r.cz;
        const c = Math.cos(r.yaw);
        const sn = Math.sin(r.yaw);
        if (Math.abs(dx * c - dz * sn) <= r.hx && Math.abs(dx * sn + dz * c) <= r.hz)
          return { id: r.id, furniture: furnitureOf(r.theme) };
      }
      return null; // outside every region: the default catalogue
    },
    registerFootprint(rect) {
      store._extraFootprints.push(rect);
      return () => {
        const i = store._extraFootprints.indexOf(rect);
        if (i >= 0) store._extraFootprints.splice(i, 1);
      };
    },
    registerCoaster(c) {
      // ROUND-7: the corridor sweep exempts a circuit's OWN pad/hut/lane by
      // matching the registered NAME (validate.ts: `if (c.name !== undefined)`
      // … `rideOfLabel(r.label) === c.name`). So an unnamed circuit skips the
      // whole ride-footprint half of the sweep, and two circuits sharing a
      // name exempt EACH OTHER's access assemblies. <Coaster>/<TrackRide>
      // always pass a name; a hand-rolled `usePark().registerCoaster` may not.
      if (!store._previewHost) {
        if (c.name === undefined)
          console.warn(
            '[Park] registerCoaster() without a `name`: validatePark can only exempt a circuit\'s OWN pad/hut/lane by name, so the corridor sweep will SKIP every ride-footprint check for this circuit. Always pass a name.',
          );
        else if (store._coasters.some((o) => o.name === c.name))
          console.warn(
            `[Park] two circuits are both registered as "${c.name}" — the corridor sweep matches OWN footprints by name, so they will exempt EACH OTHER's pads/huts/lanes. Give every ride its own name.`,
          );
      }
      store._coasters.push(c);
      return () => {
        const i = store._coasters.indexOf(c);
        if (i >= 0) store._coasters.splice(i, 1);
      };
    },
    reportLint(kind, detail, fatal = false) {
      if (store._previewHost) return; // previews are staging, not parks
      store._lints.push({ kind, detail, fatal });
      // eslint-disable-next-line no-console
      console.warn(`[Park] ${fatal ? 'FATAL LINT' : 'lint'} [${kind}] ${detail}`);
    },
    registerPlanted(p) {
      if (store._previewHost) return () => {};
      store._planted.push(p);
      return () => {
        const i = store._planted.indexOf(p);
        if (i >= 0) store._planted.splice(i, 1);
      };
    },
    registerWorld(region) {
      if (store._previewHost) return () => {};
      const clash = store._worlds.find((w) => w.id === region.id);
      if (clash)
        store.reportLint(
          'worldIdReused',
          `two worlds are both declared as "${region.id}" (${clash.title} and ${region.title}) — every positional theme check resolves a piece to a world BY ID, so the second one silently inherits the first one's findings. Give each world its own id`,
          true,
        );
      store._worlds.push(region);
      return () => {
        const i = store._worlds.indexOf(region);
        if (i >= 0) store._worlds.splice(i, 1);
      };
    },
    registerBlocker(spec) {
      if (store._previewHost) return () => {};
      if (!store.ground || !store.paths) {
        // no sim here (a static diorama) — nothing walks, nothing to block
        console.info(
          `[Park] registerBlocker(${spec.label}): no <Terrain>/<Paths> yet, so there is no sim to keep out — declare solid dressing AFTER the street skeleton`,
        );
        return () => {};
      }
      const h = store.manager().registerBlocker(spec);
      return () => h.remove();
    },
  };
  return store;
}
