# HauntedMansion

A crooked haunted mansion dark ride with flickering windows. Slow eerie ParticleKit smoke wisps drift off the crooked chimney (max 40, long ~4.5 s lives, growing and thinning); after dark the emitter's material colour lerps toward a sickly green so the wisps read haunted under the night washes.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## RCT2 station behaviour — EXCEPTION (walkthrough)

HauntedMansion is a WALKTHROUGH, the other motion-gate **exception**: there is no vehicle to park, so the update stays ungated (bats, chimney smoke and window flicker keep their own life through the whole FSM cycle). Capacity **6** = the 6 interior tour spots: `seatWorld` places boarded guests on static anchors INSIDE the ground floor (walls x ±1.3 / z ±1.1 hide them), so "riders" are simply indoors between the entrance and exit huts.

## Brick masonry

All three tiers and the crooked chimney are **brick**. Stage's texture set has no masonry pattern (wood / metal / asphalt / leaf / fabric / concrete / grass / plastic / sand) and Stage is not this component's to extend, so HauntedMansion draws its own masonry canvas locally, the same way Stage's `drawTexture` does: one 128 px canvas with a lime-mortar bed, 8 courses of 4 stretchers in **running bond** (alternate courses half-lapped), per-brick tonal variation, two weathering flecks and a top-edge highlight, used as both `map` and `bumpMap` (bumpScale 0.06) so the joints catch real relief. It is **deterministic** — hashed sine only, no `Math.random` — and cached module-level per colour/mortar/repeat, so remounts and screenshots are byte-identical. `brickBox()` is the local wrapper with `box()`-like arguments. Spooky palette and all night behaviour (window flicker, porch lantern, green facade uplight, blue tower wash, green-tinted smoke, bats) are unchanged.
