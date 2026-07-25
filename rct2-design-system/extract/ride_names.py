#!/usr/bin/env python3
"""Recover authentic RCT2 ride/car display names + assign a design-system category.

For every unique prefix in assets/rides_cars/raw_index.json this:
  1. Decodes the ride .DAT object chunk (via objextract.read_object).
  2. Parses the object's first string table (the NAME table) to recover the
     authentic English (language id 0) display name.
  3. Reads the ride type (ride_type[0..2] at decoded offset 12) to pick a
     design-system category.
  4. Emits ride_names.json keyed by prefix.

String table format inside the decoded chunk:
  The rct_ride_entry legacy header is a fixed size; the first string table
  (name) begins at offset 450. Each entry is: 1 byte language id, then a
  NUL-terminated string. English is language id 0. The table ends with 0xFF.
  Three tables follow in order: name, description, capacity.
"""
import os, json, sys
from objextract import read_object

DEPOT = ("/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/"
         "Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331/ObjData")
RAW_INDEX = "/Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/assets/rides_cars/raw_index.json"
OUT = "/Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/extract/ride_names.json"

# Offset of the first (name) string table in the decoded ride object chunk.
NAME_TABLE_OFFSET = 450
# Offset of ride_type[0] in the decoded chunk (seek8, flags u32, then ride_type[3]).
RIDE_TYPE_OFFSET = 12

CAT_ROLLER = "Roller Coaster"
CAT_WATER  = "Water Ride"
CAT_TRANS  = "Transport Ride"
CAT_GENTLE = "Gentle Ride"
CAT_THRILL = "Thrill Ride"
CAT_SHOP   = "Shop/Stall"

# RCT2 ride type id -> category.
RIDE_TYPE_CATEGORY = {
    0:  CAT_ROLLER,  # Spiral Roller Coaster
    1:  CAT_ROLLER,  # Stand-up Roller Coaster
    2:  CAT_ROLLER,  # Suspended Swinging Coaster
    3:  CAT_ROLLER,  # Inverted Roller Coaster
    4:  CAT_ROLLER,  # Junior Roller Coaster
    5:  CAT_TRANS,   # Miniature Railway
    6:  CAT_TRANS,   # Monorail
    7:  CAT_ROLLER,  # Mini Suspended Coaster
    8:  CAT_WATER,   # Boat Hire
    9:  CAT_ROLLER,  # Wooden Wild Mouse
    10: CAT_ROLLER,  # Steeplechase
    11: CAT_GENTLE,  # Car Ride
    12: CAT_THRILL,  # Launched Freefall
    13: CAT_ROLLER,  # Bobsleigh Coaster
    14: CAT_GENTLE,  # Observation Tower
    15: CAT_ROLLER,  # Looping Roller Coaster
    16: CAT_WATER,   # Dinghy Slide
    17: CAT_ROLLER,  # Mine Train Coaster
    18: CAT_TRANS,   # Chairlift
    19: CAT_ROLLER,  # Corkscrew Roller Coaster
    20: CAT_GENTLE,  # Maze
    21: CAT_GENTLE,  # Spiral Slide
    22: CAT_THRILL,  # Go-Karts
    23: CAT_WATER,   # Log Flume
    24: CAT_WATER,   # River Rapids
    25: CAT_THRILL,  # Dodgems
    26: CAT_THRILL,  # Swinging Ship
    27: CAT_THRILL,  # Swinging Inverter Ship
    28: CAT_SHOP,    # Food Stall
    29: CAT_SHOP,    # (unused 1D)
    30: CAT_SHOP,    # Drink Stall
    31: CAT_SHOP,    # (unused 1F)
    32: CAT_SHOP,    # Shop
    33: CAT_GENTLE,  # Merry-Go-Round
    34: CAT_SHOP,    # (unused 22)
    35: CAT_SHOP,    # Information Kiosk
    36: CAT_SHOP,    # Toilets
    37: CAT_GENTLE,  # Ferris Wheel
    38: CAT_THRILL,  # Motion Simulator
    39: CAT_GENTLE,  # 3D Cinema
    40: CAT_THRILL,  # Top Spin
    41: CAT_GENTLE,  # Space Rings
    42: CAT_ROLLER,  # Reverse Freefall Coaster
    43: CAT_TRANS,   # Lift
    44: CAT_ROLLER,  # Vertical Drop Roller Coaster
    45: CAT_SHOP,    # Cash Machine
    46: CAT_THRILL,  # Twist
    47: CAT_GENTLE,  # Haunted House
    48: CAT_SHOP,    # First Aid
    49: CAT_GENTLE,  # Circus
    50: CAT_GENTLE,  # Ghost Train
    51: CAT_ROLLER,  # Twister Roller Coaster
    52: CAT_ROLLER,  # Wooden Roller Coaster
    53: CAT_ROLLER,  # Side-Friction Roller Coaster
    54: CAT_ROLLER,  # Steel Wild Mouse
    55: CAT_ROLLER,  # Multi-Dimension Roller Coaster
    56: CAT_ROLLER,  # Multi-Dimension Roller Coaster (alt)
    57: CAT_ROLLER,  # Flying Roller Coaster
    58: CAT_ROLLER,  # Flying Roller Coaster (alt)
    59: CAT_ROLLER,  # Virginia Reel
    60: CAT_WATER,   # Splash Boats
    61: CAT_GENTLE,  # Mini Helicopters
    62: CAT_ROLLER,  # Lay-down Roller Coaster
    63: CAT_TRANS,   # Suspended Monorail
    64: CAT_ROLLER,  # Lay-down Roller Coaster (alt)
    65: CAT_ROLLER,  # Reverser Roller Coaster
    66: CAT_ROLLER,  # Heartline Twister Coaster
    67: CAT_GENTLE,  # Mini Golf
    68: CAT_ROLLER,  # Giga Coaster
    69: CAT_THRILL,  # Roto-Drop
    70: CAT_THRILL,  # Flying Saucers
    71: CAT_GENTLE,  # Crooked House
    72: CAT_TRANS,   # Monorail Cycles
    73: CAT_ROLLER,  # Compact Inverted Coaster
    74: CAT_ROLLER,  # Water Coaster
    75: CAT_ROLLER,  # Air Powered Vertical Coaster
    76: CAT_ROLLER,  # Inverted Hairpin Coaster
    77: CAT_THRILL,  # Magic Carpet
    78: CAT_WATER,   # Submarine Ride
    79: CAT_WATER,   # River Rafts
    80: CAT_SHOP,    # (unused 50)
    81: CAT_THRILL,  # Enterprise
    82: CAT_SHOP,    # (unused 52)
    83: CAT_SHOP,    # (unused 53)
    84: CAT_SHOP,    # (unused 54)
    85: CAT_SHOP,    # (unused 55)
    86: CAT_ROLLER,  # Inverted Impulse Coaster
    87: CAT_ROLLER,  # Mini Roller Coaster
    88: CAT_ROLLER,  # Mine Ride
    89: CAT_SHOP,    # (unused 59)
    90: CAT_ROLLER,  # LIM Launched Roller Coaster
}

# Keyword fallback for name-based categorisation when the ride type is unknown.
NAME_KEYWORDS = [
    (CAT_WATER,  ("flume", "rapid", "boat", "canoe", "log ", "water", "dinghy",
                  "raft", "submarine", "splash", "swan", "surf")),
    (CAT_TRANS,  ("monorail", "train", "tram", "chairlift", "ski-lift", "lift",
                  "railway", "cable")),
    (CAT_ROLLER, ("coaster", "rollercoaster", "roller coaster")),
    (CAT_GENTLE, ("carousel", "merry-go-round", "ferris", "wheel", "car ride",
                  "cars", "golf", "maze")),
    (CAT_THRILL, ("dodgem", "twist", "top spin", "swing", "freefall", "drop",
                  "enterprise", "carpet", "kart", "spinning")),
]


def parse_name_table(obj, offset=NAME_TABLE_OFFSET):
    """Return list of (lang_id, str) entries for the string table at `offset`."""
    entries = []
    i = offset
    n = len(obj)
    while i < n and obj[i] != 0xFF:
        lang = obj[i]
        i += 1
        end = obj.find(b"\x00", i)
        if end < 0:
            break
        entries.append((lang, obj[i:end].decode("latin-1")))
        i = end + 1
        if len(entries) > 64:  # runaway guard
            break
    return entries


def english_name(obj):
    """Recover the authentic English (lang id 0) name, or None on failure."""
    entries = parse_name_table(obj)
    if not entries:
        return None
    for lang, s in entries:
        if lang == 0 and s.strip():
            return s
    # No explicit English entry: fall back to the first non-empty entry.
    for lang, s in entries:
        if s.strip():
            return s
    return None


def ride_type_of(obj):
    """First valid (non-0xFF) ride type in ride_type[0..2], or None."""
    for k in range(3):
        rt = obj[RIDE_TYPE_OFFSET + k]
        if rt != 0xFF:
            return rt
    return None


def category_from_name(name):
    low = name.lower()
    for cat, kws in NAME_KEYWORDS:
        if any(kw in low for kw in kws):
            return cat
    return CAT_GENTLE


def main():
    idx = json.load(open(RAW_INDEX))
    # Preserve one entry per prefix; remember the car index (first seen).
    prefixes = {}
    for e in idx:
        prefixes.setdefault(e["prefix"], e)

    out = {}
    fallbacks = []
    cat_counts = {}

    for pfx in sorted(prefixes):
        entry = prefixes[pfx]
        path = os.path.join(DEPOT, pfx + ".DAT")
        fallback = False
        name = None
        rt = None
        if os.path.exists(path):
            try:
                _otype, _objname, obj = read_object(path)
                name = english_name(obj)
                rt = ride_type_of(obj)
            except Exception as ex:  # noqa
                print(f"WARN {pfx}: parse error {ex}", file=sys.stderr)

        if not name:
            name = pfx  # last-resort fallback to DAT code
            fallback = True

        if rt is not None and rt in RIDE_TYPE_CATEGORY:
            category = RIDE_TYPE_CATEGORY[rt]
        else:
            category = category_from_name(name)
            fallback = True

        rec = {
            "name": name,
            "category": category,
            "car": entry.get("car", 0),
            # hero rotation: index 1 is the most side-on/recognizable default.
            "hero": 1,
        }
        if fallback:
            rec["fallback"] = True
            fallbacks.append(pfx)
        out[pfx] = rec
        cat_counts[category] = cat_counts.get(category, 0) + 1

    json.dump(out, open(OUT, "w"), indent=2)

    # ---- Summary ----
    print(f"Total named: {len(out)}")
    print("Per category:")
    for cat in [CAT_ROLLER, CAT_WATER, CAT_TRANS, CAT_GENTLE, CAT_THRILL, CAT_SHOP]:
        print(f"  {cat:16} {cat_counts.get(cat, 0)}")
    print(f"Fallbacks ({len(fallbacks)}): {fallbacks if fallbacks else 'none'}")
    print("\nSamples:")
    for pfx in sorted(out)[:15]:
        r = out[pfx]
        print(f"  {pfx:10} -> {r['name']} ({r['category']})")


if __name__ == "__main__":
    main()
