import React from 'react';
import { ScenePreview, TrackRide, Station, Lift, Drop, Straight, TurnR, Loop } from '../Park';
import { SplineCoaster } from './index';

const previews = {
  componentName: 'SplineCoaster',
  importPath: 'components/SplineCoaster',
  previews: [
    { name: 'Loop Royale — the 360° VERTICAL LOOP', description:
        "The `loop` piece: RCT2's signature steel inversion (TrackElemType::Left/RightVerticalLoop), laid where a real coaster puts one — straight after the first drop, where the speed is. A chain <Lift height={4.6}/> to a level 180° apex hairpin, the full 4.6 back down the out leg, and the train hits the loop at 9.9 u/s: a clothoid TEARDROP **4.0 units tall** (bottom radius 3.0, crest radius 1.0), 3.14 forward and — this is the part that makes it legal — 1.2 units to the SIDE. It used to be 2.5 tall, and that was a limit of the RULER, not of steel: `checkCoasterDesign` exempted a FIXED 2.8 arc-units either side of an inversion, while a loop's own lead-in is 2.07·R, so any loop past R 1.35 fell outside its own exemption and failed the pitchRate sweep. The window is element-sized now — it grows from the flip until the track is level and upright again, which is precisely where an RCT2 fixed element ends — so the loop is sized by the RIDE instead: crest G ≈ 4·Δh/R − 1 for the drop Δh from the lift crest to the loop's top, which is why a taller loop is paired with a taller lift. A planar vertical loop remains geometrically impossible here: a plane curve that returns to its own level with the tangent turned through 2π must cross itself, so its legs meet at ZERO clearance and `validateSpline`'s 0.9 gate can never pass. Real steel and RCT2 answer it identically — the loop is slightly helical and steps one tile across, which is exactly why the game's table holds a LEFT and a RIGHT vertical loop instead of one symmetric piece. Measured on the compiled circuit: design clean with ZERO violations, validateSpline worst clearance 1.09 AT the crossing under the loop, ZERO synthesized closure, worst lateral 0.91 g against the 1.275 g derail gate, +4.84 g through the loop's bottom and +1.15 g over the inverted crest 4.55 up — positive, so the train is pressed INTO the rails the whole way round. 75.3 units, 18.3 s a lap, excitement 5.25 / intensity 6.69 / nausea 2.26, one inversion.",
      render: () => (
        <ScenePreview distance={26} targetY={2.5} height={460} autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([17.8, 13.0, 17.8], [0, 2.6, 0])}>
          <TrackRide profile="coaster" type="steel" name="Loop Royale" position={[2.8, -0.96]} rotation={-Math.PI * 0.25} cars={3}>
            <Station />
            <Lift height={4.6} />
            <TurnR angle={180} radius={2.8} />
            <Drop height={4.6} />
            <Straight length={0.72} />
            <Loop radius={2.0} />
            <Straight length={0.72} />
            <Lift height={2.4} length={3.61} />
            <TurnR angle={180} radius={2.2} />
            <Drop height={2.4} length={3.61} />
            <Straight length={1.66} />
          </TrackRide>
        </ScenePreview>
      ) },
    { name: 'Barrel Roll — the ROLL CHANNEL (a 360° inversion)', description:
        "The new `roll` prop: an explicit ROLL CHANNEL, which is the one thing control points alone cannot ask for. Parallel transport pins the frame up to a single degree of freedom — the roll about the tangent — and curvature banking spends it leaning into turns, so a full 360° rotation about the travel axis is not expressible by any set of points: the path a barrel roll follows is a dead straight line. RCT2 draws exactly the same line. `TrackElemType::leftBarrelRollUpToDown = 174` and its three siblings (ride/ted/TrackElemType.h:192-195) are described at TrackData.cpp:8633 as `{ TrackGroup::barrelRoll, TrackPitch::none, TrackPitch::none, TrackRoll::upsideDown, TrackRoll::none }` with `pieceLength = 96` — a STRAIGHT, LEVEL, un-turned three-tile element whose only change is roll, none→upsideDown and back, which is why a full roll is 6 tiles = **7.2 units** at this kit's 1.2 u/tile and why that is the channel's default `span`. So the API is a list of ELEMENTS (`{ atPoint, dir, turns, span }`) anchored to a fractional CONTROL-POINT index, not a 4th component on the points (that would tie roll to point spacing and change the type of the exported SPLINE_COASTER_LAYOUT) and not a raw callback (nothing could then check the closure rule). The closure rule is the interesting part: `computeSplineFrames` interpolates its sampled frames CYCLICALLY, so the roll profile must be periodic mod 2π — each element ramps 0→2π·turns on a smoothstep in arc length and then HOLDS, which reduces the requirement to \"the signed turns sum to a whole number\". A non-integer total is refused with a warning rather than tearing the seam, exactly as RCT2 ships its barrel roll as a PAIR (…DownToUp + …UpToDown). Roll ADDS to curvature bank (same degree of freedom), so the element belongs on straight level track — measured under this one: **0.09° of pitch and 0.00° of auto-bank**. Inversions are STEEL ONLY: the wooden RTD's `enabledTrackGroups` (WoodenRollerCoaster.h:26) lists `verticalLoop` but neither `corkscrew` nor `barrelRoll`, so a wooden build drops the roll with a warning. Measured on this circuit: the track reaches **up.y = −1.0000** (dead upside down) at u 0.7094 and passes through banked-90 at |up.y| 0.00038; the channel adds **exactly −1.000000 turns**; frame at u=1 meets u=0 to 7.4e-11; `checkCoasterDesign('steel')` clean with ZERO violations on the ROLLED frames (`checkCoasterDesign('wooden')` reports 'inversion'); validateSpline worst clearance 4.063; worst lateral 0.734 g against the 1.275 g derail gate. Through the whole 24 s animation cycle every car basis stays right-handed (det +1), car up == frame up to 1.000000, the wheel offset holds 0.195 to 0.000000, and at the apex the lead car hangs at y 0.505 with both riders at 0.285 under a track centreline at 0.700 — seated, upside down. 75.8 units, 19.4 s a lap, excitement 4.83 / intensity 5.09 / nausea 1.71, one inversion.",
      render: () => (
        // fixed pose, low and along the valley, so the ROLL is what you see —
        // the whole 34-unit stadium from higher up makes it 20 px of track
        <ScenePreview distance={34} targetY={1.4} height={460} autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([8.0, 6.4, 19.0], [-1.0, 1.2, 1.4])}>
          <SplineCoaster
            roll={[{ atPoint: 41.5, dir: 'R', turns: 1 }]}
            points={[
              [-14.19, 2.0, -2.8], [-11.99, 2.0, -2.8],                              // west hairpin exit, level run-out
              [-11.16, 1.99, -2.8], [-10.33, 1.86, -2.8], [-9.5, 1.63, -2.8], [-8.67, 1.35, -2.8], [-7.83, 1.07, -2.8], [-7.0, 0.84, -2.8], [-6.17, 0.71, -2.8], [-5.34, 0.7, -2.8], // the drop home
              [-4.14, 0.7, -2.8], [-2.94, 0.7, -2.8],                                 // STATION — level, in the lowest quarter
              [-2.14, 0.7, -2.8], [-1.35, 0.84, -2.8], [-0.55, 1.18, -2.8], [0.25, 1.57, -2.8], [1.05, 1.96, -2.8], [1.84, 2.34, -2.8], [2.64, 2.73, -2.8], [3.44, 3.12, -2.8], [4.23, 3.46, -2.8], [5.03, 3.6, -2.8], // the 26° chain lift
              [5.83, 3.6, -2.8], [14.19, 3.6, -2.8],                                  // crest plateau, held level into the turn
              [16.17, 3.6, -1.98], [16.99, 3.6, 0.0], [16.17, 3.6, 1.98], [14.19, 3.6, 2.8], // EAST hairpin — level, ridden slow (the apex trick)
              [11.99, 3.6, 2.8],                                                      // level run-out
              [11.19, 3.59, 2.8], [10.4, 3.43, 2.8], [9.61, 3.13, 2.8], [8.81, 2.75, 2.8], [8.02, 2.35, 2.8], [7.23, 1.95, 2.8], [6.43, 1.55, 2.8], [5.64, 1.17, 2.8], [4.85, 0.87, 2.8], [4.05, 0.71, 2.8], // THE DROP — the train hits the valley at 8.2 u/s
              // points 39-44: the valley. Dead straight, dead level — THE BARREL ROLL, centred at atPoint 41.5
              [3.26, 0.7, 2.8], [1.54, 0.7, 2.8], [-0.18, 0.7, 2.8], [-1.9, 0.7, 2.8], [-3.62, 0.7, 2.8], [-5.34, 0.7, 2.8],
              [-6.17, 0.71, 2.8], [-7.0, 0.84, 2.8], [-7.83, 1.07, 2.8], [-8.67, 1.35, 2.8], [-9.5, 1.63, 2.8], [-10.33, 1.86, 2.8], [-11.16, 1.99, 2.8], [-11.99, 2.0, 2.8], // climb out of the valley
              [-14.19, 2.0, 2.8], [-16.17, 2.0, 1.98], [-16.99, 2.0, 0.0], [-16.17, 2.0, -1.98], // WEST hairpin — level and high, so slow
            ]}
          />
        </ScenePreview>
      ) },
    { name: '3D rig — Vertical Plunge (the steepest legal steel drop)', description:
        "The full rig — closed Catmull-Rom track, parallel-transport frames, curvature banking, chain lift, ground supports, 3-car CoasterCar train — on the STEEPEST circuit RCT2's steel rules allow. The lift climbs a 55° hill to a 6.4-unit crest, the train swings the level apex hairpin at chain speed, then falls off the edge at 72.6°: a 5.7-unit near-vertical plunge into the valley, a 67° climb to a second HIGH hairpin and a second 67° drop home. Steel track is allowed 90° (TYPE_RULES.steel), so the BINDING limit is the pitch-RATE rule — RCT2 steps slope through one-tile transition pieces, ~0.55 rad/unit; this layout runs 0.44, which is exactly what caps the plunge at ~73°. Both turns sit AT an apex (the §4.0 trick) so every fast metre is dead straight: worst lateral 0.66 g against the 1.5 g derail guard, +7.2 g through the valley, 1.33 s airtime, checkCoasterDesign('steel') clean with ZERO violations, validateSpline worst clearance 3.23. Omit `points` for the gentler stock circuit (SPLINE_COASTER_LAYOUT).",
      render: () => (
        <ScenePreview distance={17.5} targetY={2.6} height={340} autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([11.39, 9.44, 11.39], [0, 2.6, 0])}>
          <SplineCoaster
            points={[
              [-3.25, 0.70, -0.57], [-2.64, 0.70, -1.18], [-2.03, 0.70, -1.79], // station straight, level (boarding)
              [-1.41, 0.70, -2.40], [-0.90, 0.82, -2.92], [-0.39, 1.21, -3.43], [0.12, 2.00, -3.94], [0.64, 3.03, -4.46], [1.15, 4.07, -4.97], [1.66, 5.10, -5.48], [2.18, 5.89, -5.99], [2.69, 6.28, -6.51], // the 55° chain lift
              [3.20, 6.40, -7.02], [4.08, 6.40, -7.60], [5.11, 6.40, -7.81], [6.14, 6.40, -7.61], [7.02, 6.40, -7.02], [7.61, 6.40, -6.14], [7.81, 6.40, -5.11], [7.60, 6.40, -4.08], // apex hairpin, held LEVEL — ridden at chain speed
              [7.02, 6.40, -3.20], [6.57, 6.31, -2.75], [6.12, 6.01, -2.30], [5.67, 5.45, -1.85], [5.22, 4.43, -1.40], [4.77, 2.67, -0.95], [4.32, 1.65, -0.50], [3.87, 1.09, -0.05], [3.42, 0.79, 0.40], // THE DROP — 72.6° off the crest
              [2.97, 0.70, 0.85], [2.17, 0.70, 1.65], [1.37, 0.70, 2.45], // valley: the fastest track on the circuit, dead straight
              [0.57, 0.70, 3.25], [0.03, 0.83, 3.79], [-0.51, 1.27, 4.33], [-1.05, 2.17, 4.87], [-1.59, 3.73, 5.41], [-2.13, 4.63, 5.94], [-2.66, 5.07, 6.48], // 67° climb to the second apex
              [-3.20, 5.20, 7.02], [-4.08, 5.20, 7.60], [-5.11, 5.20, 7.81], [-6.14, 5.20, 7.61], [-7.02, 5.20, 7.02], [-7.61, 5.20, 6.14], [-7.81, 5.20, 5.11], [-7.60, 5.20, 4.08], // second hairpin — level and HIGH, so slow
              [-7.02, 5.20, 3.20], [-6.48, 5.07, 2.66], [-5.94, 4.63, 2.13], [-5.41, 3.73, 1.59], [-4.87, 2.17, 1.05], [-4.33, 1.27, 0.51], [-3.79, 0.83, -0.03], // second 67° drop, home into the station
            ]}
          />
        </ScenePreview>
      ) },
    { name: 'Out-and-Back (taller crest, twin drops)', description:
        "RCT2 archetype — the OUT-AND-BACK: the train climbs a taller crest (3.6 vs the stock 3.05), takes one long plunge down the east side, skims a speed hill, swings a wide turnaround at the far end and takes a SECOND drop on the return leg before a low banked turn home. Shows the new `points` prop: pass any control-point layout and the sweep, banking, chain-lift detection and ground supports all follow it. Verified legal before shipping — checkCoasterDesign('steel') clean with zero issues and validateSpline worst clearance 2.22.",
      render: () => (
        <ScenePreview distance={20} targetY={1.6} height={520}>
          <SplineCoaster
            points={[
              [-5.6, 0.7, -2.4], [-2.2, 0.75, -4.2], // station straight, level
              [1.6, 2.2, -4.8], [4.6, 3.6, -4.0],    // lift hill to the tall crest
              [6.0, 3.55, -2.2],                      // crest plateau, held level
              [6.4, 2.1, 0.4], [5.6, 1.05, 2.4],      // the long first drop
              [3.4, 1.85, 4.2], [0.6, 2.15, 5.0],     // speed hill + wide turnaround
              [-2.4, 1.25, 4.6], [-4.8, 0.9, 3.4],    // second drop on the return
              [-6.6, 0.78, 1.2], [-6.2, 0.7, -1.2],   // low banked turn home
            ]}
          />
        </ScenePreview>
      ) },
  ],
};

export default previews;
