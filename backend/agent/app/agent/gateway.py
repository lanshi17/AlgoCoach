"""Read-only client for the Java gateway's problem endpoints.

The agent never talks to LeetCode directly (see ``docs/backend-agent.md`` §1);
it asks the gateway for problem metadata. This module normalises the gateway
response into the small, JSON-serialisable shape the coach tools and the
vector index consume, so the coach does not depend on the gateway's raw
GraphQL-derived field names.
"""
from __future__ import annotations

import html
import logging
import re
from typing import Any
from urllib.parse import quote

import httpx

from app.config import gateway_base_url, gateway_timeout_seconds

logger = logging.getLogger(__name__)

# Tool results are pasted into the Claude conversation; keep the statement
# bounded so one long problem cannot exhaust the context window.
MAX_TOOL_CONTENT_CHARS = 4000

_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _plain_text(value: Any) -> str:
    """Strip LeetCode's HTML and collapse whitespace for local embedding."""
    if not isinstance(value, str):
        return ""
    text = html.unescape(_TAG_RE.sub(" ", value))
    return _WHITESPACE_RE.sub(" ", text).strip()


def _first_text(payload: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _topic_names(raw: Any) -> list[str]:
    """Accept both ``["Array"]`` and LeetCode's ``[{"name": ...}]``."""
    names: list[str] = []
    for tag in raw if isinstance(raw, list) else []:
        if isinstance(tag, dict):
            name = tag.get("nameTranslated") or tag.get("name")
        else:
            name = tag
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


def normalize_problem(payload: Any, slug: str | None = None) -> dict | None:
    """Normalise a gateway Problem JSON into the coach's meta shape.

    ``None`` (or a non-object) is rejected rather than indexed, so a broken
    upstream response can never become a bogus vector-memory entry.
    """
    if not isinstance(payload, dict) or not payload:
        return None

    problem_id = str(
        slug
        or payload.get("titleSlug")
        or payload.get("problem_id")
        or payload.get("problemId")
        or ""
    ).strip()
    if not problem_id:
        return None

    title = _first_text(payload, ("translatedTitle", "title", "name")) or problem_id
    content = _plain_text(
        _first_text(payload, ("translatedContent", "content", "description"))
    )
    difficulty = _first_text(payload, ("difficulty", "level")).upper()
    topics = _topic_names(payload.get("topicTags") or payload.get("topics"))

    return {
        "problem_id": problem_id,
        "title": title,
        "difficulty": difficulty,
        "topics": topics,
        "content": content[:MAX_TOOL_CONTENT_CHARS],
    }


async def fetch_problem(slug: str) -> dict | None:
    """GET ``/api/problems/{slug}`` and return normalised metadata.

    Network, timeout, non-2xx and malformed-JSON failures are logged and
    return ``None``; the coach reports a tool error instead of caching a
    partial result.
    """
    problem_id = (slug or "").strip()
    if not problem_id:
        return None

    url = f"{gateway_base_url()}/api/problems/{quote(problem_id, safe='')}"
    try:
        async with httpx.AsyncClient(timeout=gateway_timeout_seconds()) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Problem fetch failed for %r: %s", problem_id, exc)
        return None

    problem = normalize_problem(payload, problem_id)
    if problem is None:
        logger.warning("Problem response for %r was not usable", problem_id)
    return problem
