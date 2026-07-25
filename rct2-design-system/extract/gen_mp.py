#!/usr/bin/env python3
"""Generate the Magic Patterns design-system file tree from components.json.

Emits self-contained catalog components (base64 sprites embedded) that render
via three shared primitives: RotationViewer, PeepWalker, MoodFaces.
"""
import os, json, base64, re

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
MP = f"{ROOT}/mp"
DATA = json.load(open(f"{ROOT}/app/components.json"))

def datauri(relpath):
    with open(f"{ROOT}/{relpath}", "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

def write(path, content):
    full = f"{MP}/{path}"
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(content)

_used = set()
def pascal(s, suffix=""):
    base = re.sub(r'[^A-Za-z0-9]', ' ', s).title().replace(' ', '')
    if suffix: base = base + suffix
    if not base or not base[0].isalpha(): base = "C" + base
    name = base; n = 2
    while name in _used:
        name = f"{base}{n}"; n += 1
    _used.add(name)
    return name

def sprite_lit(r):
    return ("{uri:%s,w:%d,h:%d,x:%d,y:%d}"
            % (json.dumps(datauri(r['src'])), r['w'], r['h'], r['x'], r['y']))

# ---------------- static config files ----------------
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
                         "tailwind-merge": "2.6.1"}
    }, indent=2) + "\n")
    write("lib/types.ts",
        "export interface Sprite { uri: string; w: number; h: number; x: number; y: number; }\n")

# ---------------- primitives ----------------
ROTATION_VIEWER = r'''import React, { useEffect, useMemo, useState } from 'react';
import type { Sprite } from '../../lib/types';

export interface RotationViewerProps {
  name: string;
  group?: string;
  rotations: Sprite[];
  zoom?: number;
  background?: string;
}

const DIRS = ['NE', 'SE', 'SW', 'NW'];

/** Renders a real RCT2 asset across its 4 map rotations with auto-rotate + manual controls. */
export function RotationViewer({ name, group, rotations, zoom = 4, background = '#7a9a9a' }: RotationViewerProps) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(zoom);

  useEffect(() => {
    if (!playing || rotations.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % rotations.length), 650);
    return () => clearInterval(t);
  }, [playing, rotations.length]);

  const box = useMemo(() => {
    const minX = Math.min(...rotations.map((r) => r.x));
    const minY = Math.min(...rotations.map((r) => r.y));
    const maxX = Math.max(...rotations.map((r) => r.x + r.w));
    const maxY = Math.max(...rotations.map((r) => r.y + r.h));
    return { minX, minY, cw: maxX - minX, ch: maxY - minY };
  }, [rotations]);

  const r = rotations[i % rotations.length];
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: '#1b2828' }}>
      {group && <div className="self-start text-[10px] uppercase tracking-widest text-teal-300/70">{group}</div>}
      <div className="flex items-center justify-center rounded-lg" style={{ width: box.cw * scale + 32, height: box.ch * scale + 32, background }}>
        <div style={{ position: 'relative', width: box.cw * scale, height: box.ch * scale }}>
          <img src={r.uri} alt={name} draggable={false}
            style={{ position: 'absolute', left: (r.x - box.minX) * scale, top: (r.y - box.minY) * scale, width: r.w * scale, height: r.h * scale }} />
        </div>
      </div>
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="flex items-center gap-1">
        {rotations.map((_, k) => (
          <button key={k} onClick={() => { setI(k); setPlaying(false); }}
            className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ background: k === i ? '#2dd4bf' : '#334848', color: k === i ? '#04201d' : '#a7c4c4' }}>
            {DIRS[k] || k + 1}
          </button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-1 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">
          {playing ? '⏸ rotating' : '▶ rotate'}
        </button>
      </div>
      <input type="range" min={2} max={9} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-32 accent-teal-400" />
    </div>
  );
}
'''

PEEP_WALKER = r'''import React, { useEffect, useState } from 'react';

export interface PeepWalkerProps {
  name: string;
  group?: string;
  w: number;
  h: number;
  frames: Record<string, string[]>;
  fps?: number;
  zoom?: number;
}

const DIRS = ['NE', 'SE', 'SW', 'NW'];

/** Animated, direction-selectable RCT2 peep walk cycle (real sprites). */
export function PeepWalker({ name, group, w, h, frames, fps = 6, zoom = 6 }: PeepWalkerProps) {
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
      {group && <div className="self-start text-[10px] uppercase tracking-widest text-teal-300/70">{group}</div>}
      <div className="flex items-center justify-center rounded-lg" style={{ width: w * scale + 24, height: h * scale + 24, background: '#5c8a5c' }}>
        <img src={seq[f % Math.max(seq.length, 1)]} alt={name} draggable={false} style={{ width: w * scale, height: h * scale }} />
      </div>
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="flex items-center gap-1">
        {dirKeys.map((k, idx) => (
          <button key={k} onClick={() => setD(k)} className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ background: k === d ? '#2dd4bf' : '#334848', color: k === d ? '#04201d' : '#a7c4c4' }}>
            {DIRS[idx] || k}
          </button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-1 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">
          {playing ? '⏸ walk' : '▶ walk'}
        </button>
      </div>
      <input type="range" min={3} max={12} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-32 accent-teal-400" />
    </div>
  );
}
'''

MOOD_FACES = r'''import React, { useEffect, useState } from 'react';

export interface Face { name: string; uri: string; w: number; h: number; }
export interface MoodFacesProps { faces: Face[]; zoom?: number; }

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
      <div className="self-start text-[10px] uppercase tracking-widest text-teal-300/70">Guest · Mood</div>
      <div className="flex items-center justify-center rounded-lg" style={{ width: face.w * zoom + 24, height: face.h * zoom + 24, background: '#f4e9c8' }}>
        <img src={face.uri} alt={face.name} draggable={false} style={{ width: face.w * zoom, height: face.h * zoom }} />
      </div>
      <div className="text-sm font-semibold text-white">{face.name}</div>
      <div className="flex flex-wrap items-center justify-center gap-1" style={{ maxWidth: 260 }}>
        {faces.map((fc, k) => (
          <button key={k} onClick={() => { setI(k); setPlaying(false); }} className="h-2 w-2 rounded-full"
            style={{ background: k === i ? '#2dd4bf' : '#456' }} title={fc.name} />
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-2 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">
          {playing ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  );
}
'''

def emit_primitive(name, code, sample_render):
    write(f"components/{name}/index.tsx", code)
    write(f"components/{name}/{name}.previews.tsx",
        "import React from 'react';\nimport { %s } from './index';\n\n"
        "const previews = {\n  componentName: '%s',\n  importPath: 'components/%s',\n"
        "  previews: [\n    { name: 'Overview', description: 'Reusable primitive.', render: () => %s },\n  ],\n};\n\n"
        "export default previews;\n" % (name, name, name, sample_render))
    write(f"components/{name}/Context.md",
        f"# {name}\n\nShared primitive for the RCT2 real-asset catalog. "
        f"Renders authentic sprites extracted from the RollerCoaster Tycoon 2 game data.\n")

# ---------------- catalog components ----------------
def emit_rotation_component(comp_name, display, group, rotations, note):
    rots = "[" + ",".join(sprite_lit(r) for r in rotations) + "]"
    write(f"components/{comp_name}/index.tsx",
        "import React from 'react';\n"
        "import { RotationViewer } from '../RotationViewer';\n"
        "import type { Sprite } from '../../lib/types';\n\n"
        "const ROTATIONS: Sprite[] = %s;\n\n"
        "export function %s() {\n"
        "  return <RotationViewer name=%s group=%s rotations={ROTATIONS} />;\n}\n"
        % (rots, comp_name, json.dumps(display), json.dumps(group)))
    _emit_preview(comp_name, display, note)

def emit_peep_component(comp_name, display, group, w, h, frames, fps):
    fr = "{" + ",".join(
        "%s:[%s]" % (json.dumps(k), ",".join(json.dumps(datauri(p)) for p in v))
        for k, v in frames.items()) + "}"
    write(f"components/{comp_name}/index.tsx",
        "import React from 'react';\n"
        "import { PeepWalker } from '../PeepWalker';\n\n"
        "const FRAMES: Record<string, string[]> = %s;\n\n"
        "export function %s() {\n"
        "  return <PeepWalker name=%s group=%s w={%d} h={%d} frames={FRAMES} fps={%d} />;\n}\n"
        % (fr, comp_name, json.dumps(display), json.dumps(group), w, h, fps))
    _emit_preview(comp_name, display, f"Animated real RCT2 {group.lower()} walk cycle.")

def emit_faces_component(comp_name, display, faces):
    fl = "[" + ",".join(
        "{name:%s,uri:%s,w:%d,h:%d}" % (json.dumps(f['name']), json.dumps(datauri(f['src'])), f['w'], f['h'])
        for f in faces) + "]"
    write(f"components/{comp_name}/index.tsx",
        "import React from 'react';\n"
        "import { MoodFaces } from '../MoodFaces';\nimport type { Face } from '../MoodFaces';\n\n"
        "const FACES: Face[] = %s;\n\n"
        "export function %s() {\n  return <MoodFaces faces={FACES} />;\n}\n"
        % (fl, comp_name))
    _emit_preview(comp_name, display, "The real RCT2 guest mood-face set.")

def _emit_preview(comp_name, display, note):
    write(f"components/{comp_name}/{comp_name}.previews.tsx",
        "import React from 'react';\nimport { %s } from './index';\n\n"
        "const previews = {\n  componentName: '%s',\n  importPath: 'components/%s',\n"
        "  previews: [\n    { name: 'Default', description: %s, render: () => <%s /> },\n  ],\n};\n\n"
        "export default previews;\n" % (comp_name, comp_name, comp_name, json.dumps(note), comp_name))
    write(f"components/{comp_name}/Context.md",
        f"# {display}\n\n{note}\n\nExtracted directly from RollerCoaster Tycoon 2 game files "
        f"(sprite data decoded via the OpenRCT2 format). Shown across its real rotations/frames.\n")

def main():
    emit_config()
    emit_primitive("RotationViewer", ROTATION_VIEWER,
        "<RotationViewer name=\"Sample\" rotations={[{uri:'',w:32,h:24,x:-16,y:-16},{uri:'',w:32,h:24,x:-16,y:-16}]} />")
    emit_primitive("PeepWalker", PEEP_WALKER,
        "<PeepWalker name=\"Sample\" w={13} h={20} frames={{'0':['']}} />")
    emit_primitive("MoodFaces", MOOD_FACES,
        "<MoodFaces faces={[{name:'Happy',uri:'',w:12,h:12}]} />")

    index = []  # (component_name, display, category)
    # ride vehicles
    for c in DATA['rideVehicles']:
        cn = pascal(c['name'])
        emit_rotation_component(cn, c['name'], c['group'], c['rotations'],
                                f"{c['name']} — real ride vehicle, 4 map rotations.")
        index.append((cn, c['name'], "Ride · Vehicle · " + c['group']))
    # ride track rails
    for c in DATA['rideTrack']:
        cn = pascal(c['name'] + " Track", "")
        emit_rotation_component(cn, c['name'] + " Track", "Track Rail", c['rotations'],
                                f"{c['name']} flat track rail — real sprites, 4 rotations.")
        index.append((cn, c['name'] + " Track", "Ride · Track Rail"))
    # peeps (guests + staff)
    for c in DATA['guests']:
        cn = pascal(c['name'])
        emit_peep_component(cn, c['name'], c['group'], c['w'], c['h'], c['frames'], c.get('frameCount', 6))
        index.append((cn, c['name'], "Peep · " + c['group']))
    # mood faces
    mf = DATA['moodFaces']
    cn = pascal("Guest Mood Faces")
    emit_faces_component(cn, mf['name'], mf['faces'])
    index.append((cn, mf['name'], "Peep · Guest"))
    # scenery
    for c in DATA['scenery']:
        cn = pascal(c['name'])
        emit_rotation_component(cn, c['name'], c['group'], c['rotations'],
                                f"{c['name']} — real RCT2 scenery, 4 rotations.")
        index.append((cn, c['name'], "Scenery · " + c['group']))

    json.dump(index, open(f"{MP}/_index.json", "w"))
    print(f"generated {len(index)} catalog components + 3 primitives -> {MP}")
    # size report
    import glob
    tot = sum(os.path.getsize(f) for f in glob.glob(f"{MP}/components/**/*", recursive=True) if os.path.isfile(f))
    print(f"components dir size: {tot/1e6:.2f} MB")

if __name__ == "__main__":
    main()
