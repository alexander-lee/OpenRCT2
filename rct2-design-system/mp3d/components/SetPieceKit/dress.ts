import type { WorldTheme } from './index';
import type { StreetDress } from './dressShared';
import { fireDress } from './dressFire';
import { tideDress } from './dressTidewater';
import { brassDress } from './dressBrasswork';
import { gladeDress } from './dressThornwick';
import { pulseDress } from './dressPulse';

// ---------------------------------------------------------------------------
// STREET DRESS — the STRUCTURAL half of the theme layer. See `dressShared.ts`
// for the contract and the reasoning; the five worlds live one per module.
//
// THE PUBLIC SURFACE IS `dressOf` AND `DRESSED_THEME_IDS`, and it is deliberately
// two names. A blanket `export *` here would newly leak every helper (`glow`,
// `chainOf`, `rimStations`, `LEG_DIRS`…) and all five factories out of
// SetPieceKit, which is how a split turns into a breaking API change.
// ---------------------------------------------------------------------------

const FACTORIES: Record<string, (th: WorldTheme) => StreetDress> = {
  fire: fireDress,
  pirateBeach: tideDress,
  steampunk: brassDress,
  enchantedForest: gladeDress,
  neon: pulseDress,
};

/**
 * The STRUCTURAL dress for a theme, or `null` when there is none.
 *
 * `null` is the whole safety story of this module: `DEFAULT_THEME` has no
 * entry, so an un-themed set-piece never enters this file and keeps its
 * historic geometry by CONTROL FLOW rather than by a promise. An inline theme
 * with an unrecognised id gets the same treatment — it still recolours (the
 * palette layer is unconditional), it just does not invent a silhouette for a
 * world nobody described.
 */
export function dressOf(theme: WorldTheme | undefined): StreetDress | null {
  if (!theme) return null;
  const f = FACTORIES[theme.id];
  return f ? f(theme) : null;
}

/** every theme id that has a structural dress (docs + probes) */
export const DRESSED_THEME_IDS = Object.keys(FACTORIES);

export type { StreetDress, ThemedLamp, KerbStation, PlazaCtx } from './dressShared';
