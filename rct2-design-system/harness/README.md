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
  ds-push/         change detection (manifest.mjs) + the scripted pusher (push.mjs)
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

## FAST PUSH PROTOCOL — read this before you push anything to Magic Patterns

Design system: **`ds-fbd20bf8-b16d-4cf1-8440-d20bc095fc4a`**. Source of truth:
`../mp3d/`. Tools: **`ds-push/push.mjs`** (does the push over HTTP) and
**`ds-push/manifest.mjs`** (works out what changed). No deps, no install.

**Why there is a protocol at all.** File bytes travel through MODEL OUTPUT
TOKENS and output is the slow part of the loop. The old habit paid for every
file's bytes three times — read from disk, read the server copy to diff it,
emit the write, then read it back to verify. `rules/park-generation.md` (88 KB
≈ 22k tokens) cost ~90k tokens for ONE file; a rules-only push agent burned
555k tokens and ~40 minutes. Hashing is local and free, so the diff and the
verification both move off the wire.

### THE FAST PATH: `push.mjs` — push from a script, not from the model

**`ds-push/push.mjs` sends the file bytes over HTTP instead of through model
output tokens.** `manifest.mjs` killed the *input* cost of a push; this kills the
*output* cost, which was the one that actually hurt. Use it whenever it is
available and fall back to the seven manual steps below only if it is not.

```sh
cd rct2-design-system/harness/ds-push
node push.mjs --dry-run        # the plan + the exact request shapes. No key needed. Send nothing.
export MAGICPATTERNS_API_KEY='mp_...'
node push.mjs                  # push everything `plan` reports, verify, commit the manifest
```

It reuses `manifest.mjs` for the diff and the batching (it imports `diff()` and
`planBatches()` — there is one source of truth for "what changed"), pushes each
call in dependency order, verifies, and then runs `manifest.mjs commit` for
exactly the paths that verified. A path that did not verify stays dirty.

| flag | effect |
|---|---|
| `--dry-run` | print the plan and every JSON-RPC body (content elided), send nothing. **Works with no API key** |
| `--paths=<glob,glob>` | same filter as `manifest.mjs` |
| `--verify=list\|content\|none` | `list` (default) = one `get_design_system`, assert every path is present. **`content` = read every file back and compare sha256.** Byte-exact verification used to be unaffordable; over the wire it is free |
| `--publish` | `publish_design_system` after a fully clean push |
| `--keep-going` | don't stop at the first failure (unsafe — dependency order) |
| `--no-commit` | push + verify but leave the manifest dirty |
| `--limit=N` | only send the first N write calls |
| `--design-system=ds-…` | retarget, e.g. at a **throwaway** design system for a test |
| `--fat-batches [--batch-bytes=N]` | ignore the 8 KB/24 KB/6-file batching and pack up to N bytes per call (default 1 MB) |
| `--json` | machine-readable summary |

#### Setting up the key (this is the ONLY thing a human has to do)

1. Sign in at <https://www.magicpatterns.com/>. **API-key auth requires a paid
   plan** — it is the same entitlement the MCP integration needs.
2. Open **Settings → API Keys** (<https://www.magicpatterns.com/settings/api-keys>)
   and click **Create Key**. **Copy it immediately — it is shown exactly once.**
3. Export it in the shell that runs the script:
   ```sh
   export MAGICPATTERNS_API_KEY='mp_...'
   ```

The same key authenticates the v3 REST API and the MCP server, so one key covers
everything here.

> **SECURITY — never commit a key.** This repo pushes to a **public** GitHub
> fork; a key in a tracked file is a published key. `push.mjs` reads
> `MAGICPATTERNS_API_KEY` from the environment and nowhere else: it never writes
> a key to disk, never prints one, and passes every diagnostic through a
> redactor that rewrites `mp_…` to `mp_***REDACTED***` before it can reach a
> terminal or a CI log. Keep the key in your keychain / 1Password / an untracked
> file outside the repo that you `source` by hand. Do not add it to
> `.claude.json`, a `.env` in this repo, or a shell script here. If a key does
> leak, revoke it in Settings → API Keys and create a new one.

#### How it talks to Magic Patterns

There is **no** documented REST endpoint for design-system *file* writes — v3
REST documents only `GET /api/v3/design-systems` under its "Design Systems" tag.
The write path is the MCP server itself. `https://mcp.magicpatterns.com/mcp` is
streamable-HTTP MCP, i.e. JSON-RPC 2.0 over `POST` with SSE-framed responses, and
Magic Patterns documents API-key auth as a first-class alternative to OAuth
"for headless environments, CI, or any client where the interactive OAuth flow is
impractical". So `push.mjs` is a ~150-line MCP client. Verified against the live
server (2026-07):

```
POST https://mcp.magicpatterns.com/mcp
  content-type: application/json
  accept: application/json, text/event-stream      <- MANDATORY, both types
  authorization: Bearer $MAGICPATTERNS_API_KEY     <- x-mp-api-key also works
  x-mp-agent-name: rct2-ds-push                    <- optional, for UI attribution
  {"jsonrpc":"2.0","id":1,"method":"initialize",
   "params":{"protocolVersion":"2025-06-18","capabilities":{},
             "clientInfo":{"name":"rct2-ds-push","version":"1.0.0"}}}
-> 200 text/event-stream, and a `mcp-session-id: <uuid>` RESPONSE HEADER that
   must be echoed on every subsequent request

POST … {"jsonrpc":"2.0","method":"notifications/initialized"}      -> 202, no body

POST … {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
          "name":"write_design_system_files",
          "arguments":{"designSystemId":"ds-…","files":[{"fileName":"rules/x.md","content":"…"}]}}}
-> 200 text/event-stream: event: message / data: {"result":{…},"jsonrpc":"2.0","id":3}

DELETE …  (mcp-session-id: <uuid>)      release the session
```

Two traps this client handles that a naive one would not:

- **`initialize` succeeds with a bad key.** Authentication is checked at
  *tool-call* time, not handshake time. A missing `Authorization` header is a
  real `401`, but an *invalid* key comes back as **HTTP 200 / JSON-RPC success**
  carrying `isError: true` and the text `Error: Authentication failed. Please log
  in again.` You must check `result.isError`, not the status code.
- Responses are SSE frames even for a single reply, so the body has to be parsed
  out of `data: ` lines rather than `JSON.parse`d whole.

#### Limits (measured / documented)

| | |
|---|---|
| request body size | **≥ 16 MB accepted** by the transport (probed at 1/4/8/16 MB). The whole 5.9 MB corpus fits in one request — the 8 KB/24 KB/6-file batching is kept as the DEFAULT only because it bounds the blast radius of one rejected call, not because of a wire limit. `--fat-batches` opts out |
| rate limit | **1000 generations per 10 h per key** (documented). File writes are not generations |
| credits | v3/MCP bill against the normal credit balance; the credit-consuming tools are the *generative* ones (`create_design`, `send_prompt`, `create_slide_deck`). `write_design_system_files` carries no "requires credits" note. Out of credits = `402` |
| polling | irrelevant here — writes are synchronous. Only `create_design`/`send_prompt` are async (and must not be polled more than once per 60 s) |

Sources: [MCP overview / API-key auth](https://www.magicpatterns.com/docs/documentation/features/mcp-server/overview#api-key-authentication),
[available tools](https://www.magicpatterns.com/docs/documentation/features/mcp-server/available_tools),
[v3 API getting started](https://www.magicpatterns.com/docs/api/getting-started),
[list design systems (OpenAPI)](https://www.magicpatterns.com/docs/api/list-design-systems),
plus a live `tools/list` against `mcp.magicpatterns.com` for the exact schemas.

#### The failure modes it names for you

`push.mjs` classifies the three we have actually been bitten by, and prints the
remedy rather than the raw server string:

- **409 conflict** — the concurrent session that also writes this design system
  moved the active artifact. `push.mjs` never sends `baseArtifactId` (see step 5
  below), so a 409 is a real collision, not drift detection. Nothing is lost;
  the manifest still lists those files as dirty, so just re-run.
- **HTTP 500 with no `validationErrors`** — the unresolved-import signature. A
  file in that call imports something not on the server yet. Do **not** edit the
  file; push the dependency first and re-send unchanged.
- **Incomplete component trio** — reported as non-blocking `validationErrors` on
  the write and then **fatal at publish**. Every code component needs
  `index.tsx` (named export — a default export rejects the whole write),
  `<Name>.previews.tsx` (default-exported previews object) and `Context.md`.

#### What actually gets faster (and what does not)

| | |
|---|---|
| **free now** | emitting the file bytes. 142.6 KB of changed rules = ~36.5k output tokens under the old protocol; `push.mjs` sends them for **0** model tokens. Read-back verification is free too, which is why `--verify=content` exists at all |
| **still costs** | deciding *what* to change, and authoring the edit. If the model writes the file to `mp3d/` it still emits those bytes **once**. `push.mjs` removes the *second* emission (disk → Magic Patterns), not the first (model → disk) |
| **new flat cost** | one command plus ~40 lines of script output ≈ **under 1k tokens, independent of push size** |

A realistic **rules-only** push — the one that historically moved 253,158 B
(≈63k tokens of content) and burned **555k tokens / ~40 minutes**:

| | tokens for the push step | wall clock |
|---|---|---|
| the 555k-token incident (chunked writes, narration, 409s) | **555,000** | ~40 min |
| disciplined manual protocol, push-only agent | ~127,000 | minutes |
| disciplined manual protocol, agent that authored the change | ~70,000 | minutes |
| **`push.mjs`** | **< 1,000** | **seconds** |

That is **~70–130× off the push step** against the disciplined protocol and
~500× against the bad day. Measured transmission: **142.6 KB in two calls in
0.7 s** — that run was auth-rejected on purpose, so a real write adds
server-side validate + compile + activate per call; expect seconds to tens of
seconds, not minutes. The honest bottom line: for a change the session already
authored the total roughly **halves** (one emission instead of two), and for a
change already sitting on disk the push becomes **effectively free**.

### The seven steps (manual fallback — use `push.mjs` above if you can)

Use this only when `push.mjs` can't run (no `MAGICPATTERNS_API_KEY`, no paid
plan, network blocked). Everything below is still correct; it is just the
expensive way.

```sh
cd rct2-design-system/harness/ds-push
node manifest.mjs plan        # 1. what changed + the write-call plan. NO server reads.
```

1. **Get the changed list from the manifest, not the server.** `plan` prints
   exactly the files whose sha256 differs from the last verified push (plus any
   it has never seen), already in dependency order, with the write-call plan.
   **Never** `read_design_system_files` just to diff — that is the single
   biggest waste in the old loop.
2. **One `write_design_system_files` call per line of the plan.** A file over
   **8 KB is always alone in its call.** Small files may share a call (see
   *Batching* below) — the `files` param is an array and everything in one call
   lands atomically.
3. **NEVER chunk a file across calls.** Writes **REPLACE**, they do not append.
   A chunked write left a TRUNCATED file on this server. One file = one
   complete `content` string, or don't send it.
4. **Emit NOTHING but the tool call in a write turn.** No narration, no
   preamble, no "now writing X". Narration alongside a big write blew the 64k
   output cap for two agents and lost the whole turn.
5. **Do not pass `baseArtifactId`.** A CONCURRENT SESSION also pushes to this
   design system; sending a base artifact id turns every one of its writes into
   a 409 storm for you. Writes merge onto the existing artifact, so omitting it
   is safe for disjoint file sets.
6. **Verify from the write RESPONSE plus ONE `get_design_system` at the end of
   the batch.** The response already tells you accepted/rejected and carries
   `validationErrors`; the final call's `files` list confirms every path
   landed. **Do not read files back** — that is a third pass over the bytes and
   it proves nothing the file list doesn't.
7. **Record the push only after that final check:**
   ```sh
   node manifest.mjs commit --all-changed     # or: commit <path> <path> ...
   ```
   A path you did not confirm in the file list must NOT be committed — leave it
   dirty so the next `plan` picks it up again.

### Dependency order (the plan already sorts by this)

`package.json` / `tailwind.config.js` / `index.css` → leaf `.ts` modules →
`.tsx` submodules → component `index.tsx` → `*.previews.tsx` → `Context.md` →
`rules/*.md` **last** (nothing imports them).

**An HTTP 500 with no `validationErrors` means an unresolved import from a file
that has not landed yet.** Do NOT edit the file to work around it. Push the
missing dependency first, then re-send the file unchanged.

### Batching cut-off

| | rule |
|---|---|
| per-file ceiling to be batchable | **8 KB** (`SMALL_FILE_BYTES`) |
| max total content in one call | **24 KB** (`BATCH_BYTES`) |
| max files in one call | **6** (`BATCH_MAX_FILES`) |
| over 8 KB | **strictly one file per call, never batched** |

The limits are about the cost of *failure*, not the cost of success: a rejected
call throws away every byte in it, so the most a single rejection can cost you
is ~6k output tokens of re-emission. 24 KB ≈ 6k tokens is also comfortably
under the 64k output cap even with a rejection retry in the same turn.

### The measured win

Realistic change — 2 rules files + one component trio (`rules/park-generation.md`
88,350 B + `rules/park-generation-rides.md` 68,413 B + `components/Carousel/`
index 12,496 + previews 486 + Context 1,299) = **171,044 B ≈ 42,761 tokens** of
file content, at ~4 B/token for this source mix. Call that **1×**.

| | passes over the bytes | tokens | round trips |
|---|---|---|---|
| OLD: disk read + server diff read + write + read back | 1× out, 3× in | **171,000** | **20** |
| NEW, push-only agent (must read disk once) | 1× out, 1× in + 6k flat | **91,500** | **12** |
| NEW, agent that authored the change (content in context) | 1× out + 6k flat | **48,800** | **7** |

The 6k flat is the one `get_design_system` file-list check for the whole batch.
Emitting the bytes once is irreducible — you cannot write a file without
sending it — so the saving is all on the **input/round-trip** side: **47–71%
fewer tokens, 40–65% fewer round trips.**

The bigger real-world saving is the failure modes this protocol deletes. The
rules-only push that burned **555k tokens / ~40 min** moved 253,158 B ≈ 63,290
tokens of content — **8.8× the bytes**, because chunked writes truncated and had
to be re-sent, narration blew the 64k output cap and lost whole turns, and
`baseArtifactId` produced 409s that forced re-reads. Steps 3, 4 and 5 above
exist to make that impossible; the same push under this protocol is ~2× bytes
(≈127k) or ~1× (≈70k) if the agent authored the edits — a **4–8× reduction**.

### Never push these (baked into the tool — `node manifest.mjs audit` prints them)

- anything under `harness/` (and `skills-drafts/`, `tools/`, `node_modules/`,
  `shots/`, `out/`, `signatures/`), any dotfile, any `mp3d/_*.json` scratch
  payload, any image
- `components/{GrandPark,ThornwickGlade,EmberfallCaldera,TidewaterHollow,BrassworkFoundry,PulseDistrict}`
  — the five prefab "land macro" components **deleted deliberately** in v6.0.
  They must stay gone; `park-eval/preflight.mjs` fails any park importing them.
- the five **server-ahead** files, where the server copy is newer than disk and
  a push would regress it:
  `components/{Road,ColorKit,DirtPath,NormalPath,QueuePath}/Context.md`

One path remap: `mp3d/SETUP.md` is the design system's **`rules/setup.md`**.

### The manifest, and when it lies

`ds-push/pushed-manifest.json` is `serverPath -> { sha256, bytes, pushedAt }`
for every file pushed **and verified**. It is a local cache of a remote state,
so it can be wrong in two ways:

- **A CONCURRENT SESSION also pushes to this design system.** If it pushes a
  file, your manifest still holds your old sha and `plan` will offer to push
  your disk copy over theirs. Both sessions work from the same `mp3d/` tree, so
  that is usually a harmless idempotent re-push — but if you are about to push
  something you did not change, check with the other session first.
- **Anything that says "pushed" but wasn't.** Recovery, cheapest first:

```sh
node manifest.mjs forget <path>...            # make specific paths re-push
node manifest.mjs forget --paths='rules/*'    # ...or a glob
node manifest.mjs forget --all                # distrust everything (re-pushes 5.9 MB)

# name-level reconcile: call get_design_system, save its JSON, then —
node manifest.mjs reconcile --server-list=/tmp/ds.json
#   drops entries for paths the server does NOT have (they never landed) and
#   lists server paths the manifest doesn't know. Cheap: names only, no content.

# byte-level reconcile for a SMALL suspect set: read those files with
# read_design_system_files, write the server copies into DIR/<serverPath>, then —
node manifest.mjs reconcile --from-dir=/tmp/ds-server
#   hashes the SERVER's bytes and says which differ from disk. Authoritative.
#   Never do this for the whole tree — it is 5.9 MB of tool-result content.
```

A re-push is one write. A wrong "clean" is a change that silently never ships.
When in doubt, `forget` and re-push.

**Bootstrapping.** The manifest ships empty, so the first `plan` reports all
371 files. Once, at a moment when **no push is in flight and `mp3d/` has not
been edited since the last one**, seed it:

```sh
node manifest.mjs reconcile --server-list=/tmp/ds.json --assume-clean
```

That records disk hashes as `source:"assumed"` for every path the server
already has. It asserts disk == server without checking, which is exactly true
right after a full push has landed and false at any other time.

### ds-push/ commands

| command | what it does |
|---|---|
| `node push.mjs [--dry-run]` | **do the whole push over HTTP** (see THE FAST PATH above). Diff + write + verify + commit, 0 output tokens of file content |
| `plan` | changed files + dependency order + the write-call plan. **Start here.** |
| `status` | the same list without the plan. `--quiet` = paths only, `--json` = machine-readable |
| `commit <path>… \| --all-changed` | record paths as pushed+verified (hashes them now) |
| `hash [<path>…]` | sha256 + bytes for the push set, no manifest change |
| `forget <path>… \| --paths=<glob> \| --all` | drop entries so those paths re-push |
| `reconcile --server-list=F [--assume-clean]` / `--from-dir=D` | rebuild from the server (see above) |
| `audit` | push set vs excludes, counts + the baked-in never-push lists |

`--paths=<glob,glob>` filters any command (`--paths='rules/*'`,
`--paths='components/Park/*'`). Paths may be given local (`SETUP.md`,
absolute) or server-side (`rules/setup.md`); everything normalises to the
server path.

## Tool reference

### park-eval/

| file | purpose |
|---|---|
| `eval.mjs` | bundle a park TSX, mount fullscreen at 1280x800, shoot 8 angles + capture console → `shots/<name>/`, then **run `score-park.mjs` over the `probe.json` beside those shots and print the 16-axis score** (wired 2026-07-26; it refuses to print a score with no `probe.json`, flags one that PREDATES the run as stale, and exits non-zero if any axis is unmeasured). Since 2026-07-27 it also **refuses a `--name` that points at another park's `shots/` directory** (`--reassign-shots` opts out) — see "`--name` CANNOT SPEAK FOR ANOTHER PARK" |
| `score-park.mjs` | **THE 16-AXIS RUBRIC SCORER (2026-07-26).** `node score-park.mjs <park\|probe.json>` → a compact table + `shots/<park>/score.json` carrying per-axis `{ axis, name, weight, score, max, inputs, reason }`, where `inputs` records the probe fields actually read and `reason` names the threshold that decided the score. **Written because `eval.mjs` computed NO SCORE AT ALL** — axis 15 (`score-layout.mjs`) and axis 16 (embedded `probe.worlds.score`) were the only executable scorers and the other 14 axes were an agent doing arithmetic in its head off `RUBRIC.md`, so no two scorers reached the same number and "two consecutive parks at 100/100" was unfalsifiable. Reuses `scoreLayout` and the embedded `scoreWorlds` output rather than reimplementing them, and parses the weights out of `RUBRIC.md`'s own table (same regex as `check-weights.mjs`) so it cannot drift from the document. **A MISSING INPUT IS `unmeasured`, NEVER A PASS AND NEVER A ZERO:** the axis's weight leaves the denominator, the total prints as `X / Y MEASURED ***INCOMPLETE***` and the process exits non-zero. Detects a STALE embedded `worlds.score` (one predating the 2026-07-26 count/choice split) and recomputes it; derives the never-used shelf LIVE from `signatures/` instead of `RUBRIC.md`'s hard-coded (and already stale) prose list; refuses to score an internally inconsistent `water.terrainWater`. Every place `RUBRIC.md` had to be interpreted is in the `AMBIGUITIES` export and copied into every `score.json`. `--parkType=thrill\|family` (default `family`, the rubric's own tie-break), `--json`, `--no-write`, `--allow-unmeasured` |
| `score-park.selftest.mjs` | **PROOF THE SCORER CAN FAIL.** Mutates an IN-MEMORY copy of a high-scoring park's `probe.json` (nothing on disk, no signature published) and asserts each mutation costs points on the axis it should, across all 16 axes, plus the policy invariants: a missing input is unmeasured (neither awarded nor zeroed), an unmapped gate-failure kind is not forgiven (**including an unmapped `autofix` `[subkind]`, reported by its own name**), a GENUINE render failure caps the total at 40 while COMPONENT-prefixed `console.error`s do not, every `autofix` subkind lands on the axis `GATE_FAIL_SUBTAG_AXIS` names, `monorail.deckCenters` are world space, a PINNED novelty corpus reproduces exactly, and two runs are byte-identical. It found two real defects in `score-park.mjs` while being written. `node score-park.selftest.mjs [--park=<name>]`, exit 0 = every proof held |
| `seed-table.mjs` | regenerate the §1 SEED TABLE of `mp3d/rules/park-generation.md`: runs the real `parkComposition`, builds the real terrain from `comp.landform`, flood-fills the BUILT heightfield and reports landform archetype / water centroid+bbox+area / ranges / sand / meadows / apron per (seed, climate). `--size=128` (default), `--sweep`, `--json`, `--seeds=`, `--climates=`. Reports EVERY water body (`water.all`, biggest first), the measured gap between the two biggest, the `secondFrac` ratio and the `totalPct` — the composition composes TWO bodies on any plot ≥ 64 (2026-07) |
| `probe.mjs` | bundle a park TSX WITH eval-tag instrumentation, walk the live scene graph + ParkStore, write `shots/<name>/probe.json`. Since 2026-07-25 it also carries **`consoleSummary.lintKinds` / `lintCount` / `gateWarningKinds`** (the exact `[Park] lint [kind]` and gate-raised warning kinds — `probe.validation` is only populated by `DemoPark`, so before this every other park needed a second `w7-check.mjs` run to learn what "ok: true" was hiding), **`terrain.climate`** (axis 8's bands are per-climate and the probe used not to say which one) and **`terrain.maxSlope` on a fixed 0.6-u pitch** with the old size-relative figure kept as `maxSlopeCoarse`. **It does NOT publish a corpus signature unless you pass `--signature`** (2026-07-26), and it records `corpusSnapshot` (the exact novelty denominator, by name + hash) and `parkSource` / `probeName` / `probedAt` (the park's identity and the `--name` that chose its output locations). **Since 2026-07-27 a `--name` that would overwrite ANOTHER park's `shots/<name>/` or `signatures/<name>.json` refuses before bundling** — see "`--name` CANNOT SPEAK FOR ANOTHER PARK" below; opt out with `--reassign-shots` / `--reassign-signature` / `--reassign` |
### THE CORPUS IS OPT-IN (2026-07-26)

`probe.mjs` used to publish a `signatures/` entry on **every** successful run, so
measuring a park silently mutated the novelty denominator of every *other* park.
Pass **`--signature`** to publish; omit it and the probe says so in as many words
(`[probe] NO SIGNATURE PUBLISHED for "<name>" …`), naming the unchanged corpus
size and hash so nobody has to assume.

Why the default was inverted, all measured rather than argued:

* **Two concurrent wave agents changed each other's denominator mid-run.** Waves
  16A and 16B overlapped; whether 16A's park was inside 16B's "29-park corpus"
  came down to which run reached `saveSignature` first.
* **`signatures/` moved three times during a single scoring session** (`r16b`,
  `skeleton-a`, `w18-skeleton-b` rewritten by another process), taking the corpus
  hash from `60e0cabe` to `4cd4c268`.
* **The same park scored 97.68 and 96.18 on identical code** — 1.5 points apart,
  purely from that drift. A yardstick that moves under the thing it measures is
  worse than the defects it exists to find.

A probe's own measurements are unaffected either way: the corpus snapshot is
resolved **before** any write, and a park is never in its own denominator.
`score-park.mjs` records the exact membership it used (`corpusStamp.scoringTime`,
by name + `sha256`) and `--corpus=<stamp.json>` pins it, so every park in a wave
can be scored against a provably identical corpus.

### `--name` CANNOT SPEAK FOR ANOTHER PARK (2026-07-27)

Opt-in publication shrank the corpus hazard but did not close it. A park's
**identity is its source path**; `--name` only chooses two output *locations* —
`shots/<name>/` and `signatures/<name>.json`. When the two disagreed, the name
won:

> `node probe.mjs samples/zzbase-a.tsx --name=skeleton-a` — a throwaway baseline
> copy, run while another agent was measuring — overwrote **both**
> `shots/skeleton-a/probe.json` and `signatures/skeleton-a.json`, rewriting the
> signature's own `park` field to point at the scratch file. A scratch park
> impersonated a corpus entry and the real `skeleton-a` measurement was destroyed.
> Nothing said a word; it was caught only because a third agent happened to
> `diff signatures/`. (Precedent: five near-identical copies of `worlds-ref` were
> forked into the corpus across four waves by the same `--name=` mechanism — see
> the de-duplication note in `corpus.mjs`.)

`probe.mjs` now **refuses, before it bundles anything**, when `--name` would write
over a measurement that belongs to a different source file:

| guard | fires when | applies to |
|---|---|---|
| `shotsConflict` | `shots/<name>/probe.json` records a different `parkSource`, **or** `signatures/<name>.json` records a different `park` | **every** `probe.mjs` run (that write is unconditional) and every `eval.mjs` run — `eval.mjs` fills the same directory with PNGs and then prints a score off the `probe.json` in it, so a foreign `--name` there scores the wrong park under this park's name |
| `signatureConflict` | `signatures/<name>.json` exists and its `park` is a different file | `--signature` runs only |

Both print the **stored** path and the **probed** path and exit non-zero. The
deliberate opt-outs are `--reassign-shots`, `--reassign-signature`, or
`--reassign` for both; a reassigned signature is stamped with `reassignedFrom`,
so it can never be mistaken for a normal refresh afterwards. Nothing is ever
silently overwritten.

Two details that matter:

* **The `shots/` guard fires without `--signature`**, because `shots/<name>/probe.json`
  is the only stored copy of a park's `layoutRaw` and `resign.mjs` rebuilds that
  park's corpus signature from it. A clobbered shots directory does not just lose
  a measurement, it primes the corpus to be re-signed from the wrong geometry.
  Refusing (rather than quietly writing elsewhere) is the right behaviour because
  the directory name is a **key**: `score-park.mjs`, `eval.mjs`, `resign.mjs` and
  `probe-layout-thresholds.mjs` all look measurements up by it, so a diverted
  write would leave every reader still consuming the impostor.
* **A conflict that appears mid-run does not throw the measurement away.** The
  pre-flight gate runs before a ~2-minute render, but `shots/` and `signatures/`
  are shared and mutable. If another process takes the name while this probe is
  in SwiftShader, the completed report is written **beside** the incumbent as
  `probe.CONFLICT.json`, nothing is overwritten, and the run exits non-zero.
  `saveSignature` re-checks at the write too, and a `--signature` run whose
  publication was refused exits non-zero even though its `probe.json` is good.

**Provenance, so this is detectable after the fact.** `probe.json` carries
`parkSource` (resolved source path), `probeName` and `probedAt`, stamped *before*
any gate can bail out — so even a `probe.UNMEASURED.json` says where it came
from. A published signature carries `park` + `probeName` + `shots` (which
`shots/` directory holds the measurement it summarises, so `resign.mjs` stops
guessing that a name is a path).

```sh
node corpus.mjs --audit          # every signature: source on disk? scratch? duplicated?
node corpus.mjs --audit --json   #   ...contradicted by the probe.json it re-derives from?
```

The audit **reports only — it never deletes a corpus entry**, because removing one
shifts every novelty distance and the axis-16 preset median. It errors on: a
record whose `name` disagrees with its filename, a `park` that is absent or not on
disk, a `park` that looks like a scratch/baseline/diagnostic copy (`zzbase*`,
`_scratch*`, `__*`, dotfiles, `*-diag`, anything under `out/`), two signatures
claiming the same `park`, and a `shots/<name>/probe.json` whose `parkSource`
contradicts the signature. It *notes* the legitimate cases so they are never
mistaken for defects: the four `fixture:control` sentinels, the name/file splits
(`w18-skeleton-b` ← `samples/skeleton-b.tsx`, `w18-skeleton-c`, `r12a` ←
`r12a-run.tsx`), and every report written before 2026-07-26, whose provenance is
**unknown rather than verified**.

Measured 2026-07-27 over the 30-entry corpus: **0 errors, 32 notes** — 4 fixture
sentinels, 3 name/file splits, 23 pre-provenance reports, 2 entries
(`w18-skeleton-b`, `w18-skeleton-c`) with no `probe.json` under their own name at
all, so `resign.mjs` silently skips them. No signature points at a missing file, a
scratch copy, or a duplicate; the `samples/zzbase-a.tsx` that caused the incident
is no longer on disk and nothing references it. `skeleton-a` is the first entry
whose measurement is provenance-**verified** rather than merely unchallenged.

| `evaltags.mjs` | the instrumented bundler (eval-tag injections + import preprocessor) shared by `eval.mjs` and `probe.mjs` |
| `lib.mjs` | plain (uninstrumented) bundler/page-opener used by `w7-check.mjs` — a probe run against this bundle reports "no `__evalPark` store" by design |
| `paths.mjs` | the one place `HERE` (this directory) and `REPO` (the design system) are defined |
| `layout.mjs`, `catalog.mjs`, `corpus.mjs`, `score-layout.mjs`, `fixtures.mjs`, `usage.mjs`, `calibrate.mjs` | scoring-axis support modules (layout uniqueness, ride/stall catalog, cross-park novelty corpus, calibration) |
| `RUBRIC.md` | the **16-axis**, 100-point scoring rubric and the pipeline command reference (it said 15 here until 2026-07-25 — axis 16 WORLDS has been in the rubric, and in `check-weights.mjs`'s assertion, since the world layer landed) |
| `samples/` | reference parks — see "Reference parks" below |
| `signatures/` | cross-park corpus signatures (layout/roster novelty). **Written by `probe.mjs` ONLY when `--signature` is passed — corpus membership is opt-in since 2026-07-26 (see "THE CORPUS IS OPT-IN" below).** A signature's IDENTITY is its `park` (resolved source path), not its `name`: `samples/skeleton-b.tsx` is stored as `w18-skeleton-b`. **A `--name` that would overwrite an entry belonging to a different `park` is REFUSED (2026-07-27)**, and `node corpus.mjs --audit` reports every entry whose `park` is missing, scratch-derived, duplicated, or contradicted by the `probe.json` it would be re-derived from |
| `shots/<name>/` | per-park output: `01..07*.png` (incl. `05b-nadir.png` and `06b-ground-close.png`), `console.log`, `probe.json` |
| `w7-check.mjs` | fast regression runner: mounts parks, reports `validatePark` verdict + `[Park]` lints, no screenshots |
| `probe-perf.mjs` | the `[Park] perf:` line for one or more parks and nothing else — draws / triangles / fps / CPU frame ms / **JS heap** / **validatePark wall-clock ms** / active lights / runtime entries. `eval.mjs` makes you pay for eight SwiftShader screenshots to see it and `w7-check.mjs` closes the page before the timer fires. Written 2026-07 for the 192 → 128 rescale |
| `probe-ground-mat.mjs` | reads the TERRAIN GROUND MESH's material back out of a live park page — is the turf map actually bound, at what repeat/colour-space, with what colour multiplier and bump scale — plus a histogram of the generated turf canvas and a sample of the vertex colours. Written 2026-07 during the grass rework: "the render still looks like a flat fill" has two completely different causes (map not applied vs map applied and too weak) and a screenshot cannot tell them apart |
| `probe-boulevard-avoid.mjs` | PURE regression probe (no browser) pinning `boulevardPlan({ avoid })` — the `.map(snapXZ)` index bug that made `avoid` a silent no-op. Exit 0 = pass |
| `probe-sim-reach.mjs` | how far the FIRST ride's queue tail can sit from the gate and still complete a cycle in the smoke window — the measurement behind `rules/park-generation.md` §0.3's GATE PROXIMITY rule. Pure sim, no browser |
| `probe-board-quiet.mjs` | **WHEN DOES A RIDE LEAVE THE STATION? (2026-07-28)** The behavioural probe behind the BOARDING-QUIET departure rule (`GameManager/rideFsm.ts` `waitingForPassengers`, `GameManager/Context.md` "THE DEPARTURE RULE"). No browser: the real `createGameManager` on a hand-built street graph, stepped at dt = 1/30 and sampled EVERY step, because a state transition is one step wide. Per ride, per cycle it reports first-boarding→departure, last-boarding→departure, the gap BETWEEN boardings, riders per departure, cycles and riders per sim-minute, which deadline ENDED the dwell (full / quiet window / `maxWait` cap / empty queue), and the invariant that must never break: **a ride departing while a guest is still in `enteringRide`** (mid-doorway, one step from being a rider) — exit 1 if it ever does. Five scenarios: a trickle-fed flat ride, a busy one, a crowded one, one behind a 30 u queue lane (the pathology that anchored `maxWait` on the first boarding instead of the train's arrival) and the 4-platform monorail graph from `probe-monorail-transfer.mjs`. **`--legacy` restores the pre-2026-07-28 condition IN MEMORY at bundle time** (an esbuild `onLoad` rewrite, asserting each anchor — nothing under `mp3d/` is written), so the before/after stays reproducible. It also replicates `validatePark`'s **queue-stall detector** exactly (same 0.5 s sampling, same reset-on-observed-shrink rule) and prints the longest hold against the real `stallSecs`, importing `SIM_SMOKE_SECONDS` from `ParkBuilder` rather than restating it — that measurement is what recalibrated `stallSecs` from `max(30, maxDur + 15)` to `max(45, round(0.75·secs))`, after the wider smoke window turned a latent mis-calibration into a false `sim` FAIL on `arch-ref`. `--secs=` `--arrive=` `--guests=` `--only=` `--json` |
| `probe-archetype-bounds.mjs` | compiles the three published §4.0 coaster archetypes with the real `compileTrackPieces` and prints their LOCAL bbox (closure points included), growth direction in words, and the copyable LEGAL START RANGE per park size using the bounds guard's own `worstExt > half + margin` arithmetic — raw and snapped inward to the 1.2-u lattice. Written after a round-10 park put §4.0-A at `x = −90` on a 192 assuming the ring grows +x (it grows −x), fataled the compile and lost the ride. `--sizes=` `--margin=` `--cell=` `--json` |
| `probe-skeleton.mjs` | **THE OFFLINE LAYOUT LOOP (2026-07-26) — ~2 s instead of `probe.mjs`'s ~2 min, and IT IS NOT THE GATE.** No browser: it bundles the park for NODE behind a `document.createElement('canvas')` shim, calls a `__netdump()` the park exports, and reports (a) axis 15 through the real `layoutMetrics`/`signatureOf`/`scoreLayout` + the `signatures/` corpus distance, (b) `parkComposition` UNGUARDED vs GUARDED — `terrainSeed`, `probesTried`, both water centroids and **how far the guard list MOVED them** (§5c's re-compose, the AUTHORITY that the §1-W box sieve only pre-filters for) plus `report.reliefFloor`, (c) the BUILT heightfield through the real `buildTerrain`, so ground height / composed dryness / **peak-bump contribution (> 0.75 = a `terrain` FAIL)** at every cell the park PAVES or STANDS ON, (d) `solvePathHeights` + `<Paths>`' own span audit — `pathY`, per-node ramps, worst span lift (> 1.0 `causeway`, > 2.0 REFUSED), spans crossing water, (e) `worldsTouched` on an ESTIMATED ring bbox. Every module-scope `throw` in the park is rewritten to a collected lint on a temp copy, so one failing assertion does not hide the numbers that would fix it. **It cannot run `validatePark`** — no `footprints`/`blockers`/`corridor`/`accessibility`/`padOnStreet`/`plantedInWater`/`crossTheme`, no GameManager lanes, no registration, no spline legality, no render; `skeleton-b`'s first `probe.mjs` run returned 8 failures this tool reported as 0. Its plot metrics are approximations (it has no manager access-spur nodes) and its `setPieces[].bbox` is the plan footprint not the mounted group, so `gridRegularity` reads slightly HIGH — the safe direction. **Iterate here, then always finish with `preflight` + `typecheck` + `probe.mjs`.** `--exclude=` `--terse` `--json`. Opt a park in by exporting `__netdump()` — worked copy in `samples/skeleton-b.tsx` |
| `probe-guard-stability.mjs` | **IS THIS PARK'S SEED GUARD-STABLE? (2026-07-25)** No browser: it calls the park's default export as a function, walks the element tree for the real `<Terrain keepDry/coasterPts>`, and re-composes at the park's OWN size — unguarded `probes`, GUARDED `probes`, post-clamp violations, clamp-disc count, and how many of 12 REALISTIC one-cell `keepDry` edits move the landform identity (`mv`, the column RUBRIC.md's baseline table publishes). Written after a corpus-wide seed audit found the §1 `probes` column being read two ways it does not support: **`probes` is SIZE-dependent** (seed 7 temperate is `probes 18` at 128 and `probes 1` at 48, and four "fragile" samples are size-48 parks), and **a high `probes` is not guard fragility** (`seedcheck-s1-192` is `probes 17` guarded AND unguarded, same landform, 0 clamps). Also prints the climate ACTUALLY used, which is how `worlds-ref` — `<Park seed={7}>` with no `climate` — was found to compose `climateOf(7)` = desert. `--seeds=` `--climates=` to shop for a better row BEFORE re-seeding |
| `probe-buildable.mjs` | per-(seed, climate) buildable land at a given size (dry + `flatEnough` + peak keep-out), quadrant occupancy and area within 20/48/75 u of the gate — the measurement that retired §0.3's "3 of 4 quadrants" check |
| `probe-layout-thresholds.mjs` | **the measurement behind axis 15's DISTRICT and PLOT numbers (wave-10).** No browser: it re-derives them from the stored `probe.json` `layoutRaw` of every park in `shots/` plus the `fixtures.mjs` controls. §1 the single-link MERGE LADDER (intra-district ride gaps vs inter-district jumps, i.e. what a clustering cut has to separate, and the old/new cut side by side); §2 the largest MUTUAL separation k district centres can reach inside §0.3's gate-reach band once each is given its footprint — the measurement that refutes an 80-u separation floor (at 192 k=3 tops out at 75.0 u; at 128, 66.5 u against a 32.66 u floor); §3 the `plotUtilisation` CEILING for a park confined to that band, against the 0.70 threshold. **`--size=` (default 128) — sections 2 and 3 were hardcoded to the retired 192 default until 2026-07-25, and the geometry is not scale-free: the gate sits at `1.2·round((S/2 − 0.8)/1.2)` and §0.3's reach is a fixed ~75 u, so at 192 the band stops at z = 19.8 (two quadrants empty, ceiling 0.722) but at 128 it runs to z = −11.4, past the mid-line (all four quadrants reachable, ceiling 0.930).** `--ladder` `--feasible` `--plot` `--size=` |
| `resign.mjs` | RE-DERIVE the stored `signatures/*.json` layout signatures from the stored probes when a layout THRESHOLD changes, instead of re-rendering every park. Two of the 29 signature dimensions are `districts.count` / `maxSeparation`, so a district-threshold change silently leaves the corpus comparing old-ruler vectors with new-ruler ones. Never CREATES a corpus entry (that is `probe.mjs`'s job — it changes every other park's novelty). Since 2026-07-27 it looks the probe up by the signature's own `shots` field (a name is not a path) and **REFUSES** to re-sign from a `probe.json` whose `parkSource` disagrees with the signature's `park`. `--write` |
| `typecheck.mjs` | **the STATIC TYPE GATE (wave-9).** `tsc --noEmit` over a sample park + its plan module, with the design-system specifiers rewritten by the same `preprocessParkSource` the bundler uses. Reports ONLY diagnostics in the park's own files (DS diagnostics are a footnote). Exit 1 = the park has type errors, which ARE defects — esbuild strips types without checking them, so a round-8 park declared `Array<{position, shape}>` and filled it with 48 TUPLES: all 48 trees got `position: undefined` and nothing complained. Run it BEFORE burning a browser run: `node typecheck.mjs samples/x.tsx` / `--all` / `--ds` (runs `preflight.mjs` per file first and skips `tsc` for a file that fails it) |
| `preflight.mjs` | **the FAST PRE-BUNDLE LINT (wave-10) — run this FIRST, it is milliseconds.** Resolves every local component import in the park file (+ any sibling plan module it imports) against the components that ACTUALLY EXIST under `mp3d/components/` on disk right now — never a hard-coded list — and fails fast, one line per problem, naming the missing component, the importing line, and a remedy. Written after a park imported `BrassworkFoundry`/`PulseDistrict`/`ThornwickGlade` (three of the five prefab "land macro" components deleted in v6.0): esbuild refused the whole bundle and the round scored 0/100 with 0 screenshots, no `probe.json`, no `validatePark` line, and a raw esbuild dump that took a human-visible chunk of time to diagnose. The five deleted lands (`BrassworkFoundry`/`PulseDistrict`/`ThornwickGlade`/`EmberfallCaldera`/`TidewaterHollow`) get a specific remedy (build the world from a themed set-piece plan + that world's own rides/stalls + its surviving `*Scenery` pack, rules §3.1); any other missing component gets a generic one. Also flags a `<Coaster>`/`<TrackRide>` `pieces` prop cast through `as unknown as string[]` (pieces is `TrackPiece[]`; plain `as any` is NOT flagged) and an authored `ratings={{ ... }}` with no `rateCoaster(` call anywhere in the file (transcribed, not measured). `eval.mjs` and `probe.mjs` both call this before bundling and refuse to launch esbuild/a browser on failure. Standalone: `node preflight.mjs samples/x.tsx` (exit 0 clean, 1 = problems) |

Run the full pipeline on a park:

```sh
cd rct2-design-system/harness/park-eval
node preflight.mjs samples/demo-ref.tsx      # FAST import/cast/ratings lint — run this FIRST
node eval.mjs      samples/demo-ref.tsx      # 8 PNGs + console.log -> shots/demo-ref/
node probe.mjs      samples/demo-ref.tsx      # probe.json (numeric scene report)
node probe.mjs      samples/demo-ref.tsx --signature   # ...and JOIN the novelty corpus (opt-in)
node probe-skeleton.mjs samples/skeleton-b.tsx # OFFLINE layout/water/terrain loop (~2 s) — NOT the gate
node calibrate.mjs [--save] [--matrix]        # axes 15 + 16 over the signatures/ corpus
node check-weights.mjs                        # assert RUBRIC.md's 16 axis weights sum to 100
node seed-table.mjs                           # regenerate rules/park-generation-composition.md §1 at size 128
node seed-table.mjs --sweep --json            # the 24-seed x 4-climate sweep (water budgets, §0.10)
node probe-boulevard-avoid.mjs                # pure regression probe: <Boulevard> `avoid` really blocks
node probe-sim-reach.mjs                      # gate->tail walking bound (§0.3 GATE PROXIMITY)
node probe-board-quiet.mjs [--legacy]         # ride DEPARTURE timing / riders per departure (A/B)
node probe-buildable.mjs                      # buildable land / quadrant occupancy (§0.3 spread check)
node probe-archetype-bounds.mjs                # §4.0 archetype local bbox + LEGAL START RANGE (128 / 48)
node probe-layout-thresholds.mjs              # axis 15 district cut/floor + plotUtilisation ceiling
node corpus.mjs --audit                       # SIGNATURE PROVENANCE: missing/scratch/duplicate/contradicted entries
node resign.mjs [--write]                     # re-derive signatures/ after a layout threshold change
node typecheck.mjs samples/demo-ref.tsx       # STATIC type gate — run this FIRST, it is seconds
```

`typecheck.mjs` needs `typescript` + `@types/react` + `@types/three` in
`park-eval/node_modules` (added to this directory's install step; it prints the
`npm i` line if they are missing).

**BIG-PLOT NOTES (the `<Park size>` default is 128 since 2026-07; it was 192).**
A 128 park mounts a 284² terrain mesh under swiftshader (192 mounted a 427² one)
and still takes tens of seconds to minutes, so `openParkPage` allows a 240 s
navigation and a 180 s settle window (`PARK_NAV_MS` / `PARK_SETTLE_MS` override
both) — the old 30 s puppeteer navigation default failed outright. **BOTH
harnesses honour those two variables**: `park-eval/lib.mjs`, `park-eval/evaltags.mjs`
AND `mp3d-render/lib.mjs` (the last one was fixed in 2026-07, along with a
dual-React resolution bug in the same file that rendered every page as a BLANK
CANVAS — see the SINGLETONS note in that file). `eval.mjs`'s topdown frames the
WHOLE plot (`parkSize · 1.7`, past `orbitRadiusFor`'s deliberate big-plot
compression) and temporarily lifts the scene fog + camera far plane for that one
shot, because `fogRangeFor(128)` puts the haze wall at 109-237 u and a full-plot
topdown from 218 u up would otherwise render as flat fog. `05b-nadir.png` is the
shot to check composed coordinates against: azimuth 0 / elevation 89, so world
+x is screen RIGHT and world +z is screen DOWN (the gate edge). `06b-ground-close.png`
(added 2026-07) is the EYE-LEVEL shot — radius ~22 u, elevation 4 — and is the
only one that judges ground MATERIALS rather than the middle distance.

### mp3d-render/

| file | purpose |
|---|---|
| `render.mjs` | bundle ONE component's `.previews.tsx`, screenshot it (optionally orbited/night-toggled) |
| `check-all.mjs` | esbuild-bundle every component's previews file, no browser — fast sanity pass over the whole catalog |
| `check-some.mjs` | same, for an explicit component subset |
| `lib.mjs` | shared bundler/page-opener (same shape as `park-eval/lib.mjs`) |
| `probe-render-cost.mjs` | **WHERE A PARK'S FRAME GOES (2026-07-27).** Mounts any park (`--park=<ABSOLUTE .tsx>` `--export=`; resolves `./components/…` like `lib.mjs`), waits for the verdict, then **polls `stats()` until the draw/triangle counts stop moving** and only then measures — every number from an explicit `renderer.render()` with `renderer.info` reset immediately before, inside ONE synchronous `page.evaluate` so no rAF can interleave. Reports the full frame vs the colour pass vs the **shadow depth pass** priced separately; a LIT/DARK light census; `lodDetail`-tagged vs actually-SHED (the direct answer to "is the park runtime's LOD firing?"); per-runtime-entry attribution by **hide-and-render delta** (authoritative — it prices exactly what the renderer skips) cross-checked against a static geometry walk; `--drill=<i,j>` for one level deeper; and an **in-page A/B** of candidate optimisations applied and reverted on the live scene. `--rounds` `--frames` `--no-ab` `--top` `--json` `--save=` |
| `probe-perf-budget.mjs` | **THE PERF PASS/FAIL GATE (2026-07-27).** 6 assertions, exit 1 on any failure, each naming the defect it catches: dark lights culled, `stats()` agrees with an independent `renderer.info` read, `fps` is honest against `frameMs`, the park's own `[Park] perf:` line agrees with the settled park, and SETUP.md §13's ~3000-draw / ~2.5M-triangle reference points. Verified to fail: with `darkCull.tick(dt)` commented out of the Stage loop it reported `FAIL darkLightsCulled 21 of 24 …` and exited 1 |
| `probe-reef-water.mjs` | **WHERE IS THE WATERLINE IN ReefRacer'S LAGOON?** No browser: builds the component for node behind a canvas shim with the previews' flat ground and then MEASURES BY RAYCAST rather than by re-deriving the component's own arithmetic — the sheet's plane and its DISPLACED surface (a baked shore dive means the surface is not one plane), the sand top on a grid tagged by `userData.sand` (every sand class is the same white `mat()` + texture, so colour cannot tell them apart), the exposed-floor area and depth distribution, the shore band per azimuth, and every reef item as submerged/awash/PROUD. `--json` `--rays=N` `--src=<index.tsx>` (probe a DIFFERENT copy — how a pre-change baseline is measured with the same ruler instead of trusting remembered numbers) |
| `probe-ots-water.mjs` | the same ruler pointed at **OceanTunnelSlide**, plus two questions that component needed: a `drawnOver` breakdown (WHICH sand class the sheet is drawn over, and how far under the surface it is — `dry`/`spit` appearing there at all means the lagoon is painted across its own beach) and a **depth SPREAD** (p90 − p10; 0 = one flat depth everywhere = a painted disc). It found the sea slide's bed seated 65 mm UNDER the host's own opaque surface, i.e. invisible, which was the whole of "the water reads as fake". Same flags |
| `probe-*.mjs`, `validate-react-park.mjs` | assorted scene/canvas/seed probes used during earlier waves |
| `shots/` | per-component screenshots |

#### `validate-react-park.mjs`'s `[STATS]` LINE IS NOT A PERF MEASUREMENT

It reads `canvas.__stageApi.stats()` at whatever instant its `__parkReport` poll
happens to return, and a park keeps growing for **~15 s past `onReady`** — the
build queue drains, AUTO-keepDry rebuilds the terrain, and the gate stream keeps
admitting guests (DemoPark asks for 10 and settles at 22, at 13 draws each). Three
runs of the *same deterministic park* on 2026-07-27 reported **1172, 1854 and 1780
draws**. Nothing was wrong with the park; the sample was taken at three different
stages of its assembly. Two further traps in the same line, both fixed in the
design system on 2026-07-27 but worth knowing when reading older reports:

* **`fps` could not read below 10.** It averaged `1/dt` over the Stage loop's
  CLAMPED dt (`min(dt, 0.1)`), so a park rendering at 1.4 real fps reported
  "13.6 fps" — and *every* perf figure quoted in this project came off that
  field. It is `1 / mean(unclamped dt)` now. `frameMs` was always honest.
* **`frameMs` is a 20-frame EMA**, so a reading taken seconds after mount is
  still dominated by the build-phase frames and reads 2-3x the steady state.

Use `probe-render-cost.mjs` (explains) or `probe-perf-budget.mjs` (asserts) for
anything you intend to compare against another number.

Run the component sanity pass:

```sh
cd rct2-design-system/harness/mp3d-render
node check-all.mjs
node render.mjs FerrisWheel --night --angle=40
node probe-render-cost.mjs                    # where DemoPark's frame goes (minutes)
node probe-perf-budget.mjs                    # perf pass/fail gate (exit 1 on regression)
node probe-cork.mjs                           # SplineCoaster byte-for-byte fingerprint
```

## Reference parks (`park-eval/samples/`)

**Their MEASURED baselines — verdict, exact lint kinds, draws, tris, park size
and per-axis scores — live in one place: `park-eval/RUBRIC.md`'s REFERENCE-PARK
BASELINE TABLE, re-measured 2026-07-25. Do not score a round against numbers
quoted anywhere else.**

Four sample parks were lost with `/tmp/park-eval`: `demo.tsx`,
`broadmoor.tsx`, `setpiece-demo.tsx`, `arch-w6.tsx`. Restoration status,
method, and honesty about what could NOT be recovered:

| lost file | restored as | method |
|---|---|---|
| `demo.tsx` | `demo-ref.tsx` | **(a) DS source, verbatim.** Imports `DemoPark` directly from `components/Park/Park.previews.tsx` — the in-repo size-16 JSX-composed worked example the design system itself ships and validates (`validatePark ok: true`). Fixed a bug from the prior reconstruction pass: it had rendered `previews.previews[0]`, which is actually the OTHER preview in that file (`DistrictPark`, size 48) — the docstring always said DemoPark, only the array index was wrong. Now imports `DemoPark` by name so it can't drift again. |
| `broadmoor.tsx` | **NOT RECOVERED** | Searched (a) DS previews/composition source, (b) git status/stash/log (the harness was never committed; `rct2-design-system/` is untracked), (c) filesystem for stray `*.tsx` mentioning `<Park` outside the repo/`/tmp` — nothing found. The name surfaces exactly once, in `mp3d/rules/park-generation.md`: *"the size-48 reference park `broadmoor` runs the legacy rect h 1.0 shifted by (+12.0, −14.4) into the back-east meadow, full gate green."* That is a single design-rule citation about one archetype-translation decision, not the park's full composition — not enough to reconstruct the file faithfully. `district-ref.tsx` (below) is a real, verified size-48 park from the same docs, but nothing ties it to the "broadmoor" name, so it is offered as a bonus reference, not a broadmoor substitute. |
| `setpiece-demo.tsx` | `setpiece-ref.tsx` | **(a) DS source, adapted.** `SetPieceKit.previews.tsx` only previews the three set-pieces standalone (via `<ScenePreview>`, no `<Park>` wrapper) — there is no previews file that composes a full park from them. This file was built by hand from the DS's own building blocks (`buildParkNet`, `fountainPlazaPlan`/`bazaarPlan`/`boulevardPlan`, `FountainPlaza`/`Bazaar`/`Boulevard`) following the same port-to-port wiring contract the previews file demonstrates, wrapped in `<Park>` with a gate spur and two flat rides tailed onto the fused net. This is a faithful reconstruction of the *pattern*, not a byte-for-byte recovery of the original file. |
| `arch-w6.tsx` | `arch-ref.tsx` (primary) + `arch-ref-legacy.tsx` (alternate seed) | **Reconstructed from design-system rules docs, not previews-derived.** `rules/park-generation.md` publishes the §4.0-A THRILL steel-rectangle archetype's exact piece list verbatim ("Publish-and-copy — don't re-derive"), which both files copy exactly. The original file's seed/biome is unknown, so two candidate reconstructions exist: `arch-ref.tsx` (seed 7, temperate) and `arch-ref-legacy.tsx` (seed 5, alpine) — each re-probed for its own water placement rather than trusting the seed table (a documented round-7 failure mode). Treat `arch-ref.tsx` as primary; `arch-ref-legacy.tsx` exists because the exact original seed could not be confirmed. |

Also in `samples/`: **`grass-check.tsx`** — a TERRAIN-ONLY visual probe (no `<Paths>`, no `<GameManager>`, so it reports the "no GameManager" failure by design). It mounts `<Park>` with NO `size`, so it is always whatever the current default plot is, and its one job is to let terrain/grass work be judged BY LOOKING with nothing else in frame. Added 2026-07 with the grass rework.

Also present in `samples/` but **out of scope** for this restoration (not one
of the four requested files, and not needed per the round-7/8 record):
`cinder-peak.tsx` (a separately-tracked wave-7 evidence park — **re-probed
2026-07-25 and it now FAILS `validatePark` with 40 failures, headed by
`latticeInWater` ×4: the composed water moved under its hand-authored path
lattice. It is a REGRESSION FIXTURE now, not a clean reference — see
`RUBRIC.md`'s baseline table**) and
`district-ref.tsx` (the bonus size-48 reference described above). The
round-6/7 evidence parks `alder-grove`, `obsidian-falls`, `willowmere` are
confirmed **not recoverable** and are not needed — their scores and defect
lists are already recorded elsewhere.

## Known harness gotchas

- **Screenshots are the expensive part, and they can time out under load.**
  `eval.mjs` shoots 8 angles through SwiftShader; when the machine is busy
  (another agent session running its own browser runs, say) `Page.captureScreenshot`
  can exceed puppeteer's protocol timeout and the whole run dies AFTER the park
  has already validated — with no `console.log` written. If you only need the
  verdict + lints, use `w7-check.mjs` (no screenshots) and give it a long
  `W7_WAIT`; a 48-park needs tens of seconds of settle under contention, a
  128-park tens of seconds to minutes.
- **`w7-check.mjs` reports `ok:false` for a park that never printed a verdict**,
  which under contention can mean "the settle window expired", not "the park
  failed". `<Park>` always emits the `[Park] validatePark → …` line when it
  reaches the settle effect (wave-9), so no line at all = it never got there.
- The stall eval tag used to read only the sibling `name` prop and so reported
  `register={{ name }}` stalls as catalog-default-named. Fixed (wave-9); the
  DESIGN SYSTEM was always right, the probe was lying.

## Verification

`node eval.mjs samples/demo-ref.tsx && node probe.mjs samples/demo-ref.tsx`
was run end-to-end from this persistent location as part of the migration;
see the migration report for the numeric results (park size framing,
`notes: []`, `rideRoster`/`stallRoster`/`layout` population, night-shot
`nightK`).
