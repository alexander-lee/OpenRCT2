# UI placement rules

Overlay UI (buttons, windows, viewport insets) sits on top of the Stage canvas
inside its `position: relative` wrapper. These rules are mandatory.

## The day/night switcher

- **`UIDayNight` is ALWAYS and ONLY top-right.** Stage renders it itself
  (`top: 10px; right: 10px`, z-index 5) — never add a second one, never move
  it, never restyle it.
- **Nothing may overlap the top-right switcher** — no window, viewport inset
  or badge in that slot. Windows render at z-index 4, below it.
- Day = raised light button with the gold pixel sun; night = latched
  pressed-in dark button with the pale pixel moon. Keep the two states this
  unambiguous.

## Icons

- **All overlay-UI icons come from `components/UIIcons` (`<UIIcon name=… />`).**
  NO emoji, NO icon libraries, NO smooth vector art — every icon is a
  hand-drawn ~10x10 pixel grid (2-3 flat colours + dark outline) in the RCT2
  toolbar-pictogram spirit, rendered crisp-edged.
- Available names are in `UI_ICON_NAMES` (sun, moon, ride, guest, park,
  camera, wrench, warning, close, chevronUp, chevronDown, happy, sad). New
  icons are drawn in the same grid style and added there — never inline.
- Standard sizes: 20px default, 12-14px inline with 11px text, 11px in title
  bar buttons.

## Windows

- **All windows use `UIWindow` chrome exclusively** — no custom window chrome,
  ever. Ride viewer, guest info, park info, ride stats etc. compose
  `<UIWindow>` and only supply body content.
- **Park Info window anchors `corner="bottom-right"` and MUST be
  `collapsible`.**
- **Maximum ONE `UIWindow` per corner.** Free-positioned (`x`/`y`) windows
  must also start clear of every anchored window and the switcher.
- Initial positions are deterministic (props only — no randomness, no
  measuring).

### Window content typography

Use the `UI_TEXT` styles exported from `components/UIWindow`:

- **List-item NAMES / labels: bold** (`UI_TEXT.name`, weight 700).
- **Secondary values** (queue counts, stats, states): normal weight, slightly
  smaller, muted (`UI_TEXT.value`).
- **Section headers: small-caps** — uppercase, 9px, letter-spaced
  (`UI_TEXT.header`).

## Viewport insets (extra cameras)

- Viewport insets — a RideViewer camera view, a player/guest cam — render
  **bottom-left by default** via the Stage build API:

  ```tsx
  <Stage build={(t, g, api) => {
    const cam = new t.PerspectiveCamera(50, 1, 0.1, 100);
    g.add(cam);
    const rect = rect43(0.02, 0.6, 0.3, canvasW / canvasH); // 4:3, from Stage
    const remove = api?.addViewport(cam, rect);
    // rect is normalized 0..1, x/y measured from the canvas TOP-LEFT
  }} />
  ```

- **Every camera inset renders at a 4:3 pixel aspect** — compute the rect with
  `rect43(x, y, w, canvasAspect)` (exported from `components/Stage`).
- **Every camera inset gets a `ViewportFrame`** (exported from
  `components/UIWindow`): render `<ViewportFrame rect={rect} />` as a sibling
  inside the same `position: relative` wrapper so the raw camera view reads as
  a framed RCT2 viewport widget (tan bevel outside, dark inner edge).
  RideViewer and the PlayerCam previews do both.
- `api` is the optional third `build` argument:
  `{ scene, camera, renderer, addViewport(cam, rect, opts?) => remover,
  setCameraPose(pos, target?), setGroundSampler(fn), onPick(cb) =>
  unsubscriber }`. Registered viewports render each frame AFTER the main view
  (scissor + viewport). Two-argument `build(t, g)` callbacks remain fully
  supported.
- **Hide lists keep player POVs clear:** `addViewport(cam, rect, { hide:
  [objects] })` toggles each listed root (descendants included) invisible for
  THAT viewport's render pass only, restoring right after. `attachPlayerCam`
  passes the vehicle automatically so onboard/chase insets show the track
  ahead instead of the car's own interior — do the same for any custom
  vehicle-mounted camera.
- Insets must never cover the top-right switcher or an anchored window's
  title bar; keep them clear of the bottom-right Park Info slot.

## Full-screen parks

- **Park generation / park composition scenes render the canvas FULL-SCREEN:**
  mount the Stage in a full-viewport container (100% width/height) and set
  `fullscreen` on Stage (100% x 100vh, no border radius — the responsive
  canvas tracks it). Small fixed-height canvases are for component previews
  only. Overlay windows keep their normal corner rules on top.
- **`<Park>` (components/Park) owns the canvas AND the windows.** A JSX-
  composed park gets all of this for free — ONE full-screen Stage
  (`fullscreen` default true, autoRotate off, terrain-clamped camera),
  `onPick` wired so a ride click opens RideViewer and a guest click opens
  GuestInfo (one floating window at a time), and ParkInfo mounted
  bottom-right once the manager settles. Never render a second Stage or a
  duplicate window suite inside a `<Park>`; custom overlays join its
  `position: relative` wrapper and follow the corner rules above.

## Navigation & clickability

- **Keyboard navigation is always live** on every Stage (held-key set →
  key-repeat safe; page scroll is suppressed). The keys MOVE the view — the
  mouse aims it:
  - **↑ ↓** glide the view (orbit target + camera together) forward/back
    along the camera's heading projected onto the ground plane; **← →**
    strafe left/right. Speed scales with the camera distance.
  - **Space / Shift** fly the view UP / DOWN (~2.2 units/s).
  - **Drag** orbits (azimuth + pitch). Don't rebind any of these.
- **Terrain following:** give the Stage a ground sampler — the `groundAt`
  prop or `api.setGroundSampler(fn)` (e.g. TerrainKit's `heightAt`) — and
  every frame the camera is clamped to y ≥ ground + 0.35 and the orbit
  target to y ≥ ground + 0.15, smoothed (instant push-up, lerped release) so
  the view can NEVER clip under terrain or walls. Every terrain scene should
  set it.
- **Clickable scene objects carry a marker in `userData`**: rides set
  `userData.rideRef`, guests set `userData.guestRef`, on their root group.
  `api.onPick(cb)` raycasts pointer clicks (drags are ignored), walks up the
  parent chain and delivers the first `rideRef`/`guestRef` carrier — use it to
  open the matching RideViewer / GuestInfo window from a click.
- **autoRotate policy:** parks and multi-ride scenes turn it OFF
  (`autoRotate={false}` — teleported/arrow-key poses must hold). Small
  single-rig component previews may keep the default slow auto-rotate.

## Performance (UI side)

- **Poll, never per-frame.** Live windows (GuestInfo, ParkInfo, RideViewer
  stats) read their accessors on a `setInterval` of **≥ 300 ms** — reading
  GameManager accessors or `api.stats()` every animation frame forces React
  re-renders at 60 Hz and stutters the canvas. 300-500 ms reads as "live" in
  an RCT2 window.
- **One `UIWindow` per corner** (above) is also the perf rule: every open
  window is another polling loop + React subtree — one floating window
  (RideViewer or GuestInfo) at a time, ParkInfo may stay.
- **Viewport insets are full render passes.** Each `addViewport` camera
  re-renders the whole scene into its rect every frame — keep at most ONE
  live inset (RideViewer's cam OR a PlayerCam) mounted at a time, and remove
  it (call the disposer) when its window closes.
- **Budget probe:** `api.stats()` (Stage build API) returns `{ drawCalls,
  triangles, fps }` for the last complete frame — poll it at the same
  ≥ 300 ms cadence for any debug HUD. Budgets live in SETUP.md §13.
