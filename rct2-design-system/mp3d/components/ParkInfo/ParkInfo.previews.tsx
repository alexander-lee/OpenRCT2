import React, { useState } from 'react';
import { ParkInfo, ParkInfoManager } from './index';
import { Stage, StageApi, box, cyl } from '../Stage';
import { createGameManager } from '../GameManager';

// Live demo: three placeholder flat rides run by one GameManager, the Park
// Information window anchored bottom-right (collapsible — both mandatory per
// rules/ui.md). Clicking a row teleports the main orbit camera to a vantage
// of that ride via api.setCameraPose. autoRotate is off so the teleported
// pose holds (orbit dragging still works).
function ParkInfoDemo() {
  const [live, setLive] = useState<{ api: StageApi; mgr: ParkInfoManager } | null>(null);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Stage
        height={420}
        distance={14}
        targetY={0.4}
        autoRotate={false}
        build={(t, g, api) => {
          const mgr = createGameManager(t);
          g.add(mgr.group);

          // three podium spinners at spread-out plots, varied breakdown cycles
          type THREEGroup = InstanceType<typeof t.Group>;
          const plots: { name: string; x: number; z: number; every: number; tint: number }[] = [
            { name: 'Whirligig', x: -4.6, z: -2.4, every: 24, tint: 0x7d2e28 },
            { name: 'Orbiter', x: 4.8, z: -2.0, every: 44, tint: 0x2c5a7d },
            { name: 'Spin Doctor', x: 0.4, z: 4.6, every: 64, tint: 0x4a7d2e },
          ];
          const spins: { spin: number; target: number; angle: number; rotor: THREEGroup }[] = [];
          plots.forEach((p, i) => {
            const padTop = 0.22;
            g.add(cyl(t, 1.05, 1.15, padTop + 0.3, 0x9a978e, [p.x, (padTop - 0.3) / 2 + 0.11, p.z], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 24 }));
            g.add(cyl(t, 0.08, 0.11, 0.5, 0x4a4e55, [p.x, padTop + 0.25, p.z], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 12 }));
            const rotor = new t.Group();
            rotor.position.set(p.x, padTop + 0.5, p.z);
            rotor.add(cyl(t, 0.85, 0.95, 0.1, 0x2c4a66, [0, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.4, rough: 0.5, seg: 24 }));
            for (let k = 0; k < 4; k += 1) {
              const a = (k / 4) * Math.PI * 2;
              rotor.add(box(t, [0.3, 0.24, 0.3], p.tint, [Math.cos(a) * 0.62, 0.16, Math.sin(a) * 0.62], { rough: 0.7 }));
            }
            g.add(rotor);
            const s = { spin: 0, target: 0.15, angle: 0, rotor };
            spins.push(s);
            // queue lane runs outward from the park centre past the podium
            const m = Math.hypot(p.x, p.z) || 1;
            const dir: [number, number] = [p.x / m, p.z / m];
            mgr.registerRide({
              name: p.name,
              capacity: 4,
              rideDuration: 5,
              intensity: 3 + i,
              minWait: 2,
              maxWait: 6,
              breakdownEvery: p.every, // staggered so dots differ over time
              queueAnchor: [p.x + dir[0] * 2.0, 0, p.z + dir[1] * 2.0],
              queueDir: dir,
              boardPoint: [p.x, padTop + 0.1, p.z],
              exitPoint: [p.x - dir[1] * 2.2, 0, p.z + dir[0] * 2.2],
              seatWorld: (k) => {
                const a = (k / 4) * Math.PI * 2 - s.angle;
                return [p.x + Math.cos(a) * 0.62, padTop + 0.52, p.z + Math.sin(a) * 0.62, Math.atan2(Math.cos(a), Math.sin(a))];
              },
              onStateChange: (st) => {
                s.target = st === 'travelling' ? 2.4 : 0.15;
              },
            });
          });
          mgr.spawnGuests(12, { x: 0, z: 0, r: 3.2 });
          if (api) setLive({ api, mgr });

          let last = 0;
          return (time) => {
            const dt = Math.min(Math.max(time - last, 0), 1 / 15);
            last = time;
            spins.forEach((s) => {
              s.spin += (s.target - s.spin) * Math.min(1, dt * 2);
              s.angle += s.spin * dt;
              s.rotor.rotation.y = s.angle;
            });
            mgr.update(time, dt);
          };
        }}
      />
      {live && <ParkInfo manager={live.mgr} api={live.api} />}
    </div>
  );
}

const previews = {
  componentName: 'ParkInfo',
  importPath: 'components/ParkInfo',
  previews: [
    {
      name: 'Park roster with click-to-view teleport',
      description:
        'The Park Information window (bottom-right anchored, collapsible — both mandatory per rules/ui.md) listing three live GameManager rides: each row shows an RCT2-coded status dot (green Open, red Broken down, amber Being repaired — the rides run staggered deterministic breakdown cycles), the ride name and queue count. Clicking a row teleports the main orbit camera to a vantage of that ride via api.setCameraPose; drag to orbit from there.',
      render: () => <ParkInfoDemo />,
    },
  ],
};

export default previews;
