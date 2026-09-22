import pytest
from httpx import AsyncClient, ASGITransport
from app.services.gateway import app as gateway_app
from app.services.auth_service import app as auth_app
from app.services.widget_service import app as widget_app
from app.services.chat_service import app as chat_app

@pytest.mark.asyncio
async def test_gateway_metrics():
    async with AsyncClient(transport=ASGITransport(app=gateway_app), base_url="http://test") as ac:
        response = await ac.get("/metrics")
        assert response.status_code == 200
        assert "http_requests_total" in response.text or "http_request_duration_seconds" in response.text

@pytest.mark.asyncio
async def test_auth_service_metrics():
    async with AsyncClient(transport=ASGITransport(app=auth_app), base_url="http://test") as ac:
        response = await ac.get("/metrics")
        assert response.status_code == 200
        assert "http_requests_total" in response.text or "http_request_duration_seconds" in response.text

@pytest.mark.asyncio
async def test_widget_service_metrics():
    async with AsyncClient(transport=ASGITransport(app=widget_app), base_url="http://test") as ac:
        response = await ac.get("/metrics")
        assert response.status_code == 200
        assert "http_requests_total" in response.text or "http_request_duration_seconds" in response.text

@pytest.mark.asyncio
async def test_chat_service_metrics():
    async with AsyncClient(transport=ASGITransport(app=chat_app), base_url="http://test") as ac:
        response = await ac.get("/metrics")
        assert response.status_code == 200
        assert "http_requests_total" in response.text or "http_request_duration_seconds" in response.text
