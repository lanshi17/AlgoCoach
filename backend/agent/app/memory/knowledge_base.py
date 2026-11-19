"""User-managed knowledge sources and configurable embedding index."""
from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import os
import re
import stat
import threading
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree

import httpx

from app.config import knowledge_dir
from app.memory.db import DEFAULT_WORKSPACE_ID
from app.memory.vector_store import (
    COLLECTION_USER_KNOWLEDGE,
    VectorStore,
    VectorRecord,
)

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_TOTAL_BYTES = 100 * 1024 * 1024
MAX_FILES = 20
MAX_TEXT_CHARS = 2_000_000
CHUNK_CHARS = 1_200
CHUNK_OVERLAP = 120
ALLOWED_SUFFIXES = {
    ".txt", ".md", ".markdown", ".rst", ".log", ".json", ".csv", ".tsv",
    ".yaml", ".yml", ".html", ".htm", ".pdf", ".docx", ".zip",
}


class KnowledgeBaseError(ValueError):
    """A user-correctable knowledge-base request error."""


class RemoteEmbeddingFunction:
    """Chroma callable for OpenAI-compatible ``/embeddings`` providers."""

    def __init__(self, base_url: str, model: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self._lock = threading.Lock()

    @staticmethod
    def name() -> str:
        return "algocoach-remote-embeddings"

    def embed_documents(self, input: list[str]) -> list[list[float]]:
        return self(input)

    def embed_query(self, input: str) -> list[list[float]]:
        return self([input])

    def is_legacy(self) -> bool:
        return True

    def __call__(self, input: list[str]) -> list[list[float]]:
        endpoint = self.base_url
        if not endpoint.endswith("/embeddings"):
            endpoint += "/embeddings"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            with self._lock, httpx.Client(timeout=60.0) as client:
                response = client.post(endpoint, headers=headers, json={
                    "model": self.model, "input": input,
                })
        except httpx.TimeoutException as exc:
            raise KnowledgeBaseError("embedding Provider 请求超时，请检查网络或稍后重试") from exc
        except httpx.HTTPError as exc:
            raise KnowledgeBaseError("embedding Provider 网络请求失败，请检查 Base URL") from exc
        if response.status_code >= 400:
            raise KnowledgeBaseError(
                f"embedding Provider 返回 HTTP {response.status_code}"
            )
        try:
            payload = response.json()
        except ValueError as exc:
            raise KnowledgeBaseError("embedding Provider 返回了无效 JSON") from exc
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, list) or not data:
            raise KnowledgeBaseError("embedding Provider 返回缺少 data")
        ordered = sorted(data, key=lambda item: item.get("index", 0))
        vectors = [item.get("embedding") for item in ordered]
        if not all(isinstance(vector, list) and vector for vector in vectors):
            raise KnowledgeBaseError("embedding Provider 返回了无效向量")
        return [[float(value) for value in vector] for vector in vectors]


@dataclass(frozen=True)
class KnowledgeConfig:
    provider: str = "local"
    model: str = "all-MiniLM-L6-v2"
    base_url: str = ""
    api_key: str = ""
    dimensions: int | None = None

    def public(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "baseUrl": self.base_url,
            "hasApiKey": bool(self.api_key),
            "dimensions": self.dimensions,
        }


knowledge_store = VectorStore()
_configured_signature: tuple[str, str, str, bool, int | None] | None = None


def _root() -> Path:
    path = Path(knowledge_dir()).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    (path / "sources").mkdir(exist_ok=True)
    return path


def _config_path() -> Path:
    return _root() / "config.json"


def _sources_dir(workspace_id: str = DEFAULT_WORKSPACE_ID) -> Path:
    if workspace_id == DEFAULT_WORKSPACE_ID:
        return _root() / "sources"
    digest = hashlib.sha256(workspace_id.encode("utf-8")).hexdigest()[:32]
    path = _root() / "workspaces" / digest / "sources"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _workspace_collection(config: KnowledgeConfig, workspace_id: str) -> str:
    collection = _collection_for(config)
    if workspace_id == DEFAULT_WORKSPACE_ID:
        return collection
    digest = hashlib.sha256(workspace_id.encode("utf-8")).hexdigest()[:16]
    return f"{collection}_{digest}"


def _read_config() -> KnowledgeConfig:
    try:
        payload = json.loads(_config_path().read_text(encoding="utf-8"))
        return KnowledgeConfig(
            provider=str(payload.get("provider", "local")),
            model=str(payload.get("model", "all-MiniLM-L6-v2")),
            base_url=str(payload.get("baseUrl", "")),
            api_key=str(payload.get("apiKey", "")),
            dimensions=int(payload["dimensions"]) if payload.get("dimensions") else None,
        )
    except (OSError, ValueError, TypeError):
        return KnowledgeConfig()


def _write_config(config: KnowledgeConfig) -> None:
    path = _config_path()
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps({
        "provider": config.provider, "model": config.model,
        "baseUrl": config.base_url, "apiKey": config.api_key,
        "dimensions": config.dimensions,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(temporary, stat.S_IRUSR | stat.S_IWUSR)
    temporary.replace(path)


def get_config() -> KnowledgeConfig:
    return _read_config()


def configure(payload: dict[str, Any]) -> KnowledgeConfig:
    current = _read_config()
    provider = str(payload.get("provider", current.provider)).strip().lower()
    model = str(payload.get("model", current.model)).strip()
    base_url = str(payload.get("baseUrl", current.base_url)).strip().rstrip("/")
    api_key = str(payload.get("apiKey", ""))
    if not api_key and provider != "local":
        api_key = current.api_key
    dimensions_raw = payload.get("dimensions", current.dimensions)
    if dimensions_raw in (None, ""):
        dimensions = None
    else:
        try:
            dimensions = int(str(dimensions_raw))
        except (TypeError, ValueError) as exc:
            raise KnowledgeBaseError("向量维度必须是整数") from exc
    if provider not in {"local", "openai-compatible"}:
        raise KnowledgeBaseError("只支持 local 或 openai-compatible embedding Provider")
    if not model:
        raise KnowledgeBaseError("embedding 模型名不能为空")
    if provider == "openai-compatible":
        if not base_url or not api_key:
            raise KnowledgeBaseError("自定义 embedding Provider 需要 Base URL 和 API key")
        if dimensions is None or dimensions <= 0 or dimensions > 8192:
            raise KnowledgeBaseError("自定义 embedding 需要有效的维度（1-8192）")
    next_config = KnowledgeConfig(provider, model, base_url, api_key, dimensions)
    _write_config(next_config)
    return next_config


def _embedding_for(config: KnowledgeConfig) -> Any:
    if config.provider == "local":
        return None
    return RemoteEmbeddingFunction(config.base_url, config.model, config.api_key)


def _collection_for(config: KnowledgeConfig) -> str:
    """Return the Chroma collection owned by one embedding configuration.

    Chroma persists the embedding function on a collection. Reusing the local
    collection after switching to a remote provider therefore raises a
    configuration-conflict error (and could mix vectors with different
    dimensions). Local keeps the historical collection name; each remote
    endpoint/model/dimension tuple gets a stable, separate collection.
    """
    if config.provider == "local":
        return COLLECTION_USER_KNOWLEDGE
    signature = json.dumps({
        "provider": config.provider,
        "model": config.model,
        "baseUrl": config.base_url,
        "dimensions": config.dimensions,
    }, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    suffix = hashlib.sha256(signature.encode("utf-8")).hexdigest()[:16]
    return f"{COLLECTION_USER_KNOWLEDGE}_{suffix}"


async def apply_config(config: KnowledgeConfig) -> None:
    global _configured_signature
    await knowledge_store.reset()
    knowledge_store.configure_embedding(_embedding_for(config))
    _configured_signature = (
        config.provider, config.model, config.base_url,
        bool(config.api_key), config.dimensions,
    )


async def _ensure_configured() -> KnowledgeConfig:
    config = _read_config()
    signature = (
        config.provider, config.model, config.base_url,
        bool(config.api_key), config.dimensions,
    )
    if signature != _configured_signature:
        await apply_config(config)
    return config


def _safe_name(name: str) -> str:
    clean = Path(name).name
    clean = re.sub(r"[^\w.()\-\u3400-\u9fff ]+", "_", clean).strip(" .")
    if not clean or clean in {".", ".."}:
        raise KnowledgeBaseError("文件名无效")
    return clean[:180]


def _html_text(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def _docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    return "\n".join(node.text or "" for node in root.iter() if node.tag.endswith("}t"))


def _pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:  # noqa: BLE001 - parser-specific errors are user input
        raise KnowledgeBaseError("PDF 无法解析，请确认文件未加密且内容可复制") from exc


def _extract_bytes(name: str, data: bytes) -> list[tuple[str, str]]:
    suffix = Path(name).suffix.lower()
    if suffix == ".zip":
        outputs: list[tuple[str, str]] = []
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for item in archive.infolist():
                if item.is_dir() or item.file_size > MAX_FILE_BYTES:
                    continue
                nested = _safe_name(item.filename)
                if Path(nested).suffix.lower() in ALLOWED_SUFFIXES - {".zip"}:
                    outputs.extend(_extract_bytes(nested, archive.read(item)))
        return outputs
    if suffix == ".docx":
        text = _docx_text(data)
    elif suffix == ".pdf":
        text = _pdf_text(data)
    elif suffix in {".html", ".htm"}:
        text = _html_text(data.decode("utf-8", "replace"))
    elif suffix in {".csv", ".tsv"}:
        delimiter = "\t" if suffix == ".tsv" else ","
        rows = csv.reader(io.StringIO(data.decode("utf-8", "replace")), delimiter=delimiter)
        text = "\n".join(" | ".join(row) for row in rows)
    elif suffix == ".json":
        try:
            text = json.dumps(json.loads(data.decode("utf-8")), ensure_ascii=False, indent=2)
        except ValueError as exc:
            raise KnowledgeBaseError(f"JSON 文件 {name} 无法解析") from exc
    else:
        text = data.decode("utf-8", "replace")
    text = text[:MAX_TEXT_CHARS].strip()
    return [(name, text)] if text else []


def _chunks(text: str) -> Iterable[str]:
    start = 0
    while start < len(text):
        end = min(len(text), start + CHUNK_CHARS)
        chunk = text[start:end].strip()
        if chunk:
            yield chunk
        if end >= len(text):
            break
        start = max(start + 1, end - CHUNK_OVERLAP)


def _source_id(name: str, data: bytes) -> str:
    return hashlib.sha256(name.encode() + b"\0" + data).hexdigest()[:24]


def list_sources(workspace_id: str = DEFAULT_WORKSPACE_ID) -> list[dict[str, Any]]:
    output = []
    for path in sorted(_sources_dir(workspace_id).iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        stat_result = path.stat()
        source_id, _, source_name = path.name.partition("--")
        output.append({"id": source_id or path.stem, "name": source_name or path.name, "bytes": stat_result.st_size,
                       "updatedAt": stat_result.st_mtime})
    return output


async def search_sources(query: str, *, top_k: int = 3,
                         workspace_id: str = DEFAULT_WORKSPACE_ID) -> list[dict[str, Any]]:
    """Find excerpts in the index for the currently selected embedding model."""
    query = query.strip()[:2000]
    if not query:
        return []
    config = await _ensure_configured()
    matches = await knowledge_store.query(_workspace_collection(config, workspace_id), query, top_k=max(1, min(top_k, 3)))
    return [
        {"source": str(item.get("metadata", {}).get("source_name", "")),
         "excerpt": str(item.get("document", ""))[:1600]}
        for item in matches
        if item.get("metadata", {}).get("source_name") and item.get("document")
    ]


async def add_source(name: str, data: bytes, workspace_id: str = DEFAULT_WORKSPACE_ID) -> dict[str, Any]:
    config = await _ensure_configured()
    collection = _workspace_collection(config, workspace_id)
    name = _safe_name(name)
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise KnowledgeBaseError("不支持的文件类型；可上传 txt、md、json、csv、html、pdf、docx 或 zip")
    if len(data) > MAX_FILE_BYTES:
        raise KnowledgeBaseError("单个文件不能超过 20 MB")
    source_id = _source_id(name, data)
    path = _sources_dir(workspace_id) / f"{source_id}--{name}"
    records: list[VectorRecord] = []
    for extracted_name, text in _extract_bytes(name, data):
        extracted_id = hashlib.sha1(extracted_name.encode()).hexdigest()[:8]
        for index, chunk in enumerate(_chunks(text)):
            records.append(VectorRecord(
                f"kb:{source_id}:{extracted_id}:{index}", chunk,
                {"source_id": source_id, "source_name": extracted_name,
                 "source_type": "user_knowledge", "chunk": index},
            ))
    if not records:
        raise KnowledgeBaseError("文件中没有可索引的文本")
    await knowledge_store.upsert(collection, records)
    path.write_bytes(data)
    return {"id": source_id, "name": name, "bytes": len(data), "chunks": len(records)}


async def remove_source(source_id: str, workspace_id: str = DEFAULT_WORKSPACE_ID) -> int:
    config = await _ensure_configured()
    collection = _workspace_collection(config, workspace_id)
    if not re.fullmatch(r"[0-9a-f]{24}", source_id):
        raise KnowledgeBaseError("知识库源标识无效")
    removed = await knowledge_store.delete(
        collection, where={"source_id": source_id}
    )
    for path in _sources_dir(workspace_id).glob(f"{source_id}--*"):
        path.unlink(missing_ok=True)
    return removed


async def reindex(workspace_id: str = DEFAULT_WORKSPACE_ID) -> dict[str, int]:
    config = await _ensure_configured()
    collection = _workspace_collection(config, workspace_id)
    existing_ids = set(await knowledge_store.ids(
        collection, where={"source_type": "user_knowledge"}
    ))
    all_records: list[VectorRecord] = []
    chunks = 0
    files = 0
    for path in sorted(_sources_dir(workspace_id).iterdir()):
        if not path.is_file() or "--" not in path.name:
            continue
        source_id, name = path.name.split("--", 1)
        data = path.read_bytes()
        for extracted_name, text in _extract_bytes(name, data):
            extracted_id = hashlib.sha1(extracted_name.encode()).hexdigest()[:8]
            records = [VectorRecord(f"kb:{source_id}:{extracted_id}:{index}", chunk,
                {"source_id": source_id, "source_name": extracted_name,
                 "source_type": "user_knowledge", "chunk": index})
                for index, chunk in enumerate(_chunks(text))]
            if records:
                all_records.extend(records)
                chunks += len(records)
        files += 1
    if all_records:
        # Embed the complete rebuilt set before deleting stale records. If the
        # remote provider is unavailable, the previous index remains usable.
        await knowledge_store.upsert(collection, all_records)
    current_ids = {record.id for record in all_records}
    stale_ids = existing_ids - current_ids
    if stale_ids:
        await knowledge_store.delete(collection, ids=sorted(stale_ids))
    return {"files": files, "chunks": chunks}


async def status(workspace_id: str = DEFAULT_WORKSPACE_ID) -> dict[str, Any]:
    config = await _ensure_configured()
    return {"config": config.public(), "sources": list_sources(workspace_id),
            "indexedChunks": await knowledge_store.count(_workspace_collection(config, workspace_id))}
