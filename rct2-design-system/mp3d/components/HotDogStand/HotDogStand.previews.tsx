import React from 'react';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { HotDogStand, buildHeldHotDog } from './index';

// The stand sells REAL hot dogs through the GameManager consumable flow (the
// same live-sim vignette as the BalloonStand preview): a ScenePreview `dress`
// hook runs a miniature deterministic sim — small path loop, the stall
// registered at the counter front — at 2x time, PRE-WARMED so guests are
// already mid-loop on the first frame. The mini hot dog buyers carry is the
// stall's OWN `heldItem` recipe (buildHeldHotDog, exported from ./index and
// registered on the stall descriptor), so what this preview shows is exactly
// what a real park shows — no preview-only mesh surgery.
function HotDogStandDemo() {
  return (
    <ScenePreview
      distance={7.5}
      targetY={1.4}
      autoRotate={false}
      dress={(t, g, api) => {
        // frame the counter front with the path loop in the foreground
        api.setCameraPose?.([0, 4.8, 8.6], [0, 1.4, 1.2]);
        // small loop passing the counter front (stand at origin faces +z)
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
        // the <HotDogStand> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. Anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 1.0 —
        // just clear of the counter slab edge (z 0.85), no clipping.
        // ...with the stall's OWN held item, exactly as <HotDogStand register>
        // does inside a real <Park> (the descriptor carries buildHeldHotDog)
        mgr.registerStall({ name: 'Hot Dogs', item: 'food', price: 3, value: 5, anchor: [0, 0, 0.28], dir: [0, 1], heldItem: buildHeldHotDog });
        // ...and the cohort is spawned ALREADY PECKISH. A fresh RCT2
        // arrival is well fed — hunger spawns at 177-255 on the INVERTED 0-255
        // scale — and the counter refuses food above hunger 75 (RCT2's own
        // DecideAndBuyItem gate), which on the RCT2-faithful 512-tick needs
        // clock is ~163 sim-s of walking before anyone may buy at all: longer
        // than this whole vignette, so the cart stood idle. The needs RATES are
        // correct and deliberately untouched; a STAGED vignette seeds the state
        // it exists to demonstrate. The band is wide on purpose — the hungriest
        // guests buy during the pre-warm and are already eating on frame 1, the
        // fed end of it crosses the seek threshold while the preview plays, so
        // fresh sales keep landing on screen.
        mgr.spawnGuests(8, undefined, { hunger: [4, 48] });
        // pre-warm (fixed 1/30 substeps, deterministic): 32 sim-s is enough for
        // the hungriest of the staged cohort to have bought and be eating on
        // frame 1, with the rest still working their way to the counter, so the
        // sales keep coming while the preview plays
        const WARM = 32;
        let simT = 0;
        while (simT < WARM) {
          simT += 1 / 30;
          mgr.update(simT, 1 / 30);
        }
        // HARNESS PROBE (never called by the page, no visual cost): the live
        // stall roster + guest records, so a headless run can ASSERT this
        // vignette actually trades (sold > 0, items in hands) instead of
        // eyeballing a screenshot.
        g.userData.stallProbe = () => ({ simT, stalls: mgr.stalls(), guests: mgr.guests() });
        // then run at 2x in fixed substeps — a full walk-up -> buy -> eat ->
        // bin/litter cycle fits one viewing without rushing the walk cycles
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
      <HotDogStand />
    </ScenePreview>
  );
}

const previews = {
  componentName: 'HotDogStand',
  importPath: 'components/HotDogStand',
  previews: [
    {
      name: 'Selling hot dogs (live sim)',
      description:
        "Hot dog stand as a working composableStall: the stone kiosk with the giant roof dog (HOTDS) registered with a miniature GameManager sim (item 'food', price 3, value 5). Peckish guests on the path loop walk up to the serving front (local +z, 0.72 out from the counter), buy, and stroll off EATING — the item in their hand is the stall's OWN 3D hot dog (bun trough, plump sausage, mustard stripe — StallConfig.heldItem, the same mesh a real park serves), lifted to the mouth on the eased bite-cycle arm overlay until only a crumpled container is left to throw away (RCT2 DecideAndBuyItem, Guest.cpp:1529). Pre-warmed + 2x time so buying and eating both show in one viewing. Deterministic.",
      render: () => <HotDogStandDemo />,
    },
    {
      name: '3D rig',
      description: "Hot dog stand: stone kiosk, striped awning, giant hot dog on the roof (HOTDS).",
      render: () => (
        <ScenePreview distance={4.8} targetY={0.8}>
          <HotDogStand withGuest />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
