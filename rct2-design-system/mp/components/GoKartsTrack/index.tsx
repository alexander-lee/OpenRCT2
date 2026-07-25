import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[323,1177,64,30],[388,1177,64,30],[453,1177,64,30],[518,1177,64,30]];

export function GoKartsTrack() {
  return <SpriteRotator name="Go Karts Track" group="Track Rail" cells={CELLS} />;
}
