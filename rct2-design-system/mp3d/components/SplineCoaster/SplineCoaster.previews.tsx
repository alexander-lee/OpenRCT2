import React from 'react';
import { ScenePreview } from '../Park';
import { SplineCoaster } from './index';

const previews = {
  componentName: 'SplineCoaster',
  importPath: 'components/SplineCoaster',
  previews: [
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
