# SceneryPack

20 classic RCT2 base-game scenery pieces (gardens / walls / statues tabs) that Kit doesn't cover: marbleStatue, birdbath, picnicTable, planterBox, topiarySpiral, topiaryElephant, signpost, tvMonitorPost, parkClock, flagpole, ironArchway, brickWall, picketFence, lionStatue, cactusCluster, fallenLog, mushroomCluster, wishingWell, gazebo, hotAirBalloon.

API: `SCENERY_NAMES: string[]`; `buildScenery(t, name, { scale?, seed? }) → THREE.Group`; `buildSceneryAnimated(t, name, opts) → { group, update?(time) }` — tvMonitorPost (static shimmer), parkClock (turning hands), flagpole (waving pennant) and hotAirBalloon (sway + night burner glow via `nightKOf`) return updaters. Every piece is grounded at y=0, deterministic (hashed-sine scatter, seed offsets it), realistic palette, textured + bump-mapped, contact-audited in comments.

`SceneryPack` preview: a 5×4 museum grid of all 20 on concrete pads over the Stage lawn, slow auto-rotate.
