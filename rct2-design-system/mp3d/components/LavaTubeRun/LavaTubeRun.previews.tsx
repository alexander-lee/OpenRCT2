import React from 'react';
import { ScenePreview, Station, Straight, Lift, Drop, Hill, TurnR } from '../Park';
import { mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { hash01 } from '../ColorKit';
import { LavaTubeRun } from './index';

// The two CURVATURE-RAMPED corners the circuit turns on. RCT2 never welds a
// tight curve straight onto a fast straight, and neither can this kit: a
// chorded arc leaves a ~10° kink at the junction where the auto-banking (which
// follows curvature, smoothed) has not developed, and that kink alone is the
// whole lateral-G budget. The SLOW crest corner ramps in two stages; the three
// FAST low corners ramp in three and hold the circuit at 1.13 g against the
// 1.5 g derail guard. Each fragment sums to exactly 90°, so four of them bring
// the train home on the station heading with nothing synthesized.
const crestCorner = (r: number) => (
  <>
    <TurnR angle={12} radius={r * 2.6} />
    <TurnR angle={66} radius={r} />
    <TurnR angle={12} radius={r * 2.6} />
  </>
);
const fastCorner = (r: number) => (
  <>
    <TurnR angle={5} radius={14} />
    <TurnR angle={10} radius={9} />
    <TurnR angle={18} radius={6} />
    <TurnR angle={24} radius={r} />
    <TurnR angle={18} radius={6} />
    <TurnR angle={10} radius={9} />
    <TurnR angle={5} radius={14} />
  </>
);

type StageT = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[0];
type StageG = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[1];

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

const previews = {
  componentName: 'LavaTubeRun',
  importPath: 'components/LavaTubeRun',
  previews: [
    {
      name: '3D rig — Cinder Bore (the stock circuit + the flank it dives through)',
      description:
        "The whole coaster on the shipped \"Cinder Bore\" circuit: a 4.0-unit chain lift out of the basalt station, a curvature-ramped corner at the 4.55 summit, all 4.0 units back in ONE 30° plunge down the far side, a banked sweep, and then **14.3 units of dead-straight low run at full speed — which is where the LAVA TUBE sits**: a basalt RIDGE crosses the track with a rock portal driven through each side of it, an older flow spilling down its outer face and a magma pool boiling at its foot. A long shallow camelback (height 1.1 over a 10-unit run — a SHORT camelback at these speeds reads −4 vertical g, and this one reads −0.49) carries the airtime on the way home. Compiled with the ride's own rules (`profile: 'coaster'`, `type: 'steel'`, bank **0.70** — the 40° auto-bank is what soaks the lateral G on the fast turns either side of the tube) and verified compile-only before shipping: `checkCoasterDesign('steel')` clean with ZERO violations, `validateSpline` worst clearance **5.60**, **ZERO** synthesized closure, worst effective lateral **1.13 g** against the 1.5 g derail guard, peak roll 25.4°, 99.4 u of track, 15 s a lap, E **5.44** / I 6.78 / N 2.15 — **thrilling**.",
      render: () => (
        <ScenePreview
          distance={33}
          targetY={2.2}
          height={340}
          autoRotate={false}
          dress={(t, g, api) => {
            ashField(22)(t, g);
            api.setCameraPose?.([18.01, 12.4, 25.7], [0, 2.2, 0]);
          }}
        >
          {/* rotated a half-turn so the FLANK (and its portals) is the near
              side of the circuit and the station recedes behind it */}
          <LavaTubeRun position={[-5.45, -12.8]} rotation={Math.PI} />
        </ScenePreview>
      ),
    },
    {
      name: 'THE TUNNEL — the portal, the bore and the glow inside it',
      description:
        "The signature, close up. A basalt ridge crosses the fastest straight on the circuit and the track is driven clean through it: a rock PORTAL at each mouth (three stepped jamb blocks per side, a ring of voussoirs over the opening, a heavy lintel and a row of obsidian teeth), an 8-unit ENCLOSED BORE between them, and an exit portal on the far flank. The bore's structural roof and walls are ROCK — they are the cut faces of the flank, and a flat dark slab that size reads as a black shed from outside — with thin DARK panels just inside them so the mouths still read as holes in a hill. The interior is lit **from within by magma**: a cooled crust floor under the track, an open molten GUTTER hugging one wall, molten veins up both inner faces at rider eye level, drips down the roof, and two real PointLights inside. Every one of those is **day-and-night lerped, never gated to zero** — lava is incandescent at noon — so the portal mouths glow in daylight, and the whole thing brightens after dark. Outside, an older flow steps down the ridge's outer face into a levee'd magma pool, and smoke rises from both mouths.",
      render: () => (
        <ScenePreview
          distance={12}
          targetY={1.6}
          height={480}
          autoRotate={false}
          dress={(t, g, api) => {
            ashField(22)(t, g);
            api.setCameraPose?.([11.4, 4.3, 16.5], [0.6, 1.6, 13.1]);
          }}
        >
          <LavaTubeRun position={[-5.45, -12.8]} rotation={Math.PI} />
        </ScenePreview>
      ),
    },
    {
      name: 'Deep Bore (piece composition — a taller lift and a longer tube)',
      description:
        "Track-piece composition through JSX children (`<Station/><Lift/><Drop/><Hill/><TurnR/>…`, read with `collectTrackPieces`, which win over the `pieces` prop), plus `tunnelHalf` to drive a longer bore. The lift goes to 4.4 (a 4.95 summit, 31.5° plunge) and the tube straight solves to 14.726 with a 3.026 return leg, so the flank gets a 10.4-unit bore. Measured: `checkCoasterDesign('steel')` clean, worst clearance 5.69, ZERO synthesized closure, worst effective lateral **1.24 g** (still inside the 1.27 g crash-replay margin, but the reason the STOCK circuit ships at 4.0 rather than 4.4 — every 0.4 of lift costs ~0.11 g on the fast corners), highest drop 4.41, airtime 0.21 s, 101.3 u, E 5.54 / I 6.98 / N 2.18. Note the two solved straight lengths: the closure of a four-corner circuit has exactly two degrees of freedom, and landing the last authored piece 0.30 u short of the station on its own axis is what stops `compileTrackPieces` synthesizing a return leg through the track.",
      render: () => (
        <ScenePreview
          distance={28}
          targetY={1.8}
          height={340}
          autoRotate={false}
          dress={(t, g, api) => {
            ashField(23)(t, g);
            api.setCameraPose?.([-13.46, 9.58, 23.31], [0, 1.8, 0]);
          }}
        >
          <LavaTubeRun position={[5.65, 13.0]} cars={4} tunnelHalf={5.2}>
            <Station />
            <Straight length={0.6} />
            <Lift height={4.4} length={9} />
            <Straight length={0.8} />
            {crestCorner(3.6)}
            <Straight length={1.0} />
            <Drop height={4.4} length={9} />
            <Straight length={3.0} />
            {fastCorner(3.2)}
            <Straight length={14.726} />
            {fastCorner(3.2)}
            <Hill height={1.1} length={10} />
            <Straight length={3.026} />
            {fastCorner(3.2)}
            <Straight length={1.4} />
          </LavaTubeRun>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
