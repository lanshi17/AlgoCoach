from __future__ import annotations

import json
import zipfile

from app.memory.algorithm_knowledge import seed_algorithm_knowledge


def _write_sources(root):
    archive_path = root / "01-算法套路.md.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr(
            "04-算法与编程/01-算法套路/广度优先搜索.md",
            "---\ntitle: 广度优先搜索\ndate: 2026-01-01\n---\n"
            "# 分层遍历\n\nBFS 按距离逐层搜索。\n",
        )
        archive.writestr(
            "04-算法与编程/01-算法套路/assets/bfs.png",
            b"test-image-bytes",
        )
        archive.writestr("../outside.md", "must not escape the notes directory")

def test_imports_notes_and_assets_idempotently_without_editor_sources(tmp_path):
    sources = tmp_path / "sources"
    sources.mkdir()
    _write_sources(sources)
    workspace = tmp_path / "reme"

    first = seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)

    assert (first.notes, first.assets) == (1, 1)
    assert first.written == 2
    library = workspace / "digest/wiki/algorithm-library"
    note = library / "notes/01-算法套路/广度优先搜索.md"
    assert note.is_file()
    assert "BFS 按距离逐层搜索" in note.read_text(encoding="utf-8")
    assert "source_path" in note.read_text(encoding="utf-8")
    assert (library / "notes/01-算法套路/assets/bfs.png").read_bytes() == b"test-image-bytes"
    assert not (workspace / "digest/wiki/outside.md").exists()

    manifest = json.loads((library / ".source-manifest.json").read_text(encoding="utf-8"))
    assert len(manifest["files"]) == 2

    second = seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)
    assert second.written == 0
    assert second.unchanged == 2
    assert second.removed == 0


def test_reimport_removes_only_previously_imported_stale_files(tmp_path):
    sources = tmp_path / "sources"
    sources.mkdir()
    _write_sources(sources)
    workspace = tmp_path / "reme"
    seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)

    library = workspace / "digest/wiki/algorithm-library"
    stored_solution = library / "solutions/stored.cpp.md"
    stored_solution.parent.mkdir(parents=True)
    stored_solution.write_text("Stored historical solution", encoding="utf-8")
    manifest_path = library / ".source-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["files"].append("solutions/stored.cpp.md")
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with zipfile.ZipFile(sources / "01-算法套路.md.zip", "w") as archive:
        archive.writestr("outside.md", "must not escape the notes directory")
    (workspace / "digest/wiki/algorithm-library/manual-note.md").write_text(
        "Manual ReMe note; importer does not own this file.\n", encoding="utf-8"
    )
    update = seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)

    assert update.removed == 2
    assert not (library / "notes/01-算法套路/广度优先搜索.md").exists()
    assert stored_solution.read_text(encoding="utf-8") == "Stored historical solution"
    assert (library / "manual-note.md").read_text(encoding="utf-8").startswith("Manual ReMe")
