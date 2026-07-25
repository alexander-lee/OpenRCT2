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
      riddenTotal: s.riddenTotal,
      queued: rides.reduce((sum, r) => sum + r.queue.length, 0),
      riding: rides.reduce((sum, r) => sum + r.riders.length + r.entering.length, 0),
      litterCount: s.fx.litter.length,
      poopCount: s.fx.poops.length,
      vomitCount: s.fx.vomits.length,
      balloonsSold: s.balloonsSold,
      balloonsFlown: s.balloonsFlown,
      balloonsAirborne: s.fx.airBalloons.filter((b) => b.active).length,
      restroomUses: restrooms.reduce((sum, r) => sum + r.uses, 0),
      thoughts: allThoughts,
      // per-ride occupancy summary
      rides: rides.map((r) => ({ name: r.cfg.name, state: r.state, queue: r.queue.length, ...s.rideFsm.occupancyOf(r) })),
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
    thoughts: g.thoughts.map((th) => th.text),
    position: [g.x, g.baseY, g.z] as [number, number, number],
    /** additive: the two-hand held-item registry (null = hand free) */
    hands: { left: handItem(g, 'left'), right: handItem(g, 'right') },
    /** additive: true while inside a hut / not yet through the gate */
    hidden: g.hidden || g.entryDelay > 0,
    gone: g.gone,
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
      queue: r.queue.length,
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
