# AGENTS.md

This repository is a registry with two content types, both published by GitHub Pages: HTML artifacts at `https://the-khiem7.github.io/kai-artifact/<slug>/` and markdown documents at `https://the-khiem7.github.io/kai-artifact/docs/<slug>/`. Follow these rules for every change.

## Layout

- Two content folders at the repository root: `artifacts/` (HTML pages) and `documents/` (markdown notes). Never put content anywhere else.
- One artifact = one folder `artifacts/<slug>/`. Entry point is `artifacts/<slug>/index.html`. Required - the build fails without it.
- One document = one file `documents/<slug>.md`, flat, no subfolders.
- `<slug>` is lowercase kebab-case: `^[a-z0-9]+(-[a-z0-9]+)*$`. The build fails on any other name.
- Artifact slugs `assets`, `docs` and `_astro` are reserved: they are the home page's own paths. The build fails on them.
- The slug is the public URL. Never rename or delete a published slug unless the user asks - every link already shared breaks.
- The published artifact URL drops the `artifacts/` prefix: `artifacts/foo/index.html` is served at `/kai-artifact/foo/`.
- `docs/baseline/` is the internal baseline documentation pack, not published content. Do not confuse it with `documents/`.

## Artifact page content

- Every `index.html` has a `<title>` and a `<meta name="description" content="...">`. They are the artifact's name and description in the README and on the home page; a missing title falls back to the slug.
- Every `index.html` declares its language on the root element (`<html lang="vi">`, `<html lang="en">`). The home page shows the primary subtag as a chip (`VI`, `EN`).
- Add `<meta name="keywords" content="aws, alb, ...">` with lowercase kebab-case topics. Topics that two or more pages share become lines on the home page knowledge map; a page without keywords floats unconnected.
- Keep every asset (CSS, JS, images, data) inside the artifact's own folder and reference it with a relative path (`./style.css`). Never use root-absolute paths (`/style.css`) - the site is served under `/kai-artifact/`, so they resolve to the wrong place.
- Load external scripts only from a CDN with an exact pinned version.
- Pages are public on the internet, even if the repository is private. Never commit secrets, credentials, tokens, internal hostnames, customer data, or other confidential content into an artifact or a document.

## Document content

- Format is defined by `.claude/skills/knowledge-distill/references/note-format.md`: frontmatter `title`, `description` (both double-quoted), `lang`, `date`, `topics`, `status`; no `source` key; one paragraph per line; ASCII hyphen only.
- `uv run .claude/skills/knowledge-distill/scripts/check_notes.py documents` validates them. The site build runs it first and fails on any error.
- Create documents from a messy source with the project skill `knowledge-distill` (`.claude/skills/knowledge-distill/`).
- Mermaid blocks (```mermaid fences) are drawn in the browser; the diagram source must stay valid Mermaid.

## Site dock inside artifacts

- Artifacts are full pages with their own layout, so the site shell cannot wrap them. `scripts/build_site.py site` instead injects `<script src="<base>/assets/kai-dock.js" data-slug="<slug>" defer>` before `</body>` of the published copy only. The files in `artifacts/` are never edited by the build, and an iframe wrapper was rejected because it would change how already-shared URLs behave and break text-fragment links.
- `site/public/assets/kai-dock.js` defines a `<kai-dock>` custom element with a closed Shadow DOM, so no CSS crosses in either direction. It adds one element to `<body>`. It has no theme switch: each artifact owns its theme and storage key, the dock only follows it.
- It picks the first free corner (bottom-right, top-right, bottom-left, top-left) that does not overlap the artifact's fixed or sticky controls. A page overrides this with `<meta name="kai:dock" content="off | top-right | bottom-right | bottom-left | top-left">`.
- After editing the dock, re-check all artifacts at a desktop and a 390px width for overlap and console errors.

## README

- The section between `<!-- ARTIFACTS:START -->` and `<!-- ARTIFACTS:END -->` in `README.md` is owned by CI (two tables: Artifacts and Documents). Never edit it by hand; CI overwrites it on every push to `main`.
- Never remove or rename the two markers - the build fails without them.
- The rest of `README.md` is free to edit.

## Home page

- The home page is an Astro project in `site/`: `src/pages/index.astro` (home), `src/pages/docs/[slug].astro` (documents), `src/scripts/home.ts` (map, filters, counters), `src/scripts/doc.ts` (progress bar, TOC, Mermaid), `src/styles/global.css` (tokens and layout).
- Concept "constellation": every artifact and document is a star, shared topics are the lines. Artifact accent is gold, document accent is teal. The glyph (four stars, three lines) is the mark in the nav, favicon, og image and artifact dock. Fonts are self-hosted through `@fontsource` packages.
- Libraries are npm dependencies bundled at build time (Astro, `d3-force` for the map, `motion` for animation, `mermaid` for diagrams, loaded only on document pages). Versions are pinned by `site/package-lock.json`.
- Motion must stop under `prefers-reduced-motion`. Keep light and dark themes working.
- `site/public/assets/registry.json` is generated by `build_site.py manifest` (gitignored); the home page and the dock both read it.
- `site/public/assets/` is copied to `/kai-artifact/assets/` (favicon, social preview, dock). `site/public/assets/og.png` is rendered at 1200x630 from `site/source/og.html`; re-render it after editing that source.

## Decision record

- Astro replaced the hand-written `site/template.html` rendered by Python `string.Template`. Why: documents need markdown rendering, and the redesign needs components, page transitions and bundled libraries; doing that in standard-library Python would mean writing a markdown renderer by hand. What breaks if reverted: documents cannot be published. Rejected: keeping Python plus CDN scripts (hand-written markdown, unpinned runtime), Eleventy (weaker component and transition support).
- The earlier signature (`k/` monogram, IBM Plex, one teal accent, no themed metaphor) was dropped on purpose for the constellation identity above. The "no themed metaphor" rule no longer applies.
- `scripts/build_site.py` remains the single place for validation, the README table and the manifest, so `scripts/publish.py` (which imports it) keeps sharing the slug and metadata rules with CI. Python standard library only for those scripts.

## Build and deploy

- `.github/workflows/pages.yml` runs on push to `main` (changes under `artifacts/`, `documents/`, `scripts/`, `site/`, the checker script, or the workflow) and on manual dispatch. It regenerates the README section, commits it as `github-actions[bot]` when it changed, builds `_site/` with Node and Python, and deploys to GitHub Pages. It checks out full history because the manifest dates each page by the commit that first added it.
- Check a change locally before pushing (needs Node 24 or newer):
  - `uv run scripts/build_site.py site --base-url https://the-khiem7.github.io/kai-artifact/ --out _site` - checks documents, writes the manifest, builds Astro, copies artifacts with the dock injected. `_site/` is gitignored.
  - To preview, serve a folder that contains `_site` renamed to `kai-artifact` (the site lives under `/kai-artifact/`), and build with `--base-url http://localhost:<port>/kai-artifact/`.
  - `uv run scripts/build_site.py readme --base-url https://the-khiem7.github.io/kai-artifact/` - previews the README section. Optional; CI does it anyway.
- CI may push a README commit after your push. Run `git pull --rebase` before the next push.
- Remove an artifact or document by deleting it; CI updates the README and the site.
