# NeonSign

Neon tube signage: text in a compact 16-segment-style vector font, or any SVG path, rendered as emissive neon tubes with halo glow, stand-off mounted so nothing floats.

Original three.js model on the shared Stage (day/night lighting). Exports:

- `buildNeonSign(t, opts)` — returns `{ group, update(time), width, scale }` (`scale` = the resolved scale, needed for post math when the auto default applies); call `update` each frame. `opts`:
  - `text` — TEXT mode (default `'NEON'`): A-Z, 0-9, space, `! ? ' -` laid out with per-glyph advance + kerning; each character is polyline strokes from a built-in vector font.
  - `path` — PATH mode: an SVG path string (`M/m L/l H/h V/v C/c Q/q Z`; Béziers sampled to polylines) normalised to the sign height and y-flipped, so any shape becomes a neon outline.
  - `color` (default hot pink), `secondary` (tints alternating characters / subpaths), `scale` (cap height = 1.5 × scale; DEFAULT is AUTO — 1, shrunk so the sign never exceeds ~2.5 u of width, so a long marquee like "HAUNTED" stays park-sized instead of ~8 u; an explicit `scale` is always honoured untouched; the resolved value is returned as `scale`), `backboard` (default on for text, off for path — but `<Park>`'s `<Neon>` wrapper defaults it OFF inside a park; pass `backboard` there to opt in).
  - Every stroke = TubeGeometry pair: emissive core tube + larger transparent halo tube. Mounting: dark metal backboard with straight stand-off pins, or (no backboard) an open rear rail with angled pins. BACKBOARD (round-2 safeguard): it HUGS the text — padding = 0.15 × cap height, thin 0.04·scale slab — and is AREA-CAPPED at ~4 u² of face; a bigger request (a long marquee used to render as a monolithic black wall filling whole ground shots) falls back to the open rear rail with a console note. Includes ONE PointLight tinted to the neon colour.
  - `update(time)`: hashed occasional flicker dips (deterministic, no `Math.random`) and night gating via `nightKOf` — day ≈ 12% residual glow (round-2: tubes read as unlit glass in daylight instead of pink day-glow), full neon + light at night.
- `parseSvgPath(d)` — the SVG path → polylines sampler, exported for reuse.
- `NeonSign` — preview: pink "OPEN" over a backboard between two ground posts + a cyan SVG star on a pole. Use the Stage night toggle.

The sign group's origin is the text baseline centre; position/rotate the group and support it (posts/pole to the rear rail or backboard) as in the preview.
