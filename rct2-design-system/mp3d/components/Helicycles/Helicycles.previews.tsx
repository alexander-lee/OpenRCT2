import React from 'react';
import { ScenePreview } from '../Park';
import { Helicycles } from './index';

const previews = {
  componentName: 'Helicycles',
  importPath: 'components/Helicycles',
  previews: [
    { name: '3D rig', description: "Helicycles: pedal-powered orange helicopter pods with pink rotors (HELICAR).", render: () => (
        <ScenePreview distance={6}
      targetY={0.9}>
          <Helicycles />
        </ScenePreview>
      ) },
  ],
};

export default previews;
