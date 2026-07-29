import React from 'react';
import { ScenePreview } from '../Park';
import { BumperCars } from './index';

const previews = {
  componentName: 'BumperCars',
  importPath: 'components/BumperCars',
  previews: [
    { name: '3D rig', description: "Dodgems: a fenced arena with a powered ceiling grid and four darting cars that actually bump. Steel floor plates with bolted seams and a painted centre ring, rubber rub rails and hazard chevrons on the walls, corner bollards, and the striped facia valance every fairground dodgem hangs off its roof edge.", render: () => (
        <ScenePreview distance={6.5}
      targetY={0.8}>
          <BumperCars />
        </ScenePreview>
      ) },
    { name: 'Car detail', description: "One dodgem up close: a fat rubber bumper torus on the sim's own 0.41 collision radius, the coloured skirt band that flashes on every hit, a flared egg-shaped fibreglass tub under a chrome cockpit rim, a rounded nose cowl with a chrome nose bar and lamp studs, a tall curved back panel carrying the number roundel and twin tail lamps, a bucket seat with piping and a headroll, a dash with a chrome strip, a real spoked steering wheel on a raked column, and the sprung pole — foot plate, coil, mast, brace and contact shoe — up to the live ceiling grid.", render: () => (
        <ScenePreview distance={2.6} targetY={0.5} height={420} autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([2.55, 1.45, 2.75], [0.05, 0.45, 0.1])}>
          <BumperCars />
        </ScenePreview>
      ) },
  ],
};

export default previews;
