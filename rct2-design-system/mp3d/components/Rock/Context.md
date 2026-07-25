# Rock

A single deterministic faceted boulder.

`buildRock(t, { scale?, seed?, tint? })` returns a THREE.Group whose origin sits at ground level: an icosahedron squashed into a natural footprint with position-hashed vertex displacement (same seed = same rock, shared corners stay welded), flat shaded with the shared procedural 'concrete' texture in realistic grey-brown tints. Lower the group slightly to bury it in terrain.

Built with three.js on the shared Stage.
