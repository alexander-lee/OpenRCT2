# rct2-design-system/harness

In-repo home for the mp3d design-system evaluation tooling.

## READ THIS FIRST

**This harness must never live under `/tmp`.** An earlier copy lived only in
`/tmp` (`/tmp/park-eval`, `/tmp/mp3d-render`) and a reboot purge destroyed it
along with all 15 sample parks on 2026-07-24. It was then moved to a
persistent home outside the repo (`~/rct2-harness`), and as of this move it
lives IN the git repo itself, at `rct2-design-system/harness/`, so its
source is versioned and can never again be silently lost to a reboot.

A symlink is left at `~/rct2-harness` pointing at
`rct2-design-system/harness`, purely so other agents and docs that still
hardcode the old `~/rct2-harness` path keep working. Do not treat that
symlink as the source of truth — this directory (inside the repo) is.

**`node_modules/`, `shots/`, `out/`, `signatures/`, and all image files are
gitignored** (see `.gitignore` in this directory) — the fork this repo pushes
to is public, and none of that is safe or useful to publish (screenshots may
leak proprietary RCT2-derived renders; `node_modules`/browser caches are
just bulk). Only the `.mjs` tools, `package.json`, `RUBRIC.md`, `README.md`
and `samples/*.tsx` are committed. That means a fresh clone needs, in EACH
tool directory (`park-eval/` and `mp3d-render/`):

```sh
npm i
npx playwright install chromium
```

before anything here will run.

## Layout

```
rct2-design-system/harness/
  park-eval/       full-park evaluation harness (bundle + screenshot + probe + score)
  mp3d-render/     per-component preview screenshot harness
```

Both directories are self-contained: each has its own `package.json` and its
own `node_modules` (gitignored, installed against the design-system's own
pinned versions: `three@0.169.0`, `react@18.3.1`, `react-dom@18.3.1`,
`esbuild`), plus `playwright` (with its chromium browser) and `puppeteer-core`
as an optional higher-fidelity renderer. Every script resolves the design
system at `../../mp3d` (a sibling of `harness/`), derived from the script's
own `import.meta.url` rather than a hardcoded absolute path — so the harness
keeps working if the repo is moved or cloned somewhere else. It reads the
design system read-only — nothing under `mp3d/` is ever written by the
harness (eval-tag instrumentation is injected in memory at bundle time).

Browser choice: `evaltags.mjs`'s `openParkPage()` (used by `eval.mjs` and
`probe.mjs`) tries `puppeteer-core` against the newest installed
Chrome-for-Testing build under `~/.cache/puppeteer/chrome` first, and
transparently falls back to `playwright`'s bundled chromium if that's not
found. Both browsers run headless with `--use-angle=swiftshader` so 3D
rendering works without a GPU.

### park-eval/

| file | purpose |
|---|---|
| `eval.mjs` | bundle a park TSX, mount fullscreen at 1280x800, shoot 7 angles + capture console → `shots/<name>/` |
| `probe.mjs` | bundle a park TSX WITH eval-tag instrumentation, walk the live scene graph + ParkStore, write `shots/<name>/probe.json` |
| `evaltags.mjs` | the instrumented bundler (eval-tag injections + import preprocessor) shared by `eval.mjs` and `probe.mjs` |
| `lib.mjs` | plain (uninstrumented) bundler/page-opener used by `w7-check.mjs` — a probe run against this bundle reports "no `__evalPark` store" by design |
| `paths.mjs` | the one place `HERE` (this directory) and `REPO` (the design system) are defined |
| `layout.mjs`, `catalog.mjs`, `corpus.mjs`, `score-layout.mjs`, `fixtures.mjs`, `usage.mjs`, `calibrate.mjs` | scoring-axis support modules (layout uniqueness, ride/stall catalog, cross-park novelty corpus, calibration) |
| `RUBRIC.md` | the 15-axis, 100-point scoring rubric and the pipeline command reference |
| `samples/` | reference parks — see "Reference parks" below |
| `signatures/` | cross-park corpus signatures (layout/roster novelty) written by `probe.mjs` |
| `shots/<name>/` | per-park output: `01..07*.png`, `console.log`, `probe.json` |
| `w7-check.mjs` | fast regression runner: mounts parks, reports `validatePark` verdict + `[Park]` lints, no screenshots |

Run the full pipeline on a park:

```sh
cd rct2-design-system/harness/park-eval
node eval.mjs      samples/demo-ref.tsx      # 7 PNGs + console.log -> shots/demo-ref/
node probe.mjs      samples/demo-ref.tsx      # probe.json (numeric scene report)
node calibrate.mjs [--save] [--matrix]        # axis 15 over the signatures/ corpus
```

### mp3d-render/

| file | purpose |
|---|---|
| `render.mjs` | bundle ONE component's `.previews.tsx`, screenshot it (optionally orbited/night-toggled) |
| `check-all.mjs` | esbuild-bundle every component's previews file, no browser — fast sanity pass over the whole catalog |
| `check-some.mjs` | same, for an explicit component subset |
| `lib.mjs` | shared bundler/page-opener (same shape as `park-eval/lib.mjs`) |
| `probe-*.mjs`, `validate-react-park.mjs` | assorted scene/canvas/seed probes used during earlier waves |
| `shots/` | per-component screenshots |

Run the component sanity pass:

```sh
cd rct2-design-system/harness/mp3d-render
node check-all.mjs
node render.mjs FerrisWheel --night --angle=40
```

## Reference parks (`park-eval/samples/`)

Four sample parks were lost with `/tmp/park-eval`: `demo.tsx`,
`broadmoor.tsx`, `setpiece-demo.tsx`, `arch-w6.tsx`. Restoration status,
method, and honesty about what could NOT be recovered:

| lost file | restored as | method |
|---|---|---|
| `demo.tsx` | `demo-ref.tsx` | **(a) DS source, verbatim.** Imports `DemoPark` directly from `components/Park/Park.previews.tsx` — the in-repo size-16 JSX-composed worked example the design system itself ships and validates (`validatePark ok: true`). Fixed a bug from the prior reconstruction pass: it had rendered `previews.previews[0]`, which is actually the OTHER preview in that file (`DistrictPark`, size 48) — the docstring always said DemoPark, only the array index was wrong. Now imports `DemoPark` by name so it can't drift again. |
| `broadmoor.tsx` | **NOT RECOVERED** | Searched (a) DS previews/composition source, (b) git status/stash/log (the harness was never committed; `rct2-design-system/` is untracked), (c) filesystem for stray `*.tsx` mentioning `<Park` outside the repo/`/tmp` — nothing found. The name surfaces exactly once, in `mp3d/rules/park-generation.md`: *"the size-48 reference park `broadmoor` runs the legacy rect h 1.0 shifted by (+12.0, −14.4) into the back-east meadow, full gate green."* That is a single design-rule citation about one archetype-translation decision, not the park's full composition — not enough to reconstruct the file faithfully. `district-ref.tsx` (below) is a real, verified size-48 park from the same docs, but nothing ties it to the "broadmoor" name, so it is offered as a bonus reference, not a broadmoor substitute. |
| `setpiece-demo.tsx` | `setpiece-ref.tsx` | **(a) DS source, adapted.** `SetPieceKit.previews.tsx` only previews the three set-pieces standalone (via `<ScenePreview>`, no `<Park>` wrapper) — there is no previews file that composes a full park from them. This file was built by hand from the DS's own building blocks (`buildParkNet`, `fountainPlazaPlan`/`bazaarPlan`/`boulevardPlan`, `FountainPlaza`/`Bazaar`/`Boulevard`) following the same port-to-port wiring contract the previews file demonstrates, wrapped in `<Park>` with a gate spur and two flat rides tailed onto the fused net. This is a faithful reconstruction of the *pattern*, not a byte-for-byte recovery of the original file. |
| `arch-w6.tsx` | `arch-ref.tsx` (primary) + `arch-ref-legacy.tsx` (alternate seed) | **Reconstructed from design-system rules docs, not previews-derived.** `rules/park-generation.md` publishes the §4.0-A THRILL steel-rectangle archetype's exact piece list verbatim ("Publish-and-copy — don't re-derive"), which both files copy exactly. The original file's seed/biome is unknown, so two candidate reconstructions exist: `arch-ref.tsx` (seed 7, temperate) and `arch-ref-legacy.tsx` (seed 5, alpine) — each re-probed for its own water placement rather than trusting the seed table (a documented round-7 failure mode). Treat `arch-ref.tsx` as primary; `arch-ref-legacy.tsx` exists because the exact original seed could not be confirmed. |

Also present in `samples/` but **out of scope** for this restoration (not one
of the four requested files, and not needed per the round-7/8 record):
`cinder-peak.tsx` (a separately-tracked wave-7 evidence park) and
`district-ref.tsx` (the bonus size-48 reference described above). The
round-6/7 evidence parks `alder-grove`, `obsidian-falls`, `willowmere` are
confirmed **not recoverable** and are not needed — their scores and defect
lists are already recorded elsewhere.

## Verification

`node eval.mjs samples/demo-ref.tsx && node probe.mjs samples/demo-ref.tsx`
was run end-to-end from this persistent location as part of the migration;
see the migration report for the numeric results (park size framing,
`notes: []`, `rideRoster`/`stallRoster`/`layout` population, night-shot
`nightK`).
