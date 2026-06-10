"""Singleton LightRAG factory + thin async helpers."""

from __future__ import annotations

import asyncio
import json

from lightrag import LightRAG, QueryParam
from lightrag.kg.shared_storage import initialize_pipeline_status

from . import config, llm

_rag = None
_lock = asyncio.Lock()


async def get_rag():
    global _rag
    if _rag is not None:
        return _rag
    async with _lock:
        if _rag is not None:
            return _rag
        config.WORKING_DIR.mkdir(parents=True, exist_ok=True)
        r = LightRAG(
            working_dir=str(config.WORKING_DIR),
            llm_model_func=llm.llm_complete,
            embedding_func=llm.get_embedding_func(),
            llm_model_max_async=8,
            max_parallel_insert=6,
            embedding_batch_num=32,
            chunk_token_size=1200,
            chunk_overlap_token_size=100,
        )
        await r.initialize_storages()
        await initialize_pipeline_status()
        _rag = r
        return _rag


async def query(text, mode="hybrid"):
    r = await get_rag()
    return await r.aquery(text, param=QueryParam(mode=mode))


async def insert_texts(texts, ids=None, file_paths=None):
    r = await get_rag()
    await r.ainsert(texts, ids=ids, file_paths=file_paths)


async def stats():
    info = {"entities": 0, "relations": 0, "docs": 0, "chunks": 0}
    wd = config.WORKING_DIR

    graph_file = wd / "graph_chunk_entity_relation.graphml"
    if graph_file.exists():
        try:
            import networkx as nx

            g = nx.read_graphml(str(graph_file))
            info["entities"] = g.number_of_nodes()
            info["relations"] = g.number_of_edges()
        except Exception:
            pass

    for key, fname in [
        ("docs", "kv_store_doc_status.json"),
        ("chunks", "kv_store_text_chunks.json"),
    ]:
        f = wd / fname
        if f.exists():
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                info[key] = len(d)
            except Exception:
                pass

    return info
