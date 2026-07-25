import React from 'react';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { BurgerShop } from './index';

// The shop sells REAL burgers through the GameManager consumable flow (the
// same live-sim vignette as the BalloonStand preview): a ScenePreview `dress`
// hook runs a miniature deterministic sim — small path loop, the stall
// registered at the counter front — at 2x time, PRE-WARMED so guests are
// already mid-loop on the first frame. Peckish guests step off the path to
// the counter, buy (item 'food', price 3, value 5 — good-value happiness),
// then stroll on EATING: the held burger lifts to the mouth on the eased
// bite-cycle arm overlay until only a crumpled container is left to bin.
function BurgerShopDemo() {
  return (
    <ScenePreview
      distance={7.5}
      targetY={1.4}
      autoRotate={false}
      dress={(t, g, api) => {
        // frame the counter front with the path loop in the foreground
        api.setCameraPose?.([0, 4.6, 8.6], [0, 1.3, 1.2]);
        // small loop passing the counter front (shop at origin faces +z)
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
        // the <BurgerShop> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. Anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 1.38 —
        // just clear of the counter slab edge (z 1.23), no clipping.
        mgr.registerStall({ name: 'Burger Bar', item: 'food', price: 3, value: 5, anchor: [0, 0, 0.66], dir: [0, 1] });
        mgr.spawnGuests(8);
        // pre-warm (fixed 1/30 substeps, deterministic): guests are spread
        // around the loop with the purchase/eat cycle in full swing — the eat
        // chain lasts ~6.4 sim-s, so fresh buys land on-screen within seconds
        const WARM = 32;
        let simT = 0;
        while (simT < WARM) {
          simT += 1 / 30;
          mgr.update(simT, 1 / 30);
        }
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
      <BurgerShop />
    </ScenePreview>
  );
}

const previews = {
  componentName: 'BurgerShop',
  importPath: 'components/BurgerShop',
  previews: [
    {
      name: 'Selling burgers (live sim)',
      description:
        "Burger shop as a working composableStall: the giant sesame-bun building (BURGB) registered with a miniature GameManager sim (item 'food', price 3, value 5). Peckish guests on the path loop walk up to the serving front (local +z, 0.72 out from the counter), buy, and stroll off EATING — the held burger (bun dome, patty, base bun on the right-hand pivot) lifts to the mouth on the eased bite-cycle arm overlay with a nod into each bite, until only a crumpled container is left to throw away (RCT2 DecideAndBuyItem, Guest.cpp:1529). Pre-warmed + 2x time so buying and eating both show in one viewing. Deterministic.",
      render: () => <BurgerShopDemo />,
    },
    {
      name: '3D rig',
      description: "Burger shop: the building IS a giant sesame-bun burger with a serving hatch (BURGB).",
      render: () => (
        <ScenePreview distance={5.8} targetY={0.75} autoRotate={false}>
          <BurgerShop withGuest />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
