"""HTTP routes for the agent service."""
import hashlib
import json
import logging
from uuid import uuid4
from typing import Any

import anthropic
from fastapi import APIRouter, HTTPException, Query, Request, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from openai import APIConnectionError as OpenAIAPIConnectionError
from openai import APIStatusError as OpenAIAPIStatusError
from pydantic import ValidationError

from app.agent.coach import ProviderConfigurationError, coach
from app.agent.turns import TurnConflict, turn_store
from app.config import (
    chat_session_id,
    remotion_codegen_enabled,
    remotion_codegen_token,
)
from app.memory.memory_service import memory, normalize_workspace_id
from app.memory import knowledge_base
from app.models.schemas import (
    AnimateRequest,
    ChatRequest,
    GeneratedAnimationRequest,
    MasteryExportResponse,
    MasteryImportRequest,
    MasteryImportResponse,
    MemoryRecordRequest,
    MemoryRecordResponse,
    TurnReplayRequest,
)
from app.remotion.animation_service import (
    AnimationDisabled,
    GeneratedJobLimitExceeded,
    animation_service,
)
from app.remotion.codegen import (
    InvalidGeneratedCode,
    SandboxUnavailable,
    authorize_bearer,
    sandbox_manager,
    validate_request,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _sse(payload: dict[str, Any]) -> str:
    """Encode one newline-safe JSON event for the chat stream."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _provider_error_detail(status_code: int, protocol: str) -> str:
    """Translate upstream model errors into actionable, credential-safe text."""
    if status_code == 401:
        return "模型服务认证失败，请检查 Provider API Key。"
    if status_code == 403:
        return "当前账号无权访问所选模型，请检查模型权限或更换模型。"
    if status_code == 404:
        if protocol == "openai-response":
            return "模型或 Responses API 路径不存在。请检查模型名称，并确认 Base URL 对应的服务支持 /responses（通常 Base URL 以 /v1 结尾）。"
        return "模型或 API 路径不存在，请检查模型名称和 Provider Base URL。"
    if status_code == 429:
        return "模型服务请求过于频繁或额度不足，请稍后重试并检查账号额度。"
    if status_code in (400, 422):
        return "模型服务无法接受当前请求。请检查模型是否支持所选协议及工具调用。"
    if status_code >= 500:
        return "模型服务暂时不可用，请稍后重试。"
    return "模型服务请求失败，请检查 Provider 设置后重试。"


@router.get("/knowledge/config")
async def knowledge_config():
    return knowledge_base.get_config().public()


@router.put("/knowledge/config")
async def update_knowledge_config(request: Request):
    try:
        payload = await request.json()
        config = knowledge_base.configure(payload)
        await knowledge_base.apply_config(config)
        return config.public()
    except knowledge_base.KnowledgeBaseError as exc:
        raise HTTPException(422, detail=str(exc)) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, detail="embedding 配置格式无效") from exc


@router.get("/knowledge/sources")
async def knowledge_sources(workspaceId: str = "local-default"):
    return {"sources": knowledge_base.list_sources(workspaceId)}


@router.post("/knowledge/sources")
async def upload_knowledge_sources(files: list[UploadFile] = File(...), workspaceId: str = "local-default"):
    if len(files) > knowledge_base.MAX_FILES:
        raise HTTPException(413, detail=f"一次最多上传 {knowledge_base.MAX_FILES} 个文件")
    total = 0
    results = []
    try:
        for upload in files:
            data = await upload.read()
            total += len(data)
            if total > knowledge_base.MAX_TOTAL_BYTES:
                raise knowledge_base.KnowledgeBaseError("单次上传总大小不能超过 100 MB")
            results.append(await knowledge_base.add_source(upload.filename or "source.txt", data, workspaceId))
        return {"sources": results}
    except knowledge_base.KnowledgeBaseError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@router.delete("/knowledge/sources/{source_id}")
async def delete_knowledge_source(source_id: str, workspaceId: str = "local-default"):
    try:
        return {"removedChunks": await knowledge_base.remove_source(source_id, workspaceId)}
    except knowledge_base.KnowledgeBaseError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@router.post("/knowledge/reindex")
async def reindex_knowledge(workspaceId: str = "local-default"):
    try:
        return await knowledge_base.reindex(workspaceId)
    except knowledge_base.KnowledgeBaseError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@router.get("/knowledge/status")
async def knowledge_status(workspaceId: str = "local-default"):
    try:
        return await knowledge_base.status(workspaceId)
    except knowledge_base.KnowledgeBaseError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


def _session_id(req: ChatRequest) -> str:
    """Derive the AgentScope state namespace from the current page context."""
    identity = json.dumps(
        [req.workspaceId, req.conversationId, req.platform, req.problemId],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return chat_session_id() + "-" + hashlib.sha256(identity.encode()).hexdigest()[:24]


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream thinking/text deltas through a small SSE contract.

    Errors are emitted as an event because HTTP headers have already been sent
    once the first model delta arrives.
    """
    session_id = _session_id(req)
    provider = req.provider
    turn_id = req.turnId or uuid4().hex

    async def events():
        started = False

        async def emit(event: dict[str, Any]):
            return _sse(await turn_store.append(turn_id, event))

        try:
            snapshot = await turn_store.begin(
                turn_id,
                workspace_id=req.workspaceId,
                conversation_id=req.conversationId,
                capability=req.capability,
            )
            started = snapshot.created
            if not snapshot.created:
                replayed = await turn_store.replay(turn_id, req.afterSequence)
                if replayed is not None:
                    _, persisted_events = replayed
                    for persisted_event in persisted_events:
                        yield _sse(persisted_event)
                return
            kwargs: dict[str, Any] = {
                "session_id": session_id,
                "message": req.message,
                "mode": req.mode,
                "capability": req.capability,
                "workspace_id": req.workspaceId,
                "problem_id": req.problemId,
                "code": req.code,
                "code_language": req.codeLanguage,
                "goal": req.goal,
                "training_phase": req.trainingPhase,
                "time_remaining_sec": req.timeRemainingSec,
                "animations": req.animations,
                "coach_style": req.coachStyle,
            }
            if req.platform:
                kwargs["platform"] = req.platform
            if provider is not None:
                kwargs["provider"] = provider.model_dump()
            async for event in coach.chat_stream(**kwargs):
                yield await emit(event)
            await turn_store.finish(turn_id, "completed")
        except TurnConflict as exc:
            yield _sse({
                "type": "error",
                "status": 409,
                "detail": str(exc),
                "turn_id": turn_id,
                "event_id": 0,
            })
        except (OpenAIAPIStatusError, anthropic.APIStatusError) as exc:
            protocol = provider.protocol if provider is not None else ""
            logger.warning(
                "Model provider rejected streaming chat request (protocol=%s, status=%s)",
                protocol,
                exc.status_code,
            )
            error = {
                "type": "error",
                "status": 502,
                "detail": _provider_error_detail(exc.status_code, protocol),
            }
            yield await emit(error) if started else _sse({**error, "turn_id": turn_id, "event_id": 0})
            if started:
                await turn_store.finish(turn_id, "failed")
        except ProviderConfigurationError as exc:
            logger.warning("Streaming provider configuration rejected: %s", exc.code)
            error = {
                "type": "error",
                "status": 400,
                "detail": {"code": exc.code, "message": str(exc)},
            }
            yield await emit(error) if started else _sse({**error, "turn_id": turn_id, "event_id": 0})
            if started:
                await turn_store.finish(turn_id, "failed")
        except (PermissionError, RuntimeError) as exc:
            logger.warning("Streaming provider configuration rejected: %s", type(exc).__name__)
            error = {
                "type": "error",
                "status": 400,
                "detail": str(exc) if isinstance(exc, RuntimeError)
                else "模型 Provider 配置无效，请检查 API Key 和模型名称。",
            }
            yield await emit(error) if started else _sse({**error, "turn_id": turn_id, "event_id": 0})
            if started:
                await turn_store.finish(turn_id, "failed")
        except (OpenAIAPIConnectionError, anthropic.APIConnectionError):
            logger.warning("Streaming model provider connection failed")
            error = {
                "type": "error",
                "status": 502,
                "detail": "无法连接模型服务，请检查网络和 Provider Base URL。",
            }
            yield await emit(error) if started else _sse({**error, "turn_id": turn_id, "event_id": 0})
            if started:
                await turn_store.finish(turn_id, "failed")
        except Exception:
            logger.exception("Unexpected streaming chat failure")
            error = {
                "type": "error",
                "status": 502,
                "detail": "教练服务暂时不可用，请稍后重试。",
            }
            yield await emit(error) if started else _sse({**error, "turn_id": turn_id, "event_id": 0})
            if started:
                await turn_store.finish(turn_id, "failed")

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat/replay")
async def replay_turn(req: TurnReplayRequest):
    """Return persisted events for a turn without invoking the model."""
    replayed = await turn_store.replay(req.turnId, req.afterSequence)
    if replayed is None:
        raise HTTPException(404, detail="找不到该 turn")
    snapshot, events = replayed
    return {
        "turnId": snapshot.turn_id,
        "workspaceId": snapshot.workspace_id,
        "conversationId": snapshot.conversation_id,
        "capability": snapshot.capability,
        "state": snapshot.state,
        "events": events,
    }


@router.post("/memory/record", response_model=MemoryRecordResponse)
async def record_memory(req: MemoryRecordRequest):
    """Persist a finished submission reported by the Java gateway.

    The gateway calls this after its submission record is durable. Review
    memory is updated in a later conversation, so this callback records an
    empty sticking-points list.
    """
    await memory.record_attempt(
        problem_id=req.problem_id,
        platform=req.platform,
        status=req.status,
        lang=req.lang,
        duration_sec=req.duration_sec,
        topics=req.topics,
        sticking_points=[],
        client_id=req.client_id,
        workspace_id=req.workspace_id,
    )
    return MemoryRecordResponse()


@router.get("/memory/profile")
async def memory_profile(request: Request):
    """Expose only local learning aggregates needed by the progress views."""
    workspace_id = normalize_workspace_id(
        request.query_params.get("workspaceId")
        or request.query_params.get("workspace_id")
    )
    return await memory.profile_snapshot(workspace_id=workspace_id)


@router.get("/memory/patterns")
async def list_memory_patterns(workspaceId: str = "local-default"):
    return await memory.list_patterns(workspace_id=workspaceId)


@router.delete("/memory/patterns/{pattern_id}")
async def delete_memory_pattern(pattern_id: int, workspaceId: str = "local-default"):
    if not await memory.delete_pattern(pattern_id, workspace_id=workspaceId):
        raise HTTPException(404, detail="找不到该记忆点")
    return {"ok": True}


@router.get("/memory/mastery-path")
async def memory_mastery_path(
    request: Request,
    limit: int = Query(default=6, ge=1, le=12),
):
    """Return the next explainable learning steps for one workspace."""
    workspace_id = normalize_workspace_id(
        request.query_params.get("workspaceId")
        or request.query_params.get("workspace_id")
    )
    return await memory.mastery_path(limit=limit, workspace_id=workspace_id)


@router.get("/memory/export")
async def export_memory(request: Request):
    """Download local learning history, vector records, and ReMe/Chroma files."""
    workspace_id = normalize_workspace_id(
        request.query_params.get("workspaceId")
        or request.query_params.get("workspace_id")
    )
    archive = await memory.export_archive(workspace_id=workspace_id)
    return Response(
        content=archive,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="algocoach-memory.zip"'},
    )


@router.get("/memory/mastery-export", response_model=MasteryExportResponse)
async def export_mastery(request: Request):
    """Return a small topic-level mastery bundle for another device."""
    workspace_id = normalize_workspace_id(
        request.query_params.get("workspaceId")
        or request.query_params.get("workspace_id")
    )
    return await memory.export_mastery(workspace_id=workspace_id)


@router.post("/memory/mastery-import", response_model=MasteryImportResponse)
async def import_mastery(req: MasteryImportRequest, request: Request):
    """Merge another device's mastery bundle into the target workspace."""
    workspace_id = normalize_workspace_id(
        request.query_params.get("workspaceId")
        or request.query_params.get("workspace_id")
    )
    return await memory.import_mastery(
        [topic.model_dump() for topic in req.topics],
        workspace_id=workspace_id,
    )


@router.post("/animate")
async def animate(req: AnimateRequest):
    """Manually request an animation (from frontend, e.g., button click).

    ``REMOTION_ENABLED`` is off by default; ``animation_service.enqueue`` is the
    single entry that owns the capability, and this route only maps its refusal
    to HTTP 503.
    """
    try:
        job = await animation_service.enqueue(
            kind=req.type,
            topic=req.topic,
            title=req.title,
            problem_id=req.problemId,
        )
    except AnimationDisabled:
        raise HTTPException(
            503,
            detail={"code": "AnimationDisabled", "reason": "remotion_disabled"},
        ) from None
    return {"job_id": job.id, "status": job.status}


@router.post("/animate/generated")
async def animate_generated(request: Request):
    """Queue an agent-generated Remotion composition (P2, opt-in).

    Access control: when the feature is enabled, ``REMOTION_CODEGEN_TOKEN``
    must be configured and the request must carry ``Authorization: Bearer
    <token>``. The token is compared in constant time and is never logged or
    echoed. Authentication runs before the JSON body is read/validated, before
    any scratch file exists, and before the sandbox preflight.

    Disabled by default. There is no host ``npx``/``node`` fallback.
    """
    if not remotion_codegen_enabled():
        raise HTTPException(
            503,
            detail={"code": "SandboxUnavailable", "reason": "codegen_disabled"},
        )

    expected_token = remotion_codegen_token()
    if expected_token is None:
        # Feature-level fail-closed: enabling codegen without a token must not
        # expose the endpoint at all.
        raise HTTPException(
            503,
            detail={"code": "SandboxUnavailable", "reason": "codegen_token_missing"},
        )

    if not authorize_bearer(request.headers.get("authorization"), expected_token):
        raise HTTPException(
            401,
            detail={"code": "Unauthorized", "reason": "invalid_token"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Only read/validate the body after authentication. This keeps malformed
    # or oversized JSON from being processed for unauthenticated callers.
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={"code": "InvalidRequest", "reason": "invalid_json"},
        ) from exc
    try:
        req = GeneratedAnimationRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            422,
            detail={"code": "InvalidRequest", "reason": "invalid_body"},
        ) from exc

    # Admission cap: reject before static validation/preflight/temp files.
    if not animation_service.generated_capacity_available():
        raise HTTPException(
            429,
            detail={"code": "TooManyRequests", "reason": "generated_job_limit"},
            headers={"Retry-After": "5"},
        )

    # Reject invalid input before any scratch file or subprocess exists.
    try:
        clean_props = validate_request(req.code, req.props)
    except InvalidGeneratedCode as exc:
        raise HTTPException(
            400,
            detail={"code": exc.code, "reason": exc.reason},
        ) from exc

    try:
        await sandbox_manager.ensure_available()
    except SandboxUnavailable as exc:
        raise HTTPException(
            503,
            detail={"code": "SandboxUnavailable", "reason": exc.reason},
        ) from exc

    try:
        job = await animation_service.enqueue_generated(
            title=req.title,
            code=req.code,
            props=clean_props,
        )
    except GeneratedJobLimitExceeded as exc:
        # A concurrent request may have taken the last slot during preflight.
        raise HTTPException(
            429,
            detail={"code": "TooManyRequests", "reason": "generated_job_limit"},
            headers={"Retry-After": "5"},
        ) from exc
    return {"job_id": job.id, "status": job.status}


@router.get("/animate/{job_id}")
async def poll_animate(job_id: str):
    job = await animation_service.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return {
        "id": job.id,
        "status": job.status,
        "videoUrl": job.video_url,
        "title": job.title,
    }
