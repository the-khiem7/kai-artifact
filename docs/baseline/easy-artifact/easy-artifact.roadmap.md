---
baseline_schema: "2.0"
pack: "easy-artifact"
document: "roadmap"
status: "active"
updated: "2026-10-14"
code_ref: "42e0ee0"
---

# easy-artifact - roadmap

| Phase | Goal | Depends on | Status |
|---|---|---|---|
| EA-P1 | Evaluate alternatives, confirm mechanism | - | complete |
| EA-P2 | `scripts/publish.py` | EA-P1 | active |
| EA-P3 | `skills/kai-artifact-publish/SKILL.md` | EA-P2 | planned |
| EA-P4 | README install section and `AGENTS.md` update | EA-P3 | planned |
| EA-P5 | End-to-end verification from a foreign repo | EA-P4 | planned |

## EA-P1: Phase 1 - Evaluate alternatives

- Result: complete. EA-Q1 (alternative approaches), EA-Q2 (secret scan scope) and EA-Q3 (skill name) are closed as EA-D9, EA-D7 and EA-D8 in `easy-artifact.hallucination.md`; no open question remains.
- Evidence: decisions EA-D1 to EA-D9 recorded from the user's answers; research table kept in EA-D9, unverified by hands-on test.

## EA-P2: Phase 2 - `scripts/publish.py`

- Standard library only, run with `uv run`.
- Inputs: source folder, `--slug`, optional `--update`, optional `--repo` (default the registry URL).
- Steps: shallow clone, reject existing slug without `--update`, validate with the `build_site.py` rules (import or shared function), scan for secrets, copy, commit without any AI trailer, `git pull --rebase`, push, print URL.
- Acceptance: refuses existing slug, refuses a folder with a planted fake key, runs with `gh` absent from PATH.
- Verification gate: run against a throwaway slug, then remove that folder only through a commit the user approves.
- Status: `scripts/publish.py` written (uncommitted). It operates on the checkout it sits in, so the skill clones first (EA-D5). Extra checks beyond the plan: root-absolute `src`/`href`/`action`, missing `<title>`, description or `lang`, symlinks, files over 50 MB, key-like file names. The scan reports file and line only, never the matched value. The wait step polls the page URL for HTTP 200 and needs neither `gh` nor an extra token.
- Evidence (dry run only, 9 cases, all pass, working tree unchanged afterwards): clean folder ok; missing `lang`, fake AWS-style key and root-absolute link each refused; existing slug without `--update`, reserved slug `assets`, invalid slug `Bad_Name` and `--update` on a missing slug each refused; `--update` on the existing slug ok.
- Not observed: a real commit, `git pull --rebase`, push, the CI deploy, the live-page poll, and the `gh`-absent claim (the script never calls `gh`, so it is untested rather than proven).

## EA-P3: Phase 3 - skill

- `skills/kai-artifact-publish/SKILL.md` with `name` and `description` frontmatter. It carries the artifact rules an agent must follow (relative assets, `lang`, title, description, no secrets) by reading `AGENTS.md` from the fresh clone instead of copying them.
- Acceptance: `npx skills add the-khiem7/kai-artifact -l` lists the skill.

## EA-P4: Phase 4 - documentation

- README section "Publish from another repo" with `npx skills add the-khiem7/kai-artifact -g -a claude-code`, placed outside the CI-owned markers.
- `AGENTS.md`: layout entry for `skills/`, and a note that `scripts/publish.py` shares validation with `build_site.py`. Do not add `skills/**` to the workflow trigger paths: a skill change does not change the site.

## EA-P5: Phase 5 - end-to-end

- From a different repo on this machine, install the skill globally and publish a sample folder; open the live URL.
- Acceptance: link resolves, README table row appears via CI, second publish of the same slug is refused.

## Risks

- First Actions run and Pages source setting are unverified; a successful push does not prove deploy.
- Direct push to `main` fails if branch protection blocks it; the CI bot push has the same dependency.
- `npx skills` behaviour is taken from its README, not observed.

## Next action

Phase 2 - EA-P2 (`scripts/publish.py`): the dry-run checks pass. Ask the user for permission to run one real publish of a throwaway slug (this commits and pushes to `main` and triggers a public deploy), then remove that slug only through a commit the user approves. After that, start Phase 3 - EA-P3 (`skills/kai-artifact-publish/SKILL.md`).
