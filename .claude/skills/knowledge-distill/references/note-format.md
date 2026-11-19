# Note format

File: `documents/<slug>.md`, `<slug>` matches `^[a-z0-9]+(-[a-z0-9]+)*$`. The slug is the public URL (`/docs/<slug>/`), so never rename a published one.

## Frontmatter

```yaml
---
title: "Short title - subtitle"
description: "One or two sentences, shown on the homepage card."
lang: vi
date: 2026-11-19
topics: [kebab-case, tags]
status: partially-verified
---
```

| Key | Rule |
|---|---|
| `title` | required, plain text in double quotes (the site parses real YAML, and an unquoted `: ` breaks the build) |
| `description` | required, one line in double quotes |
| `lang` | required, `vi` or `en` |
| `date` | required, `YYYY-MM-DD`, day the note was written or last re-verified |
| `topics` | required, flow list of kebab-case tags; shared tags link notes and artifacts on the homepage map |
| `status` | required, `verified`, `partially-verified` or `unverified` |
| `source` | forbidden |

Each value is on one line. Do not add other keys.

## Body skeleton

1. `# H1` same idea as the title.
2. One paragraph: what the note covers and why it matters. Cross-reference related notes by file name in backticks.
3. Numbered `##` sections, each: concept, how it works, trade-off. Prefer tables for comparisons.
4. `## Kiểm chứng`: a table of verified claims with text-fragment links, then `### Chưa xác minh được` as a bullet list.

## Diagrams

- Mermaid in a fenced block tagged `mermaid`, vertical (`flowchart TB` or `sequenceDiagram`). Every opening fence has a closing fence.
- Or a horizontal ASCII flow on one line, for example `A -> B -> C`. No box-drawing frames.

## Links

Every evidence link carries a text fragment: `<url>#:~:text=<text>`. Copy the text verbatim from the page and percent-encode spaces (`%20`) and `-` `&` `,` (`%2D` `%26` `%2C`). Keep it short and unique. A link whose fragment was not seen on the fetched page gets `(fragment unverified)` next to it.

## Writing

- Vietnamese prose, English technical terms unchanged.
- ASCII hyphen `-` only outside URL fragments.
- One paragraph is one line, no hard wrapping.
- Opinion and motive are labelled as analysis, not stated as fact.
