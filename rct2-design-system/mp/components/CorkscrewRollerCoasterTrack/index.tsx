import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[683,1177,48,29],[732,1177,48,29],[781,1177,48,29],[830,1177,48,29]];

export function CorkscrewRollerCoasterTrack() {
  return <SpriteRotator name="Corkscrew Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
