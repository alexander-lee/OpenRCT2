// ---------------------------------------------------------------------------
// GUEST SPAWNING — builds each guest's <Guest> rig, its hashed appearance and
// its fresh-arrival RCT2 stat block, then places it either at the registered
// park entrance (the sole gate: staggered arrival, walk in through the
// archway, THEN join the network) or, with no gate, distributed along the
// path net's real edges / inside the fallback home disc.
//
// Every appearance pick, stat roll and phase offset is a hashed draw off the
// guest index, so a given seed always spawns the same crowd. Implementation
// detail of createGameManager.
// ---------------------------------------------------------------------------

import { buildPeep, SKIN_TONES, SHIRTS, TROUSERS, HAIRS } from '../Guest';
import type { Expression } from '../Guest';
import { hash01, GUEST_SCALE, NEEDS_TICK, BITE_GAP, GUEST_CASH_BASE, GUEST_CASH_STEP, GUEST_CASH_TIERS } from './types';
import type { SimGuest, WayPt, GuestSpawnStats } from './types';
import type { Sim } from './sim';

/** the opening cohort is all inside the park within this many sim-s (the
 *  gate-front stagger compresses to fit — see `gap` below) */
const OPENING_WINDOW = 20;

// ---- the OPTIONAL starting-stat override (GuestSpawnStats) -------------------
// `seeded(spec, rolled, h, sd, lo, hi)` returns the guest's value for one stat:
// the RCT2 roll the caller did NOT override, a fixed override, or a per-guest
// hashed draw inside an overridden `[min, max]` band.
//
// THE DEFAULT PATH IS UNTOUCHED BY CONSTRUCTION. `rolled` is evaluated by the
// caller exactly as before and returned verbatim when `spec` is undefined, and
// the extra draws use their OWN seeds (31+) off the same pure `hash01(i, sd)`
// generator — it carries no cursor, so an unused draw cannot shift any other
// roll. A `spawnGuests(n)` call with no third argument therefore produces
// bit-identical guests to the version before this option existed.
const seeded = (
  spec: number | [number, number] | undefined,
  rolled: number,
  h: (sd: number) => number,
  sd: number,
  lo: number,
  hi: number,
): number => {
  if (spec === undefined) return rolled;
  const v = typeof spec === 'number' ? spec : spec[0] + Math.floor(h(sd) * (spec[1] - spec[0] + 1));
  return Math.max(lo, Math.min(hi, Math.round(v)));
};

export function createSpawn(s: Sim) {
  const { t, group, net, routing, walkY, groundAt, nodeXZ, guests, coreEdgeCount } = s;

  // ---- guests ----------------------------------------------------------------
  // With a registered park entrance, `area` is optional: EVERY guest arrives
  // at the gate's spawnPoint (staggered), walks in through the archway and
  // only then wanders the network. Without one, the old behaviour remains.
  // THE GATE STREAM calls this with `count === 1` for each guest RCT2's
  // generation roll admits mid-session (arrivals.ts) — the walk-in is the same
  // one the opening cohort makes, so nothing is ever placed inside the park.
  // `stats` (ADDITIVE, optional) stages the cohort's STARTING NEEDS — see
  // GuestSpawnStats in types.ts for why previews need it and why passing
  // nothing is bit-identical to the pre-existing behaviour.
  const spawnGuests = (count: number, area?: { x: number; z: number; r: number }, stats?: GuestSpawnStats) => {
    const home = area ?? { x: s.parkEntrance ? s.parkEntrance.arch.x : 0, z: s.parkEntrance ? s.parkEntrance.arch.z : 0, r: 3 };
    if (!s.parkEntrance) {
      s.spawnPt = { x: home.x, z: home.z };
      if (routing) s.spawnNode = routing.nearestNode(home.x, home.z);
    }
    // OPENING STAGGER. The cohort files in through the arch one at a time,
    // 0.85 s apart — but an opening population is now ~50 on the default plot
    // (Park/parkRoot `guestsForSize`), and 50 x 0.85 s is 42 s of trickle
    // before the park is full. The gap therefore COMPRESSES so the whole
    // cohort is inside within OPENING_WINDOW; anything up to 23 guests keeps
    // the classic 0.85 s exactly (every reference park spawns 10-22, so their
    // sims stay bit-identical).
    const gap = count * 0.85 <= OPENING_WINDOW ? 0.85 : OPENING_WINDOW / count;
    for (let k = 0; k < count; k += 1) {
      const i = guests.length;
      const h = (sd: number) => hash01(i * 91.7 + sd * 17.31);
      const exprs: Expression[] = ['happy', 'neutral', 'happy', 'surprised', 'neutral'];
      const peep = buildPeep(t, {
        skin: SKIN_TONES[Math.floor(h(1) * SKIN_TONES.length)],
        shirt: SHIRTS[Math.floor(h(2) * SHIRTS.length)],
        trousers: TROUSERS[Math.floor(h(3) * TROUSERS.length)],
        hair: HAIRS[Math.floor(h(4) * HAIRS.length)],
        expression: exprs[Math.floor(h(5) * exprs.length)],
      });
      peep.group.scale.setScalar(GUEST_SCALE);
      peep.group.rotation.order = 'YXZ'; // yaw first so slump pitches in facing frame
      group.add(peep.group);

      let x: number;
      let z: number;
      let fromNode = 0;
      let toNode = -1;
      let u = 0;
      let entryDelay = 0;
      let yaw0 = h(8) * Math.PI * 2;
      const waypoints: WayPt[] = [];
      let netReentry: number | null = null;
      if (s.parkEntrance) {
        // sole spawn: appear (staggered) at the gate's spawnPoint, walk in
        // through the archway, THEN join the network and wander normally
        x = s.parkEntrance.spawn.x;
        z = s.parkEntrance.spawn.z;
        entryDelay = k * gap;
        yaw0 = Math.atan2(s.parkEntrance.arch.x - x, s.parkEntrance.arch.z - z);
        waypoints.push({
          x: s.parkEntrance.arch.x,
          z: s.parkEntrance.arch.z,
          y: routing ? walkY(s.parkEntrance.arch.x, s.parkEntrance.arch.z) : groundAt(s.parkEntrance.arch.x, s.parkEntrance.arch.z),
        });
        if (s.parkEntrance.attach) {
          fromNode = s.parkEntrance.attach.node;
          netReentry = s.parkEntrance.attach.node;
        }
      } else if (net && routing && coreEdgeCount > 0) {
        // distribute along hashed REAL edges (not logical spurs)
        const ei = Math.floor(h(6) * coreEdgeCount) % coreEdgeCount;
        const [a, b] = net.edges[ei];
        fromNode = a;
        toNode = b;
        u = 0.15 + h(7) * 0.7;
        const [ax, az] = nodeXZ(a);
        const [bx, bz] = nodeXZ(b);
        x = ax + (bx - ax) * u;
        z = az + (bz - az) * u;
      } else {
        const a = h(6) * Math.PI * 2;
        const r = Math.sqrt(h(7)) * home.r;
        x = home.x + Math.cos(a) * r;
        z = home.z + Math.sin(a) * r;
      }

      const baseY = s.parkEntrance ? s.parkEntrance.spawn.y : routing ? walkY(x, z) : groundAt(x, z);
      // the two stats that spawn EQUAL to their chase target, resolved once so
      // an override moves both halves together (an energy of 60 with a target
      // still at 230 would chase straight back up and undo the staging)
      const happiness0 = seeded(stats?.happiness, 204 + Math.floor(h(10) * 52), h, 31, 0, 255);
      const energy0 = seeded(stats?.energy, 204 + Math.floor(h(13) * 52), h, 32, 32, 255);
      peep.group.name = `guest-${i}`;
      peep.group.position.set(x, baseY, z);
      if (entryDelay > 0) peep.group.visible = false;
      const rec: SimGuest = {
        idx: i,
        peep,
        state: 'walking',
        gone: false,
        hidden: false,
        x,
        z,
        baseY,
        yaw: yaw0,
        phase: h(9) * Math.PI * 2,
        // fresh-arrival spawn stats (0-255 RCT2 scale, hashed per guest):
        // energy + happiness 80-100% (204-255); hunger/thirst/toilet NEEDS
        // 0-30% (0-77) — hunger/thirst are stored INVERTED like RCT2
        // (255 = sated, the UI bar draws 255 - value), so a 0-30% need is a
        // stored 178-255; toilet is stored directly; nausea starts at 0.
        // ...each one passed through `seeded`, which returns the RCT2 roll
        // verbatim unless THIS call staged that stat (GuestSpawnStats)
        happiness: happiness0,
        happinessTarget: happiness0,
        hunger: seeded(stats?.hunger, 255 - Math.floor(h(11) * 78), h, 33, 0, 255),
        thirst: seeded(stats?.thirst, 255 - Math.floor(h(12) * 78), h, 34, 0, 255),
        energy: energy0,
        energyTarget: energy0,
        nausea: 0,
        toilet: seeded(stats?.toilet, Math.floor(h(15) * 78), h, 35, 0, 255),
        // RCT2's cash roll: FOUR discrete tiers, not a smooth spread —
        // `cash = guestInitialCash + ((rand & 3) · £10) − £10` (Guest.cpp:7362),
        // so the £50 scenario default gives £40/£50/£60/£70. On this sim's
        // price scale (one coin ~ £0.40 — see GUEST_CASH_BASE) that is
        // 100/125/150/175 coins, against the old smooth 40-130.
        cash: seeded(stats?.cash, GUEST_CASH_BASE + Math.floor(h(16) * GUEST_CASH_TIERS) * GUEST_CASH_STEP, h, 36, 0, 1e9),
        intensityTolerance: seeded(stats?.intensityTolerance, 2 + Math.floor(h(17) * 8), h, 37, 0, 255), // 2..9
        fromNode,
        toNode,
        u,
        path: [],
        junctionMemory: [],
        goal: null,
        waypoints,
        netReentry,
        resume: null,
        target: null,
        home: { ...home },
        ride: null,
        station: null,
        boardStation: 0,
        lastRide: null,
        lastRideT: -999,
        riddenIds: new Set<number>(),
        timeInQueue: 0,
        ridden: 0,
        exitDelay: 0,
        stall: null,
        bin: null,
        restroom: null,
        bench: null,
        sitW: 0,
        benchT: -999,
        holding: null,
        eatHand: 'right',
        held: null,
        heldL: null,
        heldCustom: null,
        balloons: { left: null, right: null },
        worn: null,
        glanceUpUntil: -999,
        eatN: 0,
        containerSince: -999,
        biteGap: BITE_GAP,
        nextBiteAt: 0,
        lastBiteAt: -999,
        eatK: 0,
        eatArm: null,
        lapW: 0,
        litterUpsetT: -999,
        fling: null,
        squatT: 0,
        vomitT: 0,
        sickUntil: -1,
        entryDelay,
        hopArmed: false,
        despawnAtWpEnd: false,
        timer: 0,
        acc128: h(18) * NEEDS_TICK, // stagger Tick128 phases
        tick128N: 0,
        lastSec: -1,
        decN: 0,
        action: null,
        headTilt: 0,
        slump: 0,
        moving: false,
        thoughts: [],
        lastThoughtAt: -999,
      };
      guests.push(rec);
      // clickability (rules/ui.md): the guest's visual group carries a LIVE
      // accessor — Stage.onPick finds it and a GuestInfo window can poll it
      peep.group.userData.guestRef = () => s.queries.recordOf(rec);
      // CLICK PROXY: peep limbs are thin, fast-moving raycast targets that
      // clicks slip through — a fat body capsule catches them instead. The
      // raycaster tests `visible: false` meshes (three walks every child and
      // Mesh.raycast never checks visibility), but the renderer skips them,
      // so the proxy costs nothing to draw. Local units: peep is ~1.8 tall
      // pre-GUEST_SCALE.
      // `userData.clickProxy` is the CONTRACT with Stage.onPick: the proxy is
      // allowed to be invisible, but it is a SECOND-PASS target — real geometry
      // at the clicked pixel always wins first. Without that flag this column
      // (0.72 wide around a ~0.2-wide body) sat nearer to the camera than the
      // guest actually under the cursor and stole their click on any busy path.
      const hitProxy = new t.Mesh(new t.CylinderGeometry(0.72, 0.72, 2.05, 6), new t.MeshBasicMaterial());
      hitProxy.name = 'guestClickProxy';
      hitProxy.position.y = 0.95;
      hitProxy.visible = false;
      hitProxy.userData.clickProxy = true;
      peep.group.add(hitProxy);
    }
  };

  return { spawnGuests };
}
