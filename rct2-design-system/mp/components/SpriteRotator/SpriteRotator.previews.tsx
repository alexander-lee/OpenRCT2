import React from 'react';
import { SpriteRotator } from './index';

const previews = {
  componentName: 'SpriteRotator',
  importPath: 'components/SpriteRotator',
  previews: [
    { name: 'Overview', description: 'Reusable primitive.', render: () => <SpriteRotator name="Sample" cells={[[0,0,32,24],[0,0,32,24]]} /> },
  ],
};

export default previews;
