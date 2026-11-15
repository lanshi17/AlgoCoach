"""HTTP routes for the agent service."""
import hashlib
import json
import logging
from typing import Any

import anthropic
from fastapi import APIRouter, HTTPException, Request, Response
from openai import APIConnectionError as OpenAIAPIConnectionError
from openai import APIStatusError as OpenAIAPIStatusError
from pydantic import ValidationError

from app.agent.coach import ProviderConfigurationError, coach
from app.config import chat_session_id, remotion_codegen_enabled, remotion_codegen_token
from app.memory.memory_service import memory
from app.models.schemas import (
    AnimateRequest,
    ChatRequest,
    ChatResponse,
    GeneratedAnimationRequest,
    MemoryRecordRequest,
    MemoryRecordResponse,
)
from app.remotion.animation_service import (
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


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Main agent conversation endpoint."""
    session_id = chat_session_id()
    # PREP, IDLE and REVIEW are phases of the same coaching conversation, so
    # keep their AgentState continuous. The current mode is supplied to the
    # system prompt on every turn. FOCUS returns before model/memory access in
    # AlgoCoach.chat and therefore never contributes stale turns to this state.
    if req.conversationId or (req.problemId and req.platform):
        identity = json.dumps(
            [req.conversationId, req.platform, req.problemId],
            ensure_ascii=False,
            separators=(',', ':'),
        )
        session_id += '-' + hashlib.sha256(identity.encode()).hexdigest()[:24]
    provider = req.provider
    platform_kwargs: dict[str, Any] = {"platform": req.platform} if req.platform else {}
    try:
        if provider is None:
            result = await coach.chat(
                session_id=session_id,
                message=req.message,
                mode=req.mode,
                problem_id=req.problemId,
                goal=req.goal,
                training_phase=req.trainingPhase,
                time_remaining_sec=req.timeRemainingSec,
                **platform_kwargs,
            )
        else:
            result = await coach.chat(
                session_id=session_id,
                message=req.message,
                mode=req.mode,
                problem_id=req.problemId,
                goal=req.goal,
                training_phase=req.trainingPhase,
                time_remaining_sec=req.timeRemainingSec,
                provider=provider.model_dump(),
                **platform_kwargs,
            )
    except (OpenAIAPIStatusError, anthropic.APIStatusError) as exc:
        protocol = provider.protocol if provider is not None else ""
        logger.warning(
            "Model provider rejected chat request (protocol=%s, status=%s)",
            protocol,
            exc.status_code,
        )
        raise HTTPException(
            status_code=502,
            detail=_provider_error_detail(exc.status_code, protocol),
        ) from None
    except ProviderConfigurationError as exc:
        logger.warning("Model provider configuration rejected: %s", exc.code)
        raise HTTPException(
            status_code=400,
            detail={"code": exc.code, "message": str(exc)},
        ) from None
    except (PermissionError, RuntimeError) as exc:
        # Configuration failures are raised before the SDK request is made.
        # Keep the message actionable, but never return arbitrary exception text
        # that could contain a credential or provider response body.
        logger.warning("Model provider configuration rejected: %s", type(exc).__name__)
        raise HTTPException(
            status_code=400,
            detail=str(exc) if isinstance(exc, RuntimeError) else "模型 Provider 配置无效，请检查 API Key 和模型名称。",
        ) from None
    except (OpenAIAPIConnectionError, anthropic.APIConnectionError):
        logger.warning("Model provider connection failed")
        raise HTTPException(
            status_code=502,
            detail="无法连接模型服务，请检查网络和 Provider Base URL。",
        ) from None
    return ChatResponse(content=result["content"], animationId=result["animation_id"])


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
    )
    return MemoryRecordResponse()


@router.get("/memory/profile")
async def memory_profile():
    """Expose only local learning aggregates needed by the progress views."""
    return await memory.profile_snapshot()


@router.get("/memory/export")
async def export_memory():
    """Download local learning history, vector records, and ReMe/Chroma files."""
    archive = await memory.export_archive()
    return Response(
        content=archive,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="algocoach-memory.zip"'},
    )


@router.post("/animate")
async def animate(req: AnimateRequest):
    """Manually request an animation (from frontend, e.g., button click)."""
    job = await animation_service.enqueue(
        kind=req.type,
        topic=req.topic,
        title=req.title,
        problem_id=req.problemId,
    )
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
