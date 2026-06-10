"""MCP stdio server. Exposes ONLY 3 tools: kg_query, kg_insert_text, kg_stats.

Reindex / export are intentionally NOT exposed — they would be expensive if the model
called them by mistake. Use the `rag` CLI for those.
"""

from __future__ import annotations

import asyncio
import hashlib
import json

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from . import rag as rag_mod

server = Server("lightrag-kg")


@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="kg_query",
            description=(
                "Query the LightRAG knowledge graph built from this project's code & docs. "
                "Modes: hybrid (default, recommended), local (entity neighborhood), "
                "global (themes/communities), naive (vector search only)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language question"},
                    "mode": {
                        "type": "string",
                        "enum": ["hybrid", "local", "global", "naive"],
                        "default": "hybrid",
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="kg_insert_text",
            description=(
                "Insert an ad-hoc text note (decision, idea, conversation snippet) into the "
                "knowledge graph. Use `source` to label provenance."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "source": {
                        "type": "string",
                        "description": "Provenance label, e.g. 'chat-2026-06-09'",
                    },
                },
                "required": ["text"],
            },
        ),
        Tool(
            name="kg_stats",
            description="Return counts of entities, relations, docs, and chunks.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name, arguments):
    if name == "kg_query":
        mode = arguments.get("mode", "hybrid")
        ans = await rag_mod.query(arguments["query"], mode=mode)
        return [TextContent(type="text", text=ans or "")]

    if name == "kg_insert_text":
        text = arguments["text"]
        source = arguments.get("source") or "ad-hoc"
        wrapped = f"FILE: notes/{source}\nLANG: markdown\n---\n{text}"
        doc_id = f"doc-note-{hashlib.sha1(wrapped.encode()).hexdigest()[:12]}"
        await rag_mod.insert_texts(
            [wrapped],
            ids=[doc_id],
            file_paths=[f"notes/{source}"],
        )
        return [TextContent(type="text", text=f"inserted as {doc_id}")]

    if name == "kg_stats":
        info = await rag_mod.stats()
        return [TextContent(type="text", text=json.dumps(info, indent=2))]

    return [TextContent(type="text", text=f"unknown tool: {name}")]


async def amain():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


def main():
    asyncio.run(amain())


if __name__ == "__main__":
    main()
