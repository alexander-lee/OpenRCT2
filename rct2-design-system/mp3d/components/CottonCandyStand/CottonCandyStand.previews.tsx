import React from 'react';
import * as THREE from 'three';
import { cyl, ball } from '../Stage';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { CottonCandyStand } from './index';

// The stand sells REAL candy floss through the GameManager consumable flow
// (the same live-sim vignette as the BalloonStand preview): a ScenePreview
// `dress` hook runs a miniature deterministic sim — small path loop, the
// stall registered at the counter front — at 2x time, PRE-WARMED so guests
// are already mid-loop on the first frame. The GameManager's stock held-food
// mesh is a burger, so every lazily-built `heldFood` hand group is re-dressed
// ONCE (deterministic meshes, userData-flagged) into a floss cone — cream
// stick + pink fluff ball, matching the counter display cones — tilted
// forward off the forearm.
function CottonCandyStandDemo() {
  return (
    <ScenePreview
      distance={7.5}
      targetY={1.4}
      autoRotate={false}
      dress={(t, g, api) => {
        // frame the counter front with the path loop in the foreground
        api.setCameraPose?.([0, 4.8, 8.8], [0, 1.4, 1.2]);
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
        // the <CottonCandyStand> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. Anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 1.18 —
        // just clear of the counter slab edge (z 1.03), no clipping.
        mgr.registerStall({ name: 'Cotton Candy', item: 'food', price: 2, value: 4, anchor: [0, 0, 0.46], dir: [0, 1] });
        mgr.spawnGuests(8);
        // re-dress stock burger hand-meshes into floss cones: heldFood groups
        // are built lazily on each guest's FIRST food purchase, so sweep after
        // every sim step and convert any new ones exactly once
        const dressHeld = () => {
          const fresh: THREE.Object3D[] = [];
          mgr.group.traverse((o) => {
            if (o.name === 'heldFood' && !o.userData.floss) fresh.push(o);
          });
          fresh.forEach((h) => {
            h.userData.floss = true;
            h.clear();
            h.rotation.x = 0.45; // tip the cone forward, fluff clear of arm+hair
            // paper cone stick + pink fluff ball, the counter display recipe —
            // fist-to-head sized to match the stock burger's new read, riding
            // the hold origin in front of the closed fist
            h.add(cyl(t, 0.018, 0.044, 0.17, 0xf0e6d0, [0, 0.005, 0], { rough: 0.7, seg: 8 }));
            h.add(ball(t, 0.095, 0xecb0c8, [0, 0.155, 0], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.95 }));
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
        dressHeld(); // first frame already shows floss cones, not burgers
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
      <CottonCandyStand />
    </ScenePreview>
  );
}

const previews = {
  componentName: 'CottonCandyStand',
  importPath: 'components/CottonCandyStand',
  previews: [
    {
      name: 'Selling candy floss (live sim)',
      description:
        "Cotton candy stand as a working composableStall: the giant floss cloud (CNDYF) registered with a miniature GameManager sim (item 'food', price 2, value 4). Peckish guests on the path loop walk up to the serving front (local +z, 0.72 out from the counter), buy, and stroll off EATING — the held hand-mesh is re-dressed deterministically into a floss cone (cream stick + pink fluff, the counter display recipe) tilted forward off the forearm, lifted to the mouth on the eased bite-cycle arm overlay until only a crumpled container is left to throw away (RCT2 DecideAndBuyItem, Guest.cpp:1529). Pre-warmed + 2x time so buying and eating both show in one viewing. Deterministic.",
      render: () => <CottonCandyStandDemo />,
    },
    {
      name: '3D rig',
      description: "Cotton candy stand: a giant fluffy pink floss cloud with a hatch (CNDYF).",
      render: () => (
        <ScenePreview distance={5.6} targetY={0.85} autoRotate={false}>
          <CottonCandyStand withGuest />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
