import React from 'react';
import { Enterprise } from './index';

const previews = {
  componentName: 'Enterprise',
  importPath: 'components/Enterprise',
  previews: [
    { name: 'Default', description: "Enterprise \u2014 real RCT2 asset across its 4 map rotations.", render: () => <Enterprise /> },
  ],
};

export default previews;
