import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[846,940,50,46],[897,940,50,46],[948,940,50,46],[999,940,50,46]];

export function StreamlinedMonorailTrains() {
  return <SpriteRotator name="Streamlined Monorail Trains" group="Transport Ride" cells={CELLS} />;
}
