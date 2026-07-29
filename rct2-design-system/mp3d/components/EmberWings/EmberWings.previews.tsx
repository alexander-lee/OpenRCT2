import React from 'react';
import { ScenePreview, Station, Straight, Lift, Drop, TurnR } from '../Park';
import { mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { hash01 } from '../ColorKit';
import { EmberWings, EmberWingsHanger } from './index';

// The CURVATURE-RAMPED 90° corner every EmberWings circuit turns on. A
// suspended coaster's track is near-UNBANKED (the cars roll, not the rail), so
// nothing discounts the lateral G — and a bare chorded arc welded onto a fast
// straight leaves a ~10° kink exactly where the curvature banking has not
// developed yet. Ramping 12° r(2.6R) → 66° rR → 12° r(2.6R) holds the whole
// circuit at 0.86-0.88 g against the kit's 1.5 g derail guard. The four cores
// sum to 4 × 90° = 360°, which is what brings the train home on the station
// heading with ZERO synthesized closure.
const corner = (r: number) => (
  <>
    <TurnR angle={12} radius={r * 2.6} />
    <TurnR angle={66} radius={r} />
    <TurnR angle={12} radius={r * 2.6} />
  </>
);

/** the caldera floor: a lattice of BROKEN ASH PLATES over the preview's grass
 *  disc, so the rim circuit and its lava fissures read as VOLCANIC ground.
 *
 *  This was two flat `CircleGeometry` discs, and at the park camera elevation
 *  (--elev=50) they read as a tarmac pancake with a drawn-compass edge —
 *  rules/component-audit.md §6, "flat boxes on the ground read as floor tiles".
 *  Plates with hashed heights and a CLUMPED rim are the same language the land's
 *  own `calderaFloor` lays under all three circuits, so the standalone preview
 *  and the world now show the same ground. One merged draw per tone. */
const ashField = (radius: number) => (t: StageT, g: StageG) => {
  const PITCH = 1.34;
  const n = Math.ceil(radius / PITCH) + 1;
  const dark: MergedBoxSpec[] = [];
  const pale: MergedBoxSpec[] = [];
  for (let ix = -n; ix <= n; ix += 1)
    for (let iz = -n; iz <= n; iz += 1) {
      const h = hash01(ix * 9.7 + iz * 1.73 + 0.4);
      const h2 = hash01(ix * 3.11 + iz * 7.71 + 1.9);
      const x = ix * PITCH + (h2 - 0.5) * 0.44;
      const z = iz * PITCH + (hash01(ix * 5.31 + iz * 2.87) - 0.5) * 0.44;
      const r = Math.hypot(x, z) / radius;
      if (r > 1.04) continue;
      // CLUMPED rim dither. A per-cell hash on a regular lattice CHECKERBOARDS
      // once the fade band is more than a couple of units wide (§6); two
      // low-frequency sines make the field break off in patches instead.
      const clump = 0.52 + 0.3 * Math.sin(x * 0.44 + z * 0.31) + 0.18 * Math.sin(z * 0.79 - x * 0.23);
      if (r > 0.8 && (r - 0.8) / 0.24 > clump) continue;
      const spec: MergedBoxSpec = {
        dims: [PITCH + 0.26 + h * 0.26, 0.05 + h2 * 0.035, PITCH + 0.26 + h2 * 0.26],
        pos: [x, 0.014 + h * 0.014, z],
        rotY: (h - 0.5) * 0.5,
        repeat: [1, 1],
      };
      (h > 0.62 ? pale : dark).push(spec);
    }
  if (dark.length) g.add(mergedBoxes(t, dark, 0x3a332d, { tex: 'asphalt', rough: 1, bump: 0.06, flat: true }));
  if (pale.length) g.add(mergedBoxes(t, pale, 0x4a423a, { tex: 'concrete', rough: 1, bump: 0.07, flat: true }));
};
type StageT = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[0];
type StageG = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[1];

const previews = {
  componentName: 'EmberWings',
  importPath: 'components/EmberWings',
  previews: [
    {
      name: '3D rig — Crater Rim Flight (the stock suspended circuit)',
      description:
        "The full flyer — obsidian rail on side-mounted cantilever TOWERS, a raised boarding deck with airgates under a basalt canopy, ember braziers, the CALDERA FLOOR the loop encloses (three lava fissures and the open magma vent pool at the circuit's own centroid, with heat haze and embers rising THROUGH the flight path) and a 4-car train of suspended wing gondolas — on the shipped \"Crater Rim Flight\" circuit. A 2.4-unit chain lift (22°) climbs out of the station onto the rim, then the train sweeps a full 360° of the caldera on four curvature-ramped corners with two swooping descents (0.9 then 1.5) and two wide, fast low turns home. Compiled with the flyer's own rule set — `profile: 'coaster'`, `type: 'inverted'` (the hangs-below-the-rail family) and bank pinned at **0.20 rad**, far under that type's 55° ceiling, because RCT2's SuspendedSwingingCoaster has no banking track group at all: the visible roll is the PENDULUM on each car's yoke, integrated from the car's own measured motion and clamped by mechanical stops at 0.42 rad. Verified compile-only before shipping: `checkCoasterDesign('inverted')` clean with ZERO violations, `validateSpline` worst clearance **4.71**, **ZERO** synthesized closure (the last piece lands 0.30 u short of the station, dead on its axis), worst effective lateral **0.88 g** against the 1.5 g derail guard, peak roll 11.5°, 80.0 u of track, 19 s a lap, E **2.72** / I 3.44 / N 2.42 (moderate).",
      render: () => (
        <ScenePreview
          distance={30}
          targetY={1.8}
          height={340}
          autoRotate={false}
          dress={(t, g, api) => {
            ashField(21)(t, g);
            api.setCameraPose?.([14.35, 10.57, 24.85], [0, 1.8, 0]);
          }}
        >
          <EmberWings position={[3.5, 9.0]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Hanger rig — the yoke, the wings and the dangling riders',
      description:
        "The vehicle, close up, on a straight 5.2-unit section of the flyer's own rail profile (twin tubes at ±0.34, crossties, box spine) held up by two of the component's cantilever towers. This is the anatomy of the suspended car: the BOGIE rides on TOP of the rails on four running wheels with vertical-axis guide wheels hugging the rail flanks; two YOKE ARMS at |x| 0.40 drop past the crossties to a cross beam 0.30 below the rail, then two drop plates carry the fore-and-aft PIVOT PIN another 0.20 down; the gondola hangs off that pin on a bearing CONCENTRIC with it (so the bearing itself cannot sweep) and is free to roll — here on a slow deterministic figure-of-eight, so a still frame always catches the cars mid-swing. The tub is a BACK-PACK: seat carrier, back wall and rear-half side walls only, with nothing at all forward of z −0.07 — which is what lets the riders' LEGS HANG FREE below the cantilevered cushions onto a footrest bar while they sit in over-shoulder FLYING HARNESSES with their arms spread. WING FAIRINGS sweep off both flanks to |x| 0.91, pushed AFT so they never occlude the legs and given ANHEDRAL so the rising tip stays 0.11 under the yoke cross beam through the full 0.42 rad of swing. The brazier's coals use the same Volcano crust/crack lava material as the fissures, so they glow by day too.",
      render: () => (
        <ScenePreview
          distance={3.2}
          targetY={0.92}
          height={560}
          autoRotate={false}
          dress={(t, g, api) => {
            ashField(6)(t, g);
            api.setCameraPose?.([-1.19, 1.26, 3.65], [0, 0.92, 0.7]);
          }}
        >
          <EmberWingsHanger />
        </ScenePreview>
      ),
    },
    {
      name: 'Cinder Ridge (piece composition — a tighter, lower rim loop)',
      description:
        "Track-piece composition through JSX children (`<Station/><Lift/><Drop/><TurnR/>…`, read with `collectTrackPieces`, which win over the `pieces` prop): a shorter, shallower rim circuit for a cramped ledge — a 2.0-unit lift, corner radii dropped to 3.4 / 3.8 / 5.2 / 5.2 and descents of 0.7 then 1.3. 71.2 u instead of 80.0, a 24.0 × 15.6 footprint instead of 26.6 × 18.0, and it stays even calmer: worst effective lateral **0.86 g**, worst clearance 4.17, ZERO synthesized closure, `checkCoasterDesign('inverted')` clean, E 2.67 / I 3.35 / N 2.38 (moderate), 17 s a lap. Note the two straight lengths (5.34 and 1.402): those are SOLVED, not chosen — the closure of a four-corner rim loop has exactly two degrees of freedom, and landing the last authored piece 0.30 u short of the station on its own axis is what keeps `compileTrackPieces` from synthesizing a return leg straight through the circuit.",
      render: () => (
        <ScenePreview
          distance={13}
          targetY={1.8}
          height={400}
          autoRotate={false}
          dress={(t, g, api) => {
            ashField(19)(t, g);
            api.setCameraPose?.([11.34, 5.38, 17.38], [3.3, 1.8, 7.8]);
          }}
        >
          <EmberWings position={[3.3, 7.8]} cars={5}>
            <Station />
            <Straight length={0.4} />
            <Lift height={2.0} length={5.0} />
            <Straight length={0.6} />
            {corner(3.4)}
            <Straight length={0.6} />
            <Drop height={0.7} length={3.6} />
            <Straight length={1.0} />
            {corner(3.8)}
            <Straight length={0.6} />
            <Drop height={1.3} length={5.0} />
            <Straight length={5.34} />
            {corner(5.2)}
            <Straight length={1.402} />
            {corner(5.2)}
            <Straight length={1.3} />
          </EmberWings>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
