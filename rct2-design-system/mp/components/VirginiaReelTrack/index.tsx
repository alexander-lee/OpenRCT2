import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[318,1146,47,30],[366,1146,47,30],[414,1146,47,30],[462,1146,47,30]];

export function VirginiaReelTrack() {
  return <SpriteRotator name="Virginia Reel Track" group="Track Rail" cells={CELLS} />;
}
