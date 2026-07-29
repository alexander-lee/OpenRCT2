// ---------------------------------------------------------------------------
// REGISTRATION — everything a park declares to the sim: rides (queue lane +
// entrance/exit huts + placement audit + routing spurs + auto blockers),
// stalls, litter bins, restrooms, attention zones (dance / watch) and the park
// entrance (the sole spawn/despawn point).
//
// Each register* returns the small live HANDLE the composition layer holds on
// to; those handles are part of the PUBLIC API of '../GameManager' and their
// shapes are unchanged. Implementation detail of createGameManager.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { buildRideEntrance, ENTRANCE_DOORWAY, HUT_APRON_Y } from '../RideEntrance';
import { T, SPACING, BOARD_QUIET_SECS } from './types';
import type {
  RideConfig,
  RideStationConfig,
  RideStationRec,
  StallConfig,
  RideRec,
  StallRec,
  BinRec,
  RestroomRec,
  SimGuest,
  WayPt,
  AttentionZoneConfig,
  WatchZoneConfig,
} from './types';
import {
  buildQueueLane,
  buildExitLane,
  exitLaneRect,
  planExitLane,
  exitLaneLabels,
  laneFenceRects,
  hutRect,
  EXIT_LANE_BACK,
  EXIT_LANE_MAX,
} from './access';
import type { FootRect } from './access';
import type { Sim } from './sim';

// ---- ATTENTION ZONES: registerDanceZone / registerWatchZone ----------------
// LOGIC only — the rig mesh (a DanceFloor's tiles, a MagicMirror's glass) is
// always the caller's job. Wandering guests whose stroll crosses the rectangle
// take a hashed per-second chance to stop and either
//   mode 'dance'  — action { kind: 'dance' }, the pose sequencer's 2.2 Hz beat,
//                   a hashed 10-30 s dwell, happy + energetic guests only
//                   (<DanceFloor register>: unchanged from the original API), or
//   mode 'watch'  — state 'watching', standing still and FACING `faceAt` for a
//                   hashed 4-10 s. This is the existing RCT2 PeepState::Watching
//                   path (navigation.ts's "watch a nearby ride" sets exactly the
//                   same three fields) made registrable from outside.
// Both then walk on, and BOTH carry a per-guest re-latch bar (`ready`).
export interface DanceZoneRec {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  cos: number;
  sin: number;
  /** what a latched guest DOES here (see above) */
  mode: 'dance' | 'watch';
  /** world xz the guest turns to face while latched (null = keep heading) */
  faceAt: [number, number] | null;
  /** hashed dwell window in seconds */
  minLinger: number;
  maxLinger: number;
  /** per-guest seconds after a dwell ENDS before this zone may latch again */
  cooldown: number;
  /** need floors to latch (0 = no gate) */
  minHappiness: number;
  minEnergy: number;
  /** THE COOLDOWN BAR: guest idx -> simTime this zone may latch them again.
   *  Per guest AND per zone, so one guest walking on never stops the next
   *  guest from stopping. Guest idx is monotonic and never reused (spawn.ts),
   *  so entries stay valid for the guest's whole visit. */
  ready: Map<number, number>;
}

export const inDanceZone = (z: DanceZoneRec, x: number, zz: number): boolean => {
  // world → zone-local (undo the yaw; matches Park's local frame:
  // +z_world = [sin, cos], +x_world = [cos, -sin])
  const dx = x - z.cx;
  const dz = zz - z.cz;
  const lx = dx * z.cos - dz * z.sin;
  const lz = dx * z.sin + dz * z.cos;
  return Math.abs(lx) <= z.halfW && Math.abs(lz) <= z.halfD;
};

export function createRegistry(s: Sim) {
  const { t, group, net, routing, rides, stalls, bins, guests, rideAt, stallAt, restrooms, restroomAt, danceZones } = s;

  // ---- ride registration: lane + huts + placement audit + routing attach ----
  //
  // MULTI-STATION (RCT2 `Ride` owns an array of `RideStation`s, Ride.h /
  // Station.h). `cfg` describes STATION 0 exactly as it always has; each entry
  // in `cfg.stations` adds another platform built by the SAME code below, with
  // its own queue lane, entrance hut, exit hut, exit footpath, routing spurs
  // and blockers. `buildStationRig` is that code, factored out verbatim — a
  // one-station ride runs the identical path it did before.
  const buildStationRig = (
    cfg: RideConfig,
    sc: RideStationConfig,
    /** the label every footprint/warning for THIS platform carries. Station 0
     *  keeps the bare ride name so existing labels/audits are unchanged. */
    label: string,
  ) => {
    const m = Math.hypot(sc.queueDir[0], sc.queueDir[1]) || 1;
    const dir: [number, number] = [sc.queueDir[0] / m, sc.queueDir[1] / m];
    const laneLen = Math.max(1.2, sc.laneLen ?? Math.max(2.2, 0.6 + cfg.capacity * 2 * SPACING + 0.5));
    // the ride's access rig (lane + huts) lives in ONE subgroup so the
    // corridor auto-resolver can translate it in lockstep with the sim state
    const accessG = new t.Group();
    // NAMED, so the rendered rig is identifiable in a scene walk / raycast
    // probe — Stage bakes colour into the texture and leaves material.color
    // white, so names are the only reliable discriminator (see access.ts)
    accessG.name = `access:${label}`;
    group.add(accessG);
    // ---- THE LANE'S TWO LEVELS ----------------------------------------------
    // The head stands at the RIDE (`queueAnchor[1] + 0.09`); the tail has to
    // land on the STREET, which `walkY` samples at `pathY + nodeY + 0.09`. They
    // are only equal by accident — a ride pad is `groundAt + 0.22` and the
    // street is a solved, near-level lattice — so a flat lane put the whole
    // difference in a step at the mouth of the queue. Hand the tail level to
    // buildQueueLane and the lane becomes an RCT2 sloped path instead.
    const laneY = sc.queueAnchor[1] + 0.09;
    const tailXZ: [number, number] = [
      sc.queueAnchor[0] + dir[0] * (laneLen + 0.35),
      sc.queueAnchor[2] + dir[1] * (laneLen + 0.35),
    ];
    const laneTailY = net ? s.walkY(tailXZ[0], tailXZ[1]) : laneY; // net-less previews stay flat
    // ---- THE SIM DATUM vs THE RENDERED SURFACE ------------------------------
    // `walkY` reports `node + PATH_H` — the height guests set their feet at —
    // but the network DRAWS its pavement higher than that: junction pads and
    // ramp ribbons finish at `padTop = PATH_H + PATH_PAD_LIP` (a deliberate
    // 6 mm, so pad faces are never coplanar with a passing slab's and the joins
    // cannot z-fight), and a KNUCKLE pad bevels toward each of its sloped edges.
    // A lane graded to the datum stops UNDER the pavement it joins — measured
    // +5 to +12 mm across six rides, and up to 8 mm again on a ramped knuckle.
    //
    // So the SLAB ramps to `surfY` sampled where the slab PHYSICALLY ENDS
    // (`anchor + dir·laneLen`, which is 0.35 short of the tail NODE — the
    // node's pad reaches 0.61 back and covers the overlap), while `laneTailY`
    // stays the datum because every queue SLOT height hangs off it.
    const laneEndXZ: [number, number] = [sc.queueAnchor[0] + dir[0] * laneLen, sc.queueAnchor[2] + dir[1] * laneLen];
    const laneTailRenderY = net ? s.surfY(laneEndXZ[0], laneEndXZ[1]) : laneTailY;
    const laneG = buildQueueLane(t, sc.queueAnchor, dir, laneLen, cfg.queueSurface, laneTailRenderY);
    accessG.add(laneG);

    // Queue-head audit (verified arithmetic): the lane extends anchor -> +dir
    // with slot i at anchor + (0.45 + i·SPACING)·dir, so slot 0 (the HEAD) is
    // the anchor end — the RIDE side. The entrance hut + sign stand just
    // BEYOND the head at anchor − 0.62·dir facing +dir, putting its doorway
    // (local +z, 0.66) at anchor + 0.04·dir, directly in front of slot 0.
    // Guests join from past the TAIL (anchor + (laneLen + 0.35)·dir spur),
    // file toward slot 0 and enter through the doorway. Not reversed.
    const entYaw = Math.atan2(dir[0], dir[1]);
    const ent = sc.queueAnchor === cfg.queueAnchor ? (cfg.entrance ?? buildRideEntrance(t, { kind: 'entrance' }).group) : buildRideEntrance(t, { kind: 'entrance' }).group;
    const ex0 = sc.queueAnchor[0] - dir[0] * 0.62;
    const ez0 = sc.queueAnchor[2] - dir[1] * 0.62;
    ent.name = 'entranceHut';
    ent.position.set(ex0, sc.queueAnchor[1], ez0);
    ent.rotation.y = entYaw;
    accessG.add(ent);
    const dw = ENTRANCE_DOORWAY;
    const doorway: WayPt = { x: ex0 + Math.sin(entYaw) * dw[2], z: ez0 + Math.cos(entYaw) * dw[2], y: sc.queueAnchor[1] + 0.09 };
    // hut INTERIOR — the boarding walk ends here (RCT2 'inEntrance'): the
    // guest steps through the front doorway INTO the hut and vanishes; the
    // ride then seats them at boardPoint. They never walk onto the ride.
    const hutIn: WayPt = { x: ex0, z: ez0, y: sc.queueAnchor[1] + 0.09 };

    // ---- the exit hut's OUTWARD facing --------------------------------------
    // RCT2 stores the exit element's `direction` pointing INWARD at the station
    // and connects the footpath on the REVERSE side (EntranceElement.cpp:22-26,
    // Footpath.cpp:118-121); `cfg.exitDir` is that reverse — the outward side,
    // the same sense as the UI's `gRideEntranceExitPlaceDirection`
    // (openrct2-ui/ride/Construction.cpp:479-483). Prefer it, because the RCT2
    // LAYOUT puts the exit ADJACENT to the entrance on the SAME station face,
    // which makes the legacy `boardPoint → exitPoint` vector diagonal and skews
    // the hut off the cardinal grid. Fall back to that vector when unset.
    let exDir: [number, number];
    if (sc.exitDir && (sc.exitDir[0] !== 0 || sc.exitDir[1] !== 0)) {
      const em = Math.hypot(sc.exitDir[0], sc.exitDir[1]);
      exDir = [sc.exitDir[0] / em, sc.exitDir[1] / em];
    } else {
      const odx = sc.exitPoint[0] - sc.boardPoint[0];
      const odz = sc.exitPoint[2] - sc.boardPoint[2];
      const om = Math.hypot(odx, odz) || 1;
      exDir = [odx / om, odz / om];
    }
    const exYaw = Math.atan2(exDir[0], exDir[1]);
    // ---- placement audit: entrance hut / exit hut / queue lane / board pad --
    const entRect = hutRect(ex0, ez0, entYaw, `${label} entrance hut`);
    const laneRect: FootRect = {
      cx: sc.queueAnchor[0] + dir[0] * (laneLen / 2),
      cz: sc.queueAnchor[2] + dir[1] * (laneLen / 2),
      hx: 0.36, // 0.55 lane + railings
      hz: laneLen / 2,
      yaw: entYaw,
      label: `${label} queue lane`,
    };
    const padRect: FootRect = { cx: sc.boardPoint[0], cz: sc.boardPoint[2], hx: 0.45, hz: 0.45, yaw: 0, label: `${label} boardPoint pad` };
    const placed = s.access.placeAccess(label, entRect, laneRect, padRect, [sc.exitPoint[0], sc.exitPoint[2]], exYaw);
    const exitPos: WayPt = { x: placed.exit[0], z: placed.exit[1], y: sc.exitPoint[1] };
    s.access.allFootprints.push(entRect, laneRect, padRect, hutRect(exitPos.x, exitPos.z, exYaw, `${label} exit hut`));

    const exit = buildRideEntrance(t, { kind: 'exit' }).group;
    exit.name = 'exitHut';
    exit.position.set(exitPos.x, exitPos.y, exitPos.z);
    exit.rotation.y = exYaw;
    accessG.add(exit);
    // the doorway waypoint stands ON the hut's apron — HUT_APRON_Y, the hut's
    // own published slab top, which IS the shared path course (PATH_H) so the
    // queue lane / exit path that butts against it is flush, not a step
    const exitDoor: WayPt = { x: exitPos.x + Math.sin(exYaw) * dw[2], z: exitPos.z + Math.cos(exYaw) * dw[2], y: exitPos.y + HUT_APRON_Y };

    // ---- THE EXIT PATH: "construct a path FROM the ride exit" ---------------
    // The mirror of the queue lane. RCT2 puts a guest leaving a ride down on the
    // tile IMMEDIATELY OUTSIDE the exit (Guest.cpp:4412-4452 → :5092-5140) and,
    // finding no PathElement there, drops them onto the bare terrain via
    // `PeepState::falling` (Peep.cpp:781-890) — legal, but the ride is flagged
    // `STR_EXIT_NOT_CONNECTED` for as long as it is open (Ride.cpp:2076). So the
    // exit gets an ORDINARY footpath (grey, unfenced) cast out along its doorway
    // facing to the first street it meets; that street point — not a bare 1.5 u
    // step onto the grass — becomes the routing spur guests re-join the network
    // at. See access.ts `planExitLane`.
    const exitLaneStart: [number, number] = [exitPos.x + exDir[0] * EXIT_LANE_BACK, exitPos.z + exDir[1] * EXIT_LANE_BACK];
    const queueTail: [number, number] = [
      sc.queueAnchor[0] + dir[0] * (laneLen + 0.35),
      sc.queueAnchor[2] + dir[1] * (laneLen + 0.35),
    ];
    const exitPlan = planExitLane(exitLaneStart, exDir, net, s.coreNodeCount, EXIT_LANE_MAX, queueTail);
    let exitLaneG: THREE.Group | null = null;
    // the STREET level at the far end — the exit path ramps down (or up) to it
    // for the same reason the queue lane does: both runs are pinned at a ride
    // pad on one end and a solved street lattice on the other
    const exitEndY = exitPlan && net ? s.walkY(exitPlan.end[0], exitPlan.end[1]) : undefined;
    // …and the same datum/render distinction as the queue lane above. `plan.end`
    // IS the run's physical far end, so it is sampled directly.
    const exitEndRenderY = exitPlan && net ? s.surfY(exitPlan.end[0], exitPlan.end[1]) : undefined;
    if (exitPlan) {
      exitLaneG = buildExitLane(t, exitPlan, exitPos.y, cfg.exitSurface, s.groundAt, [0, 0, 0], exitEndRenderY, `${label} exit path`);
      accessG.add(exitLaneG);
      const exLaneRects = exitPlan.legs.map((leg, i) => exitLaneRect(leg, exitLaneLabels(label)[i]));
      // Audited like the queue lane. EXEMPT: the ride's own exit hut (the path
      // abuts its doorway apron by design, exactly as the entrance hut abuts the
      // head of its queue lane) and its own queue lane + entrance hut (the RCT2
      // pair stands one tile apart and the JOIN leg lands on the queue's own tail
      // — one ride's access rig, built by one function, not a collision).
      s.access.auditExitLane(label, exLaneRects, [`${label} exit hut`, `${label} queue lane`, `${label} entrance hut`]);
      s.access.allFootprints.push(...exLaneRects);
    }
    // `y` used to be a hardcoded 0 here — harmless only because every consumer
    // re-sampled it. Now that the run RAMPS, the end of it is a real height and
    // the guest stepping onto the street should be given it.
    const exitOut: WayPt = exitPlan
      ? { x: exitPlan.end[0], z: exitPlan.end[1], y: exitEndY ?? exitPos.y + 0.09 }
      : {
          x: exitPos.x + exDir[0] * 1.5,
          z: exitPos.z + exDir[1] * 1.5,
          y: net ? s.walkY(exitPos.x + exDir[0] * 1.5, exitPos.z + exDir[1] * 1.5) : exitPos.y,
        };
    // an L-shaped run needs its CORNER as a waypoint, or the leaving guest walks
    // the chord and cuts across the grass inside the bend. Its height is the
    // RAMP's at that distance along the run, not the hut's — the corner sits one
    // leg out from the doorway and is already partway down to the street.
    const exitCorner: WayPt | null =
      exitPlan && exitPlan.legs.length > 1
        ? {
            x: exitPlan.legs[1].from[0],
            z: exitPlan.legs[1].from[1],
            // both ends as WALKING SURFACES (the hut apron is exitPos.y + 0.09,
            // the same slab top the exit lane lays), so the corner lands ON the
            // ramp rather than a slab thickness under it
            y:
              exitPos.y +
              0.09 +
              ((exitEndY ?? exitPos.y + 0.09) - (exitPos.y + 0.09)) * (exitPlan.legs[0].len / Math.max(1e-6, exitPlan.len)),
          }
        : null;
    // net-less managers (previews, unit rigs) have no streets at all — there is
    // nothing to connect to and nothing to report
    if (!exitPlan && net)
      console.warn(
        `[GameManager] placeAccess(${label}): NO street lies on the exit hut's outward ray [${exDir
          .map((v) => +v.toFixed(2))
          .join(', ')}] within 9 u, so the ride has NO exit path — guests leaving it step onto bare ground. This is RCT2's STR_EXIT_NOT_CONNECTED ("${label} has no path leading from its exit! Construct a path from the ride exit", Ride.cpp:2076): put the exit on the station face the QUEUE comes off, one tile beside the entrance, so its path runs out beside the queue lane`,
      );

    // ---- routing spurs + blockers for THIS platform -------------------------
    const tailX = sc.queueAnchor[0] + dir[0] * (laneLen + 0.35);
    const tailZ = sc.queueAnchor[2] + dir[1] * (laneLen + 0.35);
    const queueAttach = routing ? s.access.safeAttach(`registerRide(${label}) queue tail`, tailX, tailZ) : null;
    const exitAttach = routing ? s.access.safeAttach(`registerRide(${label}) exit`, exitOut.x, exitOut.z) : null;
    if (queueAttach) s.blockers.spurNodes.add(queueAttach.node);
    if (exitAttach) s.blockers.spurNodes.add(exitAttach.node);
    // the ride BODY (its boarding pad) is solid — guests never walk to
    // boardPoint (the ride SEATS them). `owner` is the deadlock safety valve
    // for the ride's OWN sanctioned access walk.
    const padBlocker = s.blockers.registerBlocker({
      rect: { cx: sc.boardPoint[0], cz: sc.boardPoint[2], hx: 0.45, hz: 0.45, yaw: 0 },
      label: `${label} pad`,
      kind: 'ride',
      owner: cfg.name,
    });
    // the railings get NO owner: the whole queue walk (tail join, slot shuffle,
    // hut doorway, balking back out) runs down the lane CENTRE, a clear 0.12 u
    // inside both padded rails, so exempting them would only let a queue-bound
    // guest clip the railing end instead of walking round to the mouth.
    const laneBlockers = laneFenceRects(sc.queueAnchor, dir, laneLen).map((r, i) =>
      s.blockers.registerBlocker({ rect: r, label: `${label} queue railing ${i}`, kind: 'queue', height: 0.5 }),
    );
    return {
      dir,
      laneLen,
      maxSlots: Math.max(2, Math.floor((laneLen - 0.45) / SPACING)),
      laneY,
      laneTailY,
      doorway,
      hutIn,
      exitPos,
      exitYaw: exYaw,
      exitDir: exDir,
      exitShift: placed.shift,
      exitDoor,
      exitOut,
      exitCorner,
      queueAttach,
      exitAttach,
      accessG,
      exitG: exit,
      laneG,
      exitLaneG,
      exitLaneLen: exitPlan ? exitPlan.len : 0,
      padBlocker,
      laneBlockers,
    };
  };

  const registerRide = (cfg: RideConfig) => {
    // STATION 0 — the ride's own fields, built by exactly the code above
    const rig0 = buildStationRig(cfg, cfg, cfg.name);
    const rec: RideRec = {
      cfg,
      idx: rides.length,
      state: 'movingToEndOfStation',
      timer: 0.5,
      queue: [],
      entering: [],
      riders: [],
      maxSlots: rig0.maxSlots,
      laneY: rig0.laneY,
      laneTailY: rig0.laneTailY,
      dir: rig0.dir,
      doorway: rig0.doorway,
      hutIn: rig0.hutIn,
      exitPos: rig0.exitPos,
      exitYaw: rig0.exitYaw,
      exitDir: rig0.exitDir,
      exitShift: rig0.exitShift,
      exitDoor: rig0.exitDoor,
      exitOut: rig0.exitOut,
      exitCorner: rig0.exitCorner,
      queueAttach: rig0.queueAttach,
      exitAttach: rig0.exitAttach,
      accessG: rig0.accessG,
      exitG: rig0.exitG,
      laneG: rig0.laneG,
      exitLaneG: rig0.exitLaneG,
      exitLaneLen: rig0.exitLaneLen,
      laneLen: rig0.laneLen,
      intensity: Math.max(1, Math.min(10, cfg.intensity ?? 4)),
      price: cfg.price ?? 0,
      minWait: cfg.minWait ?? T(32 * 10),
      maxWait: cfg.maxWait ?? T(32 * 60),
      // the boarding-quiet window is in REAL seconds (it times a WALK — see
      // BOARD_QUIET_SECS), which is why it is not wrapped in T() like its two
      // neighbours above
      quietWait: Math.max(0, cfg.quietWait ?? BOARD_QUIET_SECS),
      boardedSeen: 0,
      boardAt: -1,
      lastBoardAt: -1,
      total: 0,
      laneBlockers: rig0.laneBlockers,
      padBlocker: rig0.padBlocker,
      stations: [],
      atStation: 0,
      transfers: 0,
    };
    // NO RIDE CAN BREAK DOWN. `breakdownEvery` is the one knob that used to buy
    // a breakdown, so a park still passing it is told, once, that it now buys
    // nothing — silently honouring it would contradict the rule, and silently
    // dropping it would leave an author wondering why their ride never stops.
    // (DELIBERATE DIVERGENCE FROM RCT2 — see RideConfig.breakdownEvery.)
    if (cfg.breakdownEvery !== undefined)
      console.warn(
        `[GameManager] registerRide(${cfg.name}): breakdownEvery=${cfg.breakdownEvery} is IGNORED — no ride in this design system can break down. ` +
          'Remove the field; a crash (cfg.vehicleHandle.crashed()) is the only way a ride stops serving guests.',
      );
    // stations[0] is a VIEW over the ride's own fields (same objects, delegated
    // by accessor) — a one-station ride is byte-identical to what it was, and
    // every existing consumer of rec.queue / rec.dir / rec.exitPos still sees
    // the platform the FSM is working with.
    const view: Record<string, PropertyDescriptor> = {};
    (
      [
        'dir', 'laneLen', 'maxSlots', 'laneY', 'laneTailY', 'queue', 'entering', 'doorway', 'hutIn',
        'exitPos', 'exitYaw', 'exitDir', 'exitDoor', 'exitOut', 'exitCorner',
        'queueAttach', 'exitAttach', 'accessG', 'exitG', 'laneG', 'exitLaneG',
        'exitLaneLen', 'laneBlockers',
      ] as const
    ).forEach((k) => {
      view[k] = {
        enumerable: true,
        get: () => (rec as unknown as Record<string, unknown>)[k],
        set: (v: unknown) => {
          (rec as unknown as Record<string, unknown>)[k] = v;
        },
      };
    });
    view.anchor = { enumerable: true, get: () => rec.cfg.queueAnchor };
    view.boardPoint = { enumerable: true, get: () => rec.cfg.boardPoint };
    const station0 = Object.defineProperties({ ride: rec, idx: 0, label: cfg.name }, view) as unknown as RideStationRec;
    rec.stations.push(station0);
    // EXTRA PLATFORMS — same rig, own everything
    (cfg.stations ?? []).forEach((sc, i) => {
      const label = sc.label ? `${cfg.name} · ${sc.label}` : `${cfg.name} station ${i + 1}`;
      const rig = buildStationRig(cfg, sc, label);
      rec.stations.push({
        ride: rec,
        idx: i + 1,
        label,
        anchor: sc.queueAnchor,
        boardPoint: sc.boardPoint,
        queue: [],
        entering: [],
        ...rig,
      } as unknown as RideStationRec);
    });
    // every platform's queue tail is a place a guest can join THIS ride
    if (routing)
      for (const st of rec.stations) {
        if (!st.queueAttach) continue;
        rideAt.set(st.queueAttach.node, rec);
        s.stationAt.set(st.queueAttach.node, st);
      }
    rides.push(rec);
    return {
      name: cfg.name,
      state: () => rec.state,
      /** guests queuing across ALL platforms (station 0 only on an ordinary ride) */
      queueLength: () => rec.stations.reduce((n, st) => n + st.queue.length, 0),
      occupancy: () => s.rideFsm.occupancyOf(rec),
      /** resolved exit hut centre — reflects any placement-audit shift */
      exitPoint: () => [rec.exitPos.x, rec.exitPos.y, rec.exitPos.z] as [number, number, number],
      exitShift: rig0.exitShift,
      // ---- ADDITIVE: MULTI-STATION (RCT2 Ride::GetStations(), Ride.h) --------
      /** how many platforms this ride has (1 for every ordinary ride) */
      stationCount: () => rec.stations.length,
      /** the platform the train is at right now (RCT2 `current_station`) */
      currentStation: () => rec.atStation,
      /** completed TRANSFERS: guests who boarded at one platform and got off at
       *  a DIFFERENT one. 0 on a one-station ride, by definition. */
      transfers: () => rec.transfers,
      /** per-platform snapshot — the shape validatePark / the probe gate on:
       *  every station needs its own street-attached queue AND its own exit
       *  path (`exitLaneLen > 0`), exactly like any single-station ride. */
      stations: () =>
        rec.stations.map((st) => ({
          idx: st.idx,
          label: st.label,
          boardPoint: [st.boardPoint[0], st.boardPoint[1], st.boardPoint[2]] as [number, number, number],
          queueAnchor: [st.anchor[0], st.anchor[1], st.anchor[2]] as [number, number, number],
          queueDir: [st.dir[0], st.dir[1]] as [number, number],
          queueLength: st.queue.length,
          queueNode: st.queueAttach?.node ?? -1,
          exitAt: [st.exitPos.x, st.exitPos.y, st.exitPos.z] as [number, number, number],
          exitDir: [st.exitDir[0], st.exitDir[1]] as [number, number],
          exitNode: st.exitAttach?.node ?? -1,
          exitLaneLen: st.exitLaneLen,
        })),
      /** ADDITIVE: the RCT2 exit PATH — the ordinary footpath from the exit hut
       *  out to the street. `len: 0` is RCT2's STR_EXIT_NOT_CONNECTED state
       *  (Ride.cpp:2076): the exit faces no paving and leaving guests step onto
       *  bare ground. `end` is where the run meets the street. */
      exitLane: () => ({
        len: rec.exitLaneLen,
        dir: [rec.exitDir[0], rec.exitDir[1]] as [number, number],
        end: [rec.exitOut.x, rec.exitOut.z] as [number, number],
      }),
      // ---- additive accessors (UI window suite) ----
      /** RCT2 status line — `'closed'` for a crashed ride, else `'open'`.
       *  It can NEVER return `'brokenDown'` / `'beingRepaired'`: no ride in
       *  this design system breaks down (access.ts `statusOf`). A caller
       *  branching on those two arms is writing dead code. */
      status: () => s.access.statusOf(rec),
      /** riders served over the ride's lifetime */
      totalRides: () => rec.total,
      /** the vehicle/seat anchor — camera targets aim here */
      boardPoint: () => [cfg.boardPoint[0], cfg.boardPoint[1], cfg.boardPoint[2]] as [number, number, number],
      /** ADDITIVE: the live per-seat transform (harness probes assert riders
       *  sit in DISTINCT seats) — null when the ride has no seatWorld */
      seatAt: (k: number) => (cfg.seatWorld ? cfg.seatWorld(k) : null),
      /** ADDITIVE: the registered RCT2 rating triple (SplineRideKit's
       *  `rateCoaster`) — null when the caller registered none. Informational
       *  only; the sim gates guests on `intensity()` as before. */
      ratings: () => cfg.ratings ?? null,
      /** ADDITIVE: the sim's guest-gating intensity (1–10) */
      intensity: () => rec.intensity,
    };
  };

  // ---- stall registration: logic-only attach point in front of the shop -----
  const registerStall = (cfg: StallConfig) => {
    const m = Math.hypot(cfg.dir[0], cfg.dir[1]) || 1;
    const front: WayPt = { x: cfg.anchor[0] + (cfg.dir[0] / m) * 0.72, z: cfg.anchor[2] + (cfg.dir[1] / m) * 0.72, y: cfg.anchor[1] };
    const rec: StallRec = { cfg, front, attach: s.access.safeAttach(`registerStall(${cfg.name}) front`, front.x, front.z), sold: 0, blocker: null };
    if (rec.attach) {
      stallAt.set(rec.attach.node, rec);
      s.blockers.spurNodes.add(rec.attach.node);
    }
    // the shop BODY is solid — the counter half only reaches 0.42 out, so the
    // serving front (0.72 out) and its approach stay walkable
    rec.blocker = s.blockers.registerBlocker({
      rect: { cx: cfg.anchor[0], cz: cfg.anchor[2], hx: 0.6, hz: 0.42, yaw: Math.atan2(cfg.dir[0] / m, cfg.dir[1] / m) },
      label: `${cfg.name} body`,
      kind: 'stall',
      owner: cfg.name,
    });
    stalls.push(rec);
    return { name: cfg.name, sold: () => rec.sold };
  };

  const registerBin = (x: number, z: number) => {
    const b: BinRec = { x, z, count: 0 };
    bins.push(b);
    return { count: () => b.count };
  };

  // ---- restroom registration: LOGIC only — the buildRestroom hut mesh is the
  // caller's job. Accepts the placed hut's transform ({ anchor, yaw }: doorway
  // = anchor + rotY(yaw)·[0, 0, 0.72], the buildRestroom contract) or a WORLD
  // `doorway` point directly. Attaches a routing spur at the doorway.
  const registerRestroom = (cfg: { anchor?: [number, number, number]; yaw?: number; doorway?: [number, number, number]; owner?: string }) => {
    let dw: WayPt;
    if (cfg.doorway) {
      dw = { x: cfg.doorway[0], y: cfg.doorway[1] + 0.08, z: cfg.doorway[2] }; // apron top
    } else {
      const [ax, ay, az] = cfg.anchor!;
      const yaw = cfg.yaw ?? 0;
      dw = { x: ax + Math.sin(yaw) * 0.72, y: ay + 0.08, z: az + Math.cos(yaw) * 0.72 };
    }
    const rec: RestroomRec = {
      doorway: dw,
      attach: s.access.safeAttach('registerRestroom doorway', dw.x, dw.z),
      uses: 0,
      owner: cfg.owner ?? null,
    };
    if (rec.attach) {
      restroomAt.set(rec.attach.node, rec);
      s.blockers.spurNodes.add(rec.attach.node);
    }
    restrooms.push(rec);
    return { uses: () => rec.uses };
  };

  // ---- attention zones ------------------------------------------------------
  // THE COOLDOWN DEFAULTS, and why they are what they are.
  //
  // A zone with no cooldown is a TRAP, and it was measured: the latch fires at
  // ~0.35/s on any guest standing inside the rectangle, so a guest whose dwell
  // expires while still inside simply re-latches. Escaping a ~2.3 u zone at the
  // ~0.55 u/s guest walk speed takes ~4 s, i.e. ~5 expected re-latches before
  // they get out. On a dance floor that reads as a party; on a prop beside a
  // street it is a permanent stop — MagicMirror's behaviour park pinned one
  // guest for 44.5 s of a 70 s run, left 3 of 6 guests never resuming, and
  // failed validatePark's `sim` gate ("stood still >25 sim-s while walking").
  //
  // 30 s for BOTH modes:
  //   * it has to exceed the time to WALK CLEAR of the rectangle or the guest
  //     re-latches before escaping. Even a 5 u floor at the slowest (tired,
  //     hungry) walk speed is under ~12 s, so 30 s clears it with margin;
  //   * the bar is per guest AND per zone, so a crowd is unaffected — the next
  //     guest along still stops. A DanceFloor with a normal crowd still shows
  //     dancers continuously; it is only the SAME guest who cannot re-latch;
  //   * it bounds one guest's stop at their single dwell (≤30 s dance, ≤10 s
  //     watch) instead of the unbounded chain measured above, and 30 s is long
  //     enough that a guest doing laps of a plaza ring does not stop at the same
  //     prop every lap.
  const DANCE_COOLDOWN = 30;
  const WATCH_COOLDOWN = 30;

  const makeZone = (mode: 'dance' | 'watch', cfg: AttentionZoneConfig): DanceZoneRec => {
    const rot = cfg.rotation ?? 0;
    const dance = mode === 'dance';
    const [lo, hi] = cfg.linger ?? (dance ? [10, 30] : [4, 10]);
    const zone: DanceZoneRec = {
      cx: cfg.center[0],
      cz: cfg.center[1],
      halfW: cfg.halfW,
      halfD: cfg.halfD,
      cos: Math.cos(rot),
      sin: Math.sin(rot),
      mode,
      faceAt: cfg.faceAt ?? null,
      minLinger: Math.max(0, Math.min(lo, hi)),
      maxLinger: Math.max(lo, hi),
      cooldown: Math.max(0, cfg.cooldown ?? (dance ? DANCE_COOLDOWN : WATCH_COOLDOWN)),
      // dance keeps the original gate EXACTLY (happiness ≥ 160, energy > 128);
      // a watch zone gates on nothing — anybody may look at a thing
      minHappiness: cfg.gate?.happiness ?? (dance ? 160 : 0),
      minEnergy: cfg.gate?.energy ?? (dance ? 129 : 0),
      ready: new Map(),
    };
    danceZones.push(zone);
    return zone;
  };

  /** the count accessor both zone kinds return (guests latched INSIDE it) */
  const zoneCount = (zone: DanceZoneRec) =>
    guests.filter(
      (g) =>
        !g.gone &&
        !g.hidden &&
        (zone.mode === 'dance' ? g.action?.kind === 'dance' : g.state === 'watching') &&
        inDanceZone(zone, g.x, g.z),
    ).length;

  /** DANCE zone (the original API — `center`/`halfW`/`halfD`/`rotation` alone
   *  behaves exactly as before apart from the per-guest cooldown above) */
  const registerDanceZone = (cfg: AttentionZoneConfig) => {
    const zone = makeZone('dance', cfg);
    return {
      /** guests currently dancing inside this zone */
      dancers: () => zoneCount(zone),
      /** ADDITIVE: bar this zone from latching a guest again for `cooldown` s */
      cooldown: () => zone.cooldown,
    };
  };

  /** WATCH zone — the sibling of the dance zone for scenery a guest should stop
   *  and LOOK at (a mirror, a fountain, a piano). Same rectangle, but the guest
   *  enters PeepState::Watching, faces `faceAt`, and dwells a hashed 4-10 s. */
  const registerWatchZone = (cfg: WatchZoneConfig) => {
    const zone = makeZone('watch', cfg);
    return {
      /** guests currently standing and watching inside this zone */
      watchers: () => zoneCount(zone),
      /** the resolved per-guest re-latch bar in seconds */
      cooldown: () => zone.cooldown,
    };
  };

  const nearestRestroom = (g: SimGuest): RestroomRec | null => {
    let best: RestroomRec | null = null;
    let bestD = Infinity;
    for (const rr of restrooms) {
      const d = (rr.doorway.x - g.x) ** 2 + (rr.doorway.z - g.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = rr;
      }
    }
    return best;
  };

  const restroomReachable = (g: SimGuest): boolean => {
    for (const rr of restrooms) {
      if (!routing) return true; // direct-walk fallback can always get there
      if (!rr.attach) continue;
      if (g.fromNode === rr.attach.node || routing.route(g.fromNode, rr.attach.node).length >= 2) return true;
    }
    return false;
  };

  // ---- park entrance: the SOLE spawn/despawn point once registered ----------
  // Accepts a buildParkEntrance return (LOCAL spawnPoint/archway, +z outside)
  // plus the transform the CALLER placed the group at — { position, yaw } opts,
  // or read straight off pe.group when omitted. Stores WORLD points, attaches
  // the archway to the routing net and returns the resolved world points.
  const registerParkEntrance = (
    pe: { group?: THREE.Group; spawnPoint: [number, number, number]; archway: [number, number, number] },
    o: { yaw?: number; position?: [number, number, number] } = {},
  ) => {
    const yaw = o.yaw ?? pe.group?.rotation.y ?? 0;
    const p0: [number, number, number] = o.position ?? (pe.group ? [pe.group.position.x, pe.group.position.y, pe.group.position.z] : [0, 0, 0]);
    const tf = (l: [number, number, number]): WayPt => ({
      x: p0[0] + Math.cos(yaw) * l[0] + Math.sin(yaw) * l[2],
      y: p0[1] + l[1],
      z: p0[2] - Math.sin(yaw) * l[0] + Math.cos(yaw) * l[2],
    });
    const spawn = tf(pe.spawnPoint);
    const arch = tf(pe.archway);
    s.parkEntrance = { spawn, arch, attach: s.access.safeAttach('registerParkEntrance archway', arch.x, arch.z) };
    s.spawnPt = { x: spawn.x, z: spawn.z };
    if (s.parkEntrance.attach) s.blockers.spurNodes.add(s.parkEntrance.attach.node);
    if (s.parkEntrance.attach) s.spawnNode = s.parkEntrance.attach.node;
    else if (routing) s.spawnNode = routing.nearestNode(arch.x, arch.z);
    return {
      spawnPoint: [spawn.x, spawn.y, spawn.z] as [number, number, number],
      archway: [arch.x, arch.y, arch.z] as [number, number, number],
    };
  };

  return {
    registerRide,
    registerStall,
    registerBin,
    registerRestroom,
    registerDanceZone,
    registerWatchZone,
    registerParkEntrance,
    nearestRestroom,
    restroomReachable,
  };
}
