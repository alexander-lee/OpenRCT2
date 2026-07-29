// ---------------------------------------------------------------------------
// WorldLandmark — pick a world's GIANT off its own theme.
//
// Each landmark is a REAL COMPONENT you can mount by name, exactly like
// `<Volcano>`:
//
//     <Volcano />           fire             the original — cone, crater, flows
//     <BeachedGalleon />    pirateBeach      a ship heeled over in the sand
//     <GreatZeppelin />     steampunk        an airship at its mooring mast
//     <DragonRoost />       enchantedForest  a crag, a stick nest, glowing eggs
//     <DiscoBallFloor />    neon             a mirror ball over a chasing floor
//
// This component is the CONVENIENCE over those five: one tag per world, so a
// park never has to know which giant belongs to which theme. Either form works.
//
// WHY THEY EXIST. `fire` had `<Volcano>` — radius 2.75 (5.5 tiles across),
// height 2.55 — and no other world had anything of that mass. Their biggest
// pieces were props (`<WreckedHull>` 1.8 × 0.78, `<GiantGear>` r 0.64,
// `<GiantToadstools>` r 0.94, and neon's pylons are tall but THIN). So the
// caldera read as a place and the other four read as a lawn with ornaments.
// ---------------------------------------------------------------------------

import React from 'react';
import { Volcano } from '../Volcano';
import { BeachedGalleon } from '../BeachedGalleon';
import { GreatZeppelin } from '../GreatZeppelin';
import { DragonRoost } from '../DragonRoost';
import { DiscoBallFloor } from '../DiscoBallFloor';
import type { WorldPlan } from '../SetPieceKit';

type XZ = [number, number];

/** every world's giant, by theme id (both spellings resolve) */
export const LANDMARK_OF: Record<string, string> = {
  fire: 'Volcano', emberfall: 'Volcano',
  pirateBeach: 'BeachedGalleon', tidewater: 'BeachedGalleon',
  steampunk: 'GreatZeppelin', brasswork: 'GreatZeppelin',
  enchantedForest: 'DragonRoost', thornwick: 'DragonRoost',
  neon: 'DiscoBallFloor', pulse: 'DiscoBallFloor',
};

/**
 * `<WorldLandmark plan={W} />` — the world's GIANT, picked off its own theme.
 *
 * The partner of `<WorldGround>`: the ground says what the land is made of,
 * this says what it IS. Mount it INSIDE the world's rect and list its cell in
 * `worldPlan({ include })` — a landmark outside the rect dresses nothing and
 * counts for nothing.
 *
 * Mount order: after `<Paths>` and `<WorldGround>`, before the world's props.
 */
export const WorldLandmark: React.FC<{ plan: WorldPlan; position?: XZ; scale?: number }> = ({
  plan, position, scale = 1,
}) => {
  const at: XZ = position ?? [plan.region.cx, plan.region.cz];
  switch (plan.theme.id) {
    case 'pirateBeach':
    case 'tidewater':
      return <BeachedGalleon position={at} scale={scale} />;
    case 'steampunk':
    case 'brasswork':
      return <GreatZeppelin position={at} scale={scale} />;
    case 'enchantedForest':
    case 'thornwick':
      return <DragonRoost position={at} scale={scale} />;
    case 'neon':
    case 'pulse':
      return <DiscoBallFloor position={at} scale={scale} />;
    case 'fire':
    case 'emberfall':
      return <Volcano position={at} radius={2.75 * scale} />;
    default:
      // the Original dress owns no giant — nothing to place, and that is fine
      return null;
  }
};

WorldLandmark.displayName = 'WorldLandmark';
