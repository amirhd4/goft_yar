from fastapi import FastAPI
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

@app.get("/", tags=["Root"])
async def read_root():
    """A simple hello world endpoint."""
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}