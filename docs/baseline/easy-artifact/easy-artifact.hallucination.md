---
baseline_schema: "2.0"
pack: "easy-artifact"
document: "hallucination"
status: "active"
updated: "2026-10-14"
code_ref: "42e0ee0"
---

# easy-artifact - decisions and open questions

## Entry index

| ID | About | Status | Related |
|---|---|---|---|
| EA-D1 | Mechanism: skill + shallow temp clone + script | closed | EA-D5 |
| EA-D2 | Push straight to `main`; `gh` optional, plain git required | closed | EA-D1 |
| EA-D3 | Existing slug refused unless `--update` | closed | - |
| EA-D4 | No provenance file in the artifact folder | closed | - |
| EA-D5 | Script lives in the registry repo, shallow clone only | closed | EA-D1, EA-D6 |
| EA-D6 | Skill stored in this repo, installed with `npx skills` | closed | EA-D5 |
| EA-D9 | Keep approach 1 (EA-D1); alternatives researched and rejected | closed | EA-D1, EA-Q1 |
| EA-D7 | Secret scan uses built-in patterns only | closed | EA-D2, EA-Q2 |
| EA-D8 | Skill name is `kai-artifact-publish` | closed | EA-D6, EA-Q3 |

## Closed decisions

### EA-D1: Mechanism is a global skill that shallow-clones the registry and runs a script from the clone

- Decision: the skill clones `the-khiem7/kai-artifact` into a temp dir and runs `scripts/publish.py` from that clone.
- Why: the validator (`scripts/build_site.py` rules) is reused, so a rule change needs no skill change.
- What breaks if ignored: a reimplemented validator in the skill drifts from the registry rules and publishes pages the build then rejects, failing CI after the push.
- Rejected: GitHub Git Data API via `gh api` (blobs, tree, commit, ref update) - no clone, but the validation must be rewritten and the multi-step call sequence is fragile; the user chose option (a) over it.

### EA-D2: Push straight to `main`; `gh` is optional, plain git is required

- Decision: publish by direct push; pull request flow is not used. Authentication is the existing git login.
- Why: a pull request needs a manual merge, which defeats "no interaction with this repo".
- What breaks if ignored: with a PR gate, every publish stalls until the user merges.
- Consequence: nothing reviews the artifact before it is public, so the scan for secrets is the only gate and is mandatory.
- Fallback: the script must run on a machine without `gh`. The Pages URL is computed from the fixed pattern `https://the-khiem7.github.io/kai-artifact/<slug>/`; the deploy watch polls the page URL for HTTP 200 and needs no `gh`. If the page is not live in time, the script prints the URL and says deploy status was not confirmed.
- Rejected: requiring `gh` - the user asked for a fallback when it is not installed.

### EA-D3: An existing slug is refused unless `--update` is passed

- Decision: default is refuse; `--update` replaces the folder contents in place.
- Why: the slug is a shared URL, an accidental overwrite changes what everyone who has the link sees.
- What breaks if ignored: an agent reusing a common slug silently replaces a published artifact.
- Rejected: always overwrite - faster, but loses the earlier content from the live site without notice.

### EA-D4: No provenance file

- Decision: the published folder carries only the artifact; no `.source.json` or similar.
- Why: user choice. Git history of the registry still shows the commit that added the folder.
- Rejected: `artifacts/<slug>/.source.json` with source repo and commit - would make origin traceable, declined by the user.

### EA-D5: The script lives in the registry repo and the clone is shallow

- Decision: `scripts/publish.py` is in this repo; every clone uses `git clone --depth 1 --single-branch`.
- Why: logic stays in one place, and a depth-1 clone avoids downloading history on every publish.
- What breaks if ignored: a full clone per publish wastes disk and time as history grows; a script inside the skill copy goes stale against `build_site.py`.
- Rejected: script embedded in the skill - works offline, but drifts from the registry rules.

### EA-D6: The skill is stored in this repo and installed through the `skills` CLI

- Decision: skill sources live at `skills/<skill-name>/SKILL.md` in this repo. Install command: `npx skills add the-khiem7/kai-artifact -g -a claude-code`. The README gets an install section.
- Why: the `skills` CLI discovers `skills/` in a GitHub repo; `-g` installs to `~/.claude/skills/` so every repo sees it. Source: [vercel-labs/skills README](https://github.com/vercel-labs/skills) (fetched 2026-10-14; the discovery list and flags came from that page, not from running the CLI).
- What breaks if ignored: a skill placed outside the searched directories is not found by `npx skills add`.
- Bootstrap: the installed skill is only the instructions; it fetches the script by cloning the registry (EA-D5), so the skill needs no copy of the code.
- Unverified: `npx skills add` against this repo has not been run.

### EA-D7: Secret scan uses built-in patterns only

Closes EA-Q2.

- Decision: `publish.py` scans the source folder with regex patterns shipped in the script (private key headers, AWS access key ids, common token shapes) and aborts on any hit. No external scanner is invoked.
- Why: patterns run on every machine with no install; the push is public and unreviewed (EA-D2), so the gate must always exist.
- What breaks if ignored: a gate that depends on an optional binary silently does not run on machines without it.
- Rejected: also calling `gitleaks` when found on PATH - broader coverage, but behaviour differs per machine; declined by the user.

### EA-D8: Skill name is `kai-artifact-publish`

Closes EA-Q3.

- Decision: folder `skills/kai-artifact-publish/`, frontmatter `name: kai-artifact-publish` (the `skills` CLI requires the name to match the folder).
- Why: user choice; the `kai-artifact-` prefix groups it with this registry.
- Rejected: `publish-artifact` - generic name that can collide with another installed skill.

### EA-D9: Keep the skill + shallow clone + script design (EA-D1); no alternative adopted

Closes EA-Q1.

- Decision: build only approach 1 below. The user chose it on 2026-10-14 after a walkthrough of approaches 1-3.
- Why: it is the only approach that serves "an agent in any repo publishes without touching the registry" with just git and the existing login, and keeps validation in one place.
- What breaks if ignored: approach 2 forces `gh` onto every machine (against EA-D2) and duplicates the validator; approach 3 spreads a write token across source repos.
- Rejected: approach 2 (`gh api` Git Data API commit, no clone) - needs `gh` and a rewritten validator. Approach 3 (reusable GitHub Action called from other repos' CI) - needs a workflow and a write token in each source repo; may be added later for CI-generated artifacts, not built now. Approach 4 (`workflow_dispatch` / `repository_dispatch` carrying files) - payload limit makes real artifacts impractical. Approach 5 (Cloudflare Pages direct upload, Netlify Drop, Surge) - bypasses the registry, loses the README index and one-site model. Approach 6 (MCP server with a `publish_artifact` tool) - a server to build and run for what a script does.

Research on 2026-10-14. Every item is from general knowledge plus search snippets, not hands-on tests; treat each claim as unverified.

| # | Approach | Fit against "no interaction with the registry" |
|---|---|---|
| 1 | Current: skill + shallow clone + script (EA-D1) | needs git + login on the machine |
| 2 | `gh api` Git Data API commit, no clone | no clone, but needs `gh` and a rewritten validator |
| 3 | Reusable GitHub Action in the registry, called by other repos' CI | no local step, but every source repo needs a workflow and a token |
| 4 | `workflow_dispatch` / `repository_dispatch` carrying the files | payload size limit makes real artifacts impractical |
| 5 | Third-party host (Cloudflare Pages direct upload, Netlify Drop, Surge) | no registry repo involved, loses README index and one-site model |
| 6 | MCP server exposing a `publish_artifact` tool | works in any client, but a server to build and run |

- Search sources: [Netlify Drop alternatives](https://bugsmash.io/blog/best-netlify-drop-alternatives-static-hosting-tools/), [Host a single HTML file, 8 tools compared](https://hummingdeck.com/blog/host-single-html-file), [Git Data API multi-file commit workflow](https://n8n.io/workflows/3308-push-multiple-files-to-github-repository-via-github-rest-api/).
- Not found by search: GitHub's `repository_dispatch` payload limit and Contents API size limits; confirm on GitHub's REST docs before relying on items 2 and 4.

## Open questions

None.
