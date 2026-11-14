"""
AlgoCoach — Python FastAPI agent service.

Routes:
  POST /chat          — main agent conversation endpoint
  POST /animate       — request a prebuilt Remotion animation job
  POST /animate/generated — P2 sandboxed generated TSX (default off)
  GET  /animate/{id}  — poll animation job status
  POST /memory/record — gateway callback: persist a finished submission
  GET  /memory/profile — local progress and knowledge graph aggregates
  GET  /memory/export — ZIP download of local memories and indexes

Startup runs the additive SQLite migration and starts the cron scheduler
exactly once; shutdown stops it and closes the embedded ReMe app.
``ALGOCOACH_CRONS_ENABLED=false`` disables scheduled jobs for tests and local
runs.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.coach import coach
from app.agent.crons import shutdown_crons, start_crons
from app.agent.router import router as agent_router
from app.memory.db import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    await start_crons()
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
