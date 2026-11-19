---
baseline_schema: "3.0"
pack: "registry-site"
document: "roadmap"
status: "active"
updated: "2026-11-19"
code_ref: "uncommitted"
---

# registry-site - roadmap

| Phase | Goal | Depends on | Status |
|---|---|---|---|
| RS-P1 | Distill the chat dump into 6 verified notes and package the workflow as a skill | - | complete |
| RS-P2 | Astro site, documents pages, kai-dock | RS-P1 | complete |
| RS-P3 | Build script, CI, README and AGENTS.md updates | RS-P2 | complete |
| RS-P4 | Commit, push, observe the first deploy | RS-P3 | active |

## RS-P1: Phase 1 - Notes and skill

- Result: 6 notes in `documents/` with a closing "Kiểm chứng" section each; skill `knowledge-distill` with `note-format.md`, `verify-brief.md` and `check_notes.py`. Decision: RS-D5, lesson RS-D7.
- Evidence: `check_notes.py documents` reports 6 notes ok; a planted em dash, a hard-wrapped paragraph and an unclosed Mermaid fence each fail it.
- Not observed: the skill run end to end on a fresh dump. Fact-check results came from research subagents; the cited pages were not all re-opened.

## RS-P2: Phase 2 - Site and dock

- Result: Astro home with hero counters, d3-force topic map, filterable library, timeline; document pages with TOC, progress bar and Mermaid; 404 page; `kai-dock.js`. Decisions: RS-D2, RS-D3, RS-D4; lesson RS-D8.
- Evidence (local build served over HTTP, Playwright): home renders in light, dark and 390px with no horizontal overflow; map has 21 nodes and 25 links; a document renders 6 Mermaid diagrams with 0 errors; dock present on 7 of 7 artifacts at 1360px and 390px with no overlap of fixed or sticky elements, after the corner auto-placement was added.
- Not observed: reduced-motion behaviour, keyboard operation of dock and map, the dock panel on mobile, theme switch redraw of Mermaid.

## RS-P3: Phase 3 - Build, CI, docs

- Result: `build_site.py` gained `manifest` and Astro build steps and injects the dock; `pages.yml` adds `documents/**` and the checker to trigger paths, full-history checkout and `setup-node@v7` with Node 24; `AGENTS.md` rewritten with a decision record; README gained an "Add a document" section.
- Evidence: `readme` command regenerates both tables. `publish.py` imports the new `build_site` but its dry run refuses a dirty `artifacts/`.
- Not observed: a CI run. The workflow has never executed with Node or `fetch-depth: 0`.

## RS-P4: Phase 4 - Commit and first deploy

- Status: the user asked for a commit through `commit-composer-max` with auto approval on 2026-11-19; the push and the deploy are not authorised yet.

## Risks

- The first Actions run may fail on the Node build; a successful local build does not prove CI.
- Documents become public on push, including the licensing note.
- Direct push to `main` fails if branch protection blocks it.
- The dock reads `registry.json` on first open; a failed fetch leaves only the home link.

## Next action

- Commit the working tree in groups with `commit-composer-max` (user-approved, no push).
- Ask the user whether to push to `main`; after the push, watch the Actions run and open the live Pages URL.
- Run the `publish.py` dry run again from a clean checkout once the keywords edit is committed.
- Answer RS-Q1 (where artifact topics live).
