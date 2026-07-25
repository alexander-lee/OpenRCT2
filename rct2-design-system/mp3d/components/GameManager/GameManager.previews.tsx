import React, { useState } from 'react';
import * as THREE from 'three';
import { Stage, box, cyl } from '../Stage';
import type { StageApi } from '../Stage';
import { RideViewer } from '../RideViewer';
import { GuestInfo } from '../GuestInfo';
import type { GuestInfoRecord } from '../GuestInfo';
import { buildPathNetwork } from '../PathNetwork';
import { buildParkEntrance } from '../ParkEntrance';
import { buildRestroom } from '../Restroom';
import { buildBalloonStand } from '../BalloonStand';
import { buildFountain } from '../Fountain';
import { createGameManager, T } from './index';

// The interactive sim demo lives HERE (previews own the Stage; index.tsx
// exports only the imperative sim API — components never render a <Stage>).
// ---------------------------------------------------------------------------
// Preview: a full miniature park loop — a PathNetwork octagon with a crossbar
// and five spurs (queue tail / ride exit / stall front / park gate / restroom
// door), one placeholder spinning-disc ride with entrance + exit huts and
// queue, a drinks kiosk, two litter bins, a ParkEntrance gate as the SOLE
// spawn (14 guests stream in through the archway, staggered, and leavers file
// back out under it), a registered Restroom hut guests actually use, plus a
// BalloonStand and Fountain for ambience. Guests walk ONLY on the paths,
// queue, ride seated, buy drinks (visible held cup + drink cycle), litter and
// bin their rubbish. Deterministic.
// CLICKABILITY (rules/ui.md): the ride's visual group carries
// `userData.rideRef` (its registerRide handle) and every guest group carries
// `userData.guestRef` (a live record accessor) — Stage.onPick raycasts clicks
// to them, so clicking the ride opens a RideViewer and clicking a guest a
// live GuestInfo (one window at a time). No auto-rotate: the camera holds
// still (drag / arrow keys navigate) so windows and picking stay usable.
// ---------------------------------------------------------------------------

/** GuestInfo over a LIVE accessor (userData.guestRef): re-polls ~4×/s and
 *  closes itself when the guest despawns through the gate. */
function LiveGuestInfo({ accessor, onClose }: { accessor: () => GuestInfoRecord & { gone?: boolean }; onClose: () => void }) {
  const [, setTick] = useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const rec = accessor();
  React.useEffect(() => {
    if (rec.gone) onClose();
  }, [rec.gone, onClose]);
  return <GuestInfo guest={rec} onClose={onClose} />;
}

type PreviewPick =
  | { kind: 'ride'; handle: RideViewerHandle; vehicle?: THREE.Object3D }
  | { kind: 'guest'; accessor: () => GuestInfoRecord & { gone?: boolean } };

/** structural view of what RideViewer needs from a registerRide handle */
interface RideViewerHandle {
  name: string;
  status(): 'open' | 'closed' | 'brokenDown' | 'beingRepaired';
  queueLength(): number;
  occupancy(): { riders: number; capacity: number; occupied?: boolean };
  boardPoint(): [number, number, number];
  totalRides?(): number;
}

function GameManagerDemo() {
  const [api, setApi] = useState<StageApi | null>(null);
  const [picked, setPicked] = useState<PreviewPick | null>(null);
  return (
    <div style={{ position: 'relative' }}>
    <Stage
      distance={12.5}
      targetY={0.3}
      autoRotate={false}
      build={(t, g, stageApi) => {
        // ---- path network: octagon loop + crossbar + 3 spurs -----------------
        const R = 2.7;
        const K = 1.91;
        const nodes: [number, number][] = [
          [0, -R], // 0 south (spawn / park gate)
          [K, -K], // 1
          [R, 0], // 2 east
          [K, K], // 3
          [0, R], // 4 north
          [-K, K], // 5
          [-R, 0], // 6 west
          [-K, -K], // 7
          [0, 0], // 8 centre
          [-4.2, 2.9], // 9 spur -> queue tail
          [-3.0, -3.6], // 10 spur -> ride exit
          [3.2, 0.6], // 11 spur -> stall front
          [0, -3.55], // 12 spur -> park gate archway
          [1.35, 3.1], // 13 spur -> restroom door
        ];
        const edges: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
          [6, 8], [8, 2], // crossbar
          [5, 9], [7, 10], [2, 11], [0, 12], [3, 13], // spurs
        ];
        const net = { nodes, edges };
        const paths = buildPathNetwork(t, net, { width: 1.0 });
        g.add(paths.group);

        // ---- placeholder flat ride: podium + column + spinning disc ----------
        // podium clearance arithmetic (vs the entrance hut at (-4.2, -1.62),
        // rect half 0.55×0.5): nearest hut corner (-4.75, -2.12) is
        // hypot(1.15, 0.48) = 1.246 from the podium centre — clear of the
        // 1.15 base radius by ~0.10. boardPoint (-5.3, -2.4) sits 0.63 in
        // from the centre, on the podium top (r 1.05).
        const rx = -5.9;
        const rz = -2.6;
        const padTop = 0.22;
        // one visual group per ride so a click anywhere on it picks the ride
        const rideGroup = new t.Group();
        rideGroup.add(cyl(t, 1.05, 1.15, padTop + 0.3, 0x9a978e, [rx, (padTop - 0.3) / 2 + 0.11, rz], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 24 }));
        rideGroup.add(cyl(t, 0.08, 0.11, 0.5, 0x4a4e55, [rx, padTop + 0.25, rz], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 12 }));
        const rotor = new t.Group();
        rotor.position.set(rx, padTop + 0.5, rz);
        rotor.add(cyl(t, 0.85, 0.95, 0.1, 0x2c4a66, [0, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.4, rough: 0.5, seg: 24 }));
        for (let k = 0; k < 4; k += 1) {
          const a = (k / 4) * Math.PI * 2;
          rotor.add(box(t, [0.3, 0.24, 0.3], 0x7d2e28, [Math.cos(a) * 0.62, 0.16, Math.sin(a) * 0.62], { rough: 0.7 }));
        }
        rideGroup.add(rotor);
        g.add(rideGroup);

        // ---- drinks kiosk: simple awning box (shops proper live elsewhere) ---
        const kiosk = new t.Group();
        kiosk.position.set(3.9, 0, 0.6);
        kiosk.rotation.y = Math.atan2(-1, 0); // serving front faces -x, toward the path
        kiosk.add(box(t, [1.0, 0.06, 0.9], 0x9a978e, [0, 0.03, 0], { tex: 'concrete', repeat: [3, 3], rough: 0.95 }));
        kiosk.add(box(t, [0.9, 0.8, 0.75], 0xe8e2d2, [0, 0.46, 0], { tex: 'wood', repeat: [3, 2], rough: 0.9 }));
        kiosk.add(box(t, [0.86, 0.3, 0.06], 0x18445c, [0, 0.62, 0.38], { tex: 'fabric', repeat: [4, 2], rough: 0.7 })); // hatch shade
        kiosk.add(box(t, [0.94, 0.07, 0.24], 0xd8d2c0, [0, 0.44, 0.44], { tex: 'wood', repeat: [3, 1], rough: 0.85 })); // counter
        // striped awning: back tips embedded in the cabin roof edge, front edge
        // carried by two grounded posts — attached at both ends, never floating
        for (let s = 0; s < 5; s += 1) {
          kiosk.add(box(t, [0.2, 0.05, 0.45], s % 2 ? 0xe8e2d2 : 0x2f6fd0, [(s - 2) * 0.2, 0.8, 0.575], { rough: 0.8, rotX: 0.35 }));
        }
        [-1, 1].forEach((s) => kiosk.add(cyl(t, 0.02, 0.02, 0.75, 0x4a4e55, [s * 0.38, 0.375, 0.72], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 8 })));
        g.add(kiosk);

        // ---- bins: manager tracks logic; the preview places the meshes -------
        // both stand ON the paving (bases at slab-top / junction-pad height,
        // RCT2 bins live on path tiles), never sunk to grass level below it
        const binPts: [number, number][] = [
          [2.62, -1.05],
          [0.3, 3.0],
        ];
        const binBase = [0.0915, 0.096]; // edge-slab top / node-4 junction-pad top
        binPts.forEach(([bx, bz], bi) => {
          g.add(cyl(t, 0.09, 0.08, 0.26, 0x24282c, [bx, binBase[bi] + 0.13, bz], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.6, seg: 12 }));
          g.add(cyl(t, 0.02, 0.095, 0.06, 0x24282c, [bx, binBase[bi] + 0.29, bz], { metal: 0.3, rough: 0.6, seg: 12 }));
        });

        // ---- the manager ------------------------------------------------------
        const mgr = createGameManager(t, { net, bins: binPts });
        g.add(mgr.group);

        let spin = 0;
        let spinTarget = 0.15;
        let angle = 0;
        const whirligig = mgr.registerRide({
          name: 'Whirligig',
          capacity: 4,
          rideDuration: 5,
          intensity: 4,
          price: 2,
          minWait: T(320), // 2 s
          maxWait: T(960), // 6 s — keeps the preview cycle lively
          queueAnchor: [-4.2, 0, -1.0],
          queueDir: [0, 1], // lane runs +z toward the spur at node 9
          boardPoint: [-5.3, padTop + 0.1, -2.4],
          exitPoint: [-3.9, 0, -3.0], // exit walk rejoins the spur at node 10
          // riders sit ON the disc's 4 seats and spin with it (visible
          // occupancy): seat top = padTop+0.78, guest feet sunk to +0.52
          seatWorld: (k) => {
            const a = (k / 4) * Math.PI * 2 - angle; // rotor.rotation.y = angle
            return [rx + Math.cos(a) * 0.62, padTop + 0.52, rz + Math.sin(a) * 0.62, Math.atan2(Math.cos(a), Math.sin(a))];
          },
          onStateChange: (s) => {
            // single-arg callback: occupancy second arg is additive/optional
            spinTarget = s === 'travelling' ? 2.4 : 0.15;
          },
        });
        // clickability: the visual group carries the registerRide handle
        rideGroup.userData.rideRef = whirligig;

        // click-pick wiring: ride -> RideViewer, guest -> live GuestInfo
        // (one window at a time; Stage.onPick walks up to the tagged group)
        if (stageApi) {
          setApi(stageApi);
          // static camera (no auto-rotate): frame the loop from behind the
          // gate with the ride on the left — drag / arrow keys still navigate
          stageApi.setCameraPose?.([5.2, 8.6, -8.6], [-0.6, 0.3, 0.4]);
          stageApi.onPick?.((obj) => {
            const ud = obj.userData as { rideRef?: RideViewerHandle; guestRef?: () => GuestInfoRecord & { gone?: boolean } };
            if (ud.rideRef) setPicked({ kind: 'ride', handle: ud.rideRef });
            else if (ud.guestRef) setPicked({ kind: 'guest', accessor: ud.guestRef });
          });
        }
        mgr.registerStall({
          name: 'Sunny Drinks',
          item: 'drink',
          price: 2,
          value: 4, // good value: +8 happiness target on purchase
          anchor: [3.9, 0, 0.6],
          dir: [-1, 0], // front point lands on the spur at node 11
        });

        // ---- park gate: the SOLE spawn — arrivals stream in via the arch ----
        // (archway attaches to the node-12 spur; leavers file back out here)
        const gate = buildParkEntrance(t);
        gate.group.position.set(0, 0, -3.75);
        gate.group.rotation.y = Math.PI; // park inside at world +z, outside -z
        g.add(gate.group);
        mgr.registerParkEntrance(gate); // reads the placed group's transform

        // ---- restroom: hut mesh placed HERE, logic registered on the manager
        const loo = buildRestroom(t);
        loo.group.position.set(1.35, 0, 4.0);
        loo.group.rotation.y = Math.PI; // door faces -z, onto the node-13 spur
        g.add(loo.group);
        mgr.registerRestroom({ anchor: [1.35, 0, 4.0], yaw: Math.PI });

        // ---- balloon stand: no longer just ambience — registered as a
        // SELLING accessory stall (item 'balloon', price 2, value 3): guests
        // route to the counter front, buy, and carry the balloon on a string
        // above a relaxed hand until it flies away (drop -> buoyant climb)
        const balloons = buildBalloonStand(t);
        balloons.group.position.set(3.7, 0, 2.6);
        balloons.group.rotation.y = Math.atan2(1.91 - 3.7, 1.91 - 2.6); // front toward node 3
        g.add(balloons.group);
        const bm = Math.hypot(1.91 - 3.7, 1.91 - 2.6);
        mgr.registerStall({
          name: 'Balloon Stand',
          item: 'balloon',
          price: 2,
          value: 3,
          anchor: [3.7, 0, 2.6],
          dir: [(1.91 - 3.7) / bm, (1.91 - 2.6) / bm],
        });
        const fountain = buildFountain(t);
        fountain.group.position.set(-1.5, 0, 4.9);
        fountain.group.scale.setScalar(0.8); // one-tile footprint for this plot
        g.add(fountain.group);

        mgr.spawnGuests(14); // all 14 arrive through the gate, staggered
        let totalSpawned = 14;
        let nextWave = 30;

        // pre-warm 119 sim-s (fixed 1/30 substeps — deterministic): the park
        // opens IN FULL SWING — queues formed, drinks and balloons already
        // bought (held balloons visible from the first frame) and the first
        // hashed 60-120 s balloon lifetimes expiring into fly-aways within
        // seconds (first drops land at sim-t ~121-139 for this seed)
        const WARM = 119;
        for (let ts = 1 / 30; ts <= WARM; ts += 1 / 30) mgr.update(ts, 1 / 30);

        let last = 0;
        return (time) => {
          const dt = Math.min(Math.max(time - last, 0), 1 / 15);
          last = time;
          // fresh arrival waves through the gate as guests go home (bounded so
          // the hidden despawned-peep pool never grows past 42 guests total)
          if (time >= nextWave) {
            nextWave = time + 12;
            if (totalSpawned < 42 && mgr.stats().activeGuests < 9) {
              mgr.spawnGuests(4);
              totalSpawned += 4;
            }
          }
          spin += (spinTarget - spin) * Math.min(1, dt * 2);
          angle += spin * dt;
          rotor.rotation.y = angle;
          paths.update?.(time);
          fountain.update(time);
          mgr.update(WARM + time, dt); // continue from the pre-warmed sim clock
        };
      }}
    />
      {api && picked?.kind === 'ride' && (
        <RideViewer ride={picked.handle} api={api} vehicle={picked.vehicle} onClose={() => setPicked(null)} />
      )}
      {api && picked?.kind === 'guest' && <LiveGuestInfo accessor={picked.accessor} onClose={() => setPicked(null)} />}
    </div>
  );
}


const previews = {
  componentName: 'GameManager',
  importPath: 'components/GameManager',
  previews: [
    {
      name: 'RCT2 guest simulation on a path network',
      description:
        'The full OpenRCT2-mechanics guest sim on a miniature park: a PathNetwork loop with spurs, a ParkEntrance gate as the SOLE spawn (guests stream in through the archway, staggered, and leavers file back out under it), one placeholder spinning-disc ride (entrance/exit huts + red queue lane), a drinks kiosk, a registered Restroom hut guests actually walk into (hidden 2 s "relieving", toilet reset), two litter bins, a SELLING BalloonStand plus a Fountain. Guests walk ONLY on the paths (wander with straight bias, goal-route with 4-junction memory), carry RCT2 0-255 needs on the Tick128 cadence, join queues via real join checks (cash / intensity window / queue full / previous ride), grow unhappy past T(2000) in line and balk past T(4300). Boarding follows RCT2 PeepRideSubState: the queue-front guest walks INTO the entrance hut and vanishes, re-appears SEATED on one of the disc\'s four seats (spinning with the ride - visible occupancy, occupancy() on the ride handle), and after the movingToEndOfStation -> ... -> unloadingPassengers cycle files back out through the EXIT hut doorway - guests never walk on the ride itself. A placeAccess audit SAT-checks hut/lane/pad footprints at registration and auto-shifts a colliding exit along its pad edge. Guests buy drinks with RCT2 purchase checks and carry a VISIBLE held item (red cup + straw) with periodic tilt-up drink holds - food purchases get a burger puck and a repeated raise-to-mouth eat cycle with a head nod - then a crumpled grey container they drop as litter or bin. Guests carry at most ONE item PER HAND (two-hand registry): the balloon stand sells ACCESSORY balloons (+12 happiness, deterministic colour per guest) held on a string swaying above a RELAXED hand for a hashed 60-120 sim-s before they slip loose and FLY AWAY - accelerating buoyant climb, wind sway, slow spin, fading out ~8 u up (pooled, cap 10) while the ex-owner glances up sadly (-4 happiness); a guest with both hands full is refused with "My hands are full". The sim is pre-warmed 119 s so the loop is in full swing from the first frame, with the first fly-aways due within seconds. With no reachable restroom, a maxed toilet need falls back to a discreet capped poop mesh + embarrassment (poop counts double in the litter-blight check). NO mood orbs - mood reads from posture: head tilt, slump, shuffle, nausea stagger, springy bounce, "wow" hops. Fresh arrival waves keep the gate busy (bounded). Deterministic.',
      render: () => <GameManagerDemo />,
    },
  ],
};

export default previews;
