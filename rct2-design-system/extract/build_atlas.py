#!/usr/bin/env python3
"""Pack every component's frames into ONE atlas PNG + a CDN manifest.

Each component's frames are composited into its aligned bbox canvas (uniform
per component), then all cells are shelf-packed into a single atlas so the whole
design system needs just ONE hosted image. Components slice it via CSS sprites.
"""
import os, json, math
from PIL import Image

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
DATA = json.load(open(f"{ROOT}/app/components.json"))
ATLAS_W = 1200

def load(rel):
    return Image.open(f"{ROOT}/{rel}").convert("RGBA")

def align_rotations(rots):
    """Composite N rotation sprites into a shared bbox canvas. -> (cw,ch,[cells])"""
    minX = min(r['x'] for r in rots); minY = min(r['y'] for r in rots)
    maxX = max(r['x']+r['w'] for r in rots); maxY = max(r['y']+r['h'] for r in rots)
    cw, ch = maxX-minX, maxY-minY
    cells = []
    for r in rots:
        canvas = Image.new("RGBA", (cw, ch), (0,0,0,0))
        canvas.alpha_composite(load(r['src']), (r['x']-minX, r['y']-minY))
        cells.append(canvas)
    return cw, ch, cells

def main():
    # gather cells: list of (key, PIL image); comp records reference keys
    cells = []       # (key, img)
    comps = []       # component descriptors with cell keys
    def add(key, img):
        cells.append((key, img)); return key

    for c in DATA['rideVehicles']:
        cw, ch, cs = align_rotations(c['rotations'])
        keys = [add(f"v_{c['prefix']}_{i}", im) for i, im in enumerate(cs)]
        comps.append(dict(kind="rot", name=c['name'], group=c['group'],
                          cw=cw, ch=ch, frames=keys))
    for c in DATA['rideTrack']:
        cw, ch, cs = align_rotations(c['rotations'])
        keys = [add(f"t_{c['key']}_{i}", im) for i, im in enumerate(cs)]
        comps.append(dict(kind="rot", name=c['name']+" Track", group="Track Rail",
                          cw=cw, ch=ch, frames=keys))
    for c in DATA['scenery']:
        cw, ch, cs = align_rotations(c['rotations'])
        keys = [add(f"s_{c['dat']}_{i}", im) for i, im in enumerate(cs)]
        comps.append(dict(kind="rot", name=c['name'], group="Scenery · "+c['group'],
                          cw=cw, ch=ch, frames=keys))
    for c in DATA['guests']:
        fr = {}
        for d, files in c['frames'].items():
            fr[d] = [add(f"p_{c['name']}_{d}_{i}", load(f)) for i, f in enumerate(files)]
        comps.append(dict(kind="walk", name=c['name'], group=c['group'],
                          cw=c['w'], ch=c['h'], frames=fr))
    mf = DATA['moodFaces']
    faces = []
    for i, f in enumerate(mf['faces']):
        im = load(f['src']); k = add(f"f_{i}", im)
        faces.append(dict(key=k, name=f['name'], w=f['w'], h=f['h']))
    comps.append(dict(kind="faces", name=mf['name'], group="Peep · Guest", faces=faces))

    # shelf-pack
    order = sorted(cells, key=lambda kv: -kv[1].height)
    pos = {}
    x = y = rowh = 0
    for key, im in order:
        if x + im.width > ATLAS_W:
            x = 0; y += rowh + 1; rowh = 0
        pos[key] = (x, y, im.width, im.height)
        x += im.width + 1
        rowh = max(rowh, im.height)
    atlas_h = y + rowh + 1
    atlas = Image.new("RGBA", (ATLAS_W, atlas_h), (0,0,0,0))
    for key, im in cells:
        px, py, _, _ = pos[key]
        atlas.alpha_composite(im, (px, py))
    # quantize lossless (unique colours) to shrink
    ncol = min(256, len(atlas.getcolors(maxcolors=1<<20) or [0]*256))
    atlas.convert("RGBA").quantize(colors=max(2, ncol), method=Image.Quantize.FASTOCTREE,
                                   dither=Image.Dither.NONE).save(f"{ROOT}/assets/atlas.png", optimize=True)

    # build cdn manifest: replace keys with [sx,sy,w,h]
    def cell(k):
        p = pos[k]; return [p[0], p[1], p[2], p[3]]
    out = []
    for c in comps:
        if c['kind'] == 'rot':
            out.append(dict(kind='rot', name=c['name'], group=c['group'],
                            cw=c['cw'], ch=c['ch'], frames=[cell(k) for k in c['frames']]))
        elif c['kind'] == 'walk':
            out.append(dict(kind='walk', name=c['name'], group=c['group'],
                            cw=c['cw'], ch=c['ch'],
                            frames={d: [cell(k) for k in ks] for d, ks in c['frames'].items()}))
        else:
            out.append(dict(kind='faces', name=c['name'], group=c['group'],
                            faces=[dict(name=f['name'], cell=cell(f['key'])) for f in c['faces']]))
    manifest = dict(atlasW=ATLAS_W, atlasH=atlas_h, components=out)
    json.dump(manifest, open(f"{ROOT}/app/cdn_manifest.json", "w"))
    sz = os.path.getsize(f"{ROOT}/assets/atlas.png")
    print(f"atlas {ATLAS_W}x{atlas_h}, {len(cells)} cells, {sz/1024:.1f}KB, {len(out)} components")

if __name__ == "__main__":
    main()
