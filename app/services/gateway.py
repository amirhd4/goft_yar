import os
import time
import asyncio
from typing import Dict, Tuple
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import httpx

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
WIDGET_SERVICE_URL = os.getenv("WIDGET_SERVICE_URL", "http://localhost:8002")
CHAT_SERVICE_URL = os.getenv("CHAT_SERVICE_URL", "http://localhost:8003")

from app.logging_config import setup_observability

app = FastAPI(title="Goftyar API Gateway", version="1.0.0")
setup_observability(app, service_name="gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Token Bucket Rate Limiting
class TokenBucket:
    def __init__(self, capacity: int = 60, refill_rate: float = 1.0):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = capacity
        self.last_update = time.time()

    def consume(self) -> bool:
        now = time.time()
        elapsed = now - self.last_update
        self.last_update = now
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

rate_limiters: Dict[str, TokenBucket] = {}

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Exempt static files or docs from rate limiting
    if request.url.path.startswith("/static") or request.url.path.startswith("/docs"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    if client_ip not in rate_limiters:
        rate_limiters[client_ip] = TokenBucket(capacity=100, refill_rate=2.0)

    bucket = rate_limiters[client_ip]
    if not bucket.consume():
        return Response(content="Rate limit exceeded. Too many requests.", status_code=429)

    return await call_next(request)


# Helper function to forward HTTP requests to target microservices
async def proxy_http_request(target_base_url: str, request: Request) -> Response:
    path = request.url.path
    query = request.url.query
    url = f"{target_base_url}{path}" + (f"?{query}" if query else "")

    headers = dict(request.headers)
    headers.pop("host", None)

    content = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            rp_req = client.build_request(
                method=request.method,
                url=url,
                headers=headers,
                content=content,
            )
            rp_resp = await client.send(rp_req)
            return Response(
                content=rp_resp.content,
                status_code=rp_resp.status_code,
                headers=dict(rp_resp.headers),
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Downstream service unavailable: {str(exc)}",
            )


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "gateway"}

# Route REST endpoints
@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def route_auth(request: Request, path: str):
    return await proxy_http_request(AUTH_SERVICE_URL, request)

@app.api_route("/api/widgets/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def route_widgets_sub(request: Request, path: str):
    return await proxy_http_request(WIDGET_SERVICE_URL, request)

@app.api_route("/api/widgets", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def route_widgets_root(request: Request):
    return await proxy_http_request(WIDGET_SERVICE_URL, request)

@app.api_route("/api/messages/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def route_messages(request: Request, path: str):
    return await proxy_http_request(CHAT_SERVICE_URL, request)

@app.api_route("/api/upload", methods=["POST"])
async def route_upload(request: Request):
    return await proxy_http_request(CHAT_SERVICE_URL, request)

@app.api_route("/uploads/{path:path}", methods=["GET"])
async def route_uploads_static(request: Request, path: str):
    return await proxy_http_request(CHAT_SERVICE_URL, request)


# WebSocket Proxy for /ws/chat
@app.websocket("/ws/chat")
async def websocket_proxy(websocket: WebSocket):
    query_params = websocket.query_params
    target_ws_url = CHAT_SERVICE_URL.replace("http://", "ws://").replace("https://", "wss://")
    ws_endpoint = f"{target_ws_url}/ws/chat?{query_params}"

    await websocket.accept()

    import websockets
    try:
        async with websockets.connect(ws_endpoint) as backend_ws:
            async def forward_to_backend():
                try:
                    while True:
                        msg = await websocket.receive_text()
                        await backend_ws.send(msg)
                except Exception:
                    pass

            async def forward_to_client():
                try:
                    while True:
                        msg = await backend_ws.recv()
                        await websocket.send_text(msg)
                except Exception:
                    pass

            await asyncio.gather(forward_to_backend(), forward_to_client())
    except Exception as e:
        print(f"Gateway WebSocket proxy error: {e}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass


# Mount static directory for widget assets
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")
