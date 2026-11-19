"""Build the registry: README index section, the registry manifest and the GitHub Pages site.

Two content types: HTML artifacts (artifacts/<slug>/index.html) and markdown documents (documents/<slug>.md).

Usage:
    python scripts/build_site.py readme --base-url https://the-khiem7.github.io/kai-artifact/
    python scripts/build_site.py manifest
    python scripts/build_site.py site --base-url https://the-khiem7.github.io/kai-artifact/ --out _site
"""

from __future__ import annotations

import argparse
import datetime
import html
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ROOT / "artifacts"
DOCUMENTS_DIR = ROOT / "documents"
README = ROOT / "README.md"
SITE_DIR = ROOT / "site"
# Generated and gitignored. Lives under public/ so Astro publishes it as /assets/registry.json for the artifact dock.
REGISTRY = SITE_DIR / "public" / "assets" / "registry.json"
CHECK_NOTES = ROOT / ".claude" / "skills" / "knowledge-distill" / "scripts" / "check_notes.py"
START_MARKER = "<!-- ARTIFACTS:START -->"
END_MARKER = "<!-- ARTIFACTS:END -->"
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# Slugs that would collide with what the home page publishes at the site root: shared assets, the
# documents section and Astro's bundle folder.
RESERVED_SLUGS = {"assets", "docs", "_astro"}
# The dock script is injected into every published artifact copy unless the page opts out with
# <meta name="kai:dock" content="off">.
DOCK_SCRIPT = "assets/kai-dock.js"


@dataclass
class Artifact:
    slug: str
    title: str
    description: str
    lang: str
    topics: list[str] = field(default_factory=list)
    date: str = ""
    dock: str = ""


@dataclass
class Document:
    slug: str
    title: str
    description: str
    lang: str
    topics: list[str]
    date: str
    status: str


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.description = ""
        self.lang = ""
        self.keywords = ""
        self.dock = ""
        self._in_title = False
        self._title_done = False

    def handle_starttag(self, tag, attrs):
        if tag == "html" and not self.lang:
            self.lang = (dict(attrs).get("lang") or "").strip()
        if tag == "title" and not self._title_done:
            self._in_title = True
        elif tag == "meta":
            a = dict(attrs)
            name = (a.get("name") or "").lower()
            content = (a.get("content") or "").strip()
            if name == "description" and not self.description:
                self.description = content
            elif name == "keywords" and not self.keywords:
                self.keywords = content
            elif name == "kai:dock" and not self.dock:
                self.dock = content.lower()

    def handle_endtag(self, tag):
        if tag == "title" and self._in_title:
            self._in_title = False
            self._title_done = True

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def _collapse(text: str) -> str:
    return " ".join(text.split())


def _first_commit_date(path: Path) -> str:
    """Date the file first entered git, so the timeline shows publication order. Falls back to today."""
    try:
        out = subprocess.run(
            ["git", "log", "--diff-filter=A", "--format=%ad", "--date=short", "--", str(path.relative_to(ROOT))],
            cwd=ROOT, text=True, capture_output=True, check=True,
        ).stdout.split()
    except (subprocess.CalledProcessError, FileNotFoundError):
        out = []
    return out[-1] if out else datetime.date.today().isoformat()


def discover() -> list[Artifact]:
    if not ARTIFACTS_DIR.is_dir():
        return []
    errors: list[str] = []
    artifacts: list[Artifact] = []
    for entry in sorted(ARTIFACTS_DIR.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        slug = entry.name
        if not SLUG_RE.match(slug):
            errors.append(f"artifacts/{slug}: folder name must be lowercase kebab-case (a-z, 0-9, '-')")
            continue
        if slug in RESERVED_SLUGS:
            errors.append(f"artifacts/{slug}: slug is reserved for the home page")
            continue
        index = entry / "index.html"
        if not index.is_file():
            errors.append(f"artifacts/{slug}: missing index.html")
            continue
        parser = _MetaParser()
        parser.feed(index.read_text(encoding="utf-8", errors="replace"))
        title = _collapse(parser.title) or slug
        # Primary subtag only: "vi-VN" -> "VI".
        lang = parser.lang.split("-")[0].upper()
        topics = [t.strip().lower() for t in parser.keywords.split(",") if t.strip()]
        artifacts.append(Artifact(slug, title, _collapse(parser.description), lang, topics, _first_commit_date(index), parser.dock))
    if errors:
        for e in errors:
            print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
    return artifacts


def _frontmatter(text: str) -> dict[str, str]:
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    fm: dict[str, str] = {}
    if m:
        for line in m.group(1).splitlines():
            key, sep, value = line.partition(":")
            value = value.strip()
            if sep and len(value) >= 2 and value[0] == value[-1] == '"':
                value = value[1:-1].replace('\\"', '"').replace("\\\\", "\\")
            if sep:
                fm[key.strip()] = value
    return fm


def discover_documents() -> list[Document]:
    """Read documents/<slug>.md frontmatter. The full format check is the knowledge-distill checker."""
    if not DOCUMENTS_DIR.is_dir():
        return []
    errors: list[str] = []
    docs: list[Document] = []
    for path in sorted(DOCUMENTS_DIR.glob("*.md")):
        slug = path.stem
        if not SLUG_RE.match(slug):
            errors.append(f"documents/{path.name}: file name must be lowercase kebab-case")
            continue
        fm = _frontmatter(path.read_text(encoding="utf-8"))
        missing = [k for k in ("title", "description", "lang", "date", "topics", "status") if not fm.get(k)]
        if missing:
            errors.append(f"documents/{path.name}: frontmatter missing {', '.join(missing)}")
            continue
        topics = [t.strip() for t in fm["topics"].strip("[]").split(",") if t.strip()]
        docs.append(Document(slug, fm["title"], fm["description"], fm["lang"], topics, fm["date"], fm["status"]))
    if errors:
        for e in errors:
            print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
    return docs


def _normalize_base(base_url: str) -> str:
    return base_url.rstrip("/") + "/"


def _md_cell(text: str) -> str:
    # GitHub renders inline HTML in tables, so escape it to show page metadata as plain text.
    return html.escape(text, quote=False).replace("\\", "\\\\").replace("|", "\\|")


def render_readme_section(artifacts: list[Artifact], documents: list[Document], base_url: str) -> str:
    if not artifacts and not documents:
        return "_No artifacts yet._"
    out: list[str] = []
    if artifacts:
        out += ["### Artifacts", "", "| Artifact | Description | Link |", "| --- | --- | --- |"]
        for a in artifacts:
            url = f"{base_url}{a.slug}/"
            out.append(f"| {_md_cell(a.title)} | {_md_cell(a.description)} | [{a.slug}]({url}) |")
    if documents:
        if out:
            out.append("")
        out += ["### Documents", "", "| Document | Description | Link |", "| --- | --- | --- |"]
        for d in documents:
            url = f"{base_url}docs/{d.slug}/"
            out.append(f"| {_md_cell(d.title)} | {_md_cell(d.description)} | [{d.slug}]({url}) |")
    return "\n".join(out)


def cmd_readme(base_url: str) -> None:
    text = README.read_text(encoding="utf-8")
    start = text.find(START_MARKER)
    end = text.find(END_MARKER)
    if start == -1 or end == -1 or end < start:
        print(f"error: README.md must contain {START_MARKER} followed by {END_MARKER}", file=sys.stderr)
        sys.exit(1)
    section = render_readme_section(discover(), discover_documents(), base_url)
    new_text = text[: start + len(START_MARKER)] + "\n" + section + "\n" + text[end:]
    if new_text != text:
        README.write_text(new_text, encoding="utf-8", newline="\n")
        print("README.md updated")
    else:
        print("README.md already up to date")


def cmd_manifest() -> tuple[list[Artifact], list[Document]]:
    """Write the registry that the Astro home page and the artifact dock both read."""
    artifacts = discover()
    documents = discover_documents()
    items = [
        {"type": "artifact", "slug": a.slug, "title": a.title, "description": a.description, "lang": a.lang,
         "topics": a.topics, "date": a.date, "href": f"{a.slug}/"}
        for a in artifacts
    ] + [
        {"type": "document", "slug": d.slug, "title": d.title, "description": d.description, "lang": d.lang.upper(),
         "topics": d.topics, "date": d.date, "href": f"docs/{d.slug}/", "status": d.status}
        for d in documents
    ]
    items.sort(key=lambda i: (i["date"], i["slug"]), reverse=True)
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"registry: {len(artifacts)} artifact(s), {len(documents)} document(s)")
    return artifacts, documents


def inject_dock(html_text: str, slug: str, base_url: str) -> str:
    """Add the site dock to a published artifact copy. The source file in artifacts/ is never touched."""
    # A path under the site base, not the absolute URL, so the same build works on localhost and on Pages.
    src = urlparse(base_url).path.rstrip("/") + "/" + DOCK_SCRIPT
    tag = f'<script src="{html.escape(src)}" data-slug="{html.escape(slug)}" defer></script>'
    matches = list(re.finditer(r"</body\s*>", html_text, re.I))
    if matches:
        i = matches[-1].start()
        return html_text[:i] + tag + "\n" + html_text[i:]
    return html_text + "\n" + tag + "\n"


def _run(cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> None:
    result = subprocess.run(cmd, cwd=cwd, env=env)
    if result.returncode != 0:
        print(f"error: {' '.join(cmd)} failed (exit {result.returncode})", file=sys.stderr)
        sys.exit(1)


def cmd_site(base_url: str, out: Path) -> None:
    # Documents must pass the note checker before they are published.
    if DOCUMENTS_DIR.is_dir() and CHECK_NOTES.is_file():
        _run([sys.executable, str(CHECK_NOTES), str(DOCUMENTS_DIR)], ROOT)
    artifacts, _ = cmd_manifest()
    npm = shutil.which("npm")
    if not npm:
        print("error: npm not found on PATH (Node.js is required to build the home page)", file=sys.stderr)
        sys.exit(1)
    if not (SITE_DIR / "node_modules").is_dir():
        _run([npm, "ci"], SITE_DIR)
    parsed = urlparse(base_url)
    env = {**os.environ, "KAI_SITE": f"{parsed.scheme}://{parsed.netloc}", "KAI_BASE": parsed.path.rstrip("/") or "/", "KAI_OUT": str(out)}
    if out.exists():
        shutil.rmtree(out)
    _run([npm, "run", "build"], SITE_DIR, env)
    for a in artifacts:
        dest = out / a.slug
        shutil.copytree(ARTIFACTS_DIR / a.slug, dest)
        if a.dock != "off":
            index = dest / "index.html"
            patched = inject_dock(index.read_bytes().decode("utf-8", errors="replace"), a.slug, base_url)
            index.write_bytes(patched.encode("utf-8"))
    # Without .nojekyll, Pages drops files and folders whose names start with "_" (Astro's _astro bundle folder).
    (out / ".nojekyll").write_text("", encoding="utf-8")
    print(f"built {len(artifacts)} artifact(s) into {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p_readme = sub.add_parser("readme", help="regenerate the artifact and document section of README.md")
    p_readme.add_argument("--base-url", required=True)
    sub.add_parser("manifest", help="write site/public/assets/registry.json")
    p_site = sub.add_parser("site", help="build the GitHub Pages site")
    p_site.add_argument("--base-url", required=True)
    p_site.add_argument("--out", default="_site")
    args = parser.parse_args()

    if args.command == "manifest":
        cmd_manifest()
        return
    base_url = _normalize_base(args.base_url)
    if args.command == "readme":
        cmd_readme(base_url)
    else:
        cmd_site(base_url, (ROOT / args.out).resolve())


if __name__ == "__main__":
    main()
