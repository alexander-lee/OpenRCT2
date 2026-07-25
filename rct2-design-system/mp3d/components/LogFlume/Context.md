# LogFlume

Log flume water ride: an elevated trough with a CARVED log boat of riders. The hull (exported as `buildLog(t, scheme?)`) is ported from the reference "RC Park 3D" LogBoat construction: an open-top LatheGeometry log (top ~0.66 rad left open, rounded bow AND stern, DoubleSide bark), partial-arc darker bark rings that follow the taper via the shared `hullROf` profile, pale cut-wood gunwale lips SWEPT along the opening edges (tubes hugging the hull, never floating past the tapers), a dark hollowed cockpit with three cut-wood bench seats + back lips, cut-wood BOW/STERN DECKS closing the lathe's opening arc over the end tapers (plus bark tip plugs) so the hull is solid from every angle, chevron bow-wave plates at the waterline, and three seated `buildPeep` riders. Hull radius 0.30 / length 1.48 / origin at barrel centre — trough-compatible (rides at wheelOffset 0.25).

The drop lands in a flared splash RUN-OUT on the trough itself (no separate splash pool): low outward-leaned splash boards ride both rim rails through the valley (found by a deterministic steepest-frame scan), churned-foam patches whiten the trough water, and the proximity-driven foam burst + ParticleKit droplet spray erupt as the log crosses.

Track pieces: `pieces` prop or JSX piece children (`<Station/><Lift/><Drop/>…`) compile via `compileTrackPieces` on the 'flume' profile — vertical lifts/drops are legal (rampPoints grammar) and the drift pacing plunges drops at up to ~4x climb speed; a FATAL compile marks the build `invalid` (never registered). Sim extras: the lead log is the ride `vehicle` (RideViewer onboard cam). Park layout: queue front 4.4 / exit [-1.9, 4.0] clear the trough loop. Trough water: ONE continuous animated `buildWaterRibbon` (WaterTile shader, same as RiverRapids' channel) follows the flume spline — 220 frame samples riding +0.035 above the centreline, width 0.72 inside the wall faces (±0.45), amp 0.16 × waviness 0.6 (calmer than rapids chop; crests +0.064 under the wall tops +0.18, troughs +0.006 above the backing strip −0.02), uNight moonlight-dims it after dark; the profile's flat blue-grey strip (0x447588, −0.02) stays beneath as the opaque backing body colour.

### Preview circuits (RCT2 archetypes)

`LogFlume.h:26` gives the flume `sBend` and `curveSmall` but **no helix and no banked turns**, and its slope set is 25° up / steep-60° **DOWN only** (there is no `slopeSteepUp`) — gentle conveyor climbs, steep chutes.

- **3D rig — Big Chute (LEAD)** — the steepest chute the piece table can build.
  Because the CLIMB is capped at 25° and the plunge at 60°, a steep chute comes
  from climbing LONG and dropping SHORT: one 16-unit conveyor
  `{ type: 'lift', height: 4.8, length: 16 }` hauls the log 4.8 units up at
  **23.9°** (the explicit `length` is what buys the legal grade — `ramp()` takes
  `max(length, 2.2, 1.9·rise)`), a level hairpin turns it at the top, and all
  4.8 units come back in ONE 11-unit chute at **33.1°** — 4× the fall of the
  stock loop — into a 9-unit splash run-out. 33.1° is the ceiling `rampPoints`'
  one-tile transition rule allows at that height, NOT the 60° whitelist. Closes
  with ZERO synthesized track, `validateSpline` worst clearance **3.09**, design
  report clean. Held still at 23° camera elevation (`dress`/`setCameraPose`) so
  the chute reads as a chute.

Two more archetype previews:

- **Cascade Run** — the out-and-back with a stepped cascade: `lift` 1.4 to the high traverse, then three DIFFERENT chutes home (0.4 off the top corner, 0.45, and the 0.55 splashdown finale) with an `sbend` meander jogging the back straight.
- **Horseshoe Plunge** — lift, a 180° radius-3 hairpin around the head of the site, then ONE tall 1.15 chute down the whole return leg into a 2.6-u splash run-out. Narrow 6 × 14.5 — the classic "one big drop" flume.

Both land 0.3 u short of the station on their own brake straight, so the compiler synthesizes nothing; clearance 2.28 / 2.12, validateSpline clean.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.
