import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[504,1264,44,23],[549,1264,44,23],[594,1264,44,23],[639,1264,44,23]];

export function MineRideTrack() {
  return <SpriteRotator name="Mine Ride Track" group="Track Rail" cells={CELLS} />;
}
