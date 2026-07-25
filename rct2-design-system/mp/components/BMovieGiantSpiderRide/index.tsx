import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[132,502,128,104],[261,502,128,104],[390,502,128,104],[519,502,128,104]];

export function BMovieGiantSpiderRide() {
  return <SpriteRotator name="B-Movie Giant Spider Ride" group="Thrill Ride" cells={CELLS} />;
}
