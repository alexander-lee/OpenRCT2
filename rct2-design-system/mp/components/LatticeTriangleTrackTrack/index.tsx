import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[922,1113,44,31],[967,1113,44,31],[1012,1113,44,31],[1057,1113,44,31]];

export function LatticeTriangleTrackTrack() {
  return <SpriteRotator name="Lattice Triangle Track Track" group="Track Rail" cells={CELLS} />;
}
