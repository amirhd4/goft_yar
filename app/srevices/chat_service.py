import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import chat_router
from app.connection_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    await manager.init_pubsub()
    yield
    try:
        await manager.pubsub_adapter.disconnect()
    except Exception:
        pass


app = FastAPI(title="Goftyar Chat & Presence Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(chat_router.router)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")