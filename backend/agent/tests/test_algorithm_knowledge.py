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

    editor = root / "editor"
    (editor / "cn").mkdir(parents=True)
    (editor / "cn" / "4-sum.cpp").write_text(
        "/*\n * [18] 四数之和\n */\nclass Solution {};\n",
        encoding="utf-8",
    )
    (editor / "en").mkdir()
    (editor / "en" / "template.rs").write_text(
        "fn main() {}\n",
        encoding="utf-8",
    )
    (editor / "cn" / ".lcpr_data").mkdir()
    (editor / "cn" / ".lcpr_data" / "group.json").write_text(
        '{"private": "sidecar metadata is not a solution"}',
        encoding="utf-8",
    )


def test_imports_notes_assets_and_historical_solutions_idempotently(tmp_path):
    sources = tmp_path / "sources"
    sources.mkdir()
    _write_sources(sources)
    workspace = tmp_path / "reme"

    first = seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)

    assert (first.notes, first.solutions, first.assets) == (1, 2, 1)
    assert first.written == 4
    library = workspace / "digest/wiki/algorithm-library"
    note = library / "notes/01-算法套路/广度优先搜索.md"
    solution = library / "solutions/cn/4-sum.cpp.md"
    template = library / "solutions/en/template.rs.md"
    assert note.is_file()
    assert "BFS 按距离逐层搜索" in note.read_text(encoding="utf-8")
    assert "source_path" in note.read_text(encoding="utf-8")
    assert (library / "notes/01-算法套路/assets/bfs.png").read_bytes() == b"test-image-bytes"
    assert "四数之和" in solution.read_text(encoding="utf-8")
    assert "class Solution {};" in solution.read_text(encoding="utf-8")
    assert "code_template" in template.read_text(encoding="utf-8")
    assert not (workspace / "digest/wiki/outside.md").exists()
    assert not any("sidecar metadata" in path.read_text(encoding="utf-8")
                   for path in library.rglob("*.md"))

    manifest = json.loads((library / ".source-manifest.json").read_text(encoding="utf-8"))
    assert len(manifest["files"]) == 4

    second = seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)
    assert second.written == 0
    assert second.unchanged == 4
    assert second.removed == 0


def test_reimport_removes_only_previously_imported_stale_files(tmp_path):
    sources = tmp_path / "sources"
    sources.mkdir()
    _write_sources(sources)
    workspace = tmp_path / "reme"
    seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)

    (sources / "editor/cn/4-sum.cpp").unlink()
    (workspace / "digest/wiki/algorithm-library/manual-note.md").write_text(
        "Manual ReMe note; importer does not own this file.\n", encoding="utf-8"
    )
    update = seed_algorithm_knowledge(source_dir=sources, workspace_dir=workspace)

    library = workspace / "digest/wiki/algorithm-library"
    assert update.removed == 1
    assert not (library / "solutions/cn/4-sum.cpp.md").exists()
    assert (library / "manual-note.md").read_text(encoding="utf-8").startswith("Manual ReMe")
