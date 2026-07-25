import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[942,1146,48,30],[991,1146,48,30],[1040,1146,48,30],[1089,1146,48,30]];

export function MultiDimensionRollerCoasterTrack() {
  return <SpriteRotator name="Multi Dimension Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
