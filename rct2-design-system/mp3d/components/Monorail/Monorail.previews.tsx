import React from 'react';
import { ScenePreview, Station, Straight, TurnL, TurnR, SBend } from '../Park';
import { Monorail } from './index';

const previews = {
  componentName: 'Monorail',
  importPath: 'components/Monorail',
  previews: [
    { name: '3D rig', description: "Elevated monorail beam on piers with a streamlined gliding train.", render: () => (
        <ScenePreview distance={8}
      targetY={1.4}>
          <Monorail />
        </ScenePreview>
      ) },
    { name: 'Custom loop (pieces)', description: "Piece-composed FLAT beam loop — a compact clockwise loop (a 0.85-scale mirror of the Grand Circle geometry, so it closes exactly with nothing synthesized — clearance 1.82); the shuttle becomes three articulated cars gliding the elevated beam (vertical pieces are stripped — monorails never ramp).", render: () => (
        <ScenePreview distance={12}
      targetY={1.2}>
          {/* A COMPACT MIRROR (0.85 scale, turnR) of the verified Grand Circle
              geometry below. Hand-authored rectangles kept failing here: it is
              not enough for the turns to sum to 360° — the list must also END
              FACING the station, else compileTrackPieces synthesizes a closing
              piece that crosses the beam. The original list turned only 180°
              (52% synthesized → FATAL on every page load); a rectangle and a
              hexagon both self-intersected at ~0.07. Mirroring a known-legal
              circuit preserves every clearance: closed, NOTHING synthesized,
              worst clearance 1.82, zero compiler warnings. */}
          <Monorail pieces={[
            'station',
            { type: 'straight', length: 1.7 },
            { type: 'turnR', angle: 90, radius: 2.55 },
            { type: 'straight', length: 2.04 },
            { type: 'turnR', angle: 90, radius: 2.55 },
            { type: 'straight', length: 1.02 },
            { type: 'sbend', length: 3.06, radius: -1.02 },
            { type: 'straight', length: 1.28 },
            { type: 'turnR', angle: 90, radius: 2.55 },
            { type: 'straight', length: 1.02 },
            { type: 'turnR', angle: 90, radius: 2.55 },
            { type: 'straight', length: 1.19 },
          ]} />
        </ScenePreview>
      ) },
    { name: 'Grand Circle Tour (sweeping R3 stadium loop)', description: "RCT2 archetype — the GRAND CIRCLE monorail that rings the park. Monorail.h:26 is the only whitelist here with `curveLarge` as well as small/medium curves and s-bends, its max height is a deliberate 8 and its rating asks for open air (RequirementUnsheltered 4) — so the game literally rewards a big, sweeping, outdoor circuit. Four wide radius-3 <TurnL/> sweeps make a stadium oval around the site with an <SBend/> kink easing the beam past the far corner, and the three articulated cars glide it without ever changing height (the beam is FLAT-only: lifts/drops/hills are stripped with a console.warn, so none are used here). Closes on its own approach straight — nothing synthesized, worst clearance 2.15.", render: () => (
        <ScenePreview distance={21.5}
      targetY={1.0}
      height={520}>
          <Monorail position={[-4.2, -1.45]}>
            <Station />
            <Straight length={2} />
            <TurnL radius={3} />
            <Straight length={2.4} />
            <TurnL radius={3} />
            <Straight length={1.2} />
            <SBend length={3.6} radius={1.2} />
            <Straight length={1.5} />
            <TurnL radius={3} />
            <Straight length={1.2} />
            <TurnL radius={3} />
            <Straight length={1.4} />
          </Monorail>
        </ScenePreview>
      ) },
    { name: 'Plaza Circuit (L-wrap around a block)', description: "RCT2 archetype — the monorail THREADED THROUGH THE PARK rather than around it: an L-wrap that steps out twice to dodge a block of buildings (five <TurnL/> and one reverse <TurnR/> notch, total sweep still 360°), then runs one long 7.8-unit beam down the far side back to the station. 11.4 × 10.5, concave where the Grand Circle is convex. Flat throughout (monorail track has no steep pieces and no banking at all), so the piers just march along the spline; the circuit lands 0.3 u short of the station straight with no synthesized return track, clearance 2.22.", render: () => (
        <ScenePreview distance={21}
      targetY={1.1}
      height={520}>
          <Monorail position={[-5.7, -2.15]}>
            <Station />
            <Straight length={3} />
            <TurnL radius={1.8} />
            <Straight length={2} />
            <TurnL radius={1.8} />
            <Straight length={1.5} />
            <TurnR radius={1.8} />
            <Straight length={2.2} />
            <TurnL radius={1.8} />
            <Straight length={1.8} />
            <TurnL radius={1.8} />
            <Straight length={7.8} />
            <TurnL radius={1.8} />
            <Straight length={1} />
          </Monorail>
        </ScenePreview>
      ) },
  ],
};

export default previews;
