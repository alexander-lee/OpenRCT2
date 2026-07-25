import React, { useState } from 'react';
import { rect43, Stage } from '../Stage';
import type { StageViewportRect } from '../Stage';
import { UIWindow, ViewportFrame } from '../UIWindow';
import { buildRideSpline } from '../SplineRideKit';
import { buildCoasterCar } from '../CoasterCar';
import { attachPlayerCam } from './index';
import type { PlayerCamMode, PlayerCamHandle } from './index';

// The camera demos live HERE (previews own the Stage; index.tsx exports the
// attachPlayerCam API — components never render a <Stage>).
// ---------------------------------------------------------------------------
// Preview: a small SplineRideKit coaster with a 2-car train; the front car
// carries a live onboard PlayerCam inset bottom-left (second preview: chase).
// Layout copied from SplineRideKit's known-valid MINI_COASTER loop.
// ---------------------------------------------------------------------------
const LOOP: [number, number, number][] = [
  [-3.0, 0.55, -0.6], [-2.2, 0.55, -1.9], [-0.4, 0.9, -2.5], [1.5, 1.5, -2.1],
  [2.6, 1.5, -0.6], [2.55, 1.0, 1.0], [1.2, 0.6, 2.2], [-1.0, 0.55, 2.4],
  [-2.7, 0.55, 1.5], [-3.2, 0.55, 0.4],
];

function CoasterCamDemo({ mode }: { mode: PlayerCamMode }) {
  // inset rect is computed in build (needs the live canvas aspect for rect43)
  // and lifted here so the mandatory ViewportFrame can cover it (rules/ui.md)
  const [vpRect, setVpRect] = useState<StageViewportRect | null>(null);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Stage
        height={400}
        distance={10}
        targetY={0.9}
        build={(t, g, api) => {
          const coaster = buildRideSpline(t, LOOP, { profile: 'coaster' });
          g.add(coaster.group);
          const front = buildCoasterCar(t, 'front');
          const tail = buildCoasterCar(t, 'end');
          const run = coaster.run([front, tail], { spacing: 1.15 });
          let cam: PlayerCamHandle | null = null;
          if (api) {
            // standard bottom-left 4:3 inset (rules/ui.md)
            const el = api.renderer.domElement;
            const aspect = (el.clientWidth || el.width) / (el.clientHeight || el.height) || 2.2;
            const r = rect43(0.02, 0, 0.26, aspect);
            const rect = { ...r, y: 1 - 0.03 - r.h };
            // chase sits 2.2 behind the front car — inside the trailing car
            // on this 2-car train — so the whole train goes on the hide list
            cam = attachPlayerCam(t, api, front, { mode, rect, hide: mode === 'chase' ? [front, tail] : [front] });
            setVpRect(rect);
          }
          return (time) => {
            run(time);
            void cam; // detach() lives with the Stage teardown
          };
        }}
      />
      <UIWindow title={mode === 'onboard' ? 'On-Ride Camera' : 'Chase Camera'} x={10} y={10} width={190}>
        <div>{mode === 'onboard' ? 'Riding the front car — seat-height view, looking forward.' : 'Following 2.2 behind and 0.9 above the front car.'}</div>
        <div style={{ marginTop: 3, fontSize: 9, opacity: 0.75 }}>Live view: bottom-left inset</div>
      </UIWindow>
      {/* mandatory framed-monitor chrome over the camera inset (rules/ui.md) */}
      {vpRect && <ViewportFrame rect={vpRect} />}
    </div>
  );
}

/** default preview: the onboard camera riding the front car */
function PlayerCamOnboard() {
  return <CoasterCamDemo mode="onboard" />;
}

/** chase-mode preview */
function PlayerCamChase() {
  return <CoasterCamDemo mode="chase" />;
}


const previews = {
  componentName: 'PlayerCam',
  importPath: 'components/PlayerCam',
  previews: [
    {
      name: 'Onboard camera on a coaster train',
      description:
        'attachPlayerCam in onboard mode: the camera is parented to the front car of a small SplineRideKit coaster at seat height looking forward (zero-lag — the vehicle world matrix carries it), rendered live into the default bottom-left viewport inset via api.addViewport. A UIWindow labels the feed; the main orbit view keeps working.',
      render: () => <PlayerCamOnboard />,
    },
    {
      name: 'Chase camera',
      description:
        'attachPlayerCam in chase mode: each frame the camera re-poses from the front car’s world matrix — 2.2 behind the travel direction, 0.9 up, looking at the vehicle — in the bottom-left inset.',
      render: () => <PlayerCamChase />,
    },
  ],
};

export default previews;
