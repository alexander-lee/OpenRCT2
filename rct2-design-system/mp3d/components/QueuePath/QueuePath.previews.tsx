import React from 'react';
import { ScenePreview } from '../Park';
import { QueuePath } from './index';

const previews = {
  componentName: 'QueuePath',
  importPath: 'components/QueuePath',
  previews: [
    {
      name: '3D rig',
      description: "The RCT2 queue-line path tile: red lane, railings and a queueing guest.",
      render: () => (
        <ScenePreview distance={4.6} targetY={0.35} autoRotate={false}>
          <QueuePath />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
