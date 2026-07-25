import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[266,1208,48,28],[315,1208,48,28],[364,1208,48,28],[413,1208,48,28]];

export function LayDownRollerCoasterInvertedTrack() {
  return <SpriteRotator name="Lay Down Roller Coaster Inverted Track" group="Track Rail" cells={CELLS} />;
}
