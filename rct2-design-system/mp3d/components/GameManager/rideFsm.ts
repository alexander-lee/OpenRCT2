// ---------------------------------------------------------------------------
// RIDE STATE MACHINE (Vehicle.h:123 status cycle) — the per-ride admission /
// departure / travel / unload loop, the RCT2 exit-hut unload walk, the
// deterministic breakdown schedule and the shared queue-drain used by both
// crashes and breakdowns.
//
// The FSM never touches guest geometry directly: riders are teleported INSIDE
// the exit hut and walk out through its front doorway, exactly like RCT2's
// leaveVehicle → approachExit → inExit chain. Implementation detail of
// createGameManager.
// ---------------------------------------------------------------------------

import { hash01, clamp255, BREAK_DOWN_SECS, REPAIR_SECS } from './types';
import type { RideState, RideRec, RideStationRec, HandSlot } from './types';
import { slotPos, breakIntervalOf } from './access';
import type { Sim } from './sim';

export function createRideFsm(s: Sim) {
  const { routing, walkY } = s;

  const occupancyOf = (r: RideRec) => ({ riders: r.riders.length, capacity: r.cfg.capacity, occupied: r.riders.length > 0 });

  const setState = (r: RideRec, st: RideState, timer: number) => {
    r.state = st;
    r.timer = timer;
    r.cfg.onStateChange?.(st, occupancyOf(r));
  };

  /** the PLATFORM the train is at (RCT2 `Vehicle::current_station`,
   *  ride/Vehicle.h:198). `stations[0]` is a view over the ride's own fields,
   *  so a one-station ride resolves to exactly what it always used. */
  const stationOf = (r: RideRec): RideStationRec => r.stations[r.atStation] ?? r.stations[0];

  // RCT2 leaveVehicle -> approachExit -> inExit (Peep.h:81): riders teleport
  // INSIDE the exit hut (hidden — they're "in the exit") and file out through
  // its front doorway onto the apron, one at a time. Never across the ride.
  //
  // MULTI-STATION: they leave through the exit of the platform the train is
  // AT, not the one they boarded from. That is RCT2 exactly —
  // `Guest::updateRideLeaveVehicle` overwrites the peep's own station index
  // with the vehicle's (`CurrentRideStation = ride_station;`,
  // entity/Guest.cpp:4192 + 4226) and then reads `station.Exit` off THAT
  // station (:4236). The peep's boarding station is simply forgotten.
  const unloadRiders = (r: RideRec, safe: boolean) => {
    const st = stationOf(r);
    r.riders.forEach((g, k) => {
      g.hidden = true; // inExit — revealed when their exitDelay runs out
      g.state = 'leavingRide';
      g.ride = null;
      if (safe && g.boardStation !== st.idx) r.transfers += 1; // rode A -> B
      g.station = null;
      g.x = st.exitPos.x;
      g.z = st.exitPos.z;
      g.baseY = st.exitDoor.y;
      g.yaw = st.exitYaw;
      g.exitDelay = k * 0.6;
      g.lastRide = r;
      g.lastRideT = s.simTime;
      if (safe) {
        // RCT2 ride satisfaction: happiness target boost, nausea from intensity
        g.happinessTarget = clamp255(g.happinessTarget + 40);
        g.nausea = clamp255(g.nausea + r.intensity * (6 + hash01(g.idx * 7.9 + g.ridden * 3.1) * 12));
        g.ridden += 1;
        g.riddenIds.add(r.idx); // novelty bookkeeping — navigation.ts prefers unridden rides
        s.riddenTotal += 1;
        r.total += 1; // per-ride lifetime total (handle.totalRides())
        // "<ride> was great!" — RCT2's wasGreat carries the ride id
        // (Guest.cpp:1836), which is where the park owner learns WHICH ride
        // the crowd liked
        s.fx.pushThought(g, 'wasGreat', r.cfg.name);
        g.timer = hash01(g.idx * 5.3 + g.ridden * 9.7) < 0.6 ? 0.8 : 0; // 'wow' hop
        g.hopArmed = g.timer > 0; // one pose-layer jump on the exit apron
        // a held balloon sometimes slips away in the post-ride excitement
        // (RCT2 blows held balloons away on a hashed per-tick chance,
        // Guest.cpp:6951-6963) — the release lands once they're on the apron
        (['left', 'right'] as HandSlot[]).forEach((h, hi) => {
          const b = g.balloons[h];
          if (b && hash01(g.idx * 3.9 + g.ridden * 11.7 + hi * 5.3) < 0.12) b.dropAt = Math.min(b.dropAt, s.simTime + 1.6 + k * 0.6);
        });
      } else {
        s.fx.pushThought(g, 'notSafe', r.cfg.name); // "I'm not going on <ride> — it isn't safe"
        g.happinessTarget = clamp255(g.happinessTarget - 30);
        g.timer = 0;
      }
      g.waypoints = [{ ...st.exitDoor }];
      // the exit path may TURN (planExitLane's JOIN case) — walk its corner, or
      // the guest takes the chord and cuts across the grass inside the bend
      // the corner's own `y` is the RAMP's height at that distance along the
      // run (registry.ts) — `walkY` is the STREET sampler and falls back to the
      // flat base level a tile off the network, which is exactly where a corner
      // sits, so it used to drop the guest through the middle of the path
      if (st.exitCorner) g.waypoints.push({ ...st.exitCorner });
      if (st.exitAttach) {
        g.waypoints.push({ x: st.exitAttach.x, z: st.exitAttach.z, y: routing ? walkY(st.exitAttach.x, st.exitAttach.z) : st.exitOut.y });
        g.netReentry = st.exitAttach.node;
      } else {
        g.waypoints.push({ ...st.exitOut });
      }
    });
    r.riders = [];
  };

  // shared queue-drain (crash AND breakdown): guests think it's unsafe and
  // walk away; anyone mid-doorway backs out; anyone aboard leaves via the exit
  const drainRide = (r: RideRec) => {
    // EVERY platform drains — a broken transport ride strands nobody
    for (const st of r.stations) {
      // empty the queue — guests think it's unsafe and walk away
      [...st.queue].forEach((g) => {
        g.happinessTarget = clamp255(g.happinessTarget - 30);
        s.needs.leaveQueue(g, 'notSafe');
      });
      st.queue.length = 0;
      // guests mid-doorway turn straight around — back OUT through the doorway
      // first, then down the lane centre (never diagonally through a wall)
      st.entering.forEach((g) => {
        g.happinessTarget = clamp255(g.happinessTarget - 30);
        s.fx.pushThought(g, 'notSafe', r.cfg.name);
        g.ride = null;
        g.station = null;
        g.state = 'walking';
        g.hidden = false; // may have been mid-dwell inside the hut
        if (st.queueAttach) {
          // past the doorway (inside the hut zone) -> out via the doorway first
          const along = (g.x - st.anchor[0]) * st.dir[0] + (g.z - st.anchor[2]) * st.dir[1];
          g.waypoints = along < 0
            ? [{ ...st.doorway }, { x: st.queueAttach.x, z: st.queueAttach.z, y: walkY(st.queueAttach.x, st.queueAttach.z) }]
            : [{ x: st.queueAttach.x, z: st.queueAttach.z, y: walkY(st.queueAttach.x, st.queueAttach.z) }];
          g.netReentry = st.queueAttach.node;
        } else {
          g.waypoints = [];
          s.nav.newFallbackTarget(g);
        }
      });
      st.entering.length = 0;
    }
    unloadRiders(r, false); // anyone aboard escapes via the exit
  };

  const crashRide = (r: RideRec) => {
    setState(r, 'crashed', 0);
    drainRide(r);
  };

  // deterministic breakdown: pause the FSM, drain everyone off through the
  // crash-ish path, park the vehicle (movingToEndOfStation resets callbacks —
  // e.g. a spin target) and hold until the repair completes
  const breakDown = (r: RideRec) => {
    r.brokenAt = s.simTime;
    drainRide(r);
    setState(r, 'movingToEndOfStation', 1.0);
  };

  const updateRide = (r: RideRec, dt: number) => {
    if (r.state !== 'crashed' && r.cfg.vehicleHandle?.crashed?.()) {
      crashRide(r);
      return;
    }
    // ---- breakdown schedule (additive; deterministic — see breakIntervalOf)
    if (r.state !== 'crashed') {
      if (r.brokenAt >= 0) {
        if (s.simTime - r.brokenAt >= BREAK_DOWN_SECS + REPAIR_SECS) {
          r.brokenAt = -1; // repaired — reopen and rearm the schedule
          r.breakN += 1;
          r.nextBreak = s.simTime + breakIntervalOf(r);
        } else {
          return; // FSM paused: no admissions while broken / being repaired
        }
      } else if (s.simTime >= r.nextBreak) {
        breakDown(r);
        return;
      }
    }
    const st = stationOf(r);
    const nStations = r.stations.length;
    if (r.state === 'movingToEndOfStation') {
      r.timer -= dt;
      if (r.timer <= 0) {
        // a fresh dwell: nobody has boarded yet, so the boarding-quiet window
        // is not armed and `maxWait` has nothing to be measured from
        r.boardedSeen = 0;
        r.boardAt = -1;
        r.lastBoardAt = -1;
        setState(r, 'waitingForPassengers', 0);
      }
    } else if (r.state === 'waitingForPassengers') {
      r.timer += dt; // counts UP; every deadline below is a stamp of this clock
      // ---- BOARDINGS. `riders` only ever GROWS inside this state (guestPass.ts
      // pushes a guest the instant their doorway walk ends; unloadRiders empties
      // it in `arriving`, a different state), so a count that has moved past
      // `boardedSeen` is one or more guests having just sat down. That is the
      // event the quiet window is measured against — NOT `queue.shift()` below,
      // which only moves a guest into `entering`, from where drainRide can still
      // send them back out of the doorway.
      if (r.riders.length > r.boardedSeen) {
        r.boardedSeen = r.riders.length;
        if (r.boardAt < 0) r.boardAt = r.timer; // the first guest aboard
        r.lastBoardAt = r.timer; // ...and every one after them re-arms the window
      }
      const laden = r.riders.length > 0;
      const full = r.riders.length >= r.cfg.capacity;
      // THE BOARDING-QUIET WINDOW (`quietWait`, default BOARD_QUIET_SECS = 10 s):
      // `quietWait` seconds have passed with nobody new sitting down.
      const quietOut = r.lastBoardAt >= 0 && r.timer - r.lastBoardAt >= r.quietWait;
      // ...and its ceiling: a queue that keeps feeding a boarding every few
      // seconds re-arms the window indefinitely, so the dwell is also capped at
      // `maxWait` FROM THE FIRST BOARDING (see RideConfig.maxWait for why the
      // anchor is the first boarding and not the train's arrival).
      const capped = r.boardAt >= 0 && r.timer - r.boardAt >= r.maxWait;
      // DOORS CLOSING: once the ride has decided to leave, stop taking guests
      // OUT of the queue. Without this the departure is unreachable behind a
      // busy queue — `st.entering.length === 0` (below) is the guard that stops
      // a train leaving with somebody mid-doorway, and admitting the next head
      // the moment the last one sat down keeps that set non-empty, so the ride
      // could only ever leave FULL. Anyone already in the doorway still boards;
      // the queue simply waits for the next train, exactly as it does while the
      // ride is away.
      const doorsClosing = laden && (quietOut || capped);
      const aboard = r.riders.length + st.entering.length;
      if (!doorsClosing && aboard < r.cfg.capacity) {
        const head = st.queue[0];
        if (head) {
          const s0 = slotPos(st, 0);
          if (Math.hypot(head.x - s0.x, head.z - s0.z) < 0.22) {
            st.queue.shift();
            head.state = 'enteringRide';
            head.ride = r;
            head.station = st;
            head.boardStation = st.idx; // for the TRANSFER count on unload
            head.cash = Math.max(0, head.cash - r.price); // pay at the entrance
            // atEntrance -> inEntrance (Peep.h:81): the walk ENDS INSIDE the
            // hut. The ride seats them at boardPoint — they never walk to it.
            head.waypoints = [{ ...st.doorway }, { ...st.hutIn }];
            head.timer = -1; // 'inEntrance' dwell, armed on arrival
            st.entering.push(head);
          }
        }
      }
      // DEPARTURE. The rule a rider actually feels is the BOARDING-QUIET one:
      // once somebody is aboard the ride waits `quietWait` (10 s) for another
      // guest and then goes. It does NOT wait for a full vehicle — a part-full
      // train leaving on the quiet window is the normal case, and `full` is only
      // the shortcut that skips the rest of that window (a full vehicle has
      // nothing left to wait FOR, so it never sits out the quiet timer).
      //
      // `st.entering.length === 0` is the invariant that outranks every timer:
      // a guest who has left the queue and is walking through the entrance hut
      // is one step from being a rider, and departing on top of them would
      // strand them in `enteringRide` with no vehicle. `doorsClosing` above is
      // what keeps that guard from blocking the departure forever.
      //
      // A TRANSPORT ride must also leave an EMPTY platform — RCT2's max-wait
      // timer runs whether or not anyone boarded (ride/Vehicle.Station.cpp:598-605),
      // and a monorail that parked forever at a quiet station would never reach
      // the busy one. That clause is unchanged, and it is the ONLY way a
      // rider-less vehicle departs: a single-station flat ride still waits
      // indefinitely for its first guest.
      if (st.entering.length === 0) {
        if (
          (laden && ((full && r.timer >= r.minWait) || quietOut || capped || (r.timer >= r.minWait && st.queue.length === 0))) ||
          (!laden && nStations > 1 && r.timer >= r.minWait && st.queue.length === 0)
        ) {
          setState(r, 'waitingToDepart', 0.6);
        }
      }
    } else if (r.state === 'waitingToDepart') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'departing', r.cfg.loadTime ?? 1.0);
    } else if (r.state === 'departing') {
      r.timer -= dt;
      // `rideDuration` is the FULL CIRCUIT; each inter-station leg gets its
      // share (RCT2 stores exactly this per station: `SegmentTime`, "time for
      // train to reach the next station from this station", ride/Ride.h:175)
      if (r.timer <= 0) setState(r, 'travelling', r.cfg.rideDuration / nStations);
    } else if (r.state === 'travelling') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'arriving', 1.0);
    } else if (r.state === 'arriving') {
      r.timer -= dt;
      if (r.timer <= 0) {
        // RCT2 UpdateTravelling/UpdateArriving latch the station index off the
        // TRACK TILE the train reached and stop there unconditionally
        // (ride/Vehicle.TrackMotion.cpp:433 → ride/Vehicle.Station.cpp:1503-1511,
        // :1682). Our circuit's station order IS the `stations` array order.
        r.atStation = (r.atStation + 1) % nStations;
        const n = r.riders.length;
        unloadRiders(r, true); // EVERY rider gets off (Vehicle.Station.cpp:974-981)
        setState(r, 'unloadingPassengers', 0.8 + n * 0.6 + 0.8);
      }
    } else if (r.state === 'unloadingPassengers') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'movingToEndOfStation', 1.0);
    }
  };

  return { occupancyOf, setState, unloadRiders, drainRide, crashRide, breakDown, updateRide };
}
