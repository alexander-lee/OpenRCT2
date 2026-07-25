import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[147,1177,43,30],[191,1177,43,30],[235,1177,43,30],[279,1177,43,30]];

export function SuspendedSwingingCoasterTrack() {
  return <SpriteRotator name="Suspended Swinging Coaster Track" group="Track Rail" cells={CELLS} />;
}
