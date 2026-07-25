import React, { useEffect, useState } from 'react';
import { GuestInfo, GuestInfoRecord } from './index';
import { Stage, box, cyl } from '../Stage';
import { createGameManager } from '../GameManager';

type Mgr = ReturnType<typeof createGameManager>;

// Live demo: a small GameManager park (spinner ride + drinks kiosk), with the
// GuestInfo window locked onto Guest 1 — the wrapper polls manager.guests()
// every frame (rAF) so the mood line, the six stat bars and the thought ring
// track the live simulation.
function GuestInfoDemo() {
  const [mgr, setMgr] = useState<Mgr | null>(null);
  const [guest, setGuest] = useState<GuestInfoRecord | null>(null);

  useEffect(() => {
    if (!mgr) return;
    let raf = 0;
    const loop = () => {
      const rec = mgr.guests().find((g) => g.id === 0); // track Guest 1
      if (rec) setGuest(rec);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [mgr]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Stage
        height={400}
        distance={9.5}
        targetY={0.5}
        build={(t, g) => {
          // spinner ride (as in the RideViewer demo) so states/needs evolve
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
          // drinks kiosk box so thirsty guests buy (thoughts + happiness move)
          const kiosk = new t.Group();
          kiosk.position.set(3.4, 0, -1.6);
          kiosk.add(box(t, [0.9, 0.8, 0.75], 0xe8e2d2, [0, 0.46, 0], { tex: 'wood', repeat: [3, 2], rough: 0.9 }));
          kiosk.add(box(t, [0.94, 0.07, 0.24], 0xd8d2c0, [-0.5, 0.44, 0], { tex: 'wood', repeat: [3, 1], rough: 0.85, rotY: Math.PI / 2 }));
          g.add(kiosk);

          const manager = createGameManager(t);
          g.add(manager.group);
          let spin = 0;
          let spinTarget = 0.15;
          let angle = 0;
          manager.registerRide({
            name: 'Whirligig',
            capacity: 4,
            rideDuration: 5,
            intensity: 4,
            minWait: 2,
            maxWait: 6,
            queueAnchor: [2.0, 0, 1.5],
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
          manager.registerStall({ name: 'Sunny Drinks', item: 'drink', price: 2, value: 4, anchor: [3.4, 0, -1.6], dir: [-1, 0] });
          manager.spawnGuests(8, { x: 2.4, z: 2.6, r: 2.4 });
          setMgr(manager);

          let last = 0;
          return (time) => {
            const dt = Math.min(Math.max(time - last, 0), 1 / 15);
            last = time;
            spin += (spinTarget - spin) * Math.min(1, dt * 2);
            angle += spin * dt;
            rotor.rotation.y = angle;
            manager.update(time, dt);
          };
        }}
      />
      {guest && <GuestInfo guest={guest} onClose={() => setGuest(null)} />}
    </div>
  );
}

// One fixed guest record per emotion band — the same window six times, so the
// full pixel-face range (ecstatic → happy → neutral → unhappy → angry + the
// sick override at nausea 210) is visible at once. Deterministic, no sim.
const EMOTION_GUESTS: GuestInfoRecord[] = [
  { id: 1, name: 'Eddie Ecstatic', state: 'walking', happiness: 245, hunger: 200, thirst: 190, energy: 220, nausea: 20, toilet: 40, thoughts: ['That ride was great!', 'I love this park!'] },
  { id: 2, name: 'Hannah Happy', state: 'walking', happiness: 175, hunger: 160, thirst: 150, energy: 180, nausea: 35, toilet: 70, thoughts: ['What a nice day.'] },
  { id: 3, name: 'Norm Neutral', state: 'queuing', happiness: 120, hunger: 120, thirst: 110, energy: 130, nausea: 60, toilet: 110, thoughts: ["I've been queuing a while..."] },
  { id: 4, name: 'Ursula Unhappy', state: 'walking', happiness: 80, hunger: 60, thirst: 55, energy: 90, nausea: 90, toilet: 150, thoughts: ["I'm hungry.", "I'm thirsty."] },
  { id: 5, name: 'Angus Angry', state: 'leavingPark', happiness: 30, hunger: 40, thirst: 30, energy: 60, nausea: 70, toilet: 180, thoughts: ["I want to go home.", "This park is too expensive!"] },
  { id: 6, name: 'Greta Green', state: 'sitting', happiness: 150, hunger: 90, thirst: 80, energy: 70, nausea: 210, toilet: 120, thoughts: ["I feel sick.", 'That ride was too intense!'] },
];

function EmotionGallery() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 640, background: '#4a5a4a', borderRadius: 8 }}>
      {EMOTION_GUESTS.map((g, i) => (
        <GuestInfo key={g.id} guest={g} x={12 + (i % 3) * 288} y={12 + Math.floor(i / 3) * 310} />
      ))}
    </div>
  );
}

const previews = {
  componentName: 'GuestInfo',
  importPath: 'components/GuestInfo',
  previews: [
    {
      name: 'Guest window tracking a live guest',
      description:
        'The RCT2 Guest window (stats + thoughts tabs) on UIWindow chrome, locked onto Guest 1 of a live GameManager sim: the mood line leads with the LARGE pixel emotion face (emotionOf — it cycles live as happiness and nausea move), six bevelled stat bars mirror the RCT2 stats tab (happiness sweeps green to red, energy yellow, hunger/thirst inverted so the bar grows with the need, nausea sickly green, toilet brown) and the thoughts list shows the 5-slot ring latest-first, quoted. The wrapper polls manager.guests() every frame.',
      render: () => <GuestInfoDemo />,
    },
    {
      name: 'Emotion face range',
      description:
        'Six fixed guest records, one per emotion band: ecstatic (≥200), happy (≥160), neutral (≥96), unhappy (≥64), angry (<64), and the green sick face overriding at nausea ≥ 180 — each rendered large on the mood line of its own Guest window.',
      render: () => <EmotionGallery />,
    },
  ],
};

export default previews;
