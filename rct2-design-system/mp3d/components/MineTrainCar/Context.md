# MineTrainCar

Mine-train ORE CART modelled from the RCT2 mine-train vehicle sprite: a rough-sawn timber tub bound with iron straps, an open iron rim (never a lid), a dark interior well, two in-line bench seats with lumbar rolls and grab bars, an iron underframe and four flanged wheels. It is the vehicle `MineTrainCoaster` runs on its ore train.

`buildMineTrainCart(t, variant?, scheme?, { riders? }) → THREE.Group` — origin on the WHEEL AXLE line (wheel bottoms at −0.15, so a spline runner's default `wheelOffset` 0.195 drops them exactly onto the kit's 0.045 rail tops). RCT2 uses distinct sprites per train position, so `variant` picks the dressing while tub, seats, riders and dimensions stay IDENTICAL (train spacing math never changes):

- `'front'` (default) — raked ore-guard plate over the leading axle + a hooded MINE LANTERN whose `PointLight`/glass are published as `userData.headlamp` / `headlampMat`
- `'middle'` — plain, iron couplers at both ends
- `'end'` — rear coupler plus a red tail lamp (`userData.taillampMat`)

The lamp refs use the same keys `CoasterCar` uses, so **`gateCarLights(cart, k)` works on these carts unchanged** (lamps dark by day, lit after dusk). `scheme` is an RCT2 `VehicleColour` (`ride/VehicleColour.h:19-24`): `body` → tub planking, `trim` → ironwork (bands + rim), `tertiary` → the end plank panels; omitted gives the weathered timber/iron default.

`MINE_CART_SEATS` — the 2 seats per cart as cart-local `{ y: 0.195, z: ±0.22 }` offsets (peep GROUP origin; hips settle 0.015 INTO the 0.435 cushion top, and the 0.44 z pitch keeps the rear rider's legs clear of the bench in front). `MineTrainCoaster` parents an anchor per seat to each cart and feeds them to `makeSeatWorld`, so real GameManager guests ride the ore train — 3 carts × 2 seats is its capacity of 6. `riders: false` builds the cart empty (what a registered ride does); decorative riders are flagged `lodDetail` so the park runtime sheds them at distance.

`<MineTrainCar/>` is the composable single-vehicle preview: the cart on a short rustic test bed (rough sleepers + twin rusted rails), bobbing and rocking gently off the Stage clock. Deterministic; original three.js model on the shared Stage, proportions and palette referenced from the RCT2 asset library.
