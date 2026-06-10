"""kg-index CLI — discover files, wrap content, batch-insert into LightRAG."""

from __future__ import annotations

import argparse
import asyncio
import fnmatch
import hashlib
import json
import re
import time
from pathlib import Path

from rich.console import Console

from . import config, rag as rag_mod

console = Console()


def sha1_bytes(b: bytes) -> str:
    return hashlib.sha1(b).hexdigest()


def slugify(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"[/\\]", "-", text)
    text = re.sub(r"[^a-z0-9\s_-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-_")
    return text[:180] if text else "unknown"


def load_manifest() -> dict:
    if config.MANIFEST.exists():
        try:
            return json.loads(config.MANIFEST.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_manifest(m: dict) -> None:
    config.MANIFEST.write_text(json.dumps(m, indent=2, sort_keys=True), encoding="utf-8")


def detect_lang(p: Path) -> str:
    return config.LANG_BY_EXT.get(p.suffix.lower(), "text")


def discover_files():
    root = config.PROJECT_ROOT
    results = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        try:
            rel = p.relative_to(root)
        except ValueError:
            continue
        rel_posix = rel.as_posix()

        if set(rel.parts) & config.EXCLUDE_DIRS:
            continue
        if any(
            fnmatch.fnmatch(rel_posix, g) or fnmatch.fnmatch(p.name, g)
            for g in config.EXCLUDE_GLOBS
        ):
            continue
        if any(fnmatch.fnmatch(rel_posix, g) for g in config.INCLUDE_GLOBS):
            try:
                if p.stat().st_size > config.MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            results.append(rel)
    return sorted(results, key=lambda x: x.as_posix())


def read_file(rel: Path):
    p = config.PROJECT_ROOT / rel
    try:
        b = p.read_bytes()
    except OSError:
        return None, None
    try:
        text = b.decode("utf-8")
    except UnicodeDecodeError:
        return None, None
    return text, sha1_bytes(b)


def wrap_content(rel: Path, content: str, lang: str) -> str:
    return f"FILE: {rel.as_posix()}\nLANG: {lang}\n---\n{content}"


def doc_id_for(rel: Path) -> str:
    return f"doc-{hashlib.sha1(rel.as_posix().encode()).hexdigest()[:12]}"


async def run_index(mode: str = "incremental", dry_run: bool = False):
    manifest = {} if mode == "full" else load_manifest()
    files = discover_files()
    plan = []
    for rel in files:
        content, sha = read_file(rel)
        if content is None:
            continue
        prev = manifest.get(rel.as_posix())
        if mode != "full" and prev == sha[:16]:
            continue
        lang = detect_lang(config.PROJECT_ROOT / rel)
        plan.append((rel, content, sha, lang))

    console.print(f"[bold]Discovered:[/bold] {len(files)} files | [bold]To index:[/bold] {len(plan)}")
    if not plan:
        console.print("[green]Nothing to do.[/green]")
        return

    total_chars = sum(len(c) for _, c, _, _ in plan)
    est_tokens = total_chars // 4
    console.print(
        f"[bold]Approx chars:[/bold] {total_chars:,}  "
        f"[bold]Approx input tokens:[/bold] {est_tokens:,}"
    )

    if dry_run:
        console.print("\n[bold]Sample of files that would be indexed:[/bold]")
        for rel, _, _, lang in plan[:50]:
            console.print(f"  - {rel.as_posix()}  ({lang})")
        if len(plan) > 50:
            console.print(f"  ... and {len(plan) - 50} more")
        return

    texts = [wrap_content(rel, c, lang) for rel, c, _, lang in plan]
    ids = [doc_id_for(rel) for rel, _, _, _ in plan]
    paths = [rel.as_posix() for rel, _, _, _ in plan]

    started = time.time()
    console.print(f"\n[bold]Inserting {len(texts)} docs (this writes to OpenAI)...[/bold]")
    await rag_mod.insert_texts(texts, ids=ids, file_paths=paths)
    elapsed = time.time() - started

    new_manifest = manifest if mode != "full" else {}
    for rel, _, sha, _ in plan:
        new_manifest[rel.as_posix()] = sha[:16]
    save_manifest(new_manifest)

    console.print(f"\n[green]Done in {elapsed:.1f}s.[/green]  Manifest updated.")


def main():
    p = argparse.ArgumentParser(prog="kg-index")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--full", action="store_true", help="Reindex everything; ignore manifest.")
    g.add_argument("--incremental", action="store_true", help="Only reindex changed files (default).")
    p.add_argument("--dry-run", action="store_true", help="Show plan without inserting.")
    args = p.parse_args()
    mode = "full" if args.full else "incremental"
    asyncio.run(run_index(mode=mode, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
