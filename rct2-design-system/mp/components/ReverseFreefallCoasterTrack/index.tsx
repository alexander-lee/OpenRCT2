import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[726,1146,53,30],[780,1146,53,30],[834,1146,53,30],[888,1146,53,30]];

export function ReverseFreefallCoasterTrack() {
  return <SpriteRotator name="Reverse Freefall Coaster Track" group="Track Rail" cells={CELLS} />;
}
