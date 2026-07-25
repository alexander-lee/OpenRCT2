#!/usr/bin/env python3
"""Batch: extract 4-rotation cars for EVERY ride .DAT, write raw_index.json."""
import os, glob, json, struct
from ride_cars_extract import extract_ride, OBJ, OUT, ROOT

def main():
    rides = []
    for f in sorted(glob.glob(f"{OBJ}/*.DAT")):
        try:
            flags = struct.unpack_from('<I', open(f, 'rb').read(4), 0)[0]
        except Exception:
            continue
        if (flags & 0x0F) != 0:  # only ride objects
            continue
        try:
            entries = extract_ride(f)
        except Exception as e:
            continue
        for e in entries:
            r0 = e['rotations'][0]
            if r0['w'] < 10 or r0['h'] < 8:   # drop placeholder/empty cars
                # delete the tiny files we just wrote
                for r in e['rotations']:
                    p = f"{ROOT}/{r['file']}"
                    if os.path.exists(p): os.remove(p)
                continue
            rides.append(e)
    with open(f"{OUT}/raw_index.json", "w") as fp:
        json.dump(rides, fp)
    # summary
    from collections import Counter
    codes = Counter(e['prefix'] for e in rides)
    print(f"ride-car components: {len(rides)} across {len(codes)} ride objects")
    sizes = sorted((e['rotations'][0]['w']*e['rotations'][0]['h'], e['prefix'], e['car'])
                   for e in rides)
    print("smallest:", sizes[:3])
    print("largest:", sizes[-5:])

if __name__ == "__main__":
    main()
