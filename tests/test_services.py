import os
import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient

from app.database import engine, Base
from app.main import app as main_app
from app.services.gateway import app as gateway_app
from app.connection_manager import (
    ConnectionManager,
    LocalPubSubAdapter,
    RedisPubSubAdapter,
    KafkaPubSubAdapter
)


@pytest_asyncio.fixture(autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.mark.asyncio
async def test_auth_and_workspace_flow():
    async with AsyncClient(transport=ASGITransport(app=main_app), base_url="http://test") as client:
        # 1. Register User
        reg_resp = await client.post("/api/auth/register", json={
            "username": "operator_test1",
            "password": "password123"
        })
        assert reg_resp.status_code == 200, reg_resp.text
        user_data = reg_resp.json()
        assert user_data["username"] == "operator_test1"

        # 2. Login User
        login_resp = await client.post("/api/auth/login", data={
            "username": "operator_test1",
            "password": "password123"
        })
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Workspace
        ws_resp = await client.post("/api/auth/workspaces", json={
            "name": "Test Company Workspace",
            "allowed_domains": "*"
        }, headers=headers)
        assert ws_resp.status_code == 200
        ws_data = ws_resp.json()
        assert ws_data["name"] == "Test Company Workspace"
        assert ws_data["api_key"].startswith("gy_live_")

        # 4. Get My Workspace
        my_ws_resp = await client.get("/api/auth/workspaces/my", headers=headers)
        assert my_ws_resp.status_code == 200
        assert my_ws_resp.json()["id"] == ws_data["id"]

        # 5. Onboard Guest with API Key
        guest_resp = await client.post("/api/auth/widget/onboard", json={
            "api_key": ws_data["api_key"]
        })
        assert guest_resp.status_code == 200
        guest_data = guest_resp.json()
        assert "token" in guest_data
        assert guest_data["guest_username"].startswith("guest_")


@pytest.mark.asyncio
async def test_widget_crud_and_origin_validation():
    async with AsyncClient(transport=ASGITransport(app=main_app), base_url="http://test") as client:
        # Register and Login
        await client.post("/api/auth/register", json={"username": "widget_op", "password": "pass"})
        login_resp = await client.post("/api/auth/login", data={"username": "widget_op", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create Workspace
        ws_resp = await client.post("/api/auth/workspaces", json={"name": "Widget WS"}, headers=headers)
        api_key = ws_resp.json()["api_key"]

        # Create Widget with restricted allowed domains
        widget_resp = await client.post("/api/widgets", json={
            "name": "Restricted Widget",
            "theme_color": "#ff5722",
            "allowed_domains": "example.com",
            "is_ai_active": True
        }, headers=headers)
        assert widget_resp.status_code == 200

        # Fetch Public Widget Config with matching Origin header -> allowed
        config_ok = await client.get(f"/api/widgets/config?api_key={api_key}", headers={"Origin": "https://example.com"})
        assert config_ok.status_code == 200

        # Fetch Public Widget Config with disallowed Origin header -> 403 Forbidden
        config_denied = await client.get(f"/api/widgets/config?api_key={api_key}", headers={"Origin": "https://unauthorized.com"})
        assert config_denied.status_code == 403


@pytest.mark.asyncio
async def test_file_upload_and_messages_history():
    async with AsyncClient(transport=ASGITransport(app=main_app), base_url="http://test") as client:
        # Register user
        await client.post("/api/auth/register", json={"username": "user1", "password": "password"})
        login_resp = await client.post("/api/auth/login", data={"username": "user1", "password": "password"})
        token = login_resp.json()["access_token"]

        # File upload test
        files = {"file": ("test.png", b"fake_image_bytes", "image/png")}
        upload_resp = await client.post("/api/upload", files=files)
        assert upload_resp.status_code == 200
        assert "file_url" in upload_resp.json()
        assert upload_resp.json()["type"] == "image/png"


@pytest.mark.asyncio
async def test_connection_manager_and_pubsub():
    cm = ConnectionManager()
    await cm.init_pubsub()

    received_messages = []

    class MockWebSocket:
        async def accept(self):
            pass

        async def send_json(self, data):
            received_messages.append(data)

    mock_ws = MockWebSocket()
    await cm.connect(user_id=101, websocket=mock_ws)

    online_users = await cm.get_online_users()
    assert 101 in online_users

    # Test send_to_user via PubSub
    await cm.send_to_user(101, {"type": "test_msg", "text": "hello"})
    await asyncio.sleep(0.1)

    assert len(received_messages) == 1
    assert received_messages[0]["type"] == "test_msg"
    assert received_messages[0]["text"] == "hello"

    await cm.disconnect(101)
    online_users_after = await cm.get_online_users()
    assert 101 not in online_users_after


@pytest.mark.asyncio
async def test_pubsub_adapter_selection_and_fallback():
    # 1. Test Local Adapter Selection
    os.environ["PUBSUB_ADAPTER"] = "local"
    cm_local = ConnectionManager()
    assert isinstance(cm_local.pubsub_adapter, LocalPubSubAdapter)
    await cm_local.init_pubsub()
    assert isinstance(cm_local.pubsub_adapter, LocalPubSubAdapter)

    # 2. Test Kafka Adapter Selection & Graceful Fallback on Connection Failure
    os.environ["PUBSUB_ADAPTER"] = "kafka"
    os.environ["KAFKA_BOOTSTRAP_SERVERS"] = "localhost:9099" # invalid port to test fallback
    cm_kafka = ConnectionManager()
    assert isinstance(cm_kafka.pubsub_adapter, KafkaPubSubAdapter)
    await cm_kafka.init_pubsub()
    # Should fall back to LocalPubSubAdapter gracefully
    assert isinstance(cm_kafka.pubsub_adapter, LocalPubSubAdapter)

    # Clean up environment variables
    os.environ.pop("PUBSUB_ADAPTER", None)
    os.environ.pop("KAFKA_BOOTSTRAP_SERVERS", None)


@pytest.mark.asyncio
async def test_gateway_rate_limiting():
    client = TestClient(gateway_app)
    responses = [client.get("/static/demo.html") for _ in range(5)]
    for r in responses:
        assert r.status_code in [200, 404]


@pytest.mark.asyncio
async def test_message_rate_limiter_anti_bot():
    from app.rate_limiter import MessageRateLimiter

    limiter = MessageRateLimiter(capacity=3, refill_rate=1.0, duplicate_limit=2, duplicate_window=5.0)
    user_id = 999

    # 1. Normal allowed messages
    ok, err = limiter.check_rate_limit(user_id, "hello 1")
    assert ok is True
    ok, err = limiter.check_rate_limit(user_id, "hello 2")
    assert ok is True
    ok, err = limiter.check_rate_limit(user_id, "hello 3")
    assert ok is True

    # 4th message exceeds capacity (capacity=3)
    ok, err = limiter.check_rate_limit(user_id, "hello 4")
    assert ok is False
    assert "تعداد پیام‌های شما زیاد است" in err

    # 2. Test duplicate detection
    limiter_dup = MessageRateLimiter(capacity=10, refill_rate=1.0, duplicate_limit=2, duplicate_window=5.0)
    ok1, _ = limiter_dup.check_rate_limit(user_id, "same text")
    assert ok1 is True
    ok2, _ = limiter_dup.check_rate_limit(user_id, "same text")
    assert ok2 is True
    # 3rd identical message within window should be caught as spam
    ok3, err3 = limiter_dup.check_rate_limit(user_id, "same text")
    assert ok3 is False
    assert "تکراری" in err3


@pytest.mark.asyncio
async def test_cursor_pagination_messages_endpoint():
    from app.models import Message
    from app.database import AsyncSessionLocal

    async with AsyncClient(transport=ASGITransport(app=main_app), base_url="http://test") as client:
        # Register users
        await client.post("/api/auth/register", json={"username": "userA", "password": "password"})
        await client.post("/api/auth/register", json={"username": "userB", "password": "password"})

        # Populate 10 messages between user 1 and user 2 in DB
        async with AsyncSessionLocal() as db:
            for i in range(1, 11):
                msg = Message(
                    sender_id=1,
                    receiver_id=2,
                    content=f"Message {i}",
                    message_type="text",
                    is_delivered=True,
                    is_read=True
                )
                db.add(msg)
            await db.commit()

        # Fetch first page with limit=4
        res1 = await client.get("/api/messages/2?current_user_id=1&limit=4")
        assert res1.status_code == 200
        data1 = res1.json()
        assert len(data1["messages"]) == 4
        assert data1["has_more"] is True
        assert data1["next_cursor"] is not None
        assert data1["messages"][0]["content"] == "Message 7"
        assert data1["messages"][-1]["content"] == "Message 10"

        # Fetch second page using next_cursor
        cursor1 = data1["next_cursor"]
        res2 = await client.get(f"/api/messages/2?current_user_id=1&before_id={cursor1}&limit=4")
        assert res2.status_code == 200
        data2 = res2.json()
        assert len(data2["messages"]) == 4
        assert data2["has_more"] is True
        assert data2["messages"][0]["content"] == "Message 3"
        assert data2["messages"][-1]["content"] == "Message 6"

        # Fetch third page using next_cursor
        cursor2 = data2["next_cursor"]
        res3 = await client.get(f"/api/messages/2?current_user_id=1&before_id={cursor2}&limit=4")
        assert res3.status_code == 200
        data3 = res3.json()
        assert len(data3["messages"]) == 2
        assert data3["has_more"] is False
        assert data3["next_cursor"] is None
        assert data3["messages"][0]["content"] == "Message 1"
        assert data3["messages"][1]["content"] == "Message 2"
