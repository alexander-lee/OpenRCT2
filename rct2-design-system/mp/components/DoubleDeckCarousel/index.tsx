import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[506,200,114,134],[621,200,114,134],[736,200,114,134],[851,200,114,134]];

export function DoubleDeckCarousel() {
  return <SpriteRotator name="Double Deck Carousel" group="Gentle Ride" cells={CELLS} />;
}
