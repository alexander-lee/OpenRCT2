import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1090,1208,30,26],[1121,1208,30,26],[1152,1208,30,26],[0,1237,30,26]];

export function VirginiaReel() {
  return <SpriteRotator name="Virginia Reel" group="Roller Coaster" cells={CELLS} />;
}
