#!/usr/bin/env python3
"""Generate atlas-based Magic Patterns files from cdn_manifest.json.

Every component slices ONE hosted atlas image via CSS sprites -> tiny text files.
Usage: python3 gen_mp2.py <ATLAS_URL>
"""
import os, json, re, sys

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
MP = f"{ROOT}/mp"
M = json.load(open(f"{ROOT}/app/cdn_manifest.json"))
ATLAS_URL = sys.argv[1] if len(sys.argv) > 1 else "__ATLAS_URL__"

def write(path, content):
    full = f"{MP}/{path}"
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w").write(content)

_used = set()
def pascal(s):
    base = re.sub(r'[^A-Za-z0-9]', ' ', s).title().replace(' ', '')
    if not base or not base[0].isalpha(): base = "C" + base
    name = base; n = 2
    while name in _used: name = f"{base}{n}"; n += 1
    _used.add(name); return name

def emit_config():
    write("index.css",
        "/* @import url() FONT IMPORTS MUST ALWAYS BE AT THE VERY TOP OF THIS FILE, "
        "ABOVE THE TAILWIND IMPORTS — DO NOT DELETE THIS COMMENT */\n\n"
        "/* CRITICAL: THE FOLLOWING TAILWIND IMPORTS MUST NEVER BE DELETED OR REORDERED */\n"
        "@import 'tailwindcss/base';\n@import 'tailwindcss/components';\n@import 'tailwindcss/utilities';\n\n"
        "/* END TAILWIND IMPORTS — ALL OTHER CSS MUST GO BELOW THIS LINE */\n"
        "img{image-rendering:pixelated;image-rendering:crisp-edges;}\n")
    write("tailwind.config.js",
        "module.exports = {\n  content: ['./components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],\n"
        "  theme: { extend: {} },\n  plugins: [],\n};\n")
    write("package.json", json.dumps({
        "name": "magic-patterns-project", "private": True,
        "dependencies": {"react": "18.3.1", "react-dom": "18.3.1",
                         "react-router-dom": "6.30.2", "lucide-react": "0.577.0",
                         "tailwind-merge": "2.6.1"}}, indent=2) + "\n")

LIB_ATLAS = '''import React from 'react';

/** All RCT2 sprites are packed into ONE hosted atlas image; components slice it. */
export const ATLAS_URL = %s;
export const ATLAS_W = %d;
export const ATLAS_H = %d;

/** [sx, sy, w, h] — a rectangle within the atlas (unscaled px). */
export type Cell = [number, number, number, number];

/** Renders a single atlas cell at an integer pixel scale (nearest-neighbour). */
export function AtlasCell({ cell, scale = 4 }: { cell: Cell; scale?: number }) {
  const [sx, sy, w, h] = cell;
  return (
    <div style={{ width: w * scale, height: h * scale, overflow: 'hidden', position: 'relative' }}>
      <img src={ATLAS_URL} alt="" draggable={false}
        style={{ position: 'absolute', left: -sx * scale, top: -sy * scale,
                 width: ATLAS_W * scale, height: ATLAS_H * scale, maxWidth: 'none' }} />
    </div>
  );
}
'''

SPRITE_ROTATOR = r'''import React, { useEffect, useState } from 'react';
import { AtlasCell, type Cell } from '../Atlas';

export interface SpriteRotatorProps { name: string; group?: string; cells: Cell[]; zoom?: number; background?: string; }
const DIRS = ['NE', 'SE', 'SW', 'NW'];

/** A real RCT2 asset shown across its 4 map rotations (auto-rotate + manual). */
export function SpriteRotator({ name, group, cells, zoom = 4, background = '#7a9a9a' }: SpriteRotatorProps) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(zoom);
  useEffect(() => {
    if (!playing || cells.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % cells.length), 640);
    return () => clearInterval(t);
  }, [playing, cells.length]);
  const [, , w, h] = cells[0];
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: '#1b2828' }}>
      {group && <div className="self-start text-[10px] font-bold uppercase tracking-widest text-teal-300/70">{group}</div>}
      <div className="flex items-center justify-center rounded-lg p-3" style={{ background, minWidth: w * scale + 24, minHeight: h * scale + 24 }}>
        <AtlasCell cell={cells[i % cells.length]} scale={scale} />
      </div>
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="flex items-center gap-1">
        {cells.map((_, k) => (
          <button key={k} onClick={() => { setI(k); setPlaying(false); }} className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ background: k === i ? '#2dd4bf' : '#334848', color: k === i ? '#04201d' : '#a7c4c4' }}>{DIRS[k] || k + 1}</button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-1 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">{playing ? '⏸ rotating' : '▶ rotate'}</button>
      </div>
      <input type="range" min={2} max={9} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-32 accent-teal-400" />
    </div>
  );
}
'''

PEEP_WALKER = r'''import React, { useEffect, useState } from 'react';
import { AtlasCell, type Cell } from '../Atlas';

export interface PeepWalkerProps { name: string; group?: string; frames: Record<string, Cell[]>; fps?: number; zoom?: number; }
const DIRS = ['NE', 'SE', 'SW', 'NW'];

/** Animated, direction-selectable RCT2 peep walk cycle (real sprites). */
export function PeepWalker({ name, group, frames, fps = 6, zoom = 6 }: PeepWalkerProps) {
  const dirKeys = Object.keys(frames);
  const [d, setD] = useState(dirKeys[0]);
  const [f, setF] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(zoom);
  const seq = frames[d] || [];
  useEffect(() => {
    if (!playing || seq.length < 2) return;
    const t = setInterval(() => setF((p) => (p + 1) % seq.length), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, seq.length, fps, d]);
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: '#1b2828' }}>
      {group && <div className="self-start text-[10px] font-bold uppercase tracking-widest text-teal-300/70">{group}</div>}
      <div className="flex items-center justify-center rounded-lg p-3" style={{ background: '#5c8a5c' }}>
        <AtlasCell cell={seq[f % Math.max(seq.length, 1)]} scale={scale} />
      </div>
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="flex items-center gap-1">
        {dirKeys.map((k, idx) => (
          <button key={k} onClick={() => setD(k)} className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ background: k === d ? '#2dd4bf' : '#334848', color: k === d ? '#04201d' : '#a7c4c4' }}>{DIRS[idx] || k}</button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-1 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">{playing ? '⏸ walk' : '▶ walk'}</button>
      </div>
      <input type="range" min={3} max={12} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-32 accent-teal-400" />
    </div>
  );
}
'''

MOOD_FACES = r'''import React, { useEffect, useState } from 'react';
import { AtlasCell, type Cell } from '../Atlas';

export interface FaceItem { name: string; cell: Cell; }
export interface MoodFacesProps { faces: FaceItem[]; zoom?: number; }

/** The real RCT2 guest mood faces (unhappy → very happy → tired/sick), cycling. */
export function MoodFaces({ faces, zoom = 2 }: MoodFacesProps) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((p) => (p + 1) % faces.length), 700);
    return () => clearInterval(t);
  }, [playing, faces.length]);
  const face = faces[i % faces.length];
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: '#1b2828' }}>
      <div className="self-start text-[10px] font-bold uppercase tracking-widest text-teal-300/70">Peep · Guest · Mood</div>
      <div className="flex items-center justify-center rounded-lg p-4" style={{ background: '#f4e9c8' }}>
        <AtlasCell cell={face.cell} scale={zoom} />
      </div>
      <div className="text-sm font-semibold text-white">{face.name}</div>
      <div className="flex max-w-[260px] flex-wrap items-center justify-center gap-1">
        {faces.map((fc, k) => (
          <button key={k} onClick={() => { setI(k); setPlaying(false); }} className="h-2 w-2 rounded-full"
            style={{ background: k === i ? '#2dd4bf' : '#456' }} title={fc.name} />
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-2 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">{playing ? '⏸' : '▶'}</button>
      </div>
    </div>
  );
}
'''

def emit_primitive(name, code, sample):
    write(f"components/{name}/index.tsx", code)
    write(f"components/{name}/{name}.previews.tsx",
        "import React from 'react';\nimport { %s } from './index';\n\n"
        "const previews = {\n  componentName: '%s',\n  importPath: 'components/%s',\n"
        "  previews: [\n    { name: 'Overview', description: 'Reusable primitive.', render: () => %s },\n  ],\n};\n\n"
        "export default previews;\n" % (name, name, name, sample))
    write(f"components/{name}/Context.md",
        f"# {name}\n\nShared primitive for the RCT2 real-asset catalog. Slices the hosted sprite atlas "
        f"(authentic RollerCoaster Tycoon 2 game art decoded via the OpenRCT2 sprite format).\n")

def cells_lit(cells):
    return "[" + ",".join("[%d,%d,%d,%d]" % tuple(c) for c in cells) + "]"

def emit_preview(cn, note):
    write(f"components/{cn}/{cn}.previews.tsx",
        "import React from 'react';\nimport { %s } from './index';\n\n"
        "const previews = {\n  componentName: '%s',\n  importPath: 'components/%s',\n"
        "  previews: [\n    { name: 'Default', description: %s, render: () => <%s /> },\n  ],\n};\n\n"
        "export default previews;\n" % (cn, cn, cn, json.dumps(note), cn))

def main():
    emit_config()
    write("components/Atlas/index.tsx", LIB_ATLAS % (json.dumps(ATLAS_URL), M['atlasW'], M['atlasH']))
    write("components/Atlas/Atlas.previews.tsx",
        "import React from 'react';\nimport { AtlasCell } from './index';\n\n"
        "const previews = {\n  componentName: 'Atlas',\n  importPath: 'components/Atlas',\n"
        "  previews: [\n    { name: 'Overview', description: 'Shared atlas + cell slicer (foundation).', render: () => <AtlasCell cell={[0,0,64,64]} scale={2} /> },\n  ],\n};\n\nexport default previews;\n")
    write("components/Atlas/Context.md",
        "# Atlas\n\nFoundation: exports ATLAS_URL / ATLAS_W / ATLAS_H / the Cell type and the AtlasCell slicer. "
        "Every catalog component slices ONE hosted image (authentic RCT2 sprites) through this.\n")
    emit_primitive("SpriteRotator", SPRITE_ROTATOR, "<SpriteRotator name=\"Sample\" cells={[[0,0,32,24],[0,0,32,24]]} />")
    emit_primitive("PeepWalker", PEEP_WALKER, "<PeepWalker name=\"Sample\" frames={{ '0': [[0,0,13,20]] }} />")
    emit_primitive("MoodFaces", MOOD_FACES, "<MoodFaces faces={[{ name: 'Happy', cell: [0,0,12,12] }]} />")

    index = []
    for c in M['components']:
        if c['kind'] == 'rot':
            cn = pascal(c['name'])
            write(f"components/{cn}/index.tsx",
                "import React from 'react';\nimport { SpriteRotator } from '../SpriteRotator';\n"
                "import type { Cell } from '../Atlas';\n\n"
                "const CELLS: Cell[] = %s;\n\n"
                "export function %s() {\n  return <SpriteRotator name=%s group=%s cells={CELLS} />;\n}\n"
                % (cells_lit(c['frames']), cn, json.dumps(c['name']), json.dumps(c['group'])))
            emit_preview(cn, f"{c['name']} — real RCT2 asset across its 4 map rotations.")
            write(f"components/{cn}/Context.md",
                  f"# {c['name']}\n\nGroup: {c['group']}. Authentic RollerCoaster Tycoon 2 sprite, "
                  f"shown across its 4 map rotations. Decoded from the original game data.\n")
            index.append((cn, c['name'], c['group']))
        elif c['kind'] == 'walk':
            cn = pascal(c['name'])
            fr = "{" + ",".join("%s:%s" % (json.dumps(d), cells_lit(cs)) for d, cs in c['frames'].items()) + "}"
            write(f"components/{cn}/index.tsx",
                "import React from 'react';\nimport { PeepWalker } from '../PeepWalker';\n"
                "import type { Cell } from '../Atlas';\n\n"
                "const FRAMES: Record<string, Cell[]> = %s;\n\n"
                "export function %s() {\n  return <PeepWalker name=%s group=%s frames={FRAMES} />;\n}\n"
                % (fr, cn, json.dumps(c['name']), json.dumps(c['group'])))
            emit_preview(cn, f"{c['name']} — animated real RCT2 walk cycle, 4 facings.")
            write(f"components/{cn}/Context.md",
                  f"# {c['name']}\n\nGroup: {c['group']}. Animated walk cycle from real RCT2 peep sprites; "
                  f"shirt/trouser colours applied via the authentic palette-remap ranges.\n")
            index.append((cn, c['name'], c['group']))
        else:  # faces
            cn = pascal(c['name'])
            fl = "[" + ",".join("{name:%s,cell:[%d,%d,%d,%d]}" % (json.dumps(f['name']), *f['cell']) for f in c['faces']) + "]"
            write(f"components/{cn}/index.tsx",
                "import React from 'react';\nimport { MoodFaces } from '../MoodFaces';\n"
                "import type { FaceItem } from '../MoodFaces';\n\n"
                "const FACES: FaceItem[] = %s;\n\n"
                "export function %s() {\n  return <MoodFaces faces={FACES} />;\n}\n" % (fl, cn))
            emit_preview(cn, "The real RCT2 guest mood-face set (cycling).")
            write(f"components/{cn}/Context.md",
                  f"# {c['name']}\n\nGroup: {c['group']}. The authentic RCT2 guest mood faces.\n")
            index.append((cn, c['name'], c['group']))

    json.dump(index, open(f"{MP}/_index.json", "w"))
    print(f"generated {len(index)} catalog components + 3 primitives (atlas={ATLAS_URL})")

if __name__ == "__main__":
    main()
