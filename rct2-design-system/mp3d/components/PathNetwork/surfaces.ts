// ---------------------------------------------------------------------------
// PATH SURFACES — the walked-surface palettes, in a LEAF module.
//
// WHY THIS FILE EXISTS (and why it must import NOTHING):
//
// `SetPieceKit`'s `WORLD_THEMES` builds its theme objects at MODULE SCOPE and
// each one evaluates a surface preset (`pathSurface: SURFACE_BASALT`). The
// component graph has a real cycle —
//
//     SetPieceKit -> PathNetwork -> Park -> SetPieceKit
//
// (`PathNetwork/index.tsx` imports `composable` from `../Park`, and `Park`
// imports `SetPieceKit`.) If the presets lived in `PathNetwork/index.tsx`, then
// whichever module the bundler starts with decides whether `SURFACE_BASALT` is
// initialised when `WORLD_THEMES` is evaluated. esbuild happens to hoist these
// favourably and the local bundle works — but that is luck, not a guarantee,
// and a bundler that orders them the other way leaves every theme with
// `pathSurface: undefined`, or throws on a binding that is still `void 0`.
//
// A module with NO imports cannot be part of a cycle, so its bindings are
// always initialised before any consumer's body runs. `PathNetwork/index.tsx`
// re-exports everything here (so `from '../PathNetwork'` keeps working for
// ordinary consumers), while `SetPieceKit` imports THIS FILE directly and
// therefore never pulls `PathNetwork/index.tsx` — and never enters the cycle.
//
// Keep it dependency-free. Adding an import here re-opens the hazard.
// ---------------------------------------------------------------------------

/**
 * A PATH SURFACE — what the walked network is made of.
 *
 * Municipal grey concrete is correct for a hub or a plain park, and WRONG
 * running through a volcanic caldera, a shipwreck cove or a nightclub street.
 * A themed land re-skins its own court, but until surfaces existed the STREETS
 * between and through the lands stayed grey, so a themed world was a costume
 * over municipal infrastructure.
 *
 * `pave` is the walking surface, `kerb` its edging, `seam` the joint lines.
 * `*Tex` picks the procedural Stage texture; keep it plausible for the material
 * (`asphalt` for tarmac, `sand` for a beach path, `wood` for decking,
 * `concrete` for flags).
 */
export interface PathSurface {
  pave: number;
  kerb: number;
  seam: number;
  paveTex?: 'asphalt' | 'concrete' | 'sand' | 'wood' | 'metal' | 'grass';
  kerbTex?: 'asphalt' | 'concrete' | 'sand' | 'wood' | 'metal' | 'grass';
  /** paving roughness (default 0.95) — gloss is how a nightclub street reads */
  rough?: number;
}

/** an OBB region of the park that paves itself with its own surface — pass a
 *  world's `plan.extent` and its `theme.pathSurface` */
export interface PathSurfaceZone {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  /** quarter-turn yaw of the region (default 0) */
  yaw?: number;
  surface: PathSurface;
}

/** the stock municipal tarmac-and-concrete street (unchanged default) */
export const SURFACE_TARMAC: PathSurface = { pave: 0x9a9a96, kerb: 0xb8b8b2, seam: 0x77776f };
/** the stock beaten-earth track (what `kind: 'dirt'` has always produced) */
export const SURFACE_DIRT: PathSurface = { pave: 0x9a7448, kerb: 0x7a5a34, seam: 0x6a4e2c, paveTex: 'sand', kerbTex: 'concrete' };

/**
 * THE FIVE WORLD SURFACES. Each was picked against its own land's ground and
 * then MEASURED in a render, not chosen in the abstract — the recurring failure
 * is a surface landing on the same VALUE as the terrain under it so the court
 * loses its edge (Tidewater's boardwalk), or a pale course reading as municipal
 * concrete in a wood (Thornwick). Both directions are live.
 *
 * Audit findings, so these are not re-litigated blind:
 *  - BASALT   luma 0.0445 vs Emberfall's ash 0.0185 → +1.27 stops, and −2.68
 *             under the surrounding sand. An edge both ways. KEEP.
 *  - BOARDWALK street luma ~91 vs beach ~135 — only ~1.5x, short of the 2-stop
 *             rule, and it reads ONLY because the dark kerb/seam pair gives it
 *             a hard edge. Do NOT lighten `kerb`/`seam`; darken `pave` toward
 *             ~0x8f7048 if more margin is ever wanted.
 *  - IRONPLATE `pave` is deliberately Brasswork's own `pavingLight` — the tone
 *             its court is already laid in — luma ~90 against cinder 43-56.
 *  - MOSSFLAG luma 110 against a wood at 52-67 at essentially the same hue
 *             (68 deg): a trodden way, not municipal concrete. KEEP.
 *  - NIGHTGLASS ladder 30.2 (land asphalt) -> 43.6 (this) -> 60.9 (court) ->
 *             75.0 (kerb): monotone, no collapse either way. The PALE kerb is
 *             what makes a near-black preset safe — 0x2b2b33 on 0x1c1e26 alone
 *             is a 1.6x step with no edge. `rough: 0.45` matters: a nightclub
 *             street reads by being glossy, not merely dark.
 */
export const SURFACE_BASALT: PathSurface = { pave: 0x5d534d, kerb: 0x7d7069, seam: 0x342c29, paveTex: 'concrete', kerbTex: 'concrete' };
export const SURFACE_BOARDWALK: PathSurface = { pave: 0xa8895f, kerb: 0x6f5637, seam: 0x53401f, paveTex: 'wood', kerbTex: 'wood' };
export const SURFACE_IRONPLATE: PathSurface = { pave: 0x8e8880, kerb: 0x5a4a3c, seam: 0x3b342e, paveTex: 'metal', kerbTex: 'concrete', rough: 0.8 };
export const SURFACE_MOSSFLAG: PathSurface = { pave: 0x6f7355, kerb: 0x8b8d76, seam: 0x3f452f, paveTex: 'concrete', kerbTex: 'concrete' };
export const SURFACE_NIGHTGLASS: PathSurface = { pave: 0x2b2b33, kerb: 0x4a4a58, seam: 0x16161c, paveTex: 'concrete', kerbTex: 'metal', rough: 0.45 };

/**
 * THE COMMON FURNITURE, themed — bench / bin / lamp / fountain / stall tones.
 *
 * This lives HERE, in the leaf module, for the same reason `PathSurface` does:
 * `SetPieceKit -> PathNetwork -> Park -> SetPieceKit` is a real import cycle, so
 * `PathNetwork/build.ts` cannot import a VALUE out of SetPieceKit to resolve a
 * theme's furniture. Declaring the shape and its defaults in a module with no
 * imports lets both sides share it: SetPieceKit re-exports it as
 * `WorldFurniture` (it already imports `PathSurface` from here) and build.ts
 * consumes it directly.
 *
 * Every default is the exact constant its builder used to bake in, so a park
 * with no theme renders identically to before this existed.
 */
export interface PathFurniture {
  /** cast frame of a verge BENCH, and a LITTER BIN's ribbed body — one ironwork
   *  tone, as RCT2 has it (was PathNetwork's `IRON_C`) */
  benchFrame: number;
  /** the bench's timber slats, seat + back (was its `SLAT_C`) */
  benchSlat: number;
  binBody: number;
  /** the bin's domed lid — a separate token so a theme can accent it */
  binLid: number;
  /** verge LAMP POST ironwork, its lantern glass, and that glass's emissive */
  lampPost: number;
  lantern: number;
  lanternGlow: number;
  /** FOUNTAIN: basin masonry, the water disc, its jet/spray tint */
  basin: number;
  water: number;
  spray: number;
  /** MARKET STALL / BAZAAR: canopy, fascia trim, and the post it hangs on */
  stallCanopy: number;
  stallTrim: number;
  stallPost: number;
}

/** the furniture every unthemed park has always had — see PathFurniture */
export const DEFAULT_FURNITURE: PathFurniture = {
  benchFrame: 0x2c3a33,
  benchSlat: 0x6b4a2a,
  binBody: 0x2c3a33,
  binLid: 0x2c3a33,
  lampPost: 0x2c3a33,
  lantern: 0xffe9a8,
  lanternGlow: 0x8a6c20,
  basin: 0x9b968c,
  water: 0x1f8fd2,
  spray: 0x9adcec,
  stallCanopy: 0xe8dfc8,
  stallTrim: 0xa8443c,
  stallPost: 0x6b4a2a,
};
