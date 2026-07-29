import React from 'react';
import { ScenePreview } from '../Park';
import { buildPathNetwork, SURFACE_BASALT } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { EmberRoast, buildHeldSkewer } from './index';

// The grill sells REAL skewers through the GameManager consumable flow (the same
// live-sim vignette as the four catalog shops): a ScenePreview `dress` hook runs
// a miniature deterministic sim — small path loop, the stall registered at the
// counter front — at 2x time, PRE-WARMED so guests are already hungry and
// mid-loop on the first frame. Peckish guests step off the path to the basalt
// counter, buy (item 'food', price 4, value 6 — good-value happiness), then
// stroll on EATING: the grill's OWN held skewer (charred meat chunks and
// peppers on a hardwood stick, threaded through the fist) lifts to the mouth on
// the eased bite-cycle arm overlay until only a crumpled container is left to
// bin.
function EmberRoastDemo() {
  return (
    <ScenePreview
      distance={6.4}
      targetY={0.9}
      autoRotate={false}
      dress={(t, g, api) => {
        // frame the counter front with the path loop in the foreground; the flue
        // stack and the giant skewer sign fill the top of the frame
        api.setCameraPose?.([0, 3.3, 6.6], [0, 0.85, 1.0]);
        // small loop passing the counter front (grill at origin faces +z)
        const nodes: [number, number][] = [
          [-3, 1.6], [0, 1.6], [3, 1.6], [3, 4.2], [0, 4.2], [-3, 4.2],
        ];
        const edges: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4],
        ];
        const net = { nodes, edges };
        // THE WORLD'S OWN PAVING, not municipal grey. Emberfall Caldera's
        // theme carries `pathSurface: SURFACE_BASALT`, and a volcanic stall
        // standing on tarmac was the tell — this preview is the only place the
        // stall is shown on a path, so it has to be the world's path.
        const paths = buildPathNetwork(t, net, { width: 1.0, surface: SURFACE_BASALT });
        g.add(paths.group);
        const mgr = createGameManager(t, { net });
        g.add(mgr.group);
        // the <EmberRoast> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. The anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 0.82 —
        // clear of the counter's slate lip (z 0.53) and the sign-gantry posts (z 0.44).
        // ...with the grill's OWN held skewer (StallConfig.heldItem), exactly as
        // <EmberRoast register> wires it inside a real <Park>
        mgr.registerStall({ name: 'Ember Roast', item: 'food', price: 4, value: 6, anchor: [0, 0, 0.1], dir: [0, 1], heldItem: buildHeldSkewer });
        // ...and the cohort is spawned ALREADY PECKISH. A fresh RCT2
        // arrival is well fed — hunger spawns at 177-255 on the INVERTED 0-255
        // scale — and the counter refuses food above hunger 75 (RCT2's own
        // DecideAndBuyItem gate), which on the RCT2-faithful 512-tick needs
        // clock is ~163 sim-s of walking before anyone may buy at all: longer
        // than this whole vignette, so the grill stood idle. The needs RATES are
        // correct and deliberately untouched; a STAGED vignette seeds the state
        // it exists to demonstrate. The band is wide on purpose — the hungriest
        // guests buy during the pre-warm and are already eating on frame 1, the
        // fed end of it crosses the seek threshold while the preview plays, so
        // fresh sales keep landing on screen.
        mgr.spawnGuests(8, undefined, { hunger: [4, 48] });
        // pre-warm (fixed 1/30 substeps, deterministic): 32 sim-s is enough for
        // the hungriest of the staged cohort to have bought and be eating on
        // frame 1, with the rest still working their way to the counter — the
        // sales then keep coming while the preview plays. (It used to be 78 s
        // to outwait the OLD hunger onset; the seeded cohort above replaces
        // that wait, and a shorter warm keeps live buying on screen.)
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
      <EmberRoast />
    </ScenePreview>
  );
}

const previews = {
  componentName: 'EmberRoast',
  importPath: 'components/EmberRoast',
  previews: [
    {
      name: 'Selling skewers (live sim)',
      description:
        "Ember Roast as a working composableStall: the volcanic-stone skewer grill registered with a miniature GameManager sim (item 'food', price 4, value 6). Peckish guests on the path loop walk up to the serving front (local +z, 0.72 out from the basalt counter), buy, and stroll off EATING — the shop's own held skewer (three charred meat chunks and two scorched peppers on a hardwood stick, threaded through the fist with the handle poking out below it) lifts to the mouth on the eased bite-cycle arm overlay with a nod into each bite, until only a crumpled container is left to throw away (RCT2 DecideAndBuyItem, Guest.cpp:1529). The coals glow through EmberfallScenery's shared crust/crack lava material — visible by DAY as well as at night. Pre-warmed + 2x time so buying and eating both show in one viewing. Deterministic.",
      render: () => <EmberRoastDemo />,
    },
    {
      name: '3D rig',
      description:
        "Ember Roast: rough basalt block counter, an iron grate over a bed of glowing coals sunk into the slate top (near-black crust with emissive cracks, the Emberfall lava language), a canted soot-blackened chimney breast and banded stack, an iron rack of spare skewers, a scorched-sailcloth valance in the world's own canopy colours, a slate chalk menu board and one heroic charred skewer as the sign on the front gantry. Smoke and sparks lift off the whole grate; the gaslights hung from the lintel come up after dark while the coals keep burning.",
      render: () => (
        <ScenePreview distance={4.4} targetY={0.8} autoRotate={false}>
          <EmberRoast withGuest />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
