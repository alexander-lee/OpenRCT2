# Rubric calibration — axes 15 and 16

> **SPLIT OUT OF `RUBRIC.md` — the VOLATILE calibration data.**
>
> Corpus-derived thresholds for the layout-uniqueness and WORLDS axes.
> Keeping it welded to the rubric meant every re-measurement rewrote the whole
> 74.6 KB file. The stable half (Pipeline, the weights table, the 16 axis
> DEFINITIONS) lives in `RUBRIC.md` and rarely changes; this file is the part
> that changes when the corpus is re-measured. `check-weights.mjs` parses only
> the weights table, so it is unaffected by this split.

## Calibration — axis 15 across the corpus

`node calibrate.mjs` (pure node, no browser). `grid` = `gridRegularity`,
`effL` = effective edge-length classes, `obl%` = non-cardinal edges,
`dist`/`sep` = district count / max separation, `plot` = `plotUtilisation`,
`open`/`sprd` = open-space count / area spread, `novl` = nearest-signature
distance.

**READ THE TWO HALVES OF THIS TABLE DIFFERENTLY.** `calibrate.mjs` re-parses a
park's SOURCE to rebuild its street net, which works for the four synthetic
controls and for the parks whose nets are literal arrays, and SKIPS the rest
(`fountainPlazaPlan is not defined`, `no street net found in source`, …). The
LIVE-PROBE rows below come from `shots/<name>/probe.json` and are what a scorer
actually scores; where the two disagree, the live probe wins.

Synthetic controls (`fixtures.mjs`, re-run 2026-07-25):

| park | grid | effL | obl% | dist | sep | plot | open | sprd | novl | **score** |
|------|-----:|-----:|-----:|-----:|----:|-----:|-----:|-----:|-----:|----------:|
| ctrl-organic  | 0.131 | 4.12 | 90 | 2 | 32.68 | 0.884 | 3 | 6.25 | 0.281 | **7.0** |
| ctrl-setpiece | 0.656 | 3.88 |  0 | 3 | 40.79 | 0.882 | 2 | 1.50 | 0.132 | **5.71** |
| ctrl-lattice  | 1.000 | 1.00 |  0 | 6 | 42.43 | 0.882 | 1 | 1.00 | 0.091 | **3.25** |
| ctrl-huddle   | 1.000 | 1.00 |  0 | 1 |  0.0 | 0.150 | 1 | 1.00 | 0.177 | **1.0** |

LIVE PROBES, re-measured 2026-07-25 (`node probe.mjs samples/<park>.tsx`, all
`notes: []`):

| park | size | grid | effL | lns | dist | sep / floor | plot | open | sprd | novl | **score** |
|------|-----:|-----:|-----:|----:|-----:|------------:|-----:|-----:|-----:|-----:|----------:|
| district-ref | 48 | 0.584 | 4.29 | 0.378 | 2 | 26.16 / 20 | 0.951 | 2 | 2.33 | 0.099 | **6.75** |
| worlds-ref | 128 | 0.635 | 1.56 | 0.126 | 3 | 101.72 / 32.66 | 0.636 | 4 | 2.33 | 0.118 | **5.11** |
| seedcheck-s1-192 | 192 | 0.596 | 2.64 | 0.132 | 3 | 79.01 / 40 | 0.280 | 2 | 2.33 | 0.042 | **4.78** |
| arch-ref | 48 | 0.655 | 2.80 | 0.267 | 1 | 0 / 20 | 0.895 | 1 | 1.00 | 0.107 | **4.09** |
| setpiece-ref | 48 | 0.697 | 2.78 | 0.286 | 1 | 0 / 20 | 0.583 | 2 | 2.33 | 0.099 | **4.02** |
| demo-ref | 16 | 0.737 | 1.99 | 0.308 | 2 | 13.33 / 11.55 | 0.598 | 1 | 1.00 | 0.118 | **3.60** |
| arch-ref-legacy | 48 | 0.655 | 2.80 | 0.267 | 1 | 0 / 20 | 0.895 | 1 | 1.00 | **0** | **3.09** |
| **cinder-peak** | 48 | **0.774** | 2.07 | **0.951** | 1 | 0 / 20 | 0.982 | 1 | 1.00 | 0.125 | **2.63** |

Both failure modes are still caught at opposite ends: the monotonous lattice
(cinder-peak, ctrl-lattice) scores **0/3** on the anti-lattice points, and the
one-quadrant huddle (ctrl-huddle, round 6's failure) scores **0/2** on
districts/plot AND 0/3 on anti-lattice. The set-piece control and the organic
control — the two that read well by eye in shot 05 — score 5.71 and 7, and the
best real park (`district-ref`) lands at 6.75. **The axis spans 2.63–7.0 over
the live corpus, so it discriminates.**

**WHAT MOVED SINCE THE LAST PUBLICATION OF THIS TABLE, and why:**
* `arch-ref` `plot` **0.830 → 0.895** and `novl` **0.132 → 0.107** — the plot
  figure was the STATIC re-parse; the live probe places the rides where the
  manager actually put them. The novelty distance shrank because the corpus grew
  from 6 signatures to 13.
* `arch-ref-legacy` scores **3.09, one point below `arch-ref`, purely on
  novelty** — the two files are the same street net at a different seed, so
  their 29-dim signatures are IDENTICAL (`novl 0`). **`signatures/arch-ref-legacy.json`
  is deliberately NOT kept in the corpus** (it would drive `arch-ref`'s novelty
  to 0 as well and cost the primary reference park a point for having an
  alternate-seed twin). Probe it if you want its numbers, then delete its
  signature — see Corpus hygiene below.
* **`cinder-peak` 3.13 → 2.63, and it is NO LONGER A CLEAN PARK** — see the
  regression note under Corpus status. Its district count fell 2 → 1 and its
  `maxSeparation` 13.2 → 0 because several of its pads were auto-relocated
  (`padOnStreet` ×5) when the composition moved the water under its lattice.
  Do not cite it as a clean live-probe row.

Street net (cinder-peak): 41 street nodes / 61 street edges (58 / 78 including
the 17 access spur nodes), one x-pitch pair `[10.8, 6.0]` and z-pitches
`[4.8, 6.0, 7.2]`.

Pairwise signature distances confirm the fingerprint discriminates:

|               | organic | setpiece | lattice | cinder | huddle |
|---------------|--------:|---------:|--------:|-------:|-------:|
| ctrl-organic  |    –    |  0.281   |  0.401  | 0.343  | 0.461  |
| ctrl-setpiece |  0.281  |    –     |  0.221  | 0.201  | 0.237  |
| ctrl-lattice  |  0.401  |  0.221   |    –    | **0.091** | 0.177 |
| cinder-peak   |  0.343  |  0.201   | **0.091** |   –    | 0.193  |
| ctrl-huddle   |  0.461  |  0.237   |  0.177  | 0.193  |   –    |

## Calibration — axis 16 (WORLDS) across the corpus

`node calibrate.mjs` prints this table too. `decl` = declared `<World>` regions,
`presets` = the BUILT preset worlds, `xTheme` = cross-theme placements, `minSep`
= closest world-centre pair vs `floor` = `districtSeparationFloor(size)`.

Two sources, in this order: a **probed** record (`signatures/<name>.json`'s
`worlds` block, written by `probe.mjs` from the design system's own
`auditWorldThemes`), else a **static** read of the park source — a park that
never mounts `<World` cannot have a declared world, so the axis is 0 by
construction and provable without a browser.

| park | decl | built presets | xTheme | minSep | floor | **score** |
|------|-----:|---------------|-------:|-------:|------:|----------:|
| **worlds-ref** (LIVE probe, re-measured 2026-07-25 after the v6.0 rebuild) | **3** | pulse + brasswork + thornwick | **0** | **54.37** | 32.66 | **4.75** (5.0 before the world-CHOICE split) |

### Calibration — the WORLD-CHOICE term (added 2026-07-26)

Re-scored over every corpus park that declares a world, `presetUsage` computed
from `signatures/` (frequency `brasswork 7 · pulse 7 · thornwick 5 ·
emberfall 3 · tidewater 2`, median **5** → underused `tidewater`, `emberfall`;
at median `thornwick`; over-used `brasswork`, `pulse`):

| park | built presets | count | choice | variety | axis 16 old → new |
|------|---------------|------:|-------:|--------:|------------------:|
| r13a | pulse, brasswork, **tidewater** | 1 | **0.5** | 1.5 | 5.0 → **5.0** |
| r13b | pulse, **emberfall**, **tidewater** | 1 | **0.5** | 1.5 | 5.0 → **5.0** |
| r14a | thornwick, pulse, **emberfall** | 1 | **0.5** | 1.5 | 5.0 → **5.0** |
| coolpark | pulse, brasswork, thornwick | 1 | 0.25 | 1.25 | 5.0 → **4.75** |
| r12a | pulse, brasswork, thornwick | 1 | 0.25 | 1.25 | 5.0 → **4.75** |
| worlds-ref | pulse, brasswork, thornwick | 1 | 0.25 | 1.25 | 5.0 → **4.75** |
| voltmoor | **emberfall**, brasswork | 0.5 | **0.5** | 1.0 | 3.42 → **3.67** |
| r14b | thornwick, brasswork | 0.5 | 0.25 | 0.75 | 3.92 → **3.92** |
| coolpark-a | pulse | 0.2 | 0 | 0.2 | 2.08 → **2.03** |
| hollowmere2 | brasswork | 0.2 | 0 | 0.2 | 3.08 → **3.03** |

**The term discriminates and it is small.** The three parks that built the
identical brasswork + pulse + thornwick trio each lose 0.25; the three that
reached for `tidewater`/`emberfall` hold a full 5.0; `voltmoor` GAINS 0.25 for
having built emberfall. Nobody moves by more than a quarter point, which is the
intended size: this is a nudge away from a default, not a re-ranking.

**THE TABLE ABOVE IS THE CORPUS-24 SNAPSHOT AND IT ALREADY MOVED.** At corpus 27
(three w18 parks added the same day) the frequencies read `brasswork 9 ·
thornwick 8 · pulse 8 · emberfall 5 · tidewater 2`, median **8**, so `pulse`
slid from over-used to AT the median and `coolpark-a` (pulse only) went 2.03 →
**2.28**. **`tidewater` and `emberfall` are still the two under-used presets, and
the three-park brasswork+pulse+thornwick trio still reads 4.75** — the ordering
is stable, the absolute numbers are not. **`node calibrate.mjs` now RE-SCORES the
variety term from the corpus on disk instead of printing whatever a signature was
written with**, precisely because a corpus-relative term is stale the moment a
park is added; it keeps `buildOut`/`separation`/`coherence` from the stored parts,
because a signature does not carry the per-world build-out list (deriving those
from `builtPresets` paid every park with an unbuilt world a full 1.0 — caught and
fixed here, it had moved `r14b` 3.92 → 4.25 and `voltmoor` 3.42 → 4.0).
| arch-ref, arch-ref-legacy, briarwood, cinder-peak, demo-ref, district-ref, grass-check, meadowmere, meadowmere-diag, scoria-point, seedcheck-s1-192, setpiece-ref, stormhollow | 0 | – | 0 | – | – | **0** |
| ctrl-organic, ctrl-setpiece, ctrl-lattice, ctrl-huddle (fixtures) | 0 | – | 0 | – | – | **0** |

**worlds-ref, axis 16 = 5/5** (`shots/worlds-ref/probe.json`, `notes: []`,
`validatePark → ok: true`):

| part | score | the numbers |
|------|------:|-------------|
| world variety | **1.25 / 1.5** (was 1.5 before the 2026-07-26 COUNT+CHOICE split) | 3 declared, 3 BUILT: `pulse`, `brasswork`, `thornwick` → COUNT **1/1**. CHOICE **0.25/0.5**: `thornwick` sits exactly AT the corpus median (5 builds) and the other two are the two MOST-built presets (`brasswork` 7, `pulse` 7). `unusedPresets` `emberfall` (3) and `tidewater` (2) are the two the corpus under-uses — both fully buildable, this park simply did not use them, which is now what the 0.25 costs. **`worlds-ref` therefore reads axis 16 = 4.75/5, not 5.0** |
| build-out | **1 / 1** | pulse 1 ride / 4 stalls / 3 scenery + 2 set-pieces · foundry 2 / 4 / 3 + 1 · glade 1 / 4 / 3 + 1 — every world `built: true` |
| separation | **1 / 1** | closest pair foundry↔glade **54.37** u ≥ the 32.66 u floor at size 128 (others 55.28, 87.10) |
| coherence | **1.5 / 1.5** | `crossTheme: []`, `unplacedThemed: []`, 19 themed pieces across the three worlds (6 · 7 · 6) and 14 neutral |

**THIS ROW IS THE POST-v6.0 REBUILD.** The land macros `worlds-ref` used to call
were removed from the design system, so the park was rebuilt from surviving
components only — a themed structural set-piece per world plus that world's own
ride, stall and scenery, with every hand-placed cell in `worldPlan({ include })`.
**It scores the same 5.0 it did before**, which is the evidence that axis 16 was
never coupled to the macros: what the audit measures is `<World>` regions and
component theme tags, and both survived intact.

**THE PRE-WORLDS CORPUS SCORES 0, AND THAT IS THE CORRECT READING — but check
what it does NOT do.** Every reference park keeps `validatePark → ok: true`
(verdicts re-measured 2026-07-25 — see the BASELINE TABLE below, and note that
`arch-ref` now carries **2** lints, not the 3 this line used to claim), because
the whole audit is skipped when
`declared === 0`: no world regions, no findings, no new warnings, no change to
any other axis's inputs. Their `layout.signature`s are untouched, so the novelty
points on axes 13 and 15 still compare against the same corpus. **The only thing
that moves for a pre-worlds park is its absolute total** — 0/5 on axis 16 plus
whatever it loses from Creativity's 8 → 3 trim. They remain valid regression
references for the gate, for the signature corpus and for axes 1-15; they are
simply no longer plausible TOP scorers, which is the point of adding the axis.

Deliberately NOT done: no fallback that pays a park for having no worlds. A
"nothing is wrong so take the coherence points" rule would have kept the legacy
totals up and made the axis unable to discriminate at all.

### Verification of the cross-theme check (2026-07-25)

The coherence test is negative-tested, not assumed. A copy of `worlds-ref` with
two deliberate breaks — a `<LavaFissure>` (emberfall) planted at `[9.6, 45.6]`
inside the **pulse** world, and a `<Bazaar theme={EMBERFALL_CALDERA}>` at
`[12, -33.6]` inside the **thornwick** world — reports:

```
gate warnings: {"crossTheme": 2}          validatePark → ok: true   (warnings, not failures)
probe.worlds.crossThemeCount 2
  LavaFissure  emberfall [9.6, 45.6]   -> world pulse (pulse)
  Bazaar       emberfall [12, -33.6]   -> world glade (thornwick)
probe.worlds.score 4.0  { variety: 1.5, buildOut: 1, separation: 1, coherence: 0.5 }
```

The second finding is the reason `tagComponent` takes an explicit `at`: a
`setPiece()` builds in WORLD coordinates and mounts its group at the ORIGIN, so
before that the Emberfall-dressed bazaar read as `world: null` (the cell [0, 0])
instead of a cross-theme hit. Set-pieces are now resolved from their FOOTPRINT
CENTRE.

