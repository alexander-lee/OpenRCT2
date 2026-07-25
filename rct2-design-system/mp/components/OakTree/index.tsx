import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[517,991,64,43],[582,991,64,43],[647,991,64,43],[712,991,64,43]];

export function OakTree() {
  return <SpriteRotator name="Oak Tree" group="Scenery \u00b7 Nature" cells={CELLS} />;
}
