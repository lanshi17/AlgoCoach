"""Local embedding model shared by ReMe and the existing Chroma store.

Chroma's default embedding function is the local ONNX
``all-MiniLM-L6-v2`` model (384 dimensions). AgentScope expects an
``EmbeddingModelBase`` instance when ReMe's vector store is enabled, so this
small adapter lets both stores use the same local model without an API key or
an additional embedding service.
"""
from __future__ import annotations

import asyncio
import threading
import time
from collections.abc import Callable, Sequence
from typing import Any, cast

from agentscope.credential import CredentialBase
from agentscope.embedding import EmbeddingModelBase, EmbeddingResponse, EmbeddingUsage

LOCAL_EMBEDDING_DIMENSIONS = 384
LOCAL_EMBEDDING_MODEL = "local-chroma-all-MiniLM-L6-v2"


class LocalChromaEmbeddingModel(EmbeddingModelBase[str]):
    """AgentScope adapter around Chroma's bundled local embedding function."""

    def __init__(
        self,
        *,
        embedding_function: Callable[[list[str]], Sequence[Sequence[float]]] | None = None,
    ) -> None:
        super().__init__(
            CredentialBase(),
            LOCAL_EMBEDDING_MODEL,
            LOCAL_EMBEDDING_DIMENSIONS,
            None,
            8_192,
            64,
            0,
            0.0,
        )
        self._embedding_function = embedding_function
        self._embedding_lock = threading.Lock()

    def _get_embedding_function(self) -> Callable[[list[str]], Sequence[Sequence[float]]]:
        function = self._embedding_function
        if function is None:
            with self._embedding_lock:
                if self._embedding_function is None:
                    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

                    # Chroma lazily downloads its ONNX model on the first call;
                    # constructing the function itself is local and cheap.
                    self._embedding_function = cast(
                        Callable[[list[str]], Sequence[Sequence[float]]],
                        DefaultEmbeddingFunction(),
                    )
                function = self._embedding_function
        assert function is not None
        return function

    async def _call_api(self, inputs: list[str], **_: Any) -> EmbeddingResponse:
        started = time.perf_counter()
        function = self._get_embedding_function()
        vectors = await asyncio.to_thread(function, [str(value) for value in inputs])
        embeddings = [list(map(float, vector)) for vector in vectors]
        if any(len(vector) != self.dimensions for vector in embeddings):
            raise ValueError(
                f"local embedding model returned an unexpected dimension; "
                f"expected {self.dimensions}",
            )
        return EmbeddingResponse(
            embeddings=embeddings,
            usage=EmbeddingUsage(
                time=time.perf_counter() - started,
                tokens=None,
            ),
        )


def create_local_embedding_model() -> LocalChromaEmbeddingModel:
    """Create the default local model used by ReMe's vector index."""
    return LocalChromaEmbeddingModel()
