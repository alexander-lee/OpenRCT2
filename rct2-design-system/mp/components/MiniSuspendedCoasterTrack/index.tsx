import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[294,1289,47,22],[342,1289,47,22],[390,1289,47,22],[438,1289,47,22]];

export function MiniSuspendedCoasterTrack() {
  return <SpriteRotator name="Mini Suspended Coaster Track" group="Track Rail" cells={CELLS} />;
}
