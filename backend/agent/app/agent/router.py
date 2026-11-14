"""HTTP routes for the agent service."""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import ValidationError

from app.agent.coach import coach
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


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Main agent conversation endpoint."""
    # The public contract has no session field; use one stable process-wide
    # session so AgentScope keeps conversation and ReMe writes scoped to it.
    session_id = chat_session_id()
    if req.provider is None:
        result = await coach.chat(
            session_id=session_id,
            message=req.message,
            mode=req.mode,
            problem_id=req.problemId,
            goal=req.goal,
            training_phase=req.trainingPhase,
            time_remaining_sec=req.timeRemainingSec,
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
            provider=req.provider.model_dump(),
        )
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
