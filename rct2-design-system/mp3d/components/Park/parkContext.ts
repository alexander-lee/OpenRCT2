import { createContext, useContext } from 'react';
import * as THREE from 'three';
import type { StageApi } from '../Stage';
import { createGameManager } from '../GameManager';
import type { BlockerSpec } from '../GameManager';
import { terrainLint } from '../ParkBuilder';
import type { ParkClimate, ParkComposition, ParkFootRect } from '../ParkBuilder';
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
//   FAR         beyond MID                    every 4th    + particles (Points),
//                                             frame        + its PointLights —
//                                                          the geometry stays as
//                                                          a static silhouette
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
// throttled. On top of the tiers the runtime enforces the GLOBAL LIGHT
// BUDGET: every 0.3 s all entry PointLights are sorted by camera distance and
// only the nearest `budgets.lights` (default 16) stay `visible` — components
// keep animating `intensity` freely (night gates), the budget only owns
// `visible`.

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
  tier?: LodTier;
  offSince?: number;
}

export function createParkRuntime(three: typeof THREE, entries: Set<RuntimeEntry>, api: StageApi, opts: { size: number; lights: number }) {
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
    e.obj.traverse((o) => {
      const anyO = o as { isPointLight?: boolean; isSpotLight?: boolean; isPoints?: boolean };
      if (anyO.isPointLight || anyO.isSpotLight) e.lights!.push(o);
      else if (anyO.isPoints) e.points!.push(o);
      if ((o.userData as { lodDetail?: boolean }).lodDetail && o.visible) e.details!.push(o);
    });
    e.tier = 0;
    e.offSince = 0;
    e.ready = true;
  };

  const applyTier = (e: RuntimeEntry, t: LodTier) => {
    if (e.tier === t) return;
    e.tier = t;
    e.details!.forEach((o) => (o.visible = t === 0));
    e.points!.forEach((o) => (o.visible = t <= 1));
    if (t >= 2) e.lights!.forEach((o) => (o.visible = false)); // the budget re-admits them when nearer
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

    // global light budget: nearest-N admission, re-sorted at 0.3 s cadence.
    // Keeping the ACTIVE set the same size avoids three.js re-compiling the
    // forward shaders (programs are keyed on the visible-light count); the
    // 0.9 stickiness bonus stops equal-distance lights swapping every pass.
    lightClock += dt;
    if (lightClock >= 0.3) {
      lightClock = 0;
      const cand: { o: THREE.Object3D; d: number }[] = [];
      entries.forEach((e) => {
        if (!e.ready || !e.lights!.length) return;
        if (e.lod !== 'full' && e.tier! >= 2) return; // FAR/OFFSCREEN lights stay out
        for (const o of e.lights!) {
          o.getWorldPosition(tmp);
          let d = Infinity;
          for (let ci = 0; ci < cams.length; ci++) d = Math.min(d, camPool[ci].distanceTo(tmp));
          if (o.visible) d *= 0.9;
          cand.push({ o, d });
        }
      });
      cand.sort((a, b) => a.d - b.d);
      for (let i = 0; i < cand.length; i++) cand[i].o.visible = i < opts.lights;
    }
  };

  return { tick };
}

// ---- the context ------------------------------------------------------------

/** terrain facts, set by <Terrain> when it mounts */
export interface ParkGround {
  heightAt: (x: number, z: number) => number;
  waterLevel: number;
  size: number;
  comp: ParkComposition;
  lint: ReturnType<typeof terrainLint>;
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
  /** build-time lint / auto-fix events (round-6 safeguard) — fed to
   *  validatePark, which promotes the `fatal` ones to hard failures */
  _lints: ParkLint[];
  /** planted scenery/tree footprints (round-6 safeguard) — validatePark
   *  audits them for dryness + path-slab intrusion */
  _planted: { label: string; x: number; z: number; r: number }[];
  /** corridor auto-resolution candidates (round-5 safeguard) */
  _movables: MovableRec[];
  /** set by <Terrain>: re-run the guard clamp over runtime-derived footprints
   *  + coaster footings and rebuild the terrain in place (round-5 safeguard) */
  _reclamp: ((rects: ParkFootRect[], coasterPts: V3[]) => void) | null;
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

export function makeStore(three: typeof THREE, root: THREE.Group, api: StageApi, cfg: { seed: number; size: number; climate: ParkClimate }): ParkStore {
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
    _lints: [],
    _planted: [],
    _movables: [],
    _reclamp: null,
    _tShift: 0,
    _gm: null,
    addObject(obj, updater, opts) {
      root.add(obj);
      const entry: RuntimeEntry = { obj, update: updater, lod: opts?.lod ?? 'auto', phase: store._entrySeq++ };
      store._entries.add(entry);
      let alive = true;
      return () => {
        if (!alive) return;
        alive = false;
        root.remove(obj);
        store._entries.delete(entry);
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
        for (const [cx, cz, w, d] of store.paths.plazas) {
          if (Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= d / 2) return store.paths.plazaY;
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
        walkYAt: (store.paths as ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }).walkYAt,
        bins: store.paths.bins,
        // live view over the registered circuits — powers mgr.corridorCells()
        circuits: () => store._coasters.map((c) => ({ name: c.name, points: c.points, fatal: c.fatal })),
      });
      // a runtime entry (never cleaned up — the sim lives for the park's
      // lifetime) so its hut lamps count against the global light budget;
      // it spans the park, so it always classifies NEAR and never throttles
      store.addObject(mgr.group);
      store._managerInst = mgr;
      return mgr;
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
