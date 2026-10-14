---
baseline_schema: "2.0"
pack: "easy-artifact"
document: "introduction"
status: "active"
updated: "2026-10-14"
code_ref: "42e0ee0"
---

# easy-artifact - introduction

## Scope

Let an agent working in any other repository publish a finished artifact into the kai-artifact registry without the user opening, cloning or touching the registry repo by hand. The registry itself (folder-per-artifact, GitHub Pages deploy, CI-owned README section, home page) is already built and is out of scope here.

## Current truth

- Implemented: registry repo `the-khiem7/kai-artifact` with `artifacts/<slug>/index.html`, `scripts/build_site.py` (validates slug, `index.html`, title, description, `lang`), `.github/workflows/pages.yml` (README section update, build, deploy), rules in `AGENTS.md`. Remote `origin` is `https://github.com/the-khiem7/kai-artifact.git`.
- Unverified: first real Actions run and the live Pages URL.
- Not built: any publish path from a foreign repo. Today an artifact only enters by editing this repo.

## Target

- A user-global skill that any agent session can invoke as "publish this artifact". It publishes a snapshot of a local folder to `artifacts/<slug>/` and prints `https://the-khiem7.github.io/kai-artifact/<slug>/`.
- The skill is stored in this repo under `skills/` and installed with `npx skills add the-khiem7/kai-artifact -g -a claude-code`; the README documents that install.
- The publish logic lives in this repo at `scripts/publish.py`, so the rules stay in one place.

## Constraints

- Pages are public on the internet: no keys, passwords, tokens, internal hostnames or customer data in a published folder. A scan for such material is mandatory before push.
- Python standard library only for scripts, run with `uv run`. No dependency added to the registry.
- Standard Windows user, no elevation: per-user installs only.
- No `Co-Authored-By` or other AI trailer in any commit message.
- A published slug is a shared URL: never rename or delete it without the user asking.
- Auth is the machine's existing git login. No new token is created or stored by this design.

## Flow (target)

1. Skill clones the registry shallow into a temp dir.
2. Skill runs `scripts/publish.py` from that clone with the source folder and slug.
3. `publish.py` refuses an existing slug unless `--update`, validates with the same rules as `build_site.py`, scans for secrets, copies the folder, commits, `git pull --rebase`, pushes to `main`.
4. CI deploys. The script prints the computed Pages URL; if `gh` is installed it may also watch the run.
