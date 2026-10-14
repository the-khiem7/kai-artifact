"""Publish a folder as an artifact of this registry: validate, scan, copy, commit, push.

Run it from a checkout of the registry (the kai-artifact-publish skill makes a shallow clone for this):

    uv run scripts/publish.py <source-dir> --slug my-report
    uv run scripts/publish.py <source-dir> --slug my-report --update
    uv run scripts/publish.py <source-dir> --slug my-report --dry-run

Exit status: 0 published (or dry run clean), 1 refused or failed.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_site  # noqa: E402  (shares the slug, reserved-slug and metadata rules with the CI build)

BRANCH = "main"
MAX_FILE_BYTES = 50 * 1024 * 1024
SKIP_DIRS = {".git", "node_modules", "__pycache__"}
SKIP_FILES = {".DS_Store", "Thumbs.db"}

# Every pattern is a hard stop: the page goes public the moment it is pushed.
SECRET_PATTERNS = [
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("AWS access key id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("JSON Web Token", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
    (
        "credential assignment",
        re.compile(r"""(?i)\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']"""),
    ),
]
SECRET_FILENAMES = re.compile(r"(?i)^(?:\.env(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)|credentials|.*\.(?:pem|key|p12|pfx|kdbx))$")
# Root-absolute references break under the /kai-artifact/ project path.
ROOT_ABSOLUTE = re.compile(r"""(?i)\b(?:src|href|action)\s*=\s*["']/(?!/)""")
HTML_SUFFIXES = {".html", ".htm"}


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(["git", *args], cwd=build_site.ROOT, text=True, capture_output=True)
    if check and result.returncode != 0:
        fail(f"git {' '.join(args)} failed: {(result.stderr or result.stdout).strip()}")
    return result


def iter_source_files(source: Path):
    for path in sorted(source.rglob("*")):
        rel = path.relative_to(source)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        yield path, rel


def check_source(source: Path) -> list[str]:
    """Return every reason the folder must not be published; secrets are reported by location only, never by value."""
    problems: list[str] = []
    index = source / "index.html"
    if not index.is_file():
        problems.append("source folder has no index.html")
    for path, rel in iter_source_files(source):
        if path.is_symlink():
            problems.append(f"{rel}: symbolic links are not published")
            continue
        if path.is_dir():
            continue
        if SECRET_FILENAMES.match(path.name):
            problems.append(f"{rel}: file name looks like key or credential material")
            continue
        if path.stat().st_size > MAX_FILE_BYTES:
            problems.append(f"{rel}: larger than {MAX_FILE_BYTES // (1024 * 1024)} MB")
            continue
        data = path.read_bytes()
        if b"\0" in data[:8192]:
            continue  # binary: pattern scan only makes sense on text
        text = data.decode("utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), 1):
            for label, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    problems.append(f"{rel}:{lineno}: possible {label}")
            if path.suffix.lower() in HTML_SUFFIXES and ROOT_ABSOLUTE.search(line):
                problems.append(f"{rel}:{lineno}: root-absolute src/href/action; use a relative path")
    if index.is_file():
        meta = build_site._MetaParser()
        meta.feed(index.read_text(encoding="utf-8", errors="replace"))
        if not build_site._collapse(meta.title):
            problems.append("index.html has no <title>")
        if not build_site._collapse(meta.description):
            problems.append('index.html has no <meta name="description" content="...">')
        if not meta.lang.strip():
            problems.append('index.html has no lang on the <html> element (for example <html lang="en">)')
    return problems


def preflight(slug: str, update: bool) -> Path:
    if not build_site.SLUG_RE.match(slug):
        fail(f"slug '{slug}' must be lowercase kebab-case (a-z, 0-9, '-')")
    if slug in build_site.RESERVED_SLUGS:
        fail(f"slug '{slug}' is reserved for the home page")
    dest = build_site.ARTIFACTS_DIR / slug
    if dest.exists() and not update:
        fail(f"artifact '{slug}' already exists; pass --update to replace it (its link stays the same)")
    if update and not dest.exists():
        fail(f"--update given but artifact '{slug}' does not exist")
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if branch != BRANCH:
        fail(f"checkout is on '{branch}', expected '{BRANCH}'")
    if git("status", "--porcelain", "--", "artifacts").stdout.strip():
        fail("artifacts/ has uncommitted changes in this checkout; use a fresh clone")
    for key in ("user.name", "user.email"):
        if not git("config", key, check=False).stdout.strip():
            fail(f"git {key} is not set; set it before publishing so the commit has an author")
    return dest


def copy_into(source: Path, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for path, rel in iter_source_files(source):
        target = dest / rel
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def rollback(slug: str) -> None:
    git("restore", "--staged", "--worktree", "--", f"artifacts/{slug}", check=False)
    git("clean", "-fdq", "--", f"artifacts/{slug}", check=False)


def push() -> None:
    for attempt in (1, 2):
        git("pull", "--rebase", "--autostash", "origin", BRANCH)
        result = git("push", "origin", f"HEAD:{BRANCH}", check=False)
        if result.returncode == 0:
            return
        if attempt == 2:
            fail(f"git push failed: {(result.stderr or result.stdout).strip()}")
        print("push rejected, retrying once after a fresh pull")


def wait_for_page(url: str, timeout: int) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(10)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path, help="folder that holds index.html and its assets")
    parser.add_argument("--slug", required=True, help="public name: the page is served at <base-url><slug>/")
    parser.add_argument("--update", action="store_true", help="replace an artifact that already exists")
    parser.add_argument("--dry-run", action="store_true", help="validate and scan, then undo the copy; no commit, no push")
    parser.add_argument("--base-url", default="https://the-khiem7.github.io/kai-artifact/")
    parser.add_argument("--wait", type=int, default=240, help="seconds to wait for the live page; 0 skips the wait")
    args = parser.parse_args()

    source = args.source.resolve()
    if not source.is_dir():
        fail(f"source '{args.source}' is not a folder")
    base_url = build_site._normalize_base(args.base_url)
    url = f"{base_url}{args.slug}/"

    dest = preflight(args.slug, args.update)
    problems = check_source(source)
    if problems:
        for p in problems:
            print(f"error: {p}", file=sys.stderr)
        fail(f"{len(problems)} problem(s) in the source folder; nothing was copied or pushed")

    copy_into(source, dest)
    try:
        build_site.discover()  # exits 1 on any registry rule violation
    except SystemExit:
        rollback(args.slug)
        raise
    if args.dry_run:
        rollback(args.slug)
        print(f"dry run ok: '{args.slug}' passes every check; nothing committed or pushed. It would be served at {url}")
        return

    verb = "update" if args.update else "add"
    git("add", "--", f"artifacts/{args.slug}")
    git("commit", "-m", f"feat(artifact): {verb} {args.slug}", "--", f"artifacts/{args.slug}")
    push()
    print(f"pushed '{args.slug}' to {BRANCH}; CI deploys it")
    print(f"link: {url}")
    if args.wait > 0:
        if wait_for_page(url, args.wait):
            print("live: the page answers 200")
        else:
            print(f"not live yet after {args.wait}s: deploy status not confirmed; check the Actions run of the registry repo")
    else:
        print("deploy status not checked")


if __name__ == "__main__":
    main()
