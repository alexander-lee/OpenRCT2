// ---------------------------------------------------------------------------
// THE GATE STREAM — guests keep ARRIVING through the registered park entrance
// while the park is doing well, and stop coming when it is not. This is
// OpenRCT2's own guest generation, ported:
//
//   Park::Update (src/openrct2/world/Park.cpp:320-354) recomputes the park
//   rating + the generation probability every 512 ticks (~13 s of play) and
//   then calls generateGuests() ONCE PER TICK. generateGuests (:220-231) rolls
//   `ScenarioRand() & 0xFFFF < park.guestGenerationProbability` and, on a hit,
//   calls GenerateGuest() — which spawns the peep AT A PEEP SPAWN (the park
//   entrance) in state `enteringPark` and lets it walk in (:537-555). Nobody is
//   ever teleported into the park interior, and neither is anyone here:
//   `s.spawn.spawnGuests(1)` is the SAME call `<Park>` opens the park with, so
//   an arrival appears at the gate's `spawnPoint`, walks in under the archway
//   and only then joins the path network (spawn.ts).
//
//   calculateGuestGenerationProbability (Park.cpp:168-218):
//     probability = 50 + clamp(rating - 200, 0, 650)          // 50 .. 700
//     if (numGuests > suggestedGuestMaximum) probability /= 4
//   out of 0xFFFF per tick. So the park RATING is the whole gate, and the
//   rating's guest half is dominated by HAPPINESS (CalculateParkRating
//   :388-422): a park where every guest is happy earns the full +500 back,
//   one where none are keeps the -500 penalty. That is the "arrivals dry up
//   when the guests are miserable" rule the design asks for — it is not a
//   bespoke threshold, it is RCT2's own curve.
//
// WHICH CLOCK. The generation roll is authored per RCT2 tick, i.e. against
// RCT2's real 40 ticks/s, so it is read on the REAL clock (`TR`), NOT this
// sim's 4x-compressed appetite clock (see "THE TWO CLOCKS" in types.ts). That
// asymmetry is exactly what makes the gate bite: arrivals run at RCT2's own
// pace (~26/min at the rating ceiling, ~1.8/min at the floor) while a
// miserable park's DEPARTURES run on the compressed clock (the 5% leave roll
// every 3.2 sim-s, needs.ts), so a soured park drains far faster than the gate
// can refill it.
//
// Everything here is hashed off the roll counter — no Math.random, no
// Date.now, and the accumulator is driven by dt, so a 1/30 validatePark smoke
// loop and a variable-dt render loop see the same arrivals after the same
// amount of elapsed sim time. The dt fed in is the CLAMPED one (see `walkClock`
// in sim.ts), the same clock guest timers run on: on a slow page arrivals
// therefore slow down in step with the guests already inside, instead of a
// stalled frame dumping a coachload through the gate at once.
// Implementation detail of createGameManager.
// ---------------------------------------------------------------------------

import { hash01, RCT2_TICKS_PER_SEC } from './types';
import type { Sim } from './sim';

/** RCT2's generation roll is per game tick at its own 40 ticks/s (Park.cpp:353,
 *  called from GameState.cpp:329 once per tick) — one roll per this many sim-s */
const ROLL_EVERY = 1 / RCT2_TICKS_PER_SEC; // 0.025 s
/** RCT2 recomputes rating + probability every 512 ticks (Park.cpp:335-341) */
const RECALC_EVERY = 512 / RCT2_TICKS_PER_SEC; // 12.8 s
/** RCT2's own "is this guest happy?" line — happiness > 128 (Park.cpp:404) */
export const HAPPY_AT = 128;
/** default hard ceiling when the caller gives none (`<Park>` always does) */
const DEFAULT_CAP = 120;

/** BonusValue per open ride, RCT2's `suggestedGuestMaximum` summand
 *  (Park.cpp:107-140). RCT2 reads it off the ride TYPE descriptor; this sim
 *  has no RCT2 ride type, only the guest-gating `intensity` (1-10), so the
 *  three bands below are the MEDIANS of the real tables
 *  (src/openrct2/ride/rtd/**): gentle 22-50 (median 45), thrill 35-65
 *  (median 45), coaster 50-120 (median 90). */
const bonusOf = (intensity: number) => (intensity >= 7 ? 90 : intensity >= 4 ? 50 : 40);

export function createArrivals(s: Sim) {
  const cfg = s.opts.arrivals ?? {};
  const cap = Math.max(0, Math.round(cfg.cap ?? DEFAULT_CAP));
  const enabled = cfg.enabled ?? true;

  let acc = 0; // sim-s owed to the roll clock
  let rollN = 0; // total rolls made (the hash key — never reset)
  let sinceCalc = RECALC_EVERY; // force a recompute on the first update
  let rating = 0;
  let probability = 0;
  let suggestedMax = 0;
  let arrived = 0; // guests admitted THROUGH the gate since opening

  // ---- park rating (CalculateParkRating, Park.cpp:375-483) ------------------
  // Ported LITERALLY, term for term, off the data this sim actually keeps:
  //
  //   GUESTS (:388-422) — the guest-count slope and, above all, the HAPPINESS
  //     term: a flat -500 bought back at 2·min(250, happyGuests·300/N), where
  //     "happy" is RCT2's own happiness > 128 (:404). This is the whole gate:
  //     a park where nobody is happy keeps the -500, one where 5/6 are gets it
  //     all back. NOT modelled: the lost-guest penalty (:418-421, needs
  //     `guestIsLostCountdown`) and `ratingCasualtyPenalty`.
  //   RIDES (:424-470) — uptime from the sim's REAL breakdown state, plus
  //     RCT2's two excitement/intensity terms. RCT2 only counts a ride in
  //     those if `RideHasRatings` (:435): an untested ride contributes nothing
  //     but still costs the park the -100/-200 baselines. This sim's rides
  //     carry ratings only when the author MEASURED them (`registerRide`'s
  //     `cfg.ratings`, SplineRideKit `rateCoaster`), in human units — ×100 to
  //     get RCT2's fixed point — so the same rule applies unchanged: a park of
  //     measured coasters rates (and draws) higher than one of unrated flat
  //     rides, exactly as RCT2 intends.
  //   LITTER (:475-483) — RCT2 counts only litter older than 7680 ticks
  //     (~5 min); this sim's pooled litter carries no age, so ALL of it counts.
  //     The LITTER_CAP pool bounds the penalty at 600 − 4·(150 − 40) = 160.
  //
  // RCT2 does all of this in integer arithmetic; the float terms here are
  // rounded once at the end, so the result can differ by a point.
  const parkRatingOf = (active: number, happy: number) => {
    let r = 1150;
    // ---- guests -------------------------------------------------------------
    r -= 150 - Math.min(2000, active) / 13; // -150 .. +3 over 0..2000 (:391)
    r -= 500; // (:410)
    if (active > 0) r += 2 * Math.min(250, Math.floor((happy * 300) / active)); // (:415)
    // ---- rides --------------------------------------------------------------
    let uptime = 0;
    let rated = 0;
    let totExc = 0;
    let totInt = 0;
    for (const ride of s.rides) {
      // RCT2 sums `100 - ride.downtime` (:441). This sim has no downtime
      // history, but it does know the ride's live state: open = 100, broken
      // down / being repaired = 25, crashed = 0.
      uptime += ride.state === 'crashed' ? 0 : ride.brokenAt >= 0 ? 25 : 100;
      const rt = ride.cfg.ratings;
      if (!rt) continue; // RCT2's `RideHasRatings` gate (:435)
      totExc += (rt.excitement * 100) / 8; // (:437-438)
      totInt += (rt.intensity * 100) / 8;
      rated += 1;
    }
    r -= 200;
    if (s.rides.length > 0) r += (uptime / s.rides.length) * 2; // (:443-445)
    r -= 100;
    if (rated > 0) {
      // the "well-balanced fleet" bonus: RCT2's reference park averages
      // excitement/8 = 46 and intensity/8 = 65, and every step away from that
      // costs half a point, capped at 50 each (:449-467)
      const aE = Math.min(Math.abs(totExc / rated - 46) / 2, 50);
      const aI = Math.min(Math.abs(totInt / rated - 65) / 2, 50);
      r += 100 - aE - aI;
    }
    r -= 200 - (Math.min(1000, totExc) + Math.min(1000, totInt)) / 10; // (:469-471)
    // ---- litter -------------------------------------------------------------
    r -= 600 - 4 * (150 - Math.min(150, s.fx.litter.length));
    return Math.max(0, Math.min(999, Math.round(r)));
  };

  /** RCT2's suggestedGuestMaximum — Σ BonusValue over OPEN, unbroken rides
   *  (Park.cpp:107-140: closed / broken down / crashed rides contribute 0) */
  const suggestedMaxOf = () => {
    let sum = 0;
    for (const r of s.rides) {
      if (r.state === 'crashed' || r.brokenAt >= 0) continue;
      sum += bonusOf(r.intensity);
    }
    return sum;
  };

  /** calculateGuestGenerationProbability (Park.cpp:168-218), out of 0xFFFF */
  const probabilityOf = (rate: number, numGuests: number, sugg: number) => {
    let p = 50 + Math.max(0, Math.min(650, rate - 200));
    // "The more guests, the lower the chance of a new one" (:173-183)
    if (numGuests > sugg) p = Math.floor(p / 4);
    return p;
  };

  const activeCount = () => {
    let n = 0;
    for (const g of s.guests) if (!g.gone) n += 1;
    return n;
  };

  const recalc = () => {
    let active = 0;
    let happy = 0;
    for (const g of s.guests) {
      if (g.gone) continue;
      active += 1;
      if (g.happiness > HAPPY_AT) happy += 1;
    }
    rating = parkRatingOf(active, happy);
    suggestedMax = suggestedMaxOf();
    // RCT2 counts guests IN the park plus those heading for it (:174); here the
    // walk-in from the gate is already an active guest, so `active` is both.
    probability = probabilityOf(rating, active, suggestedMax);
    return active;
  };

  /** the per-frame pass — called from `update` AFTER the guest pass, so a
   *  guest who despawned this frame has already freed their slot */
  const update = (d: number) => {
    if (!enabled || !s.parkEntrance) return;
    sinceCalc += d;
    if (sinceCalc >= RECALC_EVERY) {
      sinceCalc %= RECALC_EVERY;
      recalc();
    }
    acc += d;
    // roll once per RCT2 tick of elapsed SIM time (dt-independent, so the
    // 1/30 smoke loop and the render loop agree)
    while (acc >= ROLL_EVERY) {
      acc -= ROLL_EVERY;
      rollN += 1;
      // HARD ceiling: a full park stops admitting. `leavingPark` guests free
      // their slot the moment they despawn (needs.ts `despawn` sets `gone`),
      // so the population BREATHES at the cap instead of ratcheting.
      if (activeCount() >= cap) continue;
      if (Math.floor(hash01(rollN * 7.13 + 37.77) * 0x10000) < probability) {
        s.spawn.spawnGuests(1);
        arrived += 1;
      }
    }
  };

  /** live snapshot for `stats()` / probes — `perMinute` is the expected
   *  arrival rate at the current probability (rolls run at RCT2's 40/s) */
  const snapshot = () => ({
    parkRating: rating,
    guestGenerationProbability: probability,
    arrivalsPerMinute: +((probability / 0x10000) * RCT2_TICKS_PER_SEC * 60).toFixed(2),
    suggestedGuestMaximum: suggestedMax,
    guestCap: cap,
    arrivals: arrived,
    gateStream: enabled && !!s.parkEntrance,
  });

  return { update, snapshot, recalc, parkRatingOf, probabilityOf, cap, enabled };
}
