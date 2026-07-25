import React from 'react';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { BalloonStand } from './index';

// The kiosk sells REAL balloons through the GameManager accessory flow: a
// ScenePreview `dress` hook runs a miniature deterministic sim (small path
// loop, the stall registered at the kiosk's front) at 2x time, PRE-WARMED so
// the loop is already in full swing on the first frame — guests stroll with
// balloons swaying above relaxed hands, others step up to the counter to buy,
// and every so often one balloon DROPS and climbs away with accelerating
// buoyancy, wind sway and a slow spin before fading out overhead.
function BalloonStandDemo() {
  return (
    <ScenePreview
      distance={7.5}
      targetY={1.4}
      autoRotate={false}
      dress={(t, g, api) => {
        // frame the counter front with the path loop in the foreground —
        // fly-aways climb through the upper half of the frame
        api.setCameraPose?.([0, 4.6, 8.4], [0, 1.5, 1.2]);
        // small loop passing the counter front (stall at origin faces +z)
        const nodes: [number, number][] = [
          [-3, 1.6], [0, 1.6], [3, 1.6], [3, 4.2], [0, 4.2], [-3, 4.2],
        ];
        const edges: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4],
        ];
        const net = { nodes, edges };
        const paths = buildPathNetwork(t, net, { width: 1.0 });
        g.add(paths.group);
        const mgr = createGameManager(t, { net });
        g.add(mgr.group);
        // the <BalloonStand> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself
        mgr.registerStall({ name: 'Balloon Stand', item: 'balloon', price: 2, value: 3, anchor: [0, 0, 0], dir: [0, 1] });
        mgr.spawnGuests(8);
        // pre-warm (fixed 1/30 substeps, deterministic): fast-forward to just
        // before the first hashed 60-120 s balloon lifetime expires (first
        // drop lands at sim-t ~100.7 for this seed), so held balloons read
        // immediately and a fly-away climbs the frame within seconds
        const WARM = 99;
        let simT = 0;
        while (simT < WARM) {
          simT += 1 / 30;
          mgr.update(simT, 1 / 30);
        }
        // then run at 2x in fixed substeps — a full purchase->hold->fly-away
        // lifecycle fits one viewing without rushing the walk cycles
        let last = 0;
        return (time) => {
          const dt = Math.min(Math.max(time - last, 0), 0.1);
          last = time;
          let step = dt * 2;
          while (step > 0) {
            const h = Math.min(step, 1 / 30);
            simT += h;
            mgr.update(simT, h);
            step -= h;
          }
          paths.update?.(time);
        };
      }}
    >
      <BalloonStand />
    </ScenePreview>
  );
}

const previews = {
  componentName: 'BalloonStand',
  importPath: 'components/BalloonStand',
  previews: [
    {
      name: 'Selling balloons (live sim)',
      description:
        "RCT2 balloon stall as a working composableStall: striped-canopy kiosk with its swaying 7-balloon bunch, registered with a miniature GameManager sim (item 'balloon', price 2, value 3). Guests on the path loop step up to the counter, buy, and walk off with a coloured balloon on a string swaying above a RELAXED hand (deterministic colour per guest from BALLOON_COLS); after a hashed 60-120 sim-s hold, the balloon slips loose and FLIES AWAY - accelerating buoyancy, wind sway, slow spin, fading out ~8 u up - while the guest glances up sadly (RCT2 blow-away: Guest.cpp:6951, Balloon.cpp:33). Pre-warmed + 2x time so the full buy/hold/fly-away loop shows in one viewing. Deterministic.",
      render: () => <BalloonStandDemo />,
    },
  ],
};

export default previews;
