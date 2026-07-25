import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball } from '../Stage';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { HotDogStand } from './index';

// The stand sells REAL hot dogs through the GameManager consumable flow (the
// same live-sim vignette as the BalloonStand preview): a ScenePreview `dress`
// hook runs a miniature deterministic sim — small path loop, the stall
// registered at the counter front — at 2x time, PRE-WARMED so guests are
// already mid-loop on the first frame. The GameManager's stock held-food mesh
// is a burger, so every lazily-built `heldFood` hand group is re-dressed ONCE
// (deterministic meshes, userData-flagged) into a mini hot dog — bun halves,
// plump sausage, mustard stripe — matching the giant one on the roof.
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
        mgr.registerStall({ name: 'Hot Dogs', item: 'food', price: 3, value: 5, anchor: [0, 0, 0.28], dir: [0, 1] });
        mgr.spawnGuests(8);
        // re-dress stock burger hand-meshes into hot dogs: heldFood groups are
        // built lazily on each guest's FIRST food purchase, so sweep after
        // every sim step and convert any new ones exactly once
        const dressHeld = () => {
          const fresh: THREE.Object3D[] = [];
          mgr.group.traverse((o) => {
            if (o.name === 'heldFood' && !o.userData.hotdog) fresh.push(o);
          });
          fresh.forEach((h) => {
            h.userData.hotdog = true;
            h.clear();
            // fist-to-head sized to match the stock burger's new read at park
            // zoom, centred on the hold origin (in front of the closed fist)
            // bun trough lying across the hand (along local x), rounded ends
            h.add(cyl(t, 0.052, 0.052, 0.21, 0xd9a04c, [0, -0.012, 0], { rough: 0.8, seg: 10, rotZ: Math.PI / 2 }));
            [-0.105, 0.105].forEach((bx) => h.add(ball(t, 0.052, 0xd9a04c, [bx, -0.012, 0], { rough: 0.8 })));
            // plump sausage proud of the bun, stretched end caps
            h.add(cyl(t, 0.033, 0.033, 0.26, 0xa84222, [0, 0.036, 0], { tex: 'plastic', repeat: [4, 1], rough: 0.5, seg: 10, rotZ: Math.PI / 2 }));
            [-0.13, 0.13].forEach((bx) => {
              const cap = ball(t, 0.033, 0xa84222, [bx, 0.036, 0], { rough: 0.5 });
              cap.scale.x = 1.3;
              h.add(cap);
            });
            // mustard stripe along the top
            h.add(box(t, [0.225, 0.012, 0.021], 0xe8b414, [0, 0.071, 0], { rough: 0.22 }));
          });
        };
        // pre-warm (fixed 1/30 substeps, deterministic): guests are spread
        // around the loop with the purchase/eat cycle in full swing — the eat
        // chain lasts ~6.4 sim-s, so fresh buys land on-screen within seconds
        const WARM = 32;
        let simT = 0;
        while (simT < WARM) {
          simT += 1 / 30;
          mgr.update(simT, 1 / 30);
        }
        dressHeld(); // first frame already shows hot dogs, not burgers
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
          dressHeld();
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
        "Hot dog stand as a working composableStall: the stone kiosk with the giant roof dog (HOTDS) registered with a miniature GameManager sim (item 'food', price 3, value 5). Peckish guests on the path loop walk up to the serving front (local +z, 0.72 out from the counter), buy, and stroll off EATING — the held hand-mesh is re-dressed deterministically into a mini hot dog (bun halves, plump sausage, mustard stripe) matching the roof prop, lifted to the mouth on the eased bite-cycle arm overlay until only a crumpled container is left to throw away (RCT2 DecideAndBuyItem, Guest.cpp:1529). Pre-warmed + 2x time so buying and eating both show in one viewing. Deterministic.",
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
