"""Check the knowledge notes in documents/ against the note format.

Usage:
    uv run .claude/skills/knowledge-distill/scripts/check_notes.py documents [more paths...]

Each path is a folder (its *.md files are checked) or a single .md file. Exit 0 when all pass, 1 otherwise.
Standard library only.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TOPIC_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
REQUIRED = ("title", "description", "lang", "date", "topics", "status")
ALLOWED = set(REQUIRED)
STATUSES = {"verified", "partially-verified", "unverified"}
LANGS = {"vi", "en"}
# En dash and em dash. Allowed only inside a copied URL text fragment.
DASHES = ("–", "—")
FRAGMENT_RE = re.compile(r"#:~:text=[^\s)]*")
# Lines that are never part of a plain paragraph for the hard-wrap check.
NON_PARAGRAPH = re.compile(r"^\s*(#|[-*+] |\d+[.)] |\||>|<|!\[|\[[^\]]+\]:)")


def parse_frontmatter(lines: list[str]) -> tuple[dict[str, str], int, list[str]]:
    errors: list[str] = []
    if not lines or lines[0].strip() != "---":
        return {}, 0, ["line 1: file must start with a --- frontmatter block"]
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            fm: dict[str, str] = {}
            for n, raw in enumerate(lines[1:i], start=2):
                if not raw.strip():
                    continue
                if ":" not in raw or raw[0] in " \t":
                    errors.append(f"line {n}: frontmatter entry must be 'key: value' on one line")
                    continue
                key, _, value = raw.partition(":")
                fm[key.strip()] = value.strip()
            return fm, i + 1, errors
    return {}, 0, ["frontmatter block is not closed with ---"]


def check_frontmatter(fm: dict[str, str]) -> list[str]:
    errors: list[str] = []
    if "source" in fm:
        errors.append("frontmatter: 'source' is forbidden")
    for key in fm:
        if key not in ALLOWED and key != "source":
            errors.append(f"frontmatter: unknown key '{key}'")
    for key in REQUIRED:
        if not fm.get(key):
            errors.append(f"frontmatter: missing or empty '{key}'")
    # Free text is real YAML for the site build: an unquoted ': ' or leading special character fails the parse.
    for key in ("title", "description"):
        v = fm.get(key, "")
        if v and not (len(v) >= 2 and v[0] == v[-1] == '"'):
            errors.append(f"frontmatter: '{key}' must be wrapped in double quotes (escape inner quotes as \\\")")
    if fm.get("status") and fm["status"] not in STATUSES:
        errors.append(f"frontmatter: status must be one of {sorted(STATUSES)}")
    if fm.get("lang") and fm["lang"] not in LANGS:
        errors.append(f"frontmatter: lang must be one of {sorted(LANGS)}")
    if fm.get("date") and not DATE_RE.match(fm["date"]):
        errors.append("frontmatter: date must be YYYY-MM-DD")
    topics = fm.get("topics", "")
    if topics:
        if not (topics.startswith("[") and topics.endswith("]")):
            errors.append("frontmatter: topics must be a flow list like [a, b]")
        else:
            items = [t.strip() for t in topics[1:-1].split(",") if t.strip()]
            if not items:
                errors.append("frontmatter: topics must not be empty")
            for t in items:
                if not TOPIC_RE.match(t):
                    errors.append(f"frontmatter: topic '{t}' must be lowercase kebab-case")
    return errors


def check_body(lines: list[str], offset: int) -> list[str]:
    errors: list[str] = []
    in_code = False
    fence_line = 0
    fence_is_mermaid = False
    prev_paragraph = False
    for idx in range(offset, len(lines)):
        n = idx + 1
        line = lines[idx]
        stripped = line.strip()
        if stripped.startswith("```"):
            if in_code:
                in_code = False
            else:
                in_code = True
                fence_line = n
                fence_is_mermaid = stripped[3:].strip().lower().startswith("mermaid")
            prev_paragraph = False
            continue
        if in_code:
            continue
        # Dashes: strip copied URL fragments first, they may legitimately contain them.
        scrubbed = FRAGMENT_RE.sub("", line)
        for d in DASHES:
            if d in scrubbed:
                errors.append(f"line {n}: en/em dash found, use an ASCII hyphen")
                break
        is_paragraph = bool(stripped) and not NON_PARAGRAPH.match(line)
        if is_paragraph and prev_paragraph:
            errors.append(f"line {n}: paragraph continues from the previous line (hard wrap); keep one paragraph on one line")
        prev_paragraph = is_paragraph
    if in_code:
        kind = "mermaid " if fence_is_mermaid else ""
        errors.append(f"line {fence_line}: unclosed {kind}code fence")
    return errors


def check_file(path: Path) -> list[str]:
    errors: list[str] = []
    if not SLUG_RE.match(path.stem):
        errors.append(f"file name '{path.stem}' must be lowercase kebab-case")
    lines = path.read_text(encoding="utf-8").split("\n")
    fm, offset, fm_errors = parse_frontmatter(lines)
    errors.extend(fm_errors)
    if fm:
        errors.extend(check_frontmatter(fm))
    errors.extend(check_body(lines, offset))
    return errors


def collect(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for raw in paths:
        p = Path(raw)
        if p.is_dir():
            files.extend(sorted(p.glob("*.md")))
        elif p.is_file():
            files.append(p)
        else:
            print(f"error: {raw} does not exist", file=sys.stderr)
            sys.exit(1)
    return files


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    paths = sys.argv[1:]
    if not paths:
        print(__doc__)
        sys.exit(1)
    failed = 0
    files = collect(paths)
    for f in files:
        errs = check_file(f)
        if errs:
            failed += 1
            for e in errs:
                print(f"{f}: {e}", file=sys.stderr)
    if failed:
        print(f"{failed} of {len(files)} note(s) failed", file=sys.stderr)
        sys.exit(1)
    print(f"{len(files)} note(s) ok")


if __name__ == "__main__":
    main()
