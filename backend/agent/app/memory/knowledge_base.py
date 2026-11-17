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
from app.memory.vector_store import (
    COLLECTION_USER_KNOWLEDGE,
    VectorRecord,
    vector_store,
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
        with self._lock, httpx.Client(timeout=60.0) as client:
            response = client.post(endpoint, headers=headers, json={
                "model": self.model, "input": input,
            })
        if response.status_code >= 400:
            raise KnowledgeBaseError(
                f"embedding Provider 返回 HTTP {response.status_code}"
            )
        payload = response.json()
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


def _root() -> Path:
    path = Path(knowledge_dir()).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    (path / "sources").mkdir(exist_ok=True)
    return path


def _config_path() -> Path:
    return _root() / "config.json"


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
    dimensions = int(dimensions_raw) if dimensions_raw not in (None, "") else None
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


async def apply_config(config: KnowledgeConfig) -> None:
    await vector_store.reset()
    vector_store.configure_embedding(_embedding_for(config))


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


def list_sources() -> list[dict[str, Any]]:
    output = []
    for path in sorted((_root() / "sources").iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        stat_result = path.stat()
        source_id, _, source_name = path.name.partition("--")
        output.append({"id": source_id or path.stem, "name": source_name or path.name, "bytes": stat_result.st_size,
                       "updatedAt": stat_result.st_mtime})
    return output


async def add_source(name: str, data: bytes) -> dict[str, Any]:
    name = _safe_name(name)
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise KnowledgeBaseError("不支持的文件类型；可上传 txt、md、json、csv、html、pdf、docx 或 zip")
    if len(data) > MAX_FILE_BYTES:
        raise KnowledgeBaseError("单个文件不能超过 20 MB")
    source_id = _source_id(name, data)
    path = _root() / "sources" / f"{source_id}--{name}"
    path.write_bytes(data)
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
    await vector_store.upsert(COLLECTION_USER_KNOWLEDGE, records)
    return {"id": source_id, "name": name, "bytes": len(data), "chunks": len(records)}


async def remove_source(source_id: str) -> int:
    if not re.fullmatch(r"[0-9a-f]{24}", source_id):
        raise KnowledgeBaseError("知识库源标识无效")
    removed = await vector_store.delete(COLLECTION_USER_KNOWLEDGE,
                                        where={"source_id": source_id})
    for path in (_root() / "sources").glob(f"{source_id}--*"):
        path.unlink(missing_ok=True)
    return removed


async def reindex() -> dict[str, int]:
    await vector_store.delete(COLLECTION_USER_KNOWLEDGE, where={"source_type": "user_knowledge"})
    chunks = 0
    files = 0
    for path in sorted((_root() / "sources").iterdir()):
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
                await vector_store.upsert(COLLECTION_USER_KNOWLEDGE, records)
                chunks += len(records)
        files += 1
    return {"files": files, "chunks": chunks}


async def status() -> dict[str, Any]:
    config = _read_config()
    return {"config": config.public(), "sources": list_sources(),
            "indexedChunks": await vector_store.count(COLLECTION_USER_KNOWLEDGE)}
