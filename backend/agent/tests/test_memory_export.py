"""Local data export contains training records and configured memory files."""
import json
from io import BytesIO
from zipfile import ZipFile

import pytest

from app.memory.db import EpisodicRecord, SessionLocal
from app.memory import memory_service as memory_module

pytestmark = pytest.mark.asyncio


async def test_export_archive_contains_rows_reme_files_and_vector_store(
    client, tmp_path, monkeypatch
):
    now = "2026-11-13T12:00:00"
    async with SessionLocal() as session:
        session.add(EpisodicRecord(
            problem_id="two-sum", platform="LEETCODE", status="ACCEPTED",
            lang="python3", duration_sec=120, topics='["Array"]',
            sticking_points="[]", created_at=now,
        ))
        await session.commit()

    reme = tmp_path / "reme"
    chroma = tmp_path / "chroma"
    reme.mkdir()
    chroma.mkdir()
    (reme / "memory.md").write_text("persisted conversation memory", encoding="utf-8")
    (chroma / "index.bin").write_bytes(b"local index")
    async def export_vectors():
        return {"problem_content": [{"id": "two-sum", "document": "statement", "metadata": {}}]}

    monkeypatch.setattr(memory_module, "reme_workspace_dir", lambda: str(reme))
    monkeypatch.setattr(memory_module, "chroma_path", lambda: str(chroma))
    monkeypatch.setattr(memory_module.vector_store, "export_all", export_vectors)

    response = await client.get("/memory/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
    with ZipFile(BytesIO(response.content)) as archive:
        payload = json.loads(archive.read("memory.json"))
        assert payload["tables"]["episodic"][0]["problem_id"] == "two-sum"
        assert payload["vectors"]["problem_content"][0]["document"] == "statement"
        assert archive.read("reme/memory.md").decode() == "persisted conversation memory"
        assert archive.read("chroma/index.bin") == b"local index"
        assert payload["secrets_included"] is False
