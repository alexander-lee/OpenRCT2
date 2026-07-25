import React from 'react';
import { Teleporter } from './index';

const previews = {
  componentName: 'Teleporter',
  importPath: 'components/Teleporter',
  previews: [
    { name: 'Default', description: "Teleporter \u2014 real RCT2 asset across its 4 map rotations.", render: () => <Teleporter /> },
  ],
};

export default previews;
