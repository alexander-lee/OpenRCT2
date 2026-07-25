import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[510,1146,53,30],[564,1146,53,30],[618,1146,53,30],[672,1146,53,30]];

export function AirPoweredVerticalCoasterTrack() {
  return <SpriteRotator name="Air Powered Vertical Coaster Track" group="Track Rail" cells={CELLS} />;
}
