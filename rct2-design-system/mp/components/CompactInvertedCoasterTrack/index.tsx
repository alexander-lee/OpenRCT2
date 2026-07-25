import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[70,1208,48,28],[119,1208,48,28],[168,1208,48,28],[217,1208,48,28]];

export function CompactInvertedCoasterTrack() {
  return <SpriteRotator name="Compact Inverted Coaster Track" group="Track Rail" cells={CELLS} />;
}
