# RiverRapids

River rapids rebuilt on SplineRideKit ('rapids' profile — RCT2 rapids are a tracked ride of channel pieces): a CLEAN closed course (~7 x 4.5) — one dead-straight low station reach, a conveyor lift up the east side, ONE broad high back sweep and a gradual west descent easing into the splash-pond drop; minimum bend radius 1.11, validateSpline clean. The channel carries REAL shader water: ONE continuous `buildWaterRibbon` (WaterTile) following the spline — 220 frame samples riding 0.055 above the profile's flat strip (kept beneath as opaque backing), width 0.8 inside the walls, amp 0.16 calming the swell to channel chop; its (across, alongArc) local coords keep the waves flowing seamlessly around the closed loop (no per-reach seams). Foam patches are few, thin and skipped on the lift. A boarding gangway plank bridges the station deck (outer bank) onto the channel wall. The round raft with tyre tube and six yellow-backed seats of guest riders (RAPBOAT) drifts via run(), with spin, wallow and bob layered on top.

Track pieces: `pieces` prop or JSX piece children compile via `compileTrackPieces` on the 'rapids' profile — lifts and stepped drops are legal and drift-paced (drops run faster than climbs); a FATAL compile marks the build `invalid`. Sim extras: the raft is the ride `vehicle`. Park layout: queue front 4.4 / exit [-1.7, 4.2] clear the channel + deck. Channel water follows WaterTile's natural blue-grey palette (backing strip 0x447588, pond floor 0x223849, pond swell amp 0.4 so troughs stay above the floor).

### Preview circuits (RCT2 archetypes)

RCT2's rapids have the narrowest vocabulary of any tracked ride — `RiverRapids.h:26` whitelists `curveVerySmall` quarter-turns and 25° slopes ONLY (no s-bends, no helix, no steep pieces) plus the `rapids`/`waterfall`/`whirlpool` set pieces — so real courses are chains of short reaches chamfered by shallow bends.

- **3D rig — Gorge Run (LEAD)** — the biggest descent the table allows. 25° is a
  hard ceiling BOTH ways, so a real gorge is bought with LENGTH, not grade: a
  12-unit conveyor `{ type: 'lift', height: 3.6, length: 12 }` lifts the raft 3.6
  units out of the station pool at **23.9°**, a level hairpin turns it at the top
  of the gorge, and all 3.6 units come back down ONE unbroken 12-unit reach at
  **23.9°** — **12 z-steps**, against the 0.4/0.3 steps of the stock loop — into
  the splash pond. Peak grade 23.9° of the 25° ceiling, roll 14.3° (the profile
  caps rapids banking at 0.2 rad anyway), closes with ZERO synthesized track,
  `validateSpline` worst clearance **2.63**. Held still at 23° camera elevation
  (`dress`/`setCameraPose`) so the descent reads.

Two more archetype previews:

- **Oxbow Meander** — eight 45° `turnL` reaches with matched opposite pairs (so the octagon closes exactly), the conveyor `lift` 0.7 on the station reach and a two-step rapids staircase (0.4 then 0.3) down the far bank.
- **Delta Gorge** — three long reaches joined by 120° bends around a central island: lift, a diagonal two-step descent, then one 7.4-u flat-water float home. Broad (10.4 × 11.4) where the Oxbow is tall.

Neither uses a piece the rapids table lacks; both close with zero synthesized track (clearance 2.14 / 2.05).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.
