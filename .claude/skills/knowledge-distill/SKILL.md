---
name: knowledge-distill
description: Distill a mixed-topic dump (an AI chat export, a rambling notes file) into a small set of verified Vietnamese knowledge notes under documents/, one cohesive topic per file, with Mermaid diagrams and fact-check links carrying text fragments. Also re-verifies one existing note. Use when the user says split, distill, refine or clean up a dump / chat log / random knowledge file into notes or documents, or asks to verify or fact-check a note in documents/. Not for writing HTML artifacts and not for publishing.
---

# knowledge-distill

Turns one messy source file into 4-8 cohesive notes in `documents/<slug>.md`. The notes are published by the site build as pages, so they must pass `scripts/check_notes.py`.

## Modes

- `distill <source-file>`: full pipeline below.
- `verify <documents/note.md>`: run only steps 5-7 on one existing note.

## Pipeline

1. **Read everything.** Read the source in chunks until the last line (a single read can truncate). Confirm the total line count before briefing.
2. **Brief.** List the topics with source line ranges and propose a grouping: merge closely related topics so the result is 4-8 files, not one per topic. Say what in the source looks wrong, outdated or unsourced.
3. **Ask labelled questions** (global CLAUDE.md format, one topic letter per round). Pre-fill these defaults so the user only answers deviations:
   - output folder `documents/`, flat, kebab-case slug per file
   - no README or index file
   - rewrite concisely into knowledge notes, drop the user's original questions
   - diagrams: Mermaid (vertical) or horizontal ASCII, never boxed ASCII art
   - language: Vietnamese with English technical terms
   - research official sources and attach links with text fragments
   - frontmatter as in `references/note-format.md`, no `source` field
   - no commit unless asked
4. **Write the notes** following `references/note-format.md`. Do not copy the source's claims as fact: keep them as claims until step 5.
5. **Verify.** Launch one research subagent per note, in parallel, using `references/verify-brief.md`. Each returns every claim as verified / refuted / unverified with an official source. Fold results into the note:
   - refuted claims are corrected in the body, not left with a caveat
   - verified claims get a link `<url>#:~:text=<fragment>` in the closing "Kiểm chứng" section
   - a fragment the agent did not see on the fetched page is marked `(fragment unverified)`
   - claims with no official source go in "Chưa xác minh được"
   - set `status` to `verified` only when nothing is left unverified, else `partially-verified`
   Agent reports are not proof: say in the final report that the pages were not re-opened by you, unless you did.
6. **Check.** Run `uv run .claude/skills/knowledge-distill/scripts/check_notes.py documents`. Fix every failure.
7. **Report in Vietnamese.** Table of files, table of source claims proven wrong, list of unverified items per file, and a flag to confirm with the internal licensing, legal, security or data-protection team when a note touches licensing, legal or regulated data. End with the next labelled question.

## Rules

- Never hard-wrap a paragraph; one paragraph is one line.
- ASCII hyphen only in prose. En and em dashes appear only inside copied URL fragments.
- Analysis, motive and opinion in the source stays but is labelled as analysis, not fact.
- Never put secrets, internal hostnames or personal data into a note: documents are published on a public site.
- Do not commit, push or publish unless asked.
