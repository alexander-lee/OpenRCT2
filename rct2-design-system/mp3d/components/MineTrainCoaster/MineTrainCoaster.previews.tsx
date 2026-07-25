import React from 'react';
import { ScenePreview, Station, Straight, Lift, Drop, TurnR, HelixR } from '../Park';
import { MineTrainCoaster } from './index';

// The RAMPED 180° TURNAROUND both circuits come home on. RCT2 never welds a
// tight curve straight onto a fast straight: it ramps curvature in through
// transition pieces. Chorded 40°+ arcs leave a ~10° kink at the junction with
// the brake straight, and the auto-banking (which follows curvature, smoothed)
// has not developed there — that kink alone read 1.28-1.42 g effective lateral
// against the 1.5 g derail guard. Ramping 8° → 15° → 30° → 74° core → 30° →
// 15° → 8° drops the same 180° turn to 1.04-1.09 g. Net: Δz 9.68 units, ZERO
// net Δx, and it lands the train dead on the station axis.
const rampedTurnaround = (
  <>
    <TurnR angle={8} radius={14} />
    <TurnR angle={15} radius={9} />
    <TurnR angle={30} radius={6} />
    <TurnR angle={74} radius={3.6} />
    <TurnR angle={30} radius={6} />
    <TurnR angle={15} radius={9} />
    <TurnR angle={8} radius={14} />
  </>
);

const previews = {
  componentName: 'MineTrainCoaster',
  importPath: 'components/MineTrainCoaster',
  previews: [
    {
      name: '3D rig — Prospector’s Plunge (the steepest legal mine-train drop)',
      description:
        "The full rig — rough-hewn sleepers, rusted rail on timber stringers, weathered trestle bents on log cribbing, the timber-framed MINE-SHAFT PORTAL, the pit-head headframe and a 3-cart ore train — on the biggest plunge a mine train can legally take. `MineTrainCoaster.h:27` gives the mine train slopes AND steep slopes, sBends, banked curves and half-banked helixes but NO inversion group at all, which is exactly `TYPE_RULES.wooden` (60° slope ceiling, ~25° banking, `inversions: false`) — so the binding limit is not the slope cap but RCT2's pitch-RATE grammar (~0.55 rad/unit, one 25° transition piece per tile): a 4.0-unit fall is spread over a 10.0-unit run and peaks at 31.8°, the steepest `compileTrackPieces` will build. A 10.7-unit chain lift hauls the train to a 5.05-unit summit, a half-banked DESCENDING 180° helix (`helixDownBankedHalf`, the mine train's signature element) turns it over the edge, then the whole 4.0 units come back in ONE plunge that dives straight into the mine shaft — the portal sits on the dead-straight low run, the fastest track on the circuit — and a curvature-RAMPED 180° turnaround brings it home. Verified compile-only before shipping: `checkCoasterDesign('wooden')` clean with ZERO violations, `validateSpline` worst clearance 4.09, ZERO synthesized closure (the last piece lands 0.27 u short of the station, on the axis), worst effective lateral 1.09 g against the 1.5 g derail guard, E 5.87 / I 9.19 / N 3.86.",
      render: () => (
        <ScenePreview
          distance={18.5}
          targetY={2.4}
          height={340}
          autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([11.93, 9.91, 11.93], [0, 2.4, 0])}
        >
          <MineTrainCoaster position={[4.19, -10.76]} rotation={Math.PI * 0.42}>
            <Station />
            <Straight length={0.6} />
            <Lift height={4.5} length={9} />
            <Straight length={0.8} />
            <HelixR angle={180} radius={4.84} height={-0.5} />
            <Straight length={1.0} />
            <Drop height={4.0} length={8} />
            <Straight length={5.35} />
            {rampedTurnaround}
            <Straight length={1.4} />
          </MineTrainCoaster>
        </ScenePreview>
      ),
    },
    {
      name: 'Ore Bin Spiral (the signature descending helix)',
      description:
        "RCT2 archetype — the MINE-TRAIN HELIX. `MineTrainCoaster.h:27` whitelists `helixUpBankedHalf`/`helixDownBankedHalf`, and RCT2's own mine trains spend their height in banked spirals rather than plunges, so this circuit coils instead: a 10.6-unit chain lift to a 4.95-unit summit, a full 360° half-banked DESCENDING helix (radius 3.0, −1.15 — the 1.15 of vertical separation IS the clearance the spiral passes over itself with), a wide level 180° summit turnaround taken at helix speed, then a 3.25-unit drop through the mine-shaft portal on the long low straight and the same curvature-ramped 180° turnaround home. Longer and a shade gentler than the lead: 90.2 units of track, 20 s a lap, peak grade 31.5°, worst effective lateral 1.04 g, worst clearance 1.15 (the helix), ZERO synthesized closure, `checkCoasterDesign('wooden')` clean, E 5.87 / I 8.80 / N 3.71.",
      render: () => (
        <ScenePreview
          distance={24.2}
          targetY={2.4}
          height={340}
          autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([15.64, 12.25, 15.64], [0, 2.4, 0])}
        >
          <MineTrainCoaster position={[5.52, -3.59]} rotation={Math.PI / 4}>
            <Station />
            <Straight length={0.6} />
            <Lift height={4.4} length={9} />
            <Straight length={0.8} />
            <HelixR angle={360} radius={3.0} height={-1.15} />
            <Straight length={1.2} />
            <TurnR angle={180} radius={4.84} />
            <Straight length={1.0} />
            <Drop height={3.25} length={6.5} />
            <Straight length={7.36} />
            {rampedTurnaround}
            <Straight length={1.4} />
          </MineTrainCoaster>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
