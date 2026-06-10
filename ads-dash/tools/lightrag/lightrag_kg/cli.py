"""`rag` — unified CLI over the lightrag-kg package.

See README.md for the full subcommand list. All commands accept --json.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

from rich.console import Console
from rich.markdown import Markdown
from rich.table import Table

from . import config, rag as rag_mod

console = Console()


# --- helpers ---

def _load_graph_safe():
    try:
        import networkx as nx
    except Exception as e:
        console.print(f"[red]networkx import failed: {e}[/red]")
        return None
    gf = config.WORKING_DIR / "graph_chunk_entity_relation.graphml"
    if not gf.exists():
        console.print(
            f"[yellow]No graph yet at {gf}. Run `rag index --full` first.[/yellow]"
        )
        return None
    try:
        return nx.read_graphml(str(gf))
    except Exception as e:
        console.print(f"[red]Failed to read graph: {e}[/red]")
        return None


# --- commands ---

async def cmd_search(args):
    mode = args.mode
    ans = await rag_mod.query(args.term, mode=mode)
    if args.json:
        print(json.dumps({"mode": mode, "answer": ans}))
    else:
        console.print(Markdown(ans or ""))


async def cmd_stats(args):
    info = await rag_mod.stats()
    if args.json:
        print(json.dumps(info, indent=2))
        return
    t = Table(title="LightRAG stats")
    t.add_column("metric")
    t.add_column("value", justify="right")
    for k, v in info.items():
        t.add_row(k, str(v))
    console.print(t)


async def cmd_top(args):
    g = _load_graph_safe()
    if g is None:
        sys.exit(1)
    deg = sorted(g.degree, key=lambda x: x[1], reverse=True)[: args.n]
    if args.json:
        print(json.dumps([{"entity": n, "degree": d} for n, d in deg], indent=2))
        return
    t = Table(title=f"Top {args.n} entities by degree")
    t.add_column("entity")
    t.add_column("degree", justify="right")
    for n, d in deg:
        t.add_row(str(n), str(d))
    console.print(t)


async def cmd_find(args):
    g = _load_graph_safe()
    if g is None:
        sys.exit(1)
    needle = args.term.lower()
    matches = [n for n in g.nodes() if needle in str(n).lower()][:50]
    if args.json:
        print(json.dumps(matches, indent=2))
        return
    if not matches:
        console.print(f"[yellow]No matches for '{args.term}'.[/yellow]")
        return
    for n in matches:
        d = g.nodes[n]
        console.print(
            f"- [bold]{n}[/bold]  ({d.get('entity_type', '?')}, degree={g.degree(n)})"
        )


async def cmd_show(args):
    g = _load_graph_safe()
    if g is None:
        sys.exit(1)
    name = args.term
    if name not in g:
        cand = [n for n in g.nodes() if name.lower() in str(n).lower()]
        if not cand:
            console.print(f"[red]Entity not found: {name}[/red]")
            sys.exit(1)
        name = cand[0]
        console.print(f"[dim](matched: {name})[/dim]")
    d = g.nodes[name]
    info = {
        "entity": name,
        "entity_type": d.get("entity_type", "?"),
        "description": d.get("description", ""),
        "degree": g.degree(name),
        "file_paths": [
            p.strip()
            for p in str(d.get("file_path", "")).split("<SEP>")
            if p.strip()
        ],
        "neighbors": sorted(g.neighbors(name)),
    }
    if args.json:
        print(json.dumps(info, indent=2))
        return
    console.print(
        f"\n[bold]{name}[/bold]  ({info['entity_type']}, degree={info['degree']})"
    )
    if info["description"]:
        console.print(f"\n[dim]{info['description']}[/dim]")
    if info["neighbors"]:
        console.print(f"\n[bold]Neighbors ({len(info['neighbors'])}):[/bold]")
        for nb in info["neighbors"][:50]:
            console.print(f"  - {nb}")
    if info["file_paths"]:
        console.print(f"\n[bold]Appears in ({len(info['file_paths'])}):[/bold]")
        for fp in info["file_paths"][:20]:
            console.print(f"  - {fp}")


async def cmd_insert(args):
    text = args.text
    source = args.source or "ad-hoc"
    wrapped = f"FILE: notes/{source}\nLANG: markdown\n---\n{text}"
    doc_id = f"doc-note-{hashlib.sha1(wrapped.encode()).hexdigest()[:12]}"
    await rag_mod.insert_texts(
        [wrapped], ids=[doc_id], file_paths=[f"notes/{source}"]
    )
    if args.json:
        print(json.dumps({"ok": True, "doc_id": doc_id}))
    else:
        console.print(f"[green]Inserted[/green] as {doc_id}")


async def cmd_shell(args):
    try:
        from prompt_toolkit import PromptSession

        sess = PromptSession()
        prompt_fn = lambda: sess.prompt("rag> ")
    except Exception:
        prompt_fn = lambda: input("rag> ")

    console.print(
        "[dim]Interactive RAG shell. "
        "/local X · /global X · /chunks X · /stats · /top [N] · /find X · /show X · /exit[/dim]"
    )
    ns = argparse.Namespace
    while True:
        try:
            line = prompt_fn()
        except (EOFError, KeyboardInterrupt):
            console.print()
            break
        line = (line or "").strip()
        if not line:
            continue
        if line in ("/exit", "/quit", "exit", "quit"):
            break
        if line.startswith("/stats"):
            await cmd_stats(ns(json=False))
            continue
        if line.startswith("/top"):
            parts = line.split()
            n = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 20
            await cmd_top(ns(n=n, json=False))
            continue
        if line.startswith("/find "):
            await cmd_find(ns(term=line[6:].strip(), json=False))
            continue
        if line.startswith("/show "):
            await cmd_show(ns(term=line[6:].strip(), json=False))
            continue
        if line.startswith("/local "):
            await cmd_search(ns(term=line[7:].strip(), mode="local", json=False))
            continue
        if line.startswith("/global "):
            await cmd_search(ns(term=line[8:].strip(), mode="global", json=False))
            continue
        if line.startswith("/chunks "):
            await cmd_search(ns(term=line[8:].strip(), mode="naive", json=False))
            continue
        await cmd_search(ns(term=line, mode="hybrid", json=False))


async def cmd_index(args):
    from . import index as idx

    mode = "full" if args.full else "incremental"
    await idx.run_index(mode=mode, dry_run=args.dry_run)


async def cmd_export(args):
    from . import to_obsidian as exp

    exp.export(clean=args.clean)


async def cmd_mcp_check(args):
    import importlib

    proj = config.PROJECT_ROOT
    mcp_path = proj / ".mcp.json"
    results: list[tuple[bool, str]] = []

    def add(ok: bool, msg: str):
        results.append((ok, msg))

    if not mcp_path.exists():
        add(False, f".mcp.json not found at {mcp_path}")
    else:
        try:
            data = json.loads(mcp_path.read_text(encoding="utf-8"))
            srv = (data.get("mcpServers") or {}).get("lightrag")
            if srv is None:
                add(False, ".mcp.json has no 'lightrag' server entry")
            else:
                add(True, f".mcp.json has 'lightrag' entry (command={srv.get('command')})")
                args_list = srv.get("args", [])
                if "--project" in args_list:
                    i = args_list.index("--project")
                    if i + 1 < len(args_list):
                        proj_arg = Path(args_list[i + 1])
                        if proj_arg.resolve() == config.PACKAGE_ROOT.resolve():
                            add(True, f"--project points to {config.PACKAGE_ROOT}")
                        else:
                            add(False, f"--project={proj_arg} (expected {config.PACKAGE_ROOT})")
        except Exception as e:
            add(False, f".mcp.json parse error: {e}")

    try:
        importlib.import_module("lightrag_kg.server")
        add(True, "lightrag_kg.server importable")
    except Exception as e:
        add(False, f"lightrag_kg.server import failed: {e}")

    if config.WORKING_DIR.exists() and any(config.WORKING_DIR.iterdir()):
        add(True, f"rag_storage/ has data at {config.WORKING_DIR}")
    else:
        add(False, f"rag_storage/ empty — run `rag index --full` first ({config.WORKING_DIR})")

    if args.json:
        print(json.dumps([{"ok": ok, "msg": m} for ok, m in results], indent=2))
    else:
        for ok, msg in results:
            marker = "[green]OK[/green]" if ok else "[red]FAIL[/red]"
            console.print(f"{marker}  {msg}")


# --- main ---

def main():
    p = argparse.ArgumentParser(prog="rag", description="LightRAG knowledge graph CLI")
    p.add_argument("--json", action="store_true", help="Machine-readable output (prefix form)")

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", help="Machine-readable output")

    sub = p.add_subparsers(dest="cmd", required=True)

    for name, mode, helpline in [
        ("search", "hybrid", "Hybrid query with synthesis (default)"),
        ("ask", "hybrid", "Alias for search"),
        ("chunks", "naive", "Naive vector search only"),
        ("local", "local", "Local query (entity neighborhood)"),
        ("global", "global", "Global query (themes / communities)"),
    ]:
        sp = sub.add_parser(name, help=helpline, parents=[common])
        sp.add_argument("term", nargs="+")
        sp.set_defaults(func=cmd_search, mode=mode)

    sub.add_parser("stats", help="Graph counts", parents=[common]).set_defaults(func=cmd_stats)

    sp = sub.add_parser("top", help="Top N entities by degree", parents=[common])
    sp.add_argument("n", nargs="?", type=int, default=20)
    sp.set_defaults(func=cmd_top)

    sp = sub.add_parser("find", help="Find entity by substring", parents=[common])
    sp.add_argument("term", nargs="+")
    sp.set_defaults(func=cmd_find)

    sp = sub.add_parser("show", help="Show entity details", parents=[common])
    sp.add_argument("term", nargs="+")
    sp.set_defaults(func=cmd_show)

    sp = sub.add_parser("insert", help="Insert ad-hoc text", parents=[common])
    sp.add_argument("text")
    sp.add_argument("--source", default=None)
    sp.set_defaults(func=cmd_insert)

    sub.add_parser("shell", help="Interactive REPL", parents=[common]).set_defaults(func=cmd_shell)

    sp = sub.add_parser("index", help="(Re)index project files", parents=[common])
    g = sp.add_mutually_exclusive_group()
    g.add_argument("--full", action="store_true")
    g.add_argument("--incremental", action="store_true")
    sp.add_argument("--dry-run", action="store_true")
    sp.set_defaults(func=cmd_index)

    sp = sub.add_parser("export", help="Export Obsidian vault", parents=[common])
    sp.add_argument("--clean", action="store_true")
    sp.set_defaults(func=cmd_export)

    sub.add_parser("mcp-check", help="Validate MCP setup", parents=[common]).set_defaults(func=cmd_mcp_check)

    args = p.parse_args()
    if hasattr(args, "term") and isinstance(args.term, list):
        args.term = " ".join(args.term)
    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
