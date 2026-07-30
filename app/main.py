from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.routers import auth_router, chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Goft Yar - Core Engine", version="1.0.0", lifespan=lifespan)

app.include_router(auth_router.router)
app.include_router(chat_router.router)

app.mount("/static", StaticFiles(directory="static"), name="static")