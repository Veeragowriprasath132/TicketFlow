"""
TicketFlow — Mock Ticketing System
main.py — FastAPI entry point
"""
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 TicketFlow starting...")
    from database import init_db
    init_db()
    logger.info("✅ Database ready")
    yield
    logger.info("TicketFlow shutting down.")


app = FastAPI(
    title="TicketFlow API",
    description="Mock Ticketing System — integrates with ServicePulse",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes import router
app.include_router(router)

# Serve frontend
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/", include_in_schema=False)
    def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/health")
def health():
    return {"status": "ok", "app": "TicketFlow", "version": "1.0.0"}


@app.get("/api")
def api_root():
    return {
        "message": "TicketFlow API",
        "docs": "/docs",
        "endpoints": ["/api/tickets", "/api/teams", "/api/agents", "/api/sync"]
    }
