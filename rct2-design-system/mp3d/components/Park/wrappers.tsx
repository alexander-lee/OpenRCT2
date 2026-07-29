// ---------------------------------------------------------------------------
// Park/wrappers — the QUEUED content wrappers: <Gate>, <FlatRide>, <Placed>,
// <Stall>, <Restroom>, <Fountain>, <Torch>, <Neon>, <DanceFloorR>, <Scenery>
// and <Lights>. Each one hands its build to the park's time-sliced build queue
// (`enqueueBuild`) so a park streams in instead of blocking in one frame.
//
// <Terrain> and <Paths> are the exception and live in ./wrappersLand: they stay
// SYNCHRONOUS because every wrapper here guards on `park.ground`/`park.paths`
// at effect time. They are re-exported by name below so `./wrappers` remains
// the single import surface Park/index.tsx reads.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cyl } from '../Stage';
import { planRideAccess, plinthUnder, groundRideAccess, reportPlanLint, TILE } from '../ParkBuilder';
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
import { WORLD_THEMES } from '../SetPieceKit';
import type { WorldTheme } from '../SetPieceKit';
import { usePark, xzOf, yOf, isXZ, disposeDeep } from './parkContext';
import type { MovableRec, ParkContextValue, ParkPathsInfo, ParkPosition, ParkStore, V3, XZ } from './parkContext';
import { ConfigurableStall, pickAdjacentExitCell, exitIsAdjacentOutward, exitAdjacencyLintDetail } from './configurableRide';

// The SYNCHRONOUS land pair, re-exported BY NAME (never `export *`) so the
// public surface of './wrappers' is exactly what it was before the split.
export type { TerrainProps, PathsProps } from './wrappersLand';
export { Terrain, Paths } from './wrappersLand';

// ---- <ThemeRegion> --------------------------------------------------------

export interface ThemeRegionProps {
  /** a shipped world (`'emberfall' | 'tidewater' | 'brasswork' | 'thornwick' |
   *  'pulse' | 'default'`) or a WorldTheme object of your own */
  theme: WorldTheme | string;
  /** region centre `[x, z]` */
  position: XZ;
  /** half-extents `[hx, hz]` — the rectangle this theme dresses */
  extent: XZ;
  /** quarter-turn yaw of the rectangle (default 0) */
  rotation?: number;
  /** override the region id (defaults to `theme.id`). Two regions sharing an id
   *  share a furniture merge bucket, which is what you want for a world split
   *  across two rectangles. */
  id?: string;
}

/**
 * `<ThemeRegion>` — DESIGNATE PART OF THE PLOT AS ONE WORLD.
 *
 * The spatial half of the theme abstraction. Mount it after `<Terrain>` and
 * BEFORE `<Paths>` (the street network reads the regions when it builds), then:
 *
 *   * every ROAD inside the rectangle is paved with `theme.pathSurface` —
 *     `<Paths>` derives its `surfaceZones` from the registered regions, so you
 *     no longer hand-list a zone per world;
 *   * every BENCH, LITTER BIN and LAMP POST the network plants on those roads is
 *     dressed in `theme.furniture` (Emberfall's charred iron and lava lanterns,
 *     Pulse's black steel and magenta neon, …);
 *   * `usePark().themeAt(x, z)` answers for anything else — a `<Scenery>` piece,
 *     a `<Fountain>`, a set-piece plan — so a component can dress itself from
 *     where it stands instead of being told.
 *
 * You still choose WHICH pieces belong in a world; a theme cannot know a caldera
 * wants basalt rocks. What it removes is having to restate the world's LOOK at
 * every call site.
 *
 * ```tsx
 * <Terrain … />
 * <ThemeRegion theme="emberfall" position={[-30, 20]} extent={[22, 18]} />
 * <ThemeRegion theme="pulse"     position={[28, -24]} extent={[20, 16]} />
 * <Paths nodes={NODES} edges={EDGES} />   // ← both worlds' streets, automatically
 * ```
 */
export const ThemeRegion: React.FC<ThemeRegionProps> = ({ theme, position, extent, rotation = 0, id }) => {
  const park = usePark('ThemeRegion');
  const key = JSON.stringify({ theme: typeof theme === 'string' ? theme : theme.id, position, extent, rotation, id });
  useEffect(() => {
    // ---- DEGRADE, NEVER THROW (2026-07-28) ---------------------------------
    // These three checks used to `throw` from inside this effect body. Unlike
    // every other wrapper's validation they are NOT inside a `queueBuild`, so
    // `runOneBuild`'s try/catch (parkContext.ts:695) could not contain them: an
    // uncaught error in an effect unwinds React and takes the WHOLE PARK — no
    // Stage, no validatePark verdict, all 16 axes zero, over one mistyped theme
    // id. That made `<ThemeRegion>` the last un-isolated crash path in the
    // design system, and it is the same defect the wave-9 P0-A pass removed
    // from every plan builder ("DEGRADE, LINT, NEVER THROW" — SetPieceKit
    // Context.md). A theme region is DRESSING: skipping one costs a park its
    // themed path surface and verge furniture, which is a lint, not a page.
    const resolved: WorldTheme | undefined = typeof theme === 'string' ? WORLD_THEMES[theme] : theme;
    if (!resolved) {
      reportPlanLint(
        'themeRegionUnknown',
        `<ThemeRegion>: unknown theme "${String(theme)}" — SKIPPED (no region registered, so this land keeps the ` +
          `default dress). Shipped ids are ${Object.keys(WORLD_THEMES).join(', ')}, or pass a WorldTheme object.`,
      );
      return;
    }
    if (!isXZ(position) || !isXZ(extent)) {
      reportPlanLint(
        'themeRegionBadRect',
        `<ThemeRegion theme="${resolved.id}">: position and extent must both be [x, z] — SKIPPED ` +
          `(got position ${JSON.stringify(position)}, extent ${JSON.stringify(extent)}).`,
      );
      return;
    }
    if (extent[0] <= 0 || extent[1] <= 0) {
      reportPlanLint(
        'themeRegionBadRect',
        `<ThemeRegion theme="${resolved.id}">: extent is HALF-extents and must be positive — SKIPPED ` +
          `(got ${JSON.stringify(extent)}).`,
      );
      return;
    }
    return park.registerThemeRegion({
      theme: resolved,
      cx: position[0],
      cz: position[1],
      hx: extent[0],
      hz: extent[1],
      yaw: rotation,
      ...(id ? { id } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
};

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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
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
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Gate');
    return () => {
      cancel();
      disposeBuilt?.();
    };
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
  /** exit hut cell — OPTIONAL: omitted, it is auto-derived the RCT2 way — ONE
   *  TILE (1.2 u) along the station face from the entrance hut, i.e. right beside
   *  the head of the queue, so the queue runs IN next to it and its own ordinary
   *  footpath runs OUT (`adjacentExitCells`, configurableRide.tsx). It used to
   *  default to the local `[-1.5, 1.35]` cell with its doorway facing the queue
   *  frame's −x — the OPPOSITE way from the entrance, with nothing leading away
   *  from it. Pass a cell to place it yourself; a choice that is not
   *  adjacent-and-outward is reported as an `exitNotAdjacent` lint. */
  exit?: XZ;
  /** exit doorway OUTWARD facing — OPTIONAL: defaults to `queueDir`, so the exit
   *  opens the same way the entrance does (RCT2's `DirectionReverse` of the
   *  stored element direction) */
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
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
      // ---- exit/exitDir auto-derivation: THE RCT2 LAYOUT ---------------------
      // The exit hut takes the station-face cell ONE TILE beside the ENTRANCE hut,
      // facing the same way OUT — queue in, footpath out, side by side. It used to
      // take the local `[-1.5, 1.35]` cell with `exitDir` = the queue frame's −x,
      // i.e. the opposite face, and nothing led away from it: measured over the
      // reference parks that put 25 of 26 exits on bare grass. The entrance hut's
      // own cell comes out of `planRideAccess` (the tail node minus the lane), so
      // derive from THAT, not from the ride centre.
      const qm = Math.hypot(props.queueDir[0], props.queueDir[1]) || 1;
      const qd: XZ = [props.queueDir[0] / qm, props.queueDir[1] / qm];
      const acc0 = planRideAccess(park.paths.net.nodes, props.queueTailNode, qd, props.capacity ?? 3, [x, z], qd);
      const derivedExit = pickAdjacentExitCell({
        anchor: acc0.anchor,
        dir: qd,
        net: park.paths.net,
        streetNodes: park.paths.streetNodes,
        tail: park.paths.net.nodes[props.queueTailNode],
      }).cell;
      const exit: XZ = props.exit ?? derivedExit;
      const exitDir: XZ = props.exitDir ?? qd;
      if (!props.exit)
        console.info(
          `[Park] <FlatRide> "${props.name ?? 'Flat Ride'}": no exit given — auto-derived the exit hut at [${exit[0].toFixed(2)}, ${exit[1].toFixed(
            2,
          )}], one tile along the station face from the entrance hut and facing the same way out (pass exit/exitDir to place it yourself)`,
        );
      // an AUTHORED exit that is not adjacent-and-outward is honoured and LINTED
      if (props.exit || props.exitDir) {
        const m = exitIsAdjacentOutward(acc0.anchor, qd, exit, exitDir);
        if (!m.ok)
          park.reportLint(
            'exitNotAdjacent',
            exitAdjacencyLintDetail(`[Park] <FlatRide> "${props.name ?? 'Flat Ride'}"`, m, exit, derivedExit, qd),
            false,
          );
      }
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
        exitDir: acc.exitDir, // the OUTWARD facing — the exit path is cast along it
      });
      // the lane is GRADED from the ride's level to the street at its tail
      // (GameManager buildQueueLane) — the berm under it follows the same two
      // ends, or it stands proud of the slab at one and leaves air at the other
      const frTailY =
        (park.paths as ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }).walkYAt?.(acc.tail[0], acc.tail[1]) ?? frAccY;
      groundRideAccess(t, g, groundAt, acc, frAccY, [handle.exitPoint()[0], handle.exitPoint()[2]], frTailY);
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
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'FlatRide');
    return () => {
      cancel();
      disposeBuilt?.();
    };
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
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
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Placed');
    return () => {
      cancel();
      disposeBuilt?.();
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
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
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Restroom');
    return () => {
      cancel();
      disposeBuilt?.();
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
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
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Fountain');
    return () => {
      cancel();
      disposeBuilt?.();
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
      const t = park.three;
      const [x, z] = position;
      const torch = buildTorch(t, { height });
      torch.group.position.set(x, park.floorAt(x, z), z);
      return park.addObject(torch.group, torch.update);
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Torch');
    return () => {
      cancel();
      disposeBuilt?.();
    };
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
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
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Neon');
    return () => {
      cancel();
      disposeBuilt?.();
    };
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
      const t = park.three;
      const [x, z] = position;
      const df = buildDanceFloor(t, { size, tile });
      df.group.position.set(x, park.groundAt(x, z), z);
      df.group.rotation.y = rotation;
      return park.addObject(df.group, df.update);
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'DanceFloorR');
    return () => {
      cancel();
      disposeBuilt?.();
    };
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
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
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Scenery');
    return () => {
      cancel();
      disposeBuilt?.();
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
    // TIME-SLICED MOUNT: queued through the store so a park streams
    // in instead of building every child in one blocking commit.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
      const t = park.three;
      const g = new t.Group();
      const mk = ([x, z]: XZ) => buildLightPole(t, [x, park.floorAt(x, z), z], { height: poleHeight });
      const a = mk(from);
      const b = mk(to);
      const span = buildStringLights(t, a.hook, b.hook, { bulbs, colors, sag });
      g.add(a.group, b.group, span.group);
      return park.addObject(g, span.update);
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Lights');
    return () => {
      cancel();
      disposeBuilt?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}
