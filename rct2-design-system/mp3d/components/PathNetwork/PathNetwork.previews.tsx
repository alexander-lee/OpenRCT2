import React from 'react';
import { ScenePreview } from '../Park';
import { PathNetwork, ElevatedWalkway } from './index';

const previews = {
  componentName: 'PathNetwork',
  importPath: 'components/PathNetwork',
  previews: [
    { name: '3D rig', description: 'A branching footpath graph — loop, T-junctions and spurs — rendered as RCT2 grey tarmac ribbons with pale kerbs, junction pads, lamps and bins. Drag to orbit.', render: () => (
        <ScenePreview distance={10}
      targetY={0.15}
      autoRotate={false}>
          <PathNetwork />
        </ScenePreview>
      ) },
    { name: 'Elevated walkway', description: 'RCT2 sloped-path ramps — flat inclined ribbons at constant grade, flush at both knuckles, built from [x, z, elevation] node triples — up to an elevated straight standing on wooden scaffold bays (posts, rungs, alternating diagonal braces — one merged mesh), with a kiosk beside the elevated section on its own four-post scaffold deck. Drag to orbit.', render: () => (
        <ScenePreview distance={11}
      targetY={0.6}
      autoRotate={false}>
          <ElevatedWalkway />
        </ScenePreview>
      ) },
  ],
};

export default previews;
