import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[934,813,72,55],[1007,813,72,55],[1080,813,72,55],[0,884,72,55]];

export function C1950SRocketRide() {
  return <SpriteRotator name="1950's Rocket Ride" group="Roller Coaster" cells={CELLS} />;
}
