import React from 'react';
import { ScenePreview } from '../Park';
import { DirtPath } from './index';

const previews = {
  componentName: 'DirtPath',
  importPath: 'components/DirtPath',
  previews: [
    {
      name: '3D rig',
      description: "A trodden-earth dirt footpath tile with worn ruts, embedded pebbles, packed-earth edging and verge tufts (RCT2 dirt footpath) — a guest strolls its length.",
      render: () => (
        <ScenePreview distance={4.6} targetY={0.25} autoRotate={false}>
          <DirtPath />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
