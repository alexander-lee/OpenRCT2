import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[879,1177,61,29],[941,1177,61,29],[1003,1177,61,29],[1065,1177,61,29]];

export function StandUpRollerCoasterTrack() {
  return <SpriteRotator name="Stand Up Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
