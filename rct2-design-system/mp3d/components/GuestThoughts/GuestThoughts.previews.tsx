import React, { useState } from 'react';
import { GuestThoughts } from './index';
import { ParkInfo, ParkInfoManager } from '../ParkInfo';
import { Stage, StageApi, box, cyl } from '../Stage';
import { createGameManager } from '../GameManager';

// Live demo: one GameManager runs two placeholder spinners + 14 guests whose
// needs/ride reactions write real thoughts; the Guest Thoughts window opens
// ALREADY VISIBLE (plus the ParkInfo window bottom-right whose "Guest
// thoughts" button is the real entry point — press it to toggle this window).
type Manager = ReturnType<typeof createGameManager>;

function GuestThoughtsDemo() {
  const [live, setLive] = useState<{ api: StageApi; mgr: Manager } | null>(null);
  const [open, setOpen] = useState(true);
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
          type THREEGroup = InstanceType<typeof t.Group>;
          const plots: { name: string; x: number; z: number; every: number; tint: number }[] = [
            { name: 'Whirligig', x: -4.6, z: -2.4, every: 22, tint: 0x7d2e28 },
            { name: 'Orbiter', x: 4.8, z: -2.0, every: 48, tint: 0x2c5a7d },
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
            const m = Math.hypot(p.x, p.z) || 1;
            const dir: [number, number] = [p.x / m, p.z / m];
            mgr.registerRide({
              name: p.name,
              capacity: 4,
              rideDuration: 5,
              intensity: 3 + i * 3,
              price: 6, // some guests refuse ("I can't afford that" thoughts)
              minWait: 2,
              maxWait: 6,
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
          mgr.spawnGuests(14, { x: 0, z: 0, r: 3.2 });
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
      {live && open && <GuestThoughts manager={live.mgr} onClose={() => setOpen(false)} />}
      {live && <ParkInfo manager={live.mgr as ParkInfoManager} api={live.api} />}
    </div>
  );
}

const previews = {
  componentName: 'GuestThoughts',
  importPath: 'components/GuestThoughts',
  previews: [
    {
      name: 'Summarised guest thoughts (RCT2 Guest List view)',
      description:
        "The RCT2 Guest List window's summarised-thoughts view on UIWindow chrome: every in-park guest's freshest thought is tallied into one row — up to four overlapping pixel emotion faces (UIIcons), the quoted thought text, and a right-aligned 'N guests' count — sorted most-common-first, exactly like openrct2-ui/windows/GuestList.cpp RefreshGroups/DrawScrollSummarised. Polls manager.guests() every 500 ms. Two live spinners plus needs pressure generate real thoughts (queue moans, can't-afford refusals, ride reactions). The bottom-right ParkInfo window carries the real ENTRY POINT — its 'Guest thoughts' button toggles this window.",
      render: () => <GuestThoughtsDemo />,
    },
  ],
};

export default previews;
