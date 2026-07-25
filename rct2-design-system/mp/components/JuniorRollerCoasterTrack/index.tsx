import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[455,1237,56,25],[512,1237,56,25],[569,1237,56,25],[626,1237,56,25]];

export function JuniorRollerCoasterTrack() {
  return <SpriteRotator name="Junior Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
