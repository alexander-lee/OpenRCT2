import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[0,0,187,199],[188,0,187,199],[376,0,187,199],[564,0,187,199]];

export function HauntedHouse() {
  return <SpriteRotator name="Haunted House" group="Gentle Ride" cells={CELLS} />;
}
