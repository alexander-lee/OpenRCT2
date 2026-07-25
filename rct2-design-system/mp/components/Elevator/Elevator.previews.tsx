import React from 'react';
import { Elevator } from './index';

const previews = {
  componentName: 'Elevator',
  importPath: 'components/Elevator',
  previews: [
    { name: 'Default', description: "Elevator \u2014 real RCT2 asset across its 4 map rotations.", render: () => <Elevator /> },
  ],
};

export default previews;
