import React from 'react';
import { box } from '../Stage';
import { ScenePreview, Station, Lift, Drop, TurnR, Straight } from '../Park';
import { buildWaterRibbon, LAVA } from '../WaterTile';
import { MagmaRun, buildTimberBoat } from './index';

const previews = {
  componentName: 'MagmaRun',
  importPath: 'components/MagmaRun',
  previews: [
    {
      name: '3D rig — Caldera Circuit (LEAD)',
      description:
        "Magma Run, the flagship water ride of the Emberfall Caldera: a log flume threaded through a BASALT CANYON with a live magma fissure network. The stock circuit climbs to a 4.6-unit summit in TWO gentle conveyor flights around a corner (RCT2's flume table has 25° slopes UP but only steep-60° DOWN — LogFlume.h:26 — so conveyors are long and chutes are short), crests beside a spatter cone spilling fresh lava, then drops the whole 4.6 units in ONE 32.3° chute into a steaming splash run-out and runs home through a rock LAVA TUBE lit from inside by a magma seam in its floor. The magma runs BENEATH the elevated conveyor and chute, FLANKS the low legs and drains out through gaps blasted in the canyon wall; the crust is near-black basalt with an incandescent Voronoi crack network (Volcano's crust field) on a white-yellow → orange → deep-red → black temperature gradient, and it glows in DAYLIGHT as well as at night. Compiles CLOSED with zero synthesized track, worst clearance 3.09, design report clean; the timber boat keeps 0.05 of floor clearance and 0.16 of wall clearance the whole way round.",
      render: () => (
        <ScenePreview
          distance={26}
          targetY={2.0}
          height={560}
          autoRotate={false}
          background="#7a6a68"
          dress={(_t, _g, api) => api.setCameraPose?.([18.5, 16.5, -19.5], [-1.6, 1.0, 0.4])}
        >
          <MagmaRun position={[4.8, 6.4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The timber boat (close)',
      description:
        "The vehicle on its own (`buildTimberBoat`, staged through the preview's `dress` hook): a HEWN TIMBER log-boat, four riders aboard. A real lofted hull — 15 cross-sections from a canoe stern to a raked stem, with rocker in the bottom and sheer in the gunwale — split into three lofts so it carries a hard scorch line: warm scorched topside planking above, CHARRED near-black planking below the waterline where the flume has soaked and the caldera has baked it. Then swept cut-wood gunwale caps and a mid-strake batten, THREE wrought-iron bands chorded round the sections, an iron stem cap and mooring ring, a carved FLAME-HEAD prow with ember eyes, a charred sole of boards and four hewn thwarts with back lips. Wood grain runs fore-and-aft on every loft, because the UVs are (girth, along-z) — it reads as planking, not as a texture wrapped round a tube.",
      render: () => (
        <ScenePreview
          distance={3.0}
          targetY={0.6}
          height={430}
          autoRotate={false}
          ground={false}
          background="#7a6a68"
          dress={(t, g, api) => {
            // a short length of the ride's own trough so the boat is IN water,
            // not floating: floor, two walls, rim rails and the water strip at
            // the exact heights buildRideSpline's 'flume' profile sweeps them
            g.add(box(t, [0.9, 0.06, 2.7], 0x6b4a2e, [0, 0.37, 0], { tex: 'wood', repeat: [2, 6], rough: 0.85 }));
            [-1, 1].forEach((s) => {
              g.add(box(t, [0.06, 0.3, 2.7], 0x58402a, [s * 0.45, 0.52, 0], { tex: 'wood', repeat: [1, 8], rough: 0.85 }));
              g.add(box(t, [0.09, 0.09, 2.7], 0x8a6238, [s * 0.46, 0.66, 0], { tex: 'wood', repeat: [1, 8], rough: 0.9 }));
            });
            // the MOLTEN channel the boat rides — the ride's own liquid, staged
            // here with the same WaterTile LAVA palette and the same calmed
            // amp/waviness, so the close-up shows what the circuit shows (this
            // strip was a flat blue-grey plate until the trough went molten,
            // and the mismatch was the first thing the audit shot caught)
            const lava = buildWaterRibbon(
              t,
              Array.from({ length: 24 }, (_, i) => ({
                p: new t.Vector3(0, 0.485, -1.35 + (i / 23) * 2.7),
                side: new t.Vector3(1, 0, 0),
                up: new t.Vector3(0, 1, 0),
              })),
              0.78,
              { amp: 0.09, waviness: 0.3, palette: LAVA },
            );
            g.add(lava.mesh);
            const boat = buildTimberBoat(t);
            boat.position.set(0, 0.72, 0); // = the trough centreline 0.47 + wheelOffset 0.25
            g.add(boat);
            api.setCameraPose?.([1.72, 1.36, 1.98], [0.02, 0.6, 0.02]);
            return (time: number) => lava.update(time * 0.34); // viscous: a third of channel rate
          }}
        />
      ),
    },
    {
      name: 'The chute + the magma pool (close)',
      description:
        "Close on the drop: the boat plunges the 4.6-unit chute at 32°, hits the flared splash run-out and throws a burst of foam and droplets while a curtain of steam rolls off the magma pool at the foot of the cutting. The pool is one of the ride's two lava PointLights — both burn by DAY as well as at night, because lava is not a lamp. Note the temperature gradient (white-hot cracks at the vent cooling to black crust at the toe) and the boat reading unmistakably as WOOD: warm scorched topside planking above a charred waterline band, three wrought-iron bands chorded round the hull, hewn cut-wood gunwale caps and a carved flame-head prow with ember eyes.",
      render: () => (
        <ScenePreview
          distance={10}
          targetY={1.3}
          height={470}
          autoRotate={false}
          background="#7a6a68"
          dress={(_t, _g, api) => api.setCameraPose?.([6.8, 5.6, -8.8], [-0.9, 1.2, -2.0])}
        >
          <MagmaRun position={[1.0, 12.72]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The lava tube (close)',
      description:
        'The rock tunnel on the return leg: a basalt bore driven through a boulder outcrop, timber portal ribs at both mouths, unlit dark liner panels just inside the cut faces — and the light coming from a magma SEAM down the bore floor plus glowing crack panels along the lower walls, so the mouth reads as a hole in the hill rather than a black shed. One warm PointLight lives inside the bore, day and night.',
      render: () => (
        <ScenePreview
          distance={9}
          targetY={1.0}
          height={440}
          autoRotate={false}
          background="#7a6a68"
          dress={(_t, _g, api) => api.setCameraPose?.([3.9, 2.35, -6.8], [0.1, 0.8, -1.3])}
        >
          <MagmaRun position={[-3.53, 8.07]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The conveyor climb (close)',
      description:
        "The boat crawling the second conveyor flight up to the 4.6-unit summit, with the riders aboard and the canyon rim's SPATTER CONE — five overlapping tiers of piled basalt with a lava-filled vent and a spill running down its flank through a gap blasted in the wall — on the left. Also the clearest look at the ride's construction: trestle bents carrying the trough, twin rows of rubber CONVEYOR CLEATS riding the chain lines up BOTH climbs (the kit only chains the tallest flight, and this circuit climbs in two), emissive ember beads on the rim rails, and the ground magma channel running directly BENEATH the elevated trough, threaded between the bents.",
      render: () => (
        <ScenePreview
          distance={13}
          targetY={2.6}
          height={470}
          autoRotate={false}
          background="#7a6a68"
          dress={(_t, _g, api) => api.setCameraPose?.([9.8, 7.0, 9.8], [0.5, 2.2, 0.5])}
        >
          <MagmaRun position={[16.42, 9.54]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Track pieces — Fissure Gorge',
      description:
        'Track-piece composition: <Station/> boarding straight, one long <Lift/> conveyor up the gorge wall, a 180° hairpin at the head of the site and ONE <Drop/> chute down the whole return leg into a splash run-out — the classic RCT2 "one big drop" flume, re-themed. Every bit of theming follows the layout: the canyon cutting, the magma channels, the branch fissures, the lava tube and the spatter cone are all placed off frame scans, so a different piece list rebuilds the whole land around it. Compiles CLOSED with zero synthesized track, worst clearance 2.42.',
      render: () => (
        <ScenePreview distance={24} targetY={1.6} height={470} autoRotate={false} background="#7a6a68">
          <MagmaRun position={[5.1, 2.6]}>
            <Station />
            <Lift height={2.6} length={8.4} />
            <TurnR angle={180} radius={2.6} />
            <Straight length={1.2} />
            <Drop height={2.6} />
            <Straight length={3.25} />
            <TurnR angle={90} radius={2.0} />
            <Straight length={1.2} />
            <TurnR angle={90} radius={2.0} />
            <Straight length={1.2} />
          </MagmaRun>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
