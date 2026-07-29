import React from 'react';
import { ScenePreview } from '../Park';
import { PirateShip } from './index';

// Components never render a <Stage> — every preview wraps them in <ScenePreview>.
// Preview 0 is the working view; preview 1 is the MID-DISTANCE park view, which
// is the one that decides whether a rig has a silhouette. A rig that only reads
// in close-up has failed.

const previews = {
  componentName: 'PirateShip',
  importPath: 'components/PirateShip',
  previews: [
    {
      name: '3D rig',
      description:
        "Swinging pirate ship: a lofted two-tone galleon hull with a real sheer, bulwarks and cap rail, a gilded figurehead under the bowsprit, a raked transom with quarter galleries and a stern lantern, and a mast with crow's nest, furled sail, shrouds and jolly roger — hung from four splayed pendulum arms inside a braced orange A-frame, with flanking boarding decks.",
      render: () => (
        <ScenePreview distance={9.5} targetY={1.6} ground height={620}>
          <PirateShip />
        </ScenePreview>
      ),
    },
    {
      name: 'Mid-distance (park view)',
      description: 'The same rig at the distance a guest sees it from across a park — the silhouette check.',
      render: () => (
        <ScenePreview distance={16} targetY={1.4} ground height={620}>
          <PirateShip />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
