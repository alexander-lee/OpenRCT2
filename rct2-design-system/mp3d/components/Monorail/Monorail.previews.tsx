import React from 'react';
import { ScenePreview, Station, Straight, TurnL, TurnR, SBend } from '../Park';
import { Monorail } from './index';

const previews = {
  componentName: 'Monorail',
  importPath: 'components/Monorail',
  previews: [
    { name: '3D rig', description: "A LARGE, PARK-SCALE TRANSPORT RIDE — use it AROUND YOUR ENTIRE PARK, not as a plot attraction in a corner. Elevated monorail beam on piers with a streamlined gliding train: because the beam rides above the ground on piers it can fly over paths, plazas and the gaps between lands, which is what makes a park-wide ring practical where a ground-level ride could never cross. RCT2 agrees — Monorail.h:26 is the only whitelist with `curveLarge`, and its rating asks for open air (RequirementUnsheltered 4), so the game literally rewards a big sweeping outdoor circuit. Size the loop to the PARK: see the Grand Circle Tour preview for the intended scale.", render: () => (
        <ScenePreview distance={8}
      targetY={1.4}>
          <Monorail />
        </ScenePreview>
      ) },
    { name: 'Custom loop (pieces)', description: "Piece-composed FLAT beam loop — the STARTER CIRCUIT documented in Context.md, byte-identical: station + four radius-2 <TurnL/> corners with real straight legs between them. Closes on its own approach straight with NOTHING synthesized (worst clearance 1.75 against the 0.9 minimum, closure gap 1.50, zero compiler warnings, report.fatal unset), so it registers as a real ride. The shuttle becomes three articulated cars gliding the elevated beam (vertical pieces are stripped — monorails never ramp). 7.0 × 9.3 u.", render: () => (
        <ScenePreview distance={15}
      targetY={1.0}>
          {/* THE STARTER CIRCUIT — kept in lockstep with Monorail/Context.md,
              measured by harness/park-eval/probe-monorail-loop.mjs.
              Closure algebra: the four 90° arcs cancel out of the net
              displacement, so the circuit closes iff the two CROSS legs match
              (3 and 3) and the FAR along-axis leg beats the near one by the
              2.6-u station deck plus the tail — 2.6 + 1.2 + 1.2 + 0.3 = 5.3.
              That leaves the cursor 0.3 u short of the station already facing
              it, so compileTrackPieces synthesizes nothing.
              DO NOT "simplify" this into a symmetric rectangle: equal opposite
              legs end 2.6 + tail u PAST the station and the compiler bends a
              loop-back across the beam (0 of 540 measured symmetric rectangles
              are legal, clearances down to 0.00, vs 1008 of 1008 legal once the
              far leg is solved — and a fatal compile is NOT a
              registered ride: no station, no queue, empty transport category).
              The list this preview used to carry turned only 180° and
              synthesized 52% of its own length → FATAL on every page load. */}
          <Monorail position={[-3.5, -1.2]} pieces={[
            'station',
            { type: 'straight', length: 1.2 },
            { type: 'turnL', angle: 90, radius: 2 },
            { type: 'straight', length: 3 },
            { type: 'turnL', angle: 90, radius: 2 },
            { type: 'straight', length: 5.3 },
            { type: 'turnL', angle: 90, radius: 2 },
            { type: 'straight', length: 3 },
            { type: 'turnL', angle: 90, radius: 2 },
            { type: 'straight', length: 1.2 },
          ]} />
        </ScenePreview>
      ) },
    { name: 'MULTI-STATION ring (4 platforms — the §4.2 shape)', description: "THE REQUIRED SHAPE, scaled down to fit a preview: FOUR `station` decks on one closed flat ring, which is legal because an RCT2 Ride owns an ARRAY of stations (ride/Ride.h:404, 255 slots; the legacy save format caps it at 4, rct12/Limits.h:21) and the monorail RTD sets neither `hasOneStation` nor `hasSinglePieceStation` (ride/rtd/transport/Monorail.h:19-84). Each deck gets a platform island — slab, kerb, yellow edge line, back and end railings, canopy on four posts — plus THREE vertical cores down to grade: a stair core and TWO working elevators, one serving the entrance hut and one the exit. All of it is placed from `report.stations[i]`, the compiler's own pose list, never from arithmetic. Inside a <Park> each deck becomes a REAL GameManager station with its own queue lane, entrance hut, exit hut and exit footpath, and the ride is handed the RESOLVED hut coordinates back (`onAccessPlaced`) so the cores stand clear of both huts and of the queue lane instead of, as they used to, capping the lane mouth right in front of the ENTRANCE sign. The trains run a constant-speed TIMETABLE round the ring rather than the ride FSM — a fleet, evenly spaced, moving 99% of the time — and stop at every platform and unload there (RCT2 brakes into every station piece unconditionally: Vehicle.TrackMotion.cpp:433 -> Vehicle.Station.cpp:1503-1511, :974-981), so a guest boards at one platform and walks out at the NEXT. `beamY` 2.6 flies the beam 2.45 u up so it clears streets; the park-scale numbers are in rules/park-generation-rides.md §4.2.", render: () => (
        <ScenePreview distance={34}
      targetY={1.2}>
          {/* the §4.2 shape at L 20.4 / R 6 (the size-48 row of the scaling
              table): p = (L - 2.6)/2 = 8.9, tail = 8.6 split (7.1, 1.5).
              Measured by harness/park-eval/probe-monorail-grand.mjs --sweep:
              worst clearance 6.93, closure gap 1.800, NOTHING synthesized,
              zero compiler warnings, 4 stations. */}
          <Monorail beamY={2.6} pieces={[
            'station',
            { type: 'straight', length: 8.9 },
            { type: 'turnL', angle: 90, radius: 6 },
            { type: 'straight', length: 8.9 },
            'station',
            { type: 'straight', length: 8.9 },
            { type: 'turnL', angle: 90, radius: 6 },
            { type: 'straight', length: 8.9 },
            'station',
            { type: 'straight', length: 8.9 },
            { type: 'turnL', angle: 90, radius: 6 },
            { type: 'straight', length: 8.9 },
            'station',
            { type: 'straight', length: 8.9 },
            { type: 'turnL', angle: 90, radius: 6 },
            { type: 'straight', length: 7.1 },
            { type: 'straight', length: 1.5 },
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
