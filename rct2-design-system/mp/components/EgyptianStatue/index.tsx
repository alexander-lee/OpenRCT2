import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[518,813,40,60],[559,813,40,60],[600,813,40,60],[641,813,40,60]];

export function EgyptianStatue() {
  return <SpriteRotator name="Egyptian Statue" group="Scenery \u00b7 Statue" cells={CELLS} />;
}
