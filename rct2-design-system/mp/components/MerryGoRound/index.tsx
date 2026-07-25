import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[991,610,113,97],[0,715,113,97],[114,715,113,97],[228,715,113,97]];

export function MerryGoRound() {
  return <SpriteRotator name="Merry-Go-Round" group="Gentle Ride" cells={CELLS} />;
}
