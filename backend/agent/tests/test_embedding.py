from __future__ import annotations

import pytest

from app.memory.embedding import (
    LOCAL_EMBEDDING_DIMENSIONS,
    LOCAL_EMBEDDING_MODEL,
    LocalChromaEmbeddingModel,
)


@pytest.mark.asyncio
async def test_local_chroma_embedding_adapter_returns_agent_scope_response():
    calls: list[list[str]] = []

    def fake_embedding(inputs: list[str]):
        calls.append(inputs)
        return [[float(index)] * LOCAL_EMBEDDING_DIMENSIONS for index, _ in enumerate(inputs, 1)]

    model = LocalChromaEmbeddingModel(embedding_function=fake_embedding)
    response = await model(["BFS", "sliding window"])

    assert model.model == LOCAL_EMBEDDING_MODEL
    assert model.dimensions == LOCAL_EMBEDDING_DIMENSIONS
    assert calls == [["BFS", "sliding window"]]
    assert response.source == "api"
    assert response.embeddings[0] == [1.0] * LOCAL_EMBEDDING_DIMENSIONS
    assert response.embeddings[1] == [2.0] * LOCAL_EMBEDDING_DIMENSIONS
    assert response.usage is not None
