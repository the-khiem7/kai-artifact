# AGENTS.md

This repository is an artifact registry. Every artifact is a static web page published by GitHub Pages at `https://the-khiem7.github.io/kai-artifact/<slug>/`. Follow these rules for every change.

## Layout

- One artifact = one folder `artifacts/<slug>/`. Never put an artifact anywhere else.
- Entry point is `artifacts/<slug>/index.html`. Required - the build fails without it.
- `<slug>` is lowercase kebab-case: `^[a-z0-9]+(-[a-z0-9]+)*$`. The build fails on any other folder name.
- The slug is the public URL. Never rename or delete a published slug unless the user asks - every link already shared breaks.
- The published URL drops the `artifacts/` prefix: `artifacts/foo/index.html` is served at `/kai-artifact/foo/`.

## Page content

- Every `index.html` has a `<title>` and a `<meta name="description" content="...">`. They are the artifact's name and description in the README and the landing page; a missing title falls back to the slug.
- Keep every asset (CSS, JS, images, data) inside the artifact's own folder and reference it with a relative path (`./style.css`). Never use root-absolute paths (`/style.css`) - the site is served under `/kai-artifact/`, so they resolve to the wrong place.
- Load external scripts only from a CDN with an exact pinned version.
- Pages are public on the internet, even if the repository is private. Never commit secrets, credentials, tokens, internal hostnames, customer data, or other confidential content into an artifact.

## README

- The section between `<!-- ARTIFACTS:START -->` and `<!-- ARTIFACTS:END -->` in `README.md` is owned by CI. Never edit it by hand; CI overwrites it on every push to `main`.
- Never remove or rename the two markers - the build fails without them.
- The rest of `README.md` is free to edit.

## Build and deploy

- `.github/workflows/pages.yml` runs on push to `main` (changes under `artifacts/`, `scripts/`, or the workflow) and on manual dispatch. It regenerates the README section, commits it as `github-actions[bot]` when it changed, builds `_site/`, and deploys to GitHub Pages.
- `scripts/build_site.py` is the only build logic. Python standard library only - add no dependencies.
- Check a change locally before pushing:
  - `uv run scripts/build_site.py site --base-url https://the-khiem7.github.io/kai-artifact/ --out _site` - builds the site into `_site/` (gitignored).
  - `uv run scripts/build_site.py readme --base-url https://the-khiem7.github.io/kai-artifact/` - previews the README section. Optional; CI does it anyway.
- CI may push a README commit after your push. Run `git pull --rebase` before the next push.
- Remove an artifact by deleting its folder; CI updates the README and the site.
