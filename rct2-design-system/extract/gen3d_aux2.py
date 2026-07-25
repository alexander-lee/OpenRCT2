import os, json
MP=os.path.abspath("mp3d")
CDIR=f"{MP}/components"
desc={
 "WaterTile":"Animated water surface with a custom GLSL wave + Fresnel + sparkle shader.",
 "GrassTile":"A grass land tile (textured earth slab with tufts) from the RCT2 terrain surface.",
 "SandTile":"A sand land tile with dune ripples from the RCT2 desert surface.",
 "TerrainMap":"A generated RCT2-style landscape: stepped grass/sand tiles flooded by the water shader.",
 "Carousel":"Merry-go-round: spinning horses under a striped canopy, from the RCT2 sprite.",
 "FerrisWheel":"Ferris wheel with A-frame supports and gondolas that stay upright as they orbit.",
 "Teacups":"Spinning tea-cups flat ride: a turntable of cups that each spin on their own axis.",
 "BumperCars":"Dodgems: a fenced arena with a powered ceiling grid and four darting cars.",
 "PirateShip":"Swinging pirate ship on a pivot arm between two towers.",
 "DropTower":"Vertical drop tower: a ring gondola that climbs then drops.",
 "LogFlume":"Log flume water ride: an elevated trough with a log boat of riders.",
 "Monorail":"Elevated monorail beam on piers with a streamlined gliding train.",
 "HauntedMansion":"A crooked haunted mansion dark ride with flickering windows.",
 "SwingRide":"Chair swing / wave-swinger: chained chairs flung out from a spinning canopy.",
 "GoKarts":"Go-kart circuit: an oval asphalt track with four karts racing around it.",
 "MineTrainCar":"Mine-train ore-cart vehicle with iron bands and a prospector.",
 "BobsleighCar":"Sleek two-seat bobsleigh on chrome runners in a banked chute.",
 "InvertedCoasterCar":"Inverted-coaster car whose seats hang beneath the rail.",
 "Kit":"Scenery kit showcase: trees, bench, bin, lamp, fountain, statue and flower bed together.",
 "NormalPath":"A paved (tarmac) footpath tile from the RCT2 path assets.",
 "DirtPath":"A dirt footpath tile from the RCT2 path assets.",
 "QueuePath":"A narrow railed queue lane, sized for a single guest, from the RCT2 queue path.",
}
def prev(name,d):
    return ("import React from 'react';\nimport { %s } from './index';\n\n"
      "const previews = {\n  componentName: '%s',\n  importPath: 'components/%s',\n"
      "  previews: [\n    { name: '3D rig', description: %s, render: () => <%s /> },\n  ],\n};\n\nexport default previews;\n"
      % (name,name,name,json.dumps(d),name))
made=[]
for name in sorted(os.listdir(CDIR)):
    d=f"{CDIR}/{name}"
    if not os.path.isdir(d): continue
    if not os.path.exists(f"{d}/index.tsx"): continue
    pf=f"{d}/{name}.previews.tsx"; cf=f"{d}/Context.md"
    dd=desc.get(name, f"{name} — a 3D RCT2 rig.")
    if not os.path.exists(pf):
        open(pf,"w").write(prev(name,dd)); made.append(name+"/previews")
    if not os.path.exists(cf):
        open(cf,"w").write(f"# {name}\n\n{dd}\n\nBuilt with three.js on the shared Stage; modelled from the authentic RCT2 sprite.\n"); made.append(name+"/ctx")
print("created aux:", made)
