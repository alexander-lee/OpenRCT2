#!/usr/bin/env python3
"""Assemble the unified ~100-component design-system manifest.

Rides prioritized: ride vehicles (cars) + track rails. Then peeps, then 10 scenery.
Joins authentic ride names/categories, dedups to one hero car per ride, curates.
"""
import os, json
from collections import defaultdict

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
EX = os.path.dirname(__file__)

def load(p): return json.load(open(p))

CAR_QUOTA = {"Roller Coaster": 26, "Thrill Ride": 8, "Water Ride": 6,
             "Transport Ride": 5, "Gentle Ride": 5}   # -> 50 vehicles
RAIL_QUOTA = 30

# famous coasters to force-include (match on prefix)
MUST = {"PTCT1","BMSD","BMFL","BMVD","ARRT2","ARRSW2","WMOUSE","BOB1","SPDRCR",
        "REVF1","VEKST","GTC","NEMT","INTINV","BMRB","MFT","STEEP2","LFB1",
        "RAPBOAT","MONO1","SFRIC1","VREEL","ZLDB","INTBOB","SMC1"}

# swinging/enclosed rides whose cardinal sub-frames decode to a backdrop
EXCLUDE = {"JUNKSWNG"}

def build_cars():
    names = load(f"{EX}/ride_names.json")
    raw = load(f"{ROOT}/assets/rides_cars/raw_index.json")
    raw = [e for e in raw if e['prefix'] not in EXCLUDE]
    # pick hero car per prefix = largest rot0 area
    best = {}
    for e in raw:
        a = e['rotations'][0]['w'] * e['rotations'][0]['h']
        if e['prefix'] not in best or a > best[e['prefix']]['_area']:
            e2 = dict(e); e2['_area'] = a; best[e['prefix']] = e2
    rides = []
    for pre, e in best.items():
        meta = names.get(pre, {"name": e['obj_name'], "category": "Thrill Ride"})
        rides.append(dict(prefix=pre, name=meta['name'], group=meta['category'],
                          car=e['car'], area=e['_area'],
                          rotations=[{"src": r['file'], "w": r['w'], "h": r['h'],
                                      "x": r['x'], "y": r['y']} for r in e['rotations']]))
    # curate by quota, forcing MUST, then largest within each category
    by_cat = defaultdict(list)
    for r in rides: by_cat[r['group']].append(r)
    chosen = []
    seen = set()
    for cat, quota in CAR_QUOTA.items():
        pool = sorted(by_cat.get(cat, []), key=lambda r: (-(r['prefix'] in MUST), -r['area']))
        for r in pool[:quota]:
            chosen.append(r); seen.add(r['prefix'])
    # ensure all MUST are present
    for r in rides:
        if r['prefix'] in MUST and r['prefix'] not in seen:
            chosen.append(r); seen.add(r['prefix'])
    return chosen

def build_rails():
    rails = load(f"{ROOT}/assets/rails/manifest.json")
    # priority: keep first RAIL_QUOTA, but drop exact-duplicate sprite sets
    out = []
    seen_src = set()
    for r in rails:
        key = r['rotations'][0]['file'].split('/')[-1]
        s0 = tuple((rt['w'], rt['h']) for rt in r['rotations'])
        out.append(dict(key=r['key'], name=r['name'],
                        rotations=[{"src": rt['file'], "w": rt['w'], "h": rt['h'],
                                    "x": rt['x'], "y": rt['y']} for rt in r['rotations']]))
    return out[:RAIL_QUOTA]

def build_peeps():
    m = load(f"{ROOT}/assets/peeps/manifest.json")
    comps = []
    for g in m['guests']:
        comps.append(dict(kind="walk", name=g['name'], group="Guest",
                          w=g['w'], h=g['h'], frameCount=g['frameCount'],
                          frames=g['frames']))
    for s in m['staff']:
        comps.append(dict(kind="walk", name=s['name'], group="Staff",
                          w=s['w'], h=s['h'], frameCount=s['frameCount'],
                          frames=s['frames']))
    faces = dict(kind="faces", name="Guest Mood Faces", group="Guest",
                 faces=[{"name": f['name'], "src": f['file'], "w": f['w'], "h": f['h']}
                        for f in m['faces']])
    return comps, faces

def build_scenery():
    sc = load(f"{ROOT}/assets/scenery10/manifest.json")
    return [dict(dat=s['dat'], name=s['name'], group=s['category'],
                 rotations=[{"src": r['file'], "w": r['w'], "h": r['h'],
                             "x": r['x'], "y": r['y']} for r in s['rotations']])
            for s in sc]

def main():
    cars = build_cars()
    rails = build_rails()
    peeps, faces = build_peeps()
    scenery = build_scenery()
    manifest = dict(
        rideVehicles=cars, rideTrack=rails,
        guests=peeps, moodFaces=faces, scenery=scenery,
    )
    total = len(cars) + len(rails) + len(peeps) + 1 + len(scenery)
    manifest['counts'] = dict(rideVehicles=len(cars), rideTrack=len(rails),
                              peeps=len(peeps)+1, scenery=len(scenery), total=total)
    with open(f"{ROOT}/app/components.json", "w") as fp:
        json.dump(manifest, fp)
    print("=== component manifest ===")
    print(f"ride vehicles : {len(cars)}")
    print(f"ride track    : {len(rails)}")
    print(f"peeps         : {len(peeps)+1} (incl. mood faces)")
    print(f"scenery       : {len(scenery)}")
    print(f"TOTAL         : {total}")
    from collections import Counter
    print("vehicle groups:", dict(Counter(c['group'] for c in cars)))
    print("sample vehicles:", [c['name'] for c in cars[:8]])

if __name__ == "__main__":
    main()
