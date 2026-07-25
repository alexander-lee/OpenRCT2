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
import { hash01, GUEST_SCALE, NEEDS_TICK, BITE_GAP } from './types';
import type { SimGuest, WayPt } from './types';
import type { Sim } from './sim';

export function createSpawn(s: Sim) {
  const { t, group, net, routing, walkY, groundAt, nodeXZ, guests, coreEdgeCount } = s;

  // ---- guests ----------------------------------------------------------------
  // With a registered park entrance, `area` is optional: EVERY guest arrives
  // at the gate's spawnPoint (staggered), walks in through the archway and
  // only then wanders the network. Without one, the old behaviour remains.
  const spawnGuests = (count: number, area?: { x: number; z: number; r: number }) => {
    const home = area ?? { x: s.parkEntrance ? s.parkEntrance.arch.x : 0, z: s.parkEntrance ? s.parkEntrance.arch.z : 0, r: 3 };
    if (!s.parkEntrance) {
      s.spawnPt = { x: home.x, z: home.z };
      if (routing) s.spawnNode = routing.nearestNode(home.x, home.z);
    }
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
        entryDelay = k * 0.85;
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
        happiness: 204 + Math.floor(h(10) * 52),
        happinessTarget: 204 + Math.floor(h(10) * 52),
        hunger: 255 - Math.floor(h(11) * 78),
        thirst: 255 - Math.floor(h(12) * 78),
        energy: 204 + Math.floor(h(13) * 52),
        energyTarget: 204 + Math.floor(h(13) * 52),
        nausea: 0,
        toilet: Math.floor(h(15) * 78),
        cash: Math.floor(40 + h(16) * 90),
        intensityTolerance: 2 + Math.floor(h(17) * 8), // 2..9
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
        lastRide: null,
        lastRideT: -999,
        timeInQueue: 0,
        ridden: 0,
        exitDelay: 0,
        stall: null,
        bin: null,
        restroom: null,
        holding: null,
        eatHand: 'right',
        held: null,
        heldL: null,
        balloons: { left: null, right: null },
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
      const hitProxy = new t.Mesh(new t.CylinderGeometry(0.72, 0.72, 2.05, 6), new t.MeshBasicMaterial());
      hitProxy.position.y = 0.95;
      hitProxy.visible = false;
      peep.group.add(hitProxy);
    }
  };

  return { spawnGuests };
}
