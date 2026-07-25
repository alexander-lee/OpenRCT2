// ---------------------------------------------------------------------------
// REGISTRATION — everything a park declares to the sim: rides (queue lane +
// entrance/exit huts + placement audit + routing spurs + auto blockers),
// stalls, litter bins, restrooms, dance zones and the park entrance (the sole
// spawn/despawn point).
//
// Each register* returns the small live HANDLE the composition layer holds on
// to; those handles are part of the PUBLIC API of '../GameManager' and their
// shapes are unchanged. Implementation detail of createGameManager.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { buildRideEntrance, ENTRANCE_DOORWAY } from '../RideEntrance';
import { T, SPACING } from './types';
import type { RideConfig, StallConfig, RideRec, StallRec, BinRec, RestroomRec, SimGuest, WayPt } from './types';
import { buildQueueLane, laneFenceRects, hutRect, breakIntervalOf } from './access';
import type { FootRect } from './access';
import type { Sim } from './sim';

// ---- dance-zone registration: LOGIC only — the DanceFloor rig mesh is the
// caller's job (<DanceFloor register> composes this). Wandering guests whose
// stroll crosses the zone (happy + energetic enough) stop and dance on the
// shared 2.2 Hz beat for a hashed 10-30 s (the pose 'dance' path below).
export interface DanceZoneRec {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  cos: number;
  sin: number;
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
  const { t, group, routing, rides, stalls, bins, guests, rideAt, stallAt, restrooms, restroomAt, danceZones } = s;

  // ---- ride registration: lane + huts + placement audit + routing attach ----
  const registerRide = (cfg: RideConfig) => {
    const m = Math.hypot(cfg.queueDir[0], cfg.queueDir[1]) || 1;
    const dir: [number, number] = [cfg.queueDir[0] / m, cfg.queueDir[1] / m];
    const laneLen = Math.max(1.2, cfg.laneLen ?? Math.max(2.2, 0.6 + cfg.capacity * 2 * SPACING + 0.5));
    // the ride's access rig (lane + huts) lives in ONE subgroup so the
    // corridor auto-resolver can translate it in lockstep with the sim state
    const accessG = new t.Group();
    group.add(accessG);
    const laneG = buildQueueLane(t, cfg.queueAnchor, dir, laneLen);
    accessG.add(laneG);

    // Queue-head audit (verified arithmetic): the lane extends anchor -> +dir
    // with slot i at anchor + (0.45 + i·SPACING)·dir, so slot 0 (the HEAD) is
    // the anchor end — the RIDE side. The entrance hut + sign stand just
    // BEYOND the head at anchor − 0.62·dir facing +dir, putting its doorway
    // (local +z, 0.66) at anchor + 0.04·dir, directly in front of slot 0.
    // Guests join from past the TAIL (anchor + (laneLen + 0.35)·dir spur),
    // file toward slot 0 and enter through the doorway. Not reversed.
    const entYaw = Math.atan2(dir[0], dir[1]);
    const ent = cfg.entrance ?? buildRideEntrance(t, { kind: 'entrance' }).group;
    const ex0 = cfg.queueAnchor[0] - dir[0] * 0.62;
    const ez0 = cfg.queueAnchor[2] - dir[1] * 0.62;
    ent.position.set(ex0, cfg.queueAnchor[1], ez0);
    ent.rotation.y = entYaw;
    accessG.add(ent);
    const dw = ENTRANCE_DOORWAY;
    const doorway: WayPt = { x: ex0 + Math.sin(entYaw) * dw[2], z: ez0 + Math.cos(entYaw) * dw[2], y: cfg.queueAnchor[1] + 0.09 };
    // hut INTERIOR — the boarding walk ends here (RCT2 'inEntrance'): the
    // guest steps through the front doorway INTO the hut and vanishes; the
    // ride then seats them at boardPoint. They never walk onto the ride.
    const hutIn: WayPt = { x: ex0, z: ez0, y: cfg.queueAnchor[1] + 0.09 };

    const odx = cfg.exitPoint[0] - cfg.boardPoint[0];
    const odz = cfg.exitPoint[2] - cfg.boardPoint[2];
    const om = Math.hypot(odx, odz) || 1;
    const exYaw = Math.atan2(odx / om, odz / om);
    // ---- placement audit: entrance hut / exit hut / queue lane / board pad --
    const entRect = hutRect(ex0, ez0, entYaw, `${cfg.name} entrance hut`);
    const laneRect: FootRect = {
      cx: cfg.queueAnchor[0] + dir[0] * (laneLen / 2),
      cz: cfg.queueAnchor[2] + dir[1] * (laneLen / 2),
      hx: 0.36, // 0.55 lane + railings
      hz: laneLen / 2,
      yaw: entYaw,
      label: `${cfg.name} queue lane`,
    };
    const padRect: FootRect = { cx: cfg.boardPoint[0], cz: cfg.boardPoint[2], hx: 0.45, hz: 0.45, yaw: 0, label: `${cfg.name} boardPoint pad` };
    const placed = s.access.placeAccess(cfg.name, entRect, laneRect, padRect, [cfg.exitPoint[0], cfg.exitPoint[2]], exYaw);
    const exitPos: WayPt = { x: placed.exit[0], z: placed.exit[1], y: cfg.exitPoint[1] };
    s.access.allFootprints.push(entRect, laneRect, padRect, hutRect(exitPos.x, exitPos.z, exYaw, `${cfg.name} exit hut`));

    const exit = buildRideEntrance(t, { kind: 'exit' }).group;
    exit.position.set(exitPos.x, exitPos.y, exitPos.z);
    exit.rotation.y = exYaw;
    accessG.add(exit);
    const exitDoor: WayPt = { x: exitPos.x + Math.sin(exYaw) * dw[2], z: exitPos.z + Math.cos(exYaw) * dw[2], y: exitPos.y + 0.08 };
    const exitOut: WayPt = { x: exitPos.x + Math.sin(exYaw) * 1.5, z: exitPos.z + Math.cos(exYaw) * 1.5, y: 0 };

    const rec: RideRec = {
      cfg,
      idx: rides.length,
      state: 'movingToEndOfStation',
      timer: 0.5,
      queue: [],
      entering: [],
      riders: [],
      maxSlots: Math.max(2, Math.floor((laneLen - 0.45) / SPACING)),
      laneY: cfg.queueAnchor[1] + 0.09,
      dir,
      doorway,
      hutIn,
      exitPos,
      exitYaw: exYaw,
      exitShift: placed.shift,
      exitDoor,
      exitOut,
      queueAttach: null,
      exitAttach: null,
      accessG,
      exitG: exit,
      laneG,
      laneLen,
      intensity: Math.max(1, Math.min(10, cfg.intensity ?? 4)),
      price: cfg.price ?? 0,
      minWait: cfg.minWait ?? T(32 * 10),
      maxWait: cfg.maxWait ?? T(32 * 60),
      total: 0,
      brokenAt: -1,
      breakN: 0,
      nextBreak: 0, // resolved below once the rec exists (hashed reliability)
      laneBlockers: [],
      padBlocker: null,
    };
    rec.nextBreak = s.simTime + breakIntervalOf(rec);
    if (routing) {
      // logical spur nodes so guests can SEEK the queue tail / leave the exit
      const tailX = cfg.queueAnchor[0] + dir[0] * (laneLen + 0.35);
      const tailZ = cfg.queueAnchor[2] + dir[1] * (laneLen + 0.35);
      rec.queueAttach = s.access.safeAttach(`registerRide(${cfg.name}) queue tail`, tailX, tailZ);
      rec.exitAttach = s.access.safeAttach(`registerRide(${cfg.name}) exit`, exitOut.x, exitOut.z);
      if (rec.queueAttach) {
        rideAt.set(rec.queueAttach.node, rec);
        s.blockers.spurNodes.add(rec.queueAttach.node);
      }
      if (rec.exitAttach) s.blockers.spurNodes.add(rec.exitAttach.node);
    }
    // ---- auto-registered BLOCKERS: the ride BODY (its boarding pad) and the
    // queue lane's two fence railings. Guests never walk to boardPoint (the
    // ride SEATS them), so the pad is solid; the lane is only enterable at its
    // open tail. Both carry the ride's name as `owner`, a deadlock safety valve
    // for the ride's OWN sanctioned access walk.
    rec.padBlocker = s.blockers.registerBlocker({
      rect: { cx: cfg.boardPoint[0], cz: cfg.boardPoint[2], hx: 0.45, hz: 0.45, yaw: 0 },
      label: `${cfg.name} pad`,
      kind: 'ride',
      owner: cfg.name,
    });
    // the railings get NO owner: the whole queue walk (tail join, slot shuffle,
    // hut doorway, balking back out) runs down the lane CENTRE, a clear 0.12 u
    // inside both padded rails, so exempting them would only let a queue-bound
    // guest clip the railing end instead of walking round to the mouth.
    rec.laneBlockers = laneFenceRects(cfg.queueAnchor, dir, laneLen).map((r, i) =>
      s.blockers.registerBlocker({ rect: r, label: `${cfg.name} queue railing ${i}`, kind: 'queue', height: 0.5 }),
    );
    rides.push(rec);
    return {
      name: cfg.name,
      state: () => rec.state,
      queueLength: () => rec.queue.length,
      occupancy: () => s.rideFsm.occupancyOf(rec),
      /** resolved exit hut centre — reflects any placement-audit shift */
      exitPoint: () => [rec.exitPos.x, rec.exitPos.y, rec.exitPos.z] as [number, number, number],
      exitShift: placed.shift,
      // ---- additive accessors (UI window suite) ----
      /** RCT2 status line: open / closed / brokenDown / beingRepaired */
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

  const registerDanceZone = (cfg: { center: [number, number]; halfW: number; halfD: number; rotation?: number }) => {
    const rot = cfg.rotation ?? 0;
    const zone: DanceZoneRec = { cx: cfg.center[0], cz: cfg.center[1], halfW: cfg.halfW, halfD: cfg.halfD, cos: Math.cos(rot), sin: Math.sin(rot) };
    danceZones.push(zone);
    return {
      /** guests currently dancing inside this zone */
      dancers: () => guests.filter((g) => !g.gone && !g.hidden && g.action?.kind === 'dance' && inDanceZone(zone, g.x, g.z)).length,
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
    registerParkEntrance,
    nearestRestroom,
    restroomReachable,
  };
}
