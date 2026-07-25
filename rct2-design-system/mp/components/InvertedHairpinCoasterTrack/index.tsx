import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[126,1289,41,22],[168,1289,41,22],[210,1289,41,22],[252,1289,41,22]];

export function InvertedHairpinCoasterTrack() {
  return <SpriteRotator name="Inverted Hairpin Coaster Track" group="Track Rail" cells={CELLS} />;
}
