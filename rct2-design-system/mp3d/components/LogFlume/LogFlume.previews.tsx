import React from 'react';
import { ScenePreview, Station, Lift, Drop, TurnL, Straight, SBend } from '../Park';
import { LogFlume, buildLog } from './index';

const previews = {
  componentName: 'LogFlume',
  importPath: 'components/LogFlume',
  previews: [
    { name: '3D rig — Big Chute (the steepest legal flume drop)', description:
        "The full rig — trough, shader water ribbon, splash run-out, carved log with riders — on the STEEPEST chute the flume piece table can build. `LogFlume.h:26` gives the flume `slope` and `slopeSteepDown` but NO `slopeSteepUp`, so the climb is capped at 25° and the plunge at 60°: the way to a steep chute is therefore to CLIMB LONG and DROP SHORT. One 16-unit conveyor <Lift height={4.8} length={16}/> hauls the log 4.8 units up at 23.9° (a longer `length` is what buys the legal grade), the level hairpin turns it round at the top, and the whole 4.8 units come back in ONE 11-unit chute at 33.1° — 4× the fall of the stock loop — straight into a 9-unit splash run-out. 33.1° is the ceiling rampPoints' one-tile transition rule allows at this height, not the 60° whitelist. Compiles CLOSED with ZERO synthesized track, checkCoasterDesign + validateSpline clean, worst clearance 3.09.",
      render: () => (
        <ScenePreview distance={20.5} targetY={2.15} height={340} autoRotate={false} background="#bfe6f2"
          dress={(_t, _g, api) => api.setCameraPose?.([13.34, 10.16, 13.34], [0, 2.15, 0])}>
          <LogFlume position={[-4.5, 7.61]} rotation={Math.PI * 0.75}>
            <Station />
            <Lift height={4.8} length={16} />
            <TurnL angle={180} radius={2.2} />
            <Drop height={4.8} />
            <Straight length={9.05} />
            <TurnL angle={180} radius={2.2} />
            <Straight length={1.2} />
          </LogFlume>
        </ScenePreview>
      ) },
    { name: 'Hollowed log (vehicle detail)', description:
        "The boat on its own, turning slowly. It was a `LatheGeometry` barrel: a circular section revolved with a CONSTANT-angle slot cut out of the top, so the scoop ran the whole length and both ends had to be patched shut afterwards with two more lathe bands and two ball plugs — five meshes and two seams to fake one shape. It is now a real lofted surface. Three fair curves against the length (outer radius, scoop half-angle, bore radius) define a station; three lofts triangulate the grid — the outer hull, the BORE whose radius falls to zero at both ends so the hollow closes itself into rounded inboard ends and needs no caps, and one continuous RIM band that traverses the port rim bow-ward and the starboard rim stern-ward and closes through the degenerate quads where the scoop pinches out. The scoop is WIDE amidships and pinched at the ends because the curve says so, which is what a hollowed log actually looks like — and it is 3 draws instead of 10. Origin, keel height and bow direction are unchanged, so `wheelOffset: 0.25` and every existing caller still hold.",
      render: () => (
        <ScenePreview distance={3} targetY={0} height={360} autoRotate={false} background="#cfe4ea"
          dress={(t, g, api) => {
            api.setCameraPose?.([1.55, 0.95, 1.55], [0, -0.02, 0]);
            const log = buildLog(t);
            g.add(log);
            return (time) => { log.rotation.y = time * 0.35; };
          }} />
      ) },
    { name: 'Station house & plunge pool (detail)', description:
        "Close on the two structures this component builds around the compiled circuit. THE STATION HOUSE: a planked boarding platform on knee-braced posts, a railed outer edge, a shingled gable canopy carried on four posts that reaches back across the boarding channel as well as the deck, valanced gable boards, an operator booth with a glazed hatch and control levers, and three hanging lanterns that light after dark. THE PLUNGE POOL: the run-out drop lands in a raised pool the trestle stands in — a LOFTED graded bed (the depth gradient has to come from the bed read through the sheet, because WaterTile's alpha follows wave height and not depth), a wet band straddling the waterline instead of a hard clip edge, a real animated water ribbon, a timber retaining kerb and boulder rockwork. Behind both, the TRESTLE VIADUCT: the kit's bents laced together bay by bay with stringers, ledgers and alternating sway diagonals, every member placed from its two endpoints.",
      render: () => (
        <ScenePreview distance={9} targetY={1.0} height={420} autoRotate={false} background="#bfe6f2"
          dress={(_t, _g, api) => api.setCameraPose?.([5.6, 3.4, 6.2], [-0.6, 0.85, 0.2])}>
          <LogFlume position={[-2.5, -4.4]}>
            <Station />
            <Lift height={1.2} length={3.2} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
            <Drop />
            <Straight length={2.66} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
          </LogFlume>
        </ScenePreview>
      ) },
    { name: 'Chute-drop course (pieces)', description: "Track-piece composition: <Station/> boarding straight, a <Lift/> belt climb to the crest and the classic chute <Drop/> — the log crawls the lift then plunges the drop at speed (gravity-fed drift pacing) into the splash run-out.", render: () => (
        <ScenePreview distance={13}
      targetY={1.0}
      background="#bfe6f2">
          <LogFlume position={[-2.5, -4.4]}>
            <Station />
            <Lift height={1.2} length={3.2} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
            <Drop />
            <Straight length={2.66} />
            <TurnL />
            <Straight length={2} />
            <TurnL />
          </LogFlume>
        </ScenePreview>
      ) },
    { name: 'Cascade Run (out-and-back, three chutes)', description: "RCT2 archetype — the OUT-AND-BACK log flume with a stepped cascade. A 25° conveyor <Lift height={1.4}/> out of the station onto the high traverse, then THREE different chutes on the way home: a 0.4 hop off the top corner, a 0.45 step, and the 0.55 splashdown finale into the run-out, with an <SBend/> meander jogging the back straight between them. Authentic to the piece table: RCT2's log flume has NO helix and NO banked turns, but it does have s-bends and steep-60° DOWN slopes with no steep UP (LogFlume.h:26) — so every climb is gentle and every plunge is steep. Compiles CLOSED with zero synthesized return track; checkCoasterDesign + validateSpline clean, worst clearance 2.28.", render: () => (
        <ScenePreview distance={26}
      targetY={0.5}
      height={520}
      background="#bfe6f2">
          <LogFlume position={[-3.9, -4.0]}>
            <Station />
            <Lift height={1.4} />
            <TurnL radius={1.6} />
            <Drop height={0.4} />
            <Straight length={1.4} />
            <TurnL radius={1.6} />
            <Drop height={0.45} />
            <Straight length={0.8} />
            <SBend length={2.4} radius={1.2} />
            <Straight length={0.8} />
            <Drop />
            <TurnL radius={1.6} />
            <Straight length={3.4} />
            <TurnL radius={1.6} />
            <Straight length={1.16} />
          </LogFlume>
        </ScenePreview>
      ) },
    { name: 'Horseshoe Plunge (hairpin + one big chute)', description: "RCT2 archetype — the HORSESHOE flume: lift straight out of the station, a 180° <TurnL angle={180} radius={3}/> hairpin around the head of the site, then ONE tall 1.15-unit splashdown <Drop/> down the entire return leg into a 2.6-unit splash run-out (the single steep chute is the biggest thing the flume's 25°-up / 60°-down piece table can build). A narrow 6 × 14.5 footprint — the classic \"one big drop\" flume, quite unlike the Cascade Run's wide three-step circuit. Lands on its own brake straight 0.3 u short of the station, so nothing is synthesized; clearance 2.12, validateSpline clean.", render: () => (
        <ScenePreview distance={22}
      targetY={0.8}
      height={520}
      background="#bfe6f2">
          <LogFlume position={[-3.0, -4.45]}>
            <Station />
            <Lift height={1.15} />
            <TurnL angle={180} radius={3} />
            <Straight length={1.2} />
            <Drop />
            <Straight length={2.6} />
            <TurnL radius={1.6} />
            <Straight length={2.8} />
            <TurnL radius={1.6} />
            <Straight length={0.9} />
          </LogFlume>
        </ScenePreview>
      ) },
  ],
};

export default previews;
