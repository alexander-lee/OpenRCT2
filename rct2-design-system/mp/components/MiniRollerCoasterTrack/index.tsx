import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[684,1264,44,23],[729,1264,44,23],[774,1264,44,23],[819,1264,44,23]];

export function MiniRollerCoasterTrack() {
  return <SpriteRotator name="Mini Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
