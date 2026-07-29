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

import { clamp255, TOILET_SEEK, LAST_RIDE_TIMEOUT, SIT_DROP } from './types';
import type { SimGuest, RideRec, StallRec } from './types';
import type { Sim } from './sim';

/** how readily a guest heads for a ride they have NOT been on yet, per aimless
 *  node arrival … */
const RIDE_SEEK_NEW = 0.45;
/** …and once they have ridden everything reachable. Roughly the old flat rate,
 *  so a park settles instead of every guest riding for ever. */
const RIDE_SEEK_REPEAT = 0.12;
/** energy at or below which a guest starts actively hunting for a bench */
const REST_SEEK = 110;
/**
 * APPETITE SEEK THRESHOLDS — thirst / hunger (both stored RCT2-style INVERTED:
 * 255 = fully sated, 0 = starving) at or below which an aimless guest walks to a
 * stall on purpose instead of waiting to happen past one.
 *
 * These sit deliberately BETWEEN RCT2's two published numbers:
 *
 *   * the COUNTER GATE, `hunger > 75` / `thirst > 75` (DecideAndBuyItem,
 *     Guest.cpp:1574, 1580) — above it the shop refuses the sale, so a seek
 *     threshold above 75 would send guests on trips that end in "I'm not
 *     hungry";
 *   * the THOUGHT TRIGGERS, `hunger <= 10` / `thirst <= 25` (:1098, :1103) —
 *     the point at which a guest starts COMPLAINING, which is far too late to
 *     start walking. That is what this used to seek on, and it is why hunger and
 *     thirst barely drove navigation at all: a guest reached 10 only after ~5
 *     minutes of walking, by which time most had left.
 *
 * 60 gives the loop a rhythm instead of a permanent errand: a finished meal
 * leaves hunger at ~175 (75 + a 12-16-bite refill at +7 each) and the passive
 * drain is 2 per 3.2 s, so a guest goes looking for food roughly every three
 * minutes and spends the time in between riding — which is the priority order
 * this park wants (thirsty → drink, hungry → food, otherwise ride).
 */
const THIRST_SEEK = 60;
/** …and hunger, on the same reasoning (the two drain at the same rate here) */
const HUNGER_SEEK = 60;
/** …and the impulse budget that hunt gets on the arrival roll. The plain whim
 *  owns p < 0.16; a tired guest keeps looking all the way to 0.30, which eats
 *  into the watch/balloon whims exactly as a worn-out guest's priorities do. */
const REST_SEEK_P = 0.3;

export function createNavigation(s: Sim) {
  const { routing, walkY, groundAt, nodeXZ, rides, stalls, restrooms, rideAt, stationAt, stallAt, restroomAt } = s;

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
      // unreachable — give up, and SAY SO: RCT2's guest heading for a ride it
      // cannot route to thinks "I can't find <ride>" (Guest.cpp:1456, the
      // thought carries guestHeadingToRideId)
      const lost = g.goal.ride?.cfg.name ?? g.goal.stall?.cfg.name ?? null;
      if (lost) s.fx.pushThought(g, 'cantFind', lost);
      g.goal = null;
    }
    g.toNode = routing.wanderNext(prev, g.fromNode, g.idx * 131.7 + g.decN * 23.9);
    g.decN += 1;
  };

  /**
   * RIDE APPETITE — NOVELTY FIRST.
   *
   * The old rule was one 10 % roll that picked a SINGLE ride uniformly at
   * random and then discarded the whole roll if that ride happened to be
   * crashed, broken, unreachable or the one the guest had just got off. A park's
   * roster therefore got sampled with replacement at ~10 % per junction, so the
   * two attractions nearest the gate were ridden over and over while the far
   * half of a big park was barely touched — and a guest who had done everything
   * nearby was as likely to re-pick it as to walk to something new.
   *
   * Three changes, all aimed at COVERAGE:
   *
   *  1. Build the ELIGIBLE list first and pick from that, so an ineligible ride
   *     never wastes the decision.
   *  2. Split it into rides the guest has NOT been on (`g.riddenIds`) and ones
   *     they have, and draw from the unridden pool whenever it is non-empty.
   *     This is the whole "try all the rides" behaviour.
   *  3. Want it MORE: a guest with something new to try heads for a ride on
   *     `RIDE_SEEK_NEW`; once they have done everything reachable the appetite
   *     drops to `RIDE_SEEK_REPEAT`, which is roughly the old rate — so a park
   *     still settles down instead of every guest riding forever.
   */
  const seekRide = (g: SimGuest) => {
    if (!rides.length) return;
    const fresh: RideRec[] = [];
    const again: RideRec[] = [];
    for (const r of rides) {
      // a WRECK is the only ride that is not a candidate; nothing can be broken
      // down (GameManager/access.ts `statusOf`)
      if (r.state === 'crashed') continue;
      if (g.lastRide === r && s.simTime - g.lastRideT < LAST_RIDE_TIMEOUT) continue; // RCT2 previous_ride_time_out
      if (!r.stations.some((st) => st.queueAttach)) continue; // no reachable platform
      (g.riddenIds.has(r.idx) ? again : fresh).push(r);
    }
    const pool = fresh.length ? fresh : again;
    if (!pool.length) return;
    if (s.fx.draw(g, 26) >= (fresh.length ? RIDE_SEEK_NEW : RIDE_SEEK_REPEAT)) return;
    const r = pool[Math.floor(s.fx.draw(g, 17) * pool.length) % pool.length];
    // MULTI-STATION: head for the NEAREST platform of that ride. A
    // park-spanning monorail is only useful if the guest walks to the station in
    // the district they are standing in, not always to station 0 on the far side
    // of the park.
    let best = null as (typeof r.stations)[number] | null;
    let bestD = Infinity;
    for (const st of r.stations) {
      if (!st.queueAttach) continue;
      const d = (st.queueAttach.x - g.x) ** 2 + (st.queueAttach.z - g.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    }
    if (best?.queueAttach) g.goal = { kind: 'ride', node: best.queueAttach.node, ride: r };
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
    // WALKING PAST A QUEUE. A guest standing on a ride's own tail node used to
    // step up on a flat coin-flip whatever the ride was; they now step up far
    // more readily for one they have NOT been on, which is the same
    // novelty-first rule seekRide applies when choosing where to walk.
    const walkUpP = rideHere && !g.riddenIds.has(rideHere.idx) ? 0.9 : 0.5;
    if (rideHere && (g.goal?.ride === rideHere || (!g.goal && s.fx.draw(g, 14) < walkUpP))) {
      // guests DECIDE at the ride entrance (Guest.cpp:5774). On a multi-station
      // transport ride the node also names WHICH platform they walked up to.
      if (s.needs.tryJoinQueue(g, rideHere, stationAt.get(n) ?? rideHere.stations[0])) return;
      chooseNext(g, prev);
      return;
    }
    // WHICH STALL IS THIS NODE? `stallAt` is a Map, so when several stalls share
    // one attach node — which is the NORMAL case for a row of shops, and every
    // `<Bazaar>` is a row of shops — only the LAST one registered owns the slot.
    // A guest walking to any of the others therefore arrived at their stall,
    // failed `g.goal.stall === stallHere`, had the goal cleared as stale two lines
    // below, and wandered off; they could never buy, ever. MEASURED on arch-ref
    // (2 stalls): `Glacier Soda` sold and `Summit Grill` sold 0, indefinitely.
    // A guest who is HEADING FOR a specific stall recognises its own attach node
    // regardless of who holds the map slot; the walk-past impulse still uses the
    // map, which is the right behaviour for "whoever is standing here".
    const stallHere = g.goal?.stall && g.goal.stall.attach?.node === n ? g.goal.stall : stallAt.get(n);
    // passing impulse: consumables when peckish; accessories are a joy buy —
    // guests with a balloon already rarely step up again, and a guest whose
    // hands are BOTH full still occasionally tries (and is refused with the
    // visible "my hands are full" thought at the counter)
    // The consumable gates are RCT2's OWN counter thresholds (DecideAndBuyItem
    // refuses food above hunger 75 and drink above thirst 75, Guest.cpp:1574,
    // 1580) — walking up with hunger 80 only ever earned an "I'm not hungry"
    // refusal, which is a wasted trip and a wasted thought slot. Was < 90.
    const stallImpulse = (st: StallRec): boolean => {
      if (st.cfg.item === 'food') return g.hunger <= 75 && s.fx.draw(g, 15) < 0.35;
      if (st.cfg.item === 'drink') return g.thirst <= 75 && s.fx.draw(g, 15) < 0.35;
      return s.fx.draw(g, 15) < (g.balloons.left || g.balloons.right ? 0.06 : 0.3); // accessory (repeat joy buys are rare)
    };
    if (stallHere && (g.goal?.stall === stallHere || (!g.goal && stallImpulse(stallHere)))) {
      s.needs.startBuying(g, stallHere);
      g.netReentry = null;
      return;
    }
    if (g.goal && n === g.goal.node) g.goal = null; // reached a stale goal node

    // ---- PRESSING NEEDS, AND THEY PREEMPT A PLEASURE GOAL --------------------
    //
    // A full bladder, then thirst, then hunger — the order a guest feels them.
    //
    // THE PREEMPTION IS THE WHOLE POINT, and it is a BUG FIX. These used to be
    // gated on `!g.goal`, i.e. a guest only ever noticed a need while completely
    // aimless — but `seekRide` claims a goal on 45 % of aimless arrivals and a
    // ride is many nodes away, so a guest is goal-directed almost all the time
    // and the appetite branches were practically unreachable. MEASURED on
    // arch-ref (116 guests, 180 sim-s, counters on the branches): the DRINK
    // branch was entered **4 times** and the FOOD branch **once** in the entire
    // run, and the park sold 2 drinks and 0 food while every guest was down at
    // thirst 6 / hunger 7 and thinking "I'm thirsty".
    //
    // So a real need now overrides a ride the guest was merely fancying (`kind
    // === 'ride'`), which is the priority the design asks for: thirsty → drink,
    // hungry → food, OTHERWISE a ride. It cannot thrash, because the need goal is
    // resolved to a REACHABLE target FIRST and only replaces the old goal if one
    // was found — a hungry guest in a park with no reachable food stall keeps
    // walking to their ride.
    const needsDrink = !g.holding && g.thirst <= THIRST_SEEK;
    const needsFood = !g.holding && g.hunger <= HUNGER_SEEK;
    if (g.toilet >= TOILET_SEEK || needsDrink || needsFood) {
      let need: SimGuest['goal'] = null;
      if (g.toilet >= TOILET_SEEK && restrooms.length) {
        const rr = s.registry.nearestRestroom(g);
        if (rr && rr.attach) need = { kind: 'restroom', node: rr.attach.node, restroom: rr };
      }
      // whichever appetite is MORE pressing goes first (both are stored inverted,
      // so the LOWER number is the hungrier/thirstier one) and thirst breaks an
      // exact tie, being the quicker and cheaper fix. A strict thirst-then-hunger
      // order starves the food stalls: the two needs drain at the same rate, so
      // they come due together, thirst would always win, and `!g.holding` then
      // bars food for the whole 1.6-3.2-minute drink.
      const order: ('drink' | 'food')[] = g.thirst <= g.hunger ? ['drink', 'food'] : ['food', 'drink'];
      for (const item of order) {
        if (need) break;
        if (item === 'drink' ? !needsDrink : !needsFood) continue;
        const st = s.needs.nearestStall(g, item);
        if (st && st.attach) need = { kind: 'stall', node: st.attach.node, stall: st };
      }
      if (need && (!g.goal || g.goal.kind === 'ride')) {
        g.goal = need;
        g.path = [];
      }
    }
    // ---- and THEN the pleasures: a RIDE first, then the whims ----------------
    // Only a guest with nothing pressing gets here — the needs above have already
    // taken their pick, and one of them may have just taken this guest's ride goal
    // away. `!g.holding` gates the appetites up there for RCT2's reason: a guest
    // already carrying a burger or a cup would only earn "I haven't finished my
    // drink yet" at the counter (Guest.cpp:1553), so the trip would be wasted.
    if (!g.goal) {
      {
        // RIDES ARE SOUGHT FIRST, off their OWN draw (see seekRide) — a guest who
        // wants a ride should not be competing with the sit/watch/balloon whims
        // for the same slice of one random number.
        seekRide(g);
        const p = g.goal ? 1 : s.fx.draw(g, 16);
        // The non-ride whims keep their ORIGINAL windows: rides used to own
        // p < 0.10 and each impulse below sat in the band above it, so the bands
        // are still gated on their own lower bound and p < 0.10 now simply falls
        // through to plain wandering. Moving rides onto a separate draw without
        // this would have handed their 10 % to the REST branch and made guests
        // sit down more, which is the opposite of the point.
        if ((p >= 0.1 && p < 0.16) || (g.energy <= REST_SEEK && p < REST_SEEK_P)) {
          // REST STOP (RCT2 PeepState::Sitting). Two ways in: the standing 16 %
          // whim anyone takes, and a WORN-OUT guest actively looking for a seat
          // — RCT2 makes a tired peep far likelier to sit (Guest.cpp:2790), and
          // without that second door a park's benches went unused because the
          // guests who most needed them were no likelier to find one.
          const seat = s.needs.claimBench(g);
          if (seat) {
            // walk the last couple of metres off the network onto the seat.
            // `resume` is the edge position to step back onto afterwards, the
            // same detour bookkeeping the litter-bin walk uses.
            g.resume = { from: g.fromNode, to: g.toNode, u: g.u };
            g.state = 'sitting';
            g.timer = -1; // armed when the walk to the seat completes
            g.path = [];
            g.toNode = -1;
            g.waypoints = [{ x: seat.x, z: seat.z, y: seat.y - SIT_DROP }];
            return;
          }
          // NO BENCH WITHIN REACH — a worn-out guest EATS rather than stand in
          // the street. RCT2 pauses the day's energy drain for as long as a guest
          // is working through a meal (needs.ts `energyTarget -= 2` is gated on
          // `holding !== 'food' && holding !== 'drink'`), so food is the other
          // half of "I need a rest" when there is nowhere to sit — and it is what
          // a real park does with a tired crowd.
          if (!g.holding && g.hunger <= HUNGER_SEEK && stalls.some((st) => st.cfg.item === 'food')) {
            const fs = s.needs.nearestStall(g, 'food');
            if (fs && fs.attach) {
              g.goal = { kind: 'stall', node: fs.attach.node, stall: fs };
              chooseNext(g, prev);
              return;
            }
          }
          // …otherwise the original in-place pause, unchanged
          g.state = 'sitting';
          g.timer = 3 + s.fx.draw(g, 18) * 3;
          return;
        } else if (p >= 0.16 && p < 0.24) {
          // watch a nearby ride (RCT2 PeepState::Watching)
          let watch: RideRec | null = null;
          for (const r of rides) if (Math.hypot(r.cfg.boardPoint[0] - g.x, r.cfg.boardPoint[2] - g.z) < 5) watch = r;
          if (watch) {
            g.state = 'watching';
            g.timer = 2.5 + s.fx.draw(g, 19) * 2;
            g.yaw = Math.atan2(watch.cfg.boardPoint[0] - g.x, watch.cfg.boardPoint[2] - g.z);
            return;
          }
        } else if (p >= 0.24 && p < 0.3 && !g.balloons.left && !g.balloons.right) {
          // fancy a balloon: seek the nearest accessory stall (joy buy)
          const st = s.needs.nearestStall(g, 'balloon');
          if (st && st.attach) g.goal = { kind: 'stall', node: st.attach.node, stall: st };
        } else if (p >= 0.3 && p < 0.34 && !g.worn) {
          // fancy something to WEAR (goggles, a hat): the same joy-buy roll,
          // one head only. Parks with no 'wearable' stall registered find
          // nothing here and fall through to plain wandering exactly as before.
          const st = s.needs.nearestStall(g, 'wearable');
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
      } else if (!g.holding && g.thirst <= THIRST_SEEK && s.needs.nearestStall(g, 'drink'))
        s.needs.startBuying(g, s.needs.nearestStall(g, 'drink')!);
      else if (!g.holding && g.hunger <= HUNGER_SEEK && s.needs.nearestStall(g, 'food'))
        s.needs.startBuying(g, s.needs.nearestStall(g, 'food')!);
      else if (s.fx.draw(g, 24) < 0.3 && rides.length) {
        const r = rides[Math.floor(s.fx.draw(g, 25) * rides.length) % rides.length];
        if (r.state !== 'crashed') s.needs.tryJoinQueue(g, r);
        if (g.state === 'walking') newFallbackTarget(g);
      } else newFallbackTarget(g);
    }
  };

  return { chooseNext, arriveAtNode, netStep, newFallbackTarget, fallbackStep };
}
