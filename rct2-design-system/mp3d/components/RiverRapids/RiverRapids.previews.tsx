import React from 'react';
import { ScenePreview, Station, Lift, Drop, TurnL, Straight } from '../Park';
import { RiverRapids } from './index';

const previews = {
  componentName: 'RiverRapids',
  importPath: 'components/RiverRapids',
  previews: [
    { name: '3D rig — Gorge Run (the steepest legal rapids descent)', description:
        "The full rig — boulder-lined channel, continuous shader water, gangway, the round raft of riders (RAPBOAT) — on the biggest descent the rapids piece table allows. `RiverRapids.h:26` whitelists `curveVerySmall` and `slope` ONLY: no s-bends, no helix, NO steep pieces, so 25° is a hard ceiling both ways and the only route to a real gorge is a LONG reach at that grade. A 12-unit conveyor <Lift height={3.6} length={12}/> lifts the raft 3.6 units out of the station pool at 23.9°, a level hairpin turns it at the top of the gorge, and the whole 3.6 units come back down ONE unbroken 12-unit rapids reach at 23.9° — 12 z-steps, against the 0.4/0.3 steps of the stock loop — into the splash pond. Peak grade 23.9° of the 25° ceiling; closes with ZERO synthesized track, validateSpline clean, worst clearance 2.63.",
      render: () => (
        <ScenePreview distance={17} targetY={1.8} height={340} autoRotate={false} background="#bfe6f2"
          dress={(_t, _g, api) => api.setCameraPose?.([11.07, 8.44, 11.07], [0, 1.8, 0])}>
          <RiverRapids position={[-3.22, 6.05]} rotation={Math.PI * 0.75}>
            <Station />
            <Lift height={3.6} length={12} />
            <TurnL angle={180} radius={2} />
            <Drop height={3.6} length={12} />
            <Straight length={4.1} />
            <TurnL angle={180} radius={2} />
            <Straight length={1.2} />
          </RiverRapids>
        </ScenePreview>
      ) },
    { name: 'Descending gorge (pieces)', description: "Track-piece composition: a conveyor <Lift/> out of the station pool, then a two-step descending gorge (<Drop/> reaches split by a churning shelf) — the raft drifts the flats and shoots each drop faster than it climbs.", render: () => (
        <ScenePreview distance={12}
      targetY={0.7}
      background="#bfe6f2">
          <RiverRapids position={[-2.5, -3.3]}>
            <Station />
            <Lift height={0.8} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
            <Drop height={0.4} />
            <Straight length={0.8} />
            <Drop height={0.4} />
            <Straight length={0.8} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
          </RiverRapids>
        </ScenePreview>
      ) },
    { name: 'Oxbow Meander (eight 45° reaches)', description: "RCT2 archetype — the MEANDERING rapids circuit, built the only way the rapids piece table allows: RiverRapids.h:26 whitelists `curveVerySmall` quarter-turns and 25° slopes ONLY — no s-bends, no helix, no steep pieces — so a real rapids course is a chain of short reaches chamfered by shallow bends. This one is an eight-reach OXBOW: <Lift height={0.7}/> out of the station pool, four 45° <TurnL/> reaches sweeping around the top of the gorge, a two-step rapids staircase (0.4 then 0.3 — the churning `rapids`/`waterfall` shelves) down the far bank, and four more 45° reaches easing home. Opposite reaches are matched so the octagon closes exactly on itself: zero synthesized track, worst clearance 2.14, validateSpline clean.", render: () => (
        <ScenePreview distance={21}
      targetY={0.5}
      height={520}
      background="#bfe6f2">
          <RiverRapids position={[-3.65, -3.2]}>
            <Station />
            <Lift height={0.7} />
            <TurnL angle={45} radius={2} />
            <Straight length={1.2} />
            <TurnL angle={45} radius={2} />
            <Straight length={1.6} />
            <TurnL angle={45} radius={2} />
            <Straight length={1.2} />
            <TurnL angle={45} radius={2} />
            <Straight length={0.6} />
            <Drop height={0.4} />
            <Straight length={0.4} />
            <Drop height={0.3} />
            <TurnL angle={45} radius={2} />
            <Straight length={1.2} />
            <TurnL angle={45} radius={2} />
            <Straight length={1.6} />
            <TurnL angle={45} radius={2} />
            <Straight length={1.2} />
            <TurnL angle={45} radius={2} />
          </RiverRapids>
        </ScenePreview>
      ) },
    { name: 'Delta Gorge (three long reaches)', description: "RCT2 archetype — the wide THREE-REACH delta loop that rapids designs fall into on open ground: three long river reaches joined by 120° <TurnL angle={120}/> bends around a central rock island. The station reach carries the conveyor <Lift height={0.7}/>, the second drops through two graded rapids steps (0.4 then 0.3) on the diagonal, and the third is one 7.4-unit flat-water float home — 10.4 × 11.4, broad and shallow instead of the Oxbow's tall meander. Rapids never bank and never exceed 25°, so both steps stay gentle; the loop closes on its own last bend with nothing synthesized, clearance 2.05.", render: () => (
        <ScenePreview distance={21}
      targetY={0.6}
      height={520}
      background="#bfe6f2">
          <RiverRapids position={[-5.2, -3.2]}>
            <Station />
            <Lift height={0.7} />
            <TurnL angle={120} radius={2} />
            <Straight length={0.6} />
            <Drop height={0.4} />
            <Straight length={0.4} />
            <Drop height={0.3} />
            <TurnL angle={120} radius={2} />
            <Straight length={7.4} />
            <TurnL angle={120} radius={2} />
          </RiverRapids>
        </ScenePreview>
      ) },
  ],
};

export default previews;
