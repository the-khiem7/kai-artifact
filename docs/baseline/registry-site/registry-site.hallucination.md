---
baseline_schema: "3.0"
pack: "registry-site"
document: "hallucination"
status: "active"
updated: "2026-11-19"
code_ref: "uncommitted"
---

# registry-site - decisions and open questions

## Entry index

| ID | About | Status | Related |
|---|---|---|---|
| RS-D1 | Two content types at the root, documents rendered as pages | closed | RS-D5 |
| RS-D2 | Home page built with Astro, old template and AGENTS.md limits dropped | closed | RS-D3 |
| RS-D3 | Constellation visual identity replaces the k/ monogram | closed | RS-D2, RS-D4 |
| RS-D4 | kai-dock overlay injected into published artifact copies | closed | RS-D3 |
| RS-D5 | One project skill, knowledge-distill | closed | RS-D1 |
| RS-D6 | build_site.py stays the single validator, README and manifest generator | closed | RS-D2 |
| RS-D7 | Lesson: checker accepted frontmatter that real YAML rejects | closed | RS-D5 |
| RS-D8 | Lesson: the hidden attribute lost to display flex | closed | - |
| RS-Q1 | Where artifact topics live: keywords meta or a sidecar | open | RS-D6 |

## Open questions

### RS-Q1: Where do artifact topics live?

- Question: the home map links pages by shared topics, and artifacts had no topic data. Seven `artifacts/*/index.html` files each got one `<meta name="keywords">` line, which contradicts the earlier plan line that `artifacts/**` stays untouched.
- Options: keep the meta line in each artifact (self-describing, travels with `publish.py`), or a sidecar `site/topics.json` mapping slug to topics (artifact sources stay unedited, topics drift from the page).
- Recommendation: keep the meta line - a new artifact then carries its own topics with no second file to update. [agent]
- Cost of no answer: none now, the seven files already carry the line and the build reads it.

## Closed decisions

### RS-D1: Two content types at the repository root, documents rendered as site pages

- Decision: `artifacts/` holds HTML pages and `documents/` holds flat markdown notes; each `documents/<slug>.md` is published at `/kai-artifact/docs/<slug>/`. The user decided this on 2026-11-19 (repo vision, G1 render as pages, G2 move all 6 notes). [user]
- Why: the notes are source material for later artifacts and should be readable on the site, not only in git. [user]
- What breaks if ignored: notes left in `.temp/` are untracked and invisible to the site.
- Rejected: render documents only in the repo, not on Pages - declined by the user. [user]
- Rejected: keep the notes in `.temp/knowledge/` until reviewed - declined by the user in favour of moving all six. [user]

### RS-D2: Home page is an Astro project and the old template and AGENTS.md limits no longer bind

- Decision: `site/` is an Astro project that replaces `site/template.html`. The user approved the plan on 2026-11-19 and said the old `AGENTS.md` constraints (standard-library Python only, plain signature, no themed metaphor) must not limit the redesign. [user]
- Why: documents need markdown rendering, and the redesign needs components, page transitions and bundled libraries; hand-writing a markdown renderer in standard-library Python was the alternative. [user]
- What breaks if ignored: reverting to the template leaves documents unpublishable.
- Rejected: keep Python plus CDN scripts - markdown would be hand-written and runtime scripts unpinned. [agent]
- Rejected: Eleventy - weaker component and transition support than Astro. [agent]

### RS-D3: Constellation identity replaces the k/ monogram signature

- Decision: every artifact and document is a star, shared topics are the lines; one four-star glyph is the mark in nav, favicon, og image and dock; gold marks artifacts, teal marks documents. The user asked on 2026-11-19 for a creative icon not bound to `k/`. [user]
- Why: a single mark that also acts as the dock icon ties the site and the injected controls together. [agent]
- What breaks if ignored: a leftover `k/` mark in `og.html` or the favicon makes the site look half-migrated.
- Rejected: keep IBM Plex, teal and the `k/` monogram - the user lifted the limit. [user]

### RS-D4: kai-dock is injected into published artifact copies and never edits sources

- Decision: `build_site.py site` appends `<script src="<base>/assets/kai-dock.js" data-slug=... defer>` before `</body>` of each copy in `_site/`. The dock is a custom element with a closed Shadow DOM. The user chose on 2026-11-19: full panel (home link, current title, newer and older artifact, topic chips linking to `/?topic=<t>#library`, copy link), no theme control, always-visible collapsed icon, artifacts only; icon is the constellation glyph. [user]
- Why: artifacts have their own layout and cannot sit in the Astro shell; the overlay adds navigation without touching their content. Each artifact owns its theme storage key (`terraform-training` uses `tf-theme`), so the dock only follows it. [user]
- What breaks if ignored: a dock that sets `data-theme` desynchronises the artifact's own toggle; a dock without Shadow DOM inherits artifact CSS.
- Agent addition, not ruled on: the dock picks the first free corner among bottom-right, top-right, bottom-left, top-left that overlaps no fixed or sticky element, unless `<meta name="kai:dock">` says otherwise. Added because at 390px `ecommerce-on-aws` and `signalscout-prod-architecture` have a bottom bar that sat under a fixed bottom-right dock. [agent]
- Rejected: iframe wrapper page - changes already-shared URLs and breaks text-fragment links and full-screen layouts. [agent]
- Rejected: editing artifact sources to add controls - drifts and pollutes content. [agent]
- Rejected: auto-hide on scroll, and the same dock on document pages - declined by the user. [user]

### RS-D5: One project-scoped skill, knowledge-distill

- Decision: the dump-to-notes workflow is one skill at `.claude/skills/knowledge-distill/` with `distill` and `verify` modes, plus `scripts/check_notes.py`. The user chose one skill on 2026-11-19. [user]
- Why: one entry point keeps the pipeline (read, brief, ask, write, verify, check, report) in one place. [user]
- What breaks if ignored: notes that skip the checker reach the build, which runs it and fails.
- Rejected: two skills (distill plus verify) and three skills (plus doc-to-artifact) - declined by the user. [user]

### RS-D6: build_site.py stays the single validator, README generator and manifest writer

- Decision: `scripts/build_site.py` keeps validation, the README tables and a `manifest` command that writes `site/public/assets/registry.json` (gitignored); `site` runs `check_notes.py`, the manifest, `npm run build`, then copies artifacts with the dock injected. [agent]
- Why: `scripts/publish.py` imports `build_site`, so slug, reserved-slug and metadata rules stay shared with CI. [agent]
- What breaks if ignored: duplicated rules let `publish.py` accept a page the CI build rejects.
- Rejected: move validation into the Astro project - `publish.py` could no longer reuse it. [agent]

### RS-D7: Lesson - the note checker accepted frontmatter that real YAML rejects

- Mistake: `check_notes.py` parsed frontmatter as `key: value` lines, so unquoted `description: a: b` passed; the Astro content layer parses real YAML and aborted the build.
- Why it looked reasonable: the six notes had passed the checker and the earlier format check.
- What disproved it: `astro build` failed with "Nested mappings are not allowed in compact mappings" at the `description` line.
- Fix: `title` and `description` are double-quoted in all six notes; the checker now rejects an unquoted value; `note-format.md` and `build_site.py` were updated to match. [agent]

### RS-D8: Lesson - the hidden attribute lost to display flex

- Mistake: library filtering toggled `card.hidden`, but `.card { display: flex }` overrides the user-agent `[hidden]` rule, so filtered cards stayed visible while the counter said "2 shown".
- Why it looked reasonable: `hidden` works on elements with default display.
- What disproved it: a Playwright screenshot of `?topic=serverless` showed all six cards.
- Fix: global `[hidden] { display: none !important; }` in `site/src/styles/global.css`. [agent]
