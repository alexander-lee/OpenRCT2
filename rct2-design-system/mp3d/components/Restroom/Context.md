# Restroom

The RCT2 toilets facility: a squat 1-tile utilitarian brick hut with timber corner posts, pitched shingle roof with stepped gable fillers, a real walk-in door opening (dark recessed interior), a timber-framed blue enamel **plaque** over the door whose male/female pictograms are PAINTED into a procedural `CanvasTexture` (`signTexture`, the Stage `drawTexture` pattern — drawn once at build time from a hashed-sine speckle and canvas paths, no fonts, no external assets, no glyph primitives standing off the panel) and a red occupied-light **recessed** into the brick beside the door — a bezel ring half buried in the wall (0.0145 proud) with the lens set back flush inside it (0.0045 proud) — whose emissive is gated by `nightKOf` (lights up at night only).

API / contract: `buildRestroom(t) → { group, doorway: [0, 0, 0.72] }` — `doorway` is the walk-in point at the FRONT of the hut (+z) at ground level in the group's local space. GameManager agents route guests to this point; the opening is 0.46 wide × 0.62 tall (fits a 0.5-scale peep). Footprint ≈ 1.44 × 1.24, ridge height 1.45.

Original three.js model on the shared Stage (day/night lighting); proportions referenced from the RCT2 toilets facility. Deterministic — no randomness.
