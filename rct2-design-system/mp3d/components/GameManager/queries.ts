// ---------------------------------------------------------------------------
// READ-SIDE ACCESSORS — the park-wide `stats()` snapshot, the live per-guest
// records that feed GuestInfo (and the clickable guest's `userData.guestRef`),
// the ride roster RideViewer/ParkInfo read, and the validation accessors
// ParkBuilder.validatePark audits (routing attach points, audited footprints,
// stall roster, residual access collisions, resolved gate points).
//
// Every accessor is a pure read that COPIES what it returns, so a caller can
// never mutate sim state through it. Implementation detail of
// createGameManager.
// ---------------------------------------------------------------------------

import { handItem } from './guestFx';
import type { SimGuest } from './types';
import type { Sim } from './sim';

export function createQueries(s: Sim) {
  const { rides, stalls, guests, restrooms } = s;

  const stats = () => {
    const active = guests.filter((g) => !g.gone);
    const avgHappiness = active.length ? active.reduce((sum, g) => sum + g.happiness, 0) / active.length : 0;
    const allThoughts = guests
      .flatMap((g) => g.thoughts.map((th) => ({ guest: g.idx, type: th.type, text: th.text, t: th.t })))
      .sort((a, b) => b.t - a.t)
      .slice(0, 10);
    return {
      avgHappiness,
      activeGuests: active.length,
      /** ADDITIVE: the sim clock. A harness that wants to step the sim forward
       *  MUST start from this — `update(t, dt)` with t restarting near 0 sends
       *  time BACKWARDS and every FSM deadline lands in the future. */
      simTime: s.simTime,
      riddenTotal: s.riddenTotal,
      queued: rides.reduce((sum, r) => sum + r.stations.reduce((q, st) => q + st.queue.length, 0), 0),
      riding: rides.reduce((sum, r) => sum + r.riders.length + r.stations.reduce((e, st) => e + st.entering.length, 0), 0),
      /** ADDITIVE: guests carried BETWEEN platforms by a multi-station transport
       *  ride (boarded at A, got off at B). 0 unless the park has one. */
      transfers: rides.reduce((sum, r) => sum + r.transfers, 0),
      litterCount: s.fx.litter.length,
      poopCount: s.fx.poops.length,
      vomitCount: s.fx.vomits.length,
      balloonsSold: s.balloonsSold,
      balloonsFlown: s.balloonsFlown,
      balloonsAirborne: s.fx.airBalloons.filter((b) => b.active).length,
      restroomUses: restrooms.reduce((sum, r) => sum + r.uses, 0),
      thoughts: allThoughts,
      // ---- THE GATE STREAM (additive, arrivals.ts) -------------------------
      // `parkRating` is RCT2's CalculateParkRating (0-999), `arrivalsPerMinute`
      // the rate the current `guestGenerationProbability` implies, `guestCap`
      // the hard population ceiling and `arrivals` the number of guests that
      // have walked in through the gate since the park opened.
      ...s.arrivals.snapshot(),
      // per-ride occupancy summary
      rides: rides.map((r) => ({ name: r.cfg.name, state: r.state, queue: r.stations.reduce((q, st) => q + st.queue.length, 0), ...s.rideFsm.occupancyOf(r) })),
    };
  };

  // ---- additive UI accessors (window suite: GuestInfo / RideViewer / ParkInfo)
  /** one live guest record — also served by the guest group's
   *  `userData.guestRef` accessor (clickability) */
  const recordOf = (g: SimGuest) => ({
    id: g.idx,
    name: `Guest ${g.idx + 1}`,
    state: g.state,
    happiness: g.happiness,
    hunger: g.hunger,
    thirst: g.thirst,
    energy: g.energy,
    nausea: g.nausea,
    toilet: g.toilet,
    /** ADDITIVE: cash in pocket — the RCT2 guest window's "Cash in pocket"
     *  line (openrct2-ui/windows/Guest.cpp stats tab) */
    cash: g.cash,
    /** ADDITIVE: rides completed this visit — RCT2's "No. of rides" */
    ridden: g.ridden,
    thoughts: g.thoughts.map((th) => th.text),
    /** ADDITIVE: the same ring with the thought's SUBJECT split out (the ride /
     *  stall the thought names, null when the thought names nothing) */
    thoughtSubjects: g.thoughts.map((th) => th.subject),
    position: [g.x, g.baseY, g.z] as [number, number, number],
    /** additive: the two-hand held-item registry (null = hand free) */
    hands: { left: handItem(g, 'left'), right: handItem(g, 'right') },
    /** additive: the WEARABLE on the head slot — the name of the stall that
     *  sold it, or null for a bare head (worn items are kept for the whole
     *  visit, so this only ever goes null → set) */
    worn: g.worn ? g.worn.stall : null,
    /** additive: true while inside a hut / not yet through the gate */
    hidden: g.hidden || g.entryDelay > 0,
    gone: g.gone,
    // ---- ADDITIVE: which ride, and on a MULTI-STATION ride which PLATFORM --
    /** the ride this guest is queuing for / aboard / leaving, by name (null
     *  when they are just walking) — RCT2's guest window names it too */
    ride: g.ride ? g.ride.cfg.name : g.lastRide ? g.lastRide.cfg.name : null,
    /** the PLATFORM they are queuing at / boarded from, by label. Always
     *  station 0's label on an ordinary single-station ride. */
    station: g.station ? g.station.label : null,
    /** ADDITIVE: the station INDEX they boarded at. Paired with the ride's own
     *  `currentStation()` on unload this is what makes a TRANSFER measurable
     *  (RCT2 keeps no such field — `Peep::CurrentRideStation` is overwritten
     *  with the vehicle's on disembark, entity/Guest.cpp:4192 + :4226). */
    boardStation: g.boardStation,
  });

  /** live per-guest records — RCT2 guest-window data (openrct2-ui/windows/
   *  Guest.cpp stats tab bars :146-159, thoughts tab :172,827-848) */
  const guestRecords = () => guests.filter((g) => !g.gone).map(recordOf);

  /** registered-ride roster for park-wide windows (name + status + queue +
   *  boardPoint so a camera can be aimed at the ride) */
  const rideList = () =>
    rides.map((r) => ({
      name: r.cfg.name,
      status: s.access.statusOf(r),
      state: r.state,
      queue: r.stations.reduce((q, st) => q + st.queue.length, 0),
      /** ADDITIVE: platforms on this ride (RCT2 `Ride::numStations`,
       *  ride/Ride.h:263). 1 for every ordinary ride. */
      stationCount: r.stations.length,
      /** ADDITIVE: guests carried from one platform to a DIFFERENT one */
      transfers: r.transfers,
      /** ADDITIVE: rides COMPLETED on this ride over its lifetime (the same
       *  counter `handle.totalRides()` returns). The per-ride figure is what
       *  makes roster COVERAGE measurable — `stats().riddenTotal` is the sum and
       *  hides a park where two attractions take every rider
       *  (harness/park-eval/probe-ride-coverage.mjs). */
      total: r.total,
      boardPoint: [r.cfg.boardPoint[0], r.cfg.boardPoint[1], r.cfg.boardPoint[2]] as [number, number, number],
      /** additive: the configured TRAVELLING duration — validatePark scales
       *  its sim-smoke window off the longest one */
      rideDuration: r.cfg.rideDuration,
      /** ADDITIVE: the sim's guest-gating intensity (1–10) — the park-wide
       *  gentle/moderate/intense MIX is read off this */
      intensity: r.intensity,
      /** ADDITIVE: the registered RCT2 rating triple, when the caller
       *  measured one (SplineRideKit `rateCoaster`); null otherwise */
      ratings: r.cfg.ratings ?? null,
    }));

  // ---- additive validation accessors (ParkBuilder.validatePark) -------------
  /** routing attach points: park-gate node + each ride's queue-tail/exit node */
  const accessPoints = () => ({
    entranceNode: s.parkEntrance?.attach?.node ?? -1,
    rides: rides.map((r) => ({
      name: r.cfg.name,
      queueNode: r.queueAttach?.node ?? -1,
      exitNode: r.exitAttach?.node ?? -1,
      // ---- ADDITIVE: the RCT2 entrance/exit LAYOUT facts the gate audits ----
      // RCT2 hands a ride two path connections of DIFFERENT kinds — a queue INTO
      // the entrance and an ordinary footpath OUT of the exit — and the huts sit
      // on tiles adjacent to the station, each facing outward. These are the
      // measured values for both halves of that shape.
      /** entrance hut centre + its OUTWARD doorway facing (the queue's axis) */
      entranceAt: [r.cfg.queueAnchor[0] - r.dir[0] * 0.62, r.cfg.queueAnchor[2] - r.dir[1] * 0.62] as [number, number],
      entranceDir: [r.dir[0], r.dir[1]] as [number, number],
      /** exit hut centre + its OUTWARD doorway facing */
      exitAt: [r.exitPos.x, r.exitPos.z] as [number, number],
      exitDir: [r.exitDir[0], r.exitDir[1]] as [number, number],
      /** length of the ride's EXIT PATH; 0 = none was buildable, which is RCT2's
       *  STR_EXIT_NOT_CONNECTED condition (Ride.cpp:2076) */
      exitLaneLen: r.exitLaneLen,
      /** where that path meets the street (== the exit spur node's cell) */
      exitLaneEnd: [r.exitOut.x, r.exitOut.z] as [number, number],
      // ---- ADDITIVE: EVERY PLATFORM (RCT2 rides own a station ARRAY,
      // ride/Ride.h:404). Index 0 repeats the fields above; a multi-station
      // transport ride adds one entry per extra platform, and validatePark
      // gates EACH of them on its own queue node + exit path exactly as it
      // gates a single-station ride's one platform. An unreachable platform
      // is a station guests cannot board at, which is the whole defect a
      // silently-unregistered monorail used to hide.
      stations: r.stations.map((st) => ({
        idx: st.idx,
        label: st.label,
        queueNode: st.queueAttach?.node ?? -1,
        exitNode: st.exitAttach?.node ?? -1,
        entranceAt: [st.anchor[0] - st.dir[0] * 0.62, st.anchor[2] - st.dir[1] * 0.62] as [number, number],
        entranceDir: [st.dir[0], st.dir[1]] as [number, number],
        boardPoint: [st.boardPoint[0], st.boardPoint[1], st.boardPoint[2]] as [number, number, number],
        exitAt: [st.exitPos.x, st.exitPos.z] as [number, number],
        exitDir: [st.exitDir[0], st.exitDir[1]] as [number, number],
        exitLaneLen: st.exitLaneLen,
        exitLaneEnd: [st.exitOut.x, st.exitOut.z] as [number, number],
      })),
    })),
  });
  /** every audited footprint rect (entrance/exit huts, queue lanes, pads) */
  const footprints = () => s.access.allFootprints.map((f) => ({ ...f }));
  /** registered stalls (name + anchor + serving dir) — validatePark's
   *  track-corridor sweep audits their footprints (additive accessor) */
  const stallList = () =>
    stalls.map((st) => ({
      name: st.cfg.name,
      anchor: [st.cfg.anchor[0], st.cfg.anchor[1], st.cfg.anchor[2]] as [number, number, number],
      dir: [st.cfg.dir[0], st.cfg.dir[1]] as [number, number],
      /** ADDITIVE: items sold over the stall's lifetime (ParkInfo / benches) */
      sold: st.sold,
    }));
  /** residual placeAccess collisions (no safe auto-fix) — validatePark
   *  promotes any entry its own OBB sweep didn't already fail on */
  const accessAudit = () => s.access.accessAuditRecs.map((r) => ({ ...r }));
  /** resolved park-gate world points (validatePark's gate-at-edge check) */
  const entrancePoints = () =>
    s.parkEntrance
      ? {
          spawn: [s.parkEntrance.spawn.x, s.parkEntrance.spawn.y, s.parkEntrance.spawn.z] as [number, number, number],
          arch: [s.parkEntrance.arch.x, s.parkEntrance.arch.y, s.parkEntrance.arch.z] as [number, number, number],
        }
      : null;

  return { stats, recordOf, guestRecords, rideList, accessPoints, footprints, stallList, accessAudit, entrancePoints };
}
