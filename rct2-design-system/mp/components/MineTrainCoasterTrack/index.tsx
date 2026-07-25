import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[31,1237,49,26],[81,1237,49,26],[131,1237,49,26],[181,1237,49,26]];

export function MineTrainCoasterTrack() {
  return <SpriteRotator name="Mine Train Coaster Track" group="Track Rail" cells={CELLS} />;
}
