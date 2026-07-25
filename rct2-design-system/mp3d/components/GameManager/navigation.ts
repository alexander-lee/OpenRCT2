// ---------------------------------------------------------------------------
// NAVIGATION — the path-network walk (edge traversal, junction memory, goal
// routing and wandering), everything a guest DECIDES on arriving at a node
// (queue joins, shop impulses, restroom seeking, sit/watch/balloon whims,
// litter blight), and the minimal direct-walk fallback used when no path net
// was handed to the manager.
//
// Route choice is `buildRouting`'s (GuestPathfinding.cpp-style junction
// memory); every impulse is a hashed per-guest draw. Implementation detail of
// createGameManager.
// ---------------------------------------------------------------------------

import { clamp255, TOILET_SEEK, LAST_RIDE_TIMEOUT } from './types';
import type { SimGuest, RideRec, StallRec } from './types';
import type { Sim } from './sim';

export function createNavigation(s: Sim) {
  const { routing, walkY, groundAt, nodeXZ, rides, stalls, restrooms, rideAt, stallAt, restroomAt } = s;

  // ---- network locomotion -------------------------------------------------------
  const chooseNext = (g: SimGuest, prev: number) => {
    if (!routing) return;
    if (g.path.length) {
      g.toNode = g.path.shift()!;
      return;
    }
    if (g.goal) {
      const p = routing.route(g.fromNode, g.goal.node, g.junctionMemory);
      if (p.length >= 2) {
        g.path = p.slice(1);
        g.toNode = g.path.shift()!;
        return;
      }
      g.goal = null; // unreachable — give up
    }
    g.toNode = routing.wanderNext(prev, g.fromNode, g.idx * 131.7 + g.decN * 23.9);
    g.decN += 1;
  };

  const arriveAtNode = (g: SimGuest) => {
    const prev = g.fromNode;
    const n = g.toNode;
    g.fromNode = n;
    g.toNode = -1;
    g.u = 0;
    const [nx, nz] = nodeXZ(n);
    g.x = nx;
    g.z = nz;
    // junction memory: last 4 thin junctions (GuestPathfinding.cpp:628,1300)
    if (routing!.adjacency[n].length >= 3 && g.junctionMemory[g.junctionMemory.length - 1] !== n) {
      g.junctionMemory.push(n);
      if (g.junctionMemory.length > 4) g.junctionMemory.shift();
    }
    // litter: 6% hashed chance per edge traversed while holding a container —
    // plays the visible arm fling; the scraps arc from the hand (startThrow)
    if (g.holding === 'container' && s.fx.draw(g, 11) < 0.06) s.fx.startThrow(g);
    // litter blight: >= 3 pieces within 1.2 u -> happiness target −17
    if (s.simTime - g.litterUpsetT > 12) {
      let near = 0;
      for (const L of s.fx.litter) if (Math.hypot(L.x - g.x, L.z - g.z) < 1.2) near += 1;
      for (const P of s.fx.poops) if (Math.hypot(P.x - g.x, P.z - g.z) < 1.2) near += 2; // poop counts double
      for (const V of s.fx.vomits) if (Math.hypot(V.x - g.x, V.z - g.z) < 1.2) near += 2; // so does sick
      if (near >= 3) {
        g.happinessTarget = clamp255(g.happinessTarget - 17);
        s.fx.pushThought(g, 'badLitter');
        g.litterUpsetT = s.simTime;
      }
    }
    // arrivals at goal / points of interest
    if (g.state === 'leavingPark') {
      if (n === s.spawnNode) {
        if (s.parkEntrance) {
          // through the archway (the attach node sits under the arch) and out
          // to the gate's spawnPoint, where the guest despawns
          g.waypoints = [{ x: s.parkEntrance.spawn.x, z: s.parkEntrance.spawn.z, y: s.parkEntrance.spawn.y }];
          g.netReentry = null;
          g.despawnAtWpEnd = true;
        } else {
          s.needs.despawn(g);
        }
        return;
      }
      chooseNext(g, prev);
      return;
    }
    const restroomHere = restroomAt.get(n);
    if (restroomHere && (g.goal?.restroom === restroomHere || (!g.goal && g.toilet >= TOILET_SEEK))) {
      g.state = 'usingRestroom';
      g.restroom = restroomHere;
      g.goal = null;
      g.path = [];
      g.timer = -1; // armed when the doorway walk completes
      g.waypoints = [{ ...restroomHere.doorway }];
      g.netReentry = null;
      return;
    }
    const rideHere = rideAt.get(n);
    if (rideHere && (g.goal?.ride === rideHere || (!g.goal && s.fx.draw(g, 14) < 0.5))) {
      // guests DECIDE at the ride entrance (Guest.cpp:5774)
      if (s.needs.tryJoinQueue(g, rideHere)) return;
      chooseNext(g, prev);
      return;
    }
    const stallHere = stallAt.get(n);
    // passing impulse: consumables when peckish; accessories are a joy buy —
    // guests with a balloon already rarely step up again, and a guest whose
    // hands are BOTH full still occasionally tries (and is refused with the
    // visible "my hands are full" thought at the counter)
    const stallImpulse = (st: StallRec): boolean => {
      if (st.cfg.item === 'food') return g.hunger < 90 && s.fx.draw(g, 15) < 0.35;
      if (st.cfg.item === 'drink') return g.thirst < 90 && s.fx.draw(g, 15) < 0.35;
      return s.fx.draw(g, 15) < (g.balloons.left || g.balloons.right ? 0.06 : 0.3); // accessory (repeat joy buys are rare)
    };
    if (stallHere && (g.goal?.stall === stallHere || (!g.goal && stallImpulse(stallHere)))) {
      s.needs.startBuying(g, stallHere);
      g.netReentry = null;
      return;
    }
    if (g.goal && n === g.goal.node) g.goal = null; // reached a stale goal node
    // pressing need first: seek the nearest restroom once toilet ≥ 200
    if (!g.goal && g.toilet >= TOILET_SEEK && restrooms.length) {
      const rr = s.registry.nearestRestroom(g);
      if (rr && rr.attach) g.goal = { kind: 'restroom', node: rr.attach.node, restroom: rr };
    }
    // decisions when aimless
    if (!g.goal) {
      if (g.hunger <= 10 && stalls.some((st) => st.cfg.item === 'food')) {
        const st = s.needs.nearestStall(g, 'food');
        if (st && st.attach) g.goal = { kind: 'stall', node: st.attach.node, stall: st };
      } else if (g.thirst <= 25 && stalls.some((st) => st.cfg.item === 'drink')) {
        const st = s.needs.nearestStall(g, 'drink');
        if (st && st.attach) g.goal = { kind: 'stall', node: st.attach.node, stall: st };
      } else {
        const p = s.fx.draw(g, 16);
        if (p < 0.1 && rides.length) {
          // head for a ride's queue (full checks happen at the entrance)
          const r = rides[Math.floor(s.fx.draw(g, 17) * rides.length) % rides.length];
          if (r.state !== 'crashed' && r.brokenAt < 0 && r.queueAttach && !(g.lastRide === r && s.simTime - g.lastRideT < LAST_RIDE_TIMEOUT)) {
            g.goal = { kind: 'ride', node: r.queueAttach.node, ride: r };
          }
        } else if (p < 0.16) {
          g.state = 'sitting'; // rest stop (RCT2 PeepState::Sitting)
          g.timer = 3 + s.fx.draw(g, 18) * 3;
          return;
        } else if (p < 0.24) {
          // watch a nearby ride (RCT2 PeepState::Watching)
          let watch: RideRec | null = null;
          for (const r of rides) if (Math.hypot(r.cfg.boardPoint[0] - g.x, r.cfg.boardPoint[2] - g.z) < 5) watch = r;
          if (watch) {
            g.state = 'watching';
            g.timer = 2.5 + s.fx.draw(g, 19) * 2;
            g.yaw = Math.atan2(watch.cfg.boardPoint[0] - g.x, watch.cfg.boardPoint[2] - g.z);
            return;
          }
        } else if (p < 0.3 && !g.balloons.left && !g.balloons.right) {
          // fancy a balloon: seek the nearest accessory stall (joy buy)
          const st = s.needs.nearestStall(g, 'balloon');
          if (st && st.attach) g.goal = { kind: 'stall', node: st.attach.node, stall: st };
        }
      }
    }
    chooseNext(g, prev);
  };

  const netStep = (g: SimGuest, dt: number) => {
    if (g.waypoints.length) {
      if (s.loco.followWaypoints(g, dt)) {
        if (g.netReentry != null) {
          g.fromNode = g.netReentry;
          g.netReentry = null;
          g.toNode = -1;
          g.u = 0;
        } else if (g.despawnAtWpEnd) {
          s.needs.despawn(g); // stepped out through the park gate
        }
      }
      return;
    }
    if (g.toNode < 0) {
      chooseNext(g, g.fromNode);
      if (g.toNode < 0) return;
    }
    const [ax, az] = nodeXZ(g.fromNode);
    const [bx, bz] = nodeXZ(g.toNode);
    const len = Math.hypot(bx - ax, bz - az) || 1e-6;
    g.u += (s.loco.speedOf(g) * dt) / len;
    if (g.u >= 1) {
      arriveAtNode(g);
    } else {
      g.x = ax + (bx - ax) * g.u;
      g.z = az + (bz - az) * g.u;
      g.yaw = Math.atan2(bx - ax, bz - az);
    }
    g.moving = true;
    g.baseY += (walkY(g.x, g.z) - g.baseY) * Math.min(1, dt * 8); // follows ramps/elevated decks
  };

  // ---- minimal direct-walk fallback (no network provided) ----------------------
  const newFallbackTarget = (g: SimGuest) => {
    const h1 = s.fx.draw(g, 21);
    const h2 = s.fx.draw(g, 22);
    g.target = {
      x: g.home.x + Math.cos(h1 * Math.PI * 2) * Math.sqrt(h2) * g.home.r,
      z: g.home.z + Math.sin(h1 * Math.PI * 2) * Math.sqrt(h2) * g.home.r,
      y: 0,
    };
  };

  const fallbackStep = (g: SimGuest, dt: number) => {
    if (g.waypoints.length) {
      s.loco.followWaypoints(g, dt);
      return;
    }
    if (g.state === 'leavingPark') {
      g.moving = !s.loco.moveToward(g, s.spawnPt.x, s.spawnPt.z, s.loco.speedOf(g), dt);
      if (!g.moving) s.needs.despawn(g);
      return;
    }
    if (!g.target) newFallbackTarget(g);
    g.moving = !s.loco.moveToward(g, g.target!.x, g.target!.z, s.loco.speedOf(g), dt);
    g.baseY += (groundAt(g.x, g.z) - g.baseY) * Math.min(1, dt * 8);
    if (!g.moving) {
      // simplified decisions at each leg end
      if (g.holding === 'container' && s.fx.draw(g, 23) < 0.06) s.fx.startThrow(g);
      if (g.toilet >= TOILET_SEEK && restrooms.length) {
        const rr = s.registry.nearestRestroom(g)!;
        g.state = 'usingRestroom';
        g.restroom = rr;
        g.timer = -1;
        g.waypoints = [{ ...rr.doorway }];
      } else if (g.hunger <= 10 && s.needs.nearestStall(g, 'food')) s.needs.startBuying(g, s.needs.nearestStall(g, 'food')!);
      else if (g.thirst <= 25 && s.needs.nearestStall(g, 'drink')) s.needs.startBuying(g, s.needs.nearestStall(g, 'drink')!);
      else if (s.fx.draw(g, 24) < 0.3 && rides.length) {
        const r = rides[Math.floor(s.fx.draw(g, 25) * rides.length) % rides.length];
        if (r.state !== 'crashed') s.needs.tryJoinQueue(g, r);
        if (g.state === 'walking') newFallbackTarget(g);
      } else newFallbackTarget(g);
    }
  };

  return { chooseNext, arriveAtNode, netStep, newFallbackTarget, fallbackStep };
}
