import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[234,1113,49,32],[284,1113,49,32],[334,1113,49,32],[384,1113,49,32]];

export function FlyingRollerCoasterInvertedTrack() {
  return <SpriteRotator name="Flying Roller Coaster Inverted Track" group="Track Rail" cells={CELLS} />;
}
