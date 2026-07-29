# Composing parks — §3.1-N why transcribing loses · the SET-PIECE CONTRACT

**ARCHIVED 2026-07-28 — the full text now lives in the repo at
`mp3d/rules-archive/park-generation-skeletons-b.md` and is no longer shipped to the design system.**

Reason: skeleton variants §3.1-N/Y/Z + the set-piece contract. `rules/*.md` is never injected into a generation — only
`rules/setup.md` and the conditionally-loaded skills reach the agent — but this
whole directory is what `get_design_guidelines` returns, and at 660 KB that one
call destroyed an agent's context. **`rules/setup.md` is the authoritative
manual**; it carries the corrected, measured version of everything that mattered
here.

Nothing was lost — read the archive copy in the repo if you need the detail.
