"""Local vector memory for problem statements, topic explanations, and error descriptions.

Documents live in a persistent, on-machine ChromaDB directory selected by
``CHROMA_PATH``. Three document collections are implemented:

======================  ===========================================
collection              contents
======================  ===========================================
``problem_content``     problem statement used for similar-problem search
``topic_explanation``   explanation text a future animation can reuse
``error_description``   the user's sticking points / recurring mistakes
======================  ===========================================

``solution_comment`` intentionally does not exist yet: ``docs/memory-system.md``
keeps it as a V2 item because the REVIEW follow-up data source is not wired.

Privacy and locality
--------------------
* The default Chroma embedding function is the local ONNX MiniLM model; no
  statement or sticking point is sent to an embedding API or any other cloud
  service.
* The embedding model is initialised lazily on the first index/query, not at
  import or app startup. Its first use downloads the ~80 MB ONNX model into
  Chroma's local cache (``~/.cache/chroma`` by default), so the very first
  index operation is slower and needs network access once.
* Anonymous telemetry is disabled with ``anonymized_telemetry=False``.

All operations are async wrappers around Chroma's synchronous client; the
blocking embedding work runs in a worker thread. An optional
``embedding_function`` can be injected, which is how tests use a deterministic
fake embedding and never download a model.
"""
from __future__ import annotations

import asyncio
import hashlib
import re
import threading
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Sequence

from app.config import chroma_path

COLLECTION_PROBLEM_CONTENT = "problem_content"
COLLECTION_TOPIC_EXPLANATION = "topic_explanation"
COLLECTION_ERROR_DESCRIPTION = "error_description"
COLLECTION_USER_KNOWLEDGE = "user_knowledge"
USER_KNOWLEDGE_COLLECTION_PREFIX = f"{COLLECTION_USER_KNOWLEDGE}_"

DOCUMENT_COLLECTIONS: tuple[str, ...] = (
    COLLECTION_PROBLEM_CONTENT,
    COLLECTION_TOPIC_EXPLANATION,
    COLLECTION_ERROR_DESCRIPTION,
    COLLECTION_USER_KNOWLEDGE,
)

# Returned results are bounded so a tool call cannot flood the model context.
DEFAULT_TOP_K = 5
MAX_TOP_K = 10
MAX_INDEX_CHARS = 500
MAX_RESULT_CHARS = 500

_WHITESPACE_RE = re.compile(r"\s+")


class VectorStoreUnavailable(RuntimeError):
    """ChromaDB is missing or the local persistent directory cannot be opened."""


class VectorStoreError(ValueError):
    """Invalid collection name, id or document text."""


@dataclass(frozen=True)
class VectorRecord:
    """One document to upsert. ``id`` is the idempotency key."""

    id: str
    document: str
    metadata: dict[str, Any] = field(default_factory=dict)


def _import_chromadb():
    """Import ChromaDB lazily so the API can start without the optional model.

    ``chromadb`` (and its PyTorch-free ONNX dependencies) is pinned in
    ``requirements.txt``; importing it lazily keeps failures local to the
    vector tools instead of breaking every agent route on startup.
    """
    try:
        import chromadb
        from chromadb.config import Settings
    except ImportError as exc:  # pragma: no cover - exercised by a fake in tests
        raise VectorStoreUnavailable("chromadb is not installed") from exc
    return chromadb, Settings


def _normalise_text(value: Any) -> str:
    if not isinstance(value, str):
        value = "" if value is None else str(value)
    return _WHITESPACE_RE.sub(" ", value).strip()


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[:limit]


def _stable_hash(value: str) -> str:
    """Process-independent hash for deterministic document ids."""
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]


def _clamp_top_k(value: Any, default: int = DEFAULT_TOP_K) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(parsed, MAX_TOP_K))


def _clean_metadata(record_id: str, metadata: dict[str, Any] | None) -> dict[str, Any]:
    """Coerce metadata to the scalar values ChromaDB accepts.

    Chroma rejects ``None``, lists and nested objects. ``None`` is dropped and
    sequences become a comma-separated string, which still works as an exact
    metadata filter for single-topic queries.
    """
    cleaned: dict[str, Any] = {}
    for key, value in (metadata or {}).items():
        if value is None:
            continue
        if isinstance(value, bool):
            cleaned[str(key)] = value
        elif isinstance(value, (int, float)):
            cleaned[str(key)] = value
        elif isinstance(value, str):
            cleaned[str(key)] = value
        elif isinstance(value, (list, tuple, set, frozenset)):
            joined = ",".join(
                _normalise_text(item) for item in value if _normalise_text(item)
            )
            if joined:
                cleaned[str(key)] = joined
        else:
            cleaned[str(key)] = str(value)
    # Keep the record id filterable alongside problem_id/topic/platform.
    cleaned.setdefault("id", record_id)
    return cleaned


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _compose_problem_document(title: str, topics: Sequence[str], content: str) -> str:
    parts = [_normalise_text(title)]
    topic_names = [_normalise_text(topic) for topic in topics if _normalise_text(topic)]
    if topic_names:
        parts.append("考点：" + "、".join(topic_names))
    if content:
        parts.append(_truncate(_normalise_text(content), MAX_INDEX_CHARS))
    return " ".join(part for part in parts if part)


class VectorStore:
    """Persistent, local document store with idempotent upsert and query.

    ``path`` defaults to ``CHROMA_PATH`` and is resolved on first use, so a
    store object can be constructed at import time without touching disk.
    """

    def __init__(self, path: str | None = None, embedding_function: Any = None):
        self._path = path
        self._embedding_function = embedding_function
        self._client: Any = None
        self._collections: dict[str, Any] = {}
        # Chroma's client/collection creation is synchronous; a plain lock is
        # safe across the ``asyncio.to_thread`` workers used below.
        self._lock = threading.RLock()

    @property
    def path(self) -> str:
        return self._path or chroma_path()

    # ── Chroma client / collection lifecycle ─────────────────

    def _ensure_client(self):
        with self._lock:
            if self._client is None:
                try:
                    chromadb, settings_cls = _import_chromadb()
                    self._client = chromadb.PersistentClient(
                        path=self.path,
                        settings=settings_cls(anonymized_telemetry=False),
                    )
                except VectorStoreUnavailable:
                    raise
                except Exception as exc:  # noqa: BLE001 - surfaced as a domain error
                    raise VectorStoreUnavailable(
                        f"cannot open local vector store at {self.path!r}"
                    ) from exc
            return self._client

    def _collection(self, name: str):
        if (
            name not in DOCUMENT_COLLECTIONS
            and not name.startswith(USER_KNOWLEDGE_COLLECTION_PREFIX)
        ):
            raise VectorStoreError(f"unknown vector collection: {name!r}")
        with self._lock:
            collection = self._collections.get(name)
            if collection is None:
                client = self._ensure_client()
                kwargs: dict[str, Any] = {
                    "name": name,
                    "metadata": {"hnsw:space": "cosine"},
                }
                if self._embedding_function is not None:
                    kwargs["embedding_function"] = self._embedding_function
                collection = client.get_or_create_collection(**kwargs)
                self._collections[name] = collection
            return collection

    # ── Generic upsert / query ───────────────────────────────

    async def upsert(self, collection: str, records: Sequence[VectorRecord]) -> int:
        """Insert or replace records, keyed by ``id``.

        Repeating the same upsert does not duplicate rows. A batch with
        duplicate ids keeps the last record, matching Chroma's upsert
        semantics.
        """
        prepared: dict[str, VectorRecord] = {}
        for record in records:
            if not isinstance(record, VectorRecord):
                raise VectorStoreError("records must be VectorRecord instances")
            record_id = _normalise_text(record.id)
            document = _normalise_text(record.document)
            if not record_id:
                raise VectorStoreError("vector record id must not be empty")
            if not document:
                raise VectorStoreError(f"vector record {record_id!r} has no document")
            prepared[record_id] = VectorRecord(
                id=record_id,
                document=document,
                metadata=_clean_metadata(record_id, record.metadata),
            )
        if not prepared:
            return 0
        batch = list(prepared.values())
        return await asyncio.to_thread(self._upsert_sync, collection, batch)

    def _upsert_sync(self, collection: str, records: list[VectorRecord]) -> int:
        target = self._collection(collection)
        target.upsert(
            ids=[record.id for record in records],
            documents=[record.document for record in records],
            metadatas=[record.metadata for record in records],
        )
        return len(records)

    async def query(
        self,
        collection: str,
        query_text: str | None = None,
        *,
        query_embedding: Sequence[float] | None = None,
        top_k: Any = DEFAULT_TOP_K,
        where: dict[str, Any] | None = None,
    ) -> list[dict]:
        """Return the nearest documents, nearest first.

        An empty query or an empty collection returns ``[]``. ``top_k`` is
        clamped to ``MAX_TOP_K`` and returned documents are truncated to
        ``MAX_RESULT_CHARS``.
        """
        text = _normalise_text(query_text)
        if query_embedding is None and not text:
            return []
        if query_embedding is not None and text:
            raise VectorStoreError("pass either query_text or query_embedding")
        limit = _clamp_top_k(top_k)
        return await asyncio.to_thread(
            self._query_sync, collection, text, query_embedding, limit, where
        )

    def _query_sync(
        self,
        collection: str,
        text: str,
        query_embedding: Sequence[float] | None,
        limit: int,
        where: dict[str, Any] | None,
    ) -> list[dict]:
        target = self._collection(collection)
        if target.count() == 0:
            # Chroma versions differ on querying an empty collection; an empty
            # result is the documented behaviour of this API either way.
            return []
        kwargs: dict[str, Any] = {
            "n_results": limit,
            "include": ["documents", "metadatas", "distances"],
        }
        if query_embedding is not None:
            embedding = list(query_embedding)
            if embedding and not isinstance(embedding[0], (list, tuple)):
                embedding = [embedding]  # type: ignore[list-item]
            kwargs["query_embeddings"] = embedding
        else:
            kwargs["query_texts"] = [text]
        if where:
            kwargs["where"] = where

        result = target.query(**kwargs)
        return _format_query_result(result)

    async def get(self, collection: str, record_id: str) -> dict | None:
        """Return one stored document, or ``None`` when it is not indexed."""
        record_id = _normalise_text(record_id)
        if not record_id:
            return None
        return await asyncio.to_thread(self._get_sync, collection, record_id)

    def _get_sync(self, collection: str, record_id: str) -> dict | None:
        target = self._collection(collection)
        result = target.get(
            ids=[record_id], include=["documents", "metadatas"]
        )
        ids = result.get("ids") or []
        if not ids:
            return None
        documents = result.get("documents") or [None]
        metadatas = result.get("metadatas") or [None]
        return {
            "id": ids[0],
            "document": _truncate(documents[0] or "", MAX_RESULT_CHARS),
            "metadata": dict(metadatas[0] or {}),
        }

    async def count(self, collection: str) -> int:
        """Number of documents in a collection (used by tests and diagnostics)."""
        return await asyncio.to_thread(self._count_sync, collection)

    async def ids(self, collection: str, *, where: dict[str, Any] | None = None) -> list[str]:
        """Return ids matching an optional metadata filter."""
        return await asyncio.to_thread(self._ids_sync, collection, where)

    async def delete(self, collection: str, *, where: dict[str, Any] | None = None,
                     ids: Sequence[str] | None = None) -> int:
        """Delete records by metadata filter or explicit ids."""
        if not where and not ids:
            return 0
        return await asyncio.to_thread(self._delete_sync, collection, where, ids)

    def _delete_sync(self, collection: str, where: dict[str, Any] | None,
                     ids: Sequence[str] | None) -> int:
        target = self._collection(collection)
        before = int(target.count())
        target.delete(where=where, ids=list(ids) if ids else None)
        return max(0, before - int(target.count()))

    async def reset(self) -> None:
        """Drop the local client so a new embedding function can be used."""
        await asyncio.to_thread(self._reset_sync)

    def _reset_sync(self) -> None:
        with self._lock:
            self._client = None
            self._collections = {}

    def configure_embedding(self, embedding_function: Any) -> None:
        """Set an embedding function before the next Chroma client is opened."""
        with self._lock:
            if self._client is not None:
                raise RuntimeError("vector store must be reset before changing embeddings")
            self._embedding_function = embedding_function

    async def export_all(self) -> dict[str, list[dict[str, Any]]]:
        """Return all indexed documents and metadata without embedding vectors."""
        return await asyncio.to_thread(self._export_all_sync)

    def _export_all_sync(self) -> dict[str, list[dict[str, Any]]]:
        exported: dict[str, list[dict[str, Any]]] = {}
        for name in DOCUMENT_COLLECTIONS:
            collection = self._collection(name)
            count = int(collection.count())
            records: list[dict[str, Any]] = []
            for offset in range(0, count, 500):
                batch = collection.get(
                    limit=min(500, count - offset),
                    offset=offset,
                    include=["documents", "metadatas"],
                )
                ids = batch.get("ids") or []
                documents = batch.get("documents") or []
                metadatas = batch.get("metadatas") or []
                for index, record_id in enumerate(ids):
                    records.append({
                        "id": record_id,
                        "document": documents[index] if index < len(documents) else "",
                        "metadata": metadatas[index] if index < len(metadatas) else {},
                    })
            exported[name] = records
        return exported

    def _count_sync(self, collection: str) -> int:
        return int(self._collection(collection).count())

    def _ids_sync(self, collection: str, where: dict[str, Any] | None) -> list[str]:
        result = self._collection(collection).get(where=where, include=["metadatas"])
        return [str(record_id) for record_id in (result.get("ids") or [])]

    # ── Domain helpers ───────────────────────────────────────

    async def index_problem(
        self,
        problem_id: str,
        title: str,
        content: str,
        topics: Sequence[str] | None = None,
        *,
        platform: str = "LEETCODE",
        difficulty: str = "",
        created_at: str | None = None,
    ) -> bool:
        """Idempotently index one problem statement under ``problem_content``."""
        problem_id = _normalise_text(problem_id)
        if not problem_id:
            raise VectorStoreError("problem_id must not be empty")
        topics = list(topics or [])
        document = _compose_problem_document(title or problem_id, topics, content or "")
        metadata = {
            "problem_id": problem_id,
            "title": _normalise_text(title),
            "topic": ",".join(_normalise_text(topic) for topic in topics if _normalise_text(topic)),
            "platform": _normalise_text(platform) or "LEETCODE",
            "created_at": created_at or _iso_now(),
        }
        if difficulty:
            metadata["difficulty"] = _normalise_text(difficulty).upper()
        await self.upsert(
            COLLECTION_PROBLEM_CONTENT,
            [VectorRecord(problem_id, document, metadata)],
        )
        return True

    async def index_topic_explanation(
        self,
        topic: str,
        explanation: str,
        *,
        problem_id: str = "",
        platform: str = "LEETCODE",
        created_at: str | None = None,
    ) -> str | None:
        """Idempotently index a topic explanation; returns the document id."""
        topic = _normalise_text(topic)
        explanation = _normalise_text(explanation)
        if not topic or not explanation:
            return None
        record_id = f"topic:{_stable_hash(f'{topic}:{explanation}')}"
        document = _truncate(f"{topic} {explanation}", MAX_INDEX_CHARS)
        await self.upsert(
            COLLECTION_TOPIC_EXPLANATION,
            [VectorRecord(record_id, document, {
                "problem_id": _normalise_text(problem_id),
                "topic": topic,
                "platform": _normalise_text(platform) or "LEETCODE",
                "created_at": created_at or _iso_now(),
            })],
        )
        return record_id

    async def index_error_descriptions(
        self,
        problem_id: str,
        sticking_points: Sequence[str],
        *,
        platform: str = "LEETCODE",
        created_at: str | None = None,
    ) -> list[str]:
        """Idempotently index the user's sticking points under ``error_description``.

        The id is derived from the problem and the normalised text, so writing
        the same sticking point again updates the same row instead of adding a
        duplicate. Blank points are ignored.
        """
        problem_id = _normalise_text(problem_id) or "unknown"
        created_at = created_at or _iso_now()
        records: list[VectorRecord] = []
        for point in sticking_points or []:
            text = _normalise_text(point)
            if not text:
                continue
            record_id = f"error:{problem_id}:{_stable_hash(text)}"
            records.append(VectorRecord(
                id=record_id,
                document=_truncate(f"{problem_id} {text}", MAX_INDEX_CHARS),
                metadata={
                    "problem_id": problem_id,
                    "topic": "",
                    "platform": _normalise_text(platform) or "LEETCODE",
                    "created_at": created_at,
                },
            ))
        if not records:
            return []
        await self.upsert(COLLECTION_ERROR_DESCRIPTION, records)
        return [record.id for record in records]

    async def find_similar_problems(
        self,
        text: str,
        top_k: Any = DEFAULT_TOP_K,
        where: dict[str, Any] | None = None,
    ) -> list[dict]:
        return await self.query(
            COLLECTION_PROBLEM_CONTENT, text, top_k=top_k, where=where
        )

    async def find_similar_errors(
        self,
        text: str,
        top_k: Any = DEFAULT_TOP_K,
        where: dict[str, Any] | None = None,
    ) -> list[dict]:
        return await self.query(
            COLLECTION_ERROR_DESCRIPTION, text, top_k=top_k, where=where
        )

    async def find_topic_explanations(
        self,
        text: str,
        top_k: Any = DEFAULT_TOP_K,
        where: dict[str, Any] | None = None,
    ) -> list[dict]:
        return await self.query(
            COLLECTION_TOPIC_EXPLANATION, text, top_k=top_k, where=where
        )

    async def similar_to_problem(
        self, problem_id: str, top_k: Any = DEFAULT_TOP_K
    ) -> list[dict]:
        """Find problems like an already-indexed one, excluding itself."""
        problem_id = _normalise_text(problem_id)
        if not problem_id:
            return []
        record = await self.get(COLLECTION_PROBLEM_CONTENT, problem_id)
        if record is None:
            return []
        limit = _clamp_top_k(top_k)
        embedding = await asyncio.to_thread(
            self._embedding_sync, COLLECTION_PROBLEM_CONTENT, problem_id
        )
        if embedding is None:
            # Fall back to querying the stored text (works with Chroma's own
            # embedding function as well).
            embedding = record["document"]
        results = await self.query(
            COLLECTION_PROBLEM_CONTENT,
            query_embedding=embedding if isinstance(embedding, list) else None,
            query_text=embedding if isinstance(embedding, str) else None,
            top_k=limit + 1,
        )
        return [item for item in results if item["id"] != problem_id][:limit]

    def _embedding_sync(self, collection: str, record_id: str) -> list[float] | None:
        target = self._collection(collection)
        result = target.get(ids=[record_id], include=["embeddings"])
        embeddings = result.get("embeddings")
        if embeddings is None or len(embeddings) == 0:
            return None
        embedding = embeddings[0]
        if hasattr(embedding, "tolist"):
            embedding = embedding.tolist()
        return [float(value) for value in embedding]


def _format_query_result(result: dict) -> list[dict]:
    """Flatten Chroma's nested query result into a bounded list of dicts."""
    ids = (result.get("ids") or [[]])[0]
    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    items: list[dict] = []
    for index, record_id in enumerate(ids or []):
        document = documents[index] if index < len(documents) else ""
        metadata = metadatas[index] if index < len(metadatas) else {}
        distance = distances[index] if index < len(distances) else None
        items.append({
            "id": record_id,
            "document": _truncate(document or "", MAX_RESULT_CHARS),
            "metadata": dict(metadata or {}),
            "distance": None if distance is None else float(distance),
        })
    return items


# Process-wide store used by the coach. Constructing it is side-effect free;
# the Chroma client, collections and embedding model are created on first use.
vector_store = VectorStore()

_workspace_stores: dict[tuple[VectorStore, str, str], VectorStore] = {}
_workspace_stores_lock = threading.Lock()


def workspace_vector_store(workspace_id: str, base_store: VectorStore = vector_store) -> VectorStore:
    """Use a separate persistent index for each non-default workspace.

    The legacy index remains at CHROMA_PATH. Sibling directories keep its
    backup/export from accidentally including other workspaces' data.
    """
    if workspace_id == "local-default":
        return base_store
    base_path = Path(base_store.path).expanduser().resolve()
    key = (base_store, str(base_path), workspace_id)
    with _workspace_stores_lock:
        if key not in _workspace_stores:
            digest = hashlib.sha256(workspace_id.encode("utf-8")).hexdigest()[:32]
            path = base_path.parent / f"{base_path.name}-workspaces" / digest
            _workspace_stores[key] = VectorStore(
                path=str(path), embedding_function=base_store._embedding_function
            )
        return _workspace_stores[key]
