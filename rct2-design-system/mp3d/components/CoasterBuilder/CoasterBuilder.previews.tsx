import React from 'react';
import { ScenePreview, TrackRide, Station, Lift, Drop, Hill, TurnL, TurnR, Straight, Corkscrew } from '../Park';
import { CoasterBuilder } from './index';

const previews = {
  componentName: 'CoasterBuilder',
  importPath: 'components/CoasterBuilder',
  previews: [
    { name: 'Twin-Apex Plunge (the steepest piece-composed steel drop)', description:
        "The LEAD circuit for this page: the biggest drop the piece grammar can build on the modern spline chassis (<TrackRide profile=\"coaster\" type=\"steel\">), since <CoasterBuilder>'s own LAYOUT is hard-coded in its index.tsx and cannot be re-pointed. A chain <Lift height={5.5}/> climbs 5.5 units, the level 180\u00b0 apex hairpin turns the train round at the top and it plunges the full 5.5 back down at 34.2\u00b0 nominal / 34.6\u00b0 as the compiled spline measures it — the steepest grade `rampPoints` will build at that height, since RCT2 steps slope through one-tile transition pieces and a taller drop is what buys a steeper one (h 1.0 \u2192 18\u00b0, 3.6 \u2192 29.5\u00b0, 5.5 \u2192 34.2\u00b0). Then a 3.6 climb to a second apex hairpin and a second 29.5\u00b0 drop into the station. Every turn sits AT an apex where the energy pacing is slow (\u00a74.0's trick) so the whole fast half is straight: rateCoaster reads excitement 5.28 (THRILLING band), highest drop 5.47, +6.34 g, worst lateral 0.96 g against the 1.275 g crash gate, 480 simulated seconds crash-free, ZERO synthesized closure, design + clearance clean (worst 3.89).",
      render: () => (
        <ScenePreview distance={22.25} targetY={2.8} height={300} autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([14.48, 11.49, 14.48], [0, 2.8, 0])}>
          <TrackRide profile="coaster" type="steel" name="Twin-Apex Plunge" position={[-3.03, -0.51]} rotation={Math.PI * 0.75} cars={4}>
            <Station />
            <Lift height={5.5} />
            <TurnR angle={180} radius={2.5} />
            <Drop height={5.5} />
            <Straight length={4.1} />
            <Lift height={3.6} />
            <TurnR angle={180} radius={2.5} />
            <Drop height={3.6} />
            <Straight length={1.2} />
          </TrackRide>
        </ScenePreview>
      ) },
    { name: '3D rig', description: "A wooden coaster COMPOSED from TrackKit pieces: station, chain lift, drops, corkscrew and turns — the train follows the spline.", render: () => (
        <ScenePreview distance={16}
      targetY={1.3}>
          <CoasterBuilder />
        </ScenePreview>
      ) },
    { name: 'Out-and-Back Woodie (RCT2 wooden archetype)', description: "The classic RCT2 WOODEN OUT-AND-BACK, composed as pieces on the modern spline chassis (<TrackRide profile=\"coaster\" type=\"wooden\">) — CoasterBuilder's own LAYOUT is hard-coded in its index.tsx, so alternate circuits are authored this way. Chain <Lift height={1.2}/> out of the station, the full first <Drop/> down the out leg, then TWO camelback <Hill/> airtime bumps of different size (0.45 then 0.35) down the return leg and a straight brake run home. That is exactly what the game asks a woodie for: WoodenRollerCoaster.h:85 sets RequirementNumDrops 2, RequirementDropHeight 12 and RequirementNegativeGs 0.10, i.e. two real drops plus air time, and wooden banking is capped at ~25° (coasterBankCap clamps the auto-bank to the type limit). Design + clearance checks clean, 480 simulated seconds crash-free, no synthesized closure.", render: () => (
        <ScenePreview distance={28}
      targetY={0.7}
      height={520}>
          <TrackRide profile="coaster" type="wooden" name="Out-and-Back" position={[-5.4, -3.55]} cars={3}>
            <Station />
            <Lift height={1.2} />
            <TurnL radius={2} />
            <Drop />
            <Straight length={0.6} />
            <TurnL radius={2} />
            <Hill height={0.45} />
            <Straight length={0.6} />
            <Hill height={0.35} />
            <Straight length={2.03} />
            <TurnL radius={2} />
            <Straight length={6.88} />
            <TurnL radius={2} />
            <Straight length={1.4} />
          </TrackRide>
        </ScenePreview>
      ) },
    { name: 'Corkscrew Twister (RCT2 steel archetype, L-wrap)', description: "The RCT2 CORKSCREW COASTER laid on the verified L-WRAP skeleton from rules/park-generation.md §4 (lift 1.0: c 2.0, d 1.3, e 4.3, f 9.8 + the 1.2-u brake tail) — five right turns and one left, wrapping a concave L around the plot instead of a rectangle. Chain <Lift height={1}/>, first <Drop/> straight into a banked turn, then the inverting <Corkscrew dir=\"R\"/> mid-course before the long return leg and the straight brake tail that lands 0.3 u short of the station. Inversions are STEEL-only (the wooden piece table has no corkscrew group — WoodenRollerCoaster.h:26), so this one is type=\"steel\" and banks to the steel 55° limit. Compiles with zero synthesized track, design + clearance clean (worst 1.30 at the corkscrew), 480 simulated seconds crash-free.", render: () => (
        <ScenePreview distance={28}
      targetY={0.7}
      height={520}>
          <TrackRide profile="coaster" type="steel" name="Corkscrew Twister" position={[6.4, -3.45]} cars={3}>
            <Station />
            <Lift height={1} />
            <TurnR />
            <Drop />
            <TurnR />
            <Straight length={2} />
            <TurnL />
            <Straight length={1.3} />
            <TurnR />
            <Straight length={1} />
            <Corkscrew dir="R" />
            <Straight length={0.9} />
            <TurnR />
            <Straight length={9.8} />
            <TurnR />
            <Straight length={0.9} />
          </TrackRide>
        </ScenePreview>
      ) },
  ],
};

export default previews;
