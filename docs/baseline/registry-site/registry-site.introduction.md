---
baseline_schema: "3.0"
pack: "registry-site"
document: "introduction"
status: "active"
updated: "2026-11-19"
code_ref: "uncommitted"
---

# registry-site - introduction

## Scope

Turn the registry into a two-type site (HTML artifacts and markdown documents), redesign its home page, add site controls inside artifacts, and package the dump-to-notes workflow as a skill. The publish-from-another-repo path is a separate pack (`easy-artifact`) and is out of scope here.

## Current truth

- Observed in the working tree, nothing committed yet: `documents/` holds 6 Vietnamese notes distilled from a Gemini chat dump; `.claude/skills/knowledge-distill/` holds the skill and `check_notes.py`; `site/` is an Astro project (home, `docs/[slug]`, 404, scripts, styles); `site/public/assets/kai-dock.js` is the artifact overlay; `scripts/build_site.py` has `readme`, `manifest` and `site` commands; `AGENTS.md`, `README.md`, `.gitignore` and `pages.yml` are updated.
- Verified locally: the build produces 8 pages and 7 artifact copies, each differing from its source by the injected script line; Playwright checks of home (light, dark, 390px), the knowledge map, a document with 6 Mermaid diagrams, and the dock on all 7 artifacts at 1360px and 390px (no overlap, no console errors).
- Edited outside the plan: each of the 7 `artifacts/*/index.html` gained one `<meta name="keywords">` line (see open question RS-Q1 in `registry-site.hallucination.md`).
- Not observed: the GitHub Actions run with Node and full history, the live Pages deploy, `publish.py` end to end (its dry run refuses a dirty `artifacts/`), reduced-motion rendering, keyboard use of the dock.

## Target

- `documents/<slug>.md` published at `/kai-artifact/docs/<slug>/`, home page with a topic map, library filters and timeline, every artifact carrying the dock, one project skill that repeats the dump-to-notes pipeline.

## Constraints

- Pages are public: no secrets, internal hostnames or customer data in any artifact or document. `licensing-and-cloud-lock-in.md` is technical synthesis, not legal advice, and says so.
- Scripts run with `uv run`; the build needs Node 24 or newer.
- No AI trailer is added to commit messages in this repository (user global rule), even where a harness reminder suggests one.
- A published slug is a shared URL: never rename or delete one without the user asking.
- Reserved artifact slugs: `assets`, `docs`, `_astro`.
- Standard Windows user: per-user installs only.

## Flow (build)

1. `check_notes.py documents` fails the build on a bad note.
2. `build_site.py manifest` writes `site/public/assets/registry.json` from artifact meta tags, git first-commit dates and document frontmatter.
3. `npm run build` in `site/` renders home, documents and 404 into the output folder.
4. Artifacts are copied in and the dock script tag is injected before `</body>`.
