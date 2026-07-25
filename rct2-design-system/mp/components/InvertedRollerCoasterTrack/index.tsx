import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[434,1113,49,32],[484,1113,49,32],[534,1113,49,32],[584,1113,49,32]];

export function InvertedRollerCoasterTrack() {
  return <SpriteRotator name="Inverted Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
