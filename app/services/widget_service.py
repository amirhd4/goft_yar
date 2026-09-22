from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import widget_router
from app.logging_config import setup_observability

app = FastAPI(title="Goftyar Widget Service", version="1.0.0")
setup_observability(app, service_name="widget-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "widget_service"}

app.include_router(widget_router.router)
