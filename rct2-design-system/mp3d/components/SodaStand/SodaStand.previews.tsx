import React from 'react';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { SodaStand, buildHeldSoda } from './index';

// The stand sells REAL sodas through the GameManager consumable flow (the
// same live-sim vignette as the BalloonStand preview): a ScenePreview `dress`
// hook runs a miniature deterministic sim — small path loop, the stall
// registered at the counter front — at 2x time, PRE-WARMED so guests are
// already mid-loop on the first frame. Thirsty guests step off the path to
// the counter, buy (item 'drink', price 2, value 4 — good-value happiness),
// then stroll on DRINKING: the held red cup + straw (matching the giant can
// cluster) tips up on the eased swig-cycle arm overlay, head tilting back.
function SodaStandDemo() {
  return (
    <ScenePreview
      distance={7.5}
      targetY={1.4}
      autoRotate={false}
      dress={(t, g, api) => {
        // frame the counter front with the path loop in the foreground —
        // the camera rides a touch higher so the straw tops stay in frame
        api.setCameraPose?.([0, 5.2, 9.0], [0, 1.6, 1.2]);
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
        // the <SodaStand> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. Anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 0.97 —
        // just clear of the counter slab edge (z 0.82), no clipping.
        // ...with the stand's OWN held mini can (StallConfig.heldItem), exactly
        // as <SodaStand register> wires it inside a real <Park>
        mgr.registerStall({ name: 'Soda Stand', item: 'drink', price: 2, value: 4, anchor: [0, 0, 0.25], dir: [0, 1], heldItem: buildHeldSoda });
        // ...and the cohort is spawned ALREADY THIRSTY. A fresh RCT2
        // arrival is watered — thirst spawns at 177-255 on the INVERTED 0-255
        // scale — and the counter refuses a drink above thirst 75 (RCT2's own
        // DecideAndBuyItem gate), which on the RCT2-faithful 512-tick needs
        // clock is ~163 sim-s of walking before anyone may buy at all: longer
        // than this whole vignette, so the stand stood idle. The needs RATES are
        // correct and deliberately untouched; a STAGED vignette seeds the state
        // it exists to demonstrate. The band is wide on purpose — the driest
        // guests buy during the pre-warm and are already sipping on frame 1, the
        // watered end of it crosses the seek threshold while the preview plays,
        // so fresh sales keep landing on screen.
        mgr.spawnGuests(8, undefined, { thirst: [4, 48] });
        // pre-warm (fixed 1/30 substeps, deterministic): 32 sim-s is enough for
        // the thirstiest of the staged cohort to have bought and be sipping on
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
        // then run at 2x in fixed substeps — a full walk-up -> buy -> drink ->
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
      <SodaStand />
    </ScenePreview>
  );
}

const previews = {
  componentName: 'SodaStand',
  importPath: 'components/SodaStand',
  previews: [
    {
      name: 'Selling sodas (live sim)',
      description:
        "Soda stand as a working composableStall: the giant-can cluster (DRNKS) registered with a miniature GameManager sim (item 'drink', price 2, value 4). Thirsty guests on the path loop walk up to the serving front (local +z, 0.72 out from the counter), buy, and stroll off DRINKING — the held red cup with its white straw (the GameManager's stock drink mesh, already matching the big red can) tips up on the eased swig-cycle arm overlay with the head tilting back, until only a crumpled container is left to throw away (RCT2 DecideAndBuyItem, Guest.cpp:1529). Pre-warmed + 2x time so buying and drinking both show in one viewing. Deterministic.",
      render: () => <SodaStandDemo />,
    },
    {
      name: '3D rig',
      description: "Soda stand: a cluster of giant soda cans with ring pulls and a straw (DRNKS).",
      render: () => (
        <ScenePreview distance={5.2} targetY={0.9}>
          <SodaStand withGuest />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
