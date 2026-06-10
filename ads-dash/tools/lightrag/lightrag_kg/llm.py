"""OpenAI provider wrapper with tenacity retry on transient errors.

Exposes:
  - llm_complete(prompt, ...)         -> str   (chat)
  - embed(texts)                      -> list[list[float]]
  - get_embedding_func()              -> lightrag EmbeddingFunc
  - resolved_models()                 -> dict
  - probe()                           -> dict   (sanity check)
"""

from __future__ import annotations

import os
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    RateLimitError,
)
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.utils import EmbeddingFunc

from . import config  # noqa: F401 — side-effect: loads .env.local

LLM_MODEL = "gpt-4o-mini"
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536
EMBED_MAX_TOKENS = 8192


def _is_retryable_exc(exc):
    if isinstance(exc, (RateLimitError, APITimeoutError, APIConnectionError)):
        return True
    if isinstance(exc, APIStatusError):
        return exc.status_code in (429, 500, 502, 503, 504)
    return False


_retry = retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception(_is_retryable_exc),
    reraise=True,
)


@_retry
async def llm_complete(
    prompt,
    system_prompt=None,
    history_messages=None,
    keyword_extraction=False,
    **kwargs,
):
    history_messages = history_messages or []
    return await openai_complete_if_cache(
        LLM_MODEL,
        prompt,
        system_prompt=system_prompt,
        history_messages=history_messages,
        **kwargs,
    )


@_retry
async def embed(texts):
    return await openai_embed(texts, model=EMBED_MODEL)


def get_embedding_func():
    return EmbeddingFunc(
        embedding_dim=EMBED_DIM,
        max_token_size=EMBED_MAX_TOKENS,
        func=embed,
    )


def resolved_models():
    return {"llm": LLM_MODEL, "embed": EMBED_MODEL}


async def probe():
    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY not set (looked in .env.local at project root)")
    llm_reply = await llm_complete("Reply with the single word: OK")
    emb = await embed(["probe"])
    return {
        "ok": True,
        "llm_reply": (llm_reply or "").strip(),
        "embed_dim": len(emb[0]) if emb is not None and len(emb) else 0,
        "models": resolved_models(),
    }
