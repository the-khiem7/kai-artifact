"""Build the artifact registry: README index section and the GitHub Pages site.

Usage:
    python scripts/build_site.py readme --base-url https://the-khiem7.github.io/kai-artifact/
    python scripts/build_site.py site --base-url https://the-khiem7.github.io/kai-artifact/ --out _site
"""

from __future__ import annotations

import argparse
import html
import re
import shutil
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ROOT / "artifacts"
README = ROOT / "README.md"
SITE_DIR = ROOT / "site"
TEMPLATE = SITE_DIR / "template.html"
SITE_ASSETS = SITE_DIR / "assets"
START_MARKER = "<!-- ARTIFACTS:START -->"
END_MARKER = "<!-- ARTIFACTS:END -->"
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# Slugs that would collide with files the home page publishes at the site root.
RESERVED_SLUGS = {"assets"}


@dataclass
class Artifact:
    slug: str
    title: str
    description: str
    lang: str


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.description = ""
        self.lang = ""
        self._in_title = False
        self._title_done = False

    def handle_starttag(self, tag, attrs):
        if tag == "html" and not self.lang:
            self.lang = (dict(attrs).get("lang") or "").strip()
        if tag == "title" and not self._title_done:
            self._in_title = True
        elif tag == "meta":
            a = dict(attrs)
            if (a.get("name") or "").lower() == "description" and not self.description:
                self.description = (a.get("content") or "").strip()

    def handle_endtag(self, tag):
        if tag == "title" and self._in_title:
            self._in_title = False
            self._title_done = True

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def _collapse(text: str) -> str:
    return " ".join(text.split())


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
        artifacts.append(Artifact(slug, title, _collapse(parser.description), lang))
    if errors:
        for e in errors:
            print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
    return artifacts


def _normalize_base(base_url: str) -> str:
    return base_url.rstrip("/") + "/"


def _md_cell(text: str) -> str:
    # GitHub renders inline HTML in tables, so escape it to show page metadata as plain text.
    return html.escape(text, quote=False).replace("\\", "\\\\").replace("|", "\\|")


def render_readme_section(artifacts: list[Artifact], base_url: str) -> str:
    if not artifacts:
        return "_No artifacts yet._"
    lines = ["| Artifact | Description | Link |", "| --- | --- | --- |"]
    for a in artifacts:
        url = f"{base_url}{a.slug}/"
        lines.append(f"| {_md_cell(a.title)} | {_md_cell(a.description)} | [{a.slug}]({url}) |")
    return "\n".join(lines)


def cmd_readme(base_url: str) -> None:
    text = README.read_text(encoding="utf-8")
    start = text.find(START_MARKER)
    end = text.find(END_MARKER)
    if start == -1 or end == -1 or end < start:
        print(f"error: README.md must contain {START_MARKER} followed by {END_MARKER}", file=sys.stderr)
        sys.exit(1)
    section = render_readme_section(discover(), base_url)
    new_text = text[: start + len(START_MARKER)] + "\n" + section + "\n" + text[end:]
    if new_text != text:
        README.write_text(new_text, encoding="utf-8", newline="\n")
        print("README.md updated")
    else:
        print("README.md already up to date")


def render_landing(artifacts: list[Artifact], base_url: str) -> str:
    if not artifacts:
        items = '      <p class="empty">No artifacts yet.</p>'
    else:
        rows = []
        for a in artifacts:
            url = html.escape(base_url + a.slug + "/")
            path = html.escape(f"/{a.slug}/")
            desc = f"<p>{html.escape(a.description)}</p>" if a.description else ""
            lang = f'<span class="chip mono" title="Language">{html.escape(a.lang)}</span>' if a.lang else ""
            rows.append(
                f'        <li><h2><a href="{html.escape(a.slug)}/">{html.escape(a.title)}</a></h2>{desc}'
                f'<div class="row"><span class="path mono">{path}</span>{lang}'
                f'<button class="copy mono" type="button" data-url="{url}">Copy link</button></div></li>'
            )
        items = '      <ul id="list">\n' + "\n".join(rows) + "\n      </ul>"
    template = Template(TEMPLATE.read_text(encoding="utf-8"))
    return template.substitute(base_url=html.escape(base_url), count=len(artifacts), items=items)


def cmd_site(base_url: str, out: Path) -> None:
    artifacts = discover()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for a in artifacts:
        shutil.copytree(ARTIFACTS_DIR / a.slug, out / a.slug)
    shutil.copytree(SITE_ASSETS, out / "assets")
    (out / "index.html").write_text(render_landing(artifacts, base_url), encoding="utf-8", newline="\n")
    # Without .nojekyll, Pages drops files and folders whose names start with "_".
    (out / ".nojekyll").write_text("", encoding="utf-8")
    print(f"built {len(artifacts)} artifact(s) into {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p_readme = sub.add_parser("readme", help="regenerate the artifact section of README.md")
    p_readme.add_argument("--base-url", required=True)
    p_site = sub.add_parser("site", help="build the GitHub Pages site")
    p_site.add_argument("--base-url", required=True)
    p_site.add_argument("--out", default="_site")
    args = parser.parse_args()

    base_url = _normalize_base(args.base_url)
    if args.command == "readme":
        cmd_readme(base_url)
    else:
        cmd_site(base_url, (ROOT / args.out).resolve())


if __name__ == "__main__":
    main()
