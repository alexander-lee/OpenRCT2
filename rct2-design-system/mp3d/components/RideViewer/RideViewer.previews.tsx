import React, { useState } from 'react';
import type * as THREE from 'three';
import { RideViewer, RideViewerRide } from './index';
import { Stage, StageApi, box, cyl } from '../Stage';
import { createGameManager } from '../GameManager';

// Live demo: a spinning placeholder flat ride run by the GameManager, with
// the RideViewer window polling its handle and an orbiting camera inset
// bottom-left. breakdownEvery keeps the deterministic breakdown cycle short
// so the status line visits Open -> Broken down -> Being repaired -> Open.
function RideViewerDemo() {
  const [live, setLive] = useState<{ api: StageApi; ride: RideViewerRide; vehicle: THREE.Object3D } | null>(null);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Stage
        height={400}
        distance={9.5}
        targetY={0.5}
        build={(t, g, api) => {
          // placeholder spinner: podium + column + 4-seat rotor disc
          const padTop = 0.22;
          g.add(cyl(t, 1.05, 1.15, padTop + 0.3, 0x9a978e, [0, (padTop - 0.3) / 2 + 0.11, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 24 }));
          g.add(cyl(t, 0.08, 0.11, 0.5, 0x4a4e55, [0, padTop + 0.25, 0], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 12 }));
          const rotor = new t.Group();
          rotor.position.set(0, padTop + 0.5, 0);
          rotor.add(cyl(t, 0.85, 0.95, 0.1, 0x2c4a66, [0, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.4, rough: 0.5, seg: 24 }));
          for (let k = 0; k < 4; k += 1) {
            const a = (k / 4) * Math.PI * 2;
            rotor.add(box(t, [0.3, 0.24, 0.3], 0x7d2e28, [Math.cos(a) * 0.62, 0.16, Math.sin(a) * 0.62], { rough: 0.7 }));
          }
          g.add(rotor);

          const mgr = createGameManager(t);
          g.add(mgr.group);
          let spin = 0;
          let spinTarget = 0.15;
          let angle = 0;
          const handle = mgr.registerRide({
            name: 'Whirligig',
            capacity: 4,
            rideDuration: 5,
            intensity: 4,
            minWait: 2,
            maxWait: 6,
            breakdownEvery: 26, // short deterministic cycle for the demo
            queueAnchor: [2.0, 0, 1.5], // entrance hut clears the 1.15-radius podium base
            queueDir: [0.6, 0.8],
            boardPoint: [0, padTop + 0.1, 0.6],
            exitPoint: [-1.7, 0, 1.5],
            seatWorld: (k) => {
              const a = (k / 4) * Math.PI * 2 - angle;
              return [Math.cos(a) * 0.62, padTop + 0.52, Math.sin(a) * 0.62, Math.atan2(Math.cos(a), Math.sin(a))];
            },
            onStateChange: (s) => {
              spinTarget = s === 'travelling' ? 2.4 : 0.15;
            },
          });
          mgr.spawnGuests(9, { x: 2.6, z: 3.0, r: 2.2 });
          // hand the first rotor seat to the window as the onboard-cam vehicle
          if (api) setLive({ api, ride: handle, vehicle: rotor.children[1] });

          let last = 0;
          return (time) => {
            const dt = Math.min(Math.max(time - last, 0), 1 / 15);
            last = time;
            spin += (spinTarget - spin) * Math.min(1, dt * 2);
            angle += spin * dt;
            rotor.rotation.y = angle;
            mgr.update(time, dt);
          };
        }}
      />
      {live && <RideViewer ride={live.ride} api={live.api} vehicle={live.vehicle} onClose={() => setLive(null)} />}
    </div>
  );
}

const previews = {
  componentName: 'RideViewer',
  importPath: 'components/RideViewer',
  previews: [
    {
      name: 'Ride window with live camera inset',
      description:
        'The RCT2 Ride window on UIWindow chrome over a live GameManager scene: colour-coded status line (green Open, red Broken down, amber Being repaired — the ride runs a short deterministic breakdown cycle), queue length, riders/capacity and total customers, plus the viewport-tab camera reborn as a bottom-left inset slowly orbiting the ride’s boardPoint via api.addViewport. Guests queue, board the spinning rotor and file out while the window polls the handle live.',
      render: () => <RideViewerDemo />,
    },
  ],
};

export default previews;
