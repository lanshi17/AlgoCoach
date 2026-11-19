"""
AlgoCoach — Python FastAPI agent service.

Routes:
  POST /chat/stream   — streaming agent conversation endpoint
  POST /chat/replay   — replay persisted terminal turn events
  POST /animate       — request a prebuilt Remotion animation job
  POST /animate/generated — P2 sandboxed generated TSX (default off)
  GET  /animate/{id}  — poll animation job status
  POST /memory/record — gateway callback: persist a finished submission
  GET  /memory/profile — local progress and knowledge graph aggregates
  GET  /memory/mastery-path — ordered, explainable next learning steps
  GET  /memory/export — ZIP download of local memories and indexes

Startup creates the current SQLite schema and starts the cron scheduler exactly
once; shutdown stops it and closes the embedded ReMe app.
``ALGOCOACH_CRONS_ENABLED=false`` disables scheduled jobs for tests and local
runs.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.coach import coach
from app.agent.crons import shutdown_crons, start_crons
from app.agent.router import router as agent_router
from app.memory.db import init_db
from app.memory.algorithm_knowledge import seed_algorithm_knowledge

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    await start_crons()
    # ReMe's embedded AgentScope configuration indexes Markdown in daily/ and
    # digest/. Seed the notes archive before the first lazy ReMe startup so its
    # initial file scan sees the algorithm knowledge.
    try:
        await asyncio.to_thread(seed_algorithm_knowledge)
    except Exception:  # noqa: BLE001 - local knowledge import must not block API startup
        logger.exception("Could not seed the ReMe algorithm knowledge library")
    try:
        yield
    finally:
        await shutdown_crons()
        # The embedded ReMe app has no framework-managed lifecycle; close it
        # explicitly so its file watchers/index jobs stop with the process.
        await coach.close()


app = FastAPI(title="AlgoCoach Agent", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)
