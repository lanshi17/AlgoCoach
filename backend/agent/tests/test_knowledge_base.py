from __future__ import annotations

import json
import zipfile

import pytest

from app.memory import knowledge_base as kb


class FakeStore:
    def __init__(self):
        self.records = {}
        self.embedding = None

    async def upsert(self, _collection, records):
        self.records.update({record.id: record for record in records})
        return len(records)

    async def delete(self, _collection, *, where=None, ids=None):
        before = len(self.records)
        for record_id in list(self.records):
            record = self.records[record_id]
            if ids and record_id in ids:
                del self.records[record_id]
            elif where and all(record.metadata.get(key) == value for key, value in where.items()):
                del self.records[record_id]
        return before - len(self.records)

    async def count(self, _collection):
        return len(self.records)

    async def ids(self, _collection, *, where=None):
        return [record_id for record_id, record in self.records.items()
                if not where or all(record.metadata.get(key) == value for key, value in where.items())]

    async def reset(self):
        self.embedding = None

    def configure_embedding(self, embedding):
        self.embedding = embedding


@pytest.mark.asyncio
async def test_upload_extracts_text_formats_and_indexes_chunks(tmp_path, monkeypatch):
    monkeypatch.setattr(kb, "knowledge_dir", lambda: str(tmp_path / "knowledge"))
    store = FakeStore()
    monkeypatch.setattr(kb, "knowledge_store", store)
    monkeypatch.setattr(kb, "_configured_signature", None)

    archive = tmp_path / "sources.zip"
    with zipfile.ZipFile(archive, "w") as output:
        output.writestr("lesson.md", "滑动窗口需要维护不变量。")
        output.writestr("data.json", json.dumps({"topic": "DP", "level": 2}))

    result = await kb.add_source("sources.zip", archive.read_bytes())

    assert result["chunks"] >= 2
    assert len(store.records) == result["chunks"]
    assert all(record.metadata["source_type"] == "user_knowledge" for record in store.records.values())
    assert kb.list_sources()[0]["name"].endswith("sources.zip")


@pytest.mark.asyncio
async def test_custom_embedding_config_is_local_and_reconfigures_store(tmp_path, monkeypatch):
    monkeypatch.setattr(kb, "knowledge_dir", lambda: str(tmp_path / "knowledge"))
    store = FakeStore()
    monkeypatch.setattr(kb, "knowledge_store", store)
    monkeypatch.setattr(kb, "_configured_signature", None)

    config = kb.configure({
        "provider": "openai-compatible",
        "model": "text-embedding-3-small",
        "baseUrl": "https://example.test/v1",
        "apiKey": "secret-value",
        "dimensions": 1536,
    })
    await kb.apply_config(config)

    assert config.public()["hasApiKey"] is True
    assert kb._collection_for(config) != kb._collection_for(kb.KnowledgeConfig())
    persisted = json.loads((tmp_path / "knowledge/config.json").read_text())
    assert persisted["apiKey"] == "secret-value"
    assert store.embedding is not None


def test_rejects_unsupported_source_and_provider(tmp_path, monkeypatch):
    monkeypatch.setattr(kb, "knowledge_dir", lambda: str(tmp_path / "knowledge"))
    with pytest.raises(kb.KnowledgeBaseError):
        kb.configure({"provider": "unknown", "model": "x"})
