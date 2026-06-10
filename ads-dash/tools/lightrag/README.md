# lightrag-kg

LightRAG knowledge graph for **ads-dash**. Provides:

- MCP stdio server (3 tools: `kg_query`, `kg_insert_text`, `kg_stats`)
- Unified CLI `rag` (search, stats, shell, etc.)
- Obsidian vault export

## Quickstart (Windows / PowerShell)

```powershell
uv sync
.\.venv\Scripts\Activate.ps1
rag index --dry-run
rag index --full
rag export --clean
rag search "your question"
```

## Subcommands

| Command | Mode | Use |
|---|---|---|
| `rag search "X"` | hybrid | Synthesized answer + citations (default) |
| `rag ask "X"` | hybrid | Alias for search |
| `rag local "X"` | local | Entity neighborhood |
| `rag global "X"` | global | Themes/communities |
| `rag chunks "X"` | naive | Vector search only |
| `rag stats` | — | Graph counts |
| `rag top [N]` | — | Top N entities by degree |
| `rag find "X"` | — | Substring search in entity names |
| `rag show "X"` | — | Full entity card + neighbors |
| `rag shell` | — | Interactive REPL |
| `rag insert "text" --source label` | — | Ad-hoc note |
| `rag index --full \| --incremental \| --dry-run` | — | (Re)index |
| `rag export --clean` | — | Refresh Obsidian vault |
| `rag mcp-check` | — | Validate MCP setup |

All commands accept `--json` for machine-readable output.
