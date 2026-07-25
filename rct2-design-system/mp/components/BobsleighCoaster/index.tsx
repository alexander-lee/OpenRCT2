import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[864,1264,30,22],[895,1264,30,22],[926,1264,30,22],[957,1264,30,22]];

export function BobsleighCoaster() {
  return <SpriteRotator name="Bobsleigh Coaster" group="Roller Coaster" cells={CELLS} />;
}
