import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[692,1077,57,34],[750,1077,57,34],[808,1077,57,34],[866,1077,57,34]];

export function SideFrictionRollerCoasterTrack() {
  return <SpriteRotator name="Side Friction Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
