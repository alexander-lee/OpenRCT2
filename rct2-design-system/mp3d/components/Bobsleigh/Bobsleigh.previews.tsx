import React from 'react';
import { ScenePreview, Station, Lift, Drop, Hill, TurnL, Straight, SBend, HelixL } from '../Park';
import { Bobsleigh } from './index';

const previews = {
  componentName: 'Bobsleigh',
  importPath: 'components/Bobsleigh',
  previews: [
    { name: '3D rig — Summit Chute (the steepest legal bobsled plunge)', description:
        "The full rig — icy half-pipe chute, hard banking, steel spine and columns, a 2-sled train — on the biggest plunge a bobsled can legally take. `BobsleighCoaster.h:26` gives the bobsled `slope` and banked helixes but NO steep slopes at all, so 25° is an absolute ceiling and height has to be bought with LENGTH: a 12-unit belt <Lift height={3.6} length={12}/> hauls the sleds 3.6 units to the summit at 23.9°, the level summit hairpin turns them over the edge, and the whole 3.6 units come back in ONE unbroken 12-unit 23.9° plunge — 9× the drop of the old two-stage run. It then climbs 2.2 to a second HIGH hairpin (energy-paced, so it is slow up there) and drops home into the station. Every fast metre is dead straight and every turn sits at an apex, which is how the ride keeps the live 1.5 g derail guard happy: 480 simulated seconds CRASH-FREE, peak grade 24.0°, closes with ZERO synthesized track, worst clearance 3.59.",
      render: () => (
        <ScenePreview distance={20.75} targetY={1.95} height={300} autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([13.51, 10.06, 13.51], [0, 1.95, 0])}>
          <Bobsleigh position={[-0.14, 3.54]} rotation={Math.PI * 0.75}>
            <Station />
            <Lift height={3.6} length={12} />
            <TurnL angle={180} radius={2.4} />
            <Drop height={3.6} length={12} />
            <Straight length={4.1} />
            <Lift height={2.2} />
            <TurnL angle={180} radius={2.4} />
            <Drop height={2.2} />
            <Straight length={1.2} />
          </Bobsleigh>
        </ScenePreview>
      ) },
    { name: 'Downhill run (pieces)', description: 'Track-piece composition: a tall belt <Lift/> to the summit (a small settling <Drop/> right after the crest keeps the lift detector unambiguous), then a two-stage downhill home — energy-paced, so the train crawls the belt at 1.3 u/s and gravity hurls it down the drops at ~5.5 u/s through the banked turns (1.5 g derail guard live, verified crash-free).', render: () => (
        <ScenePreview distance={16}
      targetY={1.3}>
          <Bobsleigh position={[-2.5, -6.9]}>
            <Station />
            <Lift height={1.8} />
            <Drop height={0.2} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
            <Drop height={1.2} />
            <Straight length={0.4} />
            <Drop height={0.4} />
            <Straight length={4.0} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
          </Bobsleigh>
        </ScenePreview>
      ) },
    { name: 'Alpine Spiral (hexagon + descending helix finale)', description: "RCT2 archetype — the BOBSLEIGH DOUBLE-HELIX finale. BobsleighCoaster.h:26 whitelists half-banked helixes UP and DOWN and flat-banked curves but NO steep slopes at all (25° ceiling), and the ride is graded on lateral Gs rather than drop height (RequirementLateralGs 1.20) — so the authentic layout is a banked spiral, never a plunge. Six 60° <TurnL/> bends make a hexagonal mountain circuit: <Lift height={1.5}/> to the summit, a 0.2 settling crest drop, then a full descending <HelixL angle={360} radius={2.4} height={-1.15}/> spiralling INSIDE the loop as the finale, a last 0.15 step and a flat brake run home. Energy-paced: the sleds crawl the belt and carve the helix under the live 1.5 g derail guard — 480 simulated seconds crash-free, worst clearance 1.15, closes with nothing synthesized.", render: () => (
        <ScenePreview distance={23}
      targetY={0.9}
      height={520}>
          <Bobsleigh position={[-3.4, -5.15]}>
            <Station />
            <Lift height={1.5} />
            <TurnL angle={60} radius={2} />
            <Straight length={1.6} />
            <TurnL angle={60} radius={2} />
            <Straight length={1.6} />
            <TurnL angle={60} radius={2} />
            <Drop height={0.2} />
            <Straight length={0.5} />
            <HelixL angle={360} radius={2.4} height={-1.15} />
            <Straight length={0.5} />
            <Drop height={0.15} />
            <Straight length={2.32} />
            <TurnL angle={60} radius={2} />
            <Straight length={1.6} />
            <TurnL angle={60} radius={2} />
            <Straight length={1.6} />
            <TurnL angle={60} radius={2} />
          </Bobsleigh>
        </ScenePreview>
      ) },
    { name: 'Chicane Descent (hairpin summit, camelback, base U-turn)', description: "RCT2 archetype — the twisting BOBSLED CHUTE that doubles back on itself: \"riders career down a twisting track guided only by the curvature and banking\" (STR_0525). <Lift height={0.9}/> straight out of the station, a 180° hairpin across the summit, then a chicane descent — 0.4 drop, <SBend/> kink, a <Hill height={0.3}/> camelback and the 0.5 finale drop — into a tight two-turn U at the base and a long 4.75-unit brake run back past the station. Narrow 4.4 × 16.5, all inside the 25° slope ceiling; the sleds bank hard through the hairpin and the base U. Crash-free over 480 simulated seconds, clearance 2.15, no synthesized closure.", render: () => (
        <ScenePreview distance={21}
      targetY={0.9}
      height={520}>
          <Bobsleigh position={[-2.2, -1.6]}>
            <Station />
            <Lift height={0.9} />
            <TurnL angle={180} radius={2.2} />
            <Drop height={0.4} />
            <SBend length={2.4} radius={1.2} />
            <Hill height={0.3} />
            <Drop height={0.5} />
            <TurnL radius={1.6} />
            <TurnL radius={1.6} />
            <Straight length={4.75} />
          </Bobsleigh>
        </ScenePreview>
      ) },
  ],
};

export default previews;
