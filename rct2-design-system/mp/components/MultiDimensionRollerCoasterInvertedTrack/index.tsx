import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1138,1146,48,30],[0,1177,48,30],[49,1177,48,30],[98,1177,48,30]];

export function MultiDimensionRollerCoasterInvertedTrack() {
  return <SpriteRotator name="Multi Dimension Roller Coaster Inverted Track" group="Track Rail" cells={CELLS} />;
}
