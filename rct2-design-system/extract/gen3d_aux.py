import os, json
MP=os.path.abspath("mp3d")
def w(p,c):
    full=f"{MP}/{p}"; os.makedirs(os.path.dirname(full),exist_ok=True); open(full,"w").write(c)

w("index.css","/* @import url() FONT IMPORTS MUST ALWAYS BE AT THE VERY TOP OF THIS FILE, ABOVE THE TAILWIND IMPORTS — DO NOT DELETE THIS COMMENT */\n\n/* CRITICAL: THE FOLLOWING TAILWIND IMPORTS MUST NEVER BE DELETED OR REORDERED */\n@import 'tailwindcss/base';\n@import 'tailwindcss/components';\n@import 'tailwindcss/utilities';\n\n/* END TAILWIND IMPORTS — ALL OTHER CSS MUST GO BELOW THIS LINE */\n")
w("tailwind.config.js","module.exports = {\n  content: ['./components/**/*.{ts,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n};\n")
w("package.json", json.dumps({"name":"magic-patterns-project","private":True,"dependencies":{
  "react":"18.3.1","react-dom":"18.3.1","react-router-dom":"6.30.2","lucide-react":"0.577.0",
  "tailwind-merge":"2.6.1","three":"0.169.0","@types/three":"0.169.0"}}, indent=2)+"\n")

def prev(name, desc):
    return ("import React from 'react';\nimport { %s } from './index';\n\n"
      "const previews = {\n  componentName: '%s',\n  importPath: 'components/%s',\n"
      "  previews: [\n    { name: '3D rig', description: %s, render: () => <%s /> },\n  ],\n};\n\nexport default previews;\n"
      % (name,name,name,json.dumps(desc),name))

comps={
 "WoodenCoaster":"Wooden roller-coaster track + riding train, modelled from the RCT2 sprite (rails, ties, wooden support bents). Drag to orbit.",
 "CoasterCar":"A single wooden-coaster car with seated riders, modelled from the RCT2 vehicle sprite. Drag to orbit.",
 "Guest":"A park guest with an animated walk cycle, modelled from the RCT2 peep sprite. Drag to orbit.",
 "OakTree":"An oak tree with chunky foliage that sways, modelled from the RCT2 scenery sprite. Drag to orbit.",
 "Road":"A paved road tile with kerbs and centre line, modelled from the RCT2 tarmac footpath. Drag to orbit.",
}
for name,desc in comps.items():
    w(f"components/{name}/{name}.previews.tsx", prev(name,desc))
    w(f"components/{name}/Context.md", f"# {name}\n\n{desc}\n\nBuilt with three.js on top of the shared `Stage` component. The geometry is hand-modelled to match the colours and proportions of the authentic RollerCoaster Tycoon 2 sprite (its 4 rotations were used as reference).\n")

# Stage trio (previews needs a build sample)
w("components/Stage/Stage.previews.tsx",
  "import React from 'react';\nimport { Stage, box, ball } from './index';\n\n"
  "const previews = {\n  componentName: 'Stage',\n  importPath: 'components/Stage',\n"
  "  previews: [\n    { name: 'Foundation', description: 'Reusable three.js viewport (orbit camera, sun + soft shadows, grass ground). Pass a build(THREE, group) callback.', render: () => (\n"
  "      <Stage build={(t, g) => { g.add(box(t, [1, 1, 1], 0xdd6633, [0, 0.5, 0])); g.add(ball(t, 0.45, 0x4488cc, [1, 0.45, 0.6])); }} />\n"
  "    ) },\n  ],\n};\n\nexport default previews;\n")
w("components/Stage/Context.md",
  "# Stage\n\nFoundation for every 3D rig. Creates a three.js `WebGLRenderer`, an orbit camera (drag to rotate, auto-rotates when idle), hemisphere + directional sun light with soft shadows, and a grass ground disc. Exposes geometry helpers `box`, `cyl`, `ball`, `mat`.\n\n```tsx\n<Stage build={(THREE, group) => {\n  group.add(box(THREE, [1,1,1], 0xdd6633, [0,0.5,0]));\n  return (t) => { group.rotation.y = t; }; // optional per-frame update\n}} />\n```\n")

w("rules/overview.md",
  "# RollerCoaster Tycoon 2 — 3D Rigs\n\nReal-time **three.js** models of RCT2 assets, hand-built to match the original\nisometric sprites (their 4 rotations are the modelling reference). Unlike the\nsprite design system, these are true 3D and can be freely orbited, lit and\nanimated.\n\n## Architecture\n- **Stage** — the shared viewport (renderer, orbit camera, sun + soft shadows,\n  grass ground) + geometry helpers `box` / `cyl` / `ball` / `mat`. Every rig is\n  `<Stage build={(THREE, group) => { ... }} />`.\n- Each rig's `build` populates a group and may return `(t) => void` to animate.\n\n## Starter rigs (this version)\n- **WoodenCoaster** — a run of wooden track (rails, ties, support bents) with a\n  2-car train riding a loop. *(the roller coaster)*\n- **CoasterCar** — one detailed car with seated riders. *(the roller-coaster car)*\n- **Guest** — an animated walking peep.\n- **OakTree** — swaying scenery.\n- **Road** — a paved path tile with kerbs + centre line.\n\n## How to model a new rig (be particular)\n1. Open the matching sprite in the *RollerCoaster Tycoon 2 — Real Assets* system\n   and study all 4 rotations for silhouette, colour and part breakdown.\n2. Compose from `box`/`cyl`/`ball` in world units (1 unit ~= one tile edge;\n   a guest is ~1.1 tall). Match the sprite's palette.\n3. Anchor to the ground (feet / base at y=0). Add an `update(t)` for anything\n   the sprite animates (wheels, walk cycle, sway, spinning platforms).\n4. Keep integer-ish proportions and readable, chunky forms — these are stylised\n   theme-park models, not photoreal.\n")
print("wrote aux files")
