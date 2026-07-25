# skills-drafts — paste-ready Magic Patterns SKILLS

Four finished skills for the **RCT2 3D park** design system
(`ds-fbd20bf8-b16d-4cf1-8440-d20bc095fc4a`).

Magic Patterns skills are **conditional**: a skill's body is injected into a
generation only when the request matches its `description`. `rules/*.md` are
injected into **every** generation. That is why these four carry far more
procedural detail than the rules ever could.

**The MCP tools cannot write skills.** Each one has to be pasted by hand in the
web UI. That is the only manual step.

---

## What to paste, and in what order

Paste them in this order. It only matters because later skills reference
earlier ones by name, and the UI list reads better with the workflow first.

| # | Skill name (type it EXACTLY) | Body file | One-line purpose |
|---|---|---|---|
| 1 | `park-composition` | `park-composition/SKILL.md` | The end-to-end park workflow: composition order, `buildParkNet` as the mandatory street builder, the FountainPlaza/Bazaar/Boulevard set-pieces, districts, keepDry, off-lattice pads, validate to zero warnings. |
| 2 | `coaster-pieces` | `coaster-pieces/SKILL.md` | Copy a verified §4.0 archetype verbatim, pin `queueDir` with its heading and tail, translate rigidly in 1.2 steps, self-check against the published `rateCoaster` numbers. |
| 3 | `ride-and-stall-roster` | `ride-and-stall-roster/SKILL.md` | The under-used catalog rides and stalls to the same copy-paste standard — verified piece circuits, per-ride queue arithmetic, sale defaults, the Bazaar. |
| 4 | `park-troubleshooting` | `park-troubleshooting/SKILL.md` | The measured rounds 6-7 failure catalogue: every `validatePark` check and fatal lint with its threshold and its fix. |

### Steps

1. Open the design system in Magic Patterns → **Design System → Skills**.
2. **Add skill.**
3. Set the skill **name** to the value in the table above — it must match the
   `name:` field in the frontmatter exactly (lowercase, hyphenated).
4. Open the corresponding `SKILL.md` on disk and paste **the entire file,
   frontmatter included** (the `---` fences, `name:`, `description:`, `---`,
   then the markdown body). Do not paste the body without the frontmatter — the
   `description` IS the trigger, and without it the skill will never be
   injected.
5. Save, then repeat for skills 2-4.
6. **Publish the design system** once all four are saved, so generations pick
   them up.

---

## How to verify each one took effect

Skills are conditional, so "it appears in the list" is not proof. Each of
these has a distinctive behaviour it forces. Run the test prompt against the
published design system and look for the canary.

| Skill | Test prompt | Canary — the skill fired if you see this | It did NOT fire if you see |
|---|---|---|---|
| `park-composition` | "Build a temperate thrill park on the default plot with four districts." | `buildParkNet({ … })` and at least one of `fountainPlazaPlan` / `bazaarPlan` / `boulevardPlan`; `<Terrain keepDry={NET.keepDry}>`; set-pieces declared AFTER `<Paths>` | a hand-written `const NODES: [number, number][] = [...]` lattice with `KEEP_DRY = [...NODES]` |
| `coaster-pieces` | "Add a high-thrill steel coaster to this park." | one of the A/B/C piece lists verbatim, `heading={0}`, `queueDir={[1, 0]}`, a tail at `start.x + 6.0`, and **no `bank` prop** | an invented piece list, a `bank={…}` prop, or a tail 1-2 cells from the station |
| `ride-and-stall-roster` | "Give this park a monorail, a log flume and a shop row." | a named verified circuit ("Grand Circle Tour", "Big Chute") pasted as JSX piece children, plus `bazaarPlan({ stalls: [...] })` | `<Monorail>` with `lift`/`drop` pieces (they get stripped), or four hand-placed stalls |
| `park-troubleshooting` | "validatePark says `blockers` and `padOnStreet` — fix it." | `offPathCell(NET, …, { clear: 1.8 })`, and a fence split into two runs with a gateway gap | a pad nudged by an eyeballed 0.5 u, or "the auto-fix will handle it" |

If a canary is missing, the usual cause is the `description` line being trimmed
on paste. Re-open the skill in the UI and confirm the description still names
the trigger words (`buildParkNet`, `<Coaster>`, `Monorail`, `validatePark`).

---

## Relationship to `rules/park-generation.md`

The rules file stays the always-on layer (the fatal-warnings policy, the
archetype tables, the seed table, the canonical imports). These skills do NOT
merely restate it — as of writing they **correct** it in five places, and the
skills are the accurate copies:

1. **The queue-lane formula.** Rules §0.4 and the footprint table print
   `1.8 + 0.35×capacity + 0.35` (tail 3.55 at capacity 4). The code uses
   `front + laneLenOf(capacity) + 0.35` with
   `laneLenOf(c) = max(2.2, 1.1 + 0.56·c)` → **5.49** at capacity 4, front 1.8.
   The `laneTrim` lint in the source says so itself.
2. **`buildParkNet` and the set-pieces are absent from the rules entirely.**
   FountainPlaza / Bazaar / Boulevard / SetPieceKit exist, are documented in
   their own `Context.md` files and are the fix for the layout failures — but
   nothing in `rules/park-generation.md` mentions them.
3. **The round-7 placement API is absent.** `offPathCell` / `pathClearance` and
   the 1.8-u `PAD_OFF_LATTICE` rule ship in the code and `Park/index.tsx`
   points at a "rules §0.14" that does not exist yet; §0 still ends at item 13.
4. **The seed table's water coordinates are pre-guard** and the composition
   re-picks the body when your `keepDry` overlaps them. The rules present the
   table as if it were authoritative; the code adds `park.terrain.water` /
   `park.isDryCell` precisely because round-7 was misled by it.
5. **The water rides do not need the water body.** LogFlume, RiverRapids and
   PaddleBoats each build their own water; PaddleBoats on the real lake trips
   the wet-pad guard.

When someone updates the rules to cover items 2-3, re-check these skills for
overlap — the skills should keep the procedural detail and the rules keep the
policy.
